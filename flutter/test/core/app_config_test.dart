import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/config/app_config.dart';

void main() {
  test('课程演示接受宿主机与无证书服务器HTTP；可选release保持HTTPS', () {
    for (final url in [
      'http://10.0.2.2:8080/api/v1',
      'http://192.0.2.10:8080/api/v1',
      'http://course.example/api/v1',
      'https://course.example/api/v1',
    ]) {
      expect(
        AppConfig(apiBaseUrl: url, isDebug: true).isTransportAllowed,
        isTrue,
      );
    }
    expect(
      const AppConfig(
        apiBaseUrl: 'http://course.example/api/v1',
        isDebug: false,
      ).isTransportAllowed,
      isFalse,
    );
    expect(
      const AppConfig(
        apiBaseUrl: 'https://course.example/api/v1',
        isDebug: false,
      ).isTransportAllowed,
      isTrue,
    );
  });

  test('服务地址缺主机/路径或混入凭证和查询时不允许业务请求', () {
    for (final url in [
      '',
      'file:///api/v1',
      'http:/api/v1',
      'http://course.example',
      'http://name:password@course.example/api/v1',
      'http://course.example/api/v1?token=secret',
      'http://course.example/api/v1#fragment',
    ]) {
      expect(
        AppConfig(apiBaseUrl: url, isDebug: true).isTransportAllowed,
        isFalse,
      );
    }
  });
}
