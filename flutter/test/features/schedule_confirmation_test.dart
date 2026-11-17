import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/providers.dart';
import 'package:pandora_employee/features/schedule/domain/calendar_drag.dart';
import 'package:pandora_employee/features/schedule/presentation/schedule_confirmation.dart';
import 'package:pandora_employee/features/tasks/domain/task_record.dart';

import '../support/test_harness.dart';
import 'task_actions_web_parity_test.dart' show launcher;
import 'task_calendar_drag_ui_test.dart' show taskJson;

CalendarDragPreview get proposal => CalendarDragPreview(
  allDay: false,
  startAt: DateTime.parse('2026-11-10T16:30:00Z'),
  dueAt: DateTime.parse('2026-11-10T17:30:00Z'),
);

void main() {
  testWidgets('日历确认发现原版本变化不以新版本覆盖，无PATCH', (tester) async {
    final backend = FakeBackend();
    backend.on('GET', '/tasks/t1', (_) => FakeResponse({...taskJson(), 'rowVersion': 2}, etag: '"2"'));
    final container = buildTestContainer(backend: backend, user: employeeUser(), accountEpoch: () => 1);
    addTearDown(container.dispose);
    await tester.pumpWidget(
      wrapWithScope(container, ScheduleConfirmation(task: TaskRecord.fromJson(taskJson()), preview: proposal)),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('任务版本或资格已变化'), findsOneWidget);
    expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, '提交')).onPressed, isNull);
    expect(backend.requestsFor('PATCH', '/tasks/t1'), isEmpty);
  });

  testWidgets('改期响应丢失保原因，原版本与同键重放能跨已提交后的版本变化', (tester) async {
    final backend = FakeBackend();
    var writes = 0;
    backend.on(
      'GET',
      '/tasks/t1',
      (_) => FakeResponse({
        ...taskJson(),
        'rowVersion': writes == 0 ? 1 : 2,
        'frozen': writes > 0,
      }, etag: writes == 0 ? '"1"' : '"2"'),
    );
    backend.on(
      'PATCH',
      '/tasks/t1',
      (_) => ++writes == 1
          ? FakeResponse({'code': 'UNKNOWN_RESULT', 'message': '保存结果待确认'}, status: 503)
          : FakeResponse({'taskId': 't1', 'requestId': 'r1', 'outcome': 'pending'}),
    );
    backend.on(
      'GET',
      '/approval-requests/r1',
      (_) => FakeResponse({
        'requestId': 'r1',
        'taskId': 't1',
        'status': 'pending',
        'currentReviewerId': 'new',
        'participants': [
          {'id': 'new', 'displayName': '真实新上级'},
        ],
      }),
    );
    final container = buildTestContainer(backend: backend, user: employeeUser(), accountEpoch: () => 1);
    addTearDown(container.dispose);
    await tester.pumpWidget(
      wrapWithScope(
        container,
        launcher(ScheduleConfirmation(task: TaskRecord.fromJson(taskJson()), preview: proposal)),
      ),
    );
    await tester.tap(find.text('打开'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '保留的改期原因');
    await tester.tap(find.text('提交'));
    await tester.pumpAndSettle();
    expect(find.text('保存结果待确认'), findsOneWidget);
    expect(find.text('保留的改期原因'), findsOneWidget);
    await tester.tap(find.text('提交'));
    await tester.pumpAndSettle();
    final requests = backend.requestsFor('PATCH', '/tasks/t1');
    expect(requests, hasLength(2));
    expect(requests[0].headers['If-Match'], '"1"');
    expect(requests[1].headers['If-Match'], '"1"');
    expect(requests[0].headers['Idempotency-Key'], requests[1].headers['Idempotency-Key']);
    expect(requests[1].jsonBody, {'command': 'reschedule', ...proposal.payload('保留的改期原因')});
    expect(backend.requestsFor('GET', '/approval-requests/r1'), hasLength(1));
    expect(find.text('确认调整排期'), findsNothing);
  });

  testWidgets('切账号后迟到写不读取新账号申请；后台中断使未提交确认失效', (tester) async {
    var epoch = 1;
    final pending = Completer<FakeResponse>();
    final backend = FakeBackend();
    backend.on('GET', '/tasks/t1', (_) => FakeResponse(taskJson(), etag: '"1"'));
    backend.on('PATCH', '/tasks/t1', (_) => pending.future);
    final container = buildTestContainer(backend: backend, user: employeeUser(), accountEpoch: () => epoch);
    addTearDown(container.dispose);
    await tester.pumpWidget(
      wrapWithScope(container, ScheduleConfirmation(task: TaskRecord.fromJson(taskJson()), preview: proposal)),
    );
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '账号一的原因');
    await tester.tap(find.text('提交'));
    await tester.pumpAndSettle();
    epoch++;
    container.invalidate(accountEpochProvider);
    pending.complete(FakeResponse({'taskId': 't1', 'requestId': 'old-request', 'outcome': 'pending'}));
    await tester.pumpAndSettle();
    expect(backend.requestsFor('GET', '/approval-requests/old-request'), isEmpty);
    await tester.pumpWidget(
      wrapWithScope(
        container,
        ScheduleConfirmation(key: const ValueKey('next'), task: TaskRecord.fromJson(taskJson()), preview: proposal),
      ),
    );
    await tester.pumpAndSettle();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    await tester.pumpAndSettle();
    expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, '提交')).onPressed, isNull);
    expect(backend.requestsFor('PATCH', '/tasks/t1'), hasLength(1));
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
  });
}
