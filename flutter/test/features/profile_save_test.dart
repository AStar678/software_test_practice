import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:pandora_employee/features/profile/presentation/profile_pages.dart';
import 'package:pandora_employee/features/profile/presentation/profile_providers.dart';
import 'package:pandora_employee/features/profile/presentation/profile_widgets.dart';

import '../support/test_harness.dart';

void main() {
  testWidgets('stale profile refresh preserves the draft and other edits', (
    tester,
  ) async {
    var version = 1;
    var email = 'old@example.test';
    var avatar = 'cat';
    var failRead = false;
    final backend = FakeBackend();
    backend.on('GET', '/me/profile', (_) {
      if (failRead) return FakeResponse({'message': '读取失败'}, status: 503);
      return FakeResponse({
        'id': 'u1',
        'displayName': '员工',
        'email': email,
        'avatar': avatar,
      }, etag: '"$version"');
    });
    backend.on('PATCH', '/me/profile', (request) {
      if (request.headers['If-Match'] != '"$version"') {
        return FakeResponse({'message': '资料已更新'}, status: 412);
      }
      expect(request.jsonBody, {'email': 'draft@example.test'});
      email = request.jsonBody['email']! as String;
      version++;
      failRead = true;
      return FakeResponse({'rowVersion': version}, etag: '"$version"');
    });
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      wrapWithScope(
        container,
        const Scaffold(body: SingleChildScrollView(child: SelfProfileCard())),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('编辑头像和邮箱'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'draft@example.test');

    version = 2;
    avatar = 'bear';
    await tester.runAsync(() => container.read(profileApiProvider).self());
    await tester.tap(find.text('保存'));
    await tester.pumpAndSettle();
    expect(find.text('资料已更新'), findsOneWidget);
    await tester.tap(find.text('重新读取'));
    await tester.pumpAndSettle();
    expect(find.text('draft@example.test'), findsOneWidget);
    final bear = tester.widget<ChoiceChip>(
      find.widgetWithText(ChoiceChip, '🐻 小熊'),
    );
    expect(bear.selected, isTrue);

    await tester.tap(find.text('保存'));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);
    expect(email, 'draft@example.test');
    expect(avatar, 'bear');
    final writes = backend.requestsFor('PATCH', '/me/profile');
    expect(writes.map((request) => request.headers['If-Match']), [
      '"1"',
      '"2"',
    ]);
    expect(
      writes.first.headers['Idempotency-Key'],
      isNot(writes.last.headers['Idempotency-Key']),
    );
  });

  testWidgets('profile avatar renders previously saved PNG images', (
    tester,
  ) async {
    final png = img.encodePng(img.Image(width: 1, height: 1));
    final avatar = 'data:image/png;base64,${base64Encode(png)}';
    await tester.pumpWidget(
      MaterialApp(
        home: ProfileAvatar(avatar: avatar, name: '员工'),
      ),
    );
    final widget = tester.widget<CircleAvatar>(find.byType(CircleAvatar));
    expect(widget.backgroundImage, isA<MemoryImage>());
  });
}
