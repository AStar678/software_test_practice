package cn.pandora.workspace;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import cn.pandora.task.TaskService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WorkspaceAnalysisTest {
    private static final Instant NOW = Instant.parse("2026-10-20T18:00:00Z");

    @Test
    void extractsUnregisteredChineseAndOtherWordsFromTaskText() {
        List<Map<String, Object>> words = WorkspaceService.keywords(List.of(
                task("one", "量子纠缠校准", "NebulaSync NebulaSync", "medium",
                        "2026-10-20T08:00:00Z", "2026-10-21T08:00:00Z"),
                task("two", "量子纠缠复核", "NebulaSync", "low",
                        "2026-10-20T08:00:00Z", "2026-10-21T08:00:00Z")));

        assertTrue(words.stream().anyMatch(row -> "量子纠缠校准".equals(row.get("word"))));
        assertTrue(words.stream().anyMatch(row -> "量子".equals(row.get("word"))
                && ((Number) row.get("count")).intValue() == 2));
        assertTrue(words.stream().anyMatch(row -> "nebulasync".equals(row.get("word"))
                && ((Number) row.get("count")).intValue() == 3));
    }

    @Test
    void producesProportionalConflictAndHighPriorityAdviceWithSources() {
        Map<String, Object> first = task("first", "紧急发布", "", "urgent",
                "2026-10-20T08:00:00Z", "2026-10-20T20:00:00Z");
        Map<String, Object> second = task("second", "并行校验", "", "medium",
                "2026-10-20T17:00:00Z", "2026-10-20T19:00:00Z");

        List<Map<String, Object>> suggestions = WorkspaceService.suggestions(List.of(first, second), NOW);

        assertTrue(suggestions.stream().anyMatch(row -> "remaining_20_percent".equals(row.get("rule"))
                && List.of("first").equals(row.get("sourceTaskIds"))));
        assertTrue(suggestions.stream().anyMatch(row -> "schedule_conflict".equals(row.get("rule"))
                && List.of("first", "second").equals(row.get("sourceTaskIds"))));
        assertTrue(suggestions.stream().anyMatch(row -> "high_priority".equals(row.get("rule"))
                && "first".equals(row.get("taskId"))));
        assertTrue(suggestions.stream().allMatch(row -> row.get("sources") instanceof List<?>));
    }

    @Test
    void excludesCompletedAndFrozenTasksFromAdviceAndUsesStrictOverdueRule() {
        Map<String, Object> done = task("done", "已完成", "", "urgent",
                "2026-10-19T08:00:00Z", "2026-10-19T20:00:00Z");
        done.put("executionState", "done");
        Map<String, Object> frozen = task("frozen", "待审核", "", "urgent",
                "2026-10-19T08:00:00Z", "2026-10-19T20:00:00Z");
        frozen.put("frozen", true);
        Map<String, Object> overdue = task("overdue", "已逾期", "", "low",
                "2026-10-19T08:00:00Z", "2026-10-19T20:00:00Z");

        List<Map<String, Object>> suggestions = WorkspaceService.suggestions(List.of(done, frozen, overdue), NOW);

        assertEquals(1, suggestions.size());
        assertEquals("overdue", suggestions.getFirst().get("rule"));
        assertEquals("overdue", suggestions.getFirst().get("taskId"));
    }

    @Test
    void managerGetsDepartmentStatisticsButOnlyPersonalSuggestions() {
        Map<String, Object> personal = task("personal", "本人星云排期", "个人 NebulaSync", "medium",
                "2026-10-20T08:00:00Z", "2026-10-20T20:00:00Z");
        personal.put("originalCreatorId", "manager");
        personal.put("assigneeIds", List.of("manager"));
        Map<String, Object> department = task("department", "部门机密议题", "只在部门统计词云中出现", "urgent",
                "2026-10-20T08:00:00Z", "2026-10-20T20:00:00Z");
        department.put("originalCreatorId", "other");
        department.put("assigneeIds", List.of("employee"));
        Map<String, Object> pendingComplete = task("pending", "待完成审核", "", "low",
                "2026-10-20T08:00:00Z", "2026-10-21T20:00:00Z");
        pendingComplete.put("originalCreatorId", "other");
        pendingComplete.put("assigneeIds", List.of("employee"));
        pendingComplete.put("pending", true);
        pendingComplete.put("pendingKind", "complete");
        pendingComplete.put("frozen", true);
        Map<String,Object> outside=task("outside","范围外本人创建任务","privateoutsideword","urgent",
                "2026-10-20T08:00:00Z","2026-10-20T20:00:00Z");
        outside.put("originalCreatorId","manager");outside.put("assigneeIds",List.of("outside-employee"));
        List<Map<String, Object>> rows = List.of(personal, department, pendingComplete,outside);

        MemoryDb db = new MemoryDb();
        TaskService tasks = mock(TaskService.class);
        when(tasks.list(any(), anyMap())).thenReturn(Map.of("items", rows));
        Actor manager = actor(7);
        Access access=mock(Access.class);
        when(access.employeeDirectory(any(),org.mockito.ArgumentMatchers.eq(false))).thenReturn(List.of(
                Map.of("id","manager","departmentId","department","teamId","team"),
                Map.of("id","employee","departmentId","department","teamId","team")));
        WorkspaceService service = new WorkspaceService(db, access, tasks, mock(Events.class),
                Clock.fixed(NOW, ZoneOffset.UTC));

        Map<String, Object> statistics = service.statistics(manager, Map.of("scope", "visible"));
        assertEquals("department", statistics.get("scope"));
        assertEquals(3, statistics.get("total"));
        assertTrue(keywordRows(statistics).stream().noneMatch(row->"privateoutsideword".equals(row.get("word"))));
        assertEquals(1L, statistics.get("pendingComplete"));
        assertTrue(keywordRows(statistics).stream().anyMatch(row -> "部门机密议题".equals(row.get("word"))));

        service.createAiJob(manager, Map.of("scopeType", "auto"));
        Map<String, Object> result = db.storedResult();
        assertEquals("department", result.get("statisticsScope"));
        assertEquals("self", result.get("suggestionScope"));
        assertTrue(suggestionRows(result).stream().flatMap(row -> ((List<?>) row.get("sourceTaskIds")).stream())
                .allMatch(id->List.of("personal","outside").contains(id)));
        assertTrue(suggestionRows(result).stream().noneMatch(row -> "部门机密议题".equals(row.get("title"))));
    }

    @Test
    void staleRoleScopedJobIsRejectedAfterAuthorizationVersionChanges() {
        Map<String, Object> personal = task("personal", "个人任务", "", "medium",
                "2026-10-20T08:00:00Z", "2026-10-20T20:00:00Z");
        personal.put("originalCreatorId", "manager");
        personal.put("assigneeIds", List.of("manager"));
        MemoryDb db = new MemoryDb();
        TaskService tasks = mock(TaskService.class);
        when(tasks.list(any(), anyMap())).thenReturn(Map.of("items", List.of(personal)));
        Access access=mock(Access.class);
        when(access.employeeDirectory(any(),org.mockito.ArgumentMatchers.eq(false))).thenReturn(List.of(
                Map.of("id","manager","departmentId","department","teamId","team"),
                Map.of("id","employee","departmentId","department","teamId","team")));
        WorkspaceService service = new WorkspaceService(db, access, tasks, mock(Events.class),
                Clock.fixed(NOW, ZoneOffset.UTC));
        Map<String, Object> created = service.createAiJob(actor(7), Map.of("scopeType", "auto"));

        ApiException error = assertThrows(ApiException.class,
                () -> service.aiJob(actor(8), created.get("jobId").toString()));
        assertEquals(409, error.status);
        assertEquals("ANALYSIS_SCOPE_CHANGED", error.code);
    }

    private static Map<String, Object> task(String id, String title, String description, String priority,
                                             String startAt, String dueAt) {
        Map<String, Object> task = new LinkedHashMap<>();
        task.put("id", id);
        task.put("title", title);
        task.put("description", description);
        task.put("priority", priority);
        task.put("startAt", startAt);
        task.put("dueAt", dueAt);
        task.put("executionState", "doing");
        task.put("frozen", false);
        return task;
    }

    private static Actor actor(long authzVersion) {
        return new Actor("manager", "org", "department_head", "team", "upper", 2, "department", "position",
                Set.of("create_task"), Map.of("task_view", "department"), authzVersion,
                true, false, 1L);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> keywordRows(Map<String, Object> statistics) {
        return (List<Map<String, Object>>) statistics.get("keywords");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> suggestionRows(Map<String, Object> result) {
        return (List<Map<String, Object>>) result.get("suggestions");
    }

    private static final class MemoryDb extends Db {
        private Map<String, Object> job;

        MemoryDb() {
            super(null, new ObjectMapper());
        }

        @Override
        public int update(String sql, Object... args) {
            if (sql.startsWith("INSERT INTO ai_jobs")) {
                job = new LinkedHashMap<>();
                job.put("id", args[0]);
                job.put("organizationId", args[1]);
                job.put("requestedBy", args[2]);
                job.put("status", "completed");
                job.put("scopeType", args[3]);
                job.put("resultJson", args[4]);
            }
            return 1;
        }

        @Override
        public Map<String, Object> one(String sql, Object... args) {
            if (sql.startsWith("SELECT * FROM ai_jobs") && job != null) return new LinkedHashMap<>(job);
            throw ApiException.notFound();
        }

        Map<String, Object> storedResult() {
            return parse(Objects.toString(job.get("resultJson")));
        }
    }
}
