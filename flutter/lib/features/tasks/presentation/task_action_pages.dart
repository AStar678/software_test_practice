import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/company/company_date.dart';
import '../../../core/company/company_time.dart';
import '../../../core/company/date_picker_bounds.dart';
import '../../../core/errors/app_error.dart';
import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/state_views.dart';
import '../../people/domain/person_summary.dart';
import '../domain/task_record.dart';
import 'assignee_picker.dart';
import 'task_providers.dart';
import 'task_review.dart';

/// 重开：完整新排期 + 有序负责人候选 + 原因，一次原子提交。
/// 拒绝/撤销/失效保留原完成状态与排期。
class TaskReopenPage extends ConsumerStatefulWidget {
  const TaskReopenPage({super.key, required this.taskId});

  final String taskId;

  @override
  ConsumerState<TaskReopenPage> createState() => _TaskReopenPageState();
}

class _TaskReopenPageState extends ConsumerState<TaskReopenPage> {
  final _reasonController = TextEditingController();
  List<PersonSummary> _candidates = const [];
  List<PersonSummary> _assignees = const [];
  CompanyDate? _startDate;
  CompanyDate? _dueDate;
  TimeOfDay _startTime = const TimeOfDay(hour: 9, minute: 0);
  TimeOfDay _dueTime = const TimeOfDay(hour: 18, minute: 0);
  bool _loading = true;
  bool _saving = false;
  String? _error;
  late final int _epoch;

  bool get _current => mounted && _epoch == ref.read(accountEpochProvider);
  TaskRecord? _task;

  CompanyTimeZone get _zone => ref.read(companyTimeZoneProvider);

  @override
  void initState() {
    super.initState();
    _epoch = ref.read(accountEpochProvider);
    unawaited(_load());
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final api = ref.read(tasksApiProvider);
      final task = await api.detail(widget.taskId);
      if (!mounted || !_current) return;
      if (!task.done || task.frozen || task.pending || task.businessOwnerId != ref.read(currentUserProvider)?.id) {
        setState(() {
          _loading = false;
          _error = '当前账号不能重开该任务';
        });
        return;
      }
      final candidates = await api.assigneeCandidates(purpose: 'edit');
      if (!mounted || !_current) return;
      final known = {for (final person in candidates) person.id: person};
      final names = {for (final person in task.participants) person.id: person.displayName};
      final businessDate = ref.read(workspaceClockProvider).businessDate;
      final now = ref.read(workspaceClockProvider).now().toUtc();
      final keepSchedule = task.startAt != null && task.dueAt != null && task.dueAt!.isAfter(now);
      setState(() {
        _task = task;
        _candidates = candidates;
        _assignees = [
          for (final id in task.assigneeIds) known[id] ?? PersonSummary(id: id, displayName: names[id] ?? '原负责人'),
        ];
        _startDate = keepSchedule ? _zone.dateOf(task.startAt!) : businessDate;
        _dueDate = keepSchedule ? _zone.dateOf(task.dueAt!) : businessDate.addDays(1);
        if (keepSchedule) {
          final start = _zone.toLocal(task.startAt!);
          final due = _zone.toLocal(task.dueAt!);
          _startTime = TimeOfDay(hour: start.hour, minute: start.minute);
          _dueTime = TimeOfDay(hour: due.hour, minute: due.minute);
        }
        _loading = false;
      });
    } catch (error) {
      if (!mounted || !_current) return;
      setState(() {
        _loading = false;
        _error = error is ApiException ? error.message : '无法读取任务';
      });
    }
  }

  Future<void> _save() async {
    if (!_current || _saving) return;
    final task = _task;
    final start = _startDate;
    final due = _dueDate;
    if (task == null || start == null || due == null) return;
    if (_reasonController.text.trim().isEmpty) {
      setState(() => _error = '请填写重开原因');
      return;
    }
    if (_assignees.isEmpty) {
      setState(() => _error = '至少保留一位有效负责人');
      return;
    }
    final startAt = _zone.at(start, hour: _startTime.hour, minute: _startTime.minute);
    final dueAt = _zone.at(due, hour: _dueTime.hour, minute: _dueTime.minute);
    if (dueAt.isBefore(startAt)) {
      setState(() => _error = '新排期的截止时间不得早于开始时间');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final keys = ref.read(operationKeysProvider);
      final approvals = ref.read(approvalsApiProvider);
      final payload = {
        'allDay': false,
        'startAt': startAt.toUtc().toIso8601String(),
        'dueAt': dueAt.toUtc().toIso8601String(),
        'assigneeIds': [for (final person in _assignees) person.id],
        'reason': _reasonController.text.trim(),
      };
      final key = keys.keyFor(
        scope: 'task:reopen:${task.id}',
        method: 'PATCH',
        path: '/tasks/${task.id}',
        body: {'command': 'reopen', ...payload},
        ifMatch: '"${task.rowVersion}"',
      );
      final result = await ref
          .read(tasksApiProvider)
          .reopen(
            id: task.id,
            startAt: startAt,
            dueAt: dueAt,
            assigneeIds: [for (final person in _assignees) person.id],
            reason: _reasonController.text.trim(),
            idempotencyKey: key,
            ifMatch: '"${task.rowVersion}"',
          );
      if (!mounted || !_current) return;
      keys.complete('task:reopen:${task.id}');
      final message = await taskMutationMessage(result, approvals);
      if (!mounted || !_current) return;
      ref.invalidate(taskDetailProvider(task.id));
      if (!mounted || !_current) return;
      showSnack(context, message);
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted || !_current) return;
      setState(() {
        _saving = false;
        _error = error is ApiException ? error.message : '重开失败，请重试';
      });
    }
  }

  Future<void> _pickDate({required bool isStart}) async {
    final current = (isStart ? _startDate : _dueDate) ?? ref.read(workspaceClockProvider).businessDate;
    final startDay = isStart || _startDate == null
        ? null
        : DateTime(_startDate!.year, _startDate!.month, _startDate!.day);
    final initial = DatePickerBounds.clampInitial(
      DateTime(current.year, current.month, current.day),
      startDay,
    )!;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020, 1, 1),
      lastDate: DateTime(2040, 12, 31),
      selectableDayPredicate: isStart ? null : (day) => DatePickerBounds.endOnOrAfter(day, startDay),
      cancelText: '取消',
      confirmText: '确定',
    );
    if (picked == null) return;
    setState(() {
      final date = CompanyDate(picked.year, picked.month, picked.day);
      if (isStart) {
        _startDate = date;
        if (_dueDate == null || _dueDate!.isBefore(date)) _dueDate = date;
      } else {
        _dueDate = date;
      }
    });
  }

  Future<void> _pickTime({required bool isStart}) async {
    final time = await showTimePicker(
      context: context,
      initialTime: isStart ? _startTime : _dueTime,
      cancelText: '取消',
      confirmText: '确定',
    );
    if (time == null) return;
    setState(() {
      if (isStart) {
        _startTime = time;
      } else {
        _dueTime = time;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final task = _task;
    return UnsavedChangesGuard(
      hasUnsavedChanges: _reasonController.text.trim().isNotEmpty,
      child: PandoraPage(
        title: '重开任务',
        showBack: true,
        onBack: () => Navigator.of(context).maybePop(),
        child: _loading
            ? const LoadingView()
            : task == null
            ? EmptyView(message: _error ?? '任务不存在')
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(task.title, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(
                    '当前状态：已完成 · 第 ${task.executionRound} 轮',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: PandoraColors.muted),
                  ),
                  const SizedBox(height: 16),
                  Text('新的排期', style: Theme.of(context).textTheme.labelLarge),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => _pickDate(isStart: true),
                          child: Text('开始 ${_startDate?.iso ?? '未选'}'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton(
                        onPressed: () => _pickTime(isStart: true),
                        child: Text(_startTime.format(context)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => _pickDate(isStart: false),
                          child: Text('截止 ${_dueDate?.iso ?? '未选'}'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton(onPressed: () => _pickTime(isStart: false), child: Text(_dueTime.format(context))),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text('负责人（按顺序，可替换已停用人员）', style: Theme.of(context).textTheme.labelLarge),
                  AssigneePicker(
                    selected: _assignees,
                    candidates: _candidates,
                    onChanged: (next) => setState(() => _assignees = next),
                  ),
                  const SizedBox(height: 12),
                  ReviewerPreviewPanel(
                    payload: {
                      'taskId': task.id,
                      'operation': 'reopen',
                      'assigneeIds': [for (final person in _assignees) person.id],
                    },
                  ),
                  TextField(
                    controller: _reasonController,
                    maxLength: 500,
                    decoration: const InputDecoration(labelText: '重开原因（必填）'),
                    onChanged: (_) => setState(() {}),
                  ),
                  if (_error != null) Text(_error!, style: const TextStyle(color: PandoraColors.overdue)),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _saving ? null : _save,
                    child: _saving
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('提交重开申请'),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    '审批通过后负责人与新排期同时生效；拒绝或撤销时保持完成状态与原排期不变。',
                    style: TextStyle(fontSize: 12, color: PandoraColors.muted),
                  ),
                ],
              ),
      ),
    );
  }
}

/// 专用交接：只替换来源在有序负责人中的位置，不夹带资料。
class TaskHandoverPage extends ConsumerStatefulWidget {
  const TaskHandoverPage({super.key, required this.taskId});

  final String taskId;

  @override
  ConsumerState<TaskHandoverPage> createState() => _TaskHandoverPageState();
}

class _TaskHandoverPageState extends ConsumerState<TaskHandoverPage> {
  final _reasonController = TextEditingController();
  TaskRecord? _task;
  String? _sourceUserId;
  String? _targetUserId;
  List<PersonSummary> _sources = const [];
  List<PersonSummary> _targets = const [];
  PersonSummary? _preset;
  bool _loading = true;
  bool _saving = false;
  bool _savingPreset = false;
  bool _loadingTargets = false;
  int _targetGeneration = 0;
  String? _error;
  late final int _epoch;

  bool get _current => mounted && _epoch == ref.read(accountEpochProvider);

  @override
  void initState() {
    super.initState();
    _epoch = ref.read(accountEpochProvider);
    unawaited(_load());
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final api = ref.read(tasksApiProvider);
      final task = await api.detail(widget.taskId);
      if (!mounted || !_current) return;
      final me = ref.read(currentUserProvider);
      final names = {for (final person in task.participants) person.id: person.displayName};
      final sources = [for (final id in task.handoverSources) PersonSummary(id: id, displayName: names[id] ?? '负责人')];
      final sourceId = (me != null && task.handoverSources.contains(me.id))
          ? me.id
          : (sources.isEmpty ? null : sources.first.id);
      if (!mounted || !_current) return;
      setState(() {
        _task = task;
        _sources = task.canHandover ? sources : const [];
        _sourceUserId = task.canHandover ? sourceId : null;
        _loading = false;
      });
      if (task.canHandover && sourceId != null) {
        await _loadTargets(sourceId);
      }
    } catch (error) {
      if (!mounted || !_current) return;
      setState(() {
        _loading = false;
        _error = error is ApiException ? error.message : '无法读取交接信息';
      });
    }
  }

  bool _targetCurrent(String source, int generation) =>
      _current && _sourceUserId == source && generation == _targetGeneration;

  Future<void> _loadTargets(String sourceId) async {
    if (!mounted || !_current) return;
    final generation = ++_targetGeneration;
    setState(() {
      _loadingTargets = true;
      _targets = const [];
      _preset = null;
      _targetUserId = null;
      _error = null;
    });
    try {
      final api = ref.read(tasksApiProvider);
      final targets = await api.handoverTargets(subjectId: sourceId);
      if (!_targetCurrent(sourceId, generation)) return;
      final preset = await api.handoverPreset(sourceId);
      if (!_targetCurrent(sourceId, generation)) return;
      final validPreset = targets.items.any((person) => person.id == preset.targetUserId);
      setState(() {
        _targets = targets.items;
        _preset = validPreset ? targets.items.firstWhere((person) => person.id == preset.targetUserId) : null;
        _targetUserId = validPreset ? preset.targetUserId : targets.items.firstOrNull?.id;
        _loadingTargets = false;
      });
    } catch (error) {
      if (!_targetCurrent(sourceId, generation)) return;
      setState(() {
        _loadingTargets = false;
        _error = error is ApiException ? error.message : '无法读取交接对象';
      });
    }
  }

  Future<void> _savePreset() async {
    if (!_current || _savingPreset || _loadingTargets || _saving) return;
    final generation = _targetGeneration;
    final target = _targetUserId;
    final source = _sourceUserId;
    if (target == null || source == null) {
      setState(() => _error = '请先选择交接对象');
      return;
    }
    setState(() {
      _savingPreset = true;
      _error = null;
    });
    try {
      final keys = ref.read(operationKeysProvider);
      final key = keys.keyFor(
        scope: 'handover-preset:$source',
        method: 'PUT',
        path: '/users/$source/handover-preset',
        body: {'targetUserId': target},
      );
      final preset = await ref
          .read(tasksApiProvider)
          .saveHandoverPreset(userId: source, targetUserId: target, idempotencyKey: key);
      if (!mounted || !_targetCurrent(source, generation)) return;
      keys.complete('handover-preset:$source');
      setState(() {
        _preset = preset.target;
        _savingPreset = false;
      });
      showSnack(context, '已保存为默认交接对象');
    } catch (error) {
      if (!mounted || !_targetCurrent(source, generation)) return;
      setState(() {
        _savingPreset = false;
        _error = error is ApiException ? error.message : '默认交接对象保存失败';
      });
    }
  }

  Future<void> _clearPreset() async {
    if (!_current || _savingPreset || _loadingTargets || _saving) return;
    final generation = _targetGeneration;
    final source = _sourceUserId;
    if (source == null) return;
    setState(() => _savingPreset = true);
    try {
      final keys = ref.read(operationKeysProvider);
      final key = keys.keyFor(
        scope: 'handover-preset:$source',
        method: 'DELETE',
        path: '/users/$source/handover-preset',
      );
      await ref.read(tasksApiProvider).clearHandoverPreset(userId: source, idempotencyKey: key);
      if (!mounted || !_targetCurrent(source, generation)) return;
      keys.complete('handover-preset:$source');
      setState(() {
        _preset = null;
        _savingPreset = false;
      });
      showSnack(context, '已清除默认交接对象');
    } catch (error) {
      if (!mounted || !_targetCurrent(source, generation)) return;
      setState(() => _savingPreset = false);
      showSnack(context, error is ApiException ? error.message : '清除失败，请重试');
    }
  }

  Future<void> _submit() async {
    if (!_current || _saving || _loadingTargets || _savingPreset) return;
    final task = _task;
    final source = _sourceUserId;
    final target = _targetUserId;
    if (task == null || source == null || target == null) {
      setState(() => _error = '请选择交接对象');
      return;
    }
    if (!_sources.any((person) => person.id == source) || !_targets.any((person) => person.id == target)) {
      setState(() => _error = '交接对象已失效，请重新选择');
      return;
    }
    if (source == target) {
      setState(() => _error = '交接对象不能与被交接人相同');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final keys = ref.read(operationKeysProvider);
      final approvals = ref.read(approvalsApiProvider);
      final reason = _reasonController.text.trim();
      final payload = {'sourceUserId': source, 'targetUserId': target, if (reason.isNotEmpty) 'reason': reason};
      final key = keys.keyFor(
        scope: 'task:handover:${task.id}',
        method: 'POST',
        path: '/tasks/${task.id}/handover',
        body: payload,
        ifMatch: '"${task.rowVersion}"',
      );
      final result = await ref
          .read(tasksApiProvider)
          .handover(
            taskId: task.id,
            sourceUserId: source,
            targetUserId: target,
            reason: reason,
            idempotencyKey: key,
            ifMatch: '"${task.rowVersion}"',
          );
      if (!mounted || !_current) return;
      keys.complete('task:handover:${task.id}');
      final message = await taskMutationMessage(result, approvals);
      if (!mounted || !_current) return;
      ref.invalidate(taskDetailProvider(task.id));
      if (!mounted || !_current) return;
      showSnack(context, message);
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted || !_current) return;
      setState(() {
        _saving = false;
        _error = error is ApiException ? error.message : '交接失败，请重试';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final task = _task;
    final names = {for (final person in _sources) person.id: person.displayName};
    return UnsavedChangesGuard(
      hasUnsavedChanges: _reasonController.text.trim().isNotEmpty,
      child: PandoraPage(
        title: '交接任务',
        showBack: true,
        onBack: () => Navigator.of(context).maybePop(),
        child: _loading
            ? const LoadingView()
            : task == null
            ? EmptyView(message: _error ?? '任务不存在')
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(task.title, style: Theme.of(context).textTheme.titleMedium),
                  if (_sources.isEmpty) const Text('当前账号没有该任务的专用交接权限。'),
                  const SizedBox(height: 14),
                  Text('被交接人', style: Theme.of(context).textTheme.labelLarge),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    initialValue: _sourceUserId,
                    decoration: const InputDecoration(labelText: '从当前负责人中选择', isDense: true),
                    items: [
                      for (final person in _sources)
                        DropdownMenuItem(value: person.id, child: Text(names[person.id] ?? person.displayName)),
                    ],
                    onChanged: _saving || _savingPreset
                        ? null
                        : (value) async {
                            if (value == null) return;
                            setState(() {
                              _sourceUserId = value;
                              _targetUserId = null;
                              _preset = null;
                            });
                            await _loadTargets(value);
                          },
                  ),
                  const SizedBox(height: 14),
                  Text('交接对象', style: Theme.of(context).textTheme.labelLarge),
                  if (_preset != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              '默认交接对象：${_preset!.displayName}',
                              style: const TextStyle(color: PandoraColors.muted),
                            ),
                          ),
                          TextButton(
                            onPressed: _savingPreset || _saving ? null : _clearPreset,
                            child: const Text('清除'),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 6),
                  if (_loadingTargets)
                    const Text('正在读取交接对象…')
                  else if (_targets.isEmpty)
                    const Text('没有可用的交接对象', style: TextStyle(color: PandoraColors.muted))
                  else
                    Column(
                      children: [
                        for (final person in _targets)
                          ListTile(
                            dense: true,
                            leading: Icon(
                              _targetUserId == person.id ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                              color: _targetUserId == person.id ? PandoraColors.brand : PandoraColors.muted,
                            ),
                            title: Text(person.displayName),
                            subtitle: person.positionPath.isEmpty
                                ? null
                                : Text(
                                    person.positionPath,
                                    style: const TextStyle(fontSize: 11, color: PandoraColors.muted),
                                  ),
                            onTap: _saving || _savingPreset ? null : () => setState(() => _targetUserId = person.id),
                          ),
                      ],
                    ),
                  if (_targetUserId != null && !_loadingTargets)
                    ReviewerPreviewPanel(
                      payload: {
                        'taskId': task.id,
                        'operation': 'handover',
                        'assigneeIds': [for (final id in task.assigneeIds) id == _sourceUserId ? _targetUserId : id],
                      },
                    ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _reasonController,
                    maxLength: 500,
                    decoration: const InputDecoration(labelText: '交接原因（可选）'),
                    onChanged: (_) => setState(() {}),
                  ),
                  if (_error != null) Text(_error!, style: const TextStyle(color: PandoraColors.overdue)),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: _saving || _savingPreset || _loadingTargets || _targetUserId == null ? null : _submit,
                    child: _saving
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('提交交接申请'),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: _savingPreset || _saving || _loadingTargets || _targetUserId == null
                        ? null
                        : _savePreset,
                    child: Text(_savingPreset ? '正在保存…' : '保存为默认交接对象'),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    '交接只替换来源负责人，不改变任务资料、创建来源或其他负责人顺序。',
                    style: TextStyle(fontSize: 12, color: PandoraColors.muted),
                  ),
                ],
              ),
      ),
    );
  }
}
