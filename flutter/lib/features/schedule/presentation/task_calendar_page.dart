import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/company/company_date.dart';
import '../../../core/company/company_time.dart';
import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/state_views.dart';
import '../../daily_items/domain/month_layout.dart';
import '../../holidays/domain/holiday_calendar.dart';
import '../../holidays/presentation/holiday_providers.dart';
import '../../tasks/domain/task_record.dart';
import '../data/schedule_api.dart';
import '../domain/task_calendar.dart';

class TaskCalendarPage extends ConsumerStatefulWidget {
  const TaskCalendarPage({super.key});

  @override
  ConsumerState<TaskCalendarPage> createState() => _TaskCalendarPageState();
}

class _TaskCalendarPageState extends ConsumerState<TaskCalendarPage> {
  final Map<String, List<TaskRecord>> _tasks = {};
  final Set<String> _loading = {};
  final Map<String, Object> _errors = {};
  final Map<int, HolidayYear> _holidays = {};
  late CompanyDate _anchor;
  final _scroll = ScrollController();
  final _currentMonthKey = GlobalKey();
  bool _dayVertical = false;

  @override
  void initState() {
    super.initState();
    _anchor = ref.read(businessDateProvider);
    final months = CompanyCalendarGrid.continuousMonths(
      _anchor,
      monthsBefore: 12,
      monthsAfter: 24,
    );
    final index = months.indexWhere(
      (month) => month.year == _anchor.year && month.month == _anchor.month,
    );
    _scroll.addListener(_loadVisibleMonths);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (index > 0) _scroll.jumpTo(index * 510.0);
      _scrollToCurrentMonth();
      _loadAround(_anchor);
    });
  }

  @override
  void dispose() {
    _scroll
      ..removeListener(_loadVisibleMonths)
      ..dispose();
    super.dispose();
  }

  void _loadVisibleMonths() {
    if (!_scroll.hasClients) return;
    final months = CompanyCalendarGrid.continuousMonths(
      _anchor,
      monthsBefore: 12,
      monthsAfter: 24,
    );
    final first = (_scroll.offset / 510).floor().clamp(0, months.length - 1);
    final last = ((_scroll.offset + _scroll.position.viewportDimension) / 510)
        .ceil()
        .clamp(0, months.length);
    for (var index = first; index < last; index++) {
      final month = months[index];
      if (_tasks.containsKey(_key(month)) || _loading.contains(_key(month))) {
        continue;
      }
      unawaited(_loadMonth(month));
    }
  }

  void _scrollToCurrentMonth() {
    final context = _currentMonthKey.currentContext;
    if (context != null) {
      Scrollable.ensureVisible(
        context,
        alignment: 0,
        duration: const Duration(milliseconds: 250),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final months = CompanyCalendarGrid.continuousMonths(
      _anchor,
      monthsBefore: 12,
      monthsAfter: 24,
    );
    return Scaffold(
      appBar: AppBar(
        title: const Text('日程'),
        actions: [
          TextButton(onPressed: _scrollToCurrentMonth, child: const Text('今天')),
          IconButton(
            tooltip: '任务表单',
            onPressed: () => context.push('/tasks/table'),
            icon: const Icon(Icons.table_chart_outlined),
          ),
          IconButton(
            tooltip: '我的申请与审核',
            onPressed: () => context.push('/approvals'),
            icon: const Icon(Icons.assignment_outlined),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        tooltip: '新建任务',
        onPressed: () => context.push('/tasks/new'),
        child: const Icon(Icons.add),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _loadAround(_anchor),
          child: ListView.builder(
            controller: _scroll,
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 96),
            itemCount: months.length,
            itemBuilder: (context, index) {
              final month = months[index];
              final current =
                  month.year == _anchor.year && month.month == _anchor.month;
              return KeyedSubtree(
                key: current ? _currentMonthKey : null,
                child: _MonthBlock(
                  month: month,
                  tasks: _tasks[_key(month)] ?? const [],
                  businessDate: _anchor,
                  loading: _loading.contains(_key(month)),
                  error: _errors[_key(month)],
                  onRetry: () => _loadMonth(month),
                  holidays: _holidays[month.year],
                  onDay: (day) => _openDay(day),
                  onTaskDrop: _dropTask,
                  onPin: _togglePin,
                  onOpenTask: (id) => context.push('/tasks/$id'),
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

  Future<void> _loadAround(CompanyDate anchor) async {
    final months = CompanyCalendarGrid.continuousMonths(
      anchor,
      monthsBefore: 12,
      monthsAfter: 24,
    );
    final center = months.indexWhere(
      (month) => month.year == anchor.year && month.month == anchor.month,
    );
    if (center < 0) return;
    for (var index = center - 2; index <= center + 2; index++) {
      if (index < 0 || index >= months.length) continue;
      final month = months[index];
      if (_tasks.containsKey(_key(month)) || _loading.contains(_key(month))) {
        continue;
      }
      unawaited(_loadMonth(month));
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
      final holidayFuture = ref
          .read(holidayRepositoryProvider)
          .load(month.year);
      final from = month.firstDayOfMonth.addDays(-7);
      final to = month.lastDayOfMonth.addDays(7);
      final rows = await ref
          .read(scheduleApiProvider)
          .listCalendarTasks(
            assigneeId: ref.read(currentUserProvider)?.id ?? '',
            from: from.iso,
            to: to.iso,
          );
      HolidayYear? holidays;
      try {
        holidays = await holidayFuture;
      } catch (_) {
        // 节假日失败不得阻止任务日历；月份仍正常显示。
      }
      if (!mounted) return;
      setState(() {
        _tasks[key] = rows;
        if (holidays != null) _holidays[month.year] = holidays;
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

  Future<void> _openDay(CompanyDate day) async {
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
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => _DaySheet(
        day: day,
        tasks: tasks,
        vertical: _dayVertical,
        onVerticalChanged: (value) => setState(() => _dayVertical = value),
        onCreate: () => context.push('/tasks/new?date=${day.iso}'),
        onOpen: (id) {
          Navigator.of(context).pop();
          context.push('/tasks/$id');
        },
        onPin: _togglePin,
      ),
    );
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
      await ref
          .read(scheduleApiProvider)
          .setCalendarPin(
            taskId: task.id,
            pinned: pinned,
            idempotencyKey: idempotency,
          );
      key.complete('calendar-pin:${task.id}');
      await _loadAround(_anchor);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _dropTask(
    TaskCalendarSelection selection,
    CompanyDate target,
  ) async {
    final all = _tasks.values.expand((rows) => rows).toList();
    final task = all.where((row) => row.id == selection.taskId).firstOrNull;
    if (task == null ||
        !task.published ||
        task.pending ||
        task.done ||
        task.frozen) {
      return;
    }
    if (!task.canReschedule || !task.canEditField('startAt')) return;
    final delta = target.differenceInDays(selection.grabDay);
    if (delta == 0) return;
    final Map<String, Object?> payload;
    if (task.allDay) {
      final start = task.allDayStart;
      final due = task.allDayEnd;
      if (start == null || due == null) return;
      payload = {
        'allDay': true,
        'startDate': start.addDays(delta).iso,
        'dueDate': due.addDays(delta).iso,
      };
    } else {
      final start = task.startAt;
      final due = task.dueAt;
      if (start == null || due == null) return;
      payload = {
        'allDay': false,
        'startAt': start.add(Duration(days: delta)).toUtc().toIso8601String(),
        'dueAt': due.add(Duration(days: delta)).toUtc().toIso8601String(),
      };
    }
    final reason = await _askReason(context, '调整排期');
    if (reason == null) return;
    final keys = ref.read(operationKeysProvider);
    final key = keys.keyFor(
      scope: 'calendar-move:${task.id}',
      method: 'PATCH',
      path: '/tasks/${task.id}',
      body: {'command': 'reschedule', ...payload, 'reason': reason},
    );
    try {
      await ref
          .read(scheduleApiProvider)
          .change(
            id: task.id,
            command: 'reschedule',
            payload: {...payload, 'reason': reason},
            idempotencyKey: key,
          );
      keys.complete('calendar-move:${task.id}');
      await _loadAround(_anchor);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }
}

Future<String?> _askReason(BuildContext context, String title) async {
  final controller = TextEditingController();
  final value = await showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: controller,
        maxLength: 500,
        autofocus: true,
        decoration: const InputDecoration(labelText: '原因（必填）'),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('取消'),
        ),
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
  controller.dispose();
  return value;
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
    required this.onTaskDrop,
    required this.onPin,
    required this.onOpenTask,
    required this.holidays,
  });

  final CompanyDate month;
  final List<TaskRecord> tasks;
  final CompanyDate businessDate;
  final bool loading;
  final Object? error;
  final VoidCallback onRetry;
  final ValueChanged<CompanyDate> onDay;
  final Future<void> Function(TaskCalendarSelection, CompanyDate) onTaskDrop;
  final Future<void> Function(TaskRecord) onPin;
  final ValueChanged<String> onOpenTask;
  final HolidayYear? holidays;

  @override
  Widget build(BuildContext context) {
    final projected = tasks
        .map(
          (task) => CalendarTask(
            task: task,
            pendingProjection: task.pending && task.pendingSchedule != null,
          ),
        )
        .toList();
    final layout = MonthLayoutCalculator.compute(
      month: month,
      items: projected.map(pseudoItem).toList(),
    );
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
                const Spacer(),
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
            if (holidays?.status == HolidayCacheStatus.stale)
              const Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  '节假日标签为最近有效缓存',
                  style: TextStyle(fontSize: 10, color: PandoraColors.muted),
                ),
              )
            else if (holidays?.status == HolidayCacheStatus.missing)
              const Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  '本年官方节假日尚未公布',
                  style: TextStyle(fontSize: 10, color: PandoraColors.muted),
                ),
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
              SizedBox(
                height: 74,
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final cellWidth = constraints.maxWidth / 7;
                    return Stack(
                      children: [
                        Row(
                          children: [
                            for (var i = 0; i < 7; i++)
                              Expanded(
                                child: DragTarget<TaskCalendarSelection>(
                                  onAcceptWithDetails: (details) => onTaskDrop(
                                    details.data,
                                    week.days[i].date,
                                  ),
                                  builder: (context, candidate, rejected) {
                                    final day = week.days[i];
                                    final isToday = day.date == businessDate;
                                    final holiday =
                                        holidays?.byDate[day.date.iso];
                                    return InkWell(
                                      onTap: day.inMonth
                                          ? () => onDay(day.date)
                                          : null,
                                      child: Container(
                                        margin: const EdgeInsets.all(1),
                                        decoration: BoxDecoration(
                                          color: isToday
                                              ? PandoraColors.petal
                                              : (candidate.isNotEmpty
                                                    ? PandoraColors.mint
                                                    : Colors.transparent),
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
                                                  style: const TextStyle(
                                                    fontSize: 11,
                                                  ),
                                                ),
                                                if (holiday != null) ...[
                                                  const SizedBox(width: 2),
                                                  Expanded(
                                                    child: Text(
                                                      '${holiday.name}${holiday.isOffDay ? '·休' : '·班'}',
                                                      maxLines: 1,
                                                      overflow:
                                                          TextOverflow.ellipsis,
                                                      style: TextStyle(
                                                        fontSize: 8,
                                                        color: holiday.isOffDay
                                                            ? PandoraColors
                                                                  .brand
                                                            : PandoraColors
                                                                  .muted,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ],
                                            ),
                                            for (
                                              var lane = 0;
                                              lane < MonthLayout.maxLanes;
                                              lane++
                                            )
                                              if (week.bars
                                                  .where(
                                                    (bar) =>
                                                        bar.lane == lane &&
                                                        bar.startColumn <= i &&
                                                        bar.endColumn >= i,
                                                  )
                                                  .isNotEmpty)
                                                const SizedBox(height: 15),
                                            if (day.overflowCount > 0)
                                              Text(
                                                '+${day.overflowCount}',
                                                style: const TextStyle(
                                                  fontSize: 10,
                                                  color: PandoraColors.brand,
                                                ),
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
                        for (final bar in week.bars)
                          Positioned(
                            left: bar.startColumn * cellWidth + 2,
                            top: 18 + bar.lane * 16,
                            width:
                                ((bar.endColumn - bar.startColumn + 1) *
                                            cellWidth -
                                        4)
                                    .clamp(2, double.infinity),
                            height: 15,
                            child: Builder(
                              builder: (barContext) {
                                final selection = TaskCalendarSelection(
                                  taskId: bar.itemId,
                                  grabDay: week.days[bar.startColumn].date,
                                );
                                return Listener(
                                  onPointerDown: (event) {
                                    final box = barContext.findRenderObject();
                                    if (box is! RenderBox) return;
                                    final localX = box
                                        .globalToLocal(event.position)
                                        .dx;
                                    final offset = (localX / cellWidth)
                                        .floor()
                                        .clamp(
                                          0,
                                          bar.endColumn - bar.startColumn,
                                        );
                                    selection.grabDay = week
                                        .days[bar.startColumn + offset]
                                        .date;
                                  },
                                  child:
                                      LongPressDraggable<TaskCalendarSelection>(
                                        delay: const Duration(
                                          milliseconds: 500,
                                        ),
                                        hapticFeedbackOnStart: true,
                                        data: selection,
                                        feedback: Material(
                                          elevation: 4,
                                          child: Container(
                                            constraints: const BoxConstraints(
                                              maxWidth: 220,
                                            ),
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 4,
                                            ),
                                            decoration: BoxDecoration(
                                              color: Colors.white,
                                              borderRadius:
                                                  BorderRadius.circular(12),
                                            ),
                                            child: Text(
                                              bar.name,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
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
                                          onTap: () => onDay(
                                            week.days[bar.endColumn].date,
                                          ),
                                          onLongPress: () => onDay(
                                            week.days[bar.startColumn].date,
                                          ),
                                          child: _taskBar(
                                            context,
                                            bar,
                                            projected,
                                          ),
                                        ),
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
          ],
        ),
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
    final pending = item?.pendingProjection == true;
    return Container(
      alignment: Alignment.centerLeft,
      padding: const EdgeInsets.symmetric(horizontal: 5),
      decoration: BoxDecoration(
        color: _color(color),
        borderRadius: BorderRadius.circular(6),
        border: pending
            ? Border.all(color: PandoraColors.brand, style: BorderStyle.solid)
            : null,
      ),
      child: Text(
        bar.name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontSize: 10),
      ),
    );
  }

  Color _color(String value) {
    final hex = value.replaceFirst('#', '');
    final parsed = int.tryParse(hex, radix: 16);
    return parsed == null ? PandoraColors.petal : Color(0xFF000000 | parsed);
  }
}

class _DaySheet extends StatelessWidget {
  const _DaySheet({
    required this.day,
    required this.tasks,
    required this.vertical,
    required this.onVerticalChanged,
    required this.onCreate,
    required this.onOpen,
    required this.onPin,
  });

  final CompanyDate day;
  final List<TaskRecord> tasks;
  final bool vertical;
  final ValueChanged<bool> onVerticalChanged;
  final VoidCallback onCreate;
  final ValueChanged<String> onOpen;
  final Future<void> Function(TaskRecord) onPin;

  @override
  Widget build(BuildContext context) {
    final zone = CompanyTimeZone.fallback;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: SizedBox(
          height: MediaQuery.of(context).size.height * .72,
          child: Column(
            children: [
              ListTile(
                title: Text('${day.iso} 完整清单'),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      tooltip: vertical ? '切换横向日轴' : '切换纵向日轴',
                      onPressed: () => onVerticalChanged(!vertical),
                      icon: Icon(
                        vertical
                            ? Icons.view_stream_outlined
                            : Icons.view_agenda_outlined,
                      ),
                    ),
                    IconButton(
                      onPressed: onCreate,
                      tooltip: '新建任务',
                      icon: const Icon(Icons.add),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      tooltip: '关闭',
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: tasks.isEmpty
                    ? const EmptyView(message: '这一天暂无负责的任务')
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
                        itemCount: tasks.length,
                        separatorBuilder: (_, _) => const Divider(height: 1),
                        itemBuilder: (context, index) {
                          final task = tasks[index];
                          final start = task.allDay
                              ? task.allDayStart?.iso ?? '全天'
                              : (task.startAt == null
                                    ? '—'
                                    : zone.formatDateTime(task.startAt!));
                          return ListTile(
                            leading: Icon(
                              task.pinned ? Icons.push_pin : Icons.task_alt,
                              color: task.pinned
                                  ? PandoraColors.brand
                                  : PandoraColors.muted,
                            ),
                            title: Text(task.title),
                            subtitle: Text(
                              '${task.done ? '已完成 · ' : ''}${task.pending ? '审核中 · ' : ''}$start',
                            ),
                            trailing: IconButton(
                              tooltip: task.pinned ? '取消日历置顶' : '置顶到我的月视图',
                              onPressed: () => onPin(task),
                              icon: Icon(
                                task.pinned
                                    ? Icons.push_pin
                                    : Icons.push_pin_outlined,
                              ),
                            ),
                            onTap: () => onOpen(task.id),
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
}
