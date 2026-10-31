package cn.pandora.task;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.auth.CompanyTree;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import cn.pandora.workspace.ExpiryService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.Clock;
import java.util.*;
import static cn.pandora.common.Db.s;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/** Compare the batched path to the unchanged single-object authority/projection at meaningful scale. */
class TaskBatchReadTest {
    static String id(int n) {return String.format("00000000-0000-0000-0000-%012d",n);}
    static Map<String,Object> row(Object... values) {
        var result=new LinkedHashMap<String,Object>();result.put("organizationId","org");
        for(int i=0;i<values.length;i+=2) result.put((String)values[i],values[i+1]);return result;
    }
    static class Data extends Db {
        final Map<String,Map<String,Object>> people=new LinkedHashMap<>(),tasks=new LinkedHashMap<>(),versions=new LinkedHashMap<>(),requests=new LinkedHashMap<>();
        final List<Map<String,Object>> placements=new ArrayList<>(),teams=new ArrayList<>(),departments=new ArrayList<>();
        final Map<String,List<String>> owners=new HashMap<>();
        final Map<String,String> businessOwners=new HashMap<>();
        final List<String> queries=new ArrayList<>();
        long authzVersion=1;
        Data(int count) {
            super(null,null);
            person(1,"founder",null,null);
            for(int dep=10;dep<=20;dep+=10) {
                departments.add(row("id",TaskBatchReadTest.id(dep)));person(dep,"department_head",TaskBatchReadTest.id(dep),null);
                for(int team=dep+1;team<=dep+2;team++) {
                    teams.add(row("id",TaskBatchReadTest.id(team),"departmentId",TaskBatchReadTest.id(dep)));person(team,"team_head",TaskBatchReadTest.id(dep),TaskBatchReadTest.id(team));
                }
            }
            for(int i=0;i<500;i++) {int team=new int[]{11,12,21,22}[i%4];person(100+i,"employee",TaskBatchReadTest.id(team<20?10:20),TaskBatchReadTest.id(team));}
            for(int i=0;i<count;i++) {
                String task=TaskBatchReadTest.id(10000+i),version=TaskBatchReadTest.id(20000+i),owner=TaskBatchReadTest.id(100+i%500),creator=TaskBatchReadTest.id(i%3==0?1:101);
                tasks.put(task,row("id",task,"currentVersionId",version,"originalCreatorId",creator,"executionState",i%2==0?"doing":"todo",
                        "rowVersion",1,"executionRound",1,"dueVersion",1,"createdAt","2026-10-01T00:00:00Z","updatedAt","2026-10-01T00:00:00Z"));
                versions.put(version,row("id",version,"taskId",task,"versionNo",1,"title","任务 "+i,"description","正文保留 "+i,"createdBy",creator,
                        "priority",i%2==0?"high":"low","executionState","todo","startAt","2026-10-01T00:00:00Z","dueAt","2026-11-01T00:00:00Z","parentTaskId",null));
                owners.put(version,List.of(owner));businessOwners.put(task,creator);
            }
        }
        void person(int n,String type,String dep,String team) {
            people.put(TaskBatchReadTest.id(n),row("id",TaskBatchReadTest.id(n),"displayName","人员 "+n,"active",true,"reviewerAvailable",true,"credentialVersion",1,"mustChangePassword",false,"accountType","employee"));
            placements.add(row("employeeId",TaskBatchReadTest.id(n),"placementType",type,"departmentId",dep,"teamId",team,"positionId",TaskBatchReadTest.id(2)));
        }
        @Override public List<Map<String,Object>> list(String sql,Object... args) {
            queries.add(sql);
            if(sql.startsWith("SELECT authz_version")) return List.of(row("authzVersion",authzVersion));
            if(sql.startsWith("SELECT founder_employee_id")) return List.of(row("founderEmployeeId",TaskBatchReadTest.id(1)));
            if(sql.startsWith("SELECT time_zone")) return List.of(row("timeZone","Asia/Shanghai"));
            if(sql.startsWith("SELECT u.id,u.organization_id,u.display_name,(")) return copy(people.values());
            if(sql.startsWith("SELECT * FROM departments")) return copy(departments);
            if(sql.startsWith("SELECT * FROM teams")) return copy(teams);
            if(sql.startsWith("SELECT * FROM positions")) return List.of(row("id",TaskBatchReadTest.id(2)));
            if(sql.startsWith("SELECT * FROM employee_placements")) return copy(placements);
            if(sql.startsWith("SELECT id,display_name FROM users")) return select(people,args,1,sql.contains("id IN")).stream().sorted(Comparator.comparing(r->s(r,"id"))).toList();
            if(sql.startsWith("SELECT * FROM users WHERE id=?")) return one(people.get(args[0]));
            if(sql.startsWith("SELECT t.* FROM tasks t")) return copy(tasks.values()); // Repeated Access check must independently reject out-of-scope candidates.
            if(sql.startsWith("SELECT * FROM tasks")) return select(tasks,args,1,sql.contains("id IN") || sql.contains("AND id=?"));
            if(sql.startsWith("SELECT * FROM task_version_tags")) return List.of();
            if(sql.startsWith("SELECT * FROM task_versions")) return select(versions,args,1,true);
            if(sql.startsWith("SELECT version_id,user_id FROM task_version_assignees")) {
                var result=new ArrayList<Map<String,Object>>();for(int i=1;i<args.length;i++) for(String owner:owners.getOrDefault(args[i],List.of())) result.add(row("versionId",args[i],"userId",owner));return result;
            }
            if(sql.startsWith("SELECT user_id FROM task_version_assignees")) return owners.getOrDefault(args[1],List.of()).stream().map(owner->row("userId",owner)).toList();
            if(sql.startsWith("SELECT employee_id FROM task_business_owners")) return businessOwners.containsKey(args[1])?List.of(row("employeeId",businessOwners.get(args[1]))):List.of();
            if(sql.startsWith("SELECT task_id,employee_id FROM task_business_owners")) {
                var result=new ArrayList<Map<String,Object>>();for(int i=1;i<args.length;i++) if(businessOwners.containsKey(args[i])) result.add(row("taskId",args[i],"employeeId",businessOwners.get(args[i])));return result;
            }
            if(sql.startsWith("SELECT task_id FROM user_task_pins")) return List.of();
            if(sql.startsWith("SELECT * FROM approval_requests") || sql.startsWith("SELECT id,task_id,proposed_version_id")) {
                if(sql.contains("status='pending' AND task_id IN")) return requests.values().stream().filter(r->"pending".equals(s(r,"status")) && Arrays.asList(args).contains(s(r,"taskId"))).map(LinkedHashMap::new).map(r->(Map<String,Object>)r).toList();
                if(sql.contains("task_id=? AND status='pending'")) return requests.values().stream().filter(r->Objects.equals(args[1],s(r,"taskId")) && "pending".equals(s(r,"status"))).map(LinkedHashMap::new).map(r->(Map<String,Object>)r).toList();
                return copy(requests.values());
            }
            throw new AssertionError("Unexpected SQL: "+sql);
        }
        List<Map<String,Object>> select(Map<String,Map<String,Object>> values,Object[] args,int first,boolean filter) {
            if(!filter) return copy(values.values());var result=new ArrayList<Map<String,Object>>();
            for(int i=first;i<args.length;i++) if(values.containsKey(args[i])) result.add(new LinkedHashMap<>(values.get(args[i])));return result;
        }
        static List<Map<String,Object>> copy(Collection<Map<String,Object>> rows) {return rows.stream().map(LinkedHashMap::new).map(r->(Map<String,Object>)r).toList();}
        static List<Map<String,Object>> one(Map<String,Object> row) {return row==null?List.of():List.of(new LinkedHashMap<>(row));}
    }
    record Fixture(Data db,Access access,TaskService service) {
        Fixture(int tasks) {this(new Data(tasks));}
        Fixture(Data db) {this(db,new Access(db));}
        Fixture(Data db,Access access) {this(db,access,new TaskService(db,access,mock(Events.class),Clock.systemUTC(),mock(ExpiryService.class),new CompanyTree(db),mock(Tags.class)));}
        Actor actor(int n) {return access.actor(db.people.get(id(n)));}
    }
    @SuppressWarnings("unchecked")
    @Test void allFixedRolesKeepTheSingleObjectVisibilityAndProjection() {
        var f=new Fixture(20);
        f.db.businessOwners.put(id(10000),id(103)); // Explicit takeover adds a cross-department personal relationship.
        f.db.versions.get(id(20001)).put("parentTaskId",id(10003));
        for(int person:List.of(1,10,11,12,20,21,100,101,103,105)) {
            Actor actor=f.actor(person);var expected=new ArrayList<Map<String,Object>>();
            for(var task:f.db.tasks.values()) {
                var version=f.db.versions.get(s(task,"currentVersionId"));var owners=f.db.owners.get(s(version,"id"));
                if(!f.access.canSeeTask(actor,task,version,owners)) continue;
                Map<String,Object> view=ReflectionTestUtils.invokeMethod(f.service,"taskView",actor,task,version,owners);
                view.put("pinned",false);expected.add(view);
            }
            var result=f.service.list(actor,Map.of("limit","3","offset","1"));
            assertEquals(expected.size(),result.get("total"),"actor "+person);
            assertEquals(expected.subList(Math.min(1,expected.size()),Math.min(4,expected.size())),result.get("items"),"actor "+person);
            var expectedIds=new LinkedHashSet<String>();expected.forEach(r->expectedIds.add(s(r,"id")));
            assertEquals(expectedIds,f.service.readableTaskIds(actor,f.db.tasks.keySet()));
        }
    }
    @Test void fiveThousandTasksUseBoundedQueriesAndOneAnalyticsSnapshot() {
        var f=new Fixture(5000);Actor founder=f.actor(1);f.db.queries.clear();
        var result=f.service.list(founder,Map.of("limit","10"));
        assertEquals(5000,result.get("total"));assertEquals(10,((List<?>)result.get("items")).size());
        assertTrue(f.db.queries.size()<100,"SQL calls: "+f.db.queries.size());
        assertTrue(f.db.queries.stream().noneMatch(q->q.startsWith("SELECT * FROM users WHERE")),"routes must not fetch credentials per task");
        f.db.queries.clear();assertEquals(5000,f.service.statisticsTasks(founder,Map.of()).size());
        assertTrue(f.db.queries.size()<100,"analytics SQL calls: "+f.db.queries.size());
        assertEquals(1,f.db.queries.stream().filter(q->q.startsWith("SELECT t.* FROM tasks")).count());
        Actor department=f.actor(10);f.db.queries.clear();f.service.list(department,Map.of("limit","1"));
        String candidate=f.db.queries.stream().filter(q->q.startsWith("SELECT t.*")).findFirst().orElseThrow();
        assertTrue(candidate.contains("task_business_owners") && candidate.contains("employee_placements") && candidate.contains("pr.active=1") && candidate.contains("ep.department_id=?"));
    }
    @Test void pendingReviewerUsesOperatorManagerAndHistoricalReviewDoesNotGrantComments() {
        var f=new Fixture(3);String task=id(10000);f.db.businessOwners.put(task,id(103));
        f.db.requests.put(id(30000),row("id",id(30000),"taskId",task,"kind","progress","status","pending","applicantId",id(105),"currentReviewerId",id(104),
                "proposedVersionId",id(20000),"baseVersionId",id(20000),"rowVersion",1));
        assertEquals(1,f.service.approvals(f.actor(12),"reviewer","1","0").get("total"));
        assertEquals(0,f.service.approvals(f.actor(104),"reviewer","1","0").get("total"));
        // The historical reviewer can open the ordinary message, but has no effective task/comment right.
        f.db.requests.get(id(30000)).put("status","approved");
        assertEquals(Set.of(task),f.service.readableTaskIds(f.actor(104),List.of(task),true));
        assertEquals(Set.of(),f.service.readableTaskIds(f.actor(104),List.of(task),false));
        // Creation ignores a stale stored reviewer and uses the creator's current direct manager.
        f.db.tasks.get(task).put("originalCreatorId",id(100));f.db.requests.get(id(30000)).put("kind","create");f.db.requests.get(id(30000)).put("status","pending");
        assertEquals(1,f.service.approvals(f.actor(12),"reviewer","1","0").get("total"));
        assertEquals(0,f.service.approvals(f.actor(104),"reviewer","1","0").get("total"));
    }
    @Test void snapshotsAreClearedAfterFailureAndNeverSurviveOwnershipChanges() {
        var f=new Fixture(3);Actor employee=f.actor(104);String task=id(10000);
        assertEquals(0,f.service.list(employee,Map.of()).get("total"));
        assertThrows(ApiException.class,()->f.service.list(employee,Map.of("state","invalid")));
        f.db.businessOwners.put(task,employee.id());
        assertEquals(1,f.service.list(employee,Map.of()).get("total"));
        f.db.businessOwners.put(task,id(103));
        assertEquals(0,f.service.list(employee,Map.of()).get("total"));
        f.db.authzVersion=2;
        assertThrows(ApiException.class,()->f.service.list(employee,Map.of()));
    }
    @Test void administratorTaskLocatorBatchesEvenForAOneItemPage() {
        var f=new Fixture(5000);Actor admin=f.access.actor(row("id",id(9),"accountType","admin","active",true));
        f.db.queries.clear();var result=f.service.adminTasks(admin,Map.of("limit","1"));
        assertEquals(5000,result.get("total"));assertEquals(1,((List<?>)result.get("items")).size());
        assertEquals(10,f.db.queries.stream().filter(q->q.startsWith("SELECT * FROM task_version_tags")).count(),"one tag batch per 500 versions");
        assertTrue(f.db.queries.size()<45,"admin SQL calls: "+f.db.queries.size());
        assertEquals(Set.of(),f.service.readableTaskIds(admin,f.db.tasks.keySet(),true));
    }

    @Test void analyticsKeepsFrozenCompletionAndEffectiveStateFields() {
        var f=new Fixture(3);String task=id(10000);
        f.db.requests.put(id(30000),row("id",id(30000),"taskId",task,"kind","complete","status","pending",
                "applicantId",id(100),"currentReviewerId",id(1),"proposedVersionId",id(20000),"baseVersionId",id(20000),"rowVersion",1));
        var analytics=f.service.statisticsTasks(f.actor(1),Map.of());
        var projected=(List<?>)f.service.list(f.actor(1),Map.of()).get("items");
        for(int i=0;i<analytics.size();i++) {
            var item=(Map<?,?>)projected.get(i);
            for(String key:List.of("id","title","description","priority","executionState","startAt","dueAt","assigneeIds",
                    "originalCreatorId","businessOwnerId","frozen","pending","pendingKind"))
                assertEquals(item.get(key),analytics.get(i).get(key),key);
        }
        assertEquals(true,analytics.getFirst().get("frozen"));
        assertEquals("complete",analytics.getFirst().get("pendingKind"));
        assertEquals("todo",analytics.getFirst().get("executionState"));
    }

    @Test void historicalNotificationProbeDoesNotFailForAnUnavailablePendingAssignee() {
        var f=new Fixture(1);String task=id(10000);Actor reader=f.actor(104);
        f.db.people.get(id(100)).put("active",false);
        f.db.placements.removeIf(place->id(100).equals(s(place,"employeeId")));
        f.db.requests.put(id(30000),row("id",id(30000),"taskId",task,"kind","progress","status","pending",
                "applicantId",id(105),"currentReviewerId",reader.id(),"proposedVersionId",id(20000),"baseVersionId",id(20000),"rowVersion",1));
        assertEquals(Set.of(),f.service.readableTaskIds(reader,List.of(task),true));
        // A broken owner blocks the request and removes it from the former reviewer inbox.
        assertEquals(List.of(),f.service.approvals(reader,"reviewer","1","0").get("items"));
    }

}
