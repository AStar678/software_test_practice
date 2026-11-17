package cn.pandora.mobile;

import static org.junit.Assert.*;

import java.time.LocalDate;
import org.junit.Test;

public class HomeDailyCalendarTest {
  @Test public void consecutiveWeeksHaveNoDuplicateOrMissingDatesAtYearBoundary() {
    int position = HomeDailyCalendar.weekPosition(LocalDate.of(2026, 12, 31));
    LocalDate first = HomeDailyCalendar.weekStart(position);
    assertEquals(LocalDate.of(2026, 12, 28), first);
    assertEquals(position, HomeDailyCalendar.weekPosition(LocalDate.of(2027, 1, 3)));
    assertEquals(first.plusDays(7), HomeDailyCalendar.weekStart(position + 1));
    assertEquals(first.minusDays(7), HomeDailyCalendar.weekStart(position - 1));
  }
}
