import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/features/schedule/presentation/task_calendar_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/test_harness.dart';

Map<String, Object?> calendarTask({
  required String id,
  required String title,
  required bool allDay,
  String? startAt,
  String? dueAt,
  String? startDate,
  String? dueDate,
  bool pending = false,
}) => {
      'id': id,
      'taskId': id,
      'title': title,
      'description': '',
      'priority': 'medium',
      'allDay': allDay,
      'startAt': startAt,
      'dueAt': dueAt,
      'startDate': startDate,
      'dueDate': dueDate,
      'executionState': 'todo',
      'status': 'applied',
      'assigneeIds': ['u1'],
      'rowVersion': 1,
      'published': true,
      'pending': pending,
      'frozen': pending,
      'canReschedule': true,
      'canPin': true,
      'canTablePin': true,
      'tablePinned': false,
      'pinned': false,
      'editableFields': ['startAt', 'dueAt'],
      'participants': [
        {'id': 'u1', 'displayName': '亚里士多德'},
      ],
    };

void main() {
  testWidgets('本人月历命中日打开局部抽屉，并可切换横纵日轴', (tester) async {
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final backend = FakeBackend();
    backend.on('GET', '/tasks', (request) async => FakeResponse({
          'items': [
            calendarTask(
              id: 'timed',
              title: '定时任务',
              allDay: false,
              startAt: '2026-11-10T02:00:00Z',
              dueAt: '2026-11-10T03:00:00Z',
            ),
            calendarTask(
              id: 'all',
              title: '全天任务',
              allDay: true,
              startDate: '2026-11-10',
              dueDate: '2026-11-10',
            ),
          ],
          'nextCursor': null,
        }));
    final container = buildTestContainer(backend: backend, user: employeeUser());
    addTearDown(container.dispose);

    await tester.pumpWidget(wrapWithScope(container, const TaskCalendarPage()));
    await tester.pumpAndSettle();

    expect(find.text('2026年11月'), findsOneWidget);
    await tester.tap(find.text('定时任务').hitTestable().first);
    await tester.pumpAndSettle();

    expect(find.text('2026-11-10 完整清单'), findsOneWidget);
    final drawer = find.byType(Drawer);
    expect(drawer, findsOneWidget);
    expect(tester.getSize(drawer).width, closeTo(390 * .42, .5));
    expect(find.descendant(of: drawer, matching: find.text('定时任务')), findsOneWidget);
    expect(find.descendant(of: drawer, matching: find.text('全天任务')), findsOneWidget);

    await tester.tap(find.widgetWithText(OutlinedButton, '日轴'));
    await tester.pumpAndSettle();
    expect(find.text('00:00'), findsWidgets);
    expect(find.widgetWithText(OutlinedButton, '横向'), findsOneWidget);

    await tester.tap(find.widgetWithText(OutlinedButton, '横向'));
    await tester.pumpAndSettle();
    expect(find.text('全天'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, '纵向'), findsOneWidget);

    await tester.tap(find.byTooltip('关闭'));
    await tester.pumpAndSettle();
    expect(find.byType(Drawer), findsNothing);
    expect(find.text('2026年11月'), findsOneWidget);
  });

  testWidgets('跨日条按实际触点日期打开清单，不固定回条首日', (tester) async {
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final backend = FakeBackend();
    backend.on('GET', '/tasks', (request) async => FakeResponse({
          'items': [
            calendarTask(
              id: 'span',
              title: '跨日任务',
              allDay: true,
              startDate: '2026-11-10',
              dueDate: '2026-11-12',
            ),
          ],
          'nextCursor': null,
        }));
    final container = buildTestContainer(backend: backend, user: employeeUser());
    addTearDown(container.dispose);

    await tester.pumpWidget(wrapWithScope(container, const TaskCalendarPage()));
    await tester.pumpAndSettle();

    final bar = find.byKey(const ValueKey('task-bar-span')).hitTestable().first;
    final rect = tester.getRect(bar);
    await tester.tapAt(Offset(rect.right - 6, rect.center.dy));
    await tester.pumpAndSettle();

    expect(find.text('2026-11-12 完整清单'), findsOneWidget);
  });
}
