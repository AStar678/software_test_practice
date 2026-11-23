import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/company/date_picker_bounds.dart';

void main() {
  test('结束日期不得早于开始日期', () {
    final start = DateTime(2026, 11, 10);
    expect(DatePickerBounds.endOnOrAfter(DateTime(2026, 11, 9), start), isFalse);
    expect(DatePickerBounds.endOnOrAfter(DateTime(2026, 11, 10), start), isTrue);
    expect(DatePickerBounds.endOnOrAfter(DateTime(2026, 12, 1), start), isTrue);
    expect(DatePickerBounds.endOnOrAfter(DateTime(2026, 11, 9), null), isTrue);
  });

  test('结束初始日期早于开始日期时收敛到开始日', () {
    final start = DateTime(2026, 11, 10);
    expect(DatePickerBounds.clampInitial(DateTime(2026, 11, 8), start), start);
    expect(DatePickerBounds.clampInitial(DateTime(2026, 11, 12), start), DateTime(2026, 11, 12));
  });
}
