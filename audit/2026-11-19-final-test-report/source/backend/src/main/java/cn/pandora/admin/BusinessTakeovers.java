package cn.pandora.admin;

import cn.pandora.auth.*;
import cn.pandora.common.*;
import cn.pandora.task.TaskService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import static cn.pandora.common.Db.*;
import static cn.pandora.admin.OrganizationService.*;

/** Administrative provenance is separate from the employee who takes actual business responsibility. */
@Service
public class BusinessTakeovers {
    private final Db db;
    private final Access access;
    private final AuthService auth;
    private final Events events;
    private final TaskService tasks;
    public BusinessTakeovers(Db db,Access access,AuthService auth,Events events,TaskService tasks) {
        this.db=db;this.access=access;this.auth=auth;this.events=events;this.tasks=tasks;
    }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> inventory(Actor actor,String employeeId) {
        access.requireAdmin(actor);access.requireCurrent(actor);
        if(access.knownUser(actor,employeeId)==null) throw ApiException.notFound();
        var result=new LinkedHashMap<String,Object>();
        result.put("employeeId",employeeId);result.put("rowVersion",actor.authzVersion());
        result.put("placement",db.find("SELECT * FROM employee_placements WHERE organization_id=? AND employee_id=?",actor.organizationId(),employeeId));
        result.put("businessTasks",db.list("SELECT t.id,t.original_creator_id,t.execution_state,t.row_version,v.title,COALESCE(b.employee_id,t.original_creator_id) AS business_owner_id,COALESCE(b.row_version,1) AS owner_version FROM tasks t JOIN task_versions v ON v.organization_id=t.organization_id AND v.id=t.current_version_id LEFT JOIN task_business_owners b ON b.organization_id=t.organization_id AND b.task_id=t.id WHERE t.organization_id=? AND COALESCE(b.employee_id,t.original_creator_id)=? ORDER BY t.id",actor.organizationId(),employeeId));
        result.put("unfinishedAssignments",db.list("SELECT t.id,t.row_version,v.title FROM tasks t JOIN task_versions v ON v.organization_id=t.organization_id AND v.id=t.current_version_id JOIN task_version_assignees a ON a.organization_id=t.organization_id AND a.version_id=v.id WHERE t.organization_id=? AND t.execution_state<>'done' AND a.user_id=? ORDER BY t.id",actor.organizationId(),employeeId));
        result.put("pendingRequests",db.list("SELECT id,task_id,kind,applicant_id,current_reviewer_id,row_version,applicable_deadline FROM approval_requests WHERE organization_id=? AND status='pending' AND (applicant_id=? OR current_reviewer_id=?) ORDER BY id",actor.organizationId(),employeeId,employeeId));
        return result;
    }

    public Map<String,Object> transfer(Actor actor,String ifMatch,Map<String,Object> input) {
        access.requireAdmin(actor);allowed(input,Set.of("transfers"));
        var company=db.one("SELECT authz_version FROM organizations WHERE id=?",actor.organizationId());
        Writes.checkVersion(ifMatch,n(company,"authzVersion"));
        if(!(input.get("transfers") instanceof List<?> raw) || raw.isEmpty()) throw bad("transfers须为非空接管安排");
        var prepared=apply(actor,raw);
        db.update("UPDATE organizations SET authz_version=authz_version+1 WHERE id=?",actor.organizationId());
        int refreshed=tasks.refreshPendingRoutes(access.actor(auth.account(actor)));
        return Map.of("rowVersion",n(company,"authzVersion")+1,"transfers",prepared,"refreshedRequests",refreshed);
    }

    /** Shared by final deactivation plans; the caller owns company lock, versions and route refresh. */
    List<Map<String,Object>> apply(Actor actor,List<?> raw) {
        access.requireAdmin(actor);
        if(raw.size()>1000) throw bad("接管安排最多1000项");
        Set<String> seen=new HashSet<>();List<Map<String,Object>> prepared=new ArrayList<>();
        for(Object value:raw) {
            if(!(value instanceof Map<?,?> map)) throw bad("接管安排格式无效");
            Map<String,Object> item=new LinkedHashMap<>();
            map.forEach((key,entry)->{if(!(key instanceof String))throw bad("接管字段无效");item.put((String)key,entry);});
            allowed(item,Set.of("taskId","taskVersion","ownerVersion","previousEmployeeId","nextEmployeeId","reason"));
            String taskId=requiredUuid(item.get("taskId"),"taskId"),target=requiredUuid(item.get("nextEmployeeId"),"nextEmployeeId");
            if(!seen.add(taskId)) throw bad("同一任务只能安排一次接管");
            String reason=text(item.get("reason"),"接管原因",500);
            var task=db.one("SELECT * FROM tasks WHERE organization_id=? AND id=? FOR UPDATE",actor.organizationId(),taskId);
            if(s(task,"currentVersionId")==null) throw bad("未发布创建申请不能改写为他人的业务创建");
            String previous=access.businessOwner(task);
            if(!Objects.equals(previous,item.get("previousEmployeeId"))) throw new ApiException(412,"VERSION_CONFLICT","当前业务责任方已变化");
            if(previous.equals(target)) throw bad("接管人与原业务责任方不能相同");
            if(access.activeUser(actor,target)==null) throw bad("接管人须为本公司有效业务员工");
            var owner=db.find("SELECT row_version FROM task_business_owners WHERE organization_id=? AND task_id=?",actor.organizationId(),taskId);
            long ownerVersion=owner==null?1:n(owner,"rowVersion");
            if(!(item.get("taskVersion") instanceof Number taskVersion) || taskVersion.longValue()!=n(task,"rowVersion")
                    || !(item.get("ownerVersion") instanceof Number expected) || expected.longValue()!=ownerVersion)
                throw new ApiException(412,"VERSION_CONFLICT","任务或业务责任版本已变化");
            prepared.add(Map.of("taskId",taskId,"previousEmployeeId",previous,"nextEmployeeId",target,"reason",reason,"ownerVersion",ownerVersion+1));
        }
        for(var item:prepared) {
            String taskId=s(item,"taskId");
            db.update("INSERT INTO task_business_owners(organization_id,task_id,employee_id,row_version) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE employee_id=VALUES(employee_id),row_version=VALUES(row_version),updated_at=UTC_TIMESTAMP(6)",
                    actor.organizationId(),taskId,s(item,"nextEmployeeId"),n(item,"ownerVersion"));
            db.update("INSERT INTO task_business_transfers(id,organization_id,task_id,previous_employee_id,next_employee_id,administrator_id,reason,owner_version) VALUES(?,?,?,?,?,?,?,?)",
                    id(),actor.organizationId(),taskId,s(item,"previousEmployeeId"),s(item,"nextEmployeeId"),actor.id(),s(item,"reason"),n(item,"ownerVersion"));
            db.update("UPDATE tasks SET row_version=row_version+1,updated_at=UTC_TIMESTAMP(6) WHERE organization_id=? AND id=?",actor.organizationId(),taskId);
            db.update("INSERT INTO task_history_entries(id,organization_id,task_id,actor_id,entry_type,field_name,before_value,after_value,detail_json) VALUES(?,?,?,?,'business_takeover','businessOwnerId',?,?,?)",
                    id(),actor.organizationId(),taskId,actor.id(),s(item,"previousEmployeeId"),s(item,"nextEmployeeId"),db.json(Map.of("reason",s(item,"reason"),"ownerVersion",n(item,"ownerVersion"))));
            events.record(actor,taskId,"task.business.takeover",List.of(s(item,"previousEmployeeId"),s(item,"nextEmployeeId")),item);
        }
        return prepared;
    }
}
