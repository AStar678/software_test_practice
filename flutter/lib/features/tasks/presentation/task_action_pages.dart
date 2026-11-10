import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/company/company_date.dart';
import '../../../core/company/company_time.dart';
import '../../../core/errors/app_error.dart';
import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/state_views.dart';
import '../../people/domain/person_summary.dart';
import '../domain/task_record.dart';
import 'assignee_picker.dart';
import 'task_providers.dart';

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
  TaskRecord? _task;

  CompanyTimeZone get _zone => ref.read(companyTimeZoneProvider);

  @override
  void initState() {
    super.initState();
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
      final candidates = await api.assigneeCandidates(purpose: 'edit');
      if (!mounted) return;
      final known = {for (final person in candidates) person.id: person};
      final names = {for (final person in task.participants) person.id: person.displayName};
      final businessDate = ref.read(workspaceClockProvider).businessDate;
      final now = _zone.toLocal(DateTime.now().toUtc());
      setState(() {
        _task = task;
        _candidates = candidates;
        _assignees = [
          for (final id in task.assigneeIds)
            known[id] ??
                PersonSummary(id: id, displayName: names[id] ?? '原负责人')
        ];
        final startDay = task.startAt == null ? businessDate : _zone.dateOf(task.startAt!);
        final dueDay = task.dueAt == null ? businessDate.addDays(1) : _zone.dateOf(task.dueAt!);
        _startDate = startDay.isBefore(businessDate) ? businessDate : startDay;
        _dueDate = dueDay.isBefore(businessDate) ? businessDate.addDays(1) : dueDay;
        if (task.startAt != null) {
          final local = _zone.toLocal(task.startAt!);
          _startTime = TimeOfDay(hour: local.hour, minute: local.minute);
        } else {
          _startTime = TimeOfDay(hour: now.hour, minute: 0);
        }
        if (task.dueAt != null) {
          final local = _zone.toLocal(task.dueAt!);
          _dueTime = TimeOfDay(hour: local.hour, minute: local.minute);
        }
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error is ApiException ? error.message : '无法读取任务';
      });
    }
  }

  Future<void> _save() async {
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
      );
      final result = await ref.read(tasksApiProvider).reopen(
            id: task.id,
            startAt: startAt,
            dueAt: dueAt,
            assigneeIds: [for (final person in _assignees) person.id],
            reason: _reasonController.text.trim(),
            idempotencyKey: key,
          );
      keys.complete('task:reopen:${task.id}');
      ref.invalidate(taskDetailProvider(task.id));
      if (!mounted) return;
      showSnack(context, result.pendingReview ? '重开申请已提交审核' : '重开已直接生效');
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error is ApiException ? error.message : '重开失败，请重试';
      });
    }
  }

  Future<void> _pickDate({required bool isStart}) async {
    final current = (isStart ? _startDate : _dueDate) ?? ref.read(workspaceClockProvider).businessDate;
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(current.year, current.month, current.day),
      firstDate: DateTime(2020, 1, 1),
      lastDate: DateTime(2040, 12, 31),
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
        if (_startDate == null || date.isBefore(_startDate!)) _startDate = date;
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
                      Text(
                        task.title,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
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
                          OutlinedButton(
                            onPressed: () => _pickTime(isStart: false),
                            child: Text(_dueTime.format(context)),
                          ),
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
                      TextField(
                        controller: _reasonController,
                        maxLength: 500,
                        decoration: const InputDecoration(labelText: '重开原因（必填）'),
                        onChanged: (_) => setState(() {}),
                      ),
                      if (_error != null)
                        Text(_error!, style: const TextStyle(color: PandoraColors.overdue)),
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
  String? _error;

  @override
  void initState() {
    super.initState();
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
      final me = ref.read(currentUserProvider);
      final names = {for (final person in task.participants) person.id: person.displayName};
      final sources = [
        for (final id in task.assigneeIds) PersonSummary(id: id, displayName: names[id] ?? '负责人'),
      ];
      final sourceId = (me != null && task.assigneeIds.contains(me.id))
          ? me.id
          : (sources.isEmpty ? null : sources.first.id);
      if (!mounted) return;
      setState(() {
        _task = task;
        _sources = sources;
        _sourceUserId = sourceId;
        _loading = false;
      });
      if (sourceId != null) {
        await _loadTargets(sourceId);
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error is ApiException ? error.message : '无法读取交接信息';
      });
    }
  }

  Future<void> _loadTargets(String sourceId) async {
    try {
      final api = ref.read(tasksApiProvider);
      final targets = await api.handoverTargets(subjectId: sourceId);
      final preset = await api.handoverPreset(sourceId);
      if (!mounted) return;
      setState(() {
        _targets = targets.items;
        _preset = preset.target;
        _targetUserId ??= preset.targetUserId;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error is ApiException ? error.message : '无法读取交接对象');
    }
  }

  Future<void> _savePreset() async {
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
      final preset = await ref.read(tasksApiProvider).saveHandoverPreset(
            userId: source,
            targetUserId: target,
            idempotencyKey: key,
          );
      keys.complete('handover-preset:$source');
      if (!mounted) return;
      setState(() {
        _preset = preset.target;
        _savingPreset = false;
      });
      showSnack(context, '已保存为默认交接对象');
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _savingPreset = false;
        _error = error is ApiException ? error.message : '默认交接对象保存失败';
      });
    }
  }

  Future<void> _clearPreset() async {
    final source = _sourceUserId;
    if (source == null) return;
    try {
      final keys = ref.read(operationKeysProvider);
      final key = keys.keyFor(scope: 'handover-preset:$source', method: 'DELETE', path: '/users/$source/handover-preset');
      await ref.read(tasksApiProvider).clearHandoverPreset(userId: source, idempotencyKey: key);
      keys.complete('handover-preset:$source');
      if (!mounted) return;
      setState(() => _preset = null);
      showSnack(context, '已清除默认交接对象');
    } catch (error) {
      if (!mounted) return;
      showSnack(context, error is ApiException ? error.message : '清除失败，请重试');
    }
  }

  Future<void> _submit() async {
    final task = _task;
    final source = _sourceUserId;
    final target = _targetUserId;
    if (task == null || source == null || target == null) {
      setState(() => _error = '请选择交接对象');
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
      final reason = _reasonController.text.trim();
      final payload = {
        'sourceUserId': source,
        'targetUserId': target,
        if (reason.isNotEmpty) 'reason': reason,
      };
      final key = keys.keyFor(
        scope: 'task:handover:${task.id}',
        method: 'POST',
        path: '/tasks/${task.id}/handover',
        body: payload,
      );
      final result = await ref.read(tasksApiProvider).handover(
            taskId: task.id,
            sourceUserId: source,
            targetUserId: target,
            reason: reason,
            idempotencyKey: key,
          );
      keys.complete('task:handover:${task.id}');
      ref.invalidate(taskDetailProvider(task.id));
      if (!mounted) return;
      showSnack(context, result.pendingReview ? '交接申请已提交审核' : '交接已直接生效');
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
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
                        onChanged: (value) async {
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
                              TextButton(onPressed: _clearPreset, child: const Text('清除')),
                            ],
                          ),
                        ),
                      const SizedBox(height: 6),
                      if (_targets.isEmpty)
                        const Text('没有可用的交接对象', style: TextStyle(color: PandoraColors.muted))
                      else
                        Column(
                          children: [
                            for (final person in _targets)
                              ListTile(
                                dense: true,
                                leading: Icon(
                                  _targetUserId == person.id
                                      ? Icons.radio_button_checked
                                      : Icons.radio_button_unchecked,
                                  color: _targetUserId == person.id ? PandoraColors.brand : PandoraColors.muted,
                                ),
                                title: Text(person.displayName),
                                subtitle: person.positionPath.isEmpty
                                    ? null
                                    : Text(
                                        person.positionPath,
                                        style: const TextStyle(fontSize: 11, color: PandoraColors.muted),
                                      ),
                                onTap: () => setState(() => _targetUserId = person.id),
                              ),
                          ],
                        ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _reasonController,
                        maxLength: 500,
                        decoration: const InputDecoration(labelText: '交接原因（可选）'),
                        onChanged: (_) => setState(() {}),
                      ),
                      if (_error != null)
                        Text(_error!, style: const TextStyle(color: PandoraColors.overdue)),
                      const SizedBox(height: 8),
                      FilledButton(
                        onPressed: _saving ? null : _submit,
                        child: _saving
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Text('提交交接申请'),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton(
                        onPressed: _savingPreset ? null : _savePreset,
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
