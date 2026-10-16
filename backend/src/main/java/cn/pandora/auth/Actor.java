package cn.pandora.auth;

import java.util.Map;
import java.util.Set;

/**
 * Authenticated identity snapshot (DEV-002, DEV-005).
 *
 * Authority is carried explicitly: {@code capabilities} are the granted actions and {@code scopes}
 * map an authority area (task_view, task_dispatch, log_read, profile_read) to a range
 * (self, reports, department, company). The legacy {@code role} column is kept only because the
 * prototype pages still read it for labels; it is never used to decide access, so a team lead or an
 * administrator does not gain business authority by name.
 *
 * {@code authzVersion} is the organization authorization version at the time the session was built.
 * A write compares its own snapshot with the freshly read one, so an organization change invalidates
 * an in-flight form, a stale candidate list and a replayed idempotent request.
 */
public record Actor(
        String id,
        String organizationId,
        String role,
        String teamId,
        String managerId,
        int rank,
        String departmentId,
        String positionId,
        Set<String> capabilities,
        Map<String, String> scopes,
        long authzVersion,
        boolean reviewerAvailable,
        boolean mustChangePassword,
        long credentialVersion) {

    /** Compatibility constructor for callers that only know the legacy identity columns. */
    public Actor(String id, String organizationId, String role, String teamId, String managerId, int rank) {
        this(id, organizationId, role, teamId, managerId, rank, null, null,
                Set.of(), Map.of(), 1L, true, false, 1L);
    }

    public boolean administrator() { return "admin".equals(role); }

    public boolean business() { return !administrator(); }

    public boolean can(String capability) {
        return capabilities != null && capabilities.contains(capability);
    }

    /** Range configured for one authority area; defaults to the narrowest range. */
    public String scope(String area) {
        return scopes == null ? "self" : scopes.getOrDefault(area, "self");
    }

    /** Same identity and authority, but with the legacy role label replaced (used by the seed/tests). */
    public Actor withRole(String replacement) {
        return new Actor(id, organizationId, replacement, teamId, managerId, rank, departmentId, positionId,
                capabilities, scopes, authzVersion, reviewerAvailable, mustChangePassword, credentialVersion);
    }
}
