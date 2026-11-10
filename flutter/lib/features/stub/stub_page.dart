import 'package:flutter/material.dart';

import '../../core/widgets/common.dart';
import '../../core/widgets/state_views.dart';

/// 后续章节交付的二级页面占位。正式内容由对应章节实现，
/// 这里只保证路由骨架、返回层级与可用性，不伪装业务数据。
class StubPage extends StatelessWidget {
  const StubPage({super.key, required this.title, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return PandoraPage(
      title: title,
      showBack: true,
      child: EmptyView(
        message: subtitle == null ? '此页面将在后续章节接入' : '此页面将在后续章节接入\n$subtitle',
      ),
    );
  }
}
