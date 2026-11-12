import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/state_views.dart';
import '../../tasks/domain/task_record.dart';
import 'tags_providers.dart';

const List<({String color, String label})> _tagPalette = [
  (color: '#F6D5D2', label: '珊瑚红'),
  (color: '#FBE3CB', label: '蜜杏'),
  (color: '#F8EFC8', label: '麦黄'),
  (color: '#DCEEE0', label: '青瓷'),
  (color: '#D8EAF4', label: '湖蓝'),
  (color: '#E4DEF3', label: '雾紫'),
  (color: '#F2DFE9', label: '藕粉'),
  (color: '#E4E7EC', label: '石灰'),
];

class TagManagePage extends ConsumerStatefulWidget {
  const TagManagePage({super.key});
  @override
  ConsumerState<TagManagePage> createState() => _TagManagePageState();
}

class _TagManagePageState extends ConsumerState<TagManagePage> {
  List<TaskTag> _tags = const [];
  Object? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    try {
      final tags = await ref.read(tagsApiProvider).list();
      if (!mounted) return;
      setState(() { _tags = tags; _loading = false; _error = null; });
    } catch (error) {
      if (!mounted) return;
      setState(() { _error = error; _loading = false; });
    }
  }

  Future<void> _edit([TaskTag? tag]) async {
    final name = TextEditingController(text: tag?.name ?? '');
    var selectedColor = _tagPalette.any((entry) => entry.color == tag?.color)
        ? tag!.color!
        : _tagPalette.first.color;
    var validation = '';
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(tag == null ? '新建标签' : '编辑标签'),
          content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            TextField(controller: name, maxLength: 40, decoration: const InputDecoration(labelText: '名称')),
            const SizedBox(height: 10),
            const Text('颜色（固定色板）'),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final entry in _tagPalette)
                  ChoiceChip(
                    label: Text(entry.label),
                    avatar: CircleAvatar(backgroundColor: _color(entry.color), radius: 7),
                    selected: selectedColor == entry.color,
                    onSelected: (_) => setDialogState(() => selectedColor = entry.color),
                  ),
              ],
            ),
            if (validation.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(validation, style: const TextStyle(color: PandoraColors.overdue)),
              ),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('取消')),
            FilledButton(
              onPressed: () {
                if (name.text.trim().isEmpty) {
                  setDialogState(() => validation = '名称不能为空');
                  return;
                }
                Navigator.of(context).pop(true);
              },
              child: const Text('保存'),
            ),
          ],
        ),
      ),
    );
    final nextName = name.text.trim();
    final nextColor = selectedColor;
    await Future<void>.delayed(const Duration(milliseconds: 300));
    name.dispose();
    if (accepted != true || !mounted) return;
    final keys = ref.read(operationKeysProvider);
    final scope = 'tag:${tag?.id ?? 'new'}';
    final key = keys.keyFor(scope: scope, method: tag == null ? 'POST' : 'PATCH', path: tag == null ? '/tags' : '/tags/${tag.id}', body: {'name': nextName, 'color': nextColor});
    try {
      if (tag == null) {
        await ref.read(tagsApiProvider).create(name: nextName, color: nextColor, idempotencyKey: key);
      } else {
        await ref.read(tagsApiProvider).change(id: tag.id, name: nextName, color: nextColor, rowVersion: tag.rowVersion, idempotencyKey: key);
      }
      keys.complete(scope);
      await _load();
    } catch (error) {
      if (!mounted) return;
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${error.toString()}；目录已刷新，请重新编辑')));
    }
  }

  Future<void> _delete(TaskTag tag) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('删除标签？'),
        content: const Text('已使用该标签的任务和日志会保留名称与颜色快照。'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('删除')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final keys = ref.read(operationKeysProvider);
    final key = keys.keyFor(scope: 'tag:${tag.id}', method: 'DELETE', path: '/tags/${tag.id}', body: const {});
    try {
      await ref.read(tagsApiProvider).delete(id: tag.id, rowVersion: tag.rowVersion, idempotencyKey: key);
      keys.complete('tag:${tag.id}');
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.read(currentUserProvider);
    if (user?.isFounder != true) {
      return PandoraPage(
        title: '公司标签',
        showBack: true,
        child: const EmptyView(message: '仅固定创始人可以维护公司共用标签目录。'),
      );
    }
    return PandoraPage(
      title: '公司标签',
      showBack: true,
      child: _loading
          ? const LoadingView()
          : _error != null
              ? ErrorView(error: _error!, onRetry: _load)
              : ListView(children: [
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: FilledButton.icon(onPressed: () => _edit(), icon: const Icon(Icons.add), label: const Text('新建标签')),
                  ),
                  for (final tag in _tags)
                    ListTile(
                      leading: CircleAvatar(backgroundColor: _color(tag.color), radius: 12),
                      title: Text(tag.name),
                      subtitle: Text(tag.deleted ? '已删除' : '公司共用'),
                      trailing: tag.deleted ? null : Row(mainAxisSize: MainAxisSize.min, children: [
                        IconButton(tooltip: '编辑', onPressed: () => _edit(tag), icon: const Icon(Icons.edit_outlined)),
                        IconButton(tooltip: '删除', onPressed: () => _delete(tag), icon: const Icon(Icons.delete_outline)),
                      ]),
                    ),
                ]),
    );
  }

  Color _color(String? value) {
    final parsed = int.tryParse((value ?? '').replaceFirst('#', ''), radix: 16);
    return parsed == null ? PandoraColors.petal : Color(0xFF000000 | parsed);
  }
}
