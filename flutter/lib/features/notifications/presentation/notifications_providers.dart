import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/notifications_api.dart';

final notificationsApiProvider = Provider<NotificationsApi>((ref) {
  return NotificationsApi(client: ref.watch(apiClientProvider));
});
