import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/company/date_picker_bounds.dart';
import '../../../core/errors/app_error.dart';
import '../../../core/preferences/app_preferences.dart';
import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/fading_name_text.dart';
import '../../../core/widgets/state_views.dart';
import '../domain/task_record.dart';
import 'task_providers.dart';

class TaskTablePage extends ConsumerStatefulWidget {
  const TaskTablePage({super.key});

  @override
  ConsumerState<TaskTablePage> createState() => _TaskTablePageState();
}

class _TaskTablePageState extends ConsumerState<TaskTablePage> {
  static const int _pageSize = 50;
  static const double _headerHeight = 44;
  static const double _rowHeight = 66;

  final _search = TextEditingController();
  List<TaskRecord> _items = const [];
  int _total = 0;
  int _pageIndex = 0;
  String _relation = 'all';
  String _completion = 'all';
  String _sort = 'startAt';
  String _direction = 'asc';
  DateTime? _from;
  DateTime? _to;
  AppPreferences? _preferences;
  int _requestId = 0;
  bool _loading = true;
  Object? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => unawaited(_restore()));
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _restore() async {
    String? accountId;
    for (var attempt = 0; attempt < 5 && accountId == null; attempt++) {
      accountId = ref.read(currentUserProvider)?.id;
      if (accountId == null) {
        await Future<void>.delayed(const Duration(milliseconds: 20));
      }
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
    _pageIndex =
        int.tryParse(_preferences?.getString('tasksTable.pageIndex') ?? '') ??
        0;
    if (!mounted) return;
    await _loadPage(_pageIndex);
  }

  Future<void> _loadPage(int page) async {
    final requestId = ++_requestId;
    setState(() {
      _loading = true;
      _error = null;
      _pageIndex = page.clamp(0, 1 << 30);
    });
    try {
      final result = await ref
          .read(tasksApiProvider)
          .table(
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

  Future<void> _applyFilter(VoidCallback change) async {
    setState(() {
      change();
      _pageIndex = 0;
    });
    await _persistFilters();
    await _loadPage(0);
  }

  String? _dateIso(DateTime? value) => value == null
      ? null
      : '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';

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

  Widget _filters() => Padding(
    padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _search,
                textInputAction: TextInputAction.search,
                onSubmitted: (_) => _applyFilter(() {}),
                decoration: InputDecoration(
                  hintText: '搜索任务名称',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: IconButton(
                    tooltip: '清空搜索',
                    onPressed: () {
                      _search.clear();
                      unawaited(_applyFilter(() {}));
                    },
                    icon: const Icon(Icons.clear),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton.tonalIcon(
              onPressed: _showFilters,
              icon: const Icon(Icons.filter_alt_outlined),
              label: const Text('筛选'),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          '共 $_total 项 · 每页 $_pageSize',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    ),
  );

  Future<void> _showFilters() async {
    var relation = _relation;
    var completion = _completion;
    var sort = _sort;
    var direction = _direction;
    var from = _from;
    var to = _to;
    await showModalBottomSheet<void>(
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
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('筛选', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: relation,
                    decoration: const InputDecoration(labelText: '关系'),
                    items: const [
                      DropdownMenuItem(value: 'all', child: Text('全部')),
                      DropdownMenuItem(value: 'assigned', child: Text('我负责')),
                      DropdownMenuItem(value: 'created', child: Text('我创建')),
                    ],
                    onChanged: (value) =>
                        setSheetState(() => relation = value ?? relation),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: completion,
                    decoration: const InputDecoration(labelText: '完成状态'),
                    items: const [
                      DropdownMenuItem(value: 'all', child: Text('全部')),
                      DropdownMenuItem(value: 'unfinished', child: Text('未完成')),
                      DropdownMenuItem(value: 'completed', child: Text('已完成')),
                    ],
                    onChanged: (value) =>
                        setSheetState(() => completion = value ?? completion),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: sort,
                          decoration: const InputDecoration(labelText: '排序字段'),
                          items: const [
                            DropdownMenuItem(
                              value: 'startAt',
                              child: Text('开始时间'),
                            ),
                            DropdownMenuItem(value: 'title', child: Text('名称')),
                            DropdownMenuItem(
                              value: 'createdAt',
                              child: Text('创建时间'),
                            ),
                            DropdownMenuItem(
                              value: 'dueAt',
                              child: Text('截止时间'),
                            ),
                            DropdownMenuItem(
                              value: 'priority',
                              child: Text('紧急程度'),
                            ),
                            DropdownMenuItem(
                              value: 'state',
                              child: Text('执行状态'),
                            ),
                          ],
                          onChanged: (value) =>
                              setSheetState(() => sort = value ?? sort),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: direction,
                          decoration: const InputDecoration(labelText: '排序方向'),
                          items: const [
                            DropdownMenuItem(value: 'asc', child: Text('升序')),
                            DropdownMenuItem(value: 'desc', child: Text('降序')),
                          ],
                          onChanged: (value) => setSheetState(
                            () => direction = value ?? direction,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () async {
                            final picked = await _pickFilterDate(from);
                            if (picked != null) {
                              setSheetState(() => from = picked);
                            }
                          },
                          child: Text(
                            from == null ? '日期从：不限' : '从 ${_dateIso(from)}',
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () async {
                            final picked = await _pickFilterDate(to, start: from);
                            if (picked != null) {
                              setSheetState(() => to = picked);
                            }
                          },
                          child: Text(
                            to == null ? '日期至：不限' : '至 ${_dateIso(to)}',
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      TextButton(
                        onPressed: () => setSheetState(() {
                          relation = 'all';
                          completion = 'all';
                          sort = 'startAt';
                          direction = 'asc';
                          from = null;
                          to = null;
                        }),
                        child: const Text('清空筛选'),
                      ),
                      const Spacer(),
                      FilledButton(
                        onPressed:
                            from != null && to != null && to!.isBefore(from!)
                            ? null
                            : () {
                                Navigator.of(context).pop();
                                unawaited(
                                  _applyFilter(() {
                                    _relation = relation;
                                    _completion = completion;
                                    _sort = sort;
                                    _direction = direction;
                                    _from = from;
                                    _to = to;
                                  }),
                                );
                              },
                        child: const Text('应用筛选'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<DateTime?> _pickFilterDate(DateTime? current, {DateTime? start}) => showDatePicker(
    context: context,
    initialDate: DatePickerBounds.clampInitial(current ?? DateTime.now(), start)!,
    firstDate: DateTime(2020),
    lastDate: DateTime(2040, 12, 31),
    selectableDayPredicate: start == null ? null : (day) => DatePickerBounds.endOnOrAfter(day, start),
  );

  Widget _body() {
    if (_error != null && _items.isEmpty) {
      return ErrorView(error: _error!, onRetry: () => _loadPage(_pageIndex));
    }
    if (_items.isEmpty) {
      return _loading
          ? const LoadingView()
          : const EmptyView(message: '没有符合条件的任务');
    }
    return Column(
      children: [
        Container(
          height: _headerHeight,
          color: PandoraColors.petal.withValues(alpha: .35),
          child: const Row(
            children: [
              Expanded(flex: 4, child: _CompactHeader('任务')),
              Expanded(flex: 2, child: _CompactHeader('负责人')),
              Expanded(flex: 2, child: _CompactHeader('状态')),
              Expanded(flex: 3, child: _CompactHeader('截止时间')),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: ListView.separated(
            key: const ValueKey('task-table-list'),
            itemCount: _items.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final task = _items[index];
              return Material(
                key: ValueKey('task-table-row-${task.id}'),
                color: _rowColor(task, index),
                child: InkWell(
                  onTap: () => _openTask(task.id),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: _rowHeight),
                    child: Row(
                      children: [
                        Expanded(
                          flex: 4,
                          child: Padding(
                            padding: const EdgeInsets.all(8),
                            child: Row(
                              children: [
                                if (task.tablePinned)
                                  const Icon(
                                    Icons.push_pin,
                                    size: 15,
                                    color: PandoraColors.brand,
                                  ),
                                if (task.tablePinned) const SizedBox(width: 4),
                                Expanded(
                                  child: FadingNameText(task.title, maxLines: 2),
                                ),
                                IconButton(
                                  tooltip: task.tablePinned
                                      ? '取消表单置顶'
                                      : '置顶到表单',
                                  visualDensity: VisualDensity.compact,
                                  onPressed: task.canTablePin
                                      ? () => _toggleTablePin(task)
                                      : null,
                                  icon: Icon(
                                    task.tablePinned
                                        ? Icons.push_pin
                                        : Icons.push_pin_outlined,
                                    size: 18,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        Expanded(
                          flex: 2,
                          child: _CompactCell(
                            task.participants
                                .map((p) => p.displayName)
                                .join('、'),
                          ),
                        ),
                        Expanded(
                          flex: 2,
                          child: _CompactCell(_stateLabel(task)),
                        ),
                        Expanded(
                          flex: 3,
                          child: _CompactCell(
                            task.deadlineText(
                              ref.read(companyTimeZoneProvider),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        _pagination(),
      ],
    );
  }

  Color _rowColor(TaskRecord task, int index) => task.tablePinned
      ? const Color(0xFFE8F1FC)
      : index.isEven
      ? PandoraColors.paper
      : const Color(0xFFF7F2F6);

  Widget _pagination() {
    final pages = _total == 0 ? 1 : ((_total - 1) ~/ _pageSize) + 1;
    if (pages <= 1 && !_loading) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
      child: Row(
        children: [
          Text(
            '第 ${_pageIndex + 1} / $pages 页',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const Spacer(),
          TextButton(
            onPressed: _loading || _pageIndex <= 0
                ? null
                : () => _loadPage(_pageIndex - 1),
            child: const Text('上一页'),
          ),
          TextButton(
            onPressed: _loading || _pageIndex + 1 >= pages
                ? null
                : () => _loadPage(_pageIndex + 1),
            child: const Text('下一页'),
          ),
        ],
      ),
    );
  }

  void _openTask(String id) {
    unawaited(context.push('/tasks/$id'));
  }

  Future<void> _toggleTablePin(TaskRecord task) async {
    final keys = ref.read(operationKeysProvider);
    final pinned = !task.tablePinned;
    final scope = 'table-pin:${task.id}';
    final key = keys.keyFor(
      scope: scope,
      method: pinned ? 'PUT' : 'DELETE',
      path: '/tasks/${task.id}/table-pin',
      body: const {},
    );
    try {
      await ref
          .read(tasksApiProvider)
          .setTablePin(taskId: task.id, pinned: pinned, idempotencyKey: key);
      keys.complete(scope);
      if (mounted) await _loadPage(0);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(userMessageFor(error))));
    }
  }

  String _stateLabel(TaskRecord task) {
    if (task.done) return '已完成';
    if (task.pending) return '审核中';
    if (task.doing) return '进行中';
    return '待开始';
  }
}

class _CompactHeader extends StatelessWidget {
  const _CompactHeader(this.label);

  final String label;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 6),
    child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
  );
}

class _CompactCell extends StatelessWidget {
  const _CompactCell(this.value);

  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
    child: Text(
      value.isEmpty ? '—' : value,
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
    ),
  );
}
