package cn.pandora.seed;

import cn.pandora.admin.RoleCatalog;
import cn.pandora.auth.*;
import cn.pandora.common.*;
import cn.pandora.task.TaskService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.*;
import static cn.pandora.common.Db.*;

/** Seed once in a single transaction. Restarting never resets edited business data. */
@Component
@Order(DemoSeed.ORDER)
@ConditionalOnProperty(name="pandora.seed",havingValue="true")
public class DemoSeed implements ApplicationRunner {
    /** Before {@link cn.pandora.admin.OrganizationConstraints} so a seeded database is already mapped. */
    public static final int ORDER = 0;
    private static final String ORG="10000000-0000-0000-0000-000000000001";
    private final Db db; private final TaskService tasks;private final TransactionTemplate tx;private final String password;
    private final RoleCatalog roles;
    private final cn.pandora.auth.Access access;
    private final Map<String,Actor> actors=new LinkedHashMap<>();
    private final LocalDate today=LocalDate.now(ZoneId.of("Asia/Shanghai"));
    public DemoSeed(Db db,TaskService tasks,TransactionTemplate tx,@Value("${pandora.demo-password}") String password,RoleCatalog roles,cn.pandora.auth.Access access) {this.db=db;this.tasks=tasks;this.tx=tx;this.password=password;this.roles=roles;this.access=access;}
    @Override public void run(ApplicationArguments args) {
        tx.executeWithoutResult(status->{
            db.update("INSERT IGNORE INTO organizations(id,name,time_zone) VALUES(?,?,?)",ORG,"潘多拉演示公司","Asia/Shanghai");
            db.one("SELECT id FROM organizations WHERE id=? FOR UPDATE",ORG);
            if(db.jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE organization_id=?",Long.class,ORG)>0) return;
            String managementDepartment=department("管理层"), productDepartment=department("产品部"), marketingDepartment=department("市场部");
            String generalManager=position("总经理"), departmentManager=position("部门经理"), specialist=position("专员"), administrator=position("系统管理员");
            String management=team("公司管理层",managementDepartment), product=team("产品部",productDepartment), marketing=team("市场部",marketingDepartment);
            roles.ensureDefaults(ORG);
            String hash=AuthService.PASSWORDS.encode(password);
            user("upper","王海", "upper",management,managementDepartment,generalManager,null,1,hash);
            user("admin","系统管理员","admin",management,managementDepartment,administrator,null,0,hash);
            user("middle","李敏","middle",product,productDepartment,departmentManager,actors.get("upper").id(),2,hash);
            user("market","陈冲","middle",marketing,marketingDepartment,departmentManager,actors.get("upper").id(),2,hash);
            user("employee","张涛","lower",product,productDepartment,specialist,actors.get("middle").id(),3,hash);
            user("colleague","赵蕾","lower",product,productDepartment,specialist,actors.get("middle").id(),3,hash);
            user("marketing","孙悦","lower",marketing,marketingDepartment,specialist,actors.get("market").id(),3,hash);
            lead(management,actors.get("upper").id());
            lead(product,actors.get("middle").id());
            lead(marketing,actors.get("market").id());
            String parent=create("upper","季度产品目标",List.of("middle"),-3,15,false,true);
            String doing=create("middle","上线素材校对",List.of("employee","colleague"),-2,2,false,true);
            command("employee",doing,Map.of("command","progress","progressNote","已完成第一轮校对，等待产品确认。"),true);
            String completed=create("middle","客户反馈整理",List.of("employee"),-5,-1,false,true);
            command("employee",completed,Map.of("command","complete","completionNote","已按分类整理并复核全部反馈。"),true);
            create("employee","个人研究计划 待创建审核",List.of("employee"),0,5,false,false);
            String pendingComplete=create("middle","产品验收 待完成审核",List.of("employee"),-2,1,false,true);
            command("employee",pendingComplete,Map.of("command","complete","completionNote","验收清单已逐项核对，请审核。"),false);
            String pendingChange=create("upper","跨层派发 待排期变更",List.of("employee"),-1,6,false,true);
            command("upper",pendingChange,Map.of("command","change","title","排期变更后的标题 尚未生效","reason","协调资源，更新任务名称。"),false);
            create("market","市场活动方案",List.of("marketing"),-2,4,false,true);
            create("middle","逾期预算核对",List.of("employee"),-4,-2,false,true);
            create("middle","全天部门培训",List.of("employee","colleague"),0,0,true,true);
            String reopen=create("middle","数据清单复核",List.of("colleague"),-3,3,false,true);
            command("colleague",reopen,Map.of("command","complete","completionNote","首轮复核已完成。"),true);
            command("middle",reopen,Map.of("command","reopen","reason","补充数据后需再复核。"),true);
            Map<String,Object> childInput=input("产品资料 子任务",List.of("employee"),0,3,false);
            childInput.put("parentTaskId",parent);
            var child=tasks.create(actors.get("upper"),childInput); approve(child);
            for(int i=1;i<=6;i++) create("middle","今日排期事项 "+i,List.of("employee"),0,0,false,true);
            for(var entry:actors.entrySet()) {
                Actor a=entry.getValue();if(a.role().equals("admin")) continue;
                for(int i=0;i<3;i++) {
                    db.update("INSERT INTO work_logs(id,organization_id,author_id,business_date,body,task_id) VALUES(?,?,?,?,?,?)",id(),ORG,a.id(),today.minusDays(i),i==0?"完成本日工作整理，记录待办与协作问题。":"复盘工作进展并补充后续计划。",entry.getKey().equals("employee")?doing:null);
                }
                db.update("INSERT INTO home_items(id,organization_id,owner_id,kind,title,body,sort_order) VALUES(?,?,?,'personal',?,?,0)",id(),ORG,a.id(),"本周关注","明确完成标准，及时同步阻塞事项。");
            }
            for(int i=1;i<=3;i++) db.update("INSERT INTO home_items(id,organization_id,kind,title,body,sort_order) VALUES(?,?,'company',?,?,?)",id(),ORG,"公司目标 "+i,List.of("按计划交付并保障质量","及时处理客户反馈","完善协作与知识记录").get(i-1),i);
        });
    }
    private String department(String name) {String id=id();db.update("INSERT INTO departments(id,organization_id,name) VALUES(?,?,?)",id,ORG,name);return id;}
    private String position(String name) {String id=id();db.update("INSERT INTO positions(id,organization_id,name) VALUES(?,?,?)",id,ORG,name);return id;}
    private String team(String name,String departmentId) {String id=id();db.update("INSERT INTO teams(id,organization_id,name,department_id) VALUES(?,?,?,?)",id,ORG,name,departmentId);return id;}
    private void lead(String teamId,String userId) {db.update("UPDATE teams SET lead_user_id=? WHERE organization_id=? AND id=?",userId,ORG,teamId);}
    private void user(String username,String name,String role,String team,String department,String position,String manager,int rank,String hash) {
        String uid=id();db.update("INSERT INTO users(id,organization_id,team_id,department_id,position_id,manager_id,username,password_hash,display_name,role,rank_level) VALUES(?,?,?,?,?,?,?,?,?,?,?)",uid,ORG,team,department,position,manager,username,hash,name,role,rank);
        roles.grant(ORG,uid,RoleCatalog.codeForLegacyRole(role),null);
        // The seeded actors carry their real capabilities and ranges, exactly like a logged-in one.
        actors.put(username,access.actor(db.one("SELECT * FROM users WHERE id=?",uid)));
    }
    private Map<String,Object> input(String title,List<String> owners,int start,int due,boolean allDay) {
        Map<String,Object> body=new LinkedHashMap<>();body.put("title",title);body.put("description","本地演示任务，用于核对任务流转与人员权限。");body.put("acceptanceCriteria","材料完整、结果可复核，并经审核确认。");body.put("priority",due<0?"urgent":"medium");body.put("allDay",allDay);body.put("assigneeIds",owners.stream().map(k->actors.get(k).id()).toList());
        if(allDay) { body.put("startDate",today.plusDays(start).toString());body.put("dueDate",today.plusDays(due).toString()); }
        else {body.put("startAt",today.plusDays(start).atTime(9,0).atZone(ZoneId.of("Asia/Shanghai")).toOffsetDateTime().toString());body.put("dueAt",today.plusDays(due).atTime(18,0).atZone(ZoneId.of("Asia/Shanghai")).toOffsetDateTime().toString());}
        return body;
    }
    private String create(String creator,String title,List<String> owners,int start,int due,boolean allDay,boolean approve) {
        var result=tasks.create(actors.get(creator),input(title,owners,start,due,allDay));if(approve) approve(result);return s(result,"taskId");
    }
    private void command(String username,String taskId,Map<String,Object> body,boolean approve) {
        long version=db.jdbc.queryForObject("SELECT row_version FROM tasks WHERE id=?",Long.class,taskId);
        var result=tasks.change(actors.get(username),taskId,"\""+version+"\"",body);if(approve) approve(result);
    }
    private void approve(Map<String,Object> result) {
        String rid=s(result,"requestId");if(rid==null) return;
        var r=db.one("SELECT * FROM approval_requests WHERE id=?",rid);if(!"pending".equals(s(r,"status"))) return;
        Actor reviewer=actors.values().stream().filter(a->a.id().equals(s(r,"currentReviewerId"))).findFirst().orElseThrow();
        tasks.decide(reviewer,rid,"\""+n(r,"rowVersion")+"\"",Map.of("decision","approve","comment","演示初始化审核通过"));
    }
}
