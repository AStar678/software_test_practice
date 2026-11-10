import 'dart:convert';

import 'package:dio/dio.dart';

import '../errors/app_error.dart';

/// 把 Dio/HTTP 错误映射为统一错误类别；错误响应体优先读取 `{code,message}`，
/// 其次读取 Spring 默认错误结构，绝不把失败伪装成空集合。
ApiException mapDioException(DioException error) {
  switch (error.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
    case DioExceptionType.transformTimeout:
      return ApiException.timeout();
    case DioExceptionType.connectionError:
      return ApiException.network();
    case DioExceptionType.cancel:
      return ApiException.cancelled();
    case DioExceptionType.badCertificate:
      return ApiException(
        kind: ApiErrorKind.network,
        message: '安全连接校验失败，请检查网络环境',
        details: error.error,
      );
    case DioExceptionType.badResponse:
      return mapHttpError(error.response?.statusCode ?? 0, error.response?.data);
    case DioExceptionType.unknown:
      final raw = error.error?.toString() ?? '';
      if (raw.contains('SocketException') || raw.contains('Connection') || raw.contains('Handshake')) {
        return ApiException.network();
      }
      return ApiException(
        kind: ApiErrorKind.unknown,
        message: '请求未完成，请稍后重试',
        details: error.error,
      );
  }
}

ApiException mapHttpError(int statusCode, Object? data) {
  final body = _decodeBody(data);
  final code = body['code']?.toString();
  final message = body['message']?.toString();
  switch (statusCode) {
    case 400:
      return ApiException(
        kind: ApiErrorKind.validation,
        message: message ?? '提交内容不合法，请检查后重试',
        statusCode: statusCode,
        code: code,
        details: body.isEmpty ? null : body,
      );
    case 401:
      return ApiException(
        kind: ApiErrorKind.unauthorized,
        message: message ?? '登录状态已失效，请重新登录',
        statusCode: statusCode,
        code: code,
      );
    case 403:
      return ApiException(
        kind: ApiErrorKind.forbidden,
        message: message ?? '当前账号没有此操作权限',
        statusCode: statusCode,
        code: code,
        details: body.isEmpty ? null : body,
      );
    case 404:
      return ApiException(
        kind: ApiErrorKind.notFound,
        message: message ?? '内容不存在或已无权访问',
        statusCode: statusCode,
        code: code,
      );
    case 409:
      return ApiException(
        kind: ApiErrorKind.conflict,
        message: message ?? '数据已发生变化，请刷新后重试',
        statusCode: statusCode,
        code: code,
        details: body.isEmpty ? null : body,
      );
    case 412:
      return ApiException(
        kind: ApiErrorKind.conflict,
        message: message ?? '版本已更新，请重新读取后再提交',
        statusCode: statusCode,
        code: code ?? 'PRECONDITION_FAILED',
      );
    case 413:
      return ApiException(
        kind: ApiErrorKind.validation,
        message: message ?? '内容超出允许大小',
        statusCode: statusCode,
        code: code,
      );
    case 428:
      return ApiException(
        kind: ApiErrorKind.validation,
        message: message ?? '缺少必需的操作条件，请刷新后重试',
        statusCode: statusCode,
        code: code ?? 'PRECONDITION_REQUIRED',
      );
    case 429:
      return ApiException(
        kind: ApiErrorKind.server,
        message: message ?? '操作过于频繁，请稍后重试',
        statusCode: statusCode,
        code: code,
        retryable: true,
      );
    default:
      if (statusCode >= 500) {
        return ApiException(
          kind: ApiErrorKind.server,
          message: message ?? '服务暂时不可用，请稍后重试',
          statusCode: statusCode,
          code: code,
          retryable: true,
        );
      }
      return ApiException(
        kind: ApiErrorKind.unknown,
        message: message ?? '请求未完成（$statusCode），请稍后重试',
        statusCode: statusCode,
        code: code,
      );
  }
}

Map<String, Object?> _decodeBody(Object? data) {
  if (data is Map) return Map<String, Object?>.from(data);
  if (data is String && data.isNotEmpty) {
    try {
      final decoded = jsonDecode(data);
      if (decoded is Map) return Map<String, Object?>.from(decoded);
    } on FormatException {
      return const {};
    }
  }
  return const {};
}
