import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/features/notifications/domain/notification_record.dart';
import 'package:pandora_employee/features/notifications/presentation/notifications_page.dart';
import 'package:pandora_employee/features/profile/presentation/profile_pages.dart';
import 'package:pandora_employee/features/tasks/presentation/task_table_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/test_harness.dart';
import 'task_table_ui_test.dart' show tableTask;

void main() {
  testWidgets('通知类型在读态上方；多条/单条/空/失败/加载/分页和模式的结果框体稳定', (tester) async {
    tester.view.physicalSize = const Size(320, 720);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final backend = FakeBackend();
    var count = 3;
    var fail = false;
    Completer<FakeResponse>? pending;
    FakeResponse response() => FakeResponse({
      'items': [
        for (var i = 0; i < count; i++)
          {
            'id': 'n$i',
            'title': '通知$i',
            'category': 'system',
            'unread': true,
            'summary': '真实通知内容',
            'createdAt': '2026-11-10T02:00:00Z',
          },
      ],
      'total': count + 1,
      'unreadCount': 9,
      'nextOffset': count > 1 ? count : null,
    });
    backend.on(
      'GET',
      '/notifications',
      (_) =>
          pending?.future ??
          (fail ? FakeResponse({'message': '读取失败'}, status: 503) : response()),
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
    final body = find.byKey(const ValueKey('notification-results'));
    final bounds = tester.getRect(body);
    void stable() => expect(tester.getRect(body), bounds);
    final types = find.byType(ChoiceChip);
    final read = find.byType(SegmentedButton<NotificationReadFilter>);
    expect(
      tester.getBottomLeft(types.first).dy,
      lessThan(tester.getTopLeft(read).dy),
    );
    Future<void> select(String label) async {
      await tester.tap(find.descendant(of: read, matching: find.text(label)));
      await tester.pumpAndSettle();
      stable();
    }

    await tester.tap(find.byTooltip('完整模式'));
    await tester.pumpAndSettle();
    stable();
    await tester.tap(find.text('加载更多'));
    await tester.pumpAndSettle();
    stable();
    count = 1;
    await select('未读');
    count = 0;
    await select('已读');
    expect(find.text('当前筛选条件下没有通知'), findsOneWidget);
    fail = true;
    await select('全部');
    expect(find.text('加载失败'), findsOneWidget);
    pending = Completer<FakeResponse>();
    await tester.tap(find.text('重试'));
    await tester.pump();
    await tester.pump();
    stable();
    expect(find.text('正在读取通知'), findsOneWidget);
    pending.complete(response());
    await tester.pumpAndSettle();
    stable();
    expect(backend.requests.where((r) => r.method != 'GET'), isEmpty);
    tester.view.physicalSize = const Size(390, 640);
    await tester.pumpAndSettle();
    expect(tester.getSize(body).height, greaterThan(200));
    expect(tester.takeException(), isNull);
  });

  testWidgets('本人和下属的入职日期/时长各一次，不显示asOf统计日期；缺值保留空态', (tester) async {
    final backend = FakeBackend();
    final person = <String, Object?>{
      'id': 'u1',
      'displayName': '员工',
      'role': 'employee',
      'profileVersion': 1,
      'hireDate': '2024-02-29',
      'tenure': {'years': 2, 'months': 8, 'days': 12, 'asOfDate': '2026-11-10'},
    };
    backend.on('GET', '/me/profile', (_) => FakeResponse(person, etag: '"1"'));
    backend.on(
      'GET',
      '/users/u2',
      (_) => FakeResponse({...person, 'id': 'u2'}),
    );
    backend.on(
      'GET',
      '/users/u3',
      (_) => FakeResponse({
        ...person,
        'id': 'u3',
        'hireDate': null,
        'tenure': null,
      }),
    );
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    for (final child in [
      const Scaffold(body: SelfProfileCard()),
      const ProfileDetailPage(personId: 'u2'),
    ]) {
      await tester.pumpWidget(wrapWithScope(container, child));
      await tester.pumpAndSettle();
      expect(find.text('入职日期'), findsOneWidget);
      expect(find.text('入职时长'), findsOneWidget);
      expect(find.text('2024-02-29'), findsOneWidget);
      expect(find.text('2 年 8 个月 12 天'), findsOneWidget);
      expect(find.textContaining('截至'), findsNothing);
      expect(find.text('统计日期'), findsNothing);
      expect(find.text('2026-11-10'), findsNothing);
    }
    await tester.pumpWidget(
      wrapWithScope(container, const ProfileDetailPage(personId: 'u3')),
    );
    await tester.pumpAndSettle();
    expect(find.text('入职日期未设置'), findsOneWidget);
    expect(find.text('入职时长未设置'), findsOneWidget);
  });

  testWidgets('表单置顶固定列和横滚列同蓝底，切列/刷新/取消后恢复斑马纹且不写日历置顶', (tester) async {
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final backend = FakeBackend();
    var pinned = true;
    backend.on(
      'GET',
      '/tasks/table',
      (_) => FakeResponse({
        'items': [
          {...tableTask(0), 'tablePinned': pinned, 'pinned': false},
          tableTask(1),
          tableTask(2),
        ],
        'total': 3,
      }),
    );
    backend.on('DELETE', '/tasks/t0/table-pin', (_) {
      pinned = false;
      return FakeResponse({'ok': true});
    });
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const TaskTablePage()));
    await tester.pumpAndSettle();
    List<Material> rows(String side) => tester
        .widgetList<Material>(
          find.descendant(
            of: find.byKey(ValueKey('task-table-$side-list')),
            matching: find.byType(Material),
          ),
        )
        .where((widget) => widget.color != null)
        .toList();
    void blue() {
      expect(rows('left').first.color, const Color(0xFFE8F1FC));
      expect(rows('right').first.color, rows('left').first.color);
      expect(rows('left')[1].color, isNot(rows('left')[2].color));
    }

    blue();
    await tester.drag(
      find.byKey(const ValueKey('task-table-body-scroll')),
      const Offset(-180, 0),
    );
    await tester.pumpAndSettle();
    blue();
    await tester.tap(find.text('概览'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('全部列').last);
    await tester.pumpAndSettle();
    blue();
    final horizontal = tester
        .widget<SingleChildScrollView>(
          find.byKey(const ValueKey('task-table-body-scroll')),
        )
        .controller!;
    horizontal.jumpTo(0);
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('取消表单置顶').first);
    await tester.pumpAndSettle();
    expect(rows('left').first.color, isNot(const Color(0xFFE8F1FC)));
    expect(rows('right').first.color, rows('left').first.color);
    expect(backend.requestsFor('DELETE', '/tasks/t0/table-pin'), hasLength(1));
    expect(backend.requests.where((r) => r.path.endsWith('/pin')), isEmpty);
  });
}
