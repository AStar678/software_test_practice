import 'package:flutter/material.dart';

import '../../../core/theme/pandora_theme.dart';
import '../../people/domain/person_summary.dart';

/// 有序多负责人选择：可搜索、可增删、可调整顺序，候选只带授权摘要。
class AssigneePicker extends StatefulWidget {
  const AssigneePicker({
    super.key,
    required this.selected,
    required this.candidates,
    required this.onChanged,
    this.allowReorder = true,
    this.search,
  });

  final List<PersonSummary> selected;
  final List<PersonSummary> candidates;
  final ValueChanged<List<PersonSummary>> onChanged;
  final bool allowReorder;
  final ValueChanged<String>? search;

  @override
  State<AssigneePicker> createState() => _AssigneePickerState();
}

class _AssigneePickerState extends State<AssigneePicker> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  bool _isSelected(PersonSummary person) => widget.selected.any((item) => item.id == person.id);

  void _toggle(PersonSummary person) {
    final next = List<PersonSummary>.from(widget.selected);
    if (_isSelected(person)) {
      next.removeWhere((item) => item.id == person.id);
    } else {
      next.add(person);
    }
    widget.onChanged(next);
  }

  void _move(int index, int delta) {
    final target = index + delta;
    if (target < 0 || target >= widget.selected.length) return;
    final next = List<PersonSummary>.from(widget.selected);
    final moved = next.removeAt(index);
    next.insert(target, moved);
    widget.onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    final filtered = widget.candidates.where((person) {
      if (_query.isEmpty) return true;
      final haystack = '${person.displayName} ${person.positionPath}'.toLowerCase();
      return haystack.contains(_query.toLowerCase());
    }).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.selected.isNotEmpty) ...[
          Text('已选负责人（按顺序）', style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 6),
          for (var index = 0; index < widget.selected.length; index++)
            _SelectedRow(
              person: widget.selected[index],
              index: index,
              total: widget.selected.length,
              allowReorder: widget.allowReorder,
              onRemove: () => _toggle(widget.selected[index]),
              onMove: (delta) => _move(index, delta),
            ),
          const SizedBox(height: 8),
        ],
        TextField(
          controller: _searchController,
          decoration: const InputDecoration(
            labelText: '搜索员工',
            prefixIcon: Icon(Icons.search),
            isDense: true,
          ),
          onChanged: (value) {
            setState(() => _query = value.trim());
            widget.search?.call(value.trim());
          },
        ),
        const SizedBox(height: 6),
        ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 240),
          child: filtered.isEmpty
              ? const Padding(
                  padding: EdgeInsets.all(12),
                  child: Text('没有匹配的员工', style: TextStyle(color: PandoraColors.muted)),
                )
              : ListView.builder(
                  shrinkWrap: true,
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final person = filtered[index];
                    final selectedIndex = widget.selected.indexWhere((item) => item.id == person.id);
                    return CheckboxListTile(
                      dense: true,
                      value: selectedIndex >= 0,
                      controlAffinity: ListTileControlAffinity.leading,
                      title: Text(person.displayName, maxLines: 1, overflow: TextOverflow.ellipsis),
                      subtitle: person.positionPath.isEmpty
                          ? null
                          : Text(
                              person.positionPath,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 11, color: PandoraColors.muted),
                            ),
                      secondary: selectedIndex >= 0 ? Text('第 ${selectedIndex + 1} 位') : null,
                      onChanged: (_) => _toggle(person),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class _SelectedRow extends StatelessWidget {
  const _SelectedRow({
    required this.person,
    required this.index,
    required this.total,
    required this.allowReorder,
    required this.onRemove,
    required this.onMove,
  });

  final PersonSummary person;
  final int index;
  final int total;
  final bool allowReorder;
  final VoidCallback onRemove;
  final ValueChanged<int> onMove;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        CircleAvatar(
          radius: 12,
          backgroundColor: PandoraColors.petal,
          child: Text('${index + 1}', style: const TextStyle(fontSize: 11, color: PandoraColors.brand)),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            person.positionPath.isEmpty ? person.displayName : '${person.displayName} · ${person.positionPath}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        if (allowReorder) ...[
          IconButton(
            tooltip: '上移',
            visualDensity: VisualDensity.compact,
            onPressed: index == 0 ? null : () => onMove(-1),
            icon: const Icon(Icons.arrow_upward, size: 16),
          ),
          IconButton(
            tooltip: '下移',
            visualDensity: VisualDensity.compact,
            onPressed: index == total - 1 ? null : () => onMove(1),
            icon: const Icon(Icons.arrow_downward, size: 16),
          ),
        ],
        TextButton(onPressed: onRemove, child: const Text('移除')),
      ],
    );
  }
}
