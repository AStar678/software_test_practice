package cn.pandora.admin;

import cn.pandora.auth.Actor;
import cn.pandora.common.Writes;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin")
public class BusinessTakeoverController {
    private final BusinessTakeovers takeovers;
    private final Writes writes;
    public BusinessTakeoverController(BusinessTakeovers takeovers,Writes writes) {this.takeovers=takeovers;this.writes=writes;}
    @GetMapping("/employees/{id}/responsibilities")
    public Map<String,Object> inventory(@RequestAttribute("actor") Actor actor,@PathVariable String id) {return takeovers.inventory(actor,id);}
    @PostMapping("/business-takeovers")
    public Map<String,Object> transfer(@RequestAttribute("actor") Actor actor,
            @RequestHeader(value="Idempotency-Key",required=false) String key,
            @RequestHeader(value="If-Match",required=false) String match,@RequestBody Map<String,Object> input) {
        return writes.run(actor,key,"POST /admin/business-takeovers",input,match,()->takeovers.transfer(actor,match,input));
    }
}
