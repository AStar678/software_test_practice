import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/preferences/app_preferences.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('日历模式、密度和日期按账号命名空间持久化', () async {
    SharedPreferences.setMockInitialValues({});
    final first = await AppPreferences.load('u1');
    await first.setString('calendar.mode', 'vertical');
    await first.setString('calendar.density', 'comfortable');
    await first.setString('calendar.lastDate', '2026-11-12');

    final again = await AppPreferences.load('u1');
    expect(again.getString('calendar.mode'), 'vertical');
    expect(again.getString('calendar.density'), 'comfortable');
    expect(again.getString('calendar.lastDate'), '2026-11-12');

    final other = await AppPreferences.load('u2');
    expect(other.getString('calendar.mode'), isNull);
    expect(other.getString('calendar.lastDate'), isNull);

    await again.clearAccount();
    final cleared = await AppPreferences.load('u1');
    expect(cleared.getString('calendar.mode'), isNull);
    final untouched = await AppPreferences.load('u2');
    expect(untouched.getString('calendar.mode'), isNull);
  });
}
