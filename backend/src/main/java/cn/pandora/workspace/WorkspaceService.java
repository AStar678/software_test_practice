package cn.pandora.workspace;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.*;
import cn.pandora.task.TaskService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.regex.Pattern;

import static cn.pandora.common.Db.*;

@Service
public class WorkspaceService {
    private static final Pattern HAN_RUN = Pattern.compile("\\p{IsHan}{2,}");
    private static final Pattern OTHER_WORD = Pattern.compile("[\\p{L}\\p{N}][\\p{L}\\p{N}_-]{1,31}");
    private static final Set<String> KEYWORD_STOP_WORDS = Set.of(
            "任务", "项目", "工作", "进行", "完成", "需要", "以及", "一个", "我们", "相关", "当前",
            "the", "and", "for", "with", "from", "this", "that");
    private final Db db;
    private final Access access;
    private final TaskService tasks;
    private final Events events;
    private final Clock clock;

    public WorkspaceService(Db db, Access access, TaskService tasks, Events events, Clock clock) {
        this.db = db; this.access = access; this.tasks = tasks; this.events = events; this.clock = clock;
    }

    public Map<String,Object> me(Actor a) {
        var row=db.one("SELECT u.*,o.name AS organization_name,d.name AS department_name,p.name AS position_name,t.name team_name,m.display_name manager_name "
            + "FROM users u LEFT JOIN organizations o ON o.id=u.organization_id "
            + "LEFT JOIN departments d ON d.organization_id=u.organization_id AND d.id=u.department_id "
            + "LEFT JOIN positions p ON p.organization_id=u.organization_id AND p.id=u.position_id "
            + "LEFT JOIN teams t ON t.id=u.team_id AND t.organization_id=u.organization_id "
            + "LEFT JOIN users m ON m.id=u.manager_id AND m.organization_id=u.organization_id "
            + "WHERE u.id=? AND u.organization_id=? AND u.active=1", a.id(), a.organizationId());
        var result=safeUser(row);
        for(String key:List.of("phone","email","profileVersion","managerName","organizationName","departmentName","positionName")) result.put(key,row.get(key));
        return result;
    }

    public Map<String,Object> users(Actor a, Map<String,String> filters, boolean admin) {
        if (admin) access.requireAdmin(a); else business(a);
        String query = filters.getOrDefault("q", "").trim().toLowerCase(Locale.ROOT);
        var rows = db.list("SELECT u.*,t.name team_name FROM users u LEFT JOIN teams t ON t.id=u.team_id AND t.organization_id=u.organization_id WHERE u.organization_id=? ORDER BY u.rank_level,u.display_name,u.id", a.organizationId());
        var allowed = rows.stream().filter(u -> admin || (enabled(u) && !"admin".equals(s(u,"role")) && access.canSeePerson(a,u)))
            .filter(u -> query.isEmpty() || (s(u,"displayName")+" "+s(u,"username")).toLowerCase(Locale.ROOT).contains(query))
            .map(this::safeUser).toList();
        return page(allowed, filters);
    }

    public Map<String,Object> person(Actor a, String userId) {
        business(a);
        var row = db.one("SELECT u.*,o.name AS organization_name,d.name AS department_name,p.name AS position_name,"
                + "t.name AS team_name,m.display_name AS manager_name FROM users u "
                + "LEFT JOIN organizations o ON o.id=u.organization_id "
                + "LEFT JOIN departments d ON d.organization_id=u.organization_id AND d.id=u.department_id "
                + "LEFT JOIN positions p ON p.organization_id=u.organization_id AND p.id=u.position_id "
                + "LEFT JOIN teams t ON t.id=u.team_id AND t.organization_id=u.organization_id "
                + "LEFT JOIN users m ON m.id=u.manager_id AND m.organization_id=u.organization_id "
                + "WHERE u.id=? AND u.organization_id=? AND u.active=1", userId, a.organizationId());
        if (!access.canSeePerson(a, row)) throw ApiException.notFound();
        var result = safeUser(row);
        for (String key : List.of("organizationName","departmentName","positionName","teamName","managerName")) {
            result.put(key, row.get(key));
        }
        result.put("canReadLogs", access.canReadLogAuthor(a, userId));
        if (access.canReadPhone(a, row)) result.put("phone", row.get("phone"));
        return result;
    }

    /**
     * Subordinates shown from "My": the intersection of the current profile scope and the actual
     * management chain. Indirect reports are included only when the profile scope itself allows them.
     */
    public Map<String,Object> reports(Actor a) {
        business(a);
        var rows = db.list("SELECT u.*,d.name AS department_name,p.name AS position_name,t.name AS team_name,"
                + "m.display_name AS manager_name FROM users u "
                + "LEFT JOIN departments d ON d.organization_id=u.organization_id AND d.id=u.department_id "
                + "LEFT JOIN positions p ON p.organization_id=u.organization_id AND p.id=u.position_id "
                + "LEFT JOIN teams t ON t.organization_id=u.organization_id AND t.id=u.team_id "
                + "LEFT JOIN users m ON m.organization_id=u.organization_id AND m.id=u.manager_id "
                + "WHERE u.organization_id=? AND u.active=1 ORDER BY u.rank_level,u.display_name,u.id", a.organizationId());
        Map<String,List<Map<String,Object>>> children = new LinkedHashMap<>();
        for (var row : rows) children.computeIfAbsent(s(row,"managerId"), key -> new ArrayList<>()).add(row);
        Set<String> visited = new HashSet<>();
        visited.add(a.id());
        Deque<String> queue = new ArrayDeque<>();
        queue.add(a.id());
        List<Map<String,Object>> items = new ArrayList<>();
        while (!queue.isEmpty()) {
            String managerId = queue.removeFirst();
            for (var row : children.getOrDefault(managerId, List.of())) {
                String id = s(row,"id");
                if (!visited.add(id)) continue;
                queue.addLast(id);
                if ("admin".equals(s(row,"role")) || !access.canSeePerson(a,row)) continue;
                Map<String,Object> item = new LinkedHashMap<>();
                for (String key : List.of("id","displayName","role","rankLevel","departmentId","departmentName",
                        "positionId","positionName","teamId","teamName","managerId","managerName")) item.put(key,row.get(key));
                item.put("canReadLogs", access.canReadLogAuthor(a,id));
                items.add(item);
            }
        }
        items.sort(Comparator.comparingLong((Map<String,Object> row) -> n(row,"rankLevel"))
                .thenComparing(row -> Objects.toString(row.get("displayName"),""))
                .thenComparing(row -> Objects.toString(row.get("id"),"")));
        return Map.of("items", items);
    }

    public Map<String,Object> logs(Actor a, Map<String,String> filters) {
        business(a);
        String scope = filters.getOrDefault("scope", "self");
        if (!Set.of("self","visible","log").contains(scope)) throw bad("scope 只能为 self 或 visible");
        // The log range is its own authority: company for the executive, direct reports for a
        // manager, self below that. Being a teammate or sharing a task grants nothing here.
        var allowedIds = new HashSet<>(access.logAuthorIds(a));
        if (scope.equals("self")) allowedIds.retainAll(Set.of(a.id()));
        String author = filters.get("authorId");
        if (author != null && !allowedIds.contains(author)) throw ApiException.notFound();
        if (author != null) allowedIds.retainAll(Set.of(author));
        LocalDate from = optionalDate(filters.get("from")), to = optionalDate(filters.get("to"));
        if (from != null && to != null && from.isAfter(to)) throw bad("开始日期不得晚于结束日期");
        LocalDate today = today(a);
        var result = db.list("SELECT w.*,u.display_name author_name FROM work_logs w JOIN users u ON u.id=w.author_id AND u.organization_id=w.organization_id WHERE w.organization_id=? ORDER BY w.business_date DESC,w.created_at DESC,w.id",a.organizationId()).stream()
            .filter(row -> allowedIds.contains(s(row,"authorId")))
            .filter(row -> from == null || !LocalDate.parse(s(row,"businessDate")).isBefore(from))
            .filter(row -> to == null || !LocalDate.parse(s(row,"businessDate")).isAfter(to))
            .map(row -> safeLog(a,row,today)).toList();
        return page(result,filters);
    }

    /** Author filter for the log page: only people inside the reader's own log range. */
    public Map<String,Object> logAuthors(Actor a, Map<String,String> filters) {
        business(a);
        String query = filters.getOrDefault("q","").strip().toLowerCase(Locale.ROOT);
        var allowed = new LinkedHashSet<>(access.logAuthorIds(a));
        var rows = db.list("SELECT u.id,u.username,u.display_name,u.manager_id,u.department_id,u.team_id,"
                + "d.name AS department_name,t.name AS team_name FROM users u "
                + "LEFT JOIN departments d ON d.organization_id=u.organization_id AND d.id=u.department_id "
                + "LEFT JOIN teams t ON t.organization_id=u.organization_id AND t.id=u.team_id "
                + "WHERE u.organization_id=? AND u.active=1 ORDER BY u.rank_level,u.display_name,u.id",a.organizationId())
            .stream().filter(u -> allowed.contains(s(u,"id"))).toList();
        var items = rows.stream()
            .filter(u -> query.isEmpty()
                || s(u,"displayName").toLowerCase(Locale.ROOT).contains(query)
                || s(u,"username").toLowerCase(Locale.ROOT).contains(query))
            .map(u -> {
                Map<String,Object> item = new LinkedHashMap<>();
                for (String key : List.of("id","username","displayName","managerId","departmentId","departmentName","teamId","teamName")) item.put(key,u.get(key));
                item.put("self", a.id().equals(s(u,"id")));
                return item;
            }).toList();
        // Tree edges only ever point at people the reader may already read.
        Map<String,Map<String,Object>> nodes = new LinkedHashMap<>();
        for (var u : rows) {
            Map<String,Object> node = new LinkedHashMap<>();
            node.put("id", s(u,"id"));
            node.put("displayName", s(u,"displayName"));
            node.put("departmentName", u.get("departmentName"));
            node.put("children", new ArrayList<Map<String,Object>>());
            nodes.put(s(u,"id"), node);
        }
        List<Map<String,Object>> roots = new ArrayList<>();
        for (var u : rows) {
            Map<String,Object> node = nodes.get(s(u,"id"));
            Map<String,Object> parent = nodes.get(s(u,"managerId"));
            if (parent == null) roots.add(node);
            else ((List<Map<String,Object>>) parent.get("children")).add(node);
        }
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("tree", roots);
        result.put("empty", items.isEmpty());
        return result;
    }

    public Map<String,Object> log(Actor a, String logId) {
        business(a);
        var row = db.one("SELECT w.*,u.display_name author_name FROM work_logs w JOIN users u ON u.id=w.author_id AND u.organization_id=w.organization_id WHERE w.organization_id=? AND w.id=?",a.organizationId(),logId);
        if (!access.canReadLogAuthor(a, s(row,"authorId"))) throw ApiException.notFound();
        return safeLog(a,row,today(a));
    }

    public Map<String,Object> createLog(Actor a, Map<String,Object> body) {
        business(a);
        allowed(body,Set.of("body","businessDate","taskId"));
        String text = required(body,"body",10000);
        LocalDate today = today(a);
        LocalDate date = body.containsKey("businessDate") ? dateFor(a,body,"businessDate") : today;
        if (!date.equals(today)) throw bad("只能新建公司当天的日志");
        var existing = findLog(a, date);
        if (existing != null) throw logExists(existing);
        String taskId = nullable(body,"taskId");
        if (taskId != null) tasks.detail(a,taskId);
        String logId = id();
        try {
            db.update("INSERT INTO work_logs(id,organization_id,author_id,business_date,body,task_id) VALUES(?,?,?,?,?,?)",logId,a.organizationId(),a.id(),java.sql.Date.valueOf(date),text,taskId);
        } catch (DuplicateKeyException duplicate) {
            var concurrent = findLog(a, date);
            if (concurrent != null) throw logExists(concurrent);
            throw duplicate;
        }
        events.record(a,null,"log.created",List.of(),Map.of("logId",logId));
        return Map.of("logId",logId,"rowVersion",1,"businessDate",date.toString());
    }

    public Map<String,Object> changeLog(Actor a, String logId, String ifMatch, Map<String,Object> body) {
        business(a);
        allowed(body,Set.of("body","businessDate","taskId"));
        var row = ownedLog(a,logId);
        LocalDate rowDate = LocalDate.parse(s(row,"businessDate"));
        if (!rowDate.equals(today(a))) throw conflict("WORK_LOG_FROZEN","该日志已过公司当天，不能再修改");
        if (body.containsKey("businessDate")) {
            LocalDate requested = dateFor(a,body,"businessDate");
            if (!requested.equals(rowDate)) throw bad("日志日期不能修改");
        }
        Writes.checkVersion(ifMatch,n(row,"rowVersion"));
        String text = body.containsKey("body") ? required(body,"body",10000) : s(row,"body");
        String taskId = body.containsKey("taskId") ? nullable(body,"taskId") : s(row,"taskId");
        if (body.containsKey("taskId") && taskId != null) tasks.detail(a,taskId);
        db.update("UPDATE work_logs SET body=?,task_id=?,row_version=row_version+1,updated_at=UTC_TIMESTAMP(6) WHERE id=? AND organization_id=?",text,taskId,logId,a.organizationId());
        events.record(a,null,"log.updated",List.of(),Map.of("logId",logId));
        return Map.of("logId",logId,"rowVersion",n(row,"rowVersion")+1,"businessDate",rowDate.toString());
    }

    public Map<String,Object> deleteLog(Actor a, String logId, String ifMatch) {
        business(a);
        var row = ownedLog(a,logId);
        LocalDate rowDate = LocalDate.parse(s(row,"businessDate"));
        if (!rowDate.equals(today(a))) throw conflict("WORK_LOG_FROZEN","该日志已过公司当天，不能再删除");
        Writes.checkVersion(ifMatch,n(row,"rowVersion"));
        db.update("DELETE FROM work_logs WHERE id=? AND organization_id=?",logId,a.organizationId());
        events.record(a,null,"log.deleted",List.of(),Map.of("logId",logId));
        return Map.of("logId",logId,"deleted",true);
    }

    public Map<String,Object> notifications(Actor a, Map<String,String> filters) {
        boolean unread = "true".equals(filters.get("unread"));
        Instant now = clock.instant();
        var visible = db.list("SELECT * FROM notifications WHERE organization_id=? AND recipient_id=? AND hidden_at IS NULL ORDER BY created_at DESC,id",a.organizationId(),a.id()).stream()
            .filter(row -> notificationVisible(a,row,now)).map(row -> safeNotification(a,row,now)).toList();
        var result = page(visible.stream().filter(row -> !unread || row.get("readAt")==null).toList(),filters);
        result.put("unreadCount",visible.stream().filter(row -> row.get("readAt")==null).count());
        return result;
    }

    /** Non-mutating detail read; opening a message goes through {@link #openNotification}. */
    public Map<String,Object> notification(Actor a, String notificationId) {
        var row = db.one("SELECT * FROM notifications WHERE organization_id=? AND recipient_id=? AND id=? AND hidden_at IS NULL",a.organizationId(),a.id(),notificationId);
        Instant now = clock.instant();
        if (!notificationVisible(a,row,now)) throw ApiException.notFound();
        return safeNotification(a,row,now);
    }

    /**
     * Open-as-read command (DEV-031). The ordinary list GET never changes state; this command marks the
     * message read and returns only command metadata, so the unread badge can refresh without
     * copying notification/task text into the idempotency cache. Detail remains a separate GET.
     */
    public Map<String,Object> openNotification(Actor a, String notificationId) {
        var row = db.one("SELECT * FROM notifications WHERE organization_id=? AND recipient_id=? AND id=? AND hidden_at IS NULL FOR UPDATE",a.organizationId(),a.id(),notificationId);
        Instant now = clock.instant();
        if (!notificationVisible(a,row,now)) throw ApiException.notFound();
        if (row.get("readAt")==null) {
            db.update("UPDATE notifications SET read_at=?,row_version=row_version+1 WHERE organization_id=? AND id=?",Timestamp.from(now),a.organizationId(),notificationId);
            // Read back MySQL's DATETIME(6) value so the first response and a later
            // idempotent open expose the same microsecond-normalized timestamp.
            row = db.one("SELECT * FROM notifications WHERE organization_id=? AND recipient_id=? AND id=?",
                a.organizationId(),a.id(),notificationId);
        }
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("notificationId",notificationId);
        result.put("readAt",Objects.toString(row.get("readAt"),null));
        result.put("rowVersion",n(row,"rowVersion"));
        result.put("unreadCount",unreadCount(a,now));
        return result;
    }

    public Map<String,Object> changeNotification(Actor a, String notificationId, String ifMatch, Map<String,Object> body) {
        allowed(body,Set.of("action"));
        var row = db.one("SELECT * FROM notifications WHERE organization_id=? AND recipient_id=? AND id=? FOR UPDATE",a.organizationId(),a.id(),notificationId);
        Instant now = clock.instant();
        if (!notificationVisible(a,row,now)) throw ApiException.notFound();
        long version = notificationVersion(row);
        Writes.checkVersion(ifMatch,version);
        String action = required(body,"action",20);
        if (action.equals("read")) {
            db.update("UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE organization_id=? AND id=?",Timestamp.from(now),a.organizationId(),notificationId);
            if (row.get("readAt")==null) version++;
        } else if (action.equals("hide") || action.equals("delete")) {
            db.update("UPDATE notifications SET hidden_at=COALESCE(hidden_at,?) WHERE organization_id=? AND id=?",Timestamp.from(now),a.organizationId(),notificationId);
            if (row.get("hiddenAt")==null) version+=2;
        } else throw bad("action 只能为 read、hide 或 delete");
        return Map.of("notificationId",notificationId,"rowVersion",version,"action",action,"unreadCount",unreadCount(a,now));
    }

    /**
     * Event-level withdrawal (DEV-032). The business initiator or a notification manager may withdraw
     * only while the event is strictly younger than 180 seconds. Automatic reminders are managed by the
     * administrator only. Every copy keeps a placeholder with no body or jump target.
     */
    public Map<String,Object> withdrawNotification(Actor a, String notificationId, Map<String,Object> body) {
        allowed(body,Set.of("reason"));
        var row = db.one("SELECT * FROM notifications WHERE organization_id=? AND recipient_id=? AND id=?",a.organizationId(),a.id(),notificationId);
        return withdrawEvent(a,s(row,"eventId"),body);
    }

    public Map<String,Object> withdrawEvent(Actor a, String eventId, Map<String,Object> body) {
        allowed(body,Set.of("reason"));
        String reason = body != null && body.containsKey("reason") ? required(body,"reason",500) : "发起人撤回";
        var event = db.one("SELECT * FROM domain_events WHERE organization_id=? AND id=? FOR UPDATE",a.organizationId(),eventId);
        Instant now = clock.instant();
        Instant occurred = event.get("occurredAt")==null ? null : Instant.parse(String.valueOf(event.get("occurredAt")));
        if (event.get("revokedAt")!=null) throw conflict("NOTIFICATION_WITHDRAWN","该通知已撤回");
        if (occurred == null || now.isBefore(occurred) || !now.isBefore(occurred.plusSeconds(180)))
            throw conflict("WITHDRAW_WINDOW_CLOSED","通知发出已满3分钟，不能撤回");
        Map<String,Object> details = event.get("detailsJson")==null ? Map.of() : db.parse(s(event,"detailsJson"));
        boolean automatic = "scheduled_rule".equals(Objects.toString(details.get("origin"),"")) || event.get("initiatorId")==null;
        boolean manager = a.can("manage_notifications");
        if (automatic && !manager) throw forbidden("仅管理员可管理自动提醒");
        if (!manager && !a.id().equals(s(event,"initiatorId"))) throw forbidden("仅业务发起人或通知管理员可撤回");
        int changed = db.update("UPDATE domain_events SET revoked_at=?,revoked_by=?,revocation_reason=? WHERE organization_id=? AND id=? AND revoked_at IS NULL",
                Timestamp.from(now),a.id(),reason,a.organizationId(),eventId);
        if (changed != 1) throw conflict("NOTIFICATION_WITHDRAWN","该通知已撤回");
        int copies = db.update("UPDATE notifications SET summary=?,title=NULL,change_summary=NULL,task_id=NULL,readonly=TRUE,row_version=row_version+1 WHERE organization_id=? AND event_id=?",
                "该通知已被撤回。",a.organizationId(),eventId);
        db.update("INSERT INTO audit_logs(id,organization_id,actor_id,object_id,action,details_json) VALUES(?,?,?,?,?,?)",
                id(),a.organizationId(),a.id(),eventId,"notification.withdrawn",db.json(Map.of("reason",reason,"copies",copies)));
        return Map.of("eventId",eventId,"withdrawn",true,"copies",copies);
    }

    /** Administration notification management (DEV-001, DEV-032): visible to explicit managers only. */
    public Map<String,Object> adminNotifications(Actor a, Map<String,String> filters) {
        access.requireCapability(a,"manage_notifications");
        Instant now = clock.instant();
        var rows = db.list("SELECT n.*,u.display_name AS recipient_name,e.revoked_at,e.expires_at AS event_expires_at,e.title AS event_title,"
                + "e.change_summary AS event_summary FROM notifications n "
                + "LEFT JOIN users u ON u.organization_id=n.organization_id AND u.id=n.recipient_id "
                + "LEFT JOIN domain_events e ON e.organization_id=n.organization_id AND e.id=n.event_id "
                + "WHERE n.organization_id=? ORDER BY n.created_at DESC,n.id",a.organizationId())
            .stream().map(row -> {
                Map<String,Object> view = new LinkedHashMap<>();
                for (String key : List.of("id","eventId","eventType","recipientId","recipientName","title","summary",
                        "changeSummary","taskId","requestId","createdAt","deliveredAt","readAt","hiddenAt","revokedAt")) view.put(key,row.get(key));
                Object expires = row.get("expiresAt")!=null?row.get("expiresAt"):row.get("eventExpiresAt");
                view.put("expiresAt",expires);
                view.put("expired",expires!=null && !now.isBefore(Instant.parse(String.valueOf(expires))));
                return view;
            }).toList();
        return page(rows,filters);
    }

    /**
     * Dedicated read-only historical entry (DEV-033). It is available only through the recipient's own
     * delivered, non-deleted, non-withdrawn, unexpired message; it returns the current effective task
     * only and never a proposal, diff, contact, log, route or business action.
     */
    public Map<String,Object> notificationTask(Actor a, String notificationId) {
        var row = db.one("SELECT * FROM notifications WHERE organization_id=? AND recipient_id=? AND id=? AND hidden_at IS NULL",a.organizationId(),a.id(),notificationId);
        Instant now = clock.instant();
        if (!notificationVisible(a,row,now)) throw ApiException.notFound();
        if (s(row,"taskId")==null) throw conflict("HISTORICAL_TASK_UNAVAILABLE","该消息没有可查看的任务");
        Map<String,Object> task = db.find("SELECT * FROM tasks WHERE organization_id=? AND id=?",a.organizationId(),s(row,"taskId"));
        if (task == null || s(task,"currentVersionId")==null) throw conflict("HISTORICAL_TASK_UNAVAILABLE","该任务尚未发布或已不可用");
        Map<String,Object> version = db.find("SELECT * FROM task_versions WHERE organization_id=? AND id=?",a.organizationId(),s(task,"currentVersionId"));
        List<String> owners = db.list("SELECT user_id FROM task_version_assignees WHERE organization_id=? AND version_id=? ORDER BY ordinal,user_id",a.organizationId(),s(version,"id"))
                .stream().map(r -> s(r,"userId")).toList();
        boolean accessRevoked = !access.canSeeTask(a,task,version,owners);
        Map<String,Object> view = new LinkedHashMap<>();
        for (String key : List.of("title","description","acceptanceCriteria","priority","allDay","startAt","dueAt",
                "startDate","dueDate","executionState","progressNote")) view.put(key,version.get(key));
        view.put("taskId",s(task,"id"));
        view.put("originalCreatorId",s(task,"originalCreatorId"));
        view.put("createdAt",task.get("createdAt"));
        view.put("readonly",true);
        view.put("historical",true);
        view.put("accessRevoked",accessRevoked);
        view.put("relationLost",row.get("relationLost"));
        view.put("notice",accessRevoked ? "你已不再具有该任务的当前权限，此页仅展示消息送达时保留的只读摘要。"
                : "该入口仅提供当前有效任务的只读摘要，不开放任何业务操作。");
        view.put("assignees",participantSummaries(a,owners));
        view.put("creator",db.find("SELECT id,display_name AS displayName FROM users WHERE organization_id=? AND id=?",a.organizationId(),s(task,"originalCreatorId")));
        return view;
    }

    /** Retention cleanup: expired message copies are removed; task/request/audit history is untouched. */
    public int cleanupNotifications(String organizationId, Instant now) {
        return db.update("DELETE FROM notifications WHERE organization_id=? AND expires_at IS NOT NULL AND expires_at<=?",organizationId,Timestamp.from(now));
    }

    private long unreadCount(Actor a, Instant now) {
        return db.list("SELECT * FROM notifications WHERE organization_id=? AND recipient_id=? AND hidden_at IS NULL",a.organizationId(),a.id())
                .stream().filter(row -> notificationVisible(a,row,now) && row.get("readAt")==null).count();
    }

    private Map<String,Object> safeNotification(Actor a, Map<String,Object> row, Instant now) {
        var event = db.find("SELECT * FROM domain_events WHERE organization_id=? AND id=?",a.organizationId(),s(row,"eventId"));
        boolean revoked = event != null && event.get("revokedAt")!=null;
        // Copies masked at delivery must never regain the restricted title/summary from the event row.
        boolean contentMasked = Boolean.TRUE.equals(row.get("contentMasked"))
                || row.get("contentMasked") instanceof Number masked && masked.intValue() == 1;
        Map<String,Object> details = event == null || event.get("detailsJson")==null ? Map.of() : db.parse(s(event,"detailsJson"));
        Instant occurred = event == null || event.get("occurredAt")==null ? null : Instant.parse(String.valueOf(event.get("occurredAt")));
        boolean manager = a.can("manage_notifications");
        boolean automatic = "scheduled_rule".equals(Objects.toString(details.get("origin"),"")) || (event != null && event.get("initiatorId")==null);
        boolean withinWithdrawal = occurred != null && !now.isBefore(occurred) && now.isBefore(occurred.plusSeconds(180));
        var view = new LinkedHashMap<String,Object>();
        for (String key : List.of("id","eventId","eventType","createdAt","deliveredAt","readAt","readonly","relationLost")) view.put(key,row.get(key));
        view.put("taskId",contentMasked||revoked?null:row.get("taskId"));
        view.put("requestId",contentMasked||revoked?null:row.get("requestId"));
        if (revoked) {
            view.put("title",null);
            view.put("summary","该通知已被撤回。");
            view.put("changeSummary",null);
            view.put("readonly",true);
        } else if (contentMasked) {
            // Ordinary event whose recipient lost task authority before delivery: keep only the generic
            // delivery message, with no restricted title, change summary, request metadata or task jump.
            view.put("title",null);
            view.put("summary",row.get("summary")!=null?row.get("summary"):"你的工作关系或访问范围已变化，请查看当前工作安排。");
            view.put("changeSummary",null);
            view.put("readonly",true);
        } else {
            view.put("title",row.get("title")!=null?row.get("title"):event==null?null:event.get("title"));
            view.put("summary",row.get("summary"));
            view.put("changeSummary",row.get("changeSummary")!=null?row.get("changeSummary"):event==null?null:event.get("changeSummary"));
        }
        view.put("revoked",revoked);
        view.put("withdrawn",revoked);
        view.put("expiresAt",row.get("expiresAt")!=null?row.get("expiresAt"):event==null?null:event.get("expiresAt"));
        view.put("rowVersion",notificationVersion(row));
        view.put("canWithdraw",!revoked && withinWithdrawal && (manager || (!automatic && event!=null && a.id().equals(s(event,"initiatorId")))));
        view.put("canOpenTask",!revoked && !contentMasked && s(row,"taskId")!=null);
        view.put("canReview",false);
        view.put("requestStatus",null);
        view.put("requestKind",null);
        String requestId = revoked || contentMasked ? null : s(row,"requestId");
        if (requestId != null) {
            var request = db.find("SELECT id,kind,status,comment,decided_at,current_reviewer_id,applicable_deadline FROM approval_requests WHERE organization_id=? AND id=?",a.organizationId(),requestId);
            if (request != null) {
                view.put("requestStatus",s(request,"status"));
                view.put("requestKind",s(request,"kind"));
                view.put("requestComment",request.get("comment"));
                view.put("requestDecidedAt",request.get("decidedAt"));
                boolean deadlineOpen = request.get("applicableDeadline")==null
                        || now.isBefore(Instant.parse(String.valueOf(request.get("applicableDeadline"))));
                view.put("canReview",!revoked && "pending".equals(s(request,"status")) && deadlineOpen
                        && a.id().equals(s(request,"currentReviewerId")));
            }
        }
        return view;
    }

    private boolean notificationVisible(Actor a, Map<String,Object> row, Instant now) {
        if (row.get("hiddenAt")!=null) return false;
        var event = db.find("SELECT revoked_at,occurred_at,expires_at FROM domain_events WHERE organization_id=? AND id=?",a.organizationId(),s(row,"eventId"));
        Object expires = row.get("expiresAt")!=null?row.get("expiresAt"):event==null?null:event.get("expiresAt");
        if (expires != null && !now.isBefore(Instant.parse(String.valueOf(expires)))) return false;
        boolean revoked = event != null && event.get("revokedAt")!=null;
        if (revoked) return true;
        if (s(row,"taskId")==null) return true;
        if (canReadTask(a,s(row,"taskId"),true)) return true;
        // Delivered event messages keep a read-only historical entry after the current authority is lost;
        // legacy-unbound copies and undelivered candidates never gain that exception (DEV-033).
        return row.get("deliveredAt")!=null && "event".equals(s(row,"source"));
    }

    private List<Map<String,Object>> participantSummaries(Actor a, Collection<String> ids) {
        List<String> safeIds = ids.stream().filter(id -> id != null && !id.isBlank()).toList();
        if (safeIds.isEmpty()) return List.of();
        List<Object> args = new ArrayList<>();
        args.add(a.organizationId());
        args.addAll(safeIds);
        String placeholders = String.join(",", Collections.nCopies(safeIds.size(), "?"));
        return db.list("SELECT id,display_name FROM users WHERE organization_id=? AND id IN ("+placeholders+") ORDER BY display_name,id",args.toArray())
                .stream().map(row -> Map.<String,Object>of("id",s(row,"id"),"displayName",s(row,"displayName"))).toList();
    }

    public Map<String,Object> home(Actor a) {
        business(a);
        var assigned = db.list("SELECT t.id AS task_id,v.title,v.priority,a.assigned_at,a.assigned_source "
                + "FROM task_assignments a JOIN tasks t ON t.organization_id=a.organization_id AND t.id=a.task_id "
                + "JOIN task_versions v ON v.organization_id=t.organization_id AND v.id=t.current_version_id "
                + "WHERE a.organization_id=? AND a.user_id=? AND a.active=TRUE "
                + "AND t.current_version_id IS NOT NULL AND t.execution_state<>'done' AND t.original_creator_id<>? "
                + "ORDER BY a.assigned_at DESC,t.id LIMIT 10",a.organizationId(),a.id(),a.id());
        LocalDate today = clock.instant().atZone(zone(a)).toLocalDate();
        var logPage = logs(a,Map.of("scope","self","from",today.minusDays(9).toString(),"to",today.toString(),"limit","10"));
        return Map.of("companyItems",db.list("SELECT id,kind,title,body,sort_order,row_version FROM home_items WHERE organization_id=? AND kind='company' ORDER BY sort_order,created_at,id LIMIT 10",a.organizationId()),
            "personalItems",db.list("SELECT id,kind,title,body,sort_order,row_version FROM home_items WHERE organization_id=? AND kind='personal' AND owner_id=? ORDER BY sort_order,created_at,id LIMIT 10",a.organizationId(),a.id()),
            "assignedTasks",assigned,"recentLogs",logPage.get("items"),"businessDate",today.toString());
    }

    public Map<String,Object> homeItem(Actor a,String itemId) {
        var item=readHomeItem(a,itemId,false);
        item.remove("organizationId");item.remove("ownerId");
        item.put("editable",!"company".equals(s(item,"kind")));
        return item;
    }

    public Map<String,Object> createHomeItem(Actor a,Map<String,Object> body) {
        business(a);allowed(body,Set.of("kind","title","body"));
        String kind=required(body,"kind",20);
        if(!Set.of("company","personal").contains(kind)) throw bad("kind 只能为 company 或 personal");
        requireHomeWrite(a,kind);
        String content=required(body,"body",2000),title=body.containsKey("title")?required(body,"title",200):content.substring(0,Math.min(content.length(),200));
        var items=db.list("SELECT id,sort_order FROM home_items WHERE organization_id=? AND kind=? AND (kind='company' OR owner_id=?)",a.organizationId(),kind,a.id());
        if(items.size()>=10) throw new ApiException(409,"HOME_ITEM_LIMIT","每类首页信息最多 10 条，请先删除后再新增");
        long order=items.stream().mapToLong(r->n(r,"sortOrder")).max().orElse(0)+1;
        String itemId=id();
        db.update("INSERT INTO home_items(id,organization_id,owner_id,kind,title,body,sort_order) VALUES(?,?,?,?,?,?,?)",itemId,a.organizationId(),"personal".equals(kind)?a.id():null,kind,title,content,order);
        events.record(a,null,"home_item.created",List.of(),Map.of("homeItemId",itemId,"kind",kind));
        return Map.of("id",itemId,"rowVersion",1);
    }

    public Map<String,Object> changeHomeItem(Actor a,String itemId,String ifMatch,Map<String,Object> body) {
        allowed(body,Set.of("title","body"));
        var item=readHomeItem(a,itemId,true);requireHomeWrite(a,s(item,"kind"));Writes.checkVersion(ifMatch,n(item,"rowVersion"));
        String content=body.containsKey("body")?required(body,"body",2000):s(item,"body");
        String title=body.containsKey("title")?required(body,"title",200):s(item,"title");
        db.update("UPDATE home_items SET title=?,body=?,row_version=row_version+1 WHERE organization_id=? AND id=?",title,content,a.organizationId(),itemId);
        events.record(a,null,"home_item.updated",List.of(),Map.of("homeItemId",itemId,"kind",s(item,"kind")));
        return Map.of("id",itemId,"rowVersion",n(item,"rowVersion")+1);
    }

    public Map<String,Object> deleteHomeItem(Actor a,String itemId,String ifMatch) {
        var item=readHomeItem(a,itemId,true);requireHomeWrite(a,s(item,"kind"));Writes.checkVersion(ifMatch,n(item,"rowVersion"));
        db.update("DELETE FROM home_items WHERE organization_id=? AND id=?",a.organizationId(),itemId);
        events.record(a,null,"home_item.deleted",List.of(),Map.of("homeItemId",itemId,"kind",s(item,"kind")));
        return Map.of("id",itemId,"deleted",true);
    }

    private Map<String,Object> readHomeItem(Actor a,String itemId,boolean lock) {
        business(a);
        return db.one("SELECT * FROM home_items WHERE organization_id=? AND id=? AND (kind='company' OR (kind='personal' AND owner_id=?))"+(lock?" FOR UPDATE":""),a.organizationId(),itemId,a.id());
    }
    private void requireHomeWrite(Actor a,String kind) {
        if("company".equals(kind)) throw new ApiException(403,"COMPANY_READ_ONLY","公司信息由管理员维护，业务账号仅可查看");
    }

    // Check before idempotency replay as well: commands cached under the old upper-role policy cannot bypass this restriction.
    public void checkHomeCreateAccess(Actor a,Map<String,Object> body) {
        business(a);requireHomeWrite(a,s(body,"kind"));
    }
    public void checkHomeItemWriteAccess(Actor a,String itemId) {
        business(a);
        var company=db.find("SELECT kind FROM home_items WHERE organization_id=? AND id=? AND kind='company'",a.organizationId(),itemId);
        if(company!=null) requireHomeWrite(a,"company");
    }

    public Map<String,Object> statistics(Actor a, Map<String,String> filters) {
        if(!Set.of("scope").containsAll(filters.keySet())) throw bad("统计接口当前仅支持 scope，不支持日期筛选");
        String requested=filters.getOrDefault("scope","auto");
        AnalysisScope scope=analysisScope(a,requested);
        var rows=visibleTasks(a,scope.statisticsQuery());
        var summary=summarize(rows);
        summary.put("scope",scope.statisticsScope());
        summary.put("scopeLabel",scopeLabel(scope.statisticsScope()));
        summary.put("method","current_effective_tasks");
        summary.put("keywords",keywords(rows));
        summary.put("keywordMethod","unicode_text_frequency");
        return summary;
    }

    public Map<String,Object> createAiJob(Actor a, Map<String,Object> input) {
        allowed(input,Set.of("scopeType"));
        String requested = Optional.ofNullable(nullable(input,"scopeType")).orElse("auto");
        AnalysisScope scope = analysisScope(a,requested);
        var statisticsRows = visibleTasks(a,scope.statisticsQuery());
        var suggestionRows = scope.statisticsQuery().equals(scope.suggestionQuery())
                ? statisticsRows : visibleTasks(a,scope.suggestionQuery());
        var summary = summarize(statisticsRows);
        summary.put("scope",scope.statisticsScope());
        summary.put("scopeLabel",scopeLabel(scope.statisticsScope()));
        summary.put("method","current_effective_tasks");
        summary.put("keywords",keywords(statisticsRows));
        summary.put("keywordMethod","unicode_text_frequency");
        Instant now = clock.instant();
        var suggestions = suggestions(suggestionRows,now);
        var sourceTaskIds = new LinkedHashSet<String>();
        statisticsRows.forEach(t->sourceTaskIds.add(s(t,"id")));
        suggestionRows.forEach(t->sourceTaskIds.add(s(t,"id")));
        var result = new LinkedHashMap<String,Object>();
        result.put("mode","rule_based"); result.put("method","local_proportional_schedule_rules"); result.put("modelUsed",false);
        result.put("statisticsScope",scope.statisticsScope()); result.put("statisticsScopeLabel",scopeLabel(scope.statisticsScope()));
        result.put("keywordScope",scope.statisticsScope()); result.put("suggestionScope",scope.suggestionScope());
        result.put("suggestionScopeLabel",scopeLabel(scope.suggestionScope())); result.put("requestedScope",scope.requestedScope());
        result.put("authzVersion",a.authzVersion()); result.put("summary",summary); result.put("suggestions",suggestions);
        result.put("sourceTaskIds",List.copyOf(sourceTaskIds)); result.put("generatedAt",now.toString());
        String jobId = id();
        db.update("INSERT INTO ai_jobs(id,organization_id,requested_by,status,scope_type,result_json,completed_at) VALUES(?,?,?,'completed',?,?,UTC_TIMESTAMP(6))",jobId,a.organizationId(),a.id(),"role_scoped",db.json(result));
        events.record(a,null,"analysis.completed",List.of(),Map.of("jobId",jobId,"mode","rule_based",
                "statisticsScope",scope.statisticsScope(),"suggestionScope",scope.suggestionScope()));
        return Map.of("jobId",jobId,"status","completed","mode","rule_based");
    }

    public Map<String,Object> aiJob(Actor a, String jobId) {
        business(a);
        var row = db.one("SELECT * FROM ai_jobs WHERE organization_id=? AND requested_by=? AND id=?",a.organizationId(),a.id(),jobId);
        var result = db.parse(s(row,"resultJson"));
        Set<String> currentIds;
        if ("role_scoped".equals(s(row,"scopeType"))) {
            Object storedVersion=result.get("authzVersion");
            if (storedVersion instanceof Number number && number.longValue()!=a.authzVersion()) {
                throw new ApiException(409,"ANALYSIS_SCOPE_CHANGED","授权范围已变化，请重新生成分析");
            }
            AnalysisScope current=analysisScope(a,Optional.ofNullable(s(result,"requestedScope")).orElse("auto"));
            if (!Objects.equals(current.statisticsScope(),s(result,"statisticsScope"))
                    || !Objects.equals(current.suggestionScope(),s(result,"suggestionScope"))) {
                throw new ApiException(409,"ANALYSIS_SCOPE_CHANGED","授权范围已变化，请重新生成分析");
            }
            currentIds=new HashSet<>();
            visibleTasks(a,current.statisticsQuery()).forEach(t->currentIds.add(s(t,"id")));
            visibleTasks(a,current.suggestionQuery()).forEach(t->currentIds.add(s(t,"id")));
        } else {
            // Backward compatibility for jobs written before role-scoped analysis was introduced.
            currentIds=new HashSet<>(visibleTasks(a,s(row,"scopeType")).stream().map(t->s(t,"id")).toList());
        }
        if (result.get("sourceTaskIds") instanceof Collection<?> ids && !currentIds.containsAll(ids)) {
            throw new ApiException(409,"ANALYSIS_SCOPE_CHANGED","可见范围已变化，请重新生成分析");
        }
        row.remove("resultJson"); result.remove("sourceTaskIds"); row.put("result",result);
        return row;
    }

    public Map<String,Object> adminTeams(Actor a,Map<String,String> filters) {
        access.requireAdmin(a);
        return page(db.list("SELECT id,name,parent_id FROM teams WHERE organization_id=? ORDER BY name,id",a.organizationId()),filters);
    }

    public Map<String,Object> audit(Actor a, Map<String,String> filters) {
        access.requireAdmin(a);
        var list = db.list("SELECT a.*,u.display_name actor_name FROM audit_logs a JOIN users u ON u.id=a.actor_id AND u.organization_id=a.organization_id WHERE a.organization_id=? ORDER BY a.created_at DESC,a.id",a.organizationId()).stream()
            .filter(row->!filters.containsKey("action") || filters.get("action").equals(s(row,"action")))
            .filter(row->!filters.containsKey("objectId") || filters.get("objectId").equals(s(row,"objectId")))
            .map(row->{row.put("details",db.parse(s(row,"detailsJson")));row.remove("detailsJson");return row;}).toList();
        return page(list,filters);
    }

    public boolean canReadTask(Actor a,String taskId,boolean includeApproval) {
        if (taskId == null) return true;
        var task = db.find("SELECT * FROM tasks WHERE organization_id=? AND id=?",a.organizationId(),taskId);
        if (task == null) return false;
        if (s(task,"currentVersionId") != null) {
            var version = db.find("SELECT * FROM task_versions WHERE organization_id=? AND task_id=? AND id=?",a.organizationId(),taskId,s(task,"currentVersionId"));
            var ids = db.list("SELECT user_id FROM task_version_assignees WHERE organization_id=? AND version_id=?",a.organizationId(),s(task,"currentVersionId")).stream().map(r->s(r,"userId")).toList();
            if (access.canSeeTask(a,task,version,ids)) return true;
        }
        if(includeApproval) {
            for(var request:db.list("SELECT id FROM approval_requests WHERE organization_id=? AND task_id=?",a.organizationId(),taskId)) {
                try {tasks.approval(a,s(request,"id"));return true;}
                catch(ApiException ignored) { /* Recompute the current reviewer through the task authority. */ }
            }
        }
        return false;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String,Object>> visibleTasks(Actor a,String scope) {
        business(a);
        if (!Set.of("self","visible").contains(scope)) throw bad("scope 只能为 self 或 visible");
        var rows = new ArrayList<Map<String,Object>>();
        int offset = 0;
        while (true) {
            var result = tasks.list(a,Map.of("limit","100","offset",Integer.toString(offset)));
            var items = (List<Map<String,Object>>) result.getOrDefault("items",List.of());
            rows.addAll(items);
            if (items.size()<100) break;
            offset+=items.size();
        }
        if (scope.equals("self")) rows.removeIf(t -> !a.id().equals(s(t,"originalCreatorId"))
                && !(t.get("assigneeIds") instanceof Collection<?> ids && ids.contains(a.id())));
        return rows;
    }

    private Map<String,Object> summarize(List<Map<String,Object>> rows) {
        var result = new LinkedHashMap<String,Object>(); Instant now=clock.instant();
        result.put("total",rows.size());
        for (String state : List.of("todo","doing","done")) result.put(state,rows.stream().filter(t->state.equals(s(t,"executionState"))).count());
        result.put("frozen",rows.stream().filter(t->Boolean.TRUE.equals(t.get("frozen"))).count());
        result.put("pendingComplete",rows.stream().filter(t->Boolean.TRUE.equals(t.get("pending")) && "complete".equals(s(t,"pendingKind"))).count());
        result.put("overdue",rows.stream().filter(t->!"done".equals(s(t,"executionState"))).filter(t->{var due=instant(s(t,"dueAt"));return due!=null&&due.isBefore(now);}).count());
        var priority=new LinkedHashMap<String,Object>();
        for(String level:List.of("urgent","high","medium","low"))
            priority.put(level,rows.stream().filter(t->level.equals(s(t,"priority"))).count());
        result.put("priority",priority);
        result.put("ruleBased",true); result.put("generatedAt",now.toString());
        return result;
    }

    /** Analysis ranges are derived from the current authority snapshot; callers cannot broaden them. */
    private AnalysisScope analysisScope(Actor a,String requested) {
        business(a);
        String normalized="visible".equals(requested)?"auto":requested;
        if (!Set.of("auto","self").contains(normalized)) throw bad("scope 只能为 auto、visible 或 self");
        if ("self".equals(normalized)) return new AnalysisScope("self","self","self","self","self");
        String statisticsScope=switch(a.scope("task_view")) {
            case "company" -> "company";
            case "department" -> "department";
            default -> "self";
        };
        String statisticsQuery="self".equals(statisticsScope)?"self":"visible";
        String suggestionScope="department".equals(statisticsScope)?"self":statisticsScope;
        String suggestionQuery="self".equals(suggestionScope)?"self":"visible";
        return new AnalysisScope(statisticsScope,statisticsQuery,suggestionScope,suggestionQuery,"auto");
    }

    private static String scopeLabel(String scope) {
        return switch(scope) {case "company"->"全公司";case "department"->"本部门";default->"本人";};
    }

    /** Real title/description extraction; the vocabulary is learned from the authorized task text. */
    static List<Map<String,Object>> keywords(List<Map<String,Object>> rows) {
        Map<String,Integer> counts=new LinkedHashMap<>();
        Set<String> primaryTokens=new HashSet<>();
        for(var row:rows) {
            String text=String.join(" ",Objects.toString(row.get("title"),""),Objects.toString(row.get("description"),""))
                    .toLowerCase(Locale.ROOT);
            var han=HAN_RUN.matcher(text);
            StringBuffer nonHan=new StringBuffer();
            while(han.find()) {
                String value=han.group(); addChineseKeywords(counts,primaryTokens,value);
                han.appendReplacement(nonHan," ");
            }
            han.appendTail(nonHan);
            var other=OTHER_WORD.matcher(nonHan.toString());
            while(other.find()) {
                String value=other.group(); addKeyword(counts,value); primaryTokens.add(value.toLowerCase(Locale.ROOT));
            }
        }
        return counts.entrySet().stream()
                // Prefer complete text tokens over fallback CJK n-grams, then rank by real frequency.
                .sorted(Comparator.<Map.Entry<String,Integer>>comparingInt(entry->primaryTokens.contains(entry.getKey())?1:0).reversed()
                        .thenComparing(Comparator.<Map.Entry<String,Integer>>comparingInt(Map.Entry::getValue).reversed())
                        .thenComparing((left,right)->Integer.compare(right.getKey().length(),left.getKey().length()))
                        .thenComparing(Map.Entry::getKey))
                .limit(24)
                .map(entry->Map.<String,Object>of("word",entry.getKey(),"count",entry.getValue()))
                .toList();
    }

    private static void addChineseKeywords(Map<String,Integer> counts,Set<String> primaryTokens,String value) {
        if(value.length()<=12) {addKeyword(counts,value);primaryTokens.add(value);}
        int max=Math.min(3,value.length());
        for(int size=2;size<=max;size++) {
            for(int start=0;start+size<=value.length();start++) addKeyword(counts,value.substring(start,start+size));
        }
    }

    private static void addKeyword(Map<String,Integer> counts,String word) {
        String value=word.strip().toLowerCase(Locale.ROOT);
        if(value.length()<2 || KEYWORD_STOP_WORDS.contains(value)) return;
        counts.merge(value,1,Integer::sum);
    }

    /** Rule-only advice: proportional deadline nodes, overlapping schedules and high priorities. */
    static List<Map<String,Object>> suggestions(List<Map<String,Object>> rows,Instant now) {
        List<Map<String,Object>> active=rows.stream()
                .filter(t->!Boolean.TRUE.equals(t.get("frozen")) && !"done".equals(s(t,"executionState"))).toList();
        var result=new ArrayList<Map<String,Object>>();
        for(var task:active) {
            Instant start=instant(s(task,"startAt")),due=instant(s(task,"dueAt"));
            ReminderService.Node node=start==null||due==null?null:ReminderService.chooseNode(start,due,now);
            if(node!=null) {
                boolean overdue="overdue".equals(node.node());
                String rule=overdue?"overdue":"remaining_"+node.node()+"_percent";
                String message=overdue?"任务已逾期，请确认未完成事项与下一步安排。"
                        :"任务已到剩余工期 "+node.node()+"% 节点，请确认进展与所需资源。";
                result.add(suggestion(rule,task,List.of(task),message,node.node(),node.at()));
            }
        }
        int conflictCount=0;
        conflicts: for(int left=0;left<active.size();left++) {
            var first=active.get(left); Instant firstStart=instant(s(first,"startAt")),firstDue=instant(s(first,"dueAt"));
            if(firstStart==null||firstDue==null||!firstStart.isBefore(firstDue)) continue;
            for(int right=left+1;right<active.size();right++) {
                var second=active.get(right); Instant secondStart=instant(s(second,"startAt")),secondDue=instant(s(second,"dueAt"));
                if(secondStart==null||secondDue==null||!secondStart.isBefore(secondDue)) continue;
                if(firstStart.isBefore(secondDue)&&secondStart.isBefore(firstDue)) {
                    result.add(suggestion("schedule_conflict",first,List.of(first,second),
                            "任务《"+s(first,"title")+"》与《"+s(second,"title")+"》排期重叠，请确认优先级或协调资源。",null,null));
                    if(++conflictCount>=50) break conflicts;
                }
            }
        }
        for(var task:active) {
            String priority=s(task,"priority");
            if(Set.of("urgent","high").contains(priority)) {
                result.add(suggestion("high_priority",task,List.of(task),
                        "urgent".equals(priority)?"任务紧急程度为“紧急”，建议优先确认负责人和处理计划。":"任务紧急程度为“高”，建议预留处理时间并持续跟进。",null,null));
            }
        }
        return result;
    }

    private static Map<String,Object> suggestion(String rule,Map<String,Object> primary,List<Map<String,Object>> sources,
                                                  String message,String reminderNode,Instant scheduledAt) {
        var value=new LinkedHashMap<String,Object>();
        value.put("rule",rule); value.put("taskId",s(primary,"id")); value.put("title",s(primary,"title")); value.put("message",message);
        value.put("sourceTaskIds",sources.stream().map(t->s(t,"id")).toList());
        value.put("sources",sources.stream().map(WorkspaceService::analysisSource).toList());
        if(reminderNode!=null)value.put("reminderNode",reminderNode);
        if(scheduledAt!=null)value.put("scheduledAt",scheduledAt.toString());
        return value;
    }

    private static Map<String,Object> analysisSource(Map<String,Object> task) {
        var value=new LinkedHashMap<String,Object>();
        for(String key:List.of("id","title","priority","startAt","dueAt")) value.put(key,task.get(key));
        return value;
    }

    private record AnalysisScope(String statisticsScope,String statisticsQuery,String suggestionScope,
                                 String suggestionQuery,String requestedScope) {}

    private Map<String,Object> ownedLog(Actor a,String logId) {
        return db.one("SELECT * FROM work_logs WHERE organization_id=? AND author_id=? AND id=? FOR UPDATE",a.organizationId(),a.id(),logId);
    }
    private Map<String,Object> safeLog(Actor a,Map<String,Object> row,LocalDate today) {
        row.remove("organizationId");
        String taskId=s(row,"taskId");
        if (taskId!=null && !canReadTask(a,taskId,false)) row.remove("taskId");
        row.put("editable",a.id().equals(s(row,"authorId"))
                && LocalDate.parse(s(row,"businessDate")).equals(today));
        return row;
    }
    private Map<String,Object> findLog(Actor a,LocalDate date) {
        return db.find("SELECT id,row_version,business_date FROM work_logs WHERE organization_id=? AND author_id=? AND business_date=?",
                a.organizationId(),a.id(),java.sql.Date.valueOf(date));
    }
    private static ApiException logExists(Map<String,Object> row) {
        return new ApiException(409,"WORK_LOG_EXISTS","今天已有日志，请打开已有记录编辑",
                Map.of("logId",s(row,"id"),"rowVersion",n(row,"rowVersion"),"businessDate",s(row,"businessDate")));
    }
    private LocalDate today(Actor a) {return clock.instant().atZone(zone(a)).toLocalDate();}
    private boolean notificationVisible(Actor a,Map<String,Object> row) {return canReadTask(a,s(row,"taskId"),true);}
    private Map<String,Object> safeNotification(Map<String,Object> row) {row.remove("organizationId");row.remove("recipientId");row.put("rowVersion",notificationVersion(row));return row;}
    public static long notificationVersion(Map<String,Object> row) {return 1+(row.get("readAt")==null?0:1)+(row.get("hiddenAt")==null?0:2);}
    private Map<String,Object> safeUser(Map<String,Object> row) {
        var safe=new LinkedHashMap<String,Object>();
        for(String key:List.of("id","username","displayName","role","teamId","teamName","managerId","rankLevel","active")) safe.put(key,row.get(key));
        return safe;
    }
    private ZoneId zone(Actor a) {return ZoneId.of(s(db.one("SELECT time_zone FROM organizations WHERE id=?",a.organizationId()),"timeZone"));}
    private LocalDate dateFor(Actor a,Map<String,Object> body,String key) {
        String value=nullable(body,key); return value==null?clock.instant().atZone(zone(a)).toLocalDate():optionalDate(value);
    }
    private static LocalDate optionalDate(String value) {try{return value==null?null:LocalDate.parse(value);}catch(Exception e){throw bad("日期必须为 YYYY-MM-DD");}}
    static Instant instant(String value) {try{return value==null?null:Instant.parse(value);}catch(Exception e){return null;}}
    static boolean enabled(Map<String,Object> row) {Object v=row.get("active");return Boolean.TRUE.equals(v)||"1".equals(String.valueOf(v));}
    static void business(Actor a) {if("admin".equals(a.role()))throw new ApiException(403,"BUSINESS_ROLE_REQUIRED","管理员请使用管理端接口");}
    static String nullable(Map<String,Object> body,String key) {String value=s(body,key);return value==null||value.isBlank()?null:value.trim();}
    static String required(Map<String,Object> body,String key,int max) {if(!(body.get(key) instanceof String))throw bad(key+" 必须为文字");String value=nullable(body,key);if(value==null||value.length()>max)throw bad(key+" 不能为空且不得超过 "+max+" 字");return value;}
    static void allowed(Map<String,Object> body,Set<String> keys) {if(!keys.containsAll(body.keySet()))throw bad("请求含不支持的字段");}
    static ApiException bad(String message) {return new ApiException(400,"INVALID_INPUT",message);}
    static ApiException forbidden(String message) {return new ApiException(403,"FORBIDDEN",message);}
    static ApiException conflict(String code,String message) {return new ApiException(409,code,message);}
    static Map<String,Object> page(List<Map<String,Object>> rows,Map<String,String> filters) {
        int limit=number(filters,"limit",20,1,100),offset=number(filters,"offset",0,0,Integer.MAX_VALUE);
        int start=Math.min(offset,rows.size()),end=(int)Math.min((long)start+limit,rows.size());
        var result=new LinkedHashMap<String,Object>();result.put("items",rows.subList(start,end));result.put("total",rows.size());result.put("nextOffset",end<rows.size()?end:null);return result;
    }
    static int number(Map<String,String> filters,String key,int fallback,int min,int max) {try{int value=Integer.parseInt(filters.getOrDefault(key,Integer.toString(fallback)));if(value<min||value>max)throw new NumberFormatException();return value;}catch(Exception e){throw bad(key+" 超出允许范围");}}
}
