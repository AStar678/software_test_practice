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

/** Complete final-state organization commands. Writes owns the company lock and transaction. */
@Service
public class OrganizationPlans {
    private final Db db;
    private final Access access;
    private final AuthService auth;
    private final Events events;
    private final TaskService tasks;
    private final OrganizationConstraints constraints;
    private final BusinessTakeovers takeovers;
    private final EmployeeDeactivations deactivations;
    public OrganizationPlans(Db db,Access access,AuthService auth,Events events,TaskService tasks,OrganizationConstraints constraints,
                             BusinessTakeovers takeovers,EmployeeDeactivations deactivations) {
        this.db=db;this.access=access;this.auth=auth;this.events=events;this.tasks=tasks;this.constraints=constraints;
        this.takeovers=takeovers;this.deactivations=deactivations;
    }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> draft(Actor actor) {
        access.requireAdmin(actor);access.requireCurrent(actor);
        var company=db.one("SELECT id,founder_employee_id,authz_version FROM organizations WHERE id=?",actor.organizationId());
        var result=new LinkedHashMap<String,Object>();
        result.put("organization",company);result.put("rowVersion",company.get("authzVersion"));
        result.put("departments",db.list("SELECT id,name,row_version FROM departments WHERE organization_id=? ORDER BY id",actor.organizationId()));
        result.put("teams",db.list("SELECT id,name,department_id,row_version FROM teams WHERE organization_id=? ORDER BY id",actor.organizationId()));
        result.put("positions",db.list("SELECT id,name,row_version FROM positions WHERE organization_id=? ORDER BY sort_order,name,id",actor.organizationId()));
        result.put("employees",access.employeeDirectory(actor,true));
        result.put("placements",db.list("SELECT employee_id,placement_type,department_id,team_id,position_id,row_version FROM employee_placements WHERE organization_id=? ORDER BY employee_id",actor.organizationId()));
        result.put("expectedEmployees",db.list("SELECT u.id,u.org_version AS row_version FROM users u JOIN principals p ON p.organization_id=u.organization_id AND p.id=u.id AND p.account_type='employee' WHERE u.organization_id=? ORDER BY u.id",actor.organizationId()));
        result.put("constraints",constraints.status(actor.organizationId()));return result;
    }

    public Writes.Outcome save(Actor actor,String ifMatch,Map<String,Object> input) {
        access.requireAdmin(actor);
        allowed(input,Set.of("reason","founderEmployeeId","departments","teams","placements","expectedEmployees","newEmployees",
                "deactivateEmployees","businessTransfers","cancelUnpublishedRequests"));
        String reason=text(input.get("reason"),"调整原因",500),org=actor.organizationId();
        var company=db.one("SELECT founder_employee_id,authz_version FROM organizations WHERE id=?",org);
        Writes.checkVersion(ifMatch,n(company,"authzVersion"));
        String founder=input.containsKey("founderEmployeeId")?identifier(input.get("founderEmployeeId"),"founderEmployeeId"):s(company,"founderEmployeeId");
        if(s(company,"founderEmployeeId")!=null && !Objects.equals(founder,s(company,"founderEmployeeId")))
            throw bad("固定创始人不能交接或调任");
        var previousDepartments=db.list("SELECT * FROM departments WHERE organization_id=? ORDER BY id",org);
        var previousTeams=db.list("SELECT * FROM teams WHERE organization_id=? ORDER BY id",org);
        var previousPlacements=db.list("SELECT * FROM employee_placements WHERE organization_id=? ORDER BY employee_id",org);
        var employees=new ArrayList<>(db.list("SELECT u.id,u.organization_id,(u.active AND p.active) AS active,u.org_version AS row_version FROM users u JOIN principals p ON p.organization_id=u.organization_id AND p.id=u.id AND p.account_type='employee' WHERE u.organization_id=? ORDER BY u.id",org));
        versions(rows(input,"expectedEmployees",Set.of("id","rowVersion")),employees,"id",true);
        var disabled=input.containsKey("deactivateEmployees")?rows(input,"deactivateEmployees",Set.of("employeeId","rowVersion","reason")):List.<Map<String,Object>>of();
        var disabledIds=deactivations.prepare(actor,disabled,employees,founder);
        var cancellations=input.containsKey("cancelUnpublishedRequests")?rows(input,"cancelUnpublishedRequests",Set.of("requestId","rowVersion","reason")):List.<Map<String,Object>>of();
        if(!cancellations.isEmpty() && disabled.isEmpty()) throw bad("管理撤销只能随完整停用计划提交");
        var departments=units(rows(input,"departments",Set.of("id","name","rowVersion")),org,false);
        var teams=units(rows(input,"teams",Set.of("id","name","departmentId","rowVersion")),org,true);
        var placements=rows(input,"placements",Set.of("employeeId","placementType","departmentId","teamId","positionId","rowVersion"));
        for(var placement:placements) {
            placement.put("organizationId",org);
            for(String field:List.of("employeeId","positionId")) placement.put(field,identifier(placement.get(field),field));
            for(String field:List.of("departmentId","teamId"))
                if(placement.get(field)!=null) placement.put(field,identifier(placement.get(field),field));
        }
        versions(departments,previousDepartments,"id",false);versions(teams,previousTeams,"id",false);
        versions(placements,previousPlacements,"employeeId",false);
        List<Map<String,Object>> additions=input.containsKey("newEmployees")?rows(input,"newEmployees",Set.of("id","displayName","phone")):List.of();
        Set<String> employeeIds=new HashSet<>();employees.forEach(person->employeeIds.add(s(person,"id")));
        Set<String> phones=new HashSet<>();
        for(var person:additions) {
            String id=identifier(person.get("id"),"id");
            if(!employeeIds.add(id) || db.find("SELECT id FROM principals WHERE id=?",id)!=null) throw bad("新员工ID已被使用");
            person.put("id",id);person.put("displayName",text(person.get("displayName"),"姓名",100));
            String phone=person.get("phone") instanceof String raw?PhoneNumbers.normalize(raw):null;
            if(phone==null) throw bad("新员工手机号为必填且须有效");
            if(!phones.add(phone) || db.find("SELECT id FROM users WHERE login_phone=?",phone)!=null)
                throw new ApiException(409,"PHONE_TAKEN","员工手机号已被使用");
            person.put("phone",phone);
            employees.add(Map.of("id",id,"organizationId",org,"active",true));
        }
        var titles=db.list("SELECT * FROM positions WHERE organization_id=? ORDER BY id",org);
        var finalTree=CompanyTree.validate(org,founder,employees,departments,teams,titles,placements);
        if(!finalTree.valid()) throw new ApiException(409,"INVALID_ORGANIZATION_PLAN","完整组织结果不合法",Map.of("blockers",finalTree.blockers()));
        // Validate first, then replace inside this single DML transaction. Unique head slots need no
        // deferrable constraint, and readers on a consistent snapshot never see this intermediate state.
        db.update("DELETE FROM employee_placements WHERE organization_id=?",org);
        // Clear transitional organization facts; they are never copied back from the new model.
        db.update("UPDATE users SET department_id=NULL,team_id=NULL,manager_id=NULL,position_id=NULL WHERE organization_id=?",org);
        db.update("UPDATE teams SET parent_id=NULL,lead_user_id=NULL WHERE organization_id=?",org);
        db.update("UPDATE departments SET parent_id=NULL,name=CONCAT('__plan_',id) WHERE organization_id=?",org);
        writeUnits(org,"departments",departments,previousDepartments,false);
        writeUnits(org,"teams",teams,previousTeams,true);
        deleteMissing(org,"teams",teams,previousTeams);deleteMissing(org,"departments",departments,previousDepartments);
        Map<String,String> passwords=new LinkedHashMap<>();
        for(var person:additions) {
            String employeeId=s(person,"id"),password=Credentials.generate();
            db.update("INSERT INTO principals(id,organization_id,account_type) VALUES(?,?,'employee')",employeeId,org);
            // V20 expansion compatibility only; final cleanup removes these three legacy columns.
            db.update("INSERT INTO users(id,organization_id,username,role,rank_level,password_hash,display_name,phone,login_phone,must_change_password) VALUES(?,?,?,'lower',4,?,?,?,?,TRUE)",
                    employeeId,org,employeeId,AuthService.PASSWORDS.encode(password),s(person,"displayName"),s(person,"phone"),s(person,"phone"));
            passwords.put(employeeId,password);
        }
        Map<String,Map<String,Object>> oldPlaces=index(previousPlacements,"employeeId");
        for(var placement:placements) {
            var old=oldPlaces.get(s(placement,"employeeId"));
            db.update("INSERT INTO employee_placements(organization_id,employee_id,placement_type,department_id,team_id,position_id,row_version) VALUES(?,?,?,?,?,?,?)",
                    org,s(placement,"employeeId"),s(placement,"placementType"),placement.get("departmentId"),placement.get("teamId"),s(placement,"positionId"),old==null?1:n(old,"rowVersion")+1);
            db.update("UPDATE users SET org_version=org_version+1 WHERE organization_id=? AND id=?",org,s(placement,"employeeId"));
        }
        deactivations.cancelUnpublished(actor,disabledIds,cancellations);
        int sessionsRevoked=deactivations.deactivate(actor,disabled);
        db.update("UPDATE organizations SET founder_employee_id=?,authz_version=authz_version+1 WHERE id=?",founder,org);
        Actor current=access.actor(auth.account(actor));
        List<Map<String,Object>> transfers=List.of();
        if(input.containsKey("businessTransfers")) {
            if(!(input.get("businessTransfers") instanceof List<?> raw)) throw bad("businessTransfers须为接管安排数组");
            transfers=takeovers.apply(current,raw);
        }
        int refreshed=tasks.refreshPendingRoutes(current);
        deactivations.requireSettled(current,disabledIds);
        var readiness=constraints.status(org);
        if(Boolean.TRUE.equals(readiness.get("formalWritesReady")))
            db.update("UPDATE migration_findings SET resolved_at=UTC_TIMESTAMP(6) WHERE organization_id=? AND category IN ('fixed_organization_mapping','organization_mapping','team_department_mapping') AND resolved_at IS NULL",org);
        Map<String,Object> audit=new LinkedHashMap<>();
        audit.put("reason",reason);audit.put("beforeDepartments",previousDepartments);audit.put("afterDepartments",departments);
        audit.put("beforeTeams",previousTeams);audit.put("afterTeams",teams);
        audit.put("beforePlacements",previousPlacements);audit.put("afterPlacements",placements);
        audit.put("createdEmployeeIds",passwords.keySet());audit.put("founderEmployeeId",founder);audit.put("refreshedRequests",refreshed);
        audit.put("deactivatedEmployees",disabled);audit.put("businessTransfers",transfers);audit.put("cancelledUnpublishedRequests",cancellations);
        events.record(current,null,"organization.plan.applied",List.of(),audit);
        var result=new LinkedHashMap<String,Object>();
        result.put("rowVersion",n(company,"authzVersion")+1);result.put("createdEmployeeIds",List.copyOf(passwords.keySet()));
        result.put("refreshedRequests",refreshed);result.put("constraints",readiness);
        result.put("deactivatedEmployeeIds",List.copyOf(disabledIds));result.put("sessionsRevoked",sessionsRevoked);
        return new Writes.Outcome(result,passwords.isEmpty()?Map.of():Map.of("initialPasswords",passwords));
    }

    private static List<Map<String,Object>> rows(Map<String,Object> input,String field,Set<String> fields) {
        if(!(input.get(field) instanceof List<?> list) || list.size()>10000) throw bad(field+"须为完整数组");
        var result=new ArrayList<Map<String,Object>>();
        for(Object raw:list) {
            if(!(raw instanceof Map<?,?> map) || map.keySet().stream().anyMatch(key->!(key instanceof String))) throw bad(field+"格式不正确");
            Map<String,Object> row=new LinkedHashMap<>();map.forEach((key,value)->row.put((String)key,value));allowed(row,fields);result.add(row);
        }
        return result;
    }
    private static List<Map<String,Object>> units(List<Map<String,Object>> rows,String org,boolean team) {
        Set<String> names=new HashSet<>();
        for(var row:rows) {
            row.put("id",identifier(row.get("id"),"id"));row.put("organizationId",org);
            String name=text(row.get("name"),"单位名称",100);row.put("name",name);
            if(!names.add(name.toLowerCase(Locale.ROOT))) throw bad("单位名称重复");
            if(team) row.put("departmentId",identifier(row.get("departmentId"),"departmentId"));
        }
        return rows;
    }
    private static Map<String,Map<String,Object>> index(List<Map<String,Object>> rows,String key) {
        Map<String,Map<String,Object>> result=new LinkedHashMap<>();
        for(var row:rows) if(result.putIfAbsent(s(row,key),row)!=null) throw bad("计划包含重复ID");
        return result;
    }
    private static void versions(List<Map<String,Object>> desired,List<Map<String,Object>> previous,String key,boolean exact) {
        var before=index(previous,key);var after=index(desired,key);
        if(exact && !before.keySet().equals(after.keySet())) throw new ApiException(412,"VERSION_CONFLICT","人员清单已变化，请重新读取完整计划");
        after.forEach((id,row)->{
            var old=before.get(id);
            if(old!=null && (!(row.get("rowVersion") instanceof Number version) || version.longValue()!=n(old,"rowVersion")))
                throw new ApiException(412,"VERSION_CONFLICT","组织或人员版本已变化，请重新读取完整计划");
            if(old==null && row.get("rowVersion")!=null) throw bad("新记录不能携带旧版本");
        });
    }
    private void writeUnits(String org,String table,List<Map<String,Object>> desired,List<Map<String,Object>> previous,boolean team) {
        var before=index(previous,"id");
        for(var row:desired) {
            if(before.containsKey(s(row,"id"))) {
                if(team) db.update("UPDATE teams SET name=?,department_id=?,row_version=row_version+1 WHERE organization_id=? AND id=?",s(row,"name"),s(row,"departmentId"),org,s(row,"id"));
                else db.update("UPDATE departments SET name=?,row_version=row_version+1 WHERE organization_id=? AND id=?",s(row,"name"),org,s(row,"id"));
            } else {
                if(team) db.update("INSERT INTO teams(id,organization_id,name,department_id) VALUES(?,?,?,?)",s(row,"id"),org,s(row,"name"),s(row,"departmentId"));
                else db.update("INSERT INTO departments(id,organization_id,name) VALUES(?,?,?)",s(row,"id"),org,s(row,"name"));
            }
        }
    }
    private void deleteMissing(String org,String table,List<Map<String,Object>> desired,List<Map<String,Object>> previous) {
        var after=index(desired,"id");
        for(var row:previous) if(!after.containsKey(s(row,"id"))) db.update("DELETE FROM "+table+" WHERE organization_id=? AND id=?",org,s(row,"id"));
    }
    private static String identifier(Object value,String field) {
        if(!(value instanceof String id) || !id.matches("[A-Za-z0-9_-]{1,36}")) throw bad(field+"须为有效稳定ID");return id;
    }
}
