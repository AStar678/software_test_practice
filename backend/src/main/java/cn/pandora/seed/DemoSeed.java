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
                if(!target.equals(s(identity,"databaseName")) || !marker.equals(s(identity,"marker")))
                    throw new IllegalStateException("Demo database identity does not match");
                long manifestVersion=n(identity,"manifestVersion");
                boolean prepared=identity.get("preparedAt")!=null;
                if(manifestVersion==2 && prepared && !initialize) return;
                if(manifestVersion!=MANIFEST) throw new IllegalStateException("Demo manifest does not match");
                if(prepared) return;
                today=LocalDate.parse(s(identity,"businessDate"));
            }
            db.update("INSERT INTO organizations(id,name,time_zone) VALUES(?,?,'Asia/Shanghai')",ORG,"澄川协作科技");
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
        String founderTitle=unit("positions","title-founder","创始人",null);
        String departmentTitle=unit("positions","title-department","部门经理",null);
        String headTitle=unit("positions","title-team","负责人",null);
        String employeeTitle=unit("positions","title-employee","产品运营",null);
        String marketTitle=unit("positions","title-marketing","市场运营",null);
        String hash=AuthService.PASSWORDS.encode(password);
        employee("upper","王海","13800000001","founder",null,null,founderTitle,hash);
        for(String dep:List.of("product","market")) {
            String department=unit("departments","department-"+dep,dep.equals("product")?"产品部":"市场部",null);
            employee(dep.equals("product")?"middle":"market",dep.equals("product")?"李敏":"陈冲",dep.equals("product")?"13800000002":"13800000003","department_head",department,null,departmentTitle,hash);
            for(int i=1;i<=2;i++) {
                String team=unit("teams","team-"+dep+"-"+i,(dep.equals("product")?"产品运营":"市场推广")+i+"组",department);
                employee(dep+"-head-"+i,(dep.equals("product")?List.of("许晴","蒋博"):List.of("林雅","周辰")).get(i-1),"138000000"+(dep.equals("product")?10+i:20+i),"team_head",department,team,headTitle,hash);
                if(dep.equals("product") && i==1) {
                    employee("employee","张涛","13800000004","employee",department,team,employeeTitle,hash);
                    employee("colleague","赵蕾","13800000005","employee",department,team,employeeTitle,hash);
                } else employee(dep.equals("market") && i==1?"marketing":dep+"-employee-"+i,
                        (dep.equals("product")?"孙悦":i==1?"罗菲":"沈宁"),dep.equals("market") && i==1?"13800000006":"138000000"+(dep.equals("product")?30+i:40+i),"employee",department,team,dep.equals("product")?employeeTitle:marketTitle,hash);
            }
        }
        db.update("UPDATE organizations SET founder_employee_id=? WHERE id=?",stable("upper"),ORG);
        String adminId=stable("admin");
        db.update("INSERT INTO principals(id,organization_id,account_type) VALUES(?,?,'admin')",adminId,ORG);
        db.update("INSERT INTO admin_accounts(id,organization_id,account_name,password_hash,display_name) VALUES(?,?,'admin',?,'系统管理员')",adminId,ORG,hash);
        remember("admin","admin",adminId);
        refreshActors();
    }
    private void employee(String key,String name,String phone,String kind,String dep,String team,String title,String hash) {
        String employeeId=stable(key);
        db.update("INSERT INTO principals(id,organization_id,account_type) VALUES(?,?,'employee')",employeeId,ORG);
        db.update("INSERT INTO users(id,organization_id,password_hash,display_name,phone,login_phone,email,employment_start_date) VALUES(?,?,?,?,?,?,?,?)",employeeId,ORG,hash,name,phone,phone,key+"@demo.example.test",java.sql.Date.valueOf(today.minusMonths(switch(kind){case "founder"->64;case "department_head"->38;case "team_head"->25;default->8;}).minusDays(Math.floorMod(key.hashCode(),20))));
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
        var announcements=List.of(
            "客户工作台灰度安排|周三先开放给试点客户，产品部当天汇总首轮使用反馈。",
            "上线验收口径|关键路径须通过验收，未解决的高优先级问题进入发布评审。",
            "试点客户回访|市场部本周完成首批回访，并将问题分类交给产品运营组。",
            "发布素材截止|案例稿和发布邮件在周四前完成校对，负责人在任务内确认。",
            "客服交接演练|产品运营与市场推广一起演练客户反馈的分级和转派。",
            "版本回滚预案|发布值班人员提前核对回滚步骤、联系人和异常通报范围。",
            "试点账户开通|首批名单已经确认，新增名单由市场部负责人统一汇总。",
            "周报提交安排|各组按业务日期补齐试点日志，部门负责人汇总阶段结果。",
            "会议室预订提醒|发布周评审优先使用二楼会议室，远程同事可通过会议链接参加。",
            "上线复盘会|试点结束后一周复盘，重点整理需求验证、响应时长和后续责任人。");
        for(int i=0;i<announcements.size();i++) {
            String[] announcement=announcements.get(i).split("\\|",2);
            var item=organization.createCompanyItem(actors.get("admin"),Map.of("title",announcement[0],"body",announcement[1]));
            remember("company-item-"+(i+1),"home-item",s(item,"id"));
        }
        for(int i=1;i<=110;i++) create("page-"+i,"upper","试点客户验收记录 "+String.format("%03d",i),List.of("employee"),input(today.plusDays(i%20),9,today.plusDays(30),18),true);
        create("cross-department","middle","跨部门多负责人",List.of("employee","marketing"),schedule(),true);
        create("creator-only","employee","本人仅创建不负责",List.of("marketing"),schedule(),true);
        String doing=create("doing","middle","上线素材校对",List.of("employee","colleague"),schedule(),true);
        command("employee",doing,Map.of("command","progress","progressNote","第一轮校对完成，等待确认。"),true);
        String pending=create("pending-complete","middle","产品验收 待完成审核",List.of("employee"),schedule(),true);
        command("employee",pending,Map.of("command","complete","completionNote","验收清单已核对，请审核。"),false);
        for(String outcome:List.of("pending","rejected","withdrawn","expired")) {
            String task=create("creation-"+outcome,"employee","创建申请 "+outcome,List.of("employee"),schedule(),false);
            var request=db.one("SELECT * FROM approval_requests WHERE task_id=?",task);
            if(outcome.equals("rejected")) decide(request,"reject","product-head-1");
            if(outcome.equals("withdrawn")) decide(request,"withdraw","employee");
            if(outcome.equals("expired")) {
                // Explicit seed fixture age, not an inferred record date; exercise the real expiry path.
                db.update("UPDATE approval_requests SET applicable_deadline=UTC_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE id=?",s(request,"id"));
                tasks.refreshPendingRoutes(actors.get("admin"));
            }
        }
        String complete=create("completed","employee","已完成可重开",List.of("employee"),schedule(),true);
        command("employee",complete,Map.of("command","complete","completionNote","已完成并复核。"),true);
        String reopen=create("reopened","employee","完成后已重开",List.of("employee"),schedule(),true);
        command("employee",reopen,Map.of("command","complete","completionNote","首轮完成。"),true);
        var reopenBody=schedule();reopenBody.put("command","reopen");reopenBody.put("reason","补充资料，重新执行。");
        command("employee",reopen,reopenBody,true);
        String handover=create("handover","upper","专用交接保留创建来源",List.of("employee"),schedule(),true);
        approve(tasks.handover(actors.get("employee"),handover,etag(handover),Map.of("sourceUserId",stable("employee"),"targetUserId",stable("colleague"),"reason","同部门协作交接")));
        String takeover=create("takeover","middle","正式业务接管",List.of("employee"),schedule(),true);
        takeovers.transfer(actors.get("admin"),"\"1\"",Map.of("transfers",List.of(Map.of("taskId",takeover,"taskVersion",version(takeover),"ownerVersion",1,"previousEmployeeId",stable("middle"),"nextEmployeeId",stable("colleague"),"reason","业务责任正式接管演示"))));
        refreshActors();
        command("colleague",takeover,Map.of("command","change","title","正式接管后由新责任方维护","reason","接管后直接生效"),true);
        LocalDate dense=today.plusDays(3);
        for(int i=1;i<=8;i++) {
            create("overlap-"+i,"upper","并发定时 "+i,List.of("employee"),input(dense,10,dense,12),true);
            create("all-day-"+i,"upper","全天事项 "+i,List.of("employee"),new LinkedHashMap<>(Map.of("allDay",true,"startDate",dense.toString(),"dueDate",dense.toString())),true);
        }
        LocalDate monthEnd=today.withDayOfMonth(today.lengthOfMonth());
        if(!monthEnd.isAfter(today)) monthEnd=today.plusMonths(1).withDayOfMonth(today.plusMonths(1).lengthOfMonth());
        create("cross-month","upper","跨月整日覆盖",List.of("employee"),input(monthEnd.minusDays(1),20,monthEnd.plusDays(1),10),true);
        create("full-coverage","upper","中间日仅全天投影",List.of("employee"),input(dense.minusDays(1),20,dense.plusDays(1),10),true);
        create("midnight","upper","午夜截止无次日副本",List.of("employee"),input(dense,10,dense.plusDays(1),0),true);
        create("point","upper","午夜零时长",List.of("employee"),input(dense.plusDays(1),0,dense.plusDays(1),0),true);
        LocalDate yearEnd=LocalDate.of(today.getYear(),12,31);
        create("cross-year","upper","跨年事项",List.of("employee"),input(yearEnd,20,yearEnd.plusDays(1),10),true);
        var rollout=input(today.minusDays(2),9,today.plusDays(7),18);
        String objective=create("rollout-objective","upper","客户工作台灰度上线",List.of("upper","middle","market"),rollout,true);
        var milestone=new LinkedHashMap<>(rollout);milestone.put("parentTaskId",objective);
        String product=create("rollout-product","middle","完成试点流程验收",List.of("product-head-1"),milestone,true);
        create("rollout-market","market","准备试点客户沟通材料",List.of("market-head-1"),milestone,true);
        var execution=new LinkedHashMap<>(rollout);execution.put("parentTaskId",product);
        String validation=create("rollout-validation","product-head-1","验证客户开通与反馈回收流程",List.of("employee"),execution,true);
        command("employee",validation,Map.of("command","progress","progressNote","完成 8 家试点客户的开通校验，2 个反馈已提交产品组。"),true);
        for(String key:actors.keySet()) if(!key.equals("admin")) {
            Actor actor=actors.get(key);
            String focus=switch(actor.role()) {
                case "founder" -> "核对灰度上线目标和发布风险";
                case "department_head" -> "同步部门里程碑和跨组依赖";
                case "team_head" -> "复核组内执行结果和待处理反馈";
                default -> "校对试点客户名单并跟进反馈";
            };
            dailyItems.create(actor,Map.of("date",today.toString(),"body",focus+"，在下班前同步结论。"));
            dailyItems.create(actor,Map.of("date",today.minusDays(1).toString(),"body",focus+"，补齐遗漏记录。"));
            var finished=dailyItems.create(actor,Map.of("date",today.toString(),"body","确认试点发布清单与联系人。"));
            dailyItems.change(actor,s(finished,"id"),"\"1\"",Map.of("completed",true));
            for(int offset=0;offset<3;offset++) {
                String note=focus+switch(offset) {
                    case 0 -> "。首轮试点已完成，下一步处理未关闭的反馈并复核放量条件。";
                    case 1 -> "。已更新工作台试点进度和阻塞问题，明天同步处理结果。";
                    default -> "。与相关同事对齐本周验收范围，明确负责人和交付时间。";
                };
                var log=workspace.createLog(actor,Map.of("businessDate",today.minusDays(offset).toString(),"body",note));
                remember("log-"+key+"-"+offset,"log",s(log,"logId"));
            }
        }
        for(int months=1;months<=3;months++) {
            LocalDate date=today.minusMonths(months);
            String logId=stable("rollout-history-"+months);
            db.update("INSERT INTO work_logs(id,organization_id,author_id,business_date,body,created_at) VALUES(?,?,?,?,?,?)",
                    logId,ORG,stable("employee"),java.sql.Date.valueOf(date),"工作台前期调研第 "+(4-months)+" 轮：完成试点客户访谈，记录开通步骤和常见反馈。",
                    java.sql.Timestamp.from(date.atTime(17,0).atZone(ZoneId.of("Asia/Shanghai")).toInstant()));
            remember("rollout-history-"+months,"log",logId);
        }
        // 重建沿用首次创建时间，另一条日志覆盖真实冻结状态。
        var deleted=db.one("SELECT * FROM work_logs WHERE author_id=? AND business_date=?",stable("colleague"),today.minusDays(1));
        workspace.deleteLog(actors.get("colleague"),s(deleted,"id"),"\""+n(deleted,"rowVersion")+"\"");
        workspace.createLog(actors.get("colleague"),Map.of("businessDate",today.minusDays(1).toString(),"body","根据试点名单修订回访安排，补录已确认的访谈时间。"));
        db.update("UPDATE work_logs SET created_at=UTC_TIMESTAMP(6)-INTERVAL 25 HOUR WHERE author_id=? AND business_date=?",stable("marketing"),today.minusDays(2));
        String tag=stable("tag-focus");
        db.update("INSERT INTO tags(id,organization_id,name,color) VALUES(?,?,'重点','#F6D5D2')",tag,ORG);
        remember("tag-focus","tag",tag);
        var taggedLog=db.one("SELECT id,row_version FROM work_logs WHERE organization_id=? AND author_id=? AND business_date=?",ORG,stable("employee"),today);
        workspace.changeLog(actors.get("employee"),s(taggedLog,"id"),"\""+n(taggedLog,"rowVersion")+"\"",Map.of("tagIds",List.of(tag)));
        command("middle",doing,Map.of("command","change","tagIds",List.of(tag),"reason","重点跟进"),true);
        comments.create(actors.get("middle"),"task",doing,Map.of("body","评论独立于任务进展与审核，请确认清单。"));
        String revoked=create("comment-revoked","upper","评论撤权边界",List.of("employee"),schedule(),true);
        comments.create(actors.get("upper"),"task",revoked,Map.of("body","撤权后旧评论通知不得恢复此正文。"));
        var delivery=worker.getIfAvailable();
        if(delivery!=null) for(int i=0;i<10 && n(db.one("SELECT COUNT(*) AS c FROM domain_events WHERE status='pending'"),"c")>0;i++) delivery.runOnce();
        command("upper",revoked,Map.of("command","change","assigneeIds",List.of(stable("marketing")),"reason","转交其他部门，保留普通历史消息例外"),true);
    }
    private Map<String,Object> schedule() {return input(today,9,today.plusDays(7),18);}
    private Map<String,Object> input(LocalDate start,int hour,LocalDate due,int dueHour) {
        var result=new LinkedHashMap<String,Object>();result.put("allDay",false);
        result.put("startAt",start.atTime(hour,0).atZone(ZoneId.of("Asia/Shanghai")).toOffsetDateTime().toString());
        result.put("dueAt",due.atTime(dueHour,0).atZone(ZoneId.of("Asia/Shanghai")).toOffsetDateTime().toString());return result;
    }
    private String create(String key,String creator,String title,List<String> owners,Map<String,Object> schedule,boolean approve) {
        var body=new LinkedHashMap<>(schedule);body.put("title",title);body.put("description","客户工作台试点交付。请在任务中记录进度、问题和验收结果。当前工作："+title);
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
