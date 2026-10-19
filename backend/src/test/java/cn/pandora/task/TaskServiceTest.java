package cn.pandora.task;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import cn.pandora.workspace.ExpiryService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TaskServiceTest {
    private static final String CREATOR = "10000000-0000-0000-0000-000000000001";
    private static final String EMPLOYEE_A = "10000000-0000-0000-0000-000000000002";
    private static final String EMPLOYEE_B = "10000000-0000-0000-0000-000000000003";
    private static final String MANAGER_A = "10000000-0000-0000-0000-000000000004";
    private static final String MANAGER_B = "10000000-0000-0000-0000-000000000005";
    private static final String UPPER = "10000000-0000-0000-0000-000000000006";
    private static final Actor ACTOR = new Actor(CREATOR, "org", "upper", "team", null, 1);

    @Test
    void validatesUnicodeTextLengthsAndRequiredValues() {
        assertEquals("工作", TaskService.requiredText(Map.of("title", "  工作  "), "title", 2));
        assertEquals("😀😀", TaskService.requiredText(Map.of("title", "😀😀"), "title", 2));
        assertThrows(ApiException.class, () -> TaskService.requiredText(Map.of("title", "😀😀😀"), "title", 2));
        assertThrows(ApiException.class, () -> TaskService.requiredText(Map.of("title", " \n "), "title", 80));
        assertThrows(ApiException.class, () -> TaskService.requiredText(Map.of("title", 42), "title", 80));
    }

    @Test
    void rejectsDuplicateOrMalformedAssigneesAndUntrustedFields() {
        assertThrows(ApiException.class, () -> TaskService.ids(List.of(CREATOR, CREATOR)));
        assertThrows(ApiException.class, () -> TaskService.ids(List.of()));
        assertThrows(ApiException.class, () -> TaskService.ids(List.of("1-1-1-1-1")));
        assertThrows(ApiException.class, () -> TaskService.allowed(Map.of("executionState", "done"), Set.of("title")));
    }

    @Test
    void requiresZonedTimesAndValidDates() {
        assertEquals(Instant.parse("2026-10-12T01:00:00Z"), TaskService.instant("2026-10-12T09:00:00+08:00", "startAt"));
        assertThrows(ApiException.class, () -> TaskService.instant("2026-10-12T09:00:00", "startAt"));
        assertThrows(ApiException.class, () -> TaskService.requiredDate("2026-02-30", "dueDate"));
    }

    @Test
    void allDayTaskUsesOrganizationWorkdayDeadlineAndKeepsCalendarDates() {
        Db db = mock(Db.class);
        when(db.one("SELECT time_zone FROM organizations WHERE id=?", "org")).thenReturn(Map.of("timeZone", "Asia/Shanghai"));
        when(db.one("SELECT off_work_time FROM organizations WHERE id=?", "org")).thenReturn(Map.of("offWorkTime", "18:00:00"));
        TaskService service = new TaskService(db, mock(Access.class), mock(Events.class), java.time.Clock.systemUTC(), mock(ExpiryService.class));
        Map<String, Object> input = new LinkedHashMap<>(Map.of("title", "全天任务", "description", "说明",
                "acceptanceCriteria", "标准", "assigneeIds", List.of(CREATOR), "allDay", true,
                "startDate", "2026-10-12", "dueDate", "2026-10-13"));
        Map<String, Object> result = ReflectionTestUtils.invokeMethod(service, "validateForm", ACTOR, input, null);
        assertNotNull(result);
        assertEquals("2026-10-11T16:00:00Z", result.get("startAt"));
        assertEquals("2026-10-13T10:00:00Z", result.get("dueAt"));
        assertEquals("2026-10-12", result.get("startDate"));
        assertEquals("2026-10-13", result.get("dueDate"));
        input.put("dueDate", "2026-10-11");
        assertThrows(ApiException.class, () -> ReflectionTestUtils.invokeMethod(service, "validateForm", ACTOR, input, null));
        input.put("allDay", 1);
        assertThrows(ApiException.class, () -> ReflectionTestUtils.invokeMethod(service, "validateForm", ACTOR, input, null));
    }

    @Test
    void commandAliasesCannotDisagreeOrBypassTypeValidation() {
        assertEquals("complete", TaskService.command(Map.of("command", "complete"), "command", "action", "change"));
        assertThrows(ApiException.class, () -> TaskService.command(Map.of("command", "complete", "action", "reopen"), "command", "action", "change"));
        assertThrows(ApiException.class, () -> TaskService.command(Map.of("command", 1), "command", "action", "change"));
    }

    @Test
    void theFirstHighestAssigneeInSavedOrderDecidesTheRoute() {
        TaskService service = service(Map.of(
                CREATOR, user(CREATOR, "upper", 1, null, true),
                EMPLOYEE_A, user(EMPLOYEE_A, "lower", 3, MANAGER_A, true),
                EMPLOYEE_B, user(EMPLOYEE_B, "lower", 3, MANAGER_B, true),
                MANAGER_A, user(MANAGER_A, "middle", 2, UPPER, true),
                MANAGER_B, user(MANAGER_B, "middle", 2, UPPER, true),
                UPPER, user(UPPER, "upper", 1, null, true)));
        // Same level, different chains: the saved order alone selects the reviewer (DEV-006).
        assertEquals(MANAGER_A, route(service, List.of(EMPLOYEE_A, EMPLOYEE_B)).reviewerId());
        assertEquals(MANAGER_B, route(service, List.of(EMPLOYEE_B, EMPLOYEE_A)).reviewerId());
        assertEquals(EMPLOYEE_A, route(service, List.of(EMPLOYEE_A, EMPLOYEE_B)).basisAssigneeId());
        assertEquals("manager-chain", route(service, List.of(EMPLOYEE_A, EMPLOYEE_B)).reason());
    }

    @Test
    void aLowerLevelAssigneeListedFirstDoesNotOutrankTheHighestLevel() {
        TaskService service = service(Map.of(
                CREATOR, user(CREATOR, "upper", 1, null, true),
                EMPLOYEE_A, user(EMPLOYEE_A, "lower", 3, MANAGER_A, true),
                MANAGER_A, user(MANAGER_A, "middle", 2, UPPER, true),
                UPPER, user(UPPER, "upper", 1, null, true)));
        TaskService.Route route = route(service, List.of(EMPLOYEE_A, UPPER));
        assertEquals(UPPER, route.basisAssigneeId(), "the highest organization level wins regardless of position in the list");
        assertEquals(CREATOR, route.reviewerId(), "the top level has no manager, so the creator reviews");
        assertEquals("creator-fallback", route.reason());
    }

    @Test
    void anUnavailableOrInactiveManagerIsSkippedAndTheChainContinues() {
        Map<String, Map<String, Object>> onLeave = new HashMap<>(Map.of(
                CREATOR, user(CREATOR, "upper", 1, null, true),
                EMPLOYEE_A, user(EMPLOYEE_A, "lower", 3, MANAGER_A, true),
                MANAGER_A, user(MANAGER_A, "middle", 2, UPPER, true),
                UPPER, user(UPPER, "upper", 1, null, true)));
        // The direct manager is on leave (reviewer_available = FALSE) but still in the chain.
        onLeave.get(MANAGER_A).put("reviewerAvailable", false);
        assertEquals(UPPER, route(service(onLeave), List.of(EMPLOYEE_A)).reviewerId());

        // An inactive manager is skipped as well.
        assertEquals(UPPER, route(service(Map.of(
                CREATOR, user(CREATOR, "upper", 1, null, true),
                EMPLOYEE_A, user(EMPLOYEE_A, "lower", 3, MANAGER_A, true),
                MANAGER_A, user(MANAGER_A, "middle", 2, UPPER, false),
                UPPER, user(UPPER, "upper", 1, null, true))), List.of(EMPLOYEE_A)).reviewerId());
    }

    @Test
    void aReviewerIsAlwaysRequiredEvenWhenTheCreatorIsTheBasis() {
        TaskService service = service(Map.of(
                CREATOR, user(CREATOR, "upper", 1, MANAGER_A, true),
                MANAGER_A, user(MANAGER_A, "middle", 0, null, true)));
        // The creator is also the only assignee: a higher manager reviews instead of an exemption (DEV-007).
        TaskService.Route route = route(service, List.of(CREATOR));
        assertEquals(MANAGER_A, route.reviewerId());
        assertTrue(route.hasReviewer());

        // With no acceptable manager at all the creator still reviews, never the applicant exemption.
        TaskService selfManaged = service(Map.of(
                CREATOR, user(CREATOR, "upper", 1, null, true)));
        assertEquals(CREATOR, route(selfManaged, List.of(CREATOR)).reviewerId());
    }

    @Test
    void aUsableCreatorIsTheFallbackAndOnlyNoReviewerAtAllIsAnExemption() {
        TaskService service = service(Map.of(
                CREATOR, user(CREATOR, "upper", 1, null, true),
                UPPER, user(UPPER, "upper", 1, null, true)));
        assertEquals(CREATOR, route(service, List.of(UPPER)).reviewerId());

        TaskService unusableCreator = service(Map.of(
                CREATOR, user(CREATOR, "upper", 1, null, false),
                UPPER, user(UPPER, "upper", 1, null, true)));
        TaskService.Route exempt = route(unusableCreator, List.of(UPPER));
        assertFalse(exempt.hasReviewer(), "a genuinely unreachable reviewer is an exemption, not an error");
        assertEquals("no-reviewer", exempt.reason());
        assertEquals(UPPER, exempt.basisAssigneeId());
    }

    @Test
    void corruptOrganizationDataBlocksRoutingInsteadOfExemptingIt() {
        TaskService cycle = service(Map.of(
                CREATOR, user(CREATOR, "upper", 1, null, true),
                EMPLOYEE_A, user(EMPLOYEE_A, "lower", 3, MANAGER_A, true),
                MANAGER_A, user(MANAGER_A, "middle", 2, EMPLOYEE_A, true)));
        ApiException cyclic = assertThrows(ApiException.class, () -> route(cycle, List.of(EMPLOYEE_A)));
        assertEquals("ROUTE_BLOCKED", cyclic.code);

        TaskService dangling = service(Map.of(
                CREATOR, user(CREATOR, "upper", 1, null, true),
                EMPLOYEE_A, user(EMPLOYEE_A, "lower", 3, MANAGER_A, true)));
        ApiException missing = assertThrows(ApiException.class, () -> route(dangling, List.of(EMPLOYEE_A)));
        assertEquals("ROUTE_BLOCKED", missing.code);

        TaskService unknownAssignee = service(Map.of(CREATOR, user(CREATOR, "upper", 1, null, true)));
        assertThrows(ApiException.class, () -> route(unknownAssignee, List.of(EMPLOYEE_A)));
        TaskService administrator = service(Map.of(
                CREATOR, user(CREATOR, "upper", 1, null, true),
                EMPLOYEE_A, user(EMPLOYEE_A, "admin", 0, null, true)));
        assertThrows(ApiException.class, () -> route(administrator, List.of(EMPLOYEE_A)),
                "an administrator never takes business ownership");
    }

    private static TaskService.Route route(TaskService service, List<String> owners) {
        return service.route(ACTOR, owners, CREATOR);
    }

    private static TaskService service(Map<String, Map<String, Object>> people) {
        Db db = mock(Db.class);
        when(db.find(anyString(), any(), any())).thenAnswer(call -> people.get(call.getArgument(2)));
        return new TaskService(db, mock(Access.class), mock(Events.class), java.time.Clock.systemUTC(), mock(ExpiryService.class));
    }

    private static Map<String, Object> user(String id, String role, int rank, String manager, boolean active) {
        Map<String, Object> user = new HashMap<>();
        user.put("id", id);
        user.put("role", role);
        user.put("rankLevel", rank);
        user.put("managerId", manager);
        user.put("active", active);
        user.put("reviewerAvailable", true);
        return user;
    }
}
