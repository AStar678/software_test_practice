import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/features/notifications/presentation/notifications_page.dart';

import '../support/test_harness.dart';

Map<String, Object?> record(String id, {bool unread = false, String category = 'result'}) => {
  'id': id,
  'eventType': 'task.create.applied',
  'title': '通知 $id',
  'summary': '通知摘要 $id',
  'createdAt': '2026-11-10T02:00:00Z',
  if (!unread) 'readAt': '2026-11-10T03:00:00Z',
  'rowVersion': 1,
  'category': category,
  'objectName': '任务 $id',
  'canReview': false,
  'purpose': '任务通知',
};

void main() {
  testWidgets('通知列表按服务结果筛选、分页且空待审不合成行', (tester) async {
    final requests = <Map<String, dynamic>>[];
    final backend = FakeBackend();
    backend.on('GET', '/notifications', (request) {
      requests.add(Map<String, dynamic>.from(request.query));
      final read = request.query['readStatus'];
      final category = request.query['category'];
      final offset = int.tryParse('${request.query['offset']}') ?? 0;
      if (category == 'review') {
        return FakeResponse({
          'items': [],
          'total': 0,
          'unreadCount': read == 'unread' ? 3 : 4,
          'nextOffset': null,
        });
      }
      if (read == 'unread') {
        return FakeResponse({
          'items': [record('n3', unread: true)],
          'total': 1,
          'unreadCount': 1,
          'nextOffset': null,
        });
      }
      if (offset == 0) {
        return FakeResponse({
          'items': [record('n1'), record('n2', unread: true)],
          'total': 3,
          'unreadCount': 2,
          'nextOffset': 2,
        });
      }
      return FakeResponse({
        'items': [record('n3', unread: true)],
        'total': 3,
        'unreadCount': 2,
        'nextOffset': null,
      });
    });
    final container = buildTestContainer(backend: backend, user: employeeUser());
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const NotificationsPage()));
    await tester.pumpAndSettle();

    expect(find.text('共 3 条'), findsOneWidget);
    expect(find.text('任务 n1'), findsOneWidget);
    expect(requests.last['offset'], 0);

    await tester.tap(find.text('加载更多'));
    await tester.pumpAndSettle();
    expect(requests.last['offset'], 2, reason: '下一页沿用服务返回的偏移');
    expect(find.text('任务 n3'), findsOneWidget);

    await tester.tap(find.text('未读'));
    await tester.pumpAndSettle();
    expect(requests.last['readStatus'], 'unread');
    expect(find.text('任务 n3'), findsOneWidget);
    expect(find.text('任务 n1'), findsNothing, reason: '已读项不混入未读筛选');

    await tester.tap(find.text('需我审核'));
    await tester.pumpAndSettle();
    expect(requests.last['category'], 'review');
    expect(requests.last['readStatus'], 'unread');
    expect(find.text('当前筛选条件下没有通知'), findsOneWidget);
    expect(find.text('共 0 条'), findsOneWidget);
    expect(find.byType(ListTile), findsNothing, reason: '服务待审为空时不合成行');
    expect(tester.takeException(), isNull);
  });
}
