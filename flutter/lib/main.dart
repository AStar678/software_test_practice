import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/company/company_time.dart';
import 'core/company/workspace_clock.dart';
import 'core/config/app_config.dart';
import 'core/providers.dart';
import 'core/session/secure_credential_store.dart';
import 'core/session/session_manager.dart';
import 'features/auth/data/auth_api.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  CompanyTimeZone.ensureInitialized();

  final config = AppConfig.fromEnvironment();
  final clock = WorkspaceClock();
  final sessionManager = SessionManager(
    api: AuthApi(
      dio: Dio(
        BaseOptions(
          connectTimeout: const Duration(seconds: 12),
          receiveTimeout: const Duration(seconds: 20),
          validateStatus: (status) => status != null && status < 400,
          contentType: 'application/json',
          headers: {'Accept': 'application/json'},
        ),
      ),
      baseUrl: config.apiBaseUrl,
    ),
    store: SecureCredentialStore(),
    clock: clock,
  );

  runApp(
    ProviderScope(
      overrides: [
        appConfigProvider.overrideWithValue(config),
        workspaceClockProvider.overrideWithValue(clock),
        sessionManagerProvider.overrideWithValue(sessionManager),
      ],
      child: const PandoraApp(),
    ),
  );

  // 先渲染启动页，再读取安全存储并核验会话。
  unawaited(sessionManager.initialize());
}
