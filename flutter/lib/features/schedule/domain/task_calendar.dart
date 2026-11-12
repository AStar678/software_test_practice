import '../../../core/company/company_date.dart';
import '../../../core/company/company_time.dart';
import '../../daily_items/domain/daily_item.dart';
import '../../daily_items/domain/month_layout.dart';
import '../../tasks/domain/task_record.dart';

class CalendarTask {
  const CalendarTask({required this.task, required this.pendingProjection});

  final TaskRecord task;
  final bool pendingProjection;

  CompanyDate get startDay {
    final proposal = pendingProjection ? task.pendingSchedule : null;
    if (proposal != null && proposal['allDay'] == true) {
      return CompanyDate.tryParse(proposal['startDate']?.toString()) ?? task.allDayStart!;
    }
    final raw = proposal?['startAt']?.toString();
    if (raw != null) {
      final parsed = DateTime.tryParse(raw);
      if (parsed != null) return CompanyTimeZone.fallback.dateOf(parsed);
    }
    return task.allDayStart ?? CompanyTimeZone.fallback.dateOf(task.startAt!);
  }

  CompanyDate get endDay {
    final proposal = pendingProjection ? task.pendingSchedule : null;
    if (proposal != null && proposal['allDay'] == true) {
      return CompanyDate.tryParse(proposal['dueDate']?.toString()) ?? task.allDayEnd!;
    }
    final raw = proposal?['dueAt']?.toString();
    if (raw != null) {
      final parsed = DateTime.tryParse(raw);
      if (parsed != null) return CompanyTimeZone.fallback.dateOf(parsed);
    }
    return task.allDayEnd ?? CompanyTimeZone.fallback.dateOf(task.dueAt!);
  }

  bool covers(CompanyDate day) {
    final proposal = pendingProjection ? task.pendingSchedule : null;
    if (proposal != null && proposal['allDay'] == true) {
      return !day.isBefore(startDay) && !day.isAfter(endDay);
    }
    if (proposal != null) {
      final start = DateTime.tryParse(proposal['startAt']?.toString() ?? '');
      final due = DateTime.tryParse(proposal['dueAt']?.toString() ?? '');
      if (start != null && due != null) {
        return ScheduleCoverage.coversTimed(day, start, due, CompanyTimeZone.fallback);
      }
    }
    return task.coversDay(day, CompanyTimeZone.fallback);
  }

  DailyItemVisualState get visualState => task.done
      ? DailyItemVisualState.completed
      : (endDay.isBefore(CompanyTimeZone.fallback.dateOf(DateTime.now())) ? DailyItemVisualState.overdue : DailyItemVisualState.open);

  String get color => task.tags.isEmpty ? '#ffe1ea' : (task.tags.first.color ?? '#ffe1ea');
}

/// 把任务适配为事项月布局的纯数据输入；只用于几何，不改变任务业务。
DailyItem pseudoItem(CalendarTask item) {
  final start = item.startDay;
  final end = item.endDay;
  return DailyItem(
    id: item.task.id,
    body: item.task.title,
    startDate: start,
    endDate: end,
    completed: item.task.done,
    status: item.visualState == DailyItemVisualState.completed
        ? 'completed'
        : item.visualState == DailyItemVisualState.overdue
            ? 'overdue'
            : 'open',
    rowVersion: item.task.rowVersion,
  );
}

class TaskCalendarSelection {
  TaskCalendarSelection({required this.taskId, required this.grabDay});

  final String taskId;
  CompanyDate grabDay;
}
