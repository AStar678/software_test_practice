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
}
