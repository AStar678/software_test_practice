import '../../tasks/domain/task_record.dart';

/// 申请投影：申请人只看到自己的提议与结果；只有当前有权审核人还会收到
/// baseVersion 与专用 diff。普通 DTO 不能拼出未授权的完整提议。
class ApprovalRequest {
  const ApprovalRequest({
    required this.requestId,
    required this.taskId,
    required this.kind,
    required this.status,
    this.comment,
    this.applicantId,
    this.currentReviewerId,
    this.rowVersion = 1,
    this.previousState,
    this.exemptionReason,
    this.createdAt,
    this.decidedAt,
    this.applicableDeadline,
    this.expiredAt,
    this.title = '',
    this.versionNo,
    this.route,
    this.proposedVersion,
    this.baseVersionId,
    this.baseVersion,
    this.diff = const [],
    this.participants = const [],
    this.records = const [],
    this.deadlineExpired = false,
    this.message,
    this.canDecide = false,
    this.canWithdraw = false,
  });

  final String requestId;
  final String taskId;
  final String kind;
  final String status;
  final String? comment;
  final String? applicantId;
  final String? currentReviewerId;
  final int rowVersion;
  final String? previousState;
  final String? exemptionReason;
  final DateTime? createdAt;
  final DateTime? decidedAt;
  final DateTime? applicableDeadline;
  final DateTime? expiredAt;
  final String title;
  final int? versionNo;
  final TaskRoute? route;
  final TaskRecord? proposedVersion;
  final String? baseVersionId;
  final TaskRecord? baseVersion;
  final List<FieldDiff> diff;
  final List<TaskParticipant> participants;
  final List<ApprovalRecord> records;
  final bool deadlineExpired;
  final String? message;

  /// 页面按钮仅作提示，服务端每次重验；这里结合状态与审核人身份保守判断。
  final bool canDecide;
  final bool canWithdraw;

  bool get isPending => status == 'pending';
  bool get isApplicantView => diff.isEmpty && baseVersion == null;

  String get kindLabel => switch (kind) {
        'create' => '新建',
        'change' => '修改',
        'progress' => '进展',
        'complete' => '完成',
        'reopen' => '重开',
        'handover' => '交接',
        'reschedule' => '排期',
        _ => kind,
      };

  String get statusLabel => switch (status) {
        'pending' => '待审核',
        'approved' => '已通过',
        'rejected' => '已拒绝',
        'withdrawn' => '已撤销',
        'expired' => '已失效',
        'direct' => '已直接生效',
        _ => status,
      };

  factory ApprovalRequest.fromJson(Map<String, Object?> json) {
    final rawRoute = json['route'];
    final rawProposed = json['proposedVersion'];
    final rawBase = json['baseVersion'];
    final diff = <FieldDiff>[];
    final rawDiff = json['diff'];
    if (rawDiff is List) {
      for (final raw in rawDiff) {
        if (raw is Map) diff.add(FieldDiff.fromJson(Map<String, Object?>.from(raw)));
      }
    }
    return ApprovalRequest(
      requestId: json['requestId']?.toString() ?? '',
      taskId: json['taskId']?.toString() ?? '',
      kind: json['kind']?.toString() ?? 'change',
      status: json['status']?.toString() ?? 'pending',
      comment: json['comment']?.toString(),
      applicantId: json['applicantId']?.toString(),
      currentReviewerId: json['currentReviewerId']?.toString(),
      rowVersion: (json['rowVersion'] as num?)?.toInt() ?? 1,
      previousState: json['previousState']?.toString(),
      exemptionReason: json['exemptionReason']?.toString(),
      createdAt: _instant(json['createdAt']),
      decidedAt: _instant(json['decidedAt']),
      applicableDeadline: _instant(json['applicableDeadline']),
      expiredAt: _instant(json['expiredAt']),
      title: json['title']?.toString() ?? '',
      versionNo: (json['versionNo'] as num?)?.toInt(),
      route: rawRoute is Map ? TaskRoute.fromJson(Map<String, Object?>.from(rawRoute)) : null,
      proposedVersion: rawProposed is Map ? TaskRecord.fromJson(Map<String, Object?>.from(rawProposed)) : null,
      baseVersionId: json['baseVersionId']?.toString(),
      baseVersion: rawBase is Map ? TaskRecord.fromJson(Map<String, Object?>.from(rawBase)) : null,
      diff: diff,
      participants: [
        for (final raw in json['participants'] as List? ?? const [])
          if (raw is Map) TaskParticipant.fromJson(Map<String, Object?>.from(raw)),
      ],
      records: [
        for (final raw in json['records'] as List? ?? const [])
          if (raw is Map) ApprovalRecord.fromJson(Map<String, Object?>.from(raw)),
      ],
      deadlineExpired: json['deadlineExpired'] == true,
      message: json['message']?.toString(),
    );
  }
}

class FieldDiff {
  const FieldDiff({required this.field, required this.before, required this.after});

  final String field;
  final String before;
  final String after;

  String get label => switch (field) {
        'title' => '标题',
        'description' => '说明',
        'acceptanceCriteria' => '完成标准',
        'priority' => '紧急程度',
        'allDay' => '全天',
        'startAt' => '开始时间',
        'dueAt' => '截止时间',
        'startDate' => '开始日期',
        'dueDate' => '截止日期',
        'assigneeIds' => '负责人',
        'tagIds' => '标签',
        'parentTaskId' => '父任务',
        'progressNote' => '进展',
        _ => field,
      };

  bool get isOrderedSet => field == 'assigneeIds' || field == 'tagIds';

  factory FieldDiff.fromJson(Map<String, Object?> json) => FieldDiff(
        field: json['field']?.toString() ?? '',
        before: json['before']?.toString() ?? '',
        after: json['after']?.toString() ?? '',
      );
}

class ApprovalRecord {
  const ApprovalRecord({required this.id, required this.body, this.createdAt});

  final String id;
  final String body;
  final DateTime? createdAt;

  factory ApprovalRecord.fromJson(Map<String, Object?> json) => ApprovalRecord(
        id: json['id']?.toString() ?? '',
        body: json['body']?.toString() ?? '',
        createdAt: _instant(json['createdAt']),
      );
}

DateTime? _instant(Object? value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString())?.toUtc();
}
