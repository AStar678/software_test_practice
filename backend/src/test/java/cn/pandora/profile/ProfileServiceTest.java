package cn.pandora.profile;

import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ProfileServiceTest {
    private static final Actor SELF = new Actor("self", "org", "lower", "team", "manager", 3);

    @Test
    void allowsOnlyEditableProfileFieldsAndSupportsClearingContacts() {
        Map<String, Object> result = ProfileService.validate(Map.of("displayName", "  张三  ", "phone", " ", "email", ""));
        assertEquals("张三", result.get("displayName"));
        assertNull(result.get("phone"));
        assertNull(result.get("email"));
        assertEquals("+86 (010) 1234-5678", ProfileService.validate(Map.of("phone", "+86 (010) 1234-5678")).get("phone"));
        assertEquals("user+work@example.test", ProfileService.validate(Map.of("email", "user+work@example.test")).get("email"));
    }

    @Test
    void rejectsPermissionAndIdentityChangesEvenWhenMixedWithValidFields() {
        for (String field : List.of("id", "userId", "organizationId", "role", "teamId", "managerId", "username", "password", "profileVersion", "rowVersion")) {
            assertThrows(ApiException.class, () -> ProfileService.validate(Map.of("displayName", "姓名", field, "injected")), field);
        }
        assertThrows(ApiException.class, () -> ProfileService.validate(Map.of()));
    }

    @Test
    void rejectsInvalidTypesControlsAndMalformedContacts() {
        assertThrows(ApiException.class, () -> ProfileService.validate(Map.of("displayName", "\n ")));
        assertThrows(ApiException.class, () -> ProfileService.validate(Map.of("displayName", "a".repeat(101))));
        assertThrows(ApiException.class, () -> ProfileService.validate(Map.of("displayName", "name\nline")));
        assertThrows(ApiException.class, () -> ProfileService.validate(Map.of("phone", 123456)));
        assertThrows(ApiException.class, () -> ProfileService.validate(Map.of("phone", "++8612345678")));
        assertThrows(ApiException.class, () -> ProfileService.validate(Map.of("phone", "123letters")));
        assertThrows(ApiException.class, () -> ProfileService.validate(Map.of("email", "not-an-email")));
        assertThrows(ApiException.class, () -> ProfileService.validate(Map.of("email", "a..b@example.test")));
        assertThrows(ApiException.class, () -> ProfileService.validate(Map.of("email", "a@example.test\r\nBcc:x@example.test")));
    }

    @Test
    void usesActorIdentityAndVersionAndReturnsNoPrivateContactValues() {
        Db db = mock(Db.class);
        Events events = mock(Events.class);
        when(db.one(anyString(), eq("org"), eq("self"))).thenReturn(Map.of("displayName", "原姓名", "phone", "13800000000", "email", "old@example.test", "profileVersion", 2L));
        when(db.update(anyString(), any(), any(), any(), any(), any(), any())).thenReturn(1);
        ProfileService service = new ProfileService(db, events);
        Map<String, Object> result = service.update(SELF, "\"2\"", Map.of("phone", ""));
        assertEquals(Map.of("id", "self", "rowVersion", 3L, "profileVersion", 3L), result);
        verify(db).update(anyString(), eq("原姓名"), isNull(), eq("old@example.test"), eq("org"), eq("self"), eq(2L));
        verify(events).record(eq(SELF), isNull(), eq("profile.updated"), eq(List.of()), eq(Map.of("userId", "self", "fields", Set.of("phone"))));
    }

    @Test
    void staleOrMissingVersionNeverWrites() {
        Db db = mock(Db.class);
        when(db.one(anyString(), eq("org"), eq("self"))).thenReturn(Map.of("profileVersion", 2L));
        ProfileService service = new ProfileService(db, mock(Events.class));
        assertEquals(412, assertThrows(ApiException.class, () -> service.update(SELF, "\"1\"", Map.of("displayName", "新姓名"))).status);
        assertEquals(428, assertThrows(ApiException.class, () -> service.update(SELF, null, Map.of("displayName", "新姓名"))).status);
        verify(db, never()).update(anyString(), any(Object[].class));
    }
}
