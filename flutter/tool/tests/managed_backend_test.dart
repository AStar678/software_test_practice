import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:pandora_employee/core/company/workspace_clock.dart';
import 'package:pandora_employee/core/config/app_config.dart';
import 'package:pandora_employee/core/net/api_client.dart';
import 'package:pandora_employee/core/net/operation_keys.dart';
import 'package:pandora_employee/core/net/version_registry.dart';
import 'package:pandora_employee/core/session/credential_store.dart';
import 'package:pandora_employee/core/session/session_manager.dart';
import 'package:pandora_employee/features/approvals/data/approvals_api.dart';
import 'package:pandora_employee/features/auth/data/auth_api.dart';
import 'package:pandora_employee/features/profile/data/profile_api.dart';
import 'package:pandora_employee/features/profile/domain/avatar_processor.dart';
import 'package:pandora_employee/features/tasks/data/tasks_api.dart';

// Host test, launched only by tool/check_managed_backend.py with a disposable DB.
void main() {
  late Map<String, dynamic> fixture;
  late String password;
  late Dio admin;
  final actors = <String, _Actor>{};
  var sequence = 0;
  String key() => 'flutter-managed-${sequence++}';
  String id(String who) => fixture['identities'][who]['id'] as String;
  Future<_Actor> actor(String who) async {
    if (actors[who] case final existing?) return existing;
    final value = _Actor(fixture['base'] as String);
    await value.session.login(
      phone: fixture['identities'][who]['identifier'] as String,
      password: password,
    );
    return actors[who] = value;
  }

  Future<Map<String, dynamic>> manage(
    String method,
    String path, {
    Object? body,
    int? version,
  }) async {
    final result = await admin.request<Map<String, dynamic>>(
      path,
      data: body,
      options: Options(
        method: method,
        headers: {
          'Idempotency-Key': key(),
          if (version != null) 'If-Match': '"$version"',
        },
      ),
    );
    return result.data!;
  }

  Future<Map<String, dynamic>> plan() =>
      manage('GET', '/admin/organization-plans');
  Map<String, Object?> planBody(Map<String, dynamic> draft) => {
    for (final field in [
      'departments',
      'teams',
      'placements',
      'expectedEmployees',
    ])
      field: draft[field],
    'reason': 'Flutter isolated course acceptance',
  };
  Future<void> decide(String who, String request, String decision) async {
    final api = (await actor(who)).approvals;
    await api.detail(request);
    await api.decide(
      requestId: request,
      decision: decision,
      comment: 'Isolated acceptance',
      idempotencyKey: key(),
    );
  }

  Map<String, Object?> form(List<String> owners) => {
    'title': 'Flutter isolated lifecycle ${sequence++}',
    'description': 'Owned disposable fixture',
    'allDay': false,
    'priority': 'medium',
    'assigneeIds': owners.map(id).toList(),
    'startAt': DateTime.now().toUtc().toIso8601String(),
    'dueAt': DateTime.now()
        .toUtc()
        .add(const Duration(days: 3))
        .toIso8601String(),
  };

  setUpAll(() async {
    fixture = jsonDecode(
      File(Platform.environment['PANDORA_CLIENT_FIXTURE']!).readAsStringSync(),
    ) as Map<String, dynamic>;
    password = Platform.environment['PANDORA_FIXTURE_PASSWORD']!;
    admin = Dio(BaseOptions(baseUrl: fixture['base'] as String));
    final login = await admin.post<Map<String, dynamic>>(
      '/auth/sessions',
      data: {
        'accountType': 'admin',
        'accountName': fixture['identities']['admin']['identifier'],
        'password': password,
      },
    );
    admin.options.headers['Authorization'] = 'Bearer ${login.data!['token']}';
  });
  tearDownAll(() {
    for (final value in actors.values) {
      value.session.dispose();
    }
    admin.close();
  });

  test('J08/J12 四层实际申请人预览、保存审核人和审批发布一致', () async {
    for (final pair in [
      ('founder', null),
      ('alpha-head', 'founder'),
      ('alpha-one-head', 'alpha-head'),
      ('alpha-one-employee', 'alpha-one-head'),
    ]) {
      final user = await actor(pair.$1);
      final preview = await user.tasks.preview({
        'operation': 'create',
        'assigneeIds': [id('alpha-one-employee')],
      }, OperationKeys());
      expect(preview.requiresApproval, pair.$2 != null);
      if (pair.$2 != null) expect(preview.reviewerId, id(pair.$2!));
      final created = await user.tasks.create(
        payload: form(['alpha-one-employee']),
        idempotencyKey: key(),
      );
      final request = await user.approvals.detail(created.requestId!);
      if (pair.$2 != null) {
        expect(request.currentReviewerId, id(pair.$2!));
        expect((await user.tasks.detail(created.taskId)).published, isFalse);
        await decide(pair.$2!, created.requestId!, 'approve');
      }
      expect((await user.tasks.detail(created.taskId)).published, isTrue);
    }
  });

  test('J10 父任务搜索、深层循环拒绝、独立完成及显式清空', () async {
    final founder = await actor('founder');
    Future<String> create(String title, {String? parent}) async {
      final result = await founder.tasks.create(
        payload: {
          ...form(['founder']),
          'title': title,
          'parentTaskId': ?parent,
        },
        idempotencyKey: key(),
      );
      return result.taskId;
    }

    final root = await create('Flutter parent root');
    final child = await create('Flutter parent child', parent: root);
    final leaf = await create('Flutter parent leaf', parent: child);
    expect(
      (await founder.tasks.searchParentTasks('Flutter parent'))
          .map((task) => task.id),
      containsAll([root, child, leaf]),
    );
    await founder.tasks.detail(root);
    await expectLater(
      founder.tasks.change(
        id: root,
        command: 'change',
        payload: {'parentTaskId': leaf, 'reason': 'Reject deep cycle'},
        idempotencyKey: key(),
      ),
      throwsA(anything),
    );
    expect((await founder.tasks.detail(root)).parentTaskId, isNull);
    await founder.tasks.detail(leaf);
    await founder.tasks.change(
      id: leaf,
      command: 'complete',
      payload: {'completionNote': 'Complete child independently'},
      idempotencyKey: key(),
    );
    expect((await founder.tasks.detail(leaf)).executionState, 'done');
    expect((await founder.tasks.detail(child)).executionState, 'todo');
    await founder.tasks.change(
      id: child,
      command: 'change',
      payload: {'description': 'Preserve omitted parent', 'reason': 'Preserve'},
      idempotencyKey: key(),
    );
    expect((await founder.tasks.detail(child)).parentTaskId, root);
    await founder.tasks.change(
      id: child,
      command: 'change',
      payload: {'parentTaskId': null, 'reason': 'Clear parent'},
      idempotencyKey: key(),
    );
    expect((await founder.tasks.detail(child)).parentTaskId, isNull);
  });

  test('J25/J28 管理资料、转组改派、旧上级失权及重置密码回读', () async {
    final employee = await actor('alpha-one-employee');
    final before = await manage(
      'GET',
      '/admin/employees/${id('alpha-one-employee')}',
    );
    await manage(
      'PATCH',
      '/admin/employees/${id('alpha-one-employee')}',
      version: before['rowVersion'] as int,
      body: {'hireDate': '2024-02-29'},
    );
    expect((await employee.profile.self()).hireDate, '2024-02-29');
    final pending = await employee.tasks.create(
      payload: form(['alpha-one-employee']),
      idempotencyKey: key(),
    );
    final oldManager = await actor('alpha-one-head');
    await oldManager.approvals.detail(pending.requestId!);
    final draft = await plan();
    final body = planBody(draft);
    final placement = (body['placements'] as List).cast<Map>().firstWhere(
      (r) => r['employeeId'] == id('alpha-one-employee'),
    );
    placement['departmentId'] = 'fixture-company-beta';
    placement['teamId'] = 'fixture-company-beta-one';
    await manage(
      'POST',
      '/admin/organization-plans',
      body: body,
      version: draft['rowVersion'] as int,
    );
    expect(
      (await employee.approvals.detail(pending.requestId!)).currentReviewerId,
      id('beta-one-head'),
    );
    await expectLater(
      oldManager.profile.person(id('alpha-one-employee')),
      throwsA(anything),
    );
    await expectLater(
      oldManager.approvals.decide(
        requestId: pending.requestId!,
        decision: 'approve',
        idempotencyKey: key(),
      ),
      throwsA(anything),
    );
    await decide('beta-one-head', pending.requestId!, 'approve');
    await employee.session.revalidateOnResume();
    expect(employee.session.state.user!.teamId, 'fixture-company-beta-one');
    final reset = await manage(
      'POST',
      '/admin/employees/${id('alpha-one-employee')}/password-reset',
      body: {},
    );
    await employee.session.revalidateOnResume();
    expect(employee.session.state.phase, SessionPhase.expired);
    final initial = reset['initialPassword'] as String;
    await employee.session.login(
      phone:
          fixture['identities']['alpha-one-employee']['identifier'] as String,
      password: initial,
    );
    expect(employee.session.state.phase, SessionPhase.restricted);
    await expectLater(employee.tasks.listTasks(), throwsA(anything));
    await employee.session.changePassword(
      currentPassword: initial,
      newPassword: 'CourseChanged@12345',
    );
    await employee.session.login(
      phone:
          fixture['identities']['alpha-one-employee']['identifier'] as String,
      password: 'CourseChanged@12345',
    );
    expect(employee.session.state.phase, SessionPhase.authenticated);
  });

  test('J11/J28 停用原责任人并接管后，Flutter重开原子替换有效负责人和排期', () async {
    final old = await actor('alpha-two-employee');
    final created = await old.tasks.create(
      payload: form(['alpha-two-employee']),
      idempotencyKey: key(),
    );
    await decide('alpha-two-head', created.requestId!, 'approve');
    final original = await old.tasks.detail(created.taskId);
    final completion = await old.tasks.change(
      id: created.taskId,
      command: 'complete',
      payload: {'completionNote': 'Before departure'},
      idempotencyKey: key(),
    );
    await decide('alpha-two-head', completion.requestId!, 'approve');
    final inventory = await manage(
      'GET',
      '/admin/employees/${id('alpha-two-employee')}/responsibilities',
    );
    final task = (inventory['businessTasks'] as List).cast<Map>().firstWhere(
      (r) => r['id'] == created.taskId,
    );
    final draft = await plan();
    final body = planBody(draft);
    final person = (draft['expectedEmployees'] as List).cast<Map>().firstWhere(
      (r) => r['id'] == id('alpha-two-employee'),
    );
    (body['placements'] as List).removeWhere(
      (r) => r['employeeId'] == id('alpha-two-employee'),
    );
    body['deactivateEmployees'] = [
      {
        'employeeId': id('alpha-two-employee'),
        'rowVersion': person['rowVersion'],
        'reason': 'Course fixture departure',
      },
    ];
    body['businessTransfers'] = [
      {
        'taskId': created.taskId,
        'taskVersion': task['rowVersion'],
        'ownerVersion': task['ownerVersion'],
        'previousEmployeeId': id('alpha-two-employee'),
        'nextEmployeeId': id('beta-one-employee'),
        'reason': 'Course fixture takeover',
      },
    ];
    await manage(
      'POST',
      '/admin/organization-plans',
      body: body,
      version: draft['rowVersion'] as int,
    );
    await old.session.revalidateOnResume();
    expect(old.session.state.phase, SessionPhase.expired);
    final receiver = await actor('beta-one-employee');
    final done = await receiver.tasks.detail(created.taskId);
    expect(done.executionState, 'done');
    final owners = [id('beta-two-employee'), id('alpha-one-employee')];
    final start = DateTime.now().toUtc().add(const Duration(days: 1));
    final reopen = await receiver.tasks.reopen(
      id: created.taskId,
      startAt: start,
      dueAt: start.add(const Duration(days: 1)),
      assigneeIds: owners,
      reason: 'Replace inactive owner',
      idempotencyKey: key(),
    );
    expect((await receiver.tasks.detail(created.taskId)).assigneeIds, [
      id('alpha-two-employee'),
    ]);
    await decide('beta-one-head', reopen.requestId!, 'reject');
    expect(
      (await receiver.tasks.detail(created.taskId)).executionState,
      'done',
    );
    final retry = await receiver.tasks.reopen(
      id: created.taskId,
      startAt: start,
      dueAt: start.add(const Duration(days: 1)),
      assigneeIds: owners,
      reason: 'New accepted round',
      idempotencyKey: key(),
    );
    await decide('beta-one-head', retry.requestId!, 'approve');
    final after = await receiver.tasks.detail(created.taskId);
    expect(after.assigneeIds, owners);
    expect(after.executionState, 'doing');
    expect(after.originalCreatorId, original.originalCreatorId);
    expect(after.executionRound, 2);
    expect(after.startAt, start);
  });

  test('J25/J30 Flutter处理头像经真实资料接口保存，非法尺寸拒绝且原值不丢', () async {
    final founder = await actor('founder');
    final avatar = const AvatarProcessor().process(
      Uint8List.fromList(img.encodePng(img.Image(width: 700, height: 400))),
    );
    await founder.profile.selfWithVersion();
    await founder.profile.update(
      values: {'avatar': avatar},
      idempotencyKey: key(),
    );
    expect((await founder.profile.self()).avatar, avatar);
    final oversized =
        'data:image/png;base64,${base64Encode(img.encodePng(img.Image(width: 513, height: 513)))}';
    await expectLater(
      founder.profile.update(
        values: {'avatar': oversized, 'email': 'must-not-save@example.test'},
        idempotencyKey: key(),
      ),
      throwsA(anything),
    );
    final after = await founder.profile.self();
    expect(after.avatar, avatar);
    expect(after.email, isNot('must-not-save@example.test'));
    await manage('POST', '/admin/worker/run-once', body: {});
  });
}

class _Actor {
  _Actor(String base) {
    session = SessionManager(
      api: AuthApi(dio: Dio(), baseUrl: base),
      store: MemoryCredentialStore(),
      clock: WorkspaceClock(),
    );
    client = ApiClient(
      config: AppConfig(apiBaseUrl: base, isDebug: true),
      session: session,
      versions: VersionRegistry(),
    );
    tasks = TasksApi(client: client);
    approvals = ApprovalsApi(client: client);
    profile = ProfileApi(client: client);
  }
  late SessionManager session;
  late ApiClient client;
  late TasksApi tasks;
  late ApprovalsApi approvals;
  late ProfileApi profile;
}
