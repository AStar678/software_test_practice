package cn.pandora.mobile;

import java.time.*;
import java.util.*;

/** Half-open interval calculations shared by the native month and day views. */
final class ScheduleMath {
  enum Edge { MOVE, START, END }

  record Range(Instant start, Instant end) {}

  static int monthCapacity(int initial, float spanChange, float perRow) {
    int change = (int) (spanChange / perRow);
    return Math.max(1, Math.min(8, initial + change));
  }

  static int monthCell(float x, float y, float width, float header, float weekHeight, int weeks) {
    if (x < 0 || x >= width || y < header || y >= header + weeks * weekHeight) return -1;
    int row = (int) ((y - header) / weekHeight);
    int column = Math.min(6, (int) (x * 7 / width));
    return row * 7 + column;
  }

  static Range shift(Range range, Edge edge, int steps, ZoneId zone, LocalDate day) {
    Instant start = edge == Edge.END ? range.start() : shift(range.start(), steps, zone, day);
    Instant end = edge == Edge.START ? range.end() : shift(range.end(), steps, zone, day);
    if (end.isBefore(start)) return null;
    if (day != null) {
      Instant from = day.atStartOfDay(zone).toInstant();
      Instant to = day.plusDays(1).atStartOfDay(zone).toInstant();
      if (start.isBefore(from) || !start.isBefore(to) || end.isAfter(to)) return null;
    }
    return new Range(start, end);
  }

  private static Instant shift(Instant instant, int steps, ZoneId zone, LocalDate day) {
    return day == null ? instant.atZone(zone).plusDays(steps).toInstant()
        : instant.plus(Duration.ofHours(steps));
  }

  static boolean hits(Instant start, Instant end, Instant from, Instant to) {
    return start.equals(end)
        ? !start.isBefore(from) && start.isBefore(to)
        : end.isAfter(from) && start.isBefore(to);
  }

  static int lane(List<Instant> laneEnds, Instant start, Instant end) {
    for (int i = 0; i < laneEnds.size(); i++)
      if (!laneEnds.get(i).isAfter(start)) {
        laneEnds.set(i, end);
        return i;
      }
    laneEnds.add(end);
    return laneEnds.size() - 1;
  }

  static Instant max(Instant a, Instant b) {
    return a.isAfter(b) ? a : b;
  }

  static Instant min(Instant a, Instant b) {
    return a.isBefore(b) ? a : b;
  }

  static double fraction(Instant at, Instant from, Instant to) {
    return Math.max(
        0,
        Math.min(
            1,
            (double) Duration.between(from, at).toMillis()
                / Duration.between(from, to).toMillis()));
  }
}
