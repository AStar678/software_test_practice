package cn.pandora.workspace;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import cn.pandora.common.Writes;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static cn.pandora.common.Db.*;

/**
 * Private daily items: one inclusive Gregorian date range, one plain-text body and an explicit
 * completed flag, owned by one employee. No task, log, tag, assignee or approval is reachable from
 * here, and every read and write is filtered by organization and owner so上级、管理员及跨公司用户
 * cannot observe another person's items. A ranged item stays one record: completing it from any
 * covered day completes the whole record and never copies it into per-day rows.
 */
@Service
public class DailyItemService {
    /** A single summary or range query stays inside one closed range of at most 93 days (a quarter). */
    public static final int MAX_SUMMARY_DAYS = 93;
    public static final int MAX_BODY = 2000;
    private static final int MAX_LIST_PAGE = 100;
    private static final Set<String> BUSINESS_ROLES = Set.of("founder", "department_head", "team_head", "employee");
    private final Db db;
    private final Access access;
    private final Events events;
    private final Clock clock;

    public DailyItemService(Db db, Access access, Events events, Clock clock) {
        this.db = db;
        this.access = access;
        this.events = events;
        this.clock = clock;
    }

    /* ---------------------------------------------------------------- reads */

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Map<String, Object> summary(Actor a, Map<String, String> filters) {
        business(a);
        if (!Set.of("from", "to").containsAll(filters.keySet()))
            throw bad("汇总接口当前仅支持 from、to");
        LocalDate from = date(filters.get("from"), "from");
        LocalDate to = date(filters.get("to"), "to");
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        if (days < 1) throw bad("from 不能晚于 to");
        if (days > MAX_SUMMARY_DAYS) throw bad("汇总范围最多 " + MAX_SUMMARY_DAYS + " 天");
        ZoneId zone = zone(a);
        LocalDate businessDate = businessDate(zone);
        // One ranged record is counted once on every day it actually covers. A record starting
        // before the window or ending after it still contributes to each overlapping day.
        var rows = db.list("SELECT start_date,end_date,completed FROM daily_items "
                        + "WHERE organization_id=? AND owner_id=? AND start_date<=? AND end_date>=?",
                a.organizationId(), a.id(), Date.valueOf(to), Date.valueOf(from));
        Map<LocalDate, long[]> counts = new TreeMap<>();
        for (var row : rows) {
            LocalDate start = LocalDate.parse(s(row, "startDate"));
            LocalDate end = LocalDate.parse(s(row, "endDate"));
            LocalDate cursor = start.isBefore(from) ? from : start;
            LocalDate last = end.isAfter(to) ? to : end;
            boolean completed = flag(row.get("completed"));
            while (!cursor.isAfter(last)) {
                long[] count = counts.computeIfAbsent(cursor, ignored -> new long[2]);
                if (completed) count[1]++; else count[0]++;
                cursor = cursor.plusDays(1);
            }
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (var entry : counts.entrySet()) {
            var day = new LinkedHashMap<String, Object>();
            day.put("date", entry.getKey().toString());
            day.put("openCount", entry.getValue()[0]);
            day.put("completedCount", entry.getValue()[1]);
            result.add(day);
        }
        // Days absent from the list are confirmed zero counts for that closed range; a failed request
        // never returns an empty 200 list, so callers cannot mistake a failure for "nothing to do".
        var response = new LinkedHashMap<String, Object>();
        response.put("from", from.toString());
        response.put("to", to.toString());
        response.put("maxDays", MAX_SUMMARY_DAYS);
        response.put("businessDate", businessDate.toString());
        response.put("organizationTimeZone", zone.getId());
        response.put("days", result);
        return response;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Map<String, Object> list(Actor a, Map<String, String> filters) {
        business(a);
        if (!Set.of("date", "from", "to", "limit", "offset").containsAll(filters.keySet()))
            throw bad("清单接口当前仅支持 date、from、to、limit、offset");
        LocalDate day = filters.containsKey("date") ? date(filters.get("date"), "date") : null;
        LocalDate from = filters.containsKey("from") ? date(filters.get("from"), "from") : null;
        LocalDate to = filters.containsKey("to") ? date(filters.get("to"), "to") : null;
        if (day != null && (from != null || to != null)) throw bad("date 与 from/to 不能混用");
        if (day == null && (from == null || to == null)) throw bad("必须提供 date，或同时提供 from、to");
        if (from != null) {
            long days = ChronoUnit.DAYS.between(from, to) + 1;
            if (days < 1) throw bad("from 不能晚于 to");
            if (days > MAX_SUMMARY_DAYS) throw bad("范围查询最多 " + MAX_SUMMARY_DAYS + " 天");
        }
        int limit = number(filters, "limit", 50, 1, MAX_LIST_PAGE);
        int offset = number(filters, "offset", 0, 0, Integer.MAX_VALUE);
        ZoneId zone = zone(a);
        LocalDate businessDate = businessDate(zone);
        String predicate = "organization_id=? AND owner_id=? AND start_date<=? AND end_date>=?";
        Object searchFrom = Date.valueOf(day == null ? from : day);
        Object searchTo = Date.valueOf(day == null ? to : day);
        long total = n(db.one("SELECT COUNT(*) AS c FROM daily_items WHERE " + predicate,
                a.organizationId(), a.id(), searchTo, searchFrom), "c");
        var rows = db.list("SELECT id,start_date,end_date,body,completed,row_version,created_at,updated_at FROM daily_items "
                        + "WHERE " + predicate + " ORDER BY created_at,id LIMIT ? OFFSET ?",
                a.organizationId(), a.id(), searchTo, searchFrom, limit, offset);
        List<Map<String, Object>> items = rows.stream().map(row -> view(row, businessDate)).toList();
        var response = new LinkedHashMap<String, Object>();
        if (day != null) response.put("date", day.toString());
        else { response.put("from", from.toString()); response.put("to", to.toString()); }
        response.put("items", items);
        response.put("total", total);
        response.put("limit", limit);
        response.put("offset", offset);
        response.put("nextOffset", (long) offset + items.size() < total ? offset + items.size() : null);
        response.put("businessDate", businessDate.toString());
        response.put("organizationTimeZone", zone.getId());
        return response;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Map<String, Object> detail(Actor a, String itemId) {
        business(a);
        ZoneId zone = zone(a);
        return view(read(a, itemId, false), businessDate(zone));
    }

    /* --------------------------------------------------------------- writes */

    public Map<String, Object> create(Actor a, Map<String, Object> body) {
        business(a);
        allowed(body, Set.of("startDate", "endDate", "date", "body"));
        boolean legacy = body.containsKey("date");
        if (legacy && (body.containsKey("startDate") || body.containsKey("endDate")))
            throw bad("date 与 startDate/endDate 不能混用");
        LocalDate start;
        LocalDate end;
        if (legacy) {
            start = date(body.get("date"), "date");
            end = start;
        } else {
            start = date(body.get("startDate"), "startDate");
            end = date(body.get("endDate"), "endDate");
        }
        requireRange(start, end);
        String content = required(body, "body", MAX_BODY);
        String itemId = id();
        db.update("INSERT INTO daily_items(id,organization_id,owner_id,start_date,end_date,body,completed,row_version) VALUES(?,?,?,?,?,?,FALSE,1)",
                itemId, a.organizationId(), a.id(), Date.valueOf(start), Date.valueOf(end), content);
        events.recordObject(a, null, "daily_item.created", List.of(),
                Map.of("dailyItemId", itemId, "startDate", start.toString(), "endDate", end.toString()), null, null, null, null, "daily_item", itemId);
        var result = new LinkedHashMap<String, Object>();
        result.put("id", itemId);
        result.put("startDate", start.toString());
        result.put("endDate", end.toString());
        result.put("date", start.toString());
        result.put("rowVersion", 1);
        result.put("businessDate", businessDate(zone(a)).toString());
        return result;
    }

    public Map<String, Object> change(Actor a, String itemId, String ifMatch, Map<String, Object> body) {
        business(a);
        allowed(body, Set.of("startDate", "endDate", "date", "body", "completed"));
        var item = read(a, itemId, true);
        Writes.checkVersion(ifMatch, n(item, "rowVersion"));
        LocalDate currentStart = LocalDate.parse(s(item, "startDate"));
        LocalDate currentEnd = LocalDate.parse(s(item, "endDate"));
        boolean hasPair = body.containsKey("startDate") || body.containsKey("endDate");
        boolean hasLegacyDate = body.containsKey("date");
        if (hasLegacyDate && hasPair) throw bad("date 与 startDate/endDate 不能混用");
        LocalDate start = currentStart;
        LocalDate end = currentEnd;
        if (hasLegacyDate) {
            // Old clients may still address a genuine single-day record. A ranged record is never
            // silently compressed, even when the supplied date equals its start date.
            if (!currentStart.equals(currentEnd))
                throw new ApiException(409, "DAILY_ITEM_RANGE_REQUIRED", "该事项已跨日，请使用 startDate 与 endDate 更新");
            start = date(body.get("date"), "date");
            end = start;
        } else if (hasPair) {
            if (!body.containsKey("startDate") || !body.containsKey("endDate"))
                throw bad("startDate 与 endDate 必须同时提供");
            start = date(body.get("startDate"), "startDate");
            end = date(body.get("endDate"), "endDate");
        }
        requireRange(start, end);
        String content = body.containsKey("body") ? required(body, "body", MAX_BODY) : s(item, "body");
        boolean completed = body.containsKey("completed") ? bool(body.get("completed")) : flag(item.get("completed"));
        long next = n(item, "rowVersion") + 1;
        db.update("UPDATE daily_items SET start_date=?,end_date=?,body=?,completed=?,row_version=?,updated_at=CURRENT_TIMESTAMP(6) "
                        + "WHERE organization_id=? AND owner_id=? AND id=?",
                Date.valueOf(start), Date.valueOf(end), content, completed, next,
                a.organizationId(), a.id(), itemId);
        events.recordObject(a, null, "daily_item.updated", List.of(),
                Map.of("dailyItemId", itemId, "startDate", start.toString(), "endDate", end.toString()), null, null, null, null, "daily_item", itemId);
        var result = new LinkedHashMap<String, Object>();
        result.put("id", itemId);
        result.put("startDate", start.toString());
        result.put("endDate", end.toString());
        result.put("date", start.toString());
        result.put("completed", completed);
        result.put("rowVersion", next);
        result.put("businessDate", businessDate(zone(a)).toString());
        return result;
    }

    public Map<String, Object> delete(Actor a, String itemId, String ifMatch) {
        business(a);
        var item = read(a, itemId, true);
        Writes.checkVersion(ifMatch, n(item, "rowVersion"));
        db.update("DELETE FROM daily_items WHERE organization_id=? AND owner_id=? AND id=?", a.organizationId(), a.id(), itemId);
        events.recordObject(a, null, "daily_item.deleted", List.of(),
                Map.of("dailyItemId", itemId, "startDate", s(item, "startDate"), "endDate", s(item, "endDate")),
                null, null, null, null, "daily_item", itemId);
        return Map.of("id", itemId, "deleted", true);
    }

    /* --------------------------------------------------------------- helpers */

    /** An employee principal whose session still matches the current company authority snapshot. */
    private void business(Actor a) {
        if (a.administrator()) throw new ApiException(403, "BUSINESS_ROLE_REQUIRED", "管理员请使用管理端接口");
        access.requireCurrent(a);
        if (!BUSINESS_ROLES.contains(a.role()))
            throw new ApiException(403, "BUSINESS_ROLE_REQUIRED", "仅本公司有效业务账号可维护每日事项");
    }

    private Map<String, Object> read(Actor a, String itemId, boolean lock) {
        if (itemId == null || itemId.isBlank()) throw ApiException.notFound();
        return db.one("SELECT id,start_date,end_date,body,completed,row_version,created_at,updated_at FROM daily_items "
                        + "WHERE organization_id=? AND owner_id=? AND id=?" + (lock ? " FOR UPDATE" : ""),
                a.organizationId(), a.id(), itemId);
    }

    private Map<String, Object> view(Map<String, Object> row, LocalDate businessDate) {
        LocalDate start = LocalDate.parse(s(row, "startDate"));
        LocalDate end = LocalDate.parse(s(row, "endDate"));
        boolean completed = flag(row.get("completed"));
        var out = new LinkedHashMap<String, Object>();
        out.put("id", s(row, "id"));
        out.put("startDate", start.toString());
        out.put("endDate", end.toString());
        // Legacy response projection only: the effective range is startDate/endDate. New clients must
        // never treat this single date as the whole record.
        out.put("date", start.toString());
        out.put("body", s(row, "body"));
        out.put("completed", completed);
        out.put("status", completed ? "completed" : businessDate.isAfter(end) ? "overdue" : "open");
        out.put("rowVersion", n(row, "rowVersion"));
        out.put("createdAt", s(row, "createdAt"));
        out.put("updatedAt", s(row, "updatedAt"));
        return out;
    }

    private static void requireRange(LocalDate start, LocalDate end) {
        if (end.isBefore(start)) throw bad("endDate 不能早于 startDate");
    }

    /** Company business date; never a device-local date. */
    private LocalDate businessDate(ZoneId zone) {
        return clock.instant().atZone(zone).toLocalDate();
    }

    private ZoneId zone(Actor a) {
        Map<String, Object> company = db.one("SELECT time_zone FROM organizations WHERE id=?", a.organizationId());
        try {
            return ZoneId.of(s(company, "timeZone"));
        } catch (RuntimeException error) {
            throw new ApiException(409, "INVALID_ORGANIZATION_ZONE", "组织时区配置无效");
        }
    }

    /** Strict ISO calendar date; never a UTC midnight timestamp that can drift with the device zone. */
    private static LocalDate date(Object value, String field) {
        if (!(value instanceof String text) || text.isBlank())
            throw bad(field + " 必须为 YYYY-MM-DD 有效日期");
        try {
            LocalDate parsed = LocalDate.parse(text.trim());
            if (!parsed.toString().equals(text.trim())) throw new DateTimeParseException("非规范日期", text, 0);
            return parsed;
        } catch (DateTimeParseException error) {
            throw bad(field + " 必须为 YYYY-MM-DD 有效日期");
        }
    }

    private static boolean bool(Object value) {
        if (!(value instanceof Boolean)) throw bad("completed 必须为布尔值");
        return (Boolean) value;
    }

    private static ApiException bad(String message) {
        return new ApiException(400, "INVALID_INPUT", message);
    }

    private static void allowed(Map<String, Object> body, Set<String> keys) {
        if (!keys.containsAll(body.keySet())) throw bad("请求含不支持的字段");
    }

    private static String required(Map<String, Object> body, String key, int max) {
        if (!(body.get(key) instanceof String)) throw bad(key + " 必须为文字");
        String value = s(body, key);
        value = value == null ? null : value.trim();
        if (value == null || value.isEmpty() || value.length() > max)
            throw bad(key + " 不能为空且不得超过 " + max + " 字");
        return value;
    }

    private static int number(Map<String, String> filters, String key, int fallback, int min, int max) {
        try {
            int value = Integer.parseInt(filters.getOrDefault(key, Integer.toString(fallback)));
            if (value < min || value > max) throw new NumberFormatException();
            return value;
        } catch (Exception error) {
            throw bad(key + " 超出允许范围");
        }
    }

    private static boolean flag(Object value) {
        if (value instanceof Boolean b) return b;
        if (value instanceof Number number) return number.intValue() != 0;
        if (value instanceof String text) return "1".equals(text) || "true".equalsIgnoreCase(text);
        return false;
    }
}
