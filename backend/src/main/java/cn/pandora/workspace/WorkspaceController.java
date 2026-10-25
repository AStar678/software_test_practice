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
    private final CommentService comments;
    private final Writes writes;
    /** Test seam kept for controller-only unit tests; production injects the dependency explicitly. */
    public WorkspaceController(WorkspaceService workspace,Writes writes) {
        this(workspace,null,writes);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceController(WorkspaceService workspace,CommentService comments,Writes writes) {
        this.workspace=workspace;this.comments=comments;this.writes=writes;
    }

    @GetMapping("/me") public Map<String,Object> me(@RequestAttribute("actor") Actor a) {return workspace.me(a);}
    /** Subordinates inside both the current profile scope and the actual management chain. */
    @GetMapping("/me/reports") public Map<String,Object> reports(@RequestAttribute("actor") Actor a) {return workspace.reports(a);}
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
    /** Flat comments on a task or a log; one publication-ordered, stably paged list. */
    @GetMapping("/tasks/{id}/comments") public Map<String,Object> taskComments(@RequestAttribute("actor") Actor a,@PathVariable String id,@RequestParam Map<String,String> filters) {
        return comments.list(a,"task",id,filters);
    }
    @PostMapping("/tasks/{id}/comments") public Map<String,Object> createTaskComment(@RequestAttribute("actor") Actor a,@PathVariable String id,@RequestHeader(value="Idempotency-Key",required=false) String key,@RequestBody Map<String,Object> body) {
        return writes.run(a,key,"POST /tasks/"+id+"/comments",body,null,()->comments.create(a,"task",id,body));
    }
    @GetMapping("/work-logs/{id}/comments") public Map<String,Object> logComments(@RequestAttribute("actor") Actor a,@PathVariable String id,@RequestParam Map<String,String> filters) {
        return comments.list(a,"log",id,filters);
    }
    @PostMapping("/work-logs/{id}/comments") public Map<String,Object> createLogComment(@RequestAttribute("actor") Actor a,@PathVariable String id,@RequestHeader(value="Idempotency-Key",required=false) String key,@RequestBody Map<String,Object> body) {
        return writes.run(a,key,"POST /work-logs/"+id+"/comments",body,null,()->comments.create(a,"log",id,body));
    }
    @PatchMapping("/comments/{id}") public Map<String,Object> changeComment(@RequestAttribute("actor") Actor a,@PathVariable String id,@RequestHeader(value="Idempotency-Key",required=false) String key,@RequestHeader(value="If-Match",required=false) String match,@RequestBody Map<String,Object> body) {
        return writes.run(a,key,"PATCH /comments/"+id,body,match,()->comments.change(a,id,match,body));
    }
    @DeleteMapping("/comments/{id}") public Map<String,Object> deleteComment(@RequestAttribute("actor") Actor a,@PathVariable String id,@RequestHeader(value="Idempotency-Key",required=false) String key,@RequestHeader(value="If-Match",required=false) String match) {
        return writes.run(a,key,"DELETE /comments/"+id,Map.of(),match,()->comments.delete(a,id,match));
    }
    @GetMapping("/notifications") public Map<String,Object> notifications(@RequestAttribute("actor") Actor a,@RequestParam Map<String,String> filters) {return workspace.notifications(a,filters);}
    @GetMapping("/notifications/{id}") public ResponseEntity<Map<String,Object>> notification(@RequestAttribute("actor") Actor a,@PathVariable String id) {
        var result=workspace.notification(a,id);return ResponseEntity.ok().eTag("\""+result.get("rowVersion")+"\"").body(result);
    }
    /** Opening a message marks it read and returns the authoritative view plus the refreshed unread count. */
    @PostMapping("/notifications/{id}/open") public Map<String,Object> openNotification(@RequestAttribute("actor") Actor a,@PathVariable String id,@RequestHeader(value="Idempotency-Key",required=false) String key) {
        return writes.run(a,key,"POST /notifications/"+id+"/open",Map.of(),null,()->workspace.openNotification(a,id));
    }
    @PatchMapping("/notifications/{id}") public Map<String,Object> changeNotification(@RequestAttribute("actor") Actor a,@PathVariable String id,@RequestHeader(value="Idempotency-Key",required=false) String key,@RequestHeader(value="If-Match",required=false) String match,@RequestBody Map<String,Object> body) {
        return writes.run(a,key,"PATCH /notifications/"+id,body,match,()->workspace.changeNotification(a,id,match,body));
    }
    /** Event-level withdrawal: business initiator or notification manager, strictly under 180 seconds. */
    @PostMapping("/notifications/{id}/withdraw") public Map<String,Object> withdrawNotification(@RequestAttribute("actor") Actor a,@PathVariable String id,@RequestHeader(value="Idempotency-Key",required=false) String key,@RequestBody(required=false) Map<String,Object> body) {
        var input=body==null?Map.<String,Object>of():body;
        return writes.run(a,key,"POST /notifications/"+id+"/withdraw",input,null,()->workspace.withdrawNotification(a,id,input));
    }
    /** Dedicated read-only current-task summary for a delivered message. */
    @GetMapping("/notifications/{id}/task") public Map<String,Object> notificationTask(@RequestAttribute("actor") Actor a,@PathVariable String id) {return workspace.notificationTask(a,id);}
    @GetMapping("/analytics/task-summary") public Map<String,Object> stats(@RequestAttribute("actor") Actor a,@RequestParam Map<String,String> filters) {return workspace.statistics(a,filters);}
    @PostMapping("/ai-jobs") public Map<String,Object> createAi(@RequestAttribute("actor") Actor a,@RequestHeader(value="Idempotency-Key",required=false) String key,@RequestBody(required=false) Map<String,Object> body) {
        var input=body==null?Map.<String,Object>of():body;return writes.run(a,key,"POST /ai-jobs",input,null,()->workspace.createAiJob(a,input));
    }
    @GetMapping("/ai-jobs/{id}") public Map<String,Object> ai(@RequestAttribute("actor") Actor a,@PathVariable String id) {return workspace.aiJob(a,id);}
    @GetMapping("/admin/users") public Map<String,Object> adminUsers(@RequestAttribute("actor") Actor a,@RequestParam Map<String,String> filters) {return workspace.users(a,filters,true);}
    @GetMapping("/admin/teams") public Map<String,Object> adminTeams(@RequestAttribute("actor") Actor a,@RequestParam Map<String,String> filters) {return workspace.adminTeams(a,filters);}
    @GetMapping("/admin/audit-logs") public Map<String,Object> audit(@RequestAttribute("actor") Actor a,@RequestParam Map<String,String> filters) {return workspace.audit(a,filters);}
    @GetMapping("/admin/notifications") public Map<String,Object> adminNotifications(@RequestAttribute("actor") Actor a,@RequestParam Map<String,String> filters) {return workspace.adminNotifications(a,filters);}
    @PostMapping("/admin/notifications/{eventId}/withdraw") public Map<String,Object> adminWithdraw(@RequestAttribute("actor") Actor a,@PathVariable String eventId,@RequestHeader(value="Idempotency-Key",required=false) String key,@RequestBody(required=false) Map<String,Object> body) {
        var input=body==null?Map.<String,Object>of():body;
        return writes.run(a,key,"POST /admin/notifications/"+eventId+"/withdraw",input,null,()->workspace.withdrawEvent(a,eventId,input));
    }
}
