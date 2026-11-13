import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/holidays_api.dart';

final holidaysApiProvider = Provider<HolidaysApi>((ref) {
  return HolidaysApi(client: ref.watch(apiClientProvider));
});

final holidayRepositoryProvider = Provider<HolidayRepository>((ref) {
  ref.watch(accountEpochProvider);
  final repository = HolidayRepository(ref.watch(holidaysApiProvider));
  ref.onDispose(repository.clear);
  return repository;
});
