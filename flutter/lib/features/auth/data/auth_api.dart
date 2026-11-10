// ignore_for_file: prefer_initializing_formals
import 'dart:convert';

import 'package:dio/dio.dart';

import '../../../core/errors/app_error.dart';
import '../../../core/net/http_error_mapper.dart';
import '../domain/employee_user.dart';
import 'auth_gateway.dart';

class LoginResult {
  const LoginResult({
    required this.token,
    required this.expiresAt,
    required this.user,
    required this.passwordChangeRequired,
  });

  final String token;
  final DateTime expiresAt;
  final EmployeeUser user;
  final bool passwordChangeRequired;

  bool get restricted => passwordChangeRequired || user.mustChangePassword;
}

/// 认证端点：只使用 employee + 手机号 + 密码，不提供管理员移动登录或注册。
class AuthApi implements AuthGateway {
  AuthApi({required Dio dio, required String baseUrl})
      : _dio = dio,
        _baseUrl = baseUrl;

  final Dio _dio;
  final String _baseUrl;

  @override
  Future<LoginResult> login({required String phone, required String password}) async {
    final data = await _run(
      () => _dio.post<Object?>(
        '$_baseUrl/auth/sessions',
        data: {'accountType': 'employee', 'phone': phone.trim(), 'password': password},
      ),
      fallbackStatus: 401,
    );
    return _parseLogin(data);
  }

  /// 只用仍持有效 token 调用；后端无独立 refresh token，过期 token 不能刷新。
  @override
  Future<LoginResult> refresh(String token) async {
    final data = await _run(
      () => _dio.post<Object?>(
        '$_baseUrl/auth/sessions/refresh',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      ),
      fallbackStatus: 401,
    );
    return _parseLogin(data);
  }

  @override
  Future<EmployeeUser> session(String token) async {
    final data = await _run(
      () => _dio.get<Object?>(
        '$_baseUrl/auth/session',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      ),
      fallbackStatus: 401,
    );
    return EmployeeUser.fromJson(data);
  }

  @override
  Future<void> logout(String token) async {
    await _run(
      () => _dio.delete<Object?>(
        '$_baseUrl/auth/sessions/current',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      ),
      fallbackStatus: 401,
    );
  }

  @override
  Future<void> changePassword({
    required String token,
    required String currentPassword,
    required String newPassword,
  }) async {
    await _run(
      () => _dio.post<Object?>(
        '$_baseUrl/auth/password',
        data: {'currentPassword': currentPassword, 'newPassword': newPassword},
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      ),
      fallbackStatus: 400,
    );
  }

  Future<Map<String, Object?>> _run(
    Future<Response<Object?>> Function() request, {
    required int fallbackStatus,
  }) async {
    try {
      final response = await request();
      return _asMap(response.data);
    } on DioException catch (error) {
      if (error.response != null) {
        throw mapHttpError(error.response!.statusCode ?? fallbackStatus, error.response!.data);
      }
      throw mapDioException(error);
    }
  }

  LoginResult _parseLogin(Map<String, Object?> data) {
    final token = data['token']?.toString() ?? '';
    if (token.isEmpty) {
      throw ApiException(
        kind: ApiErrorKind.unknown,
        message: '登录响应缺少凭证，请稍后重试',
      );
    }
    final expiresAt = DateTime.tryParse(data['expiresAt']?.toString() ?? '')?.toUtc();
    final userRaw = data['user'];
    if (expiresAt == null || userRaw is! Map) {
      throw ApiException(
        kind: ApiErrorKind.unknown,
        message: '登录响应格式不正确，请稍后重试',
      );
    }
    final user = EmployeeUser.fromJson(Map<String, Object?>.from(userRaw));
    final required = data['passwordChangeRequired'] == true || user.mustChangePassword;
    return LoginResult(
      token: token,
      expiresAt: expiresAt,
      user: user,
      passwordChangeRequired: required,
    );
  }

  Map<String, Object?> _asMap(Object? raw) {
    if (raw is Map) return Map<String, Object?>.from(raw);
    if (raw is String) {
      final decoded = jsonDecode(raw);
      if (decoded is Map) return Map<String, Object?>.from(decoded);
    }
    return const <String, Object?>{};
  }
}
