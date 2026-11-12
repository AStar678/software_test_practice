import 'package:flutter/foundation.dart';

/// 构建期平台配置。API 地址只能通过显式构建配置提供，界面上不暴露技术设置。
class AppConfig {
  const AppConfig({required this.apiBaseUrl, required this.isDebug});

  final String apiBaseUrl;
  final bool isDebug;

  static const String _definedBaseUrl = String.fromEnvironment('API_BASE_URL');
  static const String _definedReleaseBaseUrl = String.fromEnvironment('RELEASE_API_BASE_URL');

  /// 默认值与 release 规则：
  /// - 显式 `--dart-define=API_BASE_URL=...` 优先；
  /// - debug 回退到本机联调地址（Android 模拟器用 10.0.2.2）；
  /// - release 必须提供 HTTPS 地址，否则启动即报配置错误，不静默连明文。
  factory AppConfig.fromEnvironment({bool? debugOverride}) {
    final isDebug = debugOverride ?? kDebugMode;
    final configured = isDebug ? _definedBaseUrl : _definedReleaseBaseUrl;
    if (configured.isNotEmpty) {
      return AppConfig(apiBaseUrl: _normalize(configured), isDebug: isDebug);
    }
    if (isDebug) {
      final host = !kIsWeb && defaultTargetPlatform == TargetPlatform.android ? '10.0.2.2' : '127.0.0.1';
      return AppConfig(apiBaseUrl: 'http://$host:8080/api/v1', isDebug: true);
    }
    return const AppConfig(apiBaseUrl: '', isDebug: false);
  }

  bool get isConfigured => apiBaseUrl.isNotEmpty;

  /// release 只接受 HTTPS；debug 允许显式局域网 HTTP 联调。
  bool get isTransportAllowed {
    if (apiBaseUrl.isEmpty) return false;
    final uri = Uri.tryParse(apiBaseUrl);
    if (uri == null) return false;
    if (isDebug) return uri.scheme == 'http' || uri.scheme == 'https';
    return uri.scheme == 'https';
  }

  static String _normalize(String value) {
    var normalized = value.trim();
    while (normalized.endsWith('/')) {
      normalized = normalized.substring(0, normalized.length - 1);
    }
    return normalized;
  }
}
