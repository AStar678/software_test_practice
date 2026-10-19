package cn.pandora.workspace;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.*;
import cn.pandora.task.TaskService;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ProfilePrivacyAndCompanyTest {
    private static final Actor UPPER = new Actor("upper", "org", "upper", "team", null, 1);

    @Test
    void everyBusinessRoleIsRejectedBeforeCreatingCompanyInformation() {
        Db db = mock(Db.class);
        WorkspaceService service = new WorkspaceService(db, mock(Access.class), mock(TaskService.class), mock(Events.class));
        for (String role : List.of("upper", "middle", "lower")) {
            Actor actor = new Actor(role, "org", role, "team", null, 1);
            ApiException error = assertThrows(ApiException.class, () -> service.createHomeItem(actor, Map.of("kind", "company", "body", "公司信息")));
            assertEquals(403, error.status);
            assertEquals("COMPANY_READ_ONLY", error.code);
        }
        verifyNoInteractions(db);
    }

    @Test
    void companyPatchAndDeleteCannotReplayAnOlderPrivilegedIdempotencyResult() {
        Db db = mock(Db.class);
        when(db.find(anyString(), eq("org"), eq("company-item"))).thenReturn(Map.of("kind", "company"));
        Writes writes = mock(Writes.class);
        WorkspaceService service = new WorkspaceService(db, mock(Access.class), mock(TaskService.class), mock(Events.class));
        WorkspaceController controller = new WorkspaceController(service, writes);
        assertEquals(403, assertThrows(ApiException.class, () -> controller.changeHomeItem(UPPER, "company-item", "old-key-123", "\"1\"", Map.of("body", "changed"))).status);
        assertEquals(403, assertThrows(ApiException.class, () -> controller.deleteHomeItem(UPPER, "company-item", "old-key-123", "\"1\"")).status);
        assertEquals(403, assertThrows(ApiException.class, () -> controller.createHomeItem(UPPER, "old-key-123", Map.of("kind", "company", "body", "changed"))).status);
        verifyNoInteractions(writes);
    }

    @Test
    void alreadyDeletedPersonalItemsStillReachIdempotencyReplay() {
        Db db = mock(Db.class);
        when(db.find(anyString(), eq("org"), eq("already-deleted-personal"))).thenReturn(null);
        WorkspaceService service = new WorkspaceService(db, mock(Access.class), mock(TaskService.class), mock(Events.class));
        assertDoesNotThrow(() -> service.checkHomeItemWriteAccess(UPPER, "already-deleted-personal"));
        verify(db).find(anyString(), eq("org"), eq("already-deleted-personal"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void contactFieldsAreOnlyIncludedInSelfProfileNotUserDirectories() {
        Db db = mock(Db.class);
        Access access = mock(Access.class);
        Map<String, Object> row = new LinkedHashMap<>(Map.of("id", "upper", "username", "upper", "displayName", "本人", "role", "upper", "active", true,
                "phone", "13800000000", "email", "private@example.test", "profileVersion", 2L));
        when(db.one(anyString(), eq("upper"), eq("org"))).thenReturn(row);
        when(db.list(anyString(), eq("org"))).thenReturn(List.of(row));
        when(access.canSeePerson(eq(UPPER), anyMap())).thenReturn(true);
        WorkspaceService service = new WorkspaceService(db, access, mock(TaskService.class), mock(Events.class));
        assertEquals("private@example.test", service.me(UPPER).get("email"));
        for (boolean admin : List.of(false, true)) {
            Map<String, Object> person = ((List<Map<String, Object>>) service.users(UPPER, Map.of(), admin).get("items")).getFirst();
            assertFalse(person.containsKey("phone"));
            assertFalse(person.containsKey("email"));
            assertFalse(person.containsKey("profileVersion"));
        }
    }
}
