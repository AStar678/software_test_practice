import 'dart:async';

/// 安全保存的会话凭证；只存 token 与过期时刻，业务正文不进入安全存储。
class SessionCredentials {
  const SessionCredentials({required this.token, required this.expiresAt, required this.generation});

  final String token;
  final DateTime expiresAt;
  final int generation;

  bool isExpired(DateTime now) => !expiresAt.isAfter(now);

  bool isNearExpiry(DateTime now, {Duration lead = const Duration(minutes: 2)}) =>
      !expiresAt.isAfter(now.add(lead));

  SessionCredentials withGeneration(int value) =>
      SessionCredentials(token: token, expiresAt: expiresAt, generation: value);

  Map<String, Object?> toJson() => {'token': token, 'expiresAt': expiresAt.toUtc().toIso8601String()};

  static SessionCredentials? fromJson(Map<String, Object?> json) {
    final token = json['token']?.toString();
    final expiresAt = DateTime.tryParse(json['expiresAt']?.toString() ?? '')?.toUtc();
    if (token == null || token.isEmpty || expiresAt == null) return null;
    return SessionCredentials(token: token, expiresAt: expiresAt, generation: 1);
  }
}

/// 凭证存储抽象；实现必须使用系统保护的安全存储，失败不能静默忽略。
abstract class CredentialStore {
  Future<SessionCredentials?> read();
  Future<void> write(SessionCredentials credentials);
  Future<void> clear();
}

class MemoryCredentialStore implements CredentialStore {
  MemoryCredentialStore([this._value]);

  SessionCredentials? _value;
  bool failWrites = false;
  bool failReads = false;

  @override
  Future<SessionCredentials?> read() async {
    if (failReads) throw StateError('secure storage read failed');
    return _value;
  }

  @override
  Future<void> write(SessionCredentials credentials) async {
    if (failWrites) throw StateError('secure storage write failed');
    _value = credentials;
  }

  @override
  Future<void> clear() async {
    _value = null;
  }
}
