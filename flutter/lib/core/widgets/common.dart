import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:flutter_svg/flutter_svg.dart';

import '../errors/app_error.dart';

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

/// 主页面左上角标记：可见页名由潘多拉标记替代，语义仍保留页面名称。
class PandoraPageMark extends StatelessWidget {
  const PandoraPageMark({super.key, required this.pageName, this.size = 28});

  final String pageName;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      header: true,
      label: pageName,
      child: ExcludeSemantics(child: BrandMark(size: size)),
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
    this.titleWidget,
  });

  final String title;
  final Widget? titleWidget;
  final Widget child;
  final List<Widget>? actions;
  final Widget? footer;
  final bool showBack;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: titleWidget ?? Text(title),
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

/// 首页清单的纯展示序号：独立左列，不参与渐隐、不冒充业务标识。
class ListOrdinal extends StatelessWidget {
  const ListOrdinal(this.number, {super.key, this.width = 28});

  final int number;
  final double width;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '第 $number 条',
      child: SizedBox(
        width: width,
        child: Text(
          '$number',
          textAlign: TextAlign.start,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: const Color(0xFF8A7F8E),
          ),
        ),
      ),
    );
  }
}

void showSnack(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..clearSnackBars()
    ..showSnackBar(SnackBar(content: Text(message)));
}

/// 统一错误出口：只展示中文可操作提示，技术细节不进入界面。
void showErrorSnack(BuildContext context, Object error, {VoidCallback? onRetry}) {
  final message = userMessageFor(error);
  ScaffoldMessenger.of(context)
    ..clearSnackBars()
    ..showSnackBar(
      SnackBar(
        content: Text(message),
        action: onRetry == null
            ? null
            : SnackBarAction(label: '重试', onPressed: onRetry),
      ),
    );
}

void lightHaptic() {
  HapticFeedback.lightImpact();
}
