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
    private final Tags tags;
    private final Writes writes;

    public TaskController(TaskService tasks, Tags tags, Writes writes) {
        this.tasks = tasks;
        this.tags = tags;
        this.writes = writes;
    }

    /** Company tag catalogue. Reading is available to every business account; maintenance is root-only. */
    @GetMapping("/tags")
    public Map<String, Object> tags(@RequestAttribute("actor") Actor actor, @RequestParam Map<String, String> filters) {
        return tags.list(actor, filters);
    }

    @PostMapping("/tags")
    public Map<String, Object> createTag(@RequestAttribute("actor") Actor actor,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestBody Map<String, Object> input) {
        return writes.run(actor, key, "POST /tags", input, null, () -> tags.create(actor, input));
    }

    @PatchMapping("/tags/{id}")
    public Map<String, Object> changeTag(@RequestAttribute("actor") Actor actor, @PathVariable String id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestHeader(value = "If-Match", required = false) String ifMatch,
            @RequestBody Map<String, Object> input) {
        return writes.run(actor, key, "PATCH /tags/" + id, input, ifMatch, () -> tags.change(actor, id, ifMatch, input));
    }

    @DeleteMapping("/tags/{id}")
    public Map<String, Object> deleteTag(@RequestAttribute("actor") Actor actor, @PathVariable String id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestHeader(value = "If-Match", required = false) String ifMatch) {
        return writes.run(actor, key, "DELETE /tags/" + id, Map.of(), ifMatch, () -> tags.delete(actor, id, ifMatch));
    }

    @GetMapping("/tasks")
    public Map<String, Object> list(@RequestAttribute("actor") Actor actor, @RequestParam Map<String, String> filters) {
        return tasks.list(actor, filters);
    }

    /** Authorized assignee candidates; reading a department never puts its people in this list. */
    @GetMapping("/assignee-candidates")
    public Map<String, Object> assigneeCandidates(@RequestAttribute("actor") Actor actor,
            @RequestParam(value = "q", required = false) String query,
            @RequestParam(value = "purpose", required = false) String purpose) {
        // purpose=create (default) is the company-wide creation candidate list; purpose=edit keeps the
        // historical dispatch range for modifications of an already published task.
        return tasks.assigneeCandidates(actor, query, purpose);
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
        tasks.expireBeforeSubmit(actor, id);
        Map<String, Object> result = writes.run(actor, key, "POST:/tasks/" + id + "/handover", input, ifMatch,
                () -> tasks.handover(actor, id, ifMatch, input));
        return ResponseEntity.ok().eTag("\"" + result.get("rowVersion") + "\"").body(result);
    }

    /** Legal handover targets for one person (self or that person's direct manager only). */
    @GetMapping("/handover-targets")
    public Map<String, Object> handoverTargets(@RequestAttribute("actor") Actor actor,
            @RequestParam String subjectId, @RequestParam(value = "q", required = false) String query) {
        return tasks.handoverTargets(actor, subjectId, query);
    }

    /** Preset successor for one person's current tasks (V-010). */
    @GetMapping("/users/{id}/handover-preset")
    public Map<String, Object> handoverPreset(@RequestAttribute("actor") Actor actor, @PathVariable String id) {
        return tasks.handoverPreset(actor, id);
    }

    @PutMapping("/users/{id}/handover-preset")
    public Map<String, Object> saveHandoverPreset(@RequestAttribute("actor") Actor actor, @PathVariable String id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestBody Map<String, Object> input) {
        return writes.run(actor, key, "PUT /users/" + id + "/handover-preset", input, null,
                () -> tasks.saveHandoverPreset(actor, id, input));
    }

    @DeleteMapping("/users/{id}/handover-preset")
    public Map<String, Object> clearHandoverPreset(@RequestAttribute("actor") Actor actor, @PathVariable String id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        return writes.run(actor, key, "DELETE /users/" + id + "/handover-preset", Map.of(), null,
                () -> tasks.clearHandoverPreset(actor, id));
    }

    /** Personal month-view pin; never changes task data or another user's order. */
    @PutMapping("/tasks/{id}/pin")
    public Map<String, Object> pin(@RequestAttribute("actor") Actor actor, @PathVariable String id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        return writes.run(actor, key, "PUT /tasks/" + id + "/pin", Map.of(), null,
                () -> tasks.setPinned(actor, id, true));
    }

    @DeleteMapping("/tasks/{id}/pin")
    public Map<String, Object> unpin(@RequestAttribute("actor") Actor actor, @PathVariable String id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        return writes.run(actor, key, "DELETE /tasks/" + id + "/pin", Map.of(), null,
                () -> tasks.setPinned(actor, id, false));
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
        // Commit the deadline terminal state before the command so a stale-page 4xx cannot roll it back.
        tasks.expireBeforeSubmit(actor, id);
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
        // The expired terminal state (and its unfreeze/overdue events) is committed by writes.run before
        // this business error is returned; rolling it back would let the old page approve afterwards.
        if (Boolean.TRUE.equals(result.get("deadlineExpired"))) {
            throw new cn.pandora.common.ApiException(409, "REQUEST_EXPIRED", "申请已到适用截止时间失效，请调整后重提");
        }
        return ResponseEntity.ok().eTag("\"" + result.get("requestRowVersion") + "\"").body(result);
    }
}
