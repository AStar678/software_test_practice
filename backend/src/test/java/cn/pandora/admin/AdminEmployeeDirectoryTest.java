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
import org.springframework.dao.DuplicateKeyException;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Employee list filters, masked/full identity projection and independent onboarding (Admin change). */
class AdminEmployeeDirectoryTest {
    private static final String ORG="org-1";
    private static final String ADMIN="admin-1";
    private static final String FOUNDER="10000000-0000-0000-0000-000000000001";
    private static final String EMPLOYEE="10000000-0000-0000-0000-000000000002";
    private static final String HEAD="10000000-0000-0000-0000-000000000003";
    private static final String DEPT="20000000-0000-0000-0000-000000000001";
    private static final String TEAM="30000000-0000-0000-0000-000000000001";
    private static final String POSITION="40000000-0000-0000-0000-000000000001";
    private static final Actor ACTOR=new Actor(ADMIN,ORG,"admin",null,null,0,null,null,
            Set.of("manage_organization","manage_accounts","manage_company_info","manage_notifications","view_task_history"),
            Map.of(),1L,false,false,1L);
    private static final Clock CLOCK=Clock.fixed(Instant.parse("2026-11-23T02:00:00Z"),ZoneOffset.UTC);

    private Db db;
    private Access access;
    private OrganizationService service;

    @BeforeEach
    void setUp() {
        db=mock(Db.class);
        access=mock(Access.class);
        when(db.one("SELECT time_zone FROM organizations WHERE id=?",ORG))
                .thenReturn(Map.of("timeZone","UTC"));
        service=new OrganizationService(db,access,mock(Events.class),mock(OrganizationConstraints.class),
                mock(cn.pandora.auth.AuthService.class),mock(OrganizationPlans.class),CLOCK);
    }

    private static Map<String,Object> row(Object...pairs) {
        var result=new LinkedHashMap<String,Object>();
        for(int i=0;i<pairs.length;i+=2) result.put((String)pairs[i],pairs[i+1]);
        return result;
    }

    private void stubDirectory() {
        when(access.employeeDirectory(ACTOR,true)).thenReturn(new ArrayList<>(List.of(
                row("id",FOUNDER,"displayName","创始人","active",true,"placementType","founder",
                        "departmentId",null,"teamId",null,"positionId",POSITION,"departmentName",null),
                row("id",HEAD,"displayName","王主管","active",true,"placementType","department_head",
                        "departmentId",DEPT,"teamId",null,"positionId",POSITION,"departmentName","研发部"),
                row("id",EMPLOYEE,"displayName","李员工","active",false,"placementType","employee",
                        "departmentId",DEPT,"teamId",TEAM,"positionId",POSITION,"departmentName","研发部"))));
        when(db.list("SELECT id,login_phone,hire_date FROM users WHERE organization_id=?",ORG)).thenReturn(List.of(
                row("id",FOUNDER,"loginPhone","13900000001","hireDate",null),
                row("id",HEAD,"loginPhone","13900000002","hireDate",null),
                row("id",EMPLOYEE,"loginPhone","13900000003","hireDate",null)));
        when(db.list("SELECT employee_id,id_card_no FROM employee_identity_documents WHERE organization_id=?",ORG))
                .thenReturn(List.of(row("employeeId",FOUNDER,"idCardNo","11010519491231002X")));
    }

    @Test
    void listWithoutFiltersReturnsEveryoneWithMaskedIdentity() {
        stubDirectory();
        var result=service.employees(ACTOR,Map.of());
        assertEquals(3,result.get("total"));
        @SuppressWarnings("unchecked")
        var items=(List<Map<String,Object>>)result.get("items");
        assertEquals("110***********002X",items.get(0).get("idCardNoMasked"));
        assertNull(items.get(1).get("idCardNoMasked"));
        // The list projection never carries the full number.
        items.forEach(item->assertFalse(item.containsKey("idCardNo")));
    }

    @Test
    void combinedFiltersCountFromTheSameConditionSet() {
        stubDirectory();
        var result=service.employees(ACTOR,Map.of("departmentId",DEPT,"active","true"));
        assertEquals(1,result.get("total"));
        @SuppressWarnings("unchecked")
        var items=(List<Map<String,Object>>)result.get("items");
        assertEquals(HEAD,s(items.get(0),"id"));
    }

    @Test
    void searchMatchesNameDepartmentAndLoginPhone() {
        stubDirectory();
        assertEquals(1,service.employees(ACTOR,Map.of("q","王")).get("total"));
        assertEquals(2,service.employees(ACTOR,Map.of("q","研发")).get("total"));
        assertEquals(1,service.employees(ACTOR,Map.of("q","13900000003")).get("total"));
        assertEquals(0,service.employees(ACTOR,Map.of("q","不存在")).get("total"));
    }

    @Test
    void placementAndTeamFiltersCompose() {
        stubDirectory();
        assertEquals(1,service.employees(ACTOR,Map.of("placementType","founder")).get("total"));
        assertEquals(1,service.employees(ACTOR,Map.of("teamId",TEAM)).get("total"));
        assertEquals(0,service.employees(ACTOR,Map.of("placementType","team_head")).get("total"));
    }

    @Test
    void invalidFilterValuesAreRejectedBeforeAnyQuery() {
        stubDirectory();
        assertTrue(assertThrows(ApiException.class,()->service.employees(ACTOR,Map.of("placementType","boss")))
                .getMessage().contains("组织身份"));
        assertTrue(assertThrows(ApiException.class,()->service.employees(ACTOR,Map.of("active","maybe")))
                .getMessage().contains("true或false"));
        assertThrows(ApiException.class,()->service.employees(ACTOR,Map.of("departmentId","not-a-uuid")));
    }

    @Test
    void detailReturnsTheFullIdentityNumberOnlyForAdministrators() {
        stubDirectory();
        when(access.employeeDirectory(ACTOR,true)).thenReturn(new ArrayList<>(List.of(
                row("id",EMPLOYEE,"displayName","李员工","active",true,"placementType","employee"))));
        when(db.find("SELECT login_phone,hire_date FROM users WHERE organization_id=? AND id=?",ORG,EMPLOYEE))
                .thenReturn(row("loginPhone","13900000003","hireDate",null));
        when(db.find("SELECT id_card_no FROM employee_identity_documents WHERE organization_id=? AND employee_id=?",ORG,EMPLOYEE))
                .thenReturn(row("idCardNo","11010519491231002X"));
        var detail=service.employee(ACTOR,EMPLOYEE);
        assertEquals("11010519491231002X",detail.get("idCardNo"));
        // An old employee without a document row stays an explicit null.
        when(db.find("SELECT id_card_no FROM employee_identity_documents WHERE organization_id=? AND employee_id=?",ORG,EMPLOYEE))
                .thenReturn(null);
        assertNull(service.employee(ACTOR,EMPLOYEE).get("idCardNo"));
    }

    private OrganizationPlans plans;
    private Map<String,Object> draft() {
        plans=(OrganizationPlans)mock(OrganizationPlans.class);
        service=new OrganizationService(db,access,mock(Events.class),mock(OrganizationConstraints.class),
                mock(cn.pandora.auth.AuthService.class),plans,CLOCK);
        var draft=new LinkedHashMap<String,Object>();
        draft.put("rowVersion",1L);
        draft.put("departments",List.of(row("id",DEPT,"name","研发部","rowVersion",1L)));
        draft.put("teams",List.of(row("id",TEAM,"name","平台组","departmentId",DEPT,"rowVersion",1L)));
        draft.put("placements",new ArrayList<>(List.of(
                row("employeeId",FOUNDER,"placementType","founder","departmentId",null,"teamId",null,"positionId",POSITION,"rowVersion",1L),
                row("employeeId",EMPLOYEE,"placementType","employee","departmentId",DEPT,"teamId",TEAM,"positionId",POSITION,"rowVersion",1L))));
        draft.put("expectedEmployees",List.of(row("id",FOUNDER,"rowVersion",1L),row("id",EMPLOYEE,"rowVersion",1L)));
        return draft;
    }

    private Map<String,Object> onboardingInput() {
        var input=new LinkedHashMap<String,Object>();
        input.put("displayName","新员工");
        input.put("phone","13900000009");
        input.put("idCardNo","11010519491231002X");
        input.put("placementType","employee");
        input.put("departmentId",DEPT);
        input.put("teamId",TEAM);
        input.put("positionId",POSITION);
        input.put("hireDate","2026-11-01");
        return input;
    }

    @Test
    void onboardingRequiresAValidIdentityNumber() {
        var draft=draft();
        when(plans.draft(ACTOR)).thenReturn(draft);
        var missing=onboardingInput();missing.remove("idCardNo");
        assertTrue(assertThrows(ApiException.class,()->service.createEmployee(ACTOR,missing))
                .getMessage().contains("身份证号"));
        var invalid=onboardingInput();invalid.put("idCardNo","110105194912310021");
        assertTrue(assertThrows(ApiException.class,()->service.createEmployee(ACTOR,invalid))
                .getMessage().contains("校验位"));
        // Nothing reached the plan when validation failed.
        verify(plans,never()).save(any(),anyString(),anyMap());
    }

    @Test
    void onboardingWritesTheIdentityDocumentInsideTheSameCommand() {
        var draft=draft();
        when(plans.draft(ACTOR)).thenReturn(draft);
        when(plans.save(eq(ACTOR),eq("\"1\""),anyMap())).thenAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            var plan=(Map<String,Object>)invocation.getArgument(2);
            @SuppressWarnings("unchecked")
            var additions=(List<Map<String,Object>>)plan.get("newEmployees");
            String createdId=(String)additions.get(0).get("id");
            return new Writes.Outcome(Map.of("rowVersion",2L),Map.of("initialPasswords",Map.of(createdId,"pw123456")));
        });
        var result=service.createEmployee(ACTOR,onboardingInput());
        assertEquals("pw123456",result.oneTimeOnly().get("initialPassword"));
        verify(db).update(eq("INSERT INTO employee_identity_documents(organization_id,employee_id,id_card_no) VALUES(?,?,?)"),
                eq(ORG),anyString(),eq("11010519491231002X"));
    }

    @Test
    void structuralConflictPointsToTheOrganizationAdjustmentPage() {
        var draft=draft();
        when(plans.draft(ACTOR)).thenReturn(draft);
        when(plans.save(eq(ACTOR),eq("\"1\""),anyMap())).thenThrow(
                new ApiException(409,"INVALID_ORGANIZATION_PLAN","完整组织结果不合法",Map.of("blockers",List.of())));
        ApiException error=assertThrows(ApiException.class,()->service.createEmployee(ACTOR,onboardingInput()));
        assertEquals("ORGANIZATION_PLAN_REQUIRED",error.code);
        assertTrue(error.getMessage().contains("组织调整"));
        verify(db,never()).update(contains("employee_identity_documents"),any(),any(),any());
    }

    @Test
    void duplicateIdentityNumberIsRejectedAsTaken() {
        var draft=draft();
        when(plans.draft(ACTOR)).thenReturn(draft);
        when(plans.save(eq(ACTOR),eq("\"1\""),anyMap())).thenReturn(
                new Writes.Outcome(Map.of("rowVersion",2L),Map.of("initialPasswords",Map.of("new-id","pw123456"))));
        when(db.update(eq("INSERT INTO employee_identity_documents(organization_id,employee_id,id_card_no) VALUES(?,?,?)"),
                any(),any(),any())).thenThrow(new DuplicateKeyException("dup"));
        ApiException error=assertThrows(ApiException.class,()->service.createEmployee(ACTOR,onboardingInput()));
        assertEquals("ID_CARD_TAKEN",error.code);
    }

    @Test
    void editingCanRecordOrCorrectTheIdentityNumberWithVersionCheck() {
        var draft=draft();
        when(plans.draft(ACTOR)).thenReturn(draft);
        when(db.one("SELECT u.* FROM users u JOIN principals p ON p.organization_id=u.organization_id AND p.id=u.id "
                + "WHERE u.organization_id=? AND u.id=? AND p.account_type='employee' FOR UPDATE",ORG,EMPLOYEE))
                .thenReturn(row("id",EMPLOYEE,"orgVersion",3L,"displayName","李员工",
                        "phone","13900000003","loginPhone","13900000003","hireDate",null));
        when(db.find("SELECT 1 FROM employee_identity_documents WHERE organization_id=? AND employee_id=?",ORG,EMPLOYEE)).thenReturn(null);
        var result=service.updateEmployee(ACTOR,EMPLOYEE,"\"3\"",Map.of("idCardNo","11010519491231002X"));
        assertEquals(Boolean.TRUE,result.get("idCardUpdated"));
        verify(db).update(eq("INSERT INTO employee_identity_documents(organization_id,employee_id,id_card_no) VALUES(?,?,?)"),eq(ORG),eq(EMPLOYEE),eq("11010519491231002X"));
        // A second correction updates the existing row and advances its row version.
        when(db.find("SELECT 1 FROM employee_identity_documents WHERE organization_id=? AND employee_id=?",ORG,EMPLOYEE))
                .thenReturn(row("employeeId",EMPLOYEE));
        service.updateEmployee(ACTOR,EMPLOYEE,"\"3\"",Map.of("idCardNo","11010519491231002X"));
        verify(db).update(contains("UPDATE employee_identity_documents SET id_card_no=?"),eq("11010519491231002X"),eq(ORG),eq(EMPLOYEE));
        // An invalid number is rejected before any write.
        assertTrue(assertThrows(ApiException.class,
                ()->service.updateEmployee(ACTOR,EMPLOYEE,"\"3\"",Map.of("idCardNo","bad"))).getMessage().contains("18位"));
    }

    private static <T> T s(Map<String,Object> row,String key) { return (T)cn.pandora.common.Db.s(row,key); }
}
