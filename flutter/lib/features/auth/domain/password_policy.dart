import 'dart:convert';

/// 新密码策略与服务端一致：至少 10 个字符、含字母与数字、UTF-8 至多 72 字节。
class PasswordPolicy {
  const PasswordPolicy._();

  static const int minLength = 10;
  static const int maxUtf8Bytes = 72;

  static String? validateNewPassword(String password) {
    if (password.length < minLength) {
      return '新密码至少 $minLength 个字符';
    }
    final hasLetter = RegExp(r'[A-Za-z]').hasMatch(password);
    final hasDigit = RegExp(r'\d').hasMatch(password);
    if (!hasLetter || !hasDigit) {
      return '新密码需同时包含字母与数字';
    }
    if (utf8.encode(password).length > maxUtf8Bytes) {
      return '新密码过长（UTF-8 最多 $maxUtf8Bytes 字节）';
    }
    return null;
  }

  static String? validateConfirmation(String password, String confirmation) {
    if (password != confirmation) return '两次输入的新密码不一致';
    return null;
  }

  static String? validateCurrentPassword(String current) {
    if (current.isEmpty) return '请输入原密码';
    return null;
  }

  /// UTF-16 文本长度（与 Java `String.length` 同口径），用于日志正文等上限检查。
  static int utf16Length(String text) => text.length;

  /// 服务端 Java `String.trim` 只去首尾 U+0000–U+0020；
  /// 不能用 Dart 更宽的 Unicode trim 替代，也不能改写界面原文。
  static String javaTrim(String text) {
    var start = 0;
    var end = text.length;
    while (start < end && text.codeUnitAt(start) <= 0x20) {
      start++;
    }
    while (end > start && text.codeUnitAt(end - 1) <= 0x20) {
      end--;
    }
    return text.substring(start, end);
  }
}
