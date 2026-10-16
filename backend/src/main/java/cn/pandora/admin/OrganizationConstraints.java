package cn.pandora.admin;

import cn.pandora.common.Db;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

import static cn.pandora.common.Db.n;

/**
 * Second stage of the staged organization migration (task 1.2 / DEV-001..002).
 *
 * V5 adds the department/position columns as nullable and records a blocker while any account is
 * unmapped, because inventing a department from a legacy team name would be fabricating history.
 * This component applies the demand of the "Organization and administration" requirement — employee
 * department and position are required — as soon as the data actually satisfies it, and it is
 * idempotent so it also runs after an administrator completes the mapping through the admin flow.
 *
 * It only ever tightens; it never loosens a constraint, and it never writes business data.
 */
@Component
@Order(OrganizationConstraints.ORDER)
public class OrganizationConstraints implements ApplicationRunner {
    /** After DemoSeed (order 0) so a freshly seeded empty database is already mapped. */
    public static final int ORDER = 100;

    private static final Logger log = LoggerFactory.getLogger(OrganizationConstraints.class);

    private final Db db;

    public OrganizationConstraints(Db db) { this.db = db; }

    @Override
    public void run(ApplicationArguments args) {
        try {
            Map<String, Object> status = status();
            log.info("Organization constraint guard: usersMissingDepartment={} usersMissingPosition={} "
                    + "teamsMissingDepartment={} tighteningApplied={} openBlockers={}",
                status.get("usersMissingDepartment"), status.get("usersMissingPosition"),
                status.get("teamsMissingDepartment"), status.get("tighteningApplied"),
                status.get("openBlockers"));
            if (Boolean.TRUE.equals(status.get("tighteningApplied"))) return;
            if (n(status, "usersMissingDepartment") > 0 || n(status, "usersMissingPosition") > 0
                    || n(status, "teamsMissingDepartment") > 0) {
                log.info("Organization mapping incomplete ({} users, {} teams); department/position stay "
                        + "nullable until an administrator resolves it: {}",
                    n(status, "usersMissingDepartment"), n(status, "teamsMissingDepartment"),
                    status.get("blockers"));
                return;
            }
            if (tryTighten()) log.info("Organization constraints tightened to NOT NULL after a complete mapping");
        } catch (RuntimeException e) {
            // Never block startup on the second migration stage; the schema stays staged and reported.
            log.warn("Organization constraint tightening skipped: {}", e.getMessage());
        }
    }

    public Map<String, Object> status() {
        Map<String, Object> result = new LinkedHashMap<>();
        long usersMissingDepartment = n(db.one(
            "SELECT COUNT(*) AS c FROM users WHERE department_id IS NULL"), "c");
        long usersMissingPosition = n(db.one(
            "SELECT COUNT(*) AS c FROM users WHERE position_id IS NULL"), "c");
        long teamsMissingDepartment = n(db.one(
            "SELECT COUNT(*) AS c FROM teams WHERE department_id IS NULL"), "c");
        boolean nullable = isNullable("users", "department_id") || isNullable("teams", "department_id");
        result.put("usersMissingDepartment", usersMissingDepartment);
        result.put("usersMissingPosition", usersMissingPosition);
        result.put("teamsMissingDepartment", teamsMissingDepartment);
        result.put("tighteningApplied", !nullable);
        result.put("openBlockers", db.list(
            "SELECT category,subject,detail FROM migration_findings "
            + "WHERE severity='blocker' AND resolved_at IS NULL ORDER BY category,subject"));
        return result;
    }

    /** Applies NOT NULL only when nothing would violate it. Returns true when it did apply. */
    public boolean tryTighten() {
        Map<String, Object> current = status();
        if (Boolean.TRUE.equals(current.get("tighteningApplied"))) return false;
        if (n(current, "usersMissingDepartment") > 0 || n(current, "usersMissingPosition") > 0
                || n(current, "teamsMissingDepartment") > 0) return false;
        if (isNullable("users", "department_id")) {
            db.jdbc.execute("ALTER TABLE users MODIFY department_id VARCHAR(36) NOT NULL, "
                + "MODIFY position_id VARCHAR(36) NOT NULL");
        }
        if (isNullable("teams", "department_id")) {
            db.jdbc.execute("ALTER TABLE teams MODIFY department_id VARCHAR(36) NOT NULL");
        }
        db.update("UPDATE migration_findings SET resolved_at=UTC_TIMESTAMP(6) "
            + "WHERE migration='V5' AND resolved_at IS NULL "
            + "AND category IN ('organization_mapping','team_department_mapping')");
        return true;
    }

    private boolean isNullable(String table, String column) {
        // Explicit alias: MySQL echoes information_schema labels as IS_NULLABLE and Db.camel only
        // upper-cases the character after '_', so the declared label cannot be looked up directly.
        Map<String, Object> row = db.find(
            "SELECT is_nullable AS nullable FROM information_schema.columns "
            + "WHERE table_schema=DATABASE() AND table_name=? AND column_name=?", table, column);
        return row != null && "YES".equalsIgnoreCase(Db.s(row, "nullable"));
    }
}
