import 'work_log.dart';

/// 日志主动填充的纯文本规则，与服务端 Java String.trim/长度口径一致。
class WorkLogFill {
  static const int maxCodeUnits = 10000;

  static String javaTrim(String value) {
    var start = 0;
    var end = value.length;
    while (start < end && value.codeUnitAt(start) <= 0x20) {
      start++;
    }
    while (end > start && value.codeUnitAt(end - 1) <= 0x20) {
      end--;
    }
    return value.substring(start, end);
  }

  static String merge(String current, String addition) {
    return current.isEmpty ? addition : '$current\n\n$addition';
  }

  static bool fits(String value) => javaTrim(value).length <= maxCodeUnits;

  static String sourceText(FillSource source) {
    final lines = <String>[];
    if (source.dailyItems.isNotEmpty) {
      lines.add('每日事项');
      lines.addAll(source.dailyItems.map((row) => row.name));
    }
    if (source.tasks.isNotEmpty) {
      if (lines.isNotEmpty) lines.add('');
      lines.add('任务');
      lines.addAll(source.tasks.map((row) => row.name));
    }
    return lines.join('\n');
  }
}
