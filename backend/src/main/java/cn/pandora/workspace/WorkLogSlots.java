package cn.pandora.workspace;

import cn.pandora.common.Db;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.Objects;

import static cn.pandora.common.Db.s;

/**
 * Rebuilds the per-author/per-day log position for logs that earlier code physically deleted
 * (chapter 1.2).
 *
 * The previous version removed the row outright, so only recorded events can prove the slot existed.
 * A {@code log.deleted} event carries the log id, and the matching {@code log.created} event carries
 * the same id, its initiator (the author) and the real creation instant. Because the old write rule
 * only accepted the company's current day, the business date is the company-local date of that
 * creation instant — this is a derived fact, not an invented one.
 *
 * The reconstruction writes a row that keeps its real first-creation time, has an empty body and is
 * marked deleted, so it can never be read as content. A later same-day write restores the position by
 * filling the body and clearing {@code deleted_at} instead of starting a new freeze window. Anything
 * that cannot be proven (missing creation event, unknown author, damaged organization zone) is left
 * alone and recorded as an explicit migration finding, and an already occupied day is never touched.
 */
@Component
@Order(WorkLogSlots.ORDER)
public class WorkLogSlots implements ApplicationRunner {
    /** After the seed (0) and the organization constraints, on every start; the work is idempotent. */
    public static final int ORDER = 20;
    private final Db db;
    private final TransactionTemplate tx;

    public WorkLogSlots(Db db, TransactionTemplate tx) {
        this.db = db;
        this.tx = tx;
    }

    @Override
    public void run(ApplicationArguments args) {
        tx.executeWithoutResult(status -> {
            for (Map<String, Object> organization : db.list("SELECT id,time_zone FROM organizations ORDER BY id")) {
                String organizationId = s(organization, "id");
                ZoneId zone;
                try {
                    zone = ZoneId.of(s(organization, "timeZone"));
                } catch (RuntimeException invalidZone) {
                    // Without a trustworthy zone the business date cannot be derived, so nothing is written.
                    finding(organizationId, "work_log_slot_zone_invalid", "blocker", organizationId,
                            "组织时区无效，无法依据日志创建事件还原业务日位置；未写入任何还原记录。");
                    continue;
                }
                for (Map<String, Object> deleted : db.list(
                        "SELECT * FROM domain_events WHERE organization_id=? AND event_type='log.deleted' ORDER BY occurred_at,id",
                        organizationId)) {
                    String logId = logId(deleted);
                    if (logId == null) continue;
                    if (db.find("SELECT 1 FROM work_logs WHERE organization_id=? AND id=?", organizationId, logId) != null) continue;
                    Map<String, Object> created = db.find(
                            "SELECT * FROM domain_events WHERE organization_id=? AND event_type='log.created' "
                                    + "AND JSON_UNQUOTE(JSON_EXTRACT(details_json,'$.logId'))=? ORDER BY occurred_at,id LIMIT 1",
                            organizationId, logId);
                    // Older rows never filled the event initiator, but the human audit trail always
                    // recorded the same log id with the acting account, so the author stays provable.
                    Map<String, Object> audit = db.find(
                            "SELECT actor_id,created_at FROM audit_logs WHERE organization_id=? AND action='log.created' "
                                    + "AND JSON_UNQUOTE(JSON_EXTRACT(details_json,'$.logId'))=? ORDER BY created_at,id LIMIT 1",
                            organizationId, logId);
                    String authorId = created == null ? null : s(created, "initiatorId");
                    if (authorId == null && audit != null) authorId = s(audit, "actorId");
                    String createdAtText = created != null ? s(created, "occurredAt")
                            : audit != null ? s(audit, "createdAt") : null;
                    if (authorId == null || createdAtText == null) {
                        finding(organizationId, "work_log_slot_unprovable", "limitation", logId,
                                "日志删除事件缺少可证明的创建事件或作者，未还原业务日位置，也不会因此编造历史。");
                        continue;
                    }
                    Instant createdAt;
                    Instant deletedAt;
                    try {
                        createdAt = Instant.parse(createdAtText);
                        deletedAt = Instant.parse(Objects.toString(deleted.get("occurredAt"), createdAtText));
                    } catch (RuntimeException unreadable) {
                        finding(organizationId, "work_log_slot_unprovable", "limitation", logId,
                                "日志事件时间无法解析，未还原业务日位置。");
                        continue;
                    }
                    LocalDate businessDate = createdAt.atZone(zone).toLocalDate();
                    Map<String, Object> occupied = db.find(
                            "SELECT id FROM work_logs WHERE organization_id=? AND author_id=? AND business_date=?",
                            organizationId, authorId, Date.valueOf(businessDate));
                    if (occupied != null) {
                        // Another row already holds the day (for example a later recreate). The slot is
                        // still protected, so the historic delete is recorded without touching the day.
                        finding(organizationId, "work_log_slot_already_occupied", "limitation", logId,
                                "该业务日已有日志行占用，历史删除事件只登记不覆盖，未改写任何已有创建时间。");
                        continue;
                    }
                    db.update("INSERT INTO work_logs(id,organization_id,author_id,business_date,body,task_id,row_version,created_at,updated_at,deleted_at,recovered_from) "
                                    + "VALUES(?,?,?,?,'',NULL,1,?,?,?,'deleted-event')",
                            logId, organizationId, authorId, Date.valueOf(businessDate),
                            Timestamp.from(createdAt), Timestamp.from(deletedAt), Timestamp.from(deletedAt));
                    finding(organizationId, "work_log_slot_recovered", "limitation", logId,
                            "依据可证明的日志创建事件还原了被物理删除的日志日位置：保留原首次创建时间，正文为空且已标记删除。");
                }
            }
        });
    }

    private String logId(Map<String, Object> event) {
        Object raw = event.get("detailsJson");
        if (raw == null) return null;
        String text = String.valueOf(raw);
        // Stored as JSON; parse through the shared helper so a non-object payload cannot throw.
        try {
            Object value = db.parse(text).get("logId");
            return value == null ? null : String.valueOf(value);
        } catch (RuntimeException unreadable) {
            return null;
        }
    }

    /** One durable finding per subject and category so a restart cannot duplicate the same note. */
    private void finding(String organizationId, String category, String severity, String subject, String detail) {
        if (db.find("SELECT 1 FROM migration_findings WHERE organization_id=? AND migration='V16' AND category=? AND subject<=>?",
                organizationId, category, subject) != null) return;
        db.update("INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail) VALUES(?,?,?,?,?,?,?)",
                Db.id(), organizationId, "V16", category, severity, subject, detail);
    }
}
