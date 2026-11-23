import 'dart:convert';
import 'dart:typed_data';

import 'package:image/image.dart' as img;

class AvatarException implements Exception {
  const AvatarException(this.message);

  final String message;

  @override
  String toString() => message;
}

class AvatarProcessor {
  const AvatarProcessor();

  static const int maxSourceBytes = 10 * 1024 * 1024;
  static const int maxEncodedBytes = 300000;
  static const int maxDataUriCharacters = 400000;
  static const int outputSize = 256;

  String process(Uint8List bytes) {
    if (bytes.isEmpty || bytes.length > maxSourceBytes) {
      throw const AvatarException('请选择不超过 10MB 的 PNG 或 JPG 图片');
    }
    if (!_isPng(bytes) && !_isJpeg(bytes)) {
      throw const AvatarException('头像仅支持 PNG 或 JPG 图片');
    }
    final decoded = img.decodeImage(bytes);
    if (decoded == null) throw const AvatarException('无法读取这张图片');
    final square = img.copyResizeCropSquare(decoded, size: outputSize);
    Uint8List? encoded;
    for (final quality in const [90, 82, 74, 66, 58, 50, 42]) {
      final candidate = Uint8List.fromList(
        img.encodeJpg(square, quality: quality),
      );
      if (candidate.length <= maxEncodedBytes) {
        encoded = candidate;
        break;
      }
    }
    if (encoded == null) throw const AvatarException('图片处理后仍超过头像大小限制');
    final value = 'data:image/jpeg;base64,${base64Encode(encoded)}';
    if (value.length > maxDataUriCharacters) {
      throw const AvatarException('图片处理后仍超过头像传输限制');
    }
    return value;
  }

  bool _isPng(Uint8List value) =>
      value.length >= 8 &&
      value[0] == 0x89 &&
      value[1] == 0x50 &&
      value[2] == 0x4E &&
      value[3] == 0x47 &&
      value[4] == 0x0D &&
      value[5] == 0x0A &&
      value[6] == 0x1A &&
      value[7] == 0x0A;

  bool _isJpeg(Uint8List value) =>
      value.length >= 3 &&
      value[0] == 0xFF &&
      value[1] == 0xD8 &&
      value[2] == 0xFF;
}
