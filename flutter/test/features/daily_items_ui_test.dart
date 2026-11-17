import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/company/company_date.dart';
import 'package:pandora_employee/features/daily_items/presentation/daily_items_providers.dart';
import 'package:pandora_employee/features/daily_items/presentation/daily_items_day_page.dart';

import '../support/test_harness.dart';

void main() {
  testWidgets('当日清单含完成记录、完成控件不打开详情，操作后同源刷新', (tester) async {
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final backend = FakeBackend();
    var items = <Map<String, Object?>>[
      {
        'id': 'd1',
        'startDate': '2026-11-09',
        'endDate': '2026-11-11',
        'date': '2026-11-09',
        'body': '跨日事项：跟完第一幕',
        'completed': false,
        'status': 'open',
        'rowVersion': 1,
        'createdAt': '2026-11-09T02:00:00Z',
        'updatedAt': '2026-11-09T02:00:00Z',
      },
      {
        'id': 'd2',
        'startDate': '2026-11-10',
        'endDate': '2026-11-10',
        'date': '2026-11-10',
        'body': '已完成事项',
        'completed': true,
        'status': 'completed',
        'rowVersion': 2,
        'createdAt': '2026-11-10T02:00:00Z',
        'updatedAt': '2026-11-10T02:00:00Z',
      },
    ];
    backend.on(
      'GET',
      '/home',
      (request) async => FakeResponse({
        'companyItems': [],
        'assignedTasks': [],
        'businessDate': '2026-11-10',
      }),
    );
    backend.on('GET', '/daily-items', (request) async {
      return FakeResponse({
        'from': '2026-11-01',
        'to': '2026-11-30',
        'items': items,
        'total': items.length,
        'limit': 50,
        'offset': 0,
        'nextOffset': null,
        'businessDate': '2026-11-10',
        'organizationTimeZone': 'Asia/Shanghai',
      });
    });
    backend.onPattern('GET', RegExp(r'^/daily-items/[^/]+$'), (request) async {
      final id = request.path.split('/').last;
      final item = items.firstWhere((item) => item['id'] == id);
      return FakeResponse(item, etag: '"${item['rowVersion']}"');
    });
    backend.onPattern('PATCH', RegExp(r'^/daily-items/[^/]+$'), (
      request,
    ) async {
      final id = request.path.split('/').last;
      final index = items.indexWhere((item) => item['id'] == id);
      final updated = Map<String, Object?>.from(items[index]);
      updated['completed'] = request.jsonBody['completed'];
      updated['status'] = updated['completed'] == true ? 'completed' : 'open';
      updated['rowVersion'] = (updated['rowVersion']! as int) + 1;
      items = List<Map<String, Object?>>.from(items)..[index] = updated;
      return FakeResponse(updated, etag: '"3"');
    });

    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      wrapWithScope(
        container,
        DailyItemsDayPage(date: const CompanyDate(2026, 11, 10)),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('共 2 项'), findsOneWidget);
    expect(find.text('跨日事项：跟完第一幕'), findsOneWidget);
    expect(find.text('已完成事项'), findsOneWidget);
    expect(find.byType(Checkbox), findsNWidgets(2));
    expect(find.text('未完成'), findsNothing);
    expect(find.bySemanticsLabel(RegExp(r'^未完成')), findsOneWidget);
    expect(find.text('已完成'), findsNothing);

    await tester.tap(find.byType(Checkbox).first);
    await tester.pumpAndSettle();

    final patches = backend.requestsFor('PATCH', '/daily-items/d1');
    expect(patches, hasLength(1));
    expect(patches.single.jsonBody['completed'], isTrue);
    expect(patches.single.headers['If-Match'], '"1"');
    expect(patches.single.headers['Idempotency-Key'], isNotNull);
    // 完成状态变化后同源刷新，两处状态都不再显示未完成。
    expect(find.text('未完成'), findsNothing);
    expect(find.bySemanticsLabel(RegExp(r'^已完成')), findsNWidgets(2));
  });

  testWidgets('超过100条按月读完全部页，跨月按ID去重，含完成记录及末条均可达', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final items = [
      for (var i = 0; i < 105; i++)
        {
          'id': 'item-${i.toString().padLeft(3, '0')}',
          'body': '事项$i',
          'startDate': '2026-11-10',
          'endDate': '2026-12-01',
          'completed': i.isEven,
          'status': i.isEven ? 'completed' : 'open',
          'createdAt': '2026-11-09T02:00:00Z',
          'rowVersion': 1,
        },
    ];
    final backend = FakeBackend();
    backend.on('GET', '/daily-items', (request) {
      final offset = request.query['offset'] as int;
      final limit = request.query['limit'] as int;
      return FakeResponse({
        'items': items.skip(offset).take(limit).toList(),
        'total': items.length,
        'nextOffset': offset + limit < items.length ? offset + limit : null,
      });
    });
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
      accountEpoch: () => 1,
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      wrapWithScope(
        container,
        const DailyItemsDayPage(date: CompanyDate(2026, 11, 10)),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('共 105 项'), findsOneWidget);
    expect(backend.requestsFor('GET', '/daily-items'), hasLength(3));
    final load = container.read(dailyItemsProvider.notifier).ensureMonths([
      const CompanyDate(2026, 12, 1),
    ]);
    await tester.pumpAndSettle();
    await load;
    expect(container.read(dailyItemsProvider).items, hasLength(105));
    expect(backend.requestsFor('GET', '/daily-items'), hasLength(6));
    await tester.scrollUntilVisible(
      find.text('事项104'),
      500,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('事项104').hitTestable(), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('320 逻辑宽度与长文本仍可读且不溢出', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final backend = FakeBackend();
    backend.on(
      'GET',
      '/daily-items',
      (request) async => FakeResponse({
        'items': [
          {
            'id': 'n1',
            'startDate': '2026-11-09',
            'endDate': '2026-11-11',
            'body': '一个非常长的事项名称用于检查窄屏换行与状态徽标不会挤压到屏幕之外',
            'completed': false,
            'status': 'overdue',
            'rowVersion': 1,
            'createdAt': '2026-11-09T02:00:00Z',
          },
        ],
        'total': 1,
        'nextOffset': null,
        'businessDate': '2026-11-10',
      }),
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      wrapWithScope(
        container,
        DailyItemsDayPage(date: const CompanyDate(2026, 11, 10)),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('非常长的事项名称'), findsOneWidget);
    expect(find.text('已逾期'), findsNothing);
    expect(find.bySemanticsLabel(RegExp(r'^已逾期')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('月份加载失败明确提示重试，不伪装成空清单', (tester) async {
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final backend = FakeBackend();
    backend.on(
      'GET',
      '/daily-items',
      (request) async =>
          FakeResponse({'code': 'SERVER', 'message': '服务暂时不可用'}, status: 503),
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      wrapWithScope(
        container,
        DailyItemsDayPage(date: const CompanyDate(2026, 11, 10)),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('加载失败'), findsOneWidget);
    expect(find.textContaining('没有事项'), findsNothing);
    expect(find.text('重试'), findsOneWidget);
  });
}
