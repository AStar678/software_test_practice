package cn.pandora.task;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Map;

import static cn.pandora.common.Db.s;

/**
 * Applies operator-manager routing to requests that were already pending when this version was
 * deployed (chapter 3.4). It only looks at requests whose stored route still carries a legacy reason,
 * so normal restarts and freshly created requests are never recomputed.
 *
 * <p>The work is idempotent: after the first run every affected request either has a new-rule route or
 * is blocked, and the second run finds nothing to change.
 */
@Component
@Order(LegacyCreationRoutes.ORDER)
public class LegacyCreationRoutes implements ApplicationRunner {
    /** After the seed, the organization constraints and the log-slot backfill. */
    public static final int ORDER = 30;
    @Value("${pandora.startup-maintenance-enabled:true}")
    private boolean startupMaintenanceEnabled = true;
    private final Db db;
    private final Access access;
    private final TaskService tasks;
    private final TransactionTemplate tx;

    public LegacyCreationRoutes(Db db, Access access, TaskService tasks, TransactionTemplate tx) {
        this.db = db;
        this.access = access;
        this.tasks = tasks;
        this.tx = tx;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!startupMaintenanceEnabled) return;
        // Most starts have no legacy work. Do not serialize them behind business writes or another instance.
        for (Map<String, Object> organization : db.list("SELECT DISTINCT organization_id AS id FROM approval_requests WHERE "
                + TaskService.LEGACY_CREATION_ROUTES + " ORDER BY organization_id")) {
            String organizationId = s(organization, "id");
            // The administrator identity performs the same maintenance the console would; it grants no
            // business authority, and only the route metadata is rewritten.
            try {
                tx.executeWithoutResult(status -> {
                    db.one("SELECT * FROM organizations WHERE id=? FOR UPDATE",organizationId);
                    Map<String,Object> admin=db.find("SELECT a.*,'admin' AS account_type FROM admin_accounts a JOIN principals p ON p.organization_id=a.organization_id AND p.id=a.id AND p.account_type='admin' WHERE a.organization_id=? AND a.active=1 AND p.active=1",organizationId);
                    if(admin!=null) tasks.refreshLegacyCreationRoutes(access.actor(admin));
                });
            } catch (ApiException blocked) {
                // A damaged organization must not stop the application from starting; the pending
                // requests stay blocked and the repair is recorded for the administrator.
                if (db.find("SELECT 1 FROM migration_findings WHERE organization_id=? AND migration='V28' "
                        + "AND category='legacy_creation_route_refresh'", organizationId) == null) {
                    db.update("INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail) "
                                    + "VALUES(?,?,?,?,?,?,?)",
                            Db.id(), organizationId, "V28", "legacy_creation_route_refresh", "limitation", null,
                            "存量待审申请未能按操作者直属上级重算：" + blocked.getMessage() + "；申请保持阻断，需管理员修复组织关系。");
                }
            }
        }
    }
}
