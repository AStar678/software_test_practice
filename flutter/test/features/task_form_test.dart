import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/features/tasks/presentation/task_detail_page.dart';
import 'package:pandora_employee/features/tasks/presentation/task_form_page.dart';

import '../support/test_harness.dart';

void main() {
  mainEditTests();
  testWidgets('新建任务：普通员工默认本人、提交体不含完成标准、真实审核人回读', (tester) async {
    tester.view.physicalSize = const Size(420, 2600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final backend = FakeBackend();
    backend.on(
      'POST',
      '/tasks/reviewer-preview',
      (_) => FakeResponse({
        'requiresApproval': true,
        'reviewerId': 'm1',
        'route': {
          'participants': [
            {'id': 'm1', 'displayName': '预览时的上级'},
          ],
        },
      }),
    );
    backend.on('GET', '/assignee-candidates', (request) async {
      return FakeResponse({
        'items': [
          {'id': 'u1', 'displayName': '亚里士多德', 'departmentName': '制作部', 'teamName': '原画组', 'positionName': '动画师'},
          {
            'id': 'm1',
            'displayName': '柏拉图',
            'departmentName': '制作部',
            'teamName': '分镜组',
            'positionName': '组长',
            'managerId': 'u-parent',
          },
        ],
        'empty': false,
        'purpose': 'create',
      });
    });
    backend.on('GET', '/tags', (request) async {
      return FakeResponse({
        'items': [
          {'id': 't1', 'name': '重点镜头', 'color': '#F6D5D2', 'border': '#C05B52', 'deleted': false, 'rowVersion': 1},
        ],
      });
    });
    backend.on('POST', '/tasks', (request) async {
      return FakeResponse({'taskId': 'new-task', 'requestId': 'r1', 'outcome': 'pending', 'rowVersion': 1});
    });
    backend.on('GET', '/approval-requests/r1', (request) async {
      return FakeResponse({
        'requestId': 'r1',
        'taskId': 'new-task',
        'kind': 'create',
        'status': 'pending',
        'applicantId': 'u1',
        'currentReviewerId': 'm1',
        'rowVersion': 1,
        'title': '联调任务',
        'participants': [
          {'id': 'u1', 'displayName': '亚里士多德'},
          {'id': 'm1', 'displayName': '柏拉图'},
        ],
        'proposedVersion': {
          'id': 'v1',
          'title': '联调任务',
          'assigneeIds': ['u1'],
          'tags': [],
        },
      }, etag: '"1"');
    });

    final container = buildTestContainer(backend: backend, user: employeeUser(), accountEpoch: () => 1);
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const TaskCreatePage()));
    await tester.pumpAndSettle();

    expect(find.text('新建任务'), findsOneWidget);
    expect(find.text('审核人：预览时的上级'), findsOneWidget);
    expect(backend.requestsFor('POST', '/tasks/reviewer-preview'), hasLength(1));
    expect(find.textContaining('亚里士多德'), findsWidgets, reason: '普通员工默认负责人为本人');
    expect(find.text('历史完成标准（可留空）'), findsNothing, reason: '新建不提供完成标准');

    await tester.enterText(find.byType(TextFormField).at(0), '联调任务');
    await tester.enterText(find.byType(TextFormField).at(1), '用于检查提交体的说明');
    await tester.ensureVisible(find.text('提交任务'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('提交任务'));
    await tester.pumpAndSettle();
    expect(find.text('已提交审核'), findsOneWidget);
    expect(find.textContaining('柏拉图'), findsWidgets);

    final posts = backend.requestsFor('POST', '/tasks');
    expect(posts, hasLength(1));
    final payload = posts.single.jsonBody;
    expect(payload['title'], '联调任务');
    expect(payload['description'], '用于检查提交体的说明');
    expect(payload.containsKey('acceptanceCriteria'), isFalse);
    expect(payload['assigneeIds'], ['u1']);
    expect(payload['allDay'], isFalse);
    expect(payload['startAt'], isNotNull);
    expect(payload['dueAt'], isNotNull);
    expect(posts.single.headers['Idempotency-Key'], isNotNull);

    await tester.tap(find.text('知道了'));
    await tester.pumpAndSettle();
  });

  testWidgets('新建任务：没有负责人时拒绝提交并保留草稿', (tester) async {
    tester.view.physicalSize = const Size(420, 2600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final backend = FakeBackend();
    backend.on(
      'POST',
      '/tasks/reviewer-preview',
      (_) => FakeResponse({
        'requiresApproval': true,
        'reviewerId': 'm1',
        'route': {
          'participants': [
            {'id': 'm1', 'displayName': '预览时的上级'},
          ],
        },
      }),
    );
    backend.on('GET', '/assignee-candidates', (request) async => FakeResponse({'items': []}));
    backend.on('GET', '/tags', (request) async => FakeResponse({'items': []}));
    final container = buildTestContainer(backend: backend, user: employeeUser(), accountEpoch: () => 1);
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const TaskCreatePage()));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).at(0), '无负责人任务');
    await tester.enterText(find.byType(TextFormField).at(1), '说明');
    // 移除默认本人负责人。
    await tester.ensureVisible(find.text('移除'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('移除'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('提交任务'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('提交任务'));
    await tester.pumpAndSettle();

    expect(find.text('至少需要一位负责人'), findsOneWidget);
    expect(backend.requestsFor('POST', '/tasks'), isEmpty);
    expect(find.text('无负责人任务'), findsOneWidget, reason: '失败保留草稿');
  });
}

Map<String, Object?> _editTaskJson() => {
  'id': 't1',
  'taskId': 't1',
  'title': '原任务名',
  'description': '原任务说明',
  'acceptanceCriteria': '旧完成标准应保留在服务端',
  'priority': 'medium',
  'allDay': false,
  'startAt': '2026-11-10T02:00:00Z',
  'dueAt': '2026-11-10T10:00:00Z',
  'executionState': 'doing',
  'status': 'applied',
  'assigneeIds': ['u1'],
  'tags': [
    {
      'id': 't1',
      'name': '重点镜头',
      'color': '#F6D5D2',
      'border': '#C05B52',
      'deleted': false,
      'rowVersion': 1,
    },
  ],
  'tagIds': ['t1'],
  'rowVersion': 3,
  'published': true,
  'editableFields': [
    'title',
    'description',
    'acceptanceCriteria',
    'assigneeIds',
    'tagIds',
    'allDay',
    'startAt',
    'dueAt',
  ],
  'participants': [
    {'id': 'u1', 'displayName': '亚里士多德'},
    {'id': 'm1', 'displayName': '柏拉图'},
  ],
  'route': {'reasonText': '按直属上级审核', 'reviewerAvailable': true},
};

void _fakesForEditForm(FakeBackend backend) {
  backend.on('GET', '/tasks/t1', (_) => FakeResponse(_editTaskJson(), etag: '"3"'));
  backend.on('GET', '/assignee-candidates', (_) => FakeResponse({
    'items': [
      {'id': 'u1', 'displayName': '亚里士多德', 'departmentName': '制作部', 'teamName': '原画组', 'positionName': '动画师'},
      for (var index = 0; index < 10; index++)
        {
          'id': 'c$index',
          'displayName': '候选人$index',
          'departmentName': '制作部',
          'teamName': '分镜组',
          'positionName': '岗位$index',
        },
    ],
    'empty': false,
    'purpose': 'edit',
  }));
  backend.on('GET', '/tags', (_) => FakeResponse({
    'items': [
      {'id': 't1', 'name': '重点镜头', 'color': '#F6D5D2', 'border': '#C05B52', 'deleted': false, 'rowVersion': 1},
    ],
  }));
  backend.on('POST', '/tasks/reviewer-preview', (_) => FakeResponse({
    'requiresApproval': true,
    'reviewerId': 'm1',
    'route': {
      'participants': [
        {'id': 'm1', 'displayName': '柏拉图'},
      ],
    },
  }));
  backend.on('PATCH', '/tasks/t1', (_) => FakeResponse({
    'taskId': 't1',
    'requestId': 'r1',
    'outcome': 'pending',
    'rowVersion': 4,
  }));
  backend.on('GET', '/approval-requests/r1', (_) => FakeResponse({
    'requestId': 'r1',
    'taskId': 't1',
    'kind': 'change',
    'status': 'pending',
    'applicantId': 'u1',
    'currentReviewerId': 'm1',
    'rowVersion': 1,
    'title': '改名后的任务',
    'participants': [
      {'id': 'u1', 'displayName': '亚里士多德'},
      {'id': 'm1', 'displayName': '柏拉图'},
    ],
    'proposedVersion': {'id': 'v2', 'title': '改名后的任务', 'assigneeIds': ['u1'], 'tags': []},
  }, etag: '"1"'));
}

void mainEditTests() {
  testWidgets('编辑不显示也不提交完成标准，移除最后标签发送空数组', (tester) async {
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final backend = FakeBackend();
    _fakesForEditForm(backend);
    final container = buildTestContainer(backend: backend, user: employeeUser(), accountEpoch: () => 1);
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const TaskEditPage(taskId: 't1')));
    await tester.pumpAndSettle();

    expect(find.text('历史完成标准（可留空）'), findsNothing);
    expect(find.textContaining('完成标准'), findsNothing);
    expect(find.textContaining('保存时会显式清空'), findsNothing);

    await tester.enterText(find.byType(TextFormField).first, '改名后的任务');
    await tester.pumpAndSettle();

    // 展开较长的负责人树后，表单后续字段仍随外层滚动到达。
    final scrollable = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(find.text('分镜组'), 300, scrollable: scrollable);
    await tester.pumpAndSettle();
    await tester.tap(find.text('分镜组'));
    await tester.pumpAndSettle();
    expect(find.text('候选人9'), findsOneWidget);
    final outer = tester.state<ScrollableState>(scrollable);
    final before = outer.position.pixels;
    await tester.dragFrom(tester.getCenter(find.text('候选人0')), const Offset(0, -300));
    await tester.pumpAndSettle();
    expect(outer.position.pixels, greaterThan(before), reason: '负责人树随外层滚动');

    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('tag-tile-t1')),
      300,
      scrollable: scrollable,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('tag-tile-t1')));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(find.text('保存修改'), 300, scrollable: scrollable);
    await tester.pumpAndSettle();
    expect(find.text('保存修改').hitTestable(), findsOneWidget, reason: '末端字段可达');
    await tester.enterText(find.byType(TextFormField).last, '测试修改');
    await tester.pumpAndSettle();
    await tester.tap(find.text('保存修改'));
    await tester.pumpAndSettle();
    expect(find.text('已提交审核'), findsOneWidget);
    await tester.tap(find.text('知道了'));
    await tester.pumpAndSettle();

    final patches = backend.requestsFor('PATCH', '/tasks/t1');
    expect(patches, hasLength(1));
    final payload = patches.single.jsonBody;
    expect(payload['command'], 'change');
    expect(payload['title'], '改名后的任务');
    expect(payload['reason'], '测试修改');
    expect(payload['tagIds'], isEmpty, reason: '移除最后一个标签仍显式传空数组');
    expect(payload.containsKey('acceptanceCriteria'), isFalse);
    expect(patches.single.headers['If-Match'], '"3"');
    expect(tester.takeException(), isNull);
  });

  testWidgets('常规任务详情不展示历史完成标准', (tester) async {
    final backend = FakeBackend();
    _fakesForEditForm(backend);
    backend.on('GET', '/tasks/t1/comments', (_) => FakeResponse({
      'items': [],
      'total': 0,
      'nextOffset': null,
    }));
    final container = buildTestContainer(backend: backend, user: employeeUser(), accountEpoch: () => 1);
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const TaskDetailPage(taskId: 't1')));
    await tester.pumpAndSettle();
    expect(find.text('原任务名'), findsWidgets);
    expect(find.textContaining('完成标准'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
