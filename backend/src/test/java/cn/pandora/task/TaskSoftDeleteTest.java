package cn.pandora.task;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.ApiAdvice;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import cn.pandora.common.Writes;
import cn.pandora.workspace.ExpiryService;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class TaskSoftDeleteTest {
    private static final String ORG = "org";
    private static final String TASK = "10000000-0000-0000-0000-000000000001";
    private static final String VERSION = "10000000-0000-0000-0000-000000000002";
    private static final String CREATOR = "10000000-0000-0000-0000-000000000003";
    private static final Actor ACTOR = new Actor(CREATOR, ORG, "founder", "team", null, 1);

    @Test
    void deletionMarksTheRowIncrementsVersionAndKeepsHistoryWithoutCascade() {
        Db db = mock(Db.class);
        Access access = mock(Access.class);
        Events events = mock(Events.class);
        Map<String, Object> task = taskRow();
        when(db.one("SELECT * FROM tasks WHERE organization_id=? AND id=? FOR UPDATE", ORG, TASK)).thenReturn(task);
        when(db.find("SELECT * FROM approval_requests WHERE organization_id=? AND task_id=? AND status='pending' FOR UPDATE",
                ORG, TASK)).thenReturn(null);
        when(db.one("SELECT * FROM task_versions WHERE organization_id=? AND id=?", ORG, VERSION))
                .thenReturn(new LinkedHashMap<>(Map.of("id", VERSION, "title", "迁移任务")));
        when(db.update(anyString(), any(Object[].class))).thenReturn(1);
        when(db.find("SELECT display_name FROM users WHERE organization_id=? AND id=?", ORG, CREATOR))
                .thenReturn(Map.of("displayName", "张三"));
        when(access.businessOwner(task)).thenReturn(CREATOR);
        TaskService service = new TaskService(db, access, events, Clock.fixed(
                Instant.parse("2026-11-23T02:00:00Z"), ZoneOffset.UTC), mock(ExpiryService.class));

        Map<String, Object> result = service.delete(ACTOR, TASK, "\"3\"", Map.of("reason", "重复创建"));

        assertEquals(true, result.get("deleted"));
        assertEquals(TASK, result.get("taskId"));
        assertEquals(4L, result.get("rowVersion"));
        assertEquals("任务已删除", result.get("message"));
        verify(db).update(startsWith("UPDATE tasks SET deleted_at=?"), any(), any(), any(), any(), any(), any(), any());
        verify(db).update(startsWith("INSERT INTO task_history_entries"), any(), any(), any(), any(), any(),
                any(), any(), any(), any(), any());
        verify(events).record(eq(ACTOR), eq(TASK), eq("task.deleted"), eq(List.of()), anyMap(),
                isNull(), eq(VERSION), eq("迁移任务"), contains("张三"));
    }

    @Test
    void pendingRequestBlocksDeletionBeforeAnyWrite() {
        Db db = mock(Db.class);
        Access access = mock(Access.class);
        Map<String, Object> task = taskRow();
        when(db.one("SELECT * FROM tasks WHERE organization_id=? AND id=? FOR UPDATE", ORG, TASK)).thenReturn(task);
        when(db.find("SELECT * FROM approval_requests WHERE organization_id=? AND task_id=? AND status='pending' FOR UPDATE",
                ORG, TASK)).thenReturn(Map.of("id", "request-1", "status", "pending"));
        when(access.businessOwner(task)).thenReturn(CREATOR);
        TaskService service = new TaskService(db, access, mock(Events.class),
                Clock.systemUTC(), mock(ExpiryService.class));

        ApiException error = assertThrows(ApiException.class,
                () -> service.delete(ACTOR, TASK, "\"3\"", Map.of("reason", "x")));

        assertEquals(409, error.status);
        assertEquals("TASK_HAS_PENDING_REQUEST", error.code);
        verify(db, never()).update(startsWith("UPDATE tasks SET deleted_at=?"), any(), any(), any(), any(),
                any(), any(), any());
    }

    @Test
    void nonOwnerAndNonCreatorCannotDelete() {
        Db db = mock(Db.class);
        Access access = mock(Access.class);
        Map<String, Object> task = taskRow();
        when(db.one("SELECT * FROM tasks WHERE organization_id=? AND id=? FOR UPDATE", ORG, TASK)).thenReturn(task);
        when(access.businessOwner(task)).thenReturn("someone-else");
        TaskService service = new TaskService(db, access, mock(Events.class),
                Clock.systemUTC(), mock(ExpiryService.class));
        Actor reader = new Actor("reader-1", ORG, "employee", "team", null, 1);

        ApiException error = assertThrows(ApiException.class,
                () -> service.delete(reader, TASK, "\"3\"", Map.of()));

        assertEquals(403, error.status);
        assertEquals("FORBIDDEN", error.code);
    }

    @Test
    void deletedDetailIsGoneForAuthorizedReadersAndHiddenFromOtherEmployees() throws Exception {
        Db db = mock(Db.class);
        Access access = mock(Access.class);
        Map<String, Object> task = taskRow();
        task.put("deletedAt", "2026-11-23T02:00:00Z");
        when(db.one("SELECT * FROM tasks WHERE organization_id=? AND id=?", ORG, TASK)).thenReturn(task);
        when(db.one("SELECT * FROM task_versions WHERE organization_id=? AND id=?", ORG, VERSION))
                .thenReturn(Map.of("id", VERSION, "title", "迁移任务", "description", "不可出现在删除响应中"));
        when(access.canSeeTask(eq(ACTOR), eq(task), anyMap(), anyList())).thenReturn(true);
        TaskService service = new TaskService(db, access, mock(Events.class),
                Clock.systemUTC(), mock(ExpiryService.class));
        var mvc = MockMvcBuilders.standaloneSetup(new TaskController(service, mock(Tags.class), mock(Writes.class)))
                .setControllerAdvice(new ApiAdvice()).build();

        mvc.perform(get("/api/v1/tasks/{id}", TASK).requestAttr("actor", ACTOR))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.code").value("TASK_DELETED"))
                .andExpect(jsonPath("$.message").value("任务已删除"))
                .andExpect(jsonPath("$.taskId").value(TASK))
                .andExpect(jsonPath("$.title").value("迁移任务"))
                .andExpect(jsonPath("$.deletedAt").value("2026-11-23T02:00:00Z"))
                .andExpect(jsonPath("$.description").doesNotExist());
        Actor outsider = new Actor("reader-1", ORG, "employee", "team", null, 1);
        mvc.perform(get("/api/v1/tasks/{id}", TASK).requestAttr("actor", outsider))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").doesNotExist());
    }

    private static Map<String, Object> taskRow() {
        Map<String, Object> task = new LinkedHashMap<>();
        task.put("id", TASK);
        task.put("organizationId", ORG);
        task.put("originalCreatorId", CREATOR);
        task.put("currentVersionId", VERSION);
        task.put("executionState", "doing");
        task.put("rowVersion", 3L);
        task.put("deletedAt", null);
        return task;
    }
}
