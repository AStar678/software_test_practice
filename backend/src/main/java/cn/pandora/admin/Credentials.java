package cn.pandora.admin;

import cn.pandora.common.ApiException;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

/**
 * Initial-password generation and the password policy (DEV-003).
 *
 * Policy: at least 10 characters, containing both letters and digits, and at most 72 UTF-8 bytes
 * because BCrypt silently ignores anything past that boundary. The generated value is returned to
 * the caller exactly once and only its hash is stored.
 */
public final class Credentials {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    private static final String DIGITS = "23456789";
    private static final String SYMBOLS = "!@#$%^&*-_=+?";
    private static final String ALL = LETTERS + DIGITS + SYMBOLS;

    private Credentials() {}

    public static String generate() {
        StringBuilder value = new StringBuilder(16);
        value.append(LETTERS.charAt(RANDOM.nextInt(LETTERS.length())));
        value.append(DIGITS.charAt(RANDOM.nextInt(DIGITS.length())));
        for (int i = 0; i < 14; i++) value.append(ALL.charAt(RANDOM.nextInt(ALL.length())));
        // Fisher-Yates so the guaranteed letter/digit are not always in the first two positions.
        for (int i = value.length() - 1; i > 0; i--) {
            int j = RANDOM.nextInt(i + 1);
            char swap = value.charAt(i);
            value.setCharAt(i, value.charAt(j));
            value.setCharAt(j, swap);
        }
        return value.toString();
    }

    /** Policy check shared by first-login change and everyday change. */
    public static void requirePolicy(String password) {
        if (password == null || password.codePointCount(0, password.length()) < 10) {
            throw bad("新密码至少10个字符");
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw bad("新密码的UTF-8长度不得超过72字节");
        }
        boolean letter = false;
        boolean digit = false;
        for (int i = 0; i < password.length(); i++) {
            char c = password.charAt(i);
            if (Character.isLetter(c)) letter = true;
            if (Character.isDigit(c)) digit = true;
        }
        if (!letter || !digit) throw bad("新密码须同时包含字母和数字");
    }

    private static ApiException bad(String message) {
        return new ApiException(400, "INVALID_PASSWORD", message);
    }
}
