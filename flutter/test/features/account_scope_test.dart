import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/company/company_date.dart';
import 'package:pandora_employee/core/providers.dart';
import 'package:pandora_employee/features/daily_items/domain/daily_item.dart';
import 'package:pandora_employee/features/daily_items/presentation/daily_items_providers.dart';

class _EpochNotifier extends Notifier<int> {
  @override
  int build() => 1;

  void set(int value) => state = value;
}

final _testEpochProvider = NotifierProvider<_EpochNotifier, int>(_EpochNotifier.new);

void main() {
  test('账号代次变化后账号范围缓存重建，旧账号数据不进入新账号', () {
    final container = ProviderContainer(
      overrides: [
        accountEpochProvider.overrideWith((ref) => ref.watch(_testEpochProvider)),
      ],
    );
    addTearDown(container.dispose);

    final first = container.read(dailyItemsProvider);
    first.items['legacy'] = DailyItem(
      id: 'legacy',
      body: '旧账号缓存',
      startDate: const CompanyDate(2026, 11, 10),
      endDate: const CompanyDate(2026, 11, 10),
      completed: false,
      status: 'open',
      rowVersion: 1,
    );

    container.read(_testEpochProvider.notifier).set(2);

    final second = container.read(dailyItemsProvider);
    expect(identical(first, second), isFalse, reason: '账号代次变化必须重建账号作用域状态');
    expect(second.items.containsKey('legacy'), isFalse, reason: '旧账号迟到数据不能留在新账号缓存');
    expect(second.months, isEmpty);
    expect(container.read(accountEpochProvider), 2);
  });
}
