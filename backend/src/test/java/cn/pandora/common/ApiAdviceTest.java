package cn.pandora.common;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ApiAdviceTest {
    @Test
    void unexpectedExceptionReturnsAStableChineseBodyWithoutTechnicalDetail() {
        var response = new ApiAdvice().unexpected(new IllegalStateException(
                "SQL failed for startDate at jdbc:mysql://127.0.0.1:3306/pandora"));

        assertEquals(500, response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals("INTERNAL_ERROR", body.get("code"));
        assertEquals("服务暂时不可用，请稍后重试", body.get("message"));
        assertFalse(String.valueOf(body.get("message")).contains("SQL"));
        assertFalse(String.valueOf(body.get("message")).contains("startDate"));
    }

    @Test
    void unknownRouteIsANotFoundNotAnInternalError() {
        var response = new ApiAdvice().missing(new RuntimeException("no handler"));
        assertEquals(404, response.getStatusCode().value());
    }

    @Test
    void adminFacingConstraintAndLockFailuresUseStableChineseMessages() {
        var advice = new ApiAdvice();

        var constraint = advice.constraint(new org.springframework.dao.DataIntegrityViolationException(
                "Duplicate entry 'org-1-11010519491231002X' for key 'uq_id_card_company'"));
        assertEquals(409, constraint.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) constraint.getBody();
        assertEquals("DATA_CONFLICT", body.get("code"));
        assertFalse(String.valueOf(body.get("message")).contains("uq_id_card_company"));

        var busy = advice.busy(new org.springframework.dao.CannotAcquireLockException("lock wait timeout"));
        assertEquals(409, busy.getStatusCode().value());
        assertTrue(String.valueOf(((Map<?, ?>) busy.getBody()).get("message")).contains("稍后重试"));

        var invalid = advice.invalid(new IllegalArgumentException("idCardNo must be..."));
        assertEquals(400, invalid.getStatusCode().value());
        assertFalse(String.valueOf(((Map<?, ?>) invalid.getBody()).get("message")).contains("idCardNo"));
    }
}
