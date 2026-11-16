package cn.pandora.mobile;

import static org.junit.Assert.*;

import java.time.*;
import java.util.*;
import org.junit.Test;

public class ScheduleMathTest {
  private Instant at(int hour) {
    return Instant.parse("2026-10-23T00:00:00Z").plusSeconds(hour * 3600L);
  }

  @Test
  public void boundaryPointBelongsOnlyToFollowingBand() {
    assertFalse(ScheduleMath.hits(at(8), at(8), at(0), at(8)));
    assertTrue(ScheduleMath.hits(at(8), at(8), at(8), at(16)));
  }

  @Test
  public void midnightEndDoesNotOccupyFollowingDay() {
    assertFalse(ScheduleMath.hits(at(-1), at(0), at(0), at(24)));
    assertTrue(ScheduleMath.hits(at(0), at(24), at(0), at(24)));
    assertFalse(ScheduleMath.hits(at(0), at(24), at(24), at(48)));
  }

  @Test
  public void crossDayEventAppearsInAllIntersectingBands() {
    for (int h = 0; h < 24; h += 8) assertTrue(ScheduleMath.hits(at(-2), at(26), at(h), at(h + 8)));
  }

  @Test
  public void atLeastFiveSimultaneousEventsGetSeparateLanes() {
    List<Instant> ends = new ArrayList<>();
    Set<Integer> slots = new HashSet<>();
    for (int i = 0; i < 8; i++) slots.add(ScheduleMath.lane(ends, at(0), at(2)));
    assertEquals(8, slots.size());
    assertEquals(0, ScheduleMath.lane(ends, at(2), at(3)));
  }

  @Test
  public void allDayMonthOccupancyUsesWholeDays() {
    List<Instant> ends = new ArrayList<>();
    assertEquals(0, ScheduleMath.lane(ends, at(0), at(24)));
    assertEquals(1, ScheduleMath.lane(ends, at(0), at(24)));
    assertEquals(0, ScheduleMath.lane(ends, at(24), at(48)));
  }

  @Test
  public void clippingPreservesDurationAcrossThreeBands() {
    long sum = 0;
    for (int h = 0; h < 24; h += 8)
      sum +=
          Duration.between(ScheduleMath.max(at(-1), at(h)), ScheduleMath.min(at(25), at(h + 8)))
              .getSeconds();
    assertEquals(86400, sum);
  }

  @Test
  public void fractionClampsOutsideVisibleBand() {
    assertEquals(0, ScheduleMath.fraction(at(-1), at(0), at(8)), 0);
    assertEquals(.5, ScheduleMath.fraction(at(4), at(0), at(8)), 0);
    assertEquals(1, ScheduleMath.fraction(at(9), at(0), at(8)), 0);
  }

  @Test
  public void monthMoveUsesCompanyDaysAcrossDaylightSaving() {
    ZoneId zone = ZoneId.of("America/New_York");
    ZonedDateTime start = ZonedDateTime.of(2026, 3, 7, 9, 35, 0, 0, zone);
    ScheduleMath.Range range = new ScheduleMath.Range(start.toInstant(), start.plusHours(2).toInstant());
    ScheduleMath.Range shifted = ScheduleMath.shift(range, ScheduleMath.Edge.MOVE, 1, zone, null);
    assertEquals(start.plusDays(1).toInstant(), shifted.start());
    assertEquals(start.plusDays(1).plusHours(2).toInstant(), shifted.end());
  }

  @Test
  public void hourResizeKeepsMinutesAndRejectsMovingOutsideTheDay() {
    ZoneId zone = ZoneOffset.UTC;
    LocalDate day = LocalDate.of(2026, 10, 23);
    ScheduleMath.Range range = new ScheduleMath.Range(at(21).plusSeconds(20 * 60), at(23));
    ScheduleMath.Range endAtMidnight = ScheduleMath.shift(range, ScheduleMath.Edge.END, 1, zone, day);
    assertEquals(at(24), endAtMidnight.end());
    assertEquals(range.start(), endAtMidnight.start());
    assertNull(ScheduleMath.shift(range, ScheduleMath.Edge.END, 2, zone, day));
    assertNull(ScheduleMath.shift(range, ScheduleMath.Edge.START, 2, zone, day));
    ScheduleMath.Range moved = ScheduleMath.shift(range, ScheduleMath.Edge.MOVE, -1, zone, day);
    assertEquals(at(20).plusSeconds(20 * 60), moved.start());
  }

  @Test
  public void verticalFingerSeparationChangesRowsWithinBounds() {
    assertEquals(3, ScheduleMath.monthCapacity(3, -20, 48));
    assertEquals(5, ScheduleMath.monthCapacity(3, 100, 48));
    assertEquals(2, ScheduleMath.monthCapacity(3, -50, 48));
    assertEquals(1, ScheduleMath.monthCapacity(3, -300, 48));
    assertEquals(8, ScheduleMath.monthCapacity(3, 300, 48));
  }

  @Test
  public void monthDropTracksTheTargetCellAcrossWeekRows() {
    assertEquals(6, ScheduleMath.monthCell(699, 87, 700, 32, 80, 5));
    assertEquals(7, ScheduleMath.monthCell(20, 115, 700, 32, 80, 5));
    assertEquals(-1, ScheduleMath.monthCell(700, 115, 700, 32, 80, 5));
    assertEquals(-1, ScheduleMath.monthCell(20, 31, 700, 32, 80, 5));
    assertEquals(-1, ScheduleMath.monthCell(20, 432, 700, 32, 80, 5));
  }
}
