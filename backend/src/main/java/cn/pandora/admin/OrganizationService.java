package cn.pandora.admin;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.auth.AuthService;
import cn.pandora.common.*;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.regex.Pattern;

import static cn.pandora.common.Db.*;

/**
 * Organization maintenance and account administration (DEV-001, DEV-002, DEV-004, DEV-028).
 *
 * Every command is called from inside {@link Writes#run}, so it already holds the organization lock.
 * Validation is deliberately strict and explicit: employee department and position are required, one
 * department / one team / one manager per person, no manager or department cycles, references stay
 * inside the company, and the company has exactly one administrator. Organization position is always
 * supplied by the administrator and is never inferred from a position name or a team lead.
 */
@Service
public class OrganizationService {
    private static final Pattern USERNAME = Pattern.compile("^[a-z0-9][a-z0-9._-]{2,79}$");
    private static final Pattern TIME = Pattern.compile("^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$");
    private static final Set<String> LEVELS = Set.of("urgent", "high", "medium", "low");
    private static final int COMPANY_ITEM_LIMIT = 10;

    private final Db db;
    private final Access access;
    private final Events events;
    private final RoleCatalog roles;
    private final OrganizationConstraints constraints;
    private final AuthService auth;
    private final cn.pandora.task.TaskService tasks;

    public OrganizationService(Db db, Access access, Events events, RoleCatalog roles,
                               OrganizationConstraints constraints, AuthService auth,
                               cn.pandora.task.TaskService tasks) {
        this.db = db; this.access = access; this.events = events; this.roles = roles;
        this.constraints = constraints; this.auth = auth; this.tasks = tasks;
    }

    /**
     * A real organization change must leave every pending request pointing at a reviewer who can still
     * decide it, and must record who moved and why (DEV-010). Runs inside the same transaction.
     */
    private void refreshPendingRoutes(Actor actor) {
        tasks.refreshPendingRoutes(actor);
    }

    // ------------------------------------------------------------------ //
    // Structure read model
    // ------------------------------------------------------------------ //

    public Map<String, Object> structure(Actor actor) {
        access.requireAdmin(actor);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("organization", db.one("SELECT id,name,time_zone,off_work_time,authz_version FROM organizations WHERE id=?", actor.organizationId()));
        result.put("departments", db.list("SELECT d.*,p.name AS parent_name,(SELECT COUNT(*) FROM teams t WHERE t.organization_id=d.organization_id AND t.department_id=d.id) AS team_count FROM departments d LEFT JOIN departments p ON p.organization_id=d.organization_id AND p.id=d.parent_id WHERE d.organization_id=? ORDER BY d.name,d.id", actor.organizationId()));
        result.put("positions", db.list("SELECT * FROM positions WHERE organization_id=? ORDER BY sort_order,name,id", actor.organizationId()));
        result.put("teams", db.list("SELECT t.*,d.name AS department_name,l.display_name AS lead_name,(SELECT COUNT(*) FROM users u WHERE u.organization_id=t.organization_id AND u.team_id=t.id AND u.active=1) AS member_count FROM teams t LEFT JOIN departments d ON d.organization_id=t.organization_id AND d.id=t.department_id LEFT JOIN users l ON l.organization_id=t.organization_id AND l.id=t.lead_user_id WHERE t.organization_id=? ORDER BY d.name,t.name,t.id", actor.organizationId()));
        result.put("roles", db.list("SELECT * FROM roles WHERE organization_id=? ORDER BY administrator DESC,code", actor.organizationId()).stream().map(row -> {
            Map<String, Object> role = new LinkedHashMap<>(row);
            role.put("capabilities", roles.capabilitiesForRole(actor.organizationId(), s(row, "id")));
            role.put("scopes", roles.scopesForRole(actor.organizationId(), s(row, "id")));
            return role;
        }).toList());
        result.put("constraints", constraints.status());
        return result;
    }

    public List<Map<String, Object>> roles(Actor actor) {
        access.requireAdmin(actor);
        return db.list("SELECT * FROM roles WHERE organization_id=? ORDER BY administrator DESC,code", actor.organizationId());
    }

    // ------------------------------------------------------------------ //
    // Departments and positions
    // ------------------------------------------------------------------ //

    public Map<String, Object> createDepartment(Actor actor, Map<String, Object> input) {
        access.requireCapability(actor, "manage_organization");
        allowed(input, Set.of("name", "parentId"));
        String name = text(input.get("name"), "部门名称", 100);
        requireUnique("SELECT 1 FROM departments WHERE organization_id=? AND name=?", "部门名称已存在", actor.organizationId(), name);
        String parentId = optionalId(input.get("parentId"), "parentId");
        if (parentId != null) requireDepartment(actor, parentId);
        String id = Db.id();
        db.update("INSERT INTO departments(id,organization_id,name,parent_id) VALUES(?,?,?,?)", id, actor.organizationId(), name, parentId);
        bumpAuthority(actor, "organization.department.created", Map.of("departmentId", id, "name", name));
        return Map.of("departmentId", id, "rowVersion", 1);
    }

    public Map<String, Object> updateDepartment(Actor actor, String id, String ifMatch, Map<String, Object> input) {
        access.requireCapability(actor, "manage_organization");
        allowed(input, Set.of("name", "parentId"));
        Map<String, Object> row = db.one("SELECT * FROM departments WHERE organization_id=? AND id=? FOR UPDATE", actor.organizationId(), id);
        Writes.checkVersion(ifMatch, n(row, "rowVersion"));
        String name = input.containsKey("name") ? text(input.get("name"), "部门名称", 100) : s(row, "name");
        requireUniqueExcept("SELECT 1 FROM departments WHERE organization_id=? AND name=? AND id<>?", actor.organizationId(), name, id);
        String parentId = input.containsKey("parentId") ? optionalId(input.get("parentId"), "parentId") : s(row, "parentId");
        if (Objects.equals(parentId, id)) throw bad("部门不能作为自己的上级部门");
        if (parentId != null) {
            requireDepartment(actor, parentId);
            validateDepartmentChain(actor, id, parentId);
        }
        db.update("UPDATE departments SET name=?,parent_id=?,row_version=row_version+1 WHERE organization_id=? AND id=?", name, parentId, actor.organizationId(), id);
        bumpAuthority(actor, "organization.department.updated", Map.of("departmentId", id, "name", name));
        return Map.of("departmentId", id, "rowVersion", n(row, "rowVersion") + 1);
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

    // ------------------------------------------------------------------ //
    // Employees
    // ------------------------------------------------------------------ //

    public Map<String, Object> employees(Actor actor, Map<String, String> filters) {
        access.requireAdmin(actor);
        String query = filters.getOrDefault("q", "").strip().toLowerCase(Locale.ROOT);
        List<Map<String, Object>> rows = db.list("SELECT u.*,d.name AS department_name,p.name AS position_name,t.name AS team_name,m.display_name AS manager_name "
                + "FROM users u LEFT JOIN departments d ON d.organization_id=u.organization_id AND d.id=u.department_id "
                + "LEFT JOIN positions p ON p.organization_id=u.organization_id AND p.id=u.position_id "
                + "LEFT JOIN teams t ON t.organization_id=u.organization_id AND t.id=u.team_id "
                + "LEFT JOIN users m ON m.organization_id=u.organization_id AND m.id=u.manager_id "
                + "WHERE u.organization_id=? ORDER BY u.rank_level,u.display_name,u.id", actor.organizationId())
            .stream()
            .filter(row -> query.isEmpty()
                || s(row, "displayName").toLowerCase(Locale.ROOT).contains(query)
                || s(row, "username").toLowerCase(Locale.ROOT).contains(query)
                || Objects.toString(s(row, "departmentName"), "").toLowerCase(Locale.ROOT).contains(query))
            .map(row -> employeeView(actor, row))
            .toList();
        Map<String, Object> page = new LinkedHashMap<>();
        page.put("items", rows);
        page.put("total", rows.size());
        return page;
    }

    public Map<String, Object> employee(Actor actor, String id) {
        access.requireAdmin(actor);
        Map<String, Object> row = db.one("SELECT u.*,d.name AS department_name,p.name AS position_name,t.name AS team_name,m.display_name AS manager_name "
                + "FROM users u LEFT JOIN departments d ON d.organization_id=u.organization_id AND d.id=u.department_id "
                + "LEFT JOIN positions p ON p.organization_id=u.organization_id AND p.id=u.position_id "
                + "LEFT JOIN teams t ON t.organization_id=u.organization_id AND t.id=u.team_id "
                + "LEFT JOIN users m ON m.organization_id=u.organization_id AND m.id=u.manager_id "
                + "WHERE u.organization_id=? AND u.id=?", actor.organizationId(), id);
        return employeeView(actor, row);
    }

    /**
     * Administration never echoes another employee's phone number. The caller only learns whether a
     * number is on file; the owner reads and edits it through /me/profile (DEV-028).
     */
    private Map<String, Object> employeeView(Actor actor, Map<String, Object> row) {
        Map<String, Object> view = new LinkedHashMap<>();
        for (String key : List.of("id", "username", "displayName", "role", "rankLevel", "active",
                "departmentId", "departmentName", "positionId", "positionName", "teamId", "teamName",
                "managerId", "managerName", "reviewerAvailable", "mustChangePassword", "createdAt")) {
            view.put(key, row.get(key));
        }
        view.put("rowVersion", n(row, "orgVersion"));
        view.put("hasPhone", row.get("phone") != null);
        view.put("hasEmail", row.get("email") != null);
        view.put("roles", roles.grantedCodes(actor.organizationId(), s(row, "id")));
        view.put("capabilities", roles.capabilities(actor.organizationId(), s(row, "id")));
        view.put("scopes", roles.scopes(actor.organizationId(), s(row, "id")));
        view.put("editable", true);
        return view;
    }

    /** Creates an account with a generated initial password that must be changed at first login. */
    public Writes.Outcome createEmployee(Actor actor, Map<String, Object> input) {
        access.requireCapability(actor, "manage_accounts");
        allowed(input, Set.of("username", "displayName", "departmentId", "positionId", "teamId",
                "managerId", "level", "roleCodes", "phone", "email"));
        String username = text(input.get("username"), "用户名", 80).toLowerCase(Locale.ROOT);
        if (!USERNAME.matcher(username).matches()) throw bad("用户名须为3至80位小写字母、数字、点、下划线或短横线");
        requireUnique("SELECT 1 FROM users WHERE username=?", "用户名已被占用", username);
        String displayName = text(input.get("displayName"), "姓名", 100);
        String departmentId = requiredUuid(input.get("departmentId"), "departmentId");
        requireDepartment(actor, departmentId);
        String positionId = requiredUuid(input.get("positionId"), "positionId");
        requirePosition(actor, positionId);
        String teamId = optionalId(input.get("teamId"), "teamId");
        if (teamId != null) requireTeamInDepartment(actor, teamId, departmentId);
        String managerId = optionalId(input.get("managerId"), "managerId");
        int level = requiredLevel(input.get("level"));
        List<String> codes = roleCodes(input.get("roleCodes"), false);
        validateAdministrator(actor, null, codes);

        String userId = Db.id();
        String password = Credentials.generate();
        String hash = AuthService.PASSWORDS.encode(password);
        String legacyRole = RoleCatalog.legacyRoleFor(codes.contains(RoleCatalog.ADMIN) ? RoleCatalog.ADMIN
                : codes.isEmpty() ? RoleCatalog.EMPLOYEE : codes.getFirst());
        db.update("INSERT INTO users(id,organization_id,team_id,department_id,position_id,manager_id,username,password_hash,display_name,role,rank_level,active,must_change_password,credential_version,phone,email) VALUES(?,?,?,?,?,?,?,?,?,?,?,TRUE,TRUE,1,?,?)",
                userId, actor.organizationId(), teamId, departmentId, positionId, managerId, username, hash,
                displayName, legacyRole, level, optionalPhone(input.get("phone")), optionalEmail(input.get("email")));
        if (managerId != null) validateManagerChain(actor, userId, managerId);
        roles.revokeAll(actor.organizationId(), userId);
        for (String code : codes.isEmpty() ? List.of(RoleCatalog.EMPLOYEE) : codes) {
            roles.grant(actor.organizationId(), userId, code, actor.id());
        }
        bumpAuthority(actor, "organization.employee.created", Map.of("userId", userId, "username", username));
        Map<String, Object> replayable = new LinkedHashMap<>();
        replayable.put("userId", userId);
        replayable.put("username", username);
        replayable.put("mustChangePassword", true);
        replayable.put("rowVersion", 1);
        // The generated secret is shown once and is never written to the idempotency cache or audit.
        return new Writes.Outcome(replayable, Map.of("initialPassword", password));
    }

    public Map<String, Object> updateEmployee(Actor actor, String id, String ifMatch, Map<String, Object> input) {
        access.requireCapability(actor, "manage_organization");
        allowed(input, Set.of("displayName", "departmentId", "positionId", "teamId", "managerId",
                "level", "active", "reviewerAvailable", "roleCodes", "phone", "email"));
        Map<String, Object> row = db.one("SELECT * FROM users WHERE organization_id=? AND id=? FOR UPDATE", actor.organizationId(), id);
        Writes.checkVersion(ifMatch, n(row, "orgVersion"));

        String displayName = input.containsKey("displayName") ? text(input.get("displayName"), "姓名", 100) : s(row, "displayName");
        String departmentId = input.containsKey("departmentId") ? requiredUuid(input.get("departmentId"), "departmentId") : s(row, "departmentId");
        if (departmentId == null) throw bad("部门为必填项");
        requireDepartment(actor, departmentId);
        String positionId = input.containsKey("positionId") ? requiredUuid(input.get("positionId"), "positionId") : s(row, "positionId");
        if (positionId == null) throw bad("职位为必填项");
        requirePosition(actor, positionId);
        String teamId = input.containsKey("teamId") ? optionalId(input.get("teamId"), "teamId") : s(row, "teamId");
        if (teamId != null) requireTeamInDepartment(actor, teamId, departmentId);
        String managerId = input.containsKey("managerId") ? optionalId(input.get("managerId"), "managerId") : s(row, "managerId");
        if (Objects.equals(managerId, id)) throw bad("员工不能作为自己的直属上级");
        int level = input.containsKey("level") ? requiredLevel(input.get("level")) : Math.toIntExact(n(row, "rankLevel"));
        boolean active = input.containsKey("active") ? bool(input.get("active"), "active") : access.enabled(row);
        boolean reviewerAvailable = input.containsKey("reviewerAvailable") ? bool(input.get("reviewerAvailable"), "reviewerAvailable") : access.enabled(Map.of("active", row.get("reviewerAvailable")));
        List<String> codes = input.containsKey("roleCodes") ? roleCodes(input.get("roleCodes"), true) : roles.grantedCodes(actor.organizationId(), id);
        validateAdministrator(actor, id, codes);
        if (managerId != null) validateManagerChain(actor, id, managerId);

        String legacyRole = RoleCatalog.legacyRoleFor(codes.contains(RoleCatalog.ADMIN) ? RoleCatalog.ADMIN
                : codes.isEmpty() ? RoleCatalog.EMPLOYEE : codes.getFirst());
        List<String> changed = new ArrayList<>();
        for (String field : List.of("displayName", "departmentId", "positionId", "teamId", "managerId", "phone", "email")) {
            if (input.containsKey(field)) changed.add(field);
        }
        db.update("UPDATE users SET display_name=?,department_id=?,position_id=?,team_id=?,manager_id=?,rank_level=?,active=?,reviewer_available=?,role=?,phone=COALESCE(?,phone),email=COALESCE(?,email),org_version=org_version+1 WHERE organization_id=? AND id=?",
                displayName, departmentId, positionId, teamId, managerId, level, active, reviewerAvailable,
                legacyRole, optionalPhone(input.get("phone")), optionalEmail(input.get("email")),
                actor.organizationId(), id);
        roles.revokeAll(actor.organizationId(), id);
        for (String code : codes) roles.grant(actor.organizationId(), id, code, actor.id());
        bumpAuthority(actor, "organization.employee.updated", Map.of("userId", id, "fields", changed));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", id);
        result.put("rowVersion", n(row, "orgVersion") + 1);
        result.put("changed", changed);
        // Field-change receipt only: never echo another employee's phone number back.
        result.put("phoneUpdated", changed.contains("phone"));
        refreshPendingRoutes(actor);
        return result;
    }

    /** 转岗: one command moves department/team/manager/level/authority and invalidates stale authority. */
    public Map<String, Object> transferEmployee(Actor actor, String id, String ifMatch, Map<String, Object> input) {
        access.requireCapability(actor, "manage_organization");
        allowed(input, Set.of("departmentId", "positionId", "teamId", "managerId", "level", "roleCodes", "reason"));
        Map<String, Object> row = db.one("SELECT * FROM users WHERE organization_id=? AND id=? FOR UPDATE", actor.organizationId(), id);
        Writes.checkVersion(ifMatch, n(row, "orgVersion"));
        String reason = text(input.get("reason"), "转岗原因", 500);

        String departmentId = requiredUuid(input.get("departmentId"), "departmentId");
        requireDepartment(actor, departmentId);
        String positionId = requiredUuid(input.get("positionId"), "positionId");
        requirePosition(actor, positionId);
        String teamId = optionalId(input.get("teamId"), "teamId");
        if (teamId != null) requireTeamInDepartment(actor, teamId, departmentId);
        String managerId = optionalId(input.get("managerId"), "managerId");
        if (Objects.equals(managerId, id)) throw bad("员工不能作为自己的直属上级");
        int level = requiredLevel(input.get("level"));
        List<String> codes = roleCodes(input.get("roleCodes"), true);
        validateAdministrator(actor, id, codes);
        if (managerId != null) validateManagerChain(actor, id, managerId);

        Map<String, Object> before = new LinkedHashMap<>();
        for (String key : List.of("departmentId", "positionId", "teamId", "managerId", "rankLevel")) before.put(key, row.get(key));
        before.put("roleCodes", roles.grantedCodes(actor.organizationId(), id));

        String legacyRole = RoleCatalog.legacyRoleFor(codes.contains(RoleCatalog.ADMIN) ? RoleCatalog.ADMIN
                : codes.isEmpty() ? RoleCatalog.EMPLOYEE : codes.getFirst());
        db.update("UPDATE users SET department_id=?,position_id=?,team_id=?,manager_id=?,rank_level=?,role=?,org_version=org_version+1 WHERE organization_id=? AND id=?",
                departmentId, positionId, teamId, managerId, level, legacyRole, actor.organizationId(), id);
        roles.revokeAll(actor.organizationId(), id);
        for (String code : codes) roles.grant(actor.organizationId(), id, code, actor.id());

        Map<String, Object> after = Map.of("departmentId", departmentId, "positionId", positionId,
                "teamId", Objects.toString(teamId, ""), "managerId", Objects.toString(managerId, ""),
                "rankLevel", level, "roleCodes", codes);
        bumpAuthority(actor, "organization.employee.transferred",
                Map.of("userId", id, "reason", reason, "before", before, "after", after));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", id);
        result.put("rowVersion", n(row, "orgVersion") + 1);
        result.put("transferred", true);
        result.put("authorizationInvalidated", true);
        refreshPendingRoutes(actor);
        return result;
    }

    /**
     * Administrator reset (DEV-001, DEV-003). Generates a fresh one-time password, revokes every
     * existing session and restores the first-login gate. The password travels in the one-time part of
     * the outcome, so it never reaches the audit trail, the event outbox or the idempotency cache, and a
     * lost response cannot show it again — the administrator resets again instead.
     */
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

    public Map<String, Object> grantRoles(Actor actor, String id, String ifMatch, Map<String, Object> input) {        access.requireCapability(actor, "manage_organization");
        allowed(input, Set.of("roleCodes"));
        Map<String, Object> row = db.one("SELECT * FROM users WHERE organization_id=? AND id=? FOR UPDATE", actor.organizationId(), id);
        Writes.checkVersion(ifMatch, n(row, "orgVersion"));
        List<String> codes = roleCodes(input.get("roleCodes"), true);
        validateAdministrator(actor, id, codes);
        roles.revokeAll(actor.organizationId(), id);
        for (String code : codes) roles.grant(actor.organizationId(), id, code, actor.id());
        String legacyRole = RoleCatalog.legacyRoleFor(codes.contains(RoleCatalog.ADMIN) ? RoleCatalog.ADMIN
                : codes.isEmpty() ? RoleCatalog.EMPLOYEE : codes.getFirst());
        db.update("UPDATE users SET role=?,org_version=org_version+1 WHERE organization_id=? AND id=?", legacyRole, actor.organizationId(), id);
        bumpAuthority(actor, "organization.roles.granted", Map.of("userId", id, "roleCodes", codes));
        refreshPendingRoutes(actor);
        return Map.of("userId", id, "rowVersion", n(row, "orgVersion") + 1, "roles", codes);
    }

    // ------------------------------------------------------------------ //
    // Teams (authorized department lead)
    // ------------------------------------------------------------------ //

    public Map<String, Object> createTeam(Actor actor, Map<String, Object> input) {
        allowed(input, Set.of("name", "departmentId", "leadUserId"));
        String departmentId = requiredUuid(input.get("departmentId"), "departmentId");
        requireDepartment(actor, departmentId);
        requireTeamManagement(actor, departmentId);
        String name = text(input.get("name"), "团队名称", 100);
        requireUnique("SELECT 1 FROM teams WHERE organization_id=? AND name=?", "团队名称已存在", actor.organizationId(), name);
        // The creator is the default lead and the lead role grants no business authority by itself.
        // A company-wide administrator is not a member of the department, so an explicit lead is required.
        String leadUserId = input.containsKey("leadUserId") ? requiredUuid(input.get("leadUserId"), "leadUserId") : actor.id();
        requireMemberOfDepartment(actor, leadUserId, departmentId);        String id = Db.id();
        db.update("INSERT INTO teams(id,organization_id,name,department_id,lead_user_id) VALUES(?,?,?,?,?)", id, actor.organizationId(), name, departmentId, leadUserId);
        bumpAuthority(actor, "organization.team.created", Map.of("teamId", id, "departmentId", departmentId, "leadUserId", leadUserId));
        return Map.of("teamId", id, "leadUserId", leadUserId, "rowVersion", 1);
    }

    public Map<String, Object> updateTeam(Actor actor, String id, String ifMatch, Map<String, Object> input) {
        allowed(input, Set.of("name", "leadUserId", "departmentId"));
        Map<String, Object> row = db.one("SELECT * FROM teams WHERE organization_id=? AND id=? FOR UPDATE", actor.organizationId(), id);
        Writes.checkVersion(ifMatch, n(row, "rowVersion"));
        String departmentId = input.containsKey("departmentId") ? requiredUuid(input.get("departmentId"), "departmentId") : s(row, "departmentId");
        if (departmentId == null) throw bad("团队必须归属于一个部门");
        requireTeamManagement(actor, departmentId);
        String name = input.containsKey("name") ? text(input.get("name"), "团队名称", 100) : s(row, "name");
        requireUniqueExcept("SELECT 1 FROM teams WHERE organization_id=? AND name=? AND id<>?", actor.organizationId(), name, id);
        String leadUserId = input.containsKey("leadUserId") ? requiredUuid(input.get("leadUserId"), "leadUserId") : s(row, "leadUserId");
        if (leadUserId != null) requireMemberOfDepartment(actor, leadUserId, departmentId);
        db.update("UPDATE teams SET name=?,department_id=?,lead_user_id=?,row_version=row_version+1 WHERE organization_id=? AND id=?", name, departmentId, leadUserId, actor.organizationId(), id);
        bumpAuthority(actor, "organization.team.updated", Map.of("teamId", id, "leadUserId", Objects.toString(leadUserId, "")));
        refreshPendingRoutes(actor);
        return Map.of("teamId", id, "leadUserId", leadUserId, "rowVersion", n(row, "rowVersion") + 1);
    }

    // ------------------------------------------------------------------ //
    // Company information and the all-day cut-off
    // ------------------------------------------------------------------ //

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

    // ------------------------------------------------------------------ //
    // Validation helpers
    // ------------------------------------------------------------------ //

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

    private void requireTeamInDepartment(Actor actor, String teamId, String departmentId) {
        Map<String, Object> team = db.find("SELECT * FROM teams WHERE organization_id=? AND id=?", actor.organizationId(), teamId);
        if (team == null) throw bad("团队不存在或不属于本公司");
        if (!Objects.equals(departmentId, s(team, "departmentId"))) throw bad("员工只能加入其所属部门下的团队");
    }

    private void requireMemberOfDepartment(Actor actor, String userId, String departmentId) {
        Map<String, Object> user = access.activeUser(actor, userId);
        if (user == null) throw bad("团队成员不存在或已停用");
        if (!Objects.equals(departmentId, s(user, "departmentId"))) {
            throw bad(actor.id().equals(userId)
                    ? "创建者不属于该部门，请指定本部门成员为团队负责人"
                    : "团队负责人必须属于该部门");
        }
    }

    /** Team maintenance is its own authority: an explicit grant plus the same department. */
    private void requireTeamManagement(Actor actor, String departmentId) {
        if (actor.can("manage_organization")) return;
        if (!actor.can("manage_team")) throw new ApiException(403, "FORBIDDEN", "当前账号没有团队管理授权");
        if (actor.departmentId() == null || !actor.departmentId().equals(departmentId)) {
            throw new ApiException(403, "FORBIDDEN", "仅可维护本人所属部门的团队");
        }
    }

    /** Departments and employees that must be listed in the console's team-lead selector. */
    public List<Map<String, Object>> departmentMembers(Actor actor, String departmentId) {
        access.requireAdmin(actor);
        requireDepartment(actor, departmentId);
        return db.list("SELECT id,display_name FROM users WHERE organization_id=? AND department_id=? AND active=1 ORDER BY rank_level,display_name,id",
                actor.organizationId(), departmentId).stream()
            .map(row -> Map.<String, Object>of("id", s(row, "id"), "displayName", s(row, "displayName")))
            .toList();
    }

    private void validateManagerChain(Actor actor, String userId, String managerId) {
        Set<String> seen = new HashSet<>();
        String cursor = managerId;
        while (cursor != null) {
            if (cursor.equals(userId)) throw bad("上下级关系不能形成循环");
            if (!seen.add(cursor)) throw bad("上下级关系存在循环");
            Map<String, Object> row = db.find("SELECT active,manager_id FROM users WHERE organization_id=? AND id=?", actor.organizationId(), cursor);
            if (row == null) throw bad("直属上级不存在或不属于本公司");
            cursor = s(row, "managerId");
        }
    }

    private void validateDepartmentChain(Actor actor, String departmentId, String parentId) {
        Set<String> seen = new HashSet<>();
        String cursor = parentId;
        while (cursor != null) {
            if (cursor.equals(departmentId)) throw bad("部门层级不能形成循环");
            if (!seen.add(cursor)) throw bad("部门层级存在循环");
            Map<String, Object> row = db.find("SELECT parent_id FROM departments WHERE organization_id=? AND id=?", actor.organizationId(), cursor);
            if (row == null) throw bad("上级部门不存在");
            cursor = s(row, "parentId");
        }
    }

    private void validateAdministrator(Actor actor, String userId, List<String> codes) {
        if (!codes.contains(RoleCatalog.ADMIN)) return;
        Long others = db.jdbc.queryForObject("SELECT COUNT(*) FROM user_role_grants g JOIN roles r ON r.organization_id=g.organization_id AND r.id=g.role_id WHERE g.organization_id=? AND r.administrator=TRUE AND g.user_id<>?",
                Long.class, actor.organizationId(), userId == null ? "" : userId);
        if (others != null && others > 0) throw new ApiException(409, "SECOND_ADMINISTRATOR", "公司只能有一个管理员账号");
    }

    private List<String> roleCodes(Object value, boolean required) {
        if (value == null) {
            if (required) throw bad("roleCodes须为角色列表");
            return List.of();
        }
        if (!(value instanceof List<?> list)) throw bad("roleCodes须为角色列表");
        List<String> codes = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof String code) || !RoleCatalog.codes().contains(code)) throw bad("存在未知角色代码");
            if (!codes.contains(code)) codes.add(code);
        }
        if (required && codes.isEmpty()) throw bad("至少需要一个角色");
        return codes;
    }

    /** The referenced row must already exist inside the company. */
    private void requireExists(String sql, String message, Object... args) {
        if (db.find(sql, args) == null) throw new ApiException(400, "INVALID_INPUT", message);
    }

    /** The referenced row must not exist yet (name uniqueness). */
    private void requireUnique(String sql, String message, Object... args) {
        if (db.find(sql, args) != null) throw new ApiException(409, "DATA_CONFLICT", message);
    }

    private void requireUniqueExcept(String sql, Object... args) {
        if (db.find(sql, args) != null) throw new ApiException(409, "DATA_CONFLICT", "名称已存在");
    }

    private static int requiredLevel(Object value) {
        if (!(value instanceof Number number) || number.intValue() < 0 || number.intValue() > 100) {
            throw bad("组织层级须为0至100的整数，且必须显式设置");
        }
        return number.intValue();
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

    private static String optionalEmail(Object value) {
        if (value == null) return null;
        String email = text(value, "邮箱", 254);
        int at = email.indexOf('@');
        String local = at < 0 ? "" : email.substring(0, at);
        if (!email.matches("^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$")
                || local.length() > 64 || local.startsWith(".") || local.endsWith(".") || local.contains("..")) {
            throw bad("请输入有效的邮箱地址");
        }
        return email;
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

    @SuppressWarnings("unused")
    private static Timestamp now() { return Timestamp.from(Instant.now()); }
}
