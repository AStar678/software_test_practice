package cn.pandora.admin;

import cn.pandora.common.Db;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import static cn.pandora.common.Db.n;

/**
 * Completes the staged employee login-key migration (V19) once the data is actually repairable.
 *
 * V19 deliberately withholds {@code uq_users_login_phone} while normalized numbers are missing or
 * duplicated, and never invents a number or an account. The administrator repairs those records
 * through the normal employee flow. This guard then re-applies the unique index and closes the V19
 * findings, so the database no longer stays permanently in the staged state. It is idempotent and
 * only ever tightens; it never writes an employee's phone or identity.
 */
@Component
@Order(LoginKeyConstraints.ORDER)
public class LoginKeyConstraints implements ApplicationRunner {
    /** After DemoSeed (0) and OrganizationConstraints (100). */
    public static final int ORDER = 120;

    private static final Logger log = LoggerFactory.getLogger(LoginKeyConstraints.class);

    @Value("${pandora.startup-maintenance-enabled:true}")
    private boolean startupMaintenanceEnabled = true;
    private final Db db;

    public LoginKeyConstraints(Db db) {
        this.db = db;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!startupMaintenanceEnabled) return;
        try {
            if (tighten()) {
                log.info("Employee login-key uniqueness is established; duplicate V19 blockers resolved");
            } else {
                log.info("Employee login-key uniqueness stays staged: duplicate normalized numbers remain; "
                        + "log-in rejects ambiguous keys and the administrator repairs them");
            }
        } catch (RuntimeException e) {
            // Never block startup on the staged unique index; the login path also fails closed.
            log.warn("Employee login-key constraint tightening skipped: {}", e.getMessage());
        }
    }

    /**
     * Adds the unique key once no normalized duplicate remains, then resolves the matching V19
     * findings. Missing keys do not block the index: MySQL unique keys allow several NULLs, and the
     * login path still refuses a missing key. A missing-key finding is resolved only when every active
     * employee has a number; duplicate/unique findings no longer depend on that. Returns true when the
     * unique index is present afterwards.
     */
    public boolean tighten() {
        long missing = n(db.one("SELECT COUNT(*) AS c FROM users "
                + "WHERE active=1 AND (login_phone IS NULL OR login_phone='')"), "c");
        long duplicates = n(db.one("SELECT COUNT(*) AS c FROM ("
                + "SELECT login_phone FROM users WHERE login_phone IS NOT NULL AND login_phone<>'' "
                + "GROUP BY login_phone HAVING COUNT(*)>1) x"), "c");
        if (duplicates > 0) return false;
        if (!indexPresent()) db.jdbc.execute("ALTER TABLE users ADD UNIQUE KEY uq_users_login_phone (login_phone)");
        db.update("UPDATE migration_findings SET resolved_at=UTC_TIMESTAMP(6) "
                + "WHERE migration='V19' AND resolved_at IS NULL AND category IN "
                + "('employee_login_phone_duplicate','employee_login_phone_unique')");
        if (missing == 0) {
            db.update("UPDATE migration_findings SET resolved_at=UTC_TIMESTAMP(6) "
                    + "WHERE migration='V19' AND resolved_at IS NULL AND category='employee_login_phone_missing'");
        }
        return true;
    }

    private boolean indexPresent() {
        return db.find("SELECT 1 FROM information_schema.statistics "
                + "WHERE table_schema=DATABASE() AND table_name='users' "
                + "AND index_name='uq_users_login_phone' LIMIT 1") != null;
    }
}
