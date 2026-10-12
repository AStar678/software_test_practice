package cn.pandora.profile;

import cn.pandora.auth.Actor;
import cn.pandora.common.Writes;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/me/profile")
public class ProfileController {
    private final ProfileService profiles;
    private final Writes writes;

    public ProfileController(ProfileService profiles, Writes writes) { this.profiles = profiles; this.writes = writes; }

    @GetMapping
    public ResponseEntity<Map<String, Object>> get(@RequestAttribute("actor") Actor actor) {
        Map<String, Object> result = profiles.get(actor);
        return ResponseEntity.ok().eTag("\"" + result.get("rowVersion") + "\"").body(result);
    }

    @PatchMapping
    public ResponseEntity<Map<String, Object>> update(@RequestAttribute("actor") Actor actor,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestHeader(value = "If-Match", required = false) String ifMatch,
            @RequestBody Map<String, Object> input) {
        Map<String, Object> result = writes.run(actor, key, "PATCH /me/profile", input, ifMatch, () -> profiles.update(actor, ifMatch, input));
        return ResponseEntity.ok().eTag("\"" + result.get("rowVersion") + "\"").body(result);
    }
}
