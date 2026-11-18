/// 开始/结束日期选择器的统一边界：结束日期不得早于开始日期。
class DatePickerBounds {
  const DatePickerBounds._();

  static bool endOnOrAfter(DateTime day, DateTime? start) {
    if (start == null) return true;
    return !_dateOnly(day).isBefore(_dateOnly(start));
  }

  static DateTime? clampInitial(DateTime? initial, DateTime? start) {
    if (initial == null || start == null) return initial;
    return _dateOnly(initial).isBefore(_dateOnly(start)) ? _dateOnly(start) : initial;
  }

  static DateTime _dateOnly(DateTime value) => DateTime(value.year, value.month, value.day);
}
