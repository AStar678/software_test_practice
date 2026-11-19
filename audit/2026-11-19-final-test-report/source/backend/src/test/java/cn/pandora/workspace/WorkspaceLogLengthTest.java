package cn.pandora.workspace;

import cn.pandora.common.ApiException;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class WorkspaceLogLengthTest {
    @Test
    void logBodyLimitUsesUtf16CodeUnitsAndTrimsFirst() {
        // A supplementary-plane character occupies two UTF-16 code units in the existing contract.
        assertEquals("😀", WorkspaceService.required(Map.of("body", "  😀  "), "body", 2));
        assertDoesNotThrow(() -> WorkspaceService.required(Map.of("body", "😀".repeat(5000)), "body", 10000));
        assertThrows(ApiException.class, () -> WorkspaceService.required(Map.of("body", "😀".repeat(5001)), "body", 10000));
        assertDoesNotThrow(() -> WorkspaceService.required(Map.of("body", "边".repeat(10000)), "body", 10000));
        assertThrows(ApiException.class, () -> WorkspaceService.required(Map.of("body", "边".repeat(10001)), "body", 10000));
    }
}
