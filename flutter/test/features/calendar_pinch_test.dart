import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/preferences/app_preferences.dart';
import 'package:pandora_employee/core/router/read_context.dart';
import 'package:pandora_employee/features/schedule/presentation/task_calendar_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/test_harness.dart';

Map<String, Object?> denseTask(int index) => {
  'id': 'dense$index',
  'taskId': 'dense$index',
  'title': '密集任务$index',
  'description': '',
  'priority': 'medium',
  'allDay': true,
  'startDate': '2026-11-30',
  'dueDate': '2026-12-02',
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
  'editableFields': ['startDate', 'dueDate'],
  'participants': [
    {'id': 'u1', 'displayName': '亚里士多德'},
  ],
};

FakeBackend denseBackend() {
  final backend = FakeBackend();
  backend.on('GET', '/tasks', (_) => FakeResponse({
    'items': [for (var index = 0; index < 5; index++) denseTask(index)],
    'nextCursor': null,
  }));
  return backend;
}

Future<void> pumpDense(
  WidgetTester tester, {
  String? personId,
  FakeBackend? backend,
}) async {
  SharedPreferences.setMockInitialValues({});
  tester.view.physicalSize = const Size(390, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final prefs = await AppPreferences.load(
    'u1',
    calendarPerson: personId,
  );
  await prefs.setString(
    'calendar.lastDate',
    personId == null ? '2026-11-30' : '2026-11-30',
  );
  await prefs.setString('calendar.lastOffset', '0');
  final container = buildTestContainer(
    backend: backend ?? denseBackend(),
    user: employeeUser(),
  );
  addTearDown(container.dispose);
  await tester.pumpWidget(
    wrapWithScope(
      container,
      personId == null
          ? const TaskCalendarPage()
          : TaskCalendarPage(
              assigneeId: personId,
              personName: '下属',
              readContext: SubordinateReadContext(
                personId: personId,
                personName: '下属',
                chainOrigin: '/people',
              ),
            ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> pinch(
  WidgetTester tester,
  Offset center, {
  required double startGap,
  required double endGap,
  bool cancel = false,
}) async {
  final first = await tester.startGesture(
    center - Offset(0, startGap / 2),
    pointer: 1,
  );
  final second = await tester.startGesture(
    center + Offset(0, startGap / 2),
    pointer: 2,
  );
  await tester.pump(const Duration(milliseconds: 30));
  final delta = (endGap - startGap) / 2;
  await first.moveBy(Offset(0, -delta));
  await second.moveBy(Offset(0, delta));
  await tester.pump(const Duration(milliseconds: 30));
  if (cancel) {
    await first.cancel();
    await second.cancel();
  } else {
    await first.up();
    await second.up();
  }
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('密集跨月夹具双指拉开增加容量并保持锚点，收拢恢复 +N', (tester) async {
    await pumpDense(tester);
    expect(find.text('+2'), findsWidgets, reason: '紧凑周高只放三轨，其余显示 +N');
    expect(find.byKey(const ValueKey('task-bar-dense4')), findsNothing);
    final list = find.byType(ListView).first;
    final scroll = tester.state<ScrollableState>(
      find.descendant(of: list, matching: find.byType(Scrollable)).first,
    );
    final offsetBefore = scroll.position.pixels;
    expect(offsetBefore, greaterThan(0), reason: '起始锚点在 11 月 30 日附近');

    final center = tester.getCenter(list);
    await pinch(tester, center, startGap: 80, endGap: 260);
    expect(find.text('+2'), findsNothing, reason: '拉开后轨道容纳全部任务');
    for (var index = 0; index < 5; index++) {
      expect(
        find.byKey(ValueKey('task-bar-dense$index')),
        findsWidgets,
        reason: '第 $index 条不再隐藏',
      );
    }
    final anchorAfter = tester.getRect(
      find.byKey(const ValueKey('task-bar-dense0')).first,
    );
    expect(anchorAfter.top, greaterThanOrEqualTo(0));
    expect(anchorAfter.bottom, lessThanOrEqualTo(900));
    expect(find.text('2026年11月'), findsOneWidget, reason: '拉开后仍在原月份');
    final scrollAfter = tester.state<ScrollableState>(
      find
          .descendant(
            of: find.byType(ListView).first,
            matching: find.byType(Scrollable),
          )
          .first,
    );
    expect(
      scrollAfter.position.pixels,
      greaterThan(0),
      reason: '以可见日期和滚动锚点维持位置，不跳回月首',
    );

    final prefs = await AppPreferences.load('u1');
    expect(prefs.getString('calendar.weekHeight'), isNotNull);

    await pinch(tester, center, startGap: 260, endGap: 80);
    expect(find.textContaining('+'), findsWidgets, reason: '收拢后按新容量重新计算 +N');
    expect(tester.takeException(), isNull);
  });

  testWidgets('双指后单指滚动、短按和取消都可用且不发出写请求', (tester) async {
    final backend = denseBackend();
    await pumpDense(tester, backend: backend);
    final list = find.byType(ListView).first;
    final center = tester.getCenter(list);
    final scroll = tester.state<ScrollableState>(
      find.descendant(of: list, matching: find.byType(Scrollable)).first,
    );
    final offset = scroll.position.pixels;

    await pinch(tester, center, startGap: 80, endGap: 240, cancel: true);
    expect(
      find.textContaining('完整清单'),
      findsNothing,
      reason: '双指取消不打开清单',
    );
    await tester.drag(list, const Offset(0, -180));
    await tester.pumpAndSettle();
    expect(
      scroll.position.pixels,
      isNot(offset),
      reason: '双指取消后单指滚动恢复',
    );

    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 320)),
    );
    await tester.tap(
      find.byKey(const ValueKey('task-bar-dense0')).hitTestable().first,
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('完整清单'), findsOneWidget, reason: '双指后短按仍可查看清单');
    expect(
      backend.requests.where((request) => request.method != 'GET'),
      isEmpty,
      reason: '密度手势不发出任何写请求',
    );

    await tester.tap(find.byTooltip('关闭'));
    await tester.pumpAndSettle();

    // 双指按在任务条上超过长按阈值并移动，不应进入排期拖动确认。
    final barCenter = tester.getCenter(
      find.byKey(const ValueKey('task-bar-dense0')).hitTestable().first,
    );
    final firstFinger = await tester.startGesture(
      barCenter - const Offset(0, 20),
      pointer: 3,
    );
    final secondFinger = await tester.startGesture(
      barCenter + const Offset(0, 20),
      pointer: 4,
    );
    await tester.pump(const Duration(milliseconds: 600));
    await firstFinger.moveBy(const Offset(0, -50));
    await secondFinger.moveBy(const Offset(0, 50));
    await tester.pump(const Duration(milliseconds: 50));
    await firstFinger.up();
    await secondFinger.up();
    await tester.pumpAndSettle();
    expect(find.text('确认调整排期'), findsNothing, reason: '双指不触发长按改期');
    expect(
      backend.requests.where((request) => request.method != 'GET'),
      isEmpty,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('密度偏好按本人和不同下属隔离', (tester) async {
    await pumpDense(tester);
    final center = tester.getCenter(find.byType(ListView).first);
    await pinch(tester, center, startGap: 80, endGap: 260);
    final own = await AppPreferences.load('u1');
    expect(double.parse(own.getString('calendar.weekHeight')!), greaterThan(86));

    await pumpDense(tester, personId: 'p1');
    expect(
      find.text('+2'),
      findsWidgets,
      reason: '另一位人员不继承本人放大的周高',
    );
    final first = await AppPreferences.load('u1', calendarPerson: 'p1');
    expect(first.getString('calendar.weekHeight'), isNull);
    expect(tester.takeException(), isNull);
  });
}
