import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/company/workspace_clock.dart';
import 'package:pandora_employee/core/errors/app_error.dart';
import 'package:pandora_employee/core/session/credential_store.dart';
import 'package:pandora_employee/core/session/session_manager.dart';
import 'package:pandora_employee/features/auth/data/auth_api.dart';
import 'package:pandora_employee/features/auth/data/auth_gateway.dart';
import 'package:pandora_employee/features/auth/domain/employee_user.dart';

EmployeeUser _user({bool restricted = false, String id = 'u1', String name = '亚里士多德'}) {
  return EmployeeUser(
    id: id,
    displayName: name,
    role: 'employee',
    phone: '13800000004',
    organizationTimeZone: 'Asia/Shanghai',
    mustChangePassword: restricted,
  );
}

class FakeAuthGateway implements AuthGateway {
  FakeAuthGateway({required this.now});

  final DateTime Function() now;
  int loginCalls = 0;
  int refreshCalls = 0;
  int sessionCalls = 0;
  int logoutCalls = 0;

  bool restrictedLogin = false;
  ApiException? loginError;
  ApiException? refreshError;
  ApiException? sessionError;
  Completer<void>? refreshGate;
  Duration expiresIn = const Duration(hours: 1);

  @override
  Future<LoginResult> login({required String phone, required String password}) async {
    loginCalls++;
    if (loginError != null) throw loginError!;
    final user = _user(restricted: restrictedLogin);
    return LoginResult(
      token: 'token-$loginCalls',
      expiresAt: now().add(expiresIn),
      user: user,
      passwordChangeRequired: restrictedLogin,
    );
  }

  @override
  Future<LoginResult> refresh(String token) async {
    refreshCalls++;
    final gate = refreshGate;
    if (gate != null) await gate.future;
    if (refreshError != null) throw refreshError!;
    return LoginResult(
      token: 'rotated-$refreshCalls',
      expiresAt: now().add(const Duration(hours: 1)),
      user: _user(),
      passwordChangeRequired: false,
    );
  }

  @override
  Future<EmployeeUser> session(String token) async {
    sessionCalls++;
    if (sessionError != null) throw sessionError!;
    return _user();
  }

  @override
  Future<void> logout(String token) async {
    logoutCalls++;
  }

  @override
  Future<void> changePassword({
    required String token,
    required String currentPassword,
    required String newPassword,
  }) async {}
}

void main() {
  late DateTime now;
  late FakeAuthGateway gateway;
  late MemoryCredentialStore store;
  late SessionManager manager;

  SessionManager build({DateTime Function()? clock}) {
    now = DateTime.utc(2026, 11, 10, 12);
    gateway = FakeAuthGateway(now: clock ?? () => now);
    store = MemoryCredentialStore();
    manager = SessionManager(
      api: gateway,
      store: store,
      clock: WorkspaceClock(now: clock ?? () => now),
      now: clock ?? () => now,
    );
    return manager;
  }

  test('登录进入正常会话并安全保存凭证', () async {
    build();
    await manager.login(phone: '13800000004', password: 'Demo@123456');
    expect(manager.state.phase, SessionPhase.authenticated);
    expect(manager.state.accountEpoch, 1);
    expect(await store.read(), isNotNull);
    expect(manager.state.user?.displayName, '亚里士多德');
  });

  test('受限会话不预取、不刷新', () async {
    build();
    gateway.restrictedLogin = true;
    await manager.login(phone: '13800000004', password: 'Demo@123456');
    expect(manager.state.phase, SessionPhase.restricted);
    expect(await manager.authorize(), isNull);
    expect(manager.state.canUseBusinessApis, isFalse);
    expect(gateway.refreshCalls, 0);
  });

  test('并发临期请求只等待同一次刷新', () async {
    build();
    gateway.expiresIn = const Duration(seconds: 30);
    await manager.login(phone: '13800000004', password: 'Demo@123456');
    gateway.refreshGate = Completer<void>();
    final first = manager.authorize();
    final second = manager.authorize();
    await Future<void>.delayed(Duration.zero);
    expect(gateway.refreshCalls, 1);
    gateway.refreshGate!.complete();
    final tokens = await Future.wait([first, second]);
    expect(tokens[0], 'rotated-1');
    expect(tokens[1], 'rotated-1');
    expect(manager.credentialGeneration, 2);
  });

  test('启动时 token 已过期：不刷新、清理并重登', () async {
    now = DateTime.utc(2026, 11, 10, 12);
    gateway = FakeAuthGateway(now: () => now);
    store = MemoryCredentialStore(
      SessionCredentials(token: 'old', expiresAt: now.subtract(const Duration(minutes: 1)), generation: 1),
    );
    manager = SessionManager(
      api: gateway,
      store: store,
      clock: WorkspaceClock(now: () => now),
      now: () => now,
    );
    await manager.initialize();
    expect(gateway.refreshCalls, 0);
    expect(gateway.sessionCalls, 0);
    expect(manager.state.phase, SessionPhase.expired);
    expect(await store.read(), isNull);
  });

  test('启动核验成功后通知监听者进入正常会话', () async {
    now = DateTime.utc(2026, 11, 10, 12);
    store = MemoryCredentialStore(
      SessionCredentials(token: 'stored', expiresAt: now.add(const Duration(hours: 1)), generation: 1),
    );
    gateway = FakeAuthGateway(now: () => now);
    manager = SessionManager(
      api: gateway,
      store: store,
      clock: WorkspaceClock(now: () => now),
      now: () => now,
    );
    final phases = <SessionPhase>[];
    manager.events.listen((state) => phases.add(state.phase));
    await manager.initialize();
    await Future<void>.delayed(Duration.zero);
    expect(manager.state.phase, SessionPhase.authenticated);
    expect(phases, contains(SessionPhase.authenticated));
  });

  test('旧凭证代次的迟到 401 不清除已轮换的新凭证', () async {
    build();
    gateway.expiresIn = const Duration(seconds: 30);
    await manager.login(phone: '13800000004', password: 'Demo@123456');
    final oldGeneration = manager.credentialGeneration;
    expect(await manager.authorize(), 'rotated-1'); // 主动刷新，代次 +1
    expect(manager.credentialGeneration, oldGeneration + 1);

    final retry = await manager.handleUnauthorized(oldGeneration);
    expect(retry, isTrue);
    expect(manager.state.phase, SessionPhase.authenticated);
    expect(await store.read(), isNotNull);
    expect(gateway.refreshCalls, 1);
  });

  test('刷新返回 401 时进入失效，不能循环刷新', () async {
    build();
    gateway.expiresIn = const Duration(seconds: 30);
    await manager.login(phone: '13800000004', password: 'Demo@123456');
    gateway.refreshError = ApiException.sessionExpired();
    final token = await manager.authorize();
    expect(token, isNull);
    expect(manager.state.phase, SessionPhase.expired);
    expect(gateway.refreshCalls, 1);
    expect(await store.read(), isNull);
  });

  test('刷新成功但安全存储失败：暂停业务并核验，不释放新 token', () async {
    build();
    gateway.expiresIn = const Duration(seconds: 30);
    await manager.login(phone: '13800000004', password: 'Demo@123456');
    store.failWrites = true;
    final token = await manager.authorize();
    expect(token, isNull);
    expect(manager.state.phase, SessionPhase.checking);
    expect(manager.state.error, isNotNull);
    expect(gateway.sessionCalls, 1); // 用所持旧 token 核验
  });

  test('改密成功清理会话并要求重新登录', () async {
    build();
    await manager.login(phone: '13800000004', password: 'Demo@123456');
    await manager.changePassword(currentPassword: 'Demo@123456', newPassword: 'NewPass12345');
    expect(manager.state.phase, SessionPhase.unauthenticated);
    expect(manager.state.notice, contains('重新登录'));
    expect(await store.read(), isNull);
    expect(await manager.authorize(), isNull);
  });

  test('退出清理本地凭证与账号代次', () async {
    build();
    await manager.login(phone: '13800000004', password: 'Demo@123456');
    final epoch = manager.state.accountEpoch;
    await manager.logout();
    expect(manager.state.phase, SessionPhase.unauthenticated);
    expect(manager.state.accountEpoch, greaterThan(epoch));
    expect(await store.read(), isNull);
  });

  test('离线核验失败明确重试，恢复后回到正常会话', () async {
    build();
    now = DateTime.utc(2026, 11, 10, 12);
    store = MemoryCredentialStore(
      SessionCredentials(token: 'stored', expiresAt: now.add(const Duration(hours: 1)), generation: 1),
    );
    gateway = FakeAuthGateway(now: () => now);
    gateway.sessionError = ApiException.network();
    manager = SessionManager(
      api: gateway,
      store: store,
      clock: WorkspaceClock(now: () => now),
      now: () => now,
    );
    await manager.initialize();
    expect(manager.state.phase, SessionPhase.checking);
    expect(manager.state.error?.isNetwork, isTrue);

    gateway.sessionError = null;
    await manager.retryVerification();
    expect(manager.state.phase, SessionPhase.authenticated);
    expect(manager.state.user?.id, 'u1');
  });

  test('换账号递增代次且旧账号凭证不残留', () async {
    build();
    await manager.login(phone: '13800000004', password: 'Demo@123456');
    final firstEpoch = manager.state.accountEpoch;
    await manager.logout();
    await manager.login(phone: '13800000005', password: 'Demo@123456');
    expect(manager.state.accountEpoch, greaterThan(firstEpoch + 1));
    expect(manager.state.user?.id, 'u1');
  });
}
