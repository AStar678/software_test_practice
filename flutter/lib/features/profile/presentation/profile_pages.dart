import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/errors/app_error.dart';
import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/state_views.dart';
import '../../auth/domain/employee_user.dart';
import '../domain/avatar_processor.dart';
import 'profile_providers.dart';
import 'profile_widgets.dart';

class ProfileDetailPage extends ConsumerWidget {
  const ProfileDetailPage({super.key, required this.personId});

  final String personId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(personProfileProvider(personId));
    return Scaffold(
      appBar: AppBar(title: const Text('人员资料')),
      body: SafeArea(
        child: profile.when(
          loading: () => const LoadingView(label: '正在读取资料'),
          error: (error, _) => ErrorView(
            error: error,
            onRetry: () => ref.invalidate(personProfileProvider(personId)),
          ),
          data: (person) => _ProfileBody(
            person: person,
            actions: [
              OutlinedButton.icon(
                onPressed: () => context.push('/people/${person.id}/schedule'),
                icon: const Icon(Icons.calendar_month_outlined),
                label: const Text('日程'),
              ),
              OutlinedButton.icon(
                onPressed: () => context.push('/people/${person.id}/logs'),
                icon: const Icon(Icons.menu_book_outlined),
                label: const Text('日志'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class SelfProfileCard extends ConsumerWidget {
  const SelfProfileCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(selfProfileProvider);
    return profile.when(
      loading: () => const Card(
        child: SizedBox(height: 150, child: LoadingView(label: '正在读取资料')),
      ),
      error: (error, _) => Card(
        child: ErrorView(
          error: error,
          onRetry: () => ref.invalidate(selfProfileProvider),
        ),
      ),
      data: (result) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: _ProfileBody(
            person: result.data,
            actions: [
              FilledButton.tonalIcon(
                onPressed: () => showDialog<void>(
                  context: context,
                  builder: (_) => _ProfileEditDialog(
                    person: result.data,
                    version: result.etag,
                  ),
                ),
                icon: const Icon(Icons.edit_outlined),
                label: const Text('编辑头像和邮箱'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProfileBody extends StatelessWidget {
  const _ProfileBody({required this.person, required this.actions});

  final EmployeeUser person;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return ListView(
      shrinkWrap: true,
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ProfileAvatar(
              avatar: person.avatar,
              name: person.displayName,
              radius: 32,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    person.displayName,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    person.positionPath.isEmpty
                        ? '职务信息未设置'
                        : person.positionPath,
                    style: const TextStyle(color: PandoraColors.muted),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        _row('手机号', person.phone ?? '无权查看或未设置'),
        _row('邮箱', person.email ?? '无权查看或未设置'),
        _row('直属上级', person.managerName ?? '未设置'),
        _row('入职日期', person.hireDate ?? '入职日期未设置'),
        _row('入职时长', person.tenure?.label ?? '入职时长未设置'),
        if (person.tenure?.asOfDate != null)
          _row('统计日期', person.tenure!.asOfDate!),
        const SizedBox(height: 16),
        Wrap(spacing: 8, runSpacing: 8, children: actions),
      ],
    );
  }

  Widget _row(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 78,
          child: Text(
            label,
            style: const TextStyle(color: PandoraColors.muted),
          ),
        ),
        Expanded(child: Text(value)),
      ],
    ),
  );
}

class _ProfileEditDialog extends ConsumerStatefulWidget {
  const _ProfileEditDialog({required this.person, required this.version});

  final EmployeeUser person;
  final String? version;

  @override
  ConsumerState<_ProfileEditDialog> createState() => _ProfileEditDialogState();
}

class _ProfileEditDialogState extends ConsumerState<_ProfileEditDialog> {
  final _email = TextEditingController();
  late String? _initialEmail;
  late String? _initialAvatar;
  String? _version;
  String? _avatar;
  bool _saving = false;
  bool _needsReload = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _initialEmail = widget.person.email;
    _initialAvatar = widget.person.avatar;
    _version = widget.version;
    _email.text = _initialEmail ?? '';
    _avatar = _initialAvatar;
  }

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('编辑资料'),
      content: SizedBox(
        width: 420,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: ProfileAvatar(
                  avatar: _avatar,
                  name: widget.person.displayName,
                  radius: 38,
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                children: [
                  for (final entry in avatarPresets.entries)
                    ChoiceChip(
                      label: Text('${entry.value} ${_presetName(entry.key)}'),
                      selected: _avatar == entry.key,
                      onSelected: _saving
                          ? null
                          : (_) => setState(() => _avatar = entry.key),
                    ),
                ],
              ),
              TextButton.icon(
                onPressed: _saving ? null : _pickImage,
                icon: const Icon(Icons.photo_library_outlined),
                label: const Text('从系统相册选择'),
              ),
              TextField(
                controller: _email,
                enabled: !_saving,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: '邮箱（可留空）'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(),
          child: const Text('取消'),
        ),
        FilledButton(
          onPressed: _saving ? null : (_needsReload ? _reload : _save),
          child: Text(_saving ? '处理中…' : (_needsReload ? '重新读取' : '保存')),
        ),
      ],
    );
  }

  Future<void> _pickImage() async {
    setState(() => _error = null);
    XFile? selected;
    try {
      selected = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        requestFullMetadata: false,
      );
      if (selected == null) return;
      final bytes = await selected.readAsBytes();
      final processed = const AvatarProcessor().process(bytes);
      if (mounted) setState(() => _avatar = processed);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      final path = selected?.path;
      if (path != null &&
          (path.contains(
                '${Platform.pathSeparator}cache${Platform.pathSeparator}',
              ) ||
              path.startsWith(Directory.systemTemp.path))) {
        try {
          await File(path).delete();
        } catch (_) {
          // 系统选择器可能已经清理临时副本。
        }
      }
    }
  }

  Future<void> _save() async {
    final email = _email.text.trim();
    if (email.isNotEmpty &&
        !RegExp(r"^[^\s@]+@[^\s@]+\.[^\s@]+$").hasMatch(email)) {
      setState(() => _error = '请输入有效的邮箱地址');
      return;
    }
    final body = <String, Object?>{
      if (email != (_initialEmail ?? '')) 'email': email.isEmpty ? null : email,
      if (_avatar != _initialAvatar) 'avatar': _avatar,
    };
    if (body.isEmpty) {
      Navigator.of(context).pop();
      return;
    }
    final version = _version;
    if (version == null) {
      await _reload();
      return;
    }
    final api = ref.read(profileApiProvider);
    final keys = ref.read(operationKeysProvider);
    final key = keys.keyFor(
      scope: 'profile:update',
      method: 'PATCH',
      path: '/me/profile',
      body: body,
      ifMatch: version,
    );
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await api.update(values: body, idempotencyKey: key, ifMatch: version);
      keys.complete('profile:update');
      if (!mounted) return;
      ref.invalidate(selfProfileProvider);
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _needsReload =
            error is ApiException &&
            (error.statusCode == 412 || error.statusCode == 428);
        _error = error is ApiException ? error.message : '保存失败，请重试';
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _reload() async {
    setState(() {
      _needsReload = true;
      _saving = true;
      _error = null;
    });
    try {
      final result = await ref.refresh(selfProfileProvider.future);
      if (!mounted) return;
      final latest = result.data;
      setState(() {
        if (_email.text.trim() == (_initialEmail ?? '')) {
          _email.text = latest.email ?? '';
        }
        if (_avatar == _initialAvatar) _avatar = latest.avatar;
        _initialEmail = latest.email;
        _initialAvatar = latest.avatar;
        _version = result.etag;
        _needsReload = false;
        _error = '已读取最新资料，请确认修改后保存。';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ApiException ? error.message : '读取失败，请重试';
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String _presetName(String value) => switch (value) {
    'rabbit' => '兔子',
    'cat' => '猫咪',
    'bear' => '小熊',
    _ => '熊猫',
  };
}
