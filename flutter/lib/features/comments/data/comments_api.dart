import '../../../core/net/api_client.dart';
import '../../../core/net/version_registry.dart';
import '../domain/comment_record.dart';

/// 评论端点：正序 ID 游标分页，任务与日志共用；不改业务版本/冻结/审批。
class CommentsApi {
  // ignore: prefer_initializing_formals
  CommentsApi({required ApiClient client}) : _client = client;

  final ApiClient _client;

  String _base(String objectType) => objectType == 'log' ? '/work-logs' : '/tasks';

  Future<CommentPage> list({
    required String objectType,
    required String objectId,
    String? cursor,
    int limit = 20,
    int offset = 0,
  }) async {
    final result = await _client.get<CommentPage>(
      '${_base(objectType)}/$objectId/comments',
      query: {
        'limit': limit,
        'offset': offset,
        'cursor': ?cursor,
      },
      decode: (json) {
        final map = asJsonMap(json);
        final items = <CommentRecord>[
          for (final raw in asJsonList(map['items']))
            if (raw is Map) CommentRecord.fromJson(Map<String, Object?>.from(raw)),
        ];
        return CommentPage(
          items: items,
          total: (map['total'] as num?)?.toInt() ?? items.length,
          nextOffset: (map['nextOffset'] as num?)?.toInt(),
          nextCursor: map['nextCursor']?.toString(),
        );
      },
    );
    return result.data;
  }

  Future<CommentRecord> create({
    required String objectType,
    required String objectId,
    required String body,
    required String idempotencyKey,
  }) async {
    final result = await _client.write<CommentRecord>(
      method: 'POST',
      path: '${_base(objectType)}/$objectId/comments',
      body: {'body': body},
      idempotencyKey: idempotencyKey,
      decode: (json) => CommentRecord.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<CommentRecord> change({
    required String commentId,
    required String body,
    required String idempotencyKey,
  }) async {
    final result = await _client.write<CommentRecord>(
      method: 'PATCH',
      path: '/comments/$commentId',
      body: {'body': body},
      idempotencyKey: idempotencyKey,
      versionKey: VersionRegistry.comment(commentId),
      requireVersion: true,
      decode: (json) => CommentRecord.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<void> delete({required String commentId, required String idempotencyKey}) async {
    await _client.write<void>(
      method: 'DELETE',
      path: '/comments/$commentId',
      body: const {},
      idempotencyKey: idempotencyKey,
      versionKey: VersionRegistry.comment(commentId),
      requireVersion: true,
      decode: (_) {},
    );
  }
}
