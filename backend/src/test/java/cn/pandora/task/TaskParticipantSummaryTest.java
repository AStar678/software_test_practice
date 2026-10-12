package cn.pandora.task;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TaskParticipantSummaryTest {
    private static final String TASK = "20000000-0000-0000-0000-000000000001";
    private static final Actor ACTOR = new Actor("employee", "org", "lower", "team", "reviewer", 3);

    @Test
    void summariesContainOnlyNamesAndIdsWithinTheCurrentOrganization() {
        Db db = mock(Db.class);
        when(db.list(startsWith("SELECT id,display_name FROM users"), any(Object[].class))).thenAnswer(call -> {
            Object[] args = (Object[]) call.getRawArguments()[1];
            assertArrayEquals(new Object[]{"org", "employee", "creator"}, args);
            return List.of(Map.of("id", "employee", "displayName", "员工", "username", "private", "managerId", "reviewer"));
        });
        TaskService service = new TaskService(db, mock(Access.class), mock(Events.class));
        List<Map<String, Object>> result = ReflectionTestUtils.invokeMethod(service, "participantSummaries", ACTOR,
                Arrays.asList("employee", "creator", "employee", null, ""));
        assertEquals(List.of(Map.of("id", "employee", "displayName", "员工")), result);
    }

    @Test
    void effectiveTaskDoesNotRevealProposedOwnersWhileFrozen() {
        Db db = mock(Db.class);
        when(db.list(startsWith("SELECT user_id FROM task_version_assignees"), eq("org"), eq("effective")))
                .thenReturn(List.of(Map.of("userId", "employee")));
        when(db.find(startsWith("SELECT * FROM approval_requests"), eq("org"), eq(TASK)))
                .thenReturn(Map.of("id", "request", "status", "pending", "applicantId", "creator", "currentReviewerId", "reviewer", "baseVersionId", "effective", "proposedVersionId", "hidden-proposal"));
        when(db.find("SELECT * FROM users WHERE organization_id=? AND id=?", "org", "employee"))
                .thenReturn(Map.of("id", "employee", "rankLevel", 3, "managerId", "reviewer", "active", true, "role", "lower"));
        when(db.find("SELECT * FROM users WHERE organization_id=? AND id=?", "org", "reviewer"))
                .thenReturn(Map.of("id", "reviewer", "rankLevel", 2, "active", true, "role", "middle"));
        when(db.list(startsWith("SELECT id,display_name FROM users"), any(Object[].class))).thenAnswer(call -> {
            Object[] args = (Object[]) call.getRawArguments()[1];
            assertEquals(Set.of("org", "employee", "creator", "reviewer"), new HashSet<>(Arrays.asList(args)));
            return List.of(Map.of("id", "employee", "displayName", "员工"), Map.of("id", "creator", "displayName", "创建者"), Map.of("id", "reviewer", "displayName", "审核人"));
        });
        TaskService service = new TaskService(db, mock(Access.class), mock(Events.class));
        Map<String, Object> task = Map.of("id", TASK, "originalCreatorId", "creator", "rowVersion", 4, "executionRound", 1, "dueVersion", 1);
        Map<String, Object> version = Map.of("id", "effective", "createdBy", "creator", "title", "旧有效标题");
        Map<String, Object> result = ReflectionTestUtils.invokeMethod(service, "taskView", ACTOR, task, version, List.of("employee"));
        assertNotNull(result);
        assertEquals(true, result.get("frozen"));
        assertFalse(result.containsKey("pendingRequestId"));
        assertEquals("旧有效标题", result.get("title"));
        assertEquals(3, ((List<?>) result.get("participants")).size());
        verify(db, never()).list(contains("task_version_assignees"), eq("org"), eq("hidden-proposal"));
    }

    @Test
    void unauthorizedTaskReadDoesNotFetchParticipantIdentities() {
        Db db = mock(Db.class);
        Access access = mock(Access.class);
        when(db.one("SELECT * FROM tasks WHERE organization_id=? AND id=?", "org", TASK))
                .thenReturn(Map.of("id", TASK, "currentVersionId", "effective", "originalCreatorId", "another"));
        when(db.one("SELECT * FROM task_versions WHERE organization_id=? AND id=?", "org", "effective"))
                .thenReturn(Map.of("id", "effective"));
        when(db.list(startsWith("SELECT user_id FROM task_version_assignees"), eq("org"), eq("effective"))).thenReturn(List.of());
        TaskService service = new TaskService(db, access, mock(Events.class));
        assertThrows(ApiException.class, () -> service.detail(ACTOR, TASK));
        verify(db, never()).list(startsWith("SELECT id,display_name FROM users"), any(Object[].class));
    }
}
