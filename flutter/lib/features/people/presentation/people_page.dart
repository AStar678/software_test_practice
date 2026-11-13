import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers.dart';
import '../../../core/theme/pandora_theme.dart';
import '../../../core/widgets/state_views.dart';
import '../domain/report_person.dart';
import 'people_providers.dart';

class PeoplePage extends ConsumerStatefulWidget {
  const PeoplePage({super.key});

  @override
  ConsumerState<PeoplePage> createState() => _PeoplePageState();
}

class _PeoplePageState extends ConsumerState<PeoplePage> {
  final Set<String> _expanded = {};

  @override
  Widget build(BuildContext context) {
    final reports = ref.watch(reportsProvider);
    final selfId = ref.watch(currentUserProvider)?.id ?? '';
    return Scaffold(
      appBar: AppBar(title: const Text('我的下属')),
      body: SafeArea(
        child: reports.when(
          loading: () => const LoadingView(label: '正在读取下属关系'),
          error: (error, _) => ErrorView(
            error: error,
            onRetry: () => ref.invalidate(reportsProvider),
          ),
          data: (people) {
            if (people.isEmpty) return const EmptyView(message: '当前没有可查看的下属');
            final tree = ReportTree(people);
            return RefreshIndicator(
              onRefresh: () async => ref.refresh(reportsProvider.future),
              child: ListView(
                padding: const EdgeInsets.all(12),
                children: [
                  for (final person in tree.rootsFor(selfId))
                    _node(tree, person, 0),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _node(ReportTree tree, ReportPerson person, int depth) {
    final children = tree.childrenOf(person.id);
    final expanded = _expanded.contains(person.id);
    return Column(
      children: [
        Card(
          margin: EdgeInsets.only(left: depth * 14.0, bottom: 6),
          child: ListTile(
            leading: children.isEmpty
                ? const SizedBox(width: 40, child: Icon(Icons.person_outline))
                : IconButton(
                    tooltip: expanded
                        ? '收起${person.displayName}的下属'
                        : '展开${person.displayName}的下属',
                    onPressed: () => setState(
                      () => expanded
                          ? _expanded.remove(person.id)
                          : _expanded.add(person.id),
                    ),
                    icon: Icon(
                      expanded ? Icons.expand_more : Icons.chevron_right,
                    ),
                  ),
            title: Text(person.displayName),
            subtitle: Text(
              person.positionPath.isEmpty ? '职务信息未设置' : person.positionPath,
            ),
            trailing: const Icon(Icons.open_in_new, color: PandoraColors.muted),
            onTap: () => context.push('/people/${person.id}'),
          ),
        ),
        if (expanded)
          for (final child in children) _node(tree, child, depth + 1),
      ],
    );
  }
}

class SubordinateWorkspacePendingPage extends StatelessWidget {
  const SubordinateWorkspacePendingPage({
    super.key,
    required this.personId,
    required this.title,
  });

  final String personId;
  final String title;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(title)),
    body: const SafeArea(
      child: EmptyView(message: '人员选择与资料权限已接入；连续日程和人员日志将在任务 8.4 复用完整浏览组件'),
    ),
  );
}
