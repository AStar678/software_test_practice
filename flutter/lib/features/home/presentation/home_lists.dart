import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers.dart';
import '../../../core/router/navigation_targets.dart';
import '../../../core/router/read_context.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/fading_name_text.dart';
import '../../../core/widgets/state_views.dart';
import '../domain/home_data.dart';
import 'home_copy.dart';
import 'home_providers.dart';

/// 事件纪完整清单：保留服务端顺序，按 ID 独立展开正文。
class HomeEventsPage extends ConsumerStatefulWidget {
  const HomeEventsPage({super.key});

  @override
  ConsumerState<HomeEventsPage> createState() => _HomeEventsPageState();
}

class _HomeEventsPageState extends ConsumerState<HomeEventsPage> {
  final Set<String> _expanded = {};

  @override
  Widget build(BuildContext context) {
    final home = ref.watch(homeDataProvider);
    return PandoraPage(
      title: '事件纪',
      showBack: true,
      child: home.when(
        data: (data) => data.companyItems.isEmpty
            ? const EmptyView(message: '暂无公司事件')
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                itemCount: data.companyItems.length,
                separatorBuilder: (_, _) => const Divider(height: 8),
                itemBuilder: (context, index) {
                  final item = data.companyItems[index];
                  return _EventCard(
                    ordinal: index + 1,
                    item: item,
                    expanded: _expanded.contains(item.id),
                    onToggle: () => setState(() {
                      if (!_expanded.remove(item.id)) {
                        _expanded.add(item.id);
                      }
                    }),
                  );
                },
              ),
        loading: () => const LoadingView(),
        error: (error, _) => ErrorView(
          error: error,
          onRetry: () => ref.read(homeDataProvider.notifier).refresh(),
        ),
      ),
    );
  }
}

/// 紧凑事件条目：仅正文确实超出两行时在正文旁显示箭头；整条切换展开。
class _EventCard extends StatelessWidget {
  const _EventCard({
    required this.ordinal,
    required this.item,
    required this.expanded,
    required this.onToggle,
  });

  final int ordinal;
  final CompanyItem item;
  final bool expanded;
  final VoidCallback onToggle;

  static const _arrowWidth = 26.0;

  @override
  Widget build(BuildContext context) {
    final style = DefaultTextStyle.of(context).style.merge(homeCopyStyle);
    final scaler = MediaQuery.textScalerOf(context);
    final direction = Directionality.of(context);
    return Card(
      key: ValueKey(item.id),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 6, 8),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final truncated =
                !expanded &&
                _overflows(
                  item.body,
                  constraints.maxWidth - _arrowWidth,
                  style,
                  scaler,
                  direction,
                );
            return Semantics(
              expanded: expanded,
              child: InkWell(
                onTap: (expanded || truncated) ? onToggle : null,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ListOrdinal(ordinal, width: 24),
                    Expanded(
                      child: Text(
                        item.body,
                        style: homeCopyStyle,
                        maxLines: expanded ? null : 2,
                        overflow: expanded
                            ? TextOverflow.visible
                            : TextOverflow.ellipsis,
                      ),
                    ),
                    if (expanded || truncated)
                      SizedBox(
                        width: _arrowWidth,
                        height: 22,
                        child: Icon(
                          expanded
                              ? Icons.keyboard_arrow_up
                              : Icons.keyboard_arrow_down,
                          key: ValueKey('event-arrow-${item.id}'),
                          size: 20,
                        ),
                      ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  static bool _overflows(
    String body,
    double width,
    TextStyle style,
    TextScaler scaler,
    TextDirection direction,
  ) {
    if (width <= 0) return true;
    final painter = TextPainter(
      text: TextSpan(text: body, style: style),
      maxLines: 2,
      textDirection: direction,
      textScaler: scaler,
    )..layout(maxWidth: width);
    final exceeded = painter.didExceedMaxLines;
    painter.dispose();
    return exceeded;
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
              children: [Text(item.body, style: homeCopyStyle)],
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
    return PandoraPage(
      title: '任务看板',
      showBack: true,
      child: home.when(
        data: (data) => data.assignedTasks.isEmpty
            ? const EmptyView(message: '暂无本人负责的待办任务')
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: data.assignedTasks.length,
                separatorBuilder: (_, _) => const Divider(height: 16),
                itemBuilder: (context, index) {
                  final task = data.assignedTasks[index];
                  final overdue = task.isOverdueAt(
                    ref.read(workspaceClockProvider).now(),
                  );
                  return Card(
                    color: overdue ? const Color(0xFFF8E7E7) : null,
                    clipBehavior: Clip.antiAlias,
                    child: Semantics(
                      label: overdue ? '已逾期' : null,
                      child: ListTile(
                        leading: ListOrdinal(index + 1, width: 24),
                        title: FadingNameText(
                          task.title,
                          maxLines: 2,
                          style: homeCopyStyle,
                        ),
                        trailing: Text(
                          PandoraColors.priorityLabel(task.priority),
                          style: TextStyle(
                            color: PandoraColors.priority(task.priority),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        onTap: () => context.push(
                          NavigationTargets.task(
                            const NormalReadContext(),
                            task.taskId,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
        loading: () => const LoadingView(),
        error: (error, _) => ErrorView(
          error: error,
          onRetry: () => ref.read(homeDataProvider.notifier).refresh(),
        ),
      ),
    );
  }
}
