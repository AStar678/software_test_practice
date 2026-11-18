import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/features/analytics/presentation/analytics_page.dart';
import 'package:pandora_employee/features/schedule/presentation/task_calendar_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/test_harness.dart';
import 'task_calendar_ui_test.dart' show calendarTask;

void main() {
  testWidgets('统计按Web自动生成且刷新丢弃迟到报告，失败可重试', (tester) async {
    tester.view.physicalSize = const Size(390, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final oldReport = Completer<FakeResponse>();
    final backend = FakeBackend();
    backend.on('GET', '/analytics/task-summary', (request) {
      expectSync(request.query['scope'], 'auto');
      return FakeResponse({
        'scopeLabel': '公司',
        'total': 1,
        'generatedAt': '2026-11-10T20:00:00Z',
      });
    });
    var reports = 0;
    backend.on('POST', '/ai-jobs', (request) {
      expectSync(request.jsonBody, {'scopeType': 'auto'});
      reports++;
      if (reports == 3) return FakeResponse({'message': '服务暂不可用'}, status: 503);
      return FakeResponse({'jobId': 'report-$reports'});
    });
    backend.on('GET', '/ai-jobs/report-1', (_) => oldReport.future);
    backend.on(
      'GET',
      '/ai-jobs/report-2',
      (_) => FakeResponse({
        'result': {
          'suggestionScopeLabel': '公司',
          'summary': {
            'scopeLabel': '公司',
            'total': 2,
            'generatedAt': '2026-11-10T20:00:00Z',
          },
        },
      }),
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const AnalyticsPage()));
    await tester.pumpAndSettle();
    expect(reports, 1, reason: '进入页面即自动生成规则建议');
    expect(find.text('仅本人'), findsNothing);
    expect(find.text('公司 · 1 项'), findsOneWidget);
    expect(find.textContaining('current_effective_tasks'), findsNothing);
    expect(find.textContaining('2026-11-11 04:00'), findsOneWidget);

    final refresh = tester.widget<RefreshIndicator>(
      find.byType(RefreshIndicator),
    );
    unawaited(refresh.onRefresh());
    await tester.pumpAndSettle();
    expect(find.text('公司 · 2 项'), findsOneWidget);
    oldReport.complete(
      FakeResponse({
        'result': {
          'suggestionScopeLabel': '旧范围',
          'summary': {'scopeLabel': '旧范围', 'total': 999},
        },
      }),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('旧范围'), findsNothing);
    expect(find.text('公司 · 2 项'), findsOneWidget);
    final writes = backend.requestsFor('POST', '/ai-jobs');
    expect(
      writes.first.headers['Idempotency-Key'],
      isNot(writes.last.headers['Idempotency-Key']),
    );

    await tester.ensureVisible(find.text('刷新并重算'));
    await tester.tap(find.text('刷新并重算'));
    await tester.pumpAndSettle();
    expect(find.text('生成建议失败'), findsOneWidget);
    expect(find.text('服务暂不可用'), findsOneWidget);
  });

  testWidgets('词云按频次呈现，冲突建议保留每个来源任务，授权变化清空旧统计且不循环重试', (tester) async {
    tester.view.physicalSize = const Size(390, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final backend = FakeBackend();
    final summary = {
      'scopeLabel': '团队',
      'total': 2,
      'keywords': [
        {'word': '高频词', 'count': 8},
        {'word': '低频词', 'count': 1},
      ],
    };
    backend.on('GET', '/analytics/task-summary', (_) => FakeResponse(summary));
    backend.on(
      'POST',
      '/ai-jobs',
      (_) => FakeResponse({'jobId': 'scope-report'}),
    );
    var scopeChanged = false;
    backend.on(
      'GET',
      '/ai-jobs/scope-report',
      (_) => scopeChanged
          ? FakeResponse({
              'code': 'ANALYSIS_SCOPE_CHANGED',
              'message': '组织范围已变化，请刷新',
            }, status: 409)
          : FakeResponse({
              'result': {
                'summary': summary,
                'suggestionScopeLabel': '本人',
                'suggestions': [
                  {
                    'rule': 'schedule_conflict',
                    'title': '排期重叠',
                    'message': '两项任务时间重叠',
                    'sourceTaskIds': ['task-a', 'task-b', 'task-a'],
                  },
                ],
              },
            }),
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const AnalyticsPage()));
    await tester.pumpAndSettle();
    expect(
      tester.widget<Text>(find.text('高频词')).style!.fontSize,
      greaterThan(tester.widget<Text>(find.text('低频词')).style!.fontSize!),
    );
    await tester.ensureVisible(find.text('排期重叠'));
    expect(find.text('查看相关任务 1'), findsOneWidget);
    expect(find.text('查看相关任务 2'), findsOneWidget);
    expect(find.text('查看相关任务 3'), findsNothing);
    scopeChanged = true;
    await tester.ensureVisible(find.text('刷新并重算'));
    await tester.tap(find.text('刷新并重算'));
    await tester.pumpAndSettle();
    expect(find.text('团队 · 2 项'), findsNothing);
    expect(find.text('排期重叠'), findsNothing);
    expect(find.text('组织范围已变化，请刷新'), findsOneWidget);
    expect(backend.requestsFor('POST', '/ai-jobs'), hasLength(2));
    await tester.pump(const Duration(seconds: 10));
    expect(backend.requestsFor('POST', '/ai-jobs'), hasLength(2));
    expect(tester.takeException(), isNull);
  });

  testWidgets('本人日历先显示任务，节假日请求失败后仍可查看', (tester) async {
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final holidays = Completer<FakeResponse>();
    final backend = FakeBackend();
    backend.onPattern(
      'GET',
      RegExp(r'^/calendar/holidays/\d+$'),
      (_) => holidays.future,
    );
    backend.on(
      'GET',
      '/tasks',
      (_) => FakeResponse({
        'items': [
          calendarTask(
            id: 'holiday-independent',
            title: '日历测试任务',
            allDay: true,
            startDate: '2026-11-10',
            dueDate: '2026-11-10',
          ),
        ],
        'nextCursor': null,
      }),
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(wrapWithScope(container, const TaskCalendarPage()));
    await tester.pumpAndSettle();
    expect(find.text('日历测试任务').hitTestable(), findsWidgets);
    expect(backend.requestsFor('GET', '/calendar/holidays/2026'), hasLength(1));

    holidays.complete(FakeResponse({'message': '暂不可用'}, status: 503));
    await tester.pumpAndSettle();
    expect(find.text('节假日暂不可用'), findsWidgets);
    expect(find.text('日历测试任务').hitTestable(), findsWidgets);
    expect(tester.takeException(), isNull);
  });
}
