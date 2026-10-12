package cn.pandora.common;

import cn.pandora.auth.Actor;
import org.springframework.stereotype.Component;
import java.util.*;
import static cn.pandora.common.Db.*;

@Component
public class Events {
    private final Db db;
    public Events(Db db) {this.db=db;}
    public void record(Actor actor,String taskId,String type,Collection<String> recipients,Map<String,Object> details) {
        db.update("INSERT INTO audit_logs(id,organization_id,actor_id,object_id,action,details_json) VALUES(?,?,?,?,?,?)",id(),actor.organizationId(),actor.id(),taskId,type,db.json(details));
        db.update("INSERT INTO domain_events(id,organization_id,task_id,event_type,recipients_json,details_json) VALUES(?,?,?,?,?,?)",id(),actor.organizationId(),taskId,type,db.json(new LinkedHashSet<>(recipients)),db.json(details));
    }
}
