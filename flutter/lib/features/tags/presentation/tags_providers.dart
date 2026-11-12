import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/tags_api.dart';

final tagsApiProvider = Provider<TagsApi>((ref) {
  return TagsApi(client: ref.watch(apiClientProvider), versions: ref.watch(versionRegistryProvider));
});
