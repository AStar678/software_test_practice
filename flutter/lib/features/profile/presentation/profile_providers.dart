import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/profile_api.dart';

final profileApiProvider = Provider<ProfileApi>((ref) {
  return ProfileApi(client: ref.watch(apiClientProvider));
});

final selfProfileProvider = FutureProvider((ref) async {
  ref.watch(accountEpochProvider);
  return ref.watch(profileApiProvider).self();
});

final personProfileProvider = FutureProvider.family((ref, String id) async {
  ref.watch(accountEpochProvider);
  return ref.watch(profileApiProvider).person(id);
});
