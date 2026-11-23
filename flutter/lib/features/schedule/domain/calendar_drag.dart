import '../../../core/company/company_date.dart';
import '../../../core/company/company_time.dart';
import '../../tasks/domain/task_record.dart';

enum CalendarDragMode { move, start, end }

class CalendarDragPreview {
  const CalendarDragPreview({
    required this.allDay,
    this.startAt,
    this.dueAt,
    this.startDate,
    this.endDate,
  });

  final bool allDay;
  final DateTime? startAt;
  final DateTime? dueAt;
  final CompanyDate? startDate;
  final CompanyDate? endDate;

  Map<String, Object?> payload(String reason) => {
    'allDay': allDay,
    if (allDay) ...{
      'startDate': startDate?.iso,
      'dueDate': endDate?.iso,
    } else ...{
      'startAt': startAt?.toUtc().toIso8601String(),
      'dueAt': dueAt?.toUtc().toIso8601String(),
    },
    'reason': reason,
  };

  String label(CompanyTimeZone zone) {
    if (allDay) {
      final start = startDate?.iso ?? '—';
      final due = endDate?.iso;
      return due == null || due == start ? '$start（全天）' : '$start 至 $due（全天）';
    }
    if (startAt == null || dueAt == null) return '排期未设置';
    return '${zone.formatDateTime(startAt!)} 至 ${zone.formatDateTime(dueAt!)}';
  }
}

/// 月历/日轴拖动的纯规则；只产生预览，不发请求。
class CalendarDragCalculator {
  const CalendarDragCalculator._();

  static bool canReschedule(TaskRecord task) =>
      task.published &&
      !task.pending &&
      !task.frozen &&
      !task.done &&
      task.canReschedule &&
      task.canEditField('startAt');

  static CalendarDragPreview? monthMove(
    TaskRecord task,
    CompanyDate grabDay,
    CompanyDate targetDay,
  ) {
    if (!canReschedule(task)) return null;
    final delta = targetDay.differenceInDays(grabDay);
    if (delta == 0) return null;
    if (task.allDay) {
      final start = task.allDayStart;
      final due = task.allDayEnd;
      if (start == null || due == null) return null;
      return CalendarDragPreview(
        allDay: true,
        startDate: start.addDays(delta),
        endDate: due.addDays(delta),
      );
    }
    final start = task.startAt;
    final due = task.dueAt;
    if (start == null || due == null) return null;
    return CalendarDragPreview(
      allDay: false,
      startAt: start.add(Duration(days: delta)),
      dueAt: due.add(Duration(days: delta)),
    );
  }

  static CalendarDragPreview? monthResizeStart(
    TaskRecord task,
    CompanyDate grabDay,
    CompanyDate targetDay,
  ) {
    if (!canReschedule(task)) return null;
    final delta = targetDay.differenceInDays(grabDay);
    if (delta == 0) return null;
    if (task.allDay) {
      final start = task.allDayStart;
      final due = task.allDayEnd;
      if (start == null || due == null) return null;
      final next = start.addDays(delta);
      if (next.isAfter(due)) return null;
      return CalendarDragPreview(allDay: true, startDate: next, endDate: due);
    }
    final start = task.startAt;
    final due = task.dueAt;
    if (start == null || due == null) return null;
    final next = start.add(Duration(days: delta));
    if (next.isAfter(due)) return null;
    return CalendarDragPreview(allDay: false, startAt: next, dueAt: due);
  }

  static CalendarDragPreview? monthResizeEnd(
    TaskRecord task,
    CompanyDate grabDay,
    CompanyDate targetDay,
  ) {
    if (!canReschedule(task)) return null;
    final delta = targetDay.differenceInDays(grabDay);
    if (delta == 0) return null;
    if (task.allDay) {
      final start = task.allDayStart;
      final due = task.allDayEnd;
      if (start == null || due == null) return null;
      final next = due.addDays(delta);
      if (next.isBefore(start)) return null;
      return CalendarDragPreview(allDay: true, startDate: start, endDate: next);
    }
    final start = task.startAt;
    final due = task.dueAt;
    if (start == null || due == null) return null;
    final next = due.add(Duration(days: delta));
    if (next.isBefore(start)) return null;
    return CalendarDragPreview(allDay: false, startAt: start, dueAt: next);
  }

  static bool dayAxisEligible(
    TaskRecord task,
    CompanyDate day, {
    CompanyTimeZone? zone,
  }) {
    if (!canReschedule(task) || task.allDay) return false;
    final start = task.startAt;
    final due = task.dueAt;
    if (start == null || due == null) return false;
    final tz = zone ?? CompanyTimeZone.fallback;
    final dayStart = tz.dayStart(day);
    final dayEnd = tz.nextDayStart(day);
    if (start.isBefore(dayStart) || due.isAfter(dayEnd)) return false;
    return true;
  }

  static CalendarDragPreview? dayMove(
    TaskRecord task,
    CompanyDate day,
    int hourDelta, {
    CompanyTimeZone? zone,
  }) => _dayAdjust(task, day, hourDelta, CalendarDragMode.move, zone: zone);

  static CalendarDragPreview? dayResizeStart(
    TaskRecord task,
    CompanyDate day,
    int hourDelta, {
    CompanyTimeZone? zone,
  }) => _dayAdjust(task, day, hourDelta, CalendarDragMode.start, zone: zone);

  static CalendarDragPreview? dayResizeEnd(
    TaskRecord task,
    CompanyDate day,
    int hourDelta, {
    CompanyTimeZone? zone,
  }) => _dayAdjust(task, day, hourDelta, CalendarDragMode.end, zone: zone);

  static CalendarDragPreview? _dayAdjust(
    TaskRecord task,
    CompanyDate day,
    int hourDelta,
    CalendarDragMode mode, {
    CompanyTimeZone? zone,
  }) {
    if (hourDelta == 0 || !dayAxisEligible(task, day, zone: zone)) return null;
    final start = task.startAt!;
    final due = task.dueAt!;
    final delta = Duration(hours: hourDelta);
    final nextStart = mode == CalendarDragMode.end ? start : start.add(delta);
    final nextDue = mode == CalendarDragMode.start ? due : due.add(delta);
    final tz = zone ?? CompanyTimeZone.fallback;
    final dayStart = tz.dayStart(day);
    final dayEnd = tz.nextDayStart(day);
    if (nextStart.isBefore(dayStart) ||
        nextDue.isAfter(dayEnd) ||
        nextStart.isAfter(nextDue)) {
      return null;
    }
    return CalendarDragPreview(
      allDay: false,
      startAt: nextStart,
      dueAt: nextDue,
    );
  }
}
