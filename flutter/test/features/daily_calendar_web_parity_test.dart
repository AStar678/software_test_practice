import 'dart:async';

import 'package:flutter/material.dart';
import 'package:pandora_employee/core/providers.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/company/company_date.dart';
import 'package:pandora_employee/features/daily_items/domain/daily_item.dart';
import 'package:pandora_employee/features/daily_items/domain/month_layout.dart';
import 'package:pandora_employee/features/daily_items/presentation/daily_items_calendar.dart';
import 'package:pandora_employee/features/daily_items/presentation/daily_items_providers.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/test_harness.dart';

Map<String, Object?> record({
  String start = '2026-11-07',
  String end = '2026-11-11',
}) => {
  'id': 'range',
  'body': '完整正文\n原样保留',
  'startDate': start,
  'endDate': end,
  'completed': true,
  'status': 'completed',
  'rowVersion': 7,
};

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('续接中段短按命中实际日，500ms长按一次触觉，完成事项整条确认后平移', (tester) async {
    tester.view.physicalSize = const Size(390, 850);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    var saved = record();
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/daily-items',
      (_) => FakeResponse({
        'items': [saved],
        'total': 1,
      }),
    );
    backend.on('PATCH', '/daily-items/range', (request) {
      saved = {...saved, ...request.jsonBody, 'rowVersion': 8};
      return FakeResponse(saved);
    });
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    final key = GlobalKey<DailyItemsCalendarState>();
    CompanyDate? opened;
    var haptics = 0;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'HapticFeedback.vibrate') haptics++;
        return null;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      ),
    );
    await tester.pumpWidget(
      wrapWithScope(
        container,
        Scaffold(
          body: DailyItemsCalendar(
            key: key,
            businessDate: const CompanyDate(2026, 11, 10),
            onDaySelected: (day) => opened = day,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    key.currentState!.goToDate(const CompanyDate(2026, 11, 9));
    await tester.pumpAndSettle();
    final source = find.byKey(const ValueKey('daily-bar-range-2026-11-09'));
    final sourceRect = tester.getRect(source);
    // The second cell is the continuation's actual grab day (Nov 10).
    final grab = Offset(390 / 7 * 1.5, sourceRect.center.dy);
    await tester.tapAt(grab);
    await tester.pumpAndSettle();
    expect(opened, const CompanyDate(2026, 11, 10));
    opened = null;
    final gesture = await tester.startGesture(grab);
    await tester.pump(const Duration(milliseconds: 499));
    expect(haptics, 0);
    await tester.pump(const Duration(milliseconds: 2));
    expect(haptics, 1);
    await gesture.moveBy(const Offset(390 / 7, 0));
    await tester.pump();
    expect(find.textContaining('2026-11-08 至 2026-11-12'), findsOneWidget);
    await gesture.up();
    await tester.pumpAndSettle();
    expect(opened, isNull);
    expect(find.text('调整每日事项日期'), findsOneWidget);
    expect(backend.requestsFor('PATCH', '/daily-items/range'), isEmpty);
    await tester.tap(find.text('确认改期'));
    await tester.pumpAndSettle();
    final write = backend.requestsFor('PATCH', '/daily-items/range').single;
    expect(write.jsonBody, {
      'startDate': '2026-11-08',
      'endDate': '2026-11-12',
    });
    expect(write.headers['If-Match'], '"7"');
    expect(saved['completed'], isTrue);
    expect(saved['body'], '完整正文\n原样保留');
    expect(haptics, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('双向跨年补载、当前窗口刷新和尺寸变化/重建按真实日期偏移恢复', (tester) async {
    tester.view.physicalSize = const Size(390, 850);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/daily-items',
      (_) => FakeResponse({'items': [], 'total': 0}),
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    var key = GlobalKey<DailyItemsCalendarState>();
    Widget calendar() => wrapWithScope(
      container,
      Scaffold(
        body: DailyItemsCalendar(
          key: key,
          businessDate: const CompanyDate(2026, 11, 10),
          onDaySelected: (_) {},
        ),
      ),
    );
    await tester.pumpWidget(calendar());
    await tester.pumpAndSettle();
    key.currentState!.goToDate(const CompanyDate(2027, 1, 11));
    await tester.pumpAndSettle();
    final scroll = tester
        .widget<SingleChildScrollView>(
          find.byKey(const ValueKey('daily-calendar-scroll')),
        )
        .controller!;
    scroll.jumpTo(10);
    await tester.pumpAndSettle();
    expect(
      backend
          .requestsFor('GET', '/daily-items')
          .any((request) => request.query['from'] == '2026-11-01'),
      isTrue,
    );
    scroll.jumpTo(scroll.position.maxScrollExtent - 10);
    await tester.pumpAndSettle();
    expect(
      backend
          .requestsFor('GET', '/daily-items')
          .any((request) => request.query['from'] == '2027-03-01'),
      isTrue,
    );
    key.currentState!.goToDate(const CompanyDate(2027, 1, 18));
    await tester.pumpAndSettle();
    final before = tester
        .getTopLeft(find.byKey(const ValueKey('daily-day-2027-01-18')))
        .dy;
    final readStart = backend.requests.length;
    final refreshed = key.currentState!.refreshVisible();
    await tester.pumpAndSettle();
    await refreshed;
    expect(
      backend.requests
          .skip(readStart)
          .where((r) => r.path == '/daily-items')
          .map((r) => r.query['from']),
      contains('2027-01-01'),
    );
    expect(key.currentState!.anchorDate, const CompanyDate(2027, 1, 18));
    tester.view.physicalSize = const Size(320, 640);
    await tester.pumpAndSettle();
    expect(
      tester.getTopLeft(find.byKey(const ValueKey('daily-day-2027-01-18'))).dy,
      closeTo(before, 1),
    );
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    key = GlobalKey<DailyItemsCalendarState>();
    await tester.pumpWidget(calendar());
    await tester.pumpAndSettle();
    expect(key.currentState!.anchorDate, const CompanyDate(2027, 1, 18));
    expect(
      tester.getTopLeft(find.byKey(const ValueKey('daily-day-2027-01-18'))).dy,
      closeTo(before, 1),
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('跨年整条拖动在上下边缘自动补月，二维落点保持完整跨度和原锚点', (tester) async {
    tester.view.physicalSize = const Size(390, 850);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    for (final direction in [-1, 1]) {
      SharedPreferences.setMockInitialValues({});
      final backend = FakeBackend();
      final original = record(start: '2026-12-28', end: '2027-01-06');
      backend.on(
        'GET',
        '/daily-items',
        (_) => FakeResponse({
          'items': [original],
          'total': 1,
        }),
      );
      final container = buildTestContainer(
        backend: backend,
        user: employeeUser(),
      );
      final key = GlobalKey<DailyItemsCalendarState>();
      var opened = 0;
      await tester.pumpWidget(
        wrapWithScope(
          container,
          Scaffold(
            body: DailyItemsCalendar(
              key: key,
              businessDate: const CompanyDate(2026, 12, 30),
              onDaySelected: (_) => opened++,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      key.currentState!.goToDate(const CompanyDate(2026, 12, 28));
      await tester.pumpAndSettle();
      final anchor = key.currentState!.anchorDate;
      final scrollFinder = find.byKey(const ValueKey('daily-calendar-scroll'));
      final scroll = tester
          .widget<SingleChildScrollView>(scrollFinder)
          .controller!;
      final before = scroll.offset;
      final source = find
          .byKey(const ValueKey('daily-bar-range-2026-12-28'))
          .first;
      final grab = Offset(390 / 7 * 2.5, tester.getRect(source).center.dy);
      final gesture = await tester.startGesture(grab);
      await tester.pump(const Duration(milliseconds: 501));
      final viewport = Rect.fromLTWH(
        0,
        CalendarMetrics.weekdayRowHeight,
        390,
        CalendarMetrics.viewportHeight - CalendarMetrics.weekdayRowHeight,
      );
      await gesture.moveTo(
        Offset(
          390 / 7 * 2.5,
          direction < 0 ? viewport.top + 5 : viewport.bottom - 5,
        ),
      );
      for (var tick = 0; tick < 180; tick++) {
        await tester.pump(const Duration(milliseconds: 32));
      }
      expect(scroll.offset, isNot(before));
      final reads = backend
          .requestsFor('GET', '/daily-items')
          .map((r) => r.query['from'].toString());
      expect(
        reads.any(
          (date) => direction < 0
              ? date.compareTo('2026-11-01') < 0
              : date.compareTo('2027-01-01') > 0,
        ),
        isTrue,
      );
      // Pick a real in-month cell after scrolling; month-outside blanks are excluded.
      final cells = find.byWidgetPredicate(
        (widget) =>
            widget.key is ValueKey<String> &&
            (widget.key as ValueKey<String>).value.startsWith('daily-day-'),
      );
      final cell = cells
          .evaluate()
          .map((element) => find.byWidget(element.widget))
          .firstWhere(
            (finder) => Rect.fromLTRB(
              viewport.left,
              viewport.top + 48,
              viewport.right,
              viewport.bottom - 48,
            ).contains(tester.getRect(finder).center),
          );
      final targetKey = (tester.widget(cell).key as ValueKey<String>).value;
      final targetDay = CompanyDate.parse(
        targetKey.substring('daily-day-'.length),
      );
      final delta = targetDay.differenceInDays(const CompanyDate(2026, 12, 30));
      await gesture.moveTo(tester.getRect(cell).center);
      await tester.pump();
      await gesture.up();
      await tester.pumpAndSettle();
      expect(
        find.text(
          '调整后：${const CompanyDate(2026, 12, 28).addDays(delta).iso} 至 ${const CompanyDate(2027, 1, 6).addDays(delta).iso}',
        ),
        findsOneWidget,
      );
      expect(find.text('跨度保持 10 天'), findsOneWidget);
      expect(key.currentState!.anchorDate, anchor);
      expect(opened, 0);
      expect(backend.requests.where((r) => r.method != 'GET'), isEmpty);
      await tester.tap(find.text('取消'));
      await tester.pumpAndSettle();
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
      container.dispose();
    }
  });

  testWidgets('门槛前滚动、零位移、取消、月外空格、多指和后台中断均不写入', (tester) async {
    tester.view.physicalSize = const Size(390, 850);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    for (final scenario in [
      'scroll',
      'zero',
      'cancel',
      'gap',
      'multitouch',
      'background',
      'confirm-background',
    ]) {
      final backend = FakeBackend();
      final sample = scenario == 'gap'
          ? record(start: '2026-11-01', end: '2026-11-03')
          : record();
      backend.on(
        'GET',
        '/daily-items',
        (_) => FakeResponse({
          'items': [sample],
          'total': 1,
        }),
      );
      final container = buildTestContainer(
        backend: backend,
        user: employeeUser(),
      );
      final key = GlobalKey<DailyItemsCalendarState>();
      var opened = 0;
      await tester.pumpWidget(
        wrapWithScope(
          container,
          Scaffold(
            body: DailyItemsCalendar(
              key: key,
              businessDate: const CompanyDate(2026, 11, 10),
              onDaySelected: (_) => opened++,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      key.currentState!.goToDate(
        CompanyDate(2026, 11, scenario == 'gap' ? 1 : 9),
      );
      await tester.pumpAndSettle();
      final source = find.byKey(
        ValueKey(
          'daily-bar-range-${scenario == 'gap' ? '2026-10-26' : '2026-11-09'}',
        ),
      );
      final grab = Offset(
        390 / 7 * (scenario == 'gap' ? 6.5 : 1.5),
        tester.getRect(source).center.dy,
      );
      final gesture = await tester.startGesture(grab);
      await tester.pump(
        Duration(milliseconds: scenario == 'scroll' ? 100 : 501),
      );
      if (scenario == 'multitouch') {
        final second = await tester.startGesture(
          grab + const Offset(10, 10),
          pointer: 2,
        );
        await second.up();
      } else if (scenario != 'zero') {
        await gesture.moveBy(
          Offset(
            scenario == 'gap'
                ? -390 / 7
                : scenario == 'scroll'
                ? 0
                : 390 / 7,
            scenario == 'scroll' ? -35 : 0,
          ),
        );
        await tester.pump();
      }
      if (scenario == 'background') {
        tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      }
      await gesture.up();
      await tester.pumpAndSettle();
      if (scenario == 'cancel' || scenario == 'confirm-background') {
        expect(find.text('调整每日事项日期'), findsOneWidget, reason: scenario);
        if (scenario == 'confirm-background') {
          tester.binding.handleAppLifecycleStateChanged(
            AppLifecycleState.paused,
          );
          tester.binding.handleAppLifecycleStateChanged(
            AppLifecycleState.resumed,
          );
        }
        await tester.tap(find.text(scenario == 'cancel' ? '取消' : '确认改期'));
        await tester.pumpAndSettle();
      }
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      expect(find.text('调整每日事项日期'), findsNothing, reason: scenario);
      expect(
        backend.requests.where((r) => r.method != 'GET'),
        isEmpty,
        reason: scenario,
      );
      expect(opened, 0, reason: scenario);
      expect(tester.takeException(), isNull, reason: scenario);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
      container.dispose();
    }
  });

  test('稀疏周日/非连续列/月边界溢出只计真实隐藏覆盖日', () {
    final items = [
      for (final date in [
        '2026-11-01',
        '2026-11-03',
        '2026-11-08',
        '2026-11-30',
      ])
        for (var i = 0; i < 5; i++)
          DailyItem.fromJson({
            ...record(start: date, end: date),
            'id': '$date-$i',
          }),
    ];
    final layout = MonthLayoutCalculator.compute(
      month: const CompanyDate(2026, 11, 1),
      items: items,
      fixedWeeks: false,
    );
    for (final day in layout.weeks.expand((week) => week.days)) {
      expect(
        day.overflowCount,
        items.any((item) => item.startDate == day.date) ? 2 : 0,
      );
    }
    expect(CalendarMetrics.laneHeight, greaterThan(18));
    expect(
      CalendarMetrics.viewportHeight,
      CalendarMetrics.weekdayRowHeight +
          CalendarMetrics.monthHeaderHeight +
          2 * CalendarMetrics.weekHeight,
    );
  });

  test('事项月分页拒绝停滞游标、总数变化和末页缺项，重试后才标完整', () async {
    for (final failure in ['cursor', 'total', 'missing']) {
      final backend = FakeBackend();
      var repaired = false;
      backend.on('GET', '/daily-items', (request) {
        final offset = request.query['offset'] as int;
        return FakeResponse({
          'items': [if (offset == 0) record()],
          'total': repaired
              ? 1
              : failure == 'total' && offset > 0
              ? 3
              : 2,
          'nextOffset': repaired || failure == 'missing' || offset > 0
              ? null
              : failure == 'cursor'
              ? 0
              : 50,
        });
      });
      final container = buildTestContainer(
        backend: backend,
        user: employeeUser(),
      );
      final controller = container.read(dailyItemsProvider.notifier);
      await controller.ensureMonths([const CompanyDate(2026, 11, 1)]);
      var window = container
          .read(dailyItemsProvider)
          .windowFor(const CompanyDate(2026, 11, 1))!;
      expect(window.complete, isFalse, reason: failure);
      expect(window.error, isNotNull, reason: failure);
      expect(backend.requests.length, lessThanOrEqualTo(2));
      repaired = true;
      await controller.retryMonth(const CompanyDate(2026, 11, 1));
      window = container
          .read(dailyItemsProvider)
          .windowFor(const CompanyDate(2026, 11, 1))!;
      expect(window.complete, isTrue);
      expect(window.error, isNull);
      container.dispose();
    }
  });

  test('零位移不写、冲突不覆盖缓存、账号切换丢弃迟到改期且不刷新新账号', () async {
    final backend = FakeBackend();
    final pending = Completer<FakeResponse>();
    var conflict = true;
    backend.on(
      'GET',
      '/daily-items',
      (_) => FakeResponse({
        'items': [record()],
        'total': 1,
      }),
    );
    backend.on(
      'PATCH',
      '/daily-items/range',
      (_) => conflict
          ? FakeResponse({
              'code': 'VERSION_CONFLICT',
              'message': '事项已更新',
            }, status: 412)
          : pending.future,
    );
    var epoch = 1;
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
      accountEpoch: () => epoch,
    );
    addTearDown(container.dispose);
    await container.pump();
    final controller = container.read(dailyItemsProvider.notifier);
    await controller.ensureMonths([const CompanyDate(2026, 11, 1)]);
    final original = container.read(dailyItemsProvider).byId('range')!;
    await controller.moveItem(original: original, days: 0);
    expect(backend.requestsFor('PATCH', '/daily-items/range'), isEmpty);
    await expectLater(
      controller.moveItem(original: original, days: 1),
      throwsA(isA<Exception>()),
    );
    expect(
      container.read(dailyItemsProvider).byId('range')!.startDate,
      original.startDate,
    );
    conflict = false;
    final save = controller.moveItem(original: original, days: 1);
    await Future<void>.delayed(Duration.zero);
    final reads = backend.requestsFor('GET', '/daily-items').length;
    // A new account generation must replace all caches before a late write arrives.
    epoch++;
    container.invalidate(accountEpochProvider);
    await container.pump();
    expect(container.read(dailyItemsProvider).items, isEmpty);
    pending.complete(
      FakeResponse(record(start: '2026-11-08', end: '2026-11-12')),
    );
    await save;
    expect(container.read(dailyItemsProvider).items, isEmpty);
    expect(backend.requestsFor('GET', '/daily-items'), hasLength(reads));
  });

  test('改期响应丢失重试同体同键同版本，跨月全覆盖刷新且完成正文不提交', () async {
    final backend = FakeBackend();
    final original = DailyItem.fromJson(
      record(start: '2026-10-30', end: '2027-01-02'),
    );
    var attempts = 0;
    backend.on(
      'GET',
      '/daily-items',
      (_) => FakeResponse({'items': [], 'total': 0}),
    );
    backend.on('PATCH', '/daily-items/range', (request) {
      attempts++;
      if (attempts == 1) return FakeResponse({'message': '响应丢失'}, status: 503);
      return FakeResponse({
        ...record(start: '2026-10-31', end: '2027-01-03'),
        'rowVersion': 8,
      });
    });
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    final controller = container.read(dailyItemsProvider.notifier);
    await controller.ensureMonths([
      for (var i = 0; i < 4; i++) const CompanyDate(2026, 10, 1).addMonths(i),
    ]);
    await expectLater(
      controller.moveItem(original: original, days: 1),
      throwsA(isA<Exception>()),
    );
    await controller.moveItem(original: original, days: 1);
    final writes = backend.requestsFor('PATCH', '/daily-items/range');
    expect(
      writes[0].headers['Idempotency-Key'],
      writes[1].headers['Idempotency-Key'],
    );
    expect(writes.map((r) => r.headers['If-Match']), everyElement('"7"'));
    expect(
      writes.map((r) => r.jsonBody),
      everyElement({'startDate': '2026-10-31', 'endDate': '2027-01-03'}),
    );
    expect(backend.requestsFor('GET', '/daily-items'), hasLength(8));
  });
}
