import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/features/work_logs/presentation/log_body_preview.dart';

const _style = TextStyle(fontSize: 15, height: 1.55);

LogPreviewLayout _resolve(String body, {double width = 200}) =>
    resolveLogPreview(
      body: body,
      style: _style,
      maxWidth: width,
      textScaler: TextScaler.noScaling,
      textDirection: TextDirection.ltr,
    );

void main() {
  test('恰好三行不补省略号，尾部空行不算隐藏正文', () {
    final exact = _resolve('第一行\n第二行\n第三行');
    expect(exact.truncated, isFalse);
    expect(exact.text.contains('…'), isFalse);

    final trailing = _resolve('第一行\n第二行\n第三行\n');
    expect(trailing.truncated, isFalse);
    expect(trailing.text.contains('…'), isFalse);
  });

  test('显式换行隐藏第四行时第三行确实显示省略号', () {
    final layout = _resolve('第一行\n第二行\n第三行\n第四行');
    expect(layout.truncated, isTrue);
    expect(layout.text.endsWith('…'), isTrue);
    expect(layout.text.split('\n'), hasLength(3));
    expect(layout.text.contains('第四行'), isFalse);
  });

  test('第三行恰好填满仍为省略号预留宽度', () {
    const line = '1234567890';
    final layout = _resolve('$line\n$line\n$line\n更多', width: 150);
    expect(layout.truncated, isTrue);
    expect(layout.text.endsWith('…'), isTrue);
    expect(layout.text.split('\n'), hasLength(3));
    expect(layout.text.contains('更多'), isFalse);
  });

  test('窄屏软换行与中文混排截断在完整字素处', () {
    final body = '这是一段没有换行符的较长日志正文，用于验证软换行🎯以及中英文Mixed混排的处理。';
    for (final width in [80.0, 120.0, 200.0]) {
      final layout = _resolve(body, width: width);
      if (!layout.truncated) continue;
      expect(layout.text.endsWith('…'), isTrue);
      final visible = layout.text.substring(0, layout.text.length - 1);
      expect(visible.characters.length, greaterThan(0));
      expect(visible.characters.last, isNot('…'));
      expect(body.startsWith(visible), isTrue, reason: '从不半字/半字素处收尾');
    }
  });

  testWidgets('列表预览最多三行，无障碍仍可读取完整正文', (tester) async {
    final semantics = tester.ensureSemantics();
    const body = '第一行\n第二行\n第三行\n第四行\n第五行';
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 220,
              child: LogBodyPreview(body),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final text = tester.widget<Text>(find.byType(Text));
    expect(text.maxLines, 3);
    expect(text.overflow, TextOverflow.clip);
    expect(text.data, endsWith('…'));
    expect(find.bySemanticsLabel(body), findsOneWidget);
    semantics.dispose();
  });
}
