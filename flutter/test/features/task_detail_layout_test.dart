import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:pandora_employee/core/router/read_context.dart';
import 'package:pandora_employee/core/theme/pandora_theme.dart';
import 'package:pandora_employee/features/tasks/presentation/task_detail_page.dart';
import 'package:pandora_employee/features/tags/presentation/tag_badge.dart';

import '../support/test_harness.dart';

Map<String, Object?> pendingTask({bool allDay = false}) => {
  'id': 't1',
  'taskId': 't1',
  'title': '待审任务',
  'description': '任务说明正文',
  'acceptanceCriteria': '历史完成标准',
  'priority': 'high',
  'allDay': allDay,
  'startAt': allDay ? null : '2026-11-10T02:00:00Z',
  'dueAt': allDay ? null : '2026-11-11T10:00:00Z',
  'startDate': allDay ? '2026-11-10' : null,
  'dueDate': allDay ? '2026-11-12' : null,
  'executionState': 'doing',
  'progressNote': '当前已经完成的进展',
  'status': 'applied',
  'assigneeIds': ['u1'],
  'rowVersion': 5,
  'published': true,
  'pending': true,
  'frozen': true,
  'pendingKind': 'reschedule',
  'pendingRequestId': 'req-9',
  'pendingSchedule': {'dueAt': '2026-11-20T10:00:00Z'},
  'editableFields': ['title'],
  'participants': [
    {'id': 'u1', 'displayName': '亚里士多德'},
    {'id': 'm1', 'displayName': '柏拉图'},
  ],
  'originalCreatorId': 'u1',
  'businessOwnerId': 'u1',
  'createdAt': '2026-11-01T02:00:00Z',
  'canTablePin': false,
  'route': {'reasonText': '按直属上级审核', 'reviewerAvailable': true},
};

FakeBackend detailBackend({bool allDay = false}) {
  final backend = FakeBackend();
  backend.on(
    'GET',
    '/tasks/t1',
    (_) => FakeResponse(pendingTask(allDay: allDay), etag: '"5"'),
  );
  backend.on('GET', '/tasks/t1/comments', (_) => FakeResponse({
    'items': [],
    'total': 0,
    'nextOffset': null,
  }));
  return backend;
}

Future<void> pumpDetail(
  WidgetTester tester,
  FakeBackend backend, {
  ReadContext readContext = const NormalReadContext(),
}) async {
  tester.view.physicalSize = const Size(390, 1200);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final container = buildTestContainer(backend: backend, user: employeeUser());
  addTearDown(container.dispose);
  await tester.pumpWidget(
    wrapWithScope(
      container,
      TaskDetailPage(taskId: 't1', readContext: readContext),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('任务详情按服务端标签颜色显示，并保留删除状态', (tester) async {
    final backend = detailBackend();
    backend.on('GET', '/tasks/t1', (_) => FakeResponse({
      ...pendingTask(),
      'tags': [
        {'id': 'blue', 'name': '分镜', 'color': '#DDEEFF', 'border': '#336699'},
        {'id': 'green', 'name': '后期', 'color': '#DDF1E1', 'deleted': true},
      ],
    }, etag: '"5"'));
    await pumpDetail(tester, backend);
    final badges = find.byType(TagBadge);
    expect(badges, findsNWidgets(2));
    final box = tester.widget<Container>(find.descendant(
      of: badges.first,
      matching: find.byType(Container),
    ).first);
    expect((box.decoration as BoxDecoration).color, const Color(0xFFDDEEFF));
    expect(find.text('后期（已删除）'), findsOneWidget);
  });

  testWidgets('详情紧凑层级：有效截止与提议截止分离，待审入口指向原申请', (tester) async {
    final backend = detailBackend();
    await pumpDetail(tester, backend);

    expect(find.text('待审任务'), findsOneWidget);
    expect(find.text('待审核'), findsOneWidget, reason: '待审状态只出现一次，不重复堆叠');
    expect(find.text('审核'), findsNothing, reason: '常驻审核路由段已移除');
    expect(find.textContaining('2026-11-11 18:00'), findsWidgets, reason: '截止取有效版本');
    expect(find.textContaining('2026-11-20'), findsNothing, reason: '提议截止不取代有效截止');
    expect(find.text('历史完成标准'), findsNothing, reason: '常规详情不展示完成标准');
    expect(find.text('当前已经完成的进展'), findsOneWidget);
    expect(find.text('查看当前申请'), findsOneWidget);
    expect(find.text('查看我的申请'), findsNothing, reason: '不使用泛化申请列表冒充原申请');

    final titleY = tester.getTopLeft(find.text('待审任务')).dy;
    final metaY = tester.getTopLeft(find.text('截止')).dy;
    final descY = tester.getTopLeft(find.text('说明')).dy;
    expect(titleY, lessThan(metaY));
    expect(metaY, lessThan(descY));
    expect(tester.takeException(), isNull);
  });

  testWidgets('全天任务截止按结束日显示，不拼开始时间', (tester) async {
    final backend = detailBackend(allDay: true);
    await pumpDetail(tester, backend);
    expect(find.textContaining('2026-11-12（全天）'), findsWidgets);
    expect(find.textContaining('2026-11-10 至 2026-11-12'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('查看当前申请打开对应的待审申请', (tester) async {
    final backend = detailBackend();
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    final router = GoRouter(
      initialLocation: '/tasks/t1',
      routes: [
        GoRoute(
          path: '/tasks/:id',
          builder: (context, state) => TaskDetailPage(
            taskId: state.pathParameters['id'] ?? '',
          ),
        ),
        GoRoute(
          path: '/approvals/:requestId',
          builder: (context, state) => Scaffold(
            body: Text('申请页 ${state.pathParameters['requestId']}'),
          ),
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(
          theme: PandoraTheme.build(),
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('查看当前申请'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('查看当前申请'));
    await tester.pumpAndSettle();
    expect(find.text('申请页 req-9'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('下属只读详情不出现进展、完成或待审写入口', (tester) async {
    final backend = detailBackend();
    await pumpDetail(
      tester,
      backend,
      readContext: const SubordinateReadContext(
        personId: 'u1',
        personName: '下属',
        chainOrigin: 'me',
      ),
    );
    expect(find.text('提交进展'), findsNothing);
    expect(find.text('提交完成'), findsNothing);
    expect(find.text('查看当前申请'), findsNothing);
    expect(find.text('编辑任务'), findsNothing);
    expect(find.textContaining('只读'), findsWidgets);
    expect(find.text('待审核'), findsOneWidget, reason: '只读仍可见待审状态');
    expect(tester.takeException(), isNull);
  });
}
