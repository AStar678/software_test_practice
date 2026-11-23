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
}
