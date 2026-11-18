import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/company/company_date.dart';
import '../../../core/preferences/app_preferences.dart';
import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/fading_name_text.dart';
import '../domain/daily_item.dart';
import '../domain/month_layout.dart';
import 'daily_items_providers.dart';

/// Independent private-item metrics, following the final daily-items Web styles.
class CalendarMetrics {
  const CalendarMetrics._();

  static const double monthHeaderHeight = 34;
  static const double weekdayRowHeight = 26;
  static const double dateRowHeight = 36;
  static const double laneHeight = 34;
  static const double overflowHeight = 18;
  static const double weekHeight =
      dateRowHeight + laneHeight * MonthLayout.maxLanes + overflowHeight + 4;
  static const double viewportHeight =
      weekdayRowHeight + monthHeaderHeight + weekHeight * 2;

  static int weekCount(CompanyDate month) =>
      month.lastDayOfMonth.mondayOfWeek.differenceInDays(
            month.firstDayOfMonth.mondayOfWeek,
          ) ~/
          7 +
      1;
  static double monthHeight(CompanyDate month) =>
      monthHeaderHeight + weekHeight * weekCount(month) + 8;
}

Color itemStateColor(DailyItemVisualState state) => switch (state) {
  DailyItemVisualState.completed => const Color(0xFF8B8F98),
  DailyItemVisualState.overdue => const Color(0xFFC0463A),
  DailyItemVisualState.open => const Color(0xFF3B6FD8),
};
Color itemStateBackground(DailyItemVisualState state) => switch (state) {
  DailyItemVisualState.completed => const Color(0xFFF2F3F5),
  DailyItemVisualState.overdue => const Color(0xFFFDECEA),
  DailyItemVisualState.open => const Color(0xFFE9F1FD),
};
String itemStateLabel(DailyItemVisualState state) => switch (state) {
  DailyItemVisualState.completed => '已完成',
  DailyItemVisualState.overdue => '已逾期',
  DailyItemVisualState.open => '未完成',
};

/// A bounded, bidirectional month window. Persist a real date and its viewport
/// offset, so prepend, resize, refresh and return all use the same anchor.
class DailyItemsCalendar extends ConsumerStatefulWidget {
  const DailyItemsCalendar({
    super.key,
    required this.businessDate,
    required this.onDaySelected,
    this.onAnchorChanged,
  });
  final CompanyDate businessDate;
  final ValueChanged<CompanyDate> onDaySelected;
  final ValueChanged<CompanyDate>? onAnchorChanged;

  @override
  ConsumerState<DailyItemsCalendar> createState() => DailyItemsCalendarState();
}

class DailyItemsCalendarState extends ConsumerState<DailyItemsCalendar>
    with WidgetsBindingObserver {
  final _scroll = ScrollController();
  final _viewportKey = GlobalKey();
  final List<CompanyDate> _months = [];
  AppPreferences? _preferences;
  late CompanyDate _anchor;
  double _anchorOffset = 8;
  bool _restoring = true;
  Timer? _saveTimer;
  Timer? _autoScroll;
  DailyItem? _moving;
  CompanyDate? _grabDay;
  CompanyDate? _targetDay;
  Offset? _pointer;
  int? _dragEpoch;
  bool _confirming = false;
  int _interactionGeneration = 0;
  bool _ready = false;
  int _navigationGeneration = 0;
  final Set<int> _pointers = {};

  CompanyDate get anchorDate => _anchor;
  double get anchorOffset => _anchorOffset;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _anchor = widget.businessDate;
    _resetWindow(_anchor);
    _scroll.addListener(_onScroll);
    unawaited(_restorePreferences());
  }

  void _resetWindow(CompanyDate date) {
    _months.clear();
    for (var delta = -1; delta <= 1; delta++) {
      _months.add(date.firstDayOfMonth.addMonths(delta));
    }
  }

  Future<void> _restorePreferences() async {
    final epoch = ref.read(accountEpochProvider);
    final generation = _navigationGeneration;
    final preferences = await AppPreferences.load(
      ref.read(currentUserProvider)?.id,
    );
    if (!mounted || epoch != ref.read(accountEpochProvider)) return;
    _preferences = preferences;
    if (generation == _navigationGeneration) {
      final date = CompanyDate.tryParse(
        preferences.getString('dailyItems.anchor'),
      );
      if (date != null) {
        _anchor = date;
        _anchorOffset =
            double.tryParse(
              preferences.getString('dailyItems.anchorOffset') ?? '',
            ) ??
            8;
        _resetWindow(date);
      }
    }
    setState(() => _ready = true);
    WidgetsBinding.instance.addPostFrameCallback((_) => _placeAnchor());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _saveTimer?.cancel();
    _autoScroll?.cancel();
    _persistAnchor();
    _scroll.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) {
      _interactionGeneration++;
      _cancelDrag();
    }
  }

  @override
  void didChangeMetrics() {
    _restoring = true;
    WidgetsBinding.instance.addPostFrameCallback((_) => _placeAnchor());
  }

  void goToDate(CompanyDate date) {
    _cancelDrag();
    _navigationGeneration++;
    _restoring = true;
    setState(() {
      _anchor = date;
      _anchorOffset = 8;
      _resetWindow(date);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _placeAnchor());
  }

  double _monthTop(int index) {
    var top = 0.0;
    for (var i = 0; i < index; i++) {
      top += CalendarMetrics.monthHeight(_months[i]);
    }
    return top;
  }

  void _placeAnchor() {
    if (!mounted || !_scroll.hasClients) return;
    final index = _months.indexOf(_anchor.firstDayOfMonth);
    if (index < 0) return;
    final week =
        _anchor.mondayOfWeek.differenceInDays(_months[index].mondayOfWeek) ~/ 7;
    final top =
        _monthTop(index) +
        CalendarMetrics.monthHeaderHeight +
        week * CalendarMetrics.weekHeight;
    _scroll.jumpTo(
      (top - _anchorOffset).clamp(0, _scroll.position.maxScrollExtent),
    );
    _restoring = false;
    widget.onAnchorChanged?.call(_anchor);
    _persistAnchor();
  }

  void _captureAnchor() {
    if (!_scroll.hasClients || _restoring || _moving != null) return;
    final offset = _scroll.offset;
    // First real date row at/below the viewport top, as in anchorFromDom.
    for (var index = 0; index < _months.length; index++) {
      final month = _months[index];
      for (var week = 0; week < CalendarMetrics.weekCount(month); week++) {
        final top =
            _monthTop(index) +
            CalendarMetrics.monthHeaderHeight +
            week * CalendarMetrics.weekHeight;
        if (top < offset - 1) continue;
        final monday = month.mondayOfWeek.addDays(week * 7);
        _anchor = monday.isBefore(month) ? month : monday;
        _anchorOffset = top - offset;
        widget.onAnchorChanged?.call(_anchor);
        _saveTimer?.cancel();
        _saveTimer = Timer(const Duration(milliseconds: 180), _persistAnchor);
        return;
      }
    }
  }

  void _persistAnchor() {
    final prefs = _preferences;
    if (prefs == null) return;
    unawaited(prefs.setString('dailyItems.anchor', _anchor.iso));
    unawaited(prefs.setString('dailyItems.anchorOffset', '$_anchorOffset'));
  }

  void _onScroll() {
    if (_restoring || !_ready) return;
    _captureAnchor();
    if (_scroll.offset < 80) {
      _extend(before: true);
    } else if (_scroll.position.maxScrollExtent - _scroll.offset < 80) {
      _extend(before: false);
    }
  }

  void _extend({required bool before}) {
    if (_restoring || !_scroll.hasClients) return;
    _restoring = true;
    var offset = _scroll.offset;
    setState(() {
      if (before) {
        final month = _months.first.previousMonthFirst;
        _months.insert(0, month);
        offset += CalendarMetrics.monthHeight(month);
        if (_months.length > 12 && _moving == null) _months.removeLast();
      } else {
        _months.add(_months.last.nextMonthFirst);
        if (_months.length > 12 && _moving == null) {
          offset -= CalendarMetrics.monthHeight(_months.removeAt(0));
        }
      }
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scroll.hasClients) return;
      _scroll.jumpTo(offset.clamp(0, _scroll.position.maxScrollExtent));
      _restoring = false;
    });
  }

  Future<void> refreshVisible() async {
    if (!_scroll.hasClients) return;
    final from = _scroll.offset;
    final to = from + _scroll.position.viewportDimension;
    final visible = <CompanyDate>[];
    for (var i = 0; i < _months.length; i++) {
      final top = _monthTop(i);
      if (top < to && top + CalendarMetrics.monthHeight(_months[i]) > from) {
        visible.add(_months[i]);
      }
    }
    for (final month in visible) {
      await ref.read(dailyItemsProvider.notifier).retryMonth(month);
    }
  }

  CompanyDate? _hitDate(Offset global) {
    final box = _viewportKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize || !_scroll.hasClients) return null;
    final point = box.globalToLocal(global);
    if (point.dx < 0 ||
        point.dx >= box.size.width ||
        point.dy < 0 ||
        point.dy >= box.size.height) {
      return null;
    }
    final y = point.dy + _scroll.offset;
    for (var index = 0; index < _months.length; index++) {
      final month = _months[index];
      final relative = y - _monthTop(index) - CalendarMetrics.monthHeaderHeight;
      if (relative < 0 ||
          relative >=
              CalendarMetrics.weekCount(month) * CalendarMetrics.weekHeight) {
        continue;
      }
      final week = relative ~/ CalendarMetrics.weekHeight;
      final col = (point.dx / (box.size.width / 7)).floor();
      final day = month.mondayOfWeek.addDays(week * 7 + col);
      return day.month == month.month && day.year == month.year ? day : null;
    }
    return null;
  }

  void _beginDrag(BarLayout bar, Offset point) {
    if (_confirming || _pointers.length > 1) return;
    final day = _hitDate(point);
    final item = ref.read(dailyItemsProvider).byId(bar.itemId);
    if (day == null || item == null || !item.covers(day)) return;
    _captureAnchor();
    setState(() {
      _moving = item;
      _grabDay = day;
      _targetDay = day;
      _pointer = point;
      _dragEpoch = ref.read(accountEpochProvider);
    });
    unawaited(HapticFeedback.lightImpact());
    _autoScroll = Timer.periodic(
      const Duration(milliseconds: 32),
      (_) => _edgeScroll(),
    );
  }

  void _updateDrag(Offset point) {
    if (_moving == null) return;
    setState(() {
      _pointer = point;
      _targetDay = _hitDate(point);
    });
  }

  void _edgeScroll() {
    if (!mounted ||
        _moving == null ||
        _pointer == null ||
        !_scroll.hasClients ||
        _restoring) {
      return;
    }
    final box = _viewportKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return;
    final y = box.globalToLocal(_pointer!).dy;
    final speed = y < 48
        ? -10.0
        : y > box.size.height - 48
        ? 10.0
        : 0.0;
    if (speed == 0) return;
    _scroll.jumpTo(
      (_scroll.offset + speed).clamp(0, _scroll.position.maxScrollExtent),
    );
    if (!_restoring) _updateDrag(_pointer!);
  }

  void _cancelDrag() {
    _autoScroll?.cancel();
    _autoScroll = null;
    if (!mounted || _moving == null) return;
    setState(() {
      _moving = null;
      _targetDay = null;
      _pointer = null;
    });
    _placeAnchor();
  }

  Future<void> _endDrag() async {
    final original = _moving;
    final target = _targetDay;
    final grab = _grabDay;
    final epoch = _dragEpoch;
    final interaction = _interactionGeneration;
    _cancelDrag();
    if (original == null ||
        target == null ||
        grab == null ||
        target == grab ||
        epoch != ref.read(accountEpochProvider)) {
      return;
    }
    final days = target.differenceInDays(grab);
    final shifted = original.shifted(days);
    _confirming = true;
    var saving = false;
    Object? error;
    try {
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, update) => AlertDialog(
            title: const Text('调整每日事项日期'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '当前：${original.startDate.iso} 至 ${original.endDate.iso}',
                  ),
                  const SizedBox(height: 8),
                  Text('调整后：${shifted.startDate.iso} 至 ${shifted.endDate.iso}'),
                  Text(
                    '跨度保持 ${original.endDate.differenceInDays(original.startDate) + 1} 天',
                  ),
                  if (error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text(
                        '$error',
                        style: const TextStyle(color: PandoraColors.overdue),
                      ),
                    ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: saving
                    ? null
                    : () => Navigator.of(dialogContext).pop(),
                child: const Text('取消'),
              ),
              FilledButton(
                onPressed: saving
                    ? null
                    : () async {
                        if (!mounted ||
                            interaction != _interactionGeneration ||
                            epoch != ref.read(accountEpochProvider)) {
                          Navigator.of(dialogContext).pop();
                          return;
                        }
                        update(() {
                          saving = true;
                          error = null;
                        });
                        try {
                          await ref
                              .read(dailyItemsProvider.notifier)
                              .moveItem(original: original, days: days);
                          if (dialogContext.mounted) {
                            Navigator.of(dialogContext).pop();
                          }
                        } catch (failure) {
                          if (dialogContext.mounted) {
                            update(() {
                              saving = false;
                              error = failure;
                            });
                          }
                        }
                      },
                child: Text(saving ? '正在保存…' : '确认改期'),
              ),
            ],
          ),
        ),
      );
    } finally {
      _confirming = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(accountEpochProvider, (_, _) {
      _cancelDrag();
      _preferences = null;
      _restoring = true;
      _anchor = widget.businessDate;
      _anchorOffset = 8;
      setState(() {
        _resetWindow(_anchor);
        _ready = false;
      });
      unawaited(_restorePreferences());
    });
    final moving = _moving;
    final delta = moving != null && _targetDay != null && _grabDay != null
        ? _targetDay!.differenceInDays(_grabDay!)
        : null;
    return SizedBox(
      height: CalendarMetrics.viewportHeight,
      child: Column(
        children: [
          const _WeekdayHeader(),
          Expanded(
            child: SizedBox(
              key: _viewportKey,
              child: Listener(
                onPointerDown: (event) {
                  _pointers.add(event.pointer);
                  if (_pointers.length > 1) _cancelDrag();
                },
                onPointerUp: (event) => _pointers.remove(event.pointer),
                onPointerCancel: (event) {
                  _pointers.remove(event.pointer);
                  _cancelDrag();
                },
                child: Stack(
                  children: [
                    SingleChildScrollView(
                      key: const ValueKey('daily-calendar-scroll'),
                      controller: _scroll,
                      physics: moving == null
                          ? const ClampingScrollPhysics()
                          : const NeverScrollableScrollPhysics(),
                      child: Column(
                        children: [
                          for (final month in _months)
                            DailyItemsMonthBlock(
                              key: ValueKey(month.iso),
                              month: month,
                              businessDate: widget.businessDate,
                              onDaySelected: widget.onDaySelected,
                              showWeekdays: false,
                              moving: moving != null && delta != null
                                  ? moving.shifted(delta)
                                  : null,
                              onDragStart: _beginDrag,
                              onDragUpdate: _updateDrag,
                              onDragEnd: _endDrag,
                              onDragCancel: _cancelDrag,
                              onBarTap: (bar, point) {
                                final day = _hitDate(point);
                                if (day != null && moving == null) {
                                  widget.onDaySelected(day);
                                }
                              },
                            ),
                        ],
                      ),
                    ),
                    if (moving != null)
                      Positioned(
                        left: 8,
                        right: 8,
                        bottom: 8,
                        child: IgnorePointer(
                          child: Material(
                            color: PandoraColors.ink,
                            borderRadius: BorderRadius.circular(8),
                            child: Padding(
                              padding: const EdgeInsets.all(8),
                              child: Text(
                                delta == null
                                    ? '当前目标不可用'
                                    : '${moving.startDate.addDays(delta).iso} 至 ${moving.endDate.addDays(delta).iso} · 松开后确认',
                                style: const TextStyle(color: Colors.white),
                                maxLines: 2,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// One month has only its real weeks; adjacent-month gaps have no hit target.
class DailyItemsMonthBlock extends ConsumerStatefulWidget {
  const DailyItemsMonthBlock({
    super.key,
    required this.month,
    required this.businessDate,
    required this.onDaySelected,
    this.showWeekdays = true,
    this.moving,
    this.onDragStart,
    this.onDragUpdate,
    this.onDragEnd,
    this.onDragCancel,
    this.onBarTap,
  });
  final CompanyDate month;
  final CompanyDate businessDate;
  final ValueChanged<CompanyDate> onDaySelected;
  final bool showWeekdays;
  final DailyItem? moving;
  final void Function(BarLayout bar, Offset point)? onDragStart;
  final ValueChanged<Offset>? onDragUpdate;
  final VoidCallback? onDragEnd;
  final VoidCallback? onDragCancel;
  final void Function(BarLayout bar, Offset point)? onBarTap;

  @override
  ConsumerState<DailyItemsMonthBlock> createState() =>
      _DailyItemsMonthBlockState();
}

class _DailyItemsMonthBlockState extends ConsumerState<DailyItemsMonthBlock> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _requestIfNeeded());
  }

  void _requestIfNeeded() {
    if (!mounted) return;
    if (ref.read(dailyItemsProvider).windowFor(widget.month) != null) return;
    unawaited(
      ref.read(dailyItemsProvider.notifier).ensureMonths([widget.month]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(dailyItemsProvider);
    final window = state.windowFor(widget.month);
    final layout = MonthLayoutCalculator.compute(
      month: widget.month,
      items: state.items.values,
      fixedWeeks: false,
    );
    final preview = MonthLayoutCalculator.compute(
      month: widget.month,
      items: [if (widget.moving != null) widget.moving!],
      fixedWeeks: false,
    );
    if (window == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _requestIfNeeded());
    }
    return SizedBox(
      height:
          CalendarMetrics.monthHeight(widget.month) +
          (widget.showWeekdays ? CalendarMetrics.weekdayRowHeight : 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: CalendarMetrics.monthHeaderHeight,
            child: Row(
              children: [
                Text(
                  '${widget.month.year}年${widget.month.month}月',
                  style: Theme.of(context).textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
                const Spacer(),
                if (window?.error != null)
                  TextButton.icon(
                    onPressed: () => ref
                        .read(dailyItemsProvider.notifier)
                        .retryMonth(widget.month),
                    icon: const Icon(Icons.refresh, size: 16),
                    label: const Text('加载失败，重试'),
                    style: TextButton.styleFrom(
                      foregroundColor: PandoraColors.overdue,
                    ),
                  )
                else if (window == null || window.loading)
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
              ],
            ),
          ),
          if (widget.showWeekdays) const _WeekdayHeader(),
          for (var i = 0; i < layout.weeks.length; i++)
            _WeekRow(
              week: layout.weeks[i],
              previewBars: preview.weeks[i].bars,
              businessDate: widget.businessDate,
              onDaySelected: widget.onDaySelected,
              movingId: widget.moving?.id,
              onDragStart: widget.onDragStart,
              onDragUpdate: widget.onDragUpdate,
              onDragEnd: widget.onDragEnd,
              onDragCancel: widget.onDragCancel,
              onBarTap: widget.onBarTap,
            ),
        ],
      ),
    );
  }
}

class _WeekdayHeader extends StatelessWidget {
  const _WeekdayHeader();
  @override
  Widget build(BuildContext context) => SizedBox(
    height: CalendarMetrics.weekdayRowHeight,
    child: Row(
      children: [
        for (final label in CompanyCalendarGrid.weekdayLabels)
          Expanded(
            child: Center(
              child: Text(
                label,
                style: Theme.of(context).textTheme.labelSmall
                    ?.copyWith(color: PandoraColors.muted),
              ),
            ),
          ),
      ],
    ),
  );
}

class _WeekRow extends StatelessWidget {
  const _WeekRow({
    required this.week,
    required this.businessDate,
    required this.onDaySelected,
    this.onDragStart,
    this.onDragUpdate,
    this.onDragEnd,
    this.onDragCancel,
    this.onBarTap,
    this.movingId,
    this.previewBars = const [],
  });
  final WeekLayout week;
  final CompanyDate businessDate;
  final ValueChanged<CompanyDate> onDaySelected;
  final void Function(BarLayout bar, Offset point)? onDragStart;
  final ValueChanged<Offset>? onDragUpdate;
  final VoidCallback? onDragEnd;
  final VoidCallback? onDragCancel;
  final void Function(BarLayout bar, Offset point)? onBarTap;
  final String? movingId;
  final List<BarLayout> previewBars;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: CalendarMetrics.weekHeight,
    child: LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth / 7;
        return Stack(
          children: [
            Row(
              children: [
                for (final day in week.days)
                  Expanded(
                    child: day.inMonth
                        ? Semantics(
                            button: true,
                            label:
                                '${day.date.iso}，${day.coveredItemIds.length}项，'
                                '${day.openCount}项未完成，${day.completedCount}项已完成',
                            child: InkWell(
                              key: ValueKey('daily-day-${day.date.iso}'),
                              onTap: () => onDaySelected(day.date),
                              child: Column(
                                children: [
                                  Container(
                                    height: CalendarMetrics.dateRowHeight,
                                    alignment: Alignment.topCenter,
                                    decoration: day.date == businessDate
                                        ? BoxDecoration(
                                            color: PandoraColors.petal,
                                            borderRadius: BorderRadius.circular(
                                              8,
                                            ),
                                          )
                                        : null,
                                    child: Text(
                                      '${day.date.day}',
                                      style: Theme.of(context)
                                          .textTheme
                                          .labelMedium,
                                    ),
                                  ),
                                  const SizedBox(
                                    height:
                                        CalendarMetrics.laneHeight *
                                        MonthLayout.maxLanes,
                                  ),
                                  if (day.overflowCount > 0)
                                    Text(
                                      '+${day.overflowCount}',
                                      key: ValueKey(
                                        'daily-overflow-${day.date.iso}',
                                      ),
                                      style: const TextStyle(
                                        fontSize: 11,
                                        height: 1.3,
                                        color: PandoraColors.muted,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          )
                        : const SizedBox.shrink(),
                  ),
              ],
            ),
            for (final bar in week.bars)
              Positioned(
                left: bar.startColumn * width + 1,
                top:
                    CalendarMetrics.dateRowHeight +
                    bar.lane * CalendarMetrics.laneHeight,
                width: (bar.endColumn - bar.startColumn + 1) * width - 2,
                height: CalendarMetrics.laneHeight - 2,
                child: Semantics(
                  label: '${bar.name}，${itemStateLabel(bar.state)}，点击查看对应日期清单',
                  button: true,
                  child: GestureDetector(
                    key: ValueKey(
                      'daily-bar-${bar.itemId}-${week.weekStart.iso}',
                    ),
                    behavior: HitTestBehavior.opaque,
                    onTapUp: (details) {
                      if (onBarTap != null) {
                        onBarTap!(bar, details.globalPosition);
                        return;
                      }
                      final column =
                          (bar.startColumn + details.localPosition.dx / width)
                              .floor()
                              .clamp(bar.startColumn, bar.endColumn);
                      onDaySelected(week.weekStart.addDays(column));
                    },
                    onLongPressStart: onDragStart == null
                        ? null
                        : (details) =>
                              onDragStart!(bar, details.globalPosition),
                    onLongPressMoveUpdate: (details) =>
                        onDragUpdate?.call(details.globalPosition),
                    onLongPressEnd: (_) => onDragEnd?.call(),
                    onLongPressCancel: onDragCancel,
                    child: Opacity(
                      opacity: bar.itemId == movingId ? 0.35 : 1,
                      child: _BarVisual(bar: bar, moving: false),
                    ),
                  ),
                ),
              ),
            for (final bar in previewBars)
              Positioned(
                left: bar.startColumn * width + 1,
                top: CalendarMetrics.dateRowHeight,
                width: (bar.endColumn - bar.startColumn + 1) * width - 2,
                height: CalendarMetrics.laneHeight - 2,
                child: IgnorePointer(child: _BarVisual(bar: bar, moving: true)),
              ),
          ],
        );
      },
    ),
  );
}

class _BarVisual extends StatelessWidget {
  const _BarVisual({required this.bar, required this.moving});
  final BarLayout bar;
  final bool moving;
  @override
  Widget build(BuildContext context) {
    final color = itemStateColor(bar.state);
    final radius = Radius.circular(5);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: itemStateBackground(bar.state),
        border: bar.continuesBefore
            ? null
            : Border(left: BorderSide(color: color, width: 3)),
        borderRadius: BorderRadius.horizontal(
          left: bar.continuesBefore ? Radius.zero : radius,
          right: bar.continuesAfter ? Radius.zero : radius,
        ),
        boxShadow: moving
            ? [const BoxShadow(color: Color(0x44000000), blurRadius: 6)]
            : null,
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 3),
        child: Row(
          children: [
            Text(switch (bar.state) {
              DailyItemVisualState.completed => '✓',
              DailyItemVisualState.overdue => '!',
              _ => '○',
            }, style: TextStyle(fontSize: 10, color: color)),
            const SizedBox(width: 2),
            Expanded(
              child: FadingNameText(
                bar.name.split('\n').first,
                maxLines: 1,
                semanticsLabel: bar.name.split('\n').first,
                style: TextStyle(
                  fontSize: 11,
                  color: color,
                  decoration: bar.state == DailyItemVisualState.completed
                      ? TextDecoration.lineThrough
                      : null,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
