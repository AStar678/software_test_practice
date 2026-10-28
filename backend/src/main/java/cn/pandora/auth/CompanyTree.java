package cn.pandora.auth;

import cn.pandora.common.Db;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import static cn.pandora.common.Db.*;

/** Fixed four-level organization. Titles, legacy manager fields and roles are never authority. */
@Component
public class CompanyTree {
    private final Db db;
    public CompanyTree(Db db) { this.db=db; }

    public record Tree(Map<String,Map<String,Object>> nodes,List<String> roots,
                       Set<String> dangling,Set<String> cyclic,String founderId,boolean valid,
                       List<String> blockers) {}

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Tree of(String organizationId) {
        var company=db.find("SELECT founder_employee_id FROM organizations WHERE id=?",organizationId);
        return validate(organizationId,company==null?null:s(company,"founderEmployeeId"),
                db.list("SELECT u.id,u.organization_id,u.display_name,(u.active AND p.active) AS active,u.reviewer_available,u.must_change_password,u.credential_version "
                        + "FROM users u JOIN principals p ON p.organization_id=u.organization_id AND p.id=u.id "
                        + "WHERE u.organization_id=? AND p.account_type='employee' ORDER BY u.id",organizationId),
                db.list("SELECT * FROM departments WHERE organization_id=? ORDER BY id",organizationId),
                db.list("SELECT * FROM teams WHERE organization_id=? ORDER BY id",organizationId),
                db.list("SELECT * FROM positions WHERE organization_id=? ORDER BY id",organizationId),
                db.list("SELECT * FROM employee_placements WHERE organization_id=? ORDER BY employee_id",organizationId));
    }

    /** Validates a complete final result in memory, including newly-created units and head swaps. */
    public static Tree validate(String organizationId,String founderId,List<Map<String,Object>> employees,
                                List<Map<String,Object>> departments,List<Map<String,Object>> teams,
                                List<Map<String,Object>> positions,List<Map<String,Object>> placements) {
        List<String> blockers=new ArrayList<>();
        Map<String,Map<String,Object>> people=index(organizationId,employees,"id","employee",blockers);
        Map<String,Map<String,Object>> deps=index(organizationId,departments,"id","department",blockers);
        Map<String,Map<String,Object>> groups=index(organizationId,teams,"id","team",blockers);
        Map<String,Map<String,Object>> titles=index(organizationId,positions,"id","position",blockers);
        Map<String,Map<String,Object>> places=index(organizationId,placements,"employeeId","placement",blockers);
        Map<String,String> departmentHeads=new HashMap<>(),teamHeads=new HashMap<>();
        List<String> founders=new ArrayList<>();
        Set<String> dangling=new LinkedHashSet<>();
        for(var entry:deps.entrySet())
            if(s(entry.getValue(),"parentId")!=null) blockers.add("NESTED_DEPARTMENT:"+entry.getKey());
        for(var entry:groups.entrySet()) {
            if(s(entry.getValue(),"parentId")!=null) blockers.add("NESTED_TEAM:"+entry.getKey());
            if(!deps.containsKey(s(entry.getValue(),"departmentId"))) blockers.add("TEAM_DEPARTMENT_MISSING:"+entry.getKey());
        }
        for(var entry:places.entrySet()) {
            String employeeId=entry.getKey();var placement=entry.getValue();
            var employee=people.get(employeeId);
            if(employee==null || !active(employee)) {blockers.add("PLACEMENT_EMPLOYEE_INACTIVE_OR_MISSING:"+employeeId);continue;}
            String type=s(placement,"placementType"),dep=s(placement,"departmentId"),team=s(placement,"teamId");
            if(!titles.containsKey(s(placement,"positionId"))) blockers.add("POSITION_REQUIRED:"+employeeId);
            if(dep!=null && !deps.containsKey(dep)) blockers.add("PLACEMENT_DEPARTMENT_MISSING:"+employeeId);
            if(team!=null && (!groups.containsKey(team) || !Objects.equals(dep,s(groups.get(team),"departmentId"))))
                blockers.add("TEAM_DEPARTMENT_MISMATCH:"+employeeId);
            if("founder".equals(type)) {
                founders.add(employeeId);
                if(dep!=null || team!=null) blockers.add("FOUNDER_COMPANY_ONLY:"+employeeId);
            } else if("department_head".equals(type)) {
                if(dep==null || team!=null) blockers.add("DEPARTMENT_HEAD_SHAPE:"+employeeId);
                if(dep!=null && departmentHeads.putIfAbsent(dep,employeeId)!=null) blockers.add("DUPLICATE_DEPARTMENT_HEAD:"+dep);
            } else if("team_head".equals(type) || "employee".equals(type)) {
                if(dep==null || team==null) blockers.add("TEAM_REQUIRED:"+employeeId);
                if("team_head".equals(type) && team!=null && teamHeads.putIfAbsent(team,employeeId)!=null) blockers.add("DUPLICATE_TEAM_HEAD:"+team);
            } else blockers.add("INVALID_PLACEMENT_TYPE:"+employeeId);
        }
        if(founderId==null || founders.size()!=1 || !founders.contains(founderId)) blockers.add("FIXED_FOUNDER_REQUIRED");
        for(String dep:deps.keySet()) if(!departmentHeads.containsKey(dep)) blockers.add("DEPARTMENT_HEAD_REQUIRED:"+dep);
        for(String team:groups.keySet()) if(!teamHeads.containsKey(team)) blockers.add("TEAM_HEAD_REQUIRED:"+team);
        Map<String,Map<String,Object>> nodes=new LinkedHashMap<>();
        for(var entry:people.entrySet()) {
            String employeeId=entry.getKey();if(!active(entry.getValue())) continue;
            var placement=places.get(employeeId);
            if(placement==null) {blockers.add("PLACEMENT_REQUIRED:"+employeeId);dangling.add(employeeId);continue;}
            String type=s(placement,"placementType"),dep=s(placement,"departmentId"),team=s(placement,"teamId");
            String manager=switch(Objects.toString(type,"")) {
                case "founder" -> null;
                case "department_head" -> founderId;
                case "team_head" -> departmentHeads.get(dep);
                case "employee" -> teamHeads.get(team);
                default -> null;
            };
            int rank=switch(Objects.toString(type,"")) {
                case "founder" -> 1;case "department_head" -> 2;case "team_head" -> 3;case "employee" -> 4;default -> 0;
            };
            if(!"founder".equals(type) && (manager==null || manager.equals(employeeId) || !people.containsKey(manager)
                    || !active(people.get(manager)))) {dangling.add(employeeId);blockers.add("MANAGER_REQUIRED:"+employeeId);}
            Map<String,Object> node=new LinkedHashMap<>(entry.getValue());
            node.put("departmentId",dep);node.put("teamId",team);node.put("positionId",s(placement,"positionId"));
            node.put("placementType",type);node.put("role",type);node.put("rankLevel",rank);node.put("managerId",manager);
            node.put("accountType","employee");nodes.put(employeeId,Collections.unmodifiableMap(node));
        }
        // Four legal kinds derive all edges. Still detect malformed cycles before granting authority.
        Set<String> cyclic=new LinkedHashSet<>();
        for(String id:nodes.keySet()) {
            Set<String> visited=new LinkedHashSet<>();String cursor=id;
            while(cursor!=null && nodes.containsKey(cursor)) {
                if(!visited.add(cursor)) {cyclic.addAll(visited);break;}
                cursor=s(nodes.get(cursor),"managerId");
            }
        }
        if(!cyclic.isEmpty()) blockers.add("MANAGEMENT_CYCLE");
        return new Tree(Collections.unmodifiableMap(nodes),List.copyOf(founders),Set.copyOf(dangling),Set.copyOf(cyclic),
                blockers.isEmpty()?founderId:null,blockers.isEmpty(),List.copyOf(blockers));
    }

    private static Map<String,Map<String,Object>> index(String organizationId,List<Map<String,Object>> rows,
                                                       String key,String kind,List<String> blockers) {
        Map<String,Map<String,Object>> result=new LinkedHashMap<>();
        for(var row:rows) {
            String id=s(row,key);
            if(id==null || !organizationId.equals(s(row,"organizationId"))) {blockers.add("INVALID_COMPANY_REFERENCE:"+kind+":"+id);continue;}
            if(result.putIfAbsent(id,row)!=null) blockers.add("DUPLICATE_ID:"+kind+":"+id);
        }
        return result;
    }
    public String founderId(String organizationId) {return of(organizationId).founderId();}
    public boolean isFounder(Actor actor) {return actor.business() && actor.id().equals(founderId(actor.organizationId()));}
    private static boolean active(Map<String,Object> row) {
        Object value=row.get("active");return Boolean.TRUE.equals(value) || value instanceof Number number && number.intValue()==1;
    }
}
