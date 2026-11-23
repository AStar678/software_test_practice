package cn.pandora.profile;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * One unified completed-tenure projection shared by the employee Web, the PC console and the future
 * Flutter client. It counts full elapsed years, then full months, then remaining days against the
 * company business date; it never converts through 365/30 day approximations and never uses the
 * account creation date.
 */
public final class Tenure {
    private Tenure() {}

    /**
     * @return {@code null} when no real hire date is known, otherwise
     *         {@code {years,months,days,asOfDate}}. A hire date later than {@code asOfDate} is also
     *         treated as unset rather than producing a negative duration.
     */
    public static Map<String, Object> of(LocalDate hireDate, LocalDate asOfDate) {
        if (hireDate == null || asOfDate == null || hireDate.isAfter(asOfDate)) return null;
        int years = 0;
        LocalDate anniversary = hireDate;
        while (true) {
            // LocalDate.plusYears clamps 29 February to the last day of the target month.
            LocalDate next = hireDate.plusYears(years + 1L);
            if (next.isAfter(asOfDate)) break;
            years++;
            anniversary = next;
        }
        int months = 0;
        while (months < 11) {
            LocalDate next = anniversary.plusMonths(months + 1L);
            if (next.isAfter(asOfDate)) break;
            months++;
        }
        LocalDate monthAnchor = anniversary.plusMonths(months);
        int days = (int) ChronoUnit.DAYS.between(monthAnchor, asOfDate);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("years", years);
        result.put("months", months);
        result.put("days", days);
        result.put("asOfDate", asOfDate.toString());
        return result;
    }
}
