/// 详情读取上下文：只在进入路由时确定，嵌套跳转/评论保存都不能自行升级。
/// 即使当前用户在同一任务上另有创建者/负责人身份，下属或历史路径也不提供业务写操作。
sealed class ReadContext {
  const ReadContext();

  String get label;

  /// 是否允许按服务端字段资格办理业务写入。
  bool get businessWritesAllowed;

  /// 是否允许发表/维护本人评论。
  bool get commentsAllowed;
}

/// 正常本人入口：业务写权仍由服务端 `editableFields`/`can*` 裁决。
final class NormalReadContext extends ReadContext {
  const NormalReadContext();

  @override
  String get label => '正常';

  @override
  bool get businessWritesAllowed => true;

  @override
  bool get commentsAllowed => true;
}

/// 下属浏览路径：只读业务，仅合法评论。
final class SubordinateReadContext extends ReadContext {
  const SubordinateReadContext({
    required this.personId,
    required this.personName,
    required this.chainOrigin,
  });

  final String personId;
  final String personName;

  /// 进入该下属路径的来源（我的下属/人员资料等），仅用于返回。
  final String chainOrigin;

  @override
  String get label => '下属 $personName';

  @override
  bool get businessWritesAllowed => false;

  @override
  bool get commentsAllowed => true;
}

/// 历史通知任务例外：仅经 `/notifications/{id}/task` 的当前安全只读摘要，
/// 无评论、置顶、排期、交接、审核等任何写能力。
final class HistoryNotificationReadContext extends ReadContext {
  const HistoryNotificationReadContext({required this.notificationId});

  final String notificationId;

  @override
  String get label => '历史消息';

  @override
  bool get businessWritesAllowed => false;

  @override
  bool get commentsAllowed => false;
}
