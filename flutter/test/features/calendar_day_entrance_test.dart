import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:pandora_employee/core/preferences/app_preferences.dart';
import 'package:pandora_employee/core/router/read_context.dart';
import 'package:pandora_employee/core/theme/pandora_theme.dart';
import 'package:pandora_employee/features/schedule/presentation/task_calendar_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/test_harness.dart';

Map<String, Object?> calendarTaskJson({
  String id = 't1',
  String title = '入口任务',
  String startAt = '2026-11-10T02:00:00Z',
  String dueAt = '2026-11-10T10:00:00Z',
}) => {
  'id': id,
  'taskId': id,
  'title': title,
  'description': '',
  'priority': 'medium',
  'allDay': false,
  'startAt': startAt,
  'dueAt': dueAt,
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

FakeBackend calendarBackend({List<Map<String, Object?>>? tasks}) {
  final backend = FakeBackend();
  backend.on(
    'GET',
    '/tasks',
    (_) => FakeResponse({
      'items': tasks ?? [calendarTaskJson()],
      'nextCursor': null,
    }),
  );
  backend.on(
    'GET',
    '/tasks/t1',
    (_) => FakeResponse(calendarTaskJson(), etag: '"1"'),
  );
  return backend;
}

Widget routerApp(ProviderContainer container, GoRouter router) =>
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        theme: PandoraTheme.build(),
        routerConfig: router,
      ),
    );

void main() {
  testWidgets('键盘打开月格清单后可关闭并用同一焦点重开', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final container = buildTestContainer(
      backend: calendarBackend(),
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, calendarPage(null)));
    await tester.pumpAndSettle();
    final dateNumber = find
        .descendant(
          of: find.byKey(const ValueKey('task-date-header-2026-11-10')),
          matching: find.text('10'),
        )
        .hitTestable();
    final before = tester.getRect(dateNumber);
    Focus.of(tester.element(dateNumber)).requestFocus();
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pumpAndSettle();
    expect(find.text('2026-11-10 完整清单'), findsOneWidget);

    await tester.tap(find.byTooltip('关闭'));
    await tester.pumpAndSettle();
    expect(tester.getRect(dateNumber), before);
    expect(Focus.of(tester.element(dateNumber)).hasPrimaryFocus, isTrue);
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pumpAndSettle();
    expect(find.text('2026-11-10 完整清单'), findsOneWidget);
  });

  for (final personId in <String?>[null, 'p1']) {
    testWidgets('顶栏直进未缓存的公司今天并恢复月历锚点 ($personId)', (tester) async {
      SharedPreferences.setMockInitialValues({});
      tester.view.physicalSize = const Size(390, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final prefs = await AppPreferences.load('u1', calendarPerson: personId);
      await prefs.setString('calendar.lastDate', '2027-04-15');
      await prefs.setString('calendar.lastOffset', '0');

      final backend = calendarBackend(tasks: const []);
      final response = Completer<FakeResponse>();
      var todayRequests = 0;
      backend.on('GET', '/tasks', (request) {
        if (request.query['from'] != '2026-10-25') {
          return FakeResponse({'items': [], 'nextCursor': null});
        }
        expect(request.query['assigneeId'], personId ?? 'u1');
        if (++todayRequests == 1) return response.future;
        return FakeResponse({
          'items': [calendarTaskJson()],
          'nextCursor': null,
        });
      });
      final container = buildTestContainer(
        backend: backend,
        user: employeeUser(),
      );
      addTearDown(container.dispose);
      final router = GoRouter(
        initialLocation: '/schedule',
        routes: [
          GoRoute(
            path: '/schedule',
            builder: (context, state) => calendarPage(personId),
          ),
          GoRoute(
            path: '/tasks/:id',
            builder: (context, state) =>
                Scaffold(body: Text('任务详情页 ${state.pathParameters['id']}')),
          ),
        ],
      );
      addTearDown(router.dispose);
      await tester.pumpWidget(routerApp(container, router));
      await tester.pumpAndSettle();

      expect(find.text('2027年4月'), findsOneWidget);
      expect(todayRequests, 0);
      final before = tester
          .state<ScrollableState>(find.byType(Scrollable).first)
          .position
          .pixels;
      expect(find.byTooltip('日视图'), findsOneWidget);
      expect(find.byTooltip('返回月历'), findsNothing);

      await tester.tap(find.byTooltip('日视图'));
      await tester.pump();
      const date = '2026-11-10';
      expect(find.text('$date 日视图'), findsOneWidget);
      expect(find.text('加载中'), findsOneWidget);
      expect(find.text('这一天暂无负责的任务'), findsNothing);
      response.complete(FakeResponse({'message': '暂不可用'}, status: 503));
      await tester.pumpAndSettle();
      expect(find.text('加载失败'), findsOneWidget);
      expect(find.text('这一天暂无负责的任务'), findsNothing);
      await tester.tap(find.text('重试'));
      await tester.pumpAndSettle();
      expect(todayRequests, 2);
      expect(find.byTooltip('返回月历'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, '清单'), findsOneWidget);

      await tester.tap(find.widgetWithText(OutlinedButton, '清单'));
      await tester.pumpAndSettle();
      expect(find.text('$date 完整清单'), findsOneWidget);
      expect(find.byKey(const ValueKey('day-list-dash-t1')), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, '日视图'), findsOneWidget);

      await tester.tap(find.widgetWithText(OutlinedButton, '日视图'));
      await tester.pumpAndSettle();
      expect(find.text('$date 日视图'), findsOneWidget, reason: '往返仍是同一天');

      await tester.tap(find.byTooltip('返回月历'));
      await tester.pumpAndSettle();
      expect(find.text('2027年4月'), findsOneWidget);
      expect(find.textContaining('日视图'), findsNothing);
      final after = tester
          .state<ScrollableState>(find.byType(Scrollable).first)
          .position
          .pixels;
      expect(after, closeTo(before, 1), reason: '返回月历恢复进入前的滚动锚点');
      expect(tester.takeException(), isNull);
    });

    testWidgets('今天只给日期行加粉底，任务和空白可点 ($personId)', (tester) async {
      SharedPreferences.setMockInitialValues({});
      tester.view.physicalSize = const Size(390, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final container = buildTestContainer(
        backend: calendarBackend(),
        user: employeeUser(),
      );
      addTearDown(container.dispose);
      await tester.pumpWidget(wrapWithScope(container, calendarPage(personId)));
      await tester.pumpAndSettle();

      final header = find
          .byKey(const ValueKey('task-date-header-2026-11-10'))
          .hitTestable();
      final next = find
          .byKey(const ValueKey('task-date-header-2026-11-11'))
          .hitTestable();
      final paint = find
          .byKey(const ValueKey('task-bar-dash-t1'))
          .hitTestable();
      final bar = find.byKey(const ValueKey('task-bar-t1')).hitTestable();
      final cell = find
          .ancestor(of: header, matching: find.byType(InkWell))
          .first;
      expect(
        (tester.widget<DecoratedBox>(header).decoration as BoxDecoration).color,
        PandoraColors.petal,
      );
      expect(
        (tester.widget<DecoratedBox>(next).decoration as BoxDecoration).color,
        isNull,
      );
      expect(
        tester.getRect(header).bottom,
        lessThanOrEqualTo(tester.getRect(bar).top),
      );
      expect(
        tester.getSize(cell).height,
        greaterThan(tester.getSize(header).height),
      );
      final taskBackground = tester.widget<Container>(
        find.descendant(of: paint, matching: find.byType(Container)).first,
      );
      expect(
        (taskBackground.decoration as BoxDecoration).color,
        const Color(0xffffe1ea),
      );
      await tester.tap(bar);
      await tester.pumpAndSettle();
      expect(find.text('2026-11-10 完整清单'), findsOneWidget);
      await tester.tap(find.byTooltip('关闭'));
      await tester.pumpAndSettle();
      await tester.tapAt(
        tester.getRect(cell).bottomCenter - const Offset(0, 5),
      );
      await tester.pumpAndSettle();
      expect(find.text('2026-11-10 完整清单'), findsOneWidget);
    });
  }

  testWidgets('从月条打开清单、看详情返回仍保留清单与日期，关闭恢复月历位置', (tester) async {
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final prefs = await AppPreferences.load('u1');
    await prefs.setString('calendar.lastDate', '2026-11-10');
    await prefs.setString('calendar.lastOffset', '0');

    final backend = calendarBackend(
      tasks: [
        calendarTaskJson(
          startAt: '2026-11-11T02:00:00Z',
          dueAt: '2026-11-11T10:00:00Z',
        ),
      ],
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    final router = GoRouter(
      initialLocation: '/schedule',
      routes: [
        GoRoute(
          path: '/schedule',
          builder: (context, state) => const TaskCalendarPage(),
        ),
        GoRoute(
          path: '/tasks/:id',
          builder: (context, state) =>
              Scaffold(body: Text('任务详情页 ${state.pathParameters['id']}')),
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(routerApp(container, router));
    await tester.pumpAndSettle();
    final before = tester
        .state<ScrollableState>(find.byType(Scrollable).first)
        .position
        .pixels;

    await tester.tap(
      find.byKey(const ValueKey('task-bar-t1')).hitTestable().first,
    );
    await tester.pumpAndSettle();
    expect(find.text('2026-11-11 完整清单'), findsOneWidget);
    expect(find.byTooltip('返回月历'), findsOneWidget);

    await tester.tap(namePreview('入口任务').hitTestable().first);
    await tester.pumpAndSettle();
    expect(find.text('任务详情页 t1'), findsOneWidget);
    router.pop();
    await tester.pumpAndSettle();
    expect(find.text('2026-11-11 完整清单'), findsOneWidget, reason: '详情返回保留来源清单');
    expect(namePreview('入口任务'), findsWidgets);

    await tester.tap(find.byTooltip('关闭'));
    await tester.pumpAndSettle();
    expect(find.text('2026年11月'), findsOneWidget);
    final after = tester
        .state<ScrollableState>(find.byType(Scrollable).first)
        .position
        .pixels;
    expect(after, closeTo(before, 1));
    expect(find.byTooltip('日视图'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('切换本人和下属后不继承对方的日视图状态', (tester) async {
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final p1Prefs = await AppPreferences.load('u1', calendarPerson: 'p1');
    await p1Prefs.setString('calendar.lastDate', '2026-12-15');
    await p1Prefs.setString('calendar.lastOffset', '0');

    final backend = calendarBackend(tasks: const []);
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    Widget page(String id) => TaskCalendarPage(
      assigneeId: id,
      personName: id == 'p1' ? '下属一' : '下属二',
      readContext: SubordinateReadContext(
        personId: id,
        personName: id == 'p1' ? '下属一' : '下属二',
        chainOrigin: '/people',
      ),
    );

    await tester.pumpWidget(wrapWithScope(container, page('p1')));
    await tester.pumpAndSettle();
    expect(find.text('2026年12月'), findsOneWidget);
    await tester.tap(find.byTooltip('日视图'));
    await tester.pumpAndSettle();
    expect(find.text('2026-11-10 日视图'), findsOneWidget);

    await tester.pumpWidget(wrapWithScope(container, page('p2')));
    await tester.pumpAndSettle();
    expect(find.byTooltip('日视图'), findsOneWidget);
    expect(find.byTooltip('返回月历'), findsNothing);
    expect(find.textContaining('日视图'), findsNothing);
    expect(find.text('2026年11月'), findsOneWidget, reason: '另一位下属回到自己的业务日');
    expect(tester.takeException(), isNull);
  });
}

TaskCalendarPage calendarPage(String? personId) => personId == null
    ? const TaskCalendarPage()
    : TaskCalendarPage(
        assigneeId: personId,
        personName: '下属',
        readContext: SubordinateReadContext(
          personId: personId,
          personName: '下属',
          chainOrigin: '/people',
        ),
      );
