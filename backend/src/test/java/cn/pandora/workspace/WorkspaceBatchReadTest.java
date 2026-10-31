package cn.pandora.workspace;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import cn.pandora.task.TaskService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.*;
import java.util.*;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class WorkspaceBatchReadTest {
    private static final Actor VIEWER=new Actor("viewer","org","employee","team","manager",1);
    private static final Instant NOW=Instant.parse("2026-10-29T10:00:00Z");

    @Test
    void listAndDetailAgreeOnCurrentCommentAuthorityAndHistoricalMessages() {
        var f=new Fixture();
        f.add("ordinary","task.change.approved",false,false,false);
        f.add("comment-lost","comment.created",false,false,false);
        f.add("comment-deleted","comment.created",true,true,false);
        f.add("comment-withdrawn","comment.created",true,true,true);
        f.add("comment-readable","comment.created",true,false,false);
        f.add("masked","task.create.approved",true,false,false).put("contentMasked",1);
        f.add("withdrawn","task.create.approved",true,false,true);
        var result=f.service.notifications(VIEWER,Map.of("limit","100"));
        assertEquals(7,result.get("total"));
        for(var row:items(result)) assertEquals(f.service.notification(VIEWER,Db.s(row,"id")),row,Db.s(row,"id"));
        var lost=items(result).stream().filter(row->"comment-lost".equals(row.get("id"))).findFirst().orElseThrow();
        assertFalse((boolean)lost.get("canOpenTask"));
        assertNull(lost.get("commentId"));
        assertEquals("你的工作关系或访问范围已变化，请查看当前工作安排。",lost.get("summary"));
        var ordinary=items(result).getFirst();
        assertTrue((boolean)ordinary.get("canOpenTask"));
        assertTrue((boolean)ordinary.get("relationLost"));
    }

    @Test
    void metadataPaginationDoesNotLoadUnselectedMessagesOrEvents() {
        var f=new Fixture();
        IntStream.range(0,8000).forEach(i->f.add("n"+i,"task.progress.approved",false,false,false));
        f.db.rows.get("notifications").get(0).put("readAt",NOW.toString());
        var result=f.service.notifications(VIEWER,Map.of("limit","1","offset","4000","unread","true"));
        assertEquals(7999,result.get("total"));
        assertEquals(7999L,result.get("unreadCount"));
        assertEquals("n4001",items(result).getFirst().get("id"));
        var projections=f.db.queries.stream().filter(q->q.sql.contains("id IN (")).toList();
        assertTrue(projections.stream().allMatch(q->q.args.length==2),"only selected page IDs are fetched");
        assertTrue(f.db.queries.size()<=8,"database query count is bounded by page projection, not 8000 rows");
        assertFalse(f.db.queries.stream().anyMatch(q->q.sql.startsWith("SELECT * FROM notifications WHERE") && !q.sql.contains(" IN (")));
    }

    @Test
    void expiredHiddenAndUnauthorizedLegacyMessagesDoNotAffectCounts() {
        var f=new Fixture();
        f.add("delivered","task.change.approved",false,false,false);
        f.add("legacy-denied","task.change.approved",false,false,false).put("source","legacy");
        f.add("legacy-readable","task.change.approved",true,false,false).put("source","legacy");
        f.add("hidden","task.change.approved",true,false,false).put("hiddenAt",NOW.toString());
        f.add("expired","task.change.approved",true,false,false).put("expiresAt",NOW.toString());
        f.add("event-expired","task.change.approved",true,false,false);
        f.db.row("domain_events","e-event-expired").put("expiresAt",NOW.toString());
        f.add("revoked-legacy","task.change.approved",false,false,true).put("source","legacy");
        var result=f.service.notifications(VIEWER,Map.of("limit","100"));
        assertEquals(List.of("delivered","legacy-readable","revoked-legacy"),items(result).stream().map(r->r.get("id")).toList());
        assertEquals(3L,result.get("unreadCount"));
    }

    @Test
    void unpublishedCommentCanUseApprovalButPublishedCommentCannotReuseOldApproval() {
        var f=new Fixture();
        f.add("unpublished","comment.created",false,false,false);
        f.db.row("tasks","t-unpublished").remove("currentVersionId");
        f.approvalReadable.add("t-unpublished");
        f.add("published","comment.created",false,false,false);
        f.approvalReadable.add("t-published");
        var result=items(f.service.notifications(VIEWER,Map.of("limit","100")));
        assertTrue((boolean)result.get(0).get("canOpenTask"));
        assertFalse((boolean)result.get(1).get("canOpenTask"));
        f.currentReadable.add("t-published");
        assertTrue((boolean)items(f.service.notifications(VIEWER,Map.of("limit","100"))).get(1).get("canOpenTask"));
        f.currentReadable.clear();
        assertFalse((boolean)items(f.service.notifications(VIEWER,Map.of("limit","100"))).get(1).get("canOpenTask"),"a later request must recheck revoked authority");
    }

    @Test
    void combinedFiltersApplyBeforePagingAndKeepGlobalUnreadCount() {
        var f=new Fixture();
        f.add("comment","comment.created",true,false,false);
        f.add("result-read","task.change.approved",true,false,false).put("readAt",NOW.toString());
        f.add("result-one","task.change.approved",true,false,false);
        f.add("result-two","task.complete.approved",true,false,false);
        var result=f.service.notifications(VIEWER,Map.of("readStatus","unread","category","result","limit","1","offset","1"));
        assertEquals(2,result.get("total"));
        assertEquals(3L,result.get("unreadCount"));
        assertEquals("result-two",items(result).getFirst().get("id"));
        assertEquals("result",items(result).getFirst().get("category"));
        assertEquals("result-read",items(f.service.notifications(VIEWER,Map.of("readStatus","read","category","result"))).getFirst().get("id"));
    }

    @Test
    void reviewCategoryTracksReassignmentDeadlineWithdrawalAndTerminalState() {
        var f=new Fixture();
        for(String id:List.of("live","reassigned","expired","withdrawn","finished")) {
            f.add(id,"task.progress.submitted",true,false,"withdrawn".equals(id));
            var request=f.db.row("approval_requests","r-"+id);
            request.put("status","finished".equals(id)?"approved":"pending");
            request.put("currentReviewerId","reassigned".equals(id)?"someone-else":VIEWER.id());
            request.put("applicableDeadline",("expired".equals(id)?NOW:NOW.plusSeconds(60)).toString());
        }
        var review=items(f.service.notifications(VIEWER,Map.of("category","review")));
        assertEquals(List.of("live"),review.stream().map(r->r.get("id")).toList());
        assertTrue((boolean)review.getFirst().get("canReview"));
        assertEquals(4,f.service.notifications(VIEWER,Map.of("category","other")).get("total"));
        assertEquals(0,f.service.notifications(VIEWER,Map.of("category","result")).get("total"));
        for(var row:items(f.service.notifications(VIEWER,Map.of())))
            assertEquals(f.service.notification(VIEWER,Db.s(row,"id")).get("category"),row.get("category"));
    }

    @Test
    void logsProjectOnlyTheSelectedPageAndNeverExposeUnreadableLinkedTasks() {
        var f=new Fixture();
        when(f.access.logAuthorIds(VIEWER)).thenReturn(List.of("viewer"));
        IntStream.range(0,200).forEach(i->f.db.add("work_logs",map("id","l"+i,"authorId","viewer","businessDate","2026-10-29",
                "createdAt","2026-10-29T09:00:00Z","taskId","t"+i,"tagId","tag"+i,"body","body")));
        f.db.add("tags",map("id","tag30","name","旧标签","color","#F6D5D2","rowVersion",1L,"deletedAt",NOW.toString()));
        var result=f.service.logs(VIEWER,Map.of("limit","1","offset","30"));
        assertEquals(200,result.get("total"));
        var row=items(result).getFirst();
        assertEquals("l30",row.get("id"));
        assertFalse(row.containsKey("taskId"));
        assertEquals(true,row.get("editable"));
        assertEquals(true,((Map<?,?>)row.get("tag")).get("deleted"));
        verify(f.tasks).readableTaskIds(VIEWER,List.of("t30"));
        assertEquals(3,f.db.queries.size());
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String,Object>> items(Map<String,Object> response) {
        return (List<Map<String,Object>>)response.get("items");
    }
    private static Map<String,Object> map(Object... args) {
        var row=new LinkedHashMap<String,Object>();for(int i=0;i<args.length;i+=2)row.put((String)args[i],args[i+1]);return row;
    }
    private static final class Fixture {
        final MemoryDb db=new MemoryDb();
        final Access access=WorkspaceTestSupport.access();
        final TaskService tasks=mock(TaskService.class);
        final Set<String> currentReadable=new HashSet<>(),approvalReadable=new HashSet<>();
        final WorkspaceService service=new WorkspaceService(db,access,tasks,mock(Events.class),Clock.fixed(NOW,ZoneOffset.UTC));
        Fixture() {
            when(access.canSeeTask(eq(VIEWER),anyMap(),anyMap(),anyList())).thenAnswer(c->currentReadable.contains(Db.s(c.getArgument(1),"id")));
            when(access.isManagerOf(eq(VIEWER),anyString())).thenReturn(true);
            when(tasks.readableTaskIds(eq(VIEWER),anyCollection())).thenAnswer(c->new HashSet<>(currentReadable));
            when(tasks.readableTaskIds(eq(VIEWER),anyCollection(),eq(true))).thenAnswer(c->{var ids=new HashSet<>(currentReadable);ids.addAll(approvalReadable);return ids;});
            when(tasks.canReadRequest(eq(VIEWER),anyString())).thenAnswer(c->approvalReadable.contains(((String)c.getArgument(1)).replace("r-","t-")));
        }
        Map<String,Object> add(String id,String type,boolean readable,boolean deleted,boolean withdrawn) {
            String task="t-"+id,version="v-"+id,event="e-"+id,comment="c-"+id,request="r-"+id;
            var row=map("id",id,"eventId",event,"eventType",type,"taskId",task,"objectType","task","objectId",task,
                    "source","event","deliveredAt","2026-10-29T09:00:00Z","summary","private excerpt","requestId",request,"rowVersion",1L);
            db.add("notifications",row);
            var e=map("id",event,"title","title-"+id,"initiatorId","initiator","changeSummary","private change","occurredAt","2026-10-29T09:00:00Z",
                    "detailsJson",db.json(type.startsWith("comment.")?Map.of("commentId",comment):Map.of()));
            if(withdrawn)e.put("revokedAt","2026-10-29T09:01:00Z");db.add("domain_events",e);
            var c=map("id",comment);if(deleted)c.put("deletedAt",NOW.toString());db.add("task_log_comments",c);
            db.add("tasks",map("id",task,"currentVersionId",version,"originalCreatorId","initiator"));
            db.add("task_versions",map("id",version,"taskId",task,"title","title-"+id));
            db.add("approval_requests",map("id",request,"taskId",task,"kind","change","status","approved","comment","decision"));
            if(readable)currentReadable.add(task);
            return row;
        }
    }
    private record Query(String sql,Object[] args) {}
    private static final class MemoryDb extends Db {
        final Map<String,List<Map<String,Object>>> rows=new HashMap<>();
        final List<Query> queries=new ArrayList<>();
        MemoryDb(){super(null,new ObjectMapper());}
        void add(String table,Map<String,Object> row){rows.computeIfAbsent(table,k->new ArrayList<>()).add(row);}
        Map<String,Object> row(String table,String id){return rows.get(table).stream().filter(r->id.equals(r.get("id"))).findFirst().orElseThrow();}
        @Override public List<Map<String,Object>> list(String sql,Object...args) {
            queries.add(new Query(sql,args));
            String table=sql.substring(sql.indexOf(" FROM ")+6).split(" ")[0];
            var source=rows.getOrDefault(table,List.of());
            if(sql.startsWith("SELECT n.id,")) return source.stream().filter(r->r.get("hiddenAt")==null)
                    .filter(r->!sql.contains("n.read_at IS NULL") || r.get("readAt")==null).map(r->{
                        var value=new LinkedHashMap<>(r);var event=row("domain_events",Db.s(r,"eventId"));
                        value.put("eventRevokedAt",event.get("revokedAt"));value.put("eventExpiresAt",event.get("expiresAt"));
                        var request=row("approval_requests",Db.s(r,"requestId"));
                        value.put("requestStatus",request.get("status"));value.put("reviewerId",request.get("currentReviewerId"));value.put("applicableDeadline",request.get("applicableDeadline"));
                        return (Map<String,Object>)value;}).toList();
            if(sql.contains("task_version_assignees"))return List.of();
            if(sql.startsWith("SELECT w.id,"))return source.stream().map(LinkedHashMap::new).map(r->(Map<String,Object>)r).toList();
            Set<Object> ids=new HashSet<>(Arrays.asList(args));
            return source.stream().filter(r->ids.contains(r.get("id")) || (sql.contains("task_id=?") && !sql.contains(" AND id=?") && ids.contains(r.get("taskId"))))
                    .map(LinkedHashMap::new).map(r->(Map<String,Object>)r).toList();
        }
    }
}
