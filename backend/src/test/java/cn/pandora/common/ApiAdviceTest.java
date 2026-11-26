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
    void administratorFailuresKeepTheirCategoryWithoutTechnicalDetail() {
        ApiAdvice advice = new ApiAdvice();
        var organization = advice.api(new ApiException(409, "INVALID_ORGANIZATION_PLAN",
                "完整组织结果不合法", Map.of("blockers", java.util.List.of("DUPLICATE_TEAM_HEAD:unit"))));
        assertEquals(409, organization.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) organization.getBody();
        assertEquals("INVALID_ORGANIZATION_PLAN", body.get("code"));
        assertEquals("完整组织结果不合法", body.get("message"));
        assertTrue(body.containsKey("blockers"));

        var version = advice.api(new ApiException(412, "VERSION_CONFLICT", "内容已更新，请刷新后重试"));
        assertEquals(412, version.getStatusCode().value());
        var permission = advice.api(new ApiException(403, "FORBIDDEN", "需要独立管理员身份"));
        assertEquals(403, permission.getStatusCode().value());
        var validation = advice.invalid(new IllegalArgumentException("startDate must be ISO"));
        assertEquals(400, validation.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> validationBody = (Map<String, Object>) validation.getBody();
        assertFalse(String.valueOf(validationBody.get("message")).contains("startDate"));
        assertEquals("请求格式或参数不正确", validationBody.get("message"));
        var conflict = advice.constraint(new org.springframework.dao.DataIntegrityViolationException("erp.id_card_no unique"));
        assertEquals(409, conflict.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> conflictBody = (Map<String, Object>) conflict.getBody();
        assertEquals("数据关系或唯一约束冲突，请刷新后重试", conflictBody.get("message"));
        assertFalse(String.valueOf(conflictBody.get("message")).contains("id_card_no"));
    }
}
