import 'package:flutter/material.dart';

import '../../../core/theme/pandora_theme.dart';
import '../../tasks/domain/task_record.dart';

/// 标签徽标：浅色填充 + 深色描边/文字，避免把浅色板颜色当文字色。
class TagBadge extends StatelessWidget {
  const TagBadge({super.key, required this.tag});

  final TaskTag tag;

  @override
  Widget build(BuildContext context) {
    final background = _parse(tag.color, PandoraColors.petal);
    final foreground = tag.border == null
        ? Color.lerp(background, Colors.black, .45)!
        : _parse(tag.border, Color.lerp(background, Colors.black, .45)!);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: foreground.withValues(alpha: .75)),
      ),
      child: Text(
        tag.deleted ? '${tag.name}（已删除）' : tag.name,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: foreground,
              fontWeight: FontWeight.w600,
              decoration: tag.deleted ? TextDecoration.lineThrough : null,
            ),
      ),
    );
  }

  static Color _parse(String? value, Color fallback) {
    final hex = (value ?? '').replaceFirst('#', '');
    if (hex.length != 6) return fallback;
    final parsed = int.tryParse(hex, radix: 16);
    return parsed == null ? fallback : Color(0xFF000000 | parsed);
  }
}
