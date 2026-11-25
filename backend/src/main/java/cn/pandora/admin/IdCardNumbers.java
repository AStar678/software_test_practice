package cn.pandora.admin;

import cn.pandora.common.ApiException;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.Locale;

/**
 * Chinese mainland 18-digit resident identity number. Only the administrative surface may reach this
 * type: it validates the shape, the embedded birth date, the sequence code and the check digit, and
 * normalizes a trailing lower-case {@code x} to upper case. It never logs or returns the full value.
 */
final class IdCardNumbers {
    private static final int[] WEIGHTS = {7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2};
    private static final String CHECK_CODES = "10X98765432";
    private static final DateTimeFormatter BIRTH = DateTimeFormatter.ofPattern("uuuuMMdd").withResolverStyle(ResolverStyle.STRICT);

    private IdCardNumbers() {}

    /** Returns the canonical upper-case form or rejects the whole value with a Chinese explanation. */
    static String normalize(Object value, LocalDate today) {
        if (!(value instanceof String raw)) throw bad("身份证号必须为文字");
        String text = raw.strip();
        if (text.isEmpty()) throw bad("身份证号不能为空");
        if (text.length() != 18) throw bad("身份证号须为18位");
        String normalized = text.substring(0, 17) + text.substring(17).toUpperCase(Locale.ROOT);
        if (!normalized.matches("[0-9]{17}[0-9X]")) throw bad("身份证号前17位须为数字，末位须为数字或X");
        LocalDate birth;
        try {
            birth = LocalDate.parse(normalized.substring(6, 14), BIRTH);
        } catch (DateTimeParseException invalid) {
            throw bad("身份证号中的出生日期无效");
        }
        if (birth.isBefore(LocalDate.of(1900, 1, 1)) || birth.isAfter(today)) throw bad("身份证号中的出生日期无效");
        if ("000".equals(normalized.substring(14, 17))) throw bad("身份证号的顺序码无效");
        int sum = 0;
        for (int index = 0; index < 17; index++) sum += (normalized.charAt(index) - '0') * WEIGHTS[index];
        if (normalized.charAt(17) != CHECK_CODES.charAt(sum % 11)) throw bad("身份证号校验位不正确");
        return normalized;
    }

    /** List projection: keep the company/region prefix and the last four characters, hide the rest. */
    static String mask(String normalized) {
        return normalized.substring(0, 6) + "********" + normalized.substring(14);
    }

    private static ApiException bad(String message) {
        return new ApiException(400, "INVALID_INPUT", message);
    }
}
