import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../analytics/presentation/analytics_page.dart';
import '../auth/presentation/password_change_page.dart';
import '../profile/presentation/profile_pages.dart';
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
  Widget build(BuildContext context) => const AnalyticsPage();
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
            const SelfProfileCard(),
            const SizedBox(height: 12),
            Card(
              child: Column(
                children: [
                  if (user.isFounder) ...[
                    ListTile(
                      leading: const Icon(Icons.sell_outlined),
                      title: const Text('公司标签'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => GoRouterHelper.of(context).push('/tags'),
                    ),
                    const Divider(height: 1),
                  ],
                  if (user.isManagerRole) ...[
                    ListTile(
                      leading: const Icon(Icons.account_tree_outlined),
                      title: const Text('我的下属'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => GoRouterHelper.of(context).push('/people'),
                    ),
                    const Divider(height: 1),
                  ],
                  ListTile(
                    leading: const Icon(Icons.notifications_outlined),
                    title: const Text('通知中心'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () =>
                        GoRouterHelper.of(context).push('/notifications'),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.lock_outline),
                    title: const Text('修改密码'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const PasswordChangePage(),
                      ),
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
                            TextButton(
                              onPressed: () => Navigator.of(context).pop(false),
                              child: const Text('取消'),
                            ),
                            FilledButton(
                              onPressed: () => Navigator.of(context).pop(true),
                              child: const Text('退出'),
                            ),
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
