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
        for(String k:List.of("id","organizationId","teamId","managerId","username","displayName","role","rankLevel","active")) result.put(k,user.get(k));
        return result;
    }

    /** Identity plus the authority the pages need to render the correct entry points. */
    public Map<String,Object> sessionUser(Map<String,Object> user) {
        Actor actor=actor(user);
        Map<String,Object> result=new LinkedHashMap<>(publicUser(user));
        result.put("departmentId",actor.departmentId());
        result.put("positionId",actor.positionId());
        result.put("capabilities",new ArrayList<>(actor.capabilities()));
        result.put("scopes",actor.scopes());
        result.put("authzVersion",actor.authzVersion());
        result.put("mustChangePassword",actor.mustChangePassword());
        return result;
    }

    @Transactional
    public Map<String,Object> login(String username,String password) {
        if(username==null || password==null || username.length()>80 || password.getBytes(StandardCharsets.UTF_8).length>72) throw new ApiException(401,"BAD_CREDENTIALS","账号或密码不正确");
        var u=db.find("SELECT * FROM users WHERE username=? AND active=1",username);
        boolean valid=PASSWORDS.matches(password,u==null?dummyHash:s(u,"passwordHash"));
        if(u==null || !valid) throw new ApiException(401,"BAD_CREDENTIALS","账号或密码不正确");
        return issue(u);
    }
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
        var u=db.find("SELECT u.* FROM auth_sessions s JOIN users u ON u.id=s.user_id AND u.organization_id=s.organization_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>UTC_TIMESTAMP(6) AND u.active=1",hash(token));
        if(u==null) throw new ApiException(401,"UNAUTHENTICATED","登录已失效，请重新登录");
        return actor(u);
    }

    /** Identity for the restricted password screen; reads no business data. */
    public Map<String,Object> session(Actor actor) {
        var u=db.one("SELECT * FROM users WHERE id=? AND organization_id=? AND active=1",actor.id(),actor.organizationId());
        return sessionUser(u);
    }

    @Transactional
    public Map<String,Object> refresh(String token) {
        Actor a=authenticate(token);
        int changed=db.update("UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE token_hash=? AND revoked_at IS NULL",hash(token));
        if(changed!=1) throw new ApiException(401,"UNAUTHENTICATED","会话已被使用或撤销");
        return issue(db.one("SELECT * FROM users WHERE id=? AND organization_id=? AND active=1",a.id(),a.organizationId()));
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
        Map<String,Object> user=db.one("SELECT * FROM users WHERE id=? AND organization_id=? AND active=1 FOR UPDATE",actor.id(),actor.organizationId());
        if(!PASSWORDS.matches(current,s(user,"passwordHash"))) throw new ApiException(400,"INVALID_CURRENT_PASSWORD","当前密码不正确");
        long credentialVersion=n(user,"credentialVersion")+1;
        db.update("UPDATE users SET password_hash=?,must_change_password=FALSE,credential_version=? WHERE organization_id=? AND id=?",
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
