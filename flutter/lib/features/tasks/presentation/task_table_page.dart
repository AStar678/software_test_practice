import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/state_views.dart';
import '../domain/task_record.dart';
import 'task_providers.dart';

class TaskTablePage extends ConsumerStatefulWidget {
  const TaskTablePage({super.key});

  @override
  ConsumerState<TaskTablePage> createState() => _TaskTablePageState();
}

class _TaskTablePageState extends ConsumerState<TaskTablePage> {
  final _search = TextEditingController();
  List<TaskRecord> _items = const [];
  int _total = 0;
  int? _next;
  String _relation = 'all';
  String _completion = 'all';
  String _sort = 'startAt';
  String _direction = 'asc';
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
    _search.dispose();
    super.dispose();
  }

  Future<void> _load({required bool reset}) async {
    if (_loading) return;
    final offset = reset ? 0 : (_next ?? 0);
    setState(() {
      _loading = true;
      _error = null;
      if (reset) {
        _items = const [];
      }
    });
    try {
      final page = await ref.read(tasksApiProvider).table(
            relation: _relation,
            completion: _completion,
            query: _search.text,
            sort: _sort,
            direction: _direction,
            from: _dateIso(_from),
            to: _dateIso(_to),
            offset: offset,
          );
      if (!mounted) return;
      setState(() {
        final merged = <String, TaskRecord>{};
        for (final task in [..._items, ...page.items]) {
          merged[task.id] = task;
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

  Future<void> _togglePin(TaskRecord task) async {
    final keys = ref.read(operationKeysProvider);
    final key = keys.keyFor(
      scope: 'table-pin:${task.id}',
      method: task.tablePinned ? 'DELETE' : 'PUT',
      path: '/tasks/${task.id}/table-pin',
      body: const {},
    );
    try {
      await ref.read(tasksApiProvider).setTablePin(
            taskId: task.id,
            pinned: !task.tablePinned,
            idempotencyKey: key,
          );
      keys.complete('table-pin:${task.id}');
      await _load(reset: true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
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

  @override
  Widget build(BuildContext context) {
    return PandoraPage(
      title: '任务表单',
      showBack: true,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: Column(
              children: [
                TextField(
                  controller: _search,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (_) => _load(reset: true),
                  decoration: InputDecoration(
                    hintText: '搜索任务名称',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: IconButton(
                      tooltip: '清空',
                      onPressed: () { _search.clear(); _load(reset: true); },
                      icon: const Icon(Icons.clear),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(child: DropdownButtonFormField<String>(
                      initialValue: _relation,
                      decoration: const InputDecoration(labelText: '关系'),
                      items: const [
                        DropdownMenuItem(value: 'all', child: Text('全部')),
                        DropdownMenuItem(value: 'assigned', child: Text('我负责')),
                        DropdownMenuItem(value: 'created', child: Text('我创建')),
                      ],
                      onChanged: (value) { if (value != null) { _relation = value; _load(reset: true); } },
                    )),
                    const SizedBox(width: 8),
                    Expanded(child: DropdownButtonFormField<String>(
                      initialValue: _completion,
                      decoration: const InputDecoration(labelText: '完成'),
                      items: const [
                        DropdownMenuItem(value: 'all', child: Text('全部')),
                        DropdownMenuItem(value: 'unfinished', child: Text('未完成')),
                        DropdownMenuItem(value: 'completed', child: Text('已完成')),
                      ],
                      onChanged: (value) { if (value != null) { _completion = value; _load(reset: true); } },
                    )),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(child: DropdownButtonFormField<String>(
                      initialValue: _sort,
                      decoration: const InputDecoration(labelText: '排序'),
                      items: const [
                        DropdownMenuItem(value: 'startAt', child: Text('开始')),
                        DropdownMenuItem(value: 'title', child: Text('名称')),
                        DropdownMenuItem(value: 'createdAt', child: Text('创建时间')),
                        DropdownMenuItem(value: 'dueAt', child: Text('截止')),
                        DropdownMenuItem(value: 'priority', child: Text('紧急程度')),
                        DropdownMenuItem(value: 'state', child: Text('执行状态')),
                      ],
                      onChanged: (value) { if (value != null) { _sort = value; _load(reset: true); } },
                    )),
                    const SizedBox(width: 8),
                    Expanded(child: DropdownButtonFormField<String>(
                      initialValue: _direction,
                      decoration: const InputDecoration(labelText: '方向'),
                      items: const [
                        DropdownMenuItem(value: 'asc', child: Text('升序')),
                        DropdownMenuItem(value: 'desc', child: Text('降序')),
                      ],
                      onChanged: (value) { if (value != null) { _direction = value; _load(reset: true); } },
                    )),
                  ],
                ),
                const SizedBox(height: 6),
                Row(children: [
                  Expanded(child: OutlinedButton(
                    onPressed: () => _pickDate(from: true),
                    child: Text(_from == null ? '开始日期：全部' : '开始：${_dateIso(_from)}'),
                  )),
                  const SizedBox(width: 8),
                  Expanded(child: OutlinedButton(
                    onPressed: () => _pickDate(from: false),
                    child: Text(_to == null ? '结束日期：全部' : '结束：${_dateIso(_to)}'),
                  )),
                  if (_from != null || _to != null)
                    IconButton(
                      tooltip: '清除日期筛选',
                      onPressed: () { setState(() { _from = null; _to = null; }); _load(reset: true); },
                      icon: const Icon(Icons.event_busy),
                    ),
                ]),
                const SizedBox(height: 6),
                Row(children: [
                  Text('共 $_total 项', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: PandoraColors.muted)),
                  const Spacer(),
                  TextButton.icon(onPressed: () => _load(reset: true), icon: const Icon(Icons.refresh, size: 18), label: const Text('刷新')),
                ]),
              ],
            ),
          ),
          Expanded(child: _body()),
        ],
      ),
    );
  }

  Widget _body() {
    if (_error != null && _items.isEmpty) return ErrorView(error: _error!, onRetry: () => _load(reset: true));
    if (_items.isEmpty) return _loading ? const LoadingView() : const EmptyView(message: '没有符合条件的任务');
    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: ConstrainedBox(
              constraints: BoxConstraints(minWidth: MediaQuery.of(context).size.width),
              child: DataTable(
                columns: const [
                  DataColumn(label: Text('任务')),
                  DataColumn(label: Text('关系')),
                  DataColumn(label: Text('状态')),
                  DataColumn(label: Text('排期')),
                  DataColumn(label: Text('紧急程度')),
                  DataColumn(label: Text('负责人')),
                  DataColumn(label: Text('来源')),
                  DataColumn(label: Text('父任务')),
                  DataColumn(label: Text('标签')),
                  DataColumn(label: Text('进展')),
                  DataColumn(label: Text('冻结')),
                  DataColumn(label: Text('创建时间')),
                  DataColumn(label: Text('置顶')),
                ],
                rows: [
                  for (final task in _items)
                    DataRow(cells: [
                      DataCell(ConstrainedBox(constraints: const BoxConstraints(maxWidth: 220), child: Text(task.title, maxLines: 2, overflow: TextOverflow.ellipsis)), onTap: () => context.push('/tasks/${task.id}')),
                      DataCell(Text(_relationLabel(task))),
                      DataCell(Text(_stateLabel(task))),
                      DataCell(Text(task.scheduleText(ref.read(companyTimeZoneProvider)))),
                      DataCell(Text(_priorityLabel(task.priority))),
                      DataCell(Text(task.participants.map((p) => p.displayName).join('、'))),
                      DataCell(Text(task.originalCreatorId ?? '—')),
                      DataCell(Text(task.parentTaskId == null ? '—' : '有父任务')),
                      DataCell(Text(task.tags.isEmpty ? '—' : task.tags.map((tag) => tag.name).join('、'))),
                      DataCell(ConstrainedBox(constraints: const BoxConstraints(maxWidth: 220), child: Text(task.progressNote.isEmpty ? '暂无' : task.progressNote, maxLines: 2, overflow: TextOverflow.ellipsis))),
                      DataCell(Text(task.frozen || task.pending ? '冻结' : '—')),
                      DataCell(Text(task.createdAt == null ? '—' : ref.read(companyTimeZoneProvider).formatDateTime(task.createdAt!))),
                      DataCell(IconButton(
                        tooltip: task.tablePinned ? '取消表单置顶' : '置顶到表单',
                        onPressed: task.canTablePin ? () => _togglePin(task) : null,
                        icon: Icon(task.tablePinned ? Icons.push_pin : Icons.push_pin_outlined),
                      )),
                    ]),
                ],
              ),
            ),
          ),
        ),
        if (_next != null)
          Padding(
            padding: const EdgeInsets.all(12),
            child: OutlinedButton(
              onPressed: _loading ? null : () => _load(reset: false),
              child: Text(_loading ? '加载中…' : '加载更多'),
            ),
          ),
      ],
    );
  }

  String _priorityLabel(String value) => switch (value) {
        'urgent' => '紧急',
        'high' => '高',
        'low' => '低',
        _ => '中',
      };

  String _relationLabel(TaskRecord task) {
    final id = ref.read(currentUserProvider)?.id;
    final owner = task.assigneeIds.contains(id);
    final creator = task.originalCreatorId == id;
    if (owner && creator) return '创建并负责';
    return owner ? '我负责' : creator ? '我创建' : '—';
  }

  String _stateLabel(TaskRecord task) {
    if (task.done) return '已完成';
    if (task.pending) return '审核中';
    if (task.doing) return '进行中';
    return '待开始';
  }
}
