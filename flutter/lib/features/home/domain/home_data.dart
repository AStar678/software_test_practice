/// 首页数据：公司事件纪、任务看板（最多十条）与公司业务日。
/// 服务端决定范围与顺序，客户端只做少量预览，不扩大数据范围。
class HomeData {
  const HomeData({
    required this.companyItems,
    required this.assignedTasks,
    required this.businessDate,
  });

  final List<CompanyItem> companyItems;
  final List<HomeTaskCard> assignedTasks;
  final String? businessDate;

  factory HomeData.fromJson(Map<String, Object?> json) {
    return HomeData(
      companyItems: [
        for (final raw in json['companyItems'] as List? ?? const [])
          if (raw is Map) CompanyItem.fromJson(Map<String, Object?>.from(raw)),
      ],
      assignedTasks: [
        for (final raw in json['assignedTasks'] as List? ?? const [])
          if (raw is Map) HomeTaskCard.fromJson(Map<String, Object?>.from(raw)),
      ],
      businessDate: json['businessDate']?.toString(),
    );
  }

  static const HomeData empty = HomeData(companyItems: [], assignedTasks: [], businessDate: null);
}

class CompanyItem {
  const CompanyItem({
    required this.id,
    required this.title,
    required this.body,
    required this.sortOrder,
  });

  final String id;
  final String title;
  final String body;
  final int sortOrder;

  factory CompanyItem.fromJson(Map<String, Object?> json) => CompanyItem(
        id: json['id']?.toString() ?? '',
        title: json['title']?.toString() ?? '',
        body: json['body']?.toString() ?? '',
        sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      );
}

class HomeTaskCard {
  const HomeTaskCard({
    required this.taskId,
    required this.title,
    required this.priority,
    this.assignedAt,
    this.assignedSource,
  });

  final String taskId;
  final String title;
  final String priority;
  final DateTime? assignedAt;
  final String? assignedSource;

  factory HomeTaskCard.fromJson(Map<String, Object?> json) => HomeTaskCard(
        taskId: json['taskId']?.toString() ?? '',
        title: json['title']?.toString() ?? '',
        priority: json['priority']?.toString() ?? 'medium',
        assignedAt: DateTime.tryParse(json['assignedAt']?.toString() ?? '')?.toUtc(),
        assignedSource: json['assignedSource']?.toString(),
      );
}
