import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import 'company_date.dart';

/// 公司时区适配：所有“公司日期”由服务端 businessDate 与本时区推导，
/// 不使用设备本地时区解释 UTC 时间戳。
class CompanyTimeZone {
  CompanyTimeZone._(this.location, this.name);

  final tz.Location location;
  final String name;

  static bool _initialized = false;

  static void ensureInitialized() {
    if (_initialized) return;
    tzdata.initializeTimeZones();
    _initialized = true;
  }

  /// 服务端返回的 IANA 名称；未知名称回退到固定公司时区而不是设备时区。
  factory CompanyTimeZone.fromName(String? name) {
    ensureInitialized();
    final candidate = (name == null || name.trim().isEmpty) ? 'Asia/Shanghai' : name.trim();
    try {
      return CompanyTimeZone._(tz.getLocation(candidate), candidate);
    } on tz.LocationNotFoundException {
      return CompanyTimeZone._(tz.getLocation('Asia/Shanghai'), 'Asia/Shanghai');
    }
  }

  static final CompanyTimeZone fallback = CompanyTimeZone.fromName('Asia/Shanghai');

  tz.TZDateTime toLocal(DateTime instant) => tz.TZDateTime.from(instant.toUtc(), location);

  CompanyDate dateOf(DateTime instant) {
    final local = toLocal(instant);
    return CompanyDate(local.year, local.month, local.day);
  }

  /// 公司日 00:00 的绝对时刻。
  DateTime dayStart(CompanyDate date) => tz.TZDateTime(location, date.year, date.month, date.day);

  /// 次日 00:00（半开区间的右端，不占次日）。
  DateTime nextDayStart(CompanyDate date) => dayStart(date.addDays(1));

  /// 把公司日期 + 小时/分钟转成绝对时刻。
  DateTime at(CompanyDate date, {int hour = 0, int minute = 0, int second = 0}) =>
      tz.TZDateTime(location, date.year, date.month, date.day, hour, minute, second);

  /// 设备时区变化不会改变这里的结果：格式化只读取公司时区。
  String formatTime(DateTime instant) {
    final local = toLocal(instant);
    return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }

  String formatDate(DateTime instant) => dateOf(instant).iso;

  String formatDateTime(DateTime instant) {
    final local = toLocal(instant);
    return '${local.year}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')} '
        '${formatTime(instant)}';
  }

  /// 相对日期文案（仅用于日志卡片等按 businessDate 排序的场景）。
  String relativeDateLabel(CompanyDate target, CompanyDate today) {
    final diff = target.differenceInDays(today);
    return switch (diff) {
      0 => '今天',
      -1 => '昨天',
      -2 => '前天',
      1 => '明天',
      _ => target.iso,
    };
  }
}

/// 定时/旧全天的有效时段覆盖判断（半开区间，零时长归开始日）。
class ScheduleCoverage {
  const ScheduleCoverage._();

  /// 旧全天：startDate–dueDate 首尾都包含。
  static bool coversAllDay(CompanyDate day, CompanyDate start, CompanyDate endInclusive) =>
      !day.isBefore(start) && !day.isAfter(endInclusive);

  /// 定时 `[start, due)` 与公司日 `[dayStart, nextDayStart)` 相交。
  static bool coversTimed(CompanyDate day, DateTime start, DateTime due, CompanyTimeZone zone) {
    if (start == due) {
      return zone.dateOf(start) == day;
    }
    final dayStart = zone.dayStart(day);
    final dayEnd = zone.nextDayStart(day);
    return start.isBefore(dayEnd) && due.isAfter(dayStart);
  }

  /// 当天可视时段（裁剪到公司日边界）。
  static ({int startMinutes, int endMinutes}) visibleMinutes(DateTime start, DateTime due, CompanyDate day, CompanyTimeZone zone) {
    final dayStart = zone.dayStart(day);
    final dayEnd = zone.nextDayStart(day);
    final effectiveStart = start.isBefore(dayStart) ? dayStart : start;
    final effectiveEnd = due.isAfter(dayEnd) ? dayEnd : due;
    final localStart = zone.toLocal(effectiveStart);
    final localEnd = zone.toLocal(effectiveEnd);
    final startMinutes = localStart.hour * 60 + localStart.minute;
    var endMinutes = localEnd.hour * 60 + localEnd.minute;
    if (endMinutes == 0 && zone.dateOf(effectiveEnd) != zone.dateOf(effectiveStart)) {
      endMinutes = 24 * 60;
    }
    return (startMinutes: startMinutes, endMinutes: endMinutes);
  }
}
