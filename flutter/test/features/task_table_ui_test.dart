import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/preferences/app_preferences.dart';
import 'package:pandora_employee/features/tasks/presentation/task_table_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/test_harness.dart';

Map<String, Object?> tableTask(int index, {bool canPin = true}) => {
      'id': 't$index',
      'taskId': 't$index',
      'title': '任务 ${index.toString().padLeft(3, '0')}',
      'description': '说明 $index',
      'acceptanceCriteria': index.isEven ? '' : '历史标准 $index',
      'priority': index % 2 == 0 ? 'urgent' : 'medium',
      'allDay': false,
      'startAt': '2026-11-10T02:00:00Z',
      'dueAt': '2026-11-11T10:00:00Z',
      'executionState': index % 3 == 0 ? 'done' : 'todo',
      'status': 'applied',
      'assigneeIds': ['u1'],
      'rowVersion': 1,
      'published': true,
      'pending': false,
      'frozen': false,
      'canReschedule': true,
      'canPin': true,
      'canTablePin': canPin,
      'tablePinned': false,
      'pinned': false,
      'editableFields': ['title'],
      'originalCreatorId': 'u1',
      'createdAt': '2026-11-01T02:00:00Z',
      'executionRound': 1,
      'progressNote': index % 4 == 0 ? '进展 $index' : '',
      'parentTaskId': index == 2 ? 'parent-1' : null,
      'tags': [
        {'id': 'tag1', 'name': '标签一'},
      ],
      'participants': [
        {'id': 'u1', 'displayName': '亚里士多德'},
      ],
    };

FakeBackend tableBackend({int total = 120, bool canPin = true}) {
  final backend = FakeBackend();
  backend.on('GET', '/tasks/table', (request) async {
    final offset = int.tryParse(request.query['offset']?.toString() ?? '') ?? 0;
    final limit = int.tryParse(request.query['limit']?.toString() ?? '') ?? 50;
    final end = (offset + limit).clamp(0, total);
    return FakeResponse({
      'items': [for (var index = offset; index < end; index++) tableTask(index, canPin: canPin)],
      'total': total,
      'limit': limit,
      'offset': offset,
      'nextOffset': end < total ? end : null,
    });
  });
  backend.onPattern('PATCH', RegExp(r'^/tasks/[^/]+/table-pin$'), (request) async => FakeResponse({'ok': true}));
  backend.onPattern('PUT', RegExp(r'^/tasks/[^/]+/table-pin$'), (request) async => FakeResponse({'ok': true}));
  backend.onPattern('DELETE', RegExp(r'^/tasks/[^/]+/table-pin$'), (request) async => FakeResponse({'ok': true}));
  return backend;
}

Future<void> pumpTable(WidgetTester tester, FakeBackend backend) async {
  tester.view.physicalSize = const Size(390, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final container = buildTestContainer(backend: backend, user: employeeUser());
  addTearDown(container.dispose);
  await tester.pumpWidget(wrapWithScope(container, const TaskTablePage()));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('任务表单 50 条分页、页码稳定且后页置顶回第一组', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final backend = tableBackend();
    await pumpTable(tester, backend);

    expect(find.text('共 120 项 · 每页 50'), findsOneWidget);
    expect(find.text('第 1 / 3 页'), findsOneWidget);
    expect(find.text('任务 000'), findsOneWidget);
    expect(find.text('任务 050'), findsNothing);

    await tester.tap(find.widgetWithText(TextButton, '下一页'));
    await tester.pumpAndSettle();
    expect(find.text('第 2 / 3 页'), findsOneWidget);
    expect(find.text('任务 050'), findsOneWidget);
    expect(backend.requestsFor('GET', '/tasks/table').last.query['offset'], 50);

    await tester.tap(find.byTooltip('置顶到表单').hitTestable().first);
    await tester.pumpAndSettle();
    expect(backend.requestsFor('PUT', '/tasks/t50/table-pin'), hasLength(1));
    expect(backend.requestsFor('GET', '/tasks/table').last.query['offset'], 0);
    expect(find.text('第 1 / 3 页'), findsOneWidget);
    expect(find.text('任务 050'), findsNothing);
    expect(backend.requestsFor('GET', '/tasks'), isEmpty, reason: '表单置顶不得刷新或覆盖日历任务缓存');
  });

  testWidgets('列组切换保留固定标题与表头，并显示全部字段', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final backend = tableBackend(total: 3);
    await pumpTable(tester, backend);

    expect(find.text('任务'), findsOneWidget);
    expect(find.text('关系'), findsWidgets);
    expect(find.text('历史标准'), findsNothing);

    await tester.tap(find.text('概览'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('全部列').last);
    await tester.pumpAndSettle();

    expect(find.text('任务'), findsOneWidget);
    expect(find.text('历史标准'), findsOneWidget);
    expect(find.text('轮次'), findsOneWidget);
    expect(find.text('创建时间'), findsOneWidget);
    expect(find.text('置顶'), findsOneWidget);
  });

  testWidgets('横向滚动保持标题列，纵向滚动保持表头', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final backend = tableBackend(total: 20);
    await pumpTable(tester, backend);

    final titleBefore = tester.getTopLeft(find.text('任务 000'));
    final headerBefore = tester.getTopLeft(find.text('任务'));
    await tester.drag(find.byKey(const ValueKey('task-table-body-scroll')), const Offset(-180, 0));
    await tester.pumpAndSettle();
    final titleAfter = tester.getTopLeft(find.text('任务 000'));
    final headerAfter = tester.getTopLeft(find.text('任务'));
    expect(titleAfter.dx, titleBefore.dx);
    expect(headerAfter.dx, headerBefore.dx);

    await tester.drag(find.byKey(const ValueKey('task-table-right-list')), const Offset(0, -220));
    await tester.pumpAndSettle();
    final headerScrolled = tester.getTopLeft(find.text('任务'));
    expect(headerScrolled.dy, headerBefore.dy);
    expect(find.text('任务'), findsOneWidget);
  });

  testWidgets('筛选、列组和页码从账号偏好恢复，不继承日历日期', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await AppPreferences.load('u1');
    await prefs.setString(
      'tasksTable.filters',
      jsonEncode({
        'relation': 'assigned',
        'completion': 'unfinished',
        'q': '缓存',
        'sort': 'title',
        'direction': 'desc',
        'from': null,
        'to': null,
      }),
    );
    await prefs.setString('tasksTable.columnGroup', 'all');
    await prefs.setString('tasksTable.pageIndex', '1');
    final backend = tableBackend();
    await pumpTable(tester, backend);

    final request = backend.requestsFor('GET', '/tasks/table').last;
    expect(request.query['relation'], 'assigned');
    expect(request.query['completion'], 'unfinished');
    expect(request.query['q'], '缓存');
    expect(request.query['sort'], 'title');
    expect(request.query['direction'], 'desc');
    expect(request.query['from'], isNull);
    expect(request.query['offset'], 50);
    expect(find.text('第 2 / 3 页'), findsOneWidget);
    expect(find.text('历史标准'), findsOneWidget);
  });

  testWidgets('无表单置顶权限的任务不显示可写按钮', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final backend = tableBackend(total: 1, canPin: false);
    await pumpTable(tester, backend);

    expect(find.byTooltip('置顶到表单'), findsOneWidget);
    final pin = tester.widget<IconButton>(
      find.ancestor(of: find.byTooltip('置顶到表单').first, matching: find.byType(IconButton)).first,
    );
    expect(pin.onPressed, isNull);
    expect(backend.requests.where((request) => request.method == 'PUT' || request.method == 'PATCH'), isEmpty);
  });
}
