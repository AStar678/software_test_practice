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
    void permitsOnlyAvatarAndEmailIncludingClearingEmail() {
        assertNull(ProfileService.validate(Map.of("email", "")).get("email"));
        assertEquals("user+work@example.test", ProfileService.validate(Map.of("email", "user+work@example.test")).get("email"));
    }

    @Test
    void rejectsPermissionAndIdentityChangesEvenWhenMixedWithValidFields() {
        for (String field : List.of("displayName", "phone", "id", "userId", "organizationId", "role", "teamId", "managerId", "username", "password", "profileVersion", "rowVersion")) {
            assertThrows(ApiException.class, () -> ProfileService.validate(Map.of("email", "valid@example.test", field, "injected")), field);
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
    void usesActorIdentityAndVersionWhileWritingOnlyAllowedFields() {
        Db db=mock(Db.class);Events events=mock(Events.class);
        when(db.one(anyString(),eq("org"),eq("self"))).thenReturn(Map.of("email","old@example.test","avatar","cat","profileVersion",2L));
        when(db.update(anyString(),any(),any(),any(),any(),any())).thenReturn(1);
        Map<String,Object> result=new ProfileService(db,events).update(SELF,"\"2\"",Map.of("email","new@example.test"));
        assertEquals(Map.of("id","self","rowVersion",3L,"profileVersion",3L),result);
        verify(db).update(startsWith("UPDATE users SET email=?,avatar=?"),eq("new@example.test"),eq("cat"),eq("org"),eq("self"),eq(2L));
        verify(events).record(eq(SELF),isNull(),eq("profile.updated"),eq(List.of()),eq(Map.of("userId","self","fields",Set.of("email"))));
    }

    @Test
    void identityChangesAreRejectedBeforeAnyReadOrPartialProfileWrite() {
        Db db=mock(Db.class);var service=new ProfileService(db,mock(Events.class));
        for(var input:List.<Map<String,Object>>of(Map.of("phone","13900001111"),Map.of("displayName","New name"),
                Map.of("email","new@example.test","phone","13900001111"))) {
            assertEquals(400,assertThrows(ApiException.class,()->service.update(SELF,"\"2\"",input)).status);
        }
        verifyNoInteractions(db);
    }

    @Test
    void staleOrMissingVersionNeverWrites() {
        Db db = mock(Db.class);
        when(db.one(anyString(), eq("org"), eq("self"))).thenReturn(Map.of("profileVersion", 2L));
        ProfileService service = new ProfileService(db, mock(Events.class));
        assertEquals(412, assertThrows(ApiException.class, () -> service.update(SELF, "\"1\"", Map.of("email", "new@example.test"))).status);
        assertEquals(428, assertThrows(ApiException.class, () -> service.update(SELF, null, Map.of("email", "new@example.test"))).status);
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
        when(db.update(anyString(), any(), any(), any(), any(), any())).thenReturn(1);
        new ProfileService(db, events).update(SELF, "\"4\"", Map.of("avatar", "bear"));
        verify(db).update(anyString(), eq("old@example.test"), eq("bear"), eq("org"), eq("self"), eq(4L));
        verify(events).record(eq(SELF), isNull(), eq("profile.updated"), eq(List.of()), eq(Map.of("userId", "self", "fields", Set.of("avatar"))));
    }
}
