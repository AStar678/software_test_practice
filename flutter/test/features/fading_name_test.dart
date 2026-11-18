import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/widgets/fading_name_text.dart';

const _style = TextStyle(fontSize: 14, height: 1.5);

NameFadeLayout _resolve(
  String text, {
  required double width,
  int maxLines = 1,
  double scale = 1,
}) => resolveNameFade(
  text: text,
  style: _style,
  maxWidth: width,
  textScaler: TextScaler.linear(scale),
  textDirection: TextDirection.ltr,
  maxLines: maxLines,
);

double _measure(String text, {double scale = 1}) {
  final painter = TextPainter(
    text: TextSpan(text: text, style: _style),
    textDirection: TextDirection.ltr,
    textScaler: TextScaler.linear(scale),
  )..layout();
  final width = painter.width;
  painter.dispose();
  return width;
}

void main() {
  test('名称完整容纳时不渐隐，超出时才渐隐且不显示省略号', () {
    const name = '恰好容纳的名称';
    final width = _measure(name);
    final fits = _resolve(name, width: width + 1);
    expect(fits.truncated, isFalse);
    expect(fits.fadeRect, isNull);

    final clipped = _resolve(name, width: width / 3);
    expect(clipped.truncated, isTrue);
    expect(clipped.fadeText.isNotEmpty, isTrue);
    expect(clipped.visibleEnd, isNotNull);
    expect(name.substring(0, clipped.visibleEnd!), isNot(contains('…')));
  });

  test('中文混排、放大字体和跨月条宽度都切在完整字素边界', () {
    const mixed = '跨月条Name🎯和English混排👨‍👩‍👧‍👦再长一点的任务名称';
    for (final scale in [1.0, 1.5, 2.0]) {
      for (var width = 8.0; width <= 140; width += 1.5) {
        final layout = _resolve(mixed, width: width, scale: scale);
        if (!layout.truncated || layout.visibleEnd == null) continue;
        final end = layout.visibleEnd!;
        final prefix = mixed.substring(0, end);
        expect(
          prefix.characters.last,
          layout.fadeText,
          reason: '只渐隐最后一个完整字素（scale=$scale width=$width）',
        );
        expect(layout.fadeText.characters.length, 1);
        expect(
          mixed.substring(end),
          isNotEmpty,
          reason: '确实还有未显示的正文，才允许渐隐',
        );
        expect(
          layout.fadeRect!.right,
          lessThanOrEqualTo(width + 0.5),
          reason: '渐隐位置必须落在可用宽度内',
        );
        expect(
          layout.fadeRect!.width,
          greaterThan(0),
          reason: '渐隐字素必须有可见宽度',
        );
      }
    }
  });

  test('字体放大后更早截断，但末字仍完整', () {
    const name = '放大字体后的任务名称仍需完整字素';
    final normal = _resolve(name, width: 80);
    final scaled = _resolve(name, width: 80, scale: 2);
    expect(normal.truncated, isTrue);
    expect(scaled.truncated, isTrue);
    expect(scaled.visibleEnd!, lessThanOrEqualTo(normal.visibleEnd!));
    final prefix = name.substring(0, scaled.visibleEnd!);
    expect(prefix.characters.last, scaled.fadeText);
  });

  testWidgets('截断的名称不出现省略号，无障碍仍是完整名称', (tester) async {
    final semantics = tester.ensureSemantics();
    const name = '这个任务名称很长需要末字渐隐而不是省略号';
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(width: 70, child: FadingNameText(name)),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(ShaderMask), findsOneWidget);
    final texts = tester.widgetList<Text>(find.byType(Text));
    expect(
      texts.where((text) => text.overflow == TextOverflow.ellipsis),
      isEmpty,
      reason: '名称渐隐不使用省略号',
    );
    expect(texts.any((text) => (text.data ?? '').contains('…')), isFalse);
    expect(find.bySemanticsLabel(name), findsOneWidget);
    expect(tester.takeException(), isNull);
    semantics.dispose();
  });

  testWidgets('完整容纳的名称按普通文本渲染且保留无障碍名称', (tester) async {
    final semantics = tester.ensureSemantics();
    const name = '短名称';
    final width = _measure(name) + 2;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(width: width, child: const FadingNameText(name)),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(ShaderMask), findsNothing);
    expect(find.text(name), findsOneWidget);
    expect(find.bySemanticsLabel(name), findsOneWidget);
    expect(tester.takeException(), isNull);
    semantics.dispose();
  });
}
