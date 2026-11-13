import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/company/company_date.dart';
import 'package:pandora_employee/features/schedule/domain/calendar_drag.dart';
import 'package:pandora_employee/features/tasks/domain/task_record.dart';

TaskRecord task(Map<String, Object?> json) => TaskRecord.fromJson({
      'id': 't1',
      'title': '任务',
      'published': true,
      'executionState': 'todo',
      'canReschedule': true,
      'editableFields': ['startAt', 'dueAt'],
      ...json,
    });

void main() {
  final day = const CompanyDate(2026, 11, 12);

  test('月历整条移动保留时刻与工期，跨月/年只改日期差', () {
    final source = task({
      'allDay': false,
      'startAt': '2026-12-31T02:15:00Z',
      'dueAt': '2027-01-02T05:45:00Z',
    });
    final preview = CalendarDragCalculator.monthMove(source, day, day.addDays(3))!;
    expect(preview.startAt, DateTime.utc(2027, 1, 3, 2, 15));
    expect(preview.dueAt, DateTime.utc(2027, 1, 5, 5, 45));
  });

  test('续接片段按抓取日平移完整任务，不重设片段起点', () {
    final source = task({
      'allDay': false,
      'startAt': '2026-11-10T02:00:00Z',
      'dueAt': '2026-11-15T03:00:00Z',
    });
    final preview = CalendarDragCalculator.monthMove(source, day.addDays(1), day.addDays(4))!;
    expect(preview.startAt, DateTime.utc(2026, 11, 13, 2));
    expect(preview.dueAt, DateTime.utc(2026, 11, 18, 3));
  });

  test('真实端点缩放保留另一端与日内时刻', () {
    final source = task({
      'allDay': false,
      'startAt': '2026-11-12T02:15:00Z',
      'dueAt': '2026-11-12T05:45:00Z',
    });
    final start = CalendarDragCalculator.monthResizeStart(source, day, day.addDays(-1))!;
    expect(start.startAt, DateTime.utc(2026, 11, 11, 2, 15));
    expect(start.dueAt, DateTime.utc(2026, 11, 12, 5, 45));
    final end = CalendarDragCalculator.monthResizeEnd(source, day, day.addDays(2))!;
    expect(end.startAt, DateTime.utc(2026, 11, 12, 2, 15));
    expect(end.dueAt, DateTime.utc(2026, 11, 14, 5, 45));
    expect(CalendarDragCalculator.monthResizeStart(source, day, day.addDays(1)), isNull);
    expect(CalendarDragCalculator.monthResizeEnd(source, day, day.addDays(-2)), isNull);
  });

  test('旧全天按月移动并允许零工期', () {
    final source = task({'allDay': true, 'startDate': '2026-11-12', 'dueDate': '2026-11-12'});
    final preview = CalendarDragCalculator.monthMove(source, day, day.addDays(2))!;
    expect(preview.startDate, const CompanyDate(2026, 11, 14));
    expect(preview.endDate, const CompanyDate(2026, 11, 14));
  });

  test('无位移、待审、冻结、完成和无权限不产生月历预览', () {
    final normal = task({'allDay': false, 'startAt': '2026-11-12T02:00:00Z', 'dueAt': '2026-11-12T03:00:00Z'});
    expect(CalendarDragCalculator.monthMove(normal, day, day), isNull);
    for (final blocked in [
      task({'allDay': false, 'startAt': '2026-11-12T02:00:00Z', 'dueAt': '2026-11-12T03:00:00Z', 'pending': true}),
      task({'allDay': false, 'startAt': '2026-11-12T02:00:00Z', 'dueAt': '2026-11-12T03:00:00Z', 'frozen': true}),
      task({'allDay': false, 'startAt': '2026-11-12T02:00:00Z', 'dueAt': '2026-11-12T03:00:00Z', 'executionState': 'done'}),
      task({'allDay': false, 'startAt': '2026-11-12T02:00:00Z', 'dueAt': '2026-11-12T03:00:00Z', 'canReschedule': false}),
      task({'allDay': false, 'startAt': '2026-11-12T02:00:00Z', 'dueAt': '2026-11-12T03:00:00Z', 'editableFields': []}),
    ]) {
      expect(CalendarDragCalculator.monthMove(blocked, day, day.addDays(1)), isNull);
    }
  });

  test('日轴按小时调整保留分钟且最终仍在当日', () {
    final source = task({
      'allDay': false,
      'startAt': '2026-11-12T02:15:00Z',
      'dueAt': '2026-11-12T05:45:00Z',
    });
    final moved = CalendarDragCalculator.dayMove(source, day, 2)!;
    expect(moved.startAt, DateTime.utc(2026, 11, 12, 4, 15));
    expect(moved.dueAt, DateTime.utc(2026, 11, 12, 7, 45));
    expect(CalendarDragCalculator.dayMove(source, day, -11), isNull);
    expect(CalendarDragCalculator.dayMove(source, day, 18), isNull);
  });

  test('日轴边界可到 00:00 与 24:00，零时长可调整', () {
    final source = task({
      'allDay': false,
      'startAt': '2026-11-12T02:00:00Z',
      'dueAt': '2026-11-12T15:00:00Z',
    });
    expect(CalendarDragCalculator.dayMove(source, day, -10)!.startAt, DateTime.utc(2026, 11, 11, 16));
    expect(CalendarDragCalculator.dayMove(source, day, 1)!.dueAt, DateTime.utc(2026, 11, 12, 16));
    final zero = task({
      'allDay': false,
      'startAt': '2026-11-12T02:00:00Z',
      'dueAt': '2026-11-12T02:00:00Z',
    });
    expect(CalendarDragCalculator.dayMove(zero, day, 1)!.startAt, DateTime.utc(2026, 11, 12, 3));
    expect(CalendarDragCalculator.dayMove(zero, day, 14)!.dueAt, DateTime.utc(2026, 11, 12, 16));
    expect(CalendarDragCalculator.dayMove(zero, day, 15), isNull);
  });

  test('日轴拒绝旧全天、整日覆盖和跨日片段', () {
    final allDay = task({'allDay': true, 'startDate': '2026-11-12', 'dueDate': '2026-11-12'});
    expect(CalendarDragCalculator.dayMove(allDay, day, 1), isNull);
    final full = task({'allDay': false, 'startAt': '2026-11-11T16:00:00Z', 'dueAt': '2026-11-12T16:00:00Z'});
    expect(CalendarDragCalculator.dayMove(full, day, 1), isNull);
    final clipped = task({'allDay': false, 'startAt': '2026-11-11T10:00:00Z', 'dueAt': '2026-11-12T04:00:00Z'});
    expect(CalendarDragCalculator.dayMove(clipped, day, 1), isNull);
  });
}
