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
    void createRejectsBackdatedAndReturnsTheExistingTodayRecord() {
        Db db = timezone(mock(Db.class));
        WorkspaceService service = service(db, mock(Access.class));

        ApiException backdated = assertThrows(ApiException.class,
                () -> service.createLog(EMPLOYEE, Map.of("body", "old", "businessDate", "2026-10-19")));
        assertEquals(400, backdated.status);
        assertEquals("INVALID_INPUT", backdated.code);

        when(db.find(startsWith("SELECT id,row_version,business_date FROM work_logs"), eq("org"), eq("u"), any()))
                .thenReturn(Map.of("id", "log-1", "rowVersion", 2L, "businessDate", "2026-10-20"));
        ApiException duplicate = assertThrows(ApiException.class,
                () -> service.createLog(EMPLOYEE, Map.of("body", "again")));
        assertEquals(409, duplicate.status);
        assertEquals("WORK_LOG_EXISTS", duplicate.code);
        assertEquals("log-1", duplicate.details.get("logId"));
        verify(db, never()).update(contains("INSERT INTO work_logs"), any(), any(), any(), any(), any(), any());
    }

    @Test
    void createUsesTheCompanyTodayWhenTheDateIsOmitted() {
        Db db = timezone(mock(Db.class));
        when(db.find(startsWith("SELECT id,row_version,business_date FROM work_logs"), eq("org"), eq("u"), any()))
                .thenReturn(null);
        when(db.update(contains("INSERT INTO work_logs"), any(), any(), any(), any(), any(), any())).thenReturn(1);
        WorkspaceService service = service(db, mock(Access.class));

        Map<String, Object> result = service.createLog(EMPLOYEE, Map.of("body", "today"));
        assertEquals("2026-10-20", result.get("businessDate"));
        verify(db).update(contains("INSERT INTO work_logs"), any(), eq("org"), eq("u"),
                eq(java.sql.Date.valueOf("2026-10-20")), eq("today"), isNull());
    }

    @Test
    void oldLogsAreFrozenAndTheirDateCannotBeChanged() {
        Db db = timezone(mock(Db.class));
        WorkspaceService service = service(db, mock(Access.class));
        Map<String, Object> old = new LinkedHashMap<>(Map.of("id", "log-1", "organizationId", "org",
                "authorId", "u", "businessDate", "2026-10-19", "rowVersion", 1L, "body", "old"));
        when(db.one(startsWith("SELECT * FROM work_logs"), eq("org"), eq("u"), eq("log-1"))).thenReturn(old);

        ApiException frozen = assertThrows(ApiException.class,
                () -> service.changeLog(EMPLOYEE, "log-1", "\"1\"", Map.of("body", "edited")));
        assertEquals(409, frozen.status);
        assertEquals("WORK_LOG_FROZEN", frozen.code);
        assertEquals(409, assertThrows(ApiException.class,
                () -> service.deleteLog(EMPLOYEE, "log-1", "\"1\"")).status);

        Map<String, Object> today = new LinkedHashMap<>(old);
        today.put("businessDate", "2026-10-20");
        when(db.one(startsWith("SELECT * FROM work_logs"), eq("org"), eq("u"), eq("log-1"))).thenReturn(today);
        ApiException changedDate = assertThrows(ApiException.class,
                () -> service.changeLog(EMPLOYEE, "log-1", "\"1\"", Map.of("businessDate", "2026-10-21")));
        assertEquals(400, changedDate.status);
    }

    @Test
    void editableComesFromTheSameCompanyDayRule() {
        Db db = timezone(mock(Db.class));
        Access access = mock(Access.class);
        when(access.canReadLogAuthor(EMPLOYEE, "u")).thenReturn(true);
        Map<String, Object> old = new LinkedHashMap<>(Map.of("id", "log-1", "authorId", "u",
                "businessDate", "2026-10-19", "rowVersion", 1L));
        when(db.one(startsWith("SELECT w.*,u.display_name"), eq("org"), eq("log-1"))).thenReturn(old);
        WorkspaceService service = service(db, access);

        assertEquals(false, service.log(EMPLOYEE, "log-1").get("editable"));
        old.put("businessDate", "2026-10-20");
        assertEquals(true, service.log(EMPLOYEE, "log-1").get("editable"));
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
