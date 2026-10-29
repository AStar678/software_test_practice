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
    private static final int MANIFEST=2;
    private final Db db;
    private final TaskService tasks;
    private final WorkspaceService workspace;
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
    public DemoSeed(Db db,TaskService tasks,WorkspaceService workspace,CommentService comments,
                    BusinessTakeovers takeovers,Access access,OrganizationService organization,ObjectProvider<EventsWorker> worker,TransactionTemplate tx,Clock clock,
                    @Value("${pandora.demo-password}") String password,
                    @Value("${pandora.demo-target:}") String target,
                    @Value("${pandora.demo-marker:}") String marker,
                    @Value("${pandora.demo-initialize:false}") boolean initialize) {
        this.db=db;this.tasks=tasks;this.workspace=workspace;this.comments=comments;
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
            db.update("INSERT INTO organizations(id,name,time_zone) VALUES(?,?,'Asia/Shanghai')",ORG,"潘多拉演示公司");
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
        String departmentTitle=unit("positions","title-department","部门负责人",null);
        String headTitle=unit("positions","title-team","团队负责人",null);
        String employeeTitle=unit("positions","title-employee","业务专员",null);
        String hash=AuthService.PASSWORDS.encode(password);
        employee("upper","王海","13800000001","founder",null,null,founderTitle,hash);
        for(String dep:List.of("product","market")) {
            String department=unit("departments","department-"+dep,dep.equals("product")?"产品部":"市场部",null);
            employee(dep.equals("product")?"middle":"market",dep.equals("product")?"李敏":"陈冲",dep.equals("product")?"13800000002":"13800000003","department_head",department,null,departmentTitle,hash);
            for(int i=1;i<=2;i++) {
                String team=unit("teams","team-"+dep+"-"+i,(dep.equals("product")?"产品":"市场")+i+"组",department);
                employee(dep+"-head-"+i,(dep.equals("product")?"产品":"市场")+"组长"+i,"138000000"+(dep.equals("product")?10+i:20+i),"team_head",department,team,headTitle,hash);
                if(dep.equals("product") && i==1) {
                    employee("employee","张涛","13800000004","employee",department,team,employeeTitle,hash);
                    employee("colleague","赵蕾","13800000005","employee",department,team,employeeTitle,hash);
                } else employee(dep.equals("market") && i==1?"marketing":dep+"-employee-"+i,
                        (dep.equals("product")?"产品":"市场")+"专员"+i,dep.equals("market") && i==1?"13800000006":"138000000"+(dep.equals("product")?30+i:40+i),"employee",department,team,employeeTitle,hash);
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
        db.update("INSERT INTO users(id,organization_id,password_hash,display_name,phone,login_phone,email) VALUES(?,?,?,?,?,?,?)",employeeId,ORG,hash,name,phone,phone,key+"@demo.example.test");
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
        for(int i=1;i<=10;i++) {
            var item=organization.createCompanyItem(actors.get("admin"),Map.of("title","公司事项 "+i,"body","公司重要事项 "+i+"：交付、质量与协作。"));
            remember("company-item-"+i,"home-item",s(item,"id"));
        }
        for(String key:actors.keySet()) if(!key.equals("admin")) {
            for(int offset=0;offset<3;offset++) {
                var log=workspace.createLog(actors.get(key),Map.of("businessDate",today.minusDays(offset).toString(),"body","演示日志："+key+" / 业务日 "+today.minusDays(offset)));
                remember("log-"+key+"-"+offset,"log",s(log,"logId"));
            }
            workspace.createHomeItem(actors.get(key),Map.of("kind","personal","title","本周关注","body","明确完成标准，及时同步阻塞。"));
        }
        // Recreated slot retains its first creation instant. Another log demonstrates a real frozen row.
        var deleted=db.one("SELECT * FROM work_logs WHERE author_id=? AND business_date=?",stable("colleague"),today.minusDays(1));
        workspace.deleteLog(actors.get("colleague"),s(deleted,"id"),"\""+n(deleted,"rowVersion")+"\"");
        workspace.createLog(actors.get("colleague"),Map.of("businessDate",today.minusDays(1).toString(),"body","删除后重建，首次创建时间保持不变。"));
        db.update("UPDATE work_logs SET created_at=UTC_TIMESTAMP(6)-INTERVAL 25 HOUR WHERE author_id=? AND business_date=?",stable("marketing"),today.minusDays(2));
        for(int i=1;i<=110;i++) create("page-"+i,"upper","分页事项 "+String.format("%03d",i),List.of("employee"),input(today.plusDays(i%20),9,today.plusDays(30),18),true);
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
        String tag=stable("tag-focus");
        db.update("INSERT INTO tags(id,organization_id,name,color) VALUES(?,?,'重点','#F6D5D2')",tag,ORG);
        remember("tag-focus","tag",tag);
        db.update("UPDATE work_logs SET tag_id=? WHERE author_id=? AND business_date=?",tag,stable("employee"),today);
        command("middle",doing,Map.of("command","change","tagId",tag,"reason","重点跟进"),true);
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
        var body=new LinkedHashMap<>(schedule);body.put("title",title);body.put("description","真实持久演示数据："+title);
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
