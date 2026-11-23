import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/company/company_date.dart';

void main() {
  group('CompanyDate', () {
    test('严格解析并拒绝不存在的日期', () {
      expect(CompanyDate.parse('2026-11-10').iso, '2026-11-10');
      expect(() => CompanyDate.parse('2026-02-30'), throwsFormatException);
      expect(() => CompanyDate.parse('2026-2-3'), throwsFormatException);
      expect(() => CompanyDate.parse('2026-13-01'), throwsFormatException);
      expect(CompanyDate.tryParse('not-a-date'), isNull);
      expect(CompanyDate.tryParse('2024-02-29'), const CompanyDate(2024, 2, 29));
      expect(CompanyDate.tryParse('2023-02-29'), isNull);
    });

    test('跨年、闰日与周起点按 UTC 日序号计算', () {
      expect(CompanyDate.parse('2026-12-31').addDays(1), const CompanyDate(2027, 1, 1));
      expect(CompanyDate.parse('2024-02-29').addDays(1), const CompanyDate(2024, 3, 1));
      expect(CompanyDate.parse('2026-03-01').addDays(-1), const CompanyDate(2026, 2, 28));
      expect(CompanyDate.parse('2026-11-08').differenceInDays(const CompanyDate(2026, 11, 10)), -2);
      expect(const CompanyDate(2026, 11, 9).weekday, 1); // 周一
      expect(const CompanyDate(2026, 11, 8).weekday, 7); // 周日
      expect(const CompanyDate(2026, 11, 10).mondayOfWeek, const CompanyDate(2026, 11, 9));
    });

    test('月份网格从 1 号所在周一开始，跨年月份正确', () {
      final november = const CompanyDate(2026, 11, 1);
      expect(CompanyCalendarGrid.gridStart(november), const CompanyDate(2026, 10, 26));
      expect(CompanyCalendarGrid.weekCount(november), 6);
      final december = const CompanyDate(2026, 12, 1);
      expect(CompanyCalendarGrid.gridStart(december).weekday, 1);
      expect(CompanyCalendarGrid.weekCount(december), 5);
      expect(CompanyCalendarGrid.monthIndex(november), 2026 * 12 + 10);
      expect(CompanyCalendarGrid.monthFromIndex(CompanyCalendarGrid.monthIndex(november)), november);
    });

    test('区间首尾包含、按 93 日窗口切分且不漏不重', () {
      final range = CompanyDateRange(const CompanyDate(2026, 1, 1), const CompanyDate(2026, 12, 31));
      expect(range.contains(const CompanyDate(2026, 1, 1)), isTrue);
      expect(range.contains(const CompanyDate(2026, 12, 31)), isTrue);
      expect(range.contains(const CompanyDate(2027, 1, 1)), isFalse);
      expect(range.dayCount, 365);

      final windows = range.splitByWindow();
      expect(windows.every((window) => window.dayCount <= 93), isTrue);
      expect(windows.first.start, range.start);
      expect(windows.last.end, range.end);
      for (var index = 1; index < windows.length; index++) {
        expect(windows[index].start, windows[index - 1].end.addDays(1));
      }
      final allDays = windows.expand((window) => window.days).toList();
      expect(allDays.length, 365);
      expect(allDays.toSet().length, 365);
    });

    test('区间窗口长度上限', () {
      final window = CompanyDateRange.window(const CompanyDate(2026, 1, 1), const CompanyDate(2026, 6, 1));
      expect(window.dayCount, 93);
      expect(window.end, window.start.addDays(92));
    });
  });
}
