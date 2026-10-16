package cn.pandora.admin;

import cn.pandora.common.Db;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

import static cn.pandora.common.Db.s;

/**
 * Canonical role definitions, capabilities and scope levels (V5 / DEV-001..002).
 *
 * The Flyway migration backfills these for organizations that already exist when it runs. A
 * freshly created organization (a new empty database, or an organization created by the
 * administration flow) has no rows at migration time, so this component owns the same catalog and
 * applies it idempotently. Capabilities and view/dispatch ranges stay separate on purpose: a team
 * lead is not automatically a dispatcher, and the administrator gets no business scope.
 */
@Component
public class RoleCatalog {
    public static final String ADMIN = "admin";
    public static final String EXECUTIVE = "executive";
    public static final String MANAGER = "manager";
    public static final String EMPLOYEE = "employee";

    /** Legacy `users.role` value -> role code, used for backfill and compatibility reads. */
    public static String codeForLegacyRole(String legacyRole) {
        return switch (legacyRole == null ? "" : legacyRole) {
            case "admin" -> ADMIN;
            case "upper" -> EXECUTIVE;
            case "middle" -> MANAGER;
            default -> EMPLOYEE;
        };
    }

    /** Role code -> legacy label, kept so the prototype pages can still render a role name. */
    public static String legacyRoleFor(String code) {
        return switch (code == null ? "" : code) {
            case ADMIN -> "admin";
            case EXECUTIVE -> "upper";
            case MANAGER -> "middle";
            default -> "lower";
        };
    }

    public static List<String> codes() {
        return List.of(ADMIN, EXECUTIVE, MANAGER, EMPLOYEE);
    }

    private record Role(String code, String name, boolean administrator,
                        List<String> capabilities, Map<String, String> scopes) {}

    private static final List<Role> ROLES = List.of(
        new Role(ADMIN, "管理员", true,
            List.of("manage_organization", "manage_accounts", "manage_company_info",
                    "manage_notifications", "view_task_history"),
            Map.of()),
        new Role(EXECUTIVE, "上层", false,
            List.of("create_task", "handover_own", "handover_reports"),
            Map.of("task_view", "company", "task_dispatch", "company",
                   "log_read", "company", "profile_read", "company")),
        new Role(MANAGER, "中层", false,
            List.of("create_task", "handover_own", "handover_reports", "manage_team"),
            Map.of("task_view", "department", "task_dispatch", "department",
                   "log_read", "reports", "profile_read", "reports")),
        new Role(EMPLOYEE, "下层", false,
            List.of("create_task", "handover_own"),
            Map.of("task_view", "self", "task_dispatch", "self",
                   "log_read", "self", "profile_read", "self")));

    private final Db db;

    public RoleCatalog(Db db) { this.db = db; }

    /** Insert the four system roles for one organization when absent. Safe to call on every boot. */
    public void ensureDefaults(String organizationId) {
        for (Role role : ROLES) {
            db.update("INSERT INTO roles(id,organization_id,code,name,administrator,system_role) "
                    + "SELECT ?,?,?,?,?,TRUE FROM DUAL WHERE NOT EXISTS "
                    + "(SELECT 1 FROM roles WHERE organization_id=? AND code=?)",
                Db.id(), organizationId, role.code(), role.name(), role.administrator(),
                organizationId, role.code());
            String roleId = roleId(organizationId, role.code());
            if (roleId == null) continue;
            for (String capability : role.capabilities()) {
                db.update("INSERT INTO role_capabilities(organization_id,role_id,capability) "
                        + "SELECT ?,?,? FROM DUAL WHERE NOT EXISTS "
                        + "(SELECT 1 FROM role_capabilities WHERE organization_id=? AND role_id=? AND capability=?)",
                    organizationId, roleId, capability, organizationId, roleId, capability);
            }
            for (Map.Entry<String, String> scope : role.scopes().entrySet()) {
                db.update("INSERT INTO role_scopes(organization_id,role_id,scope_type,scope_level) "
                        + "SELECT ?,?,?,? FROM DUAL WHERE NOT EXISTS "
                        + "(SELECT 1 FROM role_scopes WHERE organization_id=? AND role_id=? AND scope_type=?)",
                    organizationId, roleId, scope.getKey(), scope.getValue(),
                    organizationId, roleId, scope.getKey());
            }
        }
    }

    public String roleId(String organizationId, String code) {
        Map<String, Object> row = db.find("SELECT id FROM roles WHERE organization_id=? AND code=?",
            organizationId, code);
        return row == null ? null : s(row, "id");
    }

    /** Grant one system role. Idempotent; grants are the only source of authority for an account. */
    public void grant(String organizationId, String userId, String code, String grantedBy) {
        String roleId = roleId(organizationId, code);
        if (roleId == null) throw new IllegalStateException("role catalog missing for " + organizationId);
        db.update("INSERT IGNORE INTO user_role_grants(organization_id,user_id,role_id,granted_by) VALUES(?,?,?,?)",
            organizationId, userId, roleId, grantedBy);
    }

    public void revokeAll(String organizationId, String userId) {
        db.update("DELETE FROM user_role_grants WHERE organization_id=? AND user_id=?",
            organizationId, userId);
    }

    public List<String> capabilities(String organizationId, String userId) {
        return db.list("SELECT DISTINCT c.capability FROM user_role_grants g "
                + "JOIN role_capabilities c ON c.organization_id=g.organization_id AND c.role_id=g.role_id "
                + "WHERE g.organization_id=? AND g.user_id=? ORDER BY c.capability",
            organizationId, userId).stream().map(row -> s(row, "capability")).toList();
    }

    public Map<String, String> scopes(String organizationId, String userId) {
        Map<String, String> result = new java.util.LinkedHashMap<>();
        for (Map<String, Object> row : db.list(
                "SELECT s.scope_type,s.scope_level FROM user_role_grants g "
                + "JOIN role_scopes s ON s.organization_id=g.organization_id AND s.role_id=g.role_id "
                + "WHERE g.organization_id=? AND g.user_id=? ORDER BY s.scope_type",
                organizationId, userId)) {
            // Widest configured range wins when several roles are granted.
            result.merge(s(row, "scopeType"), s(row, "scopeLevel"), RoleCatalog::widest);
        }
        return result;
    }

    /** Role codes currently granted to an account. */
    public List<String> grantedCodes(String organizationId, String userId) {
        return db.list("SELECT r.code FROM user_role_grants g "
                + "JOIN roles r ON r.organization_id=g.organization_id AND r.id=g.role_id "
                + "WHERE g.organization_id=? AND g.user_id=? ORDER BY r.code",
            organizationId, userId).stream().map(row -> s(row, "code")).toList();
    }

    /** Capabilities configured for one role definition, used by the administration console. */
    public List<String> capabilitiesForRole(String organizationId, String roleId) {
        return db.list("SELECT capability FROM role_capabilities WHERE organization_id=? AND role_id=? ORDER BY capability",
            organizationId, roleId).stream().map(row -> s(row, "capability")).toList();
    }

    /** Per-area ranges configured for one role definition. */
    public Map<String, String> scopesForRole(String organizationId, String roleId) {
        Map<String, String> result = new java.util.LinkedHashMap<>();
        for (Map<String, Object> row : db.list("SELECT scope_type,scope_level FROM role_scopes "
                + "WHERE organization_id=? AND role_id=? ORDER BY scope_type", organizationId, roleId)) {
            result.put(s(row, "scopeType"), s(row, "scopeLevel"));
        }
        return result;
    }

    public boolean isAdministrator(String organizationId, String userId) {        return db.find("SELECT 1 FROM user_role_grants g "
                + "JOIN roles r ON r.organization_id=g.organization_id AND r.id=g.role_id "
                + "WHERE g.organization_id=? AND g.user_id=? AND r.administrator=TRUE LIMIT 1",
            organizationId, userId) != null;
    }

    private static String widest(String left, String right) {
        return rank(left) >= rank(right) ? left : right;
    }

    private static int rank(String level) {
        return switch (level) {
            case "company" -> 3;
            case "department" -> 2;
            case "reports" -> 1;
            default -> 0;
        };
    }
}
