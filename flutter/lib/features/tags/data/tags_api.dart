import '../../../core/net/api_client.dart';
import '../../../core/net/version_registry.dart';
import '../../tasks/domain/task_record.dart';

class TagsApi {
  TagsApi({required ApiClient client, required VersionRegistry versions}) : _client = client, _versions = versions; // ignore: prefer_initializing_formals
  final ApiClient _client;
  final VersionRegistry _versions;

  Future<List<TaskTag>> list() async {
    final result = await _client.get<List<TaskTag>>(
      '/tags',
      decode: (json) => [
        for (final raw in (asJsonMap(json)['items'] as List? ?? const []))
          if (raw is Map) TaskTag.fromJson(Map<String, Object?>.from(raw)),
      ],
    );
    return result.data;
  }

  Future<TaskTag> create({required String name, required String color, required String idempotencyKey}) async {
    final result = await _client.write<TaskTag>(
      method: 'POST',
      path: '/tags',
      body: {'name': name, 'color': color},
      idempotencyKey: idempotencyKey,
      decode: (json) => TaskTag.fromJson(asJsonMap(asJsonMap(json)['tag'])),
    );
    return result.data;
  }

  Future<TaskTag> change({
    required String id,
    required String name,
    required String color,
    required int rowVersion,
    required String idempotencyKey,
  }) async {
    _versions.put('tag:$id', '"$rowVersion"');
    final result = await _client.write<TaskTag>(
      method: 'PATCH',
      path: '/tags/$id',
      body: {'name': name, 'color': color},
      idempotencyKey: idempotencyKey,
      versionKey: 'tag:$id',
      requireVersion: true,
      decode: (json) => TaskTag.fromJson(asJsonMap(asJsonMap(json)['tag'])),
    );
    return result.data;
  }

  Future<void> delete({required String id, required int rowVersion, required String idempotencyKey}) async {
    _versions.put('tag:$id', '"$rowVersion"');
    await _client.write<void>(
      method: 'DELETE',
      path: '/tags/$id',
      body: const {},
      idempotencyKey: idempotencyKey,
      versionKey: 'tag:$id',
      requireVersion: true,
      decode: (_) {},
    );
  }
}
