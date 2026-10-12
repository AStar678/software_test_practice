package cn.pandora.auth;

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
    public static final BCryptPasswordEncoder PASSWORDS=new BCryptPasswordEncoder(12);
    private final String dummyHash=PASSWORDS.encode("invalid-password-placeholder");
    public AuthService(Db db) {this.db=db;}
    public static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch(NoSuchAlgorithmException e) {throw new IllegalStateException(e);}
    }
    public static Actor actor(Map<String,Object> user) {
        return new Actor(s(user,"id"),s(user,"organizationId"),s(user,"role"),s(user,"teamId"),s(user,"managerId"),(int)n(user,"rankLevel"));
    }
    public static Map<String,Object> publicUser(Map<String,Object> user) {
        Map<String,Object> result=new LinkedHashMap<>();
        for(String k:List.of("id","organizationId","teamId","managerId","username","displayName","role","rankLevel","active")) result.put(k,user.get(k));
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
        return Map.of("token",token,"tokenType","Bearer","expiresAt",expires.toString(),"user",publicUser(u));
    }
    public Actor authenticate(String token) {
        if(token==null || token.length()>256) throw new ApiException(401,"UNAUTHENTICATED","请先登录");
        var u=db.find("SELECT u.* FROM auth_sessions s JOIN users u ON u.id=s.user_id AND u.organization_id=s.organization_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>UTC_TIMESTAMP(6) AND u.active=1",hash(token));
        if(u==null) throw new ApiException(401,"UNAUTHENTICATED","登录已失效，请重新登录");
        return actor(u);
    }
    @Transactional
    public Map<String,Object> refresh(String token) {
        Actor a=authenticate(token);
        int changed=db.update("UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE token_hash=? AND revoked_at IS NULL",hash(token));
        if(changed!=1) throw new ApiException(401,"UNAUTHENTICATED","会话已被使用或撤销");
        return issue(db.one("SELECT * FROM users WHERE id=? AND organization_id=? AND active=1",a.id(),a.organizationId()));
    }
    public void logout(String token) {db.update("UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE token_hash=? AND revoked_at IS NULL",hash(token));}
}
