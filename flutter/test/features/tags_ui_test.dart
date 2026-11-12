import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/features/tags/presentation/tag_manage_page.dart';
import 'package:pandora_employee/features/tags/presentation/tag_selector.dart';
import 'package:pandora_employee/features/tasks/domain/task_record.dart';

import '../support/test_harness.dart';

void main() {
  testWidgets('共用标签保留删除快照且不重新挂回', (tester) async {
    const deleted = TaskTag(id: 'old', name: '旧标签', deleted: true, color: '#FF0000');
    const fresh = TaskTag(id: 'new', name: '新标签', color: '#00FF00');
    var selected = <TaskTag>[deleted];
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: StatefulBuilder(
          builder: (context, setState) => TagSelector(
            selected: selected,
            catalog: const [deleted, fresh],
            onChanged: (next) => setState(() => selected = next),
          ),
        ),
      ),
    ));

    expect(find.text('旧标签（已删除）'), findsOneWidget);
    expect(find.text('旧标签'), findsNothing, reason: '已删除项不能作为可新增候选出现');
    expect(find.widgetWithText(ActionChip, '新标签'), findsOneWidget);

    await tester.tap(find.byTooltip('Delete'));
    await tester.pumpAndSettle();
    expect(find.text('旧标签（已删除）'), findsNothing);
    expect(find.widgetWithText(ActionChip, '旧标签'), findsNothing);
  });

  testWidgets('只有固定创始人能看到标签维护入口', (tester) async {
    final backend = FakeBackend();
    backend.on('GET', '/tags', (request) async => FakeResponse({
          'items': [
            {'id': 't1', 'name': '标签一', 'color': '#FFE1EA', 'rowVersion': 1, 'deleted': false},
          ],
        }));

    for (final founder in [true, false]) {
      final container = buildTestContainer(
        backend: backend,
        user: employeeUser(role: founder ? 'founder' : 'employee'),
      );
      addTearDown(container.dispose);
      await tester.pumpWidget(wrapWithScope(container, const TagManagePage()));
      await tester.pumpAndSettle();
      if (founder) {
        expect(find.text('新建标签'), findsOneWidget);
        expect(find.text('标签一'), findsOneWidget);
      } else {
        expect(find.text('新建标签'), findsNothing);
        expect(find.textContaining('仅固定创始人'), findsOneWidget);
      }
      await tester.pumpWidget(const SizedBox.shrink());
    }
  });
}
