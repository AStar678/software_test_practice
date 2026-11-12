import '../../../core/net/api_client.dart';
import '../../../core/net/version_registry.dart';
import '../domain/work_log.dart';

class WorkLogsApi {
  WorkLogsApi({required ApiClient client}) : _client = client; // ignore: prefer_initializing_formals
  final ApiClient _client;

  Future<WorkLogPageResult> list({
    String scope = 'self',
    String? authorId,
    int limit = 20,
    int offset = 0,
  }) async {
    final result = await _client.get<WorkLogPageResult>(
      '/work-logs',
      query: {'scope': scope, 'authorId': ?authorId, 'limit': limit, 'offset': offset},
      decode: (json) => WorkLogPageResult.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<WorkLog> detail(String id) async {
    final result = await _client.get<WorkLog>(
      '/work-logs/$id',
      versionKey: VersionRegistry.workLog(id),
      decode: (json) => WorkLog.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<WorkLog> create({
    required String businessDate,
    required String body,
    String? taskId,
    List<String> tagIds = const [],
    required String idempotencyKey,
  }) async {
    final result = await _client.write<WorkLog>(
      method: 'POST',
      path: '/work-logs',
      body: {'businessDate': businessDate, 'body': body, 'taskId': ?taskId, 'tagIds': tagIds},
      idempotencyKey: idempotencyKey,
      decode: (json) => WorkLog.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<WorkLog> change({
    required String id,
    required String body,
    String? taskId,
    List<String>? tagIds,
    required String idempotencyKey,
  }) async {
    final result = await _client.write<WorkLog>(
      method: 'PATCH',
      path: '/work-logs/$id',
      body: {'body': body, 'taskId': taskId, 'tagIds': ?tagIds},
      idempotencyKey: idempotencyKey,
      versionKey: VersionRegistry.workLog(id),
      requireVersion: true,
      decode: (json) => WorkLog.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<void> delete({required String id, required String idempotencyKey}) async {
    await _client.write<void>(
      method: 'DELETE',
      path: '/work-logs/$id',
      body: const {},
      idempotencyKey: idempotencyKey,
      versionKey: VersionRegistry.workLog(id),
      requireVersion: true,
      decode: (_) {},
    );
  }

  Future<FillSource> fillSource(String businessDate) async {
    final result = await _client.get<FillSource>(
      '/work-logs/fill-source',
      query: {'businessDate': businessDate},
      decode: (json) => FillSource.fromJson(asJsonMap(json)),
    );
    return result.data;
  }
}
