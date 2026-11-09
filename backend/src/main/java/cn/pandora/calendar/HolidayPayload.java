package cn.pandora.calendar;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;

/**
 * Validates one annual holiday payload before it can replace the cached year.
 *
 * <p>The source is fixed server configuration, never a client URL. The payload contract follows the
 * year-file format used by the verified China holiday data set:
 * {@code {"year":2026,"papers":["https://..."],"days":[{"name":"元旦","date":"2026-01-01","isOffDay":true}]}}.
 * A payload is all-or-nothing: cross-year dates, duplicates, conflicting rest/work entries, blank
 * names, non-boolean flags or a missing official paper reference are rejected before any write.</p>
 */
public final class HolidayPayload {
    public record Day(LocalDate date, String name, boolean offDay) {}
    public record Year(int year, List<Day> days, String officialNotice, String sourceHash) {}

    private static final int MAX_DAYS = 400;
    private static final int MAX_NAME_LENGTH = 100;

    private HolidayPayload() {}

    public static Year parse(byte[] body, int expectedYear, ObjectMapper mapper) {
        if (body == null || body.length == 0) {
            throw new HolidaySourceException("HOLIDAY_PAYLOAD_EMPTY", "节假日年度数据为空");
        }
        JsonNode root;
        try {
            root = mapper.readTree(body);
        } catch (Exception exception) {
            throw new HolidaySourceException("HOLIDAY_PAYLOAD_INVALID", "节假日年度数据不是合法 JSON");
        }
        if (root == null || !root.isObject()) {
            throw new HolidaySourceException("HOLIDAY_PAYLOAD_INVALID", "节假日年度数据不是对象");
        }
        JsonNode yearNode = root.get("year");
        if (yearNode == null || !yearNode.isInt() || yearNode.intValue() != expectedYear) {
            throw new HolidaySourceException("HOLIDAY_YEAR_MISMATCH", "节假日数据年份与请求年份不一致");
        }
        JsonNode papers = root.get("papers");
        if (papers == null || !papers.isArray() || papers.isEmpty()) {
            throw new HolidaySourceException("HOLIDAY_PAYLOAD_WITHOUT_NOTICE", "节假日数据缺少官方通知依据");
        }
        for (JsonNode paper : papers) {
            if (!paper.isTextual() || !isHttpUrl(paper.textValue())) {
                throw new HolidaySourceException("HOLIDAY_PAYLOAD_WITHOUT_NOTICE", "节假日数据的官方通知地址无效");
            }
        }
        JsonNode days = root.get("days");
        if (days == null || !days.isArray() || days.isEmpty() || days.size() > MAX_DAYS) {
            throw new HolidaySourceException("HOLIDAY_PAYLOAD_INVALID", "节假日日期集合为空或超出上限");
        }
        List<Day> parsed = new ArrayList<>(days.size());
        Set<LocalDate> seen = new HashSet<>();
        boolean anyOffDay = false;
        for (JsonNode item : days) {
            if (!item.isObject()) {
                throw new HolidaySourceException("HOLIDAY_PAYLOAD_INVALID", "节假日日期项不是对象");
            }
            JsonNode dateNode = item.get("date");
            JsonNode nameNode = item.get("name");
            JsonNode offNode = item.get("isOffDay");
            if (dateNode == null || !dateNode.isTextual()
                    || nameNode == null || !nameNode.isTextual()
                    || offNode == null || !offNode.isBoolean()) {
                throw new HolidaySourceException("HOLIDAY_PAYLOAD_INVALID", "节假日日期项缺少合法 date/name/isOffDay");
            }
            LocalDate date;
            try {
                date = LocalDate.parse(dateNode.textValue().strip());
            } catch (DateTimeParseException exception) {
                throw new HolidaySourceException("HOLIDAY_PAYLOAD_INVALID", "节假日日期不是合法公历日期");
            }
            if (date.getYear() != expectedYear) {
                throw new HolidaySourceException("HOLIDAY_DATE_OUT_OF_YEAR", "节假日日期不属于请求年份");
            }
            String name = nameNode.textValue().strip();
            if (name.isEmpty() || name.length() > MAX_NAME_LENGTH) {
                throw new HolidaySourceException("HOLIDAY_PAYLOAD_INVALID", "节假日名称为空或超长");
            }
            if (!seen.add(date)) {
                throw new HolidaySourceException("HOLIDAY_DATE_DUPLICATE", "节假日日期重复");
            }
            boolean off = offNode.booleanValue();
            anyOffDay |= off;
            parsed.add(new Day(date, name, off));
        }
        if (!anyOffDay) {
            throw new HolidaySourceException("HOLIDAY_PAYLOAD_INVALID", "节假日数据没有任何休假日期");
        }
        parsed.sort(Comparator.comparing(Day::date));
        return new Year(expectedYear, List.copyOf(parsed), papers.get(0).textValue(), sha256(body));
    }

    private static boolean isHttpUrl(String value) {
        try {
            var uri = java.net.URI.create(value.strip());
            return ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && !uri.getHost().isBlank();
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private static String sha256(byte[] body) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(body));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    public static String utf8(byte[] body) {
        return new String(body, StandardCharsets.UTF_8);
    }
}
