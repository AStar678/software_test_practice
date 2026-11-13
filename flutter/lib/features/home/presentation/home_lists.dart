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
import '../domain/home_data.dart';
import 'home_providers.dart';

/// 事件纪完整清单：模块顺序、最多十条、只读，先清单后详情。
class HomeEventsPage extends ConsumerWidget {
  const HomeEventsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final home = ref.watch(homeDataProvider);
    return PandoraPage(
      title: '事件纪',
      showBack: true,
      child: home.when(
        data: (data) => data.companyItems.isEmpty
            ? const EmptyView(message: '暂无公司事件')
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: data.companyItems.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final item = data.companyItems[index];
                  return Card(
                    clipBehavior: Clip.antiAlias,
                    child: ListTile(
                      title: Text(item.title),
                      subtitle: Text(item.body, maxLines: 2, overflow: TextOverflow.ellipsis),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('${AppRoutes.homeEvents}/${item.id}'),
                    ),
                  );
                },
              ),
        loading: () => const LoadingView(),
        error: (error, _) => ErrorView(error: error, onRetry: () => ref.read(homeDataProvider.notifier).refresh()),
      ),
    );
  }
}

class HomeEventDetailPage extends ConsumerWidget {
  const HomeEventDetailPage({super.key, required this.itemId});

  final String itemId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final home = ref.watch(homeDataProvider);
    CompanyItem? item;
    final data = home.asData?.value;
    if (data != null) {
      for (final candidate in data.companyItems) {
        if (candidate.id == itemId) {
          item = candidate;
          break;
        }
      }
    }
    return PandoraPage(
      title: '公司事件',
      showBack: true,
      child: item == null
          ? const EmptyView(message: '该事件不可读取')
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(item.title, style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                Text(item.body, style: Theme.of(context).textTheme.bodyLarge),
                const SizedBox(height: 24),
                Text(
                  '由管理员按公司顺序发布，员工端只读。',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: PandoraColors.muted),
                ),
              ],
            ),
    );
  }
}

/// 任务看板完整清单：先清单再详情，最多十条由服务端决定。
class HomeBoardPage extends ConsumerWidget {
  const HomeBoardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final home = ref.watch(homeDataProvider);
    final zone = ref.watch(companyTimeZoneProvider);
    return PandoraPage(
      title: '任务看板',
      showBack: true,
      child: home.when(
        data: (data) => data.assignedTasks.isEmpty
            ? const EmptyView(message: '暂无本人负责的待办任务')
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: data.assignedTasks.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final task = data.assignedTasks[index];
                  return Card(
                    clipBehavior: Clip.antiAlias,
                    child: ListTile(
                      title: Text(task.title, maxLines: 2, overflow: TextOverflow.ellipsis),
                      subtitle: task.assignedAt == null
                          ? null
                          : Text(
                              '派发时间 ${zone.formatDateTime(task.assignedAt!)}',
                              style: const TextStyle(color: PandoraColors.muted, fontSize: 11),
                            ),
                      trailing: Text(
                        PandoraColors.priorityLabel(task.priority),
                        style: TextStyle(
                          color: PandoraColors.priority(task.priority),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      onTap: () => context.push(NavigationTargets.task(const NormalReadContext(), task.taskId)),
                    ),
                  );
                },
              ),
        loading: () => const LoadingView(),
        error: (error, _) => ErrorView(error: error, onRetry: () => ref.read(homeDataProvider.notifier).refresh()),
      ),
    );
  }
}
