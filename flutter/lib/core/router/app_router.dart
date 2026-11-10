import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/password_change_page.dart';
import '../../features/auth/presentation/login_page.dart';
import '../../features/approvals/presentation/approvals_pages.dart';
import '../../features/daily_items/presentation/daily_item_pages.dart';
import '../../features/daily_items/presentation/daily_items_day_page.dart';
import '../../features/home/presentation/home_lists.dart';
import '../../features/home/presentation/home_page.dart';
import '../../features/tasks/presentation/task_action_pages.dart';
import '../../features/tasks/presentation/task_detail_page.dart';
import '../../features/tasks/presentation/task_form_page.dart';
import '../../features/tasks/presentation/task_route_args.dart';
import '../company/company_date.dart';
import '../../features/shell/destination_pages.dart';
import '../../features/shell/pandora_shell.dart';
import '../../features/stub/stub_page.dart';
import '../router/read_context.dart';
import '../providers.dart';
import '../session/session_manager.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();

/// 全部路由集中注册：五分支 + 所有二级流程。
class AppRoutes {
  const AppRoutes._();

  static const login = '/login';
  static const password = '/password';
  static const sessionCheck = '/session-check';

  static const home = '/home';
  static const homeEvents = '/home/events';
  static const homeBoard = '/home/board';
  static const company = '/company';
  static const logs = '/logs';
  static const stats = '/stats';
  static const me = '/me';

  static const dailyItemNew = '/daily-items/new';
  static const dailyItemsDayPrefix = '/daily-items/day';
  static const dailyItemsDay = '$dailyItemsDayPrefix/:date';
  static String dailyItemDay(String iso) => '$dailyItemsDayPrefix/$iso';
  static const dailyItemPattern = '/daily-items/:id';
  static String dailyItem(String id) => '/daily-items/$id';

  static const taskNew = '/tasks/new';
  static const taskPattern = '/tasks/:id';
  static String task(String id) => '/tasks/$id';
  static const taskEditPattern = '/tasks/:id/edit';
  static String taskEdit(String id) => '/tasks/$id/edit';
  static const taskReopenPattern = '/tasks/:id/reopen';
  static String taskReopen(String id) => '/tasks/$id/reopen';
  static const taskHandoverPattern = '/tasks/:id/handover';
  static String taskHandover(String id) => '/tasks/$id/handover';

  static const approvals = '/approvals';
  static const approvalPattern = '/approvals/:requestId';
  static String approval(String id) => '/approvals/$requestIdPrefix$id';
  static const requestIdPrefix = '';

  static const notifications = '/notifications';
  static const notificationPattern = '/notifications/:id';
  static String notification(String id) => '/notifications/$id';

  static const people = '/people';
  static const logsNew = '/logs/new';
  static const logPattern = '/logs/:id';
  static String log(String id) => '/logs/$id';
  static const tags = '/tags';
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final manager = ref.watch(sessionManagerProvider);
  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: AppRoutes.home,
    refreshListenable: manager,
    redirect: (context, state) {
      final phase = manager.state.phase;
      final location = state.matchedLocation;
      final onAuthPage = location == AppRoutes.login ||
          location == AppRoutes.password ||
          location == AppRoutes.sessionCheck;

      if (phase == SessionPhase.bootstrapping || phase == SessionPhase.checking) {
        return location == AppRoutes.sessionCheck ? null : AppRoutes.sessionCheck;
      }
      if (phase == SessionPhase.unauthenticated || phase == SessionPhase.expired) {
        return location == AppRoutes.login ? null : AppRoutes.login;
      }
      if (phase == SessionPhase.restricted) {
        return location == AppRoutes.password ? null : AppRoutes.password;
      }
      // 正常会话不应停留在登录/校验/改密页。
      if (onAuthPage) return AppRoutes.home;
      return null;
    },
    routes: [
      GoRoute(
        path: AppRoutes.login,
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: AppRoutes.password,
        builder: (context, state) => const PasswordChangePage(restricted: true),
      ),
      GoRoute(
        path: AppRoutes.sessionCheck,
        builder: (context, state) => const SessionCheckPage(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => PandoraShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.home,
                builder: (context, state) => const HomePage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.company,
                builder: (context, state) => const CompanyPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.logs,
                builder: (context, state) => const LogsPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.stats,
                builder: (context, state) => const StatsPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.me,
                builder: (context, state) => const MePage(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: AppRoutes.homeEvents,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const HomeEventsPage(),
      ),
      GoRoute(
        path: '${AppRoutes.homeEvents}/:id',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => HomeEventDetailPage(itemId: state.pathParameters['id'] ?? ''),
      ),
      GoRoute(
        path: AppRoutes.homeBoard,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const HomeBoardPage(),
      ),
      GoRoute(
        path: AppRoutes.taskNew,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => TaskCreatePage(parentId: state.uri.queryParameters['parent']),
      ),
      GoRoute(
        path: AppRoutes.taskPattern,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) {
          final extra = state.extra;
          final args = extra is TaskRouteArgs ? extra : const TaskRouteArgs(context: NormalReadContext());
          return TaskDetailPage(
            taskId: state.pathParameters['id'] ?? '',
            readContext: args.context,
          );
        },
      ),
      GoRoute(
        path: AppRoutes.taskEditPattern,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => TaskEditPage(taskId: state.pathParameters['id'] ?? ''),
      ),
      GoRoute(
        path: AppRoutes.taskReopenPattern,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => TaskReopenPage(taskId: state.pathParameters['id'] ?? ''),
      ),
      GoRoute(
        path: AppRoutes.taskHandoverPattern,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => TaskHandoverPage(taskId: state.pathParameters['id'] ?? ''),
      ),
      GoRoute(
        path: AppRoutes.approvals,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const ApprovalsPage(),
      ),
      GoRoute(
        path: AppRoutes.approvalPattern,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => ApprovalDetailPage(requestId: state.pathParameters['requestId'] ?? ''),
      ),
      GoRoute(
        path: AppRoutes.dailyItemNew,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) {
          final date = CompanyDate.tryParse(state.uri.queryParameters['date']);
          return DailyItemCreatePage(initialDate: date);
        },
      ),
      GoRoute(
        path: AppRoutes.dailyItemsDay,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) {
          final date = CompanyDate.tryParse(state.pathParameters['date']);
          return date == null
              ? const Scaffold(body: Center(child: Text('日期不正确')))
              : DailyItemsDayPage(date: date);
        },
      ),
      GoRoute(
        path: AppRoutes.dailyItemPattern,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => DailyItemDetailPage(itemId: state.pathParameters['id'] ?? ''),
      ),
      GoRoute(
        path: AppRoutes.notifications,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const StubPage(title: '通知'),
      ),
      GoRoute(
        path: AppRoutes.notificationPattern,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => StubPage(title: '通知详情', subtitle: state.pathParameters['id']),
      ),
      GoRoute(
        path: AppRoutes.people,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const StubPage(title: '我的下属'),
      ),
      GoRoute(
        path: AppRoutes.logsNew,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const StubPage(title: '写日志'),
      ),
      GoRoute(
        path: AppRoutes.logPattern,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => StubPage(title: '日志详情', subtitle: state.pathParameters['id']),
      ),
      GoRoute(
        path: AppRoutes.tags,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const StubPage(title: '标签目录'),
      ),
    ],
  );
});
