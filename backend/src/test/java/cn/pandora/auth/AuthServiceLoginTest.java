package cn.pandora.auth;

import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * V-001 regression: a normalized key that matches more than one active employee account must never
 * issue a session. The login contract has no company selector, so the same rule applies across
 * organizations; the database must not decide by returning whichever row happens to be first.
 */
class AuthServiceLoginTest {
    private static Map<String, Object> employee(String id, String organizationId, String phone) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", id);
        row.put("organizationId", organizationId);
        row.put("username", "user-" + id);
        row.put("role", "lower");
        row.put("active", 1);
        row.put("loginPhone", phone);
        row.put("passwordHash", AuthService.PASSWORDS.encode("Demo@123456"));
        return row;
    }

    @Test
    void ambiguousNormalizedKeyIsRejectedAcrossOrganizationsWithoutIssuingASession() {
        Db db = mock(Db.class);
        when(db.list("SELECT * FROM users WHERE login_phone=? AND role<>'admin' AND active=1", "13800000001"))
                .thenReturn(List.of(employee("employee-a", "org-a", "13800000001"),
                        employee("employee-b", "org-b", "13800000001")));
        AuthService service = new AuthService(db, mock(Access.class), mock(Events.class));

        for (String password : List.of("Demo@123456", "another-password")) {
            ApiException error = assertThrows(ApiException.class,
                    () -> service.login("138-0000-0001", password));
            assertEquals(409, error.status);
            assertEquals("LOGIN_KEY_AMBIGUOUS", error.code);
            assertTrue(error.getMessage().contains("重复"));
        }
        verify(db, never()).update(startsWith("INSERT INTO auth_sessions"), any(), any(), any(), any());
    }
}
