import 'package:flutter/material.dart';

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

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final tag in selected)
          InputChip(
            label: Text(tag.deleted ? '${tag.name}（已删除）' : tag.name),
            isEnabled: enabled,
            onDeleted: enabled ? () => onChanged([...selected]..remove(tag)) : null,
          ),
        if (enabled)
          for (final tag in catalog)
            if (!tag.deleted && !selected.any((item) => item.id == tag.id))
              ActionChip(
                label: Text(tag.name),
                onPressed: () => onChanged([...selected, tag]),
              ),
      ],
    );
  }
}
