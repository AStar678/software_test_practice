/// Mirrors backend PhoneNumbers: display separators are removed; a leading + is retained.
class PhoneNumbers {
  const PhoneNumbers._();
  static String? normalize(String raw) {
    final value = raw.replaceAll(RegExp(r'[ \u3000\t\-().]'), '');
    return RegExp(r'^\+?[0-9]{3,20}$').hasMatch(value) ? value : null;
  }
}
