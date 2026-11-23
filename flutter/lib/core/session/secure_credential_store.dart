import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'credential_store.dart';

/// Android Keystore 支持的安全存储。凭证不进明文偏好、日志或资产。
class SecureCredentialStore implements CredentialStore {
  SecureCredentialStore({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(aOptions: AndroidOptions());

  static const String _key = 'pandora.employee.session.v1';

  final FlutterSecureStorage _storage;

  @override
  Future<SessionCredentials?> read() async {
    final raw = await _storage.read(key: _key);
    if (raw == null || raw.isEmpty) return null;
    final decoded = jsonDecode(raw);
    if (decoded is! Map) return null;
    return SessionCredentials.fromJson(Map<String, Object?>.from(decoded));
  }

  @override
  Future<void> write(SessionCredentials credentials) async {
    await _storage.write(key: _key, value: jsonEncode(credentials.toJson()));
  }

  @override
  Future<void> clear() async {
    await _storage.delete(key: _key);
  }
}
