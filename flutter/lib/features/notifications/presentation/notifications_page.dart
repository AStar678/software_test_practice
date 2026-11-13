import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/errors/app_error.dart';
import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/state_views.dart';
import '../domain/notification_record.dart';
import 'notifications_providers.dart';

class NotificationsPage extends ConsumerWidget {
  const NotificationsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final epoch = ref.watch(accountEpochProvider);
    final user = ref.watch(currentUserProvider);
    return _NotificationsList(
      key: ValueKey((epoch, user?.id, user?.authzVersion)),
    );
  }
}

class _NotificationsList extends ConsumerStatefulWidget {
  const _NotificationsList({super.key});

  @override
  ConsumerState<_NotificationsList> createState() => _NotificationsListState();
}

class _NotificationsListState extends ConsumerState<_NotificationsList> {
  NotificationReadFilter _read = NotificationReadFilter.all;
  NotificationCategory _category = NotificationCategory.all;
  final List<NotificationRecord> _items = [];
  final _scroll = ScrollController();
  int? _nextOffset = 0;
  int _total = 0;
  int _unreadCount = 0;
  int _generation = 0;
  bool _compact = true;
  bool _loading = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('通知 · 未读 $_unreadCount'),
        actions: [
          Semantics(
            button: true,
            label: _compact ? '切换为完整通知模式' : '切换为精简通知模式',
            value: _compact ? '当前为精简模式' : '当前为完整模式',
            child: IconButton(
              tooltip: _compact ? '完整模式' : '精简模式',
              onPressed: () => setState(() => _compact = !_compact),
              icon: Icon(
                _compact
                    ? Icons.view_agenda_outlined
                    : Icons.view_headline_outlined,
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Material(
              color: Theme.of(context).scaffoldBackgroundColor,
              elevation: 1,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SegmentedButton<NotificationReadFilter>(
                      segments: [
                        for (final value in NotificationReadFilter.values)
                          ButtonSegment(value: value, label: Text(value.label)),
                      ],
                      selected: {_read},
                      onSelectionChanged: (value) {
                        _read = value.single;
                        _load(reset: true);
                      },
                    ),
                    const SizedBox(height: 8),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          for (final value in NotificationCategory.values)
                            Padding(
                              padding: const EdgeInsets.only(right: 6),
                              child: ChoiceChip(
                                label: Text(value.label),
                                selected: _category == value,
                                onSelected: (_) {
                                  _category = value;
                                  _load(reset: true);
                                },
                              ),
                            ),
                        ],
                      ),
                    ),
                    Row(
                      children: [
                        Text(
                          '共 $_total 条',
                          style: const TextStyle(color: PandoraColors.muted),
                        ),
                        const Spacer(),
                        if (_read != NotificationReadFilter.all ||
                            _category != NotificationCategory.all)
                          TextButton(
                            onPressed: () {
                              _read = NotificationReadFilter.all;
                              _category = NotificationCategory.all;
                              _load(reset: true);
                            },
                            child: const Text('清空筛选'),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            Expanded(child: _body()),
          ],
        ),
      ),
    );
  }

  Widget _body() {
    if (_items.isEmpty && _loading) return const LoadingView(label: '正在读取通知');
    if (_items.isEmpty && _error != null) {
      return ErrorView(error: _error!, onRetry: () => _load(reset: true));
    }
    if (_items.isEmpty) {
      final filtered =
          _read != NotificationReadFilter.all ||
          _category != NotificationCategory.all;
      return EmptyView(message: filtered ? '当前筛选条件下没有通知' : '暂无通知');
    }
    return RefreshIndicator(
      onRefresh: () => _load(reset: true),
      child: ListView.separated(
        key: PageStorageKey(
          'notifications:${_read.apiValue}:${_category.apiValue}:$_compact',
        ),
        controller: _scroll,
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
        itemCount: _items.length + (_nextOffset != null ? 1 : 0),
        separatorBuilder: (_, _) => const SizedBox(height: 6),
        itemBuilder: (context, index) {
          if (index == _items.length) {
            return Center(
              child: _error != null
                  ? TextButton(
                      onPressed: () => _load(),
                      child: const Text('加载失败，重试'),
                    )
                  : TextButton(
                      onPressed: _loading ? null : () => _load(),
                      child: Text(_loading ? '加载中…' : '加载更多'),
                    ),
            );
          }
          final item = _items[index];
          return Card(
            child: ListTile(
              leading: Semantics(
                label: item.unread ? '未读通知' : '已读通知',
                child: Icon(
                  item.unread
                      ? Icons.mark_email_unread_outlined
                      : Icons.drafts_outlined,
                  color: item.unread
                      ? PandoraColors.brand
                      : PandoraColors.muted,
                ),
              ),
              title: Text(
                item.objectName ?? item.title ?? item.purpose ?? '通知',
              ),
              subtitle: _compact
                  ? Text(
                      '${_categoryLabel(item.category)} · ${_time(item.createdAt)}',
                    )
                  : Text(
                      '${item.purpose ?? _categoryLabel(item.category)} · ${_time(item.createdAt)}\n${item.summary}',
                    ),
              isThreeLine: !_compact,
              onTap: () async {
                // 列表读取与模式/筛选切换不标读；只有详情页在任务 9.2 调用 open。
                final changed = await context.push<bool>(
                  '/notifications/${item.id}',
                );
                if (changed == true || item.unread) await _load(reset: true);
              },
            ),
          );
        },
      ),
    );
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading && !reset) return;
    final generation = reset ? ++_generation : _generation;
    if (reset) {
      setState(() {
        _items.clear();
        _nextOffset = 0;
        _error = null;
        _loading = true;
      });
    } else {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final page = await ref
          .read(notificationsApiProvider)
          .list(read: _read, category: _category, offset: _nextOffset ?? 0);
      if (!mounted || generation != _generation) return;
      final byId = {for (final item in _items) item.id: item};
      for (final item in page.items) {
        byId[item.id] = item;
      }
      setState(() {
        _items
          ..clear()
          ..addAll(byId.values);
        _nextOffset = page.nextOffset;
        _total = page.total;
        _unreadCount = page.unreadCount;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || generation != _generation) return;
      setState(() {
        if (error is ApiException &&
            (error.isForbidden || error.isUnauthorized)) {
          _items.clear();
          _total = 0;
          _unreadCount = 0;
        }
        _error = error;
        _loading = false;
      });
    }
  }

  String _categoryLabel(String value) =>
      NotificationCategory.values
          .where((item) => item.apiValue == value)
          .map((item) => item.label)
          .firstOrNull ??
      '其他';

  String _time(DateTime? value) => value == null
      ? '时间未知'
      : DateFormat('MM-dd HH:mm')
            .format(ref.read(companyTimeZoneProvider).toLocal(value));
}
