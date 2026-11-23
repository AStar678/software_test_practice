import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/app.dart';
import 'package:pandora_employee/core/company/workspace_clock.dart';
import 'package:pandora_employee/core/config/app_config.dart';
import 'package:pandora_employee/core/errors/app_error.dart';
import 'package:pandora_employee/core/providers.dart';
import 'package:pandora_employee/core/session/credential_store.dart';
import 'package:pandora_employee/core/session/session_manager.dart';
import 'package:pandora_employee/features/auth/data/auth_api.dart';
import 'package:pandora_employee/features/auth/presentation/login_page.dart';

import '../support/test_harness.dart';

void main() {
  testWidgets('登录失败保留表单并显示密码错误', (tester) async {
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final gateway = _PendingLoginGateway();
    final clock = WorkspaceClock(now: () => DateTime.utc(2026, 11, 18));
    final session = SessionManager(
      api: gateway,
      store: MemoryCredentialStore(),
      clock: clock,
    );
    addTearDown(session.dispose);
    await session.initialize();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        appConfigProvider.overrideWithValue(
          const AppConfig(apiBaseUrl: 'https://test.local/api/v1', isDebug: true),
        ),
        workspaceClockProvider.overrideWithValue(clock),
        sessionManagerProvider.overrideWithValue(session),
      ],
      child: const PandoraApp(),
    ));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).at(0), '001');
    await tester.enterText(find.byType(TextFormField).at(1), 'test-password');
    await tester.tap(find.widgetWithText(FilledButton, '登录'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    final keptLoginPage = find.byType(LoginPage).evaluate().isNotEmpty;
    gateway.pending.completeError(ApiException(
      kind: ApiErrorKind.unauthorized,
      statusCode: 401,
      message: '账号或密码不正确',
    ));
    await tester.pumpAndSettle();

    expect(keptLoginPage, isTrue);
    expect(find.text('001'), findsOneWidget);
    expect(find.text('手机号或密码不正确'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  for (final phone in ['001', '13800000001', '+123', '+86 (138) 0000.0004']) {
    testWidgets('登录表单接受服务端支持的 ${phone.length} 位登录号', (tester) async {
      final container = buildTestContainer(
        backend: FakeBackend(),
        user: employeeUser(),
      );
      addTearDown(container.dispose);
      await tester.pumpWidget(wrapWithScope(container, const LoginPage()));
      await tester.enterText(find.byType(TextFormField).at(0), phone);
      await tester.enterText(find.byType(TextFormField).at(1), 'test-password');

      expect(tester.state<FormState>(find.byType(Form)).validate(), isTrue);
    });
  }
}

class _PendingLoginGateway extends FakeAuthGateway {
  _PendingLoginGateway() : super(employeeUser());

  final pending = Completer<LoginResult>();

  @override
  Future<LoginResult> login({required String phone, required String password}) => pending.future;
}
