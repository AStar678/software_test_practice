import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/state_views.dart';
import '../domain/analytics_models.dart';
import 'analytics_providers.dart';

class AnalyticsPage extends ConsumerStatefulWidget {
  const AnalyticsPage({super.key});

  @override
  ConsumerState<AnalyticsPage> createState() => _AnalyticsPageState();
}

class _AnalyticsPageState extends ConsumerState<AnalyticsPage> {
  String _scope = 'auto';
  AnalyticsSummary? _summary;
  AnalyticsReport? _report;
  Object? _error;
  bool _loading = false;
  bool _generating = false;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('统计')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.all(12),
            children: [
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'auto', label: Text('授权范围')),
                  ButtonSegment(value: 'self', label: Text('仅本人')),
                ],
                selected: {_scope},
                onSelectionChanged: (value) {
                  _scope = value.single;
                  _report = null;
                  _load();
                },
              ),
              const SizedBox(height: 12),
              if (_loading && _summary == null)
                const SizedBox(
                  height: 180,
                  child: LoadingView(label: '正在统计真实任务'),
                ),
              if (_error != null && _summary == null)
                ErrorView(error: _error!, onRetry: _load),
              if (_summary != null) ..._summaryCards(_summary!),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: _generating ? null : _generate,
                icon: const Icon(Icons.auto_graph_outlined),
                label: Text(_generating ? '生成中…' : '生成本地规则建议'),
              ),
              const Padding(
                padding: EdgeInsets.only(top: 6),
                child: Text(
                  '建议由服务端本地比例与排期规则生成，不调用外部模型。',
                  style: TextStyle(color: PandoraColors.muted),
                ),
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
                _metric('待办', value.todo),
                _metric('进行中', value.doing),
                _metric('已完成', value.done),
                _metric('冻结', value.frozen),
                _metric('完成待审', value.pendingComplete),
                _metric('逾期', value.overdue),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              '紧急 ${value.priority['urgent'] ?? 0} · 高 ${value.priority['high'] ?? 0} · 中 ${value.priority['medium'] ?? 0} · 低 ${value.priority['low'] ?? 0}',
            ),
            const SizedBox(height: 8),
            Text(
              '方法 ${value.method} · 生成于 ${_time(value.generatedAt)}',
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
            Text('关键词', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 8),
            if (value.keywords.isEmpty)
              const Text('当前授权范围没有可提取的关键词')
            else
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final keyword in value.keywords)
                    Chip(label: Text('${keyword.word} ${keyword.count}')),
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
              '方法 ${value.method} · 外部模型：${value.modelUsed ? '是' : '否'} · ${_time(value.generatedAt)}',
              style: const TextStyle(color: PandoraColors.muted),
            ),
            const Divider(),
            if (value.suggestions.isEmpty)
              const Text('当前没有需要提示的排期或紧急任务')
            else
              for (final suggestion in value.suggestions)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.lightbulb_outline),
                  title: Text(suggestion.title),
                  subtitle: Text(suggestion.message),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: suggestion.taskId.isEmpty
                      ? null
                      : () => context.push('/tasks/${suggestion.taskId}'),
                ),
          ],
        ),
      ),
    ),
  ];

  Widget _metric(String label, int value) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
    decoration: BoxDecoration(
      color: PandoraColors.petal,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Text('$label $value'),
  );

  Future<void> _load() async {
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await ref
          .read(analyticsApiProvider)
          .summary(scope: _scope);
      if (!mounted || generation != _generation) return;
      setState(() => _summary = result);
    } catch (error) {
      if (mounted && generation == _generation) setState(() => _error = error);
    } finally {
      if (mounted && generation == _generation) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _generate() async {
    setState(() {
      _generating = true;
      _error = null;
    });
    final keys = ref.read(operationKeysProvider);
    final key = keys.keyFor(
      scope: 'analytics:$_scope',
      method: 'POST',
      path: '/ai-jobs',
      body: {'scopeType': _scope},
    );
    try {
      final id = await ref
          .read(analyticsApiProvider)
          .createReport(scope: _scope, idempotencyKey: key);
      final result = await ref.read(analyticsApiProvider).report(id);
      keys.complete('analytics:$_scope');
      if (mounted) setState(() => _report = result);
    } catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  String _time(DateTime? value) => value == null
      ? '时间未知'
      : DateFormat('yyyy-MM-dd HH:mm').format(value.toLocal());
}
