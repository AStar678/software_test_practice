package cn.pandora.auth;

import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Credential namespaces are explicitly selected, including when identifiers/passwords collide. */
class AuthServiceLoginTest {
    private static final String PHONE="13800000001";
    private static final String PASSWORD="Employee@123456";
    private static final String HASH=AuthService.PASSWORDS.encode(PASSWORD);
    private static Map<String,Object> account(String id,String type) {
        return Map.of("id",id,"organizationId","org","accountType",type,"passwordHash",HASH);
    }
    private static AuthService service(Db db) {
        return new AuthService(db,mock(Access.class),mock(Events.class)) {
            @Override public Map<String,Object> sessionUser(Map<String,Object> account) {
                return Map.of("id",account.get("id"),"accountType",account.get("accountType"));
            }
        };
    }
    private static Map<String,Object> employee(String password) {
        return Map.of("accountType","employee","phone",PHONE,"password",password);
    }
    private static Map<String,Object> admin(String password) {
        return Map.of("accountType","admin","accountName",PHONE,"password",password);
    }
    private static Db accounts() {
        Db db=mock(Db.class);
        when(db.list(startsWith("SELECT u.*,'employee' AS account_type"),eq(PHONE)))
                .thenReturn(List.of(account("employee-id","employee")));
        when(db.find(startsWith("SELECT a.*,'admin' AS account_type"),eq(PHONE)))
                .thenReturn(account("admin-id","admin"));
        return db;
    }
    private static void assertNoSession(Db db) {
        verify(db,never()).update(startsWith("INSERT INTO auth_sessions"),any(),any(),any(),any());
    }
    private static void assertIdentity(Map<String,Object> session,String id,String type) {
        Map<?,?> user=(Map<?,?>)session.get("user");
        assertEquals(id,user.get("id"));
        assertEquals(type,user.get("accountType"));
    }
    @Test void identicalIdentifierAndPasswordAreIsolatedByExplicitType() {
        AuthService service=service(accounts());
        assertIdentity(service.login(employee(PASSWORD)),"employee-id","employee");
        assertIdentity(service.login(admin(PASSWORD)),"admin-id","admin");
    }
    @Test void employeeUsesOnlyNormalizedPhoneStore() {
        Db db=accounts();
        assertIdentity(service(db).login(Map.of("accountType","employee","phone","138-0000-0001","password",PASSWORD)),"employee-id","employee");
        verify(db,never()).find(anyString(),any());
    }
    @Test void adminNeverLooksUpEmployeesEvenWhenTheirKeysAreAmbiguous() {
        Db db=accounts();
        when(db.list(startsWith("SELECT u.*,'employee' AS account_type"),eq(PHONE)))
                .thenReturn(List.of(account("one","employee"),account("two","employee")));
        assertIdentity(service(db).login(admin(PASSWORD)),"admin-id","admin");
        verify(db,never()).list(anyString(),any());
    }
    @Test void duplicatePhoneAcrossCompaniesIsRejectedBeforePasswordCheckOrSession() {
        Db db=accounts();
        when(db.list(startsWith("SELECT u.*,'employee' AS account_type"),eq(PHONE)))
                .thenReturn(List.of(account("one","employee"),account("two","employee")));
        for(String password:List.of(PASSWORD,"wrong-password")) {
            ApiException error=assertThrows(ApiException.class,()->service(db).login(employee(password)));
            assertEquals(409,error.status);
            assertEquals("LOGIN_KEY_AMBIGUOUS",error.code);
        }
        assertNoSession(db);
    }
    @Test void wrongPasswordDoesNotTryTheOtherNamespace() {
        for(String type:List.of("employee","admin")) {
            Db db=accounts();
            ApiException error=assertThrows(ApiException.class,()->service(db).login(
                    "employee".equals(type)?employee("wrong-password"):admin("wrong-password")));
            assertEquals(401,error.status);
            assertEquals("BAD_CREDENTIALS",error.code);
            if("admin".equals(type)) verify(db,never()).list(anyString(),any());
            else verify(db,never()).find(anyString(),any());
            assertNoSession(db);
        }
    }
    @Test void missingAccountDoesNotFallBackToOtherNamespace() {
        Db db=accounts();
        when(db.find(startsWith("SELECT a.*,'admin' AS account_type"),eq(PHONE))).thenReturn(null);
        assertEquals(401,assertThrows(ApiException.class,()->service(db).login(admin(PASSWORD))).status);
        verify(db,never()).list(anyString(),any());
        assertNoSession(db);
    }
    @Test void legacyMixedMissingAndUnknownFieldsAreContractErrorsWithoutDatabaseLookups() {
        List<Map<String,Object>> inputs=List.of(
                Map.of("username",PHONE,"password",PASSWORD),
                Map.of("phone",PHONE,"password",PASSWORD),
                Map.of("accountType","employee","username",PHONE,"password",PASSWORD),
                Map.of("accountType","employee","phone",PHONE,"accountName",PHONE,"password",PASSWORD),
                Map.of("accountType","employee","accountName",PHONE,"password",PASSWORD),
                Map.of("accountType","admin","phone",PHONE,"password",PASSWORD),
                Map.of("accountType","other","phone",PHONE,"password",PASSWORD),
                Map.of("accountType","employee","phone",PHONE),
                Map.of("accountType","employee","phone",123,"password",PASSWORD),
                Map.of("accountType","employee","phone",PHONE,"password",PASSWORD,"remember",true));
        for(Map<String,Object> input:inputs) {
            Db db=mock(Db.class);
            ApiException error=assertThrows(ApiException.class,()->service(db).login(input),input.keySet().toString());
            assertEquals(400,error.status);
            assertEquals("INVALID_LOGIN_CONTRACT",error.code);
            verifyNoInteractions(db);
        }
    }
}
