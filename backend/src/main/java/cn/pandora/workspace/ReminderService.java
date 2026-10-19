package cn.pandora.workspace;

import cn.pandora.common.Db;
import cn.pandora.common.Events;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

import static cn.pandora.common.Db.*;

/**
 * Proportional schedule reminders (DEV-014).
 *
 * The scan fires at the remaining 20%, 10% and 5% of the natural duration, plus one overdue notice.
 * A late scan backfills only the nearest reached node and records the earlier nodes as skipped, so a
 * restart or a suspended worker cannot send a burst of stale reminders. The ledger key is
 * task + recipient + execution round + effective schedule version + node.
 */
@Service
public class ReminderService {
    private static final int[] NODES = {20, 10, 5};
    private final Db db;
    private final Events events;

    public ReminderService(Db db, Events events) {
        this.db = db;
        this.events = events;
    }

    public int createReminders(String organizationId, Instant now) {
        int created = 0;
        for (Map<String, Object> task : db.list("SELECT t.*,v.title,v.start_at,v.due_at,v.priority FROM tasks t "
                + "JOIN task_versions v ON v.organization_id=t.organization_id AND v.id=t.current_version_id "
                + "WHERE t.organization_id=? AND t.current_version_id IS NOT NULL AND t.execution_state<>'done' "
                + "AND NOT EXISTS (SELECT 1 FROM approval_requests a WHERE a.organization_id=t.organization_id "
                + "AND a.task_id=t.id AND a.status='pending') ORDER BY v.due_at,t.id", organizationId)) {
            created += remindTask(organizationId, task, now, null);
        }
        return created;
    }

    /**
     * Expiry backfill: a published, still-unfinished task that has passed its effective deadline gets
     * one overdue notice when the pending request releases the freeze. The caller already holds the
     * organization lock and has re-read the task state after the expiry write.
     */
    public int ensureOverdueAfterExpiry(String organizationId, String taskId, Instant now) {
        Map<String, Object> task = db.find("SELECT t.*,v.title,v.start_at,v.due_at FROM tasks t "
                + "JOIN task_versions v ON v.organization_id=t.organization_id AND v.id=t.current_version_id "
                + "WHERE t.organization_id=? AND t.id=? AND t.current_version_id IS NOT NULL", organizationId, taskId);
        if (task == null || "done".equals(s(task, "executionState"))) return 0;
        Instant due = instant(task.get("dueAt"));
        if (due == null || !now.isAfter(due)) return 0;
        return remindTask(organizationId, task, now, "expiry_unfreeze");
    }

    private int remindTask(String organizationId, Map<String, Object> task, Instant now, String source) {
        String taskId = s(task, "id");
        Instant start = instant(task.get("startAt"));
        Instant due = instant(task.get("dueAt"));
        if (start == null || due == null) return 0;
        String title = s(task, "title");
        long scheduleVersion = task.get("scheduleVersion") == null ? 1 : n(task, "scheduleVersion");
        long round = task.get("executionRound") == null ? 1 : n(task, "executionRound");

        LinkedHashSet<String> recipients = new LinkedHashSet<>();
        recipients.add(s(task, "originalCreatorId"));
        for (Map<String, Object> row : db.list("SELECT user_id FROM task_version_assignees WHERE organization_id=? AND version_id=? ORDER BY ordinal,user_id",
                organizationId, s(task, "currentVersionId"))) {
            recipients.add(s(row, "userId"));
        }
        recipients.removeIf(id -> id == null || activeActor(organizationId, id) == null);

        int created = 0;
        for (String recipient : recipients) {
            Node chosen = chooseNode(start, due, now);
            if (chosen == null) continue;
            List<Integer> stale = chosen.stale();
            for (Integer node : stale) record(organizationId, taskId, recipient, round, scheduleVersion, String.valueOf(node),
                    "skipped", null, "晚扫描：该节点已过，记录为跳过");
            String node = chosen.node();
            if (node == null) continue;
            String detail = "expiry_unfreeze".equals(source) ? source : "scheduled_rule";
            String receiptId = record(organizationId, taskId, recipient, round, scheduleVersion, node, "sent", null, detail);
            if (receiptId == null) continue;
            String type = "overdue".equals(node) ? "task.overdue" : "task.reminder_" + node;
            String summary = "overdue".equals(node)
                    ? "任务《" + title + "》已超过截止时间，请查看当前安排。"
                    : "任务《" + title + "》剩余工期 " + node + "%，请查看当前安排。";
            String eventId = events.scheduled(organizationId, taskId, type, recipient,
                    Map.of("origin", detail, "node", node, "scheduleVersion", scheduleVersion,
                            "executionRound", round, "reminderId", receiptId, "actualScheduledAt", chosen.at().toString()),
                    title, summary);
            db.update("UPDATE reminder_receipts SET event_id=? WHERE id=?", eventId, receiptId);
            created++;
        }
        return created;
    }

    /**
     * Choose the single node a scan should send. When several nodes were crossed while the worker was
     * down, only the latest is sent and every earlier reached node becomes a skip record.
     */
    static Node chooseNode(Instant start, Instant due, Instant now) {
        Duration total = Duration.between(start, due);
        if (now.isAfter(due)) {
            return new Node("overdue", due, List.of(20, 10, 5));
        }
        if (total.isNegative() || total.isZero()) return null;
        long millis = total.toMillis();
        Instant at20 = due.minusMillis(millis * 20 / 100);
        Instant at10 = due.minusMillis(millis * 10 / 100);
        Instant at5 = due.minusMillis(millis * 5 / 100);
        List<Node> reached = new ArrayList<>();
        if (!now.isBefore(at20)) reached.add(new Node("20", at20, List.of()));
        if (!now.isBefore(at10)) reached.add(new Node("10", at10, List.of(20)));
        if (!now.isBefore(at5)) reached.add(new Node("5", at5, List.of(20, 10)));
        if (reached.isEmpty()) return null;
        // The last reached node is the only one that may still be sent.
        return reached.getLast();
    }

    /**
     * Insert the ledger row. Returns the receipt id when this call created a 'sent' row, or null when
     * an earlier scan already decided this exact node.
     */
    private String record(String organizationId, String taskId, String recipient, long round,
                          long scheduleVersion, String node, String state, String eventId, String detail) {
        String key = hash(organizationId + ":" + taskId + ":" + recipient + ":" + round + ":" + scheduleVersion + ":" + node);
        String receiptId = id();
        int inserted = db.update("INSERT IGNORE INTO reminder_receipts(id,organization_id,task_id,recipient_id,dedupe_key,node,state,schedule_version,execution_round,event_id,detail) "
                        + "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                receiptId, organizationId, taskId, recipient, key, node, state, scheduleVersion, round, eventId, detail);
        return inserted == 1 && "sent".equals(state) ? receiptId : null;
    }

    private Map<String, Object> activeActor(String organizationId, String userId) {
        return db.find("SELECT id FROM users WHERE organization_id=? AND id=? AND active=1 AND role<>'admin'", organizationId, userId);
    }

    static Instant instant(Object value) {
        if (value == null) return null;
        if (value instanceof Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof Instant instant) return instant;
        try {
            return Instant.parse(value.toString());
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    /** A selected reminder node and the reached nodes that must be recorded as skipped. */
    record Node(String node, Instant at, List<Integer> stale) {
    }
}
