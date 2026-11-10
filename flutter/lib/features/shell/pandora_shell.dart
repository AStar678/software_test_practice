import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/pandora_theme.dart';

/// 五分支主导航：首页、公司、日志、统计、我的。通知与任务表单不占主导航。
class PandoraShell extends StatelessWidget {
  const PandoraShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const destinations = <_Destination>[
    _Destination(label: '首页', icon: Icons.home_outlined, selected: Icons.home),
    _Destination(label: '公司', icon: Icons.calendar_month_outlined, selected: Icons.calendar_month),
    _Destination(label: '日志', icon: Icons.menu_book_outlined, selected: Icons.menu_book),
    _Destination(label: '统计', icon: Icons.insights_outlined, selected: Icons.insights),
    _Destination(label: '我的', icon: Icons.person_outline, selected: Icons.person),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) => navigationShell.goBranch(
          index,
          initialLocation: index == navigationShell.currentIndex,
        ),
        destinations: [
          for (final destination in destinations)
            NavigationDestination(
              icon: Icon(destination.icon),
              selectedIcon: Icon(destination.selected, color: PandoraColors.brand),
              label: destination.label,
            ),
        ],
      ),
    );
  }
}

class _Destination {
  const _Destination({required this.label, required this.icon, required this.selected});

  final String label;
  final IconData icon;
  final IconData selected;
}
