import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/company/company_date.dart';
import 'package:pandora_employee/features/auth/presentation/login_page.dart';
import 'package:pandora_employee/features/daily_items/presentation/daily_items_day_page.dart';
import 'package:pandora_employee/features/profile/presentation/profile_pages.dart';

import '../support/test_harness.dart';

void main() {
  testWidgets('每日事项当天页标题只显示日期', (tester) async {
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/daily-items',
      (_) => FakeResponse({
        'items': [],
        'total': 0,
        'nextOffset': null,
        'businessDate': '2026-11-10',
        'organizationTimeZone': 'Asia/Shanghai',
      }),
    );
    final container = buildTestContainer(backend: backend, user: employeeUser());
    addTearDown(container.dispose);
    await tester.pumpWidget(
      wrapWithScope(
        container,
        DailyItemsDayPage(date: CompanyDate(2026, 11, 10)),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('11月10日'), findsOneWidget);
    expect(find.textContaining('每日事项'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  for (final manager in <String?>[null, '柏拉图']) {
    testWidgets('本人资料${manager == null ? '无直属上级时隐藏该行' : '有直属上级时显示该行'}', (
      tester,
    ) async {
      final backend = FakeBackend();
      backend.on(
        'GET',
        '/me/profile',
        (_) => FakeResponse({
          'id': 'u1',
          'displayName': '亚里士多德',
          'phone': '13800000004',
          'email': 'employee@example.test',
          'managerName': manager,
          'hireDate': '2024-02-29',
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
      expect(find.text('亚里士多德'), findsWidgets);
      expect(find.text('直属上级'), manager == null ? findsNothing : findsOneWidget);
      if (manager != null) expect(find.text(manager), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('登录页不再显示客户端说明文案', (tester) async {
    final backend = FakeBackend();
    final container = buildTestContainer(backend: backend, user: employeeUser());
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const LoginPage()));
    await tester.pumpAndSettle();
    expect(find.text('潘多拉'), findsWidgets);
    expect(find.text('员工工作客户端'), findsNothing);
  });
}
