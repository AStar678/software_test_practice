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
