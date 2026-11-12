import '../../../core/net/api_client.dart';
import '../../../core/net/version_registry.dart';
import '../../../core/net/operation_keys.dart';
import '../../people/domain/person_summary.dart';
import '../domain/task_record.dart';

class TaskCursorPage {
  const TaskCursorPage({required this.items, this.nextCursor});

  final List<TaskRecord> items;
  final String? nextCursor;

  factory TaskCursorPage.fromJson(Map<String, Object?> json) => TaskCursorPage(
        items: [
          for (final raw in asJsonList(json['items']))
            if (raw is Map) TaskRecord.fromJson(Map<String, Object?>.from(raw)),
        ],
        nextCursor: json['nextCursor']?.toString(),
      );
}

class TaskTablePageResult {
  const TaskTablePageResult({required this.items, required this.total, this.nextOffset});

  final List<TaskRecord> items;
  final int total;
  final int? nextOffset;

  factory TaskTablePageResult.fromJson(Map<String, Object?> json) => TaskTablePageResult(
        items: [
          for (final raw in asJsonList(json['items']))
            if (raw is Map) TaskRecord.fromJson(Map<String, Object?>.from(raw)),
        ],
        total: (json['total'] as num?)?.toInt() ?? 0,
        nextOffset: (json['nextOffset'] as num?)?.toInt(),
      );
}

class TaskTagCatalog {
  const TaskTagCatalog({required this.items});

  final List<TaskTag> items;

  factory TaskTagCatalog.fromJson(Object? json) {
    final map = asJsonMap(json);
    return TaskTagCatalog(
      items: [
        for (final raw in asJsonList(map['items']))
          if (raw is Map) TaskTag.fromJson(Map<String, Object?>.from(raw)),
      ],
    );
  }
}

class ApprovalDecisionResult {
  const ApprovalDecisionResult({
    required this.taskId,
    required this.requestId,
    required this.status,
    this.requestStatus,
    this.rowVersion,
    this.message,
    this.deadlineExpired = false,
    this.exemptionReason,
  });

  final String taskId;
  final String requestId;
  final String status;
  final String? requestStatus;
  final int? rowVersion;
  final String? message;
  final bool deadlineExpired;
  final String? exemptionReason;

  bool get appliedDirectly => status == 'direct';

  factory ApprovalDecisionResult.fromJson(Map<String, Object?> json) => ApprovalDecisionResult(
        taskId: json['taskId']?.toString() ?? '',
        requestId: json['requestId']?.toString() ?? '',
        status: json['status']?.toString() ?? json['requestStatus']?.toString() ?? '',
        requestStatus: json['requestStatus']?.toString(),
        rowVersion: (json['rowVersion'] as num?)?.toInt(),
        message: json['message']?.toString(),
        deadlineExpired: json['deadlineExpired'] == true,
        exemptionReason: json['exemptionReason']?.toString(),
      );
}

/// 任务端点：按端点选择版本来源；创建/编辑/进展/完成/重开/交接各自使用任务版本，
/// 申请裁决使用申请自身版本，置顶/预览不套任务 If-Match。
class TasksApi {
  // ignore: prefer_initializing_formals
  TasksApi({required ApiClient client}) : _client = client;

  final ApiClient _client;

  Future<TaskRecord> detail(String id) async {
    final result = await _client.get<TaskRecord>(
      '/tasks/$id',
      versionKey: VersionRegistry.task(id),
      decode: (json) {
        final record = TaskRecord.fromJson(asJsonMap(json));
        if (record.pending) {
          // 待审任务不应出现在普通日历；页面仍需展示冻结信息。
        }
        return record;
      },
    );
    return result.data;
  }

  Future<TaskMutationResult> create({
    required Map<String, Object?> payload,
    required String idempotencyKey,
  }) async {
    final result = await _client.write<TaskMutationResult>(
      method: 'POST',
      path: '/tasks',
      body: payload,
      idempotencyKey: idempotencyKey,
      decode: (json) => TaskMutationResult.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  /// `command` 为 change/reschedule/progress/complete；重开单独走 [reopen]。
  Future<TaskMutationResult> change({
    required String id,
    required String command,
    required Map<String, Object?> payload,
    required String idempotencyKey,
  }) async {
    final result = await _client.write<TaskMutationResult>(
      method: 'PATCH',
      path: '/tasks/$id',
      body: {'command': command, ...payload},
      idempotencyKey: idempotencyKey,
      versionKey: VersionRegistry.task(id),
      requireVersion: true,
      decode: (json) => TaskMutationResult.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<TaskMutationResult> reopen({
    required String id,
    required DateTime startAt,
    required DateTime dueAt,
    required List<String> assigneeIds,
    required String reason,
    required String idempotencyKey,
  }) async {
    final result = await _client.write<TaskMutationResult>(
      method: 'PATCH',
      path: '/tasks/$id',
      body: {
        'command': 'reopen',
        'allDay': false,
        'startAt': startAt.toUtc().toIso8601String(),
        'dueAt': dueAt.toUtc().toIso8601String(),
        'assigneeIds': assigneeIds,
        'reason': reason,
      },
      idempotencyKey: idempotencyKey,
      versionKey: VersionRegistry.task(id),
      requireVersion: true,
      decode: (json) => TaskMutationResult.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<TaskMutationResult> handover({
    required String taskId,
    required String sourceUserId,
    String? targetUserId,
    String? reason,
    required String idempotencyKey,
  }) async {
    final result = await _client.write<TaskMutationResult>(
      method: 'POST',
      path: '/tasks/$taskId/handover',
      body: {
        'sourceUserId': sourceUserId,
        'targetUserId': ?targetUserId,
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      },
      idempotencyKey: idempotencyKey,
      versionKey: VersionRegistry.task(taskId),
      requireVersion: true,
      decode: (json) => TaskMutationResult.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<ReviewerPreview> preview(Map<String, Object?> payload, OperationKeys keys) async {
    final key = keys.keyFor(scope: 'reviewer-preview', method: 'POST', path: '/tasks/reviewer-preview', body: payload);
    final result = await _client.write<ReviewerPreview>(
      method: 'POST',
      path: '/tasks/reviewer-preview',
      body: payload,
      idempotencyKey: key,
      decode: (json) => ReviewerPreview.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<List<PersonSummary>> assigneeCandidates({String? query, String purpose = 'create'}) async {
    final result = await _client.get<List<PersonSummary>>(
      '/assignee-candidates',
      query: {'q': (query ?? '').trim(), 'purpose': purpose},
      decode: (json) => [
        for (final raw in asJsonList(asJsonMap(json)['items']))
          if (raw is Map) PersonSummary.fromJson(Map<String, Object?>.from(raw)),
      ],
    );
    return result.data;
  }

  Future<List<TaskRecord>> searchParentTasks(String query) async {
    final result = await _client.get<List<TaskRecord>>(
      '/tasks',
      query: {'q': query.trim(), 'limit': 20, 'offset': 0},
      decode: (json) => [
        for (final raw in asJsonList(asJsonMap(json)['items']))
          if (raw is Map) TaskRecord.fromJson(Map<String, Object?>.from(raw)),
      ],
    );
    return result.data;
  }

  /// 通用任务列表使用偏移字符串游标 `nextCursor`，与事项/表单的数字 nextOffset 不同。
  Future<TaskCursorPage> listTasksPage({String? cursor, int limit = 20}) async {
    final result = await _client.get<TaskCursorPage>(
      '/tasks',
      query: {'limit': limit, 'offset': cursor ?? 0},
      decode: (json) => TaskCursorPage.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<List<TaskRecord>> listTasks({int limit = 20, int offset = 0, String? query}) async {
    final result = await _client.get<List<TaskRecord>>(
      '/tasks',
      query: {'limit': limit, 'offset': offset, 'q': ?query},
      decode: (json) => [
        for (final raw in asJsonList(asJsonMap(json)['items']))
          if (raw is Map) TaskRecord.fromJson(Map<String, Object?>.from(raw)),
      ],
    );
    return result.data;
  }

  Future<HandoverTargets> handoverTargets({required String subjectId, String? query}) async {
    final result = await _client.get<HandoverTargets>(
      '/handover-targets',
      query: {'subjectId': subjectId, 'q': ?query},
      decode: (json) => HandoverTargets.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<HandoverPreset> handoverPreset(String userId) async {
    final result = await _client.get<HandoverPreset>(
      '/users/$userId/handover-preset',
      decode: (json) => HandoverPreset.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<HandoverPreset> saveHandoverPreset({
    required String userId,
    required String targetUserId,
    required String idempotencyKey,
  }) async {
    final result = await _client.write<HandoverPreset>(
      method: 'PUT',
      path: '/users/$userId/handover-preset',
      body: {'targetUserId': targetUserId},
      idempotencyKey: idempotencyKey,
      decode: (json) => HandoverPreset.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<void> clearHandoverPreset({required String userId, required String idempotencyKey}) async {
    await _client.write<void>(
      method: 'DELETE',
      path: '/users/$userId/handover-preset',
      body: const {},
      idempotencyKey: idempotencyKey,
      decode: (_) {},
    );
  }


  /// 本人日历范围查询：服务端按 assigneeId/from/to 返回有效版和待审提议。
  Future<List<TaskRecord>> listCalendarTasks({
    required String assigneeId,
    required String from,
    required String to,
  }) async {
    final rows = <String, TaskRecord>{};
    var offset = 0;
    while (true) {
      final result = await _client.get<TaskCursorPage>(
        '/tasks',
        query: {
          'assigneeId': assigneeId,
          'calendarPreview': 'true',
          'from': from,
          'to': to,
          'limit': 100,
          'offset': offset,
        },
        decode: (json) => TaskCursorPage.fromJson(asJsonMap(json)),
      );
      for (final task in result.data.items) {
        rows[task.id] = task;
      }
      final nextOffset = int.tryParse(result.data.nextCursor ?? '');
      if (nextOffset == null || nextOffset <= offset) break;
      offset = nextOffset;
    }
    return rows.values.toList();
  }


  Future<TaskTablePageResult> table({
    String relation = 'all',
    String completion = 'all',
    String query = '',
    String sort = 'startAt',
    String direction = 'asc',
    String? from,
    String? to,
    int limit = 50,
    int offset = 0,
  }) async {
    final result = await _client.get<TaskTablePageResult>(
      '/tasks/table',
      query: {
        'relation': relation,
        'completion': completion,
        'q': query.trim().isEmpty ? null : query.trim(),
        'sort': sort,
        'direction': direction,
        'from': from,
        'to': to,
        'limit': limit,
        'offset': offset,
      },
      decode: (json) => TaskTablePageResult.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<List<TaskTag>> tags() async {
    final result = await _client.get<List<TaskTag>>(
      '/tags',
      decode: (json) {
        final map = asJsonMap(json);
        return [
          for (final raw in asJsonList(map['items']))
            if (raw is Map) TaskTag.fromJson(Map<String, Object?>.from(raw)),
        ];
      },
    );
    return result.data;
  }

  /// 任务表单独立置顶：不要求任务 If-Match，也不改任务版本。
  Future<void> setTablePin({required String taskId, required bool pinned, required String idempotencyKey}) async {
    await _client.write<void>(
      method: pinned ? 'PUT' : 'DELETE',
      path: '/tasks/$taskId/table-pin',
      body: const {},
      idempotencyKey: idempotencyKey,
      decode: (_) {},
    );
  }

  /// 日历置顶同样不套任务 If-Match；与表单置顶是两个独立偏好。
  Future<void> setCalendarPin({required String taskId, required bool pinned, required String idempotencyKey}) async {
    await _client.write<void>(
      method: pinned ? 'PUT' : 'DELETE',
      path: '/tasks/$taskId/pin',
      body: const {},
      idempotencyKey: idempotencyKey,
      decode: (_) {},
    );
  }
}
