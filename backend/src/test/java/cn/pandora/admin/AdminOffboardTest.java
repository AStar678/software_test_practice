package cn.pandora.admin;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import cn.pandora.common.Writes;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static cn.pandora.common.Db.s;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Independent offboarding builds a restricted plan through the complete-plan contract. */
class AdminOffboardTest {
    private static final String ORG="org-1";
    private static final String ADMIN="admin-1";
    private static final String FOUNDER="10000000-0000-0000-0000-000000000001";
    private static final String EMPLOYEE="10000000-0000-0000-0000-000000000002";
    private static final String HEAD="10000000-0000-0000-0000-000000000003";
    private static final String DEPT="20000000-0000-0000-0000-000000000001";
    private static final String POSITION="40000000-0000-0000-0000-000000000001";
    private static final Actor ACTOR=new Actor(ADMIN,ORG,"admin",null,null,0,null,null,
            Set.of("manage_organization","manage_accounts","manage_company_info","manage_notifications","view_task_history"),
            Map.of(),1L,false,false,1L);
    private static final String PERSON_SQL="SELECT u.id,u.org_version,(u.active AND p.active) AS active FROM users u "
            +"JOIN principals p ON p.organization_id=u.organization_id AND p.id=u.id AND p.account_type='employee' "
            +"WHERE u.organization_id=? AND u.id=? FOR UPDATE";

    private Db db;
    private Access access;
    private OrganizationPlans plans;
    private OrganizationService service;

    @BeforeEach
    void setUp() {
        db=mock(Db.class);
        access=mock(Access.class);
        plans=mock(OrganizationPlans.class);
        service=new OrganizationService(db,access,mock(Events.class),mock(OrganizationConstraints.class),
                mock(cn.pandora.auth.AuthService.class),plans,
                Clock.fixed(Instant.parse("2026-11-23T02:00:00Z"),ZoneOffset.UTC));
        when(db.one("SELECT founder_employee_id,authz_version FROM organizations WHERE id=?",ORG))
                .thenReturn(row("founderEmployeeId",FOUNDER,"authzVersion",9L));
    }

    private static Map<String,Object> row(Object...pairs) {
        var result=new LinkedHashMap<String,Object>();
        for(int i=0;i<pairs.length;i+=2) result.put((String)pairs[i],pairs[i+1]);
        return result;
    }

    private void stubPerson(String id,long orgVersion,boolean active,String placementType) {
        when(db.one(PERSON_SQL,ORG,id)).thenReturn(row("id",id,"orgVersion",orgVersion,"active",active));
        when(db.one("SELECT * FROM employee_placements WHERE organization_id=? AND employee_id=? FOR UPDATE",ORG,id))
                .thenReturn(placementType==null?null:row("placementType",placementType,"departmentId",DEPT,"teamId",null));
    }

    private void stubDraft() {
        var draft=new LinkedHashMap<String,Object>();
        draft.put("rowVersion",1L);
        draft.put("departments",List.of(row("id",DEPT,"name","研发部","rowVersion",1L)));
        draft.put("teams",List.of());
        draft.put("placements",new ArrayList<>(List.of(
                row("employeeId",FOUNDER,"placementType","founder","departmentId",null,"teamId",null,"positionId",POSITION,"rowVersion",1L),
                row("employeeId",HEAD,"placementType","department_head","departmentId",DEPT,"teamId",null,"positionId",POSITION,"rowVersion",2L),
                row("employeeId",EMPLOYEE,"placementType","employee","departmentId",DEPT,"teamId",null,"positionId",POSITION,"rowVersion",1L))));
        draft.put("expectedEmployees",List.of(
                row("id",FOUNDER,"rowVersion",1L),row("id",HEAD,"rowVersion",2L),row("id",EMPLOYEE,"rowVersion",1L)));
        when(plans.draft(ACTOR)).thenReturn(draft);
    }

    private Map<String,Object> offboardInput() {
        var input=new LinkedHashMap<String,Object>();
        input.put("reason","合同到期离职");
        return input;
    }

    @Test
    void unitHeadWithoutSuccessorIsRejected() {
        stubPerson(HEAD,2L,true,"department_head");
        stubDraft();
        ApiException error=assertThrows(ApiException.class,()->service.offboard(ACTOR,HEAD,offboardInput()));
        assertEquals("SUCCESSOR_REQUIRED",error.code);
        verify(plans,never()).save(any(),anyString(),anyMap());
    }

    @Test
    void founderCannotOffboard() {
        stubPerson(FOUNDER,1L,true,"founder");
        ApiException error=assertThrows(ApiException.class,()->service.offboard(ACTOR,FOUNDER,offboardInput()));
        assertEquals("FOUNDER_CANNOT_OFFBOARD",error.code);
    }

    @Test
    void inactiveEmployeeIsRejected() {
        stubPerson(EMPLOYEE,1L,false,"employee");
        assertTrue(assertThrows(ApiException.class,()->service.offboard(ACTOR,EMPLOYEE,offboardInput()))
                .getMessage().contains("已停用"));
    }

    @Test
    void normalEmployeeOffboardBuildsARestrictedPlan() {
        stubPerson(EMPLOYEE,1L,true,"employee");
        stubDraft();
        var input=offboardInput();
        input.put("cancelUnpublishedRequests",List.of(Map.of("requestId","r1","rowVersion",1L,"reason","随离职撤销")));
        input.put("businessTransfers",List.of());
        when(plans.save(eq(ACTOR),eq("\"9\""),anyMap())).thenReturn(
                new Writes.Outcome(Map.of("rowVersion",10L,"deactivatedEmployeeIds",List.of(EMPLOYEE)),Map.of()));
        var result=service.offboard(ACTOR,EMPLOYEE,input);
        assertEquals(EMPLOYEE,result.replayable().get("employeeId"));
        var capture=ArgumentCaptor.forClass(Map.class);
        verify(plans).save(eq(ACTOR),eq("\"9\""),capture.capture());
        @SuppressWarnings("unchecked")
        var plan=(Map<String,Object>)capture.getValue();
        assertEquals("合同到期离职",plan.get("reason"));
        @SuppressWarnings("unchecked")
        var deactivations=(List<Map<String,Object>>)plan.get("deactivateEmployees");
        assertEquals(1,deactivations.size());
        assertEquals(EMPLOYEE,s(deactivations.get(0),"employeeId"));
        assertEquals(1L,((Number)deactivations.get(0).get("rowVersion")).longValue());
        // The plan never carries unrelated person or unit edits: placements stay as read.
        @SuppressWarnings("unchecked")
        var placements=(List<Map<String,Object>>)plan.get("placements");
        assertEquals(3,placements.size());
        assertEquals("employee",s(placements.get(2),"placementType"));
    }

    @Test
    void headSuccessorTakesTheHeadSlotInsideThePlan() {
        stubPerson(HEAD,2L,true,"department_head");
        stubDraft();
        var input=offboardInput();
        input.put("successor",Map.of("employeeId",EMPLOYEE));
        when(access.activeUser(ACTOR,EMPLOYEE)).thenReturn(row("id",EMPLOYEE,"active",true));
        when(plans.save(eq(ACTOR),eq("\"9\""),anyMap())).thenReturn(
                new Writes.Outcome(Map.of("rowVersion",10L),Map.of()));
        service.offboard(ACTOR,HEAD,input);
        var capture=ArgumentCaptor.forClass(Map.class);
        verify(plans).save(eq(ACTOR),eq("\"9\""),capture.capture());
        @SuppressWarnings("unchecked")
        var plan=(Map<String,Object>)capture.getValue();
        @SuppressWarnings("unchecked")
        var placements=(List<Map<String,Object>>)plan.get("placements");
        var successorRow=placements.stream().filter(row->EMPLOYEE.equals(s(row,"employeeId"))).findFirst().orElseThrow();
        assertEquals("department_head",s(successorRow,"placementType"));
        assertEquals(DEPT,s(successorRow,"departmentId"));
        // The departing head's own placement row is untouched by the restricted plan.
        var headRow=placements.stream().filter(row->HEAD.equals(s(row,"employeeId"))).findFirst().orElseThrow();
        assertEquals("department_head",s(headRow,"placementType"));
    }

    @Test
    void successorMustBeAnActivePlacedEmployee() {
        stubPerson(HEAD,2L,true,"department_head");
        stubDraft();
        var input=offboardInput();
        input.put("successor",Map.of("employeeId",EMPLOYEE));
        when(access.activeUser(ACTOR,EMPLOYEE)).thenReturn(null);
        assertTrue(assertThrows(ApiException.class,()->service.offboard(ACTOR,HEAD,input))
                .getMessage().contains("在职员工"));
        input.put("successor",Map.of("employeeId",HEAD,"extraField","x"));
        assertTrue(assertThrows(ApiException.class,()->service.offboard(ACTOR,HEAD,input))
                .getMessage().contains("不支持"));
    }

    @Test
    void structuralConflictPointsToTheOrganizationAdjustmentPage() {
        stubPerson(EMPLOYEE,1L,true,"employee");
        stubDraft();
        when(plans.save(eq(ACTOR),eq("\"9\""),anyMap())).thenThrow(
                new ApiException(409,"INVALID_ORGANIZATION_PLAN","完整组织结果不合法",Map.of()));
        ApiException error=assertThrows(ApiException.class,()->service.offboard(ACTOR,EMPLOYEE,offboardInput()));
        assertEquals("ORGANIZATION_PLAN_REQUIRED",error.code);
        assertTrue(error.getMessage().contains("组织调整"));
    }
}
