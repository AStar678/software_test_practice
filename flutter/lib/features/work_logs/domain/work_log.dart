import '../../../core/company/company_date.dart';
import '../../tasks/domain/task_record.dart';

class WorkLog {
  const WorkLog({
    required this.id,
    required this.businessDate,
    required this.body,
    this.authorId = '',
    this.authorName = '',
    this.createdAt,
    this.frozenAt,
    this.frozen = false,
    this.editable = false,
    this.rowVersion = 1,
    this.tags = const [],
    this.tagIds = const [],
    this.taskId,
  });

  final String id;
  final CompanyDate businessDate;
  final String body;
  final String authorId;
  final String authorName;
  final DateTime? createdAt;
  final DateTime? frozenAt;
  final bool frozen;
  final bool editable;
  final int rowVersion;
  final List<TaskTag> tags;
  final List<String> tagIds;
  final String? taskId;

  factory WorkLog.fromJson(Map<String, Object?> json) {
    final date = CompanyDate.tryParse(json['businessDate']?.toString());
    if (date == null) throw const FormatException('日志缺少业务日期');
    final tags = <TaskTag>[
      for (final raw in (json['tags'] as List? ?? const []))
        if (raw is Map) TaskTag.fromJson(Map<String, Object?>.from(raw)),
    ];
    return WorkLog(
      id: json['id']?.toString() ?? json['logId']?.toString() ?? '',
      businessDate: date,
      body: json['body']?.toString() ?? '',
      authorId: json['authorId']?.toString() ?? '',
      authorName: json['authorName']?.toString() ?? '',
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '')?.toUtc(),
      frozenAt: DateTime.tryParse(json['frozenAt']?.toString() ?? '')?.toUtc(),
      frozen: json['frozen'] == true,
      editable: json['editable'] == true,
      rowVersion: (json['rowVersion'] as num?)?.toInt() ?? 1,
      tags: tags,
      tagIds: [for (final raw in (json['tagIds'] as List? ?? const [])) raw.toString()],
      taskId: json['taskId']?.toString(),
    );
  }
}

class WorkLogPageResult {
  const WorkLogPageResult({required this.items, required this.total, this.nextOffset});

  final List<WorkLog> items;
  final int total;
  final int? nextOffset;

  factory WorkLogPageResult.fromJson(Map<String, Object?> json) => WorkLogPageResult(
        items: [
          for (final raw in (json['items'] as List? ?? const []))
            if (raw is Map) WorkLog.fromJson(Map<String, Object?>.from(raw)),
        ],
        total: (json['total'] as num?)?.toInt() ?? 0,
        nextOffset: (json['nextOffset'] as num?)?.toInt(),
      );
}

class FillName {
  const FillName({required this.id, required this.name});
  final String id;
  final String name;
}

class FillSource {
  const FillSource({required this.dailyItems, required this.tasks, required this.complete});
  final List<FillName> dailyItems;
  final List<FillName> tasks;
  final bool complete;

  bool get isEmpty => dailyItems.isEmpty && tasks.isEmpty;

  factory FillSource.fromJson(Map<String, Object?> json) => FillSource(
        dailyItems: [
          for (final raw in (json['dailyItems'] as List? ?? const []))
            if (raw is Map) FillName(id: raw['id']?.toString() ?? '', name: raw['name']?.toString() ?? ''),
        ],
        tasks: [
          for (final raw in (json['tasks'] as List? ?? const []))
            if (raw is Map) FillName(id: raw['id']?.toString() ?? '', name: raw['name']?.toString() ?? ''),
        ],
        complete: json['complete'] == true,
      );
}
