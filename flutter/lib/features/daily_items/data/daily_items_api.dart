import '../../../core/company/company_date.dart';
import '../../../core/company/workspace_clock.dart';
import '../../../core/net/api_client.dart';
import '../../../core/net/version_registry.dart';
import '../domain/daily_item.dart';

/// 范围每日事项端点适配：日期对、93 日窗口、nextOffset 分页与版本来源都单独处理。
class DailyItemsApi {
  // ignore: prefer_initializing_formals
  DailyItemsApi({required ApiClient client, required WorkspaceClock clock})
      // ignore: prefer_initializing_formals
      : _client = client,
        // ignore: prefer_initializing_formals
        _clock = clock;

  final ApiClient _client;
  final WorkspaceClock _clock;

  Future<DailyItemPage> listByDay(CompanyDate day, {int limit = 50, int offset = 0}) async {
    final result = await _client.get<DailyItemPage>(
      '/daily-items',
      query: {'date': day.iso, 'limit': limit, 'offset': offset},
      decode: _decodePage,
    );
    return result.data;
  }

  Future<DailyItemPage> listRange(CompanyDateRange range, {int limit = 50, int offset = 0}) async {
    if (range.dayCount > 93) {
      throw ArgumentError('每日事项查询窗口最多 93 天');
    }
    final result = await _client.get<DailyItemPage>(
      '/daily-items',
      query: {'from': range.start.iso, 'to': range.end.iso, 'limit': limit, 'offset': offset},
      decode: _decodePage,
    );
    return result.data;
  }

  Future<DailyItemSummary> summary(CompanyDateRange range) async {
    final result = await _client.get<DailyItemSummary>(
      '/daily-items/summary',
      query: {'from': range.start.iso, 'to': range.end.iso},
      decode: (json) {
        final map = asJsonMap(json);
        _observe(map);
        final days = <CompanyDate, DailyDayCount>{};
        for (final raw in asJsonList(map['days'])) {
          if (raw is! Map) continue;
          final item = Map<String, Object?>.from(raw);
          final date = CompanyDate.tryParse(item['date']?.toString());
          if (date == null) continue;
          days[date] = DailyDayCount(
            date: date,
            openCount: (item['openCount'] as num?)?.toInt() ?? 0,
            completedCount: (item['completedCount'] as num?)?.toInt() ?? 0,
          );
        }
        return DailyItemSummary(days: days, businessDate: map['businessDate']?.toString());
      },
    );
    return result.data;
  }

  /// 详情读取同时把 ETag 写入版本注册表，供 PATCH/DELETE 使用。
  Future<DailyItem> detail(String id) async {
    final result = await _client.get<DailyItem>(
      '/daily-items/$id',
      versionKey: VersionRegistry.dailyItem(id),
      decode: (json) {
        final map = asJsonMap(json);
        _observe(map);
        return DailyItem.fromJson(map);
      },
    );
    return result.data;
  }

  Future<DailyItem> create({
    required CompanyDate start,
    required CompanyDate end,
    required String body,
    required String idempotencyKey,
  }) async {
    final result = await _client.write<DailyItem>(
      method: 'POST',
      path: '/daily-items',
      body: {'startDate': start.iso, 'endDate': end.iso, 'body': body},
      idempotencyKey: idempotencyKey,
      decode: (json) => DailyItem.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<DailyItem> change({
    required String id,
    required String idempotencyKey,
    String? body,
    CompanyDate? start,
    CompanyDate? end,
    bool? completed,
  }) async {
    if ((start == null) != (end == null)) {
      throw ArgumentError('开始日与结束日必须同时提供或同时省略');
    }
    final payload = <String, Object?>{
      'body': ?body,
      if (start != null && end != null) 'startDate': start.iso,
      if (start != null && end != null) 'endDate': end.iso,
      'completed': ?completed,
    };
    // 版本以服务端返回的 rowVersion 为准；与读取的 ETag 同源。
    final result = await _client.write<DailyItem>(
      method: 'PATCH',
      path: '/daily-items/$id',
      body: payload,
      idempotencyKey: idempotencyKey,
      versionKey: VersionRegistry.dailyItem(id),
      requireVersion: true,
      decode: (json) => DailyItem.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  Future<void> delete({required String id, required String idempotencyKey}) async {
    await _client.write<void>(
      method: 'DELETE',
      path: '/daily-items/$id',
      body: const {},
      idempotencyKey: idempotencyKey,
      versionKey: VersionRegistry.dailyItem(id),
      requireVersion: true,
      decode: (_) {},
    );
  }

  DailyItemPage _decodePage(Object? json) {
    final map = asJsonMap(json);
    _observe(map);
    final items = <DailyItem>[
      for (final raw in asJsonList(map['items']))
        if (raw is Map) DailyItem.fromJson(Map<String, Object?>.from(raw)),
    ];
    return DailyItemPage(
      items: items,
      total: (map['total'] as num?)?.toInt() ?? items.length,
      nextOffset: (map['nextOffset'] as num?)?.toInt(),
      businessDate: map['businessDate']?.toString(),
      organizationTimeZone: map['organizationTimeZone']?.toString(),
      from: CompanyDate.tryParse(map['from']?.toString()),
      to: CompanyDate.tryParse(map['to']?.toString()),
      date: CompanyDate.tryParse(map['date']?.toString()),
    );
  }

  void _observe(Map<String, Object?> map) {
    _clock.updateBusinessDate(map['businessDate']?.toString());
    _clock.updateZone(map['organizationTimeZone']?.toString());
  }
}
