import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:pandora_employee/core/company/company_date.dart';
import 'package:pandora_employee/core/router/read_context.dart';
import 'package:pandora_employee/features/analytics/presentation/analytics_providers.dart';
import 'package:pandora_employee/features/holidays/data/holidays_api.dart';
import 'package:pandora_employee/features/holidays/domain/holiday_calendar.dart';
import 'package:pandora_employee/features/holidays/presentation/holiday_providers.dart';
import 'package:pandora_employee/features/notifications/domain/notification_record.dart';
import 'package:pandora_employee/features/notifications/presentation/notifications_page.dart';
import 'package:pandora_employee/features/notifications/presentation/notifications_providers.dart';
import 'package:pandora_employee/features/schedule/domain/day_axis.dart';
import 'package:pandora_employee/features/schedule/presentation/task_calendar_page.dart';
import 'package:pandora_employee/features/tasks/domain/task_record.dart';
import 'package:pandora_employee/features/work_logs/presentation/work_logs_page.dart';
import 'package:pandora_employee/features/people/domain/report_person.dart';
import 'package:pandora_employee/features/profile/domain/avatar_processor.dart';
import 'package:pandora_employee/features/profile/presentation/profile_pages.dart';
import 'package:pandora_employee/features/profile/presentation/profile_providers.dart';

import '../support/test_harness.dart';

void main() {
  test('头像处理仅接受 PNG/JPG，并输出 256px 且满足 data URI 限制', () {
    final source = img.Image(width: 640, height: 320)
      ..clear(img.ColorRgb8(160, 80, 120));
    final png = Uint8List.fromList(img.encodePng(source));
    final value = const AvatarProcessor().process(png);
    expect(value, startsWith('data:image/jpeg;base64,'));
    expect(
      value.length,
      lessThanOrEqualTo(AvatarProcessor.maxDataUriCharacters),
    );
    final decoded = img.decodeJpg(base64Decode(value.split(',').last));
    expect(decoded?.width, AvatarProcessor.outputSize);
    expect(decoded?.height, AvatarProcessor.outputSize);
    expect(
      () => const AvatarProcessor().process(Uint8List.fromList([1, 2, 3])),
      throwsA(isA<AvatarException>()),
    );
  });

  test('资料 PATCH 使用资料自身 ETag 且只提交邮箱和头像', () async {
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/me/profile',
      (_) => FakeResponse({
        'id': 'u1',
        'displayName': '亚里士多德',
        'role': 'employee',
        'phone': '13800000004',
        'email': 'before@example.test',
        'profileVersion': 4,
        'hireDate': '2024-02-29',
        'tenure': {
          'years': 2,
          'months': 8,
          'days': 14,
          'asOfDate': '2026-11-12',
        },
      }, etag: '"4"'),
    );
    backend.on('PATCH', '/me/profile', (request) {
      expect(request.headers['If-Match'], '"4"');
      expect(request.headers['Idempotency-Key'], isNotEmpty);
      expect(request.jsonBody.keys, unorderedEquals(['email', 'avatar']));
      return FakeResponse({'id': 'u1', 'rowVersion': 5}, etag: '"5"');
    });
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    final api = container.read(profileApiProvider);
    final profile = await api.self();
    expect(profile.tenure?.label, '2 年 8 个月 14 天');
    await api.update(
      values: {'email': 'after@example.test', 'avatar': 'panda'},
      idempotencyKey: 'profile-test-key',
    );
  });

  testWidgets('本人资料在 320 宽度展示真实职务路径且不显示身份标签', (tester) async {
    tester.view.physicalSize = const Size(320, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/me/profile',
      (_) => FakeResponse({
        'id': 'u1',
        'displayName': '亚里士多德',
        'role': 'employee',
        'departmentName': '故事部',
        'teamName': '分镜组',
        'positionName': '动画师',
        'phone': '13800000004',
        'email': 'employee@example.test',
        'profileVersion': 1,
        'hireDate': null,
        'tenure': null,
      }, etag: '"1"'),
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      wrapWithScope(
        container,
        const Scaffold(body: SingleChildScrollView(child: SelfProfileCard())),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('故事部 ▸ 分镜组 ▸ 动画师'), findsOneWidget);
    expect(find.text('employee'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  test('真实下属树按 managerId 分层，摘要模型不含联系方式', () {
    const founder = 'founder';
    final people = [
      ReportPerson.fromJson({
        'id': 'd',
        'displayName': '部门负责人',
        'managerId': founder,
        'departmentName': '故事部',
      }),
      ReportPerson.fromJson({
        'id': 't',
        'displayName': '团队负责人',
        'managerId': 'd',
        'teamName': '分镜组',
      }),
      ReportPerson.fromJson({
        'id': 'e',
        'displayName': '员工',
        'managerId': 't',
        'positionName': '动画师',
      }),
    ];
    final tree = ReportTree(people);
    expect(tree.rootsFor(founder).single.id, 'd');
    expect(tree.childrenOf('d').single.id, 't');
    expect(tree.childrenOf('t').single.id, 'e');
  });

  test('通知六类型乘三读态均作为服务端组合条件发送，GET 不标读', () async {
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/notifications',
      (request) => FakeResponse({
        'items': [],
        'total': 0,
        'nextOffset': null,
        'unreadCount': 7,
      }),
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    final api = container.read(notificationsApiProvider);
    for (final read in NotificationReadFilter.values) {
      for (final category in NotificationCategory.values) {
        final page = await api.list(read: read, category: category, offset: 0);
        expect(page.unreadCount, 7);
      }
    }
    expect(backend.requests.length, 18);
    expect(
      backend.requests.every((request) => request.method == 'GET'),
      isTrue,
    );
    expect(
      backend.requests
          .map(
            (request) =>
                '${request.query['readStatus']}:${request.query['category']}',
          )
          .toSet()
          .length,
      18,
    );
  });

  test('通知详情、标读、隐藏、撤回和历史摘要使用互相独立的端点', () async {
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/notifications/n1',
      (_) => FakeResponse({
        'id': 'n1',
        'eventType': 'task.changed',
        'summary': '原消息',
        'createdAt': '2026-11-13T00:00:00Z',
        'rowVersion': 3,
        'category': 'other',
        'taskId': 't1',
        'requestId': 'r-old',
        'canReadRequest': true,
        'canOpenTask': true,
        'canWithdraw': true,
      }),
    );
    backend.on(
      'POST',
      '/notifications/n1/open',
      (_) => FakeResponse({
        'notificationId': 'n1',
        'rowVersion': 4,
        'unreadCount': 0,
      }),
    );
    backend.on(
      'PATCH',
      '/notifications/n1',
      (_) => FakeResponse({
        'notificationId': 'n1',
        'rowVersion': 5,
        'action': 'hide',
      }),
    );
    backend.on(
      'POST',
      '/notifications/n1/withdraw',
      (_) => FakeResponse({'eventId': 'e1', 'withdrawn': true, 'copies': 1}),
    );
    backend.on(
      'GET',
      '/notifications/n1/task',
      (_) => FakeResponse({
        'taskId': 't1',
        'title': '安全摘要',
        'description': '只读内容',
        'readonly': true,
        'historical': true,
        'accessRevoked': true,
      }),
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    final api = container.read(notificationsApiProvider);
    final detail = await api.detail('n1');
    expect(detail.requestId, 'r-old');
    expect(detail.canOpenTask, isTrue);
    await api.open(id: 'n1', idempotencyKey: 'open-key-1');
    await api.hide(id: 'n1', rowVersion: 3, idempotencyKey: 'hide-key-1');
    await api.withdrawEvent(
      id: 'n1',
      reason: '撤回',
      idempotencyKey: 'withdraw-key-1',
    );
    final history = await api.historicalTask('n1');
    expect(history.readonly, isTrue);
    expect(history.accessRevoked, isTrue);
    expect(
      backend
          .requestsFor('PATCH', '/notifications/n1')
          .single
          .headers['If-Match'],
      '3',
    );
    expect(
      backend.requests.map((request) => request.path),
      containsAll([
        '/notifications/n1/open',
        '/notifications/n1/withdraw',
        '/notifications/n1/task',
      ]),
    );
  });

  test('下属日轴强制关闭拖动，即使 DTO 带正常编辑资格', () {
    final task = TaskRecord.fromJson({
      'id': 't1',
      'title': '重叠身份任务',
      'published': true,
      'executionState': 'doing',
      'startAt': '2026-11-13T01:00:00Z',
      'dueAt': '2026-11-13T02:00:00Z',
      'canReschedule': true,
      'editableFields': ['startAt', 'dueAt'],
    });
    final layout = DayAxisLayout.compute(
      day: const CompanyDate(2026, 11, 13),
      tasks: [task],
      mode: DayAxisMode.vertical,
      allowDrag: false,
    );
    expect(layout.entries.single.canDrag, isFalse);
  });

  testWidgets('下属日程复用连续月历但不显示创建、表单和审核入口', (tester) async {
    final backend = FakeBackend();
    backend.onPattern(
      'GET',
      RegExp(r'^/tasks$'),
      (_) => FakeResponse({'items': [], 'nextCursor': null}),
    );
    backend.onPattern('GET', RegExp(r'^/calendar/holidays/\d{4}$'), (request) {
      final year = int.parse(request.path.split('/').last);
      return FakeResponse({
        'year': year,
        'region': 'CN',
        'status': 'missing',
        'days': [],
      });
    });
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(id: 'manager'),
    );
    addTearDown(container.dispose);
    const readContext = SubordinateReadContext(
      personId: 'employee',
      personName: '亚里士多德',
      chainOrigin: '/people',
    );
    await tester.pumpWidget(
      wrapWithScope(
        container,
        const TaskCalendarPage(
          assigneeId: 'employee',
          personName: '亚里士多德',
          readContext: readContext,
        ),
      ),
    );
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('亚里士多德的日程'), findsOneWidget);
    expect(find.byTooltip('新建任务'), findsNothing);
    expect(find.byTooltip('任务表单'), findsNothing);
    expect(find.byTooltip('我的申请与审核'), findsNothing);
    expect(
      backend
          .requestsFor('GET', '/tasks')
          .every((request) => request.query['assigneeId'] == 'employee'),
      isTrue,
    );
  });

  testWidgets('下属日志使用人员范围分页且无写日志入口', (tester) async {
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/work-logs',
      (request) => FakeResponse({'items': [], 'total': 0, 'nextOffset': null}),
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(id: 'manager'),
    );
    addTearDown(container.dispose);
    const readContext = SubordinateReadContext(
      personId: 'employee',
      personName: '亚里士多德',
      chainOrigin: '/people',
    );
    await tester.pumpWidget(
      wrapWithScope(
        container,
        const WorkLogsPage(
          authorId: 'employee',
          personName: '亚里士多德的日志',
          readContext: readContext,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('亚里士多德的日志'), findsOneWidget);
    expect(find.byTooltip('写日志'), findsNothing);
    final request = backend.requestsFor('GET', '/work-logs').single;
    expect(request.query['scope'], 'visible');
    expect(request.query['authorId'], 'employee');
  });

  testWidgets('320 宽度可访问六类型、三读态和单几何模式切换', (tester) async {
    tester.view.physicalSize = const Size(320, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/notifications',
      (_) => FakeResponse({
        'items': [],
        'total': 0,
        'nextOffset': null,
        'unreadCount': 7,
      }),
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      wrapWithScope(container, const NotificationsPage()),
    );
    await tester.pumpAndSettle();
    expect(find.text('全部'), findsWidgets);
    expect(find.text('未读'), findsOneWidget);
    expect(find.text('已读'), findsOneWidget);
    expect(find.text('需我审核'), findsOneWidget);
    expect(find.bySemanticsLabel('切换为完整通知模式'), findsOneWidget);
    expect(find.text('通知 · 未读 7'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  test('统计读取真实范围并生成声明为本地规则的建议', () async {
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/analytics/task-summary',
      (request) => FakeResponse({
        'total': 4,
        'todo': 1,
        'doing': 2,
        'done': 1,
        'frozen': 1,
        'pendingComplete': 1,
        'overdue': 1,
        'priority': {'urgent': 1, 'high': 1, 'medium': 1, 'low': 1},
        'scope': 'team',
        'scopeLabel': '本团队',
        'method': 'current_effective_tasks',
        'keywords': [
          {'word': '分镜', 'count': 3},
        ],
        'generatedAt': '2026-11-12T12:00:00Z',
      }),
    );
    backend.on(
      'POST',
      '/ai-jobs',
      (_) => FakeResponse({
        'jobId': 'j1',
        'status': 'completed',
        'mode': 'rule_based',
      }),
    );
    backend.on(
      'GET',
      '/ai-jobs/j1',
      (_) => FakeResponse({
        'result': {
          'mode': 'rule_based',
          'method': 'local_proportional_schedule_rules',
          'modelUsed': false,
          'statisticsScopeLabel': '本团队',
          'suggestionScopeLabel': '本人',
          'summary': {'total': 4, 'scope': 'team', 'scopeLabel': '本团队'},
          'suggestions': [
            {
              'rule': 'high_priority',
              'taskId': 't1',
              'title': '分镜',
              'message': '建议优先处理',
            },
          ],
          'generatedAt': '2026-11-12T12:00:00Z',
        },
      }),
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    final api = container.read(analyticsApiProvider);
    final summary = await api.summary(scope: 'auto');
    expect(summary.scopeLabel, '本团队');
    expect(summary.priority['urgent'], 1);
    final jobId = await api.createReport(
      scope: 'auto',
      idempotencyKey: 'analytics-test-key',
    );
    final report = await api.report(jobId);
    expect(report.modelUsed, isFalse);
    expect(report.suggestions.single.taskId, 't1');
  });

  test('节假日按年缓存并区分 ready、stale、missing', () async {
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/calendar/holidays/2026',
      (_) => FakeResponse({
        'year': 2026,
        'region': 'CN',
        'status': 'ready',
        'source': 'project-cache',
        'updatedAt': '2026-01-01T00:00:00Z',
        'days': [
          {'date': '2026-10-01', 'name': '国庆节', 'isOffDay': true},
          {'date': '2026-10-10', 'name': '调休', 'isOffDay': false},
        ],
      }),
    );
    backend.on(
      'GET',
      '/calendar/holidays/2027',
      (_) => FakeResponse({
        'year': 2027,
        'region': 'CN',
        'status': 'missing',
        'source': 'project-cache',
        'days': [],
        'reason': '尚未公布',
      }),
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    final repository = HolidayRepository(container.read(holidaysApiProvider));
    final ready = await repository.load(2026);
    expect(ready.status, HolidayCacheStatus.ready);
    expect(ready.byDate['2026-10-01']?.isOffDay, isTrue);
    expect(ready.byDate['2026-10-10']?.isOffDay, isFalse);
    await repository.load(2026);
    expect(backend.requestsFor('GET', '/calendar/holidays/2026').length, 1);
    final missing = await repository.load(2027);
    expect(missing.status, HolidayCacheStatus.missing);
    expect(missing.days, isEmpty);
  });
}
