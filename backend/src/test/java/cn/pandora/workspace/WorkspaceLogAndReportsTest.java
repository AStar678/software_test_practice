package cn.pandora.workspace;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import cn.pandora.task.TaskService;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class WorkspaceLogAndReportsTest {
    private static final Actor EMPLOYEE = new Actor("u", "org", "lower", "team", "lead", 3);
    private static final Actor MANAGER = new Actor("m", "org", "middle", "team", "exec", 2);
    private static final Actor EXECUTIVE = new Actor("exec", "org", "upper", "team", null, 1);
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-20T15:59:59Z"), ZoneOffset.UTC);

    private static WorkspaceService service(Db db, Access access) {
        return new WorkspaceService(db, access, mock(TaskService.class), mock(Events.class), CLOCK);
    }

    private static Db timezone(Db db) {
        when(db.one(startsWith("SELECT time_zone FROM organizations"), eq("org")))
                .thenReturn(Map.of("timeZone", "Asia/Shanghai"));
        return db;
    }

    @Test
    void createAllowsOnlyTheCompanyThreeDayWindow() {
        Db db = timezone(mock(Db.class));
        WorkspaceService service = service(db, mock(Access.class));

        // Beyond the two backfill days: rejected without touching an existing slot.
        ApiException tooOld = assertThrows(ApiException.class,
                () -> service.createLog(EMPLOYEE, Map.of("body", "old", "businessDate", "2026-10-17")));
        assertEquals(400, tooOld.status);
        assertEquals("INVALID_INPUT", tooOld.code);
        // A future business date is never writable either.
        assertEquals(400, assertThrows(ApiException.class,
                () -> service.createLog(EMPLOYEE, Map.of("body", "later", "businessDate", "2026-10-21"))).status);

        when(db.find(startsWith("SELECT id,row_version,business_date"), eq("org"), eq("u"), any())).thenReturn(null);
        Map<String, Object> yesterday = service.createLog(EMPLOYEE,
                Map.of("body", "yesterday", "businessDate", "2026-10-19"));
        assertEquals("2026-10-19", yesterday.get("businessDate"));
        Map<String, Object> twoDaysAgo = service.createLog(EMPLOYEE,
                Map.of("body", "before", "businessDate", "2026-10-18"));
        assertEquals("2026-10-18", twoDaysAgo.get("businessDate"));
    }

    @Test
    void createStillReturnsTheExistingLiveRecordForTheSameDay() {
        Db db = timezone(mock(Db.class));
        WorkspaceService service = service(db, mock(Access.class));

        when(db.find(startsWith("SELECT id,row_version,business_date"), eq("org"), eq("u"), any()))
                .thenReturn(Map.of("id", "log-1", "rowVersion", 2L, "businessDate", "2026-10-20"));
        ApiException duplicate = assertThrows(ApiException.class,
                () -> service.createLog(EMPLOYEE, Map.of("body", "again")));
        assertEquals(409, duplicate.status);
        assertEquals("WORK_LOG_EXISTS", duplicate.code);
        assertEquals("log-1", duplicate.details.get("logId"));
    }

    @Test
    void createUsesTheCompanyTodayWhenTheDateIsOmitted() {
        Db db = timezone(mock(Db.class));
        when(db.find(startsWith("SELECT id,row_version,business_date"), eq("org"), eq("u"), any()))
                .thenReturn(null);
        when(db.update(contains("INSERT INTO work_logs"), any(), any(), any(), any(), any(), any(), any())).thenReturn(1);
        WorkspaceService service = service(db, mock(Access.class));

        Map<String, Object> result = service.createLog(EMPLOYEE, Map.of("body", "today"));
        assertEquals("2026-10-20", result.get("businessDate"));
        verify(db).update(contains("INSERT INTO work_logs"), any(), eq("org"), eq("u"),
                eq(java.sql.Date.valueOf("2026-10-20")), eq("today"), isNull(), isNull());
    }

    @Test
    void aLogStaysEditableAcrossMidnightUntilItsOwnTwentyFourHours() {
        Db db = timezone(mock(Db.class));
        Access access = mock(Access.class);
        when(access.canReadLogAuthor(EMPLOYEE, "u")).thenReturn(true);
        // Real first creation: 2026-10-20 00:00 Asia/Shanghai, i.e. the previous company day.
        Map<String, Object> row = new LinkedHashMap<>(Map.of("id", "log-1", "organizationId", "org",
                "authorId", "u", "businessDate", "2026-10-19", "rowVersion", 1L, "body", "late night",
                "createdAt", "2026-10-19T16:00:00Z"));
        when(db.one(startsWith("SELECT * FROM work_logs"), eq("org"), eq("u"), eq("log-1"))).thenReturn(row);
        when(db.one(startsWith("SELECT w.*,u.display_name"), eq("org"), eq("log-1"))).thenReturn(row);
        WorkspaceService before = service(db, access);

        // One second before the freeze, at 23:59:59 local on the following day: still the author's.
        Map<String, Object> detail = before.log(EMPLOYEE, "log-1");
        assertEquals(true, detail.get("editable"));
        assertEquals("2026-10-20T16:00:00Z", detail.get("frozenAt"));
        assertNotNull(before.changeLog(EMPLOYEE, "log-1", "\"1\"", Map.of("body", "edited")));

        // Editing the body must not move created_at, so the freeze instant cannot extend.
        verify(db, never()).update(contains("created_at="), any(), any(), any());

        WorkspaceService after = new WorkspaceService(db, access, mock(TaskService.class), mock(Events.class),
                Clock.fixed(Instant.parse("2026-10-20T16:00:00Z"), ZoneOffset.UTC));
        assertEquals(false, after.log(EMPLOYEE, "log-1").get("editable"));
        ApiException frozen = assertThrows(ApiException.class,
                () -> after.changeLog(EMPLOYEE, "log-1", "\"1\"", Map.of("body", "later")));
        assertEquals(409, frozen.status);
        assertEquals("WORK_LOG_FROZEN", frozen.code);
        assertEquals(409, assertThrows(ApiException.class,
                () -> after.deleteLog(EMPLOYEE, "log-1", "\"1\"")).status);
    }

    @Test
    void aFrozenSlotCannotBeRecreatedAndADateCannotBeChanged() {
        Db db = timezone(mock(Db.class));
        WorkspaceService service = service(db, mock(Access.class));
        // The day slot survives a delete, but only its original first creation decides the freeze.
        Map<String, Object> deleted = Map.of("id", "log-1", "rowVersion", 3L, "businessDate", "2026-10-19",
                "deletedAt", "2026-10-19T16:05:00Z", "createdAt", "2026-10-18T16:00:00Z");
        when(db.find(startsWith("SELECT id,row_version,business_date"), eq("org"), eq("u"), any())).thenReturn(deleted);
        ApiException frozen = assertThrows(ApiException.class,
                () -> service.createLog(EMPLOYEE, Map.of("body", "again", "businessDate", "2026-10-19")));
        assertEquals("WORK_LOG_FROZEN", frozen.code);

        Map<String, Object> live = new LinkedHashMap<>(Map.of("id", "log-2", "organizationId", "org",
                "authorId", "u", "businessDate", "2026-10-20", "rowVersion", 1L, "body", "now",
                "createdAt", "2026-10-20T15:00:00Z"));
        when(db.one(startsWith("SELECT * FROM work_logs"), eq("org"), eq("u"), eq("log-2"))).thenReturn(live);
        ApiException changedDate = assertThrows(ApiException.class,
                () -> service.changeLog(EMPLOYEE, "log-2", "\"1\"", Map.of("businessDate", "2026-10-21")));
        assertEquals(400, changedDate.status);
    }

    @Test
    void logDetailDropsATaskTheReaderCannotSee() {
        Db db = timezone(mock(Db.class));
        Access access = mock(Access.class);
        when(access.canReadLogAuthor(EMPLOYEE, "u")).thenReturn(true);
        Map<String, Object> row = new LinkedHashMap<>(Map.of("id", "log-1", "authorId", "u",
                "businessDate", "2026-10-20", "rowVersion", 1L, "taskId", "task-1"));
        when(db.one(startsWith("SELECT w.*,u.display_name"), eq("org"), eq("log-1"))).thenReturn(row);
        when(db.find(startsWith("SELECT * FROM tasks"), eq("org"), eq("task-1")))
                .thenReturn(Map.of("id", "task-1"));
        WorkspaceService service = service(db, access);

        assertFalse(service.log(EMPLOYEE, "log-1").containsKey("taskId"));
    }

    @Test
    void reportsAreTheIntersectionOfProfileScopeAndTheManagementChain() {
        Db db = mock(Db.class);
        Access access = mock(Access.class);
        List<Map<String, Object>> rows = List.of(
                person("m", "exec", "m", 2),
                person("e", "m", "e", 3),
                person("g", "e", "g", 3),
                person("x", "other", "x", 3));
        when(db.list(startsWith("SELECT u.*,d.name AS department_name"), eq("org"))).thenReturn(rows);
        when(access.canSeePerson(eq(MANAGER), anyMap())).thenAnswer(call ->
                "e".equals(((Map<?, ?>) call.getArgument(1)).get("id")));
        when(access.canSeePerson(eq(EXECUTIVE), anyMap())).thenReturn(true);
        WorkspaceService service = service(db, access);

        List<Map<String, Object>> direct = items(service.reports(MANAGER));
        assertEquals(List.of("e"), direct.stream().map(row -> row.get("id")).toList());
        List<Map<String, Object>> company = items(service.reports(EXECUTIVE));
        assertEquals(List.of("m", "e", "g"), company.stream().map(row -> row.get("id")).toList());
        assertTrue(company.stream().noneMatch(row -> "x".equals(row.get("id"))));
    }

    private static Map<String, Object> person(String id, String managerId, String departmentId, int rank) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", id);
        row.put("displayName", id.toUpperCase(Locale.ROOT));
        row.put("role", "lower");
        row.put("managerId", managerId);
        row.put("departmentId", departmentId);
        row.put("departmentName", departmentId + "-dept");
        row.put("positionId", "p");
        row.put("positionName", "专员");
        row.put("teamId", "t");
        row.put("teamName", "team");
        row.put("managerName", managerId);
        row.put("rankLevel", rank);
        row.put("active", true);
        return row;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> items(Map<String, Object> result) {
        return (List<Map<String, Object>>) result.get("items");
    }
}
