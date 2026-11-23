package cn.pandora.auth;

import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.boot.availability.ApplicationAvailability;
import org.springframework.boot.availability.ReadinessState;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class HealthReadinessTest {
    @Test void healthRefusesTrafficWhileStartupMaintenanceIsStillRunning() {
        var jdbc=mock(JdbcTemplate.class);var availability=mock(ApplicationAvailability.class);
        when(availability.getReadinessState()).thenReturn(ReadinessState.REFUSING_TRAFFIC);
        var controller=new AuthController(mock(AuthService.class),new Db(jdbc,new ObjectMapper()),availability);
        ApiException error=assertThrows(ApiException.class,controller::health);
        assertEquals(503,error.status);assertEquals("NOT_READY",error.code);verifyNoInteractions(jdbc);
    }
    @Test void healthKeepsItsSuccessfulContractAfterAllRunnersCompleteAndChecksTheDatabase() {
        var jdbc=mock(JdbcTemplate.class);var availability=mock(ApplicationAvailability.class);
        when(availability.getReadinessState()).thenReturn(ReadinessState.ACCEPTING_TRAFFIC);
        when(jdbc.queryForObject("SELECT 1",Integer.class)).thenReturn(1);
        var controller=new AuthController(mock(AuthService.class),new Db(jdbc,new ObjectMapper()),availability);
        assertEquals(Map.of("status","UP","application","pandora-backend","database","MySQL"),controller.health());
        verify(jdbc).queryForObject("SELECT 1",Integer.class);
    }
}
