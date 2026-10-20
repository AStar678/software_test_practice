package cn.pandora.auth;

import cn.pandora.admin.RoleCatalog;
import cn.pandora.common.Db;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Independent authority rules (DEV-002, DEV-005, DEV-028).
 *
 * These assert the separation the prototype lacked: viewing is not dispatch, a teammate is not a
 * direct report, and an administrator holds no employee business authority.
 */
class AccessTest {

    private static Actor actor(String id, String role, String departmentId, String managerId, int rank,
                               Set<String> capabilities, Map<String, String> scopes) {
        return new Actor(id, "org", role, null, managerId, rank, departmentId, null,
                capabilities, scopes, 1L, true, false, 1L);
    }

    private static Actor departmentLead(String id, String departmentId) {
        return actor(id, "middle", departmentId, "exec", 2,
                Set.of("create_task", "handover_own", "handover_reports", "manage_team"),
                Map.of("task_view", "department", "task_dispatch", "department",
                        "log_read", "reports", "profile_read", "reports"));
    }

    private static Actor executive(String id) {
        return actor(id, "upper", "d1", null, 1,
                Set.of("create_task", "handover_own", "handover_reports"),
                Map.of("task_view", "company", "task_dispatch", "company",
                        "log_read", "company", "profile_read", "company"));
    }

    private static Actor employee(String id, String departmentId, String managerId) {
        return actor(id, "lower", departmentId, managerId, 3,
                Set.of("create_task", "handover_own"),
                Map.of("task_view", "self", "task_dispatch", "self",
                        "log_read", "self", "profile_read", "self"));
    }

    private static Actor administrator() {
        return actor("admin", "admin", "d1", null, 0,
                Set.of("manage_organization", "manage_accounts", "manage_company_info",
                        "manage_notifications", "view_task_history"),
                Map.of());
    }

    private static Map<String, Object> task(String creator, String... assignees) {
        return Map.of("id", "task", "organizationId", "org",
                "originalCreatorId", creator, "currentVersionId", "version");
    }

    private static Map<String, Object> person(String id, String departmentId, String managerId, int rank) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", id);
        row.put("organizationId", "org");
        row.put("departmentId", departmentId);
        row.put("managerId", managerId);
        row.put("rankLevel", rank);
        row.put("active", true);
        return row;
    }

    private static Access access(Db db) {
        return new Access(db, mock(RoleCatalog.class));
    }

    /** Department of each user id, for the department-range lookup. */
    private static Db departments(Map<String, String> byUser) {
        Db db = mock(Db.class);
        when(db.find(startsWith("SELECT department_id FROM users"), eq("org"), anyString()))
                .thenAnswer(call -> {
                    String department = byUser.get(call.getArgument(2).toString());
                    return department == null ? null : Map.of("departmentId", department);
                });
        return db;
    }

    /** Direct manager of each user id, for the direct-report lookup. */
    private static Db managers(Map<String, String> byUser) {
        Db db = mock(Db.class);
        when(db.find(startsWith("SELECT manager_id FROM users"), eq("org"), anyString()))
                .thenAnswer(call -> {
                    String manager = byUser.get(call.getArgument(2).toString());
                    return manager == null ? null : Map.of("managerId", manager);
                });
        return db;
    }

    @Test
    void departmentLeadSeesEveryTeamInsideTheDepartmentAndNothingOutsideIt() {
        Access access = access(departments(Map.of("other-team-member", "d1", "unknown", "d2")));
        Actor lead = departmentLead("lead", "d1");

        assertTrue(access.canSeeTask(lead, task("someone"), Map.of("id", "version"), List.of("other-team-member")),
                "a second team in the same department is still the same department");
        assertFalse(access.canSeeTask(lead, task("someone"), Map.of("id", "version"), List.of("unknown")),
                "an assignee outside the department is not visible");
        // An explicitly assigned lead always keeps participant access, whatever the range says.
        assertTrue(access.canSeeTask(lead, task("someone"), Map.of("id", "version"), List.of("lead")));
    }

    @Test
    void aTaskCrossingDepartmentsIsVisibleToBothDepartmentLeads() {
        Access access = access(departments(Map.of("p1", "d1", "p2", "d2")));
        Map<String, Object> crossing = task("someone", "p1", "p2");

        assertTrue(access.canSeeTask(departmentLead("lead-d1", "d1"), crossing, Map.of("id", "version"), List.of("p1", "p2")));
        assertTrue(access.canSeeTask(departmentLead("lead-d2", "d2"), crossing, Map.of("id", "version"), List.of("p1", "p2")));
        assertFalse(access.canSeeTask(departmentLead("lead-d3", "d3"), crossing, Map.of("id", "version"), List.of("p1", "p2")),
                "the creator's department does not decide the task's department");
    }

    @Test
    void viewingADepartmentDoesNotGrantDispatchInsideIt() {
        Access access = access(mock(Db.class));
        Actor lead = departmentLead("lead", "d1");

        assertTrue(access.canDispatchTo(lead, person("subordinate", "d1", "lead", 3)), "own department subordinate");
        assertTrue(access.canDispatchTo(lead, person("lead", "d1", "exec", 2)), "self is always allowed");
        assertFalse(access.canDispatchTo(lead, person("peer", "d1", "exec", 2)), "a same-level peer is not dispatchable");
        assertFalse(access.canDispatchTo(lead, person("other-department", "d2", "exec", 3)), "another department is out of range");
        assertFalse(access.canDispatchTo(lead, person("boss", "d1", null, 1)), "a higher level is not dispatchable");

        Map<String, Object> administrator = person("admin", "d1", null, 0);
        administrator.put("role", "admin");
        assertFalse(access.canDispatchTo(lead, administrator), "an administrator never takes business ownership");
    }

    @Test
    void employeeDispatchIsLimitedToSelf() {
        Access access = access(mock(Db.class));
        Actor employee = employee("me", "d1", "lead");
        assertTrue(access.canDispatchTo(employee, person("me", "d1", "lead", 3)));
        assertFalse(access.canDispatchTo(employee, person("colleague", "d1", "lead", 3)), "an employee cannot assign a colleague");
    }

    @Test
    void administratorHoldsNoEmployeeBusinessAuthority() {
        Access access = access(mock(Db.class));
        Actor admin = administrator();

        assertFalse(access.canSeeTask(admin, task("someone", "p1"), Map.of("id", "version"), List.of("p1")));
        assertFalse(access.canReadLogAuthor(admin, "p1"));
        assertFalse(access.canSeePerson(admin, person("p1", "d1", "lead", 3)));
        assertFalse(access.canDispatchTo(admin, person("p1", "d1", "lead", 3)));
    }

    @Test
    void aTeammateIsNotADirectReportForLogs() {
        Access access = access(managers(Map.of("direct-report", "lead", "teammate", "someone-else")));
        Actor lead = departmentLead("lead", "d1");

        assertTrue(access.canReadLogAuthor(lead, "lead"), "own logs are always readable");
        assertTrue(access.canReadLogAuthor(lead, "direct-report"), "a direct report is readable even from another team");
        assertFalse(access.canReadLogAuthor(lead, "teammate"), "a teammate is not a direct report");
        assertFalse(access.canReadLogAuthor(lead, "unrelated"));
    }

    @Test
    void executiveReadsTheCompanyLogsAndEmployeeOnlyTheirOwn() {
        Db db = mock(Db.class);
        when(db.find(startsWith("SELECT * FROM users WHERE id=?"), anyString(), eq("org")))
                .thenAnswer(call -> Map.of("id", call.getArgument(1).toString()));
        Access access = access(db);

        assertTrue(access.canReadLogAuthor(executive("exec"), "anyone"));
        assertTrue(access.canReadLogAuthor(employee("me", "d1", "lead"), "me"));
        assertFalse(access.canReadLogAuthor(employee("me", "d1", "lead"), "colleague"));
    }

    @Test
    void profileCompanyScopeDoesNotGrantLogsForAnIndirectReport() {
        Access access = access(managers(Map.of("indirect", "someone-else")));
        Actor manager = actor("lead", "middle", "d1", "exec", 2,
                Set.of(), Map.of("profile_read", "company", "log_read", "reports"));
        Map<String, Object> indirect = person("indirect", "d1", "someone-else", 3);

        assertTrue(access.canSeePerson(manager, indirect), "company profile scope exposes the chain person");
        assertFalse(access.canReadLogAuthor(manager, "indirect"), "log authority stays reports-only");
    }

    @Test
    void handoverIsItsOwnAuthorityForSelfOrADirectReport() {
        Access access = access(managers(Map.of("report", "lead", "stranger", "other")));
        Actor lead = departmentLead("lead", "d1");

        assertTrue(access.canHandover(lead, "lead", List.of("lead")), "own current task");
        assertTrue(access.canHandover(lead, "report", List.of("report")), "a direct report's current task");
        assertFalse(access.canHandover(lead, "stranger", List.of("stranger")), "non-direct-report is refused");
        assertFalse(access.canHandover(lead, "report", List.of("someone-else")), "the source must currently own the task");
        assertFalse(access.canHandover(employee("me", "d1", "lead"), "report", List.of("report")),
                "an employee without the reports capability cannot hand over another person's task");
    }

    @Test
    void organizationBoundaryIsCheckedBeforeAnyRange() {
        Access access = access(mock(Db.class));
        Actor executive = executive("exec");
        Map<String, Object> otherOrgTask = Map.of("id", "task", "organizationId", "org-b",
                "originalCreatorId", "exec", "currentVersionId", "version");
        assertFalse(access.canSeeTask(executive, otherOrgTask, Map.of("id", "version"), List.of("exec")));

        Map<String, Object> otherOrgPerson = new HashMap<>(person("p1", "d1", "lead", 3));
        otherOrgPerson.put("organizationId", "org-b");
        assertFalse(access.canSeePerson(executive, otherOrgPerson));
    }

    @Test
    void phoneIsVisibleToSelfAndActualSuperiorsButNeverPeersOrUnrelatedHigherRanks() {
        Db db = mock(Db.class);
        when(db.find(startsWith("SELECT * FROM users WHERE id=?"), eq("lead"), eq("org")))
                .thenReturn(person("lead", "d1", "exec", 2));
        Access access = access(db);
        Map<String, Object> report = person("report", "d1", "lead", 3);
        assertTrue(access.canReadPhone(employee("report", "d1", "lead"), report));
        assertTrue(access.canReadPhone(departmentLead("lead", "d1"), report));
        assertTrue(access.canReadPhone(executive("exec"), report), "indirect superior");
        assertFalse(access.canReadPhone(employee("peer", "d1", "lead"), report));
        assertFalse(access.canReadPhone(departmentLead("other-lead", "d1"), report));
        assertFalse(access.canReadPhone(executive("other-exec"), report), "company scope is insufficient");
        assertFalse(access.canReadPhone(employee("report", "d1", "lead"), person("lead", "d1", "exec", 2)));
        assertFalse(access.canReadPhone(administrator(), report));
        assertFalse(access.canReadPhone(executive("exec"), person("peer-exec", "d1", "exec", 1)),
                "same rank never receives phone access even with a malformed manager link");
    }

    @Test
    void phoneAccessStopsAtOrganizationBoundariesRevokedRelationshipsAndCycles() {
        Db db = mock(Db.class);
        Access access = access(db);
        Actor exec = executive("exec");
        Map<String, Object> report = new HashMap<>(person("report", "d1", "lead", 3));
        report.put("organizationId", "other-org");
        assertFalse(access.canReadPhone(exec, report));
        report.put("organizationId", "org");
        report.put("active", false);
        assertFalse(access.canReadPhone(exec, report));
        report.put("active", true);
        assertFalse(access.canReadPhone(exec, report), "inactive or missing intermediate manager");
        when(db.find(startsWith("SELECT * FROM users WHERE id=?"), eq("lead"), eq("org")))
                .thenReturn(person("lead", "d1", "exec", 2));
        assertTrue(access.canReadPhone(exec, report));
        when(db.find(startsWith("SELECT * FROM users WHERE id=?"), eq("lead"), eq("org")))
                .thenReturn(person("lead", "d1", "report", 2));
        assertFalse(access.canReadPhone(exec, report), "reassignment and a cycle revoke the old superior");
        assertFalse(access.canReadPhone(exec, null));
    }

    @Test
    void phoneAccessFailsClosedWhenTheChainCyclesPastTheViewer() {
        // employee -> middle -> upper -> middle. The viewer (middle) appears before the repeated node,
        // so returning as soon as the viewer is found would grant a phone number from corrupt data.
        Db db = mock(Db.class);
        when(db.find(startsWith("SELECT * FROM users WHERE id=?"), anyString(), eq("org")))
                .thenAnswer(call -> switch (call.getArgument(1).toString()) {
                    case "middle" -> person("middle", "d1", "upper", 2);
                    case "upper" -> person("upper", "d1", "middle", 1);
                    default -> null;
                });
        Access access = access(db);
        Map<String, Object> employeeRow = person("employee", "d1", "middle", 3);

        assertFalse(access.canReadPhone(departmentLead("middle", "d1"), employeeRow),
                "a cycle beyond the viewer cannot prove a valid management chain");
        assertFalse(access.canReadPhone(executive("upper"), employeeRow),
                "the same corrupt chain is refused for a higher viewer too");
        assertFalse(access.canReadPhone(employee("peer", "d1", "middle"), employeeRow),
                "a viewer outside the chain is still refused");
    }
}
