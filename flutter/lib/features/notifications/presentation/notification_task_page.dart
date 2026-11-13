import 'package:flutter/material.dart';

import '../../../core/widgets/common.dart';
import '../../../core/widgets/state_views.dart';

/// 历史通知任务的导航占位：保持独立只读上下文，不读取普通任务缓存。
/// 第 9.4 章将其替换为 `/notifications/{id}/task` 的真实安全摘要。
class NotificationTaskPage extends StatelessWidget {
  const NotificationTaskPage({super.key, required this.notificationId});

  final String notificationId;

  @override
  Widget build(BuildContext context) {
    return PandoraPage(
      title: '历史任务摘要',
      showBack: true,
      child: EmptyView(
        message: '该历史消息任务仅提供安全只读摘要，不提供评论、置顶、排期或审核操作。\n历史消息：$notificationId',
      ),
    );
  }
}
