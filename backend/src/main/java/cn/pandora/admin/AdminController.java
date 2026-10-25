package cn.pandora.admin;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.ControllableClock;
import cn.pandora.common.Writes;
import cn.pandora.task.TaskService;
import cn.pandora.workspace.EventsWorker;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Map;

/** Administration console API (DEV-001, DEV-002, DEV-015, DEV-028). */
@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {
    private final OrganizationService organization;
    private final Writes writes;
    private final TaskService tasks;
    private final Access access;
    private final java.time.Clock clock;
    private final ObjectProvider<EventsWorker> worker;
    private final LoginKeyConstraints loginKeys;

    public AdminController(OrganizationService organization, Writes writes, TaskService tasks, Access access,
                           java.time.Clock clock, ObjectProvider<EventsWorker> worker, LoginKeyConstraints loginKeys) {
        this.organization = organization;
        this.writes = writes;
        this.tasks = tasks;
        this.access = access;
        this.clock = clock;
        this.worker = worker;
        this.loginKeys = loginKeys;
    }

    /**
     * Controlled clock for deadline, reminder and retention verification. It exists only when
     * pandora.clock.controllable=true and is restricted to an administrator, so production runs use
     * the normal system clock and no business endpoint can move time.
     */
    @GetMapping("/clock")
    public Map<String,Object> clock(@RequestAttribute("actor") Actor actor) {
        access.requireAdmin(actor);
        return Map.of("now", clock.instant().toString(), "controllable", clock instanceof ControllableClock);
    }

    @PostMapping("/clock/advance")
    public Map<String,Object> advanceClock(@RequestAttribute("actor") Actor actor, @RequestBody Map<String,Object> input) {
        access.requireAdmin(actor);
        if (!(clock instanceof ControllableClock controllable)) {
            throw new ApiException(409, "CLOCK_NOT_CONTROLLABLE", "当前运行未启用受控时钟");
        }
        Object seconds = input.get("seconds");
        if (!(seconds instanceof Number number) || number.longValue() < 0 || number.longValue() > 86400L * 400) {
            throw new ApiException(400, "INVALID_INPUT", "seconds 须为 0 至 34560000 的整数");
        }
        controllable.advance(java.time.Duration.ofSeconds(number.longValue()));
        return Map.of("now", clock.instant().toString(), "offsetSeconds", controllable.offset().toSeconds());
    }

    /** Run one worker pass deterministically during verification (expiry → reminders → delivery → clean-up). */
    @PostMapping("/worker/run-once")
    public Map<String,Object> runWorker(@RequestAttribute("actor") Actor actor) {
        access.requireAdmin(actor);
        EventsWorker eventsWorker = worker.getIfAvailable();
        if (eventsWorker == null) throw new ApiException(409, "WORKER_DISABLED", "当前运行未启用事件工作器");
        eventsWorker.runOnce();
        return Map.of("ran", true, "now", clock.instant().toString());
    }

    /** Complete operation history of one task; the App has no equivalent entry point (DEV-016). */
    @GetMapping("/tasks/{id}/history")
    public Map<String, Object> taskHistory(@RequestAttribute("actor") Actor actor, @PathVariable String id) {
        return tasks.taskHistory(actor, id);
    }

    /**
     * Administrator-only task locator for the formal console (chapter 9.1). A business account is
     * rejected by the capability check inside the service, and the projection carries no contact data.
     */
    @GetMapping("/tasks")
    public Map<String, Object> adminTasks(@RequestAttribute("actor") Actor actor, @RequestParam Map<String, String> filters) {
        return tasks.adminTasks(actor, filters);
    }

    @GetMapping("/organization")
    public Map<String, Object> structure(@RequestAttribute("actor") Actor actor) {
        return organization.structure(actor);
    }

    @GetMapping("/roles")
    public Map<String, Object> roles(@RequestAttribute("actor") Actor actor) {
        return Map.of("items", organization.roles(actor));
    }

    @GetMapping("/employees")
    public Map<String, Object> employees(@RequestAttribute("actor") Actor actor, @RequestParam Map<String, String> filters) {
        return organization.employees(actor, filters);
    }

    @GetMapping("/employees/{id}")
    public ResponseEntity<Map<String, Object>> employee(@RequestAttribute("actor") Actor actor, @PathVariable String id) {
        Map<String, Object> result = organization.employee(actor, id);
        return ResponseEntity.ok().eTag("\"" + result.get("rowVersion") + "\"").body(result);
    }

    @PostMapping("/employees")
    public ResponseEntity<Map<String, Object>> createEmployee(@RequestAttribute("actor") Actor actor,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestBody Map<String, Object> input) {
        Map<String, Object> result = writes.runOutcome(actor, key, "POST /admin/employees", input, null,
                () -> organization.createEmployee(actor, input));
        tightenOrganizationConstraints();
        return ResponseEntity.created(URI.create("/api/v1/admin/employees/" + result.get("userId")))
                .eTag("\"" + result.get("rowVersion") + "\"").body(result);
    }

    @PatchMapping("/employees/{id}")
    public ResponseEntity<Map<String, Object>> updateEmployee(@RequestAttribute("actor") Actor actor, @PathVariable String id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestHeader(value = "If-Match", required = false) String ifMatch,
            @RequestBody Map<String, Object> input) {
        Map<String, Object> result = writes.run(actor, key, "PATCH /admin/employees/" + id, input, ifMatch,
                () -> organization.updateEmployee(actor, id, ifMatch, input));
        tightenOrganizationConstraints();
        return ResponseEntity.ok().eTag("\"" + result.get("rowVersion") + "\"").body(result);
    }

    @PostMapping("/employees/{id}/transfer")
    public ResponseEntity<Map<String, Object>> transferEmployee(@RequestAttribute("actor") Actor actor, @PathVariable String id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestHeader(value = "If-Match", required = false) String ifMatch,
            @RequestBody Map<String, Object> input) {
        Map<String, Object> result = writes.run(actor, key, "POST /admin/employees/" + id + "/transfer", input, ifMatch,
                () -> organization.transferEmployee(actor, id, ifMatch, input));
        tightenOrganizationConstraints();
        return ResponseEntity.ok().eTag("\"" + result.get("rowVersion") + "\"").body(result);
    }

    @PostMapping("/employees/{id}/roles")
    public ResponseEntity<Map<String, Object>> grantRoles(@RequestAttribute("actor") Actor actor, @PathVariable String id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestHeader(value = "If-Match", required = false) String ifMatch,
            @RequestBody Map<String, Object> input) {
        Map<String, Object> result = writes.run(actor, key, "POST /admin/employees/" + id + "/roles", input, ifMatch,
                () -> organization.grantRoles(actor, id, ifMatch, input));
        return ResponseEntity.ok().eTag("\"" + result.get("rowVersion") + "\"").body(result);
    }

    /** Administrator password reset: returns the new one-time password exactly once (DEV-001, DEV-003). */
    @PostMapping("/employees/{id}/password-reset")
    public Map<String, Object> resetPassword(@RequestAttribute("actor") Actor actor, @PathVariable String id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        return writes.runOutcome(actor, key, "POST /admin/employees/" + id + "/password-reset", Map.of(), null,
                () -> organization.resetPassword(actor, id));
    }

    @PostMapping("/departments")
    public Map<String, Object> createDepartment(@RequestAttribute("actor") Actor actor,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestBody Map<String, Object> input) {
        return writes.run(actor, key, "POST /admin/departments", input, null, () -> organization.createDepartment(actor, input));
    }

    @PatchMapping("/departments/{id}")
    public ResponseEntity<Map<String, Object>> updateDepartment(@RequestAttribute("actor") Actor actor, @PathVariable String id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestHeader(value = "If-Match", required = false) String ifMatch,
            @RequestBody Map<String, Object> input) {
        Map<String, Object> result = writes.run(actor, key, "PATCH /admin/departments/" + id, input, ifMatch,
                () -> organization.updateDepartment(actor, id, ifMatch, input));
        return ResponseEntity.ok().eTag("\"" + result.get("rowVersion") + "\"").body(result);
    }

    @PostMapping("/positions")
    public Map<String, Object> createPosition(@RequestAttribute("actor") Actor actor,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestBody Map<String, Object> input) {
        return writes.run(actor, key, "POST /admin/positions", input, null, () -> organization.createPosition(actor, input));
    }

    @PatchMapping("/positions/{id}")
    public ResponseEntity<Map<String, Object>> updatePosition(@RequestAttribute("actor") Actor actor, @PathVariable String id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestHeader(value = "If-Match", required = false) String ifMatch,
            @RequestBody Map<String, Object> input) {
        Map<String, Object> result = writes.run(actor, key, "PATCH /admin/positions/" + id, input, ifMatch,
                () -> organization.updatePosition(actor, id, ifMatch, input));
        return ResponseEntity.ok().eTag("\"" + result.get("rowVersion") + "\"").body(result);
    }

    @PostMapping("/teams")
    public Map<String, Object> createTeam(@RequestAttribute("actor") Actor actor,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestBody Map<String, Object> input) {
        return writes.run(actor, key, "POST /admin/teams", input, null, () -> organization.createTeam(actor, input));
    }

    /** Members of one department, offered as the team-lead selector in the console. */
    @GetMapping("/departments/{id}/members")
    public Map<String, Object> departmentMembers(@RequestAttribute("actor") Actor actor, @PathVariable String id) {
        return Map.of("items", organization.departmentMembers(actor, id));
    }

    @PatchMapping("/teams/{id}")
    public ResponseEntity<Map<String, Object>> updateTeam(@RequestAttribute("actor") Actor actor, @PathVariable String id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestHeader(value = "If-Match", required = false) String ifMatch,
            @RequestBody Map<String, Object> input) {
        Map<String, Object> result = writes.run(actor, key, "PATCH /admin/teams/" + id, input, ifMatch,
                () -> organization.updateTeam(actor, id, ifMatch, input));
        // Mapping every legacy team can be the final step; retighten here too so the write gate opens
        // without requiring an unrelated employee edit or a restart (V-009).
        tightenOrganizationConstraints();
        return ResponseEntity.ok().eTag("\"" + result.get("rowVersion") + "\"").body(result);
    }

    @GetMapping("/company")
    public Map<String, Object> company(@RequestAttribute("actor") Actor actor) {
        return organization.companyItems(actor);
    }

    @PostMapping("/company/items")
    public Map<String, Object> createCompanyItem(@RequestAttribute("actor") Actor actor,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestBody Map<String, Object> input) {
        return writes.run(actor, key, "POST /admin/company/items", input, null, () -> organization.createCompanyItem(actor, input));
    }

    @PatchMapping("/company/items/{id}")
    public ResponseEntity<Map<String, Object>> updateCompanyItem(@RequestAttribute("actor") Actor actor, @PathVariable String id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestHeader(value = "If-Match", required = false) String ifMatch,
            @RequestBody Map<String, Object> input) {
        Map<String, Object> result = writes.run(actor, key, "PATCH /admin/company/items/" + id, input, ifMatch,
                () -> organization.updateCompanyItem(actor, id, ifMatch, input));
        return ResponseEntity.ok().eTag("\"" + result.get("rowVersion") + "\"").body(result);
    }

    @DeleteMapping("/company/items/{id}")
    public Map<String, Object> deleteCompanyItem(@RequestAttribute("actor") Actor actor, @PathVariable String id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestHeader(value = "If-Match", required = false) String ifMatch) {
        return writes.run(actor, key, "DELETE /admin/company/items/" + id, Map.of(), ifMatch,
                () -> organization.deleteCompanyItem(actor, id, ifMatch));
    }

    @PostMapping("/company/items/reorder")
    public Map<String, Object> reorderCompanyItems(@RequestAttribute("actor") Actor actor,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestBody Map<String, Object> input) {
        return writes.run(actor, key, "POST /admin/company/items/reorder", input, null,
                () -> organization.reorderCompanyItems(actor, input));
    }

    @PutMapping("/company/off-work-time")
    public Map<String, Object> setOffWorkTime(@RequestAttribute("actor") Actor actor,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestBody Map<String, Object> input) {
        return writes.run(actor, key, "PUT /admin/company/off-work-time", input, null,
                () -> organization.setOffWorkTime(actor, input));
    }

    /**
     * Independently configure one role's view/dispatch (and log/profile) ranges. Written through the
     * normal organization write contract so the authorization version advances and old pages,
     * candidates, approvals and idempotent replays are invalidated immediately (DEV-002).
     */
    @PatchMapping("/roles/{code}/scopes")
    public Map<String, Object> updateRoleScopes(@RequestAttribute("actor") Actor actor, @PathVariable String code,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestBody Map<String, Object> input) {
        return writes.run(actor, key, "PATCH /admin/roles/" + code + "/scopes", input, null,
                () -> organization.updateRoleScopes(actor, code, input));
    }

    /** Tighten the staged constraints once the mapping is complete; DDL must run after the command commits. */
    private void tightenOrganizationConstraints() {
        try {
            organization.applyOrganizationConstraints();
        } catch (RuntimeException ignored) {
            // The mapping stays staged and reported in the administration console; never fail the write.
        }
        try {
            // An administrator repair of a missing/duplicate phone can now re-establish the unique
            // login key immediately, without waiting for a restart.
            loginKeys.tighten();
        } catch (RuntimeException ignored) {
            // The staged login key remains reported and the login path itself rejects ambiguity.
        }
    }
}
