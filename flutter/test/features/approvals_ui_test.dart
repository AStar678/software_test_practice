import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/features/approvals/presentation/approvals_pages.dart';

import '../support/test_harness.dart';

void main() {
  testWidgets('审核人看到逐字段原上新下与有序集合变化，批准使用申请版本', (tester) async {
    tester.view.physicalSize = const Size(420, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final backend = FakeBackend();
    var decided = false;
    Map<String, Object?> requestBody() => {
          'requestId': 'r1',
          'taskId': 't1',
          'kind': 'change',
          'status': decided ? 'approved' : 'pending',
          'comment': decided ? '同意调整' : null,
          'applicantId': 'u1',
          'currentReviewerId': 'm1',
          'rowVersion': decided ? 4 : 3,
          'title': '第一幕分镜节奏',
          'versionNo': 2,
          'createdAt': '2026-11-10T06:00:00Z',
          'applicableDeadline': '2026-11-15T10:00:00Z',
          'participants': [
            {'id': 'u1', 'displayName': '亚里士多德'},
            {'id': 'm1', 'displayName': '柏拉图'},
            {'id': 'u2', 'displayName': '阿基米德'},
          ],
          'proposedVersion': {
            'id': 'v2',
            'title': '第一幕分镜节奏（修订）',
            'assigneeIds': ['u2', 'u1'],
            'tags': [
              {'id': 'tag1', 'name': '重点镜头', 'color': '#F6D5D2'},
            ],
          },
          'baseVersion': {
            'id': 'v1',
            'title': '第一幕分镜节奏',
            'assigneeIds': ['u1', 'u2'],
            'tags': [],
          },
          'diff': [
            {'field': 'title', 'before': '第一幕分镜节奏', 'after': '第一幕分镜节奏（修订）'},
            {'field': 'assigneeIds', 'before': 'u1,u2', 'after': 'u2,u1'},
            {'field': 'tagIds', 'before': '', 'after': 'tag1'},
          ],
        };

    backend.on('GET', '/approval-requests/r1', (request) async {
      return FakeResponse(requestBody(), etag: decided ? '"4"' : '"3"');
    });
    backend.on('PATCH', '/approval-requests/r1', (request) async {
      decided = true;
      return FakeResponse({
        'taskId': 't1',
        'requestId': 'r1',
        'status': 'approved',
        'requestStatus': 'approved',
        'rowVersion': 4,
      });
    });

    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(id: 'm1', role: 'team_head'),
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const ApprovalDetailPage(requestId: 'r1')));
    await tester.pumpAndSettle();

    expect(find.text('逐字段原上新下'), findsOneWidget);
    expect(find.text('仅顺序变化'), findsOneWidget);
    expect(find.textContaining('原：第一幕分镜节奏'), findsOneWidget);
    expect(find.textContaining('新：第一幕分镜节奏（修订）'), findsOneWidget);
    expect(find.textContaining('1. 亚里士多德'), findsWidgets);
    expect(find.widgetWithText(FilledButton, '批准'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, '批准'));
    await tester.pumpAndSettle();

    final patches = backend.requestsFor('PATCH', '/approval-requests/r1');
    expect(patches, hasLength(1));
    expect(patches.single.jsonBody['decision'], 'approve');
    expect(patches.single.headers['If-Match'], '"3"');
    expect(patches.single.headers['Idempotency-Key'], isNotNull);
    expect(find.widgetWithText(FilledButton, '批准'), findsNothing, reason: '已处理申请不再显示裁决按钮');
    expect(find.text('已通过'), findsOneWidget);
    expect(find.text('同意调整'), findsOneWidget);
  });

  testWidgets('申请人只看到自身提议与撤销，不显示审核 diff', (tester) async {
    tester.view.physicalSize = const Size(420, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final backend = FakeBackend();
    backend.on('GET', '/approval-requests/r2', (request) async {
      return FakeResponse({
        'requestId': 'r2',
        'taskId': 't2',
        'kind': 'change',
        'status': 'pending',
        'applicantId': 'u1',
        'currentReviewerId': 'm1',
        'rowVersion': 1,
        'title': '我的任务',
        'participants': [
          {'id': 'u1', 'displayName': '亚里士多德'},
          {'id': 'm1', 'displayName': '柏拉图'},
        ],
        'proposedVersion': {
          'id': 'v9',
          'title': '我的任务（修订）',
          'assigneeIds': ['u1'],
          'tags': [],
          'progressNote': '已完成初稿',
        },
      }, etag: '"1"');
    });

    final container = buildTestContainer(backend: backend, user: employeeUser());
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const ApprovalDetailPage(requestId: 'r2')));
    await tester.pumpAndSettle();

    expect(find.text('本次提交内容'), findsOneWidget);
    expect(find.text('逐字段原上新下'), findsNothing);
    expect(find.text('撤销申请'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, '批准'), findsNothing);
    expect(find.textContaining('已完成初稿'), findsOneWidget);
  });
}
