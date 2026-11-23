import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/router/read_context.dart';
import 'package:pandora_employee/features/comments/presentation/comments_section.dart';
import 'package:pandora_employee/features/tasks/presentation/task_detail_page.dart';

import '../support/test_harness.dart';

Map<String, Object?> commentJson(int index) => {
  'id': 'c$index',
  'objectType': 'task',
  'objectId': 't1',
  'authorId': 'u1',
  'authorName': '作者$index',
  'body': '评论正文 $index',
  'rowVersion': 1,
  'createdAt': '2026-11-10T02:00:00Z',
  'canManage': false,
};

FakeBackend commentsBackend({int failSubmitStatus = 200}) {
  final backend = FakeBackend();
  backend.on('GET', '/tasks/t1/comments', (_) => FakeResponse({
    'items': [for (var index = 1; index <= 6; index++) commentJson(index)],
    'total': 6,
    'nextOffset': null,
    'nextCursor': null,
  }));
  backend.on('POST', '/tasks/t1/comments', (request) {
    if (failSubmitStatus >= 400) {
      return FakeResponse({'message': '发送失败，请重试'}, status: failSubmitStatus);
    }
    return FakeResponse(commentJson(7));
  });
  return backend;
}

Future<void> pumpWithKeyboard(
  WidgetTester tester,
  FakeBackend backend, {
  double keyboard = 320,
}) async {
  tester.view.physicalSize = const Size(390, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final container = buildTestContainer(backend: backend, user: employeeUser());
  addTearDown(container.dispose);
  await tester.pumpWidget(
    wrapWithScope(
      container,
      MediaQuery(
        data: MediaQueryData(
          size: const Size(390, 900),
          viewInsets: EdgeInsets.only(bottom: keyboard),
        ),
        child: Scaffold(
          body: const SafeArea(
            child: SingleChildScrollView(
              padding: EdgeInsets.all(16),
              child: Column(
                children: [
                  SizedBox(height: 700, child: Text('前置评论内容')),
                  CommentsSection(objectType: 'task', objectId: 't1'),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('键盘弹出时评论输入与发送可达，长文可编辑，收起保留草稿', (tester) async {
    final backend = commentsBackend();
    await pumpWithKeyboard(tester, backend);
    final input = find.descendant(
      of: find.byType(CommentsSection),
      matching: find.byType(TextField),
    );
    await tester.ensureVisible(input);
    await tester.pumpAndSettle();
    await tester.tap(input);
    await tester.pumpAndSettle();
    final long = [for (var index = 0; index < 10; index++) '第$index行评论草稿'].join('\n');
    await tester.enterText(input, long);
    await tester.pumpAndSettle();

    final send = find.byTooltip('发送评论');
    await tester.ensureVisible(send);
    await tester.pumpAndSettle();
    expect(send.hitTestable(), findsOneWidget, reason: '键盘上方仍可点击发送');
    final sendRect = tester.getRect(send);
    expect(sendRect.bottom, lessThanOrEqualTo(900 - 320 + 1));
    final inputRect = tester.getRect(input);
    expect(inputRect.height, greaterThan(40), reason: '输入框不被压成不可用高度');
    expect(find.text(long), findsOneWidget);

    // 收起键盘：草稿仍保留。
    await pumpWithKeyboard(tester, backend, keyboard: 0);
    expect(find.text(long), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('评论提交失败保留草稿，成功后才清空', (tester) async {
    final backend = commentsBackend(failSubmitStatus: 503);
    await pumpWithKeyboard(tester, backend, keyboard: 0);
    final input = find.descendant(
      of: find.byType(CommentsSection),
      matching: find.byType(TextField),
    );
    await tester.ensureVisible(input);
    await tester.pumpAndSettle();
    await tester.enterText(input, '失败草稿');
    await tester.tap(find.byTooltip('发送评论'));
    await tester.pumpAndSettle();
    expect(find.text('失败草稿'), findsOneWidget, reason: '提交失败不清空草稿');
    expect(find.textContaining('发送失败'), findsWidgets);

    final success = commentsBackend();
    await tester.pumpWidget(
      wrapWithScope(
        buildTestContainer(backend: success, user: employeeUser()),
        const Scaffold(
          body: SingleChildScrollView(
            child: CommentsSection(objectType: 'task', objectId: 't1'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '成功评论');
    await tester.tap(find.byTooltip('发送评论'));
    await tester.pumpAndSettle();
    expect(
      tester.widget<TextField>(find.byType(TextField)).controller!.text,
      isEmpty,
      reason: '成功后清空输入',
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('下属有评论权限时任务详情仍可发表评论', (tester) async {
    final backend = commentsBackend();
    backend.on('GET', '/tasks/t1', (_) => FakeResponse({
      'id': 't1',
      'taskId': 't1',
      'title': '下属可评论任务',
      'description': '说明',
      'priority': 'medium',
      'allDay': false,
      'startAt': '2026-11-10T02:00:00Z',
      'dueAt': '2026-11-10T10:00:00Z',
      'executionState': 'doing',
      'status': 'applied',
      'assigneeIds': ['u1'],
      'rowVersion': 1,
      'published': true,
      'pending': false,
      'frozen': false,
      'editableFields': [],
      'participants': [
        {'id': 'u1', 'displayName': '亚里士多德'},
      ],
      'originalCreatorId': 'u1',
      'businessOwnerId': 'u1',
    }, etag: '"1"'));
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final container = buildTestContainer(backend: backend, user: employeeUser());
    addTearDown(container.dispose);
    await tester.pumpWidget(
      wrapWithScope(
        container,
        const TaskDetailPage(
          taskId: 't1',
          readContext: SubordinateReadContext(
            personId: 'u1',
            personName: '下属',
            chainOrigin: '/people',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final input = find.descendant(
      of: find.byType(CommentsSection),
      matching: find.byType(TextField),
    );
    await tester.scrollUntilVisible(
      input,
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.enterText(input, '下属的合法评论');
    await tester.tap(find.byTooltip('发送评论'));
    await tester.pumpAndSettle();
    final posts = backend.requestsFor('POST', '/tasks/t1/comments');
    expect(posts, hasLength(1));
    expect(posts.single.jsonBody['body'], '下属的合法评论');
    expect(tester.takeException(), isNull);
  });
}
