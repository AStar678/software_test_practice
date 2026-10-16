package cn.pandora.admin;

import cn.pandora.auth.Actor;
import cn.pandora.common.Writes;
import cn.pandora.task.TaskService;
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

    public AdminController(OrganizationService organization, Writes writes, TaskService tasks) {
        this.organization = organization;
        this.writes = writes;
        this.tasks = tasks;
    }

    /** Complete operation history of one task; the App has no equivalent entry point (DEV-016). */
    @GetMapping("/tasks/{id}/history")
    public Map<String, Object> taskHistory(@RequestAttribute("actor") Actor actor, @PathVariable String id) {
        return tasks.taskHistory(actor, id);
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
        return ResponseEntity.ok().eTag("\"" + result.get("rowVersion") + "\"").body(result);
    }

    @PostMapping("/employees/{id}/transfer")
    public ResponseEntity<Map<String, Object>> transferEmployee(@RequestAttribute("actor") Actor actor, @PathVariable String id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestHeader(value = "If-Match", required = false) String ifMatch,
            @RequestBody Map<String, Object> input) {
        Map<String, Object> result = writes.run(actor, key, "POST /admin/employees/" + id + "/transfer", input, ifMatch,
                () -> organization.transferEmployee(actor, id, ifMatch, input));
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
}
