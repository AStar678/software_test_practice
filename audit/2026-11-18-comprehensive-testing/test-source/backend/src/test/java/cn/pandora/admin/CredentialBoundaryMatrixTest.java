package cn.pandora.admin;

import cn.pandora.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.stream.Stream;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import static org.junit.jupiter.api.Assertions.*;

class CredentialBoundaryMatrixTest {
    static Stream<String> accepted() {
        return Stream.of("Abcdefghi1", "a".repeat(71) + "1", "a1" + "汉".repeat(23) + "a",
                "a1" + "😀".repeat(17) + "ab", "汉".repeat(9) + "1");
    }
    @ParameterizedTest @MethodSource("accepted")
    void exactCharacterAndUtf8LimitsAreAccepted(String password) {
        assertTrue(password.codePointCount(0, password.length()) >= 10);
        assertTrue(password.getBytes(StandardCharsets.UTF_8).length <= 72);
        assertDoesNotThrow(() -> Credentials.requirePolicy(password));
    }
    static Stream<String> rejected() {
        return Stream.of(null, "", "Abcdefgh1", "a".repeat(10), "1".repeat(10),
                "a".repeat(72) + "1", "a1" + "汉".repeat(23) + "ab", "a1" + "😀".repeat(7));
    }
    @ParameterizedTest @MethodSource("rejected")
    void invalidClassesAndFirstOutsideValuesAreRejected(String password) {
        ApiException e = assertThrows(ApiException.class, () -> Credentials.requirePolicy(password));
        assertEquals("INVALID_PASSWORD", e.code);
    }
    @RepeatedTest(3)
    void generatedPasswordsMeetPolicyAndAreUniqueWithinASample() {
        var seen = new HashSet<String>();
        for (int i = 0; i < 64; i++) {
            String password = Credentials.generate();
            assertEquals(16, password.length());
            assertDoesNotThrow(() -> Credentials.requirePolicy(password));
            assertTrue(seen.add(password), "generated credential repeated in a 64-item sample");
        }
    }
}
