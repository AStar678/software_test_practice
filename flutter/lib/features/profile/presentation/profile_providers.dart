import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/providers.dart';
import '../data/profile_api.dart';

final profileImagePickerProvider = Provider<ImagePicker>(
  (ref) => ImagePicker(),
);

final profileApiProvider = Provider<ProfileApi>((ref) {
  return ProfileApi(client: ref.watch(apiClientProvider));
});

final selfProfileProvider = FutureProvider((ref) async {
  ref.watch(accountEpochProvider);
  ref.watch(currentUserProvider.select((user) => user?.authzVersion));
  return ref.watch(profileApiProvider).selfWithVersion();
});

final personProfileProvider = FutureProvider.autoDispose.family((
  ref,
  String id,
) async {
  ref.watch(accountEpochProvider);
  ref.watch(currentUserProvider.select((user) => user?.authzVersion));
  return ref.watch(profileApiProvider).person(id);
});
