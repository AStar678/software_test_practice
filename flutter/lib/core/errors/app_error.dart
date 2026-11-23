/// 客户端统一错误模型：把 HTTP/网络/契约错误归类为界面可区分的状态，
/// 不把错误伪装成空集合，也不把失权当成普通加载失败。
enum ApiErrorKind {
  network,
  timeout,
  cancelled,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validation,
  server,
  unknown,

  /// 服务端明确告知对象已删除（HTTP 410 TASK_DELETED），不是普通失权或空数据。
  deleted,
}

class ApiException implements Exception {
  ApiException({
    required this.kind,
    required this.message,
    this.statusCode,
    this.code,
    this.details,
    this.retryable = false,
  });

  final ApiErrorKind kind;
  final String message;
  final int? statusCode;
  final String? code;
  final Object? details;

  /// 仅网络/超时/服务端 5xx 等“结果未知或可安全重试读取”的情况为 true；
  /// 写请求仍需调用方按幂等键决定是否重试。
  final bool retryable;

  bool get isUnauthorized => kind == ApiErrorKind.unauthorized;
  bool get isForbidden => kind == ApiErrorKind.forbidden;
  bool get isNotFound => kind == ApiErrorKind.notFound;
  bool get isConflict => kind == ApiErrorKind.conflict;
  bool get isValidation => kind == ApiErrorKind.validation;
  bool get isNetwork => kind == ApiErrorKind.network || kind == ApiErrorKind.timeout;
  bool get isDeleted => kind == ApiErrorKind.deleted || code == 'TASK_DELETED';

  /// 结果未知：写请求超时/断连，服务端可能已经提交。
  bool get isUncertain => kind == ApiErrorKind.timeout || kind == ApiErrorKind.network;

  static ApiException network([String message = '网络不可用，请检查连接后重试']) =>
      ApiException(kind: ApiErrorKind.network, message: message, retryable: true);

  static ApiException timeout([String message = '请求超时，请稍后重试']) =>
      ApiException(kind: ApiErrorKind.timeout, message: message, retryable: true);

  static ApiException cancelled() =>
      ApiException(kind: ApiErrorKind.cancelled, message: '请求已取消');

  static ApiException sessionExpired([String message = '登录状态已失效，请重新登录']) =>
      ApiException(kind: ApiErrorKind.unauthorized, message: message, statusCode: 401);

  static ApiException conflict(String message, {String? code}) =>
      ApiException(kind: ApiErrorKind.conflict, message: message, statusCode: 409, code: code);

  @override
  String toString() => 'ApiException($kind, $statusCode, $code): $message';
}

/// 表单级错误：保留用户草稿，并把服务端字段错误映射到具体输入。
class FieldErrors {
  const FieldErrors(this.fields, [this.message]);

  final Map<String, String> fields;
  final String? message;

  bool get isEmpty => fields.isEmpty && message == null;
}

/// 统一用户可见错误文案：绝不把 `toString()`、异常类名、HTTP 状态或英文字段名直接展示。
String userMessageFor(Object error) {
  if (error is ApiException) {
    final message = error.message.trim();
    if (message.isNotEmpty && !_looksTechnical(message)) return message;
    return _fallbackMessage(error.kind);
  }
  return '操作未完成，请稍后重试';
}

/// 错误是否值得提供“重试”入口（读取失败/网络/超时/服务 5xx）。
bool errorAllowsRetry(Object error) =>
    error is ApiException && (error.retryable || error.isNetwork || error.kind == ApiErrorKind.server);

String _fallbackMessage(ApiErrorKind kind) => switch (kind) {
  ApiErrorKind.network => '网络不可用，请检查连接后重试',
  ApiErrorKind.timeout => '请求超时，请稍后重试',
  ApiErrorKind.cancelled => '请求已取消',
  ApiErrorKind.unauthorized => '登录状态已失效，请重新登录',
  ApiErrorKind.forbidden => '当前账号没有此操作权限',
  ApiErrorKind.notFound => '内容不存在或已无权访问',
  ApiErrorKind.conflict => '数据已发生变化，请刷新后重试',
  ApiErrorKind.validation => '提交内容不合法，请检查后重试',
  ApiErrorKind.server => '服务暂时不可用，请稍后重试',
  ApiErrorKind.deleted => '任务已删除',
  ApiErrorKind.unknown => '操作未完成，请稍后重试',
};

final RegExp _technicalText = RegExp(
  r'(ApiException|DioException|Exception|StackTrace|HTTP\s*\d|\b[A-Z][A-Z0-9_]{3,}\b|'
  r'startDate|dueDate|tagIds|assigneeIds|taskId|jdbc|SQL|Table)',
  caseSensitive: false,
);

bool _looksTechnical(String message) => _technicalText.hasMatch(message);
