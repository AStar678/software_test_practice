import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/company/company_date.dart';
import 'package:pandora_employee/features/schedule/domain/day_axis.dart';
import 'package:pandora_employee/features/tasks/domain/task_record.dart';

TaskRecord timed(String id, String start, String due, {bool pending = false, bool allDay = false, Map<String, Object?>? proposal}) {
  return TaskRecord.fromJson({
    'id': id,
    'title': id,
    'published': true,
    'executionState': 'todo',
    'assigneeIds': ['u1'],
    'allDay': allDay,
    'startAt': start,
    'dueAt': due,
    'pending': pending,
    'frozen': pending,
    'canReschedule': true,
    'editableFields': ['startAt'],
    'pendingSchedule': proposal,
  });
}

void main() {
  final day = const CompanyDate(2026, 11, 12);

  test('横向日轴每个任务一行，含旧全天与整日覆盖', () {
    final tasks = [
      TaskRecord.fromJson({
        'id': 'all',
        'title': '旧全天',
        'published': true,
        'allDay': true,
        'startDate': '2026-11-12',
        'dueDate': '2026-11-12',
      }),
      timed('full', '2026-11-11T16:00:00Z', '2026-11-12T16:00:00Z'),
      timed('nine', '2026-11-12T01:00:00Z', '2026-11-12T02:00:00Z'),
    ];
    final layout = DayAxisLayout.compute(day: day, tasks: tasks, mode: DayAxisMode.horizontal);
    expect(layout.entries, hasLength(3));
    expect(layout.allDay, isEmpty);
    expect(layout.timedLanes, isEmpty);
  });

  test('纵向日轴分离全天区，超过五重叠全量分栏', () {
    final tasks = <TaskRecord>[
      TaskRecord.fromJson({
        'id': 'all',
        'title': '旧全天',
        'published': true,
        'allDay': true,
        'startDate': '2026-11-12',
        'dueDate': '2026-11-12',
      }),
      timed('full', '2026-11-11T16:00:00Z', '2026-11-12T16:00:00Z'),
      for (var index = 0; index < 7; index++)
        timed('t$index', '2026-11-12T01:00:00Z', '2026-11-12T02:00:00Z'),
    ];
    final layout = DayAxisLayout.compute(day: day, tasks: tasks, mode: DayAxisMode.vertical);
    expect(layout.allDay.map((entry) => entry.task.id), containsAll(['all', 'full']));
    expect(layout.timedLanes, hasLength(7));
    expect(layout.entries.where((entry) => !entry.allDay), hasLength(7));
  });

  test('跨日片段无拖动，零时长当日任务可拖动', () {
    final clipped = timed('clipped', '2026-11-11T10:00:00Z', '2026-11-12T04:00:00Z');
    final zero = timed('zero', '2026-11-12T02:00:00Z', '2026-11-12T02:00:00Z');
    final layout = DayAxisLayout.compute(day: day, tasks: [clipped, zero], mode: DayAxisMode.horizontal);
    expect(layout.entries.firstWhere((entry) => entry.task.id == 'clipped').clipped, isTrue);
    expect(layout.entries.firstWhere((entry) => entry.task.id == 'clipped').canDrag, isFalse);
    expect(layout.entries.firstWhere((entry) => entry.task.id == 'zero').zeroDuration, isTrue);
    expect(layout.entries.firstWhere((entry) => entry.task.id == 'zero').canDrag, isTrue);
  });

  test('待审全天提议进入纵向全天区且不重复进轴', () {
    final pending = TaskRecord.fromJson({
      'id': 'pending-all',
      'title': '全天提议',
      'published': true,
      'allDay': false,
      'startAt': '2026-11-12T02:00:00Z',
      'dueAt': '2026-11-12T03:00:00Z',
      'pending': true,
      'frozen': true,
      'pendingSchedule': {
        'allDay': true,
        'startDate': '2026-11-12',
        'dueDate': '2026-11-12',
      },
    });
    final layout = DayAxisLayout.compute(day: day, tasks: [pending], mode: DayAxisMode.vertical);
    expect(layout.allDay.single.task.id, 'pending-all');
    expect(layout.timedLanes, isEmpty);
  });

  test('待审提议使用提议时间且不可拖动', () {
    final pending = timed(
      'pending',
      '2026-11-12T02:00:00Z',
      '2026-11-12T03:00:00Z',
      pending: true,
      proposal: {
        'allDay': false,
        'startAt': '2026-11-12T05:00:00Z',
        'dueAt': '2026-11-12T06:00:00Z',
      },
    );
    final layout = DayAxisLayout.compute(day: day, tasks: [pending], mode: DayAxisMode.horizontal);
    final entry = layout.entries.single;
    expect(entry.startMinutes, 13 * 60);
    expect(entry.pendingProjection, isTrue);
    expect(entry.canDrag, isFalse);
  });
}
