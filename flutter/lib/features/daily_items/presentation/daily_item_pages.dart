import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/company/company_date.dart';
import '../../../core/errors/app_error.dart';
import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/state_views.dart';
import '../../home/presentation/home_providers.dart';
import '../domain/daily_item.dart';
import 'daily_items_providers.dart';

/// 新增每日事项：公司日期首尾包含、纯文本；失败保草稿。
class DailyItemCreatePage extends ConsumerStatefulWidget {
  const DailyItemCreatePage({super.key, this.initialDate});

  final CompanyDate? initialDate;

  @override
  ConsumerState<DailyItemCreatePage> createState() => _DailyItemCreatePageState();
}

class _DailyItemCreatePageState extends ConsumerState<DailyItemCreatePage> {
  final _formKey = GlobalKey<FormState>();
  final _bodyController = TextEditingController();
  late CompanyDate _start = widget.initialDate ?? ref.read(workspaceClockProvider).businessDate;
  late CompanyDate _end = _start;
  bool _saving = false;
  bool _dirty = false;
  String? _error;

  @override
  void dispose() {
    _bodyController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(dailyItemsProvider.notifier).createItem(
            start: _start,
            end: _end,
            body: _bodyController.text.trim(),
          );
      unawaited(ref.read(homeDataProvider.notifier).refresh());
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return UnsavedChangesGuard(
      hasUnsavedChanges: _dirty && _bodyController.text.trim().isNotEmpty,
      child: PandoraPage(
        title: '新建每日事项',
        showBack: true,
        onBack: () => Navigator.of(context).maybePop(),
        child: Form(
          key: _formKey,
          onChanged: () => setState(() => _dirty = true),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              TextFormField(
                controller: _bodyController,
                minLines: 4,
                maxLines: 8,
                maxLength: 2000,
                decoration: const InputDecoration(labelText: '事项内容', alignLabelWithHint: true),
                validator: (value) => (value ?? '').trim().isEmpty ? '请输入事项内容' : null,
              ),
              const SizedBox(height: 12),
              _DateRangeFields(
                start: _start,
                end: _end,
                onChanged: (start, end) => setState(() {
                  _start = start;
                  _end = end;
                  _dirty = true;
                }),
              ),
              const SizedBox(height: 12),
              Text(
                '起止日期都包含；跨天仍是同一条记录。',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: PandoraColors.muted),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: TextStyle(color: PandoraColors.overdue)),
              ],
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _saving || _bodyController.text.trim().isEmpty ? null : _save,
                child: _saving
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('保存事项'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DateRangeFields extends StatelessWidget {
  const _DateRangeFields({required this.start, required this.end, required this.onChanged});

  final CompanyDate start;
  final CompanyDate end;
  final void Function(CompanyDate start, CompanyDate end) onChanged;

  Future<void> _pick(BuildContext context, {required bool isStart}) async {
    final initial = isStart ? start : end;
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(initial.year, initial.month, initial.day),
      firstDate: DateTime(2020, 1, 1),
      lastDate: DateTime(2040, 12, 31),
      helpText: isStart ? '选择开始日期' : '选择结束日期',
      cancelText: '取消',
      confirmText: '确定',
    );
    if (picked == null) return;
    final date = CompanyDate(picked.year, picked.month, picked.day);
    if (isStart) {
      onChanged(date, date.isAfter(end) ? date : end);
    } else {
      onChanged(date.isBefore(start) ? date : start, date);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: () => _pick(context, isStart: true),
            child: Text('开始 ${start.iso}'),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: OutlinedButton(
            onPressed: () => _pick(context, isStart: false),
            child: Text('结束 ${end.iso}'),
          ),
        ),
      ],
    );
  }
}

/// 事项详情与编辑：真实版本、同一 ID、完成/取消完成、确认删除。
class DailyItemDetailPage extends ConsumerStatefulWidget {
  const DailyItemDetailPage({super.key, required this.itemId});

  final String itemId;

  @override
  ConsumerState<DailyItemDetailPage> createState() => _DailyItemDetailPageState();
}

class _DailyItemDetailPageState extends ConsumerState<DailyItemDetailPage> {
  DailyItem? _item;
  Object? _loadError;
  bool _loading = true;
  bool _editing = false;
  bool _saving = false;
  bool _dirty = false;
  String? _error;
  final _bodyController = TextEditingController();
  CompanyDate? _start;
  CompanyDate? _end;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void dispose() {
    _bodyController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final item = await ref.read(dailyItemsApiProvider).detail(widget.itemId);
      if (!mounted) return;
      setState(() {
        _item = item;
        _bodyController.text = item.body;
        _start = item.startDate;
        _end = item.endDate;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadError = error;
        _loading = false;
      });
    }
  }

  Future<void> _save() async {
    final original = _item;
    final start = _start;
    final end = _end;
    if (original == null || start == null || end == null) return;
    if (_bodyController.text.trim().isEmpty) {
      setState(() => _error = '请输入事项内容');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final updated = await ref.read(dailyItemsProvider.notifier).updateItem(
            original: original,
            body: _bodyController.text.trim(),
            start: start,
            end: end,
          );
      unawaited(ref.read(homeDataProvider.notifier).refresh());
      if (!mounted) return;
      setState(() {
        _item = updated;
        _editing = false;
        _dirty = false;
        _saving = false;
      });
      showSnack(context, '已保存');
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error is ApiException ? error.message : '保存失败，请重试';
      });
    }
  }

  Future<void> _toggle() async {
    final item = _item;
    if (item == null) return;
    try {
      final updated = await ref.read(dailyItemsProvider.notifier).toggleCompleted(item);
      unawaited(ref.read(homeDataProvider.notifier).refresh());
      if (!mounted) return;
      setState(() => _item = updated);
    } catch (error) {
      if (!mounted) return;
      showSnack(context, error is ApiException ? error.message : '操作失败，请重试');
    }
  }

  Future<void> _delete() async {
    final item = _item;
    if (item == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('删除这条事项？'),
        content: const Text('删除后无法恢复。'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('取消')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: PandoraColors.overdue),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('删除'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await ref.read(dailyItemsProvider.notifier).deleteItem(item);
      unawaited(ref.read(homeDataProvider.notifier).refresh());
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      showSnack(context, error is ApiException ? error.message : '删除失败，请重试');
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = _item;
    return UnsavedChangesGuard(
      hasUnsavedChanges: _editing && _dirty,
      child: PandoraPage(
        title: '事项详情',
        showBack: true,
        onBack: () => Navigator.of(context).maybePop(),
        actions: [
          if (item != null && !_editing)
            IconButton(
              tooltip: '编辑事项',
              icon: const Icon(Icons.edit_outlined),
              onPressed: () => setState(() => _editing = true),
            ),
        ],
        child: _loading
            ? const LoadingView()
            : _loadError != null
                ? ErrorView(error: _loadError!, onRetry: _load)
                : item == null
                    ? const EmptyView(message: '事项不存在或已删除')
                    : _buildContent(item),
      ),
    );
  }

  Widget _buildContent(DailyItem item) {
    if (!_editing) {
      final color = item.isCompleted
          ? PandoraColors.completed
          : (item.isOverdue ? PandoraColors.overdue : PandoraColors.open);
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              StatusBadge(label: item.stateLabel, color: color),
              const Spacer(),
              Text(
                item.startDate == item.endDate
                    ? item.startDate.iso
                    : '${item.startDate.iso} 至 ${item.endDate.iso}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: PandoraColors.muted),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(item.body, style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: _toggle,
            icon: Icon(item.isCompleted ? Icons.undo : Icons.check),
            label: Text(item.isCompleted ? '取消完成' : '标记完成'),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () => setState(() => _editing = true),
            icon: const Icon(Icons.edit_outlined),
            label: const Text('编辑'),
          ),
          const SizedBox(height: 10),
          TextButton.icon(
            onPressed: _delete,
            icon: const Icon(Icons.delete_outline),
            label: const Text('删除事项'),
            style: TextButton.styleFrom(foregroundColor: PandoraColors.overdue),
          ),
          const SizedBox(height: 18),
          Text(
            '创建于 ${item.createdAt == null ? '未知' : ref.read(workspaceClockProvider).zone.formatDateTime(item.createdAt!)}',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(color: PandoraColors.muted),
          ),
        ],
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          controller: _bodyController,
          minLines: 4,
          maxLines: 8,
          maxLength: 2000,
          decoration: const InputDecoration(labelText: '事项内容', alignLabelWithHint: true),
          onChanged: (_) => setState(() => _dirty = true),
        ),
        const SizedBox(height: 12),
        _DateRangeFields(
          start: _start ?? item.startDate,
          end: _end ?? item.endDate,
          onChanged: (start, end) => setState(() {
            _start = start;
            _end = end;
            _dirty = true;
          }),
        ),
        if (_error != null) ...[
          const SizedBox(height: 10),
          Text(_error!, style: TextStyle(color: PandoraColors.overdue)),
        ],
        const SizedBox(height: 18),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('保存修改'),
        ),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: _saving
              ? null
              : () => setState(() {
                    _editing = false;
                    _dirty = false;
                    _error = null;
                    _bodyController.text = item.body;
                    _start = item.startDate;
                    _end = item.endDate;
                  }),
          child: const Text('取消编辑'),
        ),
      ],
    );
  }
}
