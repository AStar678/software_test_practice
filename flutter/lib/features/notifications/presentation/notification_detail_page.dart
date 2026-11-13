import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/state_views.dart';
import '../domain/notification_record.dart';
import 'notifications_providers.dart';

class NotificationDetailPage extends ConsumerStatefulWidget {
  const NotificationDetailPage({super.key, required this.notificationId});
  final String notificationId;

  @override
  ConsumerState<NotificationDetailPage> createState() =>
      _NotificationDetailPageState();
}

class _NotificationDetailPageState
    extends ConsumerState<NotificationDetailPage> {
  NotificationDetail? _detail;
  Object? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final api = ref.read(notificationsApiProvider);
      var detail = await api.detail(widget.notificationId);
      if (detail.unread) {
        final keys = ref.read(operationKeysProvider);
        final scope = 'notification-open:${widget.notificationId}';
        final key = keys.keyFor(
          scope: scope,
          method: 'POST',
          path: '/notifications/${widget.notificationId}/open',
          body: const {},
        );
        await api.open(id: widget.notificationId, idempotencyKey: key);
        keys.complete(scope);
        detail = await api.detail(widget.notificationId);
      }
      if (mounted) setState(() => _detail = detail);
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final value = _detail;
    return Scaffold(
      appBar: AppBar(title: const Text('通知详情')),
      body: SafeArea(
        child: _error != null
            ? ErrorView(error: _error!, onRetry: _load)
            : value == null
            ? const LoadingView(label: '正在打开通知')
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (value.withdrawn) const _Notice(text: '该事件已撤回，仅保留安全摘要。'),
                  if (value.relationLost)
                    const _Notice(text: '工作关系或访问范围已变化，当前仅可按消息授权读取。'),
                  Text(
                    value.title ?? value.objectName ?? value.purpose ?? '通知',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    value.summary,
                    style: const TextStyle(fontSize: 16, height: 1.55),
                  ),
                  if (value.changeSummary != null &&
                      value.changeSummary != value.summary) ...[
                    const SizedBox(height: 12),
                    Text(
                      value.changeSummary!,
                      style: const TextStyle(color: PandoraColors.muted),
                    ),
                  ],
                  if (value.eventResult != null)
                    _line('结果', value.eventResult!),
                  if (value.requestStatus != null)
                    _line('申请状态', value.requestStatus!),
                  if (value.requestComment != null)
                    _line('处理意见', value.requestComment!),
                  const SizedBox(height: 20),
                  if (value.canReadRequest && value.requestId != null)
                    FilledButton.tonalIcon(
                      onPressed: () =>
                          context.push('/approvals/${value.requestId}'),
                      icon: Icon(
                        value.canReview
                            ? Icons.fact_check_outlined
                            : Icons.receipt_long_outlined,
                      ),
                      label: Text(
                        value.canReview
                            ? '审核原申请'
                            : (value.canWithdrawRequest ? '查看并撤销原申请' : '查看原申请'),
                      ),
                    ),
                  if (value.canOpenTask && value.taskId != null) ...[
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: () => context.push(
                        value.readonly || value.relationLost
                            ? '/notifications/${value.id}/task'
                            : '/tasks/${value.taskId}',
                      ),
                      icon: Icon(
                        value.readonly || value.relationLost
                            ? Icons.history_outlined
                            : Icons.open_in_new,
                      ),
                      label: Text(
                        value.readonly || value.relationLost
                            ? '查看历史任务摘要'
                            : '打开当前任务',
                      ),
                    ),
                  ],
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: _busy ? null : () => _hide(value),
                    icon: const Icon(Icons.visibility_off_outlined),
                    label: const Text('从我的通知中隐藏'),
                  ),
                  if (value.canWithdraw) ...[
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: _busy ? null : () => _withdraw(value),
                      icon: const Icon(Icons.undo_outlined),
                      label: const Text('撤回事件（严格 180 秒内）'),
                    ),
                  ],
                  if (value.canWithdrawRequest)
                    const Padding(
                      padding: EdgeInsets.only(top: 12),
                      child: Text(
                        '业务申请撤销请在原申请详情办理；它与事件撤回是两个独立动作。',
                        style: TextStyle(color: PandoraColors.muted),
                      ),
                    ),
                ],
              ),
      ),
    );
  }

  Widget _line(String label, String text) => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: Text('$label：$text'),
  );

  Future<void> _hide(NotificationDetail value) async {
    final ok = await _confirm('隐藏这条通知？', '隐藏只影响你的通知列表，不改变业务状态或审计记录。');
    if (ok != true || !mounted) return;
    setState(() => _busy = true);
    try {
      final keys = ref.read(operationKeysProvider);
      final scope = 'notification-hide:${value.id}';
      final key = keys.keyFor(
        scope: scope,
        method: 'PATCH',
        path: '/notifications/${value.id}',
        body: const {'action': 'hide'},
        ifMatch: value.rowVersion.toString(),
      );
      await ref
          .read(notificationsApiProvider)
          .hide(
            id: value.id,
            rowVersion: value.rowVersion,
            idempotencyKey: key,
          );
      keys.complete(scope);
      if (mounted) context.pop(true);
    } catch (error) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = error;
        });
      }
    }
  }

  Future<void> _withdraw(NotificationDetail value) async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('撤回事件'),
        content: TextField(
          controller: controller,
          maxLength: 500,
          decoration: const InputDecoration(labelText: '撤回原因'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('撤回'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (reason == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final keys = ref.read(operationKeysProvider);
      final scope = 'notification-withdraw:${value.id}';
      final body = {'reason': reason.isEmpty ? '发起人撤回' : reason};
      final key = keys.keyFor(
        scope: scope,
        method: 'POST',
        path: '/notifications/${value.id}/withdraw',
        body: body,
      );
      await ref
          .read(notificationsApiProvider)
          .withdrawEvent(
            id: value.id,
            reason: body['reason']!,
            idempotencyKey: key,
          );
      keys.complete(scope);
      if (mounted) await _load();
    } catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool?> _confirm(String title, String body) => showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: Text(body),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('取消'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('确认'),
        ),
      ],
    ),
  );
}

class HistoricalNotificationTaskPage extends ConsumerStatefulWidget {
  const HistoricalNotificationTaskPage({
    super.key,
    required this.notificationId,
  });
  final String notificationId;

  @override
  ConsumerState<HistoricalNotificationTaskPage> createState() =>
      _HistoricalNotificationTaskPageState();
}

class _HistoricalNotificationTaskPageState
    extends ConsumerState<HistoricalNotificationTaskPage> {
  HistoricalTaskSummary? _task;
  Object? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    try {
      final value = await ref
          .read(notificationsApiProvider)
          .historicalTask(widget.notificationId);
      if (mounted) setState(() => _task = value);
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final task = _task;
    return Scaffold(
      appBar: AppBar(title: const Text('历史任务摘要')),
      body: SafeArea(
        child: _error != null
            ? ErrorView(error: _error!, onRetry: _load)
            : task == null
            ? const LoadingView()
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const _Notice(text: '仅由当前通知授权的独立只读摘要；不会进入任务列表、日历、搜索或普通缓存。'),
                  Text(
                    task.title,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  if (task.description.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text(task.description),
                    ),
                  if (task.progressNote?.isNotEmpty == true)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text('最新进展：${task.progressNote}'),
                    ),
                  const SizedBox(height: 16),
                  Text('状态：${task.executionState ?? '未知'}'),
                  Text(
                    '排期：${task.startDate ?? task.startAt?.toIso8601String() ?? '未设置'} 至 ${task.dueDate ?? task.dueAt?.toIso8601String() ?? '未设置'}',
                  ),
                  if (task.accessRevoked)
                    const Padding(
                      padding: EdgeInsets.only(top: 12),
                      child: Text(
                        '普通访问关系已失效。',
                        style: TextStyle(color: PandoraColors.overdue),
                      ),
                    ),
                  const Padding(
                    padding: EdgeInsets.only(top: 16),
                    child: Text(
                      '此页无评论、置顶、排期、审核、父子跳转或任何写操作。',
                      style: TextStyle(color: PandoraColors.muted),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 14),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: PandoraColors.petal,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Text(text),
  );
}
