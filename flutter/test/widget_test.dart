import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/company/company_date.dart';

void main() {
  test('company date parses and adds days without device timezone', () {
    final date = CompanyDate.parse('2026-02-28');
    expect(date.addDays(1), const CompanyDate(2026, 3, 1));
    expect(CompanyDate.parse('2024-02-29').isValid, isTrue);
  });
}
