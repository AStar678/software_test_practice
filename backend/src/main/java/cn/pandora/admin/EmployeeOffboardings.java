package cn.pandora.admin;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.task.TaskService;
import org.springframework.stereotype.Service;

import java.util.*;

import static cn.pandora.admin.OrganizationService.allowed;
import static cn.pandora.admin.OrganizationService.bad;
import static cn.pandora.admin.OrganizationService.stableId;
import static cn.pandora.admin.OrganizationService.text;
import static cn.pandora.common.Db.n;
import static cn.pandora.common.Db.s;

/**
 * The single administrative offboarding command. It binds the inventory the administrator saw, then in one
 * transaction and under the company lock: withdraws the confirmed own pending requests, applies the
 * execution handovers, writes the final organization position and successor, transfers every published
 * task's management, refreshes the remaining pending reviewers from the final organization, deactivates the
 * account and revokes its sessions. Any late conflict rolls the whole command back.
 */
@Service
public class EmployeeOffboardings {
    private final Db db;
    private final Access access;
    private final OrganizationPlans plans;
    private final TaskService tasks;

    public EmployeeOffboardings(Db db, Access access, OrganizationPlans plans, TaskService tasks) {
        this.db = db;
        this.access = access;
        this.plans = plans;
        this.tasks = tasks;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> offboard(Actor actor, String employeeId, String ifMatch, Map<String, Object> input) {
        access.requireAdmin(actor);
        allowed(input, Set.of("reason", "successorEmployeeId", "executionHandovers", "businessTransfers", "ownPendingWithdrawals"));
        String reason = text(input.get("reason"), "离职原因", 500);
        String org = actor.organizationId();
        var draft = plans.draft(actor);
        List<Map<String, Object>> employees = (List<Map<String, Object>>) draft.get("employees");
        Map<String, Object> employee = employees.stream().filter(row -> employeeId.equals(s(row, "id")))
                .findFirst().orElseThrow(ApiException::notFound);
        if (!Access.enabled(employee)) throw bad("该员工已停用，不能再次办理离职");
        String founder = s((Map<String, Object>) draft.get("organization"), "founderEmployeeId");
        if (employeeId.equals(founder)) {
            throw new ApiException(409, "FOUNDER_OFFBOARDING_NOT_ALLOWED", "固定创始人不能办理普通离职");
        }

        List<Map<String, Object>> pending = db.list("SELECT r.id,r.task_id,r.kind,r.applicant_id,r.current_reviewer_id,r.row_version,"
                + "r.applicable_deadline,COALESCE(vc.title,vp.title) AS title,"
                + "(SELECT COUNT(*) FROM task_version_assignees a WHERE a.organization_id=r.organization_id "
                + " AND a.version_id=r.proposed_version_id AND a.user_id=?) AS proposed_assignee "
                + "FROM approval_requests r JOIN tasks t ON t.organization_id=r.organization_id AND t.id=r.task_id "
                + "LEFT JOIN task_versions vc ON vc.organization_id=t.organization_id AND vc.id=t.current_version_id "
                + "LEFT JOIN task_versions vp ON vp.organization_id=r.organization_id AND vp.id=r.proposed_version_id "
                + "WHERE r.organization_id=? AND r.status='pending' AND (r.applicant_id=? OR r.current_reviewer_id=? "
                + " OR EXISTS(SELECT 1 FROM task_version_assignees a3 WHERE a3.organization_id=r.organization_id "
                + " AND a3.version_id=r.proposed_version_id AND a3.user_id=?)) "
                + "ORDER BY COALESCE(vc.title,vp.title),r.created_at,r.id", employeeId, org, employeeId, employeeId, employeeId);

        List<Map<String, Object>> ownPending = pending.stream()
                .filter(row -> employeeId.equals(s(row, "applicantId"))).toList();
        List<Map<String, Object>> confirmations = table(input.get("ownPendingWithdrawals"), "本人待审撤销确认",
                Set.of("requestId", "rowVersion"));
        Map<String, Long> ownVersions = new LinkedHashMap<>();
        ownPending.forEach(row -> ownVersions.put(s(row, "id"), n(row, "rowVersion")));
        Map<String, Long> confirmedVersions = new LinkedHashMap<>();
        for (var confirmation : confirmations) {
            String requestId = stableId(confirmation.get("requestId"), "申请");
            if (!(confirmation.get("rowVersion") instanceof Number version))
                throw bad("待撤销申请的版本缺失，请刷新离职交接后重新确认");
            if (confirmedVersions.putIfAbsent(requestId, version.longValue()) != null)
                throw bad("待撤销申请不能重复确认");
        }
        if (!ownVersions.equals(confirmedVersions)) {
            List<Map<String, Object>> rows = ownPending.stream().map(row -> {
                var item = new LinkedHashMap<String, Object>();
                item.put("requestId", s(row, "id"));
                item.put("title", Objects.toString(row.get("title"), ""));
                item.put("kind", s(row, "kind"));
                item.put("rowVersion", n(row, "rowVersion"));
                return (Map<String, Object>) item;
            }).toList();
            throw new ApiException(409, "OFFBOARDING_PENDING_CONFIRMATION",
                    "该员工的本人待审申请已变化，请刷新离职交接并重新确认将撤销的申请", Map.of("pending", rows));
        }

        List<Map<String, Object>> blocked = new ArrayList<>();
        for (var row : pending) {
            if (employeeId.equals(s(row, "applicantId"))) continue;
            boolean proposed = row.get("proposedAssignee") instanceof Number count && count.longValue() > 0;
            if (proposed) {
                blocked.add(Map.of("requestId", s(row, "id"), "title", Objects.toString(row.get("title"), ""),
                        "reason", "PROPOSED_ASSIGNEE"));
            }
        }
        List<Map<String, Object>> requestedHandovers = table(input.get("executionHandovers"), "执行交接",
                Set.of("taskId", "taskVersion", "action", "replacementEmployeeId"));
        Set<String> executionTaskIds = new LinkedHashSet<>();
        for (var item : requestedHandovers) {
            String taskId = stableId(item.get("taskId"), "任务");
            if (taskId != null) executionTaskIds.add(taskId);
        }
        for (String taskId : executionTaskIds) {
            for (var row : pending) {
                if (taskId.equals(s(row, "taskId")) && !employeeId.equals(s(row, "applicantId"))) {
                    blocked.add(Map.of("requestId", s(row, "id"), "title", Objects.toString(row.get("title"), ""),
                            "reason", "TASK_PENDING"));
                }
            }
        }
        if (!blocked.isEmpty()) {
            throw new ApiException(409, "OFFBOARDING_PENDING_BLOCKED",
                    "仍有他人待审申请涉及离职员工或本次执行交接，请先由业务方办结后再办理离职",
                    Map.of("blockers", blocked));
        }

        List<Map<String, Object>> managed = db.list("SELECT t.id,vc.title FROM tasks t "
                + "JOIN task_versions vc ON vc.organization_id=t.organization_id AND vc.id=t.current_version_id "
                + "LEFT JOIN task_business_owners b ON b.organization_id=t.organization_id AND b.task_id=t.id "
                + "WHERE t.organization_id=? AND t.current_version_id IS NOT NULL AND t.deleted_at IS NULL "
                + "AND COALESCE(b.employee_id,t.original_creator_id)=? ORDER BY vc.title,t.id", org, employeeId);
        Set<String> managedIds = new LinkedHashSet<>();
        managed.forEach(row -> managedIds.add(s(row, "id")));
        List<Map<String, Object>> transfers = table(input.get("businessTransfers"), "管理权接管",
                Set.of("taskId", "taskVersion", "ownerVersion", "previousEmployeeId", "nextEmployeeId", "reason"));
        Set<String> transferIds = new LinkedHashSet<>();
        for (var transfer : transfers) {
            String taskId = stableId(transfer.get("taskId"), "任务");
            if (taskId != null) transferIds.add(taskId);
        }
        if (!managedIds.equals(transferIds)) {
            List<Map<String, Object>> missing = managed.stream().filter(row -> !transferIds.contains(s(row, "id")))
                    .map(row -> Map.<String, Object>of("taskId", s(row, "id"), "title", s(row, "title"))).toList();
            throw new ApiException(409, "BUSINESS_TAKEOVER_REQUIRED",
                    "已发布任务的全部后续业务责任须逐项安排接管人，包括已完成任务", Map.of("missing", missing));
        }

        // Snapshot-bound writes: withdraw the confirmed own requests first (freeing their task freeze),
        // then apply the execution handovers. The final organization write and settlement follow.
        Map<String, Object> withdrawn = tasks.withdrawOffboardingRequests(actor, employeeId, confirmations, reason);
        Set<String> withdrawnTaskIds = new HashSet<>();
        if (withdrawn.get("taskIds") instanceof List<?> touched)
            touched.forEach(taskId -> withdrawnTaskIds.add(Objects.toString(taskId, "")));
        // Withdrawing/expiring the applicant's own request advances that task's row version once. The
        // inventory versions were read before that, so rebase exactly those arrangements by one.
        List<Map<String, Object>> adjustedHandovers = new ArrayList<>();
        for (var item : requestedHandovers) {
            Map<String, Object> copy = new LinkedHashMap<>(item);
            if (withdrawnTaskIds.contains(s(item, "taskId"))) {
                if (!(item.get("taskVersion") instanceof Number version))
                    throw bad("执行交接任务版本缺失，请刷新离职交接后重试");
                copy.put("taskVersion", version.longValue() + 1);
            }
            adjustedHandovers.add(copy);
        }
        List<Map<String, Object>> handovers = tasks.applyOffboardingAssignments(actor, employeeId,
                adjustedHandovers, reason);
        Set<String> handedOverTaskIds = new HashSet<>();
        handovers.forEach(row -> handedOverTaskIds.add(s(row, "taskId")));

        List<Map<String, Object>> placements = new ArrayList<>((List<Map<String, Object>>) draft.get("placements"));
        Map<String, Object> departing = placements.stream().filter(row -> employeeId.equals(s(row, "employeeId")))
                .findFirst().orElseThrow(() -> new ApiException(409, "ORGANIZATION_PLAN_REQUIRED",
                        "该员工尚未安排组织位置，请先到组织调整补齐后再办理离职"));
        String headType = null;
        if ("team_head".equals(s(departing, "placementType"))) headType = "team_head";
        else if ("department_head".equals(s(departing, "placementType"))) headType = "department_head";
        placements.removeIf(row -> employeeId.equals(s(row, "employeeId")));
        String successorId = stableId(input.get("successorEmployeeId"), "继任人");
        if (headType == null && successorId != null) throw bad("该员工不是单位负责人，无需选择继任人");
        if (headType != null) {
            if (successorId == null) {
                throw new ApiException(400, "OFFBOARDING_SUCCESSOR_REQUIRED",
                        "该员工是" + ("team_head".equals(headType) ? "团队负责人" : "部门负责人") + "，请选择继任人");
            }
            if (successorId.equals(employeeId)) throw bad("继任人不能是离职员工本人");
            Map<String, Object> successor = employees.stream().filter(row -> successorId.equals(s(row, "id")))
                    .findFirst().orElseThrow(ApiException::notFound);
            if (!Access.enabled(successor)) throw bad("继任人必须是本公司有效员工");
            Map<String, Object> successorPlacement = placements.stream()
                    .filter(row -> successorId.equals(s(row, "employeeId"))).findFirst()
                    .orElseThrow(() -> new ApiException(409, "ORGANIZATION_PLAN_REQUIRED",
                            "继任人尚未安排组织位置，请到组织调整办理"));
            if (!"employee".equals(s(successorPlacement, "placementType"))) {
                throw new ApiException(409, "ORGANIZATION_PLAN_REQUIRED",
                        "继任人本人也是单位负责人，需要同时调整其他单位，请到组织调整办理");
            }
            if ("team_head".equals(headType)) {
                if (!Objects.equals(s(successorPlacement, "teamId"), s(departing, "teamId"))) {
                    throw bad("继任人须属于同一团队");
                }
                successorPlacement.put("placementType", "team_head");
                successorPlacement.put("departmentId", departing.get("departmentId"));
            } else {
                if (!Objects.equals(s(successorPlacement, "departmentId"), s(departing, "departmentId"))) {
                    throw bad("继任人须属于同一部门");
                }
                successorPlacement.put("placementType", "department_head");
                successorPlacement.put("teamId", null);
            }
        }

        // An execution handover bumps the task row version once; the takeover rows were captured against the
        // snapshot, so advance exactly those expected versions before the shared final-state writer re-checks.
        List<Map<String, Object>> adjustedTransfers = new ArrayList<>();
        for (var transfer : transfers) {
            Map<String, Object> copy = new LinkedHashMap<>(transfer);
            String taskId = s(transfer, "taskId");
            long bump = (handedOverTaskIds.contains(taskId) ? 1 : 0) + (withdrawnTaskIds.contains(taskId) ? 1 : 0);
            if (bump > 0) {
                if (!(transfer.get("taskVersion") instanceof Number version))
                    throw bad("接管任务版本缺失，请刷新离职交接后重试");
                copy.put("taskVersion", version.longValue() + bump);
            }
            adjustedTransfers.add(copy);
        }

        List<Map<String, Object>> expected = (List<Map<String, Object>>) draft.get("expectedEmployees");
        Map<String, Object> target = expected.stream().filter(row -> employeeId.equals(s(row, "id")))
                .findFirst().orElseThrow(ApiException::notFound);
        var plan = new LinkedHashMap<String, Object>();
        plan.put("reason", reason);
        plan.put("departments", draft.get("departments"));
        plan.put("teams", draft.get("teams"));
        plan.put("placements", placements);
        plan.put("expectedEmployees", expected);
        plan.put("deactivateEmployees", List.of(Map.of("employeeId", employeeId, "rowVersion", n(target, "rowVersion"), "reason", reason)));
        if (!adjustedTransfers.isEmpty()) plan.put("businessTransfers", adjustedTransfers);
        var outcome = plans.save(actor, ifMatch, plan);

        // The final organization recomputed the remaining pending routes. Any application that is still
        // pending but has no usable reviewer (or still points at the departing employee) aborts the whole
        // offboarding instead of leaving an unattended approval behind.
        Set<String> affected = new LinkedHashSet<>();
        for (var row : pending) {
            if (employeeId.equals(s(row, "applicantId"))) continue;
            if (employeeId.equals(s(row, "currentReviewerId")) || executionTaskIds.contains(s(row, "taskId"))) {
                affected.add(s(row, "id"));
            }
        }
        List<Map<String, Object>> unsettled = new ArrayList<>();
        for (String requestId : affected) {
            Map<String, Object> row = db.find("SELECT r.status,r.current_reviewer_id,r.route_reason,"
                    + "COALESCE(vc.title,vp.title) AS title FROM approval_requests r "
                    + "JOIN tasks t ON t.organization_id=r.organization_id AND t.id=r.task_id "
                    + "LEFT JOIN task_versions vc ON vc.organization_id=t.organization_id AND vc.id=t.current_version_id "
                    + "LEFT JOIN task_versions vp ON vp.organization_id=r.organization_id AND vp.id=r.proposed_version_id "
                    + "WHERE r.organization_id=? AND r.id=?", org, requestId);
            if (row == null) continue;
            String reviewer = s(row, "currentReviewerId");
            if ("pending".equals(s(row, "status")) && (reviewer == null || employeeId.equals(reviewer))) {
                unsettled.add(Map.of("requestId", requestId, "title", Objects.toString(row.get("title"), ""),
                        "reason", Objects.toString(s(row, "routeReason"), "route-blocked")));
            }
        }
        if (!unsettled.isEmpty()) {
            throw new ApiException(409, "OFFBOARDING_PENDING_BLOCKED",
                    "有他人的待审申请在最终组织下无法重新分配，请先由业务方办结后再办理离职",
                    Map.of("blockers", unsettled));
        }

        var result = new LinkedHashMap<String, Object>();
        result.put("employeeId", employeeId);
        result.put("offboarded", true);
        result.put("withdrawnOwnRequests", withdrawn.get("withdrawn"));
        result.put("expiredOwnRequests", withdrawn.get("expired"));
        result.put("executionHandovers", handovers);
        result.putAll(outcome.replayable());
        return result;
    }

    /** Parses an optional array of flat objects and rejects duplicate or unknown fields before any write. */
    private static List<Map<String, Object>> table(Object raw, String label, Set<String> fields) {
        if (raw == null) return List.of();
        if (!(raw instanceof List<?> list)) throw bad(label + "须为完整数组");
        if (list.size() > 5000) throw bad(label + "最多5000项");
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object value : list) {
            if (!(value instanceof Map<?, ?> map)) throw bad(label + "格式不正确");
            Map<String, Object> row = new LinkedHashMap<>();
            map.forEach((key, entry) -> {
                if (!(key instanceof String)) throw bad(label + "格式不正确");
                row.put((String) key, entry);
            });
            allowed(row, fields);
            result.add(row);
        }
        return result;
    }
}
