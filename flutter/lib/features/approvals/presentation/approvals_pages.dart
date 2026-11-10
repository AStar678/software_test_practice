import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_error.dart';
import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/state_views.dart';
import '../../home/presentation/home_providers.dart';
import '../../tasks/domain/task_record.dart';
import '../../tasks/presentation/task_providers.dart';
import '../domain/approval_request.dart';

/// 我的申请与待我审核：服务端分页，先过滤后计数；打开详情才做裁决。
class ApprovalsPage extends ConsumerStatefulWidget {
  const ApprovalsPage({super.key});

  @override
  ConsumerState<ApprovalsPage> createState() => _ApprovalsPageState();
}

class _ApprovalsTabState {
  List<ApprovalRequest> items = const [];
  int total = 0;
  int? nextOffset = 0;
  bool loading = false;
  Object? error;
  int generation = 0;
}

class _ApprovalsPageState extends ConsumerState<ApprovalsPage> {
  int _tab = 0;
  final Map<int, _ApprovalsTabState> _tabs = {0: _ApprovalsTabState(), 1: _ApprovalsTabState()};

  @override
  void initState() {
    super.initState();
    unawaited(_load(0, reset: true));
    unawaited(_load(1, reset: true));
  }

  Future<void> _load(int tab, {required bool reset}) async {
    final state = _tabs[tab]!;
    if (state.loading) return;
    final generation = reset ? state.generation + 1 : state.generation;
    setState(() {
      state.loading = true;
      state.error = null;
      state.generation = generation;
      if (reset) {
        state.items = const [];
        state.nextOffset = 0;
      }
    });
    try {
      final page = await ref.read(approvalsApiProvider).list(
            mine: tab == 0 ? 'applicant' : 'reviewer',
            limit: 20,
            offset: reset ? 0 : (state.nextOffset ?? 0),
          );
      if (!mounted || state.generation != generation) return;
      setState(() {
        final merged = <String, ApprovalRequest>{};
        for (final item in [...state.items, ...page.items]) {
          merged[item.requestId] = item;
        }
        state.items = merged.values.toList();
        state.total = page.total;
        state.nextOffset = page.nextOffset;
        state.loading = false;
      });
    } catch (error) {
      if (!mounted || state.generation != generation) return;
      setState(() {
        state.loading = false;
        state.error = error;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = _tabs[_tab]!;
    return PandoraPage(
      title: '申请与审核',
      showBack: true,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: SegmentedButton<int>(
              segments: const [
                ButtonSegment(value: 0, label: Text('我的申请')),
                ButtonSegment(value: 1, label: Text('待我审核')),
              ],
              selected: {_tab},
              onSelectionChanged: (selection) {
                setState(() => _tab = selection.first);
                if (_tabs[_tab]!.items.isEmpty && !_tabs[_tab]!.loading) {
                  unawaited(_load(_tab, reset: true));
                }
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              children: [
                Text(
                  '共 ${state.total} 条',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: PandoraColors.muted),
                ),
                const Spacer(),
                IconButton(
                  tooltip: '刷新',
                  onPressed: () => _load(_tab, reset: true),
                  icon: const Icon(Icons.refresh),
                ),
              ],
            ),
          ),
          Expanded(child: _buildList(state)),
        ],
      ),
    );
  }

  Widget _buildList(_ApprovalsTabState state) {
    if (state.error != null && state.items.isEmpty) {
      return ErrorView(error: state.error!, onRetry: () => _load(_tab, reset: true));
    }
    if (state.items.isEmpty) {
      return state.loading
          ? const LoadingView()
          : EmptyView(
              message: _tab == 0 ? '还没有提交过申请' : '没有待你审核的申请',
            );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      itemCount: state.items.length + 1,
      separatorBuilder: (_, _) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        if (index >= state.items.length) {
          if (state.nextOffset != null) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: OutlinedButton(
                onPressed: state.loading ? null : () => _load(_tab, reset: false),
                child: Text(state.loading ? '加载中…' : '加载更多'),
              ),
            );
          }
          return const SizedBox.shrink();
        }
        final request = state.items[index];
        return _ApprovalTile(
          request: request,
          onTap: () async {
            await Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => ApprovalDetailPage(requestId: request.requestId),
              ),
            );
            if (mounted) {
              unawaited(_load(_tab, reset: true));
            }
          },
        );
      },
    );
  }
}

class _ApprovalTile extends StatelessWidget {
  const _ApprovalTile({required this.request, required this.onTap});

  final ApprovalRequest request;
  final VoidCallback onTap;

  Color get _statusColor => switch (request.status) {
        'pending' => PandoraColors.pending,
        'approved' || 'direct' => PandoraColors.completed,
        'rejected' || 'expired' => PandoraColors.overdue,
        'withdrawn' => PandoraColors.muted,
        _ => PandoraColors.muted,
      };

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: ListTile(
        title: Text(request.title, maxLines: 2, overflow: TextOverflow.ellipsis),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Wrap(
            spacing: 6,
            runSpacing: 4,
            children: [
              StatusBadge(label: request.kindLabel, color: PandoraColors.open),
              StatusBadge(label: request.statusLabel, color: _statusColor),
              if (request.applicableDeadline != null && request.isPending)
                Text(
                  '截止 ${request.applicableDeadline!.toLocal()}',
                  style: const TextStyle(fontSize: 11, color: PandoraColors.muted),
                ),
            ],
          ),
        ),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}

/// 申请详情：当前审核人看专用 diff，申请人看自身提议与结果，旁观者只看安全摘要。
class ApprovalDetailPage extends ConsumerStatefulWidget {
  const ApprovalDetailPage({super.key, required this.requestId});

  final String requestId;

  @override
  ConsumerState<ApprovalDetailPage> createState() => _ApprovalDetailPageState();
}

class _ApprovalDetailPageState extends ConsumerState<ApprovalDetailPage> {
  ApprovalRequest? _request;
  Object? _error;
  bool _loading = true;
  bool _deciding = false;
  String? _actionError;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final request = await ref.read(approvalsApiProvider).detail(widget.requestId);
      if (!mounted) return;
      setState(() {
        _request = request;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  String? _nameOf(ApprovalRequest request, String? id) {
    if (id == null) return null;
    for (final person in request.participants) {
      if (person.id == id) return person.displayName;
    }
    return null;
  }

  Future<void> _decide(String decision) async {
    final request = _request;
    if (request == null) return;
    String? comment;
    if (decision == 'reject') {
      final controller = TextEditingController();
      comment = await showDialog<String>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('拒绝申请'),
          content: TextField(
            controller: controller,
            minLines: 3,
            maxLines: 6,
            maxLength: 2000,
            autofocus: true,
            decoration: const InputDecoration(labelText: '拒绝意见（必填）', alignLabelWithHint: true),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('取消')),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(controller.text.trim()),
              child: const Text('拒绝'),
            ),
          ],
        ),
      );
      controller.dispose();
      if (comment == null || comment.isEmpty) return;
    }
    setState(() {
      _deciding = true;
      _actionError = null;
    });
    try {
      final keys = ref.read(operationKeysProvider);
      final key = keys.keyFor(
        scope: 'approval:${request.requestId}',
        method: 'PATCH',
        path: '/approval-requests/${request.requestId}',
        body: {'decision': decision, 'comment': ?comment},
      );
      final result = await ref.read(approvalsApiProvider).decide(
            requestId: request.requestId,
            decision: decision,
            idempotencyKey: key,
            comment: comment,
          );
      keys.complete('approval:${request.requestId}');
      ref.invalidate(taskDetailProvider(request.taskId));
      ref.invalidate(homeDataProvider);
      if (!mounted) return;
      setState(() => _deciding = false);
      showSnack(
        context,
        result.deadlineExpired
            ? (result.message ?? '申请已到截止时间失效')
            : result.appliedDirectly
                ? '申请已直接生效'
                : switch (decision) {
                    'approve' => '已批准',
                    'reject' => '已拒绝',
                    _ => '已撤销',
                  },
      );
      await _load();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _deciding = false;
        _actionError = error is ApiException ? error.message : '操作失败，请重试';
      });
      // 服务端可能已改变状态：重读申请，旧按钮不复活。
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final zone = ref.watch(companyTimeZoneProvider);
    final request = _request;
    final me = ref.watch(currentUserProvider);
    return PandoraPage(
      title: '申请详情',
      showBack: true,
      child: _loading
          ? const LoadingView()
          : _error != null
              ? ErrorView(error: _error!, onRetry: _load)
              : request == null
                  ? const EmptyView(message: '申请不存在或无权查看')
                  : ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        Text(request.title, style: Theme.of(context).textTheme.titleLarge),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            StatusBadge(label: request.kindLabel, color: PandoraColors.open),
                            StatusBadge(
                              label: request.statusLabel,
                              color: request.isPending
                                  ? PandoraColors.pending
                                  : (request.status == 'rejected' || request.status == 'expired'
                                      ? PandoraColors.overdue
                                      : PandoraColors.completed),
                            ),
                            if (request.versionNo != null)
                              StatusBadge(label: '版本 ${request.versionNo}', color: PandoraColors.muted),
                          ],
                        ),
                        const SizedBox(height: 12),
                        _MetaRow(label: '申请人', value: _nameOf(request, request.applicantId) ?? '未知'),
                        _MetaRow(label: '当前审核人', value: _nameOf(request, request.currentReviewerId) ?? '未指定'),
                        if (request.createdAt != null)
                          _MetaRow(label: '提交时间', value: zone.formatDateTime(request.createdAt!)),
                        if (request.applicableDeadline != null)
                          _MetaRow(label: '有效截止', value: zone.formatDateTime(request.applicableDeadline!)),
                        if (request.applicantId == me?.id && request.exemptionReason != null)
                          _MetaRow(label: '免审原因', value: request.exemptionReason!),
                        if (request.isReviewer(me?.id) && request.isPending) ...[
                          const SizedBox(height: 8),
                          Text(
                            '逐字段原上新下',
                            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 6),
                          if (request.diff.isEmpty)
                            const Text('没有字段差异。', style: TextStyle(color: PandoraColors.muted))
                          else
                            for (final diff in request.diff) _DiffRow(diff: diff, request: request),
                        ] else if (request.applicantId == me?.id) ...[
                          const SizedBox(height: 8),
                          Text('本次提交内容', style: Theme.of(context).textTheme.titleSmall),
                          const SizedBox(height: 6),
                          _ProposalSummary(request: request),
                        ],
                        if (request.comment != null && request.comment!.trim().isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Text('处理意见', style: Theme.of(context).textTheme.titleSmall),
                          const SizedBox(height: 4),
                          Text(request.comment!),
                        ],
                        if (request.message != null) ...[
                          const SizedBox(height: 8),
                          Text(request.message!, style: const TextStyle(color: PandoraColors.overdue)),
                        ],
                        if (_actionError != null) ...[
                          const SizedBox(height: 8),
                          Text(_actionError!, style: const TextStyle(color: PandoraColors.overdue)),
                        ],
                        const SizedBox(height: 16),
                        if (request.isPending && request.isReviewer(me?.id) && request.canApproveBy(me?.id))
                          Row(
                            children: [
                              Expanded(
                                child: FilledButton(
                                  onPressed: _deciding ? null : () => _decide('approve'),
                                  child: const Text('批准'),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: _deciding ? null : () => _decide('reject'),
                                  style: OutlinedButton.styleFrom(foregroundColor: PandoraColors.overdue),
                                  child: const Text('拒绝'),
                                ),
                              ),
                            ],
                          ),
                        if (request.isPending && request.applicantId == me?.id)
                          OutlinedButton(
                            onPressed: _deciding ? null : () => _decide('withdraw'),
                            child: const Text('撤销申请'),
                          ),
                        if (!request.isPending)
                          const Text(
                            '该申请已处理完毕，旧操作不可重复执行。',
                            style: TextStyle(color: PandoraColors.muted, fontSize: 12),
                          ),
                        const SizedBox(height: 16),
                        if (request.records.isNotEmpty) ...[
                          Text('申请记录', style: Theme.of(context).textTheme.titleSmall),
                          for (final record in request.records)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                record.body,
                                style: const TextStyle(color: PandoraColors.muted, fontSize: 12),
                              ),
                            ),
                        ],
                      ],
                    ),
    );
  }
}

extension _ApprovalAudience on ApprovalRequest {
  bool isReviewer(String? userId) => userId != null && currentReviewerId == userId;

  /// 仅当前有权审核人且申请仍待审时提供裁决按钮。
  bool canApproveBy(String? userId) => isPending && isReviewer(userId);
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 84,
            child: Text(label, style: const TextStyle(color: PandoraColors.muted, fontSize: 12)),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}

class _DiffRow extends StatelessWidget {
  const _DiffRow({required this.diff, required this.request});

  final FieldDiff diff;
  final ApprovalRequest request;

  String _names(String raw, bool before) {
    final ids = raw.split(',').where((value) => value.isNotEmpty).toList();
    if (ids.isEmpty) return '（空）';
    if (diff.field == 'assigneeIds') {
      final names = {for (final person in request.participants) person.id: person.displayName};
      return [for (var i = 0; i < ids.length; i++) '${i + 1}. ${names[ids[i]] ?? ids[i]}'].join('\n');
    }
    if (diff.field == 'tagIds') {
      final version = before ? request.baseVersion : request.proposedVersion;
      final tags = {for (final tag in version?.tags ?? const <TaskTag>[]) tag.id: tag.name};
      return [for (var i = 0; i < ids.length; i++) '${i + 1}. ${tags[ids[i]] ?? ids[i]}'].join('\n');
    }
    return raw.isEmpty ? '（空）' : raw;
  }

  @override
  Widget build(BuildContext context) {
    final before = _names(diff.before, true);
    final after = _names(diff.after, false);
    final orderOnly = diff.isOrderedSet &&
        diff.before.split(',').toSet().difference(diff.after.split(',').toSet()).isEmpty &&
        diff.after.split(',').toSet().difference(diff.before.split(',').toSet()).isEmpty;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: PandoraColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(diff.label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              if (orderOnly) ...[
                const SizedBox(width: 6),
                const Text('仅顺序变化', style: TextStyle(fontSize: 11, color: PandoraColors.pending)),
              ],
            ],
          ),
          const SizedBox(height: 4),
          Text('原：$before', style: const TextStyle(color: PandoraColors.muted, fontSize: 12, height: 1.4)),
          const SizedBox(height: 2),
          Text('新：$after', style: const TextStyle(fontSize: 12, height: 1.4)),
        ],
      ),
    );
  }
}

class _ProposalSummary extends StatelessWidget {
  const _ProposalSummary({required this.request});

  final ApprovalRequest request;

  @override
  Widget build(BuildContext context) {
    final proposal = request.proposedVersion;
    if (proposal == null) return const Text('无提议内容');
    final names = {for (final person in request.participants) person.id: person.displayName};
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _MetaRow(label: '标题', value: proposal.title),
        _MetaRow(
          label: '负责人',
          value: proposal.assigneeIds.isEmpty
              ? '（空）'
              : [for (var i = 0; i < proposal.assigneeIds.length; i++) '${i + 1}. ${names[proposal.assigneeIds[i]] ?? proposal.assigneeIds[i]}'].join('\n'),
        ),
        if (proposal.tags.isNotEmpty)
          _MetaRow(label: '标签', value: proposal.tags.map((tag) => tag.name).join('、')),
        if (proposal.progressNote.isNotEmpty) _MetaRow(label: '进展', value: proposal.progressNote),
      ],
    );
  }
}
