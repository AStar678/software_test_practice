import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/work_logs_api.dart';

final workLogsApiProvider = Provider<WorkLogsApi>((ref) {
  return WorkLogsApi(client: ref.watch(apiClientProvider));
});
