import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/features/auth/domain/password_policy.dart';

void main() {
  for (final password in [
    'Abcdefghi1',
    '${'a' * 71}1',
    'a1${'😀' * 17}ab',
  ]) {
    test('正常与精确上界：${password.runes.length} 码点的密码符合后端策略', () {
      expect(PasswordPolicy.validateNewPassword(password), isNull);
    });
  }
  for (final password in [
    'Abcdefgh1',
    '${'a' * 72}1',
    'a1${'汉' * 23}ab',
  ]) {
    test('首次越界：${password.runes.length} 码点或 UTF-8 超限的密码被拒绝', () {
      expect(PasswordPolicy.validateNewPassword(password), isNotNull);
    });
  }
  test('跨端等价类：中文属于字母，十个码点且含数字的密码应与后端一致', () {
    expect(PasswordPolicy.validateNewPassword('${'汉' * 9}1'), isNull);
  });
  test('跨端下界：九个 Unicode 码点不能因 UTF-16 代理对变长而通过', () {
    expect(PasswordPolicy.validateNewPassword('a1${'😀' * 7}'), isNotNull);
  });
}
