import 'schedule_confirmation.dart';

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/company/company_date.dart';
import '../../../core/company/company_time.dart';
import '../../../core/preferences/app_preferences.dart';
import '../../../core/providers.dart';
import '../../../core/router/read_context.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/fading_name_text.dart';
import '../../../core/widgets/state_views.dart';
import '../../daily_items/domain/month_layout.dart';
import '../../holidays/domain/holiday_calendar.dart';
import '../../holidays/presentation/holiday_providers.dart';
import '../../tasks/domain/task_record.dart';
import '../../../core/router/navigation_targets.dart';
import '../data/schedule_api.dart';
import '../domain/calendar_drag.dart';
import '../domain/day_axis.dart';
import '../domain/task_calendar.dart';


const double _minWeekHeight = 72;
const double _maxWeekHeight = 220;

/// 周高决定轨道容量：更高的周行容纳更多任务条，`+N` 随之减少。
double _weekBarHeight(double weekHeight) =>
    (weekHeight * 0.15).clamp(14.0, 22.0);

double _weekLaneStep(double weekHeight) => _weekBarHeight(weekHeight) + 2;

int _weekLaneCount(double weekHeight) {
  final lanes =
      ((weekHeight - 36 - _weekBarHeight(weekHeight)) /
              _weekLaneStep(weekHeight))
          .floor();
  return lanes.clamp(0, 7) + 1;
}

class TaskCalendarPage extends ConsumerStatefulWidget {
  const TaskCalendarPage({
    super.key,
    this.assigneeId,
    this.personName,
    this.readContext = const NormalReadContext(),
  });

  final String? assigneeId;
  final String? personName;
  final ReadContext readContext;

  bool get readOnly => !readContext.businessWritesAllowed;

  @override
  ConsumerState<TaskCalendarPage> createState() => _TaskCalendarPageState();
}

class _TaskCalendarPageState extends ConsumerState<TaskCalendarPage>
    with WidgetsBindingObserver {
  final Map<String, List<TaskRecord>> _tasks = {};
  final Set<String> _loading = {};
  final Map<String, Object> _errors = {};
  final Map<int, HolidayYear> _holidays = {};
  final Set<int> _loadingHolidays = {};
  final Set<int> _holidayErrors = {};
  late CompanyDate _anchor;
  late List<CompanyDate> _months;
  late final int _epoch;
  bool _restoring = true;
  bool _changingWindow = false;
  double? _lastScale;
  final _viewportKey = GlobalKey();
  bool get _current => mounted && _epoch == ref.read(accountEpochProvider);
  double get _scale => MediaQuery.textScalerOf(context).scale(10) / 10;
  double get _weekExtent => _weekHeight * _scale;
  final _scroll = ScrollController();
  final _currentMonthKey = GlobalKey();
  AppPreferences? _preferences;
  Timer? _preferenceTimer;
  CompanyDate? _drawerDay;
  List<TaskRecord> _drawerTasks = const [];
  bool _dayViewMode = true;
  (CompanyDate, double)? _monthReturn;
  double _weekHeight = 86;
  final Map<int, Offset> _pointers = {};
  bool _pinching = false;
  double _pinchStartDistance = 0;
  double _pinchStartHeight = 86;
  (CompanyDate, double)? _pinchAnchor;
  DateTime? _suppressTapUntil;
  final Map<String, GlobalKey> _dayKeys = {};
  TaskCalendarSelection? _dragSelection;
  TaskRecord? _dragTask;
  CompanyDate? _dragTarget;
  CalendarDragPreview? _dragPreview;
  Offset? _dragLastGlobal;
  Timer? _dragTimer;
  OverlayEntry? _dragOverlay;
  _AxisDragData? _axisDrag;
  Offset? _axisDragStart;
  int _queryGeneration = 0;
  int _positionRestoreGeneration = 0;

  @override
  void initState() {
    super.initState();
    _epoch = ref.read(accountEpochProvider);
    _anchor = ref.read(businessDateProvider);
    _resetMonths(_anchor);
    WidgetsBinding.instance.addObserver(this);
    _scroll.addListener(_loadVisibleMonths);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_current) unawaited(_restorePreferences());
    });
  }

  void _resetMonths(CompanyDate date) {
    _months = CompanyCalendarGrid.continuousMonths(
      date,
      monthsBefore: 1,
      monthsAfter: 1,
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final scale = _scale;
    final previous = _lastScale;
    _lastScale = scale;
    if (previous != null && previous != scale) {
      final position = _position();
      if (position != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_current) unawaited(_restorePosition(position.$1, position.$2));
        });
      }
    }
  }

  @override
  void didUpdateWidget(covariant TaskCalendarPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.assigneeId == widget.assigneeId) return;
    _saveCurrentPosition();
    _preferenceTimer?.cancel();
    _preferences = null;
    _queryGeneration += 1;
    _positionRestoreGeneration += 1;
    _changingWindow = false;
    _tasks.clear();
    _loading.clear();
    _errors.clear();
    _dayKeys.clear();
    _drawerDay = null;
    _drawerTasks = const [];
    _monthReturn = null;
    _pointers.clear();
    _pinching = false;
    _pinchAnchor = null;
    _anchor = ref.read(businessDateProvider);
    _resetMonths(_anchor);
    _restoring = true;
    _cancelActiveDrag();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_current) unawaited(_restorePreferences());
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _saveCurrentPosition();
    if (_preferences != null) unawaited(_saveWeekHeight());
    _preferenceTimer?.cancel();
    _dragTimer?.cancel();
    _dragOverlay?.remove();
    _scroll
      ..removeListener(_loadVisibleMonths)
      ..dispose();
    super.dispose();
  }

  double get _monthExtent => 6 * _weekExtent + 100 * _scale;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) return;
    if (_dragSelection == null && _axisDrag == null) return;
    _cancelActiveDrag();
  }

  void _cancelActiveDrag() {
    _dragTimer?.cancel();
    _dragOverlay?.remove();
    _dragOverlay = null;
    _dragSelection = null;
    _dragTask = null;
    _dragTarget = null;
    _dragPreview = null;
    _dragLastGlobal = null;
    _axisDrag = null;
    _axisDragStart = null;
    if (mounted) setState(() {});
  }

  Future<void> _restorePreferences() async {
    final generation = _queryGeneration;
    final prefs = await AppPreferences.load(
      ref.read(currentUserProvider)?.id,
      calendarPerson: widget.assigneeId,
    );
    if (!_current || generation != _queryGeneration) return;
    final CompanyDate date =
        CompanyDate.tryParse(prefs.getString('calendar.lastDate') ?? '') ??
        ref.read<CompanyDate>(businessDateProvider);
    final offset =
        double.tryParse(prefs.getString('calendar.lastOffset') ?? '') ?? 0;
    setState(() {
      _preferences = prefs;
      _anchor = date;
      final storedHeight = double.tryParse(
        prefs.getString('calendar.weekHeight') ?? '',
      );
      _weekHeight =
          (storedHeight ??
                  (prefs.getString('calendar.density') == 'comfortable'
                      ? 112.0
                      : 86.0))
              .clamp(_minWeekHeight, _maxWeekHeight);
      _resetMonths(date);
    });
    await _restorePosition(date, offset);
    if (!_current || generation != _queryGeneration) return;
    _restoring = false;
    _loadVisibleMonths();
    await _loadAround(date);
  }

  (CompanyDate, double)? _position() {
    final viewport = _viewportKey.currentContext?.findRenderObject();
    if (viewport is! RenderBox || !viewport.attached) return null;
    final top = viewport.localToGlobal(Offset.zero).dy;
    (CompanyDate, double)? best;
    for (final entry in _dayKeys.entries) {
      final box = entry.value.currentContext?.findRenderObject();
      if (box is! RenderBox || !box.attached) continue;
      final y = box.localToGlobal(Offset.zero).dy - top;
      if (y + box.size.height <= 0 || y >= viewport.size.height) continue;
      final date = CompanyDate.tryParse(entry.key)!;
      if (best == null ||
          y < best.$2 - .1 ||
          ((y - best.$2).abs() < .1 && date.isBefore(best.$1))) {
        best = (date, y);
      }
    }
    return best;
  }

  Future<void> _restorePosition(CompanyDate date, double offset) async {
    if (!_current || !_scroll.hasClients) return;
    final generation = _queryGeneration;
    final restoreGeneration = ++_positionRestoreGeneration;
    _changingWindow = true;
    try {
      final index = _months.indexWhere((month) => _key(month) == _key(date));
      if (index < 0) return;
      _scroll.jumpTo(
        (index * _monthExtent).clamp(0, _scroll.position.maxScrollExtent),
      );
      await WidgetsBinding.instance.endOfFrame;
      if (!_current ||
          generation != _queryGeneration ||
          restoreGeneration != _positionRestoreGeneration ||
          !_scroll.hasClients) {
        return;
      }
      final viewport = _viewportKey.currentContext?.findRenderObject();
      final day = _dayKeys[date.iso]?.currentContext?.findRenderObject();
      if (viewport is RenderBox && day is RenderBox) {
        final y =
            day.localToGlobal(Offset.zero).dy -
            viewport.localToGlobal(Offset.zero).dy;
        _scroll.jumpTo(
          (_scroll.offset + y - offset).clamp(
            0,
            _scroll.position.maxScrollExtent,
          ),
        );
      }
    } finally {
      if (_current && restoreGeneration == _positionRestoreGeneration) {
        _changingWindow = false;
        if (!_restoring) _loadVisibleMonths();
      }
    }
  }

  void _saveCurrentPosition() {
    final position = _position();
    final prefs = _preferences;
    if (position == null || prefs == null) return;
    unawaited(prefs.setString('calendar.lastDate', position.$1.iso));
    unawaited(prefs.setString('calendar.lastOffset', position.$2.toString()));
  }

  void _loadVisibleMonths() {
    if (!_current || !_scroll.hasClients || _restoring || _changingWindow) {
      return;
    }
    _preferenceTimer?.cancel();
    _preferenceTimer = Timer(
      const Duration(milliseconds: 600),
      _saveCurrentPosition,
    );
    final first = ((_scroll.offset - 8) / _monthExtent).floor().clamp(
      0,
      _months.length - 1,
    );
    final last =
        ((_scroll.offset + _scroll.position.viewportDimension) / _monthExtent)
            .ceil()
            .clamp(first + 1, _months.length);
    for (var index = first; index < last; index++) {
      final month = _months[index];
      if (!_tasks.containsKey(_key(month)) &&
          !_loading.contains(_key(month)) &&
          !_errors.containsKey(_key(month))) {
        unawaited(_loadMonth(month));
      }
    }
    var shift = 0.0;
    final nearStart = _scroll.offset < _monthExtent / 2;
    final nearEnd =
        _scroll.position.maxScrollExtent - _scroll.offset < _monthExtent / 2;
    if (!nearStart && !nearEnd) return;
    _changingWindow = true;
    final oldOffset = _scroll.offset;
    setState(() {
      if (nearStart) {
        _months.insert(0, _months.first.addMonths(-1));
        shift += _monthExtent;
      } else {
        _months.add(_months.last.addMonths(1));
      }
      if (_months.length > 12 && _dragSelection == null && _axisDrag == null) {
        final removed = nearStart ? _months.removeLast() : _months.removeAt(0);
        if (!nearStart) shift -= _monthExtent;
        _tasks.remove(_key(removed));
        _errors.remove(_key(removed));
        _dayKeys.removeWhere((key, _) => key.startsWith(_key(removed)));
      }
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_current || !_scroll.hasClients) return;
      _scroll.jumpTo(
        (oldOffset + shift).clamp(0, _scroll.position.maxScrollExtent),
      );
      _changingWindow = false;
      _loadVisibleMonths();
    });
  }

  void _scrollToCurrentMonth() {
    if (!_current) return;
    final today = ref.read(businessDateProvider);
    setState(() {
      _anchor = today;
      _resetMonths(today);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_current) unawaited(_restorePosition(today, 0));
    });
  }

  @override
  Widget build(BuildContext context) {
    final months = _months;
    final selectedDay = _drawerDay;
    return Scaffold(
      appBar: AppBar(
        title: widget.personName == null
            ? const PandoraPageMark(pageName: '日程')
            : Text('${widget.personName}的日程'),
        actions: [
          IconButton(
            tooltip: selectedDay == null ? '日视图' : '返回月历',
            onPressed: selectedDay == null
                ? () => unawaited(
                    _openDay(_visibleAnchorDate(), dayViewMode: true),
                  )
                : _closeDay,
            icon: Icon(
              selectedDay == null
                  ? Icons.view_day_outlined
                  : Icons.calendar_month,
            ),
          ),
          TextButton(
            onPressed: selectedDay == null
                ? _scrollToCurrentMonth
                : () => unawaited(
                    _openDay(
                      ref.read(businessDateProvider),
                      dayViewMode: _dayViewMode,
                    ),
                  ),
            child: const Text('今天'),
          ),
          if (!widget.readOnly)
            IconButton(
              tooltip: '任务表单',
              onPressed: () => _openAndRefresh('/tasks/table'),
              icon: const Icon(Icons.table_chart_outlined),
            ),
          if (!widget.readOnly)
            IconButton(
              tooltip: '我的申请与审核',
              onPressed: () => _openAndRefresh('/approvals'),
              icon: const Icon(Icons.assignment_outlined),
            ),
        ],
      ),
      floatingActionButton: widget.readOnly
          ? null
          : FloatingActionButton(
              tooltip: '新建任务',
              onPressed: () => _openAndRefresh('/tasks/new'),
              child: const Icon(Icons.add),
            ),
      body: selectedDay != null
          ? _DayPanel(
              day: selectedDay,
              holiday: _holidayOn(selectedDay),
              tasks: _drawerTasks,
              dayViewMode: _dayViewMode,
              onToggleView: () => setState(() => _dayViewMode = !_dayViewMode),
              onSelectDay: (day) => unawaited(_openDay(day, dayViewMode: true)),
              readOnly: widget.readOnly,
              onOpen: _openTask,
              onPin: _togglePin,
              onClose: _closeDay,
              onAxisDragStarted: _startAxisDrag,
              onAxisDragUpdate: _updateAxisDrag,
              onAxisDragEnd: _endAxisDrag,
              onAccessibleAdjust: _accessibleAxisAdjust,
            )
          : SafeArea(
              child: Listener(
                onPointerDown: _onMonthPointerDown,
                onPointerMove: _onMonthPointerMove,
                onPointerUp: _onMonthPointerUp,
                onPointerCancel: _onMonthPointerCancel,
                child: RefreshIndicator(
                  onRefresh: _refreshCalendar,
                  child: AbsorbPointer(
                    absorbing: _pinching,
                    child: ListView.builder(
                      key: _viewportKey,
                      controller: _scroll,
                      physics: _pinching
                          ? const NeverScrollableScrollPhysics()
                          : null,
                      itemExtent: _monthExtent,
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 96),
                      itemCount: months.length,
                  itemBuilder: (context, index) {
                    final month = months[index];
                    final current =
                        month.year == _anchor.year &&
                        month.month == _anchor.month;
                    return KeyedSubtree(
                      key: current ? _currentMonthKey : null,
                      child: _MonthBlock(
                        month: month,
                        tasks: _tasks[_key(month)] ?? const [],
                        businessDate: ref.watch(businessDateProvider),
                        loading: _loading.contains(_key(month)),
                        error: _errors[_key(month)],
                        onRetry: () => _loadMonth(month),
                        onDay: (day) => _openDay(day),
                        holidays: _holidays,
                        holidayUnavailable: _holidayErrors.contains(month.year),
                        onPin: _togglePin,
                        onOpenTask: _openTask,
                        readOnly: widget.readOnly,
                        weekHeight: _weekHeight,
                        dayKey: _dayKey,
                        onDragStarted: _startMonthDrag,
                        onDragUpdate: _updateMonthDrag,
                        onDragEnd: _endMonthDrag,
                        onAccessibleAdjust: _accessibleMonthAdjust,
                      ),
                    );
                  },
                    ),
                  ),
                ),
              ),
            ),
    );
  }

  static String _key(CompanyDate month) =>
      '${month.year.toString().padLeft(4, '0')}-${month.month.toString().padLeft(2, '0')}';

  Future<void> _refreshCalendar() async {
    final years = {_anchor.year, ..._holidays.keys, ..._holidayErrors};
    for (final year in years) {
      unawaited(_loadHolidays(year, refresh: true));
    }
    await _loadAround(_anchor, force: true);
  }

  Future<void> _loadHolidays(int year, {bool refresh = false}) async {
    if ((!refresh &&
            (_holidays.containsKey(year) || _holidayErrors.contains(year))) ||
        !_loadingHolidays.add(year)) {
      return;
    }
    try {
      final holidays = await ref
          .read(holidayRepositoryProvider)
          .load(year, refresh: refresh);
      if (!mounted || !_current) return;
      setState(() {
        _holidays[year] = holidays;
        _holidayErrors.remove(year);
      });
    } catch (_) {
      if (mounted) setState(() => _holidayErrors.add(year));
    } finally {
      _loadingHolidays.remove(year);
    }
  }

  Future<void> _loadAround(CompanyDate anchor, {bool force = false}) async {
    if (!_current) return;
    if (force) {
      _queryGeneration++;
      _loading.clear();
      _errors.clear();
    }
    final generation = _queryGeneration;
    final months = force
        ? List<CompanyDate>.from(_months)
        : CompanyCalendarGrid.continuousMonths(
            anchor,
            monthsBefore: 1,
            monthsAfter: 1,
          );
    for (final month in months) {
      if (!_current || generation != _queryGeneration) return;
      if (!force &&
          (_tasks.containsKey(_key(month)) || _loading.contains(_key(month)))) {
        continue;
      }
      await _loadMonth(month);
    }
  }

  Future<void> _loadMonth(CompanyDate month) async {
    final key = _key(month);
    if (!_current || _loading.contains(key)) return;
    final generation = _queryGeneration;
    final assigneeId =
        widget.assigneeId ?? ref.read(currentUserProvider)?.id ?? '';
    final from = month.firstDayOfMonth.addDays(-7);
    final to = month.lastDayOfMonth.addDays(7);
    unawaited(_loadHolidays(from.year));
    if (to.year != from.year) unawaited(_loadHolidays(to.year));
    setState(() {
      _loading.add(key);
      _errors.remove(key);
    });
    try {
      final rows = await ref
          .read(scheduleApiProvider)
          .listCalendarTasks(
            assigneeId: assigneeId,
            from: from.iso,
            to: to.iso,
          );
      if (!_current ||
          generation != _queryGeneration ||
          assigneeId !=
              (widget.assigneeId ?? ref.read(currentUserProvider)?.id ?? '')) {
        return;
      }
      if (!_months.any((month) => _key(month) == key)) {
        _loading.remove(key);
        return;
      }
      setState(() {
        _tasks[key] = rows;
        _loading.remove(key);
      });
    } catch (error) {
      if (!_current || generation != _queryGeneration) return;
      setState(() {
        _errors[key] = error;
        _loading.remove(key);
      });
    }
  }

  GlobalKey _dayKey(CompanyDate day) =>
      _dayKeys.putIfAbsent(day.iso, () => GlobalKey());

  CompanyDate? _dayAtGlobal(Offset? global) {
    if (global == null) return null;
    for (final entry in _dayKeys.entries) {
      final context = entry.value.currentContext;
      final box = context?.findRenderObject();
      if (box is! RenderBox || !box.attached) continue;
      final local = box.globalToLocal(global);
      if (local.dx >= 0 &&
          local.dy >= 0 &&
          local.dx <= box.size.width &&
          local.dy <= box.size.height) {
        return CompanyDate.tryParse(entry.key);
      }
    }
    return null;
  }

  TaskRecord? _taskById(String id) {
    for (final rows in _tasks.values) {
      for (final task in rows) {
        if (task.id == id) return task;
      }
    }
    return null;
  }

  CalendarDragPreview? _monthPreview(
    TaskRecord task,
    CalendarDragMode mode,
    CompanyDate target,
  ) {
    final selection = _dragSelection;
    if (selection == null) return null;
    return switch (mode) {
      CalendarDragMode.move => CalendarDragCalculator.monthMove(
        task,
        selection.grabDay,
        target,
      ),
      CalendarDragMode.start => CalendarDragCalculator.monthResizeStart(
        task,
        selection.grabDay,
        target,
      ),
      CalendarDragMode.end => CalendarDragCalculator.monthResizeEnd(
        task,
        selection.grabDay,
        target,
      ),
    };
  }

  void _startMonthDrag(TaskCalendarSelection selection) {
    if (_gestureSuppressed) return;
    final task = _taskById(selection.taskId);
    if (task == null || !CalendarDragCalculator.canReschedule(task)) return;
    _dragTimer?.cancel();
    _dragSelection = selection;
    _dragTask = task;
    _dragTarget = selection.grabDay;
    _dragLastGlobal = selection.pointer;
    _dragPreview = null;
    _showDragOverlay();
    _dragTimer = Timer.periodic(
      const Duration(milliseconds: 90),
      (_) => _tickAutoScroll(),
    );
  }

  void _updateMonthDrag(TaskCalendarSelection selection, Offset global) {
    if (_dragSelection?.taskId != selection.taskId) return;
    _dragLastGlobal = global;
    _updateMonthTarget(global);
  }

  void _updateMonthTarget(Offset? global) {
    final task = _dragTask;
    final selection = _dragSelection;
    if (task == null || selection == null) return;
    final target = _dayAtGlobal(global);
    if (target == null) {
      if (mounted) {
        setState(() {
          _dragTarget = null;
          _dragPreview = null;
        });
      }
      _dragOverlay?.markNeedsBuild();
      return;
    }
    final preview = _monthPreview(task, selection.mode, target);
    if (mounted) {
      setState(() {
        _dragTarget = target;
        _dragPreview = preview;
      });
    }
    _dragOverlay?.markNeedsBuild();
  }

  void _tickAutoScroll() {
    if (_dragLastGlobal == null || !_scroll.hasClients) return;
    final screenHeight = MediaQuery.sizeOf(context).height;
    var delta = 0.0;
    if (_dragLastGlobal!.dy < 180) delta = -28;
    if (_dragLastGlobal!.dy > screenHeight - 220) delta = 28;
    if (delta == 0) return;
    final max = _scroll.position.maxScrollExtent;
    final min = _scroll.position.minScrollExtent;
    final next = (_scroll.offset + delta).clamp(min, max);
    if (next == _scroll.offset) return;
    _scroll.jumpTo(next);
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _updateMonthTarget(_dragLastGlobal),
    );
  }

  void _endMonthDrag(TaskCalendarSelection selection) {
    if (_dragSelection?.taskId != selection.taskId) return;
    _dragTimer?.cancel();
    _updateMonthTarget(_dragLastGlobal);
    final task = _dragTask;
    final target = _dayAtGlobal(_dragLastGlobal);
    final preview = task == null || target == null
        ? null
        : _monthPreview(task, selection.mode, target);
    _dragOverlay?.remove();
    _dragOverlay = null;
    final pendingTask = task;
    final pendingPreview = preview;
    if (mounted) {
      setState(() {
        _dragSelection = null;
        _dragTask = null;
        _dragTarget = null;
        _dragPreview = null;
        _dragLastGlobal = null;
      });
    }
    if (pendingTask != null && pendingPreview != null) {
      unawaited(_confirmAndSubmit(pendingTask, pendingPreview));
    }
  }

  void _showDragOverlay() {
    _dragOverlay?.remove();
    final overlay = Overlay.of(context);
    _dragOverlay = OverlayEntry(
      builder: (context) {
        final task = _dragTask;
        final target = _dragTarget;
        final preview = _dragPreview;
        if (task == null) return const SizedBox.shrink();
        final zone = CompanyTimeZone.fallback;
        return Positioned(
          left: 12,
          right: 12,
          bottom: 24,
          child: IgnorePointer(
            child: Material(
              elevation: 8,
              borderRadius: BorderRadius.circular(12),
              color: Colors.white,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      task.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '原排期：${_scheduleLabel(task, zone)}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: PandoraColors.muted,
                      ),
                    ),
                    Text(
                      target == null
                          ? '目标日期：无效落点，取消操作'
                          : preview == null
                          ? '目标日期：${target.iso}，调整无效'
                          : '新排期：${preview.label(zone)}',
                      style: TextStyle(
                        fontSize: 12,
                        color: preview == null
                            ? PandoraColors.overdue
                            : PandoraColors.brand,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
    overlay.insert(_dragOverlay!);
  }

  void _startAxisDrag(_AxisDragData data, Offset global) {
    if (_gestureSuppressed) return;
    if (!data.entry.canDrag) return;
    _dragTimer?.cancel();
    _dragSelection = null;
    _axisDrag = data;
    _axisDragStart = global;
    _dragTask = data.entry.task;
    _dragTarget = _drawerDay;
    _dragPreview = null;
    _showDragOverlay();
  }

  void _updateAxisDrag(Offset global) {
    final data = _axisDrag;
    final start = _axisDragStart;
    final day = _drawerDay;
    if (data == null || start == null || day == null) return;
    final pixels = data.vertical ? global.dy - start.dy : global.dx - start.dx;
    final hours = (pixels / data.pixelsPerHour).round();
    final preview = switch (data.mode) {
      CalendarDragMode.move => CalendarDragCalculator.dayMove(
        data.entry.task,
        day,
        hours,
      ),
      CalendarDragMode.start => CalendarDragCalculator.dayResizeStart(
        data.entry.task,
        day,
        hours,
      ),
      CalendarDragMode.end => CalendarDragCalculator.dayResizeEnd(
        data.entry.task,
        day,
        hours,
      ),
    };
    _dragPreview = preview;
    _dragOverlay?.markNeedsBuild();
  }

  void _endAxisDrag(_AxisDragData data) {
    if (_axisDrag != data) return;
    final task = data.entry.task;
    final preview = _dragPreview;
    _dragOverlay?.remove();
    _dragOverlay = null;
    _axisDrag = null;
    _axisDragStart = null;
    _dragTask = null;
    _dragPreview = null;
    _dragTarget = null;
    if (preview != null) unawaited(_confirmAndSubmit(task, preview));
  }

  void _accessibleAxisAdjust(
    DayAxisEntry entry,
    CalendarDragMode mode,
    int hours,
  ) {
    final day = _drawerDay;
    if (day == null) return;
    final preview = switch (mode) {
      CalendarDragMode.move => CalendarDragCalculator.dayMove(
        entry.task,
        day,
        hours,
      ),
      CalendarDragMode.start => CalendarDragCalculator.dayResizeStart(
        entry.task,
        day,
        hours,
      ),
      CalendarDragMode.end => CalendarDragCalculator.dayResizeEnd(
        entry.task,
        day,
        hours,
      ),
    };
    if (preview != null) unawaited(_confirmAndSubmit(entry.task, preview));
  }

  Future<void> _confirmAndSubmit(
    TaskRecord task,
    CalendarDragPreview preview,
  ) async {
    if (widget.readOnly) return;
    final epoch = ref.read(accountEpochProvider);
    final message = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (_) => ScheduleConfirmation(task: task, preview: preview),
    );
    if (!mounted ||
        epoch != ref.read(accountEpochProvider) ||
        message == null) {
      return;
    }
    await _loadAround(_anchor, force: true);
    if (!mounted || epoch != ref.read(accountEpochProvider)) return;
    _refreshDrawer();
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  void _accessibleMonthAdjust(
    TaskRecord task,
    CalendarDragMode mode,
    int days,
  ) {
    final zone = CompanyTimeZone.fallback;
    final startDay =
        task.allDayStart ??
        (task.startAt == null ? null : zone.dateOf(task.startAt!));
    final endDay =
        task.allDayEnd ??
        (task.dueAt == null ? null : zone.dateOf(task.dueAt!));
    final grab = switch (mode) {
      CalendarDragMode.move => startDay,
      CalendarDragMode.start => startDay,
      CalendarDragMode.end => endDay,
    };
    if (grab == null) return;
    final target = grab.addDays(days);
    final preview = switch (mode) {
      CalendarDragMode.move => CalendarDragCalculator.monthMove(
        task,
        grab,
        target,
      ),
      CalendarDragMode.start => CalendarDragCalculator.monthResizeStart(
        task,
        grab,
        target,
      ),
      CalendarDragMode.end => CalendarDragCalculator.monthResizeEnd(
        task,
        grab,
        target,
      ),
    };
    if (preview != null) unawaited(_confirmAndSubmit(task, preview));
  }

  bool get _gestureSuppressed =>
      _pinching ||
      (_suppressTapUntil != null && _suppressTapUntil!.isAfter(DateTime.now()));

  void _onMonthPointerDown(PointerDownEvent event) {
    _pointers[event.pointer] = event.position;
    if (_pointers.length >= 2 && !_pinching) _beginPinch();
  }

  void _onMonthPointerMove(PointerMoveEvent event) {
    if (!_pointers.containsKey(event.pointer)) return;
    _pointers[event.pointer] = event.position;
    if (!_pinching || _pointers.length < 2) return;
    final distance = _pointerDistance;
    if (_pinchStartDistance <= 0 || distance <= 0) return;
    final next = (_pinchStartHeight * distance / _pinchStartDistance).clamp(
      _minWeekHeight,
      _maxWeekHeight,
    );
    if ((next - _weekHeight).abs() < .5 || !_current) return;
    final oldExtent = _monthExtent;
    final anchor = _pinchAnchor;
    final oldOffset = _scroll.hasClients ? _scroll.offset : 0.0;
    final index = anchor == null
        ? -1
        : _months.indexWhere((month) => _key(month) == _key(anchor.$1));
    final within = index >= 0 ? oldOffset - index * oldExtent : 0.0;
    setState(() => _weekHeight = next);
    final newExtent = _monthExtent;
    final target = index >= 0
        ? index * newExtent + within * (newExtent / oldExtent)
        : oldOffset;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_current || !_pinching || !_scroll.hasClients) return;
      _scroll.jumpTo(target.clamp(0, _scroll.position.maxScrollExtent));
    });
  }

  double get _pointerDistance {
    if (_pointers.length < 2) return 0;
    final values = _pointers.values.take(2).toList();
    final vertical = (values[0].dy - values[1].dy).abs();
    return vertical >= 12 ? vertical : (values[0] - values[1]).distance;
  }

  void _beginPinch() {
    final distance = _pointerDistance;
    if (distance <= 0) return;
    _pinchStartDistance = distance;
    _pinchStartHeight = _weekHeight;
    _pinchAnchor = _position();
    _cancelActiveDrag();
    setState(() => _pinching = true);
  }

  void _onMonthPointerUp(PointerUpEvent event) {
    _pointers.remove(event.pointer);
    if (_pinching && _pointers.length < 2) _endPinch();
  }

  void _onMonthPointerCancel(PointerCancelEvent event) {
    _pointers.remove(event.pointer);
    if (_pinching && _pointers.length < 2) _endPinch();
  }

  void _endPinch() {
    if (!_pinching) return;
    final anchor = _pinchAnchor;
    _pinching = false;
    _pinchAnchor = null;
    _suppressTapUntil = DateTime.now().add(const Duration(milliseconds: 250));
    setState(() {});
    unawaited(_saveWeekHeight());
    if (anchor == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_current) unawaited(_restorePosition(anchor.$1, anchor.$2));
    });
  }

  Future<void> _saveWeekHeight() async {
    final prefs = _preferences;
    if (prefs == null) return;
    await prefs.setString(
      'calendar.weekHeight',
      _weekHeight.toStringAsFixed(1),
    );
    await prefs.setString(
      'calendar.density',
      _weekHeight >= 100 ? 'comfortable' : 'compact',
    );
  }

  CompanyDate _visibleAnchorDate() {
    final position = _position();
    return position?.$1 ?? ref.read(businessDateProvider);
  }

  /// 与月历一致：只在既有年度接口确有该日记录时返回标签，不推断周末调休。
  HolidayDay? _holidayOn(CompanyDate day) {
    for (final year in [day.year - 1, day.year, day.year + 1]) {
      final value = _holidays[year]?.byDate[day.iso];
      if (value != null) return value;
    }
    return null;
  }

  Future<void> _openDay(
    CompanyDate day, {
    bool dayViewMode = false,
  }) async {
    if (_gestureSuppressed) return;
    // 访问某天不应改写月历滚动位置；返回月历时恢复到进入前的可见锚点。
    if (_drawerDay == null) _monthReturn = _position();
    unawaited(_loadHolidays(day.year));
    final all = <String, TaskRecord>{};
    for (final rows in _tasks.values) {
      for (final task in rows) {
        all[task.id] = task;
      }
    }
    final zone = CompanyTimeZone.fallback;
    final tasks =
        all.values
            .where(
              (task) => CalendarTask(
                task: task,
                pendingProjection: task.pending && task.pendingSchedule != null,
              ).covers(day),
            )
            .toList()
          ..sort((a, b) {
            final ap = a.pinned ? 0 : 1;
            final bp = b.pinned ? 0 : 1;
            if (ap != bp) return ap.compareTo(bp);
            final as = a.startAt ?? zone.dayStart(day);
            final bs = b.startAt ?? zone.dayStart(day);
            final c = as.compareTo(bs);
            return c != 0 ? c : a.id.compareTo(b.id);
          });
    setState(() {
      _drawerDay = day;
      _drawerTasks = tasks;
      _dayViewMode = dayViewMode;
    });
  }

  void _closeDay() {
    if (_drawerDay == null) return;
    final restore = _monthReturn;
    setState(() {
      _drawerDay = null;
      _drawerTasks = const [];
      _monthReturn = null;
    });
    if (restore == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_current) unawaited(_restorePosition(restore.$1, restore.$2));
    });
  }

  Future<void> _openAndRefresh(String location) async {
    await context.push(location);
    if (mounted) await _loadAround(_anchor, force: true);
  }

  void _openTask(String id) {
    if (_gestureSuppressed) return;
    unawaited(_openTaskAndRefresh(id));
  }

  Future<void> _openTaskAndRefresh(String id) async {
    await context.push(NavigationTargets.task(widget.readContext, id));
    if (mounted) await _loadAround(_anchor, force: true);
  }

  void _refreshDrawer() {
    final day = _drawerDay;
    if (day == null) return;
    final all = <String, TaskRecord>{};
    for (final rows in _tasks.values) {
      for (final task in rows) {
        all[task.id] = task;
      }
    }
    final zone = CompanyTimeZone.fallback;
    final tasks =
        all.values
            .where(
              (task) => CalendarTask(
                task: task,
                pendingProjection: task.pending && task.pendingSchedule != null,
              ).covers(day),
            )
            .toList()
          ..sort((a, b) {
            final ap = a.pinned ? 0 : 1;
            final bp = b.pinned ? 0 : 1;
            if (ap != bp) return ap.compareTo(bp);
            final as = a.startAt ?? zone.dayStart(day);
            final bs = b.startAt ?? zone.dayStart(day);
            final c = as.compareTo(bs);
            return c != 0 ? c : a.id.compareTo(b.id);
          });
    if (mounted) setState(() => _drawerTasks = tasks);
  }

  Future<void> _togglePin(TaskRecord task) async {
    if (!_current || widget.readOnly || !task.canPin) return;
    final pinned = !task.pinned;
    final key = ref.read(operationKeysProvider);
    final idempotency = key.keyFor(
      scope: 'calendar-pin:${task.id}',
      method: pinned ? 'PUT' : 'DELETE',
      path: '/tasks/${task.id}/pin',
      body: const {},
    );
    try {
      await ref
          .read(scheduleApiProvider)
          .setCalendarPin(
            taskId: task.id,
            pinned: pinned,
            idempotencyKey: idempotency,
          );
      if (!_current) return;
      key.complete('calendar-pin:${task.id}');
      await _loadAround(_anchor, force: true);
      _refreshDrawer();
    } catch (error) {
      if (!mounted || !_current) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }
}

String _scheduleLabel(TaskRecord task, CompanyTimeZone zone) {
  if (task.allDay) {
    final start = task.allDayStart?.iso ?? '全天';
    final due = task.allDayEnd?.iso;
    return due == null || due == start ? '$start（全天）' : '$start 至 $due（全天）';
  }
  if (task.startAt == null || task.dueAt == null) return '排期未设置';
  return '${zone.formatDateTime(task.startAt!)} 至 ${zone.formatDateTime(task.dueAt!)}';
}

class _MonthBlock extends StatelessWidget {
  const _MonthBlock({
    required this.month,
    required this.tasks,
    required this.businessDate,
    required this.loading,
    required this.error,
    required this.onRetry,
    required this.holidays,
    required this.holidayUnavailable,
    required this.onDay,
    required this.onPin,
    required this.onOpenTask,
    required this.weekHeight,
    required this.dayKey,
    required this.onDragStarted,
    required this.onDragUpdate,
    required this.onDragEnd,
    required this.onAccessibleAdjust,
    this.readOnly = false,
  });

  final CompanyDate month;
  final List<TaskRecord> tasks;
  final CompanyDate businessDate;
  final bool loading;
  final Object? error;
  final VoidCallback onRetry;
  final Map<int, HolidayYear> holidays;
  final bool holidayUnavailable;
  final ValueChanged<CompanyDate> onDay;
  final Future<void> Function(TaskRecord) onPin;
  final ValueChanged<String> onOpenTask;
  final double weekHeight;
  final GlobalKey Function(CompanyDate) dayKey;
  final void Function(TaskCalendarSelection) onDragStarted;
  final void Function(TaskCalendarSelection, Offset) onDragUpdate;
  final void Function(TaskCalendarSelection) onDragEnd;
  final void Function(TaskRecord, CalendarDragMode, int) onAccessibleAdjust;
  final bool readOnly;

  double _scale(BuildContext context) =>
      MediaQuery.textScalerOf(context).scale(10) / 10;

  @override
  Widget build(BuildContext context) {
    final scale = _scale(context);
    final laneStep = _weekLaneStep(weekHeight) * scale;
    final barHeight = _weekBarHeight(weekHeight) * scale;
    final projected = tasks
        .map(
          (task) => CalendarTask(
            task: task,
            pendingProjection: task.pending && task.pendingSchedule != null,
          ),
        )
        .toList();
    final leadingIds = {
      for (final task in tasks)
        if (task.pinned) task.id,
    };
    final layout = MonthLayoutCalculator.compute(
      month: month,
      items: projected.map(pseudoItem).toList(),
      leadingIds: leadingIds,
      maxLanes: _weekLaneCount(weekHeight),
    );
    final holidaysByDate = {
      for (final year in [month.year - 1, month.year, month.year + 1])
        ...?holidays[year]?.byDate,
    };
    final holidayStatus = switch (holidays[month.year]?.status) {
      HolidayCacheStatus.stale => '节假日标签为最近有效缓存',
      HolidayCacheStatus.missing => '本年官方节假日尚未公布',
      _ => holidayUnavailable ? '节假日暂不可用' : null,
    };
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 8, 8, 10),
        child: Column(
          children: [
            Row(
              children: [
                Text(
                  '${month.year}年${month.month}月',
                  style: Theme.of(context).textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
                Expanded(
                  child: holidayStatus == null
                      ? const SizedBox.shrink()
                      : Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 6),
                          child: Text(
                            holidayStatus,
                            textAlign: TextAlign.end,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 10,
                              color: PandoraColors.muted,
                            ),
                          ),
                        ),
                ),
                if (loading)
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                if (error != null)
                  TextButton(onPressed: onRetry, child: const Text('重试')),
              ],
            ),
            Row(
              children: [
                for (final day in CompanyCalendarGrid.weekdayLabels)
                  Expanded(
                    child: Center(
                      child: Text(
                        day,
                        style: Theme.of(context).textTheme.labelSmall
                            ?.copyWith(color: PandoraColors.muted),
                      ),
                    ),
                  ),
              ],
            ),
            for (final week in layout.weeks)
              Expanded(
                child: ClipRect(
                  child: LayoutBuilder(
                  builder: (context, constraints) {
                    final cellWidth = constraints.maxWidth / 7;
                    return Stack(
                      children: [
                        Row(
                          children: [
                            for (var i = 0; i < 7; i++)
                              Expanded(
                                child: Builder(
                                  builder: (context) {
                                    final day = week.days[i];
                                    final isToday = day.date == businessDate;
                                    final holiday =
                                        holidaysByDate[day.date.iso];
                                    return InkWell(
                                      key: day.inMonth
                                          ? dayKey(day.date)
                                          : null,
                                      onTap: day.inMonth
                                          ? () => onDay(day.date)
                                          : null,
                                      child: Container(
                                        margin: const EdgeInsets.all(1),
                                        decoration: BoxDecoration(
                                          color: isToday
                                              ? PandoraColors.petal
                                              : Colors.transparent,
                                          borderRadius: BorderRadius.circular(
                                            8,
                                          ),
                                        ),
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.stretch,
                                          children: [
                                            Row(
                                              children: [
                                                Text(
                                                  '${day.date.day}',
                                                  semanticsLabel: day.date.iso,
                                                  style: const TextStyle(
                                                    fontSize: 11,
                                                  ),
                                                ),
                                                if (holiday != null) ...[
                                                  const SizedBox(width: 2),
                                                  Expanded(
                                                    child: Tooltip(
                                                      message:
                                                          '${holiday.name} · ${holiday.isOffDay ? '休' : '班'}',
                                                      child: Text(
                                                        '${holiday.isOffDay ? '休' : '班'} ${holiday.name}',
                                                        maxLines: 1,
                                                        overflow: TextOverflow
                                                            .ellipsis,
                                                        style: TextStyle(
                                                          fontSize: 8,
                                                          color:
                                                              holiday.isOffDay
                                                              ? PandoraColors
                                                                    .brand
                                                              : PandoraColors
                                                                    .muted,
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    );
                                  },
                                ),
                              ),
                          ],
                        ),
                        Positioned(
                          left: 0,
                          right: 0,
                          bottom: 0,
                          height: 18 * scale,
                          child: Row(
                            children: [
                              for (final day in week.days)
                                Expanded(
                                  child: day.overflowCount == 0
                                      ? const SizedBox.shrink()
                                      : Semantics(
                                          label:
                                              '${day.date.iso} 还有${day.overflowCount}项任务，查看完整清单',
                                          button: true,
                                          child: InkWell(
                                            key: ValueKey(
                                              'task-overflow-${day.date.iso}',
                                            ),
                                            onTap: () => onDay(day.date),
                                            child: Align(
                                              alignment: Alignment.centerRight,
                                              child: Text(
                                                '+${day.overflowCount}',
                                                style: const TextStyle(
                                                  fontSize: 10,
                                                  color: PandoraColors.brand,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                ),
                            ],
                          ),
                        ),
                        for (final bar in week.bars)
                          Positioned(
                            left: bar.startColumn * cellWidth + 2,
                            top: 18 * scale + bar.lane * laneStep,
                            width:
                                ((bar.endColumn - bar.startColumn + 1) *
                                            cellWidth -
                                        4)
                                    .clamp(2, double.infinity),
                            height: barHeight,
                            child: Builder(
                              builder: (barContext) {
                                final item = projected
                                    .where((row) => row.task.id == bar.itemId)
                                    .firstOrNull;
                                final canDrag =
                                    !readOnly &&
                                    item != null &&
                                    CalendarDragCalculator.canReschedule(
                                      item.task,
                                    );
                                final moveSelection = TaskCalendarSelection(
                                  taskId: bar.itemId,
                                  grabDay: week.days[bar.startColumn].date,
                                );
                                final startSelection = TaskCalendarSelection(
                                  taskId: bar.itemId,
                                  grabDay: bar.startDate,
                                  mode: CalendarDragMode.start,
                                );
                                final endSelection = TaskCalendarSelection(
                                  taskId: bar.itemId,
                                  grabDay: bar.endDate,
                                  mode: CalendarDragMode.end,
                                );
                                void trackPointer(
                                  TaskCalendarSelection selection,
                                  Offset position,
                                ) {
                                  final box = barContext.findRenderObject();
                                  if (box is! RenderBox) return;
                                  final localX = box.globalToLocal(position).dx;
                                  final offset = (localX / cellWidth)
                                      .floor()
                                      .clamp(
                                        0,
                                        bar.endColumn - bar.startColumn,
                                      );
                                  selection.grabDay =
                                      week.days[bar.startColumn + offset].date;
                                  selection.pointer = position;
                                }

                                void openBarDay(TapUpDetails details) {
                                  final box = barContext.findRenderObject();
                                  if (box is! RenderBox) {
                                    onDay(week.days[bar.endColumn].date);
                                    return;
                                  }
                                  final localX = box
                                      .globalToLocal(details.globalPosition)
                                      .dx;
                                  final offset = (localX / cellWidth)
                                      .floor()
                                      .clamp(
                                        0,
                                        bar.endColumn - bar.startColumn,
                                      );
                                  onDay(
                                    week.days[bar.startColumn + offset].date,
                                  );
                                }

                                final actions =
                                    <CustomSemanticsAction, VoidCallback>{
                                      if (item != null)
                                        const CustomSemanticsAction(
                                          label: '整条后移一天',
                                        ): () => onAccessibleAdjust(
                                          item.task,
                                          CalendarDragMode.move,
                                          1,
                                        ),
                                      if (item != null)
                                        const CustomSemanticsAction(
                                          label: '整条前移一天',
                                        ): () => onAccessibleAdjust(
                                          item.task,
                                          CalendarDragMode.move,
                                          -1,
                                        ),
                                      if (item != null && bar.isRealStart)
                                        const CustomSemanticsAction(
                                          label: '起点后移一天',
                                        ): () => onAccessibleAdjust(
                                          item.task,
                                          CalendarDragMode.start,
                                          1,
                                        ),
                                      if (item != null && bar.isRealStart)
                                        const CustomSemanticsAction(
                                          label: '起点前移一天',
                                        ): () => onAccessibleAdjust(
                                          item.task,
                                          CalendarDragMode.start,
                                          -1,
                                        ),
                                      if (item != null && bar.isRealEnd)
                                        const CustomSemanticsAction(
                                          label: '终点后移一天',
                                        ): () => onAccessibleAdjust(
                                          item.task,
                                          CalendarDragMode.end,
                                          1,
                                        ),
                                      if (item != null && bar.isRealEnd)
                                        const CustomSemanticsAction(
                                          label: '终点前移一天',
                                        ): () => onAccessibleAdjust(
                                          item.task,
                                          CalendarDragMode.end,
                                          -1,
                                        ),
                                    };
                                return Semantics(
                                  button: true,
                                  label: bar.name,
                                  customSemanticsActions: canDrag
                                      ? actions
                                      : null,
                                  child: Stack(
                                    clipBehavior: Clip.none,
                                    children: [
                                      Positioned.fill(
                                        child: Listener(
                                          onPointerDown: (event) =>
                                              trackPointer(
                                                moveSelection,
                                                event.position,
                                              ),
                                          child: canDrag
                                              ? LongPressDraggable<
                                                  TaskCalendarSelection
                                                >(
                                                  delay: const Duration(
                                                    milliseconds: 500,
                                                  ),
                                                  hapticFeedbackOnStart: true,
                                                  data: moveSelection,
                                                  onDragStarted: () =>
                                                      onDragStarted(
                                                        moveSelection,
                                                      ),
                                                  onDragUpdate: (details) =>
                                                      onDragUpdate(
                                                        moveSelection,
                                                        details.globalPosition,
                                                      ),
                                                  onDragEnd: (_) =>
                                                      onDragEnd(moveSelection),
                                                  feedback: _dragFeedback(
                                                    bar.name,
                                                  ),
                                                  childWhenDragging: Opacity(
                                                    opacity: .35,
                                                    child: _taskBar(
                                                      context,
                                                      bar,
                                                      projected,
                                                    ),
                                                  ),
                                                  child: GestureDetector(
                                                    key: ValueKey(
                                                      'task-bar-${bar.itemId}',
                                                    ),
                                                    onTapUp: openBarDay,
                                                    child: _taskBar(
                                                      context,
                                                      bar,
                                                      projected,
                                                    ),
                                                  ),
                                                )
                                              : GestureDetector(
                                                  key: ValueKey(
                                                    'task-bar-${bar.itemId}',
                                                  ),
                                                  onTapUp: openBarDay,
                                                  child: _taskBar(
                                                    context,
                                                    bar,
                                                    projected,
                                                  ),
                                                ),
                                        ),
                                      ),
                                      if (canDrag && bar.isRealStart)
                                        Positioned(
                                          left: -3,
                                          top: 0,
                                          bottom: 0,
                                          width: 18,
                                          child: _resizeHandle(
                                            key: ValueKey(
                                              'task-start-${bar.itemId}',
                                            ),
                                            selection: startSelection,
                                            onPointerDown: trackPointer,
                                            onDragStarted: onDragStarted,
                                            onDragUpdate: onDragUpdate,
                                            onDragEnd: onDragEnd,
                                          ),
                                        ),
                                      if (canDrag && bar.isRealEnd)
                                        Positioned(
                                          right: -3,
                                          top: 0,
                                          bottom: 0,
                                          width: 18,
                                          child: _resizeHandle(
                                            key: ValueKey(
                                              'task-end-${bar.itemId}',
                                            ),
                                            selection: endSelection,
                                            onPointerDown: trackPointer,
                                            onDragStarted: onDragStarted,
                                            onDragUpdate: onDragUpdate,
                                            onDragEnd: onDragEnd,
                                          ),
                                        ),
                                    ],
                                  ),
                                );
                              },
                            ),
                          ),
                      ],
                    );
                  },
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _dragFeedback(String name) => Material(
    elevation: 4,
    child: Container(
      constraints: const BoxConstraints(maxWidth: 220),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis),
    ),
  );

  Widget _resizeHandle({
    Key? key,
    required TaskCalendarSelection selection,
    required void Function(TaskCalendarSelection, Offset) onPointerDown,
    required void Function(TaskCalendarSelection) onDragStarted,
    required void Function(TaskCalendarSelection, Offset) onDragUpdate,
    required void Function(TaskCalendarSelection) onDragEnd,
  }) {
    return Listener(
      key: key,
      onPointerDown: (event) => onPointerDown(selection, event.position),
      child: LongPressDraggable<TaskCalendarSelection>(
        delay: const Duration(milliseconds: 500),
        hapticFeedbackOnStart: true,
        data: selection,
        onDragStarted: () => onDragStarted(selection),
        onDragUpdate: (details) =>
            onDragUpdate(selection, details.globalPosition),
        onDragEnd: (_) => onDragEnd(selection),
        feedback: const Material(
          elevation: 4,
          child: Icon(Icons.drag_handle, size: 20),
        ),
        child: const ColoredBox(color: Colors.transparent),
      ),
    );
  }

  Widget _taskBar(
    BuildContext context,
    BarLayout bar,
    List<CalendarTask> tasks,
  ) {
    final item = tasks.where((row) => row.task.id == bar.itemId).firstOrNull;
    final color = item?.color ?? '#ffe1ea';
    final pending = item?.task.pending == true;
    final done = item?.task.done == true;
    return CustomPaint(
      key: ValueKey('task-bar-dash-${bar.itemId}'),
      foregroundPainter: pending ? const _DashedBorderPainter() : null,
      child: Container(
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.symmetric(horizontal: 5),
        decoration: BoxDecoration(
          color: _color(color),
          borderRadius: BorderRadius.circular(6),
        ),
        child: FadingNameText(
          bar.name,
          maxLines: _weekBarHeight(weekHeight) >= 18 ? 2 : 1,
          style: TextStyle(
            fontSize: _weekBarHeight(weekHeight) >= 18 ? 11 : 10,
            height: 1.1,
            decoration: done ? TextDecoration.lineThrough : null,
            color: done ? PandoraColors.muted : null,
          ),
        ),
      ),
    );
  }

  Color _color(String value) {
    final hex = value.replaceFirst('#', '');
    final parsed = int.tryParse(hex, radix: 16);
    return parsed == null ? PandoraColors.petal : Color(0xFF000000 | parsed);
  }
}

class _AxisDragData {
  const _AxisDragData({
    required this.entry,
    required this.mode,
    required this.pixelsPerHour,
    required this.vertical,
  });

  final DayAxisEntry entry;
  final CalendarDragMode mode;
  final double pixelsPerHour;
  final bool vertical;
}

class _DayPanel extends StatelessWidget {
  const _DayPanel({
    required this.day,
    this.holiday,
    required this.tasks,
    required this.dayViewMode,
    required this.onToggleView,
    required this.onSelectDay,
    required this.onOpen,
    required this.onPin,
    required this.onClose,
    required this.onAxisDragStarted,
    required this.onAxisDragUpdate,
    required this.onAxisDragEnd,
    required this.onAccessibleAdjust,
    this.readOnly = false,
  });

  final CompanyDate day;
  final HolidayDay? holiday;
  final List<TaskRecord> tasks;
  final bool dayViewMode;
  final VoidCallback onToggleView;
  final ValueChanged<CompanyDate> onSelectDay;
  final ValueChanged<String> onOpen;
  final Future<void> Function(TaskRecord) onPin;
  final VoidCallback onClose;
  final void Function(_AxisDragData, Offset) onAxisDragStarted;
  final void Function(Offset) onAxisDragUpdate;
  final void Function(_AxisDragData) onAxisDragEnd;
  final void Function(DayAxisEntry, CalendarDragMode, int) onAccessibleAdjust;
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    final zone = CompanyTimeZone.fallback;
    return Material(
      color: dayViewMode ? Colors.white : PandoraColors.paper,
      child: SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 4, 4),
              child: Row(
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        Flexible(
                          child: Text(
                            dayViewMode
                                ? '${day.iso} 日视图'
                                : '${day.iso} 完整清单',
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(fontWeight: FontWeight.w600),
                          ),
                        ),
                        if (holiday != null) ...[
                          const SizedBox(width: 8),
                          Flexible(
                            child: Text(
                              '${holiday!.isOffDay ? '休' : '班'} ${holiday!.name}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 11,
                                color: holiday!.isOffDay
                                    ? PandoraColors.brand
                                    : PandoraColors.muted,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: onClose,
                    tooltip: '关闭',
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),
            if (dayViewMode)
              _DayWeekStrip(day: day, onSelectDay: onSelectDay),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: [
                OutlinedButton.icon(
                  onPressed: onToggleView,
                  icon: Icon(
                    dayViewMode ? Icons.list_alt : Icons.view_timeline_outlined,
                    size: 16,
                  ),
                  label: Text(dayViewMode ? '清单' : '日视图'),
                ),
              ],
            ),
            const Divider(height: 12),
            Expanded(
              child: tasks.isEmpty
                  ? const EmptyView(message: '这一天暂无负责的任务')
                  : dayViewMode
                  ? _DayAxisView(
                      day: day,
                      tasks: tasks,
                      onOpen: onOpen,
                      onDragStarted: onAxisDragStarted,
                      onDragUpdate: onAxisDragUpdate,
                      onDragEnd: onAxisDragEnd,
                      onAccessibleAdjust: onAccessibleAdjust,
                      readOnly: readOnly,
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(8, 0, 8, 24),
                      itemCount: tasks.length,
                      separatorBuilder: (_, _) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final task = tasks[index];
                        final when = _taskWhen(task, zone);
                        return CustomPaint(
                          key: ValueKey('day-list-dash-${task.id}'),
                          foregroundPainter: task.pending
                              ? const _DashedBorderPainter()
                              : null,
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 6,
                            ),
                            leading: Icon(
                              task.pinned ? Icons.push_pin : Icons.task_alt,
                              color: task.pinned
                                  ? PandoraColors.brand
                                  : PandoraColors.muted,
                            ),
                            title: FadingNameText(
                              task.title,
                              maxLines: 2,
                              style: TextStyle(
                                decoration: task.done
                                    ? TextDecoration.lineThrough
                                    : null,
                                color: task.done
                                    ? PandoraColors.muted
                                    : null,
                              ),
                            ),
                            subtitle: Text(
                              '${task.done ? '已完成 · ' : ''}${task.pending ? '审核中 · ' : ''}$when',
                            ),
                          trailing: !readOnly && task.canPin
                              ? IconButton(
                                  tooltip: task.pinned ? '取消日历置顶' : '置顶到我的月视图',
                                  onPressed: () => onPin(task),
                                  icon: Icon(
                                    task.pinned
                                        ? Icons.push_pin
                                        : Icons.push_pin_outlined,
                                  ),
                                )
                              : null,
                            onTap: () => onOpen(task.id),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
      ),
    );
  }

  String _taskWhen(TaskRecord task, CompanyTimeZone zone) {
    final proposal = task.pending ? task.pendingSchedule : null;
    if (proposal != null) {
      if (proposal['allDay'] == true) {
        return '提议 ${proposal['startDate']} 至 ${proposal['dueDate']}（全天）';
      }
      final start = DateTime.tryParse(proposal['startAt']?.toString() ?? '');
      final due = DateTime.tryParse(proposal['dueAt']?.toString() ?? '');
      if (start != null && due != null) {
        return '提议 ${zone.formatDateTime(start)} 至 ${zone.formatDateTime(due)}';
      }
    }
    if (task.allDay) {
      final start = task.allDayStart?.iso ?? '全天';
      final due = task.allDayEnd?.iso;
      return due == null || due == start ? '$start（全天）' : '$start 至 $due（全天）';
    }
    if (task.startAt == null || task.dueAt == null) return '排期未设置';
    return '${zone.formatDateTime(task.startAt!)} 至 ${zone.formatDateTime(task.dueAt!)}';
  }
}

class _DayWeekStrip extends StatelessWidget {
  const _DayWeekStrip({required this.day, required this.onSelectDay});

  final CompanyDate day;
  final ValueChanged<CompanyDate> onSelectDay;

  @override
  Widget build(BuildContext context) {
    final start = day.mondayOfWeek;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
      child: Row(
        children: [
          for (var index = 0; index < 7; index++)
            Expanded(
              child: Builder(builder: (context) {
                final date = start.addDays(index);
                final selected = date == day;
                return Semantics(
                  selected: selected,
                  label: date.iso,
                  child: InkWell(
                    key: ValueKey('day-week-${date.iso}'),
                    borderRadius: BorderRadius.circular(24),
                    onTap: () => onSelectDay(date),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          CompanyCalendarGrid.weekdayLabels[index],
                          style: TextStyle(
                            fontSize: 12,
                            color: index >= 5 ? Colors.black38 : Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          width: 36,
                          height: 36,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: selected ? const Color(0xFF18191D) : null,
                          ),
                          child: Text(
                            '${date.day}',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                              color: selected
                                  ? Colors.white
                                  : (index >= 5 ? Colors.black38 : Colors.black87),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ),
        ],
      ),
    );
  }
}

class _DayAxisView extends StatelessWidget {
  const _DayAxisView({
    required this.day,
    required this.tasks,
    required this.onOpen,
    required this.onDragStarted,
    required this.onDragUpdate,
    required this.onDragEnd,
    required this.onAccessibleAdjust,
    this.readOnly = false,
  });

  final CompanyDate day;
  final List<TaskRecord> tasks;
  final ValueChanged<String> onOpen;
  final void Function(_AxisDragData, Offset) onDragStarted;
  final void Function(Offset) onDragUpdate;
  final void Function(_AxisDragData) onDragEnd;
  final void Function(DayAxisEntry, CalendarDragMode, int) onAccessibleAdjust;
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    final layout = DayAxisLayout.compute(
      day: day,
      tasks: tasks,
      mode: DayAxisMode.vertical,
    );
    if (layout.entries.isEmpty) return const EmptyView(message: '这一天暂无负责的任务');
    return Column(
      children: [
        if (layout.allDay.isNotEmpty)
          _AllDayStrip(entries: layout.allDay, onOpen: onOpen),
        Expanded(
          child: _VerticalAxis(
            key: ValueKey('day-axis-${day.iso}'),
            layout: layout,
            onOpen: onOpen,
            onDragStarted: onDragStarted,
            onDragUpdate: onDragUpdate,
            onDragEnd: onDragEnd,
            onAccessibleAdjust: onAccessibleAdjust,
            readOnly: readOnly,
          ),
        ),
      ],
    );
  }
}

class _AllDayStrip extends StatelessWidget {
  const _AllDayStrip({required this.entries, required this.onOpen});

  final List<DayAxisEntry> entries;
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(8, 4, 8, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('全天', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: PandoraColors.muted)),
          const SizedBox(height: 4),
          Wrap(
            spacing: 4,
            runSpacing: 4,
            children: [
              for (final entry in entries)
                CustomPaint(
                  key: ValueKey('all-day-dash-${entry.task.id}'),
                  foregroundPainter: entry.task.pending
                      ? const _DashedBorderPainter()
                      : null,
                  child: ActionChip(
                    label: Text(
                      entry.task.title,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        decoration: entry.task.done
                            ? TextDecoration.lineThrough
                            : null,
                        color: entry.task.done ? PandoraColors.muted : null,
                      ),
                    ),
                    avatar: entry.pendingProjection
                        ? const Icon(Icons.edit_calendar_outlined, size: 14)
                        : null,
                    onPressed: () => onOpen(entry.task.id),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _VerticalAxis extends StatefulWidget {
  const _VerticalAxis({
    super.key,
    required this.layout,
    required this.onOpen,
    required this.onDragStarted,
    required this.onDragUpdate,
    required this.onDragEnd,
    required this.onAccessibleAdjust,
    required this.readOnly,
  });

  final DayAxisLayout layout;
  final ValueChanged<String> onOpen;
  final void Function(_AxisDragData, Offset) onDragStarted;
  final void Function(Offset) onDragUpdate;
  final void Function(_AxisDragData) onDragEnd;
  final void Function(DayAxisEntry, CalendarDragMode, int) onAccessibleAdjust;
  final bool readOnly;

  @override
  State<_VerticalAxis> createState() => _VerticalAxisState();
}

class _VerticalAxisState extends State<_VerticalAxis> {
  static const double _hourHeight = 52;
  static const double _labelWidth = 56;
  static const double _axisHeight = 24 * _hourHeight;
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scroll.hasClients) return;
      final timed = widget.layout.entries.where((entry) => !entry.allDay);
      if (timed.isEmpty) return;
      final first = timed.map((entry) => entry.startMinutes).reduce((a, b) => a < b ? a : b);
      final target = ((first ~/ 60 - 1).clamp(0, 23) * _hourHeight)
          .clamp(0.0, _scroll.position.maxScrollExtent);
      _scroll.jumpTo(target);
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final entries = widget.layout.entries.where((entry) => !entry.allDay).toList()
      ..sort((a, b) {
        final start = a.startMinutes.compareTo(b.startMinutes);
        return start != 0 ? start : a.lane.compareTo(b.lane);
      });
    final sameStarts = <int, List<DayAxisEntry>>{};
    final headerMinutes =
        (MediaQuery.textScalerOf(context).scale(24) * 1.2 + 16) / _hourHeight * 60;
    List<DayAxisEntry>? group;
    for (final entry in entries) {
      // 标题接近且任务重叠时并排，避免后一个色块盖住前一个名称。
      if (group == null ||
          entry.startMinutes - group.last.startMinutes >= headerMinutes ||
          !group.any((other) =>
              other.endMinutes > entry.startMinutes ||
              other.startMinutes == entry.startMinutes)) {
        group = <DayAxisEntry>[];
      }
      group.add(entry);
      sameStarts[entry.startMinutes] = group;
    }
    final maxSameStart = sameStarts.values.fold(1, (count, group) =>
        count > group.length ? count : group.length);
    return LayoutBuilder(builder: (context, constraints) {
      final minimumBlockHeight =
          MediaQuery.textScalerOf(context).scale(13) * 1.2 + 14;
      final minWidth = _labelWidth + maxSameStart * 96.0 + 12;
      final width = constraints.maxWidth > minWidth ? constraints.maxWidth : minWidth;
      final available = width - _labelWidth - 12;
      return SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: SizedBox(
          width: width,
          child: SingleChildScrollView(
            key: const ValueKey('day-timeline-scroll'),
            controller: _scroll,
            child: SizedBox(
              height: _axisHeight + 40,
              child: Stack(
                children: [
                  for (var hour = 0; hour <= 24; hour++) ...[
                    Positioned(
                      left: 0,
                      width: _labelWidth - 10,
                      top: hour * _hourHeight + 2,
                      child: Text(
                        '${hour.toString().padLeft(2, '0')}:00',
                        textAlign: TextAlign.right,
                        style: const TextStyle(fontSize: 11, color: Color(0xFF90949A)),
                      ),
                    ),
                    Positioned(
                      left: _labelWidth,
                      right: 8,
                      top: hour * _hourHeight,
                      child: const ColoredBox(
                        color: Color(0xFFE9EBEF),
                        child: SizedBox(height: 1),
                      ),
                    ),
                  ],
                  for (final entry in entries)
                    Builder(builder: (context) {
                      final group = sameStarts[entry.startMinutes]!;
                      final columns = group.length;
                      final inset = columns > 1 ? 0.0 : (entry.lane * 10.0).clamp(0.0, available * .35);
                      final columnWidth = available / columns;
                      return Positioned(
                        left: _labelWidth + inset + (columns > 1 ? group.indexOf(entry) * columnWidth : 0),
                        width: columns > 1 ? columnWidth - 4 : available - inset,
                        top: entry.startMinutes / 60 * _hourHeight + 1,
                        height: ((entry.endMinutes - entry.startMinutes) / 60 * _hourHeight)
                            .clamp(minimumBlockHeight, _axisHeight),
                        child: _AxisTaskBlock(
                          entry: entry,
                          onOpen: widget.onOpen,
                          compact: true,
                          vertical: true,
                          pixelsPerHour: _hourHeight,
                          onDragStarted: widget.onDragStarted,
                          onDragUpdate: widget.onDragUpdate,
                          onDragEnd: widget.onDragEnd,
                          onAccessibleAdjust: widget.onAccessibleAdjust,
                          readOnly: widget.readOnly,
                        ),
                      );
                    }),
                ],
              ),
            ),
          ),
        ),
      );
    });
  }
}

class _AxisTaskBlock extends StatelessWidget {
  const _AxisTaskBlock({
    required this.entry,
    required this.onOpen,
    required this.compact,
    required this.vertical,
    required this.pixelsPerHour,
    required this.onDragStarted,
    required this.onDragUpdate,
    required this.onDragEnd,
    required this.onAccessibleAdjust,
    required this.readOnly,
  });

  final DayAxisEntry entry;
  final ValueChanged<String> onOpen;
  final bool compact;
  final bool vertical;
  final double pixelsPerHour;
  final void Function(_AxisDragData, Offset) onDragStarted;
  final void Function(Offset) onDragUpdate;
  final void Function(_AxisDragData) onDragEnd;
  final void Function(DayAxisEntry, CalendarDragMode, int) onAccessibleAdjust;
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    final canDrag = !readOnly && entry.canDrag;
    final moveData = _AxisDragData(
      entry: entry,
      mode: CalendarDragMode.move,
      pixelsPerHour: pixelsPerHour,
      vertical: vertical,
    );
    final startData = _AxisDragData(
      entry: entry,
      mode: CalendarDragMode.start,
      pixelsPerHour: pixelsPerHour,
      vertical: vertical,
    );
    final endData = _AxisDragData(
      entry: entry,
      mode: CalendarDragMode.end,
      pixelsPerHour: pixelsPerHour,
      vertical: vertical,
    );
    final actions = <CustomSemanticsAction, VoidCallback>{
      if (canDrag)
        const CustomSemanticsAction(label: '后移一小时'): () =>
            onAccessibleAdjust(entry, CalendarDragMode.move, 1),
      if (canDrag)
        const CustomSemanticsAction(label: '前移一小时'): () =>
            onAccessibleAdjust(entry, CalendarDragMode.move, -1),
      if (canDrag)
        const CustomSemanticsAction(label: '起点后移一小时'): () =>
            onAccessibleAdjust(entry, CalendarDragMode.start, 1),
      if (canDrag)
        const CustomSemanticsAction(label: '起点前移一小时'): () =>
            onAccessibleAdjust(entry, CalendarDragMode.start, -1),
      if (canDrag)
        const CustomSemanticsAction(label: '终点后移一小时'): () =>
            onAccessibleAdjust(entry, CalendarDragMode.end, 1),
      if (canDrag)
        const CustomSemanticsAction(label: '终点前移一小时'): () =>
            onAccessibleAdjust(entry, CalendarDragMode.end, -1),
    };
    final pending = entry.task.pending;
    final done = entry.task.done;
    final background = _color(entry.color);
    final tagBorder = entry.task.tags.firstOrNull?.border;
    final accent = done
        ? PandoraColors.completed
        : (tagBorder == null
              ? Color.lerp(background, Colors.black, .42)!
              : _color(tagBorder));
    String time(int minutes) =>
        '${(minutes ~/ 60).toString().padLeft(2, '0')}:${(minutes % 60).toString().padLeft(2, '0')}';
    final block = Semantics(
      button: true,
      label:
          '${entry.task.title}，${entry.allDay ? '全天' : '${entry.startMinutes ~/ 60}:${(entry.startMinutes % 60).toString().padLeft(2, '0')}'}${pending ? '，待审核' : ''}',
      customSemanticsActions: canDrag ? actions : null,
      child: GestureDetector(
        onTap: () => onOpen(entry.task.id),
        child: CustomPaint(
          key: ValueKey('axis-dash-${entry.task.id}'),
          foregroundPainter: pending ? const _DashedBorderPainter() : null,
          child: DecoratedBox(
            key: ValueKey('day-task-fill-${entry.task.id}'),
            decoration: BoxDecoration(
              color: Color.lerp(Colors.white, background, .78),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: Colors.white.withValues(alpha: .65)),
            ),
            child: LayoutBuilder(builder: (context, constraints) {
              final textScaler = MediaQuery.textScalerOf(context);
              final titleHeight = textScaler.scale(13) * 1.2;
              final timeHeight = textScaler.scale(11) * 1.2;
              final showTime = constraints.maxHeight >= titleHeight + timeHeight + 16;
              return Stack(
                children: [
                  Positioned(
                    left: 4,
                    top: 5,
                    bottom: 5,
                    width: 3,
                    child: DecoratedBox(
                      key: ValueKey('day-task-accent-${entry.task.id}'),
                      decoration: BoxDecoration(
                        color: accent,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 6, 7, 4),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        FadingNameText(
                          entry.task.title,
                          maxLines: constraints.maxHeight >= titleHeight * 2 + timeHeight + 16 ? 2 : 1,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            height: 1.2,
                            decoration: done ? TextDecoration.lineThrough : null,
                            color: accent,
                          ),
                        ),
                        if (showTime) ...[
                          const SizedBox(height: 3),
                          Text(
                            '${time(entry.startMinutes)}–${time(entry.endMinutes)}${pending ? ' · 待审核' : ''}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 11, height: 1.2, color: accent),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              );
            }),
          ),
        ),
      ),
    );
    if (!canDrag) return block;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned.fill(
          child: GestureDetector(
            key: ValueKey('axis-task-${entry.task.id}'),
            behavior: HitTestBehavior.translucent,
            onLongPressStart: (details) {
              HapticFeedback.lightImpact();
              onDragStarted(moveData, details.globalPosition);
            },
            onLongPressMoveUpdate: (details) =>
                onDragUpdate(details.globalPosition),
            onLongPressEnd: (_) => onDragEnd(moveData),
            onLongPressCancel: () => onDragEnd(moveData),
            child: block,
          ),
        ),
        vertical
            ? Positioned(
                left: 0,
                right: 0,
                top: -2,
                height: 14,
                child: _axisHandle(
                  startData,
                  start: true,
                  key: ValueKey('axis-start-${entry.task.id}'),
                ),
              )
            : Positioned(
                left: -2,
                top: 0,
                bottom: 0,
                width: 14,
                child: _axisHandle(
                  startData,
                  start: true,
                  key: ValueKey('axis-start-${entry.task.id}'),
                ),
              ),
        vertical
            ? Positioned(
                left: 0,
                right: 0,
                bottom: -2,
                height: 14,
                child: _axisHandle(
                  endData,
                  start: false,
                  key: ValueKey('axis-end-${entry.task.id}'),
                ),
              )
            : Positioned(
                right: -2,
                top: 0,
                bottom: 0,
                width: 14,
                child: _axisHandle(
                  endData,
                  start: false,
                  key: ValueKey('axis-end-${entry.task.id}'),
                ),
              ),
      ],
    );
  }

  Widget _axisHandle(_AxisDragData data, {required bool start, Key? key}) {
    return GestureDetector(
      key: key,
      behavior: HitTestBehavior.translucent,
      onLongPressStart: (details) {
        HapticFeedback.lightImpact();
        onDragStarted(data, details.globalPosition);
      },
      onLongPressMoveUpdate: (details) => onDragUpdate(details.globalPosition),
      onLongPressEnd: (_) => onDragEnd(data),
      onLongPressCancel: () => onDragEnd(data),
      child: MouseRegion(
        cursor: SystemMouseCursors.resizeUpDown,
        child: const ColoredBox(color: Colors.transparent),
      ),
    );
  }

  static Color _color(String value) {
    final hex = value.replaceFirst('#', '');
    final parsed = int.tryParse(hex, radix: 16);
    return parsed == null ? PandoraColors.petal : Color(0xFF000000 | parsed);
  }
}

class _DashedBorderPainter extends CustomPainter {
  const _DashedBorderPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = PandoraColors.brand
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4;
    final path = Path()
      ..addRRect(
        RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(6)),
      );
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final next = (distance + 4).clamp(0.0, metric.length);
        canvas.drawPath(metric.extractPath(distance, next), paint);
        distance += 7;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter oldDelegate) => false;
}
