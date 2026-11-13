package cn.pandora.seed;

import cn.pandora.admin.BusinessTakeovers;
import cn.pandora.admin.OrganizationService;
import org.springframework.beans.factory.ObjectProvider;
import cn.pandora.auth.*;
import cn.pandora.common.*;
import cn.pandora.task.TaskService;
import cn.pandora.workspace.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import static cn.pandora.common.Db.*;

/** Explicit, marker-guarded, transactional preparation. Never deletes or resets existing data. */
@Component
@Order(0)
@ConditionalOnProperty(name="pandora.seed",havingValue="true")
public class DemoSeed implements ApplicationRunner {
    public static final int ORDER=0;
    private static final String ORG="10000000-0000-0000-0000-000000000001";
    private static final int MANIFEST=3;
    private final Db db;
    private final TaskService tasks;
    private final WorkspaceService workspace;
    private final DailyItemService dailyItems;
    private final CommentService comments;
    private final BusinessTakeovers takeovers;
    private final Access access;
    private final OrganizationService organization;
    private final ObjectProvider<EventsWorker> worker;
    private final TransactionTemplate tx;
    private final Clock clock;
    private final String password,target,marker;
    private final boolean initialize;
    private LocalDate today;
    private final Map<String,Actor> actors=new LinkedHashMap<>();
    public DemoSeed(Db db,TaskService tasks,WorkspaceService workspace,DailyItemService dailyItems,CommentService comments,
                    BusinessTakeovers takeovers,Access access,OrganizationService organization,ObjectProvider<EventsWorker> worker,TransactionTemplate tx,Clock clock,
                    @Value("${pandora.demo-password}") String password,
                    @Value("${pandora.demo-target:}") String target,
                    @Value("${pandora.demo-marker:}") String marker,
                    @Value("${pandora.demo-initialize:false}") boolean initialize) {
        this.db=db;this.tasks=tasks;this.workspace=workspace;this.dailyItems=dailyItems;this.comments=comments;
        this.takeovers=takeovers;this.access=access;this.organization=organization;this.worker=worker;this.tx=tx;this.clock=clock;
        this.password=password;this.target=target;this.marker=marker;this.initialize=initialize;
    }
    @Override public void run(ApplicationArguments args) {
        tx.executeWithoutResult(status->{
            String actual=s(db.one("SELECT DATABASE() AS name"),"name");
            if(target.isBlank() || marker.isBlank() || !target.equals(actual))
                throw new IllegalStateException("Demo preparation requires an explicit matching database and demo marker");
            var identity=db.find("SELECT * FROM demo_database_identity WHERE singleton=1 FOR UPDATE");
            if(identity==null) {
                if(!initialize || n(db.one("SELECT COUNT(*) AS c FROM organizations"),"c")!=0)
                    throw new IllegalStateException("Refusing to initialize a demo marker on an existing business database");
                today=LocalDate.now(clock.withZone(ZoneId.of("Asia/Shanghai")));
                db.update("INSERT INTO demo_database_identity(singleton,database_name,marker,manifest_version,business_date) VALUES(1,?,?,?,?)",target,marker,MANIFEST,today);
            } else {
                if(!target.equals(s(identity,"databaseName")) || !marker.equals(s(identity,"marker")) || n(identity,"manifestVersion")!=MANIFEST)
                    throw new IllegalStateException("Demo database identity or manifest does not match");
                if(identity.get("preparedAt")!=null) return;
                today=LocalDate.parse(s(identity,"businessDate"));
            }
            db.update("INSERT INTO organizations(id,name,time_zone) VALUES(?,?,'Asia/Shanghai')",ORG,"光屿动画");
            db.one("SELECT id FROM organizations WHERE id=? FOR UPDATE",ORG);
            prepareOrganization();
            prepareBusiness();
            db.update("UPDATE demo_database_identity SET prepared_at=UTC_TIMESTAMP(6) WHERE singleton=1");
        });
    }
    private static String stable(String key) {
        return UUID.nameUUIDFromBytes(("pandora.demo.v2/"+key).getBytes(StandardCharsets.UTF_8)).toString();
    }
    private void remember(String key,String type,String value) {
        db.update("INSERT INTO demo_seed_keys(seed_key,organization_id,object_type,object_id) VALUES(?,?,?,?)",key,ORG,type,value);
    }
    private String unit(String table,String key,String name,String department) {
        String value=stable(key);
        if(table.equals("teams")) db.update("INSERT INTO teams(id,organization_id,name,department_id) VALUES(?,?,?,?)",value,ORG,name,department);
        else db.update("INSERT INTO "+table+"(id,organization_id,name) VALUES(?,?,?)",value,ORG,name);
        remember(key,table,value);return value;
    }
    private void prepareOrganization() {
        String founderTitle=unit("positions","title-founder","总导演",null);
        String departmentTitle=unit("positions","title-department","部门总监",null);
        String headTitle=unit("positions","title-team","组长",null);
        String employeeTitle=unit("positions","title-employee","动画师",null);
        String producerTitle=unit("positions","title-producer","制片",null);
        String writerTitle=unit("positions","title-writer","编剧",null);
        String hash=AuthService.PASSWORDS.encode(password);
        employee("upper","苏景昕","13800000001","founder",null,null,founderTitle,hash,"2019-03-04");
        String story=unit("departments","department-story","故事部",null);
        String production=unit("departments","department-production","制作部",null);
        employee("middle","苏格拉底","13800000002","department_head",story,null,departmentTitle,hash,"2020-07-16");
        employee("market","毕达哥拉斯","13800000003","department_head",production,null,departmentTitle,hash,"2020-09-21");
        String storyBoard=unit("teams","team-story-board","分镜组",story);
        String script=unit("teams","team-script","剧本组",story);
        String keyArt=unit("teams","team-key-art","原画组",production);
        String compositing=unit("teams","team-compositing","合成组",production);
        employee("product-head-1","柏拉图","13800000011","team_head",story,storyBoard,headTitle,hash,"2021-11-02");
        employee("product-head-2","芝诺","13800000012","team_head",story,script,headTitle,hash,"2022-01-10");
        employee("market-head-1","泰勒斯","13800000021","team_head",production,keyArt,headTitle,hash,"2021-06-14");
        employee("market-head-2","赫拉克利特","13800000022","team_head",production,compositing,headTitle,hash,"2022-04-25");
        employee("employee","亚里士多德","13800000004","employee",story,storyBoard,employeeTitle,hash,"2023-05-18");
        employee("colleague","欧几里得","13800000005","employee",story,storyBoard,employeeTitle,hash,"2023-08-07");
        employee("marketing","阿基米德","13800000006","employee",production,keyArt,employeeTitle,hash,"2022-12-12");
        employee("product-employee-1","巴门尼德","13800000031","employee",story,script,writerTitle,hash,"2023-02-20");
        employee("product-employee-2","德谟克利特","13800000032","employee",story,script,writerTitle,hash,"2024-03-11");
        employee("market-employee-1","普罗泰戈拉","13800000041","employee",production,compositing,producerTitle,hash,"2023-10-09");
        employee("market-employee-2","高尔吉亚","13800000042","employee",production,compositing,producerTitle,hash,"2024-06-03");
        db.update("UPDATE organizations SET founder_employee_id=? WHERE id=?",stable("upper"),ORG);
        String adminId=stable("admin");
        db.update("INSERT INTO principals(id,organization_id,account_type) VALUES(?,?,'admin')",adminId,ORG);
        db.update("INSERT INTO admin_accounts(id,organization_id,account_name,password_hash,display_name) VALUES(?,?,'admin',?,'系统管理员')",adminId,ORG,hash);
        remember("admin","admin",adminId);
        refreshActors();
    }
    private void employee(String key,String name,String phone,String kind,String dep,String team,String title,String hash,String hireDate) {
        String employeeId=stable(key);
        db.update("INSERT INTO principals(id,organization_id,account_type) VALUES(?,?,'employee')",employeeId,ORG);
        db.update("INSERT INTO users(id,organization_id,password_hash,display_name,phone,login_phone,email,hire_date) VALUES(?,?,?,?,?,?,?,?)",employeeId,ORG,hash,name,phone,phone,key+"@demo.example.test",hireDate);
        db.update("INSERT INTO employee_placements(organization_id,employee_id,placement_type,department_id,team_id,position_id) VALUES(?,?,?,?,?,?)",ORG,employeeId,kind,dep,team,title);
        remember(key,"employee",employeeId);
    }
    private void refreshActors() {
        actors.clear();
        for(var row:db.list("SELECT u.*,'employee' AS account_type,k.seed_key FROM users u JOIN demo_seed_keys k ON k.object_id=u.id AND k.object_type='employee' WHERE u.organization_id=?",ORG))
            actors.put(s(row,"seedKey"),access.actor(row));
        actors.put("admin",access.actor(db.one("SELECT a.*,'admin' AS account_type FROM admin_accounts a WHERE a.organization_id=?",ORG)));
    }
    private void prepareBusiness() {
        String[][] companyItems = {
                {"《星尘》短片立项", "故事部与制作部共同确认十二分钟动画短片《星尘》的创作目标与交付节点。"},
                {"第一幕分镜评审", "分镜组提交第一幕完整分镜，汇总镜头节奏与转场意见。"},
                {"角色设定定稿", "确定星尘、旅人和守灯人的比例、服装与表情设定。"},
                {"原画关键帧交付", "原画组交付第一幕关键帧，进入动画中间画制作。"},
                {"配音演员试音", "完成三位主要角色的试音并确认声音方向。"},
                {"配乐小样确认", "作曲提交主题旋律小样，确认情绪曲线与片尾留白。"},
                {"合成镜头验收", "检查第一幕合成层、光效与景深一致性。"},
                {"片头字幕校对", "校对片名、主创名单和多语言字幕。"},
                {"预告片剪辑", "从成片素材剪出四十五秒预告并完成调色。"},
                {"成片交付与归档", "输出母版、字幕和工程归档，完成交付清单。"}
        };
        for (int i = 0; i < companyItems.length; i++) {
            var item = organization.createCompanyItem(actors.get("admin"),
                    Map.of("title", companyItems[i][0], "body", companyItems[i][1]));
            remember("company-item-" + (i + 1), "home-item", s(item, "id"));
        }
        for (String key : List.of("upper", "middle", "product-head-1", "employee")) {
            for (int offset = 0; offset < 3; offset++) {
                var log = workspace.createLog(actors.get(key), Map.of("businessDate", today.minusDays(offset).toString(),
                        "body", "《星尘》制作日志：" + displayName(key) + " 同步第 " + (3 - offset) + " 天的分镜与合成进展。"));
                remember("log-" + key + "-" + offset, "log", s(log, "logId"));
            }
        }
        for (String key : List.of("upper", "middle", "product-head-1", "employee")) {
            dailyItems.create(actors.get(key), Map.of("startDate", today.minusDays(1).toString(),
                    "endDate", today.plusDays(1).toString(), "body", "跨日事项：跟完《星尘》第一幕的分镜与合成交接。"));
            dailyItems.create(actors.get(key), Map.of("startDate", today.toString(), "endDate", today.toString(),
                    "body", "今日事项：确认交付清单与明日排期。"));
            var finished = dailyItems.create(actors.get(key), Map.of("startDate", today.toString(), "endDate", today.toString(),
                    "body", "已完成：整理昨日评审意见。"));
            dailyItems.change(actors.get(key), s(finished, "id"), "\"1\"", Map.of("completed", true));
            dailyItems.create(actors.get(key), Map.of("startDate", today.minusDays(3).toString(),
                    "endDate", today.minusDays(3).toString(), "body", "逾期事项：补齐上周的镜头备注。"));
        }
        String[][] leadTitles = {
                {"第一幕分镜节奏", "第二幕转场设计", "第三幕高潮分镜", "角色表情走查", "镜头运动复盘", "分镜交接清单",
                        "第一幕粗剪反馈", "第二幕光影方向", "第三幕情绪曲线", "片头分镜", "片尾留白", "全片分镜归档"},
                {"剧本结构评审", "角色动机梳理", "对白节奏调整", "第二幕冲突升级", "结尾伏笔确认", "分镜脚本联审",
                        "台词终稿", "场景表更新", "配音稿标注", "字幕初稿", "剧本文档归档", "创作会纪要"},
                {"原画风格校准", "关键帧线稿", "动画中间画检查", "角色比例统一", "动作节奏走查", "原画交付清单",
                        "第一幕原画", "第二幕原画", "第三幕原画", "表情库整理", "原画归档", "作画会议纪要"},
                {"镜头合成检查", "光效层次调整", "景深一致性", "合成层整理", "渲染队列确认", "素材命名规范",
                        "第一幕合成", "第二幕合成", "第三幕合成", "输出前检查", "母版导出", "交付文件归档"}
        };
        String[] leads = {"upper", "middle", "product-head-1", "employee"};
        for (int leadIndex = 0; leadIndex < leads.length; leadIndex++) {
            String lead = leads[leadIndex];
            int count = "employee".equals(lead) ? 8 : 12;
            for (int i = 1; i <= count; i++) {
                /* 每个主角既是创建者也是当前负责人，不能只用创建量证明本人工作；
                   少量跨部门/带同组协作的任务保留真实共享关系。 */
                List<String> owners = switch (lead) {
                    case "upper" -> i % 4 == 0 ? List.of("upper", "middle") : List.of("upper");
                    case "middle" -> i % 4 == 0 ? List.of("middle", "product-head-1") : List.of("middle");
                    case "product-head-1" -> i % 4 == 0 ? List.of("product-head-1", "employee") : List.of("product-head-1");
                    default -> i % 4 == 0 ? List.of("employee", "colleague") : List.of("employee");
                };
                var timing = i == 1 ? shortSchedule() :
                        input(today.plusDays(1 + i % 5), 9 + i % 3, today.plusDays(1 + i % 5 + (i % 5 == 0 ? 1 : 0)), 17);
                String task = create(lead + "-" + i, lead, leadTitles[leadIndex][i - 1], owners, timing, true);
                if (i == 2) seedHistoricalSchedule(task, input(today.minusDays(2), 10, today.minusDays(1), 16));
            }
        }
        /* 两种相互独立的个人置顶：日历置顶与表单置顶分别落在不同任务上，互不覆盖。 */
        for (String lead : leads) {
            String calendarPin = s(db.one("SELECT object_id FROM demo_seed_keys WHERE seed_key=?", "task-" + lead + "-1"), "objectId");
            String tablePin = s(db.one("SELECT object_id FROM demo_seed_keys WHERE seed_key=?", "task-" + lead + "-2"), "objectId");
            if (calendarPin != null) tasks.setPinned(actors.get(lead), calendarPin, true);
            if (tablePin != null) tasks.setTablePinned(actors.get(lead), tablePin, true);
        }
        /* 真实父子拆解链：创始人 → 部门负责人 → 团队负责人 → 员工，逐级创建并由直属上级审核。 */
        String chainParent = create("chain-parent", "upper", "《星尘》第一幕总交付", List.of("middle"), schedule(), true);
        String chainMiddle = create("chain-middle", "middle", "第一幕分镜与配音拆解", List.of("product-head-1"), schedule(), true, chainParent);
        String chainTeam = create("chain-team", "product-head-1", "分镜组镜头交付清单", List.of("employee"), schedule(), true, chainMiddle);
        create("chain-leaf", "employee", "第一幕镜头台词标注", List.of("employee"), schedule(), true, chainTeam);
        String doing = create("doing", "middle", "第一幕合成镜头校对", List.of("employee", "colleague"), schedule(), true);
        command("employee", doing, Map.of("command", "progress", "progressNote", "第一轮校对完成，等待组长确认。"), true);
        String pending = create("pending-complete", "middle", "第二幕原画验收", List.of("employee"), schedule(), true);
        command("employee", pending, Map.of("command", "complete", "completionNote", "原画清单已核对，请审核。"), false);
        String complete = create("completed", "employee", "片头字幕校对", List.of("employee"), schedule(), true);
        command("employee", complete, Map.of("command", "complete", "completionNote", "字幕已按终稿完成。"), true);
        String reopen = create("reopened", "employee", "预告片剪辑返工", List.of("employee"), schedule(), true);
        command("employee", reopen, Map.of("command", "complete", "completionNote", "首轮剪辑完成。"), true);
        var reopenBody = schedule(); reopenBody.put("command", "reopen"); reopenBody.put("reason", "补充片尾镜头，重新执行。");
        command("employee", reopen, reopenBody, true);
        for (String outcome : List.of("pending", "rejected", "withdrawn", "expired")) {
            String task = create("creation-" + outcome, "employee", switch (outcome) {
                case "pending" -> "第一幕新增航拍镜头申请";
                case "rejected" -> "第二幕补拍镜头申请";
                case "withdrawn" -> "片尾彩蛋镜头申请";
                default -> "第三幕特效镜头申请";
            }, List.of("employee"), schedule(), false);
            var request = db.one("SELECT * FROM approval_requests WHERE task_id=?", task);
            if (outcome.equals("rejected")) decide(request, "reject", "product-head-1");
            if (outcome.equals("withdrawn")) decide(request, "withdraw", "employee");
            if (outcome.equals("expired")) {
                db.update("UPDATE approval_requests SET applicable_deadline=UTC_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE id=?", s(request, "id"));
                tasks.refreshPendingRoutes(actors.get("admin"));
            }
        }
        String handover = create("handover", "upper", "分镜交接保留创作来源", List.of("employee"), schedule(), true);
        approve(tasks.handover(actors.get("employee"), handover, etag(handover),
                Map.of("sourceUserId", stable("employee"), "targetUserId", stable("colleague"), "reason", "同组分镜协作交接")));
        String takeover = create("takeover", "middle", "第二幕业务责任接管", List.of("employee"), schedule(), true);
        takeovers.transfer(actors.get("admin"), "\"1\"", Map.of("transfers", List.of(Map.of("taskId", takeover,
                "taskVersion", version(takeover), "ownerVersion", 1, "previousEmployeeId", stable("middle"),
                "nextEmployeeId", stable("colleague"), "reason", "业务责任正式接管演示"))));
        refreshActors();
        command("colleague", takeover, Map.of("command", "change", "title", "接管后由新责任方维护第二幕", "reason", "接管后直接生效"), true);
        create("cross-department", "middle", "故事部与制作部联合评审", List.of("employee", "marketing"), schedule(), true);
        create("creator-only", "employee", "片尾镜头由制作部负责", List.of("marketing"), schedule(), true);
        LocalDate monthEnd = today.withDayOfMonth(today.lengthOfMonth());
        if (!monthEnd.isAfter(today)) monthEnd = today.plusMonths(1).withDayOfMonth(today.plusMonths(1).lengthOfMonth());
        create("cross-month", "upper", "跨月镜头排期", List.of("employee"), input(monthEnd.minusDays(1), 20, monthEnd.plusDays(1), 10), true);
        String revoked = create("comment-revoked", "upper", "第一幕评论协作镜头", List.of("employee"), schedule(), true);

        String tag = stable("tag-focus");
        String linkedTag = stable("tag-animation");
        db.update("INSERT INTO tags(id,organization_id,name,color) VALUES(?,?,'重点镜头','#F6D5D2')", tag, ORG);
        db.update("INSERT INTO tags(id,organization_id,name,color) VALUES(?,?,'动画联动','#D8EAF4')", linkedTag, ORG);
        remember("tag-focus", "tag", tag);
        remember("tag-animation", "tag", linkedTag);
        /* 两种颜色的公司共用标签，供任务和日志的有序引用：两条正常任务与两篇近期日志各带两个
           标签，首标签决定任务取色；其余任务和日志保留单标签/无标签对照，不增加主线任务数量。 */
        var employeeLog = db.one("SELECT id,row_version FROM work_logs WHERE organization_id=? AND author_id=? AND business_date=?",
                ORG, stable("employee"), today);
        workspace.changeLog(actors.get("employee"), s(employeeLog, "id"), "\"" + n(employeeLog, "rowVersion") + "\"",
                Map.of("tagIds", List.of(tag, linkedTag)));
        var middleLog = db.one("SELECT id,row_version FROM work_logs WHERE organization_id=? AND author_id=? AND business_date=?",
                ORG, stable("middle"), today);
        workspace.changeLog(actors.get("middle"), s(middleLog, "id"), "\"" + n(middleLog, "rowVersion") + "\"",
                Map.of("tagIds", List.of(linkedTag, tag)));
        String compositing = s(db.one("SELECT object_id FROM demo_seed_keys WHERE seed_key=?", "task-employee-3"), "objectId");
        command("middle", doing, Map.of("command", "change", "tagIds", List.of(tag, linkedTag), "reason", "重点镜头跟进"), true);
        command("employee", compositing, Map.of("command", "change", "tagIds", List.of(linkedTag, tag), "reason", "合成与镜头联动"), true);
        comments.create(actors.get("middle"), "task", doing, Map.of("body", "合成检查请保留逐镜头记录，审核时对照原画。"));
        comments.create(actors.get("upper"), "task", revoked, Map.of("body", "请按最新分镜意见继续协作，旧评论通知不应再提供正文。"));
        var delivery = worker.getIfAvailable();
        if (delivery != null) for (int i = 0; i < 10 && n(db.one("SELECT COUNT(*) AS c FROM domain_events WHERE status='pending'"), "c") > 0; i++) delivery.runOnce();
        command("upper", revoked, Map.of("command", "change", "assigneeIds", List.of(stable("marketing")), "reason", "转交制作部，保留普通历史消息例外"), true);
        /* 四人各有已读/未读的多类型通知，打开详情才标读的规则仍由真实接口决定。 */
        for (String key : List.of("upper", "middle", "product-head-1", "employee")) {
            var messages = db.list("SELECT id FROM notifications WHERE organization_id=? AND recipient_id=? ORDER BY created_at DESC,id", ORG, stable(key));
            for (int i = 0; i < messages.size(); i++) if (i % 4 == 1)
                db.update("UPDATE notifications SET read_at=UTC_TIMESTAMP(6) WHERE id=?", s(messages.get(i), "id"));
        }
    }
    private String displayName(String key) {
        return switch (key) {
            case "upper" -> "苏景昕"; case "middle" -> "苏格拉底";
            case "product-head-1" -> "柏拉图"; case "employee" -> "亚里士多德";
            case "colleague" -> "欧几里得"; case "marketing" -> "阿基米德";
            default -> "光屿动画成员";
        };
    }
    /** A short, still actionable same-business-day interval, including preparation late at night. */
    private Map<String,Object> shortSchedule() {
        ZoneId zone = ZoneId.of("Asia/Shanghai");
        ZonedDateTime end = ZonedDateTime.now(clock.withZone(zone)).plusMinutes(90);
        ZonedDateTime last = today.atTime(23,59,59).atZone(zone);
        if (end.isAfter(last)) end = last;
        return new LinkedHashMap<>(Map.of("allDay", false, "startAt", end.minusMinutes(90).toOffsetDateTime().toString(),
                "dueAt", end.toOffsetDateTime().toString()));
    }
    /** Initial historical seed only: normal submissions correctly reject already elapsed deadlines.
        Keep the approved business record and its version/approval deadline consistent; never runs
        for an already prepared target, so repeat preparation cannot reschedule edited work. */
    private void seedHistoricalSchedule(String task, Map<String,Object> timing) {
        Instant start = OffsetDateTime.parse((String)timing.get("startAt")).toInstant();
        Instant due = OffsetDateTime.parse((String)timing.get("dueAt")).toInstant();
        db.update("UPDATE task_versions SET start_at=?,due_at=? WHERE organization_id=? AND task_id=?",
                java.sql.Timestamp.from(start),java.sql.Timestamp.from(due),ORG,task);
        db.update("UPDATE approval_requests SET applicable_deadline=? WHERE organization_id=? AND task_id=?",java.sql.Timestamp.from(due),ORG,task);
        // This is pre-existing unfinished work, with submission/decision before its historical due.
        db.update("UPDATE tasks SET created_at=created_at-INTERVAL 3 DAY,updated_at=updated_at-INTERVAL 3 DAY WHERE organization_id=? AND id=?",ORG,task);
        db.update("UPDATE task_versions SET created_at=created_at-INTERVAL 3 DAY WHERE organization_id=? AND task_id=?",ORG,task);
        db.update("UPDATE approval_requests SET created_at=created_at-INTERVAL 3 DAY,decided_at=decided_at-INTERVAL 3 DAY WHERE organization_id=? AND task_id=?",ORG,task);
        db.update("UPDATE task_history_entries SET occurred_at=occurred_at-INTERVAL 3 DAY WHERE organization_id=? AND task_id=?",ORG,task);
        db.update("UPDATE task_assignments SET assigned_at=assigned_at-INTERVAL 3 DAY,created_at=created_at-INTERVAL 3 DAY WHERE organization_id=? AND task_id=?",ORG,task);
        db.update("UPDATE task_business_owners SET updated_at=updated_at-INTERVAL 3 DAY WHERE organization_id=? AND task_id=?",ORG,task);
        db.update("UPDATE audit_logs SET created_at=created_at-INTERVAL 3 DAY WHERE organization_id=? AND object_id=?",ORG,task);
        db.update("UPDATE domain_events SET created_at=created_at-INTERVAL 3 DAY,expires_at=DATE_ADD(occurred_at-INTERVAL 3 DAY,INTERVAL 3 MONTH),occurred_at=occurred_at-INTERVAL 3 DAY WHERE organization_id=? AND task_id=?",ORG,task);
    }
    private Map<String,Object> schedule() {return input(today,9,today.plusDays(7),18);}
    private Map<String,Object> input(LocalDate start,int hour,LocalDate due,int dueHour) {
        var result=new LinkedHashMap<String,Object>();result.put("allDay",false);
        result.put("startAt",start.atTime(hour,0).atZone(ZoneId.of("Asia/Shanghai")).toOffsetDateTime().toString());
        result.put("dueAt",due.atTime(dueHour,0).atZone(ZoneId.of("Asia/Shanghai")).toOffsetDateTime().toString());return result;
    }
    private String create(String key,String creator,String title,List<String> owners,Map<String,Object> schedule,boolean approve) {
        return create(key,creator,title,owners,schedule,approve,null);
    }
    private String create(String key,String creator,String title,List<String> owners,Map<String,Object> schedule,boolean approve,String parentTaskId) {
        var body=new LinkedHashMap<>(schedule);body.put("title",title);body.put("description","光屿动画业务数据："+title);
        if (parentTaskId != null) body.put("parentTaskId", parentTaskId);
        body.put("priority",List.of("urgent","high","medium","low").get(Math.floorMod(key.hashCode(),4)));
        body.put("assigneeIds",owners.stream().map(DemoSeed::stable).toList());
        var result=tasks.create(actors.get(creator),body);if(approve) approve(result);
        remember("task-"+key,"task",s(result,"taskId"));return s(result,"taskId");
    }
    private long version(String task) {return n(db.one("SELECT row_version FROM tasks WHERE id=?",task),"rowVersion");}
    private String etag(String task) {return "\""+version(task)+"\"";}
    private void command(String who,String task,Map<String,Object> body,boolean approve) {
        var result=tasks.change(actors.get(who),task,etag(task),body);if(approve) approve(result);
    }
    private void decide(Map<String,Object> request,String decision,String who) {
        tasks.decide(actors.get(who),s(request,"id"),"\""+n(request,"rowVersion")+"\"",Map.of("decision",decision,"comment","演示业务决定："+decision));
    }
    private void approve(Map<String,Object> result) {
        String rid=s(result,"requestId");if(rid==null)return;
        var request=db.one("SELECT * FROM approval_requests WHERE id=?",rid);
        if(!"pending".equals(s(request,"status")))return;
        String reviewer=actors.entrySet().stream().filter(e->e.getValue().id().equals(s(request,"currentReviewerId"))).findFirst().orElseThrow().getKey();
        decide(request,"approve",reviewer);
    }
}
