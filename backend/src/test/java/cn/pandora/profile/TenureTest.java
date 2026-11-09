package cn.pandora.profile;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class TenureTest {
    @Test
    void countsCompleteYearsMonthsAndDaysOnLeapAndMonthEnds() {
        // 29 February hire: anniversaries are clamped to 28 February in non-leap years.
        assertEquals(Map.of("years", 2, "months", 8, "days", 12, "asOfDate", "2026-11-09"),
                Tenure.of(LocalDate.parse("2024-02-29"), LocalDate.parse("2026-11-09")));
        // 31 January -> 1 March: one complete month anchored on 29 February, then one day.
        assertEquals(Map.of("years", 0, "months", 1, "days", 1, "asOfDate", "2024-03-01"),
                Tenure.of(LocalDate.parse("2024-01-31"), LocalDate.parse("2024-03-01")));
        // The clamped 28 February is the first real anniversary, not an incomplete year.
        assertEquals(Map.of("years", 1, "months", 0, "days", 0, "asOfDate", "2025-02-28"),
                Tenure.of(LocalDate.parse("2024-02-29"), LocalDate.parse("2025-02-28")));
        assertEquals(Map.of("years", 0, "months", 11, "days", 29, "asOfDate", "2025-02-27"),
                Tenure.of(LocalDate.parse("2024-02-29"), LocalDate.parse("2025-02-27")));
        assertEquals(Map.of("years", 1, "months", 0, "days", 1, "asOfDate", "2025-03-01"),
                Tenure.of(LocalDate.parse("2024-02-29"), LocalDate.parse("2025-03-01")));
    }

    @Test
    void handlesMissingAndFutureDatesAndNeverUsesFixedDayDivisors() {
        assertNull(Tenure.of(null, LocalDate.parse("2026-11-09")));
        assertNull(Tenure.of(LocalDate.parse("2026-11-10"), LocalDate.parse("2026-11-09")));
        assertEquals(Map.of("years", 0, "months", 0, "days", 0, "asOfDate", "2026-11-09"),
                Tenure.of(LocalDate.parse("2026-11-09"), LocalDate.parse("2026-11-09")));
        // 365 days is not one year when the anniversary falls on 29 February.
        Map<String, Object> leap = Tenure.of(LocalDate.parse("2024-02-29"), LocalDate.parse("2025-02-27"));
        assertEquals(0, leap.get("years"));
        assertEquals(11, leap.get("months"));
        assertEquals(29, leap.get("days"));
    }
}
