package cn.pandora.workspace;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import cn.pandora.task.TaskService;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class NotificationCommentAccessTest {
    private final Actor viewer = new Actor("employee", "org", "lower", "team", "manager", 1);

    private WorkspaceService service(String eventType, boolean canReadTask, Map<String,Object> comment) {
        return service(eventType, canReadTask, comment, false, false);
    }

    private WorkspaceService service(String eventType, boolean canReadTask, Map<String,Object> comment,
                                     boolean withdrawn, boolean managerOfInitiator) {
        Db db = mock(Db.class);
        Access access = WorkspaceTestSupport.access();
        Map<String,Object> row = new LinkedHashMap<>();
        row.put("id", "notice");
        row.put("eventId", "event");
        row.put("eventType", eventType);
        row.put("source", "event");
        row.put("deliveredAt", "2026-10-28T00:00:00Z");
        row.put("taskId", "task");
        row.put("objectType", "task");
        row.put("objectId", "task");
        row.put("summary", "Private comment excerpt");
        row.put("rowVersion", 1);
        Map<String,Object> event = new LinkedHashMap<>(Map.of("detailsJson", "details", "title", "Task title",
                "initiatorId", "report", "changeSummary", "Private comment excerpt"));
        if (withdrawn) event.put("revokedAt", "2026-10-28T00:45:00Z");
        Map<String,Object> task = Map.of("id", "task", "currentVersionId", "version", "originalCreatorId", "creator");
        Map<String,Object> version = Map.of("id", "version", "title", "Task title",
                "description", "Confidential content written after removal");
        when(db.one(startsWith("SELECT * FROM notifications"), eq("org"), eq("employee"), eq("notice"))).thenReturn(row);
        when(db.find(contains("FROM domain_events"), eq("org"), eq("event"))).thenReturn(event);
        when(db.parse("details")).thenReturn(eventType.startsWith("comment.") ? Map.of("commentId", "comment") : Map.of());
        when(db.find("SELECT deleted_at FROM task_log_comments WHERE organization_id=? AND id=?", "org", "comment"))
                .thenReturn(comment);
        when(db.find("SELECT * FROM tasks WHERE organization_id=? AND id=?", "org", "task")).thenReturn(task);
        when(db.find("SELECT * FROM task_versions WHERE organization_id=? AND task_id=? AND id=?", "org", "task", "version"))
                .thenReturn(version);
        when(db.find("SELECT * FROM task_versions WHERE organization_id=? AND id=?", "org", "version")).thenReturn(version);
        when(access.canSeeTask(eq(viewer), eq(task), eq(version), anyList())).thenReturn(canReadTask);
        when(access.isManagerOf(viewer, "report")).thenReturn(managerOfInitiator);
        return new WorkspaceService(db, access, mock(TaskService.class), mock(Events.class),
                Clock.fixed(Instant.parse("2026-10-28T01:00:00Z"), ZoneOffset.UTC));
    }

    private void assertNoTaskJump(WorkspaceService service) {
        Map<String,Object> notice = service.notification(viewer, "notice");
        assertNull(notice.get("taskId"));
        assertNull(notice.get("requestId"));
        assertNull(notice.get("objectId"));
        assertNull(notice.get("focus"));
        assertNull(notice.get("commentId"));
        assertEquals(false, notice.get("canOpenTask"));
        assertEquals(false, notice.get("canReview"));
        assertFalse(String.valueOf(notice.get("summary")).contains("Private comment excerpt"));
        ApiException error = assertThrows(ApiException.class, () -> service.notificationTask(viewer, "notice"));
        assertEquals(404, error.status);
        assertEquals("NOT_FOUND", error.code);
    }

    @Test
    void deliveredCommentCannotReopenTaskAfterCurrentAccessIsRevoked() {
        assertNoTaskJump(service("comment.created", false, Map.of()));
    }

    @Test
    void deletedCommentCannotReopenTaskEvenWhenRecipientStillHasTaskAccess() {
        WorkspaceService service = service("comment.created", true, Map.of("deletedAt", "2026-10-28T00:30:00Z"));
        assertNoTaskJump(service);
        assertEquals("该评论已删除，正文不再展示。", service.notification(viewer, "notice").get("summary"));
    }

    @Test
    void missingCommentCannotReopenTask() {
        assertNoTaskJump(service("comment.created", true, null));
    }

    private void assertWithdrawnCommentExcerptHidden(WorkspaceService service) {
        assertNoTaskJump(service);
        Map<String,Object> notice = service.notification(viewer, "notice");
        assertEquals(false, notice.get("canReadWithdrawnDetails"));
        assertNull(notice.get("title"));
        assertNull(notice.get("changeSummary"));
        assertEquals("该通知已被撤回。", notice.get("summary"));
    }

    @Test
    void withdrawnDeletedCommentDoesNotExposeItsExcerptToTheAuthorsManager() {
        assertWithdrawnCommentExcerptHidden(service("comment.created", true,
                Map.of("deletedAt", "2026-10-28T00:30:00Z"), true, true));
    }

    @Test
    void withdrawnCommentDoesNotRestoreAnExcerptAfterTheAuthorsManagerLosesObjectAccess() {
        assertWithdrawnCommentExcerptHidden(service("comment.created", false, Map.of(), true, true));
    }

    @Test
    void existingCommentKeepsItsTaskJumpWhileCurrentAccessRemains() {
        WorkspaceService service = service("comment.created", true, Map.of());
        Map<String,Object> notice = service.notification(viewer, "notice");
        assertEquals("task", notice.get("taskId"));
        assertEquals("task", notice.get("objectId"));
        assertEquals("comments", notice.get("focus"));
        assertEquals(true, notice.get("canOpenTask"));
        assertEquals(false, service.notificationTask(viewer, "notice").get("accessRevoked"));
    }

    @Test
    void ordinaryDeliveredTaskMessageRetainsItsReadOnlyHistoricalEntry() {
        WorkspaceService service = service("task.change.approved", false, null);
        Map<String,Object> notice = service.notification(viewer, "notice");
        assertEquals(true, notice.get("canOpenTask"));
        assertEquals(true, notice.get("readonly"));
        assertEquals(true, notice.get("relationLost"));
        Map<String,Object> historical = service.notificationTask(viewer, "notice");
        assertEquals("task", historical.get("taskId"));
        assertEquals(true, historical.get("readonly"));
        assertEquals(true, historical.get("historical"));
        assertEquals(true, historical.get("accessRevoked"));
    }
}
