import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/features/work_logs/presentation/work_logs_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/test_harness.dart';

Map<String, Object?> logJson(String id, String date, {bool editable = true, bool frozen = false}) => {
      'id': id,
      'businessDate': date,
      'body': '日志 $id',
      'authorId': 'u1',
      'authorName': '亚里士多德',
      'createdAt': '2026-11-10T02:00:00Z',
      'frozen': frozen,
      'editable': editable,
      'rowVersion': 1,
      'tagIds': [],
      'tags': [],
    };

Map<String, Object?> taskJson(String id, String title) => {
      'id': id,
      'taskId': id,
      'title': title,
      'published': true,
      'executionState': 'todo',
      'assigneeIds': ['u1'],
      'rowVersion': 1,
      'editableFields': [],
      'participants': [
        {'id': 'u1', 'displayName': '亚里士多德'},
      ],
    };

void configureCommon(FakeBackend backend) {
  backend.on('GET', '/tags', (request) async => FakeResponse({'items': []}));
  backend.on('GET', '/tasks', (request) async => FakeResponse({'items': [taskJson('t1', '关联任务一')], 'nextCursor': null}));
}

Future<void> pumpEditor(WidgetTester tester, FakeBackend backend) async {
  SharedPreferences.setMockInitialValues({});
  tester.view.physicalSize = const Size(390, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final container = buildTestContainer(backend: backend, user: employeeUser());
  addTearDown(container.dispose);
  await tester.pumpWidget(wrapWithScope(container, const WorkLogEditorPage()));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('日志列表只读本人范围并按业务日期展示相对日期', (tester) async {
    final backend = FakeBackend();
    backend.on('GET', '/work-logs', (request) async => FakeResponse({
          'items': [logJson('b', '2026-11-10'), logJson('a', '2026-11-09')],
          'total': 2,
          'nextOffset': null,
        }));
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final container = buildTestContainer(backend: backend, user: employeeUser());
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const WorkLogsPage()));
    await tester.pumpAndSettle();

    expect(find.text('2026-11-10'), findsOneWidget);
    expect(find.text('2026-11-09'), findsOneWidget);
    expect(find.text('今天'), findsOneWidget);
    expect(find.text('昨天'), findsOneWidget);
    final request = backend.requestsFor('GET', '/work-logs').last;
    expect(request.query['scope'], 'self');
    expect(request.query.containsKey('authorId'), isFalse);
  });

  testWidgets('新建日志只显示近三日缺失日期', (tester) async {
    final backend = FakeBackend();
    configureCommon(backend);
    backend.on('GET', '/work-logs', (request) async => FakeResponse({
          'items': [logJson('a', '2026-11-10'), logJson('b', '2026-11-09')],
          'total': 2,
          'nextOffset': null,
        }));
    await pumpEditor(tester, backend);

    final chips = tester.widgetList<ChoiceChip>(find.byType(ChoiceChip)).toList();
    expect(chips, hasLength(1));
    expect((chips.single.label as Text).data, '2026-11-08');
  });

  testWidgets('关联任务搜索返回后保留正文和标签', (tester) async {
    final backend = FakeBackend();
    configureCommon(backend);
    backend.on('GET', '/work-logs', (request) async => FakeResponse({
          'items': [logJson('a', '2026-11-10'), logJson('b', '2026-11-09')],
          'total': 2,
        }));
    await pumpEditor(tester, backend);

    final body = find.widgetWithText(TextField, '日志正文');
    await tester.enterText(body, '等待关联任务的正文');
    await tester.tap(find.widgetWithText(TextButton, '选择'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('关联任务一'));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(TextField, '日志正文'), findsOneWidget);
    expect(find.text('等待关联任务的正文'), findsOneWidget);
    expect(find.text('关联任务一'), findsOneWidget);

    await tester.tap(find.widgetWithText(TextButton, '选择'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, '清空关联'));
    await tester.pumpAndSettle();
    expect(find.text('不关联任务'), findsOneWidget);
    expect(find.text('等待关联任务的正文'), findsOneWidget);
  });

  testWidgets('已有日志填充前重验资格，冻结后不改正文', (tester) async {
    final backend = FakeBackend();
    configureCommon(backend);
    var detailCalls = 0;
    backend.on('GET', '/work-logs/log1', (request) async {
      detailCalls++;
      return FakeResponse(logJson('log1', '2026-11-10', editable: detailCalls == 1, frozen: detailCalls > 1), etag: '"1"');
    });
    backend.on('GET', '/work-logs/fill-source', (request) async => FakeResponse({
          'businessDate': '2026-11-10',
          'dailyItems': [
            {'id': 'd1', 'name': '事项一'},
          ],
          'tasks': [],
          'complete': true,
        }));
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final container = buildTestContainer(backend: backend, user: employeeUser());
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const WorkLogEditorPage(logId: 'log1')));
    await tester.pumpAndSettle();

    expect(find.text('日志 log1'), findsOneWidget);
    await tester.tap(find.widgetWithText(OutlinedButton, '填入当日事项与任务'));
    await tester.pumpAndSettle();
    expect(find.textContaining('日志已冻结或当前账号不可编辑'), findsOneWidget);
    expect(find.text('日志 log1'), findsOneWidget);
  });

  testWidgets('日志详情可确认删除并调用删除端点', (tester) async {
    final backend = FakeBackend();
    backend.on('GET', '/work-logs/log1', (request) async => FakeResponse(logJson('log1', '2026-11-10'), etag: '"1"'));
    backend.on('GET', '/work-logs/log1/comments', (request) async => FakeResponse({'items': [], 'total': 0, 'nextOffset': null, 'nextCursor': null}));
    backend.on('DELETE', '/work-logs/log1', (request) async => FakeResponse({'deleted': true}));
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final container = buildTestContainer(backend: backend, user: employeeUser());
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const WorkLogDetailPage(logId: 'log1')));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('删除日志'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, '删除'));
    await tester.pumpAndSettle();
    expect(backend.requestsFor('DELETE', '/work-logs/log1'), hasLength(1));
  });
}
