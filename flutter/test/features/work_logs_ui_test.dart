import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/navigation/tab_refresh.dart';
import 'package:pandora_employee/core/router/read_context.dart';
import 'package:pandora_employee/core/widgets/common.dart';
import 'package:pandora_employee/features/work_logs/presentation/work_logs_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/test_harness.dart';
import 'comments_keyboard_test.dart' show commentJson;

Map<String, Object?> logJson(
  String id,
  String date, {
  bool editable = true,
  bool frozen = false,
}) => {
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
  backend.on(
    'GET',
    '/tasks',
    (request) async => FakeResponse({
      'items': [taskJson('t1', '关联任务一')],
      'nextCursor': null,
    }),
  );
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
    backend.on(
      'GET',
      '/work-logs',
      (request) async => FakeResponse({
        'items': [logJson('b', '2026-11-10'), logJson('a', '2026-11-09')],
        'total': 2,
        'nextOffset': null,
      }),
    );
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const WorkLogsPage()));
    await tester.pumpAndSettle();

    expect(find.text('2026年11月10日'), findsOneWidget);
    expect(find.text('2026年11月9日'), findsOneWidget);
    expect(find.text('今天'), findsOneWidget);
    expect(find.text('昨天'), findsOneWidget);
    final request = backend.requestsFor('GET', '/work-logs').last;
    expect(request.query['scope'], 'self');
    expect(request.query.containsKey('authorId'), isFalse);
  });

  testWidgets('日志页刷新保留已加载内容和滚动位置', (tester) async {
    final backend = FakeBackend();
    final items = [for (var i = 0; i < 30; i++) logJson('log$i', '2026-11-10')];
    backend.on(
      'GET',
      '/work-logs',
      (request) async => FakeResponse({
        'items': items,
        'total': items.length,
        'nextOffset': null,
      }),
    );
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const WorkLogsPage()));
    await tester.pumpAndSettle();

    final list = find.byType(ListView);
    await tester.drag(list, const Offset(0, -500));
    await tester.pumpAndSettle();
    final scrollable = tester.state<ScrollableState>(
      find.descendant(of: list, matching: find.byType(Scrollable)),
    );
    final before = scrollable.position.pixels;
    expect(before, greaterThan(0));

    container.read(tabRefreshProvider.notifier).bump(AppTab.logs);
    await tester.pumpAndSettle();

    final after = tester
        .state<ScrollableState>(
          find.descendant(of: list, matching: find.byType(Scrollable)),
        )
        .position
        .pixels;
    expect(after, closeTo(before, 1));
  });

  testWidgets('新建日志只显示近三日缺失日期', (tester) async {
    final backend = FakeBackend();
    configureCommon(backend);
    backend.on(
      'GET',
      '/work-logs',
      (request) async => FakeResponse({
        'items': [logJson('a', '2026-11-10'), logJson('b', '2026-11-09')],
        'total': 2,
        'nextOffset': null,
      }),
    );
    await pumpEditor(tester, backend);

    final chips = tester
        .widgetList<ChoiceChip>(find.byType(ChoiceChip))
        .toList();
    expect(chips, hasLength(1));
    expect((chips.single.label as Text).data, '2026-11-08');
  });

  testWidgets('关联任务搜索返回后保留正文和标签', (tester) async {
    final backend = FakeBackend();
    configureCommon(backend);
    backend.on(
      'GET',
      '/work-logs',
      (request) async => FakeResponse({
        'items': [logJson('a', '2026-11-10'), logJson('b', '2026-11-09')],
        'total': 2,
      }),
    );
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
      return FakeResponse(
        logJson(
          'log1',
          '2026-11-10',
          editable: detailCalls == 1,
          frozen: detailCalls > 1,
        ),
        etag: '"1"',
      );
    });
    backend.on(
      'GET',
      '/work-logs/fill-source',
      (request) async => FakeResponse({
        'businessDate': '2026-11-10',
        'dailyItems': [
          {'id': 'd1', 'name': '事项一'},
        ],
        'tasks': [],
        'complete': true,
      }),
    );
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      wrapWithScope(container, const WorkLogEditorPage(logId: 'log1')),
    );
    await tester.pumpAndSettle();

    expect(find.text('日志 log1'), findsOneWidget);
    await tester.tap(find.widgetWithText(OutlinedButton, '填入当日事项与任务'));
    await tester.pumpAndSettle();
    expect(find.textContaining('日志已冻结或当前账号不可编辑'), findsOneWidget);
    expect(find.text('日志 log1'), findsOneWidget);
  });

  testWidgets('日志编辑未保存返回弹确认，继续编辑保留正文', (tester) async {
    final backend = FakeBackend();
    configureCommon(backend);
    backend.on(
      'GET',
      '/work-logs',
      (request) async => FakeResponse({
        'items': [logJson('a', '2026-11-10'), logJson('b', '2026-11-09')],
        'total': 2,
      }),
    );
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      wrapWithScope(
        container,
        Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const WorkLogEditorPage(),
                  ),
                ),
                child: const Text('打开日志'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('打开日志'));
    await tester.pumpAndSettle();

    final body = find.widgetWithText(TextField, '日志正文');
    await tester.enterText(body, '未保存日志正文');
    await tester.pump();
    expect(
      tester
          .widget<UnsavedChangesGuard>(find.byType(UnsavedChangesGuard))
          .hasUnsavedChanges,
      isTrue,
    );
    await tester.tap(find.byTooltip('返回'));
    await tester.pumpAndSettle();
    expect(find.text('放弃未保存的修改？'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, '继续编辑'));
    await tester.pumpAndSettle();
    expect(find.text('未保存日志正文'), findsOneWidget);
  });

  testWidgets('已冻结日志显示已不能编辑且不提供编辑删除入口', (tester) async {
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/work-logs',
      (request) async => FakeResponse({
        'items': [logJson('log1', '2026-11-10', editable: false, frozen: true)],
        'total': 1,
        'nextOffset': null,
      }),
    );
    backend.on(
      'GET',
      '/work-logs/log1',
      (request) async => FakeResponse(
        logJson('log1', '2026-11-10', editable: false, frozen: true),
        etag: '"1"',
      ),
    );
    backend.on(
      'GET',
      '/work-logs/log1/comments',
      (request) async => FakeResponse({
        'items': [],
        'total': 0,
        'nextOffset': null,
        'nextCursor': null,
      }),
    );
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(wrapWithScope(container, const WorkLogsPage()));
    await tester.pumpAndSettle();
    expect(find.text('已不能编辑'), findsOneWidget);
    expect(find.textContaining('已冻结'), findsNothing);

    await tester.pumpWidget(
      wrapWithScope(container, const WorkLogDetailPage(logId: 'log1')),
    );
    await tester.pumpAndSettle();
    expect(find.text('已不能编辑'), findsOneWidget);
    expect(find.byTooltip('编辑日志'), findsNothing);
    expect(find.byTooltip('删除日志'), findsNothing);
    expect(backend.requestsFor('DELETE', '/work-logs/log1'), isEmpty);
  });

  testWidgets('本人与下属日志共用一个筛选入口，应用/取消/清除控制查询', (tester) async {
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/work-logs',
      (request) async =>
          FakeResponse({'items': [], 'total': 0, 'nextOffset': null}),
    );
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);

    Future<void> pickDay(String day) async {
      await tester.tap(find.text(day).last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
    }

    await tester.pumpWidget(wrapWithScope(container, const WorkLogsPage()));
    await tester.pumpAndSettle();
    expect(
      backend.requestsFor('GET', '/work-logs').single.query['from'],
      isNull,
    );

    await tester.tap(find.text('筛选'));
    await tester.pumpAndSettle();
    expect(find.text('筛选日志日期'), findsOneWidget);
    await tester.tap(find.text('开始日期：不限'));
    await tester.pumpAndSettle();
    await pickDay('10');
    await tester.tap(find.text('应用'));
    await tester.pumpAndSettle();
    final applied = backend.requestsFor('GET', '/work-logs').last;
    expect(applied.query['from'], endsWith('-10'));
    expect(applied.query['to'], isNull);
    expect(find.textContaining('筛选（'), findsOneWidget);
    final afterApply = backend.requestsFor('GET', '/work-logs').length;

    await tester.tap(find.textContaining('筛选（'));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('开始日期：'));
    await tester.pumpAndSettle();
    await pickDay('12');
    await tester.tap(find.text('取消'));
    await tester.pumpAndSettle();
    expect(
      backend.requestsFor('GET', '/work-logs'),
      hasLength(afterApply),
      reason: '取消不提交新条件',
    );
    expect(
      backend.requestsFor('GET', '/work-logs').last.query['from'],
      endsWith('-10'),
    );

    await tester.tap(find.textContaining('筛选（'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('清除'));
    await tester.pumpAndSettle();
    final cleared = backend.requestsFor('GET', '/work-logs').last;
    expect(cleared.query['from'], isNull);
    expect(cleared.query['to'], isNull);
    expect(find.text('筛选'), findsOneWidget);

    await tester.pumpWidget(
      wrapWithScope(
        container,
        const WorkLogsPage(
          authorId: 'p1',
          personName: '下属一',
          readContext: SubordinateReadContext(
            personId: 'p1',
            personName: '下属一',
            chainOrigin: '/people',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('筛选'), findsOneWidget, reason: '两种日志列表共用同一入口');
    await tester.tap(find.text('筛选'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('结束日期：不限'));
    await tester.pumpAndSettle();
    await pickDay('15');
    await tester.tap(find.text('应用'));
    await tester.pumpAndSettle();
    final subordinate = backend.requestsFor('GET', '/work-logs').last;
    expect(subordinate.query['scope'], 'visible');
    expect(subordinate.query['authorId'], 'p1');
    expect(subordinate.query['to'], endsWith('-15'));
    expect(tester.takeException(), isNull);
  });

  testWidgets('仅实际冻结日志显示冻结标记，非冻结下属只读不冒充冻结', (tester) async {
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/work-logs',
      (request) async => FakeResponse({
        'items': [
          logJson('frozen', '2026-11-10', editable: false, frozen: true),
          logJson('readonly', '2026-11-09', editable: false),
          logJson('mine', '2026-11-08'),
        ],
        'total': 3,
        'nextOffset': null,
      }),
    );
    for (final id in ['frozen', 'readonly', 'mine']) {
      backend.on(
        'GET',
        '/work-logs/$id',
        (request) async => FakeResponse(
          logJson(
            id,
            '2026-11-10',
            editable: id == 'mine',
            frozen: id == 'frozen',
          ),
          etag: '"1"',
        ),
      );
      backend.on(
        'GET',
        '/work-logs/$id/comments',
        (request) async => FakeResponse({
          'items': [],
          'total': 0,
          'nextOffset': null,
          'nextCursor': null,
        }),
      );
    }
    backend.on(
      'POST',
      '/work-logs/frozen/comments',
      (_) => FakeResponse(commentJson(1)),
    );
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    const subordinate = SubordinateReadContext(
      personId: 'u1',
      personName: '下属一',
      chainOrigin: '/people',
    );

    await tester.pumpWidget(
      wrapWithScope(
        container,
        const WorkLogsPage(
          authorId: 'u1',
          personName: '下属一',
          readContext: subordinate,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('已不能编辑'), findsOneWidget);
    expect(find.textContaining('已冻结'), findsNothing);

    await tester.pumpWidget(
      wrapWithScope(
        container,
        const WorkLogDetailPage(
          key: ValueKey('readonly'),
          logId: 'readonly',
          readContext: subordinate,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('已不能编辑'), findsNothing, reason: '只读不等于冻结');
    expect(find.byTooltip('编辑日志'), findsNothing);
    expect(find.text('日志 readonly'), findsOneWidget);

    await tester.pumpWidget(
      wrapWithScope(
        container,
        const WorkLogDetailPage(
          key: ValueKey('frozen'),
          logId: 'frozen',
          readContext: subordinate,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('已不能编辑'), findsOneWidget);
    expect(find.byTooltip('编辑日志'), findsNothing);
    final input = find.widgetWithText(TextField, '发表评论');
    await tester.ensureVisible(input);
    await tester.enterText(input, '冻结下属日志仍可评论');
    await tester.ensureVisible(find.byTooltip('发送评论'));
    await tester.tap(find.byTooltip('发送评论'));
    await tester.pumpAndSettle();
    expect(
      backend
          .requestsFor('POST', '/work-logs/frozen/comments')
          .single
          .jsonBody['body'],
      '冻结下属日志仍可评论',
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('列表预览三行省略而详情仍显示完整正文', (tester) async {
    final longBody = '第一行\n第二行\n第三行\n第四行\n第五行';
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/work-logs',
      (request) async => FakeResponse({
        'items': [
          {...logJson('long', '2026-11-10'), 'body': longBody},
        ],
        'total': 1,
        'nextOffset': null,
      }),
    );
    backend.on(
      'GET',
      '/work-logs/long',
      (request) async => FakeResponse({
        ...logJson('long', '2026-11-10'),
        'body': longBody,
      }, etag: '"1"'),
    );
    backend.on(
      'GET',
      '/work-logs/long/comments',
      (request) async => FakeResponse({
        'items': [],
        'total': 0,
        'nextOffset': null,
        'nextCursor': null,
      }),
    );
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const WorkLogsPage()));
    await tester.pumpAndSettle();
    final preview = tester.widget<Text>(find.textContaining('第一行').first);
    expect(preview.maxLines, 3);
    expect(preview.data, endsWith('…'));

    await tester.pumpWidget(
      wrapWithScope(
        container,
        const WorkLogDetailPage(key: ValueKey('long'), logId: 'long'),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text(longBody), findsOneWidget, reason: '详情显示完整原文');
    expect(tester.takeException(), isNull);
  });
}
