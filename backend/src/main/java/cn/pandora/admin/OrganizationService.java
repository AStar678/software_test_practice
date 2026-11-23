package cn.pandora.admin;

import cn.pandora.auth.*;
import cn.pandora.common.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import java.util.regex.Pattern;
import static cn.pandora.common.Db.*;

/** Independent administration; organization relationships are written only by complete plans. */
@Service
public class OrganizationService {
    private static final Pattern TIME=Pattern.compile("^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$");
    private static final Set<String> LEVELS=Set.of("urgent","high","medium","low");
    private static final int COMPANY_ITEM_LIMIT=10;
    private final Db db;
    private final Access access;
    private final Events events;
    private final OrganizationConstraints constraints;
    private final AuthService auth;
    private final OrganizationPlans plans;
    private final java.time.Clock clock;
    public OrganizationService(Db db,Access access,Events events,OrganizationConstraints constraints,AuthService auth,OrganizationPlans plans,
                               java.time.Clock clock) {
        this.db=db;this.access=access;this.events=events;this.constraints=constraints;this.auth=auth;this.plans=plans;this.clock=clock;
    }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> structure(Actor actor) {
        access.requireAdmin(actor);access.requireCurrent(actor);
        var result=new LinkedHashMap<String,Object>(plans.draft(actor));
        result.put("organization",db.one("SELECT id,name,time_zone,off_work_time,founder_employee_id,authz_version FROM organizations WHERE id=?",actor.organizationId()));
        return result;
    }
    public boolean applyOrganizationConstraints() {return false;}
    public List<Map<String,Object>> roles(Actor actor) {access.requireAdmin(actor);throw retiredRoles();}
    public Map<String,Object> updateRoleScopes(Actor actor,String code,Map<String,Object> input) {access.requireAdmin(actor);throw retiredRoles();}
    public Map<String,Object> grantRoles(Actor actor,String id,String match,Map<String,Object> input) {access.requireAdmin(actor);throw retiredRoles();}
    private static ApiException retiredRoles() {return new ApiException(410,"ROLE_AUTHORIZATION_RETIRED","业务权限由固定组织位置推导，不再维护角色授权");}
    private ApiException planRequired(Actor actor) {access.requireAdmin(actor);return new ApiException(410,"ORGANIZATION_PLAN_REQUIRED","请一次提交完整组织计划，安排单位负责人和所有人员最终位置");}
    public Map<String,Object> createDepartment(Actor actor,Map<String,Object> input) {throw planRequired(actor);}
    public Map<String,Object> updateDepartment(Actor actor,String id,String match,Map<String,Object> input) {throw planRequired(actor);}
    public Map<String,Object> createTeam(Actor actor,Map<String,Object> input) {throw planRequired(actor);}
    public Map<String,Object> updateTeam(Actor actor,String id,String match,Map<String,Object> input) {throw planRequired(actor);}
    public Map<String,Object> transferEmployee(Actor actor,String id,String match,Map<String,Object> input) {throw planRequired(actor);}
    public Map<String,Object> teamManagement(Actor actor) {throw new ApiException(403,"FORBIDDEN","组织由独立管理员通过完整计划维护");}

    private static final Set<String> PLACEMENT_TYPES=Set.of("founder","department_head","team_head","employee");

    /** Combinable employee-page filters; list and total are computed from the same condition set. */
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> employees(Actor actor,Map<String,String> filters) {
        access.requireAdmin(actor);access.requireCurrent(actor);
        String query=filters.getOrDefault("q","").strip().toLowerCase(Locale.ROOT);
        String departmentId=optionalUuid(filters.get("departmentId"),"departmentId");
        String teamId=optionalUuid(filters.get("teamId"),"teamId");
        String positionId=optionalUuid(filters.get("positionId"),"positionId");
        String placementType=filters.getOrDefault("placementType","").strip();
        if(!placementType.isEmpty() && !PLACEMENT_TYPES.contains(placementType)) throw bad("无效的组织身份筛选");
        Boolean active=optionalBoolean(filters.get("active"),"active");
        var phones=new HashMap<String,Object>();
        var hireDates=new HashMap<String,Object>();
        for (var row:db.list("SELECT id,login_phone,hire_date FROM users WHERE organization_id=?",actor.organizationId())) {
            phones.put(s(row,"id"),row.get("loginPhone"));
            hireDates.put(s(row,"id"),row.get("hireDate"));
        }
        // The identity table is read only here (administrator list): values leave masked, and the
        // employee-facing directory, candidates, tasks, logs and analytics never query this table.
        var maskedIds=new HashMap<String,String>();
        for (var row:db.list("SELECT employee_id,id_card_no FROM employee_identity_documents WHERE organization_id=?",actor.organizationId()))
            maskedIds.put(s(row,"employeeId"),IdCardNumbers.mask(s(row,"idCardNo")));
        var rows=access.employeeDirectory(actor,true).stream()
                .filter(row->query.isEmpty()
                        || Objects.toString(row.get("displayName"),"").toLowerCase(Locale.ROOT).contains(query)
                        || Objects.toString(row.get("departmentName"),"").toLowerCase(Locale.ROOT).contains(query)
                        || Objects.toString(phones.get(s(row,"id")),"").toLowerCase(Locale.ROOT).contains(query))
                .filter(row->departmentId==null || departmentId.equals(s(row,"departmentId")))
                .filter(row->teamId==null || teamId.equals(s(row,"teamId")))
                .filter(row->positionId==null || positionId.equals(s(row,"positionId")))
                .filter(row->placementType.isEmpty() || placementType.equals(s(row,"placementType")))
                .filter(row->active==null || active==Access.enabled(row))
                .map(row -> {var item=new LinkedHashMap<>(row);item.put("loginPhone",phones.get(s(row,"id")));
                    item.put("hireDate",hireDates.get(s(row,"id")));
                    item.put("idCardNoMasked",maskedIds.get(s(row,"id")));return item;}).toList();
        return Map.of("items",rows,"total",rows.size());
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> employee(Actor actor,String id) {
        access.requireAdmin(actor);access.requireCurrent(actor);
        var person=access.employeeDirectory(actor,true).stream().filter(row->id.equals(s(row,"id"))).findFirst().orElseThrow(ApiException::notFound);
        var item=new LinkedHashMap<>(person);
        var phone=db.find("SELECT login_phone,hire_date FROM users WHERE organization_id=? AND id=?",actor.organizationId(),id);
        item.put("loginPhone",phone==null?null:phone.get("loginPhone"));
        item.put("hireDate",phone==null?null:phone.get("hireDate"));
        // The full number is readable only in this administrator detail; old employees with no
        // document row stay an explicit null and the administrator may record it later.
        var document=db.find("SELECT id_card_no FROM employee_identity_documents WHERE organization_id=? AND employee_id=?",actor.organizationId(),id);
        item.put("idCardNo",document==null?null:s(document,"idCardNo"));
        return item;
    }
    public List<Map<String,Object>> departmentMembers(Actor actor,String departmentId) {
        access.requireAdmin(actor);requireDepartment(actor,departmentId);
        return access.employeeDirectory(actor,false).stream().filter(row->departmentId.equals(s(row,"departmentId"))).toList();
    }

    @SuppressWarnings("unchecked")
    public Writes.Outcome createEmployee(Actor actor,Map<String,Object> input) {
        access.requireAdmin(actor);
        allowed(input,Set.of("displayName","phone","idCardNo","placementType","departmentId","teamId","positionId","hireDate"));
        // The independent onboarding wizard always supplies the identity document; it is written to
        // the dedicated table in the same transaction that creates the account.
        String idCardNo=IdCardNumbers.normalize(input.get("idCardNo"),"身份证号",companyToday(actor));
        var draft=plans.draft(actor);String id=Db.id();
        var plan=new LinkedHashMap<String,Object>();
        for(String key:List.of("departments","teams","placements","expectedEmployees")) plan.put(key,draft.get(key));
        // Draft lists are local copies; cancellation or failed final validation leaves the DB untouched.
        var places=new ArrayList<>((List<Map<String,Object>>)draft.get("placements"));
        var placement=new LinkedHashMap<String,Object>();placement.put("employeeId",id);
        for(String field:List.of("placementType","departmentId","teamId","positionId")) placement.put(field,input.get(field));
        places.add(placement);plan.put("placements",places);plan.put("reason","新增员工");
        var addition=new LinkedHashMap<String,Object>();addition.put("id",id);addition.put("displayName",input.get("displayName"));addition.put("phone",input.get("phone"));
        addition.put("hireDate",input.get("hireDate"));
        plan.put("newEmployees",List.of(addition));
        Writes.Outcome outcome;
        try {
            outcome=plans.save(actor,"\""+draft.get("rowVersion")+"\"",plan);
        } catch(ApiException conflict) {
            // A minimal single-person plan can only fail because the requested slot collides with an
            // existing person or unit (second founder, occupied head slot, broken structure); such
            // changes belong to the organization-adjustment page, never a silent partial write.
            if("INVALID_ORGANIZATION_PLAN".equals(conflict.code))
                throw new ApiException(409,"ORGANIZATION_PLAN_REQUIRED","该入职位置与既有组织冲突，请到组织调整提交完整计划",conflict.details);
            throw conflict;
        }
        try {
            db.update("INSERT INTO employee_identity_documents(organization_id,employee_id,id_card_no) VALUES(?,?,?)",
                    actor.organizationId(),id,idCardNo);
        } catch(org.springframework.dao.DuplicateKeyException error) {
            throw new ApiException(409,"ID_CARD_TAKEN","该身份证号已被本公司员工使用");
        }
        var passwords=(Map<String,String>)outcome.oneTimeOnly().get("initialPasswords");
        return new Writes.Outcome(Map.of("userId",id,"rowVersion",2,"mustChangePassword",true),Map.of("initialPassword",passwords.get(id)));
    }

    /**
     * Independent offboarding: the request only names the employee, the reason, an optional unit-head
     * successor, business takeovers and unpublished-request handling. A restricted minimal plan is
     * assembled server-side and validated by the complete-plan contract, so handover, takeover,
     * session revocation and approval refresh cannot be bypassed; any failure rolls back the whole
     * offboarding.
     */
    @SuppressWarnings("unchecked")
    public Writes.Outcome offboard(Actor actor,String id,Map<String,Object> input) {
        access.requireAdmin(actor);access.requireCurrent(actor);
        allowed(input,Set.of("reason","successor","businessTransfers","cancelUnpublishedRequests"));
        String reason=text(input.get("reason"),"离职原因",500);
        var person=db.one("SELECT u.id,u.org_version,(u.active AND p.active) AS active FROM users u "
                + "JOIN principals p ON p.organization_id=u.organization_id AND p.id=u.id AND p.account_type='employee' "
                + "WHERE u.organization_id=? AND u.id=? FOR UPDATE",actor.organizationId(),id);
        if(person==null) throw ApiException.notFound();
        if(!Access.enabled(person)) throw bad("员工已停用");
        var company=db.one("SELECT founder_employee_id,authz_version FROM organizations WHERE id=?",actor.organizationId());
        if(id.equals(s(company,"founderEmployeeId")))
            throw new ApiException(409,"FOUNDER_CANNOT_OFFBOARD","固定创始人不能离职");
        var placement=db.one("SELECT * FROM employee_placements WHERE organization_id=? AND employee_id=? FOR UPDATE",actor.organizationId(),id);
        String headType=s(placement,"placementType");
        Map<String,Object> successor=successor(input.get("successor"));
        String successorId=successor==null?null:requiredUuid(successor.get("employeeId"),"successor.employeeId");
        boolean head=List.of("department_head","team_head").contains(headType);
        if(head && successorId==null)
            throw new ApiException(409,"SUCCESSOR_REQUIRED","单位负责人离职须指定继任人，请补齐继任安排");
        if(successorId!=null) {
            if(successorId.equals(id)) throw bad("继任人不能是离职员工本人");
            if(access.activeUser(actor,successorId)==null) throw bad("继任人须为本公司有效在职员工");
        }
        var draft=plans.draft(actor);
        var plan=new LinkedHashMap<String,Object>();
        for(String key:List.of("departments","teams","placements","expectedEmployees")) plan.put(key,draft.get(key));
        plan.put("reason",reason);
        plan.put("deactivateEmployees",List.of(new LinkedHashMap<>(Map.of("employeeId",id,"rowVersion",n(person,"orgVersion"),"reason",reason))));
        if(input.containsKey("cancelUnpublishedRequests")) plan.put("cancelUnpublishedRequests",input.get("cancelUnpublishedRequests"));
        if(input.containsKey("businessTransfers")) plan.put("businessTransfers",input.get("businessTransfers"));
        if(successorId!=null) {
            var places=new ArrayList<>((List<Map<String,Object>>)draft.get("placements"));
            boolean replaced=false;
            for(var row:places) {
                if(successorId.equals(s(row,"employeeId"))) {
                    row.put("placementType",headType);
                    row.put("departmentId",placement.get("departmentId"));
                    row.put("teamId",placement.get("teamId"));
                    replaced=true;
                }
            }
            if(!replaced) throw bad("继任人须为本公司已定岗员工");
            plan.put("placements",places);
        }
        Writes.Outcome outcome;
        try {
            outcome=plans.save(actor,"\""+n(company,"authzVersion")+"\"",plan);
        } catch(ApiException conflict) {
            if("INVALID_ORGANIZATION_PLAN".equals(conflict.code))
                throw new ApiException(409,"ORGANIZATION_PLAN_REQUIRED","该离职或继任安排与既有组织冲突，请到组织调整提交完整计划",conflict.details);
            throw conflict;
        }
        var merged=new LinkedHashMap<>(outcome.replayable());
        merged.put("employeeId",id);
        return new Writes.Outcome(merged,outcome.oneTimeOnly());
    }

    @SuppressWarnings("unchecked")
    private static Map<String,Object> successor(Object value) {
        if(value==null) return null;
        if(!(value instanceof Map<?,?> raw)) throw bad("successor须为继任安排对象");
        Map<String,Object> result=new LinkedHashMap<>();
        raw.forEach((key,entry)->{if(!(key instanceof String))throw bad("successor格式无效");result.put((String)key,entry);});
        allowed(result,Set.of("employeeId"));
        return result;
    }


    public Map<String,Object> administrator(Actor actor) {
        access.requireAdmin(actor);
        return db.one("SELECT id,account_name,display_name,row_version,must_change_password FROM admin_accounts WHERE organization_id=? AND id=?",actor.organizationId(),actor.id());
    }
    public Map<String,Object> updateAdministrator(Actor actor,String match,Map<String,Object> input) {
        access.requireAdmin(actor);allowed(input,Set.of("accountName","displayName"));
        if(input.isEmpty()) throw bad("请至少修改一项管理员账号资料");
        var current=administrator(actor);Writes.checkVersion(match,n(current,"rowVersion"));
        String name=input.containsKey("accountName")?text(input.get("accountName"),"管理员账号名",80):s(current,"accountName");
        String display=input.containsKey("displayName")?text(input.get("displayName"),"管理员名称",100):s(current,"displayName");
        if(db.find("SELECT id FROM admin_accounts WHERE account_name=? AND id<>?",name,actor.id())!=null)
            throw new ApiException(409,"ACCOUNT_NAME_TAKEN","管理员账号名已被使用");
        db.update("UPDATE admin_accounts SET account_name=?,display_name=?,row_version=row_version+1,credential_version=credential_version+1 WHERE organization_id=? AND id=?",name,display,actor.organizationId(),actor.id());
        int revoked=auth.revokeSessions(actor.organizationId(),actor.id());
        events.record(actor,null,"administrator.updated",List.of(),Map.of("fields",input.keySet(),"sessionsRevoked",revoked));
        return Map.of("id",actor.id(),"rowVersion",n(current,"rowVersion")+1,"reauthenticationRequired",true);
    }

    public Map<String, Object> createPosition(Actor actor, Map<String, Object> input) {
        access.requireCapability(actor, "manage_organization");
        allowed(input, Set.of("name", "sortOrder"));
        String name = text(input.get("name"), "职位名称", 100);
        requireUnique("SELECT 1 FROM positions WHERE organization_id=? AND name=?", "职位名称已存在", actor.organizationId(), name);
        int sortOrder = integer(input.get("sortOrder"), "sortOrder", 0, 10000, 0);
        String id = Db.id();
        db.update("INSERT INTO positions(id,organization_id,name,sort_order) VALUES(?,?,?,?)", id, actor.organizationId(), name, sortOrder);
        bumpAuthority(actor, "organization.position.created", Map.of("positionId", id, "name", name));
        return Map.of("positionId", id, "rowVersion", 1);
    }

    public Map<String, Object> updatePosition(Actor actor, String id, String ifMatch, Map<String, Object> input) {
        access.requireCapability(actor, "manage_organization");
        allowed(input, Set.of("name", "sortOrder"));
        Map<String, Object> row = db.one("SELECT * FROM positions WHERE organization_id=? AND id=? FOR UPDATE", actor.organizationId(), id);
        Writes.checkVersion(ifMatch, n(row, "rowVersion"));
        String name = input.containsKey("name") ? text(input.get("name"), "职位名称", 100) : s(row, "name");
        requireUniqueExcept("SELECT 1 FROM positions WHERE organization_id=? AND name=? AND id<>?", actor.organizationId(), name, id);
        int sortOrder = input.containsKey("sortOrder") ? integer(input.get("sortOrder"), "sortOrder", 0, 10000, 0) : Math.toIntExact(n(row, "sortOrder"));
        db.update("UPDATE positions SET name=?,sort_order=?,row_version=row_version+1 WHERE organization_id=? AND id=?", name, sortOrder, actor.organizationId(), id);
        bumpAuthority(actor, "organization.position.updated", Map.of("positionId", id, "name", name));
        return Map.of("positionId", id, "rowVersion", n(row, "rowVersion") + 1);
    }

    public Map<String,Object> updateEmployee(Actor actor,String id,String ifMatch,Map<String,Object> input) {
        access.requireAdmin(actor);
        allowed(input,Set.of("displayName","phone","hireDate","idCardNo"));
        if(input.isEmpty()) throw bad("请至少修改姓名、手机号、入职日期或身份证号");
        var row=db.one("SELECT u.* FROM users u JOIN principals p ON p.organization_id=u.organization_id AND p.id=u.id "
                + "WHERE u.organization_id=? AND u.id=? AND p.account_type='employee' FOR UPDATE",actor.organizationId(),id);
        Writes.checkVersion(ifMatch,n(row,"orgVersion"));
        String name=input.containsKey("displayName")?text(input.get("displayName"),"姓名",100):s(row,"displayName");
        String phone=s(row,"phone"),login=s(row,"loginPhone");
        if(input.containsKey("phone")) {
            phone=PhoneNumbers.normalize(optionalPhone(input.get("phone")));
            if(phone==null) throw bad("员工登录手机号不能为空");
            requireUniqueExceptLoginKey(actor,id,phone);login=phone;
        }
        // Omitted keeps the stored date; an explicit null clears it; a future or malformed date is
        // rejected before any other field is written.
        java.time.LocalDate hireDate=row.get("hireDate")==null?null:java.time.LocalDate.parse(Objects.toString(row.get("hireDate")));
        if(input.containsKey("hireDate")) hireDate=parseHireDate(input.get("hireDate"),companyToday(actor));
        // Omitted keeps the stored document; when present it must be a full valid number — an
        // explicit null is rejected because identity documents are never cleared once recorded.
        String idCardNo=input.containsKey("idCardNo")?IdCardNumbers.normalize(input.get("idCardNo"),"身份证号",companyToday(actor)):null;
        boolean phoneChanged=!Objects.equals(login,s(row,"loginPhone"));
        try {
            db.update("UPDATE users SET display_name=?,phone=?,login_phone=?,hire_date=?,org_version=org_version+1,profile_version=profile_version+1 WHERE organization_id=? AND id=?",
                    name,phone,login,hireDate==null?null:java.sql.Date.valueOf(hireDate),actor.organizationId(),id);
        } catch(org.springframework.dao.DuplicateKeyException error) {throw new ApiException(409,"PHONE_TAKEN","该手机号已被使用");}
        if(idCardNo!=null) {
            try {
                if(db.find("SELECT 1 FROM employee_identity_documents WHERE organization_id=? AND employee_id=?",actor.organizationId(),id)==null)
                    db.update("INSERT INTO employee_identity_documents(organization_id,employee_id,id_card_no) VALUES(?,?,?)",actor.organizationId(),id,idCardNo);
                else
                    db.update("UPDATE employee_identity_documents SET id_card_no=?,row_version=row_version+1,updated_at=UTC_TIMESTAMP(6) WHERE organization_id=? AND employee_id=?",
                            idCardNo,actor.organizationId(),id);
            } catch(org.springframework.dao.DuplicateKeyException error) {throw new ApiException(409,"ID_CARD_TAKEN","该身份证号已被本公司员工使用");}
        }
        int revoked=phoneChanged?auth.revokeSessions(actor.organizationId(),id):0;
        // The audit carries field names only; a full identity number never enters history or events.
        bumpAuthority(actor,"organization.employee.identity_updated",Map.of("userId",id,"fields",input.keySet(),"sessionsRevoked",revoked));
        var result=new LinkedHashMap<String,Object>();
        result.put("userId",id);result.put("rowVersion",n(row,"orgVersion")+1);
        result.put("phoneUpdated",input.containsKey("phone"));
        result.put("idCardUpdated",idCardNo!=null);
        result.put("hireDate",hireDate==null?null:hireDate.toString());
        result.put("sessionsRevoked",revoked);
        return result;
    }

    public Writes.Outcome resetPassword(Actor actor, String id) {
        access.requireCapability(actor, "manage_accounts");
        Map<String, Object> row = db.one("SELECT * FROM users WHERE organization_id=? AND id=? FOR UPDATE", actor.organizationId(), id);
        String password = Credentials.generate();
        long credentialVersion = n(row, "credentialVersion") + 1;
        db.update("UPDATE users SET password_hash=?,must_change_password=TRUE,credential_version=? WHERE organization_id=? AND id=?",
                AuthService.PASSWORDS.encode(password), credentialVersion, actor.organizationId(), id);
        int revoked = auth.revokeSessions(actor.organizationId(), id);
        events.record(actor, null, "account.password.reset", List.of(),
                Map.of("userId", id, "sessionsRevoked", revoked));
        Map<String, Object> replayable = new LinkedHashMap<>();
        replayable.put("userId", id);
        replayable.put("mustChangePassword", true);
        replayable.put("sessionsRevoked", revoked);
        replayable.put("credentialVersion", credentialVersion);
        return new Writes.Outcome(replayable, Map.of("initialPassword", password));
    }

    public Map<String, Object> companyItems(Actor actor) {
        access.requireAdmin(actor);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", db.list("SELECT id,body,sort_order,row_version,created_at FROM home_items WHERE organization_id=? AND kind='company' ORDER BY sort_order,created_at,id", actor.organizationId()));
        result.put("limit", COMPANY_ITEM_LIMIT);
        result.put("offWorkTime", s(db.one("SELECT off_work_time FROM organizations WHERE id=?", actor.organizationId()), "offWorkTime"));
        return result;
    }

    public Map<String, Object> createCompanyItem(Actor actor, Map<String, Object> input) {
        access.requireCapability(actor, "manage_company_info");
        // Company chronicles are body-only: the retired independent title is rejected with every other
        // unknown field before any row is written, so a rejected request never partially inserts.
        allowed(input, Set.of("body"));
        String body = bodyText(input.get("body"), "公司信息内容", 2000);
        long existing = n(db.one("SELECT COUNT(*) AS c FROM home_items WHERE organization_id=? AND kind='company'", actor.organizationId()), "c");
        if (existing >= COMPANY_ITEM_LIMIT) throw new ApiException(409, "HOME_ITEM_LIMIT", "公司信息最多10条，请先删除后再新增");
        long next = n(db.one("SELECT COALESCE(MAX(sort_order),0)+1 AS c FROM home_items WHERE organization_id=? AND kind='company'", actor.organizationId()), "c");
        String id = Db.id();
        db.update("INSERT INTO home_items(id,organization_id,owner_id,kind,body,sort_order) VALUES(?,?,NULL,'company',?,?)", id, actor.organizationId(), body, next);
        events.record(actor, null, "company_item.created", List.of(), Map.of("homeItemId", id));
        return Map.of("id", id, "rowVersion", 1, "sortOrder", next);
    }

    public Map<String, Object> updateCompanyItem(Actor actor, String id, String ifMatch, Map<String, Object> input) {
        access.requireCapability(actor, "manage_company_info");
        allowed(input, Set.of("body"));
        Map<String, Object> row = db.one("SELECT * FROM home_items WHERE organization_id=? AND id=? AND kind='company' FOR UPDATE", actor.organizationId(), id);
        Writes.checkVersion(ifMatch, n(row, "rowVersion"));
        String body = input.containsKey("body") ? bodyText(input.get("body"), "公司信息内容", 2000) : s(row, "body");
        db.update("UPDATE home_items SET body=?,row_version=row_version+1 WHERE organization_id=? AND id=?", body, actor.organizationId(), id);
        events.record(actor, null, "company_item.updated", List.of(), Map.of("homeItemId", id));
        return Map.of("id", id, "rowVersion", n(row, "rowVersion") + 1);
    }

    public Map<String, Object> deleteCompanyItem(Actor actor, String id, String ifMatch) {
        access.requireCapability(actor, "manage_company_info");
        Map<String, Object> row = db.one("SELECT * FROM home_items WHERE organization_id=? AND id=? AND kind='company' FOR UPDATE", actor.organizationId(), id);
        Writes.checkVersion(ifMatch, n(row, "rowVersion"));
        db.update("DELETE FROM home_items WHERE organization_id=? AND id=?", actor.organizationId(), id);
        events.record(actor, null, "company_item.deleted", List.of(), Map.of("homeItemId", id));
        return Map.of("id", id, "deleted", true);
    }

    public Map<String, Object> reorderCompanyItems(Actor actor, Map<String, Object> input) {
        access.requireCapability(actor, "manage_company_info");
        allowed(input, Set.of("orderedIds"));
        Object raw = input.get("orderedIds");
        if (!(raw instanceof List<?> list) || list.isEmpty()) throw bad("orderedIds须为1至10个公司信息ID");
        List<String> ordered = new ArrayList<>();
        for (Object value : list) ordered.add(requiredUuid(value, "orderedIds"));
        if (new HashSet<>(ordered).size() != ordered.size()) throw bad("公司信息顺序不能重复");
        List<String> existing = db.list("SELECT id FROM home_items WHERE organization_id=? AND kind='company' ORDER BY sort_order,created_at,id", actor.organizationId()).stream().map(r -> s(r, "id")).toList();
        if (!new HashSet<>(existing).equals(new HashSet<>(ordered))) throw bad("调序必须包含且仅包含全部现有公司信息");
        int order = 1;
        for (String itemId : ordered) {
            db.update("UPDATE home_items SET sort_order=?,row_version=row_version+1 WHERE organization_id=? AND id=?", order++, actor.organizationId(), itemId);
        }
        events.record(actor, null, "company_item.reordered", List.of(), Map.of("orderedIds", ordered));
        return Map.of("orderedIds", ordered, "reordered", true);
    }

    public Map<String, Object> setOffWorkTime(Actor actor, Map<String, Object> input) {
        access.requireCapability(actor, "manage_company_info");
        allowed(input, Set.of("offWorkTime"));
        String raw = text(input.get("offWorkTime"), "下班时刻", 8);
        if (!TIME.matcher(raw).matches()) throw bad("下班时刻须为 HH:MM 或 HH:MM:SS");
        LocalTime time = raw.length() == 5 ? LocalTime.parse(raw + ":00") : LocalTime.parse(raw);
        db.update("UPDATE organizations SET off_work_time=? WHERE id=?", java.sql.Time.valueOf(time), actor.organizationId());
        events.record(actor, null, "organization.off_work_time.updated", List.of(), Map.of("offWorkTime", time.toString()));
        return Map.of("offWorkTime", time.toString());
    }

    private void bumpAuthority(Actor actor, String action, Map<String, Object> details) {
        // Any real organization or authority change invalidates stale candidates, analytics and
        // cached idempotent responses across the company.
        db.update("UPDATE organizations SET authz_version=authz_version+1 WHERE id=?", actor.organizationId());
        events.record(actor, null, action, List.of(), details);
    }

    private void requireDepartment(Actor actor, String id) {
        requireExists("SELECT 1 FROM departments WHERE organization_id=? AND id=?", "部门不存在，请选择本公司已创建的部门", actor.organizationId(), id);
    }

    private void requirePosition(Actor actor, String id) {
        requireExists("SELECT 1 FROM positions WHERE organization_id=? AND id=?", "职位不存在，请选择本公司已创建的职位", actor.organizationId(), id);
    }

    private void requireExists(String sql,String message,Object...args) {
        if(db.find(sql,args)==null) throw bad(message);
    }

    private void requireUniqueExceptLoginKey(Actor actor, String userId, String loginPhone) {
        if (db.find("SELECT 1 FROM users WHERE login_phone=? AND NOT (organization_id=? AND id=?)", loginPhone, actor.organizationId(), userId) != null) {
            throw new ApiException(409, "PHONE_TAKEN", "该手机号已被其他员工账号使用");
        }
    }

    private void requireUnique(String sql, String message, Object... args) {
        if (db.find(sql, args) != null) throw new ApiException(409, "DATA_CONFLICT", message);
    }

    private void requireUniqueExcept(String sql, Object... args) {
        if (db.find(sql, args) != null) throw new ApiException(409, "DATA_CONFLICT", "名称已存在");
    }

    private static String optionalPhone(Object value) {
        if (value == null) return null;
        String phone = text(value, "联系电话", 32);
        long digits = phone.chars().filter(Character::isDigit).count();
        if (!phone.matches("[+0-9() .-]+") || digits < 3 || digits > 20 || phone.indexOf('+') > 0 || phone.lastIndexOf('+') != phone.indexOf('+')) {
            throw bad("联系电话须含3至20位数字，可使用开头的+、空格、括号或短横线");
        }
        return phone;
    }

    /** Strict ISO date, nullable to clear, never later than the company's today. */
    static java.time.LocalDate parseHireDate(Object value, java.time.LocalDate today) {
        if (value == null) return null;
        if (!(value instanceof String raw)) throw bad("入职日期须为YYYY-MM-DD或null");
        String text = raw.trim();
        try {
            java.time.LocalDate date = java.time.LocalDate.parse(text);
            if (!date.toString().equals(text)) throw bad("入职日期须为规范的YYYY-MM-DD日期");
            if (date.isAfter(today)) throw bad("入职日期不得晚于公司今天");
            return date;
        } catch (java.time.format.DateTimeParseException error) {
            throw bad("入职日期须为YYYY-MM-DD有效日期");
        }
    }

    private java.time.LocalDate companyToday(Actor actor) {
        String zone = s(db.one("SELECT time_zone FROM organizations WHERE id=?", actor.organizationId()), "timeZone");
        return clock.instant().atZone(java.time.ZoneId.of(zone)).toLocalDate();
    }

    static String text(Object value, String label, int max) {        if (!(value instanceof String raw)) throw bad(label + "必须为文字");
        String text = raw.strip();
        if (text.isEmpty() || text.codePointCount(0, text.length()) > max) throw bad(label + "不能为空且不得超过" + max + "字");
        if (text.codePoints().anyMatch(Character::isISOControl)) throw bad(label + "含无效字符");
        return text;
    }

    /** Company chronicle body: the same 1–2000 plain-text rule, but internal line breaks are kept. */
    static String bodyText(Object value, String label, int max) {
        if (!(value instanceof String raw)) throw bad(label + "必须为文字");
        String text = raw.strip();
        if (text.isEmpty() || text.codePointCount(0, text.length()) > max) throw bad(label + "不能为空且不得超过" + max + "字");
        if (text.codePoints().anyMatch(cp -> cp != '\n' && Character.isISOControl(cp))) throw bad(label + "含无效字符");
        return text;
    }

    static String requiredUuid(Object value, String key) {
        return TaskIds.requireUuid(value, key);
    }

    static String optionalId(Object value, String key) {
        return value == null ? null : TaskIds.requireUuid(value, key);
    }

    static boolean bool(Object value, String key) {
        if (value instanceof Boolean b) return b;
        if (value instanceof Number number && (number.intValue() == 0 || number.intValue() == 1)) return number.intValue() == 1;
        throw bad(key + "须为布尔值");
    }

    static int integer(Object value, String key, int min, int max, int fallback) {
        if (value == null) return fallback;
        if (!(value instanceof Number number) || number.intValue() < min || number.intValue() > max) {
            throw bad(key + "须为" + min + "至" + max + "的整数");
        }
        return number.intValue();
    }

    static void allowed(Map<String, Object> input, Set<String> keys) {
        if (!keys.containsAll(input.keySet())) throw bad("请求含不支持的字段");
    }

    /** Blank query parameters mean "no filter"; a value must be a well-formed company UUID. */
    static String optionalUuid(String value,String key) {
        if(value==null || value.isBlank()) return null;
        return TaskIds.requireUuid(value,key);
    }

    static Boolean optionalBoolean(String value,String key) {
        if(value==null || value.isBlank()) return null;
        if("true".equalsIgnoreCase(value)) return Boolean.TRUE;
        if("false".equalsIgnoreCase(value)) return Boolean.FALSE;
        throw bad(key+"须为true或false");
    }

    static ApiException bad(String message) { return new ApiException(400, "INVALID_INPUT", message); }

    /** Shared UUID validation so the admin surface rejects malformed identifiers the same way. */
    static final class TaskIds {
        private TaskIds() {}
        static String requireUuid(Object value, String key) {
            if (!(value instanceof String text) || !text.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")) {
                throw bad(key + "须为有效UUID");
            }
            return text.toLowerCase(Locale.ROOT);
        }
    }

}
