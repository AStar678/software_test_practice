package cn.pandora.admin;

import cn.pandora.auth.*;
import cn.pandora.common.*;
import org.springframework.stereotype.Component;
import java.time.Clock;
import java.sql.Timestamp;
import java.util.*;
import static cn.pandora.common.Db.*;
import static cn.pandora.admin.OrganizationService.*;

/** Final-plan-only deactivation. It never substitutes for employee task handover or approval. */
@Component
public class EmployeeDeactivations {
    private final Db db;
    private final AuthService auth;
    private final Events events;
    private final Clock clock;
    public EmployeeDeactivations(Db db,AuthService auth,Events events,Clock clock) {
        this.db=db;this.auth=auth;this.events=events;this.clock=clock;
    }

    Set<String> prepare(Actor actor,List<Map<String,Object>> arrangements,List<Map<String,Object>> employees,String founder) {
        Set<String> targets=new LinkedHashSet<>();
        for(var item:arrangements) {
            String employee=text(item.get("employeeId"),"停用员工ID",36);
            item.put("reason",text(item.get("reason"),"停用原因",500));
            if(!targets.add(employee)) throw bad("停用计划包含重复员工");
            if(employee.equals(founder)) throw bad("固定创始人不能停用");
            var person=employees.stream().filter(row->employee.equals(s(row,"id"))).findFirst().orElseThrow(ApiException::notFound);
            if(!Access.enabled(person)) throw bad("员工已停用");
            if(!(item.get("rowVersion") instanceof Number version) || version.longValue()!=n(person,"rowVersion"))
                throw new ApiException(412,"VERSION_CONFLICT","停用员工版本已变化");
            if(db.find("SELECT t.id FROM tasks t JOIN task_version_assignees a ON a.organization_id=t.organization_id AND a.version_id=t.current_version_id "
                    + "WHERE t.organization_id=? AND t.execution_state<>'done' AND a.user_id=? LIMIT 1",actor.organizationId(),employee)!=null)
                throw new ApiException(409,"UNFINISHED_HANDOVER_REQUIRED","未完成任务须先由业务方完成负责人交接并办结所需审批");
            person.put("active",false);
        }
        return targets;
    }

    void cancelUnpublished(Actor actor,Set<String> targets,List<Map<String,Object>> cancellations) {
        Set<String> seen=new HashSet<>();
        for(var item:cancellations) {
            String requestId=text(item.get("requestId"),"申请ID",36),reason=text(item.get("reason"),"管理撤销原因",500);
            if(!seen.add(requestId)) throw bad("撤销计划包含重复申请");
            var request=db.one("SELECT r.*,t.current_version_id FROM approval_requests r JOIN tasks t ON t.organization_id=r.organization_id AND t.id=r.task_id "
                    + "WHERE r.organization_id=? AND r.id=? FOR UPDATE",actor.organizationId(),requestId);
            if(!targets.contains(s(request,"applicantId")) || !"create".equals(s(request,"kind"))
                    || s(request,"currentVersionId")!=null || !"pending".equals(s(request,"status")))
                throw new ApiException(409,"ADMIN_CANCELLATION_NOT_ALLOWED","管理撤销仅适用于本次停用员工尚未发布的创建申请");
            if(!(item.get("rowVersion") instanceof Number version) || version.longValue()!=n(request,"rowVersion"))
                throw new ApiException(412,"VERSION_CONFLICT","待撤销创建申请已变化");
            if(request.get("applicableDeadline")==null || !clock.instant().isBefore(cn.pandora.workspace.ExpiryService.instant(request.get("applicableDeadline"))))
                throw new ApiException(409,"DEADLINE_PASSED","创建申请已到截止，请刷新责任盘点后重试");
            db.update("UPDATE approval_requests SET status='withdrawn',comment=?,decided_by=?,decided_at=?,current_reviewer_id=NULL,row_version=row_version+1 WHERE organization_id=? AND id=?",
                    reason,actor.id(),Timestamp.from(clock.instant()),actor.organizationId(),requestId);
            db.update("UPDATE task_versions SET status='withdrawn' WHERE organization_id=? AND id=? AND status='proposed'",actor.organizationId(),s(request,"proposedVersionId"));
            db.update("UPDATE tasks SET row_version=row_version+1,updated_at=UTC_TIMESTAMP(6) WHERE organization_id=? AND id=?",actor.organizationId(),s(request,"taskId"));
            var details=Map.<String,Object>of("reason",reason,"originalApplicantId",s(request,"applicantId"),"source","employee_deactivation");
            db.update("INSERT INTO task_history_entries(id,organization_id,task_id,request_id,actor_id,entry_type,field_name,before_value,after_value,detail_json) VALUES(?,?,?,?,?,'admin_creation_withdrawn','status','pending','withdrawn',?)",
                    id(),actor.organizationId(),s(request,"taskId"),requestId,actor.id(),db.json(details));
            events.record(actor,s(request,"taskId"),"task.create.admin_withdrawn",List.of(s(request,"applicantId")),details,
                    requestId,s(request,"proposedVersionId"),null,"停用准备：管理员撤销未发布创建申请。原因："+reason);
        }
    }

    int deactivate(Actor actor,List<Map<String,Object>> targets) {
        int revoked=0;
        for(var target:targets) {
            String employee=s(target,"employeeId");
            db.update("UPDATE users SET active=FALSE,reviewer_available=FALSE,org_version=org_version+1,credential_version=credential_version+1 WHERE organization_id=? AND id=?",actor.organizationId(),employee);
            db.update("UPDATE principals SET active=FALSE WHERE organization_id=? AND id=? AND account_type='employee'",actor.organizationId(),employee);
            int count=auth.revokeSessions(actor.organizationId(),employee);revoked+=count;
            events.record(actor,null,"organization.employee.deactivated",List.of(),Map.of("employeeId",employee,"reason",s(target,"reason"),"sessionsRevoked",count));
        }
        return revoked;
    }

    /** Run after final placements, ownership transfers and route refresh; failure rolls back all of it. */
    void requireSettled(Actor actor,Set<String> targets) {
        for(String employee:targets) {
            if(db.find("SELECT t.id FROM tasks t LEFT JOIN task_business_owners b ON b.organization_id=t.organization_id AND b.task_id=t.id "
                    + "WHERE t.organization_id=? AND t.current_version_id IS NOT NULL AND COALESCE(b.employee_id,t.original_creator_id)=? LIMIT 1",actor.organizationId(),employee)!=null)
                throw new ApiException(409,"BUSINESS_TAKEOVER_REQUIRED","已发布任务的全部后续业务责任须安排有效接管人，包括已完成任务");
            if(db.find("SELECT r.id FROM approval_requests r LEFT JOIN task_version_assignees a ON a.organization_id=r.organization_id AND a.version_id=r.proposed_version_id "
                    + "WHERE r.organization_id=? AND r.status='pending' AND (r.applicant_id=? OR r.current_reviewer_id=? OR a.user_id=?) LIMIT 1",
                    actor.organizationId(),employee,employee,employee)!=null)
                throw new ApiException(409,"PENDING_SETTLEMENT_REQUIRED","仍有本员工申请或包含停用负责人的待审，请先由业务方办结或撤销");
        }
        if(!targets.isEmpty() && db.find("SELECT id FROM approval_requests WHERE organization_id=? AND status='pending' AND current_reviewer_id IS NULL LIMIT 1",actor.organizationId())!=null)
            throw new ApiException(409,"PENDING_SETTLEMENT_REQUIRED","存在无法合法承接的待审，请先修复或办结");
    }
}
