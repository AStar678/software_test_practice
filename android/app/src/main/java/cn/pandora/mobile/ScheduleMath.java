package cn.pandora.mobile;

import java.time.*;
import java.util.*;

/** Half-open interval calculations shared by the native month and day views. */
final class ScheduleMath {
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
