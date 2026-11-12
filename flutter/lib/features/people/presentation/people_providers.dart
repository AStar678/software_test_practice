import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/people_api.dart';

final peopleApiProvider = Provider<PeopleApi>((ref) {
  return PeopleApi(client: ref.watch(apiClientProvider));
});

final reportsProvider = FutureProvider((ref) async {
  ref.watch(accountEpochProvider);
  return ref.watch(peopleApiProvider).reports();
});
