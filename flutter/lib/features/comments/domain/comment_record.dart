/// 平铺评论：稳定 ID 游标、作者可维护本人评论，删除后不保留正文。
class CommentRecord {
  const CommentRecord({
    required this.id,
    required this.objectType,
    required this.objectId,
    required this.authorId,
    required this.authorName,
    required this.body,
    required this.rowVersion,
    this.createdAt,
    this.editedAt,
    this.edited = false,
    this.deleted = false,
    this.canManage = false,
  });

  final String id;
  final String objectType;
  final String objectId;
  final String authorId;
  final String authorName;
  final String body;
  final int rowVersion;
  final DateTime? createdAt;
  final DateTime? editedAt;
  final bool edited;
  final bool deleted;
  final bool canManage;

  factory CommentRecord.fromJson(Map<String, Object?> json) => CommentRecord(
        id: (json['id'] ?? json['commentId'])?.toString() ?? '',
        objectType: json['objectType']?.toString() ?? '',
        objectId: json['objectId']?.toString() ?? '',
        authorId: json['authorId']?.toString() ?? '',
        authorName: json['authorName']?.toString() ?? '',
        body: json['body']?.toString() ?? '',
        rowVersion: (json['rowVersion'] as num?)?.toInt() ?? 1,
        createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '')?.toUtc(),
        editedAt: DateTime.tryParse(json['editedAt']?.toString() ?? '')?.toUtc(),
        edited: json['edited'] == true,
        deleted: json['deleted'] == true,
        canManage: json['canManage'] == true,
      );
}

class CommentPage {
  const CommentPage({required this.items, required this.total, this.nextOffset, this.nextCursor});

  final List<CommentRecord> items;
  final int total;
  final int? nextOffset;
  final String? nextCursor;

  bool get hasMore => nextCursor != null || nextOffset != null;
}
