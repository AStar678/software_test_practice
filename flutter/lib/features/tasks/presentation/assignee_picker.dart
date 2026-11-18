import 'package:flutter/material.dart';

import '../../../core/theme/pandora_theme.dart';
import '../../people/domain/person_summary.dart';

/// 有序多负责人选择：组织树展示、可搜索、可增删、可调整顺序。
class AssigneePicker extends StatefulWidget {
  const AssigneePicker({
    super.key,
    required this.selected,
    required this.candidates,
    required this.onChanged,
    this.allowReorder = true,
    this.search,
    this.tree = true,
  });

  final List<PersonSummary> selected;
  final List<PersonSummary> candidates;
  final ValueChanged<List<PersonSummary>> onChanged;
  final bool allowReorder;
  final ValueChanged<String>? search;
  final bool tree;

  @override
  State<AssigneePicker> createState() => _AssigneePickerState();
}

class _AssigneePickerState extends State<AssigneePicker> {
  final _searchController = TextEditingController();
  final Set<String> _expandedTeams = <String>{};
  final Set<String> _collapsedDepartments = <String>{};
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

  List<PersonSummary> get _filtered {
    final query = _query.toLowerCase();
    return widget.candidates.where((person) {
      if (query.isEmpty) return true;
      return '${person.displayName} ${person.positionPath}'.toLowerCase().contains(query);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.selected.isNotEmpty) ...[
          Text('已选负责人', style: Theme.of(context).textTheme.labelMedium),
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
        if (filtered.isEmpty)
          const Padding(
            padding: EdgeInsets.all(12),
            child: Text('没有匹配的员工', style: TextStyle(color: PandoraColors.muted)),
          )
        else
          widget.tree ? _tree(filtered) : _flat(filtered),
      ],
    );
  }

  Widget _flat(List<PersonSummary> people) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [for (final person in people) _personTile(person)],
    );
  }

  Widget _tree(List<PersonSummary> people) {
    final departments = <String, Map<String, List<PersonSummary>>>{};
    for (final person in people) {
      final department = _label(person.departmentName, '未分组部门');
      final team = _label(person.teamName, '未分组团队');
      departments.putIfAbsent(department, () => <String, List<PersonSummary>>{}).putIfAbsent(team, () => <PersonSummary>[]).add(person);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final department in departments.entries)
          _departmentNode(department.key, department.value),
      ],
    );
  }

  Widget _departmentNode(String name, Map<String, List<PersonSummary>> teams) {
    final searchExpanded = _query.isNotEmpty;
    final expanded = searchExpanded || !_collapsedDepartments.contains(name);
    final total = teams.values.fold<int>(0, (sum, people) => sum + people.length);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InkWell(
          onTap: () => setState(() {
            if (!expanded) {
              _collapsedDepartments.remove(name);
            } else {
              _collapsedDepartments.add(name);
            }
          }),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
            child: Row(children: [
              _expander(expanded),
              const SizedBox(width: 6),
              Expanded(child: Text(name, style: const TextStyle(fontWeight: FontWeight.w600))),
              Text('$total 人', style: const TextStyle(fontSize: 11, color: PandoraColors.muted)),
            ]),
          ),
        ),
        if (expanded)
          for (final team in teams.entries) _teamNode(name, team.key, team.value),
      ],
    );
  }

  Widget _teamNode(String department, String name, List<PersonSummary> people) {
    final key = '$department/$name';
    final expanded = _query.isNotEmpty || _expandedTeams.contains(key);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InkWell(
          onTap: () => setState(() {
            if (expanded) {
              _expandedTeams.remove(key);
            } else {
              _expandedTeams.add(key);
            }
          }),
          child: Padding(
            padding: const EdgeInsets.only(left: 22, top: 6, bottom: 6, right: 4),
            child: Row(children: [
              _expander(expanded),
              const SizedBox(width: 6),
              Expanded(child: Text(name)),
              Text('${people.length} 人', style: const TextStyle(fontSize: 11, color: PandoraColors.muted)),
            ]),
          ),
        ),
        if (expanded)
          for (final person in people) _personTile(person, indent: 46),
      ],
    );
  }

  Widget _expander(bool expanded) => AnimatedRotation(
        turns: expanded ? .25 : 0,
        duration: const Duration(milliseconds: 120),
        child: const Icon(Icons.chevron_right, size: 18, color: PandoraColors.muted),
      );

  Widget _personTile(PersonSummary person, {double indent = 0}) {
    final selectedIndex = widget.selected.indexWhere((item) => item.id == person.id);
    return Padding(
      padding: EdgeInsets.only(left: indent),
      child: CheckboxListTile(
        dense: true,
        value: selectedIndex >= 0,
        controlAffinity: ListTileControlAffinity.leading,
        title: Text(person.displayName, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: person.positionName == null || person.positionName!.trim().isEmpty
            ? null
            : Text(
                person.positionName!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11, color: PandoraColors.muted),
              ),
        secondary: selectedIndex >= 0 ? Text('第 ${selectedIndex + 1} 位') : null,
        onChanged: (_) => _toggle(person),
      ),
    );
  }

  static String _label(String? value, String fallback) {
    final text = value?.trim() ?? '';
    return text.isEmpty ? fallback : text;
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
