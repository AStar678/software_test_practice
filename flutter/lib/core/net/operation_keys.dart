import 'idempotency.dart';

/// 每个表单/操作作用域独立的幂等键：
/// 同一作用域、同一正文与版本沿用原键；改变内容或成功后重置。
class OperationKeys {
  final Map<String, IdempotencyGuard> _guards = <String, IdempotencyGuard>{};

  String keyFor({
    required String scope,
    required String method,
    required String path,
    Map<String, Object?>? body,
    String? ifMatch,
  }) {
    final guard = _guards.putIfAbsent(scope, () => IdempotencyGuard());
    return guard.keyFor(
      IdempotencyGuard.fingerprint(method: method, path: path, body: body, ifMatch: ifMatch),
    );
  }

  /// 新的一次性键（用于不经过表单幂等作用域的调用，如外部联调脚本）。
  String newKey() => IdempotencyGuard().newKey();

  void complete(String scope) {
    _guards.remove(scope);
  }

  void clear() {
    _guards.clear();
  }

  bool hasKey(String scope) => _guards[scope]?.currentKey != null;
}
