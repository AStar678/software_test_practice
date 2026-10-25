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
    void usesActorIdentityAndVersionAndSyncsTheNormalizedLoginKey() {
        Db db = mock(Db.class);
        Events events = mock(Events.class);
        when(db.one(anyString(), eq("org"), eq("self"))).thenReturn(Map.of("displayName", "原姓名", "phone", "13800000000",
                "email", "old@example.test", "role", "lower", "loginPhone", "13800000000", "profileVersion", 2L));
        when(db.find(anyString(), any(), any(), any())).thenReturn(null);
        when(db.update(anyString(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(1);
        ProfileService service = new ProfileService(db, events);
        Map<String, Object> result = service.update(SELF, "\"2\"", Map.of("phone", "139 0000 1111"));
        assertEquals(Map.of("id", "self", "rowVersion", 3L, "profileVersion", 3L), result);
        // The contact number keeps the entered formatting; the authentication key is normalized.
        verify(db).update(anyString(), eq("原姓名"), eq("139 0000 1111"), eq("old@example.test"), isNull(),
                eq("13900001111"), eq("org"), eq("self"), eq(2L));
        verify(events).record(eq(SELF), isNull(), eq("profile.updated"), eq(List.of()), eq(Map.of("userId", "self", "fields", Set.of("phone"))));
    }

    @Test
    void employeeCannotClearTheLoginNumberAndADuplicateIsRejected() {
        Db db = mock(Db.class);
        when(db.one(anyString(), eq("org"), eq("self"))).thenReturn(Map.of("displayName", "姓名", "phone", "13800000000",
                "role", "lower", "loginPhone", "13800000000", "profileVersion", 2L));
        ProfileService service = new ProfileService(db, mock(Events.class));
        assertEquals(400, assertThrows(ApiException.class,
                () -> service.update(SELF, "\"2\"", Map.of("phone", ""))).status);

        when(db.find(anyString(), any(), any(), any())).thenReturn(Map.of("id", "other"));
        ApiException duplicate = assertThrows(ApiException.class,
                () -> service.update(SELF, "\"2\"", Map.of("phone", "13900001111")));
        assertEquals(409, duplicate.status);
        assertEquals("PHONE_TAKEN", duplicate.code);
        verify(db, never()).update(anyString(), any(Object[].class));
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

    @Test
    void avatarsAllowPresetsOrBoundedImagesAndRejectUrlsSvgAndInvalidData() throws Exception {
        assertEquals("rabbit", ProfileService.validate(Map.of("avatar", "rabbit")).get("avatar"));
        assertNull(ProfileService.validate(Collections.singletonMap("avatar", null)).get("avatar"));
        var image = new java.awt.image.BufferedImage(32, 32, java.awt.image.BufferedImage.TYPE_INT_RGB);
        var output = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "png", output);
        String valid = "data:image/png;base64," + Base64.getEncoder().encodeToString(output.toByteArray());
        assertEquals(valid, ProfileService.validate(Map.of("avatar", valid)).get("avatar"));
        for (String invalid : List.of("https://example.test/avatar.jpg", "data:image/svg+xml;base64,PHN2Zy8+", "data:image/png;base64,invalid", "data:image/png;base64," + "A".repeat(400_000)))
            assertThrows(ApiException.class, () -> ProfileService.validate(Map.of("avatar", invalid)));
        output.reset();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(513, 1, java.awt.image.BufferedImage.TYPE_INT_RGB), "png", output);
        String tooWide = "data:image/png;base64," + Base64.getEncoder().encodeToString(output.toByteArray());
        assertThrows(ApiException.class, () -> ProfileService.validate(Map.of("avatar", tooWide)));
    }

    @Test
    void updatingAnAvatarPreservesContactsAndUsesTheProfileVersion() {
        Db db = mock(Db.class);
        Events events = mock(Events.class);
        when(db.one(anyString(), eq("org"), eq("self"))).thenReturn(Map.of("displayName", "姓名", "phone", "13800000000", "email", "old@example.test", "avatar", "cat", "role", "lower", "loginPhone", "13800000000", "profileVersion", 4L));
        when(db.update(anyString(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(1);
        new ProfileService(db, events).update(SELF, "\"4\"", Map.of("avatar", "bear"));
        verify(db).update(anyString(), eq("姓名"), eq("13800000000"), eq("old@example.test"), eq("bear"),
                eq("13800000000"), eq("org"), eq("self"), eq(4L));
        verify(events).record(eq(SELF), isNull(), eq("profile.updated"), eq(List.of()), eq(Map.of("userId", "self", "fields", Set.of("avatar"))));
    }
}
