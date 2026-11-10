import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/home_api.dart';
import '../domain/home_data.dart';

final homeApiProvider = Provider<HomeApi>((ref) {
  return HomeApi(
    client: ref.watch(apiClientProvider),
    clock: ref.watch(workspaceClockProvider),
  );
});

/// 首页数据：账号切换自动重建；业务日以服务端为准。
final homeDataProvider = AsyncNotifierProvider<HomeDataNotifier, HomeData>(HomeDataNotifier.new);

class HomeDataNotifier extends AsyncNotifier<HomeData> {
  @override
  Future<HomeData> build() async {
    ref.watch(accountEpochProvider);
    return ref.watch(homeApiProvider).load();
  }

  Future<void> refresh() async {
    state = const AsyncLoading<HomeData>();
    state = await AsyncValue.guard(() => ref.read(homeApiProvider).load());
  }
}
