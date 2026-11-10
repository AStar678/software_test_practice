import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../config/app_config.dart';
import '../errors/app_error.dart';
import '../session/session_gateway.dart';
import 'http_error_mapper.dart';
import 'version_registry.dart';

class ApiResult<T> {
  const ApiResult({required this.data, required this.statusCode, this.etag});

  final T data;
  final int statusCode;
  final String? etag;
}

/// 统一 HTTP 请求层：
/// - Bearer 与凭证代次；
/// - 端点级 ETag/If-Match；
/// - 调用方提供的幂等键；
/// - 401 只按代次决定是否刷新并重试一次；
/// - 请求取消；
/// - 发布包不打印请求正文。
class ApiClient {
  ApiClient({
    required this.config,
    required this.session,
    required this.versions,
    Dio? dio,
    DateTime Function()? clock,
  })  : _clock = clock ?? DateTime.now,
        _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: '',
                connectTimeout: const Duration(seconds: 12),
                receiveTimeout: const Duration(seconds: 20),
                sendTimeout: const Duration(seconds: 20),
                contentType: 'application/json',
                responseType: ResponseType.json,
                validateStatus: (status) => status != null && status < 400,
                headers: {'Accept': 'application/json'},
              ),
            ) {
    if (kDebugMode) {
      _dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            debugPrint('[api] ${options.method} ${options.path}');
            handler.next(options);
          },
          onResponse: (response, handler) {
            debugPrint('[api] ${response.statusCode} ${response.requestOptions.path}');
            handler.next(response);
          },
          onError: (error, handler) {
            debugPrint('[api] ERR ${error.response?.statusCode ?? error.type} ${error.requestOptions.path}');
            handler.next(error);
          },
        ),
      );
    }
  }

  final AppConfig config;
  final SessionGateway session;
  final VersionRegistry versions;
  final DateTime Function() _clock;
  final Dio _dio;

  String get _baseUrl => config.apiBaseUrl;

  Future<ApiResult<T>> get<T>(
    String path, {
    Map<String, Object?>? query,
    required T Function(Object? json) decode,
    String? versionKey,
    CancelToken? cancelToken,
  }) {
    return _request(
      method: 'GET',
      path: path,
      query: query,
      decode: decode,
      versionKey: versionKey,
      cancelToken: cancelToken,
    );
  }

  Future<ApiResult<T>> write<T>({
    required String method,
    required String path,
    required Map<String, Object?> body,
    required String idempotencyKey,
    required T Function(Object? json) decode,
    String? versionKey,
    bool requireVersion = false,
    CancelToken? cancelToken,
  }) {
    return _request(
      method: method,
      path: path,
      body: body,
      decode: decode,
      versionKey: versionKey,
      requireVersion: requireVersion,
      idempotencyKey: idempotencyKey,
      cancelToken: cancelToken,
    );
  }

  Future<ApiResult<T>> _request<T>({
    required String method,
    required String path,
    Map<String, Object?>? query,
    Map<String, Object?>? body,
    required T Function(Object? json) decode,
    String? versionKey,
    bool requireVersion = false,
    String? idempotencyKey,
    CancelToken? cancelToken,
  }) async {
    if (!config.isConfigured || !config.isTransportAllowed) {
      throw ApiException(
        kind: ApiErrorKind.network,
        message: '客户端未配置有效的服务地址',
      );
    }
    String? ifMatch;
    if (requireVersion) {
      if (versionKey == null) {
        throw ApiException(
          kind: ApiErrorKind.validation,
          message: '缺少版本信息，请重新读取后再提交',
        );
      }
      ifMatch = versions[versionKey];
      if (ifMatch == null) {
        throw ApiException(
          kind: ApiErrorKind.validation,
          message: '缺少版本信息，请重新读取后再提交',
        );
      }
    }

    for (var attempt = 0; attempt < 2; attempt++) {
      final token = await session.authorize();
      if (token == null) {
        throw ApiException.sessionExpired();
      }
      final generation = session.credentialGeneration;
      final headers = <String, String>{
        'Authorization': 'Bearer $token',
        if (method != 'GET' && method != 'DELETE') 'Content-Type': 'application/json',
        'If-Match': ?ifMatch,
        'Idempotency-Key': ?idempotencyKey,
      };
      try {
        final response = await _dio.request<Object?>(
          '$_baseUrl$path',
          data: body,
          queryParameters: _cleanQuery(query),
          cancelToken: cancelToken,
          options: Options(method: method, headers: headers),
        );
        final etag = response.headers.value('etag');
        if (versionKey != null) {
          versions.put(versionKey, etag);
        }
        return ApiResult<T>(
          data: decode(response.data),
          statusCode: response.statusCode ?? 200,
          etag: etag,
        );
      } on DioException catch (error) {
        final status = error.response?.statusCode;
        if (status == 401 && attempt == 0) {
          final retry = await session.handleUnauthorized(generation);
          if (retry) continue;
          throw ApiException.sessionExpired();
        }
        final mapped = mapDioException(error);
        if (mapped.isUnauthorized) {
          session.notifyExpired();
        }
        throw mapped;
      }
    }
    throw ApiException.sessionExpired();
  }

  Map<String, Object?> _cleanQuery(Map<String, Object?>? query) {
    if (query == null) return const {};
    final cleaned = <String, Object?>{};
    for (final entry in query.entries) {
      if (entry.value != null) cleaned[entry.key] = entry.value;
    }
    return cleaned;
  }

  /// 便于测试与诊断的请求摘要（不含凭证或正文）。
  String describe() => '${config.apiBaseUrl} @ ${_clock().toUtc().toIso8601String()}';
}

/// 把强类型 JSON 安全转为 Map，未知/缺字段不抛未捕获异常。
Map<String, Object?> asJsonMap(Object? value) {
  if (value is Map) return Map<String, Object?>.from(value);
  if (value is String && value.isNotEmpty) {
    final decoded = jsonDecode(value);
    if (decoded is Map) return Map<String, Object?>.from(decoded);
  }
  return const <String, Object?>{};
}

List<Object?> asJsonList(Object? value) {
  if (value is List) return List<Object?>.from(value);
  return const <Object?>[];
}
