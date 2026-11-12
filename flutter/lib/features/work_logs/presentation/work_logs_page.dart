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
      final page = await ref.read(workLogsApiProvider).list(offset: reset ? 0 : (_next ?? 0));
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

  @override
  Widget build(BuildContext context) {
    return PandoraPage(
      title: '日志 · $_total 条',
      actions: [
        IconButton(
          tooltip: '写日志',
          onPressed: () => context.push('/logs/new'),
          icon: const Icon(Icons.add),
        ),
      ],
      child: _body(),
    );
  }

  Widget _body() {
    if (_error != null && _items.isEmpty) return ErrorView(error: _error!, onRetry: () => _load(reset: true));
    if (_items.isEmpty) return _loading ? const LoadingView() : const EmptyView(message: '还没有日志');
    return ListView.separated(
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
            onTap: () => context.push('/logs/${log.id}'),
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
      if (widget.logId != null) existing = await ref.read(workLogsApiProvider).detail(widget.logId!);
      if (!mounted) return;
      setState(() {
        _catalog = tags;
        _tasks = tasks;
        _existing = existing;
        if (existing != null) {
          _body.text = existing.body;
          _date = existing.businessDate;
          _tagIds = List<String>.from(existing.tagIds);
          _taskId = existing.taskId;
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
      final WorkLog result;
      if (_existing == null) {
        result = await ref.read(workLogsApiProvider).create(
              businessDate: _date.iso,
              body: _body.text,
              taskId: _taskId,
              tagIds: _tagIds,
              idempotencyKey: key,
            );
      } else {
        result = await ref.read(workLogsApiProvider).change(
              id: _existing!.id,
              body: _body.text,
              taskId: _taskId,
              tagIds: _tagIds,
              idempotencyKey: key,
            );
      }
      keys.complete(scope);
      if (!mounted) return;
      context.pop(result.id);
    } catch (error) {
      if (!mounted) return;
      setState(() { _saving = false; _error = error; });
    }
  }

  String _merged(String addition) => WorkLogFill.merge(_body.text, addition);

  bool _withinLimit(String text) => WorkLogFill.fits(text);

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
      var addition = WorkLogFill.sourceText(source);
      var next = _merged(addition);
      if (!_withinLimit(next)) {
        if (!mounted) return;
        final edited = await showDialog<String>(
          context: context,
          builder: (context) {
            final controller = TextEditingController(text: addition);
            return AlertDialog(
              title: const Text('追加后超过 10000 字符'),
              content: SizedBox(
                width: 560,
                child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('可在此独立删减待追加文本；取消将不改动原正文。'),
                  const SizedBox(height: 8),
                  TextField(controller: controller, minLines: 8, maxLines: 16),
                ]),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('取消')),
                FilledButton(onPressed: () => Navigator.of(context).pop(controller.text), child: const Text('确认追加')),
              ],
            );
          },
        );
        if (edited == null || edited.trim().isEmpty || !mounted) return;
        addition = edited;
        next = _merged(addition);
        if (!_withinLimit(next)) {
          setState(() => _error = '追加后仍超过 10000 字符，未修改正文');
          return;
        }
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
              for (var i = 0; i < 3; i++)
                ChoiceChip(
                  label: Text(ref.read(businessDateProvider).addDays(-i).iso),
                  selected: _date == ref.read(businessDateProvider).addDays(-i),
                  onSelected: (_) => setState(() => _date = ref.read(businessDateProvider).addDays(-i)),
                ),
            ]),
          ] else
            ListTile(contentPadding: EdgeInsets.zero, title: const Text('日志日期'), subtitle: Text(_existing!.businessDate.iso)),
          const SizedBox(height: 12),
          Text('标签', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 6),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final tag in _catalog)
              if (!tag.deleted || _tagIds.contains(tag.id))
                FilterChip(
                  label: Text(tag.deleted ? '${tag.name}（已删除）' : tag.name),
                  selected: _tagIds.contains(tag.id),
                  onSelected: editable
                      ? (selected) {
                          setState(() {
                            if (selected) {
                              if (!tag.deleted && !_tagIds.contains(tag.id)) _tagIds = [..._tagIds, tag.id];
                            } else {
                              _tagIds = [for (final id in _tagIds) if (id != tag.id) id];
                            }
                          });
                        }
                      : null,
                ),
          ]),
          const SizedBox(height: 12),
          DropdownButtonFormField<String?>(
            initialValue: _taskId,
            decoration: const InputDecoration(labelText: '关联任务（可选）'),
            items: [
              const DropdownMenuItem<String?>(value: null, child: Text('不关联任务')),
              if (_taskId != null && !_tasks.any((task) => task.id == _taskId))
                DropdownMenuItem<String?>(value: _taskId, child: const Text('当前关联任务')),
              for (final task in _tasks)
                DropdownMenuItem<String?>(value: task.id, child: Text(task.title, overflow: TextOverflow.ellipsis)),
            ],
            onChanged: editable ? (value) => setState(() => _taskId = value) : null,
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

class WorkLogDetailPage extends ConsumerStatefulWidget {
  const WorkLogDetailPage({super.key, required this.logId});
  final String logId;
  @override
  ConsumerState<WorkLogDetailPage> createState() => _WorkLogDetailPageState();
}

class _WorkLogDetailPageState extends ConsumerState<WorkLogDetailPage> {
  WorkLog? _log;
  Object? _error;

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

  @override
  Widget build(BuildContext context) {
    final log = _log;
    return PandoraPage(
      title: '日志详情',
      showBack: true,
      actions: [
        if (log != null && log.editable && !log.frozen)
          IconButton(
            tooltip: '编辑日志',
            onPressed: () async {
              await context.push('/logs/${log.id}/edit');
              if (mounted) unawaited(_load());
            },
            icon: const Icon(Icons.edit_outlined),
          ),
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
