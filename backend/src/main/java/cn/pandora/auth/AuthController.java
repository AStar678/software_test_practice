package cn.pandora.auth;

import cn.pandora.common.*;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
public class AuthController {
    private final AuthService auth; private final Db db;
    public AuthController(AuthService auth,Db db) {this.auth=auth;this.db=db;}
    @GetMapping("/health") public Map<String,Object> health() {
        db.jdbc.queryForObject("SELECT 1",Integer.class);
        return Map.of("status","UP","application","pandora-backend","database","MySQL");
    }
    @PostMapping("/api/v1/auth/sessions") public Map<String,Object> login(@RequestBody Map<String,String> input) {return auth.login(input.get("username"),input.get("password"));}
    @PostMapping("/api/v1/auth/sessions/refresh") public Map<String,Object> refresh(@RequestAttribute("token") String token) {return auth.refresh(token);}
    @DeleteMapping("/api/v1/auth/sessions/current") public Map<String,Object> logout(@RequestAttribute("token") String token) {auth.logout(token);return Map.of("revoked",true);}

    /** Identity only, available to a restricted session so the change screen can render. */
    @GetMapping("/api/v1/auth/session")
    public Map<String,Object> session(@RequestAttribute("actor") Actor actor) {return auth.session(actor);}

    /**
     * First-login and everyday password change (DEV-003). Requires the current password, applies the
     * policy and revokes every session, so the client signs in again with the new password.
     */
    @PostMapping("/api/v1/auth/password")
    public Map<String,Object> changePassword(@RequestAttribute("actor") Actor actor,@RequestBody Map<String,Object> input) {
        return auth.changePassword(actor,input);
    }
}
