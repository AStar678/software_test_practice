import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/app.dart';
import 'package:pandora_employee/core/company/company_date.dart';
import 'package:pandora_employee/core/company/workspace_clock.dart';
import 'package:pandora_employee/core/session/credential_store.dart';
import 'package:pandora_employee/core/session/session_manager.dart';
import 'package:pandora_employee/features/daily_items/presentation/daily_items_calendar.dart';
import 'package:pandora_employee/features/daily_items/presentation/daily_items_day_page.dart';
import 'package:pandora_employee/features/home/domain/home_data.dart';
import 'package:pandora_employee/features/home/presentation/home_lists.dart';
import 'package:pandora_employee/features/home/presentation/home_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/test_harness.dart';

void main() {
  testWidgets('body-only事件纪两行折叠、按ID独立展开且保留原文', (tester) async {
    final bodies = [
      '第一条\n第二行\n第三行\n第四行\n<b>纯文本</b>',
      '第二条\n第二行\n第三行\n第四行',
      '恰好\n两行',
    ];
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/home',
      (_) => FakeResponse({
        'companyItems': [
          for (var i = 0; i < bodies.length; i++)
            {'id': 'c$i', 'body': bodies[i]},
        ],
      }),
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const HomeEventsPage()));
    await tester.pumpAndSettle();
    Text body(int i) => tester.widget<Text>(find.text(bodies[i]));
    expect(body(0).maxLines, 2);
    expect(body(1).maxLines, 2);
    expect(body(2).maxLines, 2);
    expect(find.byKey(const ValueKey('event-arrow-c0')), findsOneWidget);
    expect(find.byKey(const ValueKey('event-arrow-c1')), findsOneWidget);
    expect(
      find.byKey(const ValueKey('event-arrow-c2')),
      findsNothing,
      reason: '恰好两行不需要展开箭头，也不留空位',
    );
    await tester.tap(find.text(bodies[2]));
    await tester.pumpAndSettle();
    expect(body(2).maxLines, 2, reason: '未截断正文不提供伪展开操作');
    await tester.tap(find.text(bodies[0]));
    await tester.pumpAndSettle();
    await tester.tap(find.text(bodies[1]));
    await tester.pumpAndSettle();
    await tester.tap(find.text(bodies[0]));
    await tester.pumpAndSettle();
    expect(body(0).maxLines, 2);
    expect(body(1).maxLines, isNull);
    expect(body(0).data, contains('<b>纯文本</b>'));
    expect(body(0).data, contains('第一条\n第二行'));
    expect(find.byKey(const ValueKey('event-arrow-c1')), findsOneWidget);
    expect(find.byType(HomeEventsPage), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  for (final (size, scale) in [
    (const Size(390, 640), 1.0),
    (const Size(320, 568), 1.5),
  ]) {
    testWidgets('首页 ${size.width}×${size.height} 字号 $scale 半屏事项与双层滚动', (
      tester,
    ) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      tester.view.padding = const FakeViewPadding(top: 24, bottom: 24);
      tester.view.viewPadding = tester.view.padding;
      tester.platformDispatcher.textScaleFactorTestValue = scale;
      addTearDown(tester.view.reset);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      SharedPreferences.setMockInitialValues({});
      final backend = FakeBackend();
      backend.on(
        'GET',
        '/home',
        (_) => FakeResponse({
          'companyItems': [
            for (var index = 1; index <= 3; index++)
              {'id': 'event$index', 'body': '公司事件 $index\n第二行正文'},
          ],
          'assignedTasks': [],
          'businessDate': '2026-11-10',
        }),
      );
      backend.on(
        'GET',
        '/daily-items',
        (_) => FakeResponse({
          'items': [],
          'total': 0,
          'nextOffset': null,
          'businessDate': '2026-11-10',
          'organizationTimeZone': 'Asia/Shanghai',
        }),
      );
      final user = employeeUser();
      final session = SessionManager(
        api: FakeAuthGateway(user),
        store: MemoryCredentialStore(),
        clock: WorkspaceClock(now: () => DateTime.utc(2026, 11, 10, 4)),
      );
      addTearDown(session.dispose);
      await session.login(phone: user.phone!, password: 'fixture');
      final container = buildTestContainer(
        backend: backend,
        user: user,
        sessionManager: session,
      );
      addTearDown(container.dispose);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const PandoraApp(),
        ),
      );
      await tester.pumpAndSettle();
      final outer = find.byType(CustomScrollView);
      final outerPosition = tester
          .widget<CustomScrollView>(outer)
          .controller!
          .position;
      final viewport = tester.getRect(outer);
      final section = find.byKey(const ValueKey('home-daily-items-section'));
      final calendar = tester.state<DailyItemsCalendarState>(
        find.byType(DailyItemsCalendar),
      );
      final dateScroll = find.byKey(const ValueKey('daily-calendar-scroll'));
      final innerPosition = tester
          .widget<SingleChildScrollView>(dateScroll)
          .controller!
          .position;
      final title = find.text('每日事项');
      final today = find.widgetWithText(TextButton, '今天');
      final previous = find.byTooltip('上个月');
      final next = find.byTooltip('下个月');
      final add = find.byTooltip('新建每日事项');
      final month = find.widgetWithText(TextButton, '2026年11月');

      Future<void> scrollToBottom() async {
        await tester.dragFrom(
          viewport.topLeft + const Offset(8, 80),
          const Offset(0, -500),
        );
        await tester.pumpAndSettle();
        expect(
          outerPosition.pixels,
          closeTo(outerPosition.maxScrollExtent, 0.01),
        );
      }

      expect(viewport.top, tester.getRect(find.byType(AppBar)).bottom);
      expect(viewport.bottom, tester.getRect(find.byType(NavigationBar)).top);
      expect(outerPosition.maxScrollExtent, greaterThan(0));
      await scrollToBottom();
      final sectionRect = tester.getRect(section);
      expect(sectionRect.height, lessThanOrEqualTo(viewport.height / 2));
      expect(sectionRect.top, greaterThanOrEqualTo(viewport.top));
      expect(sectionRect.bottom, lessThanOrEqualTo(viewport.bottom));
      for (final target in [title, add, previous, month, next, today]) {
        final rect = tester.getRect(target);
        expect(rect.left, greaterThanOrEqualTo(sectionRect.left));
        expect(rect.right, lessThanOrEqualTo(sectionRect.right));
        expect(rect.top, greaterThanOrEqualTo(sectionRect.top));
        expect(rect.bottom, lessThanOrEqualTo(sectionRect.bottom));
        expect(target.hitTestable(), findsOneWidget);
      }
      expect(tester.takeException(), isNull, reason: '窄屏放大字体不得横向溢出');

      final previousInnerOffset = innerPosition.pixels;
      final previousAnchor = calendar.anchorDate;
      await tester.drag(dateScroll, const Offset(0, -140));
      await tester.pumpAndSettle();
      expect(innerPosition.pixels, greaterThan(previousInnerOffset));
      expect(calendar.anchorDate.isAfter(previousAnchor), isTrue);
      expect(
        outerPosition.pixels,
        closeTo(outerPosition.maxScrollExtent, 0.01),
      );

      for (final dragStart in [title, today]) {
        final innerOffset = innerPosition.pixels;
        await tester.drag(dragStart, const Offset(0, 160));
        await tester.pumpAndSettle();
        expect(outerPosition.pixels, 0);
        expect(innerPosition.pixels, innerOffset);
        expect(find.text('事件纪').hitTestable(), findsOneWidget);
        expect(find.text('任务看板').hitTestable(), findsOneWidget);
        await scrollToBottom();
      }

      await tester.tap(today);
      await tester.pumpAndSettle();
      expect(calendar.anchorDate, CompanyDate(2026, 11, 10));
      await tester.tap(previous);
      await tester.pumpAndSettle();
      expect(find.widgetWithText(TextButton, '2026年10月'), findsOneWidget);
      await tester.tap(next);
      await tester.pumpAndSettle();
      expect(month, findsOneWidget);
      await tester.tap(next);
      await tester.pumpAndSettle();
      await tester.tap(today);
      await tester.pumpAndSettle();
      expect(month, findsOneWidget);
      await tester.tap(month);
      await tester.pumpAndSettle();
      expect(find.text('定位到年月'), findsOneWidget);
      await tester.tap(find.text('取消'));
      await tester.pumpAndSettle();
      expect(find.text('定位到年月'), findsNothing);

      await tester.tap(add);
      await tester.pumpAndSettle();
      expect(find.text('新建每日事项'), findsOneWidget);
      await tester.tap(find.byTooltip('返回'));
      await tester.pumpAndSettle();
      await tester.tap(today);
      await tester.pumpAndSettle();
      final day = find.byKey(const ValueKey('daily-day-2026-11-10'));
      final dateLabel = find.descendant(of: day, matching: find.text('10'));
      expect(
        dateLabel.hitTestable(),
        findsOneWidget,
        reason: '日期 ${tester.getRect(dateLabel)}；日历 ${tester.getRect(dateScroll)}；'
            '首页 ${outerPosition.pixels} / ${outerPosition.maxScrollExtent}；'
            '日历偏移 ${innerPosition.pixels}，锚点 ${calendar.anchorDate}',
      );
      await tester.tap(dateLabel);
      await tester.pumpAndSettle();
      expect(
        tester.widget<DailyItemsDayPage>(find.byType(DailyItemsDayPage)).date,
        CompanyDate(2026, 11, 10),
      );
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('看板直接使用有效截止和执行状态，仅清单严格逾期行红底', (tester) async {
    final backend = FakeBackend();
    final tasks = [
      {
        'taskId': 't0',
        'title': '恰好截止',
        'dueAt': '2026-11-10T04:00:00Z',
        'executionState': 'todo',
      },
      {
        'taskId': 't1',
        'title': '有效版逾期',
        'dueAt': '2026-11-10T03:59:59Z',
        'executionState': 'doing',
        'pendingSchedule': {'dueAt': '2026-11-12T00:00:00Z'},
      },
      {
        'taskId': 't2',
        'title': '已完成',
        'dueAt': '2026-11-09T00:00:00Z',
        'executionState': 'done',
      },
    ];
    backend.on('GET', '/home', (_) => FakeResponse({'assignedTasks': tasks}));
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
    await tester.pumpWidget(wrapWithScope(container, const HomeBoardPage()));
    await tester.pumpAndSettle();
    expect(
      tester.widget<Card>(find.widgetWithText(Card, '有效版逾期')).color,
      const Color(0xFFF8E7E7),
    );
    expect(
      tester.widget<Card>(find.widgetWithText(Card, '恰好截止')).color,
      isNull,
    );
    expect(tester.widget<Card>(find.widgetWithText(Card, '已完成')).color, isNull);
    expect(backend.requestsFor('GET', '/tasks'), isEmpty);
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(wrapWithScope(container, const HomePage()));
    await tester.pumpAndSettle();
    expect(
      tester.widget<Card>(find.widgetWithText(Card, '有效版逾期')).color,
      isNull,
    );
    expect(tester.takeException(), isNull);
  });

  test('首页DTO保服务顺序和原始正文，不从旧标题或待审排期派生', () {
    final data = HomeData.fromJson({
      'companyItems': [
        {'id': 'c1', 'body': '原文\n完整保留', 'title': '退役字段'},
      ],
      'assignedTasks': [
        {
          'taskId': 't2',
          'dueAt': '2026-11-10T04:00:00Z',
          'executionState': 'todo',
        },
        {
          'taskId': 't1',
          'dueAt': '2026-11-09T04:00:00Z',
          'executionState': 'todo',
        },
      ],
    });
    expect(data.companyItems.single.body, '原文\n完整保留');
    expect(data.assignedTasks.map((t) => t.taskId), ['t2', 't1']);
    expect(
      data.assignedTasks.first.isOverdueAt(DateTime.utc(2026, 11, 10, 4)),
      isFalse,
    );
    expect(
      data.assignedTasks.last.isOverdueAt(DateTime.utc(2026, 11, 10, 4)),
      isTrue,
    );
  });
}
