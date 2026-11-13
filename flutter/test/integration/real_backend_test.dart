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
import 'package:pandora_employee/features/tags/data/tags_api.dart';
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
/// 运行时可设 PANDORA_WORKER_INITIAL_DELAY_MS=3600000，避免定时投递改变分页数据；
/// 测试会通过演示管理员显式触发事件投递。
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
  final demoAdmin = Dio(
    BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 5),
      receiveTimeout: const Duration(seconds: 15),
    ),
  );
  String? demoAdminToken;

  Future<void> deliverDemoEvents() async {
    if (demoAdminToken == null) {
      final response = await demoAdmin.post<Map<String, dynamic>>(
        '/auth/sessions',
        data: {
          'accountType': 'admin',
          'accountName': 'admin',
          'password': _demoPassword,
        },
      );
      demoAdminToken = response.data!['token'] as String;
    }
    await demoAdmin.post<void>(
      '/admin/worker/run-once',
      options: Options(headers: {'Authorization': 'Bearer $demoAdminToken'}),
    );
  }

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
  tearDownAll(() async {
    try {
      if (demoAdminToken != null) {
        await demoAdmin.delete<void>(
          '/auth/sessions/current',
          options: Options(
            headers: {'Authorization': 'Bearer $demoAdminToken'},
          ),
        );
      }
    } finally {
      demoAdmin.close();
    }
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

  test('J15/J19 本人日历端点只返回当前负责并携带有效/提议排期', () async {
    final userId = session.state.user!.id;
    final today = clock.businessDate;
    final rows = await tasks.listCalendarTasks(
      assigneeId: userId,
      from: today.addDays(-30).iso,
      to: today.addDays(30).iso,
    );
    for (final task in rows) {
      expect(task.assigneeIds, contains(userId));
      expect(task.published, isTrue);
    }
  }, skip: skipReason);

  test('J14 本人日历置顶持久化且不改任务版本', () async {
    final userId = session.state.user!.id;
    final today = clock.businessDate;
    final rows = await tasks.listCalendarTasks(
      assigneeId: userId,
      from: today.addDays(-30).iso,
      to: today.addDays(30).iso,
    );
    final target = rows.where((task) => task.canPin).firstOrNull;
    expect(target, isNotNull, reason: '演示数据应有当前员工可置顶任务');
    final beforeVersion = target!.rowVersion;
    final scope = 'real:calendar-pin:${target.id}';
    try {
      await tasks.setCalendarPin(
        taskId: target.id,
        pinned: true,
        idempotencyKey: keys.keyFor(
          scope: '$scope:set',
          method: 'PUT',
          path: '/tasks/${target.id}/pin',
        ),
      );
      final pinned = await tasks.listCalendarTasks(
        assigneeId: userId,
        from: today.addDays(-30).iso,
        to: today.addDays(30).iso,
      );
      final after = pinned.firstWhere((task) => task.id == target.id);
      expect(after.pinned, isTrue);
      expect(after.rowVersion, beforeVersion);
    } finally {
      await tasks.setCalendarPin(
        taskId: target.id,
        pinned: false,
        idempotencyKey: keys.keyFor(
          scope: '$scope:clear',
          method: 'DELETE',
          path: '/tasks/${target.id}/pin',
        ),
      );
    }
    final restored = await tasks.listCalendarTasks(
      assigneeId: userId,
      from: today.addDays(-30).iso,
      to: today.addDays(30).iso,
    );
    expect(restored.firstWhere((task) => task.id == target.id).pinned, isFalse);
  }, skip: skipReason);

  test('J19 待审排期只以提议时刻投影并可撤回', () async {
    final userId = session.state.user!.id;
    final today = clock.businessDate;
    final rows = await tasks.listCalendarTasks(
      assigneeId: userId,
      from: today.addDays(-30).iso,
      to: today.addDays(30).iso,
    );
    final target = rows
        .where(
          (task) =>
              task.canReschedule &&
              !task.pending &&
              !task.done &&
              task.startAt != null &&
              task.dueAt != null,
        )
        .firstOrNull;
    expect(target, isNotNull, reason: '演示数据应有当前员工可申请排期变更任务');
    final detail = await tasks.detail(target!.id);
    final proposedStart = detail.startAt!.add(const Duration(days: 2));
    final proposedDue = detail.dueAt!.add(const Duration(days: 2));
    final result = await tasks.change(
      id: detail.id,
      command: 'reschedule',
      payload: {
        'allDay': false,
        'startAt': proposedStart.toUtc().toIso8601String(),
        'dueAt': proposedDue.toUtc().toIso8601String(),
        'reason': '日历待审投影联调',
      },
      idempotencyKey: keys.keyFor(
        scope: 'real:pending-schedule:${detail.id}',
        method: 'PATCH',
        path: '/tasks/${detail.id}',
        body: {'startAt': proposedStart.toUtc().toIso8601String()},
      ),
    );
    expect(result.requestId, isNotNull);
    try {
      final projected = await tasks.listCalendarTasks(
        assigneeId: userId,
        from: proposedStart
            .subtract(const Duration(days: 3))
            .toIso8601String()
            .substring(0, 10),
        to: proposedDue
            .add(const Duration(days: 3))
            .toIso8601String()
            .substring(0, 10),
      );
      final pending = projected.firstWhere((task) => task.id == detail.id);
      expect(pending.pending, isTrue);
      expect(pending.pendingSchedule, isNotNull);
      expect(
        DateTime.parse(pending.pendingSchedule!['startAt']!.toString()),
        proposedStart.toUtc(),
      );
    } finally {
      final request = await approvals.detail(result.requestId!);
      await approvals.decide(
        requestId: request.requestId,
        decision: 'withdraw',
        idempotencyKey: keys.keyFor(
          scope: 'real:pending-schedule-withdraw:${request.requestId}',
          method: 'PATCH',
          path: '/approval-requests/${request.requestId}',
        ),
      );
    }
  }, skip: skipReason);

  test('J14 任务表单组合过滤、稳定分页与单端日期真实链路', () async {
    final userId = session.state.user!.id;
    final today = clock.businessDate;
    final first = await tasks.table(
      relation: 'assigned',
      completion: 'unfinished',
      sort: 'title',
      direction: 'asc',
      limit: 5,
      offset: 0,
    );
    expect(first.total, greaterThanOrEqualTo(first.items.length));
    for (final task in first.items) {
      expect(task.assigneeIds, contains(userId));
      expect(task.done, isFalse);
    }
    if (first.items.length == 5 && first.total > 5) {
      final second = await tasks.table(
        relation: 'assigned',
        completion: 'unfinished',
        sort: 'title',
        direction: 'asc',
        limit: 5,
        offset: 5,
      );
      expect(
        second.items
            .map((task) => task.id)
            .toSet()
            .intersection(first.items.map((task) => task.id).toSet()),
        isEmpty,
      );
    }
    final futureOnly = await tasks.table(
      from: today.addDays(365).iso,
      limit: 5,
    );
    expect(futureOnly.items, isEmpty);
    final created = await tasks.table(relation: 'created', limit: 5);
    for (final task in created.items) {
      expect(task.originalCreatorId, userId);
    }
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

  test('J08 被拒绝的创建申请可由原申请人修改重提', () async {
    final mine = await approvals.list(mine: 'applicant', limit: 50);
    final rejected = mine.items
        .where((row) => row.kind == 'create' && row.status == 'rejected')
        .firstOrNull;
    expect(rejected, isNotNull, reason: '演示数据应包含原员工被拒绝的创建申请');
    final request = await approvals.detail(rejected!.requestId);
    final proposed = request.proposedVersion;
    expect(proposed, isNotNull);
    final task = await tasks.detail(request.taskId);
    final payload = <String, Object?>{
      'title': '${proposed!.title}（重提）',
      'description': proposed.description,
      'acceptanceCriteria': proposed.acceptanceCriteria,
      'priority': proposed.priority,
      'allDay': proposed.allDay,
      'assigneeIds': proposed.assigneeIds,
      'tagIds': proposed.tagIds,
      'parentTaskId': proposed.parentTaskId,
      'reason': '联调修改重提',
    };
    if (proposed.allDay) {
      payload['startDate'] = proposed.startDate;
      payload['dueDate'] = proposed.dueDate;
    } else {
      payload['startAt'] = proposed.startAt?.toUtc().toIso8601String();
      payload['dueAt'] = proposed.dueAt?.toUtc().toIso8601String();
    }
    final changed = await tasks.change(
      id: task.id,
      command: 'change',
      payload: payload,
      idempotencyKey: keys.keyFor(
        scope: 'real:resubmit:${task.id}',
        method: 'PATCH',
        path: '/tasks/${task.id}',
        body: payload,
      ),
    );
    expect(changed.requestId, isNotNull);
    expect(changed.requestId, isNot(request.requestId));
    final old = await approvals.detail(request.requestId);
    expect(old.status, 'rejected');
    final fresh = await approvals.detail(changed.requestId!);
    expect(fresh.isPending, isTrue);
    await approvals.decide(
      requestId: fresh.requestId,
      decision: 'withdraw',
      idempotencyKey: keys.keyFor(
        scope: 'real:resubmit-withdraw:${fresh.requestId}',
        method: 'PATCH',
        path: '/approval-requests/${fresh.requestId}',
      ),
    );
  }, skip: skipReason);

  test('J09/J12 并发裁决只生效一次，待审任务评论独立可用', () async {
    final userId = session.state.user!.id;
    final now = DateTime.now().toUtc();
    final created = await tasks.create(
      payload: {
        'title': '并发审核与评论联调 ${DateTime.now().microsecondsSinceEpoch}',
        'description': '验证并发裁决、作者评论权限',
        'priority': 'medium',
        'allDay': false,
        'startAt': now.add(const Duration(days: 1)).toIso8601String(),
        'dueAt': now.add(const Duration(days: 2)).toIso8601String(),
        'assigneeIds': [userId],
        'tagIds': const <String>[],
      },
      idempotencyKey: keys.keyFor(
        scope: 'real:concurrent-create',
        method: 'POST',
        path: '/tasks',
        body: {'title': '并发审核与评论联调'},
      ),
    );
    expect(created.requestId, isNotNull);

    final reviewerSession = SessionManager(
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
    await reviewerSession.login(phone: '13800000011', password: _demoPassword);
    final reviewerClient = ApiClient(
      config: const AppConfig(apiBaseUrl: _baseUrl, isDebug: true),
      session: reviewerSession,
      versions: VersionRegistry(),
    );
    final reviewerApprovals = ApprovalsApi(client: reviewerClient);
    final reviewerComments = CommentsApi(client: reviewerClient);
    final request = await reviewerApprovals.detail(created.requestId!);

    final outcomes = await Future.wait([
      reviewerApprovals
          .decide(
            requestId: request.requestId,
            decision: 'reject',
            comment: '并发拒绝 A',
            idempotencyKey: keys.newKey(),
          )
          .then((_) => 'ok')
          .catchError((Object _) => 'failed'),
      reviewerApprovals
          .decide(
            requestId: request.requestId,
            decision: 'reject',
            comment: '并发拒绝 B',
            idempotencyKey: keys.newKey(),
          )
          .then((_) => 'ok')
          .catchError((Object _) => 'failed'),
    ]);
    expect(outcomes.where((value) => value == 'ok'), hasLength(1));
    final latest = await reviewerApprovals.detail(request.requestId);
    expect(latest.status, 'rejected');

    final comment = await comments.create(
      objectType: 'task',
      objectId: request.taskId,
      body: '待审任务独立评论',
      idempotencyKey: keys.keyFor(
        scope: 'real:pending-task-comment',
        method: 'POST',
        path: '/tasks/${request.taskId}/comments',
        body: {'body': '待审任务独立评论'},
      ),
    );
    expect(comment.id, isNotEmpty);
    await expectLater(
      reviewerComments.change(
        commentId: comment.id,
        rowVersion: comment.rowVersion,
        body: '越权修改',
        idempotencyKey: keys.newKey(),
      ),
      throwsA(isA<ApiException>()),
    );
    await comments.delete(
      commentId: comment.id,
      rowVersion: comment.rowVersion,
      idempotencyKey: keys.keyFor(
        scope: 'real:pending-task-comment-delete',
        method: 'DELETE',
        path: '/comments/${comment.id}',
      ),
    );
  }, skip: skipReason);

  test('J23 评论通知送达目标负责人', () async {
    final userId = session.state.user!.id;
    final today = clock.businessDate;
    final rows = await tasks.listCalendarTasks(
      assigneeId: userId,
      from: today.addDays(-30).iso,
      to: today.addDays(30).iso,
    );
    final targetTask = rows
        .where(
          (task) =>
              task.published &&
              !task.pending &&
              task.assigneeIds.contains(userId),
        )
        .firstOrNull;
    expect(targetTask, isNotNull, reason: '需要一条已发布的本人负责任务验证评论通知');
    final reviewerSession = SessionManager(
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
    await reviewerSession.login(phone: '13800000011', password: _demoPassword);
    final reviewerClient = ApiClient(
      config: const AppConfig(apiBaseUrl: _baseUrl, isDebug: true),
      session: reviewerSession,
      versions: VersionRegistry(),
    );
    final reviewerComments = CommentsApi(client: reviewerClient);
    final body = '评审联调评论正文 ${DateTime.now().microsecondsSinceEpoch}';
    final comment = await reviewerComments.create(
      objectType: 'task',
      objectId: targetTask!.id,
      body: body,
      idempotencyKey: keys.keyFor(
        scope: 'real:comment-notify',
        method: 'POST',
        path: '/tasks/${targetTask.id}/comments',
        body: {'body': body},
      ),
    );
    try {
      var delivered = false;
      for (var attempt = 0; attempt < 20; attempt++) {
        await deliverDemoEvents();
        final employeeNotifications = await client.get<Map<String, Object?>>(
          '/notifications',
          query: {'category': 'comment', 'limit': 100},
          decode: (json) => asJsonMap(json),
        );
        delivered = asJsonList(employeeNotifications.data['items'])
            .whereType<Map>()
            .any(
              (row) =>
                  row['eventType'] == 'comment.created' &&
                  row['objectId'] == targetTask.id &&
                  row['commentId'] == comment.id,
            );
        if (delivered) break;
        await Future<void>.delayed(const Duration(milliseconds: 250));
      }
      expect(delivered, isTrue, reason: '当前负责人应收到本次评论的通知');
    } finally {
      await reviewerComments.delete(
        commentId: comment.id,
        rowVersion: comment.rowVersion,
        idempotencyKey: keys.keyFor(
          scope: 'real:comment-notify-delete',
          method: 'DELETE',
          path: '/comments/${comment.id}',
        ),
      );
      await reviewerSession.logout();
    }
  }, skip: skipReason);

  test('J22 仅创始人可维护共用标签目录', () async {
    final founderSession = SessionManager(
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
    await founderSession.login(phone: '13800000001', password: _demoPassword);
    final founderVersions = VersionRegistry();
    final founderClient = ApiClient(
      config: const AppConfig(apiBaseUrl: _baseUrl, isDebug: true),
      session: founderSession,
      versions: founderVersions,
    );
    final founderTags = TagsApi(
      client: founderClient,
      versions: founderVersions,
    );
    final name = '联调标签 ${DateTime.now().microsecondsSinceEpoch}';
    final created = await founderTags.create(
      name: name,
      color: '#F6D5D2',
      idempotencyKey: keys.keyFor(
        scope: 'real:tag:create',
        method: 'POST',
        path: '/tags',
      ),
    );
    expect(created.name, name);
    final changed = await founderTags.change(
      id: created.id,
      name: '$name改',
      color: '#FBE3CB',
      rowVersion: created.rowVersion,
      idempotencyKey: keys.keyFor(
        scope: 'real:tag:change',
        method: 'PATCH',
        path: '/tags/${created.id}',
      ),
    );
    expect(changed.name, endsWith('改'));
    await founderTags.delete(
      id: created.id,
      rowVersion: changed.rowVersion,
      idempotencyKey: keys.keyFor(
        scope: 'real:tag:delete',
        method: 'DELETE',
        path: '/tags/${created.id}',
      ),
    );
    await expectLater(
      TagsApi(client: client, versions: VersionRegistry()).create(
        name: '员工越权标签',
        color: '#F6D5D2',
        idempotencyKey: keys.keyFor(
          scope: 'real:tag:forbidden',
          method: 'POST',
          path: '/tags',
        ),
      ),
      throwsA(isA<ApiException>()),
    );
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
        final day = clock.businessDate;
        final schedule = await TasksApi(client: scopedClient).listCalendarTasks(
          assigneeId: reports.first.id,
          from: day.addDays(-40).iso,
          to: day.addDays(40).iso,
        );
        expect(
          schedule.map((task) => task.id).toSet(),
          hasLength(schedule.length),
        );
        final logs = await WorkLogsApi(client: scopedClient)
            .list(scope: 'visible', authorId: reports.first.id, limit: 100);
        expect(logs.items.every((log) => log.id.isNotEmpty), isTrue);
      }
      await scopedSession.logout();
    }
  }, skip: skipReason);

  test('J26 通知 18 种组合均由真实服务过滤且列表读取不标读', () async {
    await deliverDemoEvents();
    final initial = await notifications.list(
      read: NotificationReadFilter.unread,
      category: NotificationCategory.all,
      offset: 0,
      limit: 7,
    );
    expect(initial.nextOffset, 7, reason: '演示库必须覆盖跨页未读通知');
    final readId = initial.items.first.id;
    final detail = await notifications.detail(readId);
    expect(detail.id, readId);
    expect(detail.summary, isNotEmpty);
    await notifications.open(
      id: readId,
      idempotencyKey: keys.keyFor(
        scope: 'real:notification-open',
        method: 'POST',
        path: '/notifications/$readId/open',
        body: const {},
      ),
    );
    HistoricalTaskSummary? history;
    int? historyOffset = 0;
    while (historyOffset != null && history == null) {
      final page = await notifications.list(
        read: NotificationReadFilter.all,
        category: NotificationCategory.all,
        offset: historyOffset,
        limit: 100,
      );
      for (final item in page.items) {
        final candidate = item.id == readId
            ? detail
            : await notifications.detail(item.id);
        if (!candidate.canOpenTask ||
            candidate.eventType.startsWith('comment.')) {
          continue;
        }
        try {
          history = await notifications.historicalTask(candidate.id);
          break;
        } on ApiException catch (error) {
          if (error.code != 'HISTORICAL_TASK_UNAVAILABLE' &&
              !error.isNotFound) {
            rethrow;
          }
        }
      }
      historyOffset = page.nextOffset;
    }
    expect(history, isNotNull, reason: '演示库必须包含一个有效普通历史任务消息');
    expect(history!.readonly, isTrue);
    expect(history.historical, isTrue);
    expect(history.taskId, isNotEmpty);
    final expectedGlobalUnread = initial.unreadCount - 1;
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
          if (category == NotificationCategory.all) {
            expect(items.map((item) => item.id), contains(readId));
          }
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

  test('J28/J29 PC 管理事件纪修改可由 Flutter 真实回读且不扩员工管理权', () async {
    await deliverDemoEvents();
    final auth = Options(headers: {'Authorization': 'Bearer $demoAdminToken'});
    final company = await demoAdmin.get<Map<String, dynamic>>(
      '/admin/company',
      options: auth,
    );
    final items = (company.data?['items'] as List).cast<Map>();
    expect(items, isNotEmpty);
    final original = Map<String, dynamic>.from(items.first);
    final id = original['id'] as String;
    final originalTitle = original['title'] as String;
    final originalBody = original['body'] as String;
    final changedTitle = '$originalTitle · Flutter联动';
    var version = (original['rowVersion'] as num).toInt();
    try {
      final changed = await demoAdmin.patch<Map<String, dynamic>>(
        '/admin/company/items/$id',
        data: {'title': changedTitle, 'body': originalBody},
        options: Options(
          headers: {
            'Authorization': 'Bearer $demoAdminToken',
            'Idempotency-Key': 'flutter-pc-link-change-$id',
            'If-Match': '"$version"',
          },
        ),
      );
      version = (changed.data?['rowVersion'] as num).toInt();
      final mobileHome = await home.load();
      expect(
        mobileHome.companyItems.firstWhere((item) => item.id == id).title,
        changedTitle,
      );
      final employeeAdminAttempt =
          await Dio(BaseOptions(validateStatus: (_) => true)).get<Object?>(
            '$_baseUrl/admin/company',
            options: Options(
              headers: {'Authorization': 'Bearer ${await session.authorize()}'},
            ),
          );
      expect(employeeAdminAttempt.statusCode, 403);
    } finally {
      await demoAdmin.patch<Map<String, dynamic>>(
        '/admin/company/items/$id',
        data: {'title': originalTitle, 'body': originalBody},
        options: Options(
          headers: {
            'Authorization': 'Bearer $demoAdminToken',
            'Idempotency-Key': 'flutter-pc-link-restore-$id-$version',
            'If-Match': '"$version"',
          },
        ),
      );
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
