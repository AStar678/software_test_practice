package cn.pandora.auth;

import java.util.Map;
import java.util.Set;

/** Current principal identity. Employee role/rank/scopes are derived from the fixed placement.
 * authzVersion fences stale requests; administrators have no employee placement.
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
        long credentialVersion,
        String accountType) {

    public Actor(String id, String organizationId, String role, String teamId, String managerId, int rank,
                 String departmentId, String positionId, Set<String> capabilities, Map<String,String> scopes,
                 long authzVersion, boolean reviewerAvailable, boolean mustChangePassword, long credentialVersion) {
        this(id, organizationId, role, teamId, managerId, rank, departmentId, positionId, capabilities,
                scopes, authzVersion, reviewerAvailable, mustChangePassword, credentialVersion,
                "admin".equals(role) ? "admin" : "employee");
    }

    /** Convenience constructor for fixed-identity unit tests. */
    public Actor(String id, String organizationId, String role, String teamId, String managerId, int rank) {
        this(id, organizationId, role, teamId, managerId, rank, null, null,
                Set.of(), Map.of(), 1L, true, false, 1L);
    }

    public boolean administrator() { return "admin".equals(accountType); }

    public boolean business() { return !administrator(); }

    public boolean can(String capability) {
        return capabilities != null && capabilities.contains(capability);
    }

    /** Derived range for one authority area; defaults to the narrowest range. */
    public String scope(String area) {
        return scopes == null ? "self" : scopes.getOrDefault(area, "self");
    }

    /** Same identity and authority, but with the legacy role label replaced (used by the seed/tests). */
    public Actor withRole(String replacement) {
        return new Actor(id, organizationId, replacement, teamId, managerId, rank, departmentId, positionId,
                capabilities, scopes, authzVersion, reviewerAvailable, mustChangePassword, credentialVersion, accountType);
    }
}
