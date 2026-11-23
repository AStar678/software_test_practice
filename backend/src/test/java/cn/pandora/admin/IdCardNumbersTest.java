package cn.pandora.admin;

import cn.pandora.common.ApiException;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class IdCardNumbersTest {
    private static final LocalDate TODAY=LocalDate.parse("2026-11-23");
    /** Valid GB 11643-1999 example number: birthdate 1949-12-31, check digit X. */
    private static final String VALID="11010519491231002X";

    private static String messageOf(Runnable call) {
        ApiException error=assertThrows(ApiException.class,call::run);
        return error.getMessage();
    }

    @Test
    void validNumberNormalizesAndKeepsUppercaseFinalX() {
        assertEquals(VALID,IdCardNumbers.normalize(VALID,"身份证号",TODAY));
        assertEquals(VALID,IdCardNumbers.normalize(" 11010519491231002x ","身份证号",TODAY));
    }

    @Test
    void rejectsWrongLengthAndNonDigits() {
        assertTrue(messageOf(()->IdCardNumbers.normalize("1101051949123100","身份证号",TODAY)).contains("18位"));
        assertTrue(messageOf(()->IdCardNumbers.normalize("11010519491ab1002X","身份证号",TODAY)).contains("前17位"));
        assertTrue(messageOf(()->IdCardNumbers.normalize("11010519491231002A","身份证号",TODAY)).contains("末位"));
        assertTrue(messageOf(()->IdCardNumbers.normalize(null,"身份证号",TODAY)).contains("必须为文字"));
        assertTrue(messageOf(()->IdCardNumbers.normalize("   ","身份证号",TODAY)).contains("不能为空"));
    }

    @Test
    void rejectsInvalidOrFutureBirthdate() {
        assertTrue(messageOf(()->IdCardNumbers.normalize("11010519491331002X","身份证号",TODAY)).contains("出生日期"));
        assertTrue(messageOf(()->IdCardNumbers.normalize("11010520991231002X","身份证号",TODAY)).contains("不得晚于今天"));
        assertTrue(messageOf(()->IdCardNumbers.normalize("11010518991231002X","身份证号",TODAY)).contains("出生年份"));
    }

    @Test
    void rejectsWrongChecksum() {
        assertTrue(messageOf(()->IdCardNumbers.normalize("110105194912310021","身份证号",TODAY)).contains("校验位"));
    }

    @Test
    void maskKeepsHeadAndTailOnly() {
        assertEquals("110***********002X",IdCardNumbers.mask(VALID));
        assertNull(IdCardNumbers.mask(null));
        assertNull(IdCardNumbers.mask("short"));
    }
}
