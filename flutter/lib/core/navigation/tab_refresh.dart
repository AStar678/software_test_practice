import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 五个底部导航入口；刷新代次按入口独立，重复点击当前入口也会递增。
enum AppTab { home, company, logs, stats, me }

/// 页面级刷新信号。只触发目标页重新读取数据，不重建导航分支、滚动或表单状态。
final tabRefreshProvider =
    NotifierProvider<TabRefreshNotifier, Map<AppTab, int>>(
      TabRefreshNotifier.new,
    );

class TabRefreshNotifier extends Notifier<Map<AppTab, int>> {
  @override
  Map<AppTab, int> build() => {for (final tab in AppTab.values) tab: 0};

  void bump(AppTab tab) {
    state = {...state, tab: (state[tab] ?? 0) + 1};
  }

  int generation(AppTab tab) => state[tab] ?? 0;
}

extension TabRefreshListen on WidgetRef {
  /// 在 build 中注册；代次变化时调用页面自己的刷新方法。
  void listenTabRefresh(AppTab tab, void Function() refresh) {
    listen<int>(
      tabRefreshProvider.select((state) => state[tab] ?? 0),
      (previous, next) {
        if (previous != null && previous != next) refresh();
      },
    );
  }
}
