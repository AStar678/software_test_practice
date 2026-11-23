import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:pandora_employee/core/preferences/app_preferences.dart';
import 'package:pandora_employee/core/theme/pandora_theme.dart';
import 'package:pandora_employee/features/tasks/presentation/task_form_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/test_harness.dart';
import 'calendar_day_entrance_test.dart'
    show calendarPage, calendarTaskJson, routerApp;
import 'calendar_day_holiday_test.dart' show holidayYear;

final weekGrid = find.byKey(const ValueKey('expanded-calendar-week'));

Finder dateHeader(String date) =>
    find.byKey(ValueKey('task-date-header-$date'));

Future<void> chooseWeek(WidgetTester tester, String month, String range) async {
  await tester.tap(find.byTooltip('选择周 $month').hitTestable());
  await tester.pumpAndSettle();
  await tester.tap(find.text(range));
  await tester.pumpAndSettle();
}

Future<void> weekPreferences(String date, {String? personId}) async {
  final prefs = await AppPreferences.load('u1', calendarPerson: personId);
  await prefs.setString('calendar.lastDate', date);
  await prefs.setString('calendar.lastOffset', '65');
  await prefs.setString('calendar.weekHeight', '102');
}

void main() {
  for (final personId in <String?>[null, 'p1']) {
    testWidgets('窄短屏的跨年周：完整浏览、创建权限和末列溢出 ($personId)', (tester) async {
      SharedPreferences.setMockInitialValues({});
      tester.view.physicalSize = const Size(320, 450);
      tester.view.devicePixelRatio = 1;
      tester.platformDispatcher.textScaleFactorTestValue = 1.25;
      addTearDown(tester.view.reset);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await weekPreferences('2026-12-01', personId: personId);
      final tasks = [
        calendarTaskJson(
          id: 'span',
          startAt: '2026-12-30T00:00:00Z',
          dueAt: '2027-01-02T04:00:00Z',
        ),
        for (var index = 0; index < 24; index++)
          calendarTaskJson(
            id: 'extra-$index',
            title: '密集任务 $index',
            startAt: '2027-01-01T01:00:00Z',
            dueAt: '2027-01-01T03:00:00Z',
          ),
        for (var index = 0; index < 24; index++)
          calendarTaskJson(
            id: 'sunday-$index',
            title: '周日任务 $index',
            startAt: '2027-01-03T01:00:00Z',
            dueAt: '2027-01-03T03:00:00Z',
          ),
      ];
      final backend = calendarBackendForWeek(tasks);
      final container = buildTestContainer(
        backend: backend,
        user: employeeUser(),
        now: DateTime.utc(2027, 1, 1, 4),
      );
      addTearDown(container.dispose);
      final detailPath = personId == null
          ? '/tasks/:id'
          : '/people/:person/tasks/:id';
      final router = GoRouter(
        initialLocation: '/schedule',
        routes: [
          GoRoute(path: '/schedule', builder: (_, _) => calendarPage(personId)),
          GoRoute(path: '/tasks/new', builder: (_, _) => const TaskCreatePage()),
          GoRoute(
            path: detailPath,
            builder: (_, state) =>
                Scaffold(body: Text('详情 ${state.pathParameters['id']}')),
          ),
        ],
      );
      addTearDown(router.dispose);
      await tester.pumpWidget(routerApp(container, router));
      await tester.pumpAndSettle();

      final monthCell = find
          .ancestor(
            of: dateHeader('2026-12-01').hitTestable(),
            matching: find.byType(InkWell),
          )
          .first;
      final before = tester.getRect(monthCell);
      final viewport = tester.getRect(find.byType(ListView));
      await chooseWeek(tester, '2026年12月', '2026-12-28 至 2027-01-03');
      expect(find.byType(Scrollable), findsNothing);
      final grid = tester.getRect(weekGrid);
      expect(grid.height, greaterThan(viewport.height - 100));
      expect(grid.width, greaterThan(270));
      expect(
        find.descendant(
          of: weekGrid,
          matching: find.byWidgetPredicate(
            (widget) =>
                widget is DecoratedBox &&
                widget.key.toString().contains('task-date-header-'),
          ),
        ),
        findsNWidgets(7),
      );
      expect(find.byTooltip('元旦 · 休'), findsOneWidget);
      expect(
        (tester.widget<DecoratedBox>(dateHeader('2027-01-01')).decoration
                as BoxDecoration)
            .color,
        PandoraColors.petal,
      );
      await tester.dragFrom(grid.center, const Offset(0, -100));
      await tester.pumpAndSettle();
      expect(tester.getRect(weekGrid), grid);

      final span = find.byKey(const ValueKey('task-bar-span'));
      expect(span, findsOneWidget);
      await tester.tapAt(
        Offset(
          tester.getCenter(dateHeader('2027-01-01')).dx,
          tester.getCenter(span).dy,
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('2027-01-01 完整清单'), findsOneWidget);
      final list = find.byType(ListView);
      final rows = tester
          .widget<ListView>(list)
          .childrenDelegate
          .estimatedChildCount;
      expect(rows, 49);
      await tester.drag(list, const Offset(0, -550));
      await tester.pumpAndSettle();
      final scroll = tester
          .state<ScrollableState>(find.byType(Scrollable))
          .position
          .pixels;
      expect(scroll, greaterThan(0));
      final row = find.byType(ListTile).hitTestable().first;
      final rowKey =
          tester
                  .widget<CustomPaint>(
                    find
                        .ancestor(of: row, matching: find.byType(CustomPaint))
                        .first,
                  )
                  .key!
              as ValueKey<String>;
      await tester.tap(row);
      await tester.pumpAndSettle();
      expect(
        find.text('详情 ${rowKey.value.replaceFirst('day-list-dash-', '')}'),
        findsOneWidget,
      );
      router.pop();
      await tester.pumpAndSettle();
      expect(
        tester.state<ScrollableState>(find.byType(Scrollable)).position.pixels,
        scroll,
      );
      await tester.tap(find.widgetWithText(OutlinedButton, '日视图'));
      await tester.pumpAndSettle();
      expect(find.text('2027-01-01 日视图'), findsOneWidget);
      await tester.tap(find.byTooltip('返回展开周'));
      await tester.pumpAndSettle();
      expect(tester.getRect(weekGrid), grid);

      final shownBars = find
          .byWidgetPredicate(
            (widget) =>
                widget is GestureDetector &&
                widget.key.toString().contains('task-bar-extra-'),
          )
          .evaluate()
          .length;
      final overflow = find.byKey(const ValueKey('task-overflow-2027-01-01'));
      expect(
        find.descendant(
          of: overflow,
          matching: find.text('+${24 - shownBars}'),
        ),
        findsOneWidget,
      );
      await tester.tap(overflow);
      await tester.pumpAndSettle();
      expect(find.text('2027-01-01 完整清单'), findsOneWidget);
      await tester.tap(find.byTooltip('关闭'));
      await tester.pumpAndSettle();

      final create = find.byTooltip('新建任务');
      final sundayOverflow = find.byKey(
        const ValueKey('task-overflow-2027-01-03'),
      );
      expect(sundayOverflow.hitTestable(), findsOneWidget);
      if (personId == null) {
        expect(create.hitTestable(), findsOneWidget);
        expect(tester.getRect(create).overlaps(grid), isFalse);
        await tester.tap(create);
        await tester.pumpAndSettle();
        expect(find.byType(TaskFormPage), findsOneWidget);
        router.pop();
        await tester.pumpAndSettle();
        expect(tester.getRect(weekGrid), grid);
        await tester.tap(sundayOverflow.hitTestable());
      } else {
        expect(create, findsNothing);
        final overflowLabel = find.descendant(
          of: sundayOverflow,
          matching: find.byType(Text),
        );
        Focus.of(tester.element(overflowLabel)).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();
        expect(find.text('2027-01-03 完整清单'), findsOneWidget);
        await tester.sendKeyEvent(LogicalKeyboardKey.escape);
        await tester.pumpAndSettle();
        expect(weekGrid, findsOneWidget);
        expect(Focus.of(tester.element(overflowLabel)).hasPrimaryFocus, isTrue);
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      }
      await tester.pumpAndSettle();
      expect(find.text('2027-01-03 完整清单'), findsOneWidget);
      await tester.tap(find.byTooltip('关闭'));
      await tester.pumpAndSettle();
      await tester.tap(dateHeader('2027-01-03'));
      await tester.pumpAndSettle();
      expect(find.text('2027-01-03 完整清单'), findsOneWidget);
      await tester.tap(find.byTooltip('关闭'));
      await tester.pumpAndSettle();

      final nextWeek = find.byTooltip('下一周');
      final previousWeek = find.byTooltip('上一周');
      expect(tester.getRect(nextWeek).overlaps(grid), isFalse);
      expect(tester.getRect(previousWeek).overlaps(grid), isFalse);
      await tester.tap(nextWeek);
      await tester.pumpAndSettle();
      expect(find.byTooltip('2027-01-04 至 2027-01-10'), findsOneWidget);
      expect(dateHeader('2027-01-03'), findsNothing);
      expect(tester.getRect(weekGrid), grid);
      await tester.tap(dateHeader('2027-01-10'));
      await tester.pumpAndSettle();
      expect(find.text('2027-01-10 完整清单'), findsOneWidget);
      await tester.tap(find.byTooltip('关闭'));
      await tester.pumpAndSettle();
      await tester.tap(previousWeek);
      await tester.pumpAndSettle();
      expect(find.byTooltip('2026-12-28 至 2027-01-03'), findsOneWidget);
      expect(sundayOverflow.hitTestable(), findsOneWidget);
      await tester.tap(nextWeek);
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('收起周'));
      await tester.pumpAndSettle();
      expect(tester.getRect(monthCell), before);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('切换人员及切回不继承展开周', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await weekPreferences('2026-11-01', personId: 'p1');
    final container = buildTestContainer(
      backend: calendarBackendForWeek([]),
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    Future<void> show(String? personId) async {
      await tester.pumpWidget(wrapWithScope(container, calendarPage(personId)));
      await tester.pumpAndSettle();
    }

    await show('p1');
    await chooseWeek(tester, '2026年11月', '2026-10-26 至 2026-11-01');
    expect(weekGrid, findsOneWidget);
    await show('p2');
    expect(weekGrid, findsNothing);
    await show(null);
    expect(weekGrid, findsNothing);
    await show('p1');
    expect(weekGrid, findsNothing);
  });
}

FakeBackend calendarBackendForWeek(List<Map<String, Object?>> tasks) =>
    FakeBackend()
      ..on(
        'GET',
        '/tasks',
        (_) => FakeResponse({'items': tasks, 'nextCursor': null}),
      )
      ..on(
        'GET',
        '/calendar/holidays/2026',
        (_) => FakeResponse(holidayYear(2026, [])),
      )
      ..on(
        'GET',
        '/calendar/holidays/2027',
        (_) => FakeResponse(
          holidayYear(2027, [
            {'date': '2027-01-01', 'name': '元旦', 'isOffDay': true},
          ]),
        ),
      );
