package cn.pandora.workspace;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import cn.pandora.task.TaskService;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class WithdrawnNotificationTest {
    private final Actor viewer = new Actor("manager", "org", "middle", "team", "exec", 2);

    private Map<String,Object> read(boolean manager, boolean masked) {
        Db db = mock(Db.class);
        Access access = mock(Access.class);
        var row = new LinkedHashMap<String,Object>();
        row.put("id", "notice"); row.put("eventId", "event");
        row.put("contentMasked", masked); row.put("summary", "该通知已被撤回。");
        var event = Map.<String,Object>of("revokedAt", "2026-10-22T10:01:00Z",
                "occurredAt", "2026-10-22T10:00:00Z", "initiatorId", "report",
                "title", "原通知标题", "changeSummary", "原申请的详细修改内容");
        when(db.one(startsWith("SELECT * FROM notifications"), eq("org"), eq("manager"), eq("notice"))).thenReturn(row);
        when(db.find(contains("FROM domain_events"), eq("org"), eq("event"))).thenReturn(event);
        when(access.isManagerOf(viewer, "report")).thenReturn(manager);
        return new WorkspaceService(db, access, mock(TaskService.class), mock(Events.class),
                Clock.fixed(Instant.parse("2026-10-22T11:00:00Z"), ZoneOffset.UTC)).notification(viewer, "notice");
    }

    @Test void actualSuperiorCanReadOriginalContentWithoutActionsOrLinks() {
        var result = read(true, false);
        assertEquals("原通知标题", result.get("title"));
        assertEquals("原申请的详细修改内容", result.get("summary"));
        assertEquals(true, result.get("canReadWithdrawnDetails"));
        assertEquals(true, result.get("readonly"));
        assertNull(result.get("taskId")); assertNull(result.get("requestId"));
        assertEquals(false, result.get("canReview"));
        assertEquals(false, result.get("canOpenTask"));
        assertEquals(false, result.get("canWithdraw"));
    }

    @Test void OtherRecipientsStillReceiveOnlyTheWithdrawalPlaceholder() {
        var result = read(false, false);
        assertNull(result.get("title")); assertNull(result.get("changeSummary"));
        assertEquals("该通知已被撤回。", result.get("summary"));
        assertEquals(false, result.get("canReadWithdrawnDetails"));
    }

    @Test void MaskedDeliveryNeverRegainsRestrictedContentEvenForASuperior() {
        var result = read(true, true);
        assertNull(result.get("title")); assertNull(result.get("changeSummary"));
        assertEquals(false, result.get("canReadWithdrawnDetails"));
    }
}
