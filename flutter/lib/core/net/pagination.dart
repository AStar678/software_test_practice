/// 分页游标类型：通用任务为偏移字符串，评论为稳定 ID 游标，
/// 事项/表单/通知为数字 nextOffset；适配器分别处理，不强造统一数字游标。
enum CursorKind { offsetNumber, offsetString, stableId }

class PagedPage<T> {
  PagedPage({
    required this.items,
    this.total,
    this.nextOffset,
    this.nextCursor,
    this.businessDate,
  });

  final List<T> items;
  final int? total;
  final int? nextOffset;
  final String? nextCursor;
  final String? businessDate;

  bool get hasMore => nextOffset != null || (nextCursor != null && nextCursor!.isNotEmpty);
}

/// 单一查询代次的分页累加器：按 ID 去重、失败保留已加载内容、
/// 未读完不宣称全量。
class PagedAccumulator<T> {
  PagedAccumulator({
    required this.idOf,
    required this.cursorKind,
  });

  final String Function(T item) idOf;
  final CursorKind cursorKind;

  final List<T> _items = <T>[];
  final Set<String> _ids = <String>{};
  int? _nextOffset;
  String? _nextCursor;
  int? total;
  bool _started = false;
  bool _exhausted = false;
  bool _failed = false;
  Object? _error;
  int _generation = 0;

  List<T> get items => List<T>.unmodifiable(_items);
  int get generation => _generation;
  bool get started => _started;
  bool get failed => _failed;
  bool get complete => _started && _exhausted && !_failed;
  int? get nextOffset => _nextOffset;

  String? get nextCursor => _nextCursor;

  bool get hasMore => !_exhausted && !_failed;
  Object? get error => _error;

  /// 开启新代次：清空旧数据，后续旧响应被丢弃。
  void restart() {
    _items.clear();
    _ids.clear();
    _nextOffset = null;
    _nextCursor = null;
    total = null;
    _started = true;
    _exhausted = false;
    _failed = false;
    _error = null;
    _generation += 1;
  }

  bool isCurrent(int generation) => generation == _generation;

  /// 记录一页；[generation] 与当前不一致时整页丢弃并返回 false。
  bool addPage(PagedPage<T> page, {required int generation}) {
    if (generation != _generation) return false;
    _started = true;
    _failed = false;
    _error = null;
    for (final item in page.items) {
      final id = idOf(item);
      if (_ids.add(id)) {
        _items.add(item);
      }
    }
    if (page.total != null) total = page.total;
    _nextOffset = page.nextOffset;
    _nextCursor = page.nextCursor;
    _exhausted = !page.hasMore;
    return true;
  }

  void fail(Object error, {required int generation}) {
    if (generation != _generation) return;
    _failed = true;
    _error = error;
    _started = true;
  }

  /// 失败后重试：保留已加载内容，重新尝试当前游标。
  int retryGeneration() {
    _failed = false;
    _error = null;
    return _generation;
  }
}
