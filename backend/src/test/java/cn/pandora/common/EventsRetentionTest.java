package cn.pandora.common;

import org.junit.jupiter.api.Test;

import java.time.*;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** DEV-032: three company-local calendar months with month-end truncation. */
class EventsRetentionTest {
    private static final ZoneId SHANGHAI = ZoneId.of("Asia/Shanghai");

    @Test
    void retainsThreeCalendarMonthsAndTruncatesToTheTargetMonthEnd() {
        Instant october = ZonedDateTime.of(2026, 10, 31, 9, 0, 0, 0, SHANGHAI).toInstant();
        assertEquals(ZonedDateTime.of(2027, 1, 31, 9, 0, 0, 0, SHANGHAI).toInstant(),
                Events.retentionEndsAt(october, SHANGHAI));
        Instant january = ZonedDateTime.of(2027, 1, 31, 9, 0, 0, 0, SHANGHAI).toInstant();
        assertEquals(ZonedDateTime.of(2027, 4, 30, 9, 0, 0, 0, SHANGHAI).toInstant(),
                Events.retentionEndsAt(january, SHANGHAI));
        Instant leap = ZonedDateTime.of(2027, 11, 30, 9, 0, 0, 0, SHANGHAI).toInstant();
        assertEquals(ZonedDateTime.of(2028, 2, 29, 9, 0, 0, 0, SHANGHAI).toInstant(),
                Events.retentionEndsAt(leap, SHANGHAI), "leap-year February keeps day 29");
    }

    @Test
    void usesTheCompanyZoneForTheLocalMoment() {
        Instant instant = Instant.parse("2026-10-31T16:30:00Z"); // 2026-11-01 00:30 in Shanghai
        assertEquals(Instant.parse("2027-01-31T16:30:00Z"), Events.retentionEndsAt(instant, SHANGHAI));
    }
}
