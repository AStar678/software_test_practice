import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/company/company_date.dart';
import '../../../core/providers.dart';
import '../data/daily_items_api.dart';
import '../domain/daily_item.dart';

final dailyItemsApiProvider = Provider<DailyItemsApi>((ref) {
  return DailyItemsApi(
    client: ref.watch(apiClientProvider),
    clock: ref.watch(workspaceClockProvider),
  );
});

class MonthWindow {
  const MonthWindow({
    required this.key,
    required this.month,
    required this.generation,
    this.loading = false,
    this.complete = false,
    this.error,
    this.total = 0,
  });

  final String key;
  final CompanyDate month;
  final int generation;
  final bool loading;
  final bool complete;
  final Object? error;
  final int total;

  MonthWindow copyWith({
    bool? loading,
    bool? complete,
    Object? error,
    bool clearError = false,
    int? total,
    int? generation,
  }) {
    return MonthWindow(
      key: key,
      month: month,
      generation: generation ?? this.generation,
      loading: loading ?? this.loading,
      complete: complete ?? this.complete,
      error: clearError ? null : (error ?? this.error),
      total: total ?? this.total,
    );
  }
}

/// 范围事项缓存：按月加载全部页、按 ID 去重、失败保留已有内容并可重试。
class DailyItemsState {
  DailyItemsState({
    Map<String, DailyItem>? items,
    Map<String, MonthWindow>? months,
    Map<String, Set<String>>? monthItemIds,
    this.revision = 0,
  }) : items = items ?? <String, DailyItem>{},
       months = months ?? <String, MonthWindow>{},
       monthItemIds = monthItemIds ?? <String, Set<String>>{};

  final Map<String, DailyItem> items;
  final Map<String, MonthWindow> months;
  final Map<String, Set<String>> monthItemIds;
  final int revision;

  static String monthKey(CompanyDate month) =>
      '${month.year.toString().padLeft(4, '0')}-${month.month.toString().padLeft(2, '0')}';

  MonthWindow? windowFor(CompanyDate day) =>
      months[monthKey(CompanyDate(day.year, day.month, 1))];

  List<DailyItem> itemsOn(CompanyDate day) {
    final list = items.values.where((item) => item.covers(day)).toList()
      ..sort((a, b) {
        final createdCompare =
            (a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0)).compareTo(
              b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0),
            );
        return createdCompare != 0 ? createdCompare : a.id.compareTo(b.id);
      });
    return list;
  }

  DailyItem? byId(String id) => items[id];

  Set<String> get loadedMonths => months.keys.toSet();
}

final dailyItemsProvider =
    NotifierProvider<DailyItemsController, DailyItemsState>(
      DailyItemsController.new,
    );

class DailyItemsController extends Notifier<DailyItemsState> {
  static const int _pageSize = 50;

  @override
  DailyItemsState build() {
    ref.watch(accountEpochProvider);
    return DailyItemsState();
  }

  DailyItemsApi get _api => ref.read(dailyItemsApiProvider);

  /// 确保这些月份已完整读取；失败月份保留已有内容并记录可重试错误。
  Future<void> ensureMonths(Iterable<CompanyDate> months) async {
    final epoch = ref.read(accountEpochProvider);
    for (final monthDate in months) {
      if (!ref.mounted || ref.read(accountEpochProvider) != epoch) return;
      final month = CompanyDate(monthDate.year, monthDate.month, 1);
      final key = DailyItemsState.monthKey(month);
      final existing = state.months[key];
      if (existing != null &&
          (existing.loading || existing.complete || existing.error != null)) {
        continue;
      }
      await _loadMonth(month, generation: (existing?.generation ?? 0) + 1);
    }
  }

  Future<void> retryMonth(CompanyDate monthDate) async {
    final month = CompanyDate(monthDate.year, monthDate.month, 1);
    final key = DailyItemsState.monthKey(month);
    final existing = state.months[key];
    await _loadMonth(month, generation: (existing?.generation ?? 0) + 1);
  }

  Future<void> _loadMonth(CompanyDate month, {required int generation}) async {
    final epoch = ref.read(accountEpochProvider);
    final key = DailyItemsState.monthKey(month);
    final range = CompanyDateRange(month.firstDayOfMonth, month.lastDayOfMonth);
    state.months[key] = MonthWindow(
      key: key,
      month: month,
      generation: generation,
      loading: true,
      complete: false,
    );
    _bump();

    final collected = <String, DailyItem>{};
    var offset = 0;
    int? expectedTotal;
    var total = 0;
    try {
      for (var pageIndex = 0; pageIndex < 120; pageIndex++) {
        final page = await _api.listRange(
          range,
          limit: _pageSize,
          offset: offset,
        );
        if (!_isCurrent(key, generation, epoch)) return;
        if (expectedTotal != null && page.total != expectedTotal) {
          throw StateError('事项数量正在变化，请重试。');
        }
        total = page.total;
        expectedTotal = total;
        for (final item in page.items) {
          collected[item.id] = item;
        }
        final next = page.nextOffset;
        if (next == null) break;
        if (next <= offset) throw StateError('事项分页异常，请重试。');
        offset = next;
      }
      if (collected.length != expectedTotal) {
        throw StateError('事项正在其他会话中变化，请重试加载。');
      }
      if (!_isCurrent(key, generation, epoch)) return;
      _mergeMonth(key, collected);
      state.months[key] = MonthWindow(
        key: key,
        month: month,
        generation: generation,
        complete: true,
        total: total,
      );
      _bump();
    } catch (error) {
      if (!_isCurrent(key, generation, epoch)) return;
      // 失败前已读到的页也保留，且明确标记未完整。
      for (final item in collected.values) {
        state.items[item.id] = item;
      }
      final ids = state.monthItemIds.putIfAbsent(key, () => <String>{});
      ids.addAll(collected.keys);
      state.months[key] = MonthWindow(
        key: key,
        month: month,
        generation: generation,
        error: error,
        total: total,
      );
      _bump();
    }
  }

  bool _isCurrent(String key, int generation, int epoch) =>
      ref.mounted &&
      ref.read(accountEpochProvider) == epoch &&
      state.months[key]?.generation == generation;

  void _mergeMonth(String key, Map<String, DailyItem> collected) {
    final previousIds = state.monthItemIds[key] ?? <String>{};
    state.monthItemIds[key] = collected.keys.toSet();
    for (final entry in collected.entries) {
      state.items[entry.key] = entry.value;
    }
    for (final removedId in previousIds.difference(collected.keys.toSet())) {
      final stillReferenced = state.monthItemIds.entries.any(
        (entry) => entry.key != key && entry.value.contains(removedId),
      );
      if (!stillReferenced) {
        state.items.remove(removedId);
      }
    }
  }

  /// 写操作成功后重取全部受影响月份（旧范围与新范围）。
  Future<void> refreshCoverage(Iterable<CompanyDate> days) async {
    final epoch = ref.read(accountEpochProvider);
    final months = <String, CompanyDate>{};
    for (final day in days) {
      final month = CompanyDate(day.year, day.month, 1);
      final key = DailyItemsState.monthKey(month);
      if (state.months.containsKey(key)) months[key] = month;
    }
    for (final entry in months.entries) {
      if (!ref.mounted || ref.read(accountEpochProvider) != epoch) return;
      final window = state.months[entry.key];
      await _loadMonth(entry.value, generation: (window?.generation ?? 0) + 1);
    }
  }

  Future<DailyItem> createItem({
    required CompanyDate start,
    required CompanyDate end,
    required String body,
    bool allDay = true,
    String? startTime,
    String? endTime,
  }) async {
    final keys = ref.read(operationKeysProvider);
    final payload = <String, Object?>{
      'startDate': start.iso,
      'endDate': end.iso,
      'allDay': allDay,
      if (!allDay) ...{'startTime': startTime, 'endTime': endTime},
      'body': body,
    };
    final key = keys.keyFor(
      scope: 'daily-item:create',
      method: 'POST',
      path: '/daily-items',
      body: payload,
    );
    final item = await _api.create(
      start: start,
      end: end,
      body: body,
      allDay: allDay,
      startTime: startTime,
      endTime: endTime,
      idempotencyKey: key,
    );
    keys.complete('daily-item:create');
    await refreshCoverage(item.coveredDates);
    return item;
  }

  Future<DailyItem> updateItem({
    required DailyItem original,
    required String body,
    required CompanyDate start,
    required CompanyDate end,
    bool? allDay,
    String? startTime,
    String? endTime,
  }) async {
    final keys = ref.read(operationKeysProvider);
    final mode = allDay ?? original.allDay;
    final payload = <String, Object?>{
      'body': body,
      'startDate': start.iso,
      'endDate': end.iso,
      'allDay': mode,
      if (!mode) ...{
        'startTime': startTime ?? original.startTime,
        'endTime': endTime ?? original.endTime,
      },
    };
    final key = keys.keyFor(
      scope: 'daily-item:edit:${original.id}',
      method: 'PATCH',
      path: '/daily-items/${original.id}',
      body: payload,
    );
    final item = await _api.change(
      id: original.id,
      body: body,
      start: start,
      end: end,
      allDay: mode,
      startTime: startTime ?? original.startTime,
      endTime: endTime ?? original.endTime,
      idempotencyKey: key,
    );
    keys.complete('daily-item:edit:${original.id}');
    await refreshCoverage([...original.coveredDates, ...item.coveredDates]);
    return item;
  }

  /// Absolute dates and the version captured at drag start: retries cannot shift twice
  /// or silently overwrite a change made while the confirmation was open.
  Future<DailyItem> moveItem({
    required DailyItem original,
    required int days,
  }) async {
    if (days == 0) return original;
    final epoch = ref.read(accountEpochProvider);
    final api = _api;
    final target = original.shifted(days);
    final keys = ref.read(operationKeysProvider);
    final scope = 'daily-item:move:${original.id}';
    final version = '"${original.rowVersion}"';
    final payload = {
      'startDate': target.startDate.iso,
      'endDate': target.endDate.iso,
    };
    final key = keys.keyFor(
      scope: scope,
      method: 'PATCH',
      path: '/daily-items/${original.id}',
      body: payload,
      ifMatch: version,
    );
    final updated = await api.change(
      id: original.id,
      start: target.startDate,
      end: target.endDate,
      idempotencyKey: key,
      ifMatch: version,
    );
    if (!ref.mounted || ref.read(accountEpochProvider) != epoch) return updated;
    keys.complete(scope);
    await refreshCoverage([...original.coveredDates, ...updated.coveredDates]);
    return updated;
  }

  Future<DailyItem> toggleCompleted(DailyItem item) async {
    final keys = ref.read(operationKeysProvider);
    final target = !item.isCompleted;
    final scope = 'daily-item:complete:${item.id}:$target';
    // 列表数据不带 ETag；完成前读取一次详情，拿到真实版本再提交。
    await _api.detail(item.id);
    final key = keys.keyFor(
      scope: scope,
      method: 'PATCH',
      path: '/daily-items/${item.id}',
      body: {'completed': target},
    );
    final updated = await _api.change(
      id: item.id,
      completed: target,
      idempotencyKey: key,
    );
    keys.complete(scope);
    await refreshCoverage(item.coveredDates);
    return updated;
  }

  Future<void> deleteItem(DailyItem item) async {
    final keys = ref.read(operationKeysProvider);
    final scope = 'daily-item:delete:${item.id}';
    final key = keys.keyFor(
      scope: scope,
      method: 'DELETE',
      path: '/daily-items/${item.id}',
    );
    await _api.delete(id: item.id, idempotencyKey: key);
    keys.complete(scope);
    await refreshCoverage(item.coveredDates);
  }

  void _bump() {
    state = DailyItemsState(
      items: state.items,
      months: state.months,
      monthItemIds: state.monthItemIds,
      revision: state.revision + 1,
    );
  }
}
