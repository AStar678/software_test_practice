import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/preferences/app_preferences.dart';
import 'package:pandora_employee/core/router/read_context.dart';
import 'package:pandora_employee/core/widgets/fading_name_text.dart';
import 'package:pandora_employee/features/schedule/presentation/task_calendar_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/test_harness.dart';

Map<String, Object?> statusTask({
  required String id,
  required String title,
  String date = '2026-11-10',
  bool allDay = false,
  bool done = false,
  bool pending = false,
  Map<String, Object?>? pendingSchedule,
}) => {
  'id': id,
  'taskId': id,
  'title': title,
  'description': '',
  'priority': 'medium',
  'allDay': allDay,
  'startAt': allDay ? null : '${date}T02:00:00Z',
  'dueAt': allDay ? null : '${date}T10:00:00Z',
  'startDate': allDay ? date : null,
  'dueDate': allDay ? date : null,
  'executionState': done ? 'done' : 'todo',
  'status': 'applied',
  'assigneeIds': ['u1'],
  'rowVersion': 1,
  'published': true,
  'pending': pending,
  'frozen': pending,
  'pendingKind': pending ? 'reschedule' : null,
  'pendingSchedule': pendingSchedule,
  'canReschedule': true,
  'canPin': true,
  'canTablePin': true,
  'pinned': false,
  'editableFields': ['startAt', 'dueAt'],
  'participants': [
    {'id': 'u1', 'displayName': '亚里士多德'},
  ],
};

FakeBackend statusBackend() {
  final backend = FakeBackend();
  backend.on('GET', '/tasks', (_) => FakeResponse({
    'items': [
      statusTask(id: 't-done', title: '已完成任务', done: true),
      statusTask(
        id: 't-pending',
        title: '待审无提议任务',
        date: '2026-11-11',
        pending: true,
      ),
      statusTask(
        id: 't-proposal',
        title: '待审有提议任务',
        date: '2026-11-12',
        pending: true,
        pendingSchedule: {
          'allDay': false,
          'startAt': '2026-11-20T02:00:00Z',
          'dueAt': '2026-11-20T10:00:00Z',
        },
      ),
      statusTask(
        id: 't-allday-done',
        title: '全天已完成',
        date: '2026-11-13',
        allDay: true,
        done: true,
      ),
      statusTask(
        id: 't-allday-pending',
        title: '全天待审',
        date: '2026-11-14',
        allDay: true,
        pending: true,
      ),
    ],
    'nextCursor': null,
  }));
  return backend;
}

Future<void> pumpStatusCalendar(
  WidgetTester tester, {
  ReadContext readContext = const NormalReadContext(),
}) async {
  SharedPreferences.setMockInitialValues({});
  tester.view.physicalSize = const Size(390, 1000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final prefs = await AppPreferences.load('u1');
  await prefs.setString('calendar.lastDate', '2026-11-10');
  await prefs.setString('calendar.lastOffset', '0');
  final backend = statusBackend();
  final container = buildTestContainer(backend: backend, user: employeeUser());
  addTearDown(container.dispose);
  await tester.pumpWidget(
    wrapWithScope(
      container,
      TaskCalendarPage(readContext: readContext),
    ),
  );
  await tester.pumpAndSettle();
}

CustomPaint dash(WidgetTester tester, String key) =>
    tester.widget<CustomPaint>(find.byKey(ValueKey(key)));

TextStyle? textStyle(WidgetTester tester, String title) {
  final texts = tester.widgetList<Text>(find.text(title)).toList();
  return texts.isEmpty ? null : texts.first.style;
}

TextStyle? nameStyle(WidgetTester tester, String title) {
  final widgets = tester
      .widgetList<FadingNameText>(find.byType(FadingNameText))
      .where((widget) => widget.text == title)
      .toList();
  return widgets.isEmpty ? null : widgets.first.style;
}

Future<void> openDay(WidgetTester tester) async {
  await tester.tap(
    find.byKey(const ValueKey('task-bar-t-done')).hitTestable().first,
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('完成删除线与待审虚线覆盖月条、清单、日轴和全天区', (tester) async {
    await pumpStatusCalendar(tester);

    expect(
      dash(tester, 'task-bar-dash-t-done').foregroundPainter,
      isNull,
      reason: '有效任务不画虚线',
    );
    expect(
      dash(tester, 'task-bar-dash-t-pending').foregroundPainter,
      isNotNull,
      reason: '待审无提议仍画虚线',
    );
    expect(
      dash(tester, 'task-bar-dash-t-proposal').foregroundPainter,
      isNotNull,
      reason: '待审有提议仍画虚线',
    );
    expect(
      find.byKey(const ValueKey('task-bar-t-proposal')),
      findsOneWidget,
      reason: '有合法提议时只在提议日期绘制，不复制到有效日期',
    );
    expect(
      nameStyle(tester, '已完成任务')?.decoration,
      TextDecoration.lineThrough,
    );
    expect(nameStyle(tester, '待审无提议任务')?.decoration, isNull);

    await openDay(tester);
    expect(find.text('2026-11-10 完整清单'), findsOneWidget);
    expect(
      nameStyle(tester, '已完成任务')?.decoration,
      TextDecoration.lineThrough,
      reason: '清单也用删除线识别完成',
    );
    await tester.tap(find.widgetWithText(OutlinedButton, '日视图'));
    await tester.pumpAndSettle();
    expect(
      nameStyle(tester, '已完成任务')?.decoration,
      TextDecoration.lineThrough,
      reason: '日轴完成删除线',
    );
    await tester.tap(find.byTooltip('返回月历'));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('task-bar-t-pending')),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(
      find.byKey(const ValueKey('task-bar-t-pending')).hitTestable().first,
    );
    await tester.pumpAndSettle();
    expect(find.text('2026-11-11 完整清单'), findsOneWidget);
    expect(
      dash(tester, 'day-list-dash-t-pending').foregroundPainter,
      isNotNull,
      reason: '清单待审有虚线',
    );
    await tester.tap(find.widgetWithText(OutlinedButton, '日视图'));
    await tester.pumpAndSettle();
    expect(
      dash(tester, 'axis-dash-t-pending').foregroundPainter,
      isNotNull,
      reason: '日轴待审虚线不依赖是否有提议',
    );
    await tester.tap(find.byTooltip('返回月历'));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('task-bar-t-allday-done')),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(
      find.byKey(const ValueKey('task-bar-t-allday-done')).hitTestable().first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(OutlinedButton, '日视图'));
    await tester.pumpAndSettle();
    expect(
      textStyle(tester, '全天已完成')?.decoration,
      TextDecoration.lineThrough,
      reason: '全天区完成删除线',
    );
    await tester.tap(find.byTooltip('返回月历'));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('task-bar-t-allday-pending')),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(
      find.byKey(const ValueKey('task-bar-t-allday-pending')).hitTestable().first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(OutlinedButton, '日视图'));
    await tester.pumpAndSettle();
    expect(
      dash(tester, 'all-day-dash-t-allday-pending').foregroundPainter,
      isNotNull,
      reason: '全天区待审虚线',
    );
    expect(
      nameStyle(tester, '待审有提议任务'),
      isNull,
      reason: '有效日期清单不混入提议占位',
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('下属只读仍能看见待审虚线，但不获得拖拽或置顶写动作', (tester) async {
    await pumpStatusCalendar(
      tester,
      readContext: const SubordinateReadContext(
        personId: 'u1',
        personName: '下属',
        chainOrigin: '/people',
      ),
    );

    expect(
      dash(tester, 'task-bar-dash-t-pending').foregroundPainter,
      isNotNull,
      reason: '只读也能辨认待审状态',
    );
    expect(find.byKey(const ValueKey('task-start-t-pending')), findsNothing);
    expect(find.byKey(const ValueKey('task-end-t-pending')), findsNothing);
    expect(find.byKey(const ValueKey('task-start-t-done')), findsNothing);
    expect(find.byTooltip('任务表单'), findsNothing);
    expect(find.byTooltip('新建任务'), findsNothing);

    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('task-bar-t-pending')),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(
      find.byKey(const ValueKey('task-bar-t-pending')).hitTestable().first,
    );
    await tester.pumpAndSettle();
    expect(
      dash(tester, 'day-list-dash-t-pending').foregroundPainter,
      isNotNull,
    );
    expect(find.byTooltip('置顶到我的月视图'), findsNothing);
    await tester.tap(find.widgetWithText(OutlinedButton, '日视图'));
    await tester.pumpAndSettle();
    expect(
      dash(tester, 'axis-dash-t-pending').foregroundPainter,
      isNotNull,
    );
    expect(find.byKey(const ValueKey('axis-task-t-pending')), findsNothing);
    expect(find.byKey(const ValueKey('axis-start-t-pending')), findsNothing);
    expect(find.byKey(const ValueKey('axis-end-t-pending')), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
