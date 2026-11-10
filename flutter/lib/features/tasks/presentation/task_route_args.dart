import '../../../core/router/read_context.dart';

/// 任务详情的路由参数：上下文在进入时固定，嵌套跳转只复制不能升级。
class TaskRouteArgs {
  const TaskRouteArgs({required this.context, this.returnLabel});

  final ReadContext context;
  final String? returnLabel;
}
