import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_error.dart';
import '../../../core/providers.dart';
import '../../../core/session/session_manager.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/common.dart';
import '../domain/password_policy.dart';

/// 受限改密：只提供改密与退出，不预取任何业务内容。
class PasswordChangePage extends ConsumerStatefulWidget {
  const PasswordChangePage({super.key, this.restricted = false});

  final bool restricted;

  @override
  ConsumerState<PasswordChangePage> createState() => _PasswordChangePageState();
}

class _PasswordChangePageState extends ConsumerState<PasswordChangePage> {
  final _formKey = GlobalKey<FormState>();
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(sessionManagerProvider).changePassword(
            currentPassword: _currentController.text,
            newPassword: _newController.text,
          );
      // 会话层已清理凭证并回到登录页；输入由本次页面销毁。
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.statusCode == 401 || error.statusCode == 403
            ? '原密码不正确或当前密码不符合要求'
            : error.message;
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _logout() async {
    await ref.read(sessionManagerProvider).logout();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(sessionStateProvider).asData?.value;
    final restricted = widget.restricted || (state?.isRestricted ?? false);
    return PopScope(
      canPop: !restricted,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('修改密码'),
          automaticallyImplyLeading: !restricted,
          actions: [
            TextButton(onPressed: _logout, child: const Text('退出登录')),
          ],
        ),
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (restricted) ...[
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: PandoraColors.mint,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Text('首次登录或密码已重置，请设置新密码后重新登录。'),
                        ),
                        const SizedBox(height: 16),
                      ],
                      TextFormField(
                        controller: _currentController,
                        obscureText: true,
                        autofillHints: const [AutofillHints.password],
                        decoration: const InputDecoration(labelText: '原密码'),
                        validator: (value) => PasswordPolicy.validateCurrentPassword(value ?? ''),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _newController,
                        obscureText: true,
                        autofillHints: const [AutofillHints.newPassword],
                        decoration: const InputDecoration(labelText: '新密码'),
                        validator: (value) => PasswordPolicy.validateNewPassword(value ?? ''),
                      ),
                      const SizedBox(height: 6),
                      const FormHint('至少 10 个字符，需含字母和数字。'),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _confirmController,
                        obscureText: true,
                        decoration: const InputDecoration(labelText: '再次输入新密码'),
                        validator: (value) => PasswordPolicy.validateConfirmation(_newController.text, value ?? ''),
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Semantics(
                          liveRegion: true,
                          child: Text(
                            _error!,
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: PandoraColors.overdue),
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),
                      FilledButton(
                        onPressed: _submitting ? null : _submit,
                        child: _submitting
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Text('保存并重新登录'),
                      ),
                      const SizedBox(height: 10),
                      const Text(
                        '修改成功后当前账号的所有登录会话都会退出，需要使用新密码重新登录。',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, color: PandoraColors.muted),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// 启动/恢复校验页：离线时明确重试，不展示旧敏感正文。
class SessionCheckPage extends ConsumerWidget {
  const SessionCheckPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(sessionStateProvider).asData?.value;
    final error = state?.error;
    final phase = state?.phase ?? SessionPhase.bootstrapping;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const BrandMark(size: 56),
                const SizedBox(height: 16),
                if (error == null && phase != SessionPhase.checking) ...[
                  const SizedBox(
                    width: 26,
                    height: 26,
                    child: CircularProgressIndicator(strokeWidth: 2.5),
                  ),
                  const SizedBox(height: 12),
                  const Text('正在读取登录状态'),
                ] else if (error != null) ...[
                  const Icon(Icons.wifi_off_outlined, size: 32, color: PandoraColors.overdue),
                  const SizedBox(height: 10),
                  Text(error.message, textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  OutlinedButton(
                    onPressed: () => ref.read(sessionManagerProvider).retryVerification(),
                    child: const Text('重试'),
                  ),
                  TextButton(
                    onPressed: () => ref.read(sessionManagerProvider).logout(),
                    child: const Text('重新登录'),
                  ),
                ] else ...[
                  const SizedBox(
                    width: 26,
                    height: 26,
                    child: CircularProgressIndicator(strokeWidth: 2.5),
                  ),
                  const SizedBox(height: 12),
                  const Text('正在核验登录状态'),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
