import 'dart:math' as math;

/// 公司 date-only 值对象：只表示年月日，绝不通过设备时区重新解释。
class CompanyDate implements Comparable<CompanyDate> {
  const CompanyDate(this.year, this.month, this.day);

  final int year;
  final int month;
  final int day;

  static final RegExp _isoPattern = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$');

  /// 严格解析 `YYYY-MM-DD`；非法值（含 2026-02-30）抛出 [FormatException]。
  factory CompanyDate.parse(String input) {
    final match = _isoPattern.firstMatch(input);
    if (match == null) {
      throw FormatException('非法公司日期：$input');
    }
    final date = CompanyDate(
      int.parse(match.group(1)!),
      int.parse(match.group(2)!),
      int.parse(match.group(3)!),
    );
    if (!date.isValid) {
      throw FormatException('非法公司日期：$input');
    }
    return date;
  }

  /// 宽松解析：无法解析时返回 null，供适配未知/缺字段响应使用。
  static CompanyDate? tryParse(String? input) {
    if (input == null) return null;
    try {
      return CompanyDate.parse(input.trim());
    } on FormatException {
      return null;
    }
  }

  factory CompanyDate.fromDateTime(DateTime value) =>
      CompanyDate(value.year, value.month, value.day);

  bool get isValid {
    if (month < 1 || month > 12 || day < 1 || day > 31) return false;
    return day <= daysInMonth(year, month);
  }

  /// 相对 1970-01-01 的日序号，只在 UTC 上运算，避免夏令时影响。
  int get daysSinceEpoch => _utc.millisecondsSinceEpoch ~/ Duration.millisecondsPerDay;

  factory CompanyDate.fromDaysSinceEpoch(int days) {
    final value = DateTime.utc(1970, 1, 1).add(Duration(days: days));
    return CompanyDate(value.year, value.month, value.day);
  }

  DateTime get _utc => DateTime.utc(year, month, day);

  /// 周一 = 1 ... 周日 = 7。
  int get weekday => _utc.weekday;

  CompanyDate addDays(int days) {
    final base = DateTime.utc(year, month, day).add(Duration(days: days));
    return CompanyDate(base.year, base.month, base.day);
  }

  /// `this - other` 的整天数。
  int differenceInDays(CompanyDate other) => daysSinceEpoch - other.daysSinceEpoch;

  bool isBefore(CompanyDate other) => compareTo(other) < 0;

  bool isAfter(CompanyDate other) => compareTo(other) > 0;

  bool isSameDay(CompanyDate other) => compareTo(other) == 0;

  /// 该日所在周的周一。
  CompanyDate get mondayOfWeek => addDays(1 - weekday);

  /// 按月平移；目标月没有该日时截到月末（如 1 月 31 日 + 1 个月 = 2 月 28/29 日）。
  CompanyDate addMonths(int months) {
    final total = year * 12 + (month - 1) + months;
    final targetYear = (total / 12).floor();
    final targetMonth = total % 12 + 1;
    final targetDay = day.clamp(1, daysInMonth(targetYear, targetMonth));
    return CompanyDate(targetYear, targetMonth, targetDay);
  }

  CompanyDate get firstDayOfMonth => CompanyDate(year, month, 1);

  CompanyDate get lastDayOfMonth => CompanyDate(year, month, daysInMonth(year, month));

  CompanyDate get nextMonthFirst => month == 12 ? CompanyDate(year + 1, 1, 1) : CompanyDate(year, month + 1, 1);

  CompanyDate get previousMonthFirst => month == 1 ? CompanyDate(year - 1, 12, 1) : CompanyDate(year, month - 1, 1);

  String get iso => '${_pad(year, 4)}-${_pad(month, 2)}-${_pad(day, 2)}';

  static bool isLeapYear(int year) => (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;

  static int daysInMonth(int year, int month) {
    const days = <int>[31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month == 2 && isLeapYear(year)) return 29;
    return days[month - 1];
  }

  static String _pad(int value, int width) => value.toString().padLeft(width, '0');

  @override
  int compareTo(CompanyDate other) {
    if (year != other.year) return year.compareTo(other.year);
    if (month != other.month) return month.compareTo(other.month);
    return day.compareTo(other.day);
  }

  @override
  bool operator ==(Object other) =>
      other is CompanyDate && other.year == year && other.month == month && other.day == day;

  @override
  int get hashCode => Object.hash(year, month, day);

  @override
  String toString() => iso;
}

/// 首尾都包含的公司日期区间。
class CompanyDateRange {
  CompanyDateRange(this.start, this.end) {
    if (end.isBefore(start)) {
      throw ArgumentError('end 不能早于 start');
    }
  }

  final CompanyDate start;
  final CompanyDate end;

  int get dayCount => end.differenceInDays(start) + 1;

  bool contains(CompanyDate date) => !date.isBefore(start) && !date.isAfter(end);

  bool intersects(CompanyDateRange other) => !end.isBefore(other.start) && !start.isAfter(other.end);

  CompanyDateRange intersection(CompanyDateRange other) {
    final from = start.isAfter(other.start) ? start : other.start;
    final to = end.isBefore(other.end) ? end : other.end;
    return CompanyDateRange(from, to);
  }

  CompanyDateRange clampTo(CompanyDateRange window) => intersection(window);

  /// 按公司日期逐日枚举（含首尾）。
  Iterable<CompanyDate> get days sync* {
    for (var date = start; !date.isAfter(end); date = date.addDays(1)) {
      yield date;
    }
  }

  /// 截取最多 [maxDays] 天的查询窗口，服务端事项范围窗口为 93 天。
  static CompanyDateRange window(CompanyDate from, CompanyDate to, {int maxDays = 93}) {
    if (to.isBefore(from)) throw ArgumentError('to 不能早于 from');
    final span = to.differenceInDays(from) + 1;
    if (span <= maxDays) return CompanyDateRange(from, to);
    return CompanyDateRange(from, from.addDays(maxDays - 1));
  }

  /// 把区间按 [maxDays] 切成无重叠、无遗漏的窗口。
  List<CompanyDateRange> splitByWindow({int maxDays = 93}) {
    final windows = <CompanyDateRange>[];
    var cursor = start;
    while (!cursor.isAfter(end)) {
      final candidateEnd = cursor.addDays(maxDays - 1);
      final windowEnd = candidateEnd.isAfter(end) ? end : candidateEnd;
      windows.add(CompanyDateRange(cursor, windowEnd));
      cursor = windowEnd.addDays(1);
    }
    return windows;
  }

  @override
  bool operator ==(Object other) => other is CompanyDateRange && other.start == start && other.end == end;

  @override
  int get hashCode => Object.hash(start, end);

  @override
  String toString() => '$start..$end';
}

/// 纯日历网格辅助：月份从 1 号所在周开始，到月末所在周结束。
class CompanyCalendarGrid {
  const CompanyCalendarGrid._();

  static const List<String> weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'];

  /// 某月网格的周一（可能属于上月）。
  static CompanyDate gridStart(CompanyDate month) => month.firstDayOfMonth.mondayOfWeek;

  /// 某月网格覆盖的周数（4–6）。
  static int weekCount(CompanyDate month) {
    final start = gridStart(month);
    final last = month.lastDayOfMonth;
    return (last.differenceInDays(start) ~/ 7) + 1;
  }

  /// 某月网格内的全部占位日期（包含相邻月日期，由调用方决定是否留空）。
  static List<CompanyDate> gridDays(CompanyDate month) {
    final start = gridStart(month);
    return List<CompanyDate>.generate(weekCount(month) * 7, (index) => start.addDays(index));
  }

  /// 日期在该月网格内的列（0–6）与行（0–5）。
  static ({int column, int row}) cellOf(CompanyDate month, CompanyDate date) {
    final offset = date.differenceInDays(gridStart(month));
    return (column: offset % 7, row: offset ~/ 7);
  }

  static int monthIndex(CompanyDate date) => date.year * 12 + (date.month - 1);

  static CompanyDate monthFromIndex(int index) {
    final year = (index / 12).floor();
    final month = index % 12 + 1;
    return CompanyDate(year, month, 1);
  }

  /// 生成从 [anchor] 前后各 [monthsBefore]/[monthsAfter] 个月的连续月份。
  static List<CompanyDate> continuousMonths(CompanyDate anchor, {int monthsBefore = 12, int monthsAfter = 12}) {
    final base = monthIndex(anchor.firstDayOfMonth);
    return List<CompanyDate>.generate(
      monthsBefore + monthsAfter + 1,
      (index) => monthFromIndex(base - monthsBefore + index),
    );
  }

  static int clamp(int value, int min, int max) => math.min(math.max(value, min), max);
}
