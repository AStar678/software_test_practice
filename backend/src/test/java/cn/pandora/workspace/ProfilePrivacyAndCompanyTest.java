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
    private static final Actor UPPER = new Actor("upper", "org", "founder", null, null, 1);

    @Test
    void everyBusinessRoleIsRejectedBeforeCreatingCompanyInformation() {
        Db db = mock(Db.class);
        WorkspaceService service = new WorkspaceService(db, WorkspaceTestSupport.access(), mock(TaskService.class), mock(Events.class), java.time.Clock.systemUTC());
        for (String role : List.of("founder", "department_head", "team_head", "employee")) {
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
        WorkspaceService service = new WorkspaceService(db, WorkspaceTestSupport.access(), mock(TaskService.class), mock(Events.class), java.time.Clock.systemUTC());
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
        WorkspaceService service = new WorkspaceService(db, WorkspaceTestSupport.access(), mock(TaskService.class), mock(Events.class), java.time.Clock.systemUTC());
        assertDoesNotThrow(() -> service.checkHomeItemWriteAccess(UPPER, "already-deleted-personal"));
        verify(db).find(anyString(), eq("org"), eq("already-deleted-personal"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void contactFieldsAreOnlyIncludedInSelfProfileNotUserDirectories() {
        Db db = mock(Db.class);
        Access access = WorkspaceTestSupport.access();
        Map<String, Object> row = new LinkedHashMap<>(Map.of("id", "upper", "displayName", "本人", "role", "founder", "active", true,
                "phone", "13800000000", "email", "private@example.test", "profileVersion", 2L));
        when(db.one(anyString(), eq("upper"), eq("org"))).thenReturn(row);
        when(access.employeeDirectory(eq(UPPER), anyBoolean())).thenReturn(List.of(row));
        when(db.one(startsWith("SELECT name,time_zone"),eq("org"))).thenReturn(Map.of("name","潘多拉","timeZone","Asia/Shanghai"));
        when(access.canSeePerson(eq(UPPER), anyMap())).thenReturn(true);
        WorkspaceService service = new WorkspaceService(db, access, mock(TaskService.class), mock(Events.class), java.time.Clock.systemUTC());
        assertEquals("private@example.test", service.me(UPPER).get("email"));
        for (boolean admin : List.of(false, true)) {
            Map<String, Object> person = ((List<Map<String, Object>>) service.users(UPPER, Map.of(), admin).get("items")).getFirst();
            assertFalse(person.containsKey("username"));
            assertFalse(person.containsKey("phone"));
            assertFalse(person.containsKey("email"));
            assertFalse(person.containsKey("profileVersion"));
        }
    }

    @Test
    void personDetailChecksBothProfileAndPhoneAccessWithoutReturningOtherPrivateFields() {
        Db db = mock(Db.class);
        Access access = WorkspaceTestSupport.access();
        Map<String, Object> raw = Map.of("id", "report", "phone", "13800000000", "email", "private@example.test",
                "passwordHash", "secret", "departmentName", "产品部", "positionName", "专员",
                "teamName", "产品部", "managerName", "李敏");
        when(access.employeeDirectory(UPPER,false)).thenReturn(List.of(raw));
        when(db.one(startsWith("SELECT phone"),eq("report"),eq("org"))).thenReturn(raw);
        when(access.canSeePerson(UPPER, raw)).thenReturn(true);
        WorkspaceService service = new WorkspaceService(db, access, mock(TaskService.class), mock(Events.class), java.time.Clock.systemUTC());
        assertFalse(service.person(UPPER, "report").containsKey("phone"));
        when(access.canReadPhone(UPPER, raw)).thenReturn(true);
        var detail = service.person(UPPER, "report");
        assertEquals("13800000000", detail.get("phone"));
        assertFalse(detail.containsKey("email"));
        assertFalse(detail.containsKey("passwordHash"));
        assertFalse(detail.containsKey("profileVersion"));
        when(access.canSeePerson(UPPER, raw)).thenReturn(false);
        assertEquals(404, assertThrows(ApiException.class, () -> service.person(UPPER, "report")).status);
        Actor admin = new Actor("admin", "org", "admin", null, null, 0);
        assertEquals(403, assertThrows(ApiException.class, () -> service.person(admin, "report")).status);
    }

    @Test
    void meAddsTheReadOnlyCompanyTimeZoneWithoutWideningContactFields() {
        Db db = mock(Db.class);
        Access access = WorkspaceTestSupport.access();
        Map<String, Object> row = new LinkedHashMap<>(Map.of("id", "upper", "displayName", "本人",
                "role", "founder", "active", true, "organizationName", "潘多拉", "organizationTimeZone", "Asia/Shanghai"));
        when(db.one(anyString(), eq("upper"), eq("org"))).thenReturn(row);
        when(access.employeeDirectory(eq(UPPER), anyBoolean())).thenReturn(List.of(row));
        when(db.one(startsWith("SELECT name,time_zone"),eq("org"))).thenReturn(Map.of("name","潘多拉","timeZone","Asia/Shanghai"));
        WorkspaceService service = new WorkspaceService(db, access, mock(TaskService.class), mock(Events.class), java.time.Clock.systemUTC());
        Map<String, Object> me = service.me(UPPER);
        assertEquals("Asia/Shanghai", me.get("organizationTimeZone"));
        assertEquals("潘多拉", me.get("organizationName"));
        assertNull(me.get("phone"));
        assertNull(me.get("email"));
        // A summary list keeps its previous shape: no new contact or timezone fields.
        Map<String, Object> summary = ((List<Map<String, Object>>) service.users(UPPER, Map.of(), true).get("items")).getFirst();
        assertFalse(summary.containsKey("organizationTimeZone"));
        assertFalse(summary.containsKey("phone"));
        assertFalse(summary.containsKey("email"));
    }
}
