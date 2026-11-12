import '../../../core/company/company_date.dart';
import '../../../core/company/company_time.dart';

/// 任务安全投影（列表/详情共用）。字段与真实 API 对齐，未知/缺字段安全降级。
class TaskRecord {
  const TaskRecord({
    required this.id,
    required this.title,
    this.versionNo,
    this.description = '',
    this.acceptanceCriteria = '',
    this.priority = 'medium',
    this.allDay = false,
    this.startAt,
    this.dueAt,
    this.startDate,
    this.dueDate,
    this.executionState = 'todo',
    this.progressNote = '',
    this.status = 'applied',
    this.createdBy,
    this.createdAt,
    this.originalCreatorId,
    this.businessOwnerId,
    this.assigneeIds = const [],
    this.tags = const [],
    this.tagIds = const [],
    this.parentTaskId,
    this.parentUnavailable = false,
    this.rowVersion = 0,
    this.executionRound = 1,
    this.published = false,
    this.pending = false,
    this.frozen = false,
    this.pendingKind,
    this.pendingSchedule,
    this.canReschedule = false,
    this.canPin = false,
    this.canTablePin = false,
    this.pinned = false,
    this.tablePinned = false,
    this.editableFields = const {},
    this.route,
    this.participants = const [],
    this.updatedAt,
  });

  final String id;
  final String title;
  final int? versionNo;
  final String description;
  final String acceptanceCriteria;
  final String priority;
  final bool allDay;
  final DateTime? startAt;
  final DateTime? dueAt;
  final String? startDate;
  final String? dueDate;
  final String executionState;
  final String progressNote;
  final String status;
  final String? createdBy;
  final DateTime? createdAt;
  final String? originalCreatorId;
  final String? businessOwnerId;
  final List<String> assigneeIds;
  final List<TaskTag> tags;
  final List<String> tagIds;
  final String? parentTaskId;
  final bool parentUnavailable;
  final int rowVersion;
  final int executionRound;
  final bool published;
  final bool pending;
  final bool frozen;
  final String? pendingKind;
  final Map<String, Object?>? pendingSchedule;
  final bool canReschedule;
  final bool canPin;
  final bool canTablePin;
  final bool pinned;
  final bool tablePinned;
  final Set<String> editableFields;
  final TaskRoute? route;
  final List<TaskParticipant> participants;
  final DateTime? updatedAt;

  bool get done => executionState == 'done';
  bool get doing => executionState == 'doing';

  /// 旧全天日期：startDate/dueDate 或由 allDay 标记的历史值。
  CompanyDate? get allDayStart => CompanyDate.tryParse(startDate);
  CompanyDate? get allDayEnd => CompanyDate.tryParse(dueDate);

  bool get hasExplicitSchedule => startAt != null && dueAt != null;

  bool canEditField(String field) => editableFields.contains(field);

  /// 当前有效时段是否覆盖公司日；旧全天首尾包含，定时半开。
  bool coversDay(CompanyDate day, CompanyTimeZone zone) {
    if (allDay) {
      final start = allDayStart;
      final end = allDayEnd;
      if (start != null && end != null) return ScheduleCoverage.coversAllDay(day, start, end);
      final startInstant = startAt;
      final dueInstant = dueAt;
      if (startInstant != null && dueInstant != null) {
        return ScheduleCoverage.coversTimed(day, startInstant, dueInstant, zone);
      }
      return false;
    }
    final start = startAt;
    final due = dueAt;
    if (start == null || due == null) return false;
    return ScheduleCoverage.coversTimed(day, start, due, zone);
  }

  String scheduleText(CompanyTimeZone zone) {
    if (allDay) {
      final start = allDayStart;
      final end = allDayEnd;
      if (start != null && end != null) {
        return start == end ? '${start.iso}（全天）' : '${start.iso} 至 ${end.iso}（全天）';
      }
    }
    if (startAt == null || dueAt == null) return '排期未设置';
    final start = zone.toLocal(startAt!);
    final due = zone.toLocal(dueAt!);
    final startDay = CompanyDate(start.year, start.month, start.day);
    final dueDay = CompanyDate(due.year, due.month, due.day);
    if (startDay == dueDay) {
      return '${startDay.iso} ${_two(start.hour, start.minute)}–${_two(due.hour, due.minute)}';
    }
    return '${startDay.iso} ${_two(start.hour, start.minute)} 至 ${dueDay.iso} ${_two(due.hour, due.minute)}';
  }

  static String _two(int hour, int minute) =>
      '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';

  factory TaskRecord.fromJson(Map<String, Object?> json) {
    final tags = <TaskTag>[];
    final rawTags = json['tags'];
    if (rawTags is List) {
      for (final raw in rawTags) {
        if (raw is Map) tags.add(TaskTag.fromJson(Map<String, Object?>.from(raw)));
      }
    }
    final participants = <TaskParticipant>[];
    final rawParticipants = json['participants'];
    if (rawParticipants is List) {
      for (final raw in rawParticipants) {
        if (raw is Map) participants.add(TaskParticipant.fromJson(Map<String, Object?>.from(raw)));
      }
    }
    final rawRoute = json['route'];
    final rawPendingSchedule = json['pendingSchedule'];
    return TaskRecord(
      id: _string(json['id']) ?? _string(json['taskId']) ?? '',
      title: _string(json['title']) ?? '',
      versionNo: _int(json['versionNo']),
      description: _string(json['description']) ?? '',
      acceptanceCriteria: _string(json['acceptanceCriteria']) ?? '',
      priority: _string(json['priority']) ?? 'medium',
      allDay: json['allDay'] == true,
      startAt: _instant(json['startAt']),
      dueAt: _instant(json['dueAt']),
      startDate: _string(json['startDate']),
      dueDate: _string(json['dueDate']),
      executionState: _string(json['executionState']) ?? 'todo',
      progressNote: _string(json['progressNote']) ?? '',
      status: _string(json['status']) ?? 'applied',
      createdBy: _string(json['createdBy']),
      createdAt: _instant(json['createdAt']),
      originalCreatorId: _string(json['originalCreatorId']),
      businessOwnerId: _string(json['businessOwnerId']),
      assigneeIds: _stringList(json['assigneeIds']),
      tags: tags,
      tagIds: _stringList(json['tagIds']),
      parentTaskId: _string(json['parentTaskId']),
      parentUnavailable: json['parentUnavailable'] == true,
      rowVersion: _int(json['rowVersion']) ?? 0,
      executionRound: _int(json['executionRound']) ?? 1,
      published: json['published'] == true,
      pending: json['pending'] == true,
      frozen: json['frozen'] == true,
      pendingKind: _string(json['pendingKind']),
      pendingSchedule: rawPendingSchedule is Map
          ? Map<String, Object?>.from(rawPendingSchedule)
          : null,
      canReschedule: json['canReschedule'] == true,
      canPin: json['canPin'] == true,
      canTablePin: json['canTablePin'] == true,
      pinned: json['pinned'] == true,
      tablePinned: json['tablePinned'] == true,
      editableFields: Set<String>.from(_stringList(json['editableFields'])),
      route: rawRoute is Map ? TaskRoute.fromJson(Map<String, Object?>.from(rawRoute)) : null,
      participants: participants,
      updatedAt: _instant(json['updatedAt']),
    );
  }

  /// 生成 PATCH 的完整字段体：只发送服务端允许编辑且用户实际改动的字段。
  Map<String, Object?> fieldsPayload({
    required bool includeTitle,
    bool includeDescription = false,
    bool includeAcceptanceCriteria = false,
    bool includePriority = false,
    bool includeSchedule = false,
    bool includeAssignees = false,
    bool includeTags = false,
    bool includeParent = false,
    bool includeProgress = false,
    String? title,
    String? description,
    String? acceptanceCriteria,
    String? priority,
    bool? allDay,
    String? startAt,
    String? dueAt,
    String? startDate,
    String? dueDate,
    List<String>? assigneeIds,
    List<String>? tagIds,
    String? parentTaskId,
    String? progressNote,
  }) {
    return {
      if (includeTitle) 'title': title,
      if (includeDescription) 'description': description,
      if (includeAcceptanceCriteria) 'acceptanceCriteria': acceptanceCriteria,
      if (includePriority) 'priority': priority,
      if (includeSchedule) ...{
        'allDay': allDay,
        'startAt': startAt,
        'dueAt': dueAt,
        'startDate': startDate,
        'dueDate': dueDate,
      },
      if (includeAssignees) 'assigneeIds': assigneeIds,
      if (includeTags) 'tagIds': tagIds,
      if (includeParent) 'parentTaskId': parentTaskId,
      if (includeProgress) 'progressNote': progressNote,
    };
  }
}

class TaskTag {
  const TaskTag({
    required this.id,
    required this.name,
    this.color,
    this.border,
    this.deleted = false,
    this.rowVersion = 1,
  });

  final String id;
  final String name;
  final String? color;
  final String? border;
  final bool deleted;
  final int rowVersion;

  factory TaskTag.fromJson(Map<String, Object?> json) {
    return TaskTag(
      id: _string(json['id']) ?? '',
      name: _string(json['name']) ?? '',
      color: _string(json['color']),
      border: _string(json['border']),
      deleted: json['deleted'] == true,
      rowVersion: _int(json['rowVersion']) ?? 1,
    );
  }
}

class TaskParticipant {
  const TaskParticipant({required this.id, required this.displayName});

  final String id;
  final String displayName;

  factory TaskParticipant.fromJson(Map<String, Object?> json) => TaskParticipant(
        id: _string(json['id']) ?? '',
        displayName: _string(json['displayName']) ?? '',
      );
}

/// 服务端审核路由预览：预览不是凭证，提交时服务端重算。
class TaskRoute {
  const TaskRoute({
    this.reviewerId,
    this.basisAssigneeId,
    this.path = const [],
    this.reason,
    this.reasonText,
    this.reviewerAvailable = false,
    this.blocked = false,
    this.creation = false,
    this.participants = const [],
  });

  final String? reviewerId;
  final String? basisAssigneeId;
  final List<String> path;
  final String? reason;
  final String? reasonText;
  final bool reviewerAvailable;
  final bool blocked;
  final bool creation;
  final List<TaskParticipant> participants;

  factory TaskRoute.fromJson(Map<String, Object?> json) => TaskRoute(
        reviewerId: _string(json['reviewerId']),
        basisAssigneeId: _string(json['basisAssigneeId']),
        path: _stringList(json['path']),
        reason: _string(json['reason']),
        reasonText: _string(json['reasonText']),
        reviewerAvailable: json['reviewerAvailable'] == true,
        blocked: json['blocked'] == true,
        creation: json['creation'] == true,
        participants: [
          for (final raw in json['participants'] as List? ?? const [])
            if (raw is Map) TaskParticipant.fromJson(Map<String, Object?>.from(raw)),
        ],
      );
}

class TaskMutationResult {
  const TaskMutationResult({
    required this.taskId,
    this.requestId,
    required this.outcome,
    this.rowVersion,
  });

  final String taskId;
  final String? requestId;
  final String outcome;
  final int? rowVersion;

  bool get pendingReview => outcome == 'pending';
  bool get appliedDirectly => outcome == 'direct';

  factory TaskMutationResult.fromJson(Map<String, Object?> json) => TaskMutationResult(
        taskId: _string(json['taskId']) ?? '',
        requestId: _string(json['requestId']),
        outcome: _string(json['outcome']) ?? _string(json['status']) ?? 'pending',
        rowVersion: _int(json['rowVersion']),
      );

  /// 创始人免审直接生效（`outcome=direct`）时的原因文案。
  String get feedback => switch (outcome) {
        'direct' => '已直接生效',
        'pending' => '已提交审核',
        _ => '已提交',
      };
}

class ReviewerPreview {
  const ReviewerPreview({
    this.operation,
    this.mode,
    this.reviewerId,
    this.requiresApproval = false,
    this.blocked = false,
    this.exemptionReason,
    this.blockedReason,
    this.route,
  });

  final String? operation;
  final String? mode;
  final String? reviewerId;
  final bool requiresApproval;
  final bool blocked;
  final String? exemptionReason;
  final String? blockedReason;
  final TaskRoute? route;

  factory ReviewerPreview.fromJson(Map<String, Object?> json) {
    final rawRoute = json['route'];
    return ReviewerPreview(
      operation: _string(json['operation']),
      mode: _string(json['mode']),
      reviewerId: _string(json['reviewerId']),
      requiresApproval: json['requiresApproval'] == true,
      blocked: json['blocked'] == true,
      exemptionReason: _string(json['exemptionReason']),
      blockedReason: _string(json['blockedReason']),
      route: rawRoute is Map ? TaskRoute.fromJson(Map<String, Object?>.from(rawRoute)) : null,
    );
  }
}

DateTime? _instant(Object? value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString())?.toUtc();
}

String? _string(Object? value) {
  if (value == null) return null;
  final text = value.toString();
  return text.isEmpty ? null : text;
}

int? _int(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '');
}

List<String> _stringList(Object? value) {
  if (value is! List) return const [];
  return [for (final item in value) if (item != null) item.toString()];
}
