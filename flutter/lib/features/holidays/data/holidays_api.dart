import '../../../core/net/api_client.dart';
import '../domain/holiday_calendar.dart';

class HolidaysApi {
  const HolidaysApi({required this.client});
  final ApiClient client;

  Future<HolidayYear> year(int year) async {
    final result = await client.get<HolidayYear>(
      '/calendar/holidays/$year',
      decode: (json) => HolidayYear.fromJson(asJsonMap(json)),
    );
    return result.data;
  }
}

class HolidayRepository {
  HolidayRepository(this.api);
  final HolidaysApi api;
  final Map<int, HolidayYear> _cache = {};

  HolidayYear? cached(int year) => _cache[year];

  Future<HolidayYear> load(int year, {bool refresh = false}) async {
    if (!refresh && _cache[year] != null) return _cache[year]!;
    try {
      final value = await api.year(year);
      _cache[year] = value;
      return value;
    } catch (error) {
      final previous = _cache[year];
      if (previous != null && previous.days.isNotEmpty) {
        final stale = previous.asStale(error.toString());
        _cache[year] = stale;
        return stale;
      }
      rethrow;
    }
  }

  void clear() => _cache.clear();
}
