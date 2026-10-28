package cn.pandora.auth;

import cn.pandora.admin.RoleCatalog;
import cn.pandora.common.Db;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Four levels, two departments and four teams; legacy grants/titles never influence decisions. */
class AccessTest {
    private static Map<String,Object> row(Object... fields) {
        var row=new LinkedHashMap<String,Object>();row.put("organizationId","org");
        for(int i=0;i<fields.length;i+=2) row.put((String)fields[i],fields[i+1]);return row;
    }
    static class Fixture {
        final Db db=mock(Db.class);
        final RoleCatalog roles=mock(RoleCatalog.class);
        final Access access=new Access(db);
        final Map<String,Map<String,Object>> people=new LinkedHashMap<>();
        final List<Map<String,Object>> deps=new ArrayList<>(),teams=new ArrayList<>(),places=new ArrayList<>();
        Fixture() {
            person("f","founder",null,null);
            for(String dep:List.of("a","b")) {
                deps.add(row("id",dep));person(dep,"department_head",dep,null);
                for(String suffix:List.of("1","2")) {
                    String team=dep+suffix;teams.add(row("id",team,"departmentId",dep));
                    person(team,"team_head",dep,team);person(team+"e","employee",dep,team);
                }
            }
            when(db.one("SELECT authz_version FROM organizations WHERE id=?","org")).thenReturn(Map.of("authzVersion",1L));
            when(db.find("SELECT founder_employee_id FROM organizations WHERE id=?","org")).thenReturn(Map.of("founderEmployeeId","f"));
            when(db.list(startsWith("SELECT u.id,u.organization_id,u.display_name,("),eq("org"))).thenAnswer(c->new ArrayList<>(people.values()));
            when(db.list("SELECT * FROM departments WHERE organization_id=? ORDER BY id","org")).thenReturn(deps);
            when(db.list("SELECT * FROM teams WHERE organization_id=? ORDER BY id","org")).thenReturn(teams);
            when(db.list("SELECT * FROM positions WHERE organization_id=? ORDER BY id","org")).thenReturn(List.of(row("id","title","name","Founder / admin")));
            when(db.list("SELECT * FROM employee_placements WHERE organization_id=? ORDER BY employee_id","org")).thenReturn(places);
            when(db.find(eq("SELECT * FROM users WHERE id=? AND organization_id=? AND active=1"),anyString(),eq("org")))
                    .thenAnswer(c->people.get(c.getArgument(1)));
        }
        void person(String id,String kind,String dep,String team) {
            people.put(id,row("id",id,"displayName",id,"active",true,"reviewerAvailable",true,"credentialVersion",1L,"accountType","employee",
                    "role","admin","rankLevel",0,"managerId","untrusted-legacy"));
            places.add(row("employeeId",id,"placementType",kind,"departmentId",dep,"teamId",team,"positionId","title"));
        }
        Actor actor(String id) {return access.actor(people.get(id));}
        Map<String,Object> task(String creator) {return row("id","task","originalCreatorId",creator,"currentVersionId","version");}
        boolean visible(String actor,String creator,String... owners) {return access.canSeeTask(actor(actor),task(creator),Map.of("id","version"),List.of(owners));}
    }
    @Test void tasksFollowCurrentOwnersAndPersonalRelationshipsAcrossDepartments() {
        var f=new Fixture();
        assertTrue(f.visible("f","b2e","b2e"));
        assertTrue(f.visible("a","b2e","a1e","b1e"));
        assertTrue(f.visible("b","a2e","a1e","b1e"));
        assertTrue(f.visible("a1","b2e","a1e"));
        assertFalse(f.visible("a1","b2e","a2e"));
        assertTrue(f.visible("a","a","b1e"));
        assertTrue(f.visible("a1","a1","b1e"));
        assertFalse(f.visible("a1e","a2e","a1"));
        assertFalse(f.visible("a1e","a1","a2e"));
        assertTrue(f.visible("a1e","a1e","b1e"));
        assertTrue(f.visible("a1e","b1e","a1e"));
    }
    @Test void formalTakeoverAddsAccessWithoutPretendingToBeOriginalCreator() {
        var f=new Fixture();
        when(f.db.find("SELECT employee_id FROM task_business_owners WHERE organization_id=? AND task_id=?","org","task"))
                .thenReturn(Map.of("employeeId","a1e"));
        assertTrue(f.visible("a1e","b1e","b2e"));
        assertEquals("b1e",f.task("b1e").get("originalCreatorId"));
    }
    @Test void unpublishedAndCrossCompanyObjectsNeverEnterNormalVisibility() {
        var f=new Fixture();var task=f.task("f");task.put("currentVersionId",null);
        assertFalse(f.access.canSeeTask(f.actor("f"),task,Map.of(),List.of("f")));
        task=f.task("f");task.put("organizationId","other");
        assertFalse(f.access.canSeeTask(f.actor("f"),task,Map.of(),List.of("f")));
    }
    @Test void logAndProfileRangesCoverAllRealDescendantsButNoPeers() {
        var f=new Fixture();
        for(String id:List.of("a1","a1e","a2","a2e")) {
            assertTrue(f.access.canReadLogAuthor(f.actor("a"),id));
            assertTrue(f.access.canSeePerson(f.actor("a"),f.people.get(id)));
            assertTrue(f.access.canReadPhone(f.actor("a"),f.people.get(id)));
        }
        assertTrue(f.access.canReadLogAuthor(f.actor("a1"),"a1e"));
        assertFalse(f.access.canReadLogAuthor(f.actor("a1"),"a2e"));
        assertFalse(f.access.canReadLogAuthor(f.actor("a"),"b1e"));
        assertFalse(f.access.canReadLogAuthor(f.actor("a1e"),"a1"));
        assertFalse(f.access.canSeePerson(f.actor("a1e"),f.people.get("a2e")));
        assertTrue(f.access.canReadPhone(f.actor("a1e"),f.people.get("a1e")));
        assertFalse(f.access.canReadPhone(f.actor("b"),f.people.get("a1e")));
    }
    @Test void companyCreationCandidatesNeverGrantTheirOtherObjects() {
        var f=new Fixture();Actor employee=f.actor("a1e");
        assertTrue(f.access.isCreationCandidate(employee,"b"));
        assertTrue(f.access.isCreationCandidate(employee,"f"));
        assertFalse(f.access.canSeePerson(employee,f.people.get("b")));
        assertFalse(f.visible("a1e","b1e","b"));
        assertFalse(f.access.isCreationCandidate(employee,"missing"));
    }
    @Test void directHandoverIsNarrowerThanAncestorReadAccessOrCompanyAssignment() {
        var f=new Fixture();
        assertTrue(f.access.canHandover(f.actor("a1"),"a1e",List.of("a1e")));
        assertTrue(f.access.canHandover(f.actor("a1e"),"a1e",List.of("a1e")));
        assertFalse(f.access.canHandover(f.actor("a"),"a1e",List.of("a1e")));
        var subject=f.actor("a1e");
        assertTrue(f.access.canBeHandoverTarget(subject,f.access.user(subject,"a2e")));
        assertFalse(f.access.canBeHandoverTarget(subject,f.access.user(subject,"b1e")));
        assertTrue(f.access.isCreationCandidate(subject,"b1e"));
        assertTrue(f.access.canBeHandoverTarget(f.actor("f"),f.access.user(subject,"b1e")));
    }
    @Test void administratorIsSeparateAndOldGrantsOrTitlesCannotPromoteEmployees() {
        var f=new Fixture();Actor admin=f.access.actor(row("id","admin","accountType","admin","credentialVersion",1L));
        assertNull(admin.departmentId());assertNull(admin.teamId());assertNull(admin.positionId());assertNull(admin.managerId());
        assertFalse(f.access.canSeeTask(admin,f.task("admin"),Map.of(),List.of("admin")));
        assertFalse(f.access.canReadLogAuthor(admin,"a1e"));
        assertFalse(f.access.canReadPhone(admin,f.people.get("a1e")));
        assertDoesNotThrow(()->f.access.requireAdmin(admin));
        var employee=f.actor("a1e");assertEquals("employee",employee.role());assertEquals(4,employee.rank());
        assertThrows(cn.pandora.common.ApiException.class,()->f.access.requireAdmin(employee));
        verifyNoInteractions(f.roles);
    }
    @Test void incompleteOrDisabledManagementNeverCreatesFounderOrRetainsOldScope() {
        var f=new Fixture();f.people.get("a").put("active",false);
        Actor actor=f.actor("a1");assertEquals("unplaced",actor.role());
        assertFalse(f.access.canSeeTask(actor,f.task("a1"),Map.of(),List.of("a1")));
        assertFalse(f.access.canReadPhone(actor,f.people.get("a1e")));
        assertFalse(f.access.isCreationCandidate(actor,"a1e"));
    }
}
