import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../data/comments_api.dart';
import '../domain/comment_record.dart';

final commentsApiProvider = Provider<CommentsApi>((ref) {
  return CommentsApi(client: ref.watch(apiClientProvider));
});

class CommentsSection extends ConsumerStatefulWidget {
  const CommentsSection({super.key, required this.objectType, required this.objectId});
  final String objectType;
  final String objectId;
  @override
  ConsumerState<CommentsSection> createState() => _CommentsSectionState();
}

class _CommentsSectionState extends ConsumerState<CommentsSection> {
  final _input = TextEditingController();
  List<CommentRecord> _items = const [];
  int _total = 0;
  String? _cursor;
  bool _loading = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_load(reset: true));
  }

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  Future<void> _load({required bool reset}) async {
    if (_loading) return;
    setState(() => _loading = true);
    try {
      final page = await ref.read(commentsApiProvider).list(
            objectType: widget.objectType,
            objectId: widget.objectId,
            cursor: reset ? null : _cursor,
          );
      if (!mounted) return;
      setState(() {
        final merged = <String, CommentRecord>{};
        for (final item in [...(reset ? const <CommentRecord>[] : _items), ...page.items]) {
          merged[item.id] = item;
        }
        _items = merged.values.toList();
        _total = page.total;
        _cursor = page.nextCursor;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() { _error = error; _loading = false; });
    }
  }

  Future<void> _submit() async {
    final text = _input.text.trim();
    if (text.isEmpty) return;
    final keys = ref.read(operationKeysProvider);
    final scope = 'comment:${widget.objectType}:${widget.objectId}';
    final key = keys.keyFor(scope: scope, method: 'POST', path: '/${widget.objectType == 'log' ? 'work-logs' : 'tasks'}/${widget.objectId}/comments', body: {'body': text});
    try {
      await ref.read(commentsApiProvider).create(
            objectType: widget.objectType,
            objectId: widget.objectId,
            body: text,
            idempotencyKey: key,
          );
      keys.complete(scope);
      _input.clear();
      await _load(reset: true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _edit(CommentRecord comment) async {
    final value = await showDialog<String>(
      context: context,
      builder: (context) => _CommentEditDialog(initial: comment.body),
    );
    if (value == null || value.isEmpty || !mounted) return;
    final keys = ref.read(operationKeysProvider);
    final scope = 'comment:${comment.id}';
    final key = keys.keyFor(scope: scope, method: 'PATCH', path: '/comments/${comment.id}', body: {'body': value});
    try {
      await ref.read(commentsApiProvider).change(commentId: comment.id, rowVersion: comment.rowVersion, body: value, idempotencyKey: key);
      keys.complete(scope);
      await _load(reset: true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _delete(CommentRecord comment, bool delete) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('删除评论？'),
        content: const Text('删除后正文和通知摘要不再显示，审计记录保留。'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('删除')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final keys = ref.read(operationKeysProvider);
    final scope = 'comment:${comment.id}';
    final key = keys.keyFor(scope: scope, method: delete ? 'DELETE' : 'PATCH', path: '/comments/${comment.id}', body: delete ? const {} : {'body': comment.body});
    try {
      if (delete) {
        await ref.read(commentsApiProvider).delete(commentId: comment.id, rowVersion: comment.rowVersion, idempotencyKey: key);
      } else {
        await ref.read(commentsApiProvider).change(commentId: comment.id, rowVersion: comment.rowVersion, body: comment.body, idempotencyKey: key);
      }
      keys.complete(scope);
      await _load(reset: true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('评论（$_total）', style: Theme.of(context).textTheme.titleSmall),
        if (_error != null)
          Row(children: [
            Expanded(child: Text('$_error', style: const TextStyle(color: PandoraColors.overdue))),
            TextButton(onPressed: _loading ? null : () => _load(reset: true), child: const Text('重试')),
          ]),
        if (_items.isEmpty && !_loading) const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('还没有评论')),
        for (final comment in _items)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(comment.authorName, style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(comment.deleted ? '该评论已删除' : comment.body),
            trailing: comment.canManage && !comment.deleted
                ? PopupMenuButton<String>(
                    tooltip: '管理评论',
                    onSelected: (value) => value == 'edit' ? _edit(comment) : _delete(comment, true),
                    itemBuilder: (context) => const [
                      PopupMenuItem(value: 'edit', child: Text('编辑')),
                      PopupMenuItem(value: 'delete', child: Text('删除')),
                    ],
                  )
                : null,
          ),
        if (_cursor != null) TextButton(onPressed: _loading ? null : () => _load(reset: false), child: const Text('加载更多评论')),
        Row(children: [
          Expanded(child: TextField(controller: _input, minLines: 1, maxLines: 4, maxLength: 10000, decoration: const InputDecoration(hintText: '发表评论', counterText: ''))),
          IconButton(tooltip: '发送评论', onPressed: _submit, icon: const Icon(Icons.send)),
        ]),
      ],
    );
  }
}


class _CommentEditDialog extends StatefulWidget {
  const _CommentEditDialog({required this.initial});
  final String initial;

  @override
  State<_CommentEditDialog> createState() => _CommentEditDialogState();
}

class _CommentEditDialogState extends State<_CommentEditDialog> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initial);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('编辑评论'),
      content: TextField(controller: _controller, minLines: 3, maxLines: 8, maxLength: 10000, autofocus: true),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('取消')),
        FilledButton(onPressed: () => Navigator.of(context).pop(_controller.text.trim()), child: const Text('保存')),
      ],
    );
  }
}
