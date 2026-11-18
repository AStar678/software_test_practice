import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:pandora_employee/core/theme/pandora_theme.dart';
import 'package:pandora_employee/features/work_logs/presentation/work_logs_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/test_harness.dart';

Map<String, Object?> logJson({
  required String id,
  required DateTime date,
  required String body,
  required int version,
  String authorId = 'u1',
}) => {
  'id': id,
  'businessDate':
      '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
  'body': body,
  'authorId': authorId,
  'authorName': '亚里士多德',
  'createdAt': '2026-11-10T02:00:00Z',
  'frozen': false,
  'editable': true,
  'rowVersion': version,
  'tagIds': [],
  'tags': [],
};

DateTime get _base => DateTime(DateTime.now().year, DateTime.now().month, 15);

GoRouter logRouter() => GoRouter(
  initialLocation: '/logs',
  routes: [
    GoRoute(path: '/logs', builder: (context, state) => const WorkLogsPage()),
    GoRoute(
      path: '/logs/new',
      builder: (context, state) => const WorkLogEditorPage(),
    ),
    GoRoute(
      path: '/logs/:id/edit',
      builder: (context, state) =>
          WorkLogEditorPage(logId: state.pathParameters['id']),
    ),
    GoRoute(
      path: '/logs/:id',
      builder: (context, state) =>
          WorkLogDetailPage(logId: state.pathParameters['id'] ?? ''),
    ),
  ],
);

void configureEditor(FakeBackend backend) {
  backend.on('GET', '/tags', (_) => FakeResponse({'items': []}));
  backend.on(
    'GET',
    '/tasks',
    (_) => FakeResponse({'items': [], 'nextCursor': null}),
  );
}

Future<void> pickDays(WidgetTester tester) async {
  await tester.tap(find.text('筛选'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('开始日期：不限'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('1').last);
  await tester.tap(find.text('OK'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('结束日期：不限'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('28').last);
  await tester.tap(find.text('OK'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('应用'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('编辑保存后详情与列表显示同一新版本，保留筛选、第二页和位置', (tester) async {
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final base = _base;
    var bodyC = '旧内容 C';
    var versionC = 5;
    var staleRead = false;
    final backend = FakeBackend();
    Map<String, Object?> itemC() => logJson(
      id: 'C',
      date: base.subtract(const Duration(days: 2)),
      body: bodyC,
      version: versionC,
    );
    backend.on('GET', '/work-logs', (request) {
      final offset = int.tryParse('${request.query['offset']}') ?? 0;
      return FakeResponse({
        'items': offset == 0
            ? [
                logJson(
                  id: 'A',
                  date: base,
                  body: '第一页 A',
                  version: 1,
                ),
                logJson(
                  id: 'B',
                  date: base.subtract(const Duration(days: 1)),
                  body: '第一页 B',
                  version: 1,
                ),
              ]
            : [
                itemC(),
                logJson(
                  id: 'D',
                  date: base.subtract(const Duration(days: 3)),
                  body: '第二页 D',
                  version: 1,
                ),
              ],
        'total': 4,
        'nextOffset': offset == 0 ? 2 : null,
      });
    });
    backend.on('GET', '/work-logs/C', (_) {
      if (staleRead) {
        return FakeResponse(
          logJson(
            id: 'C',
            date: base.subtract(const Duration(days: 2)),
            body: '旧内容 C',
            version: 5,
          ),
          etag: '"5"',
        );
      }
      return FakeResponse(itemC(), etag: '"$versionC"');
    });
    backend.on('GET', '/work-logs/C/comments', (_) => FakeResponse({
      'items': [],
      'total': 0,
      'nextOffset': null,
      'nextCursor': null,
    }));
    backend.on('PATCH', '/work-logs/C', (request) {
      bodyC = request.jsonBody['body']! as String;
      versionC += 1;
      staleRead = true;
      return FakeResponse(itemC(), etag: '"$versionC"');
    });
    configureEditor(backend);
    final container = buildTestContainer(backend: backend, user: employeeUser());
    addTearDown(container.dispose);
    final router = logRouter();
    addTearDown(router.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(
          theme: PandoraTheme.build(),
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await pickDays(tester);
    expect(find.textContaining('筛选（'), findsOneWidget);
    await tester.tap(find.text('加载更多'));
    await tester.pumpAndSettle();
    final listRequests = backend.requestsFor('GET', '/work-logs').length;
    final scroll = tester.state<ScrollableState>(
      find.byType(Scrollable).first,
    );
    await tester.scrollUntilVisible(
      find.textContaining('旧内容 C'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    final offset = scroll.position.pixels;

    await tester.tap(find.textContaining('旧内容 C'));
    await tester.pumpAndSettle();
    expect(find.text('日志详情'), findsOneWidget);
    expect(find.textContaining('旧内容 C'), findsOneWidget);
    await tester.tap(find.byTooltip('编辑日志'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, '保存后的新内容 C');
    await tester.tap(find.text('保存日志'));
    await tester.pumpAndSettle();
    expect(find.text('日志详情'), findsOneWidget);
    expect(find.text('保存后的新内容 C'), findsOneWidget);
    expect(find.textContaining('旧内容 C'), findsNothing, reason: '滞后读取不覆盖新版本');
    expect(backend.requestsFor('PATCH', '/work-logs/C'), hasLength(1));

    await tester.tap(find.byTooltip('返回'));
    await tester.pumpAndSettle();
    expect(find.text('保存后的新内容 C'), findsOneWidget);
    expect(find.textContaining('旧内容 C'), findsNothing);
    expect(find.textContaining('筛选（'), findsOneWidget, reason: '返回后保留筛选');
    expect(
      backend.requestsFor('GET', '/work-logs'),
      hasLength(listRequests),
      reason: '不整表重置或重新拉取第一页',
    );
    final listScroll = tester.state<ScrollableState>(
      find.byType(Scrollable).first,
    );
    expect(listScroll.position.pixels, closeTo(offset, 1), reason: '保留浏览位置');
    expect(tester.takeException(), isNull);
  });

  testWidgets('保存失败保留编辑内容，详情和列表仍显示旧版本', (tester) async {
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final base = _base;
    final backend = FakeBackend();
    backend.on('GET', '/work-logs', (_) => FakeResponse({
      'items': [
        logJson(id: 'C', date: base, body: '失败前内容 C', version: 3),
      ],
      'total': 1,
      'nextOffset': null,
    }));
    backend.on('GET', '/work-logs/C', (_) => FakeResponse(
      logJson(id: 'C', date: base, body: '失败前内容 C', version: 3),
      etag: '"3"',
    ));
    backend.on('GET', '/work-logs/C/comments', (_) => FakeResponse({
      'items': [],
      'total': 0,
      'nextOffset': null,
      'nextCursor': null,
    }));
    backend.on(
      'PATCH',
      '/work-logs/C',
      (_) => FakeResponse({'message': '暂时无法保存'}, status: 503),
    );
    configureEditor(backend);
    final container = buildTestContainer(backend: backend, user: employeeUser());
    addTearDown(container.dispose);
    final router = logRouter();
    addTearDown(router.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(
          theme: PandoraTheme.build(),
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('失败前内容 C'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('编辑日志'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, '失败草稿');
    await tester.tap(find.text('保存日志'));
    await tester.pumpAndSettle();
    expect(find.textContaining('暂时无法保存'), findsOneWidget);
    expect(find.text('失败草稿'), findsOneWidget, reason: '失败保留编辑内容');
    await tester.tap(find.byTooltip('返回'));
    await tester.pumpAndSettle();
    expect(find.text('放弃未保存的修改？'), findsOneWidget);
    await tester.tap(find.text('放弃'));
    await tester.pumpAndSettle();
    expect(find.text('日志详情'), findsOneWidget);
    expect(find.text('失败前内容 C'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
