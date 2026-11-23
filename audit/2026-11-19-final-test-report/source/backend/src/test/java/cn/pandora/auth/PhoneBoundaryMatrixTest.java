package cn.pandora.auth;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import static org.junit.jupiter.api.Assertions.*;

class PhoneBoundaryMatrixTest {
    @ParameterizedTest
    @CsvSource({"001,001", "12345678901234567890,12345678901234567890", "+123,+123",
            "+86 (138) 0000.0004,+8613800000004", "' 001 ',001"})
    void normalFormattedAndExactBoundsShareOneLoginKey(String input, String expected) {
        assertEquals(expected, PhoneNumbers.normalize(input));
        assertTrue(PhoneNumbers.isPhone(input));
    }
    @ParameterizedTest @NullAndEmptySource
    @ValueSource(strings = {"12", "123456789012345678901", "+12", "１２３", "١٢٣", "123e4", "++123", "12\n3", "---", "admin"})
    void outsideLengthsUnicodeDigitsAndInjectedContentAreRejected(String input) {
        assertNull(PhoneNumbers.normalize(input));
        assertFalse(PhoneNumbers.isPhone(input));
    }
}
