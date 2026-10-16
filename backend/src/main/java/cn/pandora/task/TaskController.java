package cn.pandora.task;

import cn.pandora.auth.Actor;
import cn.pandora.common.Writes;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class TaskController {
    private final TaskService tasks;
    private final Writes writes;

    public TaskController(TaskService tasks, Writes writes) {
        this.tasks = tasks;
        this.writes = writes;
    }

    @GetMapping("/tasks")
    public Map<String, Object> list(@RequestAttribute("actor") Actor actor, @RequestParam Map<String, String> filters) {
        return tasks.list(actor, filters);
    }

    /** Authorized assignee candidates; reading a department never puts its people in this list. */
    @GetMapping("/assignee-candidates")
    public Map<String, Object> assigneeCandidates(@RequestAttribute("actor") Actor actor,
            @RequestParam(value = "q", required = false) String query) {
        return tasks.assigneeCandidates(actor, query);
    }

    /** Read-only reviewer preview; it creates no request and is not an authorization token. */
    @PostMapping("/tasks/reviewer-preview")
    public Map<String, Object> reviewerPreview(@RequestAttribute("actor") Actor actor, @RequestBody Map<String, Object> input) {
        return tasks.reviewerPreview(actor, input);
    }

    /** Dedicated handover: replaces one assignee position and can never carry a base field. */
    @PostMapping("/tasks/{id}/handover")
    public ResponseEntity<Map<String, Object>> handover(@RequestAttribute("actor") Actor actor, @PathVariable String id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestHeader(value = "If-Match", required = false) String ifMatch, @RequestBody Map<String, Object> input) {
        Map<String, Object> result = writes.run(actor, key, "POST:/tasks/" + id + "/handover", input, ifMatch,
                () -> tasks.handover(actor, id, ifMatch, input));
        return ResponseEntity.ok().eTag("\"" + result.get("rowVersion") + "\"").body(result);
    }

    @GetMapping("/tasks/{id}")
    public ResponseEntity<Map<String, Object>> detail(@RequestAttribute("actor") Actor actor, @PathVariable String id) {
        Map<String, Object> result = tasks.detail(actor, id);
        return ResponseEntity.ok().eTag("\"" + result.get("rowVersion") + "\"").body(result);
    }

    @PostMapping("/tasks")
    public ResponseEntity<Map<String, Object>> create(@RequestAttribute("actor") Actor actor,
            @RequestHeader(value = "Idempotency-Key", required = false) String key, @RequestBody Map<String, Object> input) {
        Map<String, Object> result = writes.run(actor, key, "POST:/tasks", input, null, () -> tasks.create(actor, input));
        return ResponseEntity.created(URI.create("/api/v1/tasks/" + result.get("taskId"))).eTag("\"" + result.get("rowVersion") + "\"").body(result);
    }

    @PatchMapping("/tasks/{id}")
    public ResponseEntity<Map<String, Object>> change(@RequestAttribute("actor") Actor actor, @PathVariable String id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestHeader(value = "If-Match", required = false) String ifMatch, @RequestBody Map<String, Object> input) {
        Map<String, Object> result = writes.run(actor, key, "PATCH:/tasks/" + id, input, ifMatch, () -> tasks.change(actor, id, ifMatch, input));
        return ResponseEntity.ok().eTag("\"" + result.get("rowVersion") + "\"").body(result);
    }

    @GetMapping("/approval-requests")
    public Map<String, Object> approvals(@RequestAttribute("actor") Actor actor, @RequestParam(required = false) String mine,
            @RequestParam(required = false) String limit, @RequestParam(required = false) String offset) {
        return tasks.approvals(actor, mine, limit, offset);
    }

    @GetMapping("/approval-requests/{id}")
    public ResponseEntity<Map<String, Object>> approval(@RequestAttribute("actor") Actor actor, @PathVariable String id) {
        Map<String, Object> result = tasks.approval(actor, id);
        return ResponseEntity.ok().eTag("\"" + result.get("rowVersion") + "\"").body(result);
    }

    @PatchMapping("/approval-requests/{id}")
    public ResponseEntity<Map<String, Object>> decide(@RequestAttribute("actor") Actor actor, @PathVariable String id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestHeader(value = "If-Match", required = false) String ifMatch, @RequestBody Map<String, Object> input) {
        Map<String, Object> result = writes.run(actor, key, "PATCH:/approval-requests/" + id, input, ifMatch, () -> tasks.decide(actor, id, ifMatch, input));
        return ResponseEntity.ok().eTag("\"" + result.get("requestRowVersion") + "\"").body(result);
    }
}
