import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
import 'task_review.dart';

/// 任务详情：有效版/来源/字段资格；上下文在进入时固定，不能靠嵌套跳转升级。
class TaskDetailPage extends ConsumerWidget {
  const TaskDetailPage({
    super.key,
    required this.taskId,
    this.readContext = const NormalReadContext(),
  });

  final String taskId;
  final ReadContext readContext;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(taskDetailProvider(taskId));
    return Scaffold(
      appBar: AppBar(
        title: Text(
          readContext is NormalReadContext
              ? '任务详情'
              : '任务详情（${readContext.label}）',
        ),
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
    final overdue =
        !task.done &&
        task.dueAt != null &&
        task.dueAt!.isBefore(DateTime.now().toUtc());
    final canWrite = readContext.businessWritesAllowed;
    final participantById = {
      for (final person in task.participants) person.id: person.displayName,
    };

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        if (readContext is! NormalReadContext)
          _ReadOnlyBanner(context: readContext),
        if (task.frozen && !task.pending)
          const _NoticeBanner(
            icon: Icons.pause_circle_outline,
            text: '任务当前处于冻结状态。',
            color: PandoraColors.pending,
          ),
        Text(
          task.title,
          style: Theme.of(context).textTheme.titleLarge
              ?.copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            StatusBadge(
              label: task.done ? '已完成' : (task.doing ? '进行中' : '待开始'),
              color: task.done
                  ? PandoraColors.completed
                  : (task.doing ? PandoraColors.open : PandoraColors.muted),
            ),
            if (task.pending)
              StatusBadge(
                label: '待审核',
                color: PandoraColors.pending,
                icon: Icons.hourglass_top,
              ),
            StatusBadge(
              label: PandoraColors.priorityLabel(task.priority),
              color: PandoraColors.priority(task.priority),
            ),
            if (task.allDay)
              const StatusBadge(
                label: '全天',
                color: PandoraColors.muted,
                icon: Icons.wb_sunny_outlined,
              ),
            if (task.executionRound > 1)
              StatusBadge(
                label: '第 ${task.executionRound} 轮',
                color: PandoraColors.open,
              ),
          ],
        ),
        const SizedBox(height: 12),
        _MetaRow(
          label: '截止',
          child: Text(
            overdue
                ? '${task.deadlineText(zone)} · 已逾期'
                : task.deadlineText(zone),
            style: overdue
                ? const TextStyle(color: PandoraColors.overdue)
                : null,
          ),
        ),
        _MetaRow(label: '排期', child: Text(task.scheduleText(zone))),
        _MetaRow(
          label: '负责人',
          child: Text(
            task.assigneeIds.isEmpty
                ? '暂无负责人'
                : [
                    for (var index = 0; index < task.assigneeIds.length; index++)
                      '${index + 1}. ${participantById[task.assigneeIds[index]] ?? task.assigneeIds[index]}',
                  ].join('\n'),
          ),
        ),
        if (task.tags.isNotEmpty)
          _MetaRow(
            label: '标签',
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
        _MetaRow(
          label: '创建',
          child: Text(
            '${participantById[task.originalCreatorId] ?? '未知'}'
            '${task.createdAt == null ? '' : ' · ${zone.formatDateTime(task.createdAt!)}'}',
            style: const TextStyle(color: PandoraColors.muted),
          ),
        ),
        if (task.description.isNotEmpty)
          _Section(title: '说明', child: Text(task.description)),
        if (task.progressNote.isNotEmpty)
          _Section(title: '当前进展', child: Text(task.progressNote)),
        if (task.parentTaskId != null)
          _Section(
            title: '父任务',
            child: task.parentUnavailable
                ? const Text('原父任务不可见，关系保留')
                : InkWell(
                    onTap: () => context.push(
                      NavigationTargets.task(readContext, task.parentTaskId!),
                    ),
                    child: const Text(
                      '打开父任务',
                      style: TextStyle(color: PandoraColors.brand),
                    ),
                  ),
          ),
        const SizedBox(height: 8),
        if (canWrite) ...[
          if (task.editableFields.isNotEmpty && !task.frozen)
            FilledButton.icon(
              onPressed: () => context.push(AppRoutes.taskEdit(task.id)),
              icon: const Icon(Icons.edit_outlined),
              label: Text(
                task.editableFields.every(_isScheduleField) ? '调整排期' : '编辑任务',
              ),
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
          if (task.pending && task.pendingRequestId != null) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () =>
                  context.push(AppRoutes.approval(task.pendingRequestId!)),
              icon: const Icon(Icons.fact_check_outlined),
              label: const Text('查看当前申请'),
            ),
          ],
          if (task.done &&
              me?.id != null &&
              task.businessOwnerId == me!.id &&
              !task.pending &&
              !task.frozen) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => context.push(AppRoutes.taskReopen(task.id)),
              icon: const Icon(Icons.restart_alt),
              label: const Text('重开任务'),
            ),
          ],
          if (task.canTablePin) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => _toggleTablePin(context, ref, task),
              icon: Icon(
                task.tablePinned ? Icons.push_pin : Icons.push_pin_outlined,
              ),
              label: Text(task.tablePinned ? '取消表单置顶' : '置顶到表单'),
            ),
          ],
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

  static bool _isScheduleField(String field) => const {
    'allDay',
    'startAt',
    'dueAt',
    'startDate',
    'dueDate',
  }.contains(field);

  Future<void> _toggleTablePin(
    BuildContext context,
    WidgetRef ref,
    TaskRecord task,
  ) async {
    final keys = ref.read(operationKeysProvider);
    final scope = 'table-pin:${task.id}';
    final key = keys.keyFor(
      scope: scope,
      method: task.tablePinned ? 'DELETE' : 'PUT',
      path: '/tasks/${task.id}/table-pin',
      body: const {},
    );
    try {
      await ref
          .read(tasksApiProvider)
          .setTablePin(
            taskId: task.id,
            pinned: !task.tablePinned,
            idempotencyKey: key,
          );
      keys.complete(scope);
      ref.invalidate(taskDetailProvider(task.id));
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _submitProgress(BuildContext context, WidgetRef ref) =>
      _submitNote(context, ref, 'progress');

  Future<void> _submitCompletion(BuildContext context, WidgetRef ref) =>
      _submitNote(context, ref, 'complete');

  Future<void> _submitNote(
    BuildContext context,
    WidgetRef ref,
    String command,
  ) async {
    final epoch = ref.read(accountEpochProvider);
    final message = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (_) => TaskNoteDialog(
        taskId: task.id,
        rowVersion: task.rowVersion,
        command: command,
      ),
    );
    if (!context.mounted ||
        epoch != ref.read(accountEpochProvider) ||
        message == null) {
      return;
    }
    ref.invalidate(taskDetailProvider(task.id));
    ref.invalidate(homeDataProvider);
    showSnack(context, message);
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 56,
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelSmall
                  ?.copyWith(color: PandoraColors.muted),
            ),
          ),
          Expanded(child: child),
        ],
      ),
    );
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
          Text(
            title,
            style: Theme.of(context).textTheme.labelMedium
                ?.copyWith(color: PandoraColors.muted),
          ),
          const SizedBox(height: 4),
          child,
        ],
      ),
    );
  }
}

class _NoticeBanner extends StatelessWidget {
  const _NoticeBanner({
    required this.icon,
    required this.text,
    required this.color,
  });

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
          Expanded(
            child: Text(text, style: Theme.of(context).textTheme.bodySmall),
          ),
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
          const Icon(
            Icons.visibility_outlined,
            size: 18,
            color: PandoraColors.brand,
          ),
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
