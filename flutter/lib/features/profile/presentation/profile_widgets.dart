import 'dart:convert';

import 'package:flutter/material.dart';

import '../../../core/theme/pandora_theme.dart';

const avatarPresets = <String, String>{
  'rabbit': '🐇',
  'cat': '🐱',
  'bear': '🐻',
  'panda': '🐼',
};

class ProfileAvatar extends StatelessWidget {
  const ProfileAvatar({
    super.key,
    required this.avatar,
    required this.name,
    this.radius = 28,
  });

  final String? avatar;
  final String name;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final value = avatar;
    ImageProvider<Object>? image;
    if (value != null &&
        (value.startsWith('data:image/jpeg;base64,') ||
            value.startsWith('data:image/png;base64,'))) {
      try {
        image = MemoryImage(
          base64Decode(value.substring(value.indexOf(',') + 1)),
        );
      } catch (_) {
        image = null;
      }
    }
    return CircleAvatar(
      radius: radius,
      backgroundColor: PandoraColors.petal,
      backgroundImage: image,
      child: image != null
          ? null
          : Text(
              avatarPresets[value] ??
                  (name.isEmpty ? '?' : name.characters.first),
              style: TextStyle(
                fontSize: radius * .8,
                color: PandoraColors.brand,
              ),
            ),
    );
  }
}
