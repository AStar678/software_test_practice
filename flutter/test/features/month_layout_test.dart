import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/company/company_date.dart';
import 'package:pandora_employee/features/daily_items/domain/daily_item.dart';
import 'package:pandora_employee/features/daily_items/domain/month_layout.dart';

DailyItem item({
  required String id,
  required String start,
  required String end,
  String status = 'open',
  bool completed = false,
}) {
  return DailyItem(
    id: id,
    body: '事项 $id',
    startDate: CompanyDate.parse(start),
    endDate: CompanyDate.parse(end),
    completed: completed,
    status: status,
    rowVersion: 1,
    createdAt: DateTime.utc(2026, 11, 1),
  );
}

void main() {
  group('事项月历布局', () {
    test('固定六周、七列，月份内真实日期唯一且不重复相邻月', () {
      final layout = MonthLayoutCalculator.compute(
        month: const CompanyDate(2026, 11, 1),
        items: const [],
      );
      expect(layout.weeks, hasLength(6));
      final realDates = <CompanyDate>[];
      for (final week in layout.weeks) {
        expect(week.days, hasLength(7));
        for (final day in week.days) {
          if (day.inMonth) realDates.add(day.date);
        }
      }
      expect(realDates, hasLength(30));
      expect(realDates.toSet(), hasLength(30));
      expect(realDates.first, const CompanyDate(2026, 11, 1));
      expect(realDates.last, const CompanyDate(2026, 11, 30));
    });

    test('跨周事项在各周续接，边缘标记连续且不伪造真实端点', () {
      // 2026-11-04（周三）到 2026-11-12（周四），跨两个周段与两个月份网格周。
      final layout = MonthLayoutCalculator.compute(
        month: const CompanyDate(2026, 11, 1),
        items: [item(id: 'a', start: '2026-11-04', end: '2026-11-12')],
      );
      final bars = [for (final week in layout.weeks) ...week.bars.where((bar) => bar.itemId == 'a')];
      expect(bars, hasLength(2));
      expect(bars.first.startColumn, 2); // 周三
      expect(bars.first.endColumn, 6); // 周日
      expect(bars.first.continuesBefore, isFalse);
      expect(bars.first.continuesAfter, isTrue);
      expect(bars.last.startColumn, 0);
      expect(bars.last.endColumn, 3); // 周四
      expect(bars.last.continuesBefore, isTrue);
      expect(bars.last.continuesAfter, isFalse);
      // 每个覆盖日都在对应日期格内命中同一条记录。
      final coveredDays = <CompanyDate>[];
      for (final week in layout.weeks) {
        for (final day in week.days) {
          if (day.inMonth && day.coveredItemIds.contains('a')) coveredDays.add(day.date);
        }
      }
      expect(coveredDays, hasLength(9));
      expect(coveredDays.first, const CompanyDate(2026, 11, 4));
      expect(coveredDays.last, const CompanyDate(2026, 11, 12));
      expect(coveredDays.toSet(), hasLength(9));
    });

    test('跨月事项在两个月分别绘制同一条记录并标记续接', () {
      final november = MonthLayoutCalculator.compute(
        month: const CompanyDate(2026, 11, 1),
        items: [item(id: 'r', start: '2026-11-28', end: '2026-12-03')],
      );
      final december = MonthLayoutCalculator.compute(
        month: const CompanyDate(2026, 12, 1),
        items: [item(id: 'r', start: '2026-11-28', end: '2026-12-03')],
      );
      final novemberBars = [for (final week in november.weeks) ...week.bars.where((bar) => bar.itemId == 'r')];
      final decemberBars = [for (final week in december.weeks) ...week.bars.where((bar) => bar.itemId == 'r')];
      expect(novemberBars.any((bar) => bar.endColumn == 6 && bar.continuesAfter), isTrue);
      expect(decemberBars.first.startColumn, 1);
      expect(decemberBars.first.continuesBefore, isTrue);
      // 11 月 30 日也属于该事项，12 月 3 日为真实端点。
      expect(decemberBars.any((bar) => bar.isRealEnd), isTrue);
    });

    test('超过三条车道时按日准确溢出，仍保留完整命中清单', () {
      final items = [
        for (var index = 0; index < 5; index++)
          item(id: 'x$index', start: '2026-11-10', end: '2026-11-10'),
      ];
      final layout = MonthLayoutCalculator.compute(month: const CompanyDate(2026, 11, 1), items: items);
      final day = layout.weeks
          .expand((week) => week.days)
          .firstWhere((day) => day.date == const CompanyDate(2026, 11, 10));
      expect(day.coveredItemIds, hasLength(5));
      expect(day.overflowCount, 2);
      final bars = [for (final week in layout.weeks) ...week.bars.where((bar) => bar.startDate == day.date)];
      expect(bars, hasLength(3));
    });

    test('不同周起点、闰年二月与跨年月份都对齐七列', () {
      for (final month in [
        const CompanyDate(2026, 2, 1),
        const CompanyDate(2024, 2, 1),
        const CompanyDate(2026, 12, 1),
        const CompanyDate(2027, 2, 1),
      ]) {
        final layout = MonthLayoutCalculator.compute(month: month, items: const []);
        expect(layout.weeks.first.weekStart.weekday, DateTime.monday);
        expect(layout.weeks.last.weekStart.addDays(6).weekday, DateTime.sunday);
        final days = layout.weeks.expand((week) => week.days).where((day) => day.inMonth).toList();
        expect(days.length, month.lastDayOfMonth.day);
        expect(days.first.date, month);
      }
    });

    test('完成状态优先于逾期，未完成且过结束日为逾期', () {
      expect(
        visualStateOf(item(id: 'c', start: '2026-11-01', end: '2026-11-02', completed: true, status: 'overdue')),
        DailyItemVisualState.completed,
      );
      expect(
        visualStateOf(item(id: 'o', start: '2026-11-01', end: '2026-11-02', status: 'overdue')),
        DailyItemVisualState.overdue,
      );
      expect(
        visualStateOf(item(id: 'n', start: '2026-11-01', end: '2026-11-02')),
        DailyItemVisualState.open,
      );
    });

    test('零事项月份仍保留六周高度，滚动锚点稳定', () {
      final layout = MonthLayoutCalculator.compute(month: const CompanyDate(2026, 11, 1), items: const []);
      expect(layout.isEmpty, isTrue);
      expect(layout.weeks.every((week) => week.bars.isEmpty), isTrue);
    });

    test('日历置顶项排在同周其他项之前且不改变日期', () {
      final layout = MonthLayoutCalculator.compute(
        month: const CompanyDate(2026, 11, 1),
        items: [
          item(id: 'b', start: '2026-11-12', end: '2026-11-12'),
          item(id: 'a', start: '2026-11-12', end: '2026-11-12'),
          item(id: 'c', start: '2026-11-10', end: '2026-11-10'),
        ],
        leadingIds: const {'b'},
      );
      final bars = layout.weeks.expand((week) => week.bars).toList();
      expect(bars.first.itemId, 'b');
      expect(bars.first.startDate, const CompanyDate(2026, 11, 12));
      expect(bars.where((bar) => bar.startDate == const CompanyDate(2026, 11, 12)).map((bar) => bar.itemId), ['b', 'a']);
    });
  });
}
