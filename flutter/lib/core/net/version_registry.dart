/// ETag 版本注册表：任务、申请、日志、评论、通知、事项各自独立；
/// 绝不把任务版本发给申请/置顶等不同端点。
class VersionRegistry {
  final Map<String, String> _versions = <String, String>{};

  static String task(String id) => 'task:$id';
  static String approvalRequest(String id) => 'approval-request:$id';
  static String workLog(String id) => 'work-log:$id';
  static String comment(String id) => 'comment:$id';
  static String notification(String id) => 'notification:$id';
  static String dailyItem(String id) => 'daily-item:$id';
  static String homeItem(String id) => 'home-item:$id';
  static const String profile = 'profile';
  static const String me = 'me';

  String? operator [](String key) => _versions[key];

  void put(String key, String? etag) {
    if (etag == null || etag.isEmpty) {
      _versions.remove(key);
    } else {
      _versions[key] = etag;
    }
  }

  void remove(String key) => _versions.remove(key);

  void clear() => _versions.clear();

  Map<String, String> snapshot() => Map<String, String>.unmodifiable(_versions);
}
