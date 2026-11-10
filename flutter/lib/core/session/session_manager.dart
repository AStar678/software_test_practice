// ignore_for_file: prefer_initializing_formals
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../features/auth/data/auth_gateway.dart';
import '../../features/auth/domain/employee_user.dart';
import '../company/workspace_clock.dart';
import '../errors/app_error.dart';
import 'credential_store.dart';
import 'session_gateway.dart';

enum SessionPhase {
  /// 启动时读取安全存储。
  bootstrapping,

  /// 已持有凭证但尚不能确定会话有效（启动核验/刷新结果未知/离线）。
  checking,

  /// 未登录。
  unauthenticated,

  /// 受限改密会话：只允许会话读取、改密和退出。
  restricted,

  /// 正常会话。
  authenticated,

  /// 会话已失效，需要重新登录。
  expired,
}

class SessionState {
  const SessionState({
    this.phase = SessionPhase.bootstrapping,
    this.user,
    this.error,
    this.notice,
    this.accountEpoch = 0,
    this.mustChangePassword = false,
  });

  final SessionPhase phase;
  final EmployeeUser? user;
  final ApiException? error;
  final String? notice;
  final int accountEpoch;
  final bool mustChangePassword;

  bool get isAuthenticated => phase == SessionPhase.authenticated;
  bool get isRestricted => phase == SessionPhase.restricted;

  /// 受限会话也算已登录，但只能访问会话/改密/退出。
  bool get signedIn => isAuthenticated || isRestricted;

  bool get canUseBusinessApis => isAuthenticated;

  String? get accountId => user?.id;

  SessionState copyWith({
    SessionPhase? phase,
    EmployeeUser? user,
    ApiException? error,
    String? notice,
    int? accountEpoch,
    bool? mustChangePassword,
    bool clearUser = false,
    bool clearError = false,
    bool clearNotice = false,
  }) {
    return SessionState(
      phase: phase ?? this.phase,
      user: clearUser ? null : (user ?? this.user),
      error: clearError ? null : (error ?? this.error),
      notice: clearNotice ? null : (notice ?? this.notice),
      accountEpoch: accountEpoch ?? this.accountEpoch,
      mustChangePassword: mustChangePassword ?? this.mustChangePassword,
    );
  }
}

/// 显式会话状态机：
/// - 凭证只进安全存储；
/// - 刷新串行合并，成功后先保存再放行；
/// - 旧凭证代次的迟到 401 不清除新凭证；
/// - 刷新结果未知时暂停业务并核验，不重放写请求。
class SessionManager extends ChangeNotifier implements SessionGateway {
  SessionManager({
    required AuthGateway api,
    required CredentialStore store,
    required WorkspaceClock clock,
    DateTime Function()? now,
  })  : _api = api,
        _store = store,
        _clock = clock,
        _now = now ?? DateTime.now;

  final AuthGateway _api;
  final CredentialStore _store;
  final WorkspaceClock _clock;
  final DateTime Function() _now;

  final StreamController<SessionState> _events = StreamController<SessionState>.broadcast();

  SessionState _state = const SessionState();
  SessionCredentials? _credentials;
  Future<bool>? _refreshing;
  bool _disposed = false;
  bool _recovering = false;

  /// 刷新提前量：临近过期才刷新，不以每次请求换取新 token。
  static const Duration refreshLead = Duration(minutes: 2);

  SessionState get state => _state;

  Stream<SessionState> get events => _events.stream;

  WorkspaceClock get clock => _clock;

  @override
  int get credentialGeneration => _credentials?.generation ?? 0;

  bool get hasCredentials => _credentials != null;

  DateTime get _nowUtc => _now().toUtc();

  // ---------------------------------------------------------------------------
  // 启动与登录
  // ---------------------------------------------------------------------------

  /// 进程重建/应用启动：先读取安全存储，再按实际状态决定是否发请求。
  Future<void> initialize() async {
    _emit(_state.copyWith(phase: SessionPhase.bootstrapping, clearError: true));
    SessionCredentials? stored;
    try {
      stored = await _store.read();
    } catch (_) {
      _emit(_state.copyWith(
        phase: SessionPhase.unauthenticated,
        error: ApiException(
          kind: ApiErrorKind.unknown,
          message: '无法读取安全存储中的登录状态，请重新登录',
        ),
      ));
      return;
    }
    if (stored == null) {
      _emit(_state.copyWith(phase: SessionPhase.unauthenticated, clearUser: true));
      return;
    }
    _credentials = stored;
    _emit(_state.copyWith(phase: SessionPhase.checking, clearError: true));

    // 启动时已过期：不刷新、不循环，统一重登。
    if (stored.isExpired(_nowUtc)) {
      await _expire();
      return;
    }
    try {
      final user = await _api.session(stored.token);
      _applyUser(user);
      _clock.updateZone(user.organizationTimeZone);
      if (_state.isAuthenticated && stored.isNearExpiry(_nowUtc, lead: refreshLead)) {
        await _refresh();
      }
    } on ApiException catch (error) {
      await _handleVerificationError(error);
    }
  }

  Future<void> login({required String phone, required String password}) async {
    _emit(_state.copyWith(phase: SessionPhase.checking, clearError: true, clearNotice: true));
    try {
      final result = await _api.login(phone: phone, password: password);
      final credentials = SessionCredentials(
        token: result.token,
        expiresAt: result.expiresAt,
        generation: (_credentials?.generation ?? 0) + 1,
      );
      try {
        await _store.write(credentials);
      } catch (_) {
        throw ApiException(
          kind: ApiErrorKind.unknown,
          message: '无法安全保存登录状态，请检查系统安全设置后重试',
        );
      }
      _credentials = credentials;
      _clock.updateZone(result.user.organizationTimeZone);
      _state = SessionState(
        phase: result.restricted ? SessionPhase.restricted : SessionPhase.authenticated,
        user: result.user,
        accountEpoch: _state.accountEpoch + 1,
        mustChangePassword: result.restricted,
      );
      _emit(_state);
    } on ApiException catch (error) {
      _emit(SessionState(
        phase: SessionPhase.unauthenticated,
        error: error,
        accountEpoch: _state.accountEpoch,
      ));
      rethrow;
    }
  }

  // ---------------------------------------------------------------------------
  // 会话核验与刷新
  // ---------------------------------------------------------------------------

  /// 供网络层调用：临近过期时串行刷新；无有效凭证返回 null。
  @override
  Future<String?> authorize() async {
    final credentials = _credentials;
    if (credentials == null || !_state.isAuthenticated) return null;
    if (credentials.isExpired(_nowUtc)) {
      await _expire();
      return null;
    }
    if (credentials.isNearExpiry(_nowUtc, lead: refreshLead)) {
      final refreshed = await _refresh();
      if (!refreshed) return null;
      return _credentials?.token;
    }
    return credentials.token;
  }

  @override
  Future<bool> handleUnauthorized(int sentGeneration) async {
    final credentials = _credentials;
    if (credentials == null) return false;

    // 请求发出后凭证已轮换：旧代次的 401 不能清除新凭证，也不触发再次刷新。
    if (sentGeneration != credentials.generation) {
      return _state.isAuthenticated;
    }
    if (_state.isRestricted) return false;
    if (credentials.isExpired(_nowUtc)) {
      await _expire();
      return false;
    }
    return _refresh();
  }

  /// 单飞刷新：并发调用等待同一次轮换。
  Future<bool> _refresh() {
    final inFlight = _refreshing;
    if (inFlight != null) return inFlight;
    final future = _performRefresh();
    _refreshing = future;
    future.whenComplete(() {
      if (identical(_refreshing, future)) _refreshing = null;
    });
    return future;
  }

  Future<bool> _performRefresh() async {
    final current = _credentials;
    if (current == null) return false;
    if (_state.isRestricted) return false;
    if (current.isExpired(_nowUtc)) {
      await _expire();
      return false;
    }
    try {
      final result = await _api.refresh(current.token);
      final next = SessionCredentials(
        token: result.token,
        expiresAt: result.expiresAt,
        generation: current.generation + 1,
      );
      try {
        await _store.write(next);
      } catch (_) {
        // 刷新已在服务端提交但无法安全保存：暂停业务，核验所持旧凭证。
        await _recoverFromUncertainRefresh();
        return false;
      }
      _credentials = next;
      _clock.updateZone(result.user.organizationTimeZone);
      _state = SessionState(
        phase: result.restricted ? SessionPhase.restricted : SessionPhase.authenticated,
        user: result.user,
        accountEpoch: _state.accountEpoch,
        mustChangePassword: result.restricted,
      );
      _emit(_state);
      return true;
    } on ApiException catch (error) {
      if (error.isUnauthorized || error.isForbidden) {
        await _expire();
        return false;
      }
      // 网络/未知：刷新结果不确定，暂停业务并核验当前持有的凭证。
      _emit(_state.copyWith(
        phase: SessionPhase.checking,
        error: ApiException(
          kind: error.kind,
          message: '无法确认登录状态，请检查网络后重试',
          statusCode: error.statusCode,
          code: error.code,
          retryable: true,
        ),
      ));
      return false;
    }
  }

  /// 刷新响应丢失/保存失败后的恢复：若旧 token 仍有效则重试一次；
  /// 已撤销则清理并重登；网络失败只提示重试。
  Future<void> _recoverFromUncertainRefresh() async {
    if (_recovering) return;
    _recovering = true;
    try {
      final held = _credentials;
      if (held == null) {
        await _expire();
        return;
      }
      _emit(_state.copyWith(
        phase: SessionPhase.checking,
        error: ApiException(
          kind: ApiErrorKind.unknown,
          message: '刷新已提交但无法安全保存新凭证，正在核验会话',
          retryable: true,
        ),
      ));
      try {
        final user = await _api.session(held.token);
        _applyUser(user);
        _clock.updateZone(user.organizationTimeZone);
        if (_state.isAuthenticated) {
          final retried = await _performRefreshOnce();
          if (!retried) {
            _emit(_state.copyWith(
              phase: SessionPhase.checking,
              error: ApiException(
                kind: ApiErrorKind.unknown,
                message: '无法保存新登录凭证，请检查系统安全设置后重试',
                retryable: true,
              ),
            ));
          }
        }
      } on ApiException catch (error) {
        await _handleVerificationError(error);
      }
    } finally {
      _recovering = false;
    }
  }

  /// 供恢复路径显式重试一次刷新，不再递归进入恢复逻辑。
  Future<bool> _performRefreshOnce() async {
    final current = _credentials;
    if (current == null || current.isExpired(_nowUtc)) return false;
    try {
      final result = await _api.refresh(current.token);
      final next = SessionCredentials(
        token: result.token,
        expiresAt: result.expiresAt,
        generation: current.generation + 1,
      );
      await _store.write(next);
      _credentials = next;
      _state = SessionState(
        phase: result.restricted ? SessionPhase.restricted : SessionPhase.authenticated,
        user: result.user,
        accountEpoch: _state.accountEpoch,
        mustChangePassword: result.restricted,
      );
      _emit(_state);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// 用户点击“重试核验”：只检查当前持有的凭证，不重放写请求。
  Future<void> retryVerification() async {
    final held = _credentials;
    if (held == null) {
      _emit(const SessionState(phase: SessionPhase.unauthenticated));
      return;
    }
    _emit(_state.copyWith(phase: SessionPhase.checking, clearError: true));
    if (held.isExpired(_nowUtc)) {
      await _expire();
      return;
    }
    try {
      final user = await _api.session(held.token);
      _applyUser(user);
      _clock.updateZone(user.organizationTimeZone);
    } on ApiException catch (error) {
      await _handleVerificationError(error);
    }
  }

  Future<void> _handleVerificationError(ApiException error) async {
    if (error.isUnauthorized || error.isNotFound) {
      await _expire();
      return;
    }
    _emit(_state.copyWith(
      phase: SessionPhase.checking,
      error: error.isNetwork
          ? ApiException(
              kind: error.kind,
              message: '无法连接服务验证登录状态，请检查网络后重试',
              retryable: true,
            )
          : error,
    ));
  }

  // ---------------------------------------------------------------------------
  // 改密与退出
  // ---------------------------------------------------------------------------

  Future<void> changePassword({required String currentPassword, required String newPassword}) async {
    final credentials = _credentials;
    if (credentials == null) throw ApiException.sessionExpired();
    try {
      await _api.changePassword(
        token: credentials.token,
        currentPassword: currentPassword,
        newPassword: newPassword,
      );
    } on ApiException {
      // 错误原密码保留输入与草稿，不清除会话。
      rethrow;
    }
    // 服务端已撤销全部会话；本地凭证绝不能复用。
    _credentials = null;
    try {
      await _store.clear();
    } catch (_) {
      // 清理失败也不能保留内存凭证，下一次启动按无法读取处理。
    }
    _clock.reset();
    _state = SessionState(
      phase: SessionPhase.unauthenticated,
      accountEpoch: _state.accountEpoch + 1,
      notice: '密码已修改，请使用新密码重新登录',
    );
    _emit(_state);
  }

  Future<void> logout() async {
    final credentials = _credentials;
    _credentials = null;
    try {
      if (credentials != null) {
        await _api.logout(credentials.token);
      }
    } catch (_) {
      // 网络失败也要清本地会话，服务端会话由其自身过期/撤销策略处理。
    }
    try {
      await _store.clear();
    } catch (_) {
      // 本地清理失败不阻断开界面；凭证已不在内存。
    }
    _clock.reset();
    _state = SessionState(phase: SessionPhase.unauthenticated, accountEpoch: _state.accountEpoch + 1);
    _emit(_state);
  }

  /// 当前凭证被服务端撤销（401/停用）时调用。
  @override
  void notifyExpired() {
    unawaited(_expire());
  }

  Future<void> _expire() async {
    _credentials = null;
    try {
      await _store.clear();
    } catch (_) {
      // 忽略安全存储清理失败；内存凭证已清除。
    }
    _clock.reset();
    _state = SessionState(
      phase: SessionPhase.expired,
      accountEpoch: _state.accountEpoch + 1,
      notice: '登录状态已失效，请重新登录',
    );
    _emit(_state);
  }

  /// 前台恢复/权限变化后重验会话，不展示旧敏感正文。
  Future<void> revalidateOnResume() async {
    if (!_state.isAuthenticated) return;
    final credentials = _credentials;
    if (credentials == null) return;
    if (credentials.isExpired(_nowUtc)) {
      await _expire();
      return;
    }
    try {
      final user = await _api.session(credentials.token);
      _applyUser(user);
      _clock.updateZone(user.organizationTimeZone);
    } on ApiException catch (error) {
      if (error.isUnauthorized || error.isNotFound) {
        await _expire();
      }
      // 网络失败保持当前界面，由具体页面给出离线提示，不伪装成功。
    }
  }

  void updateUser(EmployeeUser user) {
    if (_state.user?.id != user.id) return;
    _applyUser(user);
    _emit(_state);
  }

  void _applyUser(EmployeeUser user) {
    _clock.updateZone(user.organizationTimeZone);
    final restricted = user.mustChangePassword;
    _state = SessionState(
      phase: restricted ? SessionPhase.restricted : SessionPhase.authenticated,
      user: user,
      accountEpoch: _state.accountEpoch,
      mustChangePassword: restricted,
    );
  }

  void _emit(SessionState state) {
    _state = state;
    if (_disposed) return;
    notifyListeners();
    if (!_events.isClosed) _events.add(state);
  }

  @override
  void dispose() {
    _disposed = true;
    _events.close();
    super.dispose();
  }
}
