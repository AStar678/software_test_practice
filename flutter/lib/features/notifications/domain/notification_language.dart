import 'notification_record.dart';

/// 通知里授权申请的类型与结果使用产品中文，不直出服务端协议枚举。
String notificationRequestKindLabel(String? kind) => switch (kind) {
  'create' => '创建任务',
  'change' => '修改资料',
  'progress' => '更新进展',
  'complete' => '提交完成',
  'reopen' => '重开任务',
  'handover' => '交接',
  'reschedule' => '调整排期',
  _ => '任务申请',
};

String notificationRequestStatusLabel(String? status) => switch (status) {
  'pending' => '待审核',
  'approved' => '已通过',
  'rejected' => '已退回',
  'withdrawn' => '已撤销',
  'direct' => '已生效',
  'expired' => '已失效',
  _ => '已处理',
};

/// 只有服务端授权且未撤回时才构造「申请：类型 · 结果」。
///
/// 无权限、无关联申请或已撤回时返回 null，调用方不应显示该行，也不应补造状态。
String? notificationRequestSummary(NotificationDetail detail) {
  if (detail.withdrawn || !detail.canReadRequest || detail.requestId == null) {
    return null;
  }
  final status = detail.requestStatus?.trim();
  if (status == null || status.isEmpty) return null;
  return '${notificationRequestKindLabel(detail.requestKind)} · '
      '${notificationRequestStatusLabel(status)}';
}

/// 处理意见同样要求授权且未撤回。
String? notificationAuthorizedRequestComment(NotificationDetail detail) {
  if (detail.withdrawn || !detail.canReadRequest || detail.requestId == null) {
    return null;
  }
  final comment = detail.requestComment?.trim();
  return comment == null || comment.isEmpty ? null : comment;
}
