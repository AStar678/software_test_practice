import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../core/theme/pandora_theme.dart';
import '../../core/widgets/state_views.dart';
import '../auth/presentation/password_change_page.dart';
import '../schedule/presentation/task_calendar_page.dart';
import '../work_logs/presentation/work_logs_page.dart';

/// 公司页：本人任务日历、任务表单、申请和创建入口。
class CompanyPage extends StatelessWidget {
  const CompanyPage({super.key});

  @override
  Widget build(BuildContext context) => const TaskCalendarPage();
}

/// 日志页：本人日志列表与写日志入口。
class LogsPage extends StatelessWidget {
  const LogsPage({super.key});

  @override
  Widget build(BuildContext context) => const WorkLogsPage();
}

/// 统计页（完整实现在后续章）。
class StatsPage extends StatelessWidget {
  const StatsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('统计')),
      body: const SafeArea(
        child: EmptyView(message: '统计功能将在后续章节接入'),
      ),
    );
  }
}

/// 我的：本人资料、改密与退出。组织身份标签不展示，使用真实职务路径。
class MePage extends ConsumerWidget {
  const MePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    if (user == null) {
      return const Scaffold(body: Center(child: Text('未登录')));
    }
    return Scaffold(
      appBar: AppBar(title: const Text('我的')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: PandoraColors.petal,
                      child: Text(
                        user.displayName.isEmpty ? '?' : user.displayName.characters.first,
                        style: const TextStyle(fontSize: 22, color: PandoraColors.brand),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(user.displayName, style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 2),
                          if (user.positionPath.isNotEmpty)
                            Text(
                              user.positionPath,
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: PandoraColors.muted),
                            ),
                          const SizedBox(height: 6),
                          Text(
                            '手机号 ${user.phone ?? '未设置'}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          if (user.managerName != null)
                            Text(
                              '直属上级 ${user.managerName}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: Column(
                children: [
                  if (user.isManagerRole) ...[
                    ListTile(
                      leading: const Icon(Icons.groups_outlined),
                      title: const Text('我的下属'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => GoRouterHelper.of(context).push('/people'),
                    ),
                    const Divider(height: 1),
                  ],
                  if (user.isFounder) ...[
                    ListTile(
                      leading: const Icon(Icons.sell_outlined),
                      title: const Text('公司标签'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => GoRouterHelper.of(context).push('/tags'),
                    ),
                    const Divider(height: 1),
                  ],
                  ListTile(
                    leading: const Icon(Icons.lock_outline),
                    title: const Text('修改密码'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => const PasswordChangePage()),
                    ),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.logout),
                    title: const Text('退出登录'),
                    onTap: () async {
                      final confirmed = await showDialog<bool>(
                        context: context,
                        builder: (context) => AlertDialog(
                          title: const Text('退出登录？'),
                          content: const Text('退出后需要重新输入手机号和密码。'),
                          actions: [
                            TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('取消')),
                            FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('退出')),
                          ],
                        ),
                      );
                      if (confirmed == true) {
                        await ref.read(sessionManagerProvider).logout();
                      }
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 路由外层的简易 push 包装，避免在页面里依赖具体 router 实例。
class GoRouterHelper {
  const GoRouterHelper._(this._context);

  static GoRouterHelper of(BuildContext context) => GoRouterHelper._(context);

  final BuildContext _context;

  void push(String location) {
    GoRouter.of(_context).push(location);
  }
}
