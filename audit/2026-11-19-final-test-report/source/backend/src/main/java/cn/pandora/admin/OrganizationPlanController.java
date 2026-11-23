package cn.pandora.admin;

import cn.pandora.auth.Actor;
import cn.pandora.common.Writes;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/organization-plans")
public class OrganizationPlanController {
    private final OrganizationPlans plans;
    private final Writes writes;
    public OrganizationPlanController(OrganizationPlans plans,Writes writes) {this.plans=plans;this.writes=writes;}
    @GetMapping
    public ResponseEntity<Map<String,Object>> draft(@RequestAttribute("actor") Actor actor) {
        var result=plans.draft(actor);return ResponseEntity.ok().eTag("\""+result.get("rowVersion")+"\"").body(result);
    }
    @PostMapping
    public ResponseEntity<Map<String,Object>> save(@RequestAttribute("actor") Actor actor,
            @RequestHeader(value="Idempotency-Key",required=false) String key,
            @RequestHeader(value="If-Match",required=false) String ifMatch,
            @RequestBody Map<String,Object> input) {
        var result=writes.runOutcome(actor,key,"POST /admin/organization-plans",input,ifMatch,()->plans.save(actor,ifMatch,input));
        return ResponseEntity.ok().eTag("\""+result.get("rowVersion")+"\"").body(result);
    }
}
