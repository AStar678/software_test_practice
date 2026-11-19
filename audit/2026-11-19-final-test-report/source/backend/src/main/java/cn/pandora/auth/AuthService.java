package cn.pandora.auth;

import cn.pandora.admin.Credentials;
import cn.pandora.common.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import static cn.pandora.common.Db.*;

@Service
public class AuthService {
    private final Db db;
    private final Access access;
    private final Events events;
    public static final BCryptPasswordEncoder PASSWORDS=new BCryptPasswordEncoder(12);
    private final String dummyHash=PASSWORDS.encode("invalid-password-placeholder");
    public AuthService(Db db,Access access,Events events) {this.db=db;this.access=access;this.events=events;}
    public static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch(NoSuchAlgorithmException e) {throw new IllegalStateException(e);}
    }

    /**
     * Full authority snapshot for a user row: explicit capabilities, per-area ranges, the current
     * organization authorization version and the account gate flags (DEV-002, DEV-003, DEV-005).
     */
    public Actor actor(Map<String,Object> user) {
        return access.actor(user);
    }

    public static Map<String,Object> publicUser(Map<String,Object> user) {
        Map<String,Object> result=new LinkedHashMap<>();
        for(String k:List.of("id","organizationId","displayName","active","accountType")) result.put(k,user.get(k));
        return result;
    }

    /** Identity plus the authority the pages need to render the correct entry points. */
    public Map<String,Object> sessionUser(Map<String,Object> user) {
        Actor actor=actor(user);
        Map<String,Object> result=new LinkedHashMap<>(publicUser(user));
        result.put("departmentId",actor.departmentId());
        result.put("positionId",actor.positionId());
        result.put("teamId",actor.teamId());
        result.put("managerId",actor.managerId());
        result.put("role",actor.role());
        result.put("accountType",actor.accountType());
        result.put("capabilities",new ArrayList<>(actor.capabilities()));
        result.put("scopes",actor.scopes());
        result.put("authzVersion",actor.authzVersion());
        result.put("mustChangePassword",actor.mustChangePassword());
        return result;
    }

    /** Strict namespaces: the request selects exactly one credential store before any lookup. */
    @Transactional
    public Map<String,Object> login(Map<String,Object> input) {
        Object type=input.get("accountType");
        if (!(type instanceof String accountType) || !Set.of("admin","employee").contains(accountType))
            throw loginContract();
        String identifierKey="admin".equals(accountType)?"accountName":"phone";
        if (!input.keySet().equals(Set.of("accountType",identifierKey,"password"))
                || !(input.get(identifierKey) instanceof String) || !(input.get("password") instanceof String))
            throw loginContract();
        String identifier=(String)input.get(identifierKey), password=(String)input.get("password");
        if(identifier.isBlank() || password.isEmpty() || identifier.length()>80
                || password.getBytes(StandardCharsets.UTF_8).length>72) throw badCredentials();
        Map<String,Object> account;
        if ("employee".equals(accountType)) {
            String phone=PhoneNumbers.normalize(identifier);
            List<Map<String,Object>> matches=phone==null?List.of():db.list(
                    "SELECT u.*,'employee' AS account_type FROM users u JOIN principals p "
                    + "ON p.organization_id=u.organization_id AND p.id=u.id "
                    + "WHERE u.login_phone=? AND u.active=1 AND p.active=1 AND p.account_type='employee'",phone);
            if(matches.size()>1) throw new ApiException(409,"LOGIN_KEY_AMBIGUOUS","该手机号在多个员工账号中重复，请管理员修复");
            account=matches.isEmpty()?null:matches.getFirst();
        } else {
            account=db.find("SELECT a.*,'admin' AS account_type FROM admin_accounts a JOIN principals p "
                    + "ON p.organization_id=a.organization_id AND p.id=a.id "
                    + "WHERE a.account_name=? AND a.active=1 AND p.active=1 AND p.account_type='admin'",identifier);
        }
        boolean matches=PASSWORDS.matches(password,account==null?dummyHash:s(account,"passwordHash"));
        if(account==null || !matches) throw badCredentials();
        return issue(account);
    }

    private static ApiException loginContract() {
        return new ApiException(400,"INVALID_LOGIN_CONTRACT","请明确提供 employee/phone/password 或 admin/accountName/password，不接受旧登录字段");
    }

    private static ApiException badCredentials() { return new ApiException(401,"BAD_CREDENTIALS","账号或密码不正确"); }
    private Map<String,Object> issue(Map<String,Object> u) {
        byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);
        String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expires=Instant.now().plusSeconds(8*3600);
        db.update("INSERT INTO auth_sessions(id,organization_id,user_id,token_hash,expires_at) VALUES(?,?,?,?,?)",id(),s(u,"organizationId"),s(u,"id"),hash(token),Timestamp.from(expires));
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("token",token);
        result.put("tokenType","Bearer");
        result.put("expiresAt",expires.toString());
        result.put("user",sessionUser(u));
        // A restricted session is announced up front so the client never loads the workspace first.
        result.put("passwordChangeRequired",truthy(u.get("mustChangePassword")));
        return result;
    }
    public Actor authenticate(String token) {
        if(token==null || token.length()>256) throw new ApiException(401,"UNAUTHENTICATED","请先登录");
        var principal=db.find("SELECT p.* FROM auth_sessions s JOIN principals p ON p.id=s.user_id AND p.organization_id=s.organization_id "
                + "WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>UTC_TIMESTAMP(6) AND p.active=1",hash(token));
        if(principal==null) throw new ApiException(401,"UNAUTHENTICATED","登录已失效，请重新登录");
        return actor(account(s(principal,"organizationId"),s(principal,"id"),s(principal,"accountType"),false));
    }

    /** Resolve only the principal's declared account namespace; administrators have no employee row. */
    public Map<String,Object> account(Actor actor) {
        return account(actor.organizationId(),actor.id(),actor.accountType(),false);
    }

    private Map<String,Object> account(String organizationId,String id,String accountType,boolean lock) {
        String table="admin".equals(accountType)?"admin_accounts":"users";
        var row=db.find("SELECT a.*,p.account_type FROM "+table+" a JOIN principals p "
                + "ON p.organization_id=a.organization_id AND p.id=a.id "
                + "WHERE a.organization_id=? AND a.id=? AND a.active=1 AND p.active=1 AND p.account_type=?"
                + (lock?" FOR UPDATE":""),organizationId,id,accountType);
        if(row==null) throw new ApiException(401,"UNAUTHENTICATED","账号已失效，请重新登录");
        return row;
    }

    /** Identity for the restricted password screen; reads no business data. */
    public Map<String,Object> session(Actor actor) {
        return sessionUser(account(actor));
    }

    @Transactional
    public Map<String,Object> refresh(String token) {
        Actor a=authenticate(token);
        int changed=db.update("UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE token_hash=? AND revoked_at IS NULL",hash(token));
        if(changed!=1) throw new ApiException(401,"UNAUTHENTICATED","会话已被使用或撤销");
        return issue(account(a));
    }
    public void logout(String token) {db.update("UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE token_hash=? AND revoked_at IS NULL",hash(token));}

    /**
     * First-login change and everyday change share one command (DEV-003).
     *
     * The current password is always verified, so a stolen restricted session alone cannot set a new
     * password. The new password must satisfy the policy, and success revokes **every** session of the
     * account, including the one that performed the change, so the client must sign in again.
     */
    @Transactional
    public Map<String,Object> changePassword(Actor actor, Map<String,Object> input) {
        allowed(input,Set.of("currentPassword","newPassword"));
        String current=required(input.get("currentPassword"),"currentPassword");
        String next=required(input.get("newPassword"),"newPassword");
        Credentials.requirePolicy(next);
        // Serialize with organization/identity commands so disable/reset and password change cannot
        // commit against different account states.
        db.one("SELECT id FROM organizations WHERE id=? FOR UPDATE",actor.organizationId());
        Map<String,Object> user=account(actor.organizationId(),actor.id(),actor.accountType(),true);
        if(!PASSWORDS.matches(current,s(user,"passwordHash"))) throw new ApiException(400,"INVALID_CURRENT_PASSWORD","当前密码不正确");
        long credentialVersion=n(user,"credentialVersion")+1;
        String table=actor.administrator()?"admin_accounts":"users";
        db.update("UPDATE "+table+" SET password_hash=?,must_change_password=FALSE,credential_version=? WHERE organization_id=? AND id=?",
                PASSWORDS.encode(next),credentialVersion,actor.organizationId(),actor.id());
        int revoked=revokeSessions(actor.organizationId(),actor.id());
        // Only the fact and the session count are audited; never the password in any form.
        events.record(actor,null,"account.password.changed",List.of(),Map.of("userId",actor.id(),"sessionsRevoked",revoked));
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("changed",true);
        result.put("credentialVersion",credentialVersion);
        result.put("sessionsRevoked",revoked);
        result.put("reLoginRequired",true);
        return result;
    }

    /** Administrator reset: a new one-time password and the first-login gate again (DEV-001, DEV-003). */
    public int revokeSessions(String organizationId,String userId) {
        return db.update("UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE organization_id=? AND user_id=? AND revoked_at IS NULL",organizationId,userId);
    }

    static boolean mustChange(String value) {
        Map<String,Object> row=new HashMap<>();
        row.put("mustChangePassword",value);
        Object raw=row.get("mustChangePassword");
        return "1".equals(String.valueOf(raw))||"true".equalsIgnoreCase(String.valueOf(raw));
    }

    static boolean truthy(Object value) {
        return Boolean.TRUE.equals(value) || value instanceof Number number && number.intValue()==1;
    }

    private static String required(Object value,String key) {
        if(!(value instanceof String text)||text.isEmpty()) throw new ApiException(400,"INVALID_INPUT",key+"不能为空");
        return text;
    }

    private static void allowed(Map<String,Object> input,Set<String> keys) {
        if(!keys.containsAll(input.keySet())) throw new ApiException(400,"INVALID_INPUT","请求含不支持的字段");
    }
}
