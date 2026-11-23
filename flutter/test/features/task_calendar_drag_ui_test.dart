import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:pandora_employee/core/router/read_context.dart';
import 'package:pandora_employee/features/schedule/presentation/task_calendar_page.dart';
import 'package:pandora_employee/features/tasks/presentation/task_detail_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/test_harness.dart';
import 'calendar_day_entrance_test.dart' show calendarPage, routerApp;
import 'calendar_week_expansion_test.dart'
    show chooseWeek, dateHeader, weekGrid, weekPreferences;
import 'comments_keyboard_test.dart' show commentsBackend;

Finder dropOutline([String? date]) => date == null
    ? find.byWidgetPredicate(
        (widget) => widget.key.toString().contains('task-drop-'),
      )
    : find.byKey(ValueKey('task-drop-$date'));

Finder realCellHeader(String date) => find
    .descendant(
      of: find.byWidgetPredicate(
        (widget) => widget is InkWell && widget.key is GlobalKey,
      ),
      matching: dateHeader(date),
    )
    .hitTestable();

Finder placeholderHeader(String date) => find
    .descendant(
      of: find.byWidgetPredicate(
        (widget) => widget is InkWell && widget.onTap == null,
      ),
      matching: dateHeader(date),
    )
    .hitTestable();

Future<void> pumpHandoff(WidgetTester tester) async {
  for (var frame = 0; frame < 5; frame++) {
    await tester.pump();
  }
}

Map<String, Object?> taskJson({bool allDay = false}) => {
  'id': 't1',
  'taskId': 't1',
  'title': '拖动任务',
  'description': '',
  'priority': 'medium',
  'allDay': allDay,
  'startAt': allDay ? null : '2026-11-09T16:30:00Z',
  'dueAt': allDay ? null : '2026-11-09T17:30:00Z',
  'startDate': allDay ? '2026-11-10' : null,
  'dueDate': allDay ? '2026-11-10' : null,
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
  'tablePinned': false,
  'pinned': false,
  'editableFields': ['startAt', 'dueAt'],
  'participants': [
    {'id': 'u1', 'displayName': '亚里士多德'},
  ],
};

Future<void> pumpCalendar(
  WidgetTester tester,
  FakeBackend backend, {
  bool atMonthStart = false,
}) async {
  SharedPreferences.setMockInitialValues({});
  if (atMonthStart) await weekPreferences('2026-11-01');
  tester.view.physicalSize = const Size(390, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final container = buildTestContainer(backend: backend, user: employeeUser());
  addTearDown(container.dispose);
  await tester.pumpWidget(wrapWithScope(container, const TaskCalendarPage()));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('展开周从续接日开始整条拖动，确认按抓取日差平移', (tester) async {
    final task = {...taskJson(), 'dueAt': '2026-11-12T01:30:00Z'};
    final backend = FakeBackend()
      ..on(
        'GET',
        '/tasks',
        (_) => FakeResponse({
          'items': [task],
          'nextCursor': null,
        }),
      )
      ..on('GET', '/tasks/t1', (_) => FakeResponse(task, etag: '"1"'))
      ..on(
        'PATCH',
        '/tasks/t1',
        (_) => FakeResponse({'taskId': 't1', 'outcome': 'direct'}),
      );
    await pumpCalendar(tester, backend, atMonthStart: true);
    await chooseWeek(tester, '2026年11月', '2026-11-09 至 2026-11-15');

    Offset continuation() => Offset(
      tester.getCenter(dateHeader('2026-11-11')).dx,
      tester.getCenter(find.byKey(const ValueKey('task-bar-t1'))).dy,
    );
    await tester.tapAt(continuation());
    await tester.pumpAndSettle();
    expect(find.text('2026-11-11 完整清单'), findsOneWidget);
    await tester.tap(find.byTooltip('关闭'));
    await tester.pumpAndSettle();

    final stationary = await tester.startGesture(continuation());
    await tester.pump(const Duration(milliseconds: 600));
    await stationary.moveBy(const Offset(4, 0));
    await stationary.up();
    await tester.pumpAndSettle();
    expect(weekGrid, findsOneWidget);
    expect(find.textContaining('完整清单'), findsNothing);
    expect(find.text('确认调整排期'), findsNothing);
    expect(backend.requestsFor('PATCH', '/tasks/t1'), isEmpty);

    final moving = await tester.startGesture(continuation());
    await tester.pump(const Duration(milliseconds: 600));
    await moving.moveBy(const Offset(16, 0));
    await pumpHandoff(tester);
    expect(weekGrid, findsNothing);
    expect(realCellHeader('2026-11-09'), findsOneWidget);
    await moving.moveTo(tester.getCenter(realCellHeader('2026-11-14')));
    await tester.pump();
    expect(dropOutline('2026-11-14'), findsOneWidget);
    await moving.up();
    await tester.pumpAndSettle();
    expect(find.text('确认调整排期'), findsOneWidget);
    expect(dropOutline(), findsNothing);
    expect(backend.requestsFor('PATCH', '/tasks/t1'), isEmpty);
    await tester.enterText(find.byType(TextField).last, '平移三天');
    await tester.tap(find.widgetWithText(FilledButton, '提交'));
    await tester.pumpAndSettle();
    final saved = backend.requestsFor('PATCH', '/tasks/t1').single.jsonBody;
    expect(
      DateTime.parse(saved['startAt'] as String),
      DateTime.utc(2026, 11, 12, 16, 30),
    );
    expect(
      DateTime.parse(saved['dueAt'] as String),
      DateTime.utc(2026, 11, 15, 1, 30),
    );
  });

  testWidgets('切到月历未加载的周后，长按拖动定位到当前那周', (tester) async {
    final task = {
      ...taskJson(),
      'startAt': '2027-01-11T01:00:00Z',
      'dueAt': '2027-01-11T02:00:00Z',
    };
    final backend = FakeBackend()
      ..on(
        'GET',
        '/tasks',
        (_) => FakeResponse({'items': [task], 'nextCursor': null}),
      );
    await pumpCalendar(tester, backend, atMonthStart: true);
    await chooseWeek(tester, '2026年11月', '2026-11-09 至 2026-11-15');
    for (var week = 0; week < 9; week++) {
      await tester.tap(find.byTooltip('下一周'));
      await tester.pumpAndSettle();
    }
    expect(find.byTooltip('2027-01-11 至 2027-01-17'), findsOneWidget);
    final taskBar = find.byKey(const ValueKey('task-bar-t1'));
    final moving = await tester.startGesture(tester.getCenter(taskBar));
    await tester.pump(const Duration(milliseconds: 600));
    await moving.moveBy(const Offset(16, 0));
    await pumpHandoff(tester);
    expect(weekGrid, findsNothing);
    expect(realCellHeader('2027-01-11'), findsOneWidget);
    await moving.moveTo(tester.getCenter(realCellHeader('2027-01-14')));
    await tester.pump();
    expect(dropOutline('2027-01-14'), findsOneWidget);
    await moving.cancel();
    await tester.pumpAndSettle();
    expect(dropOutline(), findsNothing);
    expect(backend.requestsFor('PATCH', '/tasks/t1'), isEmpty);
  });

  for (final interrupt in ['取消', '后台中断', '布局前释放']) {
    testWidgets('接续拖动$interrupt时不写入', (tester) async {
      final backend = FakeBackend()
        ..on(
          'GET',
          '/tasks',
          (_) => FakeResponse({
            'items': [taskJson()],
            'nextCursor': null,
          }),
        );
      await pumpCalendar(tester, backend, atMonthStart: true);
      await chooseWeek(tester, '2026年11月', '2026-11-09 至 2026-11-15');
      final bar = find.byKey(const ValueKey('task-bar-t1'));
      final gesture = await tester.startGesture(tester.getCenter(bar));
      await tester.pump(const Duration(milliseconds: 600));
      await gesture.moveBy(const Offset(20, 0));
      if (interrupt == '布局前释放') {
        await gesture.up();
      } else {
        await pumpHandoff(tester);
        await gesture.moveTo(tester.getCenter(realCellHeader('2026-11-13')));
        await tester.pump();
        expect(dropOutline('2026-11-13'), findsOneWidget);
        if (interrupt == '取消') {
          await gesture.cancel();
        } else {
          tester.binding.handleAppLifecycleStateChanged(
            AppLifecycleState.paused,
          );
          tester.binding.handleAppLifecycleStateChanged(
            AppLifecycleState.resumed,
          );
          await gesture.up();
        }
      }
      await tester.pumpAndSettle();
      expect(weekGrid, findsNothing);
      expect(dropOutline(), findsNothing);
      expect(find.text('确认调整排期'), findsNothing);
      expect(
        backend.requests.where((request) => request.method != 'GET'),
        isEmpty,
      );
    });
  }

  testWidgets('下属月、周、日禁止改期但能从日程打开详情发表评论', (tester) async {
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await weekPreferences('2026-11-01', personId: 'p1');
    final backend = commentsBackend()
      ..on(
        'GET',
        '/tasks',
        (_) => FakeResponse({
          'items': [taskJson()],
          'nextCursor': null,
        }),
      )
      ..on('GET', '/tasks/t1', (_) => FakeResponse(taskJson(), etag: '"1"'));
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    final router = GoRouter(
      initialLocation: '/schedule',
      routes: [
        GoRoute(path: '/schedule', builder: (_, _) => calendarPage('p1')),
        GoRoute(
          path: '/people/:person/tasks/:id',
          builder: (_, state) => TaskDetailPage(
            taskId: state.pathParameters['id']!,
            readContext: const SubordinateReadContext(
              personId: 'p1',
              personName: '下属',
              chainOrigin: '/people',
            ),
          ),
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(routerApp(container, router));
    await tester.pumpAndSettle();

    Future<void> tryAdjust(Finder task, String startKey, String endKey) async {
      expect(find.byKey(ValueKey(startKey)), findsNothing);
      expect(find.byKey(ValueKey(endKey)), findsNothing);
      final parent = find
          .ancestor(
            of: task,
            matching: find.byWidgetPredicate(
              (widget) =>
                  widget is Semantics &&
                  widget.properties.label?.contains('拖动任务') == true,
            ),
          )
          .first;
      expect(
        tester.widget<Semantics>(parent).properties.customSemanticsActions ??
            {},
        isEmpty,
      );
      final gesture = await tester.startGesture(tester.getCenter(task));
      await tester.pump(const Duration(milliseconds: 600));
      await gesture.moveBy(const Offset(35, 70));
      await gesture.up();
      await tester.sendKeyDownEvent(LogicalKeyboardKey.altLeft);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.sendKeyUpEvent(LogicalKeyboardKey.altLeft);
      await tester.pumpAndSettle();
      expect(dropOutline(), findsNothing);
      expect(find.text('确认调整排期'), findsNothing);
      expect(
        backend.requests.where((request) => request.method != 'GET'),
        isEmpty,
      );
    }

    final bar = find.byKey(const ValueKey('task-bar-t1')).hitTestable().first;
    await tryAdjust(bar, 'task-start-t1', 'task-end-t1');
    await chooseWeek(tester, '2026年11月', '2026-11-09 至 2026-11-15');
    await tryAdjust(bar, 'task-start-t1', 'task-end-t1');
    expect(weekGrid, findsOneWidget);
    await tester.tap(bar);
    await tester.pumpAndSettle();
    expect(find.text('2026-11-10 完整清单'), findsOneWidget);
    await tester.tap(find.widgetWithText(OutlinedButton, '日视图'));
    await tester.pumpAndSettle();
    final axis = find.byKey(const ValueKey('axis-dash-t1'));
    await tryAdjust(axis, 'axis-start-t1', 'axis-end-t1');
    await tester.tap(axis);
    await tester.pumpAndSettle();
    final input = find.widgetWithText(TextField, '发表评论');
    await tester.scrollUntilVisible(
      input,
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.enterText(input, '从下属日程发表评论');
    await tester.ensureVisible(find.byTooltip('发送评论'));
    await tester.tap(find.byTooltip('发送评论'));
    await tester.pumpAndSettle();
    expect(
      backend.requests
          .where((request) => request.method != 'GET')
          .single
          .jsonBody['body'],
      '从下属日程发表评论',
    );
  });
  testWidgets('长按不足 500ms 不进入拖动、不弹确认', (tester) async {
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/tasks',
      (request) async => FakeResponse({
        'items': [taskJson()],
        'nextCursor': null,
      }),
    );
    await pumpCalendar(tester, backend);

    final bar = find.byKey(const ValueKey('task-bar-t1')).hitTestable().first;
    final gesture = await tester.startGesture(tester.getCenter(bar));
    await tester.pump(const Duration(milliseconds: 300));
    await gesture.up();
    await tester.pumpAndSettle();
    expect(find.text('确认调整排期'), findsNothing);
  });

  testWidgets('月历整条拖动一次轻震，确认后只写一次', (tester) async {
    final backend = FakeBackend();
    var patches = 0;
    final haptics = <MethodCall>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'HapticFeedback.vibrate') haptics.add(call);
        return null;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      ),
    );
    backend.on(
      'GET',
      '/tasks',
      (request) async => FakeResponse({
        'items': [taskJson()],
        'nextCursor': null,
      }),
    );
    backend.on(
      'GET',
      '/tasks/t1',
      (request) async => FakeResponse(taskJson(), etag: '"1"'),
    );
    backend.on('PATCH', '/tasks/t1', (request) async {
      patches++;
      return FakeResponse({
        'taskId': 't1',
        'requestId': 'r1',
        'outcome': 'pending',
        'rowVersion': 2,
      });
    });
    await pumpCalendar(tester, backend);

    final bar = find.byKey(const ValueKey('task-bar-t1')).hitTestable().first;
    final target = find.text('11').hitTestable().first;
    final gesture = await tester.startGesture(tester.getCenter(bar));
    await tester.pump(const Duration(milliseconds: 600));
    await gesture.moveTo(tester.getCenter(target));
    await tester.pump();
    expect(dropOutline('2026-11-11'), findsOneWidget);
    await gesture.up();
    await tester.pumpAndSettle();

    expect(haptics, hasLength(1));
    expect(find.text('确认调整排期'), findsOneWidget);
    expect(dropOutline(), findsNothing);
    expect(patches, 0, reason: '确认前不得写入');
    await tester.enterText(find.byType(TextField).last, '调整一天');
    await tester.tap(find.widgetWithText(FilledButton, '提交'));
    await tester.pumpAndSettle();
    expect(patches, 1);
  });

  testWidgets('月历端点只高亮有效调整，预览与确认一致，取消不写', (tester) async {
    final backend = FakeBackend();
    var patches = 0;
    backend.on(
      'GET',
      '/tasks',
      (request) async => FakeResponse({
        'items': [taskJson()],
        'nextCursor': null,
      }),
    );
    backend.on('GET', '/tasks/t1', (_) => FakeResponse(taskJson(), etag: '"1"'));
    backend.on('PATCH', '/tasks/t1', (request) async {
      patches++;
      return FakeResponse({
        'taskId': 't1',
        'requestId': 'r1',
        'outcome': 'pending',
      });
    });
    await pumpCalendar(tester, backend);

    final handle = find
        .byKey(const ValueKey('task-start-t1'))
        .hitTestable()
        .first;
    final validTarget = tester.getCenter(realCellHeader('2026-11-09'));
    final invalidTarget = tester.getCenter(realCellHeader('2026-11-11'));
    Future<TestGesture> dragPastEnd() async {
      final gesture = await tester.startGesture(tester.getCenter(handle));
      await tester.pump(const Duration(milliseconds: 600));
      await gesture.moveTo(invalidTarget);
      await tester.pump();
      expect(find.text('目标日期：2026-11-11，调整无效'), findsOneWidget);
      expect(dropOutline(), findsNothing);
      return gesture;
    }

    final invalid = await dragPastEnd();
    await invalid.up();
    await tester.pumpAndSettle();
    expect(find.text('确认调整排期'), findsNothing);

    final gesture = await dragPastEnd();
    await gesture.moveTo(validTarget);
    await tester.pump();
    expect(dropOutline('2026-11-09'), findsOneWidget);
    final preview = find.textContaining('新排期：');
    final previewText = tester.widget<Text>(preview).data!;
    expect(previewText, contains('2026-11-09'));
    await gesture.up();
    await tester.pumpAndSettle();

    expect(find.text('确认调整排期'), findsOneWidget);
    expect(find.text(previewText), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, '取消'));
    await tester.pumpAndSettle();
    expect(patches, 0);
  });

  testWidgets('边缘滚动后只接收相邻月实格，标题、补位和视口外清除反馈', (tester) async {
    final backend = FakeBackend()
      ..on(
        'GET',
        '/tasks',
        (_) => FakeResponse({
          'items': [taskJson()],
          'nextCursor': null,
        }),
      );
    await pumpCalendar(tester, backend);
    final position = tester
        .state<ScrollableState>(find.byType(Scrollable))
        .position;
    final initialOffset = position.pixels;

    Future<TestGesture> holdTask() async {
      position.jumpTo(initialOffset);
      await tester.pumpAndSettle();
      final bar = find.byKey(const ValueKey('task-bar-t1')).hitTestable().first;
      final gesture = await tester.startGesture(tester.getCenter(bar));
      await tester.pump(const Duration(milliseconds: 600));
      return gesture;
    }

    final gesture = await holdTask();
    await gesture.moveTo(tester.getCenter(realCellHeader('2026-11-12')));
    await tester.pump();
    expect(dropOutline('2026-11-12'), findsOneWidget);

    final viewport = tester.getRect(find.byType(ListView));
    final afterEdge = Offset(
      tester.getCenter(realCellHeader('2026-11-12')).dx,
      viewport.bottom - 48,
    );
    await gesture.moveTo(afterEdge);
    final previous = <String>{};
    for (var tick = 0; tick < 16; tick++) {
      await tester.pump(const Duration(milliseconds: 90));
      await tester.pump();
      final outline = dropOutline().evaluate().singleOrNull;
      if (outline == null) continue;
      previous.add(outline.widget.key.toString());
      expect(
        tester.getRect(dropOutline()).inflate(1).contains(afterEdge),
        isTrue,
      );
    }
    expect(previous.length, greaterThan(1));

    await gesture.cancel();
    await tester.pumpAndSettle();
    expect(dropOutline(), findsNothing);

    final invalid = await holdTask();
    await invalid.moveTo(tester.getCenter(realCellHeader('2026-12-03')));
    await tester.pump();
    expect(dropOutline('2026-12-03'), findsOneWidget);
    await invalid.moveTo(tester.getCenter(find.text('2026年12月')));
    await tester.pump();
    expect(dropOutline(), findsNothing);
    await invalid.moveTo(tester.getCenter(realCellHeader('2026-12-03')));
    await tester.pump();
    expect(dropOutline('2026-12-03'), findsOneWidget);
    await invalid.moveTo(Offset(viewport.center.dx, viewport.top - 2));
    await tester.pump();
    expect(dropOutline(), findsNothing);
    await invalid.moveTo(tester.getCenter(placeholderHeader('2026-11-30')));
    await tester.pump();
    expect(dropOutline(), findsNothing);
    await invalid.up();
    await tester.pumpAndSettle();
    expect(find.text('确认调整排期'), findsNothing);

    final next = await holdTask();
    await next.moveTo(tester.getCenter(realCellHeader('2026-12-03')));
    await tester.pump();
    expect(dropOutline('2026-12-03'), findsOneWidget);
    await next.up();
    await tester.pumpAndSettle();
    expect(find.text('确认调整排期'), findsOneWidget);
    expect(find.textContaining('2026-12-03'), findsWidgets);
    expect(dropOutline(), findsNothing);
    await tester.tap(find.widgetWithText(TextButton, '取消'));
    await tester.pumpAndSettle();
    expect(
      backend.requests.where((request) => request.method != 'GET'),
      isEmpty,
    );

    final canceled = await holdTask();
    await canceled.moveTo(tester.getCenter(realCellHeader('2026-12-03')));
    await tester.pump();
    expect(dropOutline('2026-12-03'), findsOneWidget);
    await canceled.cancel();
    await tester.pumpAndSettle();
    expect(dropOutline(), findsNothing);
    expect(find.text('确认调整排期'), findsNothing);
  });

  testWidgets('拖动到视口边缘自动滚动且可取消', (tester) async {
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/tasks',
      (request) async => FakeResponse({
        'items': [taskJson()],
        'nextCursor': null,
      }),
    );
    await pumpCalendar(tester, backend);

    final before = tester
        .state<ScrollableState>(find.byType(Scrollable).first)
        .position
        .pixels;
    final bar = find.byKey(const ValueKey('task-bar-t1')).hitTestable().first;
    final gesture = await tester.startGesture(tester.getCenter(bar));
    await tester.pump(const Duration(milliseconds: 600));
    await gesture.moveTo(const Offset(195, 860));
    await tester.pump(const Duration(milliseconds: 500));
    final after = tester
        .state<ScrollableState>(find.byType(Scrollable).first)
        .position
        .pixels;
    expect(after, greaterThan(before));

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();
    await gesture.up();
    await tester.pumpAndSettle();
    expect(find.text('确认调整排期'), findsNothing);
  });

  testWidgets('拖动中进入后台取消，松手不弹确认', (tester) async {
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/tasks',
      (request) async => FakeResponse({
        'items': [taskJson()],
        'nextCursor': null,
      }),
    );
    await pumpCalendar(tester, backend);

    final bar = find.byKey(const ValueKey('task-bar-t1')).hitTestable().first;
    final target = find.text('11').hitTestable().first;
    final gesture = await tester.startGesture(tester.getCenter(bar));
    await tester.pump(const Duration(milliseconds: 600));
    await gesture.moveTo(tester.getCenter(target));
    await tester.pump(const Duration(milliseconds: 100));
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();
    await gesture.up();
    await tester.pumpAndSettle();
    expect(find.text('确认调整排期'), findsNothing);
  });

  testWidgets('日轴真实终点端点可缩放且不越界', (tester) async {
    final backend = FakeBackend();
    var patches = 0;
    backend.on(
      'GET',
      '/tasks',
      (request) async => FakeResponse({
        'items': [taskJson()],
        'nextCursor': null,
      }),
    );
    backend.on('PATCH', '/tasks/t1', (request) async {
      patches++;
      return FakeResponse({
        'taskId': 't1',
        'requestId': 'r1',
        'outcome': 'pending',
      });
    });
    await pumpCalendar(tester, backend);
    await tester.tap(namePreview('拖动任务').hitTestable().first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(OutlinedButton, '日视图'));
    await tester.pumpAndSettle();

    final handle = find.byKey(const ValueKey('axis-end-t1'));
    final gesture = await tester.startGesture(tester.getCenter(handle));
    await tester.pump(const Duration(milliseconds: 600));
    await gesture.moveBy(const Offset(0, 44));
    await tester.pump(const Duration(milliseconds: 100));
    await gesture.up();
    await tester.pumpAndSettle();
    expect(find.text('确认调整排期'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, '取消'));
    await tester.pumpAndSettle();
    expect(patches, 0);
  });

  testWidgets('日轴整条拖动显示确认，取消不写', (tester) async {
    final backend = FakeBackend();
    var patches = 0;
    backend.on(
      'GET',
      '/tasks',
      (request) async => FakeResponse({
        'items': [taskJson()],
        'nextCursor': null,
      }),
    );
    backend.on(
      'GET',
      '/tasks/t1',
      (request) async => FakeResponse(taskJson(), etag: '"1"'),
    );
    backend.on('PATCH', '/tasks/t1', (request) async {
      patches++;
      return FakeResponse({
        'taskId': 't1',
        'requestId': 'r1',
        'outcome': 'pending',
      });
    });
    await pumpCalendar(tester, backend);

    await tester.tap(namePreview('拖动任务').hitTestable().first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(OutlinedButton, '日视图'));
    await tester.pumpAndSettle();

    final axisBlock = find.byKey(const ValueKey('axis-task-t1'));
    expect(axisBlock, findsOneWidget);
    final gesture = await tester.startGesture(tester.getCenter(axisBlock));
    await tester.pump(const Duration(milliseconds: 600));
    await gesture.moveBy(const Offset(0, 44));
    await tester.pump(const Duration(milliseconds: 100));
    await gesture.up();
    await tester.pumpAndSettle();

    expect(find.text('确认调整排期'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, '取消'));
    await tester.pumpAndSettle();
    expect(patches, 0);
  });
}
