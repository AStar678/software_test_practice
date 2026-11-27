import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/errors/app_error.dart';
import '../../../core/navigation/tab_refresh.dart';
import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/state_views.dart';
import '../domain/analytics_models.dart';
import 'analytics_providers.dart';

class AnalyticsPage extends ConsumerStatefulWidget {
  const AnalyticsPage({super.key});

  @override
  ConsumerState<AnalyticsPage> createState() => _AnalyticsPageState();
}

class _AnalyticsPageState extends ConsumerState<AnalyticsPage> {
  AnalyticsSummary? _summary;
  AnalyticsReport? _report;
  Object? _summaryError;
  Object? _reportError;
  bool _loading = false;
  bool _generating = false;
  int _summaryGeneration = 0;
  int _reportGeneration = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    ref.listenTabRefresh(AppTab.stats, () {
      _load(preserve: true);
    });
    ref.listen(
      currentUserProvider.select((user) => (user?.id, user?.authzVersion)),
      (_, _) => _reloadScope(),
    );
    return Scaffold(
      appBar: AppBar(title: const PandoraPageMark(pageName: '统计')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _load(preserve: true),
          child: ListView(
            padding: const EdgeInsets.all(12),
            children: [
              if (_loading && _summary == null)
                const SizedBox(
                  height: 180,
                  child: LoadingView(label: '正在统计真实任务'),
                ),
              if (_summaryError != null)
                ErrorView(error: _summaryError!, onRetry: _load),
              if (_summary != null) ..._summaryCards(_summary!),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: _generating || _loading ? null : _generate,
                icon: const Icon(Icons.auto_graph_outlined),
                label: Text(_generating ? '正在重算…' : '刷新并重算'),
              ),
              const Padding(
                padding: EdgeInsets.only(top: 6),
                child: Text(
                  '建议由服务端本地比例与排期规则生成，不调用外部模型。',
                  style: TextStyle(color: PandoraColors.muted),
                ),
              ),
              if (_reportError != null)
                ErrorView(
                  error: _reportError!,
                  onRetry: _generate,
                  title: '生成建议失败',
                ),
              if (_report != null) ..._reportCards(_report!),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _summaryCards(AnalyticsSummary value) => [
    Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${value.scopeLabel} · ${value.total} 项',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _metric('待开始', value.todo),
                _metric('进行中', value.doing),
                _metric('已完成', value.done),
                _metric('全部待审冻结', value.frozen),
                _metric('待完成审核', value.pendingComplete),
                _metric('逾期未完成', value.overdue),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              '紧急 ${value.priority['urgent'] ?? 0} · 高 ${value.priority['high'] ?? 0} · 中 ${value.priority['medium'] ?? 0} · 低 ${value.priority['low'] ?? 0}',
            ),
            const SizedBox(height: 8),
            Text(
              '统计方法：${_methodLabel(value.method)} · 更新于 ${_time(value.generatedAt)}',
              style: const TextStyle(color: PandoraColors.muted),
            ),
          ],
        ),
      ),
    ),
    Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('关键词词云', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 8),
            if (value.keywords.isEmpty)
              const Text('当前授权范围没有可提取的关键词')
            else
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final keyword in value.keywords)
                    Tooltip(
                      message: '${keyword.word}：出现 ${keyword.count} 次',
                      child: Text(
                        keyword.word,
                        style: TextStyle(
                          fontSize:
                              12 +
                              (8 * keyword.count / _maxKeywordCount(value))
                                  .roundToDouble(),
                          fontWeight: keyword.count > 1
                              ? FontWeight.w700
                              : FontWeight.w500,
                          color: keyword.count > 1
                              ? const Color(0xFF1D4ED8)
                              : PandoraColors.muted,
                        ),
                      ),
                    ),
                ],
              ),
          ],
        ),
      ),
    ),
  ];

  List<Widget> _reportCards(AnalyticsReport value) => [
    const SizedBox(height: 12),
    Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '规则建议 · ${value.suggestionScopeLabel}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            Text(
              '生成于 ${_time(value.generatedAt)} · ${_methodLabel(value.method)}',
              style: const TextStyle(color: PandoraColors.muted),
            ),
            const Divider(),
            if (value.suggestions.isEmpty)
              const Text('当前没有需要提示的排期或紧急任务')
            else
              for (final suggestion in value.suggestions)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.lightbulb_outline),
                      title: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_ruleLabel(suggestion.rule)),
                          Text(suggestion.title),
                        ],
                      ),
                      subtitle: Text(suggestion.message),
                      trailing: suggestion.taskIds.length == 1
                          ? const Icon(Icons.chevron_right)
                          : null,
                      onTap: suggestion.taskIds.length == 1
                          ? () => context.push(
                              '/tasks/${suggestion.taskIds.single}',
                            )
                          : null,
                    ),
                    if (suggestion.taskIds.length > 1)
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        children: [
                          for (
                            var index = 0;
                            index < suggestion.taskIds.length;
                            index++
                          )
                            OutlinedButton(
                              onPressed: () => context.push(
                                '/tasks/${suggestion.taskIds[index]}',
                              ),
                              child: Text('查看相关任务 ${index + 1}'),
                            ),
                        ],
                      ),
                  ],
                ),
          ],
        ),
      ),
    ),
  ];

  int _maxKeywordCount(AnalyticsSummary value) => value.keywords.fold(
    1,
    (maximum, word) => word.count > maximum ? word.count : maximum,
  );

  Widget _metric(String label, int value) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
    decoration: BoxDecoration(
      color: PandoraColors.petal,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Text('$label $value'),
  );

  void _reloadScope() {
    _reportGeneration++;
    _report = null;
    _reportError = null;
    _generating = false;
    _load();
  }

  Future<void> _load({bool preserve = false}) async {
    final generation = ++_summaryGeneration;
    _reportGeneration++;
    setState(() {
      if (!preserve) {
        _summary = null;
        _report = null;
      }
      _reportError = null;
      _generating = false;
      _loading = true;
      _summaryError = null;
    });
    try {
      final result = await ref
          .read(analyticsApiProvider)
          .summary(scope: 'auto');
      if (!mounted || generation != _summaryGeneration) return;
      setState(() => _summary = result);
    } catch (error) {
      if (mounted && generation == _summaryGeneration) {
        setState(() => _summaryError = error);
      }
    } finally {
      if (mounted && generation == _summaryGeneration) {
        setState(() => _loading = false);
      }
    }
    if (mounted && generation == _summaryGeneration && _summaryError == null) {
      await _generate(preserve: preserve);
    }
  }

  Future<void> _generate({bool preserve = false}) async {
    if (_generating) return;
    const scope = 'auto';
    final generation = ++_reportGeneration;
    final accountEpoch = ref.read(accountEpochProvider);
    setState(() {
      _generating = true;
      if (!preserve) _report = null;
      _reportError = null;
    });
    final keys = ref.read(operationKeysProvider);
    final api = ref.read(analyticsApiProvider);
    final operationScope =
        'analytics:$scope:${ref.read(currentUserProvider)?.authzVersion}';
    final key = keys.keyFor(
      scope: operationScope,
      method: 'POST',
      path: '/ai-jobs',
      body: {'scopeType': scope},
    );
    try {
      final id = await api.createReport(scope: scope, idempotencyKey: key);
      if (!mounted ||
          generation != _reportGeneration ||
          accountEpoch != ref.read(accountEpochProvider)) {
        return;
      }
      keys.complete(operationScope);
      final result = await api.report(id);
      if (mounted &&
          generation == _reportGeneration &&
          accountEpoch == ref.read(accountEpochProvider)) {
        setState(() {
          _report = result;
          _summary = result.summary;
        });
      }
    } catch (error) {
      final scopeChanged =
          error is ApiException && error.code == 'ANALYSIS_SCOPE_CHANGED';
      if (scopeChanged) keys.complete(operationScope);
      if (mounted && generation == _reportGeneration) {
        setState(() {
          _reportError = error;
          if (scopeChanged) _summary = null;
        });
      }
    } finally {
      if (mounted && generation == _reportGeneration) {
        setState(() => _generating = false);
      }
    }
  }

  String _time(DateTime? value) => value == null
      ? '时间未知'
      : ref.read(companyTimeZoneProvider).formatDateTime(value);

  String _methodLabel(String method) => switch (method) {
    'current_effective_tasks' => '当前有效任务',
    _ => '本地规则统计',
  };

  String _ruleLabel(String rule) => switch (rule) {
    'overdue' => '已逾期',
    'remaining_20_percent' => '剩余工期 20%',
    'remaining_10_percent' => '剩余工期 10%',
    'remaining_5_percent' => '剩余工期 5%',
    'schedule_conflict' => '排期冲突',
    'high_priority' => '高紧急程度',
    _ => '规则建议',
  };
}
