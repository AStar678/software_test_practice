package cn.pandora.workspace;

import cn.pandora.auth.Actor;
import cn.pandora.common.Writes;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class WorkspaceController {
    private final WorkspaceService workspace;
    private final Writes writes;
    public WorkspaceController(WorkspaceService workspace,Writes writes) {this.workspace=workspace;this.writes=writes;}

    @GetMapping("/me") public Map<String,Object> me(@RequestAttribute("actor") Actor a) {return workspace.me(a);}
    @GetMapping("/users") public Map<String,Object> users(@RequestAttribute("actor") Actor a,@RequestParam Map<String,String> filters) {return workspace.users(a,filters,false);}
    @GetMapping("/users/{id}") public Map<String,Object> person(@RequestAttribute("actor") Actor a,@PathVariable String id) {return workspace.person(a,id);}
    @GetMapping("/home") public Map<String,Object> home(@RequestAttribute("actor") Actor a) {return workspace.home(a);}
    @GetMapping("/home/items/{id}") public ResponseEntity<Map<String,Object>> homeItem(@RequestAttribute("actor") Actor a,@PathVariable String id) {
        var result=workspace.homeItem(a,id);return ResponseEntity.ok().eTag("\""+result.get("rowVersion")+"\"").body(result);
    }
    @PostMapping("/home/items") public Map<String,Object> createHomeItem(@RequestAttribute("actor") Actor a,@RequestHeader(value="Idempotency-Key",required=false) String key,@RequestBody Map<String,Object> body) {
        workspace.checkHomeCreateAccess(a,body);
        return writes.run(a,key,"POST /home/items",body,null,()->workspace.createHomeItem(a,body));
    }
    @PatchMapping("/home/items/{id}") public Map<String,Object> changeHomeItem(@RequestAttribute("actor") Actor a,@PathVariable String id,@RequestHeader(value="Idempotency-Key",required=false) String key,@RequestHeader(value="If-Match",required=false) String match,@RequestBody Map<String,Object> body) {
        workspace.checkHomeItemWriteAccess(a,id);
        return writes.run(a,key,"PATCH /home/items/"+id,body,match,()->workspace.changeHomeItem(a,id,match,body));
    }
    @DeleteMapping("/home/items/{id}") public Map<String,Object> deleteHomeItem(@RequestAttribute("actor") Actor a,@PathVariable String id,@RequestHeader(value="Idempotency-Key",required=false) String key,@RequestHeader(value="If-Match",required=false) String match) {
        workspace.checkHomeItemWriteAccess(a,id);
        return writes.run(a,key,"DELETE /home/items/"+id,Map.of(),match,()->workspace.deleteHomeItem(a,id,match));
    }
    @GetMapping("/work-logs") public Map<String,Object> logs(@RequestAttribute("actor") Actor a,@RequestParam Map<String,String> filters) {return workspace.logs(a,filters);}
    /** Author filter (list + tree) for the log page, limited to the reader's log range. */
    @GetMapping("/work-log-authors") public Map<String,Object> logAuthors(@RequestAttribute("actor") Actor a,@RequestParam Map<String,String> filters) {return workspace.logAuthors(a,filters);}
    @GetMapping("/work-logs/{id}") public ResponseEntity<Map<String,Object>> log(@RequestAttribute("actor") Actor a,@PathVariable String id) {
        var result=workspace.log(a,id);return ResponseEntity.ok().eTag("\""+result.get("rowVersion")+"\"").body(result);
    }
    @PostMapping("/work-logs") public Map<String,Object> createLog(@RequestAttribute("actor") Actor a,@RequestHeader(value="Idempotency-Key",required=false) String key,@RequestBody Map<String,Object> body) {
        return writes.run(a,key,"POST /work-logs",body,null,()->workspace.createLog(a,body));
    }
    @PatchMapping("/work-logs/{id}") public Map<String,Object> changeLog(@RequestAttribute("actor") Actor a,@PathVariable String id,@RequestHeader(value="Idempotency-Key",required=false) String key,@RequestHeader(value="If-Match",required=false) String match,@RequestBody Map<String,Object> body) {
        return writes.run(a,key,"PATCH /work-logs/"+id,body,match,()->workspace.changeLog(a,id,match,body));
    }
    @DeleteMapping("/work-logs/{id}") public Map<String,Object> deleteLog(@RequestAttribute("actor") Actor a,@PathVariable String id,@RequestHeader(value="Idempotency-Key",required=false) String key,@RequestHeader(value="If-Match",required=false) String match) {
        return writes.run(a,key,"DELETE /work-logs/"+id,Map.of(),match,()->workspace.deleteLog(a,id,match));
    }
    @GetMapping("/notifications") public Map<String,Object> notifications(@RequestAttribute("actor") Actor a,@RequestParam Map<String,String> filters) {return workspace.notifications(a,filters);}
    @GetMapping("/notifications/{id}") public ResponseEntity<Map<String,Object>> notification(@RequestAttribute("actor") Actor a,@PathVariable String id) {
        var result=workspace.notification(a,id);return ResponseEntity.ok().eTag("\""+result.get("rowVersion")+"\"").body(result);
    }
    @PatchMapping("/notifications/{id}") public Map<String,Object> changeNotification(@RequestAttribute("actor") Actor a,@PathVariable String id,@RequestHeader(value="Idempotency-Key",required=false) String key,@RequestHeader(value="If-Match",required=false) String match,@RequestBody Map<String,Object> body) {
        return writes.run(a,key,"PATCH /notifications/"+id,body,match,()->workspace.changeNotification(a,id,match,body));
    }
    @GetMapping("/analytics/task-summary") public Map<String,Object> stats(@RequestAttribute("actor") Actor a,@RequestParam Map<String,String> filters) {return workspace.statistics(a,filters);}
    @PostMapping("/ai-jobs") public Map<String,Object> createAi(@RequestAttribute("actor") Actor a,@RequestHeader(value="Idempotency-Key",required=false) String key,@RequestBody(required=false) Map<String,Object> body) {
        var input=body==null?Map.<String,Object>of():body;return writes.run(a,key,"POST /ai-jobs",input,null,()->workspace.createAiJob(a,input));
    }
    @GetMapping("/ai-jobs/{id}") public Map<String,Object> ai(@RequestAttribute("actor") Actor a,@PathVariable String id) {return workspace.aiJob(a,id);}
    @GetMapping("/admin/users") public Map<String,Object> adminUsers(@RequestAttribute("actor") Actor a,@RequestParam Map<String,String> filters) {return workspace.users(a,filters,true);}
    @GetMapping("/admin/teams") public Map<String,Object> adminTeams(@RequestAttribute("actor") Actor a,@RequestParam Map<String,String> filters) {return workspace.adminTeams(a,filters);}
    @GetMapping("/admin/audit-logs") public Map<String,Object> audit(@RequestAttribute("actor") Actor a,@RequestParam Map<String,String> filters) {return workspace.audit(a,filters);}
}
