package cn.pandora.admin;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import static cn.pandora.admin.OrganizationService.allowed;
import static cn.pandora.admin.OrganizationService.bad;
import static cn.pandora.admin.OrganizationService.stableId;
import static cn.pandora.admin.OrganizationService.text;
import static cn.pandora.common.Db.n;
import static cn.pandora.common.Db.s;

/**
 * Independent offboarding. The request carries only the employee, a reason, an optional unit-head
 * successor, business-takeover rows and unpublished-request cancellations. The service turns it into a
 * restricted final-state plan and reuses the existing deactivation, takeover, session-revocation,
 * approval-route refresh and settlement checks; it never accepts free placement edits.
 */
@Service
public class EmployeeOffboardings {
    private final Access access;
    private final OrganizationPlans plans;

    public EmployeeOffboardings(Access access, OrganizationPlans plans) {
        this.access = access;
        this.plans = plans;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> offboard(Actor actor, String employeeId, String ifMatch, Map<String, Object> input) {
        access.requireAdmin(actor);
        allowed(input, Set.of("reason", "successorEmployeeId", "businessTransfers", "cancelUnpublishedRequests"));
        String reason = text(input.get("reason"), "离职原因", 500);
        var draft = plans.draft(actor);
        List<Map<String, Object>> employees = (List<Map<String, Object>>) draft.get("employees");
        Map<String, Object> employee = employees.stream().filter(row -> employeeId.equals(s(row, "id")))
                .findFirst().orElseThrow(ApiException::notFound);
        if (!Access.enabled(employee)) throw bad("该员工已停用");
        String founder = s((Map<String, Object>) draft.get("organization"), "founderEmployeeId");
        if (employeeId.equals(founder)) {
            throw new ApiException(409, "FOUNDER_OFFBOARDING_NOT_ALLOWED", "固定创始人不能办理普通离职");
        }
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
        if (input.containsKey("cancelUnpublishedRequests")) plan.put("cancelUnpublishedRequests", input.get("cancelUnpublishedRequests"));
        if (input.containsKey("businessTransfers")) plan.put("businessTransfers", input.get("businessTransfers"));
        try {
            var outcome = plans.save(actor, ifMatch, plan);
            var result = new LinkedHashMap<String, Object>();
            result.put("employeeId", employeeId);
            result.put("offboarded", true);
            result.putAll(outcome.replayable());
            return result;
        } catch (ApiException error) {
            if ("INVALID_ORGANIZATION_PLAN".equals(error.code)) {
                throw new ApiException(409, "ORGANIZATION_PLAN_REQUIRED",
                        "离职会改变其他人员或单位的位置，请先到组织调整完成结构变更", error.details);
            }
            throw error;
        }
    }
}
