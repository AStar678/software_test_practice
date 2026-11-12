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
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/state_views.dart';
import '../../daily_items/domain/month_layout.dart';
import '../../tasks/domain/task_record.dart';
import '../data/schedule_api.dart';
import '../domain/calendar_drag.dart';
import '../domain/day_axis.dart';
import '../domain/task_calendar.dart';

class TaskCalendarPage extends ConsumerStatefulWidget {
  const TaskCalendarPage({super.key});

  @override
  ConsumerState<TaskCalendarPage> createState() => _TaskCalendarPageState();
}

enum _CalendarDensity { compact, comfortable }

class _TaskCalendarPageState extends ConsumerState<TaskCalendarPage> with WidgetsBindingObserver {
  final Map<String, List<TaskRecord>> _tasks = {};
  final Set<String> _loading = {};
  final Map<String, Object> _errors = {};
  late CompanyDate _anchor;
  final _scroll = ScrollController();
  final _currentMonthKey = GlobalKey();
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  AppPreferences? _preferences;
  Timer? _preferenceTimer;
  CompanyDate? _drawerDay;
  List<TaskRecord> _drawerTasks = const [];
  bool _dayVertical = false;
  bool _showAxis = false;
  _CalendarDensity _density = _CalendarDensity.compact;
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

  @override
  void initState() {
    super.initState();
    _anchor = ref.read(businessDateProvider);
    WidgetsBinding.instance.addObserver(this);
    _scroll.addListener(_loadVisibleMonths);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _jumpToAnchor();
      _loadAround(_anchor);
      unawaited(_restorePreferences());
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _preferenceTimer?.cancel();
    _dragTimer?.cancel();
    _dragOverlay?.remove();
    _scroll
      ..removeListener(_loadVisibleMonths)
      ..dispose();
    super.dispose();
  }

  double get _monthExtent => _density == _CalendarDensity.comfortable ? 642 : 510;

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
    String? accountId;
    for (var attempt = 0; attempt < 5 && accountId == null; attempt++) {
      accountId = ref.read(currentUserProvider)?.id;
      if (accountId == null) await Future<void>.delayed(const Duration(milliseconds: 20));
    }
    final prefs = await AppPreferences.load(accountId);
    if (!mounted) return;
    setState(() {
      _preferences = prefs;
      final savedDate = CompanyDate.tryParse(prefs.getString('calendar.lastDate') ?? '');
      if (savedDate != null) _anchor = savedDate;
      _dayVertical = prefs.getString('calendar.mode') == 'vertical';
      _density = prefs.getString('calendar.density') == 'comfortable'
          ? _CalendarDensity.comfortable
          : _CalendarDensity.compact;
    });
    _jumpToAnchor();
    await _loadAround(_anchor);
  }

  void _jumpToAnchor() {
    if (!_scroll.hasClients) return;
    final months = CompanyCalendarGrid.continuousMonths(_anchor, monthsBefore: 12, monthsAfter: 24);
    final index = months.indexWhere((month) => month.year == _anchor.year && month.month == _anchor.month);
    if (index >= 0) _scroll.jumpTo(index * _monthExtent);
    _scrollToCurrentMonth();
  }

  Future<void> _savePreference(String key, String value) async {
    final prefs = _preferences;
    if (prefs == null) return;
    await prefs.setString(key, value);
  }

  void _scheduleSavePosition(CompanyDate date) {
    _preferenceTimer?.cancel();
    _preferenceTimer = Timer(const Duration(milliseconds: 600), () {
      unawaited(_savePreference('calendar.lastDate', date.iso));
    });
  }

  void _loadVisibleMonths() {
    if (!_scroll.hasClients) return;
    final months = CompanyCalendarGrid.continuousMonths(_anchor, monthsBefore: 12, monthsAfter: 24);
    final first = (_scroll.offset / _monthExtent).floor().clamp(0, months.length - 1);
    final last = ((_scroll.offset + _scroll.position.viewportDimension) / _monthExtent).ceil().clamp(0, months.length);
    _scheduleSavePosition(months[first].firstDayOfMonth);
    for (var index = first; index < last; index++) {
      final month = months[index];
      if (_tasks.containsKey(_key(month)) || _loading.contains(_key(month))) continue;
      unawaited(_loadMonth(month));
    }
  }

  void _scrollToCurrentMonth() {
    final context = _currentMonthKey.currentContext;
    if (context != null) {
      Scrollable.ensureVisible(context, alignment: 0, duration: const Duration(milliseconds: 250));
    }
    unawaited(_savePreference('calendar.lastDate', _anchor.iso));
  }

  void _toggleDensity() {
    setState(() {
      _density = _density == _CalendarDensity.compact ? _CalendarDensity.comfortable : _CalendarDensity.compact;
    });
    unawaited(_savePreference('calendar.density', _density.name));
  }

  void _toggleAxisOrientation() {
    setState(() => _dayVertical = !_dayVertical);
    unawaited(_savePreference('calendar.mode', _dayVertical ? 'vertical' : 'horizontal'));
  }

  @override
  Widget build(BuildContext context) {
    final months = CompanyCalendarGrid.continuousMonths(_anchor, monthsBefore: 12, monthsAfter: 24);
    return Scaffold(
      key: _scaffoldKey,
      endDrawer: _drawerDay == null
          ? null
          : Drawer(
              width: MediaQuery.sizeOf(context).width * .42,
              child: _DayPanel(
                day: _drawerDay!,
                tasks: _drawerTasks,
                vertical: _dayVertical,
                showAxis: _showAxis,
                onToggleOrientation: _toggleAxisOrientation,
                onShowAxis: () => setState(() => _showAxis = !_showAxis),
                onCreate: () {
                  Navigator.of(context).pop();
                  unawaited(_openAndRefresh('/tasks/new?date=${_drawerDay!.iso}'));
                },
                onOpen: (id) {
                  Navigator.of(context).pop();
                  unawaited(_openAndRefresh('/tasks/$id'));
                },
                onPin: _togglePin,
                onClose: () => Navigator.of(context).pop(),
                onAxisDragStarted: _startAxisDrag,
                onAxisDragUpdate: _updateAxisDrag,
                onAxisDragEnd: _endAxisDrag,
                onAccessibleAdjust: _accessibleAxisAdjust,
              ),
            ),
      appBar: AppBar(
        title: const Text('日程'),
        actions: [
          TextButton(onPressed: _scrollToCurrentMonth, child: const Text('今天')),
          IconButton(
            tooltip: _density == _CalendarDensity.compact ? '切换舒适密度' : '切换紧凑密度',
            onPressed: _toggleDensity,
            icon: Icon(_density == _CalendarDensity.compact ? Icons.density_medium : Icons.density_small),
          ),
          IconButton(
            tooltip: '任务表单',
            onPressed: () => _openAndRefresh('/tasks/table'),
            icon: const Icon(Icons.table_chart_outlined),
          ),
          IconButton(
            tooltip: '我的申请与审核',
            onPressed: () => _openAndRefresh('/approvals'),
            icon: const Icon(Icons.assignment_outlined),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        tooltip: '新建任务',
        onPressed: () => _openAndRefresh('/tasks/new'),
        child: const Icon(Icons.add),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _loadAround(_anchor, force: true),
          child: ListView.builder(
            controller: _scroll,
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 96),
            itemCount: months.length,
            itemBuilder: (context, index) {
              final month = months[index];
              final current = month.year == _anchor.year && month.month == _anchor.month;
              return KeyedSubtree(
                key: current ? _currentMonthKey : null,
                child: _MonthBlock(
                month: month,
                tasks: _tasks[_key(month)] ?? const [],
                businessDate: _anchor,
                loading: _loading.contains(_key(month)),
                error: _errors[_key(month)],
                onRetry: () => _loadMonth(month),
                onDay: (day) => _openDay(day),
                  onPin: _togglePin,
                  onOpenTask: (id) => _openAndRefresh('/tasks/$id'),
                  density: _density,
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
    );
  }

  static String _key(CompanyDate month) =>
      '${month.year.toString().padLeft(4, '0')}-${month.month.toString().padLeft(2, '0')}';

  Future<void> _loadAround(CompanyDate anchor, {bool force = false}) async {
    final months = CompanyCalendarGrid.continuousMonths(anchor, monthsBefore: 12, monthsAfter: 24);
    final center = months.indexWhere((month) => month.year == anchor.year && month.month == anchor.month);
    if (center < 0) return;
    for (var index = center - 2; index <= center + 2; index++) {
      if (index < 0 || index >= months.length) continue;
      final month = months[index];
      if (!force && (_tasks.containsKey(_key(month)) || _loading.contains(_key(month)))) continue;
      if (force) _tasks.remove(_key(month));
      await _loadMonth(month);
    }
  }

  Future<void> _loadMonth(CompanyDate month) async {
    final key = _key(month);
    if (_loading.contains(key)) return;
    setState(() {
      _loading.add(key);
      _errors.remove(key);
    });
    try {
      final from = month.firstDayOfMonth.addDays(-7);
      final to = month.lastDayOfMonth.addDays(7);
      final rows = await ref.read(scheduleApiProvider).listCalendarTasks(
            assigneeId: ref.read(currentUserProvider)?.id ?? '',
            from: from.iso,
            to: to.iso,
          );
      if (!mounted) return;
      setState(() {
        _tasks[key] = rows;
        _loading.remove(key);
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _errors[key] = error;
        _loading.remove(key);
      });
    }
  }

  GlobalKey _dayKey(CompanyDate day) => _dayKeys.putIfAbsent(day.iso, () => GlobalKey());

  CompanyDate? _dayAtGlobal(Offset? global) {
    if (global == null) return null;
    for (final entry in _dayKeys.entries) {
      final context = entry.value.currentContext;
      final box = context?.findRenderObject();
      if (box is! RenderBox || !box.attached) continue;
      final local = box.globalToLocal(global);
      if (local.dx >= 0 && local.dy >= 0 && local.dx <= box.size.width && local.dy <= box.size.height) {
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

  CalendarDragPreview? _monthPreview(TaskRecord task, CalendarDragMode mode, CompanyDate target) {
    final selection = _dragSelection;
    if (selection == null) return null;
    return switch (mode) {
      CalendarDragMode.move => CalendarDragCalculator.monthMove(task, selection.grabDay, target),
      CalendarDragMode.start => CalendarDragCalculator.monthResizeStart(task, selection.grabDay, target),
      CalendarDragMode.end => CalendarDragCalculator.monthResizeEnd(task, selection.grabDay, target),
    };
  }

  void _startMonthDrag(TaskCalendarSelection selection) {
    final task = _taskById(selection.taskId);
    if (task == null || !CalendarDragCalculator.canReschedule(task)) return;
    _dragTimer?.cancel();
    _dragSelection = selection;
    _dragTask = task;
    _dragTarget = selection.grabDay;
    _dragLastGlobal = selection.pointer;
    _dragPreview = null;
    _showDragOverlay();
    _dragTimer = Timer.periodic(const Duration(milliseconds: 90), (_) => _tickAutoScroll());
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
      if (mounted) setState(() { _dragTarget = null; _dragPreview = null; });
      _dragOverlay?.markNeedsBuild();
      return;
    }
    final preview = _monthPreview(task, selection.mode, target);
    if (mounted) setState(() { _dragTarget = target; _dragPreview = preview; });
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
    WidgetsBinding.instance.addPostFrameCallback((_) => _updateMonthTarget(_dragLastGlobal));
  }

  void _endMonthDrag(TaskCalendarSelection selection) {
    if (_dragSelection?.taskId != selection.taskId) return;
    _dragTimer?.cancel();
    _updateMonthTarget(_dragLastGlobal);
    final task = _dragTask;
    final target = _dayAtGlobal(_dragLastGlobal);
    final preview = task == null || target == null ? null : _monthPreview(task, selection.mode, target);
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
                    Text(task.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 4),
                    Text('原排期：${_scheduleLabel(task, zone)}', style: const TextStyle(fontSize: 12, color: PandoraColors.muted)),
                    Text(
                      target == null
                          ? '目标日期：无效落点，取消操作'
                          : preview == null
                              ? '目标日期：${target.iso}，调整无效'
                              : '新排期：${preview.label(zone)}',
                      style: TextStyle(fontSize: 12, color: preview == null ? PandoraColors.overdue : PandoraColors.brand),
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
      CalendarDragMode.move => CalendarDragCalculator.dayMove(data.entry.task, day, hours),
      CalendarDragMode.start => CalendarDragCalculator.dayResizeStart(data.entry.task, day, hours),
      CalendarDragMode.end => CalendarDragCalculator.dayResizeEnd(data.entry.task, day, hours),
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

  void _accessibleAxisAdjust(DayAxisEntry entry, CalendarDragMode mode, int hours) {
    final day = _drawerDay;
    if (day == null) return;
    final preview = switch (mode) {
      CalendarDragMode.move => CalendarDragCalculator.dayMove(entry.task, day, hours),
      CalendarDragMode.start => CalendarDragCalculator.dayResizeStart(entry.task, day, hours),
      CalendarDragMode.end => CalendarDragCalculator.dayResizeEnd(entry.task, day, hours),
    };
    if (preview != null) unawaited(_confirmAndSubmit(entry.task, preview));
  }

  Future<void> _confirmAndSubmit(TaskRecord task, CalendarDragPreview preview) async {
    final zone = CompanyTimeZone.fallback;
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('确认调整排期'),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('任务：${task.title}'),
              const SizedBox(height: 8),
              Text('原排期：${_scheduleLabel(task, zone)}'),
              Text('新排期：${preview.label(zone)}'),
              const SizedBox(height: 8),
              const Text('提交后按当前直属上级审核，固定创始人按原规则免审。', style: TextStyle(fontSize: 12, color: PandoraColors.muted)),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                maxLength: 500,
                autofocus: true,
                decoration: const InputDecoration(labelText: '原因（必填）', alignLabelWithHint: true),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('取消')),
          FilledButton(
            onPressed: () {
              final text = controller.text.trim();
              if (text.isNotEmpty) Navigator.of(context).pop(text);
            },
            child: const Text('提交'),
          ),
        ],
      ),
    );
    await Future<void>.delayed(const Duration(milliseconds: 350));
    controller.dispose();
    if (reason == null || !mounted) return;
    final payload = preview.payload(reason);
    try {
      // 列表不带任务 ETag；写入前必须重新读取当前任务版本。
      await ref.read(scheduleApiProvider).detail(task.id);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
      return;
    }
    final keys = ref.read(operationKeysProvider);
    final key = keys.keyFor(
      scope: 'calendar-move:${task.id}',
      method: 'PATCH',
      path: '/tasks/${task.id}',
      body: {'command': 'reschedule', ...payload},
    );
    try {
      await ref.read(scheduleApiProvider).change(
            id: task.id,
            command: 'reschedule',
            payload: payload,
            idempotencyKey: key,
          );
      keys.complete('calendar-move:${task.id}');
      await _loadAround(_anchor, force: true);
      _refreshDrawer();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  void _accessibleMonthAdjust(TaskRecord task, CalendarDragMode mode, int days) {
    final zone = CompanyTimeZone.fallback;
    final startDay = task.allDayStart ?? (task.startAt == null ? null : zone.dateOf(task.startAt!));
    final endDay = task.allDayEnd ?? (task.dueAt == null ? null : zone.dateOf(task.dueAt!));
    final grab = switch (mode) {
      CalendarDragMode.move => startDay,
      CalendarDragMode.start => startDay,
      CalendarDragMode.end => endDay,
    };
    if (grab == null) return;
    final target = grab.addDays(days);
    final preview = switch (mode) {
      CalendarDragMode.move => CalendarDragCalculator.monthMove(task, grab, target),
      CalendarDragMode.start => CalendarDragCalculator.monthResizeStart(task, grab, target),
      CalendarDragMode.end => CalendarDragCalculator.monthResizeEnd(task, grab, target),
    };
    if (preview != null) unawaited(_confirmAndSubmit(task, preview));
  }

  Future<void> _openDay(CompanyDate day) async {
    unawaited(_savePreference('calendar.lastDate', day.iso));
    final all = <String, TaskRecord>{};
    for (final rows in _tasks.values) {
      for (final task in rows) {
        all[task.id] = task;
      }
    }
    final zone = CompanyTimeZone.fallback;
    final tasks = all.values
        .where((task) => CalendarTask(task: task, pendingProjection: task.pending && task.pendingSchedule != null).covers(day))
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
      _showAxis = false;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _scaffoldKey.currentState?.openEndDrawer();
    });
  }

  Future<void> _openAndRefresh(String location) async {
    await context.push(location);
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
    final tasks = all.values
        .where((task) => CalendarTask(task: task, pendingProjection: task.pending && task.pendingSchedule != null).covers(day))
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
    if (!task.canPin) return;
    final pinned = !task.pinned;
    final key = ref.read(operationKeysProvider);
    final idempotency = key.keyFor(
      scope: 'calendar-pin:${task.id}',
      method: pinned ? 'PUT' : 'DELETE',
      path: '/tasks/${task.id}/pin',
      body: const {},
    );
    try {
      await ref.read(scheduleApiProvider).setCalendarPin(
            taskId: task.id,
            pinned: pinned,
            idempotencyKey: idempotency,
          );
      key.complete('calendar-pin:${task.id}');
      await _loadAround(_anchor, force: true);
      _refreshDrawer();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
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
    required this.onDay,
    required this.onPin,
    required this.onOpenTask,
    required this.density,
    required this.dayKey,
    required this.onDragStarted,
    required this.onDragUpdate,
    required this.onDragEnd,
    required this.onAccessibleAdjust,
  });

  final CompanyDate month;
  final List<TaskRecord> tasks;
  final CompanyDate businessDate;
  final bool loading;
  final Object? error;
  final VoidCallback onRetry;
  final ValueChanged<CompanyDate> onDay;
  final Future<void> Function(TaskRecord) onPin;
  final ValueChanged<String> onOpenTask;
  final _CalendarDensity density;
  final GlobalKey Function(CompanyDate) dayKey;
  final void Function(TaskCalendarSelection) onDragStarted;
  final void Function(TaskCalendarSelection, Offset) onDragUpdate;
  final void Function(TaskCalendarSelection) onDragEnd;
  final void Function(TaskRecord, CalendarDragMode, int) onAccessibleAdjust;

  bool get _comfortable => density == _CalendarDensity.comfortable;
  double get _rowHeight => _comfortable ? 96 : 74;
  double get _laneStep => _comfortable ? 24 : 16;
  double get _barHeight => _comfortable ? 24 : 15;

  @override
  Widget build(BuildContext context) {
    final projected = tasks.map((task) => CalendarTask(task: task, pendingProjection: task.pending && task.pendingSchedule != null)).toList();
    final leadingIds = {for (final task in tasks) if (task.pinned) task.id};
    final layout = MonthLayoutCalculator.compute(
      month: month,
      items: projected.map(pseudoItem).toList(),
      leadingIds: leadingIds,
    );
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 8, 8, 10),
        child: Column(
          children: [
            Row(
              children: [
                Text('${month.year}年${month.month}月', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                const Spacer(),
                if (loading) const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                if (error != null) TextButton(onPressed: onRetry, child: const Text('重试')),
              ],
            ),
            Row(
              children: [
                for (final day in CompanyCalendarGrid.weekdayLabels)
                  Expanded(child: Center(child: Text(day, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: PandoraColors.muted)))),
              ],
            ),
            for (final week in layout.weeks)
              SizedBox(
                height: _rowHeight,
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
                                    return InkWell(
                                      key: day.inMonth ? dayKey(day.date) : null,
                                      onTap: day.inMonth ? () => onDay(day.date) : null,
                                      child: Container(
                                        margin: const EdgeInsets.all(1),
                                        decoration: BoxDecoration(
                                          color: isToday ? PandoraColors.petal : Colors.transparent,
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.stretch,
                                          children: [
                                            Text('${day.date.day}', style: const TextStyle(fontSize: 11)),
                                            for (var lane = 0; lane < MonthLayout.maxLanes; lane++)
                                              if (week.bars.where((bar) => bar.lane == lane && bar.startColumn <= i && bar.endColumn >= i).isNotEmpty)
                                                SizedBox(height: _laneStep),
                                            if (day.overflowCount > 0)
                                              Text('+${day.overflowCount}', style: const TextStyle(fontSize: 10, color: PandoraColors.brand)),
                                          ],
                                        ),
                                      ),
                                    );
                                  },
                                ),
                              ),
                          ],
                        ),
                        for (final bar in week.bars)
                          Positioned(
                            left: bar.startColumn * cellWidth + 2,
                            top: 18 + bar.lane * _laneStep,
                            width: ((bar.endColumn - bar.startColumn + 1) * cellWidth - 4).clamp(2, double.infinity),
                            height: _barHeight,
                            child: Builder(builder: (barContext) {
                              final item = projected.where((row) => row.task.id == bar.itemId).firstOrNull;
                              final canDrag = item != null && CalendarDragCalculator.canReschedule(item.task);
                              final moveSelection = TaskCalendarSelection(taskId: bar.itemId, grabDay: week.days[bar.startColumn].date);
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
                              void trackPointer(TaskCalendarSelection selection, Offset position) {
                                final box = barContext.findRenderObject();
                                if (box is! RenderBox) return;
                                final localX = box.globalToLocal(position).dx;
                                final offset = (localX / cellWidth).floor().clamp(0, bar.endColumn - bar.startColumn);
                                selection.grabDay = week.days[bar.startColumn + offset].date;
                                selection.pointer = position;
                              }
                              final actions = <CustomSemanticsAction, VoidCallback>{
                                if (item != null)
                                  const CustomSemanticsAction(label: '整条后移一天'): () => onAccessibleAdjust(item.task, CalendarDragMode.move, 1),
                                if (item != null)
                                  const CustomSemanticsAction(label: '整条前移一天'): () => onAccessibleAdjust(item.task, CalendarDragMode.move, -1),
                                if (item != null && bar.isRealStart)
                                  const CustomSemanticsAction(label: '起点后移一天'): () => onAccessibleAdjust(item.task, CalendarDragMode.start, 1),
                                if (item != null && bar.isRealStart)
                                  const CustomSemanticsAction(label: '起点前移一天'): () => onAccessibleAdjust(item.task, CalendarDragMode.start, -1),
                                if (item != null && bar.isRealEnd)
                                  const CustomSemanticsAction(label: '终点后移一天'): () => onAccessibleAdjust(item.task, CalendarDragMode.end, 1),
                                if (item != null && bar.isRealEnd)
                                  const CustomSemanticsAction(label: '终点前移一天'): () => onAccessibleAdjust(item.task, CalendarDragMode.end, -1),
                              };
                              return Semantics(
                                button: true,
                                label: bar.name,
                                customSemanticsActions: canDrag ? actions : null,
                                child: Stack(
                                clipBehavior: Clip.none,
                                children: [
                                  Positioned.fill(
                                    child: Listener(
                                      onPointerDown: (event) => trackPointer(moveSelection, event.position),
                                      child: canDrag
                                          ? LongPressDraggable<TaskCalendarSelection>(
                                              delay: const Duration(milliseconds: 500),
                                              hapticFeedbackOnStart: true,
                                              data: moveSelection,
                                              onDragStarted: () => onDragStarted(moveSelection),
                                              onDragUpdate: (details) => onDragUpdate(moveSelection, details.globalPosition),
                                              onDragEnd: (_) => onDragEnd(moveSelection),
                                              feedback: _dragFeedback(bar.name),
                                              childWhenDragging: Opacity(opacity: .35, child: _taskBar(context, bar, projected)),
                                              child: GestureDetector(
                                                key: ValueKey('task-bar-${bar.itemId}'),
                                                onTapUp: (details) {
                                                  final box = barContext.findRenderObject();
                                                  if (box is! RenderBox) {
                                                    onDay(week.days[bar.endColumn].date);
                                                    return;
                                                  }
                                                  final localX = box.globalToLocal(details.globalPosition).dx;
                                                  final offset = (localX / cellWidth).floor().clamp(0, bar.endColumn - bar.startColumn);
                                                  onDay(week.days[bar.startColumn + offset].date);
                                                },
                                                child: _taskBar(context, bar, projected),
                                              ),
                                            )
                                          : _taskBar(context, bar, projected),
                                    ),
                                  ),
                                  if (canDrag && bar.isRealStart)
                                    Positioned(
                                      left: -3,
                                      top: 0,
                                      bottom: 0,
                                      width: 18,
                                      child: _resizeHandle(
                                        key: ValueKey('task-start-${bar.itemId}'),
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
                                        key: ValueKey('task-end-${bar.itemId}'),
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
                            }),
                          ),
                      ],
                    );
                  },
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
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
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
        onDragUpdate: (details) => onDragUpdate(selection, details.globalPosition),
        onDragEnd: (_) => onDragEnd(selection),
        feedback: const Material(
          elevation: 4,
          child: Icon(Icons.drag_handle, size: 20),
        ),
        child: Center(
          child: Container(
            width: 5,
            height: double.infinity,
            margin: const EdgeInsets.symmetric(vertical: 2),
            decoration: BoxDecoration(color: PandoraColors.brand, borderRadius: BorderRadius.circular(3)),
          ),
        ),
      ),
    );
  }

  Widget _taskBar(BuildContext context, BarLayout bar, List<CalendarTask> tasks) {
    final item = tasks.where((row) => row.task.id == bar.itemId).firstOrNull;
    final color = item?.color ?? '#ffe1ea';
    final pending = item?.pendingProjection == true;
    return CustomPaint(
      foregroundPainter: pending ? const _DashedBorderPainter() : null,
      child: Container(
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.symmetric(horizontal: 5),
        decoration: BoxDecoration(
          color: _color(color),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          bar.name,
          maxLines: _comfortable ? 2 : 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(fontSize: _comfortable ? 11 : 10, height: 1.1),
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
    required this.tasks,
    required this.vertical,
    required this.showAxis,
    required this.onToggleOrientation,
    required this.onShowAxis,
    required this.onCreate,
    required this.onOpen,
    required this.onPin,
    required this.onClose,
    required this.onAxisDragStarted,
    required this.onAxisDragUpdate,
    required this.onAxisDragEnd,
    required this.onAccessibleAdjust,
  });

  final CompanyDate day;
  final List<TaskRecord> tasks;
  final bool vertical;
  final bool showAxis;
  final VoidCallback onToggleOrientation;
  final VoidCallback onShowAxis;
  final VoidCallback onCreate;
  final ValueChanged<String> onOpen;
  final Future<void> Function(TaskRecord) onPin;
  final VoidCallback onClose;
  final void Function(_AxisDragData, Offset) onAxisDragStarted;
  final void Function(Offset) onAxisDragUpdate;
  final void Function(_AxisDragData) onAxisDragEnd;
  final void Function(DayAxisEntry, CalendarDragMode, int) onAccessibleAdjust;

  @override
  Widget build(BuildContext context) {
    final zone = CompanyTimeZone.fallback;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 4, 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '${day.iso} 完整清单',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ),
                  IconButton(onPressed: onClose, tooltip: '关闭', icon: const Icon(Icons.close)),
                ],
              ),
            ),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: [
                OutlinedButton.icon(
                  onPressed: onShowAxis,
                  icon: Icon(showAxis ? Icons.list_alt : Icons.view_timeline_outlined, size: 16),
                  label: Text(showAxis ? '清单' : '日轴'),
                ),
                if (showAxis)
                  OutlinedButton.icon(
                    onPressed: onToggleOrientation,
                    icon: Icon(vertical ? Icons.view_stream_outlined : Icons.view_agenda_outlined, size: 16),
                    label: Text(vertical ? '纵向' : '横向'),
                  ),
                FilledButton.tonalIcon(
                  onPressed: onCreate,
                  icon: const Icon(Icons.add, size: 16),
                  label: const Text('新建'),
                ),
              ],
            ),
            const Divider(height: 12),
            Expanded(
              child: tasks.isEmpty
                  ? const EmptyView(message: '这一天暂无负责的任务')
                  : showAxis
                      ? _DayAxisView(
                          day: day,
                          tasks: tasks,
                          vertical: vertical,
                          onOpen: onOpen,
                          onDragStarted: onAxisDragStarted,
                          onDragUpdate: onAxisDragUpdate,
                          onDragEnd: onAxisDragEnd,
                          onAccessibleAdjust: onAccessibleAdjust,
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(8, 0, 8, 24),
                          itemCount: tasks.length,
                          separatorBuilder: (_, _) => const Divider(height: 1),
                          itemBuilder: (context, index) {
                            final task = tasks[index];
                            final when = _taskWhen(task, zone);
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: Icon(
                                task.pinned ? Icons.push_pin : Icons.task_alt,
                                color: task.pinned ? PandoraColors.brand : PandoraColors.muted,
                              ),
                              title: Text(task.title, maxLines: 2, overflow: TextOverflow.ellipsis),
                              subtitle: Text('${task.done ? '已完成 · ' : ''}${task.pending ? '审核中 · ' : ''}$when'),
                              trailing: task.canPin
                                  ? IconButton(
                                      tooltip: task.pinned ? '取消日历置顶' : '置顶到我的月视图',
                                      onPressed: () => onPin(task),
                                      icon: Icon(task.pinned ? Icons.push_pin : Icons.push_pin_outlined),
                                    )
                                  : null,
                              onTap: () => onOpen(task.id),
                            );
                          },
                        ),
            ),
          ],
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

class _DayAxisView extends StatelessWidget {
  const _DayAxisView({
    required this.day,
    required this.tasks,
    required this.vertical,
    required this.onOpen,
    required this.onDragStarted,
    required this.onDragUpdate,
    required this.onDragEnd,
    required this.onAccessibleAdjust,
  });

  final CompanyDate day;
  final List<TaskRecord> tasks;
  final bool vertical;
  final ValueChanged<String> onOpen;
  final void Function(_AxisDragData, Offset) onDragStarted;
  final void Function(Offset) onDragUpdate;
  final void Function(_AxisDragData) onDragEnd;
  final void Function(DayAxisEntry, CalendarDragMode, int) onAccessibleAdjust;

  @override
  Widget build(BuildContext context) {
    final layout = DayAxisLayout.compute(
      day: day,
      tasks: tasks,
      mode: vertical ? DayAxisMode.vertical : DayAxisMode.horizontal,
    );
    if (layout.entries.isEmpty) return const EmptyView(message: '这一天暂无负责的任务');
    if (!vertical) {
      return _HorizontalAxis(
        layout: layout,
        onOpen: onOpen,
        onDragStarted: onDragStarted,
        onDragUpdate: onDragUpdate,
        onDragEnd: onDragEnd,
        onAccessibleAdjust: onAccessibleAdjust,
      );
    }
    return Column(
      children: [
        if (layout.allDay.isNotEmpty) _AllDayStrip(entries: layout.allDay, onOpen: onOpen),
        Expanded(
          child: _VerticalAxis(
            layout: layout,
            onOpen: onOpen,
            onDragStarted: onDragStarted,
            onDragUpdate: onDragUpdate,
            onDragEnd: onDragEnd,
            onAccessibleAdjust: onAccessibleAdjust,
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
                ActionChip(
                  label: Text(entry.task.title, overflow: TextOverflow.ellipsis),
                  avatar: entry.pendingProjection ? const Icon(Icons.edit_calendar_outlined, size: 14) : null,
                  onPressed: () => onOpen(entry.task.id),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HorizontalAxis extends StatelessWidget {
  const _HorizontalAxis({
    required this.layout,
    required this.onOpen,
    required this.onDragStarted,
    required this.onDragUpdate,
    required this.onDragEnd,
    required this.onAccessibleAdjust,
  });

  final DayAxisLayout layout;
  final ValueChanged<String> onOpen;
  final void Function(_AxisDragData, Offset) onDragStarted;
  final void Function(Offset) onDragUpdate;
  final void Function(_AxisDragData) onDragEnd;
  final void Function(DayAxisEntry, CalendarDragMode, int) onAccessibleAdjust;

  static const double _timelineWidth = 1440;
  static const double _rowHeight = 38;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: SizedBox(
        width: _timelineWidth,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const _TimeRuler(rowHeight: 24, timelineWidth: _timelineWidth),
            for (final entry in layout.entries)
              SizedBox(
                height: _rowHeight,
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final start = entry.startMinutes.clamp(0, 1440);
                    final end = entry.endMinutes.clamp(start, 1440);
                    final left = start / 1440 * constraints.maxWidth;
                    final width = ((end - start) / 1440 * constraints.maxWidth).clamp(8.0, constraints.maxWidth);
                    return Stack(
                      children: [
                        Positioned.fill(child: Container(decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: PandoraColors.line))))),
                        Positioned(
                          left: left,
                          width: width,
                          top: 5,
                          bottom: 5,
                          child: _AxisTaskBlock(
                            entry: entry,
                            onOpen: onOpen,
                            compact: false,
                            vertical: false,
                            pixelsPerHour: constraints.maxWidth / 24,
                            onDragStarted: onDragStarted,
                            onDragUpdate: onDragUpdate,
                            onDragEnd: onDragEnd,
                            onAccessibleAdjust: onAccessibleAdjust,
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _VerticalAxis extends StatelessWidget {
  const _VerticalAxis({
    required this.layout,
    required this.onOpen,
    required this.onDragStarted,
    required this.onDragUpdate,
    required this.onDragEnd,
    required this.onAccessibleAdjust,
  });

  final DayAxisLayout layout;
  final ValueChanged<String> onOpen;
  final void Function(_AxisDragData, Offset) onDragStarted;
  final void Function(Offset) onDragUpdate;
  final void Function(_AxisDragData) onDragEnd;
  final void Function(DayAxisEntry, CalendarDragMode, int) onAccessibleAdjust;

  static const double _hourHeight = 44;
  static const double _labelWidth = 40;
  static const double _laneWidth = 128;
  static const double _axisHeight = 24 * _hourHeight;

  @override
  Widget build(BuildContext context) {
    final laneCount = layout.timedLanes.isEmpty ? 1 : layout.timedLanes.length;
    final width = _labelWidth + laneCount * _laneWidth;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: SizedBox(
        width: width,
        child: SingleChildScrollView(
          child: SizedBox(
            height: _axisHeight,
            child: Stack(
              children: [
                for (var hour = 0; hour <= 24; hour++)
                  Positioned(
                    left: 0,
                    right: 0,
                    top: hour * _hourHeight,
                    child: Row(
                      children: [
                        SizedBox(
                          width: _labelWidth,
                          child: Text(
                            '${hour.toString().padLeft(2, '0')}:00',
                            style: const TextStyle(fontSize: 9, color: PandoraColors.muted),
                          ),
                        ),
                        Expanded(child: Container(height: 1, color: hour % 3 == 0 ? PandoraColors.line : PandoraColors.petal)),
                      ],
                    ),
                  ),
                for (final entry in layout.entries.where((entry) => !entry.allDay))
                  Positioned(
                    left: _labelWidth + entry.lane * _laneWidth + 2,
                    width: _laneWidth - 4,
                    top: entry.startMinutes / 1440 * _axisHeight + 1,
                    height: ((entry.endMinutes - entry.startMinutes) / 1440 * _axisHeight).clamp(22.0, _axisHeight),
                    child: _AxisTaskBlock(
                      entry: entry,
                      onOpen: onOpen,
                      compact: true,
                      vertical: true,
                      pixelsPerHour: _hourHeight,
                      onDragStarted: onDragStarted,
                      onDragUpdate: onDragUpdate,
                      onDragEnd: onDragEnd,
                      onAccessibleAdjust: onAccessibleAdjust,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TimeRuler extends StatelessWidget {
  const _TimeRuler({required this.rowHeight, required this.timelineWidth});

  final double rowHeight;
  final double timelineWidth;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: rowHeight,
      child: Stack(
        children: [
          for (var hour = 0; hour <= 24; hour += 3)
            Positioned(
              left: hour / 24 * timelineWidth,
              top: 4,
              child: Text('${hour.toString().padLeft(2, '0')}:00', style: const TextStyle(fontSize: 9, color: PandoraColors.muted)),
            ),
        ],
      ),
    );
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

  @override
  Widget build(BuildContext context) {
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
      if (entry.canDrag) const CustomSemanticsAction(label: '后移一小时'): () => onAccessibleAdjust(entry, CalendarDragMode.move, 1),
      if (entry.canDrag) const CustomSemanticsAction(label: '前移一小时'): () => onAccessibleAdjust(entry, CalendarDragMode.move, -1),
      if (entry.canDrag) const CustomSemanticsAction(label: '起点后移一小时'): () => onAccessibleAdjust(entry, CalendarDragMode.start, 1),
      if (entry.canDrag) const CustomSemanticsAction(label: '起点前移一小时'): () => onAccessibleAdjust(entry, CalendarDragMode.start, -1),
      if (entry.canDrag) const CustomSemanticsAction(label: '终点后移一小时'): () => onAccessibleAdjust(entry, CalendarDragMode.end, 1),
      if (entry.canDrag) const CustomSemanticsAction(label: '终点前移一小时'): () => onAccessibleAdjust(entry, CalendarDragMode.end, -1),
    };
    final block = Semantics(
      button: true,
      label: '${entry.task.title}，${entry.allDay ? '全天' : '${entry.startMinutes ~/ 60}:${(entry.startMinutes % 60).toString().padLeft(2, '0')}'}',
      customSemanticsActions: entry.canDrag ? actions : null,
      child: GestureDetector(
        onTap: () => onOpen(entry.task.id),
        child: CustomPaint(
          foregroundPainter: entry.pendingProjection ? const _DashedBorderPainter() : null,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
            decoration: BoxDecoration(
              color: _color(entry.color),
              borderRadius: BorderRadius.circular(4),
              border: entry.canDrag ? Border.all(color: Colors.white.withValues(alpha: .5), width: .5) : null,
            ),
            child: Text(
              entry.task.title,
              maxLines: compact ? 2 : 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 9, height: 1.1),
            ),
          ),
        ),
      ),
    );
    if (!entry.canDrag) return block;
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
            onLongPressMoveUpdate: (details) => onDragUpdate(details.globalPosition),
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
                child: _axisHandle(startData, start: true, key: ValueKey('axis-start-${entry.task.id}')),
              )
            : Positioned(
                left: -2,
                top: 0,
                bottom: 0,
                width: 14,
                child: _axisHandle(startData, start: true, key: ValueKey('axis-start-${entry.task.id}')),
              ),
        vertical
            ? Positioned(
                left: 0,
                right: 0,
                bottom: -2,
                height: 14,
                child: _axisHandle(endData, start: false, key: ValueKey('axis-end-${entry.task.id}')),
              )
            : Positioned(
                right: -2,
                top: 0,
                bottom: 0,
                width: 14,
                child: _axisHandle(endData, start: false, key: ValueKey('axis-end-${entry.task.id}')),
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
        child: Container(
          alignment: Alignment.center,
          child: Container(
            width: vertical ? 24 : 4,
            height: vertical ? 4 : 18,
            decoration: BoxDecoration(color: PandoraColors.brand, borderRadius: BorderRadius.circular(3)),
          ),
        ),
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
    final path = Path()..addRRect(RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(6)));
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
