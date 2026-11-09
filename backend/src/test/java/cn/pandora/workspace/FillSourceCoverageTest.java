package cn.pandora.workspace;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class FillSourceCoverageTest {
    private static final ZoneId SHANGHAI = ZoneId.of("Asia/Shanghai");
    private static final LocalDate DAY = LocalDate.parse("2026-11-09");

    private static Map<String, Object> timed(String start, String due) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("allDay", false);
        row.put("startAt", start);
        row.put("dueAt", due);
        return row;
    }

    @Test
    void timedTasksUseHalfOpenActualDayIntervals() {
        assertTrue(WorkspaceService.coversBusinessDay(timed("2026-11-08T23:00:00+08:00", "2026-11-09T01:00:00+08:00"), DAY, SHANGHAI));
        assertTrue(WorkspaceService.coversBusinessDay(timed("2026-11-09T23:00:00+08:00", "2026-11-10T00:00:00+08:00"), DAY, SHANGHAI));
        // A midnight due instant belongs only to the previous business day.
        assertFalse(WorkspaceService.coversBusinessDay(timed("2026-11-09T23:00:00+08:00", "2026-11-10T00:00:00+08:00"), DAY.plusDays(1), SHANGHAI));
        assertFalse(WorkspaceService.coversBusinessDay(timed("2026-11-09T09:00:00+08:00", "2026-11-09T10:00:00+08:00"), DAY.plusDays(1), SHANGHAI));
    }

    @Test
    void zeroLengthTasksBelongToTheirOwnDayAndAllDayIsInclusive() {
        assertTrue(WorkspaceService.coversBusinessDay(timed("2026-11-10T00:00:00+08:00", "2026-11-10T00:00:00+08:00"), DAY.plusDays(1), SHANGHAI));
        assertFalse(WorkspaceService.coversBusinessDay(timed("2026-11-10T00:00:00+08:00", "2026-11-10T00:00:00+08:00"), DAY, SHANGHAI));
        Map<String, Object> allDay = new LinkedHashMap<>();
        allDay.put("allDay", true);
        allDay.put("startDate", "2026-11-08");
        allDay.put("dueDate", "2026-11-10");
        assertTrue(WorkspaceService.coversBusinessDay(allDay, DAY, SHANGHAI));
        assertTrue(WorkspaceService.coversBusinessDay(allDay, LocalDate.parse("2026-11-10"), SHANGHAI));
        assertFalse(WorkspaceService.coversBusinessDay(allDay, LocalDate.parse("2026-11-11"), SHANGHAI));
    }
}
