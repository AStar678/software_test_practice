package cn.pandora.calendar;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

class HolidayPayloadTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String NOTICE = "https://www.gov.cn/zhengce/content/202511/content_7047090.htm";

    private static byte[] payload(int year, String days) {
        return ("{\"year\":" + year + ",\"papers\":[\"" + NOTICE + "\"],\"days\":[" + days + "]}").getBytes(StandardCharsets.UTF_8);
    }

    @Test void acceptsOnePublishedYearAndSortsDays() {
        var year = HolidayPayload.parse(payload(2026,
                "{\"name\":\"国庆节\",\"date\":\"2026-10-01\",\"isOffDay\":true},"
                        + "{\"name\":\"国庆节\",\"date\":\"2026-09-20\",\"isOffDay\":false}"), 2026, MAPPER);
        assertEquals(2026, year.year());
        assertEquals("2026-09-20", year.days().get(0).date().toString());
        assertFalse(year.days().get(0).offDay());
        assertEquals("2026-10-01", year.days().get(1).date().toString());
        assertEquals(NOTICE, year.officialNotice());
        assertEquals(64, year.sourceHash().length());
    }

    @Test void rejectsAWrongYearAndCrossYearDates() {
        assertEquals("HOLIDAY_YEAR_MISMATCH", assertThrows(HolidaySourceException.class,
                () -> HolidayPayload.parse(payload(2025, day("2026-01-01", true)), 2026, MAPPER)).safeCode());
        assertEquals("HOLIDAY_DATE_OUT_OF_YEAR", assertThrows(HolidaySourceException.class,
                () -> HolidayPayload.parse(payload(2026, day("2025-12-31", true)), 2026, MAPPER)).safeCode());
    }

    @Test void rejectsDuplicateAndConflictingDates() {
        assertEquals("HOLIDAY_DATE_DUPLICATE", assertThrows(HolidaySourceException.class,
                () -> HolidayPayload.parse(payload(2026,
                        day("2026-01-01", true) + "," + day("2026-01-01", false)), 2026, MAPPER)).safeCode());
    }

    @Test void rejectsBlankNamesAndNonBooleanFlags() {
        assertEquals("HOLIDAY_PAYLOAD_INVALID", assertThrows(HolidaySourceException.class,
                () -> HolidayPayload.parse(payload(2026,
                        "{\"name\":\"  \",\"date\":\"2026-01-01\",\"isOffDay\":true}"), 2026, MAPPER)).safeCode());
        assertEquals("HOLIDAY_PAYLOAD_INVALID", assertThrows(HolidaySourceException.class,
                () -> HolidayPayload.parse(payload(2026,
                        "{\"name\":\"元旦\",\"date\":\"2026-01-01\",\"isOffDay\":\"true\"}"), 2026, MAPPER)).safeCode());
    }

    @Test void requiresAnOfficialNoticeAndAtLeastOneRestDay() {
        assertEquals("HOLIDAY_PAYLOAD_WITHOUT_NOTICE", assertThrows(HolidaySourceException.class,
                () -> HolidayPayload.parse(("{\"year\":2026,\"papers\":[],\"days\":[" + day("2026-01-01", true) + "]}")
                        .getBytes(StandardCharsets.UTF_8), 2026, MAPPER)).safeCode());
        assertEquals("HOLIDAY_PAYLOAD_INVALID", assertThrows(HolidaySourceException.class,
                () -> HolidayPayload.parse(payload(2026, day("2026-01-04", false)), 2026, MAPPER)).safeCode());
    }

    @Test void rejectsMalformedJsonAndAnEmptyBody() {
        assertEquals("HOLIDAY_PAYLOAD_INVALID", assertThrows(HolidaySourceException.class,
                () -> HolidayPayload.parse("not json".getBytes(StandardCharsets.UTF_8), 2026, MAPPER)).safeCode());
        assertEquals("HOLIDAY_PAYLOAD_EMPTY", assertThrows(HolidaySourceException.class,
                () -> HolidayPayload.parse(new byte[0], 2026, MAPPER)).safeCode());
    }

    private static String day(String date, boolean off) {
        return "{\"name\":\"元旦\",\"date\":\"" + date + "\",\"isOffDay\":" + off + "}";
    }
}
