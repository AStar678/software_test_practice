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
}
