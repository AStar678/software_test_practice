import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/preferences/app_preferences.dart';
import 'package:pandora_employee/features/schedule/presentation/task_calendar_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/test_harness.dart';

Map<String, Object?> dayTask(String id, String date, String title) => {
  'id': id,
  'taskId': id,
  'title': title,
  'description': '',
  'priority': 'medium',
  'allDay': false,
  'startAt': '${date}T02:00:00Z',
  'dueAt': '${date}T10:00:00Z',
  'executionState': 'todo',
  'status': 'applied',
  'assigneeIds': ['u1'],
  'rowVersion': 1,
  'published': true,
  'pending': false,
  'frozen': false,
  'canReschedule': true,
  'canPin': true,
  'canTablePin': true,
  'pinned': false,
  'editableFields': ['startAt', 'dueAt'],
  'participants': [
    {'id': 'u1', 'displayName': '亚里士多德'},
  ],
};

FakeBackend holidayBackend({
  required List<Map<String, Object?>> tasks,
  Map<int, Map<String, Object?>>? years,
  Set<int>? failingYears,
}) {
  final backend = FakeBackend();
  backend.on('GET', '/tasks', (_) => FakeResponse({
    'items': tasks,
    'nextCursor': null,
  }));
  for (final entry in (years ?? const <int, Map<String, Object?>>{}).entries) {
    backend.on(
      'GET',
      '/calendar/holidays/${entry.key}',
      (_) => FakeResponse(entry.value),
    );
  }
  for (final year in failingYears ?? const <int>{}) {
    backend.on(
      'GET',
      '/calendar/holidays/$year',
      (_) => FakeResponse({'message': '暂不可用'}, status: 503),
    );
  }
  return backend;
}

Map<String, Object?> holidayYear(
  int year,
  List<Map<String, Object?>> days, {
  String status = 'ready',
}) => {
  'year': year,
  'region': 'CN',
  'status': status,
  'source': '项目节假日缓存',
  'days': days,
};

Future<void> pumpCalendarAt(
  WidgetTester tester,
  FakeBackend backend,
  String date,
) async {
  SharedPreferences.setMockInitialValues({});
  tester.view.physicalSize = const Size(390, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final prefs = await AppPreferences.load('u1');
  await prefs.setString('calendar.lastDate', date);
  await prefs.setString('calendar.lastOffset', '0');
  final container = buildTestContainer(backend: backend, user: employeeUser());
  addTearDown(container.dispose);
  await tester.pumpWidget(wrapWithScope(container, const TaskCalendarPage()));
  await tester.pumpAndSettle();
}

Future<void> openBar(
  WidgetTester tester,
  String taskId, {
  required String expectedTitle,
}) async {
  final bar = find.byKey(ValueKey('task-bar-$taskId'));
  await tester.scrollUntilVisible(
    bar,
    300,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.pumpAndSettle();
  await tester.tap(bar.hitTestable().first);
  await tester.pumpAndSettle();
  expect(find.text(expectedTitle), findsOneWidget);
}

void main() {
  testWidgets('同日休假与调班标签在清单和日视图一致，普通日不显示占位', (tester) async {
    final backend = holidayBackend(
      tasks: [
        dayTask('t-ny', '2026-01-01', '元旦任务'),
        dayTask('t-normal', '2026-01-02', '普通日任务'),
        dayTask('t-shift', '2026-02-14', '调班任务'),
      ],
      years: {
        2025: holidayYear(2025, [
          {'date': '2025-12-31', 'name': '跨年前夜', 'isOffDay': true},
        ]),
        2026: holidayYear(2026, [
          {'date': '2026-01-01', 'name': '元旦', 'isOffDay': true},
          {'date': '2026-02-14', 'name': '春节调班', 'isOffDay': false},
        ]),
        2027: holidayYear(2027, const [], status: 'missing'),
      },
    );
    await pumpCalendarAt(tester, backend, '2026-01-01');

    await openBar(tester, 't-ny', expectedTitle: '2026-01-01 完整清单');
    expect(find.text('休 元旦'), findsOneWidget);
    expect(find.text('元旦任务'), findsWidgets);
    await tester.tap(find.widgetWithText(OutlinedButton, '日视图'));
    await tester.pumpAndSettle();
    expect(find.text('2026-01-01 日视图'), findsOneWidget);
    expect(find.text('休 元旦'), findsOneWidget, reason: '日视图使用同一节假日记录');
    await tester.tap(find.byTooltip('返回月历'));
    await tester.pumpAndSettle();

    await openBar(tester, 't-normal', expectedTitle: '2026-01-02 完整清单');
    expect(find.textContaining('休 '), findsNothing);
    expect(find.textContaining('班 '), findsNothing);
    expect(find.text('普通日任务'), findsWidgets);
    await tester.tap(find.byTooltip('关闭'));
    await tester.pumpAndSettle();

    await openBar(tester, 't-shift', expectedTitle: '2026-02-14 完整清单');
    expect(find.text('班 春节调班'), findsOneWidget);
    expect(find.text('调班任务'), findsWidgets);
    await tester.tap(find.widgetWithText(OutlinedButton, '日视图'));
    await tester.pumpAndSettle();
    expect(find.text('班 春节调班'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('没有年度记录时不显示节假日标记，也不阻止任务读取', (tester) async {
    final backend = holidayBackend(
      tasks: [dayTask('t-no-year', '2027-01-05', '无年度数据任务')],
      years: {2027: holidayYear(2027, const [], status: 'missing')},
    );
    await pumpCalendarAt(tester, backend, '2027-01-05');
    expect(find.text('本年官方节假日尚未公布'), findsWidgets);
    await openBar(tester, 't-no-year', expectedTitle: '2027-01-05 完整清单');
    expect(find.textContaining('休 '), findsNothing);
    expect(find.textContaining('班 '), findsNothing);
    expect(find.text('无年度数据任务'), findsWidgets);
    expect(tester.takeException(), isNull);
  });

  testWidgets('节假日缓存故障不显示标记且不阻塞当天任务与清单', (tester) async {
    final backend = holidayBackend(
      tasks: [dayTask('t-fail', '2026-03-08', '缓存故障任务')],
      failingYears: {2026},
    );
    await pumpCalendarAt(tester, backend, '2026-03-08');
    await openBar(tester, 't-fail', expectedTitle: '2026-03-08 完整清单');
    expect(find.textContaining('休 '), findsNothing);
    expect(find.textContaining('班 '), findsNothing);
    expect(find.text('缓存故障任务'), findsWidgets);
    expect(find.text('这一天暂无负责的任务'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
