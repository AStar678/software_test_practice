import 'package:flutter/material.dart';

/// 日志正文预览的测量结果。
///
/// 只有确实还有非空白正文未展示时才补省略号；恰好三行或被尾部空白/换行
/// 截断时都不添加。
class LogPreviewLayout {
  const LogPreviewLayout({required this.text, required this.truncated});

  final String text;
  final bool truncated;
}

LogPreviewLayout resolveLogPreview({
  required String body,
  required TextStyle style,
  required double maxWidth,
  required TextScaler textScaler,
  required TextDirection textDirection,
  int maxLines = 3,
}) {
  bool fits(String text) {
    final painter = TextPainter(
      text: TextSpan(text: text, style: style),
      maxLines: maxLines,
      textDirection: textDirection,
      textScaler: textScaler,
    )..layout(maxWidth: maxWidth < 0 ? 0 : maxWidth);
    final exceeded = painter.didExceedMaxLines;
    painter.dispose();
    return !exceeded;
  }

  // 尾部空行不构成被隐藏的正文。
  final trimmed = body.replaceFirst(RegExp(r'[\s\u3000]+$'), '');
  if (fits(trimmed) || trimmed.isEmpty) {
    return LogPreviewLayout(text: body, truncated: false);
  }

  final clusters = body.characters.toList();
  var low = 0;
  var high = clusters.length - 1;
  var best = 0;
  while (low <= high) {
    final middle = (low + high) ~/ 2;
    final candidate = _withEllipsis(clusters, middle);
    if (fits(candidate)) {
      best = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return LogPreviewLayout(
    text: _withEllipsis(clusters, best),
    truncated: true,
  );
}

String _withEllipsis(List<String> clusters, int count) {
  final prefix = clusters.take(count).join();
  // 显式换行造成的截断也要让省略号落在正文行末，而不是空的下一行。
  final trimmed = prefix.replaceFirst(RegExp(r'[\s\u3000]+$'), '');
  return '${trimmed.isEmpty ? prefix : trimmed}…';
}

/// 日志列表正文：最多三行；未截断不加省略号，截断时在完整字素处补足省略号。
class LogBodyPreview extends StatelessWidget {
  const LogBodyPreview(
    this.body, {
    super.key,
    this.style,
    this.maxLines = 3,
  });

  final String body;
  final TextStyle? style;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    final effectiveStyle = DefaultTextStyle.of(context).style.merge(style);
    return LayoutBuilder(
      builder: (context, constraints) {
        if (!constraints.hasBoundedWidth) {
          return Text(
            body,
            style: style,
            maxLines: maxLines,
            overflow: TextOverflow.clip,
          );
        }
        final layout = resolveLogPreview(
          body: body,
          style: effectiveStyle,
          maxWidth: constraints.maxWidth,
          textScaler: MediaQuery.textScalerOf(context),
          textDirection: Directionality.of(context),
          maxLines: maxLines,
        );
        return Text(
          layout.text,
          style: style,
          maxLines: maxLines,
          overflow: TextOverflow.clip,
          semanticsLabel: layout.truncated ? body : null,
        );
      },
    );
  }
}
