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
}
