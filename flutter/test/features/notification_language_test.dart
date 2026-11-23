import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/features/notifications/presentation/notification_detail_page.dart';

import '../support/test_harness.dart';

Map<String, Object?> detailJson({
  String? requestStatus = 'direct',
  String? requestKind = 'create',
  String? requestComment,
  bool canReadRequest = true,
  bool canReview = false,
  bool canWithdrawRequest = false,
  bool withdrawn = false,
  bool readonly = false,
  String? eventResult = '已通过并生效',
}) => {
  'id': 'n1',
  'eventType': 'task.approval.direct',
  'summary': '任务《示例任务》的申请结果。',
  'createdAt': '2026-11-10T02:00:00Z',
  'readAt': '2026-11-10T03:00:00Z',
  'rowVersion': 1,
  'category': 'result',
  'title': '示例任务',
  'objectName': '示例任务',
  'purpose': '任务通知',
  'taskId': 't1',
  'canOpenTask': false,
  'requestId': canReadRequest || canReview ? 'r1' : null,
  'requestStatus': requestStatus,
  'requestKind': requestKind,
  'requestComment': requestComment,
  'canReadRequest': canReadRequest,
  'canReview': canReview,
  'canWithdrawRequest': canWithdrawRequest,
  'withdrawn': withdrawn,
  'readonly': readonly,
  'relationLost': false,
  'eventResult': eventResult,
};

Future<void> pumpDetail(WidgetTester tester, Map<String, Object?> json) async {
  final backend = FakeBackend();
  backend.on('GET', '/notifications/n1', (_) => FakeResponse(json));
  final container = buildTestContainer(backend: backend, user: employeeUser());
  addTearDown(container.dispose);
  await tester.pumpWidget(
    wrapWithScope(
      container,
      const NotificationDetailPage(notificationId: 'n1'),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('申请通知不显示事件撤回或撤销提示，保留查看原申请', (tester) async {
    await pumpDetail(tester, {
      ...detailJson(canWithdrawRequest: true),
      'canWithdraw': true,
    });
    expect(find.widgetWithText(FilledButton, '查看原申请'), findsOneWidget);
    expect(find.textContaining('撤回事件（'), findsNothing);
    expect(find.text('查看并撤销原申请'), findsNothing);
    expect(find.textContaining('业务申请撤销请'), findsNothing);
  });

  testWidgets('非申请事件通知保留原有撤回入口', (tester) async {
    await pumpDetail(tester, {
      ...detailJson(canReadRequest: false),
      'canWithdraw': true,
    });
    expect(find.text('撤回事件（严格 180 秒内）'), findsOneWidget);
  });

  testWidgets('direct 申请显示中文「创建任务 · 已生效」且不直出状态码', (tester) async {
    await pumpDetail(tester, detailJson());
    expect(find.text('申请：创建任务 · 已生效'), findsOneWidget);
    expect(find.textContaining('direct'), findsNothing);
    expect(find.text('结果：已通过并生效'), findsOneWidget, reason: '业务结果与申请状态分开');
    expect(tester.takeException(), isNull);
  });

  testWidgets('历史申请显示已通过并保留按权查看入口', (tester) async {
    await pumpDetail(
      tester,
      detailJson(requestStatus: 'approved', canReview: false),
    );
    expect(find.text('申请：创建任务 · 已通过'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, '查看原申请'), findsOneWidget);
  });

  testWidgets('当前有效待审显示待审核和审核入口', (tester) async {
    await pumpDetail(
      tester,
      detailJson(requestStatus: 'pending', canReview: true),
    );
    expect(find.text('申请：创建任务 · 待审核'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, '审核原申请'), findsOneWidget);
    expect(find.textContaining('pending'), findsNothing);
  });

  testWidgets('未知类型和未知结果使用可理解兜底，不泄漏原枚举', (tester) async {
    await pumpDetail(
      tester,
      detailJson(requestStatus: 'legacy_state', requestKind: 'legacy_kind'),
    );
    expect(find.text('申请：任务申请 · 已处理'), findsOneWidget);
    expect(find.textContaining('legacy_state'), findsNothing);
    expect(find.textContaining('legacy_kind'), findsNothing);
  });

  testWidgets('没有申请元数据时不构造申请状态', (tester) async {
    await pumpDetail(
      tester,
      detailJson(requestStatus: null, requestKind: null, eventResult: null),
    );
    expect(find.textContaining('申请：'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('无权限时不显示申请类型、结果和处理意见', (tester) async {
    await pumpDetail(
      tester,
      detailJson(
        canReadRequest: false,
        canReview: false,
        requestStatus: 'pending',
        requestKind: 'create',
        requestComment: '仅审核人可见的处理意见',
      ),
    );
    expect(find.textContaining('申请：'), findsNothing);
    expect(find.textContaining('仅审核人可见'), findsNothing);
    expect(find.widgetWithText(FilledButton, '查看原申请'), findsNothing);
    expect(find.widgetWithText(FilledButton, '审核原申请'), findsNothing);
  });

  testWidgets('已撤回不显示申请元数据和正文，只保留安全摘要', (tester) async {
    await pumpDetail(
      tester,
      detailJson(
        withdrawn: true,
        canReadRequest: true,
        requestStatus: 'approved',
        requestComment: '撤回后不应出现的处理意见',
      ),
    );
    expect(find.text('该事件已撤回，仅保留安全摘要。'), findsOneWidget);
    expect(find.textContaining('申请：'), findsNothing);
    expect(find.textContaining('撤回后不应出现'), findsNothing);
    expect(find.textContaining('approved'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
