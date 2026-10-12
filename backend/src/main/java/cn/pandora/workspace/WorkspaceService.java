package cn.pandora.workspace;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.*;
import cn.pandora.task.TaskService;
import org.springframework.stereotype.Service;

import java.time.*;
import java.util.*;

import static cn.pandora.common.Db.*;

@Service
public class WorkspaceService {
    private final Db db;
    private final Access access;
    private final TaskService tasks;
    private final Events events;

    public WorkspaceService(Db db, Access access, TaskService tasks, Events events) {
        this.db = db; this.access = access; this.tasks = tasks; this.events = events;
    }

    public Map<String,Object> me(Actor a) {
        var row=db.one("SELECT u.*,t.name team_name,m.display_name manager_name FROM users u LEFT JOIN teams t ON t.id=u.team_id AND t.organization_id=u.organization_id LEFT JOIN users m ON m.id=u.manager_id AND m.organization_id=u.organization_id WHERE u.id=? AND u.organization_id=? AND u.active=1", a.id(), a.organizationId());
        var result=safeUser(row);
        for(String key:List.of("phone","email","profileVersion","managerName")) result.put(key,row.get(key));
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

    public Map<String,Object> logs(Actor a, Map<String,String> filters) {
        business(a);
        String scope = filters.getOrDefault("scope", "self");
        if (!Set.of("self","visible").contains(scope)) throw bad("scope 只能为 self 或 visible");
        var allowedIds = new HashSet<>(scope.equals("self") ? List.of(a.id()) : access.visibleUserIds(a));
        String author = filters.get("authorId");
        if (author != null && !allowedIds.contains(author)) throw ApiException.notFound();
        if (author != null) allowedIds.retainAll(Set.of(author));
        LocalDate from = optionalDate(filters.get("from")), to = optionalDate(filters.get("to"));
        if (from != null && to != null && from.isAfter(to)) throw bad("开始日期不得晚于结束日期");
        var result = db.list("SELECT w.*,u.display_name author_name FROM work_logs w JOIN users u ON u.id=w.author_id AND u.organization_id=w.organization_id WHERE w.organization_id=? ORDER BY w.business_date DESC,w.created_at DESC,w.id",a.organizationId()).stream()
            .filter(row -> allowedIds.contains(s(row,"authorId")))
            .filter(row -> from == null || !LocalDate.parse(s(row,"businessDate")).isBefore(from))
            .filter(row -> to == null || !LocalDate.parse(s(row,"businessDate")).isAfter(to))
            .map(row -> safeLog(a,row)).toList();
        return page(result,filters);
    }

    public Map<String,Object> log(Actor a, String logId) {
        business(a);
        var row = db.one("SELECT w.*,u.display_name author_name FROM work_logs w JOIN users u ON u.id=w.author_id AND u.organization_id=w.organization_id WHERE w.organization_id=? AND w.id=?",a.organizationId(),logId);
        var author = db.one("SELECT * FROM users WHERE organization_id=? AND id=?",a.organizationId(),s(row,"authorId"));
        if (!access.canSeePerson(a,author)) throw ApiException.notFound();
        return safeLog(a,row);
    }

    public Map<String,Object> createLog(Actor a, Map<String,Object> body) {
        business(a);
        allowed(body,Set.of("body","businessDate","taskId"));
        String text = required(body,"body",10000);
        LocalDate date = dateFor(a,body,"businessDate");
        String taskId = nullable(body,"taskId");
        if (taskId != null) tasks.detail(a,taskId);
        String logId = id();
        db.update("INSERT INTO work_logs(id,organization_id,author_id,business_date,body,task_id) VALUES(?,?,?,?,?,?)",logId,a.organizationId(),a.id(),java.sql.Date.valueOf(date),text,taskId);
        events.record(a,null,"log.created",List.of(),Map.of("logId",logId));
        return Map.of("logId",logId,"rowVersion",1);
    }

    public Map<String,Object> changeLog(Actor a, String logId, String ifMatch, Map<String,Object> body) {
        business(a);
        allowed(body,Set.of("body","businessDate","taskId"));
        var row = ownedLog(a,logId);
        Writes.checkVersion(ifMatch,n(row,"rowVersion"));
        String text = body.containsKey("body") ? required(body,"body",10000) : s(row,"body");
        LocalDate date = body.containsKey("businessDate") ? dateFor(a,body,"businessDate") : LocalDate.parse(s(row,"businessDate"));
        String taskId = body.containsKey("taskId") ? nullable(body,"taskId") : s(row,"taskId");
        if (body.containsKey("taskId") && taskId != null) tasks.detail(a,taskId);
        db.update("UPDATE work_logs SET body=?,business_date=?,task_id=?,row_version=row_version+1,updated_at=UTC_TIMESTAMP(6) WHERE id=? AND organization_id=?",text,java.sql.Date.valueOf(date),taskId,logId,a.organizationId());
        events.record(a,null,"log.updated",List.of(),Map.of("logId",logId));
        return Map.of("logId",logId,"rowVersion",n(row,"rowVersion")+1);
    }

    public Map<String,Object> deleteLog(Actor a, String logId, String ifMatch) {
        business(a);
        var row = ownedLog(a,logId);
        Writes.checkVersion(ifMatch,n(row,"rowVersion"));
        db.update("DELETE FROM work_logs WHERE id=? AND organization_id=?",logId,a.organizationId());
        events.record(a,null,"log.deleted",List.of(),Map.of("logId",logId));
        return Map.of("logId",logId,"deleted",true);
    }

    public Map<String,Object> notifications(Actor a, Map<String,String> filters) {
        boolean unread = "true".equals(filters.get("unread"));
        var allowed = db.list("SELECT * FROM notifications WHERE organization_id=? AND recipient_id=? AND hidden_at IS NULL ORDER BY created_at DESC,id",a.organizationId(),a.id()).stream()
            .filter(row -> notificationVisible(a,row)).map(this::safeNotification).toList();
        var result = page(allowed.stream().filter(row -> !unread || row.get("readAt")==null).toList(),filters);
        result.put("unreadCount",allowed.stream().filter(row -> row.get("readAt")==null).count());
        return result;
    }

    public Map<String,Object> notification(Actor a, String notificationId) {
        var row = db.one("SELECT * FROM notifications WHERE organization_id=? AND recipient_id=? AND id=? AND hidden_at IS NULL",a.organizationId(),a.id(),notificationId);
        if (!notificationVisible(a,row)) throw ApiException.notFound();
        return safeNotification(row);
    }

    public Map<String,Object> changeNotification(Actor a, String notificationId, String ifMatch, Map<String,Object> body) {
        allowed(body,Set.of("action"));
        var row = db.one("SELECT * FROM notifications WHERE organization_id=? AND recipient_id=? AND id=? FOR UPDATE",a.organizationId(),a.id(),notificationId);
        if (!notificationVisible(a,row)) throw ApiException.notFound();
        long version = notificationVersion(row);
        Writes.checkVersion(ifMatch,version);
        String action = required(body,"action",20);
        if (action.equals("read")) {
            db.update("UPDATE notifications SET read_at=COALESCE(read_at,UTC_TIMESTAMP(6)) WHERE organization_id=? AND id=?",a.organizationId(),notificationId);
            if (row.get("readAt")==null) version++;
        } else if (action.equals("hide")) {
            db.update("UPDATE notifications SET hidden_at=COALESCE(hidden_at,UTC_TIMESTAMP(6)) WHERE organization_id=? AND id=?",a.organizationId(),notificationId);
            if (row.get("hiddenAt")==null) version+=2;
        } else throw bad("action 只能为 read 或 hide");
        events.record(a,null,"notification."+action,List.of(),Map.of("notificationId",notificationId));
        return Map.of("notificationId",notificationId,"rowVersion",version,"action",action);
    }

    public Map<String,Object> home(Actor a) {
        business(a);
        var assigned = visibleTasks(a,"self").stream().filter(t -> !a.id().equals(s(t,"originalCreatorId")) && !"done".equals(s(t,"executionState")))
            .map(t -> Map.<String,Object>of("taskId",s(t,"id"),"title",s(t,"title"),"priority",s(t,"priority"))).limit(10).toList();
        LocalDate today = LocalDate.now(zone(a));
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
        String scope=filters.getOrDefault("scope","visible");
        var summary=summarize(visibleTasks(a,scope));summary.put("scope",scope);return summary;
    }

    public Map<String,Object> createAiJob(Actor a, Map<String,Object> input) {
        allowed(input,Set.of("scopeType"));
        String scope = Optional.ofNullable(nullable(input,"scopeType")).orElse("visible");
        var visible = visibleTasks(a,scope);
        var summary = summarize(visible);
        summary.put("scope",scope);
        var suggestions = new ArrayList<Map<String,Object>>();
        Instant now = Instant.now();
        for (var t : visible) {
            if (Boolean.TRUE.equals(t.get("frozen")) || "done".equals(s(t,"executionState"))) continue;
            Instant due = instant(s(t,"dueAt"));
            if (due != null && !due.isAfter(now.plus(Duration.ofDays(3)))) {
                suggestions.add(Map.of("taskId",s(t,"id"),"title",s(t,"title"),"rule",due.isBefore(now)?"overdue":"due_within_72_hours",
                    "message",due.isBefore(now)?"任务已逾期，建议确认未完成事项与下一步安排。":"任务临近截止，建议确认剩余事项与需要协调的资源。"));
            }
            if (suggestions.size() == 10) break;
        }
        var result = new LinkedHashMap<String,Object>();
        result.put("mode","rule_based"); result.put("modelUsed",false); result.put("summary",summary); result.put("suggestions",suggestions);
        result.put("sourceTaskIds",visible.stream().map(t->s(t,"id")).toList()); result.put("generatedAt",now.toString());
        String jobId = id();
        db.update("INSERT INTO ai_jobs(id,organization_id,requested_by,status,scope_type,result_json,completed_at) VALUES(?,?,?,'completed',?,?,UTC_TIMESTAMP(6))",jobId,a.organizationId(),a.id(),scope,db.json(result));
        events.record(a,null,"analysis.completed",List.of(),Map.of("jobId",jobId,"mode","rule_based"));
        return Map.of("jobId",jobId,"status","completed","mode","rule_based");
    }

    public Map<String,Object> aiJob(Actor a, String jobId) {
        business(a);
        var row = db.one("SELECT * FROM ai_jobs WHERE organization_id=? AND requested_by=? AND id=?",a.organizationId(),a.id(),jobId);
        var result = db.parse(s(row,"resultJson"));
        var currentIds = new HashSet<>(visibleTasks(a,s(row,"scopeType")).stream().map(t->s(t,"id")).toList());
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
        if (scope.equals("self")) rows.removeIf(t -> !(t.get("assigneeIds") instanceof Collection<?> ids && ids.contains(a.id())));
        return rows;
    }

    private Map<String,Object> summarize(List<Map<String,Object>> rows) {
        var result = new LinkedHashMap<String,Object>(); Instant now=Instant.now();
        result.put("total",rows.size());
        for (String state : List.of("todo","doing","done")) result.put(state,rows.stream().filter(t->state.equals(s(t,"executionState"))).count());
        result.put("frozen",rows.stream().filter(t->Boolean.TRUE.equals(t.get("frozen"))).count());
        result.put("overdue",rows.stream().filter(t->!"done".equals(s(t,"executionState"))).filter(t->{var due=instant(s(t,"dueAt"));return due!=null&&due.isBefore(now);}).count());
        result.put("ruleBased",true); result.put("generatedAt",now.toString());
        return result;
    }

    private Map<String,Object> ownedLog(Actor a,String logId) {
        return db.one("SELECT * FROM work_logs WHERE organization_id=? AND author_id=? AND id=? FOR UPDATE",a.organizationId(),a.id(),logId);
    }
    private Map<String,Object> safeLog(Actor a,Map<String,Object> row) {
        row.remove("organizationId");
        String taskId=s(row,"taskId");
        if (taskId!=null && !canReadTask(a,taskId,false)) row.remove("taskId");
        row.put("editable",a.id().equals(s(row,"authorId")));
        return row;
    }
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
        String value=nullable(body,key); return value==null?LocalDate.now(zone(a)):optionalDate(value);
    }
    private static LocalDate optionalDate(String value) {try{return value==null?null:LocalDate.parse(value);}catch(Exception e){throw bad("日期必须为 YYYY-MM-DD");}}
    static Instant instant(String value) {try{return value==null?null:Instant.parse(value);}catch(Exception e){return null;}}
    static boolean enabled(Map<String,Object> row) {Object v=row.get("active");return Boolean.TRUE.equals(v)||"1".equals(String.valueOf(v));}
    static void business(Actor a) {if("admin".equals(a.role()))throw new ApiException(403,"BUSINESS_ROLE_REQUIRED","管理员请使用管理端接口");}
    static String nullable(Map<String,Object> body,String key) {String value=s(body,key);return value==null||value.isBlank()?null:value.trim();}
    static String required(Map<String,Object> body,String key,int max) {if(!(body.get(key) instanceof String))throw bad(key+" 必须为文字");String value=nullable(body,key);if(value==null||value.length()>max)throw bad(key+" 不能为空且不得超过 "+max+" 字");return value;}
    static void allowed(Map<String,Object> body,Set<String> keys) {if(!keys.containsAll(body.keySet()))throw bad("请求含不支持的字段");}
    static ApiException bad(String message) {return new ApiException(400,"INVALID_INPUT",message);}
    static Map<String,Object> page(List<Map<String,Object>> rows,Map<String,String> filters) {
        int limit=number(filters,"limit",20,1,100),offset=number(filters,"offset",0,0,Integer.MAX_VALUE);
        int start=Math.min(offset,rows.size()),end=(int)Math.min((long)start+limit,rows.size());
        var result=new LinkedHashMap<String,Object>();result.put("items",rows.subList(start,end));result.put("total",rows.size());result.put("nextOffset",end<rows.size()?end:null);return result;
    }
    static int number(Map<String,String> filters,String key,int fallback,int min,int max) {try{int value=Integer.parseInt(filters.getOrDefault(key,Integer.toString(fallback)));if(value<min||value>max)throw new NumberFormatException();return value;}catch(Exception e){throw bad(key+" 超出允许范围");}}
}
