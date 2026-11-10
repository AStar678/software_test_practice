import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pandora_employee/core/company/workspace_clock.dart';
import 'package:pandora_employee/core/config/app_config.dart';
import 'package:pandora_employee/core/net/api_client.dart';
import 'package:pandora_employee/core/net/version_registry.dart';
import 'package:pandora_employee/core/providers.dart';
import 'package:pandora_employee/core/session/session_gateway.dart';
import 'package:pandora_employee/core/session/session_manager.dart';
import 'package:pandora_employee/core/theme/pandora_theme.dart';
import 'package:pandora_employee/features/auth/data/auth_api.dart';
import 'package:pandora_employee/features/auth/data/auth_gateway.dart';
import 'package:pandora_employee/features/auth/domain/employee_user.dart';

class FakeRequest {
  FakeRequest({
    required this.method,
    required this.path,
    required this.query,
    required this.body,
    required this.headers,
  });

  final String method;
  final String path;
  final Map<String, dynamic> query;
  final Object? body;
  final Map<String, dynamic> headers;

  Map<String, Object?> get jsonBody =>
      body is Map ? Map<String, Object?>.from(body as Map) : const {};
}

class FakeResponse {
  FakeResponse(this.body, {this.status = 200, this.etag});

  final Object? body;
  final int status;
  final String? etag;
}

typedef FakeHandler = FutureOr<FakeResponse> Function(FakeRequest request);

/// 隔离自动检查用固定响应：不是运行时假后端，只在测试进程内使用。
class FakeBackend implements HttpClientAdapter {
  final List<FakeRequest> requests = <FakeRequest>[];
  final Map<String, FakeHandler> _exact = <String, FakeHandler>{};
  final List<(RegExp, String, FakeHandler)> _patterns = [];

  void on(String method, String path, FakeHandler handler) {
    _exact['$method $path'] = handler;
  }

  void onPattern(String method, RegExp pattern, FakeHandler handler) {
    _patterns.add((pattern, method, handler));
  }

  List<FakeRequest> requestsFor(String method, String path) =>
      requests.where((request) => request.method == method && request.path == path).toList();

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final path = options.uri.path.replaceFirst('/api/v1', '');
    final request = FakeRequest(
      method: options.method,
      path: path,
      query: Map<String, dynamic>.from(options.queryParameters),
      body: options.data,
      headers: Map<String, dynamic>.from(options.headers),
    );
    requests.add(request);
    FakeHandler? handler = _exact['${options.method} $path'];
    if (handler == null) {
      for (final pattern in _patterns) {
        if (pattern.$2 == options.method && pattern.$1.hasMatch(path)) {
          handler = pattern.$3;
          break;
        }
      }
    }
    if (handler == null) {
      return ResponseBody.fromString(
        jsonEncode({'code': 'NOT_FAKED', 'message': '未配置的测试端点 $path'}),
        500,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );
    }
    final response = await handler(request);
    final headers = <String, List<String>>{
      Headers.contentTypeHeader: [Headers.jsonContentType],
    };
    if (response.etag != null) headers['etag'] = [response.etag!];
    return ResponseBody.fromString(
      response.body == null ? '' : jsonEncode(response.body),
      response.status,
      headers: headers,
    );
  }

  @override
  void close({bool force = false}) {}
}

class FakeGateway implements SessionGateway {
  FakeGateway({this.generation = 1});

  int generation;

  @override
  Future<String?> authorize() async => 'test-token';

  @override
  int get credentialGeneration => generation;

  @override
  Future<bool> handleUnauthorized(int sentGeneration) async => false;

  @override
  void notifyExpired() {}
}

/// Widget 测试的完整 provider 替代：真实 ApiClient + 固定响应适配器。
ProviderContainer buildTestContainer({
  required FakeBackend backend,
  required EmployeeUser user,
  DateTime? now,
}) {
  final clock = WorkspaceClock(now: () => now ?? DateTime.utc(2026, 11, 10, 4));
  final dio = Dio(
    BaseOptions(
      validateStatus: (status) => status != null && status < 400,
      contentType: 'application/json',
    ),
  )..httpClientAdapter = backend;
  final client = ApiClient(
    config: const AppConfig(apiBaseUrl: 'https://test.local/api/v1', isDebug: true),
    session: FakeGateway(),
    versions: VersionRegistry(),
    dio: dio,
    clock: () => now ?? DateTime.utc(2026, 11, 10, 4),
  );
  final container = ProviderContainer(
    overrides: [
      appConfigProvider.overrideWithValue(
        const AppConfig(apiBaseUrl: 'https://test.local/api/v1', isDebug: true),
      ),
      workspaceClockProvider.overrideWithValue(clock),
      apiClientProvider.overrideWithValue(client),
      sessionStateProvider.overrideWith(
        (ref) => Stream<SessionState>.value(
          SessionState(
            phase: SessionPhase.authenticated,
            user: user,
            accountEpoch: 1,
          ),
        ),
      ),
    ],
  );
  return container;
}

Widget wrapWithScope(ProviderContainer container, Widget child) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(
      theme: PandoraTheme.build(),
      home: child,
    ),
  );
}

EmployeeUser employeeUser({String id = 'u1', String role = 'employee'}) {
  return EmployeeUser(
    id: id,
    displayName: role == 'founder' ? '苏景昕' : '亚里士多德',
    role: role,
    phone: '13800000004',
    organizationName: '光屿动画',
    organizationTimeZone: 'Asia/Shanghai',
    departmentName: '制作部',
    teamName: '原画组',
    positionName: '动画师',
  );
}


/// 已认证会话用的固定认证端口。
class FakeAuthGateway implements AuthGateway {
  FakeAuthGateway(this.user);

  final EmployeeUser user;

  @override
  Future<LoginResult> login({required String phone, required String password}) async => LoginResult(
        token: 'widget-token',
        expiresAt: DateTime.utc(2099, 1, 1),
        user: user,
        passwordChangeRequired: false,
      );

  @override
  Future<LoginResult> refresh(String token) async => login(phone: '', password: '');

  @override
  Future<EmployeeUser> session(String token) async => user;

  @override
  Future<void> logout(String token) async {}

  @override
  Future<void> changePassword({
    required String token,
    required String currentPassword,
    required String newPassword,
  }) async {}
}
