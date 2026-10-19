package cn.pandora.common;

import cn.pandora.auth.Actor;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.*;

import static cn.pandora.common.Db.id;
import static cn.pandora.common.Db.s;

/**
 * Durable domain events with their own provenance and retention (DEV-030—033).
 *
 * Every business event persists the originating request/version, its initiator, the task title, the
 * actual change summary, the occurrence instant and the pre-computed retention instant. Message
 * copies are created later by the worker from this record only; nothing is reconstructed from the
 * task's current state at delivery time.
 */
@Component
public class Events {
    private static final int SUMMARY_LIMIT = 1000;
    private final Db db;
    private final Clock clock;

    public Events(Db db, Clock clock) {
        this.db = db;
        this.clock = clock;
    }

    public void record(Actor actor, String taskId, String type, Collection<String> recipients, Map<String, Object> details) {
        record(actor, taskId, type, recipients, details, null, null, null, null);
    }

    public void record(Actor actor, String taskId, String type, Collection<String> recipients, Map<String, Object> details,
                       String requestId, String versionId, String title, String summary) {
        Instant occurredAt = clock.instant();
        db.update("INSERT INTO audit_logs(id,organization_id,actor_id,object_id,action,details_json) VALUES(?,?,?,?,?,?)",
                id(), actor.organizationId(), actor.id(), taskId, type, db.json(details == null ? Map.of() : details));
        insert(actor.organizationId(), taskId, type, recipients, details, requestId, versionId, actor.id(), title, summary, occurredAt);
    }

    /**
     * Scheduled reminders and overdue backfills have no human initiator. They are deliberately not
     * written to the human audit trail but keep the same event provenance and retention.
     */
    public String scheduled(String organizationId, String taskId, String type, String recipient,
                            Map<String, Object> details, String title, String summary) {
        return insert(organizationId, taskId, type, List.of(recipient), details, null, null, null, title, summary, clock.instant());
    }

    /**
     * A domain event produced by the deadline scan rather than a human command. It carries the
     * originating request/version so the resulting message keeps its original-application binding,
     * but it is not attributed to a person in the audit trail.
     */
    public void systemRecord(String organizationId, String taskId, String type, Collection<String> recipients,
                             Map<String, Object> details, String requestId, String versionId,
                             String initiatorId, String title, String summary, Instant occurredAt) {
        insert(organizationId, taskId, type, recipients, details, requestId, versionId, initiatorId, title, summary, occurredAt);
    }

    private String insert(String organizationId, String taskId, String type, Collection<String> recipients,
                        Map<String, Object> details, String requestId, String versionId, String initiatorId,
                        String title, String summary, Instant occurredAt) {
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        if (recipients != null) for (String recipient : recipients) if (recipient != null && !recipient.isBlank()) unique.add(recipient);
        Map<String, Object> payload = details == null ? new LinkedHashMap<>() : new LinkedHashMap<>(details);
        String eventId = id();
        db.update("INSERT INTO domain_events(id,organization_id,task_id,event_type,recipients_json,details_json,status,"
                        + "request_id,task_version_id,initiator_id,title,change_summary,occurred_at,expires_at) "
                        + "VALUES(?,?,?,?,?,?,'pending',?,?,?,?,?,?,?)",
                eventId, organizationId, taskId, type, db.json(unique), db.json(payload),
                requestId, versionId, initiatorId, truncate(title, 200), truncate(summary, SUMMARY_LIMIT),
                Timestamp.from(occurredAt), Timestamp.from(retentionEndsAt(organizationId, occurredAt)));
        return eventId;
    }

    /** Three company-local calendar months, truncated to the target month's last day. */
    public Instant retentionEndsAt(String organizationId, Instant occurredAt) {
        return retentionEndsAt(occurredAt, organizationZone(organizationId));
    }

    /** Pure calendar-month rule, exposed for boundary tests. */
    public static Instant retentionEndsAt(Instant occurredAt, ZoneId zone) {
        return occurredAt.atZone(zone).plusMonths(3).toInstant();
    }

    public ZoneId organizationZone(String organizationId) {
        Map<String, Object> organization = db.find("SELECT time_zone FROM organizations WHERE id=?", organizationId);
        if (organization == null) throw new ApiException(409, "INVALID_ORGANIZATION", "组织不存在或已失效");
        try {
            return ZoneId.of(s(organization, "timeZone"));
        } catch (RuntimeException exception) {
            throw new ApiException(409, "INVALID_ORGANIZATION_ZONE", "组织时区配置无效");
        }
    }

    private static String truncate(String value, int limit) {
        if (value == null) return null;
        return value.length() <= limit ? value : value.substring(0, limit);
    }
}
