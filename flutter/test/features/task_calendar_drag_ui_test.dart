import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/features/schedule/presentation/task_calendar_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/test_harness.dart';

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

Future<void> pumpCalendar(WidgetTester tester, FakeBackend backend) async {
  SharedPreferences.setMockInitialValues({});
  tester.view.physicalSize = const Size(390, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final container = buildTestContainer(backend: backend, user: employeeUser());
  addTearDown(container.dispose);
  await tester.pumpWidget(wrapWithScope(container, const TaskCalendarPage()));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('长按不足 500ms 不进入拖动、不弹确认', (tester) async {
    final backend = FakeBackend();
    backend.on('GET', '/tasks', (request) async => FakeResponse({'items': [taskJson()], 'nextCursor': null}));
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
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'HapticFeedback.vibrate') haptics.add(call);
      return null;
    });
    addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));
    backend.on('GET', '/tasks', (request) async => FakeResponse({'items': [taskJson()], 'nextCursor': null}));
    backend.on('GET', '/tasks/t1', (request) async => FakeResponse(taskJson(), etag: '"1"'));
    backend.on('PATCH', '/tasks/t1', (request) async {
      patches++;
      return FakeResponse({'taskId': 't1', 'requestId': 'r1', 'outcome': 'pending', 'rowVersion': 2});
    });
    await pumpCalendar(tester, backend);

    final bar = find.byKey(const ValueKey('task-bar-t1')).hitTestable().first;
    final target = find.text('11').hitTestable().first;
    final gesture = await tester.startGesture(tester.getCenter(bar));
    await tester.pump(const Duration(milliseconds: 600));
    await gesture.moveTo(tester.getCenter(target));
    await tester.pump(const Duration(milliseconds: 100));
    await gesture.up();
    await tester.pumpAndSettle();

    expect(haptics, hasLength(1));
    expect(find.text('确认调整排期'), findsOneWidget);
    expect(patches, 0, reason: '确认前不得写入');
    await tester.enterText(find.byType(TextField).last, '调整一天');
    await tester.tap(find.widgetWithText(FilledButton, '提交'));
    await tester.pumpAndSettle();
    expect(patches, 1);
  });

  testWidgets('月历真实起点端点可缩放，取消不写', (tester) async {
    final backend = FakeBackend();
    var patches = 0;
    backend.on('GET', '/tasks', (request) async => FakeResponse({'items': [taskJson()], 'nextCursor': null}));
    backend.on('PATCH', '/tasks/t1', (request) async {
      patches++;
      return FakeResponse({'taskId': 't1', 'requestId': 'r1', 'outcome': 'pending'});
    });
    await pumpCalendar(tester, backend);

    final handle = find.byKey(const ValueKey('task-start-t1')).hitTestable().first;
    final target = find.text('9').hitTestable().first;
    final gesture = await tester.startGesture(tester.getCenter(handle));
    await tester.pump(const Duration(milliseconds: 600));
    await gesture.moveTo(tester.getCenter(target));
    await tester.pump(const Duration(milliseconds: 100));
    await gesture.up();
    await tester.pumpAndSettle();

    expect(find.text('确认调整排期'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, '取消'));
    await tester.pumpAndSettle();
    expect(patches, 0);
  });

  testWidgets('拖动到视口边缘自动滚动且可取消', (tester) async {
    final backend = FakeBackend();
    backend.on('GET', '/tasks', (request) async => FakeResponse({'items': [taskJson()], 'nextCursor': null}));
    await pumpCalendar(tester, backend);

    final before = tester.state<ScrollableState>(find.byType(Scrollable).first).position.pixels;
    final bar = find.byKey(const ValueKey('task-bar-t1')).hitTestable().first;
    final gesture = await tester.startGesture(tester.getCenter(bar));
    await tester.pump(const Duration(milliseconds: 600));
    await gesture.moveTo(const Offset(195, 860));
    await tester.pump(const Duration(milliseconds: 500));
    final after = tester.state<ScrollableState>(find.byType(Scrollable).first).position.pixels;
    expect(after, greaterThan(before));

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();
    await gesture.up();
    await tester.pumpAndSettle();
    expect(find.text('确认调整排期'), findsNothing);
  });

  testWidgets('拖动中进入后台取消，松手不弹确认', (tester) async {
    final backend = FakeBackend();
    backend.on('GET', '/tasks', (request) async => FakeResponse({'items': [taskJson()], 'nextCursor': null}));
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
    backend.on('GET', '/tasks', (request) async => FakeResponse({'items': [taskJson()], 'nextCursor': null}));
    backend.on('PATCH', '/tasks/t1', (request) async {
      patches++;
      return FakeResponse({'taskId': 't1', 'requestId': 'r1', 'outcome': 'pending'});
    });
    await pumpCalendar(tester, backend);
    await tester.tap(find.text('拖动任务').hitTestable().first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(OutlinedButton, '日轴'));
    await tester.pumpAndSettle();

    final handle = find.byKey(const ValueKey('axis-end-t1'));
    final gesture = await tester.startGesture(tester.getCenter(handle));
    await tester.pump(const Duration(milliseconds: 600));
    await gesture.moveBy(const Offset(44, 0));
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
    backend.on('GET', '/tasks', (request) async => FakeResponse({'items': [taskJson()], 'nextCursor': null}));
    backend.on('GET', '/tasks/t1', (request) async => FakeResponse(taskJson(), etag: '"1"'));
    backend.on('PATCH', '/tasks/t1', (request) async {
      patches++;
      return FakeResponse({'taskId': 't1', 'requestId': 'r1', 'outcome': 'pending'});
    });
    await pumpCalendar(tester, backend);

    await tester.tap(find.text('拖动任务').hitTestable().first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(OutlinedButton, '日轴'));
    await tester.pumpAndSettle();

    final axisBlock = find.byKey(const ValueKey('axis-task-t1'));
    expect(axisBlock, findsOneWidget);
    final gesture = await tester.startGesture(tester.getCenter(axisBlock));
    await tester.pump(const Duration(milliseconds: 600));
    await gesture.moveBy(const Offset(60, 0));
    await tester.pump(const Duration(milliseconds: 100));
    await gesture.up();
    await tester.pumpAndSettle();

    expect(find.text('确认调整排期'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, '取消'));
    await tester.pumpAndSettle();
    expect(patches, 0);
  });
}
