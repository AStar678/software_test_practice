package cn.pandora.calendar;

/** A safe, non-sensitive failure code produced by the fixed holiday source or its validator. */
public class HolidaySourceException extends RuntimeException {
    private final String safeCode;

    public HolidaySourceException(String safeCode, String message) {
        super(message);
        this.safeCode = safeCode;
    }

    public HolidaySourceException(String safeCode, String message, Throwable cause) {
        super(message, cause);
        this.safeCode = safeCode;
    }

    public String safeCode() {
        return safeCode;
    }
}
