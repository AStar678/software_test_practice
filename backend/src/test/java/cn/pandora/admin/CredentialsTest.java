package cn.pandora.admin;

import cn.pandora.common.ApiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

/** Password policy for generated initial passwords and user-chosen changes (DEV-003). */
class CredentialsTest {

    @Test
    void generatedPasswordsSatisfyThePolicyAndDoNotRepeat() {
        String first = Credentials.generate();
        String second = Credentials.generate();
        assertNotEquals(first, second, "a generated password must not be predictable across accounts");
        for (String password : new String[]{first, second}) {
            assertTrue(password.codePointCount(0, password.length()) >= 10, "at least ten characters");
            assertTrue(password.getBytes(StandardCharsets.UTF_8).length <= 72, "at most 72 UTF-8 bytes");
            assertTrue(password.chars().anyMatch(Character::isLetter), "contains a letter");
            assertTrue(password.chars().anyMatch(Character::isDigit), "contains a digit");
            assertDoesNotThrow(() -> Credentials.requirePolicy(password));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "short1",              // fewer than ten characters
        "abcdefghijkl",        // letters only
        "1234567890123",       // digits only
        "Abcdefg1"             // eight characters
    })
    void policyRejectsTheStatedViolations(String password) {
        ApiException error = assertThrows(ApiException.class, () -> Credentials.requirePolicy(password));
        assertEquals("INVALID_PASSWORD", error.code);
    }

    @Test
    void policyAcceptsTheShortestAllowedPassword() {
        assertDoesNotThrow(() -> Credentials.requirePolicy("Abcdefghi1"));
    }

    @Test
    void policyRejectsPasswordsBeyondTheBcryptByteBoundary() {
        // 71 ASCII characters plus a three-byte character exceeds 72 UTF-8 bytes while staying short.
        String tooLong = "Abcdefghij1" + "汉".repeat(22);
        assertTrue(tooLong.getBytes(StandardCharsets.UTF_8).length > 72);
        ApiException error = assertThrows(ApiException.class, () -> Credentials.requirePolicy(tooLong));
        assertEquals("INVALID_PASSWORD", error.code);
        assertTrue(error.getMessage().contains("72"), "the message must name the byte boundary");
    }

    @Test
    void policyAcceptsAMultiBytePasswordWithinTheBoundary() {
        String acceptable = "Abcdefghij1汉";
        assertTrue(acceptable.getBytes(StandardCharsets.UTF_8).length <= 72);
        assertDoesNotThrow(() -> Credentials.requirePolicy(acceptable));
    }
}
