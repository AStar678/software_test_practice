import '../../../core/company/company_date.dart';
import '../domain/daily_item.dart';

/// 事项状态三态：完成优先，未完成且已过结束日为逾期，其余未完成。
enum DailyItemVisualState { completed, overdue, open }

DailyItemVisualState visualStateOf(DailyItem item) {
  if (item.isCompleted) return DailyItemVisualState.completed;
  if (item.isOverdue) return DailyItemVisualState.overdue;
  return DailyItemVisualState.open;
}

class DayCellLayout {
  const DayCellLayout({
    required this.date,
    required this.inMonth,
    required this.coveredItemIds,
    required this.overflowCount,
    required this.openCount,
    required this.completedCount,
  });

  final CompanyDate date;
  final bool inMonth;
  final List<String> coveredItemIds;
  final int overflowCount;
  final int openCount;
  final int completedCount;
}

class BarLayout {
  const BarLayout({
    required this.itemId,
    required this.name,
    required this.state,
    required this.startColumn,
    required this.endColumn,
    required this.lane,
    required this.continuesBefore,
    required this.continuesAfter,
    required this.startDate,
    required this.endDate,
  });

  final String itemId;
  final String name;
  final DailyItemVisualState state;
  final int startColumn;
  final int endColumn;
  final int lane;
  final bool continuesBefore;
  final bool continuesAfter;
  final CompanyDate startDate;
  final CompanyDate endDate;

  bool get isRealStart => !continuesBefore;
  bool get isRealEnd => !continuesAfter;
}

class WeekLayout {
  const WeekLayout({required this.weekStart, required this.days, required this.bars});

  final CompanyDate weekStart;
  final List<DayCellLayout> days;
  final List<BarLayout> bars;
}

class MonthLayout {
  const MonthLayout({required this.month, required this.weeks});

  final CompanyDate month;
  final List<WeekLayout> weeks;

  /// 网格始终保留六周，保证连续月份块高度一致、滚动锚点稳定。
  static const int fixedWeekCount = 6;
  static const int maxLanes = 3;

  bool get isEmpty => weeks.every((week) => week.bars.isEmpty);
}

/// 纯布局计算：七列、真实日期命中、跨周/月续接与密集溢出；
/// 与 Flutter 组件解耦以便独立检查。
class MonthLayoutCalculator {
  const MonthLayoutCalculator._();

  static MonthLayout compute({
    required CompanyDate month,
    required Iterable<DailyItem> items,
    int maxLanes = MonthLayout.maxLanes,
    Set<String> leadingIds = const {},
  }) {
    final monthStart = month.firstDayOfMonth;
    final monthEnd = month.lastDayOfMonth;
    final gridStart = CompanyCalendarGrid.gridStart(monthStart);
    final itemList = items.toList();

    final coveredByDay = <CompanyDate, List<DailyItem>>{};
    for (final item in itemList) {
      final from = item.startDate.isBefore(monthStart) ? monthStart : item.startDate;
      final to = item.endDate.isAfter(monthEnd) ? monthEnd : item.endDate;
      if (to.isBefore(from)) continue;
      for (var day = from; !day.isAfter(to); day = day.addDays(1)) {
        coveredByDay.putIfAbsent(day, () => <DailyItem>[]).add(item);
      }
    }

    final weeks = <WeekLayout>[];
    for (var weekIndex = 0; weekIndex < MonthLayout.fixedWeekCount; weekIndex++) {
      final weekStart = gridStart.addDays(weekIndex * 7);
      final lanes = List<List<bool>>.generate(
        maxLanes,
        (_) => List<bool>.filled(7, false),
      );
      final bars = <BarLayout>[];
      final overflow = <CompanyDate, int>{};

      // 同一周内按起点、ID 排序，命中分配到首个可用车道。
      final weekItems = itemList.where((item) {
        final from = _maxDate(item.startDate, _maxDate(monthStart, weekStart));
        final to = _minDate(item.endDate, _minDate(monthEnd, weekStart.addDays(6)));
        return !to.isBefore(from);
      }).toList()
        ..sort((a, b) {
          final aLeading = leadingIds.contains(a.id);
          final bLeading = leadingIds.contains(b.id);
          if (aLeading != bLeading) return aLeading ? -1 : 1;
          final startCompare = a.startDate.compareTo(b.startDate);
          return startCompare != 0 ? startCompare : a.id.compareTo(b.id);
        });

      for (final item in weekItems) {
        final segmentStart = _maxDate(item.startDate, _maxDate(monthStart, weekStart));
        final segmentEnd = _minDate(item.endDate, _minDate(monthEnd, weekStart.addDays(6)));
        final startColumn = segmentStart.differenceInDays(weekStart);
        final endColumn = segmentEnd.differenceInDays(weekStart);
        var lane = -1;
        for (var candidate = 0; candidate < maxLanes; candidate++) {
          var free = true;
          for (var column = startColumn; column <= endColumn; column++) {
            if (lanes[candidate][column]) {
              free = false;
              break;
            }
          }
          if (free) {
            lane = candidate;
            for (var column = startColumn; column <= endColumn; column++) {
              lanes[candidate][column] = true;
            }
            break;
          }
        }
        if (lane == -1) {
          for (var day = segmentStart; !day.isAfter(segmentEnd); day = day.addDays(1)) {
            overflow[day] = (overflow[day] ?? 0) + 1;
          }
          continue;
        }
        bars.add(
          BarLayout(
            itemId: item.id,
            name: item.body,
            state: visualStateOf(item),
            startColumn: startColumn,
            endColumn: endColumn,
            lane: lane,
            continuesBefore: segmentStart.isAfter(item.startDate),
            continuesAfter: segmentEnd.isBefore(item.endDate),
            startDate: segmentStart,
            endDate: segmentEnd,
          ),
        );
      }

      final days = <DayCellLayout>[];
      for (var column = 0; column < 7; column++) {
        final date = weekStart.addDays(column);
        final inMonth = !date.isBefore(monthStart) && !date.isAfter(monthEnd);
        final covered = inMonth ? (coveredByDay[date] ?? const <DailyItem>[]) : const <DailyItem>[];
        days.add(
          DayCellLayout(
            date: date,
            inMonth: inMonth,
            coveredItemIds: [for (final item in covered) item.id],
            overflowCount: overflow[date] ?? 0,
            openCount: covered.where((item) => !item.isCompleted).length,
            completedCount: covered.where((item) => item.isCompleted).length,
          ),
        );
      }
      weeks.add(WeekLayout(weekStart: weekStart, days: days, bars: bars));
    }

    return MonthLayout(month: monthStart, weeks: weeks);
  }

  static CompanyDate _maxDate(CompanyDate a, CompanyDate b) => a.isAfter(b) ? a : b;

  static CompanyDate _minDate(CompanyDate a, CompanyDate b) => a.isBefore(b) ? a : b;
}
