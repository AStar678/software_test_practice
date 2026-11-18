import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/features/schedule/presentation/task_calendar_page.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:pandora_employee/core/router/read_context.dart';
import 'package:pandora_employee/core/preferences/app_preferences.dart';

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
  for (final state in ['subordinate', 'done', 'pending']) {
    testWidgets('$state月条短按实际续接日可打开清单，无排期写入', (tester) async {
      SharedPreferences.setMockInitialValues({});
      tester.view.physicalSize = const Size(390, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final backend = FakeBackend();
      backend.on(
        'GET',
        '/tasks',
        (_) => FakeResponse({
          'items': [
            {
              ...calendarTask(
                id: 'read',
                title: '不可拖动续接任务',
                allDay: false,
                startAt: '2026-11-09T01:00:00Z',
                dueAt: '2026-11-12T10:00:00Z',
                pending: state == 'pending',
              ),
              if (state == 'done') 'executionState': 'done',
            },
          ],
          'nextCursor': null,
        }),
      );
      final container = buildTestContainer(
        backend: backend,
        user: employeeUser(),
      );
      addTearDown(container.dispose);
      await tester.pumpWidget(
        wrapWithScope(
          container,
          TaskCalendarPage(
            readContext: state == 'subordinate'
                ? const SubordinateReadContext(
                    personId: 'u1',
                    personName: '员工',
                    chainOrigin: '/people',
                  )
                : const NormalReadContext(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final bar = find
          .byKey(const ValueKey('task-bar-read'))
          .hitTestable()
          .first;
      final rect = tester.getRect(bar);
      // Third of the four occupied columns: Wednesday, not the start Monday.
      await tester.tapAt(Offset(rect.left + rect.width * .625, rect.center.dy));
      await tester.pumpAndSettle();
      expect(find.text('2026-11-11 完整清单'), findsOneWidget);
      expect(find.byType(Drawer), findsOneWidget);
      expect(backend.requests.where((r) => r.method != 'GET'), isEmpty);
    });
  }

  testWidgets('本人月历命中日打开局部抽屉，并可切换横纵日轴', (tester) async {
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final backend = FakeBackend();
    backend.on(
      'GET',
      '/tasks',
      (request) async => FakeResponse({
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
      }),
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
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
    expect(
      find.descendant(of: drawer, matching: find.text('定时任务')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: drawer, matching: find.text('全天任务')),
      findsOneWidget,
    );

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
    backend.on(
      'GET',
      '/tasks',
      (request) async => FakeResponse({
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
      }),
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(wrapWithScope(container, const TaskCalendarPage()));
    await tester.pumpAndSettle();

    final bar = find.byKey(const ValueKey('task-bar-span')).hitTestable().first;
    final rect = tester.getRect(bar);
    await tester.tapAt(Offset(rect.right - 30, rect.center.dy));
    await tester.pumpAndSettle();

    expect(find.text('2026-11-12 完整清单'), findsOneWidget);
  });
  for (final subordinate in [false, true]) {
    testWidgets('${subordinate ? "下属" : "本人"}月历稀疏溢出保持实际周日列，三轨与固定溢出行互不重叠', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({});
      tester.view.physicalSize = const Size(320, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final backend = FakeBackend();
      backend.on(
        'GET',
        '/tasks',
        (_) => FakeResponse({
          'items': [
            for (var index = 0; index < 4; index++)
              calendarTask(
                id: 'sun$index',
                title: '周日任务$index',
                allDay: true,
                startDate: '2026-11-01',
                dueDate: '2026-11-01',
              ),
            for (var index = 0; index < 3; index++)
              calendarTask(
                id: 'lane$index',
                title: '稀疏轨道$index',
                allDay: true,
                startDate: '2026-11-09',
                dueDate: '2026-11-14',
              ),
            calendarTask(
              id: 'hidden',
              title: '跨到周日隐藏项',
              allDay: true,
              startDate: '2026-11-10',
              dueDate: '2026-11-15',
            ),
          ],
          'nextCursor': null,
        }),
      );
      final container = buildTestContainer(
        backend: backend,
        user: employeeUser(),
      );
      addTearDown(container.dispose);
      await tester.pumpWidget(
        wrapWithScope(
          container,
          TaskCalendarPage(
            assigneeId: subordinate ? 'p1' : null,
            readContext: subordinate
                ? const SubordinateReadContext(
                    personId: 'p1',
                    personName: '下属',
                    chainOrigin: 'me',
                  )
                : const NormalReadContext(),
            personName: subordinate ? '下属' : null,
          ),
        ),
      );
      await tester.pumpAndSettle();
      final overflow = find
          .byKey(const ValueKey('task-overflow-2026-11-01'))
          .first;
      await tester.ensureVisible(overflow);
      await tester.pumpAndSettle();
      final counter = tester.getRect(overflow);
      for (var lane = 0; lane < 3; lane++) {
        final bar = tester.getRect(find.text('周日任务$lane').first);
        expect(bar.bottom, lessThanOrEqualTo(counter.top));
        expect(
          counter.center.dx,
          closeTo(bar.center.dx, 4),
          reason: '只有周日溢出，仍位于周日列',
        );
      }
      await tester.tap(overflow);
      await tester.pumpAndSettle();
      expect(find.text('2026-11-01 完整清单'), findsOneWidget);
      final drawer = find.byType(Drawer);
      for (var index = 0; index < 4; index++) {
        final entry = find.descendant(
          of: drawer,
          matching: find.text('周日任务$index'),
        );
        await tester.scrollUntilVisible(
          entry,
          120,
          scrollable: find
              .descendant(of: drawer, matching: find.byType(Scrollable))
              .last,
        );
        expect(
          find.descendant(of: drawer, matching: find.text('周日任务$index')),
          findsOneWidget,
        );
      }
      await tester.tap(find.byTooltip('关闭'));
      await tester.pumpAndSettle();
      final sparse = find
          .byKey(const ValueKey('task-overflow-2026-11-15'))
          .first;
      await tester.ensureVisible(sparse);
      await tester.pumpAndSettle();
      await tester.tap(sparse);
      await tester.pumpAndSettle();
      expect(find.text('2026-11-15 完整清单'), findsOneWidget);
      expect(
        find.descendant(
          of: find.byType(Drawer),
          matching: find.text('跨到周日隐藏项'),
        ),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets('连续月历突破原37个月边界，双向裁剪后恢复实际日期和偏移', (tester) async {
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/tasks',
      (_) => FakeResponse({'items': [], 'nextCursor': null}),
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
      accountEpoch: () => 1,
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const TaskCalendarPage()));
    await tester.pumpAndSettle();
    ScrollController controller() =>
        tester.widget<ListView>(find.byType(ListView).first).controller!;
    for (var index = 0; index < 30; index++) {
      controller().jumpTo(controller().position.maxScrollExtent - 1);
      await tester.pumpAndSettle();
    }
    expect(
      backend
          .requestsFor('GET', '/tasks')
          .any((r) => r.query['from'].toString().startsWith('2029')),
      isTrue,
    );
    for (var index = 0; index < 45; index++) {
      controller().jumpTo(0);
      await tester.pumpAndSettle();
    }
    expect(
      backend
          .requestsFor('GET', '/tasks')
          .any((r) => r.query['from'].toString().startsWith('2024')),
      isTrue,
    );
    expect(
      controller().position.maxScrollExtent,
      lessThan(8000),
      reason: '月份窗口裁剪为最多12个月',
    );
    await tester.pump(const Duration(milliseconds: 700));
    final prefs = await AppPreferences.load('u1');
    final savedDate = prefs.getString('calendar.lastDate');
    final savedOffset = double.parse(prefs.getString('calendar.lastOffset')!);
    expect(savedDate, isNotNull);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    await tester.pumpWidget(wrapWithScope(container, const TaskCalendarPage()));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(milliseconds: 700));
    expect(prefs.getString('calendar.lastDate'), savedDate);
    expect(
      double.parse(prefs.getString('calendar.lastOffset')!),
      closeTo(savedOffset, 1),
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('密度恢复遇刷新取消后仍能继续补载月份', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/tasks',
      (_) => FakeResponse({'items': [], 'nextCursor': null}),
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
      accountEpoch: () => 1,
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const TaskCalendarPage()));
    await tester.pumpAndSettle();
    final density = tester.widget<IconButton>(
      find.byWidgetPredicate(
        (widget) => widget is IconButton && widget.tooltip == '切换舒适密度',
      ),
    );
    density.onPressed!();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      tester
          .widget<RefreshIndicator>(find.byType(RefreshIndicator))
          .onRefresh();
    });
    await tester.pumpAndSettle();
    for (var index = 0; index < 8; index++) {
      final scroll = tester
          .widget<ListView>(find.byType(ListView).first)
          .controller!;
      scroll.jumpTo(scroll.position.maxScrollExtent - 1);
      await tester.pumpAndSettle();
    }
    expect(
      backend
          .requestsFor('GET', '/tasks')
          .any((r) => r.query['from'].toString().startsWith('2027')),
      isTrue,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('本人和两位下属日期/密度/方向独立，放大字体恢复后今天仍回实际业务日', (tester) async {
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(320, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final own = await AppPreferences.load('u1');
    await own.setString('calendar.lastDate', '2026-11-10');
    final first = await AppPreferences.load('u1', calendarPerson: 'p1');
    await first.setString('calendar.lastDate', '2028-03-12');
    await first.setString('calendar.density', 'comfortable');
    await first.setString('calendar.mode', 'vertical');
    final second = await AppPreferences.load('u1', calendarPerson: 'p2');
    await second.setString('calendar.lastDate', '2024-01-16');
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/tasks',
      (_) => FakeResponse({'items': [], 'nextCursor': null}),
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
      accountEpoch: () => 1,
    );
    addTearDown(container.dispose);
    Widget page(String id) => wrapWithScope(
      container,
      MediaQuery(
        data: const MediaQueryData(
          size: Size(320, 900),
          textScaler: TextScaler.linear(1.6),
        ),
        child: TaskCalendarPage(
          assigneeId: id,
          personName: '下属',
          readContext: SubordinateReadContext(
            personId: id,
            personName: '下属',
            chainOrigin: 'me',
          ),
        ),
      ),
    );
    await tester.pumpWidget(page('p1'));
    await tester.pumpAndSettle();
    expect(
      backend
          .requestsFor('GET', '/tasks')
          .any(
            (r) =>
                r.query['assigneeId'] == 'p1' &&
                r.query['from'].toString().startsWith('2028-03'),
          ),
      isTrue,
    );
    expect(find.byTooltip('切换紧凑密度'), findsOneWidget);
    await tester.pumpWidget(page('p2'));
    await tester.pumpAndSettle();
    expect(
      backend
          .requestsFor('GET', '/tasks')
          .any(
            (r) =>
                r.query['assigneeId'] == 'p2' &&
                r.query['from'].toString().startsWith('2024-01'),
          ),
      isTrue,
    );
    expect(find.byTooltip('切换舒适密度'), findsOneWidget);
    expect(own.getString('calendar.lastDate'), '2026-11-10');
    await tester.tap(find.text('今天'));
    await tester.pumpAndSettle();
    expect(
      backend.requestsFor('GET', '/tasks').last.query['from'].toString(),
      contains('2026'),
    );
    expect(
      find
          .byWidgetPredicate(
            (widget) => widget is Text && widget.semanticsLabel == '2026-11-10',
          )
          .hitTestable(),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
}
