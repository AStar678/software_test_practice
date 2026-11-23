package cn.pandora.task;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import cn.pandora.workspace.ExpiryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;

import static cn.pandora.common.Db.s;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** The administrator console keeps seeing soft-deleted tasks with their full deletion projection. */
class AdminDeletedTaskProjectionTest {
    private static final String ORG="org-1";
    private static final String ADMIN="admin-1";
    private static final String DELETED_TASK="10000000-0000-0000-0000-00000000000a";
    private static final String LIVE_TASK="10000000-0000-0000-0000-00000000000b";
    private static final String V_DELETED="10000000-0000-0000-0000-00000000001a";
    private static final String V_LIVE="10000000-0000-0000-0000-00000000001b";
    private static final String CREATOR="10000000-0000-0000-0000-00000000000c";
    private static final String DELETER="10000000-0000-0000-0000-00000000000d";
    private static final Actor ACTOR=new Actor(ADMIN,ORG,"admin",null,null,0,null,null,
            Set.of("manage_organization","manage_accounts","manage_company_info","manage_notifications","view_task_history"),
            Map.of(),1L,false,false,1L);

    private Db db;
    private Access access;
    private TaskService service;

    @BeforeEach
    void setUp() {
        db=mock(Db.class);
        access=mock(Access.class);
        when(access.readScope(eq(ORG),any())).thenAnswer(invocation -> ((Supplier<?>)invocation.getArgument(1)).get());
        when(db.one("SELECT time_zone FROM organizations WHERE id=?",ORG)).thenReturn(Map.of("timeZone","UTC"));
        when(db.list("SELECT id,display_name FROM users WHERE organization_id=? ORDER BY id",ORG)).thenReturn(List.of(
                Map.of("id",CREATOR,"displayName","张三"),Map.of("id",DELETER,"displayName","管理员甲")));
        when(db.list("SELECT id,display_name FROM users WHERE organization_id=?",ORG)).thenReturn(List.of(
                Map.of("id",CREATOR,"displayName","张三"),Map.of("id",DELETER,"displayName","管理员甲")));
        when(db.list("SELECT * FROM tasks WHERE organization_id=? ORDER BY created_at DESC,id",ORG)).thenReturn(List.of(
                taskRow(DELETED_TASK,V_DELETED,"2026-11-23 10:00:00","2026-11-23 11:00:00",DELETER,"误删，待管理员确认"),
                taskRow(LIVE_TASK,V_LIVE,"2026-11-23 09:00:00","2026-11-23 09:30:00",null,null)));
        when(db.list("SELECT id,task_id,proposed_version_id,status,kind FROM approval_requests WHERE organization_id=? ORDER BY created_at,id",ORG))
                .thenReturn(List.of());
        when(db.list(contains("SELECT * FROM task_versions WHERE organization_id=? AND id IN ("),any(Object[].class)))
                .thenReturn(List.of(versionRow(V_DELETED,"已删除任务"),versionRow(V_LIVE,"正常任务")));
        service=new TaskService(db,access,mock(Events.class),
                Clock.fixed(Instant.parse("2026-11-23T02:00:00Z"),ZoneOffset.UTC),mock(ExpiryService.class));
    }

    private static Map<String,Object> row(Object...pairs) {
        var result=new LinkedHashMap<String,Object>();
        for(int i=0;i<pairs.length;i+=2) result.put((String)pairs[i],pairs[i+1]);
        return result;
    }

    private static Map<String,Object> taskRow(String id,String versionId,String createdAt,String updatedAt,String deletedBy,String reason) {
        var row=row("id",id,"organizationId",ORG,"originalCreatorId",CREATOR,"currentVersionId",versionId,
                "executionState","todo","rowVersion",7L,"createdAt",createdAt,"updatedAt",updatedAt,
                "deletedBy",deletedBy,"deleteReason",reason);
        row.put("deletedAt",deletedBy==null?null:"2026-11-23 10:00:00");
        return row;
    }

    private static Map<String,Object> versionRow(String id,String title) {
        return row("id",id,"title",title,"priority","high","allDay",false,"startDate","2026-11-23","dueDate","2026-11-24");
    }

    @SuppressWarnings("unchecked")
    private List<Map<String,Object>> items(Map<String,Object> result) { return (List<Map<String,Object>>)result.get("items"); }

    @Test
    void deletedFilterReturnsOnlyDeletedTasksWithFullDeletionProjection() {
        var result=service.adminTasks(ACTOR,Map.of("deleted","true"));
        assertEquals(1,result.get("total"));
        var item=items(result).get(0);
        assertEquals(DELETED_TASK,s(item,"taskId"));
        assertEquals(Boolean.TRUE,item.get("deleted"));
        assertNotNull(item.get("deletedAt"));
        assertEquals("管理员甲",item.get("deletedByName"));
        assertEquals(DELETER,item.get("deletedBy"));
        assertEquals("误删，待管理员确认",item.get("deleteReason"));
    }

    @Test
    void liveFilterExcludesDeletedTasksAndKeepsNormalRowsUntouched() {
        var result=service.adminTasks(ACTOR,Map.of("deleted","false"));
        assertEquals(1,result.get("total"));
        var item=items(result).get(0);
        assertEquals(LIVE_TASK,s(item,"taskId"));
        assertEquals(Boolean.FALSE,item.get("deleted"));
        assertNull(item.get("deletedAt"));
        assertEquals("正常任务",item.get("title"));
    }

    @Test
    void withoutFilterBothTasksStayVisibleBecauseHistoryMustNotHideDeletions() {
        assertEquals(2,service.adminTasks(ACTOR,Map.of()).get("total"));
    }

    @Test
    void invalidDeletedFilterIsRejectedInChinese() {
        ApiException error=assertThrows(ApiException.class,()->service.adminTasks(ACTOR,Map.of("deleted","maybe")));
        assertEquals(400,error.status);
        assertTrue(error.getMessage().contains("删除筛选"));
    }

    @Test
    void deletedTaskHistoryKeepsReadingVersionsWithoutReopeningWrites() {
        when(db.find("SELECT id,organization_id,original_creator_id,execution_state,created_at,deleted_at,deleted_by,delete_reason FROM tasks WHERE organization_id=? AND id=?",ORG,DELETED_TASK))
                .thenReturn(taskRow(DELETED_TASK,V_DELETED,"2026-11-23 10:00:00","2026-11-23 11:00:00",DELETER,"误删，待管理员确认"));
        when(db.list(contains("FROM task_history_entries h"),eq(ORG),eq(DELETED_TASK))).thenReturn(List.of(
                row("id","h1","entryType","deleted","fieldName","execution_state","beforeValue","todo","afterValue",null,
                        "actorId",DELETER,"actorName","管理员甲","requestId",null,"occurredAt","2026-11-23 10:00:00","detailJson",null)));
        when(db.list(contains("FROM task_versions WHERE organization_id=? AND task_id=?"),eq(ORG),eq(DELETED_TASK))).thenReturn(List.of());
        when(db.list("SELECT * FROM request_reassignments WHERE organization_id=? AND task_id=? ORDER BY created_at,id",ORG,DELETED_TASK)).thenReturn(List.of());
        when(db.list("SELECT * FROM handover_requests WHERE organization_id=? AND task_id=? ORDER BY created_at,id",ORG,DELETED_TASK)).thenReturn(List.of());
        when(db.list("SELECT * FROM task_business_transfers WHERE organization_id=? AND task_id=? ORDER BY occurred_at,id",ORG,DELETED_TASK)).thenReturn(List.of());
        when(access.businessOwner(anyMap())).thenReturn(CREATOR);

        var history=service.taskHistory(ACTOR,DELETED_TASK);
        assertEquals(Boolean.TRUE,history.get("deleted"));
        assertEquals("管理员甲",history.get("deletedByName"));
        assertEquals("误删，待管理员确认",history.get("deleteReason"));
        @SuppressWarnings("unchecked")
        var entries=(List<Map<String,Object>>)history.get("entries");
        assertEquals("deleted",s(entries.get(0),"entryType"));
    }
}
