import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/providers.dart';
import 'core/router/app_router.dart';
import 'core/theme/pandora_theme.dart';

class PandoraApp extends ConsumerStatefulWidget {
  const PandoraApp({super.key});

  @override
  ConsumerState<PandoraApp> createState() => _PandoraAppState();
}

class _PandoraAppState extends ConsumerState<PandoraApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // 前台恢复重验会话；不重放未决写请求，不展示旧敏感正文。
      ref.read(sessionManagerProvider).revalidateOnResume();
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: '潘多拉',
      debugShowCheckedModeBanner: false,
      theme: PandoraTheme.build(),
      locale: const Locale('zh', 'CN'),
      supportedLocales: const [Locale('zh', 'CN'), Locale('en', 'US')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      routerConfig: router,
      builder: (context, child) {
        // 字体放大时不裁切文本：由各页面滚动承接。
        return MediaQuery.withClampedTextScaling(
          minScaleFactor: 0.8,
          maxScaleFactor: 2.0,
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
  }
}

/// 受限会话下不允许任何业务预取：路由与网络层都已按会话阶段拦截。
bool get isSessionRestricted => false;
