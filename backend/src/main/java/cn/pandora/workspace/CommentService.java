package cn.pandora.workspace;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import cn.pandora.common.Writes;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Clock;
import java.util.*;

import static cn.pandora.common.Db.*;

/**
 * Flat comments on tasks and logs (chapters 8.4—8.6).
 *
 * A comment belongs to exactly one task or one log; there is no reply level, no parent field and no
 * separate review. Every read and write re-runs the object's own current authority, and the author
 * must still hold that authority to edit or delete. A comment never changes a task version, a log body
 * or a freeze instant, so a frozen log or a task pending review does not lock its comment area.
 *
 * Publication order is (created_at, id), which is stable across paging and never changes on edit.
 */
@Service
public class CommentService {
    public static final int MAX_BODY = 10000;
    private static final Set<String> OBJECT_TYPES = Set.of("task", "log");
    private final Db db;
    private final Access access;
    private final WorkspaceService workspace;
    private final Events events;
    private final Clock clock;

    public CommentService(Db db, Access access, WorkspaceService workspace, Events events, Clock clock) {
        this.db = db; this.access = access; this.workspace = workspace; this.events = events; this.clock = clock;
    }

    public Map<String, Object> list(Actor a, String objectType, String objectId, Map<String, String> filters) {
        business(a);
        CommentedObject object = requireObject(a, objectType, objectId);
        int limit = number(filters, "limit", 20, 1, 100);
        int offset = number(filters, "offset", 0, 0, Integer.MAX_VALUE);
        List<Map<String, Object>> rows = db.list("SELECT c.*,u.display_name AS author_name FROM task_log_comments c "
                + "JOIN users u ON u.organization_id=c.organization_id AND u.id=c.author_id "
                + "WHERE c.organization_id=? AND c.object_type=? AND c.deleted_at IS NULL AND "
                + ("task".equals(object.type()) ? "c.task_id=?" : "c.log_id=?")
                + " ORDER BY c.created_at,c.id", a.organizationId(), object.type(), object.id());
        int start = Math.min(offset, rows.size());
        int end = (int) Math.min((long) start + limit, rows.size());
        List<Map<String, Object>> items = rows.subList(start, end).stream().map(row -> view(a, row, object)).toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("total", rows.size());
        result.put("nextOffset", end < rows.size() ? end : null);
        result.put("objectType", object.type());
        result.put("objectId", object.id());
        return result;
    }

    public Map<String, Object> create(Actor a, String objectType, String objectId, Map<String, Object> body) {
        business(a);
        onlyFields(body, Set.of("body"));
        CommentedObject object = requireObject(a, objectType, objectId);
        String text = body == null ? null : Objects.toString(body.get("body"), "").strip();
        if (text == null || text.isEmpty()) throw bad("评论内容不能为空");
        if (text.length() > MAX_BODY) throw bad("评论内容不得超过 " + MAX_BODY + " 字");
        String commentId = id();
        db.update("INSERT INTO task_log_comments(id,organization_id,object_type,task_id,log_id,author_id,body) VALUES(?,?,?,?,?,?,?)",
                commentId, a.organizationId(), object.type(),
                "task".equals(object.type()) ? object.id() : null,
                "log".equals(object.type()) ? object.id() : null, a.id(), text);
        Set<String> recipients = new LinkedHashSet<>(object.recipients());
        recipients.remove(a.id());
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("commentId", commentId);
        details.put("objectType", object.type());
        details.put("objectId", object.id());
        details.put("authorId", a.id());
        // The excerpt is stored once in the durable event; a later deletion replaces it with a
        // placeholder at read time instead of trying to edit history (chapter 8.5).
        events.recordObject(a, "task".equals(object.type()) ? object.id() : null, "comment.created", recipients,
                details, null, null, object.name(), eventSummary(object, text), object.type(), object.id());
        return Map.of("commentId", commentId, "rowVersion", 1, "objectType", object.type(), "objectId", object.id());
    }

    public Map<String, Object> change(Actor a, String commentId, String ifMatch, Map<String, Object> body) {
        business(a);
        onlyFields(body, Set.of("body"));
        Map<String, Object> row = db.one("SELECT * FROM task_log_comments WHERE organization_id=? AND id=? FOR UPDATE",
                a.organizationId(), commentId);
        requireAuthor(a, row);
        CommentedObject object = requireObject(a, s(row, "objectType"),
                "task".equals(s(row, "objectType")) ? s(row, "taskId") : s(row, "logId"));
        Writes.checkVersion(ifMatch, n(row, "rowVersion"));
        String text = body == null ? null : Objects.toString(body.get("body"), "").strip();
        if (text == null || text.isEmpty()) throw bad("评论内容不能为空");
        if (text.length() > MAX_BODY) throw bad("评论内容不得超过 " + MAX_BODY + " 字");
        // Editing keeps the publication instant and the position in the page; only the flag changes.
        // It deliberately creates no new notification.
        db.update("UPDATE task_log_comments SET body=?,edited_at=COALESCE(edited_at,UTC_TIMESTAMP(6)),row_version=row_version+1 "
                + "WHERE organization_id=? AND id=?", text, a.organizationId(), commentId);
        return Map.of("commentId", commentId, "rowVersion", n(row, "rowVersion") + 1, "edited", true,
                "objectType", object.type(), "objectId", object.id());
    }

    public Map<String, Object> delete(Actor a, String commentId, String ifMatch) {
        business(a);
        Map<String, Object> row = db.one("SELECT * FROM task_log_comments WHERE organization_id=? AND id=? FOR UPDATE",
                a.organizationId(), commentId);
        requireAuthor(a, row);
        CommentedObject object = requireObject(a, s(row, "objectType"),
                "task".equals(s(row, "objectType")) ? s(row, "taskId") : s(row, "logId"));
        Writes.checkVersion(ifMatch, n(row, "rowVersion"));
        if (row.get("deletedAt") == null) {
            db.update("UPDATE task_log_comments SET deleted_at=UTC_TIMESTAMP(6),row_version=row_version+1 WHERE organization_id=? AND id=?",
                    a.organizationId(), commentId);
        }
        return Map.of("commentId", commentId, "deleted", true, "rowVersion", n(row, "rowVersion") + 1,
                "objectType", object.type(), "objectId", object.id());
    }

    /** The object, its current authority and the notification recipients for one comment write. */
    private record CommentedObject(String type, String id, String name, Set<String> recipients) {}

    private CommentedObject requireObject(Actor a, String objectType, String objectId) {
        String type = objectType == null ? "" : objectType;
        if (!OBJECT_TYPES.contains(type)) throw bad("objectType 只能为 task 或 log");
        if (objectId == null || objectId.isBlank()) throw bad("缺少对象标识");
        if ("task".equals(type)) {
            var task = db.find("SELECT * FROM tasks WHERE organization_id=? AND id=?", a.organizationId(), objectId);
            if (task == null || !workspace.canReadTaskForComments(a, objectId)) throw ApiException.notFound();
            String title = null;
            Set<String> recipients = new LinkedHashSet<>();
            if (s(task, "currentVersionId") != null) {
                var version = db.find("SELECT title FROM task_versions WHERE organization_id=? AND id=?", a.organizationId(), s(task, "currentVersionId"));
                title = version == null ? null : s(version, "title");
                for (var owner : db.list("SELECT user_id FROM task_version_assignees WHERE organization_id=? AND version_id=? ORDER BY ordinal,user_id",
                        a.organizationId(), s(task, "currentVersionId"))) recipients.add(s(owner, "userId"));
            } else {
                // Unpublished creation: its applicant and current reviewer are the only task people.
                var request = db.find("SELECT * FROM approval_requests WHERE organization_id=? AND task_id=? ORDER BY created_at DESC,id DESC LIMIT 1",
                        a.organizationId(), objectId);
                if (request != null) {
                    recipients.add(s(request, "applicantId"));
                    recipients.add(s(request, "currentReviewerId"));
                    var proposed = db.find("SELECT title FROM task_versions WHERE organization_id=? AND id=?", a.organizationId(), s(request, "proposedVersionId"));
                    title = proposed == null ? null : s(proposed, "title");
                }
            }
            recipients.remove(null);
            return new CommentedObject("task", objectId, title == null ? "任务" : title, recipients);
        }
        var log = db.find("SELECT * FROM work_logs WHERE organization_id=? AND id=? AND deleted_at IS NULL", a.organizationId(), objectId);
        if (log == null) throw ApiException.notFound();
        String authorId = s(log, "authorId");
        if (!access.canReadLogAuthor(a, authorId)) throw ApiException.notFound();
        Set<String> recipients = new LinkedHashSet<>();
        recipients.add(authorId);
        return new CommentedObject("log", objectId, "日志 · " + s(log, "businessDate"), recipients);
    }

    private void requireAuthor(Actor a, Map<String, Object> row) {
        if (row.get("deletedAt") != null) throw ApiException.notFound();
        if (!a.id().equals(s(row, "authorId"))) {
            throw new ApiException(403, "COMMENT_AUTHOR_ONLY", "只有评论作者可以修改或删除自己的评论");
        }
    }

    private Map<String, Object> view(Actor a, Map<String, Object> row, CommentedObject object) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", s(row, "id"));
        item.put("objectType", object.type());
        item.put("objectId", object.id());
        item.put("authorId", s(row, "authorId"));
        item.put("authorName", s(row, "authorName"));
        item.put("body", s(row, "body"));
        item.put("createdAt", row.get("createdAt"));
        item.put("editedAt", row.get("editedAt"));
        item.put("edited", row.get("editedAt") != null);
        item.put("deleted", row.get("deletedAt") != null);
        item.put("rowVersion", n(row, "rowVersion"));
        item.put("canManage", a.id().equals(s(row, "authorId")));
        return item;
    }

    private String eventSummary(CommentedObject object, String text) {
        String excerpt = text.length() <= 120 ? text : text.substring(0, 120) + "…";
        return object.name() + "有新评论：" + excerpt;
    }

    private static void onlyFields(Map<String, Object> body, Set<String> allowed) {
        if (body == null) return;
        if (!allowed.containsAll(body.keySet())) throw bad("请求含不支持的字段（评论不支持回复层级）");
    }

    private static int number(Map<String, String> filters, String key, int fallback, int min, int max) {
        try {
            int value = Integer.parseInt(filters.getOrDefault(key, Integer.toString(fallback)));
            if (value < min || value > max) throw new NumberFormatException();
            return value;
        } catch (Exception e) {
            throw bad(key + " 超出允许范围");
        }
    }

    static void business(Actor a) {
        if ("admin".equals(a.role())) throw new ApiException(403, "BUSINESS_ROLE_REQUIRED", "管理员请使用管理端接口");
    }

    static ApiException bad(String message) { return new ApiException(400, "INVALID_INPUT", message); }
}
