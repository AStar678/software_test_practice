import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../approvals/data/approvals_api.dart';
import '../data/tasks_api.dart';
import '../domain/task_record.dart';

final tasksApiProvider = Provider<TasksApi>((ref) {
  return TasksApi(client: ref.watch(apiClientProvider));
});

final approvalsApiProvider = Provider<ApprovalsApi>((ref) {
  return ApprovalsApi(client: ref.watch(apiClientProvider));
});

/// 任务详情按 ID 缓存；写后显式失效再重取，不用本地猜测拼造最终状态。
final taskDetailProvider = FutureProvider.family<TaskRecord, String>((ref, id) async {
  ref.watch(accountEpochProvider);
  return ref.watch(tasksApiProvider).detail(id);
});

final taskTagsProvider = FutureProvider<List<TaskTag>>((ref) async {
  ref.watch(accountEpochProvider);
  return ref.watch(tasksApiProvider).tags();
});
