import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/company/company_date.dart';
import 'package:pandora_employee/core/company/company_time.dart';

void main() {
  final zone = CompanyTimeZone.fromName('Asia/Shanghai');

  group('公司时区与排期覆盖', () {
    test('UTC 午夜截止不进入次日，零时长归开始日', () {
      // 2026-11-10T16:00Z = 上海 2026-11-11 00:00，仍是 11-10 的截止时刻。
      final dueMidnight = DateTime.utc(2026, 11, 10, 16);
      final start = DateTime.utc(2026, 11, 10, 1);
      expect(ScheduleCoverage.coversTimed(const CompanyDate(2026, 11, 10), start, dueMidnight, zone), isTrue);
      expect(ScheduleCoverage.coversTimed(const CompanyDate(2026, 11, 11), start, dueMidnight, zone), isFalse);

      final zero = DateTime.utc(2026, 11, 10, 2);
      expect(ScheduleCoverage.coversTimed(const CompanyDate(2026, 11, 10), zero, zero, zone), isTrue);
      expect(ScheduleCoverage.coversTimed(const CompanyDate(2026, 11, 9), zero, zero, zone), isFalse);
    });

    test('同一 UTC 时刻按公司时区归日，不受设备时区影响', () {
      final instant = DateTime.utc(2026, 11, 10, 18, 30); // 上海 11-11 02:30
      expect(zone.dateOf(instant), const CompanyDate(2026, 11, 11));
      expect(zone.formatTime(instant), '02:30');
      expect(CompanyTimeZone.fromName('America/New_York').dateOf(instant), const CompanyDate(2026, 11, 10));
    });

    test('旧全天首尾都包含', () {
      final start = const CompanyDate(2026, 11, 8);
      final end = const CompanyDate(2026, 11, 10);
      expect(ScheduleCoverage.coversAllDay(start, start, end), isTrue);
      expect(ScheduleCoverage.coversAllDay(end, start, end), isTrue);
      expect(ScheduleCoverage.coversAllDay(end.addDays(1), start, end), isFalse);
    });

    test('跨日任务在当天裁剪可见时段', () {
      // 11-09 21:00 → 11-10 03:00（上海）
      final start = DateTime.utc(2026, 11, 9, 13);
      final due = DateTime.utc(2026, 11, 9, 19);
      final visible = ScheduleCoverage.visibleMinutes(start, due, const CompanyDate(2026, 11, 9), zone);
      expect(visible.startMinutes, 21 * 60);
      expect(visible.endMinutes, 24 * 60);
    });

    test('未知时区回退到公司时区而不是设备时区', () {
      final fallback = CompanyTimeZone.fromName('Not/AZone');
      expect(fallback.name, 'Asia/Shanghai');
    });
  });
}
