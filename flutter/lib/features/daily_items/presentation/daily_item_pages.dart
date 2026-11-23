import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/company/company_date.dart';
import '../../../core/company/date_picker_bounds.dart';
import '../../../core/errors/app_error.dart';
import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/state_views.dart';
import '../../home/presentation/home_providers.dart';
import '../domain/daily_item.dart';
import '../domain/month_layout.dart';
import 'daily_items_calendar.dart';
import 'daily_items_providers.dart';

/// 新增每日事项：公司日期首尾包含、纯文本；失败保草稿。
class DailyItemCreatePage extends ConsumerStatefulWidget {
  const DailyItemCreatePage({super.key, this.initialDate});

  final CompanyDate? initialDate;

  @override
  ConsumerState<DailyItemCreatePage> createState() =>
      _DailyItemCreatePageState();
}

class _DailyItemCreatePageState extends ConsumerState<DailyItemCreatePage> {
  final _formKey = GlobalKey<FormState>();
  final _bodyController = TextEditingController();
  late CompanyDate _start =
      widget.initialDate ?? ref.read(workspaceClockProvider).businessDate;
  late CompanyDate _end = _start;
  bool _allDay = true;
  TimeOfDay? _startTime;
  TimeOfDay? _endTime;
  bool _saving = false;
  bool _dirty = false;
  String? _error;

  String? get _startClock =>
      _startTime == null ? null : _hm(_startTime!);

  String? get _endClock => _endTime == null ? null : _hm(_endTime!);

  static String _hm(TimeOfDay time) =>
      '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';

  Future<void> _pickTime({required bool isStart}) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: (isStart ? _startTime : _endTime) ?? const TimeOfDay(hour: 9, minute: 0),
      helpText: isStart ? '选择开始时刻' : '选择截止时刻',
      cancelText: '取消',
      confirmText: '确定',
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _startTime = picked;
      } else {
        _endTime = picked;
      }
      _dirty = true;
      _error = null;
    });
  }

  bool get _timedRangeValid {
    if (_allDay) return true;
    final start = _startTime;
    final end = _endTime;
    if (start == null || end == null) return false;
    final startMinutes = start.hour * 60 + start.minute;
    final endMinutes = end.hour * 60 + end.minute;
    if (_start == _end) return endMinutes >= startMinutes;
    return true;
  }

  @override
  void dispose() {
    _bodyController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (!_allDay && (_startTime == null || _endTime == null)) {
      setState(() => _error = '请选择开始和截止时刻');
      return;
    }
    if (!_timedRangeValid) {
      setState(() => _error = '截止时间不能早于开始时间');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref
          .read(dailyItemsProvider.notifier)
          .createItem(
            start: _start,
            end: _end,
            body: _bodyController.text.trim(),
            allDay: _allDay,
            startTime: _startClock,
            endTime: _endClock,
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
          onChanged: () => setState(() {
            _dirty = true;
            _error = null;
          }),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              TextFormField(
                controller: _bodyController,
                minLines: 4,
                maxLines: 8,
                maxLength: 2000,
                decoration: const InputDecoration(
                  labelText: '事项内容',
                  alignLabelWithHint: true,
                ),
                validator: (value) =>
                    (value ?? '').trim().isEmpty ? '请输入事项内容' : null,
              ),
              const SizedBox(height: 12),
              _DateRangeFields(
                start: _start,
                end: _end,
                onChanged: (start, end) => setState(() {
                  _start = start;
                  _end = end;
                  _dirty = true;
                  _error = null;
                }),
              ),
              const SizedBox(height: 8),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('全天'),
                subtitle: Text(_allDay ? '按日期范围展示，不记录具体时刻' : '按公司时区的开始/截止时刻判断逾期'),
                value: _allDay,
                onChanged: (value) => setState(() {
                  _allDay = value;
                  if (value) {
                    _startTime = null;
                    _endTime = null;
                  } else {
                    _startTime ??= const TimeOfDay(hour: 9, minute: 0);
                    _endTime ??= const TimeOfDay(hour: 18, minute: 0);
                  }
                  _dirty = true;
                  _error = null;
                }),
              ),
              if (!_allDay)
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => _pickTime(isStart: true),
                        child: Text(
                          _startTime == null ? '开始时刻' : '开始 ${_hm(_startTime!)}',
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => _pickTime(isStart: false),
                        child: Text(
                          _endTime == null ? '截止时刻' : '截止 ${_hm(_endTime!)}',
                        ),
                      ),
                    ),
                  ],
                ),
              const SizedBox(height: 12),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: TextStyle(color: PandoraColors.overdue)),
              ],
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _saving || _bodyController.text.trim().isEmpty
                    ? null
                    : _save,
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
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
  const _DateRangeFields({
    required this.start,
    required this.end,
    required this.onChanged,
  });

  final CompanyDate start;
  final CompanyDate end;
  final void Function(CompanyDate start, CompanyDate end) onChanged;

  Future<void> _pick(BuildContext context, {required bool isStart}) async {
    final startDay = DateTime(start.year, start.month, start.day);
    final initial = isStart ? start : end;
    final picked = await showDatePicker(
      context: context,
      initialDate: DatePickerBounds.clampInitial(
        DateTime(initial.year, initial.month, initial.day),
        startDay,
      )!,
      firstDate: DateTime(2020, 1, 1),
      lastDate: DateTime(2040, 12, 31),
      selectableDayPredicate: isStart ? null : (day) => DatePickerBounds.endOnOrAfter(day, startDay),
      helpText: isStart ? '选择开始日期' : '选择结束日期',
      cancelText: '取消',
      confirmText: '确定',
    );
    if (picked == null) return;
    final date = CompanyDate(picked.year, picked.month, picked.day);
    if (isStart) {
      onChanged(date, date.isAfter(end) ? date : end);
    } else {
      onChanged(start, date);
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
  ConsumerState<DailyItemDetailPage> createState() =>
      _DailyItemDetailPageState();
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
  bool _allDay = true;
  TimeOfDay? _startTime;
  TimeOfDay? _endTime;

  static TimeOfDay? _parseTime(String? value) {
    if (value == null) return null;
    final parts = value.split(':');
    if (parts.length < 2) return null;
    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null) return null;
    return TimeOfDay(hour: hour, minute: minute);
  }

  static String? _clock(TimeOfDay? time) => time == null
      ? null
      : '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';

  Future<void> _pickTime({required bool isStart}) async {
    final picked = await showTimePicker(
      context: context,
      initialTime:
          (isStart ? _startTime : _endTime) ?? const TimeOfDay(hour: 9, minute: 0),
      helpText: isStart ? '选择开始时刻' : '选择截止时刻',
      cancelText: '取消',
      confirmText: '确定',
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _startTime = picked;
      } else {
        _endTime = picked;
      }
      _dirty = true;
      _error = null;
    });
  }

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
        _allDay = item.allDay;
        _startTime = _parseTime(item.startTime);
        _endTime = _parseTime(item.endTime);
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
    if (!_allDay && (_startTime == null || _endTime == null)) {
      setState(() => _error = '请选择开始和截止时刻');
      return;
    }
    if (!_allDay && start == end) {
      final startMinutes = _startTime!.hour * 60 + _startTime!.minute;
      final endMinutes = _endTime!.hour * 60 + _endTime!.minute;
      if (endMinutes < startMinutes) {
        setState(() => _error = '截止时间不能早于开始时间');
        return;
      }
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final updated = await ref
          .read(dailyItemsProvider.notifier)
          .updateItem(
            original: original,
            body: _bodyController.text.trim(),
            start: start,
            end: end,
            allDay: _allDay,
            startTime: _clock(_startTime),
            endTime: _clock(_endTime),
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
      final updated = await ref
          .read(dailyItemsProvider.notifier)
          .toggleCompleted(item);
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
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('取消'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: PandoraColors.overdue,
            ),
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
      final color = itemStateColor(visualStateOf(item));
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Text(
                item.startDate == item.endDate
                    ? item.startDate.iso
                    : '${item.startDate.iso} 至 ${item.endDate.iso}',
                style: Theme.of(context).textTheme.bodySmall
                    ?.copyWith(color: color),
              ),
              const SizedBox(height: 4),
              Text(
                item.modeLabel,
                style: Theme.of(context).textTheme.labelSmall
                    ?.copyWith(color: PandoraColors.muted),
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
            style: Theme.of(context).textTheme.labelSmall
                ?.copyWith(color: PandoraColors.muted),
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
          decoration: const InputDecoration(
            labelText: '事项内容',
            alignLabelWithHint: true,
          ),
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
        const SizedBox(height: 8),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('全天'),
          subtitle: Text(
            _allDay ? '按日期范围展示，不记录具体时刻' : '按公司时区的开始/截止时刻判断逾期',
          ),
          value: _allDay,
          onChanged: (value) => setState(() {
            _allDay = value;
            if (value) {
              _startTime = null;
              _endTime = null;
            } else {
              _startTime ??= const TimeOfDay(hour: 9, minute: 0);
              _endTime ??= const TimeOfDay(hour: 18, minute: 0);
            }
            _dirty = true;
            _error = null;
          }),
        ),
        if (!_allDay)
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _pickTime(isStart: true),
                  child: Text(
                    _startTime == null
                        ? '开始时刻'
                        : '开始 ${_clock(_startTime)}',
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _pickTime(isStart: false),
                  child: Text(
                    _endTime == null ? '截止时刻' : '截止 ${_clock(_endTime)}',
                  ),
                ),
              ),
            ],
          ),
        if (_error != null) ...[
          const SizedBox(height: 10),
          Text(_error!, style: TextStyle(color: PandoraColors.overdue)),
        ],
        const SizedBox(height: 18),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
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
                  _allDay = item.allDay;
                  _startTime = _parseTime(item.startTime);
                  _endTime = _parseTime(item.endTime);
                }),
          child: const Text('取消编辑'),
        ),
      ],
    );
  }
}
