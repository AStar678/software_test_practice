package cn.pandora.workspace;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.*;
import cn.pandora.task.Tags;
import cn.pandora.task.TaskService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

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
    private final Tags tags;

    /** Logs may be written for the company's today plus the previous two business days (chapter 7.1). */
    private static final int LOG_BACKFILL_DAYS = 2;
    /** Editing and deleting share one real freeze instant: first creation plus 24 hours. */
    private static final Duration LOG_FREEZE_WINDOW = Duration.ofHours(24);

    /** Test seam: the tag catalogue is derived from the same Db when constructed directly. */
    public WorkspaceService(Db db, Access access, TaskService tasks, Events events, Clock clock) {
        this(db, access, tasks, events, clock, new Tags(db, access, new cn.pandora.auth.CompanyTree(db)));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceService(Db db, Access access, TaskService tasks, Events events, Clock clock, Tags tags) {
        this.db = db; this.access = access; this.tasks = tasks; this.events = events; this.clock = clock;
        this.tags = tags;
    }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> me(Actor a) {
        return access.readScope(a.organizationId(), () -> meRead(a));
    }

    private Map<String,Object> meRead(Actor a) {
        business(a);
        var result=safeUser(employee(a,a.id()));
        var contacts=db.one("SELECT phone,email,avatar,profile_version FROM users WHERE id=? AND organization_id=? AND active=1",a.id(),a.organizationId());
        for(String key:List.of("phone","email","avatar","profileVersion")) result.put(key,contacts.get(key));
        var company=db.one("SELECT name,time_zone FROM organizations WHERE id=?",a.organizationId());
        result.put("organizationName",company.get("name"));
        result.put("organizationTimeZone",company.get("timeZone"));
        result.put("canManageTeam",false);
        return result;
    }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> users(Actor a, Map<String,String> filters, boolean admin) {
        return access.readScope(a.organizationId(), () -> usersRead(a,filters,admin));
    }

    private Map<String,Object> usersRead(Actor a, Map<String,String> filters, boolean admin) {
        if(admin) {access.requireAdmin(a);access.requireCurrent(a);} else business(a);
        String query=filters.getOrDefault("q","").strip().toLowerCase(Locale.ROOT);
        var allowed=access.employeeDirectory(a,admin).stream()
                .filter(row->admin || access.canSeePerson(a,row))
                .filter(row->query.isEmpty() || Objects.toString(row.get("displayName"),"").toLowerCase(Locale.ROOT).contains(query))
                .map(this::safeUser).toList();
        return page(allowed,filters);
    }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> person(Actor a, String userId) {
        return access.readScope(a.organizationId(), () -> personRead(a,userId));
    }

    private Map<String,Object> personRead(Actor a, String userId) {
        business(a);
        var row=employee(a,userId);
        if(!access.canSeePerson(a,row)) throw ApiException.notFound();
        var result=safeUser(row);
        result.put("canReadLogs",access.canReadLogAuthor(a,userId));
        result.put("canSetHandoverPreset",access.canSetHandoverPreset(a,row));
        if(access.canReadPhone(a,row)) result.put("phone",db.one(
                "SELECT phone FROM users WHERE id=? AND organization_id=? AND active=1",userId,a.organizationId()).get("phone"));
        return result;
    }

    /** Every actual descendant, including team heads and their employees below a department head. */
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> reports(Actor a) {
        return access.readScope(a.organizationId(), () -> reportsRead(a));
    }

    private Map<String,Object> reportsRead(Actor a) {
        business(a);
        var items=access.employeeDirectory(a,false).stream()
                .filter(row->!a.id().equals(s(row,"id")) && access.isManagerOf(a,s(row,"id")))
                .map(row->{var item=safeUser(row);item.put("canReadLogs",access.canReadLogAuthor(a,s(row,"id")));return item;})
                .toList();
        return Map.of("items",items);
    }

    private Map<String,Object> employee(Actor a,String id) {
        return access.employeeDirectory(a,false).stream().filter(row->id.equals(s(row,"id")))
                .findFirst().orElseThrow(ApiException::notFound);
    }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> logs(Actor a, Map<String,String> filters) {
        return access.readScope(a.organizationId(), () -> logsRead(a,filters));
    }

    private Map<String,Object> logsRead(Actor a, Map<String,String> filters) {
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
        var result = db.list("SELECT w.id,w.author_id,w.business_date FROM work_logs w JOIN users u ON u.id=w.author_id AND u.organization_id=w.organization_id WHERE w.organization_id=? AND w.deleted_at IS NULL ORDER BY w.business_date DESC,w.created_at DESC,w.id",a.organizationId()).stream()
            .filter(row -> allowedIds.contains(s(row,"authorId")))
            .filter(row -> from == null || !LocalDate.parse(s(row,"businessDate")).isBefore(from))
            .filter(row -> to == null || !LocalDate.parse(s(row,"businessDate")).isAfter(to))
            .toList();
        var paged = page(result,filters);
        @SuppressWarnings("unchecked") var selectedMetadata = (List<Map<String,Object>>) paged.get("items");
        var logRows = new HashMap<String,Map<String,Object>>();
        if(!selectedMetadata.isEmpty()) {
            var args=new ArrayList<Object>();args.add(a.organizationId());selectedMetadata.forEach(row->args.add(s(row,"id")));
            for(var row:db.list("SELECT w.*,u.display_name author_name FROM work_logs w JOIN users u ON u.id=w.author_id AND u.organization_id=w.organization_id "
                    +"WHERE w.organization_id=? AND w.id IN ("+String.join(",",Collections.nCopies(selectedMetadata.size(),"?"))+")",args.toArray())) logRows.put(s(row,"id"),row);
        }
        var selected=selectedMetadata.stream().map(row->logRows.get(s(row,"id"))).filter(Objects::nonNull).toList();
        var linked = selected.stream().map(row -> s(row,"taskId")).filter(Objects::nonNull).toList();
        Set<String> readable = linked.isEmpty() ? Set.of() : tasks.readableTaskIds(a,linked);
        var tagRows = rowsById(a,"tags","*",selected.stream().map(row -> s(row,"tagId")).toList());
        paged.put("items",selected.stream().map(row -> safeLog(a,new LinkedHashMap<>(row),readable,tagRows)).toList());
        return paged;
    }

    /**
     * Author directory for the log page (chapter 7.3): only people inside the reader's own log range,
     * carrying their real department and team. Each level can be searched independently — department,
     * then team, then person — and every count is computed after the log-authority filter, so an
     * unauthorized colleague can never be inferred from a candidate, a count or a tree edge.
     */
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> logAuthors(Actor a, Map<String,String> filters) {
        return access.readScope(a.organizationId(), () -> logAuthorsRead(a,filters));
    }

    private Map<String,Object> logAuthorsRead(Actor a, Map<String,String> filters) {
        business(a);
        String query = filters.getOrDefault("q","").strip().toLowerCase(Locale.ROOT);
        String departmentQuery = filters.getOrDefault("departmentQ","").strip().toLowerCase(Locale.ROOT);
        String teamQuery = filters.getOrDefault("teamQ","").strip().toLowerCase(Locale.ROOT);
        String department = optionalId(filters.get("departmentId"), "departmentId");
        String team = optionalId(filters.get("teamId"), "teamId");
        var allowed = new LinkedHashSet<>(access.logAuthorIds(a));
        var rows=access.employeeDirectory(a,false).stream()
                .filter(u->allowed.contains(s(u,"id"))).toList();
        // The department/team levels themselves are derived from the authorized authors only.
        Map<String,String> departments = new LinkedHashMap<>();
        Map<String,Map<String,Object>> teams = new LinkedHashMap<>();
        Map<String,Integer> departmentCounts = new LinkedHashMap<>();
        Map<String,Integer> teamCounts = new LinkedHashMap<>();
        for (var u : rows) {
            String departmentId = s(u,"departmentId");
            String departmentName = s(u,"departmentName") == null ? "未分配部门" : s(u,"departmentName");
            String key = departmentId == null ? "__none__" : departmentId;
            departments.putIfAbsent(key, departmentName);
            departmentCounts.merge(key, 1, Integer::sum);
            String teamId = s(u,"teamId");
            if (teamId != null && !teams.containsKey(teamId)) {
                Map<String,Object> node = new LinkedHashMap<>();
                node.put("id", teamId);
                node.put("name", s(u,"teamName"));
                node.put("departmentId", s(u,"departmentId"));
                teams.put(teamId, node);
                teamCounts.put(teamId, 0);
            }
            if (teamId != null) teamCounts.merge(teamId, 1, Integer::sum);
        }
        var items = rows.stream()
            .filter(u -> department == null || department.equals(departmentKey(u)))
            .filter(u -> team == null || team.equals(s(u,"teamId")))
            .filter(u -> query.isEmpty()
                || s(u,"displayName").toLowerCase(Locale.ROOT).contains(query))
            .map(u -> {
                Map<String,Object> item = new LinkedHashMap<>();
                for (String key : List.of("id","displayName","placementType","positionId","positionName","managerId","departmentId","departmentName","teamId","teamName")) item.put(key,u.get(key));
                item.put("self", a.id().equals(s(u,"id")));
                return item;
            }).toList();
        var departmentItems = departments.entrySet().stream()
            .filter(entry -> departmentQuery.isEmpty() || entry.getValue().toLowerCase(Locale.ROOT).contains(departmentQuery))
            .map(entry -> {
                Map<String,Object> node = new LinkedHashMap<>();
                node.put("id", entry.getKey());
                node.put("name", entry.getValue());
                node.put("count", departmentCounts.getOrDefault(entry.getKey(), 0));
                return node;
            }).toList();
        var teamItems = teams.values().stream()
            .filter(node -> department == null || department.equals(node.get("departmentId")))
            .filter(node -> teamQuery.isEmpty() || Objects.toString(node.get("name"),"").toLowerCase(Locale.ROOT).contains(teamQuery))
            .map(node -> {
                Map<String,Object> item = new LinkedHashMap<>(node);
                item.put("count", teamCounts.getOrDefault(s(node,"id"), 0));
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
        result.put("departments", departmentItems);
        result.put("teams", teamItems);
        result.put("total", rows.size());
        result.put("matched", items.size());
        result.put("empty", items.isEmpty());
        return result;
    }

    private static String optionalId(String value,String name) {
        if(value==null||value.isBlank())return null;
        String id=value.trim();
        if(id.length()>64||!id.matches("[A-Za-z0-9_-]+"))throw bad(name+" 无效");
        return id;
    }

    private static String departmentKey(Map<String,Object> row) {
        String departmentId = s(row,"departmentId");
        return departmentId == null ? "__none__" : departmentId;
    }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> log(Actor a, String logId) {
        return access.readScope(a.organizationId(), () -> logRead(a,logId));
    }

    private Map<String,Object> logRead(Actor a, String logId) {
        business(a);
        var row = db.one("SELECT w.*,u.display_name author_name FROM work_logs w JOIN users u ON u.id=w.author_id AND u.organization_id=w.organization_id WHERE w.organization_id=? AND w.id=? AND w.deleted_at IS NULL",a.organizationId(),logId);
        if (!access.canReadLogAuthor(a, s(row,"authorId"))) throw ApiException.notFound();
        return safeLog(a,row);
    }

    public Map<String,Object> createLog(Actor a, Map<String,Object> body) {
        business(a);
        allowed(body,Set.of("body","businessDate","taskId","tagId"));
        String text = required(body,"body",10000);
        LocalDate today = today(a);
        LocalDate date = body.containsKey("businessDate") ? dateFor(a,body,"businessDate") : today;
        if (date.isAfter(today)) throw bad("不能新建未来日期的日志");
        if (date.isBefore(today.minusDays(LOG_BACKFILL_DAYS))) throw bad("只能补写公司今天、昨天和前天的日志");
        String taskId = nullable(body,"taskId");
        if (taskId != null) tasks.detail(a,taskId);
        // A tag belongs to the company catalogue and may be left unset; only one tag per log.
        Map<String,Object> tag = tags.resolveForWrite(a, nullable(body,"tagId"), null);
        String tagId = tag == null ? null : s(tag,"id");
        var existing = findLog(a, date);
        if (existing != null && s(existing, "id") != null) {
            // The day slot survives a delete (chapter 1.2): writing again restores that same row,
            // keeps the real first-creation time and gives the writer a new row version instead of a
            // fresh freeze window. A live row is still a real conflict.
            if (existing.get("deletedAt") == null) throw logExists(existing);
            // Recreating a deleted day is a write like any other: the original first-creation instant
            // is the only freeze base, so a slot whose 24 hours are over stays closed (chapter 7.2).
            requireWritable(existing);
            int restored = db.update("UPDATE work_logs SET body=?,task_id=?,tag_id=?,deleted_at=NULL,row_version=row_version+1,updated_at=UTC_TIMESTAMP(6) "
                    + "WHERE organization_id=? AND author_id=? AND id=? AND deleted_at IS NOT NULL",
                    text, taskId, tagId, a.organizationId(), a.id(), s(existing, "id"));
            if (restored != 1) throw conflict("WORK_LOG_CONFLICT","日志日位置已被并发修改，请刷新后重试");
            events.record(a,null,"log.restored",List.of(),Map.of("logId",s(existing,"id")));
            return Map.of("logId",s(existing,"id"),"rowVersion",n(existing,"rowVersion")+1,"businessDate",date.toString(),"restored",true);
        }
        String logId = id();
        try {
            db.update("INSERT INTO work_logs(id,organization_id,author_id,business_date,body,task_id,tag_id) VALUES(?,?,?,?,?,?,?)",logId,a.organizationId(),a.id(),java.sql.Date.valueOf(date),text,taskId,tagId);
        } catch (DuplicateKeyException duplicate) {
            var concurrent = findLog(a, date);
            if (concurrent != null && s(concurrent, "id") != null) throw logExists(concurrent);
            throw duplicate;
        }
        events.record(a,null,"log.created",List.of(),Map.of("logId",logId));
        return Map.of("logId",logId,"rowVersion",1,"businessDate",date.toString());
    }

    public Map<String,Object> changeLog(Actor a, String logId, String ifMatch, Map<String,Object> body) {
        business(a);
        allowed(body,Set.of("body","businessDate","taskId","tagId"));
        var row = ownedLog(a,logId);
        LocalDate rowDate = LocalDate.parse(s(row,"businessDate"));
        requireWritable(row);
        if (body.containsKey("businessDate")) {
            LocalDate requested = dateFor(a,body,"businessDate");
            if (!requested.equals(rowDate)) throw bad("日志日期不能修改");
        }
        Writes.checkVersion(ifMatch,n(row,"rowVersion"));
        String text = body.containsKey("body") ? required(body,"body",10000) : s(row,"body");
        String taskId = body.containsKey("taskId") ? nullable(body,"taskId") : s(row,"taskId");
        if (body.containsKey("taskId") && taskId != null) tasks.detail(a,taskId);
        Map<String,Object> tag = body.containsKey("tagId")
                ? tags.resolveForWrite(a,nullable(body,"tagId"),s(row,"tagId"))
                : tags.view(a,s(row,"tagId"));
        // An unchanged tag is kept verbatim even if its catalogue row cannot be resolved; only an
        // explicit request can clear the association.
        String tagId = tag != null ? s(tag,"id") : (body.containsKey("tagId") ? null : s(row,"tagId"));
        // Editing text never moves created_at, so the freeze instant is unchanged (chapter 7.1).
        db.update("UPDATE work_logs SET body=?,task_id=?,tag_id=?,row_version=row_version+1,updated_at=UTC_TIMESTAMP(6) WHERE id=? AND organization_id=?",text,taskId,tagId,logId,a.organizationId());
        events.record(a,null,"log.updated",List.of(),Map.of("logId",logId));
        return Map.of("logId",logId,"rowVersion",n(row,"rowVersion")+1,"businessDate",rowDate.toString());
    }

    public Map<String,Object> deleteLog(Actor a, String logId, String ifMatch) {
        business(a);
        var row = ownedLog(a,logId);
        requireWritable(row);
        Writes.checkVersion(ifMatch,n(row,"rowVersion"));
        // Logical delete keeps the author/day row (and its real created_at) so the slot cannot be
        // reused with a reset window; the row is excluded from every read path instead.
        int changed = db.update("UPDATE work_logs SET deleted_at=UTC_TIMESTAMP(6),row_version=row_version+1,updated_at=UTC_TIMESTAMP(6) "
                + "WHERE id=? AND organization_id=? AND author_id=? AND deleted_at IS NULL",
                logId, a.organizationId(), a.id());
        if (changed != 1) throw conflict("WORK_LOG_CONFLICT","日志已被删除，请刷新后重试");
        events.record(a,null,"log.deleted",List.of(),Map.of("logId",logId));
        return Map.of("logId",logId,"deleted",true,"rowVersion",n(row,"rowVersion")+1);
    }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> notifications(Actor a, Map<String,String> filters) {
        return access.readScope(a.organizationId(), () -> notificationsRead(a,filters));
    }

    private Map<String,Object> notificationsRead(Actor a, Map<String,String> filters) {
        String legacy=filters.get("unread");
        if(legacy!=null && !Set.of("true","false").contains(legacy)) throw new ApiException(400,"INVALID_NOTIFICATION_FILTER","unread须为true或false");
        String read=filters.getOrDefault("readStatus","true".equals(legacy)?"unread":"all");
        String category=filters.getOrDefault("category","all");
        if(!Set.of("all","unread","read").contains(read) || !Set.of("all","review","result","reminder","comment","other").contains(category))
            throw new ApiException(400,"INVALID_NOTIFICATION_FILTER","无效的通知筛选条件");
        if(legacy!=null && filters.containsKey("readStatus") && !("true".equals(legacy)?"unread":"all").equals(read))
            throw new ApiException(400,"INVALID_NOTIFICATION_FILTER","通知已读筛选条件冲突");
        Instant now = clock.instant();
        var rows = notificationMetadata(a,false);
        var readable = notificationReadableTasks(a,rows);
        var visible = rows.stream().filter(row -> notificationVisible(row,now,readable)).toList();
        var filtered=visible.stream().filter(row -> "all".equals(read) || ("unread".equals(read)==(row.get("readAt")==null)))
                .filter(row -> "all".equals(category) || category.equals(notificationMetadataCategory(a,row,now,readable))).toList();
        var result=page(filtered,filters);
        @SuppressWarnings("unchecked") var selected=(List<Map<String,Object>>)result.get("items");
        var complete=rowsById(a,"notifications","*",selected.stream().map(row->s(row,"id")).toList());
        var selectedRows=selected.stream().map(row->complete.get(s(row,"id"))).filter(Objects::nonNull).toList();
        var batch=notificationBatch(a,selectedRows);
        result.put("items",selectedRows.stream().map(row->safeNotification(a,row,now,batch)).toList());
        result.put("unreadCount",visible.stream().filter(row -> row.get("readAt")==null).count());
        return result;
    }

    /** Non-mutating detail read; opening a message goes through {@link #openNotification}. */
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> notification(Actor a, String notificationId) {
        return access.readScope(a.organizationId(), () -> notificationRead(a,notificationId));
    }

    private Map<String,Object> notificationRead(Actor a, String notificationId) {
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
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> notificationTask(Actor a, String notificationId) {
        return access.readScope(a.organizationId(), () -> notificationTaskRead(a,notificationId));
    }

    private Map<String,Object> notificationTaskRead(Actor a, String notificationId) {
        var row = db.one("SELECT * FROM notifications WHERE organization_id=? AND recipient_id=? AND id=? AND hidden_at IS NULL",a.organizationId(),a.id(),notificationId);
        Instant now = clock.instant();
        if (!notificationVisible(a,row,now)) throw ApiException.notFound();
        if (s(row,"taskId")==null) throw conflict("HISTORICAL_TASK_UNAVAILABLE","该消息没有可查看的任务");
        // The historical entry must apply the inbox's current-object mask too. In particular, a
        // delivered comment never grants historical access after its object permission is lost or
        // its comment is deleted. Ordinary task messages keep their existing read-only exception.
        if (!Boolean.TRUE.equals(safeNotification(a,row,now).get("canOpenTask"))) throw ApiException.notFound();
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
        var rows = notificationMetadata(a,true);
        var readable = notificationReadableTasks(a,rows);
        return rows.stream().filter(row -> notificationVisible(row,now,readable)).count();
    }

    private Map<String,Object> safeNotification(Actor a, Map<String,Object> row, Instant now) {
        return safeNotification(a,row,now,null);
    }

    private Map<String,Object> safeNotification(Actor a, Map<String,Object> row, Instant now, NotificationBatch batch) {
        var event = batch == null ? db.find("SELECT * FROM domain_events WHERE organization_id=? AND id=?",a.organizationId(),s(row,"eventId"))
                : batch.events.get(s(row,"eventId"));
        String objectType = s(row,"objectType"), objectId = s(row,"objectId");
        if (objectType == null && s(row,"taskId") != null) { objectType = "task"; objectId = s(row,"taskId"); }
        String eventType = s(row,"eventType");
        Map<String,Object> objectDetails = event == null || event.get("detailsJson")==null ? Map.of() : db.parse(s(event,"detailsJson"));
        // A comment message must be re-verified against the current object authority every time it is
        // read; a deleted comment keeps a placeholder and never exposes its excerpt (chapter 8.5).
        boolean objectReadable = objectType == null || (batch == null ? canReadEventObject(a,objectType,objectId,objectDetails) : batchObjectReadable(a,objectType,objectId,objectDetails,batch));
        boolean commentEvent = eventType != null && eventType.startsWith("comment.");
        // A deleted comment keeps a placeholder; a mere loss of authority uses the generic message.
        boolean commentGone = commentEvent && (batch == null ? eventObjectDeleted(a,objectType,objectId,objectDetails) : batchObjectDeleted(objectType,objectId,objectDetails,batch));
        // Comments have no historical-notification exception: losing the object authority now masks the
        // excerpt, while an ordinary task message keeps its delivered read-only historical entry.
        boolean commentMasked = commentEvent && !objectReadable;
        boolean revoked = event != null && event.get("revokedAt")!=null;
        // Copies masked at delivery must never regain the restricted title/summary from the event row.
        boolean contentMasked = Boolean.TRUE.equals(row.get("contentMasked"))
                || row.get("contentMasked") instanceof Number masked && masked.intValue() == 1;
        boolean objectOpen = !revoked && !contentMasked && !commentGone && !commentMasked;
        boolean canReadWithdrawnDetails = revoked && !contentMasked && !commentGone && !commentMasked
                && access.isManagerOf(a, s(event,"initiatorId"));
        Map<String,Object> details = event == null || event.get("detailsJson")==null ? Map.of() : db.parse(s(event,"detailsJson"));
        Instant occurred = event == null || event.get("occurredAt")==null ? null : Instant.parse(String.valueOf(event.get("occurredAt")));
        boolean manager = a.can("manage_notifications");
        boolean automatic = "scheduled_rule".equals(Objects.toString(details.get("origin"),"")) || (event != null && event.get("initiatorId")==null);
        boolean withinWithdrawal = occurred != null && !now.isBefore(occurred) && now.isBefore(occurred.plusSeconds(180));
        var view = new LinkedHashMap<String,Object>();
        for (String key : List.of("id","eventId","eventType","createdAt","deliveredAt","readAt","readonly","relationLost")) view.put(key,row.get(key));
        // A copy delivered before a later organization/assignment change keeps only the historical
        // task entry. Delivery-time flags cannot describe authority lost after delivery.
        if (!commentEvent && objectOpen && s(row,"taskId")!=null
                && row.get("deliveredAt")!=null && "event".equals(s(row,"source"))
                && !(batch == null ? canReadTask(a,s(row,"taskId"),true) : batch.readableWithApprovals.contains(s(row,"taskId")))) {
            view.put("readonly",true);
            view.put("relationLost",true);
        }
        view.put("taskId",objectOpen?row.get("taskId"):null);
        view.put("requestId",objectOpen?row.get("requestId"):null);
        if (revoked) {
            view.put("title",canReadWithdrawnDetails ? event.get("title") : null);
            view.put("summary",canReadWithdrawnDetails ? event.get("changeSummary") : "该通知已被撤回。");
            view.put("changeSummary",canReadWithdrawnDetails ? event.get("changeSummary") : null);
            view.put("readonly",true);
        } else if (contentMasked || commentGone || commentMasked) {
            // Ordinary event whose recipient lost task authority before delivery: keep only the generic
            // delivery message, with no restricted title, change summary, request metadata or task jump.
            view.put("title",null);
            // A masked copy must never reuse a stored excerpt: losing the object authority leaves only
            // the generic delivery notice, exactly like a comment that no longer exists.
            view.put("summary",commentGone ? "该评论已删除，正文不再展示。"
                    : "你的工作关系或访问范围已变化，请查看当前工作安排。");
            view.put("changeSummary",null);
            view.put("readonly",true);
        } else {
            view.put("title",row.get("title")!=null?row.get("title"):event==null?null:event.get("title"));
            view.put("summary",row.get("summary"));
            view.put("changeSummary",row.get("changeSummary")!=null?row.get("changeSummary"):event==null?null:event.get("changeSummary"));
        }
        view.put("revoked",revoked);
        view.put("withdrawn",revoked);
        view.put("canReadWithdrawnDetails",canReadWithdrawnDetails);
        view.put("expiresAt",row.get("expiresAt")!=null?row.get("expiresAt"):event==null?null:event.get("expiresAt"));
        view.put("rowVersion",notificationVersion(row));
        view.put("canWithdraw",!revoked && withinWithdrawal && (manager || (!automatic && event!=null && a.id().equals(s(event,"initiatorId")))));
        view.put("canOpenTask",objectOpen && s(row,"taskId")!=null);
        view.put("canReview",false);
        view.put("requestStatus",null);
        view.put("requestKind",null);
        view.put("objectType",objectOpen?objectType:null);
        view.put("objectId",objectOpen?objectId:null);
        view.put("focus",objectOpen && commentEvent ? "comments" : null);
        view.put("commentId",objectOpen && objectDetails.get("commentId") instanceof String id ? id : null);
        view.put("purpose",notificationPurpose(eventType));
        view.put("objectName",objectOpen ? (batch == null ? objectName(a,objectType,objectId,row,event) : batchObjectName(objectType,objectId,row,event,batch)) : null);
        String requestId = objectOpen ? s(row,"requestId") : null;
        if (requestId != null) {
            var request = batch == null ? db.find("SELECT id,kind,status,comment,decided_at,current_reviewer_id,applicable_deadline FROM approval_requests WHERE organization_id=? AND id=?",a.organizationId(),requestId)
                    : batch.requests.get(requestId);
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
        view.put("category",notificationCategory(view));
        return view;
    }

    /** Inbox counts and page boundaries need lifecycle metadata, never message bodies. */
    private List<Map<String,Object>> notificationMetadata(Actor a,boolean unreadOnly) {
        return db.list("SELECT n.id,n.event_id,n.task_id,n.hidden_at,n.expires_at,n.read_at,n.source,n.delivered_at,n.event_type,n.request_id,"
                + "r.status AS request_status,r.current_reviewer_id AS reviewer_id,r.applicable_deadline,"
                + "e.revoked_at AS event_revoked_at,e.expires_at AS event_expires_at FROM notifications n "
                + "LEFT JOIN domain_events e ON e.organization_id=n.organization_id AND e.id=n.event_id "
                + "LEFT JOIN approval_requests r ON r.organization_id=n.organization_id AND r.id=n.request_id "
                + "WHERE n.organization_id=? AND n.recipient_id=? AND n.hidden_at IS NULL"
                + (unreadOnly ? " AND n.read_at IS NULL" : "") + " ORDER BY n.created_at DESC,n.id",a.organizationId(),a.id());
    }

    private Set<String> notificationReadableTasks(Actor a,List<Map<String,Object>> rows) {
        var ids=rows.stream().filter(row -> row.get("eventRevokedAt")==null)
                .filter(row -> "pending".equals(s(row,"requestStatus")) || row.get("deliveredAt")==null || !"event".equals(s(row,"source")))
                .map(row -> s(row,"taskId")).filter(Objects::nonNull).toList();
        return ids.isEmpty() ? Set.of() : tasks.readableTaskIds(a,ids,true);
    }

    private static boolean notificationVisible(Map<String,Object> row,Instant now,Set<String> readable) {
        if(row.get("hiddenAt")!=null) return false;
        Object expires=row.get("expiresAt")!=null?row.get("expiresAt"):row.get("eventExpiresAt");
        if(expires!=null && !now.isBefore(Instant.parse(String.valueOf(expires)))) return false;
        return row.get("eventRevokedAt")!=null || s(row,"taskId")==null || readable.contains(s(row,"taskId"))
                || (row.get("deliveredAt")!=null && "event".equals(s(row,"source")));
    }

    /** Only this page's projections; mutable content and authority never survive the request. */
    private static final class NotificationBatch {
        Map<String,Map<String,Object>> events,requests,logs,comments,taskRows;
        Set<String> readableTasks,readableWithApprovals;
    }

    private NotificationBatch notificationBatch(Actor a,List<Map<String,Object>> rows) {
        var batch=new NotificationBatch();
        batch.events=rowsById(a,"domain_events","id,revoked_at,occurred_at,expires_at,initiator_id,title,change_summary,details_json",
                rows.stream().map(row -> s(row,"eventId")).toList());
        batch.requests=rowsById(a,"approval_requests","id,kind,status,comment,decided_at,current_reviewer_id,applicable_deadline",
                rows.stream().map(row -> s(row,"requestId")).toList());
        var taskIds=new LinkedHashSet<String>();
        var logIds=new LinkedHashSet<String>();
        var commentIds=new LinkedHashSet<String>();
        for(var row:rows) {
            String taskId=s(row,"taskId"),type=s(row,"objectType"),objectId=s(row,"objectId");
            if(taskId!=null) taskIds.add(taskId);
            if("task".equals(type) && objectId!=null) taskIds.add(objectId);
            if("log".equals(type) && objectId!=null) logIds.add(objectId);
            var event=batch.events.get(s(row,"eventId"));
            if(event!=null && event.get("detailsJson")!=null) {
                Object commentId=db.parse(s(event,"detailsJson")).get("commentId");
                if(commentId instanceof String id) commentIds.add(id);
            }
        }
        batch.logs=rowsById(a,"work_logs","id,author_id,business_date,deleted_at",logIds);
        batch.comments=rowsById(a,"task_log_comments","id,deleted_at",commentIds);
        batch.taskRows=rowsById(a,"tasks","id,current_version_id",taskIds);
        var versionRows=rowsById(a,"task_versions","id,title",batch.taskRows.values().stream().map(row->s(row,"currentVersionId")).toList());
        for(var task:batch.taskRows.values()) {
            var version=versionRows.get(s(task,"currentVersionId"));
            task.put("title",version==null?null:version.get("title"));
        }
        batch.readableTasks=taskIds.isEmpty()?Set.of():tasks.readableTaskIds(a,taskIds);
        batch.readableWithApprovals=taskIds.isEmpty()?Set.of():tasks.readableTaskIds(a,taskIds,true);
        return batch;
    }

    /** Company-bound, parameterized reads; chunking also bounds the maximum SQL placeholder count. */
    private Map<String,Map<String,Object>> rowsById(Actor a,String table,String projection,Collection<String> ids) {
        var selected=new ArrayList<>(new LinkedHashSet<>(ids.stream().filter(Objects::nonNull).toList()));
        Map<String,Map<String,Object>> result=new HashMap<>();
        for(int start=0;start<selected.size();start+=500) {
            var chunk=selected.subList(start,Math.min(start+500,selected.size()));
            var args=new ArrayList<Object>();args.add(a.organizationId());args.addAll(chunk);
            for(var row:db.list("SELECT "+projection+" FROM "+table+" WHERE organization_id=? AND id IN ("
                    +String.join(",",Collections.nCopies(chunk.size(),"?"))+")",args.toArray())) result.put(s(row,"id"),new LinkedHashMap<>(row));
        }
        return result;
    }

    private boolean batchObjectReadable(Actor a,String type,String id,Map<String,Object> details,NotificationBatch batch) {
        if("task".equals(type)) {
            var task=batch.taskRows.get(id);
            return task!=null && (s(task,"currentVersionId")==null ? batch.readableWithApprovals : batch.readableTasks).contains(id);
        }
        if("log".equals(type)) {
            var log=batch.logs.get(id);
            if(log==null || log.get("deletedAt")!=null) return false;
            if(details.get("commentId") instanceof String commentId) {
                var comment=batch.comments.get(commentId);
                if(comment==null || comment.get("deletedAt")!=null) return false;
            }
            return access.canReadLogAuthor(a,s(log,"authorId"));
        }
        return true;
    }

    private static boolean batchObjectDeleted(String type,String id,Map<String,Object> details,NotificationBatch batch) {
        if(id==null) return false;
        if(details.get("commentId") instanceof String commentId) {
            var comment=batch.comments.get(commentId);
            return comment==null || comment.get("deletedAt")!=null;
        }
        if("log".equals(type)) {
            var log=batch.logs.get(id);
            return log==null || log.get("deletedAt")!=null;
        }
        return "task".equals(type) && !batch.taskRows.containsKey(id);
    }

    private static String batchObjectName(String type,String id,Map<String,Object> row,Map<String,Object> event,NotificationBatch batch) {
        if(id==null) return null;
        if("log".equals(type)) {
            var log=batch.logs.get(id);
            return log==null?"日志":"日志 · "+s(log,"businessDate");
        }
        if("task".equals(type)) {
            String title=s(row,"title");
            if(title==null && event!=null) title=s(event,"title");
            if(title!=null) return title;
            var task=batch.taskRows.get(s(row,"taskId")==null?id:s(row,"taskId"));
            return task==null?null:s(task,"title");
        }
        return null;
    }

    /** Readable identity of the object a message is about; never a restricted proposal or body. */
    private String objectName(Actor a, String objectType, String objectId, Map<String,Object> row, Map<String,Object> event) {
        if (objectId == null) return null;
        if ("log".equals(objectType)) {
            var log = db.find("SELECT business_date FROM work_logs WHERE organization_id=? AND id=?",a.organizationId(),objectId);
            return log == null ? "日志" : "日志 · " + s(log,"businessDate");
        }
        if ("task".equals(objectType)) {
            String title = s(row,"title");
            if (title == null && event != null) title = s(event,"title");
            if (title != null) return title;
            String taskId = s(row,"taskId") == null ? objectId : s(row,"taskId");
            var task = db.find("SELECT v.title FROM tasks t JOIN task_versions v ON v.organization_id=t.organization_id AND v.id=t.current_version_id WHERE t.organization_id=? AND t.id=?",a.organizationId(),taskId);
            return task == null ? null : s(task,"title");
        }
        return null;
    }

    private String notificationMetadataCategory(Actor actor,Map<String,Object> row,Instant now,Set<String> readable) {
        Map<String,Object> classification=new HashMap<>(row);
        boolean deadlineOpen=row.get("applicableDeadline")==null || now.isBefore(Instant.parse(String.valueOf(row.get("applicableDeadline"))));
        classification.put("canReview",row.get("eventRevokedAt")==null && "pending".equals(s(row,"requestStatus"))
                && actor.id().equals(s(row,"reviewerId")) && deadlineOpen && readable.contains(s(row,"taskId")));
        return notificationCategory(classification);
    }

    static String notificationCategory(Map<String,Object> view) {
        if(Boolean.TRUE.equals(view.get("canReview"))) return "review";
        String type=Objects.toString(view.get("eventType"),"");
        if(type.startsWith("comment.")) return "comment";
        if(type.startsWith("reminder.") || type.startsWith("task.deadline.")) return "reminder";
        if(type.startsWith("task.") && (type.endsWith(".approved") || type.endsWith(".rejected") || type.endsWith(".withdrawn") || type.endsWith(".expired") || type.endsWith(".direct") || type.endsWith(".applied"))) return "result";
        return "other";
    }

    /** Human purpose of a message, independent of its body (chapter 8.6). */
    static String notificationPurpose(String eventType) {
        String type = eventType == null ? "" : eventType;
        if (type.startsWith("comment.")) return "新评论";
        if (type.startsWith("log.")) return "日志";
        if (type.startsWith("task.create.")) return type.endsWith(".submitted") ? "待创建审核" : "创建结果";
        if (type.startsWith("task.change.")) return type.endsWith(".submitted") ? "修改资料待审" : "修改结果";
        if (type.startsWith("task.progress.")) return type.endsWith(".submitted") ? "进展待审" : "进展结果";
        if (type.startsWith("task.complete.")) return type.endsWith(".submitted") ? "完成待审" : "完成结果";
        if (type.startsWith("task.reopen.")) return type.endsWith(".submitted") ? "重开待审" : "重开结果";
        if (type.startsWith("task.handover.")) return type.endsWith(".submitted") ? "交接待审" : "交接结果";
        if (type.startsWith("task.deadline.") || type.startsWith("reminder.")) return "截止提醒";
        if (type.startsWith("home_item.")) return "公司信息";
        return "工作通知";
    }

    /** Whether the business object (or the exact comment) a message refers to no longer exists. */
    public boolean eventObjectDeleted(Actor a, String objectType, String objectId, Map<String,Object> details) {
        // A copy that never carried an object reference (masked at delivery) proves nothing about
        // deletion, so it must not be presented as "the comment was deleted".
        if (objectId == null) return false;
        if (details != null && details.get("commentId") instanceof String commentId) {
            var comment = db.find("SELECT deleted_at FROM task_log_comments WHERE organization_id=? AND id=?",a.organizationId(),commentId);
            return comment == null || comment.get("deletedAt") != null;
        }
        if ("log".equals(objectType)) {
            return db.find("SELECT id FROM work_logs WHERE organization_id=? AND id=? AND deleted_at IS NULL",a.organizationId(),objectId) == null;
        }
        if ("task".equals(objectType)) {
            return db.find("SELECT id FROM tasks WHERE organization_id=? AND id=?",a.organizationId(),objectId) == null;
        }
        return false;
    }

    /** Delivery/open-time authority for a non-task object; the historical-notification exception never applies. */
    public boolean canReadEventObject(Actor a, String objectType, String objectId, Map<String,Object> details) {
        if ("log".equals(objectType)) {
            var log = db.find("SELECT * FROM work_logs WHERE organization_id=? AND id=? AND deleted_at IS NULL",a.organizationId(),objectId);
            if (log == null) return false;
            if (details != null && details.get("commentId") instanceof String commentId) {
                var comment = db.find("SELECT deleted_at FROM task_log_comments WHERE organization_id=? AND id=?",a.organizationId(),commentId);
                if (comment == null || comment.get("deletedAt") != null) return false;
            }
            return access.canReadLogAuthor(a, s(log,"authorId"));
        }
        if ("task".equals(objectType)) return canReadTaskForComments(a, objectId);
        return true;
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

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> home(Actor a) {
        return access.readScope(a.organizationId(), () -> homeRead(a));
    }

    private Map<String,Object> homeRead(Actor a) {
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

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> statistics(Actor a, Map<String,String> filters) {
        return access.readScope(a.organizationId(), () -> statisticsRead(a,filters));
    }

    private Map<String,Object> statisticsRead(Actor a, Map<String,String> filters) {
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
        result.put("scopeModel","fixed_positions_v1"); result.put("authzVersion",a.authzVersion()); result.put("summary",summary); result.put("suggestions",suggestions);
        result.put("sourceTaskIds",List.copyOf(sourceTaskIds)); result.put("generatedAt",now.toString());
        String jobId = id();
        db.update("INSERT INTO ai_jobs(id,organization_id,requested_by,status,scope_type,result_json,completed_at) VALUES(?,?,?,'completed',?,?,UTC_TIMESTAMP(6))",jobId,a.organizationId(),a.id(),"role_scoped",db.json(result));
        events.record(a,null,"analysis.completed",List.of(),Map.of("jobId",jobId,"mode","rule_based",
                "statisticsScope",scope.statisticsScope(),"suggestionScope",scope.suggestionScope()));
        return Map.of("jobId",jobId,"status","completed","mode","rule_based");
    }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> aiJob(Actor a, String jobId) {
        business(a);
        var row = db.one("SELECT * FROM ai_jobs WHERE organization_id=? AND requested_by=? AND id=?",a.organizationId(),a.id(),jobId);
        var result = db.parse(s(row,"resultJson"));
        if(!"fixed_positions_v1".equals(s(result,"scopeModel")) || !(result.get("authzVersion") instanceof Number stored)
                || stored.longValue()!=a.authzVersion())
            throw new ApiException(409,"ANALYSIS_SCOPE_CHANGED","授权范围已变化，请重新生成分析");
        AnalysisScope current=analysisScope(a,Optional.ofNullable(s(result,"requestedScope")).orElse("auto"));
        if(!Objects.equals(current.statisticsScope(),s(result,"statisticsScope"))
                || !Objects.equals(current.suggestionScope(),s(result,"suggestionScope")))
            throw new ApiException(409,"ANALYSIS_SCOPE_CHANGED","授权范围已变化，请重新生成分析");
        Set<String> currentIds=new HashSet<>();
        visibleTasks(a,current.statisticsQuery()).forEach(t->currentIds.add(s(t,"id")));
        visibleTasks(a,current.suggestionQuery()).forEach(t->currentIds.add(s(t,"id")));
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
        var list = db.list("SELECT a.*,COALESCE(u.display_name,ad.display_name) AS actor_name,p.account_type AS actor_account_type FROM audit_logs a JOIN principals p ON p.id=a.actor_id AND p.organization_id=a.organization_id LEFT JOIN users u ON u.id=p.id AND u.organization_id=p.organization_id LEFT JOIN admin_accounts ad ON ad.id=p.id AND ad.organization_id=p.organization_id WHERE a.organization_id=? ORDER BY a.created_at DESC,a.id",a.organizationId()).stream()
            .filter(row->!filters.containsKey("action") || filters.get("action").equals(s(row,"action")))
            .filter(row->!filters.containsKey("objectId") || filters.get("objectId").equals(s(row,"objectId")))
            .map(row->{row.put("details",db.parse(s(row,"detailsJson")));row.remove("detailsJson");return row;}).toList();
        return page(list,filters);
    }

    /**
     * Normal viewing authority for comments and comment messages. A published task is judged only by
     * its current effective version: an older approval request (whose base version may still list the
     * requester) must not keep a removed assignee inside the current object (chapter 8.4/8.5). Only an
     * unpublished creation falls back to its applicant/reviewer participants.
     */
    public boolean canReadTaskForComments(Actor a, String taskId) {
        if (taskId == null) return false;
        var task = db.find("SELECT * FROM tasks WHERE organization_id=? AND id=?", a.organizationId(), taskId);
        if (task == null) return false;
        if (s(task,"currentVersionId") == null) return canReadTask(a, taskId, true);
        return canReadTask(a, taskId, false);
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
                // A plain read probe: the transactional approval projection would mark this worker
                // transaction rollback-only when an unrelated request is legitimately not visible.
                if(tasks.canReadRequest(a,s(request,"id"))) return true;
            }
        }
        return false;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String,Object>> visibleTasks(Actor a,String scope) {
        business(a);
        if (!Set.of("self","visible","company","department","team").contains(scope)) throw bad("分析范围无效");
        var rows = new ArrayList<>(tasks.statisticsTasks(a,Map.of()));
        if (scope.equals("self")) rows.removeIf(t -> !a.id().equals(s(t,"originalCreatorId"))
                && !(t.get("assigneeIds") instanceof Collection<?> ids && ids.contains(a.id())));
        if(Set.of("department","team").contains(scope)) {
            var members=access.employeeDirectory(a,false).stream()
                    .filter(person->"department".equals(scope)
                            ? Objects.equals(a.departmentId(),s(person,"departmentId"))
                            : Objects.equals(a.teamId(),s(person,"teamId")))
                    .map(person->s(person,"id")).collect(java.util.stream.Collectors.toSet());
            rows.removeIf(task->!(task.get("assigneeIds") instanceof Collection<?> ids)
                    || ids.stream().noneMatch(members::contains));
        }
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
            case "team" -> "team";
            default -> "self";
        };
        String statisticsQuery=statisticsScope;
        String suggestionScope=Set.of("department","team").contains(statisticsScope)?"self":statisticsScope;
        String suggestionQuery=suggestionScope;
        return new AnalysisScope(statisticsScope,statisticsQuery,suggestionScope,suggestionQuery,"auto");
    }

    private static String scopeLabel(String scope) {
        return switch(scope) {case "company"->"全公司";case "department"->"本部门";case "team"->"本团队";default->"本人";};
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
        return db.one("SELECT * FROM work_logs WHERE organization_id=? AND author_id=? AND id=? AND deleted_at IS NULL FOR UPDATE",a.organizationId(),a.id(),logId);
    }
    private Map<String,Object> safeLog(Actor a,Map<String,Object> row) {
        return safeLog(a,row,null,null);
    }
    private Map<String,Object> safeLog(Actor a,Map<String,Object> row,Set<String> readable,Map<String,Map<String,Object>> tagRows) {
        row.remove("organizationId");
        String taskId=s(row,"taskId");
        if (taskId!=null && !(readable == null ? canReadTask(a,taskId,false) : readable.contains(taskId))) row.remove("taskId");
        Map<String,Object> tag = tagRows == null ? tags.view(a,s(row,"tagId")) : tags.view(tagRows.get(s(row,"tagId")));
        row.put("tagId", tag == null ? null : s(tag,"id"));
        row.put("tag", tag);
        Instant freezeAt = freezeAt(row);
        boolean frozen = freezeAt == null || !clock.instant().isBefore(freezeAt);
        boolean owner = a.id().equals(s(row,"authorId"));
        // The freeze is a real instant, not a business-date comparison: a log written last night stays
        // editable across midnight until its own 24 hours are over (chapter 7.1).
        row.put("frozen", frozen);
        row.put("frozenAt", freezeAt == null ? null : freezeAt.toString());
        row.put("editable", owner && !frozen);
        row.put("deletable", owner && !frozen);
        return row;
    }

    /** Real first-creation plus 24 hours, from the stored created_at only (never the migration time). */
    private static Instant freezeAt(Map<String,Object> row) {
        Instant created = instant(s(row,"createdAt"));
        return created == null ? null : created.plus(LOG_FREEZE_WINDOW);
    }

    private void requireWritable(Map<String,Object> row) {
        Instant freezeAt = freezeAt(row);
        if (freezeAt == null || !clock.instant().isBefore(freezeAt)) {
            throw conflict("WORK_LOG_FROZEN","该日志自首次创建已满24小时，只能查看");
        }
    }

    private Map<String,Object> findLog(Actor a,LocalDate date) {
        return db.find("SELECT id,row_version,business_date,deleted_at,created_at FROM work_logs WHERE organization_id=? AND author_id=? AND business_date=?",
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
        for(String key:List.of("id","displayName","accountType","role","placementType","departmentId","departmentName","positionId","positionName","teamId","teamName","managerId","managerName","rankLevel","active","avatar")) safe.put(key,row.get(key));
        return safe;
    }
    private ZoneId zone(Actor a) {return ZoneId.of(s(db.one("SELECT time_zone FROM organizations WHERE id=?",a.organizationId()),"timeZone"));}
    private LocalDate dateFor(Actor a,Map<String,Object> body,String key) {
        String value=nullable(body,key); return value==null?clock.instant().atZone(zone(a)).toLocalDate():optionalDate(value);
    }
    private static LocalDate optionalDate(String value) {try{return value==null?null:LocalDate.parse(value);}catch(Exception e){throw bad("日期必须为 YYYY-MM-DD");}}
    static Instant instant(String value) {try{return value==null?null:Instant.parse(value);}catch(Exception e){return null;}}
    static boolean enabled(Map<String,Object> row) {Object v=row.get("active");return Boolean.TRUE.equals(v)||"1".equals(String.valueOf(v));}
    private void business(Actor a) {if(a.administrator())throw new ApiException(403,"BUSINESS_ROLE_REQUIRED","管理员请使用管理端接口");access.requireCurrent(a);}
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
