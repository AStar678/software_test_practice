import '../../../core/net/api_client.dart';
import '../domain/notification_record.dart';

class NotificationsApi {
  const NotificationsApi({required this.client});

  final ApiClient client;

  Future<NotificationPageResult> list({
    required NotificationReadFilter read,
    required NotificationCategory category,
    required int offset,
    int limit = 50,
  }) async {
    final result = await client.get<NotificationPageResult>(
      '/notifications',
      query: {
        'readStatus': read.apiValue,
        'category': category.apiValue,
        'offset': offset,
        'limit': limit,
      },
      decode: (json) => NotificationPageResult.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<NotificationDetail> detail(String id) async {
    final result = await client.get<NotificationDetail>(
      '/notifications/$id',
      decode: (json) => NotificationDetail.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<Map<String, Object?>> open({
    required String id,
    required String idempotencyKey,
  }) async {
    final result = await client.write<Map<String, Object?>>(
      method: 'POST',
      path: '/notifications/$id/open',
      body: const {},
      idempotencyKey: idempotencyKey,
      decode: asJsonMap,
    );
    return result.data;
  }

  Future<void> hide({
    required String id,
    required int rowVersion,
    required String idempotencyKey,
  }) async {
    await client.write<Map<String, Object?>>(
      method: 'PATCH',
      path: '/notifications/$id',
      body: const {'action': 'hide'},
      idempotencyKey: idempotencyKey,
      ifMatch: rowVersion.toString(),
      decode: asJsonMap,
    );
  }

  Future<void> withdrawEvent({
    required String id,
    required String reason,
    required String idempotencyKey,
  }) async {
    await client.write<Map<String, Object?>>(
      method: 'POST',
      path: '/notifications/$id/withdraw',
      body: {'reason': reason},
      idempotencyKey: idempotencyKey,
      decode: asJsonMap,
    );
  }

  Future<HistoricalTaskSummary> historicalTask(String id) async {
    final result = await client.get<HistoricalTaskSummary>(
      '/notifications/$id/task',
      decode: (json) => HistoricalTaskSummary.fromJson(asJsonMap(json)),
    );
    return result.data;
  }
}
