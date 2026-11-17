import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/company/company_date.dart';
import '../../../core/providers.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/state_views.dart';
import '../../daily_items/presentation/daily_items_calendar.dart';
import '../domain/home_data.dart';
import 'home_copy.dart';
import 'home_providers.dart';

/// 首页：事件纪、任务看板（各约三条预览，卡片不内滚）与每日事项连续月份。
class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  final ScrollController _scrollController = ScrollController();
  final _calendarKey = GlobalKey<DailyItemsCalendarState>();
  CompanyDate? _visibleDate;

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _setAnchor(CompanyDate date) =>
      _calendarKey.currentState?.goToDate(date);

  Future<void> _refresh() async {
    await ref.read(homeDataProvider.notifier).refresh();
    await _calendarKey.currentState?.refreshVisible();
  }

  @override
  Widget build(BuildContext context) {
    final home = ref.watch(homeDataProvider);
    final businessDate = ref.watch(businessDateProvider);
    final anchor = _visibleDate ?? businessDate;

    return Scaffold(
      appBar: AppBar(
        title: const Text('首页'),
        actions: [
          IconButton(
            tooltip: '通知',
            icon: const Icon(Icons.notifications_none),
            onPressed: () => context.push(AppRoutes.notifications),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: CustomScrollView(
            controller: _scrollController,
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                sliver: SliverToBoxAdapter(
                  child: home.when(
                    data: (data) => _HomeCards(data: data),
                    loading: () =>
                        const SizedBox(height: 220, child: LoadingView()),
                    error: (error, _) => SizedBox(
                      height: 220,
                      child: ErrorView(
                        error: error,
                        onRetry: () =>
                            ref.read(homeDataProvider.notifier).refresh(),
                      ),
                    ),
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                sliver: SliverToBoxAdapter(
                  child: _DailyItemsHeader(
                    businessDate: businessDate,
                    anchor: anchor,
                    onPrevious: () => _setAnchor(anchor.addMonths(-1)),
                    onNext: () => _setAnchor(anchor.addMonths(1)),
                    onToday: () => _setAnchor(businessDate),
                    onPick: () => _openMonthPicker(anchor),
                    onAdd: () => context.push(
                      '${AppRoutes.dailyItemNew}?date=${businessDate.iso}',
                    ),
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverToBoxAdapter(
                  child: DailyItemsCalendar(
                    key: _calendarKey,
                    businessDate: businessDate,
                    onDaySelected: (day) =>
                        context.push(AppRoutes.dailyItemDay(day.iso)),
                    onAnchorChanged: (day) {
                      if (mounted && day != _visibleDate) {
                        setState(() => _visibleDate = day);
                      }
                    },
                  ),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 24)),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openMonthPicker(CompanyDate anchor) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(anchor.year, anchor.month, 1),
      firstDate: DateTime(2020, 1, 1),
      lastDate: DateTime(2040, 12, 31),
      helpText: '定位到年月',
      initialDatePickerMode: DatePickerMode.year,
      cancelText: '取消',
      confirmText: '定位',
    );
    if (picked != null && mounted) {
      _setAnchor(CompanyDate(picked.year, picked.month, 1));
    }
  }
}

class _HomeCards extends StatelessWidget {
  const _HomeCards({required this.data});

  final HomeData data;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: _PreviewCard(
            title: '事件纪',
            emptyText: '暂无公司事件',
            onTap: () => context.push(AppRoutes.homeEvents),
            children: [
              for (var i = 0; i < data.companyItems.take(3).length; i++) ...[
                if (i > 0) const Divider(height: 1),
                _PreviewRow(
                  title: data.companyItems[i].body,
                  onTap: () => context.push(AppRoutes.homeEvents),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _PreviewCard(
            title: '任务看板',
            emptyText: '暂无待办任务',
            onTap: () => context.push(AppRoutes.homeBoard),
            children: [
              for (var i = 0; i < data.assignedTasks.take(3).length; i++) ...[
                if (i > 0) const Divider(height: 1),
                _PreviewRow(
                  title: data.assignedTasks[i].title,
                  trailing: Text(
                    PandoraColors.priorityLabel(data.assignedTasks[i].priority),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: PandoraColors.priority(
                        data.assignedTasks[i].priority,
                      ),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  onTap: () => context.push(AppRoutes.homeBoard),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _PreviewCard extends StatelessWidget {
  const _PreviewCard({
    required this.title,
    required this.emptyText,
    required this.children,
    required this.onTap,
  });

  final String title;
  final String emptyText;
  final List<Widget> children;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '$title，点击查看完整清单',
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                if (children.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Text(
                      emptyText,
                      style: Theme.of(context).textTheme.bodySmall
                          ?.copyWith(color: PandoraColors.muted),
                    ),
                  )
                else
                  ...children,
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PreviewRow extends StatelessWidget {
  const _PreviewRow({required this.title, this.trailing, required this.onTap});

  final String title;
  final Widget? trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48),
        child: Row(
          children: [
            Expanded(
              child: Text(
                title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: homeCopyStyle,
              ),
            ),
            if (trailing != null) ...[const SizedBox(width: 6), trailing!],
          ],
        ),
      ),
    );
  }
}

class _DailyItemsHeader extends StatelessWidget {
  const _DailyItemsHeader({
    required this.businessDate,
    required this.anchor,
    required this.onPrevious,
    required this.onNext,
    required this.onToday,
    required this.onPick,
    required this.onAdd,
  });

  final CompanyDate businessDate;
  final CompanyDate anchor;
  final VoidCallback onPrevious;
  final VoidCallback onNext;
  final VoidCallback onToday;
  final VoidCallback onPick;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          '每日事项',
          style: Theme.of(context).textTheme.titleMedium
              ?.copyWith(fontWeight: FontWeight.w600),
        ),
        IconButton(
          tooltip: '新建每日事项',
          visualDensity: VisualDensity.compact,
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
          onPressed: onAdd,
          icon: const Icon(Icons.add_circle_outline),
          color: PandoraColors.brand,
        ),
        const Spacer(),
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                tooltip: '上个月',
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                onPressed: onPrevious,
                icon: const Icon(Icons.chevron_left),
              ),
              TextButton(
                onPressed: onPick,
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  minimumSize: const Size(0, 32),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text('${anchor.year}年${anchor.month}月'),
              ),
              IconButton(
                tooltip: '下个月',
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                onPressed: onNext,
                icon: const Icon(Icons.chevron_right),
              ),
              TextButton(
                onPressed: onToday,
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  minimumSize: const Size(0, 32),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text('今天'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
