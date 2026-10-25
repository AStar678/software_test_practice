package cn.pandora.auth;

/**
 * One normalization rule for employee phone numbers (chapter 2.1).
 *
 * The login key is derived from the contact number by removing the display separators the profile
 * form already allows (spaces, hyphens, brackets, dots) and keeping a single leading {@code +} for a
 * real international prefix. No number range, country code or digit count is invented: the accepted
 * shape stays the one the existing profile validation already accepted (3–20 digits), and a value
 * that does not normalize to that shape is reported to the caller instead of being guessed.
 *
 * The same function backs the authentication lookup, every write that changes a contact number, and
 * the Python migration precheck (see {@code backend/scripts/migration_precheck.py}), so a login key
 * can never drift from the number it came from.
 */
public final class PhoneNumbers {
    private PhoneNumbers() {}

    /** Normalized login/contact key, or {@code null} when the input is blank or not a usable number. */
    public static String normalize(String raw) {
        if (raw == null) return null;
        StringBuilder out = new StringBuilder(raw.length());
        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);
            if (c == ' ' || c == '\u3000' || c == '\t' || c == '-' || c == '(' || c == ')' || c == '.') continue;
            out.append(c);
        }
        String text = out.toString();
        if (text.isEmpty() || !text.matches("\\+?[0-9]{3,20}")) return null;
        return text;
    }

    /** True when the raw value is a usable phone number (so login can treat it as an employee key). */
    public static boolean isPhone(String raw) {
        return normalize(raw) != null;
    }
}
