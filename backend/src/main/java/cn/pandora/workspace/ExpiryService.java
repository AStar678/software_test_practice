package cn.pandora.workspace;

import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

import static cn.pandora.common.Db.*;

/**
 * Applicable-deadline computation and the transactional pending-expiry terminal state
 * (DEV-012, DEV-013, DEV-016).
 *
 * Expiry is written exactly once against the pending row version. Every caller holds the organization
 * lock first, so an approval/withdrawal and the scan cannot both win. The caller decides whether to
 * return a business error after the transaction commits; this service never rolls back a terminal
 * state to produce an error.
 */
@Service
public class ExpiryService {
    private final Db db;
    private final Events events;
    private final ReminderService reminders;
    private final TransactionTemplate transaction;

    public ExpiryService(Db db, Events events, ReminderService reminders, PlatformTransactionManager tx) {
        this.db = db;
        this.events = events;
        this.reminders = reminders;
        this.transaction = new TransactionTemplate(tx);
    }

    /**
     * Committed expiry for a submission entry point. The command transaction that follows may reject a
     * stale page with 4xx, but the deadline terminal state (status, unfreeze, expiry/overdue events)
     * must survive that error, so it is written and committed in its own transaction first
     * (design §6, DEV-012). Call this only outside {@code Writes.run}.
     */
    public int expirePendingBeforeSubmit(String organizationId, String taskId, Instant now) {
        Integer expired = transaction.execute(status -> {
            db.one("SELECT * FROM organizations WHERE id=? FOR UPDATE", organizationId);
            return expirePendingForTask(organizationId, taskId, now);
        });
        return expired == null ? 0 : expired;
    }

    /**
     * Create, a schedule-changing modification and reopen use the proposed deadline; every other
     * request uses the effective deadline it was raised against (DEV-012).
     */
    public Instant applicableDeadline(String kind, Map<String, Object> base, Map<String, Object> proposed) {
        boolean proposedVersion = "create".equals(kind) || "reopen".equals(kind)
                || ("change".equals(kind) && scheduleChanged(base, proposed));
        Map<String, Object> source = proposedVersion || base == null ? proposed : base;
        return instant(source.get("dueAt"));
    }

    public static boolean scheduleChanged(Map<String, Object> base, Map<String, Object> proposed) {
        if (base == null || proposed == null) return true;
        for (String field : List.of("allDay", "startAt", "dueAt", "startDate", "dueDate")) {
            if (!Objects.equals(plain(base.get(field)), plain(proposed.get(field)))) return true;
        }
        return false;
    }

    /** Expire every pending request whose applicable deadline has been reached. */
    public int expirePending(String organizationId, Instant now) {
        int expired = 0;
        for (Map<String, Object> request : db.list("SELECT * FROM approval_requests WHERE organization_id=? "
                + "AND status='pending' AND applicable_deadline IS NOT NULL AND applicable_deadline<=? "
                + "ORDER BY created_at,id FOR UPDATE", organizationId, Timestamp.from(now))) {
            if (expire(organizationId, request, now, "applicable_deadline_reached")) expired++;
        }
        return expired;
    }

    /** Deadline check for one task's locked pending request, used by submission and decision paths. */
    public int expirePendingForTask(String organizationId, String taskId, Instant now) {
        Map<String, Object> request = db.find("SELECT * FROM approval_requests WHERE organization_id=? AND task_id=? "
                + "AND status='pending' FOR UPDATE", organizationId, taskId);
        if (request == null) return 0;
        Instant deadline = request.get("applicableDeadline") == null ? null : instant(request.get("applicableDeadline"));
        if (deadline == null || now.isBefore(deadline)) return 0;
        return expire(organizationId, request, now, "applicable_deadline_reached") ? 1 : 0;
    }

    /** Expire one locked request. Returns false when another terminal state already won. */
    public boolean expire(String organizationId, Map<String, Object> request, Instant now, String reason) {
        if (!"pending".equals(s(request, "status"))) return false;
        String requestId = s(request, "id");
        String taskId = s(request, "taskId");
        String proposedVersionId = s(request, "proposedVersionId");
        String kind = s(request, "kind");
        int changed = db.update("UPDATE approval_requests SET status='expired',expired_at=?,decided_at=?,"
                        + "decided_by=NULL,row_version=row_version+1 WHERE organization_id=? AND id=? AND status='pending' AND row_version=?",
                Timestamp.from(now), Timestamp.from(now), organizationId, requestId, n(request, "rowVersion"));
        if (changed != 1) return false;
        db.update("UPDATE task_versions SET status='expired',expired_at=? WHERE organization_id=? AND id=? AND status='proposed'",
                Timestamp.from(now), organizationId, proposedVersionId);
        db.update("INSERT INTO task_history_entries(id,organization_id,task_id,request_id,actor_id,entry_type,field_name,"
                        + "before_value,after_value,detail_json,occurred_at) VALUES(?,?,?,?,NULL,'request_expired','status',"
                        + "'pending','expired',?,?)",
                id(), organizationId, taskId, requestId,
                db.json(Map.of("reason", reason, "applicableDeadline",
                        Objects.toString(request.get("applicableDeadline"), ""),
                        "previousState", Objects.toString(request.get("previousState"), ""))),
                Timestamp.from(now));
        // The task row version changes because the freeze was released; the effective version and the
        // pre-submission execution state are untouched.
        db.update("UPDATE tasks SET row_version=row_version+1,updated_at=? WHERE organization_id=? AND id=?",
                Timestamp.from(now), organizationId, taskId);

        Map<String, Object> proposed = db.find("SELECT title FROM task_versions WHERE organization_id=? AND id=?",
                organizationId, proposedVersionId);
        String title = proposed == null ? "任务" : s(proposed, "title");
        LinkedHashSet<String> recipients = new LinkedHashSet<>();
        recipients.add(s(request, "applicantId"));
        recipients.add(s(request, "currentReviewerId"));
        recipients.remove(null);
        events.systemRecord(organizationId, taskId, "task." + kind + ".expired", recipients,
                Map.of("requestId", requestId, "kind", kind, "status", "expired", "reason", reason),
                requestId, proposedVersionId, s(request, "applicantId"), title,
                "任务《" + title + "》的" + kindLabel(kind) + "申请已到期失效，请调整后重提。", now);
        // A published, unfinished task that was frozen past its effective deadline gets its one
        // overdue notice now; an unpublished creation gets only the expiry/resubmit message.
        Map<String, Object> task = db.find("SELECT * FROM tasks WHERE organization_id=? AND id=?", organizationId, taskId);
        if (task != null && s(task, "currentVersionId") != null) reminders.ensureOverdueAfterExpiry(organizationId, taskId, now);
        return true;
    }

    public static String kindLabel(String kind) {
        return switch (kind == null ? "" : kind) {
            case "create" -> "创建";
            case "change" -> "修改";
            case "progress" -> "进展";
            case "complete" -> "完成";
            case "reopen" -> "重开";
            case "handover" -> "交接";
            default -> Objects.toString(kind, "");
        };
    }

    private static String plain(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    public static Instant instant(Object value) {
        if (value == null) return null;
        if (value instanceof Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof Instant instant) return instant;
        try {
            return Instant.parse(value.toString());
        } catch (RuntimeException exception) {
            throw new ApiException(409, "INVALID_DEADLINE", "任务截止时间无法解析");
        }
    }
}
