import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/errors/app_error.dart';
import 'package:pandora_employee/core/net/http_error_mapper.dart';
import 'package:pandora_employee/features/auth/domain/password_policy.dart';

void main() {
  group('HTTP 错误', () {
    test('按状态码区分失权、失联、冲突与可重试', () {
      expect(mapHttpError(401, {'code': 'UNAUTHORIZED'}).isUnauthorized, isTrue);
      expect(mapHttpError(403, {'message': '无权'}).kind, ApiErrorKind.forbidden);
      expect(mapHttpError(404, {}).kind, ApiErrorKind.notFound);
      expect(mapHttpError(409, {'message': '版本冲突'}).isConflict, isTrue);
      expect(mapHttpError(412, {'message': '旧版本'}).isConflict, isTrue);
      expect(mapHttpError(428, {'message': '缺少条件'}).kind, ApiErrorKind.validation);
      expect(mapHttpError(500, {}).retryable, isTrue);
      expect(mapHttpError(400, {'code': 'INVALID_INPUT', 'message': '不合法'}).message, '不合法');
    });

    test('错误信息不会伪装成空集合或成功', () {
      final error = mapHttpError(403, {});
      expect(error.isForbidden, isTrue);
      expect(error.message, isNotEmpty);
    });
  });

  group('密码策略', () {
    test('至少十位、含字母数字、UTF-8 至多 72 字节', () {
      expect(PasswordPolicy.validateNewPassword('abc123'), isNotNull);
      expect(PasswordPolicy.validateNewPassword('abcdefghij'), isNotNull);
      expect(PasswordPolicy.validateNewPassword('1234567890'), isNotNull);
      expect(PasswordPolicy.validateNewPassword('Abcdef1234'), isNull);
      expect(PasswordPolicy.validateNewPassword('Abcdefgh密12'), isNull);
      expect(PasswordPolicy.validateNewPassword('A1${'密' * 24}'), isNotNull); // 3*24+2 > 72 字节
      expect(PasswordPolicy.validateConfirmation('Abcdef1234', 'Abcdef1235'), isNotNull);
      expect(PasswordPolicy.validateConfirmation('Abcdef1234', 'Abcdef1234'), isNull);
    });

    test('UTF-16 长度与服务端 Java String 同口径，Java trim 只去 U+0000–U+0020', () {
      expect(PasswordPolicy.utf16Length('ab😀'), 4);
      expect(PasswordPolicy.javaTrim(' \t\u0000正文\n'), '正文');
      expect(PasswordPolicy.javaTrim('\u00a0正文\u00a0'), '\u00a0正文\u00a0');
    });
  });
}
