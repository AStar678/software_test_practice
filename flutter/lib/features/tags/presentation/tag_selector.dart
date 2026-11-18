import 'package:flutter/material.dart';

import '../../../core/theme/pandora_theme.dart';
import '../../tasks/domain/task_record.dart';

/// 任务与日志共用的有序多标签选择：顺序即首标签颜色来源。
/// 已删除标签只保留在已选集合中，可移除但不能重新挂回。
class TagSelector extends StatelessWidget {
  const TagSelector({
    super.key,
    required this.selected,
    required this.catalog,
    required this.onChanged,
    this.enabled = true,
  });

  final List<TaskTag> selected;
  final List<TaskTag> catalog;
  final ValueChanged<List<TaskTag>> onChanged;
  final bool enabled;

  List<TaskTag> get _visible {
    final result = <TaskTag>[];
    final seen = <String>{};
    for (final tag in selected) {
      if (seen.add(tag.id)) result.add(tag);
    }
    for (final tag in catalog) {
      if (!tag.deleted && seen.add(tag.id)) result.add(tag);
    }
    return result;
  }

  void _toggle(TaskTag tag) {
    if (!enabled) return;
    final isSelected = selected.any((item) => item.id == tag.id);
    if (isSelected) {
      onChanged([for (final item in selected) if (item.id != tag.id) item]);
      return;
    }
    if (tag.deleted) return;
    onChanged([...selected, tag]);
  }

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final tag in _visible)
          _TagTile(
            tag: tag,
            selected: selected.any((item) => item.id == tag.id),
            enabled: enabled,
            onTap: () => _toggle(tag),
          ),
      ],
    );
  }
}

class _TagTile extends StatelessWidget {
  const _TagTile({
    required this.tag,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final TaskTag tag;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final background = _parse(tag.color, PandoraColors.petal);
    final accent = tag.border == null
        ? Color.lerp(background, Colors.black, .35)!
        : _parse(tag.border, Color.lerp(background, Colors.black, .35)!);
    return Semantics(
      button: true,
      selected: selected,
      label: selected ? '${tag.name}，已选中' : tag.name,
      child: InkWell(
        key: ValueKey('tag-tile-${tag.id}'),
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(10),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected ? accent : accent.withValues(alpha: .55),
              width: selected ? 3 : 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (selected) ...[
                Icon(Icons.check_circle, size: 14, color: accent),
                const SizedBox(width: 4),
              ],
              Text(
                tag.deleted ? '${tag.name}（已删除）' : tag.name,
                style: TextStyle(
                  fontSize: 12,
                  height: 1.2,
                  color: accent,
                  fontWeight: FontWeight.w600,
                  decoration: tag.deleted ? TextDecoration.lineThrough : null,
                ),
              ),
            ],
          ),
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
