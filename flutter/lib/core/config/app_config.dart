import 'package:flutter/foundation.dart';

/// 构建期平台配置。API 地址只能通过显式构建配置提供，界面上不暴露技术设置。
class AppConfig {
  const AppConfig({required this.apiBaseUrl, required this.isDebug});

  final String apiBaseUrl;
  final bool isDebug;

  static const String _definedBaseUrl = String.fromEnvironment('API_BASE_URL');
  static const String _definedReleaseBaseUrl = String.fromEnvironment(
    'RELEASE_API_BASE_URL',
  );

  /// 默认值与 release 规则：
  /// - debug/课程演示使用显式 `--dart-define=API_BASE_URL=...`；
  /// - debug 默认连接现有服务器的 HTTPS 6644 入口；
  /// - 可选 release 使用 RELEASE_API_BASE_URL，必须为 HTTPS。
  factory AppConfig.fromEnvironment({bool? debugOverride}) {
    final isDebug = debugOverride ?? kDebugMode;
    final configured = isDebug ? _definedBaseUrl : _definedReleaseBaseUrl;
    if (configured.isNotEmpty) {
      return AppConfig(apiBaseUrl: _normalize(configured), isDebug: isDebug);
    }
    if (isDebug) {
      return const AppConfig(
        apiBaseUrl: 'https://8.141.96.122:6644/api/v1',
        isDebug: true,
      );
    }
    return const AppConfig(apiBaseUrl: '', isDebug: false);
  }

  bool get isConfigured => apiBaseUrl.isNotEmpty;

  /// release 只接受 HTTPS；debug 允许显式局域网 HTTP 联调。
  bool get isTransportAllowed {
    if (apiBaseUrl.isEmpty) return false;
    final uri = Uri.tryParse(apiBaseUrl);
    if (uri == null ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment ||
        uri.path != '/api/v1') {
      return false;
    }
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
