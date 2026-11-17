import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/net/version_registry.dart';
import 'package:pandora_employee/core/providers.dart';
import 'package:pandora_employee/core/router/read_context.dart';
import 'package:pandora_employee/features/tasks/presentation/task_action_pages.dart';
import 'package:pandora_employee/features/tasks/presentation/task_detail_page.dart';
import 'package:pandora_employee/features/tasks/presentation/task_review.dart';

import '../support/test_harness.dart';

Map<String, Object?> taskJson({List<String> sources = const ['s1'], bool done = false}) => {
  'id': 'task1',
  'title': '待处理镜头',
  'rowVersion': 7,
  'published': true,
  'executionState': done ? 'done' : 'doing',
  'businessOwnerId': 'u1',
  'assigneeIds': ['s1', 's2', 'u1'],
  'handoverSources': sources,
  'canHandover': sources.isNotEmpty,
  'startAt': '2026-10-01T01:17:00Z',
  'dueAt': '2026-10-02T10:23:00Z',
  'participants': [
    {'id': 's1', 'displayName': '来源甲'},
    {'id': 's2', 'displayName': '来源乙'},
    {'id': 'u1', 'displayName': '不允许的来源'},
  ],
};

FakeResponse preview(String id, String name) => FakeResponse({
  'requiresApproval': true,
  'reviewerId': id,
  'route': {
    'reviewerId': id,
    'participants': [
      {'id': id, 'displayName': name},
    ],
  },
});

void configureTask(FakeBackend backend, {List<String> sources = const ['s1'], bool done = false}) {
  backend.on(
    'GET',
    '/tasks/task1',
    (_) => FakeResponse(
      taskJson(sources: sources, done: done),
      etag: '"7"',
    ),
  );
  backend.on('POST', '/tasks/reviewer-preview', (_) => preview('old', '预览上级'));
  backend.on(
    'GET',
    '/handover-targets',
    (r) => FakeResponse({
      'subjectId': r.query['subjectId'],
      'items': [
        {'id': 't1', 'displayName': '目标甲'},
        {'id': 't2', 'displayName': '目标乙'},
      ],
    }),
  );
  backend.onPattern(
    'GET',
    RegExp(r'^/users/[^/]+/handover-preset$'),
    (_) => FakeResponse({
      'targetUserId': 'inactive',
      'target': {'id': 'inactive', 'displayName': '失效预设'},
    }),
  );
  backend.on(
    'GET',
    '/approval-requests/r1',
    (_) => FakeResponse({
      'requestId': 'r1',
      'taskId': 'task1',
      'kind': 'handover',
      'status': 'pending',
      'currentReviewerId': 'actual',
      'participants': [
        {'id': 'actual', 'displayName': '保存后的新上级'},
      ],
    }),
  );
  backend.on('GET', '/tasks/task1/comments', (_) => FakeResponse({'items': [], 'nextCursor': null}));
}

Widget launcher(Widget page) => Scaffold(
  body: Builder(
    builder: (context) => TextButton(
      onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page)),
      child: const Text('打开'),
    ),
  ),
);

Future<void> open(WidgetTester tester) async {
  await tester.tap(find.text('打开'));
  await tester.pumpAndSettle();
}

Future<void> tapVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('交接仅列服务允许来源，失效预设回退有效候选；完整有序预览，保存显示实际审核人', (tester) async {
    tester.view.physicalSize = const Size(390, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final backend = FakeBackend();
    configureTask(backend);
    backend.on(
      'POST',
      '/tasks/task1/handover',
      (_) => FakeResponse({'taskId': 'task1', 'requestId': 'r1', 'outcome': 'pending'}),
    );
    final container = buildTestContainer(backend: backend, user: employeeUser(), accountEpoch: () => 1);
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, launcher(const TaskHandoverPage(taskId: 'task1'))));
    await open(tester);
    final dropdown = tester.widget<DropdownButtonFormField<String>>(find.byType(DropdownButtonFormField<String>));
    expect(dropdown.initialValue, 's1');
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    expect(find.text('不允许的来源'), findsNothing);
    expect(find.text('来源乙'), findsNothing);
    await tester.tap(find.text('来源甲').last);
    await tester.pumpAndSettle();
    expect(find.textContaining('失效预设'), findsNothing);
    expect(find.text('审核人：预览上级'), findsOneWidget);
    expect(backend.requestsFor('POST', '/tasks/reviewer-preview').last.jsonBody, {
      'operation': 'handover',
      'taskId': 'task1',
      'assigneeIds': ['t1', 's2', 'u1'],
    });
    await tapVisible(tester, find.text('目标乙'));
    expect(backend.requestsFor('POST', '/tasks/reviewer-preview').last.jsonBody['assigneeIds'], ['t2', 's2', 'u1']);
    // A later unrelated read must not replace the version captured by this form.
    container.read(apiClientProvider).versions.put(VersionRegistry.task('task1'), '"99"');
    await tester.enterText(find.byType(TextField), '交接说明');
    await tapVisible(tester, find.text('提交交接申请'));
    final saved = backend.requestsFor('POST', '/tasks/task1/handover').single;
    expect(saved.jsonBody, {'sourceUserId': 's1', 'targetUserId': 't2', 'reason': '交接说明'});
    expect(saved.headers['If-Match'], '"7"');
    expect(find.text('已提交审核，审核人：保存后的新上级'), findsOneWidget);
  });

  testWidgets('来源快速切换丢弃迟到候选与预设，目标切换丢弃迟到预览', (tester) async {
    tester.view.physicalSize = const Size(390, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final backend = FakeBackend();
    configureTask(backend, sources: ['s1', 's2']);
    final delayedTargets = Completer<FakeResponse>();
    final delayedPreview = Completer<FakeResponse>();
    backend.on(
      'GET',
      '/handover-targets',
      (r) => r.query['subjectId'] == 's1'
          ? delayedTargets.future
          : FakeResponse({
              'subjectId': 's2',
              'items': [
                {'id': 't1', 'displayName': '目标甲'},
                {'id': 't2', 'displayName': '目标乙'},
              ],
            }),
    );
    backend.on(
      'POST',
      '/tasks/reviewer-preview',
      (r) => (r.jsonBody['assigneeIds'] as List).contains('t1') ? delayedPreview.future : preview('new', '新目标审核人'),
    );
    final container = buildTestContainer(backend: backend, user: employeeUser(), accountEpoch: () => 1);
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const TaskHandoverPage(taskId: 'task1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('来源乙').last);
    await tester.pumpAndSettle();
    await tapVisible(tester, find.text('目标乙'));
    expect(find.text('审核人：新目标审核人'), findsOneWidget);
    delayedTargets.complete(
      FakeResponse({
        'items': [
          {'id': 'bad', 'displayName': '迟到候选'},
        ],
      }),
    );
    delayedPreview.complete(preview('stale', '迟到审核人'));
    await tester.pumpAndSettle();
    expect(find.text('迟到候选'), findsNothing);
    expect(find.textContaining('迟到审核人'), findsNothing);
    expect(find.text('审核人：新目标审核人'), findsOneWidget);
    expect(backend.requestsFor('GET', '/users/s1/handover-preset'), isEmpty);
    expect(backend.requestsFor('POST', '/tasks/task1/handover'), isEmpty);
  });

  testWidgets('无允许来源不读取交接候选、不发写；下属路径无交接和重开动作', (tester) async {
    final backend = FakeBackend();
    configureTask(backend, sources: []);
    final container = buildTestContainer(backend: backend, user: employeeUser(), accountEpoch: () => 1);
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const TaskHandoverPage(taskId: 'task1')));
    await tester.pumpAndSettle();
    expect(find.text('当前账号没有该任务的专用交接权限。'), findsOneWidget);
    expect(backend.requestsFor('GET', '/handover-targets'), isEmpty);
    final submit = tester.widget<FilledButton>(find.widgetWithText(FilledButton, '提交交接申请'));
    expect(submit.onPressed, isNull);
    configureTask(backend, sources: ['s1'], done: true);
    await tester.pumpWidget(
      wrapWithScope(
        container,
        const TaskDetailPage(
          taskId: 'task1',
          readContext: SubordinateReadContext(personId: 's1', personName: '来源甲', chainOrigin: 'u1'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('交接任务'), findsNothing);
    expect(find.text('重开任务'), findsNothing);
    expect(backend.requestsFor('POST', '/tasks/task1/handover'), isEmpty);
  });

  for (final command in ['progress', 'complete']) {
    testWidgets('$command 自动预览，失败保说明、同体同版本沿用键，保存回读实际审核人', (tester) async {
      final backend = FakeBackend();
      configureTask(backend);
      var attempts = 0;
      backend.on(
        'PATCH',
        '/tasks/task1',
        (_) => ++attempts == 1
            ? FakeResponse({'code': 'NETWORK_UNKNOWN', 'message': '响应丢失，请重试'}, status: 503)
            : FakeResponse({'taskId': 'task1', 'requestId': 'r1', 'outcome': 'pending'}),
      );
      final container = buildTestContainer(backend: backend, user: employeeUser(), accountEpoch: () => 1);
      addTearDown(container.dispose);
      await tester.pumpWidget(
        wrapWithScope(container, launcher(TaskNoteDialog(taskId: 'task1', rowVersion: 7, command: command))),
      );
      await open(tester);
      expect(find.text('审核人：预览上级'), findsOneWidget);
      expect(backend.requestsFor('POST', '/tasks/reviewer-preview').single.jsonBody, {
        'operation': command,
        'taskId': 'task1',
      });
      await tester.enterText(find.byType(TextField), '保留的业务说明');
      await tester.tap(find.text('提交'));
      await tester.pumpAndSettle();
      expect(find.text('保留的业务说明'), findsOneWidget);
      expect(find.text('响应丢失，请重试'), findsOneWidget);
      container.read(apiClientProvider).versions.put(VersionRegistry.task('task1'), '"99"');
      await tester.tap(find.text('提交'));
      await tester.pumpAndSettle();
      final writes = backend.requestsFor('PATCH', '/tasks/task1');
      expect(writes, hasLength(2));
      expect(writes[0].headers['Idempotency-Key'], writes[1].headers['Idempotency-Key']);
      expect(writes[1].headers['If-Match'], '"7"');
      expect(writes[1].jsonBody, {
        'command': command,
        command == 'progress' ? 'progressNote' : 'completionNote': '保留的业务说明',
      });
      expect(backend.requestsFor('GET', '/approval-requests/r1'), hasLength(1));
    });
  }

  testWidgets('重开到期旧排期从公司今天09点/明天18点开始，保留有序旧负责人并预览', (tester) async {
    tester.view.physicalSize = const Size(390, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final backend = FakeBackend();
    configureTask(backend, done: true);
    backend.on(
      'GET',
      '/assignee-candidates',
      (_) => FakeResponse({
        'items': [
          {'id': 's2', 'displayName': '来源乙'},
          {'id': 'u1', 'displayName': '本人'},
        ],
      }),
    );
    backend.on('PATCH', '/tasks/task1', (_) => FakeResponse({'taskId': 'task1', 'outcome': 'direct'}));
    final container = buildTestContainer(backend: backend, user: employeeUser(), accountEpoch: () => 1);
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, launcher(const TaskReopenPage(taskId: 'task1'))));
    await open(tester);
    expect(find.text('开始 2026-11-10'), findsOneWidget);
    expect(find.text('截止 2026-11-11'), findsOneWidget);
    expect(backend.requestsFor('POST', '/tasks/reviewer-preview').last.jsonBody, {
      'operation': 'reopen',
      'taskId': 'task1',
      'assigneeIds': ['s1', 's2', 'u1'],
    });
    await tester.enterText(find.widgetWithText(TextField, '重开原因（必填）'), '新的轮次');
    await tapVisible(tester, find.text('提交重开申请'));
    final saved = backend.requestsFor('PATCH', '/tasks/task1').single;
    expect(saved.jsonBody['startAt'], '2026-11-10T01:00:00.000Z');
    expect(saved.jsonBody['dueAt'], '2026-11-11T10:00:00.000Z');
    expect(saved.jsonBody['assigneeIds'], ['s1', 's2', 'u1']);
    expect(saved.headers['If-Match'], '"7"');
    expect(find.text('已直接生效'), findsOneWidget);
  });

  testWidgets('换账号后迟到交接候选不触发预设或预览读取，也不能提交', (tester) async {
    var epoch = 1;
    final backend = FakeBackend();
    configureTask(backend);
    final pending = Completer<FakeResponse>();
    backend.on('GET', '/handover-targets', (_) => pending.future);
    final container = buildTestContainer(backend: backend, user: employeeUser(), accountEpoch: () => epoch);
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const TaskHandoverPage(taskId: 'task1')));
    await tester.pumpAndSettle();
    epoch++;
    container.invalidate(accountEpochProvider);
    pending.complete(
      FakeResponse({
        'items': [
          {'id': 'new', 'displayName': '旧账号候选'},
        ],
      }),
    );
    await tester.pumpAndSettle();
    expect(find.text('旧账号候选'), findsNothing);
    expect(backend.requestsFor('GET', '/users/s1/handover-preset'), isEmpty);
    expect(backend.requestsFor('POST', '/tasks/reviewer-preview'), isEmpty);
    expect(backend.requestsFor('POST', '/tasks/task1/handover'), isEmpty);
  });
}
