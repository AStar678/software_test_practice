import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/company/company_date.dart';
import '../../../core/theme/pandora_theme.dart';
import '../domain/month_layout.dart';
import 'daily_items_providers.dart';

/// 连续月份块的固定度量：六周 × 三条事项车道，使跨月滚动锚点稳定。
class CalendarMetrics {
  const CalendarMetrics._();

  static const double monthHeaderHeight = 34;
  static const double weekdayRowHeight = 20;
  static const double dateRowHeight = 18;
  static const double laneHeight = 18;
  static const double weekHeight = dateRowHeight + laneHeight * MonthLayout.maxLanes;
  static const double monthBlockHeight = monthHeaderHeight + weekdayRowHeight + weekHeight * MonthLayout.fixedWeekCount;
}

Color itemStateColor(DailyItemVisualState state) => switch (state) {
      DailyItemVisualState.completed => PandoraColors.completed,
      DailyItemVisualState.overdue => PandoraColors.overdue,
      DailyItemVisualState.open => PandoraColors.open,
    };

String itemStateLabel(DailyItemVisualState state) => switch (state) {
      DailyItemVisualState.completed => '已完成',
      DailyItemVisualState.overdue => '已逾期',
      DailyItemVisualState.open => '未完成',
    };

/// 一个连续月份块：七列、跨日事项条、条外名称与准确溢出。
/// 日期、空白、事项条及溢出都先进入该日完整清单。
class DailyItemsMonthBlock extends ConsumerStatefulWidget {
  const DailyItemsMonthBlock({
    super.key,
    required this.month,
    required this.businessDate,
    required this.onDaySelected,
  });

  final CompanyDate month;
  final CompanyDate businessDate;
  final ValueChanged<CompanyDate> onDaySelected;

  @override
  ConsumerState<DailyItemsMonthBlock> createState() => _DailyItemsMonthBlockState();
}

class _DailyItemsMonthBlockState extends ConsumerState<DailyItemsMonthBlock> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _requestIfNeeded());
  }

  @override
  void didUpdateWidget(covariant DailyItemsMonthBlock oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.month != widget.month) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _requestIfNeeded());
    }
  }

  void _requestIfNeeded() {
    if (!mounted) return;
    final key = DailyItemsState.monthKey(CompanyDate(widget.month.year, widget.month.month, 1));
    final state = ref.read(dailyItemsProvider);
    if (state.months[key] != null) return;
    unawaited(ref.read(dailyItemsProvider.notifier).ensureMonths([widget.month]));
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(dailyItemsProvider);
    final window = state.months[DailyItemsState.monthKey(CompanyDate(widget.month.year, widget.month.month, 1))];
    final layout = MonthLayoutCalculator.compute(month: widget.month, items: state.items.values);
    if (window == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _requestIfNeeded();
      });
    }

    return SizedBox(
      height: CalendarMetrics.monthBlockHeight,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: CalendarMetrics.monthHeaderHeight,
            child: Row(
              children: [
                Text(
                  '${widget.month.year}年${widget.month.month}月',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                ),
                const Spacer(),
                if (window?.error != null)
                  TextButton.icon(
                    onPressed: () => ref.read(dailyItemsProvider.notifier).retryMonth(widget.month),
                    icon: const Icon(Icons.refresh, size: 16),
                    label: const Text('加载失败，重试'),
                    style: TextButton.styleFrom(foregroundColor: PandoraColors.overdue),
                  )
                else if (window == null || window.loading)
                  const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
              ],
            ),
          ),
          const _WeekdayHeader(),
          for (final week in layout.weeks)
            _WeekRow(
              week: week,
              businessDate: widget.businessDate,
              onDaySelected: widget.onDaySelected,
            ),
        ],
      ),
    );
  }
}

class _WeekdayHeader extends StatelessWidget {
  const _WeekdayHeader();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: CalendarMetrics.weekdayRowHeight,
      child: Row(
        children: [
          for (final label in CompanyCalendarGrid.weekdayLabels)
            Expanded(
              child: Center(
                child: Text(
                  label,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(color: PandoraColors.muted),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _WeekRow extends StatelessWidget {
  const _WeekRow({
    required this.week,
    required this.businessDate,
    required this.onDaySelected,
  });

  final WeekLayout week;
  final CompanyDate businessDate;
  final ValueChanged<CompanyDate> onDaySelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: CalendarMetrics.weekHeight,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final cellWidth = constraints.maxWidth / 7;
          return Stack(
            children: [
              Row(
                children: [
                  for (final day in week.days)
                    Expanded(
                      child: _DayCell(
                        day: day,
                        isToday: day.inMonth && day.date == businessDate,
                        onTap: day.inMonth ? () => onDaySelected(day.date) : null,
                      ),
                    ),
                ],
              ),
              for (final bar in week.bars)
                Positioned(
                  left: bar.startColumn * cellWidth + 2,
                  top: CalendarMetrics.dateRowHeight + bar.lane * CalendarMetrics.laneHeight,
                  width: ((bar.endColumn - bar.startColumn + 1) * cellWidth - 4).clamp(2, double.infinity),
                  height: CalendarMetrics.laneHeight - 1,
                  child: IgnorePointer(child: _BarVisual(bar: bar)),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({required this.day, required this.isToday, this.onTap});

  final DayCellLayout day;
  final bool isToday;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    if (!day.inMonth) {
      return const SizedBox.shrink();
    }
    final semantics = '${day.date.iso}，${day.coveredItemIds.length}项，'
        '${day.openCount}项未完成，${day.completedCount}项已完成'
        '${day.overflowCount > 0 ? '，${day.overflowCount}项在完整清单中' : ''}';
    return Semantics(
      button: true,
      label: semantics,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2),
          child: Column(
            children: [
              SizedBox(
                height: CalendarMetrics.dateRowHeight,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      width: 20,
                      height: 20,
                      alignment: Alignment.center,
                      decoration: isToday
                          ? const BoxDecoration(color: PandoraColors.petal, shape: BoxShape.circle)
                          : null,
                      child: Text(
                        '${day.date.day}',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: isToday ? PandoraColors.brand : PandoraColors.ink,
                              fontWeight: isToday ? FontWeight.w700 : FontWeight.w500,
                            ),
                      ),
                    ),
                    const Spacer(),
                    if (day.overflowCount > 0)
                      Text(
                        '+${day.overflowCount}',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: PandoraColors.muted,
                              fontSize: 9,
                            ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: CalendarMetrics.laneHeight * MonthLayout.maxLanes),
            ],
          ),
        ),
      ),
    );
  }
}

class _BarVisual extends StatelessWidget {
  const _BarVisual({required this.bar});

  final BarLayout bar;

  @override
  Widget build(BuildContext context) {
    final color = itemStateColor(bar.state);
    final radius = Radius.circular(3);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          height: 5,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.horizontal(
              left: bar.continuesBefore ? Radius.zero : radius,
              right: bar.continuesAfter ? Radius.zero : radius,
            ),
          ),
        ),
        const SizedBox(height: 1),
        Text(
          bar.name,
          maxLines: 1,
          overflow: TextOverflow.clip,
          softWrap: false,
          style: TextStyle(
            fontSize: 9.5,
            height: 1.1,
            color: bar.state == DailyItemVisualState.completed ? PandoraColors.muted : PandoraColors.ink,
            decoration: bar.state == DailyItemVisualState.completed ? TextDecoration.lineThrough : null,
          ),
        ),
      ],
    );
  }
}
