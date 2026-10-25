package cn.pandora.auth;

import cn.pandora.common.Db;
import org.springframework.stereotype.Component;

import java.util.*;

import static cn.pandora.common.Db.*;

/**
 * The company employee manager graph and its proven single root.
 *
 * Administrator accounts are not employee nodes, so an administrator can never become the founder by
 * identity. Only a fully valid tree (no dangling manager reference, no cycle, exactly one root) names
 * a founder; the same check therefore governs creation routing and tag-catalogue maintenance, and an
 * organization-data defect blocks both instead of silently granting either.
 */
@Component
public class CompanyTree {
    private final Db db;

    public CompanyTree(Db db) { this.db = db; }

    public record Tree(Map<String, Map<String, Object>> nodes, List<String> roots,
                       Set<String> dangling, Set<String> cyclic, String founderId, boolean valid) {}

    public Tree of(String organizationId) {
        Map<String, Map<String, Object>> nodes = new LinkedHashMap<>();
        for (Map<String, Object> row : db.list("SELECT id,role,active,manager_id FROM users WHERE organization_id=? ORDER BY id",
                organizationId)) {
            if (active(row) && !"admin".equals(s(row, "role"))) nodes.put(s(row, "id"), row);
        }
        List<String> roots = new ArrayList<>();
        Set<String> dangling = new LinkedHashSet<>();
        Set<String> cyclic = new LinkedHashSet<>();
        for (Map<String, Object> node : nodes.values()) {
            String managerId = s(node, "managerId");
            if (managerId == null) roots.add(s(node, "id"));
            else if (!nodes.containsKey(managerId)) dangling.add(s(node, "id"));
        }
        Map<String, Integer> state = new HashMap<>();
        for (String start : nodes.keySet()) {
            List<String> path = new ArrayList<>();
            String cursor = start;
            while (cursor != null && nodes.containsKey(cursor)) {
                Integer seen = state.get(cursor);
                if (seen != null && seen == 1) {
                    cyclic.addAll(path.subList(path.indexOf(cursor), path.size()));
                    break;
                }
                if (seen != null && seen == 2) break;
                state.put(cursor, 1);
                path.add(cursor);
                cursor = s(nodes.get(cursor), "managerId");
            }
            for (String node : path) state.put(node, 2);
        }
        boolean valid = dangling.isEmpty() && cyclic.isEmpty() && roots.size() == 1;
        return new Tree(nodes, roots, dangling, cyclic, valid ? roots.getFirst() : null, valid);
    }

    /** The unique, provable founder of the company's employee tree, or null when the data is broken. */
    public String founderId(String organizationId) {
        Tree tree = of(organizationId);
        return tree.valid() ? tree.founderId() : null;
    }

    public boolean isFounder(Actor actor) {
        return actor.id().equals(founderId(actor.organizationId()));
    }

    private static boolean active(Map<String, Object> row) {
        Object value = row.get("active");
        return Boolean.TRUE.equals(value) || value instanceof Number number && number.intValue() == 1;
    }
}
