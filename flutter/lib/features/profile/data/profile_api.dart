import '../../../core/net/api_client.dart';
import '../../../core/net/version_registry.dart';
import '../../auth/domain/employee_user.dart';

class ProfileApi {
  const ProfileApi({required this.client});

  final ApiClient client;

  Future<EmployeeUser> self() async => (await selfWithVersion()).data;

  Future<ApiResult<EmployeeUser>> selfWithVersion() => client.get<EmployeeUser>(
    '/me/profile',
    versionKey: VersionRegistry.profile,
    decode: (json) => EmployeeUser.fromJson(asJsonMap(json)),
  );

  Future<EmployeeUser> person(String id) async {
    final result = await client.get<EmployeeUser>(
      '/users/$id',
      decode: (json) => EmployeeUser.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<void> update({
    required Map<String, Object?> values,
    required String idempotencyKey,
    String? ifMatch,
  }) async {
    await client.write<Map<String, Object?>>(
      method: 'PATCH',
      path: '/me/profile',
      body: values,
      idempotencyKey: idempotencyKey,
      versionKey: VersionRegistry.profile,
      requireVersion: true,
      ifMatch: ifMatch,
      decode: asJsonMap,
    );
  }
}
