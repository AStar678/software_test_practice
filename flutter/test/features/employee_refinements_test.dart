import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/errors/app_error.dart';
import 'package:pandora_employee/core/navigation/tab_refresh.dart';
import 'package:pandora_employee/core/net/http_error_mapper.dart';
import 'package:pandora_employee/core/widgets/common.dart';
import 'package:pandora_employee/core/widgets/fading_name_text.dart';
import 'package:pandora_employee/features/daily_items/domain/daily_item.dart';
import 'package:pandora_employee/features/tasks/presentation/task_form_page.dart';
import 'package:pandora_employee/features/tasks/presentation/task_providers.dart';

import '../support/test_harness.dart';

void main() {
  test('410 TASK_DELETED is an identifiable deleted state', () {
    final error = mapHttpError(410, {
      'code': 'TASK_DELETED',
      'message': '任务已删除',
      'title': '旧任务',
    });
    expect(error.isDeleted, isTrue);
    expect(error.kind, ApiErrorKind.deleted);
    expect(userMessageFor(error), '任务已删除');
  });

  test('technical exception text never reaches the user', () {
    final error = ApiException(
      kind: ApiErrorKind.unknown,
      message: 'ApiException: SQL failed at startDate / tagIds',
    );
    expect(userMessageFor(error), isNot(contains('ApiException')));
    expect(userMessageFor(error), isNot(contains('startDate')));
    expect(userMessageFor(StateError('raw stack')), '操作未完成，请稍后重试');
  });

  test('fade prefix excludes the single faded grapheme', () {
    const layout = NameFadeLayout(
      truncated: true,
      height: 16,
      visibleEnd: 3,
      fadeText: 'C',
    );
    expect(layout.prefixOf('ABC'), 'AB');
  });

  test('daily item parses whole-day and timed modes', () {
    final whole = DailyItem.fromJson({
      'id': 'd1',
      'startDate': '2026-11-23',
      'endDate': '2026-11-23',
      'body': 'x',
      'status': 'open',
    });
    expect(whole.allDay, isTrue);
    expect(whole.startTime, isNull);
    expect(whole.modeLabel, '全天');

    final timed = DailyItem.fromJson({
      'id': 'd2',
      'startDate': '2026-11-23',
      'endDate': '2026-11-24',
      'body': 'x',
      'allDay': false,
      'startTime': '23:30',
      'endTime': '00:30',
      'status': 'overdue',
    });
    expect(timed.allDay, isFalse);
    expect(timed.modeLabel, '23:30 至 00:30');
    expect(timed.isOverdue, isTrue);
  });

  testWidgets('list ordinal renders a readable sequence number', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: ListOrdinal(3))),
    );
    expect(find.text('3'), findsOneWidget);
    expect(find.byType(ListOrdinal), findsOneWidget);
  });

  testWidgets('founder creates and selects a company tag inside the task form', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(420, 2600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final backend = FakeBackend();
    backend.on('GET', '/assignee-candidates', (_) => FakeResponse({
      'items': [
        {
          'id': 'u1',
          'displayName': '苏景昕',
          'departmentName': null,
          'teamName': null,
          'positionName': '创始人',
        },
      ],
      'empty': false,
    }));
    backend.on('POST', '/tasks/reviewer-preview', (_) => FakeResponse({
      'requiresApproval': false,
      'reviewerId': 'u1',
    }));
    backend.on('GET', '/tags', (_) => FakeResponse({'items': []}));
    backend.on('POST', '/tags', (_) => FakeResponse({
      'tagId': 'tag-new',
      'rowVersion': 1,
      'tag': {
        'id': 'tag-new',
        'name': '新标签',
        'color': '#F6D5D2',
        'border': '#C05B52',
        'deleted': false,
        'rowVersion': 1,
      },
    }));
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(id: 'u1', role: 'founder'),
      accountEpoch: () => 1,
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const TaskCreatePage()));
    await tester.pumpAndSettle();

    expect(find.text('新建公司标签'), findsOneWidget);
    await tester.tap(find.text('新建公司标签'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.descendant(
        of: find.byType(AlertDialog),
        matching: find.byType(TextField),
      ),
      '新标签',
    );
    await tester.tap(find.text('创建并选中'));
    await tester.pumpAndSettle();

    expect(backend.requestsFor('POST', '/tags'), hasLength(1));
    expect(backend.requestsFor('POST', '/tags').single.jsonBody['name'], '新标签');
    expect(find.text('新建公司标签'), findsOneWidget);
  });

  testWidgets('ordinary employee sees no inline tag creation', (tester) async {
    tester.view.physicalSize = const Size(420, 2600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final backend = FakeBackend();
    backend.on('GET', '/assignee-candidates', (_) => FakeResponse({
      'items': [
        {
          'id': 'u1',
          'displayName': '亚里士多德',
          'departmentName': '制作部',
          'teamName': '原画组',
          'positionName': '动画师',
        },
      ],
      'empty': false,
    }));
    backend.on('GET', '/tags', (_) => FakeResponse({'items': []}));
    backend.on('POST', '/tasks/reviewer-preview', (_) => FakeResponse({
      'requiresApproval': false,
      'reviewerId': 'u1',
    }));
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
      accountEpoch: () => 1,
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(container, const TaskCreatePage()));
    await tester.pumpAndSettle();

    expect(find.text('新建公司标签'), findsNothing);
  });

  test('tab refresh increments each entry independently, including repeats', () {
    final container = buildTestContainer(
      backend: FakeBackend(),
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    final notifier = container.read(tabRefreshProvider.notifier);
    expect(notifier.generation(AppTab.home), 0);
    notifier.bump(AppTab.home);
    notifier.bump(AppTab.home);
    notifier.bump(AppTab.logs);
    expect(notifier.generation(AppTab.home), 2);
    expect(notifier.generation(AppTab.logs), 1);
    expect(notifier.generation(AppTab.me), 0);
  });

  test('task delete sends DELETE with If-Match and keeps references intact', () async {
    final backend = FakeBackend();
    backend.on('DELETE', '/tasks/t1', (_) => FakeResponse({
      'taskId': 't1',
      'deleted': true,
      'rowVersion': 2,
      'message': '任务已删除',
    }));
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);

    await container
        .read(tasksApiProvider)
        .delete(id: 't1', rowVersion: 1, idempotencyKey: 'delete-key-0001');

    final request = backend.requestsFor('DELETE', '/tasks/t1').single;
    expect(request.headers['If-Match'], '"1"');
    expect(request.headers['Idempotency-Key'], 'delete-key-0001');
  });
}
