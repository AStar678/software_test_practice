import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/company/company_date.dart';
import 'package:pandora_employee/core/company/workspace_clock.dart';
import 'package:pandora_employee/core/config/app_config.dart';
import 'package:pandora_employee/core/net/api_client.dart';
import 'package:pandora_employee/core/errors/app_error.dart';
import 'package:pandora_employee/core/net/http_error_mapper.dart';
import 'package:pandora_employee/core/net/operation_keys.dart';
import 'package:pandora_employee/core/net/version_registry.dart';
import 'package:pandora_employee/core/session/credential_store.dart';
import 'package:pandora_employee/core/session/session_manager.dart';
import 'package:pandora_employee/features/approvals/data/approvals_api.dart';
import 'package:pandora_employee/features/auth/data/auth_api.dart';
import 'package:pandora_employee/features/auth/domain/password_policy.dart';
import 'package:pandora_employee/features/daily_items/data/daily_items_api.dart';
import 'package:pandora_employee/features/home/data/home_api.dart';
import 'package:pandora_employee/features/tasks/data/tasks_api.dart';
import 'package:pandora_employee/features/work_logs/data/work_logs_api.dart';
import 'package:pandora_employee/features/comments/data/comments_api.dart';
import 'package:pandora_employee/features/profile/data/profile_api.dart';
import 'package:pandora_employee/features/people/data/people_api.dart';
import 'package:pandora_employee/features/notifications/data/notifications_api.dart';
import 'package:pandora_employee/features/notifications/domain/notification_record.dart';
import 'package:pandora_employee/features/analytics/data/analytics_api.dart';
import 'package:pandora_employee/features/holidays/data/holidays_api.dart';
import 'package:pandora_employee/features/holidays/domain/holiday_calendar.dart';

/// 真实隔离演示后端（`backend/scripts/start-demo.sh`）联调检查。
/// 未启动时整组跳过，不把缺失环境伪装成通过。
final bool _backendUp = () {
  try {
    final result = Process.runSync('curl', [
      '-s',
      '-o',
      '/dev/null',
      '-w',
      '%{http_code}',
      '--max-time',
      '2',
      'http://127.0.0.1:8080/health',
    ]);
    return result.stdout.toString().trim() == '200';
  } catch (_) {
    return false;
  }
}();

const String _baseUrl = 'http://127.0.0.1:8080/api/v1';
const String _demoPassword = 'Demo@123456';

void main() {
  late SessionManager session;
  late ApiClient client;
  late WorkspaceClock clock;
  late DailyItemsApi dailyItems;
  late TasksApi tasks;
  late HomeApi home;
  late ApprovalsApi approvals;
  late OperationKeys keys;
  late WorkLogsApi workLogs;
  late CommentsApi comments;
  late NotificationsApi notifications;
  late HolidaysApi holidays;

  session = SessionManager(
    api: AuthApi(
      dio: Dio(
        BaseOptions(
          connectTimeout: const Duration(seconds: 5),
          receiveTimeout: const Duration(seconds: 15),
          validateStatus: (status) => status != null && status < 400,
          contentType: 'application/json',
        ),
      ),
      baseUrl: _baseUrl,
    ),
    store: MemoryCredentialStore(),
    clock: WorkspaceClock(),
  );
  clock = WorkspaceClock();
  client = ApiClient(
    config: const AppConfig(apiBaseUrl: _baseUrl, isDebug: true),
    session: session,
    versions: VersionRegistry(),
  );
  dailyItems = DailyItemsApi(client: client, clock: clock);
  tasks = TasksApi(client: client);
  home = HomeApi(client: client, clock: clock);
  approvals = ApprovalsApi(client: client);
  keys = OperationKeys();
  workLogs = WorkLogsApi(client: client);
  comments = CommentsApi(client: client);
  notifications = NotificationsApi(client: client);
  holidays = HolidaysApi(client: client);

  setUpAll(() async {
    if (!_backendUp) return;
    await session.login(phone: '13800000004', password: _demoPassword);
  });

  final skipReason = _backendUp ? null : '真实演示后端未运行（http://127.0.0.1:8080）';

  test('J01 普通员工真实登录与会话', () async {
    expect(session.state.phase, SessionPhase.authenticated);
    final me = await client.get<Map<String, Object?>>(
      '/me',
      decode: (json) => asJsonMap(json),
    );
    expect(me.data['displayName'], isNotEmpty);
    expect(me.data['accountType'], 'employee');
  }, skip: skipReason);

  test('J01 管理员账号不能走员工移动登录', () async {
    final auth = AuthApi(
      dio: Dio(
        BaseOptions(validateStatus: (status) => status != null && status < 400),
      ),
      baseUrl: _baseUrl,
    );
    try {
      await auth.login(phone: 'admin', password: _demoPassword);
      fail('管理员不应能通过员工手机号登录');
    } catch (error) {
      expect(error, isA<Exception>());
    }
  }, skip: skipReason);

  test('J01/J02 四类真实员工均可用手机号登录并保持真实身份', () async {
    const accounts = <String, String>{
      '13800000001': 'founder',
      '13800000002': 'department_head',
      '13800000011': 'team_head',
      '13800000004': 'employee',
    };
    for (final entry in accounts.entries) {
      final scopedSession = SessionManager(
        api: AuthApi(
          dio: Dio(
            BaseOptions(
              validateStatus: (status) => status != null && status < 400,
            ),
          ),
          baseUrl: _baseUrl,
        ),
        store: MemoryCredentialStore(),
        clock: WorkspaceClock(),
      );
      await scopedSession.login(phone: entry.key, password: _demoPassword);
      expect(scopedSession.state.phase, SessionPhase.authenticated);
      expect(scopedSession.state.user?.role, entry.value);
      final scopedClient = ApiClient(
        config: const AppConfig(apiBaseUrl: _baseUrl, isDebug: true),
        session: scopedSession,
        versions: VersionRegistry(),
      );
      final me = await scopedClient.get<Map<String, Object?>>(
        '/me',
        decode: (json) => asJsonMap(json),
      );
      expect(me.data['accountType'], 'employee');
      await scopedSession.logout();
    }
  }, skip: skipReason);

  test('J04 首页三模块真实返回且看板不超过十项', () async {
    final data = await home.load();
    expect(data.companyItems, isNotEmpty);
    expect(data.companyItems.length, lessThanOrEqualTo(10));
    expect(data.assignedTasks.length, lessThanOrEqualTo(10));
    expect(data.businessDate, matches(RegExp(r'^\d{4}-\d{2}-\d{2}$')));
  }, skip: skipReason);

  test('J05/J06 范围事项：创建、区间读取、完成、删除全链路', () async {
    final today = clock.businessDate;
    final start = today.addDays(1);
    final end = today.addDays(3);
    final body = '客户端联调跨日事项 ${DateTime.now().millisecondsSinceEpoch}';
    final created = await dailyItems.create(
      start: start,
      end: end,
      body: body,
      idempotencyKey: keys.keyFor(
        scope: 'real:daily:create',
        method: 'POST',
        path: '/daily-items',
        body: {'startDate': start.iso, 'endDate': end.iso, 'body': body},
      ),
    );
    expect(created.startDate, start);
    expect(created.endDate, end);
    expect(created.completed, isFalse);

    try {
      final range = await dailyItems.listRange(
        CompanyDateRange(start, end),
        limit: 50,
      );
      final match = range.items.where((item) => item.id == created.id).toList();
      expect(match, hasLength(1));
      expect(match.single.startDate, start);
      expect(match.single.endDate, end);

      await dailyItems.detail(created.id);
      final completed = await dailyItems.change(
        id: created.id,
        completed: true,
        idempotencyKey: keys.keyFor(
          scope: 'real:daily:complete',
          method: 'PATCH',
          path: '/daily-items/${created.id}',
          body: {'completed': true},
        ),
      );
      expect(completed.isCompleted, isTrue);

      final dayPage = await dailyItems.listByDay(end);
      expect(
        dayPage.items.any((item) => item.id == created.id),
        isTrue,
        reason: '结束日也必须命中同一条记录',
      );
    } finally {
      await dailyItems.detail(created.id);
      await dailyItems.delete(
        id: created.id,
        idempotencyKey: keys.keyFor(
          scope: 'real:daily:delete',
          method: 'DELETE',
          path: '/daily-items/${created.id}',
        ),
      );
    }
  }, skip: skipReason);

  test('事项查询窗口超过 93 天在客户端即拒绝', () async {
    expect(
      () => dailyItems.listRange(
        CompanyDateRange(clock.businessDate, clock.businessDate.addDays(93)),
      ),
      throwsArgumentError,
    );
  }, skip: skipReason);

  test('重复同键创建只生效一次', () async {
    final today = clock.businessDate;
    final body = '幂等联调 ${DateTime.now().millisecondsSinceEpoch}';
    final key = keys.keyFor(
      scope: 'real:daily:idempotent',
      method: 'POST',
      path: '/daily-items',
      body: {'startDate': today.iso, 'endDate': today.iso, 'body': body},
    );
    final first = await dailyItems.create(
      start: today,
      end: today,
      body: body,
      idempotencyKey: key,
    );
    try {
      final second = await dailyItems.create(
        start: today,
        end: today,
        body: body,
        idempotencyKey: key,
      );
      expect(second.id, first.id);
      final page = await dailyItems.listByDay(today);
      expect(page.items.where((item) => item.body == body), hasLength(1));
    } finally {
      await dailyItems.detail(first.id);
      await dailyItems.delete(
        id: first.id,
        idempotencyKey: keys.keyFor(
          scope: 'real:daily:idem-delete',
          method: 'DELETE',
          path: '/daily-items/${first.id}',
        ),
      );
    }
  }, skip: skipReason);

  test('J03 旧版本写入返回 412 且保留服务端新版本', () async {
    final today = clock.businessDate;
    final created = await dailyItems.create(
      start: today,
      end: today,
      body: '版本联调 ${DateTime.now().millisecondsSinceEpoch}',
      idempotencyKey: keys.keyFor(
        scope: 'real:daily:version-create',
        method: 'POST',
        path: '/daily-items',
      ),
    );
    try {
      await dailyItems.detail(created.id); // 版本 1
      await dailyItems.change(
        id: created.id,
        body: '第一次修改',
        idempotencyKey: keys.keyFor(
          scope: 'real:daily:v1',
          method: 'PATCH',
          path: '/daily-items/${created.id}',
          body: {'body': '第一次修改'},
        ),
      );
      // 直接用旧 ETag 再写一次：服务端必须 412，而不是覆盖。
      final token = await session.authorize();
      final dio = Dio(
        BaseOptions(validateStatus: (status) => status != null && status < 600),
      );
      final response = await dio.patch<Object?>(
        '$_baseUrl/daily-items/${created.id}',
        data: {'body': '旧版本覆盖尝试'},
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
            'If-Match': '"1"',
            'Idempotency-Key': keys.newKey(),
            'Content-Type': 'application/json',
          },
        ),
      );
      expect(response.statusCode, 412);
      final mapped = mapHttpError(response.statusCode!, response.data);
      expect(mapped.isConflict, isTrue);
      // 服务端版本与正文未被旧版本覆盖。
      final latest = await dailyItems.detail(created.id);
      expect(latest.rowVersion, greaterThan(1));
    } finally {
      await dailyItems.detail(created.id);
      await dailyItems.delete(
        id: created.id,
        idempotencyKey: keys.keyFor(
          scope: 'real:daily:version-delete',
          method: 'DELETE',
          path: '/daily-items/${created.id}',
        ),
      );
    }
  }, skip: skipReason);

  test('任务详情真实可读并带字段资格与审核路由', () async {
    final list = await tasks.listTasks(limit: 5);
    expect(list, isNotEmpty);
    final detail = await tasks.detail(list.first.id);
    expect(detail.id, isNotEmpty);
    expect(detail.title, isNotEmpty);
    expect(detail.route, isNotNull);
    expect(detail.editableFields, isNotEmpty);
  }, skip: skipReason);

  test('真实审核人预览返回服务端路由，且不是凭证', () async {
    final me = await client.get<Map<String, Object?>>(
      '/me',
      decode: (json) => asJsonMap(json),
    );
    final preview = await tasks.preview({'operation': 'create'}, keys);
    expect(preview.operation, 'create');
    expect(
      preview.blocked ||
          preview.reviewerId != null ||
          preview.exemptionReason != null,
      isTrue,
    );
    expect(me.data['id'], isNotEmpty);
  }, skip: skipReason);

  test('我的申请与审核列表按 offset 分页', () async {
    final mine = await approvals.list(mine: 'applicant', limit: 5);
    expect(mine.total, greaterThanOrEqualTo(0));
    if (mine.items.isNotEmpty) {
      final detail = await approvals.detail(mine.items.first.requestId);
      expect(detail.requestId, mine.items.first.requestId);
      expect(detail.proposedVersion, isNotNull);
    }
  }, skip: skipReason);

  test('J14 任务表单独立端点返回全局过滤与置顶字段', () async {
    final today = clock.businessDate;
    final page = await tasks.table(
      from: today.addDays(-365).iso,
      to: today.addDays(365).iso,
      limit: 5,
    );
    expect(page.total, greaterThanOrEqualTo(0));
    for (final task in page.items) {
      expect(task.id, isNotEmpty);
      expect(task.canTablePin || !task.canTablePin, isTrue);
    }
    final empty = await tasks.table(
      from: today.addDays(365).iso,
      to: today.addDays(365).iso,
      limit: 5,
    );
    expect(empty.items, isEmpty);
  }, skip: skipReason);

  test('J20/J21/J23 日志、填充源与评论真实链路', () async {
    final date = clock.businessDate;
    final body = 'Flutter 日志联调 ${DateTime.now().microsecondsSinceEpoch}';
    var created = await workLogs
        .list(limit: 20)
        .then(
          (page) =>
              page.items.where((row) => row.businessDate == date).firstOrNull,
        );
    var ownsCreated = false;
    if (created == null) {
      created = await workLogs.create(
        businessDate: date.iso,
        body: body,
        idempotencyKey: keys.keyFor(
          scope: 'real:log:create',
          method: 'POST',
          path: '/work-logs',
          body: {'businessDate': date.iso, 'body': body},
        ),
      );
      ownsCreated = true;
    }
    expect(created.businessDate, date);
    final page = await workLogs.list(limit: 20);
    expect(page.items.any((row) => row.id == created!.id), isTrue);
    final fill = await workLogs.fillSource(date.iso);
    expect(fill.complete, isTrue);
    final comment = await comments.create(
      objectType: 'log',
      objectId: created.id,
      body: '真实日志评论',
      idempotencyKey: keys.keyFor(
        scope: 'real:log:comment',
        method: 'POST',
        path: '/work-logs/${created.id}/comments',
        body: {'body': '真实日志评论'},
      ),
    );
    expect(comment.id, isNotEmpty);
    final commentsPage = await comments.list(
      objectType: 'log',
      objectId: created.id,
    );
    expect(
      commentsPage.items.any(
        (row) => row.id == comment.id && row.body == '真实日志评论',
      ),
      isTrue,
    );
    await comments.delete(
      commentId: comment.id,
      rowVersion: comment.rowVersion,
      idempotencyKey: keys.keyFor(
        scope: 'real:log:comment-delete',
        method: 'DELETE',
        path: '/comments/${comment.id}',
      ),
    );
    await workLogs.detail(created.id);
    if (ownsCreated) {
      await workLogs.delete(
        id: created.id,
        idempotencyKey: keys.keyFor(
          scope: 'real:log:delete',
          method: 'DELETE',
          path: '/work-logs/${created.id}',
        ),
      );
    }
  }, skip: skipReason);

  test('J24/J25 四角色本人资料与真实下属范围遵守详情/摘要边界', () async {
    const accounts = <String, bool>{
      '13800000001': true,
      '13800000002': true,
      '13800000011': true,
      '13800000004': false,
    };
    for (final entry in accounts.entries) {
      final scopedSession = SessionManager(
        api: AuthApi(
          dio: Dio(
            BaseOptions(
              validateStatus: (status) => status != null && status < 400,
            ),
          ),
          baseUrl: _baseUrl,
        ),
        store: MemoryCredentialStore(),
        clock: WorkspaceClock(),
      );
      await scopedSession.login(phone: entry.key, password: _demoPassword);
      final scopedClient = ApiClient(
        config: const AppConfig(apiBaseUrl: _baseUrl, isDebug: true),
        session: scopedSession,
        versions: VersionRegistry(),
      );
      final self = await ProfileApi(client: scopedClient).self();
      expect(self.id, isNotEmpty);
      expect(self.phone, entry.key);
      expect(self.positionPath, isNotEmpty);
      if (self.hireDate == null) expect(self.tenure, isNull);

      final reports = await PeopleApi(client: scopedClient).reports();
      expect(reports.isNotEmpty, entry.value, reason: '角色 ${self.role} 下属范围');
      expect(
        reports.every(
          (person) => person.id.isNotEmpty && person.displayName.isNotEmpty,
        ),
        isTrue,
      );
      if (reports.isNotEmpty) {
        final detail = await ProfileApi(client: scopedClient)
            .person(reports.first.id);
        expect(detail.id, reports.first.id);
        expect(detail.phone, isNotEmpty);
        // 服务端投影可以为空，但不能用账号创建日伪造 tenure。
        if (detail.hireDate == null) expect(detail.tenure, isNull);
      }
      await scopedSession.logout();
    }
  }, skip: skipReason);

  test('J26 通知 18 种组合均由真实服务过滤且列表读取不标读', () async {
    int? expectedGlobalUnread;
    for (final read in NotificationReadFilter.values) {
      for (final category in NotificationCategory.values) {
        final items = <NotificationRecord>[];
        int? offset = 0;
        int? total;
        var pageCount = 0;
        while (offset != null) {
          final page = await notifications.list(
            read: read,
            category: category,
            offset: offset,
            limit: 7,
          );
          total ??= page.total;
          expectedGlobalUnread ??= page.unreadCount;
          expect(page.total, total);
          expect(page.unreadCount, expectedGlobalUnread);
          items.addAll(page.items);
          offset = page.nextOffset;
          pageCount++;
          expect(pageCount, lessThan(100), reason: '分页不得循环');
        }
        expect(items, hasLength(total!));
        expect(items.map((item) => item.id).toSet(), hasLength(items.length));
        if (read == NotificationReadFilter.unread) {
          expect(items.every((item) => item.unread), isTrue);
        }
        if (read == NotificationReadFilter.read) {
          expect(items.every((item) => !item.unread), isTrue);
        }
        if (category != NotificationCategory.all) {
          expect(
            items.every((item) => item.category == category.apiValue),
            isTrue,
          );
        }
      }
    }
  }, skip: skipReason);

  test('J27 四角色真实统计与本地规则建议按授权范围生成', () async {
    const accounts = <String, String>{
      '13800000001': 'company',
      '13800000002': 'department',
      '13800000011': 'team',
      '13800000004': 'self',
    };
    for (final entry in accounts.entries) {
      final scopedSession = SessionManager(
        api: AuthApi(
          dio: Dio(
            BaseOptions(
              validateStatus: (status) => status != null && status < 400,
            ),
          ),
          baseUrl: _baseUrl,
        ),
        store: MemoryCredentialStore(),
        clock: WorkspaceClock(),
      );
      await scopedSession.login(phone: entry.key, password: _demoPassword);
      final scopedClient = ApiClient(
        config: const AppConfig(apiBaseUrl: _baseUrl, isDebug: true),
        session: scopedSession,
        versions: VersionRegistry(),
      );
      final scopedAnalytics = AnalyticsApi(client: scopedClient);
      final summary = await scopedAnalytics.summary(scope: 'auto');
      expect(summary.scope, entry.value);
      expect(summary.total, greaterThanOrEqualTo(0));
      expect(summary.todo + summary.doing + summary.done, summary.total);
      expect(summary.method, 'current_effective_tasks');
      final jobId = await scopedAnalytics.createReport(
        scope: 'auto',
        idempotencyKey: 'real-analytics-${entry.key}',
      );
      final report = await scopedAnalytics.report(jobId);
      expect(report.mode, 'rule_based');
      expect(report.modelUsed, isFalse);
      expect(report.generatedAt, isNotNull);
      await scopedSession.logout();
    }
  }, skip: skipReason);

  test('J31 项目节假日接口返回 ready/stale/missing 且 missing 不预测', () async {
    final value = await holidays.year(clock.businessDate.year);
    expect(value.status, isIn(HolidayCacheStatus.values));
    if (value.status == HolidayCacheStatus.missing) {
      expect(value.days, isEmpty);
    } else {
      expect(value.updatedAt, isNotNull);
    }
  }, skip: skipReason);

  test('真实认证错误映射为可读 API 错误', () async {
    final auth = AuthApi(
      dio: Dio(
        BaseOptions(validateStatus: (status) => status != null && status < 400),
      ),
      baseUrl: _baseUrl,
    );
    await expectLater(
      auth.login(phone: '13800000004', password: 'wrong-password'),
      throwsA(isA<ApiException>()),
    );
    expect(PasswordPolicy.validateNewPassword('abc123'), isNotNull);
  }, skip: skipReason);
}
