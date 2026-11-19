package cn.pandora.task;

import cn.pandora.admin.LoginKeyConstraints;
import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import cn.pandora.workspace.ExpiryService;
import cn.pandora.workspace.WorkLogSlots;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.util.TestPropertyValues;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Clock;
import java.util.*;
import java.util.function.Consumer;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class StartupMaintenanceTest {
    private static final String CANDIDATES="SELECT DISTINCT organization_id AS id FROM approval_requests WHERE "
            +TaskService.LEGACY_CREATION_ROUTES+" ORDER BY organization_id";
    @Test void sharedCloudDebugConfigurationDisablesEveryAutomaticMaintenanceWriter() {
        Db db=mock(Db.class);Access access=mock(Access.class);TaskService tasks=mock(TaskService.class);TransactionTemplate tx=mock(TransactionTemplate.class);
        try(var context=new AnnotationConfigApplicationContext()) {
            TestPropertyValues.of("pandora.startup-maintenance-enabled=false").applyTo(context);
            context.registerBean(Db.class,()->db);context.registerBean(Access.class,()->access);
            context.registerBean(TaskService.class,()->tasks);context.registerBean(TransactionTemplate.class,()->tx);
            context.register(LegacyCreationRoutes.class,WorkLogSlots.class,LoginKeyConstraints.class);context.refresh();
            clearInvocations(db,access,tasks,tx); // Bean lifecycle initialization is distinct from runner execution.
            var args=new DefaultApplicationArguments();
            context.getBean(LegacyCreationRoutes.class).run(args);context.getBean(WorkLogSlots.class).run(args);
            context.getBean(LoginKeyConstraints.class).run(args);
            // The bean remains available for the authenticated administrator's explicit repair endpoint.
            assertNotNull(context.getBean(LoginKeyConstraints.class));
            verifyNoInteractions(db,access,tasks,tx);
        }
    }
    @Test void ordinaryRestartWithNoLegacyCandidatesNeverOpensAWriteTransactionOrCompanyLock() {
        Db db=mock(Db.class);Access access=mock(Access.class);TaskService tasks=mock(TaskService.class);TransactionTemplate tx=mock(TransactionTemplate.class);
        when(db.list(CANDIDATES)).thenReturn(List.of());
        new LegacyCreationRoutes(db,access,tasks,tx).run(new DefaultApplicationArguments());
        verify(db).list(CANDIDATES);verifyNoMoreInteractions(db);verifyNoInteractions(tx,access,tasks);
    }
    @SuppressWarnings("unchecked")
    @Test void aLegacyCandidateKeepsTheCompanyLockAndUsesTheIndependentAdmin() {
        Db db=mock(Db.class);Access access=mock(Access.class);TaskService tasks=mock(TaskService.class);TransactionTemplate tx=mock(TransactionTemplate.class);
        when(db.list(CANDIDATES)).thenReturn(List.of(Map.of("id","org")));
        var administrator=Map.<String,Object>of("id","admin","organizationId","org","accountType","admin");
        when(db.find(startsWith("SELECT a.*,'admin' AS account_type"),eq("org"))).thenReturn(administrator);
        Actor actor=new Actor("admin","org","admin",null,null,0);when(access.actor(administrator)).thenReturn(actor);
        doAnswer(call->{((Consumer<TransactionStatus>)call.getArgument(0)).accept(mock(TransactionStatus.class));return null;})
                .when(tx).executeWithoutResult(any());
        new LegacyCreationRoutes(db,access,tasks,tx).run(new DefaultApplicationArguments());
        var order=inOrder(db,access,tasks);
        order.verify(db).list(CANDIDATES);order.verify(db).one("SELECT * FROM organizations WHERE id=? FOR UPDATE","org");
        order.verify(db).find(startsWith("SELECT a.*,'admin' AS account_type"),eq("org"));
        order.verify(access).actor(administrator);order.verify(tasks).refreshLegacyCreationRoutes(actor);
        verify(tasks,never()).refreshPendingRoutes(any());
    }
    @Test void startupRepairOnlyLocksLegacyCreationsWhileExplicitOrganizationRefreshStillCoversAllPending() {
        Db db=mock(Db.class);Access access=mock(Access.class);ExpiryService expiry=mock(ExpiryService.class);
        TaskService tasks=new TaskService(db,access,mock(Events.class),Clock.systemUTC(),expiry);
        Actor actor=new Actor("admin","org","admin",null,null,0);
        assertEquals(0,tasks.refreshLegacyCreationRoutes(actor));
        verify(db).list("SELECT * FROM approval_requests WHERE organization_id=? AND "+TaskService.LEGACY_CREATION_ROUTES+" ORDER BY created_at,id FOR UPDATE","org");
        verifyNoMoreInteractions(db);verifyNoInteractions(access,expiry);
        clearInvocations(db);assertEquals(0,tasks.refreshPendingRoutes(actor));
        verify(db).list("SELECT * FROM approval_requests WHERE organization_id=? AND status='pending' ORDER BY created_at,id FOR UPDATE","org");
        verifyNoMoreInteractions(db);
    }
}
