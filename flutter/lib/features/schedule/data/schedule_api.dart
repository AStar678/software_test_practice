import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../tasks/data/tasks_api.dart';

final scheduleApiProvider = Provider<TasksApi>((ref) {
  return TasksApi(client: ref.watch(apiClientProvider));
});
