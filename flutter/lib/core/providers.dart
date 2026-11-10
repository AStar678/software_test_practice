import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'company/company_date.dart';
import 'company/company_time.dart';
import 'company/workspace_clock.dart';
import 'config/app_config.dart';
import 'net/api_client.dart';
import 'net/operation_keys.dart';
import 'net/version_registry.dart';
import 'session/session_manager.dart';
import 'session/session_gateway.dart';

/// 应用级依赖在 `main` 中通过 override 注入，便于测试替换时钟、存储与网络。
final appConfigProvider = Provider<AppConfig>((ref) {
  throw StateError('AppConfig 未注入');
});

final workspaceClockProvider = Provider<WorkspaceClock>((ref) {
  throw StateError('WorkspaceClock 未注入');
});

final sessionManagerProvider = Provider<SessionManager>((ref) {
  throw StateError('SessionManager 未注入');
});

final versionRegistryProvider = Provider<VersionRegistry>((ref) {
  final registry = VersionRegistry();
  ref.onDispose(registry.clear);
  return registry;
});

/// 会话状态流：任何页面都能区分启动校验、受限改密、正常与失效。
final sessionStateProvider = StreamProvider<SessionState>((ref) {
  final manager = ref.watch(sessionManagerProvider);
  final controller = StreamController<SessionState>();
  controller.add(manager.state);
  final subscription = manager.events.listen(controller.add);
  ref.onDispose(() async {
    await subscription.cancel();
    await controller.close();
  });
  return controller.stream;
});

/// 账号代次：登录/退出/失效都会递增，用于丢弃旧账号的迟到响应。
final accountEpochProvider = Provider<int>((ref) {
  return ref.watch(sessionStateProvider).asData?.value.accountEpoch ?? 0;
});

final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient(
    config: ref.watch(appConfigProvider),
    session: ref.watch(sessionManagerProvider) as SessionGateway,
    versions: ref.watch(versionRegistryProvider),
  );
  return client;
});

final companyTimeZoneProvider = Provider<CompanyTimeZone>((ref) {
  final clock = ref.watch(workspaceClockProvider);
  return clock.zone;
});

/// 当前公司业务日：优先服务端 businessDate。
final businessDateProvider = Provider<CompanyDate>((ref) {
  final clock = ref.watch(workspaceClockProvider);
  // 任何响应更新服务端业务日后，页面通过 invalidate 该 provider 重新定位。
  return clock.businessDate;
});

/// 当前账号；未登录时为 null。
final currentUserProvider = Provider((ref) {
  return ref.watch(sessionStateProvider).asData?.value.user;
});

/// 每个账号独立的一次性操作键表；账号切换自动重建。
final operationKeysProvider = Provider<OperationKeys>((ref) {
  ref.watch(accountEpochProvider);
  final keys = OperationKeys();
  ref.onDispose(keys.clear);
  return keys;
});
