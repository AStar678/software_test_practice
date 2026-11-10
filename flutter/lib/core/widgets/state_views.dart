import 'package:flutter/material.dart';

import '../errors/app_error.dart';
import '../theme/pandora_theme.dart';

/// 加载 / 空 / 失败 / 失权 / 离线分别呈现，错误不伪装成空集合。
class LoadingView extends StatelessWidget {
  const LoadingView({super.key, this.label = '加载中'});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      liveRegion: true,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(strokeWidth: 2.5),
            ),
            const SizedBox(height: 12),
            Text(label, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }
}

class EmptyView extends StatelessWidget {
  const EmptyView({super.key, required this.message, this.icon = Icons.inbox_outlined, this.action});

  final String message;
  final IconData icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: PandoraColors.muted, size: 32),
            const SizedBox(height: 10),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: PandoraColors.muted),
            ),
            if (action != null) ...[const SizedBox(height: 12), action!],
          ],
        ),
      ),
    );
  }
}

class ErrorView extends StatelessWidget {
  const ErrorView({
    super.key,
    required this.error,
    this.onRetry,
    this.onReload,
    this.title,
  });

  final Object error;
  final VoidCallback? onRetry;
  final VoidCallback? onReload;
  final String? title;

  @override
  Widget build(BuildContext context) {
    final api = error is ApiException ? error as ApiException : null;
    final isForbidden = api?.isForbidden ?? false;
    final isOffline = api?.isNetwork ?? false;
    final heading = title ??
        (isForbidden
            ? '无权访问'
            : isOffline
                ? '网络不可用'
                : '加载失败');
    final message = api?.message ?? '请稍后重试';
    return Semantics(
      label: '$heading：$message',
      liveRegion: true,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                isForbidden
                    ? Icons.lock_outline
                    : isOffline
                        ? Icons.wifi_off_outlined
                        : Icons.error_outline,
                color: isForbidden ? PandoraColors.pending : PandoraColors.overdue,
                size: 32,
              ),
              const SizedBox(height: 10),
              Text(heading, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 6),
              Text(
                message,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: PandoraColors.muted),
              ),
              const SizedBox(height: 14),
              if (onRetry != null)
                OutlinedButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh),
                  label: const Text('重试'),
                ),
              if (onReload != null)
                TextButton(onPressed: onReload, child: const Text('重新加载')),
            ],
          ),
        ),
      ),
    );
  }
}

/// 数据加载的显式状态，区分“加载中/真实空/失败/失权”。
sealed class LoadState<T> {
  const LoadState();

  const factory LoadState.loading() = LoadLoading<T>;
  const factory LoadState.data(T value) = LoadData<T>;
  const factory LoadState.empty() = LoadEmpty<T>;
  const factory LoadState.failure(Object error) = LoadFailure<T>;

  T? get valueOrNull => this is LoadData<T> ? (this as LoadData<T>).value : null;
}

class LoadLoading<T> extends LoadState<T> {
  const LoadLoading();
}

class LoadData<T> extends LoadState<T> {
  const LoadData(this.value);
  final T value;
}

class LoadEmpty<T> extends LoadState<T> {
  const LoadEmpty();
}

class LoadFailure<T> extends LoadState<T> {
  const LoadFailure(this.error);
  final Object error;
}

/// 语义化状态徽标：状态同时用文字表达，不只靠颜色。
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.label, required this.color, this.icon});

  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 13, color: color), const SizedBox(width: 4)],
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(color: color, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
