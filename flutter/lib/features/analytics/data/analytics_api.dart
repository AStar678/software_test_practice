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
    return result.data['jobId']?.toString() ?? '';
  }

  Future<AnalyticsReport> report(String id) async {
    final result = await client.get<AnalyticsReport>(
      '/ai-jobs/$id',
      decode: (json) {
        final row = asJsonMap(json);
        return AnalyticsReport.fromJson(
          row['result'] is Map
              ? Map<String, Object?>.from(row['result'] as Map)
              : const {},
        );
      },
    );
    return result.data;
  }
}
