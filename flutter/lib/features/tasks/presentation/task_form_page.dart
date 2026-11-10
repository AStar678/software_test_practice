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
import '../../auth/domain/employee_user.dart';
import '../../people/domain/person_summary.dart';
import '../domain/task_record.dart';
import 'assignee_picker.dart';
import 'task_providers.dart';

const Set<String> _scheduleFields = {'allDay', 'startAt', 'dueAt', 'startDate', 'dueDate'};

class TaskCreatePage extends StatelessWidget {
  const TaskCreatePage({super.key, this.parentId});

  final String? parentId;

  @override
  Widget build(BuildContext context) {
    return TaskFormPage(initialParentId: parentId);
  }
}

class TaskEditPage extends ConsumerWidget {
  const TaskEditPage({super.key, required this.taskId});

  final String taskId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(taskDetailProvider(taskId));
    return detail.when(
      data: (task) => TaskFormPage(existing: task),
      loading: () => const Scaffold(body: LoadingView()),
      error: (error, _) => Scaffold(
        appBar: AppBar(title: const Text('编辑任务')),
        body: ErrorView(error: error, onRetry: () => ref.invalidate(taskDetailProvider(taskId))),
      ),
    );
  }
}

/// 创建普通任务与字段敏感编辑共用表单。
/// 新建不写完成标准/抽象任务/百分比；编辑只提交服务端允许的字段。
class TaskFormPage extends ConsumerStatefulWidget {
  const TaskFormPage({super.key, this.existing, this.initialParentId});

  final TaskRecord? existing;
  final String? initialParentId;

  @override
  ConsumerState<TaskFormPage> createState() => _TaskFormPageState();
}

class _TaskFormPageState extends ConsumerState<TaskFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _acceptanceController = TextEditingController();
  final _progressController = TextEditingController();
  final _reasonController = TextEditingController();

  List<PersonSummary> _candidates = const [];
  List<TaskTag> _tagCatalog = const [];
  List<PersonSummary> _assignees = const [];
  List<TaskTag> _selectedTags = const [];
  String? _parentTaskId;
  bool _parentUnavailable = false;
  bool _parentChanged = false;

  bool _allDay = false;
  CompanyDate? _allDayStart;
  CompanyDate? _allDayEnd;
  DateTime? _startAt;
  DateTime? _dueAt;

  String _priority = 'medium';
  bool _dirty = false;
  bool _saving = false;
  bool _defaultAssigneeApplied = false;
  bool _loadingMeta = true;
  bool _previewing = false;
  String? _error;
  String? _conflictHint;

  TaskRecord? get _existing => widget.existing;
  bool get _isCreate => _existing == null;
  Set<String> get _editableFields => _existing?.editableFields ?? const {};
  bool get _onlySchedule =>
      !_isCreate && _editableFields.isNotEmpty && _editableFields.every(_scheduleFields.contains);

  bool _can(String field) {
    // 新建不写完成标准或进展；完成标准只作为历史字段在有有效版的任务上按权编辑。
    if (_isCreate) return field != 'acceptanceCriteria' && field != 'progressNote';
    if (_onlySchedule) return _scheduleFields.contains(field);
    return _editableFields.contains(field);
  }

  CompanyTimeZone get _zone => ref.read(companyTimeZoneProvider);

  @override
  void initState() {
    super.initState();
    _seedFromExisting();
    unawaited(_loadMetadata());
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _acceptanceController.dispose();
    _progressController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  void _seedFromExisting() {
    final existing = _existing;
    final user = ref.read(currentUserProvider);
    final businessDate = ref.read(workspaceClockProvider).businessDate;
    if (existing == null) {
      _allDay = false;
      _startAt = _zone.at(businessDate, hour: 9);
      _dueAt = _zone.at(businessDate, hour: 18);
      _parentTaskId = widget.initialParentId;
      if (user != null && user.defaultsSelfAsAssignee) {
        _assignees = [
          PersonSummary(
            id: user.id,
            displayName: user.displayName,
            departmentName: user.departmentName,
            teamName: user.teamName,
            positionName: user.positionName,
          ),
        ];
      }
      return;
    }
    _titleController.text = existing.title;
    _descriptionController.text = existing.description;
    _acceptanceController.text = existing.acceptanceCriteria;
    _progressController.text = existing.progressNote;
    _priority = existing.priority;
    _parentTaskId = existing.parentTaskId;
    _parentUnavailable = existing.parentUnavailable;
    final participants = {for (final person in existing.participants) person.id: person};
    _assignees = [
      for (final id in existing.assigneeIds)
        PersonSummary(
          id: id,
          displayName: participants[id]?.displayName ?? '负责人',
          positionName: null,
        ),
    ];
    _selectedTags = List<TaskTag>.from(existing.tags);
    if (existing.allDay && existing.allDayStart != null && existing.allDayEnd != null) {
      _allDay = true;
      _allDayStart = existing.allDayStart;
      _allDayEnd = existing.allDayEnd;
    } else {
      _allDay = false;
      _startAt = existing.startAt == null ? _zone.at(ref.read(workspaceClockProvider).businessDate, hour: 9) : _zone.toLocal(existing.startAt!);
      _dueAt = existing.dueAt == null ? _zone.at(ref.read(workspaceClockProvider).businessDate, hour: 18) : _zone.toLocal(existing.dueAt!);
    }
  }

  Future<void> _loadMetadata() async {
    try {
      final api = ref.read(tasksApiProvider);
      final results = await Future.wait<Object>([
        api.assigneeCandidates(purpose: _isCreate ? 'create' : 'edit'),
        api.tags(),
      ]);
      if (!mounted) return;
      final candidates = results[0] as List<PersonSummary>;
      final tags = results[1] as List<TaskTag>;
      final known = {for (final person in candidates) person.id: person};
      setState(() {
        _candidates = candidates.where((person) => person.id.isNotEmpty).toList();
        _tagCatalog = tags;
        _assignees = [
          for (final person in _assignees)
            if (known[person.id] != null && _can('assigneeIds')) known[person.id]! else person,
        ];
        if (_isCreate && _assignees.isNotEmpty) _defaultAssigneeApplied = true;
        _loadingMeta = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingMeta = false;
        _error = error is ApiException ? error.message : '员工与标签加载失败';
      });
    }
  }

  bool get _hasFieldEdits {
    final existing = _existing;
    if (existing == null) return true;
    if (_can('title') && _titleController.text.trim() != existing.title) return true;
    if (_can('description') && _descriptionController.text.trim() != existing.description) return true;
    if (_can('acceptanceCriteria') && _acceptanceController.text.trim() != existing.acceptanceCriteria) return true;
    if (_can('priority') && _priority != existing.priority) return true;
    if (_can('assigneeIds') && _assignees.map((p) => p.id).join(',') != existing.assigneeIds.join(',')) return true;
    if (_can('tagIds') && _selectedTagIds.join(',') != existing.tagIds.join(',')) return true;
    if (_can('progressNote') && _progressController.text.trim() != existing.progressNote) return true;
    if (_parentChanged && _can('parentTaskId')) return true;
    if (_scheduleChanged(existing)) return true;
    return false;
  }

  List<String> get _selectedTagIds => [for (final tag in _selectedTags) tag.id];

  bool _scheduleChanged(TaskRecord existing) {
    if (!_can('allDay')) return false;
    if (_allDay != existing.allDay) return true;
    if (_allDay) {
      final start = _allDayStart?.iso;
      final end = _allDayEnd?.iso;
      return start != existing.startDate || end != existing.dueDate;
    }
    final start = _startAt?.toUtc().toIso8601String();
    final due = _dueAt?.toUtc().toIso8601String();
    return start != existing.startAt?.toIso8601String() || due != existing.dueAt?.toIso8601String();
  }

  String? _validateSchedule() {
    if (_allDay) {
      final start = _allDayStart;
      final end = _allDayEnd;
      if (start == null || end == null) return '请选择开始和结束日期';
      if (end.isBefore(start)) return '结束日期不得早于开始日期';
      return null;
    }
    final start = _startAt;
    final due = _dueAt;
    if (start == null || due == null) return '请选择开始和结束时间';
    if (due.isBefore(start)) return '截止时间不得早于开始时间';
    return null;
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final scheduleError = _validateSchedule();
    if (scheduleError != null) {
      setState(() => _error = scheduleError);
      return;
    }
    if (_assignees.isEmpty) {
      setState(() => _error = '至少需要一位负责人');
      return;
    }
    if (!_isCreate && !_hasFieldEdits) {
      setState(() => _error = '没有需要保存的修改');
      return;
    }
    if (!_isCreate) {
      if (_reasonController.text.trim().isEmpty) {
        setState(() => _error = '请填写修改原因');
        return;
      }
    }
    setState(() {
      _saving = true;
      _error = null;
      _conflictHint = null;
    });
    try {
      final api = ref.read(tasksApiProvider);
      final keys = ref.read(operationKeysProvider);
      final TaskMutationResult result;
      if (_isCreate) {
        final payload = _createPayload();
        final key = keys.keyFor(
          scope: 'task:create',
          method: 'POST',
          path: '/tasks',
          body: payload,
        );
        result = await api.create(payload: payload, idempotencyKey: key);
        keys.complete('task:create');
      } else if (_onlySchedule) {
        final payload = _reschedulePayload();
        final key = keys.keyFor(
          scope: 'task:reschedule:${_existing!.id}',
          method: 'PATCH',
          path: '/tasks/${_existing!.id}',
          body: payload,
        );
        result = await api.change(
          id: _existing!.id,
          command: 'reschedule',
          payload: payload,
          idempotencyKey: key,
        );
        keys.complete('task:reschedule:${_existing!.id}');
      } else {
        final payload = _changePayload();
        final key = keys.keyFor(
          scope: 'task:change:${_existing!.id}',
          method: 'PATCH',
          path: '/tasks/${_existing!.id}',
          body: payload,
        );
        result = await api.change(
          id: _existing!.id,
          command: 'change',
          payload: payload,
          idempotencyKey: key,
        );
        keys.complete('task:change:${_existing!.id}');
      }
      ref.invalidate(taskDetailProvider(result.taskId));
      if (!mounted) return;
      setState(() => _saving = false);
      await _showOutcome(result);
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error is ApiException ? error.message : '保存失败，请重试';
      });
      if (error is ApiException && (error.isConflict || error.statusCode == 412)) {
        setState(() => _conflictHint = '任务已更新，当前修改仍保留；请确认后重新提交。');
        await _refreshVersion();
      }
    }
  }

  Future<void> _showOutcome(TaskMutationResult result) async {
    final reviewer = await _resolveActualReviewer(result.requestId);
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(result.appliedDirectly ? '已直接生效' : '已提交审核'),
        content: Text(
          result.appliedDirectly
              ? '本任务按规则直接生效。'
              : '申请已提交${reviewer == null ? '' : '，审核人：$reviewer'}。',
        ),
        actions: [
          FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('知道了')),
        ],
      ),
    );
  }

  /// 提交后回读申请详情，展示实际保存的审核人，而不是只信预览。
  Future<String?> _resolveActualReviewer(String? requestId) async {
    if (requestId == null || requestId.isEmpty) return null;
    try {
      final request = await ref.read(approvalsApiProvider).detail(requestId);
      final reviewerId = request.currentReviewerId ?? request.route?.reviewerId;
      if (reviewerId == null) return null;
      for (final person in request.participants) {
        if (person.id == reviewerId) return person.displayName;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<void> _refreshVersion() async {
    final id = _existing?.id;
    if (id == null) return;
    try {
      await ref.read(tasksApiProvider).detail(id);
    } catch (_) {
      // 读取失败时保留草稿与冲突提示，用户可再试。
    }
  }

  Map<String, Object?> _createPayload() {
    return {
      'title': _titleController.text.trim(),
      'description': _descriptionController.text.trim(),
      'priority': _priority,
      'allDay': _allDay,
      if (_allDay) ...{
        'startDate': _allDayStart!.iso,
        'dueDate': _allDayEnd!.iso,
      } else ...{
        'startAt': _startAt!.toUtc().toIso8601String(),
        'dueAt': _dueAt!.toUtc().toIso8601String(),
      },
      'assigneeIds': [for (final person in _assignees) person.id],
      'tagIds': _selectedTagIds,
      'parentTaskId': ?_parentTaskId,
    };
  }

  Map<String, Object?> _schedulePayload() {
    return {
      'allDay': _allDay,
      if (_allDay) ...{
        'startDate': _allDayStart!.iso,
        'dueDate': _allDayEnd!.iso,
      } else ...{
        'startAt': _startAt!.toUtc().toIso8601String(),
        'dueAt': _dueAt!.toUtc().toIso8601String(),
      },
    };
  }

  Map<String, Object?> _reschedulePayload() {
    return {
      ..._schedulePayload(),
      'reason': _reasonController.text.trim(),
    };
  }

  Map<String, Object?> _changePayload() {
    final existing = _existing!;
    final payload = <String, Object?>{'reason': _reasonController.text.trim()};
    if (_can('title') && _titleController.text.trim() != existing.title) {
      payload['title'] = _titleController.text.trim();
    }
    if (_can('description') && _descriptionController.text.trim() != existing.description) {
      payload['description'] = _descriptionController.text.trim();
    }
    if (_can('acceptanceCriteria') && _acceptanceController.text.trim() != existing.acceptanceCriteria) {
      payload['acceptanceCriteria'] = _acceptanceController.text.trim();
    }
    if (_can('priority') && _priority != existing.priority) {
      payload['priority'] = _priority;
    }
    if (_can('assigneeIds') && _assignees.map((p) => p.id).join(',') != existing.assigneeIds.join(',')) {
      payload['assigneeIds'] = [for (final person in _assignees) person.id];
    }
    if (_can('tagIds') && _selectedTagIds.join(',') != existing.tagIds.join(',')) {
      payload['tagIds'] = _selectedTagIds;
    }
    if (_parentChanged && _can('parentTaskId')) {
      payload['parentTaskId'] = _parentTaskId;
    }
    if (_can('progressNote') && _progressController.text.trim() != existing.progressNote) {
      payload['progressNote'] = _progressController.text.trim();
    }
    if (_scheduleChanged(existing)) {
      payload.addAll(_schedulePayload());
    }
    return payload;
  }

  Future<void> _previewReviewer() async {
    setState(() => _previewing = true);
    try {
      final preview = await ref.read(tasksApiProvider).preview(
        {
          if (_existing != null) 'taskId': _existing!.id,
          'operation': _isCreate ? 'create' : (_onlySchedule ? 'reschedule' : 'change'),
          'assigneeIds': [for (final person in _assignees) person.id],
          if (_existing != null && _onlySchedule) 'fields': _scheduleFields.toList(),
        },
        ref.read(operationKeysProvider),
      );
      if (!mounted) return;
      final reviewerNames = <String, String>{
        for (final person in preview.route?.participants ?? const <TaskParticipant>[])
          person.id: person.displayName,
      };
      final reviewer = preview.reviewerId == null ? null : reviewerNames[preview.reviewerId];
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('审核人预览'),
          content: Text(
            preview.blocked
                ? (preview.blockedReason ?? '当前组织关系无法确定审核人，请联系管理员')
                : preview.exemptionReason != null
                    ? '${preview.exemptionReason}\n提交后按实际保存结果生效。'
                    : '审核人：${reviewer ?? '按提交时的直属上级'}',
          ),
          actions: [FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('知道了'))],
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error is ApiException ? error.message : '审核人预览失败');
    } finally {
      if (mounted) setState(() => _previewing = false);
    }
  }

  Future<void> _pickDateTime({required bool isStart}) async {
    final current = isStart ? _startAt : _dueAt;
    final initial = current ?? DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020, 1, 1),
      lastDate: DateTime(2040, 12, 31),
      cancelText: '取消',
      confirmText: '确定',
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: initial.hour, minute: initial.minute),
      cancelText: '取消',
      confirmText: '确定',
    );
    if (time == null || !mounted) return;
    final value = _zone.at(CompanyDate(date.year, date.month, date.day), hour: time.hour, minute: time.minute);
    setState(() {
      if (isStart) {
        _startAt = value;
        if (_dueAt != null && _dueAt!.isBefore(value)) _dueAt = value;
      } else {
        _dueAt = value;
        if (_startAt != null && value.isBefore(_startAt!)) _startAt = value;
      }
      _dirty = true;
    });
  }

  Future<void> _pickAllDayDate({required bool isStart}) async {
    final current = isStart ? _allDayStart : _allDayEnd;
    final initial = current ?? ref.read(workspaceClockProvider).businessDate;
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(initial.year, initial.month, initial.day),
      firstDate: DateTime(2020, 1, 1),
      lastDate: DateTime(2040, 12, 31),
      cancelText: '取消',
      confirmText: '确定',
    );
    if (picked == null || !mounted) return;
    final date = CompanyDate(picked.year, picked.month, picked.day);
    setState(() {
      if (isStart) {
        _allDayStart = date;
        if (_allDayEnd == null || _allDayEnd!.isBefore(date)) _allDayEnd = date;
      } else {
        _allDayEnd = date;
        if (_allDayStart == null || date.isBefore(_allDayStart!)) _allDayStart = date;
      }
      _dirty = true;
    });
  }

  void _switchAllDay(bool value) {
    final zone = _zone;
    setState(() {
      if (value) {
        // 从定时切换到全天：结束取原截止所在日；若原截止为次日 00:00，则回退一天，避免多推进一次。
        final start = _startAt ?? zone.at(ref.read(workspaceClockProvider).businessDate, hour: 9);
        final due = _dueAt ?? start;
        final startDate = CompanyDate(start.year, start.month, start.day);
        var dueDate = CompanyDate(due.year, due.month, due.day);
        if (due.hour == 0 && due.minute == 0 && dueDate.isAfter(startDate)) {
          dueDate = dueDate.addDays(-1);
        }
        _allDayStart = startDate;
        _allDayEnd = dueDate.isBefore(startDate) ? startDate : dueDate;
      } else {
        final startDate = _allDayStart ?? zone.dateOf(DateTime.now().toUtc());
        final endDate = _allDayEnd ?? startDate;
        _startAt = zone.at(startDate, hour: 9);
        _dueAt = zone.at(endDate, hour: 18);
      }
      _allDay = value;
      _dirty = true;
    });
  }

  Future<void> _pickParent() async {
    final queryController = TextEditingController();
    List<TaskRecord> results = const [];
    var loading = false;
    final selected = await showModalBottomSheet<TaskRecord?>(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            Future<void> search(String query) async {
              setSheetState(() => loading = true);
              try {
                final found = await ref.read(tasksApiProvider).searchParentTasks(query);
                setSheetState(() {
                  results = found.where((task) => task.id != _existing?.id).toList();
                  loading = false;
                });
              } catch (_) {
                setSheetState(() => loading = false);
              }
            }

            if (!loading && results.isEmpty) {
              unawaited(search(''));
            }
            return SafeArea(
              child: Padding(
                padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: TextField(
                        controller: queryController,
                        decoration: const InputDecoration(labelText: '按名称搜索父任务', isDense: true),
                        onSubmitted: search,
                      ),
                    ),
                    if (loading) const LinearProgressIndicator(),
                    SizedBox(
                      height: 280,
                      child: ListView.builder(
                        itemCount: results.length + 1,
                        itemBuilder: (context, index) {
                          if (index == 0) {
                            return ListTile(
                              leading: const Icon(Icons.clear),
                              title: const Text('不设置父任务'),
                              onTap: () => Navigator.of(context).pop(_noParent),
                            );
                          }
                          final task = results[index - 1];
                          return ListTile(
                            title: Text(task.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                            subtitle: Text(task.scheduleText(_zone)),
                            onTap: () => Navigator.of(context).pop(task),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
    queryController.dispose();
    if (!mounted || selected == null) return;
    setState(() {
      if (identical(selected, _noParent)) {
        _parentTaskId = null;
        _parentUnavailable = false;
      } else {
        _parentTaskId = selected.id;
        _parentUnavailable = false;
      }
      _parentChanged = true;
      _dirty = true;
    });
  }

  static final TaskRecord _noParent = const TaskRecord(id: '', title: '');

  /// 新建时普通员工默认本人，三类管理者初始为空。会话身份可能在首帧后才到达，
  /// 因此在这里（而不是 initState）按当前真实角色补默认值，且只补一次。
  void _maybeApplyDefaultAssignee(EmployeeUser? user) {
    if (!_isCreate || _defaultAssigneeApplied || _loadingMeta) return;
    if (user == null) return;
    _defaultAssigneeApplied = true;
    if (!user.defaultsSelfAsAssignee || _assignees.isNotEmpty) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _assignees.isNotEmpty) return;
      setState(() {
        _assignees = [
          PersonSummary(
            id: user.id,
            displayName: user.displayName,
            departmentName: user.departmentName,
            teamName: user.teamName,
            positionName: user.positionName,
          ),
        ];
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final existing = _existing;
    _maybeApplyDefaultAssignee(ref.watch(currentUserProvider));
    final title = _isCreate ? '新建任务' : (_onlySchedule ? '调整排期' : '编辑任务');
    return UnsavedChangesGuard(
      hasUnsavedChanges: _dirty && _hasFieldEdits,
      child: PandoraPage(
        title: title,
        showBack: true,
        onBack: () => Navigator.of(context).maybePop(),
        child: Form(
          key: _formKey,
          onChanged: () => setState(() => _dirty = true),
          child: _loadingMeta
              ? const LoadingView(label: '正在读取可选项')
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (existing != null && _onlySchedule)
                      _InfoBanner(
                        text: '你当前只能调整这条任务的排期；其他字段与状态保持不变。',
                      ),
                    if (_can('title'))
                      TextFormField(
                        controller: _titleController,
                        maxLength: 80,
                        decoration: const InputDecoration(labelText: '任务标题'),
                        validator: (value) => (value ?? '').trim().isEmpty ? '请输入任务标题' : null,
                      ),
                    if (_can('description'))
                      TextFormField(
                        controller: _descriptionController,
                        minLines: 3,
                        maxLines: 6,
                        maxLength: 5000,
                        decoration: const InputDecoration(labelText: '任务说明', alignLabelWithHint: true),
                        validator: (value) => (value ?? '').trim().isEmpty ? '请填写任务说明' : null,
                      ),
                    if (_can('acceptanceCriteria'))
                      TextFormField(
                        controller: _acceptanceController,
                        minLines: 2,
                        maxLines: 4,
                        maxLength: 2000,
                        decoration: const InputDecoration(
                          labelText: '历史完成标准（可留空）',
                          alignLabelWithHint: true,
                        ),
                      ),
                    if (_can('priority')) ...[
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        initialValue: _priority,
                        decoration: const InputDecoration(labelText: '紧急程度'),
                        items: const [
                          DropdownMenuItem(value: 'urgent', child: Text('紧急')),
                          DropdownMenuItem(value: 'high', child: Text('高')),
                          DropdownMenuItem(value: 'medium', child: Text('中')),
                          DropdownMenuItem(value: 'low', child: Text('低')),
                        ],
                        onChanged: (value) => setState(() {
                          _priority = value ?? 'medium';
                          _dirty = true;
                        }),
                      ),
                    ],
                    if (_can('allDay')) ...[
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Text('排期', style: Theme.of(context).textTheme.labelLarge),
                          const Spacer(),
                          SegmentedButton<bool>(
                            segments: const [
                              ButtonSegment(value: false, label: Text('定时')),
                              ButtonSegment(value: true, label: Text('全天')),
                            ],
                            selected: {_allDay},
                            onSelectionChanged: (selection) => _switchAllDay(selection.first),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      if (_allDay)
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () => _pickAllDayDate(isStart: true),
                                child: Text('开始 ${_allDayStart?.iso ?? '未选'}'),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () => _pickAllDayDate(isStart: false),
                                child: Text('结束 ${_allDayEnd?.iso ?? '未选'}'),
                              ),
                            ),
                          ],
                        )
                      else
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () => _pickDateTime(isStart: true),
                                child: Text(
                                  '开始 ${_startAt == null ? '未选' : '${_zone.formatDate(_startAt!)} ${_zone.formatTime(_startAt!)}'}',
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () => _pickDateTime(isStart: false),
                                child: Text(
                                  '结束 ${_dueAt == null ? '未选' : '${_zone.formatDate(_dueAt!)} ${_zone.formatTime(_dueAt!)}'}',
                                ),
                              ),
                            ),
                          ],
                        ),
                      const SizedBox(height: 4),
                      Text(
                        _allDay ? '全天事项按公司日期首尾包含。' : '定时事项按公司时区记录精确起止。',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(color: PandoraColors.muted),
                      ),
                    ],
                    if (_can('assigneeIds')) ...[
                      const SizedBox(height: 16),
                      Text('负责人', style: Theme.of(context).textTheme.labelLarge),
                      const SizedBox(height: 4),
                      AssigneePicker(
                        selected: _assignees,
                        candidates: _candidates,
                        search: (query) async {
                          try {
                            final refreshed = await ref.read(tasksApiProvider).assigneeCandidates(
                                  query: query,
                                  purpose: _isCreate ? 'create' : 'edit',
                                );
                            if (mounted) setState(() => _candidates = refreshed);
                          } catch (_) {
                            // 搜索失败保留当前候选，用户可重试。
                          }
                        },
                        onChanged: (next) => setState(() {
                          _assignees = next;
                          _dirty = true;
                        }),
                      ),
                    ] else if (_assignees.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Text('负责人（按当前顺序保留）', style: Theme.of(context).textTheme.labelLarge),
                      for (var index = 0; index < _assignees.length; index++)
                        Text('${index + 1}. ${_assignees[index].displayName}'),
                    ],
                    if (_can('tagIds')) ...[
                      const SizedBox(height: 16),
                      Text('标签（按顺序）', style: Theme.of(context).textTheme.labelLarge),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          for (final tag in _selectedTags)
                            Chip(
                              label: Text(tag.deleted ? '${tag.name}（已删除）' : tag.name),
                              onDeleted: () => setState(() {
                                _selectedTags = [..._selectedTags]..remove(tag);
                                _dirty = true;
                              }),
                            ),
                          for (final tag in _tagCatalog)
                            if (!_selectedTags.any((selected) => selected.id == tag.id))
                              ActionChip(
                                label: Text(tag.name),
                                onPressed: () => setState(() {
                                  _selectedTags = [..._selectedTags, tag];
                                  _dirty = true;
                                }),
                              ),
                        ],
                      ),
                      if (_selectedTags.isEmpty)
                        Text(
                          '未选择标签；保存时会显式清空本任务的标签。',
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(color: PandoraColors.muted),
                        ),
                    ],
                    if (_can('parentTaskId')) ...[
                      const SizedBox(height: 16),
                      Text('父任务', style: Theme.of(context).textTheme.labelLarge),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              _parentTaskId == null
                                  ? '未设置'
                                  : (_parentUnavailable ? '原父任务不可见（保持不变）' : '已选择父任务'),
                              style: const TextStyle(color: PandoraColors.muted),
                            ),
                          ),
                          TextButton(onPressed: _pickParent, child: const Text('搜索/更换')),
                          if (_parentTaskId != null)
                            TextButton(
                              onPressed: () => setState(() {
                                _parentTaskId = null;
                                _parentUnavailable = false;
                                _parentChanged = true;
                                _dirty = true;
                              }),
                              child: const Text('清除'),
                            ),
                        ],
                      ),
                    ],
                    if (_can('progressNote')) ...[
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _progressController,
                        minLines: 2,
                        maxLines: 4,
                        maxLength: 2000,
                        decoration: const InputDecoration(
                          labelText: '进展说明（可选，首次填写后进入进行中）',
                          alignLabelWithHint: true,
                        ),
                      ),
                    ],
                    if (!_isCreate) ...[
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _reasonController,
                        maxLength: 500,
                        decoration: const InputDecoration(labelText: '修改原因（必填）'),
                      ),
                      const SizedBox(height: 4),
                      OutlinedButton.icon(
                        onPressed: _previewing ? null : _previewReviewer,
                        icon: const Icon(Icons.person_search_outlined),
                        label: Text(_previewing ? '正在计算审核人…' : '查看审核人'),
                      ),
                    ] else ...[
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        onPressed: _previewing ? null : _previewReviewer,
                        icon: const Icon(Icons.person_search_outlined),
                        label: Text(_previewing ? '正在计算审核人…' : '查看审核人'),
                      ),
                    ],
                    if (_conflictHint != null) ...[
                      const SizedBox(height: 8),
                      _InfoBanner(text: _conflictHint!, isError: true),
                    ],
                    if (_error != null) ...[
                      const SizedBox(height: 8),
                      Semantics(
                        liveRegion: true,
                        child: Text(_error!, style: const TextStyle(color: PandoraColors.overdue)),
                      ),
                    ],
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: _saving ? null : _save,
                      child: _saving
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                          : Text(_isCreate ? '提交任务' : '保存修改'),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
        ),
      ),
    );
  }
}

class _InfoBanner extends StatelessWidget {
  const _InfoBanner({required this.text, this.isError = false});

  final String text;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final color = isError ? PandoraColors.overdue : PandoraColors.open;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(text, style: Theme.of(context).textTheme.bodySmall),
    );
  }
}
