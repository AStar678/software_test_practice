import '../../../core/errors/app_error.dart';
import '../../../core/net/api_client.dart';
import '../domain/analytics_models.dart';

class AnalyticsApi {
  const AnalyticsApi({required this.client});
  final ApiClient client;

  Future<AnalyticsSummary> summary({required String scope}) async {
    final result = await client.get<AnalyticsSummary>(
      '/analytics/task-summary',
      query: {'scope': scope},
      decode: (json) => AnalyticsSummary.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<String> createReport({
    required String scope,
    required String idempotencyKey,
  }) async {
    final result = await client.write<Map<String, Object?>>(
      method: 'POST',
      path: '/ai-jobs',
      body: {'scopeType': scope},
      idempotencyKey: idempotencyKey,
      decode: asJsonMap,
    );
    final id = result.data['jobId'];
    if (id is! String || id.trim().isEmpty) {
      throw ApiException(kind: ApiErrorKind.unknown, message: '服务端未返回建议任务编号');
    }
    return id;
  }

  Future<AnalyticsReport> report(String id) async {
    final result = await client.get<AnalyticsReport>(
      '/ai-jobs/$id',
      decode: (json) {
        final result = asJsonMap(json)['result'];
        if (result is! Map || result.isEmpty) {
          throw ApiException(kind: ApiErrorKind.unknown, message: '服务端未返回建议结果');
        }
        return AnalyticsReport.fromJson(Map<String, Object?>.from(result));
      },
    );
    return result.data;
  }
}
