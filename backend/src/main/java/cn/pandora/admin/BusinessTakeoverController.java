package cn.pandora.admin;

import cn.pandora.auth.Actor;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

/**
 * Read-only responsibility history. The former standalone takeover write endpoint is retired: management
 * takeover is only part of the dedicated employee offboarding command, so no administrator route can change
 * task responsibility outside it. Existing takeover records and permissions stay readable.
 */
@RestController
@RequestMapping("/api/v1/admin")
public class BusinessTakeoverController {
    private final BusinessTakeovers takeovers;
    public BusinessTakeoverController(BusinessTakeovers takeovers) {this.takeovers=takeovers;}
    @GetMapping("/employees/{id}/responsibilities")
    public Map<String,Object> inventory(@RequestAttribute("actor") Actor actor,@PathVariable String id) {return takeovers.inventory(actor,id);}
}
