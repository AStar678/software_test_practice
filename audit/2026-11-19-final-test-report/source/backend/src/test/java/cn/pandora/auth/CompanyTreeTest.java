package cn.pandora.auth;

import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class CompanyTreeTest {
    private static Map<String,Object> row(Object... fields) {
        Map<String,Object> row=new LinkedHashMap<>();row.put("organizationId","org");
        for(int i=0;i<fields.length;i+=2) row.put((String)fields[i],fields[i+1]);return row;
    }
    private static List<Map<String,Object>> employees() {
        return new ArrayList<>(List.of(row("id","f","active",true),row("id","d","active",true),
                row("id","t","active",true),row("id","e","active",true)));
    }
    private static List<Map<String,Object>> placements() {
        return new ArrayList<>(List.of(place("f","founder",null,null),place("d","department_head","dep",null),
                place("t","team_head","dep","team"),place("e","employee","dep","team")));
    }
    private static Map<String,Object> place(String id,String type,String dep,String team) {
        return row("employeeId",id,"placementType",type,"departmentId",dep,"teamId",team,"positionId","title");
    }
    private static CompanyTree.Tree validate(List<Map<String,Object>> placements) {
        return CompanyTree.validate("org","f",employees(),List.of(row("id","dep")),
                List.of(row("id","team","departmentId","dep")),List.of(row("id","title","name","Any title")),placements);
    }
    @Test void positionsDeriveExactlyFourLevelsAndUniqueManagers() {
        var tree=validate(placements());assertTrue(tree.valid(),tree.blockers().toString());
        assertEquals("f",tree.founderId());assertNull(tree.nodes().get("f").get("managerId"));
        assertEquals("f",tree.nodes().get("d").get("managerId"));
        assertEquals("d",tree.nodes().get("t").get("managerId"));
        assertEquals("t",tree.nodes().get("e").get("managerId"));
        assertEquals(List.of(1,2,3,4),List.of("f","d","t","e").stream().map(id->tree.nodes().get(id).get("rankLevel")).toList());
    }
    @Test void creationWithOnlyFirstHeadsAndNoOrdinaryEmployeesIsLegal() {
        var people=employees();people.removeLast();var places=placements();places.removeLast();
        assertTrue(CompanyTree.validate("org","f",people,List.of(row("id","dep")),
                List.of(row("id","team","departmentId","dep")),List.of(row("id","title")),places).valid());
    }
    @Test void founderIsNeverInferredFromUnmanagedEmployeeOrLegacyRole() {
        var people=employees();people.getFirst().put("role","upper");people.getFirst().put("managerId",null);
        var tree=CompanyTree.validate("org",null,people,List.of(row("id","dep")),
                List.of(row("id","team","departmentId","dep")),List.of(row("id","title")),placements());
        assertFalse(tree.valid());assertNull(tree.founderId());
    }
    @Test void completeFinalPlanAllowsHeadSwapWithoutIntermediateVacancy() {
        var places=placements();places.set(2,place("t","employee","dep","team"));
        places.set(3,place("e","team_head","dep","team"));
        var tree=validate(places);assertTrue(tree.valid(),tree.blockers().toString());
        assertEquals("e",tree.nodes().get("t").get("managerId"));
    }
    @Test void missingDuplicateAndMalformedPlacementsFailDeterministically() {
        List<List<Map<String,Object>>> invalid=new ArrayList<>();
        var missing=placements();missing.remove(1);invalid.add(missing);
        var duplicate=placements();duplicate.add(place("e","team_head","dep","team"));invalid.add(duplicate);
        var doubleHead=placements();doubleHead.set(3,place("e","team_head","dep","team"));invalid.add(doubleHead);
        var noTeam=placements();noTeam.set(3,place("e","employee","dep",null));invalid.add(noTeam);
        var wrongDepartment=placements();wrongDepartment.set(3,place("e","employee","other","team"));invalid.add(wrongDepartment);
        var wrongCompany=placements();wrongCompany.get(3).put("organizationId","other");invalid.add(wrongCompany);
        var noPosition=placements();noPosition.get(3).remove("positionId");invalid.add(noPosition);
        var deputy=placements();deputy.get(1).put("placementType","deputy");invalid.add(deputy);
        for(var plan:invalid) {var tree=validate(plan);assertFalse(tree.valid());assertFalse(tree.blockers().isEmpty());assertNull(tree.founderId());}
    }
    @Test void inactiveManagersAndNestedOrDanglingUnitsFail() {
        var people=employees();people.get(1).put("active",false);
        var tree=CompanyTree.validate("org","f",people,List.of(row("id","dep","parentId","dep")),
                List.of(row("id","team","departmentId","missing","parentId","team")),List.of(row("id","title")),placements());
        assertFalse(tree.valid());assertTrue(tree.blockers().contains("NESTED_DEPARTMENT:dep"));
        assertTrue(tree.blockers().contains("NESTED_TEAM:team"));
        assertTrue(tree.blockers().contains("TEAM_DEPARTMENT_MISSING:team"));
    }
    @Test void titlesAndLegacyAuthorityCannotAlterDerivedIdentity() {
        var people=employees();people.get(3).put("role","admin");people.get(3).put("rankLevel",0);people.get(3).put("managerId","f");
        var tree=CompanyTree.validate("org","f",people,List.of(row("id","dep")),List.of(row("id","team","departmentId","dep")),
                List.of(row("id","title","name","Founder / Administrator")),placements());
        assertTrue(tree.valid());assertEquals("employee",tree.nodes().get("e").get("role"));
        assertEquals("t",tree.nodes().get("e").get("managerId"));
    }
}
