import '../../../core/company/company_date.dart';
import '../../../core/company/company_time.dart';
import '../../tasks/domain/task_record.dart';
import 'task_calendar.dart';

enum DayAxisMode { horizontal, vertical }

class DayAxisEntry {
  const DayAxisEntry({
    required this.task,
    required this.startMinutes,
    required this.endMinutes,
    required this.allDay,
    required this.clipped,
    required this.pendingProjection,
    required this.canDrag,
    this.lane = 0,
  });

  final TaskRecord task;
  final int startMinutes;
  final int endMinutes;
  final bool allDay;
  final bool clipped;
  final bool pendingProjection;
  final bool canDrag;
  final int lane;

  bool get zeroDuration => startMinutes == endMinutes;
  String get color => task.tags.isEmpty ? '#ffe1ea' : (task.tags.first.color ?? '#ffe1ea');
}

/// 日轴纯布局：真实 00:00—24:00、全天/整日覆盖分类和碰撞分栏。
class DayAxisLayout {
  const DayAxisLayout({
    required this.day,
    required this.mode,
    required this.entries,
    required this.allDay,
    required this.timedLanes,
  });

  final CompanyDate day;
  final DayAxisMode mode;
  final List<DayAxisEntry> entries;
  final List<DayAxisEntry> allDay;
  final List<List<DayAxisEntry>> timedLanes;

  static DayAxisLayout compute({
    required CompanyDate day,
    required Iterable<TaskRecord> tasks,
    required DayAxisMode mode,
    CompanyTimeZone? zone,
  }) {
    final tz = zone ?? CompanyTimeZone.fallback;
    final entries = <DayAxisEntry>[];
    for (final task in tasks) {
      final item = CalendarTask(task: task, pendingProjection: task.pending && task.pendingSchedule != null);
      if (!item.covers(day)) continue;
      final pendingProjection = item.pendingProjection;
      final proposalAllDay = pendingProjection && task.pendingSchedule?['allDay'] == true;
      final start = _start(item);
      final due = _due(item);
      final allDay = proposalAllDay || task.allDay || _isWholeDay(start, due, day, tz);
      final clipped = !allDay && (start == null || due == null || start.isBefore(tz.dayStart(day)) || due.isAfter(tz.nextDayStart(day)));
      final minutes = allDay || start == null || due == null
          ? (startMinutes: 0, endMinutes: 24 * 60)
          : ScheduleCoverage.visibleMinutes(start, due, day, tz);
      final drag = !pendingProjection &&
          task.published &&
          !task.pending &&
          !task.frozen &&
          !task.done &&
          task.canReschedule &&
          task.canEditField('startAt') &&
          !task.allDay &&
          !allDay &&
          !clipped;
      entries.add(
        DayAxisEntry(
          task: task,
          startMinutes: minutes.startMinutes,
          endMinutes: minutes.endMinutes,
          allDay: allDay,
          clipped: clipped,
          pendingProjection: pendingProjection,
          canDrag: drag,
        ),
      );
    }
    entries.sort((a, b) {
      final ap = a.task.pinned ? 0 : 1;
      final bp = b.task.pinned ? 0 : 1;
      if (ap != bp) return ap.compareTo(bp);
      final start = a.startMinutes.compareTo(b.startMinutes);
      return start != 0 ? start : a.task.id.compareTo(b.task.id);
    });
    if (mode == DayAxisMode.horizontal) {
      return DayAxisLayout(day: day, mode: mode, entries: entries, allDay: const [], timedLanes: const []);
    }
    final allDayEntries = entries.where((entry) => entry.allDay).toList();
    final timed = entries.where((entry) => !entry.allDay).toList();
    final lanes = <List<DayAxisEntry>>[];
    for (final entry in timed) {
      var lane = 0;
      while (lane < lanes.length) {
        final last = lanes[lane].last;
        if (last.endMinutes <= entry.startMinutes) {
          break;
        }
        lane++;
      }
      if (lane == lanes.length) lanes.add(<DayAxisEntry>[]);
      lanes[lane].add(entry);
    }
    final placed = <DayAxisEntry>[
      for (var index = 0; index < lanes.length; index++)
        for (final entry in lanes[index])
          DayAxisEntry(
            task: entry.task,
            startMinutes: entry.startMinutes,
            endMinutes: entry.endMinutes,
            allDay: entry.allDay,
            clipped: entry.clipped,
            pendingProjection: entry.pendingProjection,
            canDrag: entry.canDrag,
            lane: index,
          ),
    ];
    return DayAxisLayout(day: day, mode: mode, entries: [...allDayEntries, ...placed], allDay: allDayEntries, timedLanes: lanes);
  }

  static DateTime? _start(CalendarTask item) {
    final proposal = item.pendingProjection ? item.task.pendingSchedule : null;
    final raw = proposal?['startAt']?.toString();
    if (raw != null) return DateTime.tryParse(raw);
    return item.task.startAt;
  }

  static DateTime? _due(CalendarTask item) {
    final proposal = item.pendingProjection ? item.task.pendingSchedule : null;
    final raw = proposal?['dueAt']?.toString();
    if (raw != null) return DateTime.tryParse(raw);
    return item.task.dueAt;
  }

  static bool _isWholeDay(DateTime? start, DateTime? due, CompanyDate day, CompanyTimeZone zone) {
    if (start == null || due == null) return false;
    return !start.isAfter(zone.dayStart(day)) && !due.isBefore(zone.nextDayStart(day));
  }
}
