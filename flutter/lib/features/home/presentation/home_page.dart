import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/company/company_date.dart';
import '../../../core/preferences/app_preferences.dart';
import '../../../core/providers.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/state_views.dart';
import '../../daily_items/presentation/daily_items_calendar.dart';
import '../../daily_items/presentation/daily_items_providers.dart';
import '../domain/home_data.dart';
import 'home_providers.dart';

/// 首页：事件纪、任务看板（各约三条预览，卡片不内滚）与每日事项连续月份。
class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  final ScrollController _scrollController = ScrollController();
  final List<CompanyDate> _months = <CompanyDate>[];
  CompanyDate? _anchorMonth;
  AppPreferences? _preferences;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_maybeAppendMonths);
    unawaited(_loadPreferences());
  }

  @override
  void dispose() {
    _scrollController.removeListener(_maybeAppendMonths);
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadPreferences() async {
    final accountId = ref.read(currentUserProvider)?.id;
    final prefs = await AppPreferences.load(accountId);
    if (!mounted) return;
    final saved = CompanyDate.tryParse(prefs.getString('dailyItems.anchor'));
    setState(() {
      _preferences = prefs;
      if (saved != null) {
        _anchorMonth = CompanyDate(saved.year, saved.month, 1);
        _months.clear();
      }
    });
    _ensureMonths();
  }

  CompanyDate get _businessDate => ref.read(workspaceClockProvider).businessDate;

  void _ensureMonths() {
    if (_anchorMonth == null) {
      final parsedBusiness = CompanyDate.tryParse(
        ref.read(homeDataProvider).asData?.value.businessDate,
      );
      final base = parsedBusiness ?? _businessDate;
      _anchorMonth = CompanyDate(base.year, base.month, 1);
    }
    final anchor = _anchorMonth!;
    if (_months.isEmpty) {
      for (var offset = 0; offset <= 24; offset++) {
        _months.add(CompanyDate(anchor.year, anchor.month, 1).addMonths(offset));
      }
    }
  }

  void _setAnchor(CompanyDate month) {
    final normalized = CompanyDate(month.year, month.month, 1);
    setState(() {
      _anchorMonth = normalized;
      _months.clear();
      for (var offset = 0; offset <= 24; offset++) {
        _months.add(normalized.addMonths(offset));
      }
    });
    unawaited(_preferences?.setString('dailyItems.anchor', normalized.iso));
  }

  final GlobalKey _calendarAreaKey = GlobalKey();

  void _maybeAppendMonths() {
    if (!_scrollController.hasClients || _months.isEmpty) return;
    final position = _scrollController.position;
    if (position.pixels > position.maxScrollExtent - 800) {
      final last = _months.last;
      final appended = <CompanyDate>[];
      for (var offset = 1; offset <= 12; offset++) {
        appended.add(last.addMonths(offset));
      }
      setState(() => _months.addAll(appended));
    }
  }

  Future<void> _refresh() async {
    await ref.read(homeDataProvider.notifier).refresh();
    final months = <CompanyDate>{};
    final top = _firstVisibleMonthIndex();
    for (var index = top; index <= top + 2; index++) {
      if (index >= 0 && index < _months.length) months.add(_months[index]);
    }
    await ref.read(dailyItemsProvider.notifier).ensureMonths(months);
  }

  int _firstVisibleMonthIndex() {
    final anchor = _anchorMonth;
    if (anchor == null) return 0;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final home = ref.watch(homeDataProvider);
    final businessDate = ref.watch(businessDateProvider);
    _ensureMonths();
    final anchor = _anchorMonth!;

    return Scaffold(
      appBar: AppBar(
        title: const Text('首页'),
        actions: [
          IconButton(
            tooltip: '通知',
            icon: const Icon(Icons.notifications_none),
            onPressed: () => context.push(AppRoutes.notifications),
          ),
          IconButton(
            tooltip: '每日事项月份定位',
            icon: const Icon(Icons.calendar_month_outlined),
            onPressed: () => _openMonthPicker(anchor),
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
                    loading: () => const SizedBox(height: 220, child: LoadingView()),
                    error: (error, _) => SizedBox(
                      height: 220,
                      child: ErrorView(
                        error: error,
                        onRetry: () => ref.read(homeDataProvider.notifier).refresh(),
                      ),
                    ),
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                sliver: SliverToBoxAdapter(
                  child: Container(
                    key: _calendarAreaKey,
                    child: _DailyItemsHeader(
                      businessDate: businessDate,
                      anchor: anchor,
                      onPrevious: () => _setAnchor(anchor.addMonths(-1)),
                      onNext: () => _setAnchor(anchor.addMonths(1)),
                      onToday: () => _setAnchor(CompanyDate(businessDate.year, businessDate.month, 1)),
                      onPick: () => _openMonthPicker(anchor),
                      onAdd: () => context.push('${AppRoutes.dailyItemNew}?date=${businessDate.iso}'),
                    ),
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                sliver: SliverList.builder(
                  itemCount: _months.length,
                  itemBuilder: (context, index) {
                    final month = _months[index];
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                      child: DailyItemsMonthBlock(
                        key: ValueKey('${month.year}-${month.month}'),
                        month: month,
                        businessDate: businessDate,
                        onDaySelected: (day) => context.push(AppRoutes.dailyItemDay(day.iso)),
                      ),
                    );
                  },
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
              for (final item in data.companyItems.take(3))
                _PreviewRow(
                  title: item.title,
                  subtitle: item.body,
                  onTap: () => context.push(AppRoutes.homeEvents),
                ),
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
              for (final task in data.assignedTasks.take(3))
                _PreviewRow(
                  title: task.title,
                  trailing: Text(
                    PandoraColors.priorityLabel(task.priority),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: PandoraColors.priority(task.priority),
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  onTap: () => context.push(AppRoutes.homeBoard),
                ),
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
                Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                if (children.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Text(
                      emptyText,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: PandoraColors.muted),
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
  const _PreviewRow({required this.title, this.subtitle, this.trailing, required this.onTap});

  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: SizedBox(
        height: 44,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodyMedium),
                  if (subtitle != null && subtitle!.isNotEmpty)
                    Text(
                      subtitle!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(color: PandoraColors.muted),
                    ),
                ],
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
        Text('每日事项', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
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
