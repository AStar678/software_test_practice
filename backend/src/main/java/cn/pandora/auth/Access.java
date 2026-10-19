package cn.pandora.auth;

import cn.pandora.admin.RoleCatalog;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import org.springframework.stereotype.Component;

import java.util.*;

import static cn.pandora.common.Db.*;

/**
 * The single authority authority (DEV-002, DEV-005, DEV-028).
 *
 * The prototype mixed team membership into viewing, dispatch, logging and profile privacy. This
 * component keeps those decisions separate, each driven by its own configured range, so that:
 * visibility never grants dispatch, a teammate is not a direct report, and an administrator holds no
 * employee business authority at all.
 */
@Component
public class Access {
    private final Db db;
    private final RoleCatalog roles;

    public Access(Db db, RoleCatalog roles) { this.db = db; this.roles = roles; }

    /**
     * Full authority snapshot for a user row: explicit capabilities, per-area ranges, the current
     * organization authorization version and the account gate flags (DEV-002, DEV-003, DEV-005).
     */
    public Actor actor(Map<String, Object> user) {
        String organizationId = s(user, "organizationId");
        String userId = s(user, "id");
        Map<String, String> scopes = new LinkedHashMap<>(roles.scopes(organizationId, userId));
        return new Actor(userId, organizationId, s(user, "role"), s(user, "teamId"), s(user, "managerId"),
                (int) n(user, "rankLevel"), s(user, "departmentId"), s(user, "positionId"),
                new LinkedHashSet<>(roles.capabilities(organizationId, userId)), Map.copyOf(scopes),
                n(db.one("SELECT authz_version FROM organizations WHERE id=?", organizationId), "authzVersion"),
                truthy(user.get("reviewerAvailable")), truthy(user.get("mustChangePassword")),
                user.get("credentialVersion") == null ? 1L : n(user, "credentialVersion"));
    }

    /** Full snapshot of an active member, resolved by id. */
    public Actor actorFor(Actor context, String id) {
        return actor(user(context, id));
    }

    private static boolean truthy(Object value) {
        return Boolean.TRUE.equals(value) || value instanceof Number number && number.intValue() == 1;
    }

    /** Active member of the actor's organization; throws 404-style notFound when absent. */
    public Map<String, Object> user(Actor a, String id) {
        return db.one("SELECT * FROM users WHERE id=? AND organization_id=? AND active=1", id, a.organizationId());
    }

    public Map<String, Object> activeUser(Actor a, String id) {
        return db.find("SELECT * FROM users WHERE id=? AND organization_id=? AND active=1", id, a.organizationId());
    }

    public Map<String, Object> knownUser(Actor a, String id) {
        return db.find("SELECT * FROM users WHERE id=? AND organization_id=?", id, a.organizationId());
    }

    // --------------------------------------------------------------------- //
    // Task visibility (independent from dispatch)
    // --------------------------------------------------------------------- //

    public boolean canSeeTask(Actor a, Map<String, Object> task, Map<String, Object> version, List<String> assignees) {
        if (version == null || !a.organizationId().equals(s(task, "organizationId")) || s(task, "currentVersionId") == null) return false;
        if (a.id().equals(s(task, "originalCreatorId")) || assignees.contains(a.id())) return true;
        if (a.administrator()) return false;
        return switch (a.scope("task_view")) {
            case "company" -> true;
            case "department" -> touchesDepartment(a, assignees);
            case "reports" -> assignees.stream().anyMatch(id -> isDirectReport(a, id));
            default -> false;
        };
    }

    private boolean touchesDepartment(Actor a, Collection<String> assignees) {
        if (a.departmentId() == null) return false;
        for (String id : assignees) {
            Map<String, Object> person = db.find("SELECT department_id FROM users WHERE organization_id=? AND id=?", a.organizationId(), id);
            if (person != null && a.departmentId().equals(s(person, "departmentId"))) return true;
        }
        return false;
    }

    // --------------------------------------------------------------------- //
    // Dispatch authority (independent from viewing)
    // --------------------------------------------------------------------- //

    public boolean canDispatchTo(Actor a, Map<String, Object> target) {
        if (target == null || !a.organizationId().equals(s(target, "organizationId"))) return false;
        if (!enabled(target) || "admin".equals(s(target, "role"))) return false;
        String targetId = s(target, "id");
        if (a.id().equals(targetId)) return true;
        if (a.administrator()) return false;
        return switch (a.scope("task_dispatch")) {
            case "company" -> true;
            case "department" -> a.departmentId() != null
                    && a.departmentId().equals(s(target, "departmentId"))
                    && n(target, "rankLevel") > a.rank();
            case "reports" -> isDirectReport(a, targetId);
            default -> false;
        };
    }

    public void requireDispatchable(Actor a, String targetId) {
        Map<String, Object> target = activeUser(a, targetId);
        if (target == null || !canDispatchTo(a, target)) {
            throw new ApiException(403, "DISPATCH_NOT_ALLOWED", "不可向该人员派发任务，请检查部门与授权范围");
        }
    }

    /** Assignee candidates: active, non-administrator, inside the actor's dispatch range. */
    public List<Map<String, Object>> dispatchCandidates(Actor a, String query) {
        String like = query == null ? "" : query.strip();
        return db.list("SELECT u.organization_id,u.id,u.username,u.display_name,u.role,u.rank_level,u.active,"
                        + "u.department_id,u.position_id,u.team_id,d.name AS department_name,p.name AS position_name "
                        + "FROM users u "
                        + "LEFT JOIN departments d ON d.organization_id=u.organization_id AND d.id=u.department_id "
                        + "LEFT JOIN positions p ON p.organization_id=u.organization_id AND p.id=u.position_id "
                        + "WHERE u.organization_id=? AND u.active=1 ORDER BY u.rank_level,u.display_name,u.id",
                a.organizationId())
                .stream()
                .filter(u -> !"admin".equals(s(u, "role")))
                .filter(u -> canDispatchTo(a, u))
                .filter(u -> like.isEmpty()
                        || s(u, "displayName").toLowerCase(Locale.ROOT).contains(like.toLowerCase(Locale.ROOT))
                        || s(u, "username").toLowerCase(Locale.ROOT).contains(like.toLowerCase(Locale.ROOT)))
                .toList();
    }

    // --------------------------------------------------------------------- //
    // Log author range (direct reports, never teammates)
    // --------------------------------------------------------------------- //

    public boolean isDirectReport(Actor a, String otherId) {
        if (otherId == null) return false;
        Map<String, Object> person = db.find("SELECT manager_id FROM users WHERE organization_id=? AND id=? AND active=1", a.organizationId(), otherId);
        return person != null && a.id().equals(s(person, "managerId"));
    }

    public boolean canReadLogAuthor(Actor a, String authorId) {
        if (authorId == null) return false;
        if (a.id().equals(authorId)) return true;
        if (a.administrator()) return false;
        return switch (a.scope("log_read")) {
            case "company" -> activeUser(a, authorId) != null;
            case "reports" -> isDirectReport(a, authorId);
            default -> false;
        };
    }

    /** Author ids the actor may read logs for, filtered by the dedicated log range. */
    public List<String> logAuthorIds(Actor a) {
        return db.list("SELECT id FROM users WHERE organization_id=? AND active=1 ORDER BY rank_level,display_name,id", a.organizationId())
                .stream().map(row -> s(row, "id")).filter(id -> canReadLogAuthor(a, id)).toList();
    }

    // --------------------------------------------------------------------- //
    // Profile range (direct-report directory only)
    // --------------------------------------------------------------------- //

    public boolean canSeePerson(Actor a, Map<String, Object> user) {
        if (!a.organizationId().equals(s(user, "organizationId"))) return false;
        String id = s(user, "id");
        if (a.id().equals(id)) return true;
        if (a.administrator()) return false;
        return switch (a.scope("profile_read")) {
            case "company" -> enabled(user);
            case "reports" -> isDirectReport(a, id);
            default -> false;
        };
    }

    public List<String> visibleUserIds(Actor a) {
        return db.list("SELECT * FROM users WHERE organization_id=? AND active=1", a.organizationId())
                .stream().filter(u -> canSeePerson(a, u)).map(u -> s(u, "id")).toList();
    }

    // --------------------------------------------------------------------- //
    // Handover and management capabilities
    // --------------------------------------------------------------------- //

    /** Handover is its own authority: one's own tasks, or a direct report's current task. */
    public boolean canHandover(Actor a, String sourceUserId, Collection<String> currentAssignees) {
        if (sourceUserId == null || currentAssignees == null || !currentAssignees.contains(sourceUserId)) return false;
        if (a.id().equals(sourceUserId)) return a.can("handover_own");
        return a.can("handover_reports") && isDirectReport(a, sourceUserId);
    }

    public void requireCapability(Actor a, String capability) {
        if (!a.can(capability)) throw new ApiException(403, "FORBIDDEN", "当前账号没有执行该操作的授权");
    }

    /** Administration console access: the administrator identity or an explicit organization grant. */
    public void requireAdmin(Actor a) {
        if (!a.administrator() && !a.can("manage_organization") && !a.can("manage_accounts")) {
            throw new ApiException(403, "FORBIDDEN", "需要管理端权限");
        }
    }

    // --------------------------------------------------------------------- //
    // Shared helpers
    // --------------------------------------------------------------------- //

    /** Active member lookup used by callers that only need presence. */
    public boolean activeMember(Actor a, String id) {
        return activeUser(a, id) != null;
    }

    public static boolean enabled(Map<String, Object> row) {
        Object value = row.get("active");
        return Boolean.TRUE.equals(value) || value instanceof Number number && number.intValue() == 1;
    }
}
