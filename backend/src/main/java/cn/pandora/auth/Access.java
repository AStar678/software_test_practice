package cn.pandora.auth;

import cn.pandora.common.*;
import org.springframework.stereotype.Component;
import java.util.*;
import static cn.pandora.common.Db.*;

@Component
public class Access {
    private final Db db;
    public Access(Db db) {this.db=db;}
    public Map<String,Object> user(Actor a,String id) { return db.one("SELECT * FROM users WHERE id=? AND organization_id=? AND active=1",id,a.organizationId()); }
    public boolean canSeePerson(Actor a,Map<String,Object> user) {
        if(!a.organizationId().equals(s(user,"organizationId"))) return false;
        return a.id().equals(s(user,"id")) || a.role().equals("upper") || (a.role().equals("middle") && a.teamId()!=null && Objects.equals(a.teamId(),s(user,"teamId")));
    }
    public List<String> visibleUserIds(Actor a) {
        return db.list("SELECT * FROM users WHERE organization_id=? AND active=1",a.organizationId()).stream().filter(u->canSeePerson(a,u)).map(u->s(u,"id")).toList();
    }
    public boolean canSeeTask(Actor a,Map<String,Object> task,Map<String,Object> version,List<String> assignees) {
        if(version==null || !a.organizationId().equals(s(task,"organizationId")) || s(task,"currentVersionId")==null) return false;
        if(a.id().equals(s(task,"originalCreatorId")) || assignees.contains(a.id())) return true;
        if(a.role().equals("upper")) return true;
        if(a.role().equals("middle") && a.teamId()!=null) {
            for(String id:assignees) {
                var u=db.find("SELECT team_id FROM users WHERE organization_id=? AND id=?",a.organizationId(),id);
                if(u!=null && Objects.equals(a.teamId(),s(u,"teamId"))) return true;
            }
        }
        return false;
    }
    public void requireAdmin(Actor a) { if(!a.role().equals("admin")) throw new ApiException(403,"FORBIDDEN","需要后台管理员权限"); }
}
