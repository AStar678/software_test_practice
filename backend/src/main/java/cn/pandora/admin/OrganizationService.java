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
    private static final Set<String> PLACEMENT_TYPES=Set.of("founder","department_head","team_head","employee");
    private static final int COMPANY_ITEM_LIMIT=10;
    private final Db db;
    private final Access access;
    private final Events events;
    private final OrganizationConstraints constraints;
    private final AuthService auth;
    private final OrganizationPlans plans;
    private final EmployeeIdentityDocuments identity;
    private final java.time.Clock clock;
    public OrganizationService(Db db,Access access,Events events,OrganizationConstraints constraints,AuthService auth,OrganizationPlans plans,
                               EmployeeIdentityDocuments identity,java.time.Clock clock) {
        this.db=db;this.access=access;this.events=events;this.constraints=constraints;this.auth=auth;this.plans=plans;
        this.identity=identity;this.clock=clock;
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

    /**
     * Administrator employee directory with combinable filters. The same predicate builds the rows and
     * the total, so a filtered page can never disagree with its count. Options come from the current
     * organization and positions; no synthetic unit or person is returned.
     */
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> employees(Actor actor,Map<String,String> filters) {
        access.requireAdmin(actor);access.requireCurrent(actor);
        String query=filterText(filters,"q","搜索内容");
        if(query==null) query="";
        if (query.length()>200) throw bad("搜索内容最多200字");
        String department=filterId(filters,"departmentId","部门");
        String team=filterId(filters,"teamId","团队");
        String position=filterId(filters,"positionId","展示职位");
        String placementType=filterText(filters,"placementType","组织身份");
        if (placementType!=null && !PLACEMENT_TYPES.contains(placementType)) throw bad("组织身份筛选无效");
        Boolean active=filterBoolean(filters,"active");
        return directory(actor,query,null,false,department,team,position,placementType,active);
    }

    /**
     * Administrator-only directory search that may carry a full identity number in the request body. The
     * value is never placed in a URL, audit record, log or error: the server normalizes it, matches it
     * exactly inside the current company and returns the ordinary masked directory. A fragment is not an
     * identity lookup; only the unchanged name/department/login-phone text search applies to it.
     */
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> searchEmployees(Actor actor,Map<String,Object> input) {
        access.requireAdmin(actor);access.requireCurrent(actor);
        allowed(input,Set.of("q","idCardNo","departmentId","teamId","placementType","active","positionId"));
        var filters=new HashMap<String,String>();
        for(String key:List.of("q","departmentId","teamId","placementType","active","positionId")) {
            Object value=input.get(key);
            if(value==null) continue;
            if(value instanceof Boolean flag) {filters.put(key,flag.toString());continue;}
            if(!(value instanceof String text)) throw bad("搜索条件格式不正确");
            if(!text.isBlank()) filters.put(key,text);
        }
        String query=filterText(filters,"q","搜索内容");
        if(query==null) query="";
        if (query.length()>200) throw bad("搜索内容最多200字");
        String department=filterId(filters,"departmentId","部门");
        String team=filterId(filters,"teamId","团队");
        String position=filterId(filters,"positionId","展示职位");
        String placementType=filterText(filters,"placementType","组织身份");
        if (placementType!=null && !PLACEMENT_TYPES.contains(placementType)) throw bad("组织身份筛选无效");
        Boolean active=filterBoolean(filters,"active");
        if(input.get("idCardNo")!=null) {
            if(!(input.get("idCardNo") instanceof String raw)) throw bad("身份证号须为文字");
            String normalized=normalizedIdentity(actor,raw);
            return directory(actor,"",normalized,normalized==null,department,team,position,placementType,active);
        }
        String text=query.strip();
        if(looksLikeFullIdentity(text)) {
            String normalized=normalizedIdentity(actor,text);
            return directory(actor,"",normalized,normalized==null,department,team,position,placementType,active);
        }
        return directory(actor,query,null,false,department,team,position,placementType,active);
    }

    private String normalizedIdentity(Actor actor,String raw) {
        try {
            return IdCardNumbers.normalize(raw,companyToday(actor));
        } catch (RuntimeException invalid) {
            // A malformed or fragment value maps to "no such employee", never to a validation echo.
            return null;
        }
    }

    private java.time.LocalDate companyToday(Actor actor) {
        String zone=s(db.one("SELECT time_zone FROM organizations WHERE id=?",actor.organizationId()),"timeZone");
        return clock.instant().atZone(java.time.ZoneId.of(zone)).toLocalDate();
    }

    private static boolean looksLikeFullIdentity(String value) {
        return value!=null && value.length()==18 && value.matches("[0-9]{17}[0-9Xx]");
    }

    private Map<String,Object> directory(Actor actor,String query,String identityNumber,boolean identityUnmatched,
                                         String department,String team,String position,String placementType,Boolean active) {
        String needle=Objects.toString(query,"").toLowerCase(Locale.ROOT);
        String identityEmployee=null;
        if(identityNumber!=null) {
            var row=db.find("SELECT employee_id FROM employee_identity_documents WHERE organization_id=? AND id_card_no=?",
                    actor.organizationId(),identityNumber);
            identityEmployee=row==null?null:s(row,"employeeId");
        }
        if(identityUnmatched || identityNumber!=null && identityEmployee==null)
            return Map.of("items",List.of(),"total",0);
        var phones=new HashMap<String,Object>();
        var hireDates=new HashMap<String,Object>();
        for (var row:db.list("SELECT id,login_phone,hire_date FROM users WHERE organization_id=?",actor.organizationId())) {
            phones.put(s(row,"id"),row.get("loginPhone"));
            hireDates.put(s(row,"id"),row.get("hireDate"));
        }
        var masked=identity.maskedByEmployee(actor);
        String identityMatch=identityEmployee;
        var rows=access.employeeDirectory(actor,true).stream().filter(row -> {
                    if(department!=null && !department.equals(s(row,"departmentId"))) return false;
                    if(team!=null && !team.equals(s(row,"teamId"))) return false;
                    if(position!=null && !position.equals(s(row,"positionId"))) return false;
                    if(placementType!=null && !placementType.equals(s(row,"placementType"))) return false;
                    if(active!=null && active!=Access.enabled(row)) return false;
                    if(identityMatch!=null) return identityMatch.equals(s(row,"id"));
                    if(needle.isEmpty()) return true;
                    String phone=Objects.toString(phones.get(s(row,"id")),"");
                    return Objects.toString(row.get("displayName"),"").toLowerCase(Locale.ROOT).contains(needle)
                            || Objects.toString(row.get("departmentName"),"").toLowerCase(Locale.ROOT).contains(needle)
                            || phone.toLowerCase(Locale.ROOT).contains(needle);
                })
                .map(row -> {
                    var item=new LinkedHashMap<>(row);
                    item.put("loginPhone",phones.get(s(row,"id")));
                    item.put("hireDate",hireDates.get(s(row,"id")));
                    item.put("idCardNoMasked",masked.get(s(row,"id")));
                    item.put("idCardRecorded",masked.containsKey(s(row,"id")));
                    return item;
                }).toList();
        return Map.of("items",rows,"total",rows.size());
    }
    /** Detail keeps the full document value for the administrator; it never enters a directory projection. */
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> employee(Actor actor,String id) {
        access.requireAdmin(actor);access.requireCurrent(actor);
        var person=access.employeeDirectory(actor,true).stream().filter(row->id.equals(s(row,"id"))).findFirst().orElseThrow(ApiException::notFound);
        var item=new LinkedHashMap<>(person);
        var phone=db.find("SELECT login_phone,hire_date FROM users WHERE organization_id=? AND id=?",actor.organizationId(),id);
        item.put("loginPhone",phone==null?null:phone.get("loginPhone"));
        item.put("hireDate",phone==null?null:phone.get("hireDate"));
        String full=identity.full(actor,id);
        item.put("idCardNo",full);
        item.put("idCardNoMasked",full==null?null:IdCardNumbers.mask(full));
        return item;
    }
    public List<Map<String,Object>> departmentMembers(Actor actor,String departmentId) {
        access.requireAdmin(actor);requireDepartment(actor,departmentId);
        return access.employeeDirectory(actor,false).stream().filter(row->departmentId.equals(s(row,"departmentId"))).toList();
    }

    /**
     * Independent onboarding: one employee, one complete location, one identity document. It still
     * delegates to the full organization plan so the company lock, version checks, uniqueness, initial
     * password and approval-route refresh are the same as any other structural write. Anything that
     * would change another person or unit is refused instead of being patched in.
     */
    @SuppressWarnings("unchecked")
    public Writes.Outcome createEmployee(Actor actor,Map<String,Object> input) {
        access.requireAdmin(actor);
        allowed(input,Set.of("displayName","phone","placementType","departmentId","teamId","positionId","hireDate","idCardNo"));
        LocalDate today=companyToday(actor);
        String idCard=IdCardNumbers.normalize(input.get("idCardNo"),today);
        identity.requireAvailable(actor,idCard,null);
        var draft=plans.draft(actor);
        String id=Db.id();
        String placementType=text(input.get("placementType"),"组织身份",32);
        if(!PLACEMENT_TYPES.contains(placementType)) throw bad("组织身份无效");
        boolean creatingFounder="founder".equals(placementType);
        String founder=s((Map<String,Object>)draft.get("organization"),"founderEmployeeId");
        if(creatingFounder && founder!=null)
            throw new ApiException(409,"ORGANIZATION_PLAN_REQUIRED","公司已有固定创始人，请到组织调整办理负责人变更");
        String departmentId=stableId(input.get("departmentId"),"部门");
        String teamId=input.get("teamId")==null?null:stableId(input.get("teamId"),"团队");
        String positionId=stableId(input.get("positionId"),"展示职位");
        if(positionId==null) throw bad("请选择展示职位");
        if(creatingFounder) {
            if(departmentId!=null || teamId!=null) throw bad("创始人应处于公司层，不归属部门或团队");
        } else {
            if(departmentId==null) throw bad("请选择部门");
            if("department_head".equals(placementType)) {
                if(teamId!=null) throw bad("部门负责人不应归属团队");
            } else if(teamId==null) throw bad("请选择团队");
            requireDepartment(actor,departmentId);
            if(teamId!=null) {
                var team=db.find("SELECT id,department_id FROM teams WHERE organization_id=? AND id=?",actor.organizationId(),teamId);
                if(team==null) throw bad("请选择本公司已创建的团队");
                if(!departmentId.equals(s(team,"departmentId")))
                    throw new ApiException(409,"ORGANIZATION_PLAN_REQUIRED","所选团队不属于该部门，请到组织调整办理");
            }
        }
        requirePosition(actor,positionId);
        if(!"employee".equals(placementType) && !creatingFounder) {
            String unitColumn="department_head".equals(placementType)?"department_id":"team_id";
            String unitId="department_head".equals(placementType)?departmentId:teamId;
            if(db.find("SELECT employee_id FROM employee_placements WHERE organization_id=? AND placement_type=? AND "+unitColumn+"=?",
                    actor.organizationId(),placementType,unitId)!=null)
                throw new ApiException(409,"ORGANIZATION_PLAN_REQUIRED","该负责人位置已被占用，请到组织调整办理负责人变更");
        }
        var plan=new LinkedHashMap<String,Object>();
        for(String key:List.of("departments","teams","placements","expectedEmployees")) plan.put(key,draft.get(key));
        // Draft lists are local copies; cancellation or failed final validation leaves the DB untouched.
        var places=new ArrayList<>((List<Map<String,Object>>)draft.get("placements"));
        var placement=new LinkedHashMap<String,Object>();placement.put("employeeId",id);
        for(String field:List.of("placementType","departmentId","teamId","positionId")) placement.put(field,input.get(field));
        places.add(placement);plan.put("placements",places);plan.put("reason","新增员工");
        if(creatingFounder) plan.put("founderEmployeeId",id);
        var addition=new LinkedHashMap<String,Object>();addition.put("id",id);addition.put("displayName",input.get("displayName"));
        addition.put("phone",input.get("phone"));addition.put("hireDate",input.get("hireDate"));addition.put("idCardNo",idCard);
        plan.put("newEmployees",List.of(addition));
        Writes.Outcome outcome;
        try {
            outcome=plans.save(actor,"\""+draft.get("rowVersion")+"\"",plan);
        } catch(ApiException error) {
            if("INVALID_ORGANIZATION_PLAN".equals(error.code) || "VERSION_CONFLICT".equals(error.code))
                throw new ApiException(409,"ORGANIZATION_PLAN_REQUIRED",
                        "该位置需要同时修改其他人员或单位，请到组织调整办理",error.details);
            throw error;
        }
        var passwords=(Map<String,String>)outcome.oneTimeOnly().get("initialPasswords");
        // A new employee starts at org_version 1 and the placement write increments it once, so the
        // employee's own version is 2 and is what the created response's ETag represents.
        return new Writes.Outcome(Map.of("userId",id,"rowVersion",2,"mustChangePassword",true),
                Map.of("initialPassword",passwords.get(id)));
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
        int sortOrder = integer(input.get("sortOrder"), "排序", 0, 10000, 0);
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
        int sortOrder = input.containsKey("sortOrder") ? integer(input.get("sortOrder"), "排序", 0, 10000, 0) : Math.toIntExact(n(row, "sortOrder"));
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
        String normalizedIdCard=null;
        if(input.containsKey("idCardNo")) {
            normalizedIdCard=IdCardNumbers.normalize(input.get("idCardNo"),companyToday(actor));
            identity.requireAvailable(actor,normalizedIdCard,id);
        }
        boolean phoneChanged=!Objects.equals(login,s(row,"loginPhone"));
        try {
            db.update("UPDATE users SET display_name=?,phone=?,login_phone=?,hire_date=?,org_version=org_version+1,profile_version=profile_version+1 WHERE organization_id=? AND id=?",
                    name,phone,login,hireDate==null?null:java.sql.Date.valueOf(hireDate),actor.organizationId(),id);
        } catch(org.springframework.dao.DuplicateKeyException error) {throw new ApiException(409,"PHONE_TAKEN","该手机号已被使用");}
        if(normalizedIdCard!=null) identity.put(actor,id,normalizedIdCard);
        int revoked=phoneChanged?auth.revokeSessions(actor.organizationId(),id):0;
        var details=new LinkedHashMap<String,Object>();
        details.put("userId",id);details.put("fields",input.keySet());details.put("sessionsRevoked",revoked);
        // Audit states which fields changed plus a masked value, never the full document number.
        if(normalizedIdCard!=null) details.put("idCardMasked",IdCardNumbers.mask(normalizedIdCard));
        bumpAuthority(actor,"organization.employee.identity_updated",details);
        var result=new LinkedHashMap<String,Object>();
        result.put("userId",id);result.put("rowVersion",n(row,"orgVersion")+1);
        result.put("phoneUpdated",input.containsKey("phone"));
        result.put("hireDate",hireDate==null?null:hireDate.toString());
        result.put("idCardUpdated",normalizedIdCard!=null);
        if(normalizedIdCard!=null) result.put("idCardNoMasked",IdCardNumbers.mask(normalizedIdCard));
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
        if (!(raw instanceof List<?> list) || list.isEmpty()) throw bad("顺序须包含1至10个公司信息ID");
        List<String> ordered = new ArrayList<>();
        for (Object value : list) ordered.add(requiredUuid(value, "公司信息"));
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

    /** Stable organization ids are not UUIDs (fixtures and seeded units use readable ids). */
    static String stableId(Object value,String label) {
        if(value==null) return null;
        if(!(value instanceof String text) || !text.matches("[A-Za-z0-9_-]{1,36}")) throw bad("请选择有效的"+label);
        return text;
    }

    private static String filterText(Map<String,String> filters,String key,String label) {
        String value=filters.get(key);
        if(value==null || value.isBlank()) return null;
        if(value.length()>100) throw bad(label+"筛选无效");
        return value;
    }

    private static String filterId(Map<String,String> filters,String key,String label) {
        String value=filterText(filters,key,label);
        return value==null?null:stableId(value,label);
    }

    private static Boolean filterBoolean(Map<String,String> filters,String key) {
        String value=filters.get(key);
        if(value==null || value.isBlank()) return null;
        if(!"true".equals(value) && !"false".equals(value)) throw bad("在职状态筛选无效");
        return Boolean.parseBoolean(value);
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
