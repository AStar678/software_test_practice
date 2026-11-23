import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/features/people/domain/person_summary.dart';
import 'package:pandora_employee/features/tasks/presentation/assignee_picker.dart';

void main() {
  const people = [
    PersonSummary(id: 'u1', displayName: '亚里士多德', departmentName: '制作部', teamName: '原画组', positionName: '动画师'),
    PersonSummary(id: 'u2', displayName: '柏拉图', departmentName: '制作部', teamName: '分镜组', positionName: '组长'),
    PersonSummary(id: 'u3', displayName: '阿基米德', departmentName: '市场部', teamName: '品牌组', positionName: '策划'),
  ];

  Future<void> pump(WidgetTester tester, ValueChanged<List<PersonSummary>> onChanged) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: AssigneePicker(selected: const [], candidates: people, onChanged: onChanged),
        ),
      ),
    ));
  }

  testWidgets('负责人按部门和团队树状展开收起', (tester) async {
    var selected = <PersonSummary>[];
    await pump(tester, (next) => selected = next);
    expect(find.text('制作部'), findsOneWidget);
    expect(find.text('原画组'), findsOneWidget);
    expect(find.text('亚里士多德'), findsNothing, reason: '团队默认收起');

    await tester.tap(find.text('原画组'));
    await tester.pumpAndSettle();
    expect(find.text('亚里士多德'), findsOneWidget);
    await tester.tap(find.text('亚里士多德'));
    await tester.pumpAndSettle();
    expect(selected.map((person) => person.id), ['u1']);

    await tester.tap(find.text('制作部'));
    await tester.pumpAndSettle();
    expect(find.text('原画组'), findsNothing);
  });

  testWidgets('搜索自动展开命中部门和团队', (tester) async {
    await pump(tester, (_) {});
    await tester.enterText(find.byType(TextField), '柏拉图');
    await tester.pumpAndSettle();
    expect(find.text('柏拉图'), findsWidgets);
    expect(find.text('亚里士多德'), findsNothing);
    expect(find.text('市场部'), findsNothing);
  });

  testWidgets('负责人树随外层滚动自然展开，无独立限高滚动区', (tester) async {
    final many = [
      for (var index = 0; index < 14; index++)
        PersonSummary(
          id: 'p$index',
          displayName: '候选人$index',
          departmentName: '制作部',
          teamName: index.isEven ? '原画组' : '分镜组',
          positionName: '岗位$index',
        ),
    ];
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: Column(
              children: [
                AssigneePicker(
                  selected: const [],
                  candidates: many,
                  onChanged: (_) {},
                ),
                const SizedBox(height: 800),
                const Text('末端字段'),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('原画组'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('分镜组'));
    await tester.pumpAndSettle();
    expect(find.text('候选人13'), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(AssigneePicker),
        matching: find.byType(ListView),
      ),
      findsNothing,
    );
    expect(
      find.descendant(
        of: find.byType(AssigneePicker),
        matching: find.byType(SingleChildScrollView),
      ),
      findsNothing,
    );
    expect(
      tester.getSize(find.byType(AssigneePicker)).height,
      greaterThan(320),
      reason: '负责人树不再被 320 高度截断',
    );
    final outer = tester.state<ScrollableState>(
      find.byType(Scrollable).first,
    );
    expect(outer.position.pixels, 0);
    await tester.dragFrom(
      tester.getCenter(find.text('候选人0')),
      const Offset(0, -260),
    );
    await tester.pumpAndSettle();
    expect(outer.position.pixels, greaterThan(0), reason: '拖动负责人树滚动外层表单');
    await tester.ensureVisible(find.text('末端字段'));
    await tester.pumpAndSettle();
    expect(find.text('末端字段').hitTestable(), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
