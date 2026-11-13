import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/features/comments/presentation/comments_section.dart';

import '../support/test_harness.dart';

Map<String, Object?> comment(int index, {bool manage = false}) => {
      'id': 'c$index',
      'objectType': 'task',
      'objectId': 't1',
      'authorId': 'u1',
      'authorName': '作者$index',
      'body': '评论$index',
      'rowVersion': 1,
      'createdAt': '2026-11-10T02:00:00Z',
      'canManage': manage,
    };

Future<void> pumpComments(WidgetTester tester, FakeBackend backend) async {
  tester.view.physicalSize = const Size(390, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final container = buildTestContainer(backend: backend, user: employeeUser());
  addTearDown(container.dispose);
  await tester.pumpWidget(wrapWithScope(
    container,
    const Scaffold(body: SingleChildScrollView(child: CommentsSection(objectType: 'task', objectId: 't1'))),
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('评论使用稳定游标续页且不重复', (tester) async {
    final backend = FakeBackend();
    backend.on('GET', '/tasks/t1/comments', (request) async {
      final cursor = request.query['cursor'];
      if (cursor == null) {
        return FakeResponse({
          'items': [comment(1), comment(2)],
          'total': 3,
          'nextOffset': 2,
          'nextCursor': 'c2',
        });
      }
      return FakeResponse({
        'items': [comment(3)],
        'total': 3,
        'nextOffset': null,
        'nextCursor': null,
      });
    });
    await pumpComments(tester, backend);

    expect(find.text('评论（3）'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, '加载更多评论'));
    await tester.pumpAndSettle();
    expect(find.text('评论3'), findsOneWidget);
    expect(find.text('评论1'), findsOneWidget);
    expect(find.byType(ListTile), findsNWidgets(3));
    expect(backend.requestsFor('GET', '/tasks/t1/comments').last.query['cursor'], 'c2');
  });

  testWidgets('仅作者评论显示管理菜单，编辑使用行版本', (tester) async {
    final backend = FakeBackend();
    var patches = 0;
    backend.on('GET', '/tasks/t1/comments', (request) async => FakeResponse({
          'items': [comment(1, manage: true), comment(2)],
          'total': 2,
          'nextOffset': null,
          'nextCursor': null,
        }));
    backend.on('PATCH', '/comments/c1', (request) async {
      patches++;
      return FakeResponse({
        'commentId': 'c1',
        'objectType': 'task',
        'objectId': 't1',
        'authorId': 'u1',
        'authorName': '作者1',
        'body': '修改后的评论',
        'rowVersion': 2,
        'canManage': true,
      });
    });
    await pumpComments(tester, backend);

    expect(find.byTooltip('管理评论'), findsOneWidget);
    await tester.tap(find.byTooltip('管理评论'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('编辑'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, '修改后的评论');
    await tester.tap(find.widgetWithText(FilledButton, '保存'));
    await tester.pumpAndSettle();
    expect(patches, 1);
  });
}
