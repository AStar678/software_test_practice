import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_error.dart';
import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../approvals/data/approvals_api.dart';
import '../domain/task_record.dart';
import 'task_providers.dart';

/// 预览只作提示；实际审核人必须来自已保存的申请，不能用预览兜底。
Future<String> taskMutationMessage(
  TaskMutationResult result,
  ApprovalsApi approvals,
) async {
  if (result.appliedDirectly) return '已直接生效';
  if (!result.pendingReview) return result.feedback;
  if (result.requestId != null) {
    try {
      final request = await approvals.detail(result.requestId!);
      final id = request.currentReviewerId ?? request.route?.reviewerId;
      for (final person in [
        ...request.participants,
        ...?request.route?.participants,
      ]) {
        if (person.id == id) return '已提交审核，审核人：${person.displayName}';
      }
    } catch (_) {
      // 写入已经成功；回读失败不能作为写入失败重试，也不能沿用旧预览。
    }
  }
  return '已提交审核，可在我的申请中查看实际审核人';
}

class ReviewerPreviewPanel extends ConsumerStatefulWidget {
  const ReviewerPreviewPanel({super.key, required this.payload});

  final Map<String, Object?> payload;

  @override
  ConsumerState<ReviewerPreviewPanel> createState() =>
      _ReviewerPreviewPanelState();
}

class _ReviewerPreviewPanelState extends ConsumerState<ReviewerPreviewPanel> {
  ReviewerPreview? _preview;
  String? _error;
  int _generation = 0;
  late final int _epoch;

  @override
  void initState() {
    super.initState();
    _epoch = ref.read(accountEpochProvider);
    unawaited(_load());
  }

  @override
  void didUpdateWidget(ReviewerPreviewPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (jsonEncode(widget.payload) != jsonEncode(oldWidget.payload)) {
      unawaited(_load());
    }
  }

  bool _current(int generation) =>
      mounted &&
      generation == _generation &&
      _epoch == ref.read(accountEpochProvider);

  Future<void> _load() async {
    if (_epoch != ref.read(accountEpochProvider)) return;
    final generation = ++_generation;
    setState(() {
      _preview = null;
      _error = null;
    });
    try {
      final preview = await ref
          .read(tasksApiProvider)
          .preview(widget.payload, ref.read(operationKeysProvider));
      if (_current(generation)) setState(() => _preview = preview);
    } catch (error) {
      if (_current(generation)) {
        setState(
          () => _error = error is ApiException
              ? userMessageFor(error)
              : '审核路线读取失败',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(accountEpochProvider);
    if (_epoch != ref.read(accountEpochProvider)) {
      return const SizedBox.shrink();
    }
    final preview = _preview;
    String text;
    if (_error != null) {
      text = '暂时无法确认审核路线：$_error。提交时会重新校验。';
    } else if (preview == null) {
      text = '正在确认本次审核路线…';
    } else if (preview.blocked) {
      text = '审核路线不可用：${preview.blockedReason ?? '请管理员修复组织关系'}';
    } else if (preview.requiresApproval) {
      final id = preview.reviewerId ?? preview.route?.reviewerId;
      final people = preview.route?.participants ?? const <TaskParticipant>[];
      final names = {
        for (final person in people) person.id: person.displayName,
      };
      text = names[id] == null ? '提交时按实际申请人确定审核人' : '审核人：${names[id]}';
    } else {
      text =
          '无需审核人：${preview.exemptionReason ?? preview.route?.reasonText ?? '按规则免审'}；提交后直接生效。';
    }
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Semantics(
        liveRegion: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(text, style: const TextStyle(color: PandoraColors.muted)),
            if (_error != null)
              TextButton(onPressed: _load, child: const Text('重试审核人预览')),
          ],
        ),
      ),
    );
  }
}

/// 在对话框内提交：失败保留正文，未知结果可沿用相同操作键重试。
class TaskNoteDialog extends ConsumerStatefulWidget {
  const TaskNoteDialog({
    super.key,
    required this.taskId,
    required this.rowVersion,
    required this.command,
  });

  final String taskId;
  final int rowVersion;
  final String command;

  @override
  ConsumerState<TaskNoteDialog> createState() => _TaskNoteDialogState();
}

class _TaskNoteDialogState extends ConsumerState<TaskNoteDialog> {
  final _controller = TextEditingController();
  bool _saving = false;
  String? _error;
  late final int _epoch;

  bool get _current => mounted && _epoch == ref.read(accountEpochProvider);

  @override
  void initState() {
    super.initState();
    _epoch = ref.read(accountEpochProvider);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_current || _saving) return;
    final note = _controller.text.trim();
    if (note.isEmpty) {
      setState(() => _error = '请填写说明');
      return;
    }
    final command = widget.command;
    final version = '"${widget.rowVersion}"';
    final payload = {
      command == 'progress' ? 'progressNote' : 'completionNote': note,
    };
    final scope = 'task:$command:${widget.taskId}';
    final keys = ref.read(operationKeysProvider);
    final api = ref.read(tasksApiProvider);
    final approvals = ref.read(approvalsApiProvider);
    final key = keys.keyFor(
      scope: scope,
      method: 'PATCH',
      path: '/tasks/${widget.taskId}',
      body: {'command': command, ...payload},
      ifMatch: version,
    );
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final result = await api.change(
        id: widget.taskId,
        command: command,
        payload: payload,
        idempotencyKey: key,
        ifMatch: version,
      );
      if (!mounted || !_current) return;
      keys.complete(scope);
      final message = await taskMutationMessage(result, approvals);
      if (!mounted || !_current) return;
      Navigator.of(context).pop(message);
    } catch (error) {
      if (!mounted || !_current) return;
      setState(() {
        _saving = false;
        _error = error is ApiException ? userMessageFor(error) : '提交失败，请重试';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final progress = widget.command == 'progress';
    return PopScope(
      canPop: !_saving,
      child: AlertDialog(
        title: Text(progress ? '提交进展' : '提交完成'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ReviewerPreviewPanel(
                payload: {'taskId': widget.taskId, 'operation': widget.command},
              ),
              TextField(
                controller: _controller,
                enabled: !_saving,
                minLines: 3,
                maxLines: 6,
                maxLength: 2000,
                autofocus: true,
                decoration: InputDecoration(
                  labelText: progress ? '进展说明（必填）' : '完成说明（必填）',
                  alignLabelWithHint: true,
                ),
              ),
              if (_error != null)
                Text(
                  _error!,
                  style: const TextStyle(color: PandoraColors.overdue),
                ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: _saving ? null : () => Navigator.of(context).pop(),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? '正在提交…' : '提交'),
          ),
        ],
      ),
    );
  }
}
