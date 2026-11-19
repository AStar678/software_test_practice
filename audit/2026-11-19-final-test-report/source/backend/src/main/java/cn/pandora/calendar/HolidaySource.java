package cn.pandora.calendar;

/** Fixed server-side annual source; implementations never accept a client-supplied URL. */
public interface HolidaySource {
    HolidayPayload.Year fetch(int year);

    /** Stable source identifier recorded with the cache and safe to show to clients. */
    default String sourceName() {
        return "unknown";
    }
}
