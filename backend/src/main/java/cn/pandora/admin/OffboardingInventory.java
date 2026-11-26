package cn.pandora.admin;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.task.TaskService;
import cn.pandora.workspace.ExpiryService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.*;

import static cn.pandora.common.Db.n;
import static cn.pandora.common.Db.s;

/**
 * Read-only responsibility inventory for the single-employee offboarding page. It binds the current
 * versions of the employee's live task assignments, published-task management, unit-head succession and
 * every pending request in which the person is applicant, reviewer or proposed assignee, together with the
 * concrete result each item can have. It never mutates data and never returns a full identity document.
 */
@Service
public class OffboardingInventory {
    private final Db db;
    private final Access access;
    private final TaskService tasks;
    private final Clock clock;

    public OffboardingInventory(Db db, Access access, TaskService tasks, Clock clock) {
        this.db = db;
        this.access = access;
        this.tasks = tasks;
        this.clock = clock;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Map<String, Object> read(Actor actor, String employeeId) {
        access.requireAdmin(actor);
        access.requireCurrent(actor);
        String org = actor.organizationId();
        Map<String, Map<String, Object>> directory = new LinkedHashMap<>();
        for (Map<String, Object> row : access.employeeDirectory(actor, true)) directory.put(s(row, "id"), row);
        Map<String, Object> employee = directory.get(employeeId);
        if (employee == null) throw ApiException.notFound();
        if (!Access.enabled(employee)) throw OrganizationService.bad("该员工已停用，不能再次办理离职");

        Map<String, Object> company = db.one("SELECT founder_employee_id,authz_version FROM organizations WHERE id=?", org);
        boolean founder = employeeId.equals(s(company, "founderEmployeeId"));
        Map<String, Object> placement = db.find("SELECT employee_id,placement_type,department_id,team_id,position_id,row_version "
                + "FROM employee_placements WHERE organization_id=? AND employee_id=?", org, employeeId);

        List<Map<String, Object>> people = new ArrayList<>();
        for (Map<String, Object> row : directory.values()) {
            if (!Access.enabled(row) || employeeId.equals(s(row, "id"))) continue;
            Map<String, Object> person = new LinkedHashMap<>();
            person.put("id", s(row, "id"));
            person.put("displayName", s(row, "displayName"));
            person.put("placementType", s(row, "placementType"));
            person.put("departmentName", row.get("departmentName"));
            person.put("teamName", row.get("teamName"));
            people.add(person);
        }
        people.sort(Comparator.comparing((Map<String, Object> row) -> Objects.toString(row.get("displayName"), ""))
                .thenComparing(row -> s(row, "id")));

        List<Map<String, Object>> pending = db.list("SELECT r.id,r.task_id,r.kind,r.applicant_id,r.current_reviewer_id,r.row_version,"
                + "r.applicable_deadline,r.route_reason,r.proposed_version_id,t.row_version AS task_version,t.current_version_id,"
                + "COALESCE(vc.title,vp.title) AS title,"
                + "(SELECT COUNT(*) FROM task_version_assignees a WHERE a.organization_id=r.organization_id "
                + " AND a.version_id=r.proposed_version_id AND a.user_id=?) AS proposed_assignee "
                + "FROM approval_requests r JOIN tasks t ON t.organization_id=r.organization_id AND t.id=r.task_id "
                + "LEFT JOIN task_versions vc ON vc.organization_id=t.organization_id AND vc.id=t.current_version_id "
                + "LEFT JOIN task_versions vp ON vp.organization_id=r.organization_id AND vp.id=r.proposed_version_id "
                + "WHERE r.organization_id=? AND r.status='pending' AND (r.applicant_id=? OR r.current_reviewer_id=? "
                + " OR EXISTS(SELECT 1 FROM task_version_assignees a3 WHERE a3.organization_id=r.organization_id "
                + " AND a3.version_id=r.proposed_version_id AND a3.user_id=?)) "
                + "ORDER BY COALESCE(vc.title,vp.title),r.created_at,r.id", employeeId, org, employeeId, employeeId, employeeId);

        List<Map<String, Object>> pendingView = new ArrayList<>();
        List<Map<String, Object>> blockers = new ArrayList<>();
        Set<String> blockedPendingTasks = new LinkedHashSet<>();
        for (Map<String, Object> request : pending) {
            Map<String, Object> view = new LinkedHashMap<>();
            boolean selfSubmitted = employeeId.equals(s(request, "applicantId"));
            boolean reviewer = !selfSubmitted && employeeId.equals(s(request, "currentReviewerId"));
            boolean proposedAssignee = request.get("proposedAssignee") instanceof Number count && count.longValue() > 0;
            boolean deadlinePassed = deadlinePassed(request.get("applicableDeadline"));
            String result;
            String blocker = null;
            if (selfSubmitted) {
                result = deadlinePassed ? "expire" : "withdraw";
            } else if (proposedAssignee) {
                result = "blocked";
                blocker = "以该员工为拟任负责人的申请不能由离职流程代处理，请先由业务方撤回或办结";
            } else if (reviewer) {
                boolean routeBlocked = routeBlocked(actor, s(request, "applicantId"));
                if (deadlinePassed) result = "expire";
                else if (routeBlocked) {
                    result = "blocked";
                    blocker = "原申请人没有可用的审核人，请先修复组织关系";
                } else result = "reassign";
            } else {
                result = "blocked";
                blocker = "该申请仍关联离职员工，请先由业务方办结";
            }
            view.put("requestId", s(request, "id"));
            view.put("taskId", s(request, "taskId"));
            view.put("requestVersion", n(request, "rowVersion"));
            view.put("taskVersion", request.get("taskVersion") == null ? null : n(request, "taskVersion"));
            view.put("kind", s(request, "kind"));
            view.put("kindLabel", ExpiryService.kindLabel(s(request, "kind")));
            view.put("title", Objects.toString(request.get("title"), "未命名任务"));
            view.put("selfSubmitted", selfSubmitted);
            view.put("reviewer", reviewer);
            view.put("proposedAssignee", proposedAssignee);
            view.put("deadlinePassed", deadlinePassed);
            view.put("result", result);
            view.put("blocker", blocker);
            view.put("resultLabel", switch (result) {
                case "withdraw" -> "本人提交，确认后撤销";
                case "expire" -> "已到截止时间，将按到期失效";
                case "reassign" -> "由本人审批，确认后重新分配";
                default -> "无法随离职处理";
            });
            if ("blocked".equals(result)) {
                blockedPendingTasks.add(s(request, "taskId"));
                blockers.add(Map.of("code", "PENDING_REQUEST", "requestId", s(request, "id"),
                        "title", Objects.toString(request.get("title"), "未命名任务"), "message", blocker));
            }
            pendingView.add(view);
        }

        List<Map<String, Object>> assignments = new ArrayList<>();
        for (Map<String, Object> task : db.list("SELECT t.id,t.row_version,t.execution_state,t.current_version_id,vc.title "
                + "FROM tasks t JOIN task_versions vc ON vc.organization_id=t.organization_id AND vc.id=t.current_version_id "
                + "JOIN task_version_assignees a ON a.organization_id=t.organization_id AND a.version_id=vc.id "
                + "WHERE t.organization_id=? AND t.deleted_at IS NULL AND t.execution_state<>'done' AND a.user_id=? "
                + "ORDER BY vc.title,t.id", org, employeeId)) {
            String taskId = s(task, "id");
            List<Map<String, Object>> owners = new ArrayList<>();
            for (Map<String, Object> row : db.list("SELECT a.user_id,u.display_name,u.active FROM task_version_assignees a "
                    + "JOIN users u ON u.organization_id=a.organization_id AND u.id=a.user_id "
                    + "WHERE a.organization_id=? AND a.version_id=? ORDER BY a.ordinal,a.user_id",
                    org, s(task, "currentVersionId"))) {
                Map<String, Object> owner = new LinkedHashMap<>();
                owner.put("id", s(row, "userId"));
                owner.put("displayName", s(row, "displayName"));
                owner.put("active", Boolean.TRUE.equals(row.get("active")) || row.get("active") instanceof Number value && value.intValue() == 1);
                owners.add(owner);
            }
            long otherValid = owners.stream().filter(owner -> owner.get("active") == Boolean.TRUE
                    && !employeeId.equals(owner.get("id"))).count();
            boolean blockedByPending = blockedPendingTasks.contains(taskId);
            // Any other person's pending request on this task makes a new execution version conflict with it.
            boolean otherPending = db.find("SELECT id FROM approval_requests WHERE organization_id=? AND task_id=? "
                    + "AND status='pending' AND applicant_id<>? LIMIT 1", org, taskId, employeeId) != null;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("taskId", taskId);
            item.put("title", s(task, "title"));
            item.put("executionState", s(task, "executionState"));
            item.put("taskVersion", n(task, "rowVersion"));
            item.put("owners", owners);
            item.put("otherValidOwners", otherValid);
            item.put("replacementRequired", otherValid == 0);
            item.put("blockedByPending", blockedByPending || otherPending);
            if (otherPending) {
                blockers.add(Map.of("code", "PENDING_ON_TASK", "taskId", taskId, "title", s(task, "title"),
                        "message", "该任务仍有他人待审申请，执行交接会使申请失效，请先由业务方办结"));
            }
            assignments.add(item);
        }

        List<Map<String, Object>> managed = new ArrayList<>();
        for (Map<String, Object> task : db.list("SELECT t.id,t.row_version,t.execution_state,vc.title,"
                + "COALESCE(b.employee_id,t.original_creator_id) AS owner_id,COALESCE(b.row_version,1) AS owner_version "
                + "FROM tasks t JOIN task_versions vc ON vc.organization_id=t.organization_id AND vc.id=t.current_version_id "
                + "LEFT JOIN task_business_owners b ON b.organization_id=t.organization_id AND b.task_id=t.id "
                + "WHERE t.organization_id=? AND t.current_version_id IS NOT NULL AND t.deleted_at IS NULL "
                + "AND COALESCE(b.employee_id,t.original_creator_id)=? ORDER BY vc.title,t.id", org, employeeId)) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("taskId", s(task, "id"));
            item.put("title", s(task, "title"));
            item.put("executionState", s(task, "executionState"));
            item.put("taskVersion", n(task, "rowVersion"));
            item.put("ownerVersion", n(task, "ownerVersion"));
            managed.add(item);
        }

        boolean head = placement != null && Set.of("team_head", "department_head").contains(s(placement, "placementType"));
        List<Map<String, Object>> successors = new ArrayList<>();
        if (head) {
            String column = "team_head".equals(s(placement, "placementType")) ? "teamName" : "departmentName";
            Object unit = employee.get(column);
            for (Map<String, Object> person : people)
                if ("employee".equals(s(person, "placementType")) && Objects.equals(person.get(column), unit)) successors.add(person);
        }
        if (founder) blockers.add(Map.of("code", "FOUNDER", "message", "固定创始人不能办理普通离职"));
        if (head && successors.isEmpty())
            blockers.add(Map.of("code", "SUCCESSION_REQUIRED", "message", "当前单位没有可接任负责人的员工，请先到组织调整安排"));
        if (placement == null)
            blockers.add(Map.of("code", "PLACEMENT_REQUIRED", "message", "该员工尚未安排组织位置，请先到组织调整补齐"));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("employeeId", employeeId);
        result.put("rowVersion", n(company, "authzVersion"));
        result.put("employee", Map.of("id", employeeId, "displayName", s(employee, "displayName"),
                "placementType", Objects.toString(s(employee, "placementType"), ""),
                "departmentName", Objects.toString(employee.get("departmentName"), ""),
                "teamName", Objects.toString(employee.get("teamName"), ""),
                "positionName", Objects.toString(employee.get("positionName"), "")));
        result.put("founder", founder);
        result.put("successionRequired", head);
        result.put("successorCandidates", successors);
        result.put("handoverCandidates", people);
        result.put("takeoverCandidates", people);
        result.put("executionAssignments", assignments);
        result.put("managedTasks", managed);
        result.put("pendingRequests", pendingView);
        result.put("blockers", blockers);
        result.put("hasWork", !assignments.isEmpty() || !managed.isEmpty() || !pendingView.isEmpty() || head);
        result.put("canOffboard", !founder && placement != null && blockers.isEmpty());
        return result;
    }

    private boolean deadlinePassed(Object value) {
        if (value == null) return false;
        Instant deadline = ExpiryService.instant(value);
        return deadline == null || !clock.instant().isBefore(deadline);
    }

    private boolean routeBlocked(Actor actor, String applicantId) {
        try {
            TaskService.Route route = tasks.creationRoute(actor, applicantId);
            return route.blocked();
        } catch (RuntimeException invalid) {
            return true;
        }
    }
}
