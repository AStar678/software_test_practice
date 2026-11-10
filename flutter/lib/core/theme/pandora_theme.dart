import 'package:flutter/material.dart';

/// 手账视觉基线：沿用既有信息层级、圆角与颜色，不用默认 Material 配色覆盖。
class PandoraColors {
  const PandoraColors._();

  static const Color ink = Color(0xFF51495E);
  static const Color brand = Color(0xFFA34470);
  static const Color paper = Color(0xFFFFF9FC);
  static const Color mint = Color(0xFFDCF2E6);
  static const Color petal = Color(0xFFFBE5EF);
  static const Color muted = Color(0xFF7D6E80);
  static const Color line = Color(0xFFEADFE8);

  /// 状态色必须同时配合文字/图标，不能只靠颜色表达。
  static const Color open = Color(0xFF4A72A8);
  static const Color overdue = Color(0xFFB4463C);
  static const Color completed = Color(0xFF7C7C72);
  static const Color pending = Color(0xFF9A6B1F);

  static Color priority(String? priority) {
    return switch (priority) {
      'urgent' => const Color(0xFFB4463C),
      'high' => const Color(0xFFC2762F),
      'medium' => const Color(0xFF4A72A8),
      'low' => const Color(0xFF6C7A63),
      _ => muted,
    };
  }

  static String priorityLabel(String? priority) {
    return switch (priority) {
      'urgent' => '紧急',
      'high' => '高',
      'medium' => '中',
      'low' => '低',
      _ => '未设置',
    };
  }
}

class PandoraTheme {
  const PandoraTheme._();

  static const double cardRadius = 20;
  static const double buttonRadius = 13;

  static ThemeData build() {
    final scheme = ColorScheme.fromSeed(
      seedColor: PandoraColors.brand,
      brightness: Brightness.light,
      surface: PandoraColors.paper,
    ).copyWith(
      primary: PandoraColors.brand,
      onPrimary: Colors.white,
      secondary: PandoraColors.ink,
      surface: PandoraColors.paper,
      error: PandoraColors.overdue,
      outlineVariant: PandoraColors.line,
    );

    final base = ThemeData(useMaterial3: true, colorScheme: scheme);
    return base.copyWith(
      scaffoldBackgroundColor: PandoraColors.paper,
      textTheme: base.textTheme.apply(
        bodyColor: PandoraColors.ink,
        displayColor: PandoraColors.ink,
        fontSizeFactor: 1.0,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: PandoraColors.paper,
        foregroundColor: PandoraColors.ink,
        elevation: 0,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(cardRadius),
          side: const BorderSide(color: PandoraColors.line),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(buttonRadius)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(buttonRadius)),
          side: const BorderSide(color: PandoraColors.line),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(buttonRadius),
          borderSide: const BorderSide(color: PandoraColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(buttonRadius),
          borderSide: const BorderSide(color: PandoraColors.line),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        indicatorColor: PandoraColors.petal,
        labelTextStyle: WidgetStatePropertyAll(base.textTheme.labelMedium?.copyWith(color: PandoraColors.ink)),
      ),
      chipTheme: base.chipTheme.copyWith(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
      snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
    );
  }

  /// 品牌标记：项目内自有 SVG 资产，只作装饰，不含未经许可字体。
  static const String brandMarkAsset = 'assets/brand/pandora-mark.svg';
}
