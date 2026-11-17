import 'package:shared_preferences/shared_preferences.dart';

/// 仅保存非敏感、账号命名空间的偏好：页签、日历模式、浏览锚点。
/// 业务正文、联系方式、草稿、token 一律不进入普通偏好。
class AppPreferences {
  AppPreferences._(this._prefs, this._accountId, this._calendarPerson);

  final SharedPreferences _prefs;
  final String? _accountId;
  final String? _calendarPerson;

  static const String _prefix = 'pandora.pref.v1';

  static const Set<String> _allowedKeys = {
    'shell.lastTab',
    'dailyItems.anchor',
    'dailyItems.anchorOffset',
    'calendar.mode',
    'calendar.density',
    'calendar.lastDate',
    'calendar.lastOffset',
    'board.scroll',
    'tasksTable.filters',
    'tasksTable.columnGroup',
    'tasksTable.pageIndex',
    'tasksTable.scrollOffset',
  };

  static Future<AppPreferences> load(String? accountId, {String? calendarPerson}) async {
    final prefs = await SharedPreferences.getInstance();
    return AppPreferences._(prefs, accountId, calendarPerson);
  }

  String _scoped(String key) {
    assert(_allowedKeys.contains(key), '不允许持久化非白名单偏好：$key');
    final account = _accountId ?? 'anonymous';
    final person = _calendarPerson;
    return person == null ? '$_prefix.$account.$key' : '$_prefix.$account.calendarPerson.$person.$key';
  }

  String? getString(String key) => _prefs.getString(_scoped(key));

  bool? getBool(String key) => _prefs.getBool(_scoped(key));

  Future<void> setString(String key, String value) async {
    await _prefs.setString(_scoped(key), value);
  }

  Future<void> setBool(String key, bool value) async {
    await _prefs.setBool(_scoped(key), value);
  }

  Future<void> remove(String key) async {
    await _prefs.remove(_scoped(key));
  }

  /// 退出/切换账号时清理该账号的合法偏好。
  Future<void> clearAccount() async {
    final prefix = '$_prefix.${_accountId ?? 'anonymous'}.';
    for (final key in _prefs.getKeys().where((key) => key.startsWith(prefix))) {
      await _prefs.remove(key);
    }
  }
}
