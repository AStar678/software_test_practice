import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/company/company_date.dart';
import '../../../core/company/company_time.dart';
import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/state_views.dart';
import '../../comments/presentation/comments_section.dart';
import '../../tasks/domain/task_record.dart';
import '../../tasks/presentation/task_providers.dart';
import '../../tags/presentation/tag_selector.dart';
import '../../tags/presentation/tags_providers.dart';
import '../domain/work_log.dart';
import '../domain/work_log_fill.dart';
import 'work_logs_providers.dart';

class WorkLogsPage extends ConsumerStatefulWidget {
  const WorkLogsPage({super.key});
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

  @override
  void initState() {
    super.initState();
    unawaited(_load(reset: true));
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load({required bool reset}) async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
      if (reset) {
        _items = const [];
        _next = 0;
      }
    });
    try {
      final page = await ref.read(workLogsApiProvider).list(
            from: _dateIso(_from),
            to: _dateIso(_to),
            offset: reset ? 0 : (_next ?? 0),
          );
      if (!mounted) return;
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
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  String? _dateIso(DateTime? value) => value == null
      ? null
      : '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';

  Future<void> _pickDate({required bool from}) async {
    final today = DateTime.now();
    final current = from ? _from : _to;
    final picked = await showDatePicker(
      context: context,
      initialDate: current ?? today,
      firstDate: DateTime(today.year - 5),
      lastDate: DateTime(today.year + 5),
      helpText: from ? '选择开始日期' : '选择结束日期',
    );
    if (picked == null || !mounted) return;
    setState(() {
      if (from) {
        _from = picked;
      } else {
        _to = picked;
      }
    });
    await _load(reset: true);
  }

  Future<void> _returnFromDetail(String id) async {
    final offset = _scroll.hasClients ? _scroll.offset : 0.0;
    await context.push<void>('/logs/$id');
    if (!mounted) return;
    await _load(reset: true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _scroll.hasClients) {
        _scroll.jumpTo(offset.clamp(0, _scroll.position.maxScrollExtent));
      }
    });
  }

  Future<void> _refreshToTop() async {
    await _load(reset: true);
    if (mounted && _scroll.hasClients) _scroll.jumpTo(0);
  }

  @override
  Widget build(BuildContext context) {
    return PandoraPage(
      title: '日志 · $_total 条',
      actions: [
        IconButton(
          tooltip: '写日志',
          onPressed: () async {
            final saved = await context.push<bool>('/logs/new');
            if (!mounted) return;
            if (saved == true) await _load(reset: true);
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
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
      child: Row(children: [
        const Text('本人日志', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(width: 12),
        Expanded(
          child: OutlinedButton(
            onPressed: () => _pickDate(from: true),
            child: Text(_from == null ? '开始：全部' : '开始：${_dateIso(_from)}'),
          ),
        ),
        const SizedBox(width: 6),
        Expanded(
          child: OutlinedButton(
            onPressed: () => _pickDate(from: false),
            child: Text(_to == null ? '结束：全部' : '结束：${_dateIso(_to)}'),
          ),
        ),
        if (_from != null || _to != null)
          IconButton(
            tooltip: '清除日期筛选',
            onPressed: () {
              setState(() {
                _from = null;
                _to = null;
              });
              unawaited(_load(reset: true));
            },
            icon: const Icon(Icons.event_busy),
          ),
      ]),
    );
  }

  Widget _body() {
    if (_error != null && _items.isEmpty) return ErrorView(error: _error!, onRetry: () => _load(reset: true));
    if (_items.isEmpty) return _loading ? const LoadingView() : const EmptyView(message: '还没有日志');
    return RefreshIndicator(
      onRefresh: _refreshToTop,
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
                  Row(children: [
                    Text(log.businessDate.iso, style: Theme.of(context).textTheme.labelLarge?.copyWith(color: PandoraColors.brand)),
                    const Spacer(),
                    if (log.frozen) const StatusBadge(label: '已冻结', color: PandoraColors.muted),
                    if (log.createdAt != null)
                      Text(_relative(log, ref.read(businessDateProvider)), style: const TextStyle(fontSize: 12, color: PandoraColors.muted)),
                  ]),
                  const SizedBox(height: 6),
                  Text(log.body, maxLines: 4, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, height: 1.55)),
                  if (log.tags.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Wrap(spacing: 6, children: [for (final tag in log.tags) StatusBadge(label: tag.name, color: _tagColor(tag))]),
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

  String _relative(WorkLog log, CompanyDate today) => CompanyTimeZone.fallback.relativeDateLabel(log.businessDate, today);
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
  Object? _error;

  @override
  void initState() {
    super.initState();
    _date = widget.initialDate ?? ref.read(businessDateProvider);
    unawaited(_load());
  }

  @override
  void dispose() {
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
        final existingLogs = await ref.read(workLogsApiProvider).list(
              from: today.addDays(-2).iso,
              to: today.iso,
              limit: 100,
            );
        final occupied = {for (final log in existingLogs.items) log.businessDate};
        missing = [
          for (var offset = 0; offset < 3; offset++)
            if (!occupied.contains(today.addDays(-offset))) today.addDays(-offset),
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
          _date = requested != null && missing.contains(requested) ? requested : missing.first;
        }
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() { _error = error; _loading = false; });
    }
  }

  Future<void> _save() async {
    setState(() { _saving = true; _error = null; });
    try {
      final keys = ref.read(operationKeysProvider);
      final scope = 'log:${widget.logId ?? 'new'}:$_date';
      final key = keys.keyFor(scope: scope, method: widget.logId == null ? 'POST' : 'PATCH', path: widget.logId == null ? '/work-logs' : '/work-logs/${widget.logId}', body: {'body': _body.text});
      if (_existing == null) {
        await ref.read(workLogsApiProvider).create(
              businessDate: _date.iso,
              body: _body.text,
              taskId: _taskId,
              tagIds: _tagIds,
              idempotencyKey: key,
            );
      } else {
        await ref.read(workLogsApiProvider).change(
              id: _existing!.id,
              body: _body.text,
              taskId: _taskId,
              tagIds: _tagIds,
              idempotencyKey: key,
            );
      }
      keys.complete(scope);
      if (!mounted) return;
      context.pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() { _saving = false; _error = error; });
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
      builder: (context) => _TaskPickerDialog(initial: _tasks, selectedId: _taskId),
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
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('事项或任务源加载不完整，未追加任何内容，请重试')));
        return;
      }
      if (source.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('当天没有可填入的事项或任务')));
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

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_existing == null && _missingDates.isEmpty) {
      return PandoraPage(
        title: '写日志',
        showBack: true,
        child: const EmptyView(message: '公司今天、昨天和前天的日志都已填写，请从列表打开已有日志。'),
      );
    }
    final editable = _existing == null || (_existing!.editable && !_existing!.frozen);
    return PandoraPage(
      title: _existing == null ? '写日志' : '编辑日志',
      showBack: true,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_existing == null) ...[
            Text('日志日期', style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 6),
            Wrap(spacing: 8, children: [
              for (final date in _missingDates)
                ChoiceChip(
                  label: Text(date.iso),
                  selected: _date == date,
                  onSelected: (_) => setState(() => _date = date),
                ),
            ]),
          ] else
            ListTile(contentPadding: EdgeInsets.zero, title: const Text('日志日期'), subtitle: Text(_existing!.businessDate.iso)),
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
            onChanged: (next) => setState(() => _tagIds = [for (final tag in next) tag.id]),
          ),
          const SizedBox(height: 12),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('关联任务（可选）'),
            subtitle: Text(_selectedTaskTitle, maxLines: 2, overflow: TextOverflow.ellipsis),
            trailing: editable
                ? TextButton(
                    onPressed: _pickTask,
                    child: const Text('选择'),
                  )
                : null,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _body,
            minLines: 10,
            maxLines: null,
            maxLength: 10000,
            enabled: editable,
            decoration: const InputDecoration(labelText: '日志正文', alignLabelWithHint: true),
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
            Text('$_error', style: const TextStyle(color: PandoraColors.overdue)),
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
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('可在此独立删减待追加文本；取消将不改动原正文。'),
          const SizedBox(height: 8),
          TextField(controller: _controller, minLines: 8, maxLines: 16),
        ]),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('取消')),
        FilledButton(onPressed: () => Navigator.of(context).pop(_controller.text), child: const Text('确认追加')),
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
      final rows = await ref.read(tasksApiProvider).listTasks(query: _search.text.trim(), limit: 100);
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
        child: Column(children: [
          TextField(
            controller: _search,
            textInputAction: TextInputAction.search,
            onSubmitted: (_) => _runSearch(),
            decoration: InputDecoration(
              hintText: '搜索任务名称',
              suffixIcon: IconButton(tooltip: '搜索', onPressed: _runSearch, icon: const Icon(Icons.search)),
            ),
          ),
          if (_error != null) Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text('$_error', style: const TextStyle(color: PandoraColors.overdue)),
          ),
          if (_loading) const Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator()),
          Expanded(
            child: ListView.separated(
              itemCount: _results.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final task = _results[index];
                return ListTile(
                  selected: task.id == widget.selectedId,
                  title: Text(task.title, maxLines: 2, overflow: TextOverflow.ellipsis),
                  subtitle: Text(task.scheduleText(CompanyTimeZone.fallback)),
                  onTap: () => Navigator.of(context).pop(_TaskPickResult(task.id)),
                );
              },
            ),
          ),
        ]),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(const _TaskPickResult(null)), child: const Text('清空关联')),
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('取消')),
      ],
    );
  }
}

class WorkLogDetailPage extends ConsumerStatefulWidget {
  const WorkLogDetailPage({super.key, required this.logId});
  final String logId;
  @override
  ConsumerState<WorkLogDetailPage> createState() => _WorkLogDetailPageState();
}

class _WorkLogDetailPageState extends ConsumerState<WorkLogDetailPage> {
  WorkLog? _log;
  Object? _error;
  bool _deleting = false;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    try {
      final log = await ref.read(workLogsApiProvider).detail(widget.logId);
      if (!mounted) return;
      setState(() => _log = log);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error);
    }
  }

  Future<void> _delete(WorkLog log) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('删除日志？'),
        content: const Text('删除后同一业务日不能重置首次创建时间，重新填写仍受原冻结窗口约束。'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('删除')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _deleting = true);
    final keys = ref.read(operationKeysProvider);
    final key = keys.keyFor(scope: 'log-delete:${log.id}', method: 'DELETE', path: '/work-logs/${log.id}', body: const {});
    try {
      await ref.read(workLogsApiProvider).delete(id: log.id, idempotencyKey: key);
      keys.complete('log-delete:${log.id}');
      if (mounted) Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      setState(() => _deleting = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    final log = _log;
    return PandoraPage(
      title: '日志详情',
      showBack: true,
      actions: [
        if (log != null && log.editable && !log.frozen) ...[
          IconButton(
            tooltip: '编辑日志',
            onPressed: () async {
              await context.push('/logs/${log.id}/edit');
              if (mounted) unawaited(_load());
            },
            icon: const Icon(Icons.edit_outlined),
          ),
          IconButton(
            tooltip: '删除日志',
            onPressed: _deleting ? null : () => _delete(log),
            icon: const Icon(Icons.delete_outline),
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
                    Text(log.businessDate.iso, style: Theme.of(context).textTheme.labelLarge?.copyWith(color: PandoraColors.brand)),
                    const SizedBox(height: 8),
                    Text(log.body, style: const TextStyle(fontSize: 15, height: 1.55)),
                    if (log.tags.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Wrap(spacing: 6, children: [for (final tag in log.tags) StatusBadge(label: tag.name, color: _tagColor(tag))]),
                      ),
                    if (log.createdAt != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Text('创建时间 ${CompanyTimeZone.fallback.formatDateTime(log.createdAt!)}', style: const TextStyle(fontSize: 12, color: PandoraColors.muted)),
                      ),
                    const Divider(height: 28),
                    CommentsSection(objectType: 'log', objectId: log.id),
                  ],
                ),
    );
  }
}

Color _tagColor(TaskTag tag) {
  final parsed = int.tryParse((tag.color ?? '').replaceFirst('#', ''), radix: 16);
  return parsed == null ? PandoraColors.petal : Color(0xFF000000 | parsed);
}
