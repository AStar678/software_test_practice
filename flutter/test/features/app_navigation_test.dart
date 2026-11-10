import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/app.dart';
import 'package:pandora_employee/core/company/workspace_clock.dart';
import 'package:pandora_employee/core/config/app_config.dart';
import 'package:pandora_employee/core/net/api_client.dart';
import 'package:pandora_employee/core/net/version_registry.dart';
import 'package:pandora_employee/core/providers.dart';
import 'package:pandora_employee/core/session/credential_store.dart';
import 'package:pandora_employee/core/session/session_manager.dart';

import '../support/test_harness.dart';

void main() {
  testWidgets('五分支外壳、首页三模块、看板清单与任务详情逐层返回', (tester) async {
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final backend = FakeBackend();
    backend.on('GET', '/home', (request) async => FakeResponse({
          'companyItems': [
            for (var index = 1; index <= 4; index++)
              {
                'id': 'c$index',
                'kind': 'company',
                'title': '公司事件 $index',
                'body': '事件内容 $index',
                'sortOrder': index,
                'rowVersion': 1,
              },
          ],
          'assignedTasks': [
            for (var index = 1; index <= 4; index++)
              {
                'taskId': 't$index',
                'title': '个人任务 $index',
                'priority': 'urgent',
                'assignedAt': '2026-11-10T02:0$index:00Z',
                'assignedSource': 'approval',
              },
          ],
          'businessDate': '2026-11-10',
        }));
    backend.on('GET', '/daily-items', (request) async => FakeResponse({
          'items': [],
          'total': 0,
          'nextOffset': null,
          'businessDate': '2026-11-10',
          'organizationTimeZone': 'Asia/Shanghai',
        }));
    backend.on('GET', '/tasks/t1', (request) async => FakeResponse({
          'id': 't1',
          'taskId': 't1',
          'title': '个人任务 1',
          'description': '任务说明',
          'priority': 'urgent',
          'allDay': false,
          'startAt': '2026-11-10T02:00:00Z',
          'dueAt': '2026-11-11T10:00:00Z',
          'executionState': 'doing',
          'status': 'applied',
          'assigneeIds': ['u1'],
          'rowVersion': 3,
          'published': true,
          'canReschedule': true,
          'canPin': true,
          'canTablePin': true,
          'editableFields': ['startAt', 'dueAt'],
          'participants': [
            {'id': 'u1', 'displayName': '亚里士多德'},
          ],
          'originalCreatorId': 'u1',
          'businessOwnerId': 'u1',
          'createdAt': '2026-11-09T02:00:00Z',
          'route': {'reasonText': '按直属上级审核', 'reviewerAvailable': true},
        }, etag: '"3"'));

    final clock = WorkspaceClock(now: () => DateTime.utc(2026, 11, 10, 4));
    final session = SessionManager(
      api: FakeAuthGateway(employeeUser()),
      store: MemoryCredentialStore(),
      clock: clock,
    );
    await session.login(phone: '13800000004', password: 'Demo@123456');

    final dio = Dio(
      BaseOptions(validateStatus: (status) => status != null && status < 400, contentType: 'application/json'),
    )..httpClientAdapter = backend;
    final client = ApiClient(
      config: const AppConfig(apiBaseUrl: 'https://test.local/api/v1', isDebug: true),
      session: FakeGateway(),
      versions: VersionRegistry(),
      dio: dio,
      clock: () => DateTime.utc(2026, 11, 10, 4),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appConfigProvider.overrideWithValue(
            const AppConfig(apiBaseUrl: 'https://test.local/api/v1', isDebug: true),
          ),
          workspaceClockProvider.overrideWithValue(clock),
          sessionManagerProvider.overrideWithValue(session),
          apiClientProvider.overrideWithValue(client),
        ],
        child: const PandoraApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('首页'), findsWidgets);
    expect(find.text('事件纪'), findsOneWidget);
    expect(find.text('任务看板'), findsOneWidget);
    expect(find.text('每日事项'), findsOneWidget);
    expect(find.text('公司事件 1'), findsOneWidget);
    expect(find.text('公司事件 4'), findsNothing, reason: '卡片只保留约三条预览，其余进入完整清单');
    expect(find.text('个人任务 4'), findsNothing);

    await tester.tap(find.text('任务看板'));
    await tester.pumpAndSettle();
    expect(find.text('个人任务 4'), findsOneWidget, reason: '完整清单展示看板全部十项以内的条目');

    await tester.tap(find.text('个人任务 1'));
    await tester.pumpAndSettle();
    expect(find.text('任务详情'), findsOneWidget);
    expect(find.text('个人任务 1'), findsWidgets);

    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.text('个人任务 4'), findsOneWidget, reason: '返回后恢复完整清单');

    await tester.tap(find.byIcon(Icons.arrow_back));
    await tester.pumpAndSettle();
    expect(find.text('事件纪'), findsOneWidget, reason: '逐层返回首页三模块');
  });
}
