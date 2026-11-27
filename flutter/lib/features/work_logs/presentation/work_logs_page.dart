import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/company/company_date.dart';
import '../../../core/company/company_time.dart';
import '../../../core/company/date_picker_bounds.dart';
import '../../../core/navigation/tab_refresh.dart';
import '../../../core/providers.dart';
import '../../../core/router/navigation_targets.dart';
import '../../../core/router/read_context.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/state_views.dart';
import '../../comments/presentation/comments_section.dart';
import '../../tasks/domain/task_record.dart';
import '../../tasks/presentation/task_providers.dart';
import '../../tags/presentation/tag_badge.dart';
import '../../tags/presentation/tag_selector.dart';
import '../../tags/presentation/tags_providers.dart';
import '../domain/work_log.dart';
import '../domain/work_log_fill.dart';
import 'log_body_preview.dart';
import 'work_logs_providers.dart';

class WorkLogsPage extends ConsumerStatefulWidget {
  const WorkLogsPage({
    super.key,
    this.authorId,
    this.personName,
    this.readContext = const NormalReadContext(),
  });
  final String? authorId;
  final String? personName;
  final ReadContext readContext;
  @override
  ConsumerState<WorkLogsPage> createState() => _WorkLogsPageState();
}

class _WorkLogsPageState extends ConsumerState<WorkLogsPage> {
  final _scroll = ScrollController();
  List<WorkLog> _items = const [];
  int _total = 0;
  int? _next;
  DateTime? _from;
  DateTime? _to;
  bool _loading = false;
  Object? _error;
  int _queryGeneration = 0;

  @override
  void initState() {
    super.initState();
    unawaited(_load(reset: true));
  }

  @override
  void didUpdateWidget(covariant WorkLogsPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.authorId == widget.authorId) return;
    _queryGeneration += 1;
    _loading = false;
    unawaited(_load(reset: true));
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load({required bool reset}) async {
    if (_loading && !reset) return;
    final generation = reset ? ++_queryGeneration : _queryGeneration;
    final authorId = widget.authorId;
    setState(() {
      _loading = true;
      _error = null;
      if (reset) {
        _items = const [];
        _next = 0;
      }
    });
    try {
      final page = await ref
          .read(workLogsApiProvider)
          .list(
            scope: widget.authorId == null ? 'self' : 'visible',
            authorId: authorId,
            from: _dateIso(_from),
            to: _dateIso(_to),
            offset: reset ? 0 : (_next ?? 0),
          );
      if (!mounted ||
          generation != _queryGeneration ||
          authorId != widget.authorId) {
        return;
      }
      setState(() {
        final merged = <String, WorkLog>{};
        for (final log in [..._items, ...page.items]) {
          merged[log.id] = log;
        }
        _items = merged.values.toList();
        _total = page.total;
        _next = page.nextOffset;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || generation != _queryGeneration) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  /// Refresh the loaded window without clearing the visible list. The previous
  /// number of rows is re-read in pages, then the scroll offset is restored.
  Future<void> _refreshPreserving() async {
    final target = _items.length;
    final offset = _scroll.hasClients ? _scroll.offset : 0.0;
    if (target == 0) {
      await _load(reset: true);
      return;
    }
    final generation = ++_queryGeneration;
    final authorId = widget.authorId;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final merged = <String, WorkLog>{};
      var pageOffset = 0;
      var total = _total;
      int? next;
      while (merged.length < target) {
        final page = await ref
            .read(workLogsApiProvider)
            .list(
              scope: widget.authorId == null ? 'self' : 'visible',
              authorId: authorId,
              from: _dateIso(_from),
              to: _dateIso(_to),
              limit: 50,
              offset: pageOffset,
            );
        if (!mounted ||
            generation != _queryGeneration ||
            authorId != widget.authorId) {
          return;
        }
        for (final log in page.items) {
          merged[log.id] = log;
        }
        total = page.total;
        next = page.nextOffset;
        if (page.items.isEmpty || next == null || next <= pageOffset) break;
        pageOffset = next;
      }
      setState(() {
        _items = merged.values.toList();
        _total = total;
        _next = next;
        _loading = false;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _scroll.hasClients) {
          _scroll.jumpTo(offset.clamp(0, _scroll.position.maxScrollExtent));
        }
      });
    } catch (error) {
      if (!mounted || generation != _queryGeneration) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  String? _dateIso(DateTime? value) => value == null
      ? null
      : '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';

  Future<void> _returnFromDetail(String id) async {
    final offset = _scroll.hasClients ? _scroll.offset : 0.0;
    final generation = _queryGeneration;
    final author = widget.authorId;
    final saved = await context.push<WorkLog>(
      '/logs/$id',
      extra: widget.readContext,
    );
    if (!mounted ||
        generation != _queryGeneration ||
        author != widget.authorId) {
      return;
    }
    if (saved != null) _applySavedLog(saved);
    // 按同一权限重验该条；迟到或更旧响应被版本守卫忽略，不改动分页与其他行。
    unawaited(_revalidateOne(id, generation));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _scroll.hasClients) {
        _scroll.jumpTo(offset.clamp(0, _scroll.position.maxScrollExtent));
      }
    });
  }

  bool _matchesDateFilter(WorkLog log) {
    final from = _from;
    final to = _to;
    final day = DateTime(
      log.businessDate.year,
      log.businessDate.month,
      log.businessDate.day,
    );
    if (from != null &&
        day.isBefore(DateTime(from.year, from.month, from.day))) {
      return false;
    }
    if (to != null && day.isAfter(DateTime(to.year, to.month, to.day))) {
      return false;
    }
    return true;
  }

  bool _withinAuthorScope(WorkLog log) {
    final author = widget.authorId;
    if (author != null) return log.authorId == author;
    final me = ref.read(currentUserProvider)?.id;
    return me == null || log.authorId.isEmpty || log.authorId == me;
  }

  /// 只替换同一条已保存版本：保留分页、筛选与浏览位置，不整表重置。
  void _applySavedLog(WorkLog saved) {
    if (!mounted || !_withinAuthorScope(saved)) return;
    final index = _items.indexWhere((log) => log.id == saved.id);
    if (index < 0) {
      if (!_matchesDateFilter(saved)) return;
      setState(() {
        _items = [saved, ..._items];
        _total += 1;
      });
      return;
    }
    if (saved.rowVersion < _items[index].rowVersion) return;
    setState(() {
      final next = List<WorkLog>.from(_items);
      if (_matchesDateFilter(saved)) {
        next[index] = saved;
      } else {
        next.removeAt(index);
        _total = _total > 0 ? _total - 1 : 0;
      }
      _items = next;
    });
  }

  Future<void> _revalidateOne(String id, int generation) async {
    if (!mounted || generation != _queryGeneration) return;
    try {
      final fresh = await ref.read(workLogsApiProvider).detail(id);
      if (!mounted || generation != _queryGeneration) return;
      _applySavedLog(fresh);
    } catch (_) {
      // 已保存的本地版本仍然有效；读取失败不能回滚或清空列表。
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listenTabRefresh(AppTab.logs, () {
      unawaited(_refreshPreserving());
    });
    return PandoraPage(
      title: '${widget.personName ?? '日志'} · $_total 条',
      titleWidget: widget.personName == null
          ? Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const PandoraPageMark(pageName: '日志'),
                const SizedBox(width: 8),
                Text(
                  '$_total 条',
                  style: Theme.of(context).textTheme.labelMedium
                      ?.copyWith(color: PandoraColors.muted),
                ),
              ],
            )
          : null,
      actions: [
        if (widget.readContext.businessWritesAllowed)
          IconButton(
            tooltip: '写日志',
            onPressed: () async {
              final saved = await context.push<WorkLog>('/logs/new');
              if (!mounted) return;
              if (saved != null) await _load(reset: true);
            },
            icon: const Icon(Icons.add),
          ),
      ],
      child: Column(
        children: [
          _filters(),
          const Divider(height: 1),
          Expanded(child: _body()),
        ],
      ),
    );
  }

  Widget _filters() {
    final active = _from != null || _to != null;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 8,
        runSpacing: 4,
        children: [
          Text(
            widget.authorId == null ? '本人日志' : '下属日志（只读）',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          OutlinedButton.icon(
            onPressed: _openDateFilter,
            icon: const Icon(Icons.filter_alt_outlined, size: 18),
            label: Text(active ? '筛选（${_filterSummary()}）' : '筛选'),
          ),
        ],
      ),
    );
  }

  String _filterSummary() {
    final since = _from == null ? '不限' : _dateIso(_from);
    final until = _to == null ? '不限' : _dateIso(_to);
    return '$since 至 $until';
  }

  Future<void> _openDateFilter() async {
    var from = _from;
    var to = _to;
    Future<DateTime?> pick(DateTime? current, {DateTime? start}) {
      return showDatePicker(
        context: context,
        initialDate: DatePickerBounds.clampInitial(
          current ?? DateTime.now(),
          start,
        ),
        firstDate: DateTime(DateTime.now().year - 5),
        lastDate: DateTime(DateTime.now().year + 5),
        selectableDayPredicate: start == null
            ? null
            : (day) => DatePickerBounds.endOnOrAfter(day, start),
        helpText: '选择日期',
      );
    }

    final result = await showModalBottomSheet<_LogFilterResult>(
      context: context,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => SafeArea(
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              16,
              16,
              16,
              MediaQuery.viewInsetsOf(context).bottom + 16,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('筛选日志日期', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () async {
                    final picked = await pick(from);
                    if (picked == null) return;
                    setSheetState(() {
                      from = picked;
                      if (to != null && to!.isBefore(picked)) to = null;
                    });
                  },
                  child: Text(
                    from == null ? '开始日期：不限' : '开始日期：${_dateIso(from)}',
                  ),
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () async {
                    final picked = await pick(to, start: from);
                    if (picked == null) return;
                    setSheetState(() => to = picked);
                  },
                  child: Text(to == null ? '结束日期：不限' : '结束日期：${_dateIso(to)}'),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    TextButton(
                      onPressed: () =>
                          Navigator.of(context)
                              .pop(const _LogFilterResult.clear()),
                      child: const Text('清除'),
                    ),
                    const Spacer(),
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('取消'),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: () =>
                          Navigator.of(context)
                              .pop(_LogFilterResult.range(from: from, to: to)),
                      child: const Text('应用'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (result == null || !mounted) return;
    setState(() {
      _from = result.clear ? null : result.from;
      _to = result.clear ? null : result.to;
    });
    await _load(reset: true);
  }

  Widget _body() {
    if (_error != null && _items.isEmpty) {
      return ErrorView(error: _error!, onRetry: () => _load(reset: true));
    }
    if (_items.isEmpty) {
      return _loading ? const LoadingView() : const EmptyView(message: '还没有日志');
    }
    return RefreshIndicator(
      onRefresh: _refreshPreserving,
      child: ListView.separated(
        controller: _scroll,
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        itemCount: _items.length + 1,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          if (index == _items.length) {
            if (_next == null) return const SizedBox.shrink();
            return OutlinedButton(
              onPressed: _loading ? null : () => _load(reset: false),
              child: Text(_loading ? '加载中…' : '加载更多'),
            );
          }
          final log = _items[index];
          return Card(
            child: InkWell(
              onTap: () => _returnFromDetail(log.id),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          '${log.businessDate.year}年${log.businessDate.month}月${log.businessDate.day}日',
                          style: Theme.of(context).textTheme.labelLarge
                              ?.copyWith(color: PandoraColors.brand),
                        ),
                        if (log.frozen)
                          const StatusBadge(
                            label: '已不能编辑',
                            color: PandoraColors.muted,
                          ),
                        if (_relative(
                          log,
                          ref.read(businessDateProvider),
                        ).isNotEmpty)
                          Text(
                            _relative(log, ref.read(businessDateProvider)),
                            style: const TextStyle(
                              fontSize: 12,
                              color: PandoraColors.muted,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    LogBodyPreview(
                      log.body,
                      maxLines: 3,
                      style: const TextStyle(fontSize: 15, height: 1.55),
                    ),
                    if (log.tags.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Wrap(
                          spacing: 6,
                          children: [
                            for (final tag in log.tags) TagBadge(tag: tag),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  String _relative(WorkLog log, CompanyDate today) {
    final value = CompanyTimeZone.fallback.relativeDateLabel(
      log.businessDate,
      today,
    );
    return value == log.businessDate.iso ? '' : value;
  }
}

class _LogFilterResult {
  const _LogFilterResult.range({this.from, this.to}) : clear = false;

  const _LogFilterResult.clear() : from = null, to = null, clear = true;

  final DateTime? from;
  final DateTime? to;
  final bool clear;
}

class WorkLogEditorPage extends ConsumerStatefulWidget {
  const WorkLogEditorPage({super.key, this.logId, this.initialDate});
  final String? logId;
  final CompanyDate? initialDate;
  @override
  ConsumerState<WorkLogEditorPage> createState() => _WorkLogEditorPageState();
}

class _WorkLogEditorPageState extends ConsumerState<WorkLogEditorPage> {
  final _body = TextEditingController();
  final _reason = TextEditingController();
  late CompanyDate _date;
  List<TaskTag> _catalog = const [];
  List<TaskRecord> _tasks = const [];
  List<CompanyDate> _missingDates = const [];
  List<String> _tagIds = const [];
  String? _taskId;
  WorkLog? _existing;
  bool _saving = false;
  bool _loading = true;
  bool _allowPop = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _date = widget.initialDate ?? ref.read(businessDateProvider);
    _body.addListener(_onBodyChanged);
    unawaited(_load());
  }

  void _onBodyChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _body.removeListener(_onBodyChanged);
    _body.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final tags = await ref.read(tagsApiProvider).list();
      final tasks = await ref.read(tasksApiProvider).listTasks(limit: 100);
      WorkLog? existing;
      var missing = const <CompanyDate>[];
      if (widget.logId != null) {
        existing = await ref.read(workLogsApiProvider).detail(widget.logId!);
      } else {
        final today = ref.read(businessDateProvider);
        final existingLogs = await ref
            .read(workLogsApiProvider)
            .list(from: today.addDays(-2).iso, to: today.iso, limit: 100);
        final occupied = {
          for (final log in existingLogs.items) log.businessDate,
        };
        missing = [
          for (var offset = 0; offset < 3; offset++)
            if (!occupied.contains(today.addDays(-offset)))
              today.addDays(-offset),
        ];
      }
      if (!mounted) return;
      setState(() {
        _catalog = [
          ...tags,
          for (final tag in existing?.tags ?? const <TaskTag>[])
            if (!tags.any((row) => row.id == tag.id)) tag,
        ];
        _tasks = tasks;
        _existing = existing;
        _missingDates = missing;
        if (existing != null) {
          _body.text = existing.body;
          _date = existing.businessDate;
          _tagIds = List<String>.from(existing.tagIds);
          _taskId = existing.taskId;
        } else if (missing.isNotEmpty) {
          final requested = widget.initialDate;
          _date = requested != null && missing.contains(requested)
              ? requested
              : missing.first;
        }
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final keys = ref.read(operationKeysProvider);
      final scope = 'log:${widget.logId ?? 'new'}:$_date';
      final key = keys.keyFor(
        scope: scope,
        method: widget.logId == null ? 'POST' : 'PATCH',
        path: widget.logId == null
            ? '/work-logs'
            : '/work-logs/${widget.logId}',
        body: {'body': _body.text},
      );
      final WorkLog saved;
      if (_existing == null) {
        saved = await ref
            .read(workLogsApiProvider)
            .create(
              businessDate: _date.iso,
              body: _body.text,
              taskId: _taskId,
              tagIds: _tagIds,
              idempotencyKey: key,
            );
      } else {
        saved = await ref
            .read(workLogsApiProvider)
            .change(
              id: _existing!.id,
              body: _body.text,
              taskId: _taskId,
              tagIds: _tagIds,
              tags: [
                for (final tag in _catalog)
                  if (_tagIds.contains(tag.id)) tag,
              ],
              base: _existing,
              idempotencyKey: key,
            );
      }
      keys.complete(scope);
      if (!mounted) return;
      _allowPop = true;
      context.pop(saved);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error;
      });
    }
  }

  String get _selectedTaskTitle {
    final id = _taskId;
    if (id == null) return '不关联任务';
    for (final task in _tasks) {
      if (task.id == id) return task.title;
    }
    return '当前关联任务';
  }

  Future<void> _pickTask() async {
    final result = await showDialog<_TaskPickResult>(
      context: context,
      builder: (context) =>
          _TaskPickerDialog(initial: _tasks, selectedId: _taskId),
    );
    if (result == null || !mounted) return;
    setState(() => _taskId = result.id);
  }

  String _merged(String addition) => WorkLogFill.merge(_body.text, addition);

  bool _withinLimit(String text) => WorkLogFill.fits(text);

  Future<bool> _targetStillEditable() async {
    final existing = _existing;
    if (existing == null) return true;
    try {
      final fresh = await ref.read(workLogsApiProvider).detail(existing.id);
      return fresh.editable && !fresh.frozen;
    } catch (_) {
      return false;
    }
  }

  Future<void> _fill() async {
    try {
      final source = await ref.read(workLogsApiProvider).fillSource(_date.iso);
      if (!mounted) return;
      if (!source.complete) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('事项或任务源加载不完整，未追加任何内容，请重试')),
        );
        return;
      }
      if (source.isEmpty) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('当天没有可填入的事项或任务')));
        return;
      }
      if (!await _targetStillEditable()) {
        if (!mounted) return;
        setState(() => _error = '日志已冻结或当前账号不可编辑，未追加任何内容');
        return;
      }
      var addition = WorkLogFill.sourceText(source);
      var next = _merged(addition);
      if (!_withinLimit(next)) {
        if (!mounted) return;
        final edited = await showDialog<String>(
          context: context,
          builder: (context) => _FillPreviewDialog(addition: addition),
        );
        if (edited == null || edited.trim().isEmpty || !mounted) return;
        addition = edited;
        next = _merged(addition);
        if (!_withinLimit(next)) {
          setState(() => _error = '追加后仍超过 10000 字符，未修改正文');
          return;
        }
      }
      if (!await _targetStillEditable()) {
        if (!mounted) return;
        setState(() => _error = '日志状态已变化，未追加任何内容');
        return;
      }
      setState(() => _body.text = next);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error);
    }
  }

  bool get _hasUnsavedChanges {
    final existing = _existing;
    if (existing == null) {
      return _body.text.trim().isNotEmpty ||
          _tagIds.isNotEmpty ||
          _taskId != null;
    }
    final tagsChanged = _tagIds.join(',') != existing.tagIds.join(',');
    return _body.text != existing.body ||
        tagsChanged ||
        _taskId != existing.taskId;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_existing == null && _missingDates.isEmpty) {
      return PandoraPage(
        title: '写日志',
        showBack: true,
        child: const EmptyView(message: '公司今天、昨天和前天的日志都已填写，请从列表打开已有日志。'),
      );
    }
    final editable =
        _existing == null || (_existing!.editable && !_existing!.frozen);
    final page = PandoraPage(
      title: _existing == null ? '写日志' : '编辑日志',
      showBack: true,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_existing == null) ...[
            Text('日志日期', style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              children: [
                for (final date in _missingDates)
                  ChoiceChip(
                    label: Text(date.iso),
                    selected: _date == date,
                    onSelected: (_) => setState(() => _date = date),
                  ),
              ],
            ),
          ] else
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('日志日期'),
              subtitle: Text(_existing!.businessDate.iso),
            ),
          const SizedBox(height: 12),
          Text('标签', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 6),
          TagSelector(
            selected: [
              for (final id in _tagIds)
                _catalog.where((tag) => tag.id == id).firstOrNull ??
                    TaskTag(id: id, name: '历史标签', deleted: true),
            ],
            catalog: _catalog,
            enabled: editable,
            onChanged: (next) =>
                setState(() => _tagIds = [for (final tag in next) tag.id]),
          ),
          const SizedBox(height: 12),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('关联任务（可选）'),
            subtitle: Text(
              _selectedTaskTitle,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            trailing: editable
                ? TextButton(onPressed: _pickTask, child: const Text('选择'))
                : null,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _body,
            minLines: 10,
            maxLines: null,
            maxLength: 10000,
            enabled: editable,
            decoration: const InputDecoration(
              labelText: '日志正文',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 8),
          if (editable)
            OutlinedButton.icon(
              onPressed: _fill,
              icon: const Icon(Icons.playlist_add),
              label: const Text('填入当日事项与任务'),
            ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(
              '$_error',
              style: const TextStyle(color: PandoraColors.overdue),
            ),
          ],
          const SizedBox(height: 16),
          if (editable)
            FilledButton(
              onPressed: _saving || _body.text.trim().isEmpty ? null : _save,
              child: Text(_saving ? '保存中…' : '保存日志'),
            ),
        ],
      ),
    );
    return UnsavedChangesGuard(
      hasUnsavedChanges: !_allowPop && editable && _hasUnsavedChanges,
      child: page,
    );
  }
}

class _FillPreviewDialog extends StatefulWidget {
  const _FillPreviewDialog({required this.addition});

  final String addition;

  @override
  State<_FillPreviewDialog> createState() => _FillPreviewDialogState();
}

class _FillPreviewDialogState extends State<_FillPreviewDialog> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.addition);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('追加后超过 10000 字符'),
      content: SizedBox(
        width: 560,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('可在此独立删减待追加文本；取消将不改动原正文。'),
            const SizedBox(height: 8),
            TextField(controller: _controller, minLines: 8, maxLines: 16),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('取消'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(_controller.text),
          child: const Text('确认追加'),
        ),
      ],
    );
  }
}

class _TaskPickResult {
  const _TaskPickResult(this.id);
  final String? id;
}

class _TaskPickerDialog extends ConsumerStatefulWidget {
  const _TaskPickerDialog({required this.initial, this.selectedId});

  final List<TaskRecord> initial;
  final String? selectedId;

  @override
  ConsumerState<_TaskPickerDialog> createState() => _TaskPickerDialogState();
}

class _TaskPickerDialogState extends ConsumerState<_TaskPickerDialog> {
  final _search = TextEditingController();
  List<TaskRecord> _results = const [];
  bool _loading = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _results = widget.initial;
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _runSearch() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await ref
          .read(tasksApiProvider)
          .listTasks(query: _search.text.trim(), limit: 100);
      if (!mounted) return;
      setState(() {
        _results = rows;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('选择关联任务'),
      content: SizedBox(
        width: 520,
        height: 430,
        child: Column(
          children: [
            TextField(
              controller: _search,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _runSearch(),
              decoration: InputDecoration(
                hintText: '搜索任务名称',
                suffixIcon: IconButton(
                  tooltip: '搜索',
                  onPressed: _runSearch,
                  icon: const Icon(Icons.search),
                ),
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  '$_error',
                  style: const TextStyle(color: PandoraColors.overdue),
                ),
              ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(12),
                child: CircularProgressIndicator(),
              ),
            Expanded(
              child: ListView.separated(
                itemCount: _results.length,
                separatorBuilder: (_, _) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final task = _results[index];
                  return ListTile(
                    selected: task.id == widget.selectedId,
                    title: Text(
                      task.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(task.scheduleText(CompanyTimeZone.fallback)),
                    onTap: () =>
                        Navigator.of(context).pop(_TaskPickResult(task.id)),
                  );
                },
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () =>
              Navigator.of(context).pop(const _TaskPickResult(null)),
          child: const Text('清空关联'),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('取消'),
        ),
      ],
    );
  }
}

class WorkLogDetailPage extends ConsumerStatefulWidget {
  const WorkLogDetailPage({
    super.key,
    required this.logId,
    this.readContext = const NormalReadContext(),
  });
  final String logId;
  final ReadContext readContext;
  @override
  ConsumerState<WorkLogDetailPage> createState() => _WorkLogDetailPageState();
}

class _WorkLogDetailPageState extends ConsumerState<WorkLogDetailPage> {
  WorkLog? _log;
  Object? _error;
  int _loadGeneration = 0;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    final generation = ++_loadGeneration;
    try {
      final log = await ref.read(workLogsApiProvider).detail(widget.logId);
      if (!mounted || generation != _loadGeneration) return;
      setState(() {
        _log = log;
        _error = null;
      });
    } catch (error) {
      if (!mounted || generation != _loadGeneration) return;
      setState(() => _error = error);
    }
  }

  /// 保存响应优先于旧的读取；滞后详情响应不得覆盖已保存版本。
  void _applySaved(WorkLog saved) {
    final current = _log;
    if (current != null && saved.rowVersion < current.rowVersion) return;
    _loadGeneration += 1;
    setState(() {
      _log = saved;
      _error = null;
    });
  }

  Future<void> _revalidateSaved(int generation) async {
    try {
      final fresh = await ref.read(workLogsApiProvider).detail(widget.logId);
      if (!mounted || generation != _loadGeneration) return;
      _applySaved(fresh);
    } catch (_) {
      // 写入已成功；重验失败保留已保存版本，不显示旧内容。
    }
  }

  @override
  Widget build(BuildContext context) {
    final log = _log;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        Navigator.of(context).pop(_log);
      },
      child: PandoraPage(
        title: '日志详情',
        showBack: true,
        actions: [
          if (widget.readContext.businessWritesAllowed &&
              log != null &&
              log.editable &&
              !log.frozen) ...[
            IconButton(
              tooltip: '编辑日志',
              onPressed: () async {
                final saved = await context.push<WorkLog>(
                  '/logs/${log.id}/edit',
                );
                if (!mounted) return;
                if (saved != null && saved.id == log.id) {
                  _applySaved(saved);
                  unawaited(_revalidateSaved(_loadGeneration));
                } else {
                  unawaited(_load());
                }
              },
              icon: const Icon(Icons.edit_outlined),
            ),
          ],
        ],
        child: _error != null
            ? ErrorView(error: _error!, onRetry: _load)
            : log == null
            ? const LoadingView()
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (widget.readContext is! NormalReadContext)
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: PandoraColors.petal,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '通过${widget.readContext.label}浏览，仅可阅读和评论。',
                        style: const TextStyle(fontSize: 12),
                      ),
                    ),
                  Text(
                    log.businessDate.iso,
                    style: Theme.of(context).textTheme.labelLarge
                        ?.copyWith(color: PandoraColors.brand),
                  ),
                  if (log.frozen) ...[
                    const SizedBox(height: 8),
                    const Align(
                      alignment: Alignment.centerLeft,
                      child: StatusBadge(
                        label: '已不能编辑',
                        color: PandoraColors.muted,
                      ),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Text(
                    log.body,
                    style: const TextStyle(fontSize: 15, height: 1.55),
                  ),
                  if (log.tags.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Wrap(
                        spacing: 6,
                        children: [
                          for (final tag in log.tags) TagBadge(tag: tag),
                        ],
                      ),
                    ),
                  if (log.createdAt != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text(
                        '创建时间 ${CompanyTimeZone.fallback.formatDateTime(log.createdAt!)}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: PandoraColors.muted,
                        ),
                      ),
                    ),
                  if (log.taskDeleted)
                    const ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(Icons.delete_outline),
                      title: Text('任务已删除'),
                      subtitle: Text('关联任务已删除，日志内容仍保留'),
                    )
                  else if (log.taskId != null)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.link),
                      title: const Text('关联任务'),
                      subtitle: const Text('按当前来源上下文读取'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () async {
                        await context.push(
                          NavigationTargets.task(
                            widget.readContext,
                            log.taskId!,
                          ),
                        );
                        if (mounted) await _revalidateSaved(_loadGeneration);
                      },
                    ),
                  const Divider(height: 28),
                  if (widget.readContext.commentsAllowed)
                    CommentsSection(objectType: 'log', objectId: log.id),
                ],
              ),
      ),
    );
  }
}
