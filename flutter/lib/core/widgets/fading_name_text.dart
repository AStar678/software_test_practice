import 'package:flutter/material.dart';

/// 受限名称预览的测量结果。
///
/// `visibleEnd` 是最后一个完整可见字素之后的字符偏移；`fadeRect` 是该字素在
/// 文本段落坐标系中的位置。调用方据此只对这一枚字素做局部渐隐，不显示省略号，
/// 也不额外留出一个字符的位置。公开这些字段便于组件测试核对字素边界与位置。
class NameFadeLayout {
  const NameFadeLayout({
    required this.truncated,
    required this.height,
    this.visibleEnd,
    this.fadeText = '',
    this.fadeRect,
  });

  final bool truncated;
  final double height;
  final int? visibleEnd;
  final String fadeText;
  final Rect? fadeRect;

  /// 前缀不包含被渐隐的末字：末字只在遮罩层绘制一次，避免重影。
  String prefixOf(String text) {
    if (visibleEnd == null) return text;
    final end = visibleEnd! - fadeText.length;
    return end <= 0 ? '' : text.substring(0, end);
  }
}

/// 按真实文本布局判断名称是否在 [maxLines] 内被截断。
///
/// 截断时返回最后一个完整可见且非空白字素的位置；未截断时 `truncated` 为 false。
/// 不提前按固定字符数裁剪，因此中英文混排、字体放大或跨月条宽度变化都不会切在
/// 字素中间。
NameFadeLayout resolveNameFade({
  required String text,
  required TextStyle style,
  required double maxWidth,
  required TextScaler textScaler,
  required TextDirection textDirection,
  int maxLines = 1,
}) {
  final painter = TextPainter(
    text: TextSpan(text: text, style: style),
    maxLines: maxLines,
    textDirection: textDirection,
    textScaler: textScaler,
  )..layout(maxWidth: maxWidth < 0 ? 0 : maxWidth);
  final height = painter.height;
  if (!painter.didExceedMaxLines) {
    painter.dispose();
    return NameFadeLayout(truncated: false, height: height);
  }
  final lines = painter.computeLineMetrics();
  final line = lines.length >= maxLines ? lines[maxLines - 1] : lines.last;
  final lineBottom = line.baseline + line.descent;
  int? visibleEnd;
  String? fadeText;
  Rect? fadeRect;
  var offset = 0;
  for (final grapheme in text.characters) {
    final start = offset;
    offset += grapheme.length;
    final boxes = painter.getBoxesForSelection(
      TextSelection(baseOffset: start, extentOffset: offset),
    );
    if (boxes.isEmpty) continue;
    final box = boxes.last;
    // 已经换到被隐藏的行，或水平方向无法完整容纳，就从这里停止。
    if (box.top >= lineBottom - 0.5) break;
    if (box.right > maxWidth + 0.5) break;
    if (grapheme.trim().isEmpty) continue;
    visibleEnd = offset;
    fadeText = grapheme;
    fadeRect = box.toRect();
  }
  painter.dispose();
  if (visibleEnd == null || fadeRect == null) {
    return NameFadeLayout(truncated: true, height: height);
  }
  return NameFadeLayout(
    truncated: true,
    height: height,
    visibleEnd: visibleEnd,
    fadeText: fadeText!,
    fadeRect: fadeRect,
  );
}

/// 有行数限制的名称预览。
///
/// 完整显示时与普通 `Text` 一致；实际截断时不使用省略号，只让最后一个完整可见
/// 字符从左到右渐透明。完整名称始终保留在无障碍语义中。
class FadingNameText extends StatelessWidget {
  const FadingNameText(
    this.text, {
    super.key,
    this.style,
    this.maxLines = 1,
    this.textAlign = TextAlign.start,
    this.semanticsLabel,
  });

  final String text;
  final TextStyle? style;
  final int maxLines;
  final TextAlign textAlign;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final effectiveStyle = DefaultTextStyle.of(context).style.merge(style);
    final scaler = MediaQuery.textScalerOf(context);
    final direction = Directionality.of(context);
    final label = semanticsLabel ?? text;
    return LayoutBuilder(
      builder: (context, constraints) {
        if (!constraints.hasBoundedWidth) {
          return Text(
            text,
            style: style,
            maxLines: maxLines,
            overflow: TextOverflow.clip,
            textAlign: textAlign,
            semanticsLabel: semanticsLabel,
          );
        }
        final layout = resolveNameFade(
          text: text,
          style: effectiveStyle,
          maxWidth: constraints.maxWidth,
          textScaler: scaler,
          textDirection: direction,
          maxLines: maxLines,
        );
        final fadeRect = layout.fadeRect;
        if (!layout.truncated || fadeRect == null) {
          return Text(
            text,
            style: style,
            maxLines: maxLines,
            overflow: TextOverflow.clip,
            textAlign: textAlign,
            semanticsLabel: label,
          );
        }
        return Semantics(
          label: label,
          textDirection: direction,
          child: ExcludeSemantics(
            child: SizedBox(
              width: constraints.maxWidth,
              height: layout.height,
              child: Stack(
                clipBehavior: Clip.hardEdge,
                children: [
                  Positioned(
                    left: 0,
                    top: 0,
                    child: Text(
                      layout.prefixOf(text),
                      style: style,
                      textAlign: textAlign,
                    ),
                  ),
                  Positioned(
                    left: fadeRect.left,
                    top: fadeRect.top,
                    width: fadeRect.width,
                    height: fadeRect.height,
                    child: ShaderMask(
                      blendMode: BlendMode.modulate,
                      shaderCallback: (rect) => const LinearGradient(
                        begin: Alignment.centerLeft,
                        end: Alignment.centerRight,
                        colors: [Colors.white, Colors.transparent],
                      ).createShader(rect),
                      child: Text(layout.fadeText, style: style),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
