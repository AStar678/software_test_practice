package cn.pandora.workspace;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DailyItemTimedStatusTest {
    private static final String ORG = "org";
    private static final String OWNER = "owner-1";
    private static final String ITEM = "item-1";
    private static final Actor ACTOR = new Actor(OWNER, ORG, "employee", "team", null, 1);

    @Test
    void timedItemIsOpenExactlyAtItsDeadlineAndOverdueStrictlyAfterwards() {
        Map<String, Object> timed = row(false, "2026-11-23", "2026-11-23", "09:00", "10:00");
        DailyItemService exact = service(timed, "2026-11-23T02:00:00Z");
        assertEquals("open", exact.detail(ACTOR, ITEM).get("status"));

        DailyItemService after = service(timed, "2026-11-23T02:00:01Z");
        assertEquals("overdue", after.detail(ACTOR, ITEM).get("status"));
    }

    @Test
    void allDayItemUsesTheInclusiveEndDate() {
        Map<String, Object> wholeDay = row(true, "2026-11-23", "2026-11-23", null, null);
        assertEquals("open", service(wholeDay, "2026-11-23T15:59:59Z").detail(ACTOR, ITEM).get("status"));
        assertEquals("overdue", service(wholeDay, "2026-11-23T16:00:00Z").detail(ACTOR, ITEM).get("status"));
    }

    @Test
    void completedAlwaysWins() {
        Map<String, Object> wholeDay = row(true, "2026-11-01", "2026-11-01", null, null);
        wholeDay.put("completed", true);
        assertEquals("completed", service(wholeDay, "2026-11-30T02:00:00Z").detail(ACTOR, ITEM).get("status"));
    }

    @Test
    void providerProjectionCarriesModeAndTimes() {
        Map<String, Object> timed = row(false, "2026-11-23", "2026-11-24", "23:30", "00:30");
        Map<String, Object> view = service(timed, "2026-11-23T02:00:00Z").detail(ACTOR, ITEM);
        assertEquals(false, view.get("allDay"));
        assertEquals("23:30", view.get("startTime"));
        assertEquals("00:30", view.get("endTime"));
    }

    @Test
    void createRequiresBothTimesForATimedItem() {
        Db db = mock(Db.class);
        Access access = mock(Access.class);
        when(db.one("SELECT time_zone FROM organizations WHERE id=?", ORG))
                .thenReturn(Map.of("timeZone", "Asia/Shanghai"));
        when(db.update(anyString(), any(Object[].class))).thenReturn(1);
        DailyItemService service = new DailyItemService(db, access, mock(Events.class), Clock.systemUTC());

        ApiException error = assertThrows(ApiException.class, () -> service.create(ACTOR,
                Map.of("startDate", "2026-11-23", "endDate", "2026-11-23", "body", "x",
                        "allDay", false, "startTime", "09:00")));

        assertEquals(400, error.status);
        assertEquals("INVALID_INPUT", error.code);
    }

    @Test
    void timedRangeRejectsAnEarlierDeadline() {
        Db db = mock(Db.class);
        when(db.one("SELECT time_zone FROM organizations WHERE id=?", ORG))
                .thenReturn(Map.of("timeZone", "Asia/Shanghai"));
        DailyItemService service = new DailyItemService(db, mock(Access.class), mock(Events.class), Clock.systemUTC());

        ApiException error = assertThrows(ApiException.class, () -> service.create(ACTOR,
                Map.of("startDate", "2026-11-23", "endDate", "2026-11-23", "body", "x",
                        "allDay", false, "startTime", "10:00", "endTime", "09:59")));

        assertEquals(400, error.status);
        assertTrue(error.getMessage().contains("截止时间"));
    }

    private static DailyItemService service(Map<String, Object> row, String now) {
        Db db = mock(Db.class);
        when(db.one("SELECT time_zone FROM organizations WHERE id=?", ORG))
                .thenReturn(Map.of("timeZone", "Asia/Shanghai"));
        when(db.one(startsWith("SELECT id,start_date,end_date,all_day,start_time,end_time"), eq(ORG), eq(OWNER), eq(ITEM)))
                .thenReturn(row);
        return new DailyItemService(db, mock(Access.class), mock(Events.class),
                Clock.fixed(Instant.parse(now), ZoneOffset.UTC));
    }

    private static Map<String, Object> row(boolean allDay, String start, String end,
                                           String startTime, String endTime) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", ITEM);
        row.put("startDate", start);
        row.put("endDate", end);
        row.put("allDay", allDay);
        row.put("startTime", startTime);
        row.put("endTime", endTime);
        row.put("body", "内容");
        row.put("completed", false);
        row.put("rowVersion", 1L);
        return row;
    }
}
