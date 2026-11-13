import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/providers.dart';
import 'package:pandora_employee/features/analytics/presentation/analytics_page.dart';
import 'package:pandora_employee/features/schedule/presentation/task_calendar_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/test_harness.dart';
import 'task_calendar_ui_test.dart' show calendarTask;

void main() {
  testWidgets('切换统计范围会丢弃旧报告，生成失败仍有提示', (tester) async {
    tester.view.physicalSize = const Size(390, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final oldReport = Completer<FakeResponse>();
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/analytics/task-summary',
      (request) => FakeResponse({
        'scopeLabel': request.query['scope'] == 'self' ? '本人' : '公司',
        'total': 1,
        'generatedAt': '2026-11-10T20:00:00Z',
      }),
    );
    backend.on('POST', '/ai-jobs', (request) {
      if (request.jsonBody['scopeType'] == 'auto') {
        return FakeResponse({'jobId': 'auto-report'});
      }
      return FakeResponse({
        'code': 'TEST_FAILURE',
        'message': '服务暂不可用',
      }, status: 503);
    });
    backend.on('GET', '/ai-jobs/auto-report', (_) => oldReport.future);
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(wrapWithScope(container, const AnalyticsPage()));
    await tester.pumpAndSettle();
    expect(find.text('公司 · 1 项'), findsOneWidget);
    expect(find.textContaining('2026-11-11 04:00'), findsOneWidget);

    await tester.tap(find.text('生成本地规则建议'));
    await tester.pumpAndSettle();
    expect(backend.requestsFor('GET', '/ai-jobs/auto-report'), hasLength(1));
    await tester.tap(find.text('仅本人'));
    await tester.pumpAndSettle();
    expect(find.text('本人 · 1 项'), findsOneWidget);
    expect(find.text('公司 · 1 项'), findsNothing);

    oldReport.complete(
      FakeResponse({
        'result': {'suggestionScopeLabel': '公司'},
      }),
    );
    await tester.pumpAndSettle();
    expect(find.text('规则建议 · 公司'), findsNothing);
    expect(
      container.read(operationKeysProvider).hasKey('analytics:auto'),
      isFalse,
    );

    await tester.tap(find.text('生成本地规则建议'));
    await tester.pumpAndSettle();
    expect(find.text('本人 · 1 项'), findsOneWidget);
    expect(find.text('生成建议失败'), findsOneWidget);
    expect(find.text('服务暂不可用'), findsOneWidget);
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
