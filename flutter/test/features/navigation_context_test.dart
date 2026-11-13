import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/router/navigation_targets.dart';
import 'package:pandora_employee/core/router/read_context.dart';
import 'package:pandora_employee/features/approvals/presentation/approvals_pages.dart';
import 'package:pandora_employee/features/notifications/presentation/notification_task_page.dart';
import 'package:pandora_employee/features/shell/destination_pages.dart';
import 'package:pandora_employee/features/tasks/presentation/task_detail_page.dart';
import 'package:pandora_employee/features/work_logs/presentation/work_logs_page.dart';

import '../support/test_harness.dart';

Map<String, Object?> taskBody() => {
      'id': 't1',
      'taskId': 't1',
      'title': '下属任务',
      'description': '说明',
      'priority': 'medium',
      'allDay': false,
      'startAt': '2026-11-10T02:00:00Z',
      'dueAt': '2026-11-11T10:00:00Z',
      'executionState': 'doing',
      'status': 'applied',
      'assigneeIds': ['u1'],
      'rowVersion': 3,
      'published': true,
      'canReschedule': true,
      'canPin': true,
      'canTablePin': true,
      'editableFields': ['title', 'startAt', 'dueAt'],
      'participants': [
        {'id': 'u1', 'displayName': '亚里士多德'},
      ],
      'originalCreatorId': 'u1',
      'businessOwnerId': 'u1',
    };

Map<String, Object?> logBody() => {
      'id': 'l1',
      'businessDate': '2026-11-10',
      'body': '下属日志',
      'authorId': 'u1',
      'authorName': '亚里士多德',
      'createdAt': '2026-11-10T02:00:00Z',
      'frozen': false,
      'editable': true,
      'rowVersion': 1,
      'tagIds': [],
      'tags': [],
    };

Map<String, Object?> approvalBody() => {
      'requestId': 'r1',
      'taskId': 't1',
      'kind': 'change',
      'status': 'pending',
      'applicantId': 'u1',
      'currentReviewerId': 'm1',
      'rowVersion': 1,
      'title': '下属申请',
      'createdAt': '2026-11-10T06:00:00Z',
      'participants': [
        {'id': 'u1', 'displayName': '亚里士多德'},
        {'id': 'm1', 'displayName': '柏拉图'},
      ],
      'diff': [],
    };

Future<void> pump(WidgetTester tester, FakeBackend backend, Widget child) async {
  tester.view.physicalSize = const Size(420, 1200);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final container = buildTestContainer(backend: backend, user: employeeUser());
  addTearDown(container.dispose);
  await tester.pumpWidget(wrapWithScope(container, child));
  await tester.pumpAndSettle();
}

void main() {
  test('上下文路由保持同源 personId 与 history 路径', () {
    const subordinate = SubordinateReadContext(personId: 'p1', personName: '下属甲', chainOrigin: 'people');
    expect(NavigationTargets.task(subordinate, 't1'), contains('/people/p1/tasks/t1'));
    expect(NavigationTargets.task(subordinate, 't1'), contains('name=%E4%B8%8B%E5%B1%9E%E7%94%B2'));
    expect(NavigationTargets.log(subordinate, 'l1'), contains('/people/p1/logs/l1'));
    expect(NavigationTargets.approval(subordinate, 'r1'), contains('/people/p1/approvals/r1'));
    expect(
      NavigationTargets.task(const HistoryNotificationReadContext(notificationId: 'n1'), 'ignored'),
      '/notifications/n1/task',
    );
  });

  testWidgets('下属任务详情即使本人可编辑也只读并保留评论', (tester) async {
    final backend = FakeBackend();
    backend.on('GET', '/tasks/t1', (request) async => FakeResponse(taskBody(), etag: '"3"'));
    backend.on('GET', '/tasks/t1/comments', (request) async => FakeResponse({'items': [], 'total': 0, 'nextOffset': null, 'nextCursor': null}));
    await pump(
      tester,
      backend,
      const TaskDetailPage(
        taskId: 't1',
        readContext: SubordinateReadContext(personId: 'p1', personName: '下属甲', chainOrigin: 'people'),
      ),
    );

    expect(find.textContaining('下属 下属甲'), findsWidgets);
    expect(find.text('编辑任务'), findsNothing);
    expect(find.text('提交进展'), findsNothing);
    expect(find.text('交接任务'), findsNothing);
    expect(find.text('置顶到表单'), findsNothing);
    expect(find.text('评论（0）'), findsOneWidget);
  });

  testWidgets('管理者的我的页面显示下属入口', (tester) async {
    final backend = FakeBackend();
    final container = buildTestContainer(backend: backend, user: employeeUser(role: 'founder'));
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const MePage()));
    await tester.pumpAndSettle();
    expect(find.text('我的下属'), findsOneWidget);
  });

  testWidgets('下属日志只读但保留评论，历史通知任务无业务入口', (tester) async {
    final backend = FakeBackend();
    backend.on('GET', '/work-logs/l1', (request) async => FakeResponse(logBody(), etag: '"1"'));
    backend.on('GET', '/work-logs/l1/comments', (request) async => FakeResponse({'items': [], 'total': 0, 'nextOffset': null, 'nextCursor': null}));
    await pump(
      tester,
      backend,
      const WorkLogDetailPage(
        logId: 'l1',
        readContext: SubordinateReadContext(personId: 'p1', personName: '下属甲', chainOrigin: 'people'),
      ),
    );
    expect(find.byTooltip('编辑日志'), findsNothing);
    expect(find.byTooltip('删除日志'), findsNothing);
    expect(find.text('评论（0）'), findsOneWidget);

    await pump(tester, FakeBackend(), const NotificationTaskPage(notificationId: 'n1'));
    expect(find.textContaining('不提供评论'), findsOneWidget);
    expect(find.text('评论（0）'), findsNothing);
  });

  testWidgets('下属申请隐藏批准、拒绝、撤销与重提', (tester) async {
    final backend = FakeBackend();
    backend.on('GET', '/approval-requests/r1', (request) async => FakeResponse(approvalBody(), etag: '"1"'));
    await pump(
      tester,
      backend,
      const ApprovalDetailPage(
        requestId: 'r1',
        readContext: SubordinateReadContext(personId: 'p1', personName: '下属甲', chainOrigin: 'people'),
      ),
    );
    expect(find.text('批准'), findsNothing);
    expect(find.text('拒绝'), findsNothing);
    expect(find.text('撤销申请'), findsNothing);
    expect(find.text('修改并重提'), findsNothing);
    expect(find.textContaining('只读浏览'), findsOneWidget);
  });
}
