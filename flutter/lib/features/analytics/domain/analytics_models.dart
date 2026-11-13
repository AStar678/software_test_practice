class AnalyticsSummary {
  const AnalyticsSummary({
    required this.total,
    required this.todo,
    required this.doing,
    required this.done,
    required this.frozen,
    required this.pendingComplete,
    required this.overdue,
    required this.priority,
    required this.scope,
    required this.scopeLabel,
    required this.method,
    required this.keywords,
    this.generatedAt,
  });

  final int total;
  final int todo;
  final int doing;
  final int done;
  final int frozen;
  final int pendingComplete;
  final int overdue;
  final Map<String, int> priority;
  final String scope;
  final String scopeLabel;
  final String method;
  final List<AnalyticsKeyword> keywords;
  final DateTime? generatedAt;

  factory AnalyticsSummary.fromJson(Map<String, Object?> json) =>
      AnalyticsSummary(
        total: _int(json['total']),
        todo: _int(json['todo']),
        doing: _int(json['doing']),
        done: _int(json['done']),
        frozen: _int(json['frozen']),
        pendingComplete: _int(json['pendingComplete']),
        overdue: _int(json['overdue']),
        priority: {
          for (final entry
              in (json['priority'] is Map
                      ? Map<String, Object?>.from(json['priority'] as Map)
                      : const <String, Object?>{})
                  .entries)
            entry.key: _int(entry.value),
        },
        scope: json['scope']?.toString() ?? 'self',
        scopeLabel: json['scopeLabel']?.toString() ?? '本人',
        method: json['method']?.toString() ?? 'current_effective_tasks',
        keywords: [
          for (final value in json['keywords'] as List? ?? const [])
            if (value is Map)
              AnalyticsKeyword.fromJson(Map<String, Object?>.from(value)),
        ],
        generatedAt: DateTime.tryParse(json['generatedAt']?.toString() ?? ''),
      );
}

class AnalyticsKeyword {
  const AnalyticsKeyword({required this.word, required this.count});
  final String word;
  final int count;

  factory AnalyticsKeyword.fromJson(Map<String, Object?> json) =>
      AnalyticsKeyword(
        word: json['word']?.toString() ?? '',
        count: _int(json['count']),
      );
}

class AnalyticsSuggestion {
  const AnalyticsSuggestion({
    required this.rule,
    required this.taskId,
    required this.title,
    required this.message,
  });
  final String rule;
  final String taskId;
  final String title;
  final String message;

  factory AnalyticsSuggestion.fromJson(Map<String, Object?> json) =>
      AnalyticsSuggestion(
        rule: json['rule']?.toString() ?? '',
        taskId: json['taskId']?.toString() ?? '',
        title: json['title']?.toString() ?? '',
        message: json['message']?.toString() ?? '',
      );
}

class AnalyticsReport {
  const AnalyticsReport({
    required this.mode,
    required this.method,
    required this.modelUsed,
    required this.statisticsScopeLabel,
    required this.suggestionScopeLabel,
    required this.summary,
    required this.suggestions,
    this.generatedAt,
  });

  final String mode;
  final String method;
  final bool modelUsed;
  final String statisticsScopeLabel;
  final String suggestionScopeLabel;
  final AnalyticsSummary summary;
  final List<AnalyticsSuggestion> suggestions;
  final DateTime? generatedAt;

  factory AnalyticsReport.fromJson(Map<String, Object?> json) =>
      AnalyticsReport(
        mode: json['mode']?.toString() ?? 'rule_based',
        method:
            json['method']?.toString() ?? 'local_proportional_schedule_rules',
        modelUsed: json['modelUsed'] == true,
        statisticsScopeLabel: json['statisticsScopeLabel']?.toString() ?? '本人',
        suggestionScopeLabel: json['suggestionScopeLabel']?.toString() ?? '本人',
        summary: AnalyticsSummary.fromJson(
          json['summary'] is Map
              ? Map<String, Object?>.from(json['summary'] as Map)
              : const {},
        ),
        suggestions: [
          for (final value in json['suggestions'] as List? ?? const [])
            if (value is Map)
              AnalyticsSuggestion.fromJson(Map<String, Object?>.from(value)),
        ],
        generatedAt: DateTime.tryParse(json['generatedAt']?.toString() ?? ''),
      );
}

int _int(Object? value) =>
    value is num ? value.toInt() : int.tryParse(value?.toString() ?? '') ?? 0;
