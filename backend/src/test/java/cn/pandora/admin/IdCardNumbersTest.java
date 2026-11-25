package cn.pandora.admin;

import cn.pandora.common.ApiException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

/** Identity-number format, birth date, sequence code, check digit, normalization and masking. */
class IdCardNumbersTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 25);

    @Test
    void acceptsAValidNumberAndNormalizesTheTrailingLetter() {
        assertEquals("11010519491231002X", IdCardNumbers.normalize("11010519491231002X", TODAY));
        assertEquals("11010519491231002X", IdCardNumbers.normalize(" 11010519491231002x ", TODAY));
        assertEquals("110101199003076632", IdCardNumbers.normalize("110101199003076632", TODAY));
    }

    @Test
    void masksTheMiddleBirthAndSequenceDigits() {
        assertEquals("110105********002X", IdCardNumbers.mask("11010519491231002X"));
        assertEquals("440301********1239", IdCardNumbers.mask("440301198808081239"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "",                    // empty
            "11010519491231002",   // 17 characters
            "11010519491231002XX", // 19 characters
            "1101051949123100AX",  // non-digit among the first 17
            "110105194912310021",  // wrong check digit
            "110101199003070003",  // sequence code 000
            "11010119900231001X",  // 31 February
            "110101299901010019"   // future birth date
    })
    void rejectsMalformedOrImpossibleNumbers(String value) {
        ApiException error = assertThrows(ApiException.class, () -> IdCardNumbers.normalize(value, TODAY));
        assertEquals(400, error.status);
        assertEquals("INVALID_INPUT", error.code);
        assertTrue(error.getMessage().contains("身份证号"), error.getMessage());
    }

    @Test
    void rejectsANonTextValueWithoutExposingIt() {
        ApiException error = assertThrows(ApiException.class, () -> IdCardNumbers.normalize(123456789012345678L, TODAY));
        assertEquals("身份证号必须为文字", error.getMessage());
    }
}
