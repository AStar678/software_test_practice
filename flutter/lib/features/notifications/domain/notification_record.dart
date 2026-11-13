enum NotificationReadFilter {
  all('all', '全部'),
  unread('unread', '未读'),
  read('read', '已读');

  const NotificationReadFilter(this.apiValue, this.label);
  final String apiValue;
  final String label;
}

enum NotificationCategory {
  all('all', '全部'),
  review('review', '需我审核'),
  result('result', '结果告知'),
  reminder('reminder', '提醒'),
  comment('comment', '评论'),
  other('other', '其他');

  const NotificationCategory(this.apiValue, this.label);
  final String apiValue;
  final String label;
}

class NotificationRecord {
  const NotificationRecord({
    required this.id,
    required this.eventType,
    required this.summary,
    required this.createdAt,
    required this.rowVersion,
    required this.category,
    this.title,
    this.readAt,
    this.purpose,
    this.objectName,
    this.canReview = false,
    this.requestId,
  });

  final String id;
  final String eventType;
  final String? title;
  final String summary;
  final DateTime? createdAt;
  final DateTime? readAt;
  final int rowVersion;
  final String category;
  final String? purpose;
  final String? objectName;
  final bool canReview;
  final String? requestId;

  bool get unread => readAt == null;

  factory NotificationRecord.fromJson(Map<String, Object?> json) =>
      NotificationRecord(
        id: json['id']?.toString() ?? '',
        eventType: json['eventType']?.toString() ?? '',
        title: json['title']?.toString(),
        summary: json['summary']?.toString() ?? '',
        createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
        readAt: DateTime.tryParse(json['readAt']?.toString() ?? ''),
        rowVersion: (json['rowVersion'] as num?)?.toInt() ?? 0,
        category: json['category']?.toString() ?? 'other',
        purpose: json['purpose']?.toString(),
        objectName: json['objectName']?.toString(),
        canReview: json['canReview'] == true,
        requestId: json['requestId']?.toString(),
      );
}

class NotificationPageResult {
  const NotificationPageResult({
    required this.items,
    required this.total,
    required this.unreadCount,
    this.nextOffset,
  });

  final List<NotificationRecord> items;
  final int total;
  final int unreadCount;
  final int? nextOffset;

  factory NotificationPageResult.fromJson(Map<String, Object?> json) =>
      NotificationPageResult(
        items: [
          for (final item in json['items'] as List? ?? const [])
            if (item is Map)
              NotificationRecord.fromJson(Map<String, Object?>.from(item)),
        ],
        total: (json['total'] as num?)?.toInt() ?? 0,
        unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
        nextOffset: (json['nextOffset'] as num?)?.toInt(),
      );
}

class NotificationDetail extends NotificationRecord {
  const NotificationDetail({
    required super.id,
    required super.eventType,
    required super.summary,
    required super.createdAt,
    required super.rowVersion,
    required super.category,
    super.title,
    super.readAt,
    super.purpose,
    super.objectName,
    super.canReview,
    super.requestId,
    this.changeSummary,
    this.taskId,
    this.eventResult,
    this.requestStatus,
    this.requestKind,
    this.requestComment,
    this.requestDecidedAt,
    this.canReadRequest = false,
    this.canWithdrawRequest = false,
    this.canOpenTask = false,
    this.canWithdraw = false,
    this.withdrawn = false,
    this.readonly = false,
    this.relationLost = false,
    this.expiresAt,
  });

  final String? changeSummary;
  final String? taskId;
  final String? eventResult;
  final String? requestStatus;
  final String? requestKind;
  final String? requestComment;
  final DateTime? requestDecidedAt;
  final bool canReadRequest;
  final bool canWithdrawRequest;
  final bool canOpenTask;
  final bool canWithdraw;
  final bool withdrawn;
  final bool readonly;
  final bool relationLost;
  final DateTime? expiresAt;

  factory NotificationDetail.fromJson(Map<String, Object?> json) {
    final base = NotificationRecord.fromJson(json);
    return NotificationDetail(
      id: base.id,
      eventType: base.eventType,
      summary: base.summary,
      createdAt: base.createdAt,
      rowVersion: base.rowVersion,
      category: base.category,
      title: base.title,
      readAt: base.readAt,
      purpose: base.purpose,
      objectName: base.objectName,
      canReview: base.canReview,
      requestId: base.requestId,
      changeSummary: json['changeSummary']?.toString(),
      taskId: json['taskId']?.toString(),
      eventResult: json['eventResult']?.toString(),
      requestStatus: json['requestStatus']?.toString(),
      requestKind: json['requestKind']?.toString(),
      requestComment: json['requestComment']?.toString(),
      requestDecidedAt: DateTime.tryParse(
        json['requestDecidedAt']?.toString() ?? '',
      ),
      canReadRequest: json['canReadRequest'] == true,
      canWithdrawRequest: json['canWithdrawRequest'] == true,
      canOpenTask: json['canOpenTask'] == true,
      canWithdraw: json['canWithdraw'] == true,
      withdrawn: json['withdrawn'] == true || json['revoked'] == true,
      readonly: json['readonly'] == true,
      relationLost: json['relationLost'] == true,
      expiresAt: DateTime.tryParse(json['expiresAt']?.toString() ?? ''),
    );
  }
}

class HistoricalTaskSummary {
  const HistoricalTaskSummary({
    required this.taskId,
    required this.title,
    required this.description,
    required this.readonly,
    required this.historical,
    required this.accessRevoked,
    this.priority,
    this.executionState,
    this.progressNote,
    this.startAt,
    this.dueAt,
    this.startDate,
    this.dueDate,
    this.createdAt,
  });

  final String taskId;
  final String title;
  final String description;
  final bool readonly;
  final bool historical;
  final bool accessRevoked;
  final String? priority;
  final String? executionState;
  final String? progressNote;
  final DateTime? startAt;
  final DateTime? dueAt;
  final String? startDate;
  final String? dueDate;
  final DateTime? createdAt;

  factory HistoricalTaskSummary.fromJson(Map<String, Object?> json) =>
      HistoricalTaskSummary(
        taskId: json['taskId']?.toString() ?? '',
        title: json['title']?.toString() ?? '历史任务',
        description: json['description']?.toString() ?? '',
        readonly: json['readonly'] == true,
        historical: json['historical'] == true,
        accessRevoked: json['accessRevoked'] == true,
        priority: json['priority']?.toString(),
        executionState: json['executionState']?.toString(),
        progressNote: json['progressNote']?.toString(),
        startAt: DateTime.tryParse(json['startAt']?.toString() ?? ''),
        dueAt: DateTime.tryParse(json['dueAt']?.toString() ?? ''),
        startDate: json['startDate']?.toString(),
        dueDate: json['dueDate']?.toString(),
        createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
      );
}
