import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/preferences/app_preferences.dart';
import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/state_views.dart';
import '../domain/task_record.dart';
import 'task_providers.dart';

enum _ColumnGroup { overview, schedule, info, all }

extension on _ColumnGroup {
  String get label => switch (this) {
        _ColumnGroup.overview => '概览',
        _ColumnGroup.schedule => '排期',
        _ColumnGroup.info => '资料',
        _ColumnGroup.all => '全部列',
      };

  bool includes(_TableColumn column) => switch (this) {
        _ColumnGroup.overview => const {
            _TableColumn.relation,
            _TableColumn.state,
            _TableColumn.schedule,
            _TableColumn.owners,
          }.contains(column),
        _ColumnGroup.schedule => const {
            _TableColumn.schedule,
            _TableColumn.priority,
            _TableColumn.dueAt,
            _TableColumn.frozen,
            _TableColumn.overdue,
            _TableColumn.createdAt,
          }.contains(column),
        _ColumnGroup.info => const {
            _TableColumn.originalCreator,
            _TableColumn.parent,
            _TableColumn.tags,
            _TableColumn.progress,
            _TableColumn.acceptanceCriteria,
            _TableColumn.round,
            _TableColumn.createdAt,
          }.contains(column),
        _ColumnGroup.all => true,
      };
}

enum _TableColumn {
  relation('关系', 100),
  state('状态', 96),
  schedule('排期', 220),
  priority('紧急程度', 90),
  owners('负责人', 170),
  originalCreator('原来源', 150),
  parent('父任务', 150),
  tags('标签', 170),
  progress('进展', 230),
  acceptanceCriteria('历史标准', 230),
  frozen('冻结', 90),
  overdue('逾期', 80),
  round('轮次', 80),
  createdAt('创建时间', 170),
  dueAt('截止', 190),
  pin('置顶', 76);

  const _TableColumn(this.label, this.width);

  final String label;
  final double width;
}

class TaskTablePage extends ConsumerStatefulWidget {
  const TaskTablePage({super.key});

  @override
  ConsumerState<TaskTablePage> createState() => _TaskTablePageState();
}

class _TaskTablePageState extends ConsumerState<TaskTablePage> {
  static const int _pageSize = 50;
  static const double _titleWidth = 190;
  static const double _headerHeight = 44;
  static const double _rowHeight = 66;

  final _search = TextEditingController();
  final _bodyHorizontal = ScrollController();
  final _headerHorizontal = ScrollController();
  final _leftVertical = ScrollController();
  final _rightVertical = ScrollController();
  List<TaskRecord> _items = const [];
  int _total = 0;
  int _pageIndex = 0;
  String _relation = 'all';
  String _completion = 'all';
  String _sort = 'startAt';
  String _direction = 'asc';
  DateTime? _from;
  DateTime? _to;
  _ColumnGroup _group = _ColumnGroup.overview;
  AppPreferences? _preferences;
  Timer? _scrollSaveTimer;
  bool _syncingVertical = false;
  int _requestId = 0;
  bool _loading = true;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _bodyHorizontal.addListener(() {
      if (!_headerHorizontal.hasClients) return;
      final max = _headerHorizontal.position.maxScrollExtent;
      final next = _bodyHorizontal.offset.clamp(0.0, max);
      if ((_headerHorizontal.offset - next).abs() > .5) _headerHorizontal.jumpTo(next);
    });
    _leftVertical.addListener(() => _syncVertical(_leftVertical, _rightVertical));
    _rightVertical.addListener(() {
      _syncVertical(_rightVertical, _leftVertical);
      _scheduleSaveScroll();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => unawaited(_restore()));
  }

  @override
  void dispose() {
    _scrollSaveTimer?.cancel();
    unawaited(_persistScroll());
    _search.dispose();
    _bodyHorizontal.dispose();
    _headerHorizontal.dispose();
    _leftVertical.dispose();
    _rightVertical.dispose();
    super.dispose();
  }

  void _syncVertical(ScrollController source, ScrollController target) {
    if (_syncingVertical || !target.hasClients) return;
    final max = target.position.maxScrollExtent;
    final next = source.offset.clamp(0.0, max);
    if ((target.offset - next).abs() < .5) return;
    _syncingVertical = true;
    target.jumpTo(next);
    _syncingVertical = false;
  }

  Future<void> _restore() async {
    String? accountId;
    for (var attempt = 0; attempt < 5 && accountId == null; attempt++) {
      accountId = ref.read(currentUserProvider)?.id;
      if (accountId == null) await Future<void>.delayed(const Duration(milliseconds: 20));
    }
    _preferences = await AppPreferences.load(accountId);
    final rawFilters = _preferences?.getString('tasksTable.filters');
    if (rawFilters != null && rawFilters.isNotEmpty) {
      try {
        final json = Map<String, Object?>.from(jsonDecode(rawFilters) as Map);
        _relation = json['relation']?.toString() ?? _relation;
        _completion = json['completion']?.toString() ?? _completion;
        _sort = json['sort']?.toString() ?? _sort;
        _direction = json['direction']?.toString() ?? _direction;
        _search.text = json['q']?.toString() ?? '';
        _from = DateTime.tryParse(json['from']?.toString() ?? '');
        _to = DateTime.tryParse(json['to']?.toString() ?? '');
      } catch (_) {
        // 损坏偏好安全回退默认值，不影响请求。
      }
    }
    final group = _preferences?.getString('tasksTable.columnGroup');
    _group = _ColumnGroup.values.where((value) => value.name == group).firstOrNull ?? _ColumnGroup.overview;
    _pageIndex = int.tryParse(_preferences?.getString('tasksTable.pageIndex') ?? '') ?? 0;
    if (!mounted) return;
    await _loadPage(_pageIndex, restoreScroll: _preferences?.getString('tasksTable.scrollOffset'));
  }

  Future<void> _loadPage(int page, {String? restoreScroll}) async {
    final requestId = ++_requestId;
    final previousPage = _pageIndex;
    setState(() {
      _loading = true;
      _error = null;
      _pageIndex = page.clamp(0, 1 << 30);
    });
    try {
      final result = await ref.read(tasksApiProvider).table(
            relation: _relation,
            completion: _completion,
            query: _search.text,
            sort: _sort,
            direction: _direction,
            from: _dateIso(_from),
            to: _dateIso(_to),
            limit: _pageSize,
            offset: _pageIndex * _pageSize,
          );
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _items = result.items;
        _total = result.total;
        _loading = false;
      });
      unawaited(_saveString('tasksTable.pageIndex', '$_pageIndex'));
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final restored = double.tryParse(restoreScroll ?? '');
        if (restored != null && _rightVertical.hasClients) {
          _rightVertical.jumpTo(restored.clamp(0, _rightVertical.position.maxScrollExtent));
        } else if (page != previousPage && _rightVertical.hasClients) {
          _rightVertical.jumpTo(0);
        }
      });
    } catch (error) {
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  Future<void> _saveString(String key, String value) async {
    await _preferences?.setString(key, value);
  }

  Future<void> _persistFilters() async {
    await _saveString(
      'tasksTable.filters',
      jsonEncode({
        'relation': _relation,
        'completion': _completion,
        'q': _search.text,
        'sort': _sort,
        'direction': _direction,
        'from': _dateIso(_from),
        'to': _dateIso(_to),
      }),
    );
  }

  void _scheduleSaveScroll() {
    _scrollSaveTimer?.cancel();
    _scrollSaveTimer = Timer(const Duration(milliseconds: 500), () {
      unawaited(_persistScroll());
    });
  }

  Future<void> _persistScroll() async {
    if (!_rightVertical.hasClients) return;
    await _saveString('tasksTable.scrollOffset', '${_rightVertical.offset}');
  }

  Future<void> _applyFilter(VoidCallback change) async {
    setState(() {
      change();
      _pageIndex = 0;
    });
    await _persistFilters();
    await _loadPage(0);
  }

  Future<void> _togglePin(TaskRecord task) async {
    if (!task.canTablePin) return;
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
      await _applyFilter(() {});
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
    await _applyFilter(() {
      if (from) {
        _from = picked;
      } else {
        _to = picked;
      }
    });
  }

  List<_TableColumn> get _columns => [
        _TableColumn.pin,
        for (final column in _TableColumn.values)
          if (column != _TableColumn.pin && _group.includes(column)) column,
      ];

  double get _restWidth => _columns.fold(0, (sum, column) => sum + column.width);

  @override
  Widget build(BuildContext context) {
    return PandoraPage(
      title: '任务表单',
      showBack: true,
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
      child: Column(
        children: [
          TextField(
            controller: _search,
            textInputAction: TextInputAction.search,
            onSubmitted: (_) => _applyFilter(() {}),
            decoration: InputDecoration(
              hintText: '搜索任务名称',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: IconButton(
                tooltip: '清空',
                onPressed: () {
                  _search.clear();
                  unawaited(_applyFilter(() {}));
                },
                icon: const Icon(Icons.clear),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: DropdownButtonFormField<String>(
              initialValue: _relation,
              decoration: const InputDecoration(labelText: '关系'),
              items: const [
                DropdownMenuItem(value: 'all', child: Text('全部')),
                DropdownMenuItem(value: 'assigned', child: Text('我负责')),
                DropdownMenuItem(value: 'created', child: Text('我创建')),
              ],
              onChanged: (value) {
                if (value != null) unawaited(_applyFilter(() => _relation = value));
              },
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
              onChanged: (value) {
                if (value != null) unawaited(_applyFilter(() => _completion = value));
              },
            )),
          ]),
          const SizedBox(height: 6),
          Row(children: [
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
              onChanged: (value) {
                if (value != null) unawaited(_applyFilter(() => _sort = value));
              },
            )),
            const SizedBox(width: 8),
            Expanded(child: DropdownButtonFormField<String>(
              initialValue: _direction,
              decoration: const InputDecoration(labelText: '方向'),
              items: const [
                DropdownMenuItem(value: 'asc', child: Text('升序')),
                DropdownMenuItem(value: 'desc', child: Text('降序')),
              ],
              onChanged: (value) {
                if (value != null) unawaited(_applyFilter(() => _direction = value));
              },
            )),
          ]),
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
                onPressed: () => _applyFilter(() {
                  _from = null;
                  _to = null;
                }),
                icon: const Icon(Icons.event_busy),
              ),
          ]),
          const SizedBox(height: 6),
          Row(children: [
            Expanded(child: DropdownButtonFormField<_ColumnGroup>(
              initialValue: _group,
              decoration: const InputDecoration(labelText: '列组'),
              items: [
                for (final group in _ColumnGroup.values)
                  DropdownMenuItem(value: group, child: Text(group.label)),
              ],
              onChanged: (value) {
                if (value == null) return;
                setState(() => _group = value);
                unawaited(_saveString('tasksTable.columnGroup', value.name));
              },
            )),
            const SizedBox(width: 12),
            Text(
              '共 $_total 项 · 每页 $_pageSize',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: PandoraColors.muted),
            ),
          ]),
        ],
      ),
    );
  }

  Widget _body() {
    if (_error != null && _items.isEmpty) return ErrorView(error: _error!, onRetry: () => _loadPage(_pageIndex));
    if (_items.isEmpty) return _loading ? const LoadingView() : const EmptyView(message: '没有符合条件的任务');
    final columns = _columns;
    return Column(
      children: [
        SizedBox(
          height: _headerHeight,
          child: Row(children: [
            SizedBox(
              width: _titleWidth,
              child: _headerCell('任务'),
            ),
            Expanded(
              child: SingleChildScrollView(
                controller: _headerHorizontal,
                scrollDirection: Axis.horizontal,
                physics: const NeverScrollableScrollPhysics(),
                child: SizedBox(
                  width: _restWidth,
                  child: Row(children: [for (final column in columns) _headerCell(column.label, width: column.width)]),
                ),
              ),
            ),
          ]),
        ),
        const Divider(height: 1),
        Expanded(
          child: Row(children: [
            SizedBox(
              width: _titleWidth,
              child: ListView.builder(
                key: const ValueKey('task-table-left-list'),
                controller: _leftVertical,
                itemExtent: _rowHeight,
                itemCount: _items.length,
                itemBuilder: (context, index) {
                  final task = _items[index];
                  return InkWell(
                    onTap: () => _openTask(task.id),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      child: Text(task.title, maxLines: 2, overflow: TextOverflow.ellipsis),
                    ),
                  );
                },
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                key: const ValueKey('task-table-body-scroll'),
                controller: _bodyHorizontal,
                scrollDirection: Axis.horizontal,
                child: SizedBox(
                  width: _restWidth,
                  child: ListView.builder(
                    key: const ValueKey('task-table-right-list'),
                    controller: _rightVertical,
                    itemExtent: _rowHeight,
                    itemCount: _items.length,
                    itemBuilder: (context, index) {
                      final task = _items[index];
                      return InkWell(
                        onTap: () => _openTask(task.id),
                        child: Row(children: [for (final column in columns) _cell(column, task)]),
                      );
                    },
                  ),
                ),
              ),
            ),
          ]),
        ),
        _pagination(),
      ],
    );
  }

  Widget _headerCell(String label, {double? width}) {
    return Container(
      width: width,
      alignment: Alignment.centerLeft,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      color: PandoraColors.petal.withValues(alpha: .35),
      child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
    );
  }

  Widget _cell(_TableColumn column, TaskRecord task) {
    final child = switch (column) {
      _TableColumn.relation => Text(_relationLabel(task)),
      _TableColumn.state => Text(_stateLabel(task)),
      _TableColumn.schedule => Text(task.scheduleText(ref.read(companyTimeZoneProvider))),
      _TableColumn.priority => Text(_priorityLabel(task.priority)),
      _TableColumn.owners => Text(task.participants.map((person) => person.displayName).join('、')),
      _TableColumn.originalCreator => Text(_personName(task.originalCreatorId)),
      _TableColumn.parent => task.parentTaskId == null
          ? const Text('—')
          : TextButton(
              style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 28)),
              onPressed: () => _openTask(task.parentTaskId!),
              child: Text(_shortId(task.parentTaskId!)),
            ),
      _TableColumn.tags => Text(task.tags.isEmpty ? '—' : task.tags.map((tag) => tag.name).join('、')),
      _TableColumn.progress => Text(task.progressNote.isEmpty ? '—' : task.progressNote, maxLines: 2, overflow: TextOverflow.ellipsis),
      _TableColumn.acceptanceCriteria => Text(task.acceptanceCriteria.isEmpty ? '—' : task.acceptanceCriteria, maxLines: 2, overflow: TextOverflow.ellipsis),
      _TableColumn.frozen => Text(task.frozen || task.pending ? '冻结/待审' : '—'),
      _TableColumn.overdue => Text(_isOverdue(task) ? '逾期' : '—'),
      _TableColumn.round => Text('第 ${task.executionRound} 轮'),
      _TableColumn.createdAt => Text(task.createdAt == null ? '—' : ref.read(companyTimeZoneProvider).formatDateTime(task.createdAt!)),
      _TableColumn.dueAt => Text(task.dueAt == null ? '—' : ref.read(companyTimeZoneProvider).formatDateTime(task.dueAt!)),
      _TableColumn.pin => IconButton(
          tooltip: task.tablePinned ? '取消表单置顶' : '置顶到表单',
          onPressed: task.canTablePin ? () => _togglePin(task) : null,
          icon: Icon(task.tablePinned ? Icons.push_pin : Icons.push_pin_outlined),
        ),
    };
    return SizedBox(
      width: column.width,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Align(alignment: Alignment.centerLeft, child: child),
      ),
    );
  }

  Widget _pagination() {
    final pages = _total == 0 ? 1 : ((_total - 1) ~/ _pageSize) + 1;
    if (pages <= 1 && !_loading) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
      child: Row(children: [
        Text('第 ${_pageIndex + 1} / $pages 页', style: Theme.of(context).textTheme.bodySmall),
        const Spacer(),
        TextButton(
          onPressed: _loading || _pageIndex <= 0 ? null : () => _loadPage(_pageIndex - 1),
          child: const Text('上一页'),
        ),
        TextButton(
          onPressed: _loading || _pageIndex + 1 >= pages ? null : () => _loadPage(_pageIndex + 1),
          child: const Text('下一页'),
        ),
      ]),
    );
  }

  void _openTask(String id) {
    unawaited(context.push('/tasks/$id'));
  }

  bool _isOverdue(TaskRecord task) =>
      !task.done && task.dueAt != null && task.dueAt!.isBefore(DateTime.now().toUtc());

  String _personName(String? id) {
    if (id == null) return '—';
    for (final person in _items.expand((task) => task.participants)) {
      if (person.id == id) return person.displayName;
    }
    final me = ref.read(currentUserProvider);
    if (me?.id == id) return me!.displayName;
    return _shortId(id);
  }

  String _shortId(String id) => id.length <= 8 ? id : id.substring(0, 8);

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
