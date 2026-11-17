import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/features/home/domain/home_data.dart';
import 'package:pandora_employee/features/home/presentation/home_lists.dart';
import 'package:pandora_employee/features/home/presentation/home_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/test_harness.dart';

void main() {
  testWidgets('body-only事件纪两行折叠、按ID独立展开且保留原文', (tester) async {
    final bodies = ['第一条\n第二行\n第三行\n第四行\n<b>纯文本</b>', '第二条\n第二行\n第三行\n第四行'];
    final backend = FakeBackend();
    backend.on('GET', '/home', (_) => FakeResponse({
      'companyItems': [
        for (var i = 0; i < bodies.length; i++) {'id': 'c$i', 'body': bodies[i]},
      ],
    }));
    final container = buildTestContainer(backend: backend, user: employeeUser());
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const HomeEventsPage()));
    await tester.pumpAndSettle();
    Text body(int i) => tester.widget<Text>(find.text(bodies[i]));
    expect(body(0).maxLines, 2);
    expect(body(1).maxLines, 2);
    await tester.tap(find.text(bodies[0]));
    await tester.pumpAndSettle();
    await tester.tap(find.text(bodies[1]));
    await tester.pumpAndSettle();
    await tester.tap(find.text(bodies[0]));
    await tester.pumpAndSettle();
    expect(body(0).maxLines, 2);
    expect(body(1).maxLines, isNull);
    expect(body(0).data, contains('<b>纯文本</b>'));
    expect(find.byType(HomeEventsPage), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('看板直接使用有效截止和执行状态，仅清单严格逾期行红底', (tester) async {
    final backend = FakeBackend();
    final tasks = [
      {'taskId': 't0', 'title': '恰好截止', 'dueAt': '2026-11-10T04:00:00Z', 'executionState': 'todo'},
      {'taskId': 't1', 'title': '有效版逾期', 'dueAt': '2026-11-10T03:59:59Z', 'executionState': 'doing',
        'pendingSchedule': {'dueAt': '2026-11-12T00:00:00Z'}},
      {'taskId': 't2', 'title': '已完成', 'dueAt': '2026-11-09T00:00:00Z', 'executionState': 'done'},
    ];
    backend.on('GET', '/home', (_) => FakeResponse({'assignedTasks': tasks}));
    backend.on('GET', '/daily-items', (_) => FakeResponse({'items': [], 'total': 0}));
    final container = buildTestContainer(backend: backend, user: employeeUser());
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const HomeBoardPage()));
    await tester.pumpAndSettle();
    expect(tester.widget<Card>(find.widgetWithText(Card, '有效版逾期')).color, const Color(0xFFF8E7E7));
    expect(tester.widget<Card>(find.widgetWithText(Card, '恰好截止')).color, isNull);
    expect(tester.widget<Card>(find.widgetWithText(Card, '已完成')).color, isNull);
    expect(backend.requestsFor('GET', '/tasks'), isEmpty);
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(wrapWithScope(container, const HomePage()));
    await tester.pumpAndSettle();
    expect(tester.widget<Card>(find.widgetWithText(Card, '有效版逾期')).color, isNull);
    expect(tester.takeException(), isNull);
  });

  test('首页DTO保服务顺序和原始正文，不从旧标题或待审排期派生', () {
    final data = HomeData.fromJson({
      'companyItems': [{'id': 'c1', 'body': '原文\n完整保留', 'title': '退役字段'}],
      'assignedTasks': [
        {'taskId': 't2', 'dueAt': '2026-11-10T04:00:00Z', 'executionState': 'todo'},
        {'taskId': 't1', 'dueAt': '2026-11-09T04:00:00Z', 'executionState': 'todo'},
      ],
    });
    expect(data.companyItems.single.body, '原文\n完整保留');
    expect(data.assignedTasks.map((t) => t.taskId), ['t2', 't1']);
    expect(data.assignedTasks.first.isOverdueAt(DateTime.utc(2026, 11, 10, 4)), isFalse);
    expect(data.assignedTasks.last.isOverdueAt(DateTime.utc(2026, 11, 10, 4)), isTrue);
  });
}
