import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/analytics_api.dart';

final analyticsApiProvider = Provider<AnalyticsApi>((ref) {
  return AnalyticsApi(client: ref.watch(apiClientProvider));
});
