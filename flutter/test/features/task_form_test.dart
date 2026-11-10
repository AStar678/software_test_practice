import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/features/tasks/presentation/task_form_page.dart';

import '../support/test_harness.dart';

void main() {
  testWidgets('新建任务：普通员工默认本人、提交体不含完成标准、真实审核人回读', (tester) async {
    tester.view.physicalSize = const Size(420, 2600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final backend = FakeBackend();
    backend.on('GET', '/assignee-candidates', (request) async {
      return FakeResponse({
        'items': [
          {
            'id': 'u1',
            'displayName': '亚里士多德',
            'departmentName': '制作部',
            'teamName': '原画组',
            'positionName': '动画师',
          },
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
        'proposedVersion': {'id': 'v1', 'title': '联调任务', 'assigneeIds': ['u1'], 'tags': []},
      }, etag: '"1"');
    });

    final container = buildTestContainer(backend: backend, user: employeeUser());
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const TaskCreatePage()));
    await tester.pumpAndSettle();

    expect(find.text('新建任务'), findsOneWidget);
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
    backend.on('GET', '/assignee-candidates', (request) async => FakeResponse({'items': []}));
    backend.on('GET', '/tags', (request) async => FakeResponse({'items': []}));
    final container = buildTestContainer(backend: backend, user: employeeUser());
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
