import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/errors/app_error.dart';
import '../../../core/providers.dart';
import '../../../core/router/app_router.dart';
import '../../../core/router/navigation_targets.dart';
import '../../../core/router/read_context.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/state_views.dart';
import '../../comments/presentation/comments_section.dart';
import '../../home/presentation/home_providers.dart';
import '../domain/task_record.dart';
import 'task_providers.dart';

/// 任务详情：有效版/来源/字段资格；上下文在进入时固定，不能靠嵌套跳转升级。
class TaskDetailPage extends ConsumerWidget {
  const TaskDetailPage({super.key, required this.taskId, this.readContext = const NormalReadContext()});

  final String taskId;
  final ReadContext readContext;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(taskDetailProvider(taskId));
    return Scaffold(
      appBar: AppBar(
        title: Text(readContext is NormalReadContext ? '任务详情' : '任务详情（${readContext.label}）'),
        actions: [
          IconButton(
            tooltip: '刷新任务',
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(taskDetailProvider(taskId)),
          ),
        ],
      ),
      body: SafeArea(
        child: detail.when(
          data: (task) => _TaskDetailBody(task: task, readContext: readContext),
          loading: () => const LoadingView(),
          error: (error, _) => ErrorView(
            error: error,
            onRetry: () => ref.invalidate(taskDetailProvider(taskId)),
          ),
        ),
      ),
    );
  }
}

class _TaskDetailBody extends ConsumerWidget {
  const _TaskDetailBody({required this.task, required this.readContext});

  final TaskRecord task;
  final ReadContext readContext;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final zone = ref.watch(companyTimeZoneProvider);
    final me = ref.watch(currentUserProvider);
    final isAssignee = me != null && task.assigneeIds.contains(me.id);
    final overdue = !task.done && task.dueAt != null && task.dueAt!.isBefore(DateTime.now().toUtc());
    final canWrite = readContext.businessWritesAllowed;
    final participantById = {for (final person in task.participants) person.id: person.displayName};

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        if (readContext is! NormalReadContext)
          _ReadOnlyBanner(context: readContext),
        if (task.pending)
          _NoticeBanner(
            icon: Icons.hourglass_top,
            text: '有待审核的${task.pendingKind == null ? '申请' : _kindLabel(task.pendingKind!)}，业务写入暂停。',
            color: PandoraColors.pending,
          ),
        if (task.frozen && !task.pending)
          const _NoticeBanner(icon: Icons.pause_circle_outline, text: '任务当前处于冻结状态。', color: PandoraColors.pending),
        if (overdue)
          const _NoticeBanner(icon: Icons.schedule, text: '已超过截止时间。', color: PandoraColors.overdue),
        Text(task.title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            StatusBadge(
              label: task.done ? '已完成' : (task.doing ? '进行中' : '待开始'),
              color: task.done ? PandoraColors.completed : (task.doing ? PandoraColors.open : PandoraColors.muted),
            ),
            if (task.pending)
              StatusBadge(label: '待审核', color: PandoraColors.pending, icon: Icons.hourglass_top),
            StatusBadge(
              label: PandoraColors.priorityLabel(task.priority),
              color: PandoraColors.priority(task.priority),
            ),
            if (task.allDay)
              const StatusBadge(label: '全天', color: PandoraColors.muted, icon: Icons.wb_sunny_outlined),
            if (task.executionRound > 1)
              StatusBadge(label: '第 ${task.executionRound} 轮', color: PandoraColors.open),
          ],
        ),
        const SizedBox(height: 14),
        _Section(title: '排期', child: Text(task.scheduleText(zone))),
        _Section(
          title: '负责人（按顺序）',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var index = 0; index < task.assigneeIds.length; index++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text('${index + 1}. ${participantById[task.assigneeIds[index]] ?? task.assigneeIds[index]}'),
                ),
              if (task.assigneeIds.isEmpty) const Text('暂无负责人'),
            ],
          ),
        ),
        if (task.tags.isNotEmpty)
          _Section(
            title: '标签',
            child: Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final tag in task.tags)
                  Chip(
                    label: Text(tag.deleted ? '${tag.name}（已删除）' : tag.name),
                    visualDensity: VisualDensity.compact,
                  ),
              ],
            ),
          ),
        if (task.description.isNotEmpty) _Section(title: '说明', child: Text(task.description)),
        if (task.acceptanceCriteria.isNotEmpty)
          _Section(title: '完成标准（历史）', child: Text(task.acceptanceCriteria)),
        if (task.progressNote.isNotEmpty) _Section(title: '最新进展', child: Text(task.progressNote)),
        if (task.parentTaskId != null)
          _Section(
            title: '父任务',
            child: task.parentUnavailable
                ? const Text('原父任务不可见，关系保留')
                : InkWell(
                    onTap: () => context.push(NavigationTargets.task(readContext, task.parentTaskId!)),
                    child: const Text('打开父任务', style: TextStyle(color: PandoraColors.brand)),
                  ),
          ),
        _Section(
          title: '来源',
          child: Text(
            '原创建者：${participantById[task.originalCreatorId] ?? '未知'}\n'
            '创建时间：${task.createdAt == null ? '未知' : zone.formatDateTime(task.createdAt!)}',
            style: const TextStyle(color: PandoraColors.muted, height: 1.5),
          ),
        ),
        if (task.route != null)
          _Section(
            title: '审核',
            child: Text(
              task.route!.blocked
                  ? (task.route!.reasonText ?? '当前无法确定审核人')
                  : task.route!.reasonText ?? '按提交时的直属上级审核',
              style: const TextStyle(color: PandoraColors.muted),
            ),
          ),
        const SizedBox(height: 8),
        if (canWrite) ...[
          if (task.editableFields.isNotEmpty && !task.frozen)
            FilledButton.icon(
              onPressed: () => context.push(AppRoutes.taskEdit(task.id)),
              icon: const Icon(Icons.edit_outlined),
              label: Text(task.editableFields.every(_isScheduleField) ? '调整排期' : '编辑任务'),
            ),
          if (isAssignee && !task.done && !task.frozen) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _submitProgress(context, ref),
                    icon: const Icon(Icons.notes),
                    label: const Text('提交进展'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _submitCompletion(context, ref),
                    icon: const Icon(Icons.task_alt),
                    label: const Text('提交完成'),
                  ),
                ),
              ],
            ),
          ],
          if (task.done && me?.id != null && task.businessOwnerId == me!.id) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => context.push(AppRoutes.taskReopen(task.id)),
              icon: const Icon(Icons.restart_alt),
              label: const Text('重开任务'),
            ),
          ],
          if (isAssignee && !task.pending && !task.frozen) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => context.push(AppRoutes.taskHandover(task.id)),
              icon: const Icon(Icons.swap_horiz),
              label: const Text('交接任务'),
            ),
          ],
          if (task.canTablePin) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => _toggleTablePin(context, ref, task),
              icon: Icon(task.tablePinned ? Icons.push_pin : Icons.push_pin_outlined),
              label: Text(task.tablePinned ? '取消表单置顶' : '置顶到表单'),
            ),
          ],
          if (task.pending)
            TextButton(
              onPressed: () => context.push(AppRoutes.approvals),
              child: const Text('查看我的申请'),
            ),
        ] else
          const Text(
            '当前为只读浏览，业务操作请回到本人正常入口办理。',
            style: TextStyle(color: PandoraColors.muted),
          ),
        if (readContext.commentsAllowed) ...[
          const Divider(height: 32),
          CommentsSection(objectType: 'task', objectId: task.id),
        ],
      ],
    );
  }

  static bool _isScheduleField(String field) => const {'allDay', 'startAt', 'dueAt', 'startDate', 'dueDate'}.contains(field);

  static String _kindLabel(String kind) => switch (kind) {
        'create' => '新建申请',
        'change' => '修改申请',
        'progress' => '进展申请',
        'complete' => '完成申请',
        'reopen' => '重开申请',
        'handover' => '交接申请',
        'reschedule' => '排期申请',
        _ => '申请',
      };

  Future<void> _toggleTablePin(BuildContext context, WidgetRef ref, TaskRecord task) async {
    final keys = ref.read(operationKeysProvider);
    final scope = 'table-pin:${task.id}';
    final key = keys.keyFor(
      scope: scope,
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
      keys.complete(scope);
      ref.invalidate(taskDetailProvider(task.id));
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _submitProgress(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController();
    final note = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('提交进展'),
        content: TextField(
          controller: controller,
          minLines: 3,
          maxLines: 6,
          maxLength: 2000,
          autofocus: true,
          decoration: const InputDecoration(labelText: '进展说明', alignLabelWithHint: true),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('取消')),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(controller.text.trim()),
            child: const Text('提交'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (note == null || note.isEmpty || !context.mounted) return;
    await _mutate(
      context,
      ref,
      command: 'progress',
      payload: {'progressNote': note},
      successHint: '进展已提交',
    );
  }

  Future<void> _submitCompletion(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController();
    final note = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('提交完成'),
        content: TextField(
          controller: controller,
          minLines: 3,
          maxLines: 6,
          maxLength: 2000,
          autofocus: true,
          decoration: const InputDecoration(labelText: '完成说明（必填）', alignLabelWithHint: true),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('取消')),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(controller.text.trim()),
            child: const Text('提交'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (note == null || note.isEmpty || !context.mounted) return;
    await _mutate(
      context,
      ref,
      command: 'complete',
      payload: {'completionNote': note},
      successHint: '完成申请已提交',
    );
  }

  Future<void> _mutate(
    BuildContext context,
    WidgetRef ref, {
    required String command,
    required Map<String, Object?> payload,
    required String successHint,
  }) async {
    final keys = ref.read(operationKeysProvider);
    final body = {'command': command, ...payload};
    final key = keys.keyFor(
      scope: 'task:$command:${task.id}',
      method: 'PATCH',
      path: '/tasks/${task.id}',
      body: body,
    );
    try {
      final result = await ref.read(tasksApiProvider).change(
            id: task.id,
            command: command,
            payload: payload,
            idempotencyKey: key,
          );
      keys.complete('task:$command:${task.id}');
      ref.invalidate(taskDetailProvider(task.id));
      ref.invalidate(homeDataProvider);
      if (!context.mounted) return;
      showSnack(context, result.pendingReview ? '$successHint，等待审核' : '$successHint，已直接生效');
    } on ApiException catch (error) {
      if (!context.mounted) return;
      showSnack(context, error.message);
      ref.invalidate(taskDetailProvider(task.id));
    }
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.labelMedium?.copyWith(color: PandoraColors.muted)),
          const SizedBox(height: 4),
          child,
        ],
      ),
    );
  }
}

class _NoticeBanner extends StatelessWidget {
  const _NoticeBanner({required this.icon, required this.text, required this.color});

  final IconData icon;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: Theme.of(context).textTheme.bodySmall)),
        ],
      ),
    );
  }
}

class _ReadOnlyBanner extends StatelessWidget {
  const _ReadOnlyBanner({required this.context});

  final ReadContext context;

  @override
  Widget build(BuildContext widgetContext) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: PandoraColors.petal,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.visibility_outlined, size: 18, color: PandoraColors.brand),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              context is HistoryNotificationReadContext
                  ? '历史消息中的只读任务摘要，不提供评论与业务操作。'
                  : '通过${context.label}浏览，业务操作只读。',
              style: Theme.of(widgetContext).textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}
