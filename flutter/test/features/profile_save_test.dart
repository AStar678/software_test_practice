import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:pandora_employee/features/profile/domain/avatar_processor.dart';
import 'package:pandora_employee/features/profile/presentation/profile_pages.dart';
import 'package:pandora_employee/features/profile/presentation/profile_providers.dart';
import 'package:pandora_employee/features/profile/presentation/profile_widgets.dart';
import 'package:pandora_employee/features/shell/destination_pages.dart';

import '../support/test_harness.dart';

void main() {
  testWidgets('320短屏大字从资料卡内部滑动仍能到达编辑和设置', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final backend = FakeBackend();
    backend.on('GET', '/me/profile', (_) => FakeResponse({
      'id': 'u1',
      'displayName': '亚里士多德',
      'phone': '13800000004',
      'email': 'employee@example.test',
      'managerName': '柏拉图',
      'hireDate': '2024-02-29',
      'tenure': {'years': 2, 'months': 8, 'days': 12, 'asOfDate': '2026-11-10'},
    }));
    final container = buildTestContainer(backend: backend, user: employeeUser());
    addTearDown(container.dispose);
    await tester.pumpWidget(wrapWithScope(
      container,
      const MediaQuery(
        data: MediaQueryData(size: Size(320, 640), textScaler: TextScaler.linear(1.5)),
        child: MePage(),
      ),
    ));
    await tester.pumpAndSettle();
    final outer = tester.state<ScrollableState>(find.byType(Scrollable).first);
    expect(outer.position.pixels, 0);
    // Begin within the profile's inner list, where it used to consume the swipe.
    await tester.dragFrom(const Offset(160, 420), const Offset(0, -280));
    await tester.pumpAndSettle();
    expect(outer.position.pixels, greaterThan(0));
    expect(find.text('编辑头像和邮箱').hitTestable(), findsOneWidget);
    expect(find.text('通知中心').hitTestable(), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  for (final denied in [false, true]) {
    testWidgets('选图${denied ? '权限拒绝' : '取消'}保留原头像和邮箱草稿', (tester) async {
      final backend = FakeBackend();
      backend.on(
        'GET',
        '/me/profile',
        (_) => FakeResponse({
          'id': 'u1',
          'displayName': '员工',
          'avatar': 'cat',
          'email': 'old@example.test',
        }, etag: '"1"'),
      );
      final container = buildTestContainer(
        backend: backend,
        user: employeeUser(),
      );
      addTearDown(container.dispose);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: ProviderScope(
            overrides: [
              profileImagePickerProvider.overrideWithValue(
                _Picker(() async {
                  if (denied) {
                    throw PlatformException(code: 'photo_access_denied');
                  }
                  return null;
                }),
              ),
            ],
            child: const MaterialApp(home: Scaffold(body: SelfProfileCard())),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('编辑头像和邮箱'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'draft@example.test');
      await tester.tap(find.text('从系统相册选择'));
      await tester.pumpAndSettle();
      expect(find.text('draft@example.test'), findsOneWidget);
      expect(
        tester
            .widget<ChoiceChip>(find.widgetWithText(ChoiceChip, '🐱 猫咪'))
            .selected,
        isTrue,
      );
      if (denied) expect(find.text('无法选择照片，请检查系统相册权限后重试。'), findsOneWidget);
      expect(backend.requestsFor('PATCH', '/me/profile'), isEmpty);
      await tester.tap(find.text('取消'));
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsNothing);
    });
  }

  testWidgets('选图压缩清理临时副本，服务拒绝保留头像和邮箱草稿', (tester) async {
    final source = File(
      '${Directory.systemTemp.path}/pandora-avatar-widget.png',
    );
    source.writeAsBytesSync(img.encodePng(img.Image(width: 600, height: 400)));
    addTearDown(() async {
      if (await source.exists()) await source.delete();
    });
    final backend = FakeBackend();
    backend.on(
      'GET',
      '/me/profile',
      (_) => FakeResponse({
        'id': 'u1',
        'displayName': '员工',
        'avatar': 'cat',
        'email': 'old@example.test',
      }, etag: '"1"'),
    );
    backend.on('PATCH', '/me/profile', (request) {
      final value = request.jsonBody['avatar']! as String;
      expect(value.length, lessThanOrEqualTo(400000));
      final bytes = base64Decode(value.split(',').last);
      expect(bytes.length, lessThanOrEqualTo(300000));
      expect(img.decodeJpg(bytes)!.width, 256);
      expect(request.jsonBody['email'], 'draft@example.test');
      return FakeResponse({'message': '暂时无法保存'}, status: 503);
    });
    final container = buildTestContainer(
      backend: backend,
      user: employeeUser(),
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: ProviderScope(
          overrides: [
            profileImagePickerProvider.overrideWithValue(
              _Picker(() async => XFile(source.path)),
            ),
          ],
          child: const MaterialApp(home: Scaffold(body: SelfProfileCard())),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('编辑头像和邮箱'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'draft@example.test');
    await tester.runAsync(() async {
      await tester.tap(find.text('从系统相册选择'));
      for (var i = 0; i < 100 && await source.exists(); i++) {
        await Future<void>.delayed(const Duration(milliseconds: 10));
      }
    });
    await tester.pumpAndSettle();
    expect(source.existsSync(), isFalse);
    await tester.tap(find.text('保存'));
    await tester.pumpAndSettle();
    expect(find.text('暂时无法保存'), findsOneWidget);
    expect(find.text('draft@example.test'), findsOneWidget);
    expect(find.byType(AlertDialog), findsOneWidget);
    expect(
      tester
          .widgetList<CircleAvatar>(find.byType(CircleAvatar))
          .any((w) => w.backgroundImage is MemoryImage),
      isTrue,
    );
  });

  test('超10MB源拒绝且输出尺寸上限不由原图尺寸决定', () {
    expect(
      () => const AvatarProcessor().process(Uint8List(10 * 1024 * 1024 + 1)),
      throwsA(isA<AvatarException>()),
    );
  });

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

class _Picker extends ImagePicker {
  _Picker(this.select);
  final Future<XFile?> Function() select;
  @override
  Future<XFile?> pickImage({
    required ImageSource source,
    double? maxWidth,
    double? maxHeight,
    int? imageQuality,
    CameraDevice preferredCameraDevice = CameraDevice.rear,
    bool requestFullMetadata = true,
  }) {
    expect(source, ImageSource.gallery);
    expect(requestFullMetadata, isFalse);
    return select();
  }
}
