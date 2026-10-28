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
    private static final String PHONE = "13800000001";
    private static final String EMPLOYEE_SQL = "SELECT * FROM users WHERE login_phone=? AND role<>'admin' AND active=1";
    private static final String ADMIN_SQL = "SELECT * FROM users WHERE username=? AND role='admin' AND active=1";
    private static final String EMPLOYEE_PASSWORD = "Employee@123456";
    private static final String ADMIN_PASSWORD = "Admin@123456";
    private static final String EMPLOYEE_HASH = AuthService.PASSWORDS.encode(EMPLOYEE_PASSWORD);
    private static final String ADMIN_HASH = AuthService.PASSWORDS.encode(ADMIN_PASSWORD);

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

    private static Map<String, Object> user(String id, String role, String hash) {
        Map<String,Object> row = new LinkedHashMap<>();
        row.put("id",id);
        row.put("organizationId","org");
        row.put("username","admin".equals(role)?PHONE:"employee");
        row.put("role",role);
        row.put("passwordHash",hash);
        return row;
    }

    private static AuthService service(Db db) {
        return new AuthService(db,mock(Access.class),mock(Events.class)) {
            @Override public Map<String,Object> sessionUser(Map<String,Object> user) {
                return Map.of("id",user.get("id"),"role",user.get("role"));
            }
        };
    }

    private static void assertIdentity(Map<String,Object> session,String id) {
        assertEquals(id,((Map<?,?>)session.get("user")).get("id"));
    }

    private static void assertNoSession(Db db) {
        verify(db,never()).update(startsWith("INSERT INTO auth_sessions"),any(),any(),any(),any());
    }

    @Test
    void legacyNumericAdministratorAndEmployeeAreSelectedByTheirOwnPasswords() {
        Db db=mock(Db.class);
        when(db.list(EMPLOYEE_SQL,PHONE)).thenReturn(List.of(user("employee-id","lower",EMPLOYEE_HASH)));
        when(db.find(ADMIN_SQL,PHONE)).thenReturn(user("admin-id","admin",ADMIN_HASH));
        AuthService service=service(db);
        assertIdentity(service.login(PHONE,ADMIN_PASSWORD),"admin-id");
        assertIdentity(service.login(PHONE,EMPLOYEE_PASSWORD),"employee-id");
    }

    @Test
    void legacySharedIdentifierAndPasswordNeverSilentlyChooseAnIdentity() {
        Db db=mock(Db.class);
        when(db.list(EMPLOYEE_SQL,PHONE)).thenReturn(List.of(user("employee-id","lower",EMPLOYEE_HASH)));
        when(db.find(ADMIN_SQL,PHONE)).thenReturn(user("admin-id","admin",EMPLOYEE_HASH));
        ApiException error=assertThrows(ApiException.class,()->service(db).login(PHONE,EMPLOYEE_PASSWORD));
        assertEquals(409,error.status);
        assertEquals("LOGIN_IDENTITY_AMBIGUOUS",error.code);
        assertNoSession(db);
    }

    @Test
    void explicitEntryPointsDisambiguateSharedIdentifierAndPassword() {
        Db db=mock(Db.class);
        when(db.list(EMPLOYEE_SQL,PHONE)).thenReturn(List.of(user("employee-id","lower",EMPLOYEE_HASH)));
        when(db.find(ADMIN_SQL,PHONE)).thenReturn(user("admin-id","admin",EMPLOYEE_HASH));
        AuthService service=service(db);
        assertIdentity(service.login(PHONE,EMPLOYEE_PASSWORD,"admin"),"admin-id");
        assertIdentity(service.login(PHONE,EMPLOYEE_PASSWORD,"employee"),"employee-id");
    }

    @Test
    void explicitEntryPointDoesNotFallBackToAnotherAccountType() {
        Db db=mock(Db.class);
        when(db.list(EMPLOYEE_SQL,PHONE)).thenReturn(List.of(user("employee-id","lower",EMPLOYEE_HASH)));
        when(db.find(ADMIN_SQL,PHONE)).thenReturn(user("admin-id","admin",ADMIN_HASH));
        AuthService service=service(db);
        for (String type:List.of("admin","employee")) {
            String otherPassword="admin".equals(type)?EMPLOYEE_PASSWORD:ADMIN_PASSWORD;
            ApiException error=assertThrows(ApiException.class,()->service.login(PHONE,otherPassword,type));
            assertEquals(401,error.status);
            assertEquals("BAD_CREDENTIALS",error.code);
        }
        assertNoSession(db);
    }

    @Test
    void explicitAdministratorCanRepairAmbiguousEmployeeKeysWithoutLoggingInAsAnEmployee() {
        Db db=mock(Db.class);
        when(db.list(EMPLOYEE_SQL,PHONE)).thenReturn(List.of(user("employee-a","lower",EMPLOYEE_HASH),user("employee-b","lower",EMPLOYEE_HASH)));
        when(db.find(ADMIN_SQL,PHONE)).thenReturn(user("admin-id","admin",ADMIN_HASH));
        assertIdentity(service(db).login(PHONE,ADMIN_PASSWORD,"admin"),"admin-id");
        verify(db,never()).list(EMPLOYEE_SQL,PHONE);
    }

    @Test
    void explicitEmployeeStillRejectsDuplicatePhoneKeys() {
        Db db=mock(Db.class);
        when(db.list(EMPLOYEE_SQL,PHONE)).thenReturn(List.of(user("employee-a","lower",EMPLOYEE_HASH),user("employee-b","lower",EMPLOYEE_HASH)));
        ApiException error=assertThrows(ApiException.class,()->service(db).login(PHONE,EMPLOYEE_PASSWORD,"employee"));
        assertEquals(409,error.status);
        assertEquals("LOGIN_KEY_AMBIGUOUS",error.code);
        assertNoSession(db);
    }

    @Test
    void regularLegacyAdministratorAndEmployeeLoginsRemainSupported() {
        Db db=mock(Db.class);
        when(db.list(EMPLOYEE_SQL,PHONE)).thenReturn(List.of(user("employee-id","lower",EMPLOYEE_HASH)));
        when(db.find(ADMIN_SQL,"admin")).thenReturn(user("admin-id","admin",ADMIN_HASH));
        AuthService service=service(db);
        assertIdentity(service.login("admin",ADMIN_PASSWORD),"admin-id");
        assertIdentity(service.login("138-0000-0001",EMPLOYEE_PASSWORD),"employee-id");
    }

    @Test
    void wrongPasswordAndUnknownAccountTypeNeverIssueSessions() {
        Db db=mock(Db.class);
        when(db.list(EMPLOYEE_SQL,PHONE)).thenReturn(List.of(user("employee-id","lower",EMPLOYEE_HASH)));
        when(db.find(ADMIN_SQL,PHONE)).thenReturn(user("admin-id","admin",ADMIN_HASH));
        AuthService service=service(db);
        ApiException invalidPassword=assertThrows(ApiException.class,()->service.login(PHONE,"wrong-password"));
        assertEquals(401,invalidPassword.status);
        ApiException invalidType=assertThrows(ApiException.class,()->service.login(PHONE,ADMIN_PASSWORD,"unknown"));
        assertEquals(400,invalidType.status);
        assertEquals("INVALID_INPUT",invalidType.code);
        assertNoSession(db);
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
