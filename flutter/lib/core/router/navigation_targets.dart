import 'read_context.dart';

/// 路由目标只由不可升级的读取上下文生成，页面不得手写混合上下文路径。
class NavigationTargets {
  const NavigationTargets._();

  static String task(ReadContext context, String taskId) => switch (context) {
        NormalReadContext() => '/tasks/$taskId',
        SubordinateReadContext(:final personId, :final personName, :final chainOrigin) =>
          '/people/${Uri.encodeComponent(personId)}/tasks/$taskId'
              '?name=${Uri.encodeComponent(personName)}&origin=${Uri.encodeComponent(chainOrigin)}',
        HistoryNotificationReadContext(:final notificationId) => '/notifications/$notificationId/task',
      };

  static String log(ReadContext context, String logId) => switch (context) {
        NormalReadContext() => '/logs/$logId',
        SubordinateReadContext(:final personId, :final personName, :final chainOrigin) =>
          '/people/${Uri.encodeComponent(personId)}/logs/$logId'
              '?name=${Uri.encodeComponent(personName)}&origin=${Uri.encodeComponent(chainOrigin)}',
        HistoryNotificationReadContext(:final notificationId) => '/notifications/$notificationId/task',
      };

  static String approval(ReadContext context, String requestId) => switch (context) {
        NormalReadContext() => '/approvals/$requestId',
        SubordinateReadContext(:final personId, :final personName, :final chainOrigin) =>
          '/people/${Uri.encodeComponent(personId)}/approvals/$requestId'
              '?name=${Uri.encodeComponent(personName)}&origin=${Uri.encodeComponent(chainOrigin)}',
        HistoryNotificationReadContext(:final notificationId) => '/notifications/$notificationId/task',
      };

  static SubordinateReadContext subordinateFromRoute(
    Map<String, String> pathParameters,
    Map<String, String> queryParameters,
  ) {
    final personId = pathParameters['personId'] ?? '';
    final personName = queryParameters['name'];
    return SubordinateReadContext(
      personId: personId,
      personName: (personName == null || personName.isEmpty) ? personId : personName,
      chainOrigin: queryParameters['origin'] ?? 'people',
    );
  }
}
