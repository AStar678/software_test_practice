import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:flutter_svg/flutter_svg.dart';

/// 品牌标记：自有资产，仅装饰；提供语义名称。
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 52});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '潘多拉',
      image: true,
      child: SvgPicture.asset(
        'assets/brand/pandora-mark.svg',
        width: size,
        height: size,
      ),
    );
  }
}

/// 统一页面骨架：安全区、键盘避让与可滚动内容。
class PandoraPage extends StatelessWidget {
  const PandoraPage({
    super.key,
    required this.title,
    required this.child,
    this.actions,
    this.footer,
    this.showBack = false,
    this.onBack,
  });

  final String title;
  final Widget child;
  final List<Widget>? actions;
  final Widget? footer;
  final bool showBack;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        leading: showBack
            ? IconButton(
                tooltip: '返回',
                icon: const Icon(Icons.arrow_back),
                onPressed: onBack ?? () => Navigator.of(context).maybePop(),
              )
            : null,
        actions: actions,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: child,
        ),
      ),
      bottomNavigationBar: footer,
    );
  }
}

/// 离开前确认未保存草稿；不自动放弃用户输入。
class UnsavedChangesGuard extends StatelessWidget {
  const UnsavedChangesGuard({
    super.key,
    required this.hasUnsavedChanges,
    required this.child,
    this.message = '当前修改尚未保存，确定离开吗？',
  });

  final bool hasUnsavedChanges;
  final String message;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !hasUnsavedChanges,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop || !hasUnsavedChanges) return;
        final leave = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('放弃未保存的修改？'),
            content: Text(message),
            actions: [
              TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('继续编辑')),
              FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('放弃')),
            ],
          ),
        );
        if (leave == true && context.mounted) {
          Navigator.of(context).pop(result);
        }
      },
      child: child,
    );
  }
}

/// 表单首行提示：正式、短，不出现实现说明。
class FormHint extends StatelessWidget {
  const FormHint(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: const Color(0xFF7D6E80)),
      ),
    );
  }
}

void showSnack(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..clearSnackBars()
    ..showSnackBar(SnackBar(content: Text(message)));
}

void lightHaptic() {
  HapticFeedback.lightImpact();
}
