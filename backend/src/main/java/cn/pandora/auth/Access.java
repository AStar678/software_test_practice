package cn.pandora.auth;

import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import org.springframework.stereotype.Component;
import java.util.*;
import java.util.function.Supplier;
import static cn.pandora.common.Db.*;

/** Fixed organization positions and current object relationships are the only business authority. */
@Component
public class Access {
    private final Db db;
    public Access(Db db) {this.db=db;}
    /** A single read operation owns these snapshots; no authorization is retained between calls. */
    private final ThreadLocal<ReadScope> reads = new ThreadLocal<>();
    private static final class ReadScope {
        final String organizationId;
        CompanyTree.Tree tree;
        final Map<String,String> businessOwners = new HashMap<>();
        ReadScope(String organizationId) { this.organizationId=organizationId; }
    }
    public <T> T readScope(String organizationId,Supplier<T> work) {
        ReadScope previous=reads.get();
        if(previous!=null && previous.organizationId.equals(organizationId)) return work.get();
        reads.set(new ReadScope(organizationId));
        try { return work.get(); }
        finally { if(previous==null) reads.remove(); else reads.set(previous); }
    }
    private ReadScope currentRead(String org) {
        ReadScope scope=reads.get();
        return scope!=null && scope.organizationId.equals(org)?scope:null;
    }
    private CompanyTree.Tree tree(String org) {
        ReadScope scope=currentRead(org);
        if(scope==null) return new CompanyTree(db).of(org);
        if(scope.tree==null) scope.tree=new CompanyTree(db).of(org);
        return scope.tree;
    }
    /** Preload only task identities required by this read, including absent ownership rows. */
    public void primeBusinessOwners(String org,Collection<String> taskIds) {
        ReadScope scope=currentRead(org);if(scope==null || taskIds==null) return;
        List<String> missing=taskIds.stream().filter(Objects::nonNull).distinct()
                .filter(id->!scope.businessOwners.containsKey(id)).toList();
        for(int start=0;start<missing.size();start+=500) {
            List<String> part=missing.subList(start,Math.min(start+500,missing.size()));
            List<Object> args=new ArrayList<>();args.add(org);args.addAll(part);
            for(String id:part) scope.businessOwners.put(id,null);
            for(var row:db.list("SELECT task_id,employee_id FROM task_business_owners WHERE organization_id=? AND task_id IN ("
                    +String.join(",",Collections.nCopies(part.size(),"?"))+")",args.toArray()))
                scope.businessOwners.put(s(row,"taskId"),s(row,"employeeId"));
        }
    }
    private static final Set<String> MANAGEMENT=Set.of("manage_organization","manage_accounts","manage_company_info","manage_notifications","view_task_history");
    private static boolean manager(Actor a) {return Set.of("founder","department_head","team_head").contains(a.role());}
    private static boolean placed(Actor a) {return a.business() && Set.of("founder","department_head","team_head","employee").contains(a.role());}

    public Actor actor(Map<String,Object> account) {
        String org=s(account,"organizationId"),id=s(account,"id");
        long version=n(db.one("SELECT authz_version FROM organizations WHERE id=?",org),"authzVersion");
        boolean admin="admin".equals(s(account,"accountType"));
        long credential=account.get("credentialVersion")==null?1:n(account,"credentialVersion");
        if(admin) return new Actor(id,org,"admin",null,null,0,null,null,MANAGEMENT,Map.of(),version,
                false,enabledValue(account.get("mustChangePassword")),credential,"admin");
        var snapshot=tree(org);var node=snapshot.valid()?snapshot.nodes().get(id):null;
        String role=node==null?"unplaced":s(node,"placementType");
        String range=switch(role) {case "founder"->"company";case "department_head"->"department";case "team_head"->"team";default->"self";};
        Set<String> capabilities=node==null?Set.of():Set.of("create_task","handover_own");
        if(Set.of("founder","department_head","team_head").contains(role)) capabilities=Set.of("create_task","handover_own","handover_reports");
        return new Actor(id,org,role,node==null?null:s(node,"teamId"),node==null?null:s(node,"managerId"),
                node==null?0:(int)n(node,"rankLevel"),node==null?null:s(node,"departmentId"),node==null?null:s(node,"positionId"),
                capabilities,Map.of("task_view",range,"task_dispatch",node==null?"none":"company","log_read",range,"profile_read",range),version,
                node!=null && enabledValue(account.get("reviewerAvailable")),enabledValue(account.get("mustChangePassword")),credential,"employee");
    }
    public Actor actorFor(Actor context,String id) {return actor(user(context,id));}
    /** Call inside the read transaction, before using the actor captured by the HTTP filter. */
    public void requireCurrent(Actor a) {
        var company=db.one("SELECT authz_version FROM organizations WHERE id=?",a.organizationId());
        if(n(company,"authzVersion")!=a.authzVersion())
            throw new ApiException(409,"AUTHORIZATION_CHANGED","权限已更新，请重新读取后操作");
    }
    /** Public employee summaries never carry credentials, phone, email or legacy authorization. */
    public List<Map<String,Object>> employeeDirectory(Actor a,boolean includeInactive) {
        var snapshot=tree(a.organizationId());
        if(!a.administrator() && !snapshot.valid())
            throw new ApiException(409,"ORGANIZATION_MAPPING_INCOMPLETE","组织位置尚未完成，请管理员修复");
        var rows=db.list("SELECT u.id,u.organization_id,u.display_name,(u.active AND pr.active) AS active,u.avatar,u.org_version AS row_version,"
                + "ep.placement_type,ep.department_id,ep.team_id,ep.position_id,"
                + "d.name AS department_name,t.name AS team_name,p.name AS position_name,"
                + "o.name AS organization_name,o.time_zone AS organization_time_zone "
                + "FROM users u JOIN principals pr ON pr.organization_id=u.organization_id AND pr.id=u.id AND pr.account_type='employee' "
                + "JOIN organizations o ON o.id=u.organization_id "
                + "LEFT JOIN employee_placements ep ON ep.organization_id=u.organization_id AND ep.employee_id=u.id "
                + "LEFT JOIN departments d ON d.organization_id=ep.organization_id AND d.id=ep.department_id "
                + "LEFT JOIN teams t ON t.organization_id=ep.organization_id AND t.id=ep.team_id "
                + "LEFT JOIN positions p ON p.organization_id=ep.organization_id AND p.id=ep.position_id "
                + "WHERE u.organization_id=? ORDER BY u.display_name,u.id",a.organizationId());
        Map<String,String> names=new HashMap<>();
        rows.forEach(row->names.put(s(row,"id"),s(row,"displayName")));
        List<Map<String,Object>> result=new ArrayList<>();
        for(var row:rows) {
            if(!includeInactive && !enabled(row)) continue;
            var node=snapshot.nodes().get(s(row,"id"));
            for(String key:List.of("role","placementType","rankLevel","managerId","departmentId","teamId","positionId"))
                row.put(key,node==null?null:node.get(key));
            row.put("managerName",names.get(s(row,"managerId")));
            row.put("accountType","employee");
            result.add(row);
        }
        result.sort(Comparator.comparingLong((Map<String,Object> row)->row.get("rankLevel")==null?5:n(row,"rankLevel"))
                .thenComparing(row->Objects.toString(row.get("displayName"),""))
                .thenComparing(row->s(row,"id")));
        return result;
    }
    public Map<String,Object> user(Actor a,String id) {
        var row=activeUser(a,id);if(row==null) throw ApiException.notFound();return row;
    }
    public Map<String,Object> activeUser(Actor a,String id) {
        var snapshot=tree(a.organizationId());if(!snapshot.valid()) return null;
        var node=snapshot.nodes().get(id);if(node==null) return null;
        var row=db.find("SELECT * FROM users WHERE id=? AND organization_id=? AND active=1",id,a.organizationId());
        if(row==null) return null;
        Map<String,Object> result=new LinkedHashMap<>(row);result.putAll(node);return result;
    }
    public Map<String,Object> knownUser(Actor a,String id) {
        var row=db.find("SELECT u.* FROM users u JOIN principals p ON p.organization_id=u.organization_id AND p.id=u.id "
                + "WHERE u.id=? AND u.organization_id=? AND p.account_type='employee'",id,a.organizationId());
        if(row==null) return null;
        var node=tree(a.organizationId()).nodes().get(id);if(node!=null) row.putAll(node);return row;
    }
    public boolean canSeeTask(Actor a,Map<String,Object> task,Map<String,Object> version,List<String> assignees) {
        if(!placed(a) || version==null || !a.organizationId().equals(s(task,"organizationId")) || s(task,"currentVersionId")==null) return false;
        if(a.id().equals(s(task,"originalCreatorId")) || assignees.contains(a.id()) || a.id().equals(businessOwner(task))) return true;
        if("founder".equals(a.role())) return true;
        var snapshot=tree(a.organizationId());if(!snapshot.valid()) return false;
        for(String id:assignees) {
            var node=snapshot.nodes().get(id);if(node==null) continue;
            if("department_head".equals(a.role()) && Objects.equals(a.departmentId(),s(node,"departmentId"))) return true;
            if("team_head".equals(a.role()) && Objects.equals(a.teamId(),s(node,"teamId"))) return true;
        }
        return false;
    }
    public String businessOwner(Map<String,Object> task) {
        String org=s(task,"organizationId"),id=s(task,"id");ReadScope scope=currentRead(org);
        if(scope!=null && scope.businessOwners.containsKey(id))
            return Objects.requireNonNullElse(scope.businessOwners.get(id),s(task,"originalCreatorId"));
        var owner=db.find("SELECT employee_id FROM task_business_owners WHERE organization_id=? AND task_id=?",org,id);
        if(scope!=null) scope.businessOwners.put(id,owner==null?null:s(owner,"employeeId"));
        return owner==null?s(task,"originalCreatorId"):s(owner,"employeeId");
    }
    public boolean canDispatchTo(Actor a,Map<String,Object> target) {
        return placed(a) && target!=null && enabled(target) && a.organizationId().equals(s(target,"organizationId"))
                && "employee".equals(s(target,"accountType")) && s(target,"placementType")!=null;
    }
    public void requireDispatchable(Actor a,String id) {requireCreationCandidate(a,id);}
    public List<Map<String,Object>> dispatchCandidates(Actor a,String query) {return creationCandidates(a,query);}
    public List<Map<String,Object>> creationCandidates(Actor a,String query) {
        if(!placed(a)) return List.of();
        var snapshot=tree(a.organizationId());if(!snapshot.valid()) return List.of();
        String like=Objects.toString(query,"").strip().toLowerCase(Locale.ROOT);
        return db.list("SELECT u.id,u.organization_id,u.display_name,u.active,p.placement_type,p.department_id,p.team_id,p.position_id,"
                + "d.name AS department_name,t.name AS team_name,pos.name AS position_name FROM users u "
                + "JOIN employee_placements p ON p.organization_id=u.organization_id AND p.employee_id=u.id "
                + "LEFT JOIN departments d ON d.organization_id=p.organization_id AND d.id=p.department_id "
                + "LEFT JOIN teams t ON t.organization_id=p.organization_id AND t.id=p.team_id "
                + "JOIN positions pos ON pos.organization_id=p.organization_id AND pos.id=p.position_id "
                + "WHERE u.organization_id=? AND u.active=1 ORDER BY u.display_name,u.id",a.organizationId()).stream()
                .filter(row->snapshot.nodes().containsKey(s(row,"id")))
                .filter(row->like.isEmpty() || s(row,"displayName").toLowerCase(Locale.ROOT).contains(like)
                        || Objects.toString(s(row,"departmentName"),"").toLowerCase(Locale.ROOT).contains(like))
                .map(row->{var result=new LinkedHashMap<String,Object>(row);result.put("managerId",s(snapshot.nodes().get(s(row,"id")),"managerId"));
                    result.put("accountType","employee");result.put("role",s(row,"placementType"));return (Map<String,Object>)result;}).toList();
    }
    public boolean isCreationCandidate(Actor a,String id) {return canDispatchTo(a,activeUser(a,id));}
    public void requireCreationCandidate(Actor a,String id) {
        if(!isCreationCandidate(a,id)) throw new ApiException(400,"INVALID_INPUT","负责人须为本公司有效业务员工");
    }
    public boolean isDirectReport(Actor a,String id) {
        if(!placed(a) || !manager(a) || id==null) return false;
        var snapshot=tree(a.organizationId());var node=snapshot.valid()?snapshot.nodes().get(id):null;
        return node!=null && a.id().equals(s(node,"managerId"));
    }
    public boolean canReadLogAuthor(Actor a,String id) {
        if(!placed(a) || id==null) return false;
        if(a.id().equals(id)) return true;
        return isManagerOf(a,id);
    }
    public List<String> logAuthorIds(Actor a) {
        return readScope(a.organizationId(),()-> {
            var snapshot=tree(a.organizationId());if(!snapshot.valid()) return List.of();
            return snapshot.nodes().keySet().stream().filter(id->canReadLogAuthor(a,id)).toList();
        });
    }
    public boolean canSeePerson(Actor a,Map<String,Object> person) {
        if(!placed(a) || person==null || !a.organizationId().equals(s(person,"organizationId")) || !enabled(person)) return false;
        return a.id().equals(s(person,"id")) || isManagerOf(a,s(person,"id"));
    }
    public boolean canReadPhone(Actor a,Map<String,Object> person) {return canSeePerson(a,person);}
    public boolean isManagerOf(Actor a,String id) {
        if(!placed(a) || !manager(a) || id==null || a.id().equals(id)) return false;
        var snapshot=tree(a.organizationId());if(!snapshot.valid()) return false;
        var node=snapshot.nodes().get(id);if(node==null) return false;
        String cursor=s(node,"managerId");
        while(cursor!=null) {
            if(a.id().equals(cursor)) return true;
            node=snapshot.nodes().get(cursor);if(node==null) return false;cursor=s(node,"managerId");
        }
        return false;
    }
    public List<String> visibleUserIds(Actor a) {return logAuthorIds(a);}
    public boolean canHandover(Actor a,String source,Collection<String> assignees) {
        return placed(a) && assignees!=null && assignees.contains(source) && (a.id().equals(source) || isDirectReport(a,source));
    }
    public boolean canSetHandoverPreset(Actor a,Map<String,Object> subject) {
        return placed(a) && subject!=null && enabled(subject) && a.organizationId().equals(s(subject,"organizationId"))
                && "employee".equals(s(subject,"accountType")) && (a.id().equals(s(subject,"id")) || isDirectReport(a,s(subject,"id")));
    }
    public boolean canBeHandoverTarget(Actor subject,Map<String,Object> target) {
        if(!canDispatchTo(subject,target) || subject.id().equals(s(target,"id"))) return false;
        if("founder".equals(subject.role())) return true;
        return subject.departmentId()!=null && subject.departmentId().equals(s(target,"departmentId"))
                || Objects.equals(subject.managerId(),s(target,"id")) || subject.id().equals(s(target,"managerId"));
    }
    public List<Map<String,Object>> handoverTargets(Actor subject,String query) {
        return creationCandidates(subject,query).stream().filter(row->canBeHandoverTarget(subject,row)).toList();
    }
    public void requireCapability(Actor a,String capability) {
        if(MANAGEMENT.contains(capability)) {requireAdmin(a);return;}
        if(!placed(a) || !a.can(capability)) throw new ApiException(403,"FORBIDDEN","当前账号无此操作权");
    }
    public void requireAdmin(Actor a) {if(!a.administrator()) throw new ApiException(403,"FORBIDDEN","需要独立管理员身份");}
    public boolean activeMember(Actor a,String id) {return activeUser(a,id)!=null;}
    public static boolean enabled(Map<String,Object> row) {return row!=null && enabledValue(row.get("active"));}
    private static boolean enabledValue(Object value) {return Boolean.TRUE.equals(value) || value instanceof Number n && n.intValue()==1;}
}
