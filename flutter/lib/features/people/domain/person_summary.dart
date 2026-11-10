/// 人员摘要：候选/负责人/交接对象只带授权摘要，绝不带电话、邮箱、入职日或时长。
class PersonSummary {
  const PersonSummary({
    required this.id,
    required this.displayName,
    this.departmentName,
    this.teamName,
    this.positionName,
    this.placementType,
  });

  final String id;
  final String displayName;
  final String? departmentName;
  final String? teamName;
  final String? positionName;
  final String? placementType;

  String get positionPath {
    final parts = <String>[
      if (departmentName != null && departmentName!.isNotEmpty) departmentName!,
      if (teamName != null && teamName!.isNotEmpty) teamName!,
      if (positionName != null && positionName!.isNotEmpty) positionName!,
    ];
    return parts.join(' ▸ ');
  }

  factory PersonSummary.fromJson(Map<String, Object?> json) => PersonSummary(
        id: json['id']?.toString() ?? '',
        displayName: json['displayName']?.toString() ?? '',
        departmentName: json['departmentName']?.toString(),
        teamName: json['teamName']?.toString(),
        positionName: json['positionName']?.toString(),
        placementType: json['placementType']?.toString(),
      );
}

class HandoverTargets {
  const HandoverTargets({required this.items, required this.subjectId});

  final List<PersonSummary> items;
  final String subjectId;

  factory HandoverTargets.fromJson(Map<String, Object?> json) => HandoverTargets(
        items: [
          for (final raw in json['items'] as List? ?? const [])
            if (raw is Map) PersonSummary.fromJson(Map<String, Object?>.from(raw)),
        ],
        subjectId: json['subjectId']?.toString() ?? '',
      );
}

class HandoverPreset {
  const HandoverPreset({required this.userId, this.targetUserId, this.target, this.rowVersion = 0});

  final String userId;
  final String? targetUserId;
  final PersonSummary? target;
  final int rowVersion;

  factory HandoverPreset.fromJson(Map<String, Object?> json) {
    final rawTarget = json['target'];
    return HandoverPreset(
      userId: json['userId']?.toString() ?? '',
      targetUserId: json['targetUserId']?.toString(),
      target: rawTarget is Map ? PersonSummary.fromJson(Map<String, Object?>.from(rawTarget)) : null,
      rowVersion: (json['rowVersion'] as num?)?.toInt() ?? 0,
    );
  }
}
