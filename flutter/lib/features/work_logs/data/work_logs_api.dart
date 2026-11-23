import '../../../core/company/company_date.dart';
import '../../../core/net/api_client.dart';
import '../../../core/net/version_registry.dart';
import '../../tasks/domain/task_record.dart';
import '../domain/work_log.dart';

class WorkLogsApi {
  WorkLogsApi({required ApiClient client}) : _client = client; // ignore: prefer_initializing_formals
  final ApiClient _client;

  Future<WorkLogPageResult> list({
    String scope = 'self',
    String? authorId,
    String? from,
    String? to,
    int limit = 20,
    int offset = 0,
  }) async {
    final result = await _client.get<WorkLogPageResult>(
      '/work-logs',
      query: {
        'scope': scope,
        'authorId': ?authorId,
        'from': ?from,
        'to': ?to,
        'limit': limit,
        'offset': offset,
      },
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

  /// 保存响应只包含标识与版本；用提交值与基线拼出同一新版本，供详情/列表立即展示。
  ///
  /// 这不是服务端完整投影：调用方仍应使用详情重验拿全标签与作者投影。
  Future<WorkLog> change({
    required String id,
    required String body,
    String? taskId,
    List<String>? tagIds,
    List<TaskTag>? tags,
    WorkLog? base,
    required String idempotencyKey,
  }) async {
    final result = await _client.write<Map<String, Object?>>(
      method: 'PATCH',
      path: '/work-logs/$id',
      body: {'body': body, 'taskId': taskId, 'tagIds': ?tagIds},
      idempotencyKey: idempotencyKey,
      versionKey: VersionRegistry.workLog(id),
      requireVersion: true,
      decode: asJsonMap,
    );
    final json = result.data;
    final date =
        CompanyDate.tryParse(json['businessDate']?.toString()) ??
        base?.businessDate;
    if (date == null) {
      throw const FormatException('日志保存响应缺少业务日期');
    }
    return WorkLog(
      id: json['logId']?.toString() ?? id,
      businessDate: date,
      body: body,
      authorId: base?.authorId ?? '',
      authorName: base?.authorName ?? '',
      createdAt: base?.createdAt,
      frozen: base?.frozen ?? false,
      editable: true,
      rowVersion:
          (json['rowVersion'] as num?)?.toInt() ??
          ((base?.rowVersion ?? 0) + 1),
      tags: tags ?? base?.tags ?? const [],
      tagIds: tagIds ?? base?.tagIds ?? const [],
      taskId: taskId,
    );
  }

  /// 保留底层清理能力；日志详情不再提供用户删除入口。
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
