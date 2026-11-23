package cn.pandora.auth;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Chapter 2.1: one normalization rule is shared by authentication, writes and the migration precheck.
 * Formatting-equivalent spellings must map to the same key; anything else must be rejected rather
 * than guessed into a different number.
 */
class PhoneNumbersTest {
    @Test
    void formattingVariantsMapToTheSameLoginKey() {
        assertEquals("+8613800000004", PhoneNumbers.normalize("+86 138 0000 0004"));
        assertEquals("+8613800000004", PhoneNumbers.normalize("+86-138-0000-0004"));
        assertEquals("+8613800000004", PhoneNumbers.normalize("+86 (138) 0000.0004"));
        assertEquals("13800000004", PhoneNumbers.normalize(" 138 0000 0004 "));
        assertEquals("13800000004", PhoneNumbers.normalize("138-0000-0004"));
        assertEquals(PhoneNumbers.normalize("13800000004"), PhoneNumbers.normalize("138 0000 0004"));
    }

    @Test
    void invalidOrAmbiguousNumbersAreRejectedInsteadOfRewritten() {
        assertNull(PhoneNumbers.normalize(null));
        assertNull(PhoneNumbers.normalize(""));
        assertNull(PhoneNumbers.normalize("   "));
        assertNull(PhoneNumbers.normalize("13"));
        assertNull(PhoneNumbers.normalize("138000000041380000000413"));
        assertNull(PhoneNumbers.normalize("1380000O004"));
        assertNull(PhoneNumbers.normalize("++8613800000004"));
        assertNull(PhoneNumbers.normalize("+86+13800000004"));
        assertNull(PhoneNumbers.normalize("138-0000-0004 x"));
    }

    @Test
    void onlyAPhoneShapedValueIsTreatedAsAnEmployeeLoginKey() {
        assertTrue(PhoneNumbers.isPhone("138 0000 0004"));
        assertFalse(PhoneNumbers.isPhone("employee"));
        assertFalse(PhoneNumbers.isPhone("admin"));
        assertFalse(PhoneNumbers.isPhone(""));
    }
}
