import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_error.dart';
import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../tasks/domain/task_record.dart';
import '../../tasks/presentation/task_providers.dart';
import '../../tasks/presentation/task_review.dart';
import '../domain/calendar_drag.dart';

/// 日历改期独立保留原版本与绝对目标；回读新版本不能授权覆盖旧拖动。
class ScheduleConfirmation extends ConsumerStatefulWidget {
  const ScheduleConfirmation({super.key, required this.task, required this.preview});

  final TaskRecord task;
  final CalendarDragPreview preview;

  @override
  ConsumerState<ScheduleConfirmation> createState() => _ScheduleConfirmationState();
}

class _ScheduleConfirmationState extends ConsumerState<ScheduleConfirmation> with WidgetsBindingObserver {
  final _reason = TextEditingController();
  late final int _epoch;
  bool _loading = true;
  bool _saving = false;
  bool _stale = false;
  bool _attempted = false;
  bool _interrupted = false;
  String? _error;

  bool get _current => mounted && _epoch == ref.read(accountEpochProvider);

  @override
  void initState() {
    super.initState();
    _epoch = ref.read(accountEpochProvider);
    WidgetsBinding.instance.addObserver(this);
    unawaited(_check());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _reason.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed || !_current || _saving) return;
    setState(() {
      _interrupted = true;
      _stale = true;
    });
  }

  bool _changed(TaskRecord latest) =>
      latest.rowVersion != widget.task.rowVersion || !latest.canReschedule || latest.frozen || latest.done;

  Future<void> _check() async {
    try {
      final latest = await ref.read(tasksApiProvider).detail(widget.task.id);
      if (!_current) return;
      setState(() {
        _loading = false;
        _stale = _interrupted || _changed(latest);
        _error = null;
      });
    } catch (error) {
      if (!_current) return;
      setState(() {
        _loading = false;
        _error = error is ApiException ? error.message : '任务读取失败，请重试';
      });
    }
  }

  Future<void> _save() async {
    if (!_current || _saving || _loading || _stale) return;
    if (_reason.text.trim().isEmpty) {
      setState(() => _error = '请填写调整原因');
      return;
    }
    final api = ref.read(tasksApiProvider);
    final approvals = ref.read(approvalsApiProvider);
    final keys = ref.read(operationKeysProvider);
    final id = widget.task.id;
    final version = '"${widget.task.rowVersion}"';
    final payload = widget.preview.payload(_reason.text.trim());
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final latest = await api.detail(id);
      if (!_current) return;
      if (latest.done || (!_attempted && _changed(latest))) {
        setState(() {
          _saving = false;
          _stale = true;
        });
        return;
      }
      final scope = 'calendar-move:$id';
      final key = keys.keyFor(
        scope: scope,
        method: 'PATCH',
        path: '/tasks/$id',
        body: {'command': 'reschedule', ...payload},
        ifMatch: version,
      );
      _attempted = true;
      final result = await api.change(
        id: id,
        command: 'reschedule',
        payload: payload,
        idempotencyKey: key,
        ifMatch: version,
      );
      if (!_current) return;
      keys.complete(scope);
      final message = await taskMutationMessage(result, approvals);
      if (!mounted || !_current) return;
      Navigator.of(context).pop(message);
    } catch (error) {
      if (!_current) return;
      setState(() {
        _saving = false;
        _stale =
            error is ApiException && (error.statusCode == 412 || error.statusCode == 403 || error.statusCode == 404);
        _error = error is ApiException ? error.message : '调整失败，请重试';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final zone = ref.watch(companyTimeZoneProvider);
    return PopScope(
      canPop: !_saving,
      child: AlertDialog(
        title: const Text('确认调整排期'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('任务：${widget.task.title}'),
              Text('原排期：${widget.task.scheduleText(zone)}'),
              Text('新排期：${widget.preview.label(zone)}'),
              if (_loading) const Padding(padding: EdgeInsets.all(8), child: LinearProgressIndicator()),
              if (_stale) const Text('任务版本或资格已变化，或调整已中断，请取消后重新调整。', style: TextStyle(color: PandoraColors.overdue)),
              TextField(
                controller: _reason,
                maxLength: 500,
                autofocus: true,
                enabled: !_saving,
                decoration: const InputDecoration(labelText: '原因（必填）'),
              ),
              if (_error != null) Text(_error!, style: const TextStyle(color: PandoraColors.overdue)),
              if (_error != null && !_attempted && !_stale) TextButton(onPressed: _check, child: const Text('重新读取任务')),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: _saving ? null : () => Navigator.of(context).pop(), child: const Text('取消')),
          FilledButton(onPressed: _saving || _loading || _stale ? null : _save, child: Text(_saving ? '正在提交…' : '提交')),
        ],
      ),
    );
  }
}
