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
    public OrganizationService(Db db,Access access,Events events,OrganizationConstraints constraints,AuthService auth,OrganizationPlans plans) {
        this.db=db;this.access=access;this.events=events;this.constraints=constraints;this.auth=auth;this.plans=plans;
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

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> employees(Actor actor,Map<String,String> filters) {
        access.requireAdmin(actor);access.requireCurrent(actor);
        String query=filters.getOrDefault("q","").strip().toLowerCase(Locale.ROOT);
        var rows=access.employeeDirectory(actor,true).stream().filter(row->query.isEmpty()
                || Objects.toString(row.get("displayName"),"").toLowerCase(Locale.ROOT).contains(query)
                || Objects.toString(row.get("departmentName"),"").toLowerCase(Locale.ROOT).contains(query)).toList();
        return Map.of("items",rows,"total",rows.size());
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> employee(Actor actor,String id) {
        access.requireAdmin(actor);access.requireCurrent(actor);
        return access.employeeDirectory(actor,true).stream().filter(row->id.equals(s(row,"id"))).findFirst().orElseThrow(ApiException::notFound);
    }
    public List<Map<String,Object>> departmentMembers(Actor actor,String departmentId) {
        access.requireAdmin(actor);requireDepartment(actor,departmentId);
        return access.employeeDirectory(actor,false).stream().filter(row->departmentId.equals(s(row,"departmentId"))).toList();
    }

    @SuppressWarnings("unchecked")
    public Writes.Outcome createEmployee(Actor actor,Map<String,Object> input) {
        access.requireAdmin(actor);allowed(input,Set.of("displayName","phone","placementType","departmentId","teamId","positionId"));
        var draft=plans.draft(actor);String id=Db.id();
        var plan=new LinkedHashMap<String,Object>();
        for(String key:List.of("departments","teams","placements","expectedEmployees")) plan.put(key,draft.get(key));
        // Draft lists are local copies; cancellation or failed final validation leaves the DB untouched.
        var places=new ArrayList<>((List<Map<String,Object>>)draft.get("placements"));
        var placement=new LinkedHashMap<String,Object>();placement.put("employeeId",id);
        for(String field:List.of("placementType","departmentId","teamId","positionId")) placement.put(field,input.get(field));
        places.add(placement);plan.put("placements",places);plan.put("reason","新增员工");
        var addition=new LinkedHashMap<String,Object>();addition.put("id",id);addition.put("displayName",input.get("displayName"));addition.put("phone",input.get("phone"));
        plan.put("newEmployees",List.of(addition));
        var outcome=plans.save(actor,"\""+draft.get("rowVersion")+"\"",plan);
        var passwords=(Map<String,String>)outcome.oneTimeOnly().get("initialPasswords");
        return new Writes.Outcome(Map.of("userId",id,"rowVersion",2,"mustChangePassword",true),Map.of("initialPassword",passwords.get(id)));
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
        allowed(input,Set.of("displayName","phone"));
        if(input.isEmpty()) throw bad("请至少修改姓名或手机号");
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
        boolean phoneChanged=!Objects.equals(login,s(row,"loginPhone"));
        try {
            db.update("UPDATE users SET display_name=?,phone=?,login_phone=?,org_version=org_version+1,profile_version=profile_version+1 WHERE organization_id=? AND id=?",
                    name,phone,login,actor.organizationId(),id);
        } catch(org.springframework.dao.DuplicateKeyException error) {throw new ApiException(409,"PHONE_TAKEN","该手机号已被使用");}
        int revoked=phoneChanged?auth.revokeSessions(actor.organizationId(),id):0;
        bumpAuthority(actor,"organization.employee.identity_updated",Map.of("userId",id,"fields",input.keySet(),"sessionsRevoked",revoked));
        return Map.of("userId",id,"rowVersion",n(row,"orgVersion")+1,"phoneUpdated",input.containsKey("phone"),"sessionsRevoked",revoked);
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
        result.put("items", db.list("SELECT id,title,body,sort_order,row_version,created_at FROM home_items WHERE organization_id=? AND kind='company' ORDER BY sort_order,created_at,id", actor.organizationId()));
        result.put("limit", COMPANY_ITEM_LIMIT);
        result.put("offWorkTime", s(db.one("SELECT off_work_time FROM organizations WHERE id=?", actor.organizationId()), "offWorkTime"));
        return result;
    }

    public Map<String, Object> createCompanyItem(Actor actor, Map<String, Object> input) {
        access.requireCapability(actor, "manage_company_info");
        allowed(input, Set.of("title", "body"));
        String body = text(input.get("body"), "公司信息内容", 2000);
        String title = input.containsKey("title") ? text(input.get("title"), "公司信息标题", 200)
                : body.substring(0, Math.min(body.length(), 200));
        long existing = n(db.one("SELECT COUNT(*) AS c FROM home_items WHERE organization_id=? AND kind='company'", actor.organizationId()), "c");
        if (existing >= COMPANY_ITEM_LIMIT) throw new ApiException(409, "HOME_ITEM_LIMIT", "公司信息最多10条，请先删除后再新增");
        long next = n(db.one("SELECT COALESCE(MAX(sort_order),0)+1 AS c FROM home_items WHERE organization_id=? AND kind='company'", actor.organizationId()), "c");
        String id = Db.id();
        db.update("INSERT INTO home_items(id,organization_id,owner_id,kind,title,body,sort_order) VALUES(?,?,NULL,'company',?,?,?)", id, actor.organizationId(), title, body, next);
        events.record(actor, null, "company_item.created", List.of(), Map.of("homeItemId", id));
        return Map.of("id", id, "rowVersion", 1, "sortOrder", next);
    }

    public Map<String, Object> updateCompanyItem(Actor actor, String id, String ifMatch, Map<String, Object> input) {
        access.requireCapability(actor, "manage_company_info");
        allowed(input, Set.of("title", "body"));
        Map<String, Object> row = db.one("SELECT * FROM home_items WHERE organization_id=? AND id=? AND kind='company' FOR UPDATE", actor.organizationId(), id);
        Writes.checkVersion(ifMatch, n(row, "rowVersion"));
        String body = input.containsKey("body") ? text(input.get("body"), "公司信息内容", 2000) : s(row, "body");
        String title = input.containsKey("title") ? text(input.get("title"), "公司信息标题", 200) : s(row, "title");
        db.update("UPDATE home_items SET title=?,body=?,row_version=row_version+1 WHERE organization_id=? AND id=?", title, body, actor.organizationId(), id);
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

    static String text(Object value, String label, int max) {
        if (!(value instanceof String raw)) throw bad(label + "必须为文字");
        String text = raw.strip();
        if (text.isEmpty() || text.codePointCount(0, text.length()) > max) throw bad(label + "不能为空且不得超过" + max + "字");
        if (text.codePoints().anyMatch(Character::isISOControl)) throw bad(label + "含无效字符");
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
