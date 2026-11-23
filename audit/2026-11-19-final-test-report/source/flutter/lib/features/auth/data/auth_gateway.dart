import '../domain/employee_user.dart';
import 'auth_api.dart';

/// 认证端口：会话层只依赖该接口，测试可替换为固定实现。
abstract class AuthGateway {
  Future<LoginResult> login({required String phone, required String password});

  Future<LoginResult> refresh(String token);

  Future<EmployeeUser> session(String token);

  Future<void> logout(String token);

  Future<void> changePassword({
    required String token,
    required String currentPassword,
    required String newPassword,
  });
}
