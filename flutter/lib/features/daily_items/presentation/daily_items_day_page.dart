import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/company/company_date.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/state_views.dart';
import '../../../core/router/app_router.dart';
import '../../home/presentation/home_providers.dart';
import '../domain/daily_item.dart';
import 'daily_items_providers.dart';

/// 某公司日的完整事项清单：唯一入口，含已完成，完成控件不误开详情。
class DailyItemsDayPage extends ConsumerStatefulWidget {
  const DailyItemsDayPage({super.key, required this.date});

  final CompanyDate date;

  @override
  ConsumerState<DailyItemsDayPage> createState() => _DailyItemsDayPageState();
}

class _DailyItemsDayPageState extends ConsumerState<DailyItemsDayPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(ref.read(dailyItemsProvider.notifier).ensureMonths([widget.date]));
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(dailyItemsProvider);
    final window = state.windowFor(widget.date);
    final items = state.itemsOn(widget.date);
    final failed = window?.error;
    if (window == null) {
      // 账号代次/会话状态重建后缓存会清空；此时重新按当前账号读取该月。
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) unawaited(ref.read(dailyItemsProvider.notifier).ensureMonths([widget.date]));
      });
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.date.month}月${widget.date.day}日 · 每日事项'),
        actions: [
          IconButton(
            tooltip: '新建事项',
            icon: const Icon(Icons.add),
            onPressed: () => context.push('${AppRoutes.dailyItemNew}?date=${widget.date.iso}'),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: Row(
                children: [
                  Text(
                    '共 ${items.length} 项',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: PandoraColors.muted),
                  ),
                  const Spacer(),
                  if (items.isNotEmpty)
                    Text(
                      '含已完成',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(color: PandoraColors.muted),
                    ),
                ],
              ),
            ),
            if (failed != null && items.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '该月部分事项加载失败，已有内容仍可查看。',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: PandoraColors.overdue),
                      ),
                    ),
                    TextButton(
                      onPressed: () => ref.read(dailyItemsProvider.notifier).retryMonth(widget.date),
                      child: const Text('重试'),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: window == null || (window.loading && items.isEmpty)
                  ? const LoadingView(label: '正在读取当日事项')
                  : failed != null && items.isEmpty
                      ? ErrorView(
                          error: failed,
                          title: '加载失败',
                          onRetry: () => ref.read(dailyItemsProvider.notifier).retryMonth(widget.date),
                        )
                      : items.isEmpty
                      ? EmptyView(
                          message: '这一天没有事项',
                          action: OutlinedButton.icon(
                            onPressed: () => context.push('${AppRoutes.dailyItemNew}?date=${widget.date.iso}'),
                            icon: const Icon(Icons.add),
                            label: const Text('新增事项'),
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          itemCount: items.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 8),
                          itemBuilder: (context, index) {
                            final item = items[index];
                            return _DailyItemRow(
                              item: item,
                              onOpen: () => context.push(AppRoutes.dailyItem(item.id)),
                              onToggle: () => _toggle(item),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _toggle(DailyItem item) async {
    try {
      await ref.read(dailyItemsProvider.notifier).toggleCompleted(item);
      unawaited(ref.read(homeDataProvider.notifier).refresh());
    } catch (error) {
      if (!mounted) return;
      showSnack(context, error is Exception ? '完成状态更新失败，请重试' : '完成状态更新失败');
    }
  }
}

class _DailyItemRow extends StatelessWidget {
  const _DailyItemRow({required this.item, required this.onOpen, required this.onToggle});

  final DailyItem item;
  final VoidCallback onOpen;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final color = item.isCompleted
        ? PandoraColors.completed
        : (item.isOverdue ? PandoraColors.overdue : PandoraColors.open);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Semantics(
            label: item.isCompleted ? '取消完成' : '标记完成',
            checked: item.isCompleted,
            child: Checkbox(
              value: item.isCompleted,
              onChanged: (_) => onToggle(),
              activeColor: PandoraColors.brand,
            ),
          ),
          Expanded(
            child: InkWell(
              onTap: onOpen,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.body,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            decoration: item.isCompleted ? TextDecoration.lineThrough : null,
                            color: item.isCompleted ? PandoraColors.muted : PandoraColors.ink,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        StatusBadge(label: item.stateLabel, color: color),
                        Text(
                          item.startDate == item.endDate
                              ? item.startDate.iso
                              : '${item.startDate.iso} 至 ${item.endDate.iso}',
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(color: PandoraColors.muted),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
    );
  }
}
