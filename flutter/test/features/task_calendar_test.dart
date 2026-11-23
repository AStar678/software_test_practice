import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/company/company_date.dart';
import 'package:pandora_employee/core/company/company_time.dart';
import 'package:pandora_employee/features/daily_items/domain/month_layout.dart';
import 'package:pandora_employee/features/schedule/domain/task_calendar.dart';
import 'package:pandora_employee/features/tasks/domain/task_record.dart';

TaskRecord task(Map<String, Object?> json) => TaskRecord.fromJson({
      'id': 'task-1',
      'title': '任务',
      'published': true,
      'executionState': 'todo',
      'assigneeIds': ['u1'],
      ...json,
    });

void main() {
  final zone = CompanyTimeZone.fallback;
  final day = const CompanyDate(2026, 11, 12);

  test('定时任务午夜截止不产生次日副本', () {
    final item = CalendarTask(
      task: task({
        'allDay': false,
        'startAt': '2026-11-12T15:59:00Z',
        'dueAt': '2026-11-12T16:00:00Z',
      }),
      pendingProjection: false,
    );
    expect(item.covers(day), isTrue);
    expect(item.covers(day.addDays(1)), isFalse);
  });

  test('旧全天首尾都包含，零时长归开始日', () {
    final allDay = CalendarTask(
      task: task({'allDay': true, 'startDate': '2026-11-12', 'dueDate': '2026-11-14'}),
      pendingProjection: false,
    );
    expect(allDay.covers(day), isTrue);
    expect(allDay.covers(day.addDays(2)), isTrue);
    expect(allDay.covers(day.addDays(3)), isFalse);

    final zero = CalendarTask(
      task: task({'allDay': false, 'startAt': '2026-11-12T02:00:00Z', 'dueAt': '2026-11-12T02:00:00Z'}),
      pendingProjection: false,
    );
    expect(zero.covers(day), isTrue);
    expect(zero.covers(day.addDays(1)), isFalse);
  });

  test('待审任务只按提议排期投影', () {
    final item = CalendarTask(
      task: task({
        'pending': true,
        'frozen': true,
        'allDay': false,
        'startAt': '2026-11-12T02:00:00Z',
        'dueAt': '2026-11-12T03:00:00Z',
        'pendingSchedule': {
          'allDay': false,
          'startAt': '2026-11-20T02:00:00Z',
          'dueAt': '2026-11-20T03:00:00Z',
        },
      }),
      pendingProjection: true,
    );
    expect(item.covers(day), isFalse);
    expect(item.covers(const CompanyDate(2026, 11, 20)), isTrue);
    expect(pseudoItem(item).startDate, const CompanyDate(2026, 11, 20));
  });

  test('完成/逾期状态与首标签颜色同源', () {
    final done = CalendarTask(
      task: task({
        'executionState': 'done',
        'allDay': true,
        'startDate': '2026-11-12',
        'dueDate': '2026-11-12',
        'tags': [
          {'id': 't1', 'name': '红', 'color': '#ff0000'},
          {'id': 't2', 'name': '蓝', 'color': '#0000ff'},
        ],
      }),
      pendingProjection: false,
    );
    expect(done.visualState, DailyItemVisualState.completed);
    expect(done.color, '#ff0000');
    expect(pseudoItem(done).completed, isTrue);
    expect(zone.dateOf(DateTime.utc(2026, 11, 12, 2)), day);
  });
}
