import 'dart:convert';
import 'dart:math';

/// 幂等键只在“同一操作、同一请求体、同一目标版本”的网络不确定重试中沿用。
/// 改变正文、目标或版本后必须新建操作键。
class IdempotencyGuard {
  IdempotencyGuard({Random? random}) : _random = random ?? Random.secure();

  final Random _random;
  String? _fingerprint;
  String? _key;

  static const int minLength = 8;
  static const int maxLength = 80;

  /// 返回本次提交应使用的键；内容有变化时生成新键。
  String keyFor(String fingerprint) {
    if (_fingerprint == fingerprint && _key != null) {
      return _key!;
    }
    _fingerprint = fingerprint;
    _key = newKey();
    return _key!;
  }

  /// 丢弃当前键（提交成功后调用）。
  void reset() {
    _fingerprint = null;
    _key = null;
  }

  String? get currentKey => _key;

  String newKey() {
    final bytes = List<int>.generate(16, (_) => _random.nextInt(256));
    final key = base64Url.encode(bytes).replaceAll('=', '');
    assert(key.length >= minLength && key.length <= maxLength);
    return key;
  }

  /// 统一指纹：方法 + 路径 + 目标版本 + 规范化正文。
  static String fingerprint({
    required String method,
    required String path,
    String? ifMatch,
    Map<String, Object?>? body,
  }) {
    final normalized = body == null ? '' : _canonicalJson(body);
    return '$method|$path|${ifMatch ?? ''}|$normalized';
  }

  static String _canonicalJson(Object? value) {
    if (value is Map) {
      final keys = value.keys.map((key) => key.toString()).toList()..sort();
      return '{${keys.map((key) => '${jsonEncode(key)}:${_canonicalJson(value[key])}').join(',')}}';
    }
    if (value is List) {
      return '[${value.map(_canonicalJson).join(',')}]';
    }
    return jsonEncode(value);
  }
}

/// 写请求的三种结果状态；页面 loading 与写状态相互独立。
enum WriteStatus { idle, submitting, success, failed, uncertain }

/// 一次写操作的不可变快照：保存原体、版本与键，便于“同体同版本重试”。
class WriteAttempt {
  WriteAttempt({
    required this.method,
    required this.path,
    required this.body,
    required this.ifMatch,
    required this.key,
  });

  final String method;
  final String path;
  final Map<String, Object?> body;
  final String? ifMatch;
  final String key;

  String get fingerprint =>
      IdempotencyGuard.fingerprint(method: method, path: path, ifMatch: ifMatch, body: body);
}

/// 端点版本来源：任务、申请、日志、评论各自持有 ETag；置顶类端点不套任务版本。
enum VersionSource { none, task, approvalRequest, workLog, comment, notification, dailyItem, profile, homeItem }
