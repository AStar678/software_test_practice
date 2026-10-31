package cn.pandora.task;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.auth.CompanyTree;
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
    private static final Actor ACTOR = new Actor(CREATOR, "org", "founder", "team", null, 1);

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
    void assigneeOrderAndTakeoverNeverChangeOperatorManagerReview() {
        var people=new HashMap<String,Map<String,Object>>();
        people.put(CREATOR,user(CREATOR,"founder",1,null,true));
        people.put(MANAGER_A,user(MANAGER_A,"team_head",3,CREATOR,true));
        people.put(MANAGER_B,user(MANAGER_B,"team_head",3,CREATOR,true));
        people.put(EMPLOYEE_A,user(EMPLOYEE_A,"employee",4,MANAGER_A,true));
        people.put(EMPLOYEE_B,user(EMPLOYEE_B,"employee",4,MANAGER_B,true));
        var service=service(people);
        for(var owners:List.of(List.of(EMPLOYEE_A,EMPLOYEE_B),List.of(EMPLOYEE_B,EMPLOYEE_A),List.of(CREATOR))) {
            var route=service.route(ACTOR,owners,EMPLOYEE_A);
            assertEquals(MANAGER_A,route.reviewerId());assertEquals("direct-manager",route.reason());
            assertFalse(route.directFor(EMPLOYEE_A));
            assertEquals(MANAGER_B,service.route(ACTOR,owners,EMPLOYEE_B).reviewerId());
            assertTrue(service.route(ACTOR,owners,CREATOR).directFor(CREATOR));
        }
        people.get(MANAGER_A).put("reviewerAvailable",false);
        assertTrue(service.route(ACTOR,List.of(EMPLOYEE_B),EMPLOYEE_A).blocked());
        people.get(EMPLOYEE_A).put("managerId",null);
        assertTrue(service.route(ACTOR,List.of(EMPLOYEE_B),EMPLOYEE_A).blocked());
    }

    @Test
    void inactiveAdminOrMissingOwnersCannotEnterBusinessRouting() {
        var service=service(Map.of(CREATOR,user(CREATOR,"employee",4,null,true),
                EMPLOYEE_A,user(EMPLOYEE_A,"admin",0,null,true),EMPLOYEE_B,user(EMPLOYEE_B,"employee",4,null,false)));
        for(var owner:List.of(EMPLOYEE_A,EMPLOYEE_B,MANAGER_A))
            assertThrows(ApiException.class,()->service.route(ACTOR,List.of(owner),CREATOR));
    }

    @Test
    void creationUsesOnlyFixedFounderOrTheDerivedDirectManager() {
        Db db=mock(Db.class);var tree=mock(CompanyTree.class);
        Map<String,Map<String,Object>> people=new HashMap<>();
        people.put(CREATOR,user(CREATOR,"founder",1,null,true));
        people.put(EMPLOYEE_A,user(EMPLOYEE_A,"employee",4,MANAGER_A,true));
        people.put(MANAGER_A,user(MANAGER_A,"team_head",3,CREATOR,true));
        when(tree.of("org")).thenReturn(new CompanyTree.Tree(people,List.of(CREATOR),Set.of(),Set.of(),CREATOR,true,List.of()));
        var service=new TaskService(db,mock(Access.class),mock(Events.class),java.time.Clock.systemUTC(),mock(ExpiryService.class),tree,mock(Tags.class));
        assertEquals("founder-exempt",service.creationRoute(ACTOR,CREATOR).reason());
        assertEquals(MANAGER_A,service.creationRoute(ACTOR,EMPLOYEE_A).reviewerId());
        people.get(MANAGER_A).put("reviewerAvailable",false);
        assertTrue(service.creationRoute(ACTOR,EMPLOYEE_A).blocked());
        people.get(EMPLOYEE_A).put("managerId",null);
        assertTrue(service.creationRoute(ACTOR,EMPLOYEE_A).blocked());
        when(tree.of("org")).thenReturn(new CompanyTree.Tree(people,List.of(),Set.of(),Set.of(),null,false,List.of("FIXED_FOUNDER_REQUIRED")));
        assertTrue(service.creationRoute(ACTOR,CREATOR).blocked());
    }

    private static TaskService service(Map<String,Map<String,Object>> people) {
        var access=mock(Access.class);
        when(access.activeUser(any(),any())).thenAnswer(call->{
            var person=people.get(call.getArgument(1));
            return person!=null && Boolean.TRUE.equals(person.get("active")) && !"admin".equals(person.get("role"))?person:null;
        });
        var tree=mock(CompanyTree.class);
        when(tree.of("org")).thenReturn(new CompanyTree.Tree(people,List.of(CREATOR),Set.of(),Set.of(),CREATOR,true,List.of()));
        return new TaskService(mock(Db.class),access,mock(Events.class),java.time.Clock.systemUTC(),mock(ExpiryService.class),tree,mock(Tags.class));
    }

    @Test
    void automaticApplicationReusesTheExplicitCreationCandidateCheck() {
        // V-008 (adapted by 3.1): a reviewer-less creation path must not bypass the applicant's current
        // creation-candidate rule. A creation now accepts any active business member, so the authority
        // re-check is the creation candidate check rather than the narrower dispatch range.
        Db db = mock(Db.class);
        Access access = mock(Access.class);
        when(db.list(startsWith("SELECT user_id FROM task_version_assignees"), eq("org"), eq("version")))
                .thenReturn(List.of(Map.of("userId", "owner")));
        when(access.activeUser(any(), eq("owner"))).thenReturn(user("owner", "employee", 3, null, true));
        when(access.user(any(), eq("applicant"))).thenReturn(user("applicant", "founder", 0, null, true));
        when(access.actor(any())).thenReturn(new Actor("applicant", "org", "founder", null, null, 0));
        doThrow(new ApiException(400, "INVALID_INPUT", "负责人不可用"))
                .when(access).requireCreationCandidate(any(), eq("owner"));
        TaskService service = new TaskService(db, access, mock(Events.class),
                java.time.Clock.systemUTC(), mock(ExpiryService.class));
        Map<String, Object> task = Map.of("id", "task", "originalCreatorId", "applicant");
        Map<String, Object> request = Map.of("id", "request", "applicantId", "applicant",
                "kind", "create", "proposedVersionId", "version");
        Map<String, Object> proposed = Map.of("id", "version");

        assertThrows(ApiException.class, () -> ReflectionTestUtils.invokeMethod(service,
                "validateApplicationEffect", ACTOR, task, request, proposed, null, "create"));
    }

    @Test
    void creationHasNoCompletionCriterionButHistoricalValuesRemainValid() {
        // Chapter 4.1: absent or blank is a valid (empty) value for a new creation; an existing value
        // still passes through edits. Only over-long text is rejected.
        assertEquals("", TaskService.optionalTextValue(null, "acceptanceCriteria", 2000));
        assertEquals("", TaskService.optionalTextValue("   ", "acceptanceCriteria", 2000));
        assertEquals("材料完整", TaskService.optionalTextValue(" 材料完整 ", "acceptanceCriteria", 2000));
        assertThrows(cn.pandora.common.ApiException.class,
                () -> TaskService.optionalTextValue("x".repeat(2001), "acceptanceCriteria", 2000));
        assertEquals("按本次操作者的直属上级审核", TaskService.routeReasonText("direct-manager"));
        assertEquals("固定创始人操作，记录原因后直接生效",
                TaskService.routeReasonText("founder-exempt"));
        assertTrue(TaskService.routeReasonText("manager-unavailable").contains("阻断"));
    }

    @Test
    void distinctTagIdentitiesCannotDisappearFromReviewDiffEvenWhenNamesMatch() {
        var service=service(Map.of());
        var before=Map.<String,Object>of("id","before","tagIds",List.of(EMPLOYEE_A),
                "tagSnapshots",List.of(Map.of("tagId",EMPLOYEE_A,"tagNameSnapshot","相同名称")));
        var after=Map.<String,Object>of("id","after","tagIds",List.of(EMPLOYEE_B),
                "tagSnapshots",List.of(Map.of("tagId",EMPLOYEE_B,"tagNameSnapshot","相同名称")));
        List<Map<String,Object>> diff=ReflectionTestUtils.invokeMethod(service,"diff",ACTOR,before,after);
        assertNotNull(diff);
        assertEquals(1,diff.size());assertEquals("tagIds",diff.getFirst().get("field"));
    }

    @Test
    void noReviewerApplicationBindsEveryPlaceholderToExactlyOneArgument() {
        // V-003: the update used to pass a duplicated argument while the SQL had one fewer placeholder.
        TaskService.Route route = new TaskService.Route(null, "basis", List.of(), "no-reviewer",
                TaskService.routeReasonText("no-reviewer"), 3L, false, false);
        Object[] args = TaskService.noReviewerApplyArgs(route, java.sql.Timestamp.from(Instant.EPOCH),
                "org", "request", 7L,"applicant");
        long placeholders = TaskService.NO_REVIEWER_APPLY_SQL.chars().filter(c -> c == '?').count();
        assertEquals(placeholders, args.length);
        assertEquals(9, args.length);
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
