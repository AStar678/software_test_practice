/// 员工身份与资料模型。姓名/手机号仅管理员可改，组织字段由服务端投影。
class EmployeeUser {
  const EmployeeUser({
    required this.id,
    required this.displayName,
    required this.role,
    this.organizationId,
    this.accountType = 'employee',
    this.active = true,
    this.departmentId,
    this.departmentName,
    this.positionId,
    this.positionName,
    this.teamId,
    this.teamName,
    this.placementType,
    this.managerId,
    this.managerName,
    this.avatar,
    this.phone,
    this.email,
    this.profileVersion,
    this.hireDate,
    this.tenure,
    this.organizationName,
    this.organizationTimeZone,
    this.mustChangePassword = false,
    this.authzVersion,
  });

  final String id;
  final String displayName;
  final String role;
  final String? organizationId;
  final String accountType;
  final bool active;
  final String? departmentId;
  final String? departmentName;
  final String? positionId;
  final String? positionName;
  final String? teamId;
  final String? teamName;
  final String? placementType;
  final String? managerId;
  final String? managerName;
  final String? avatar;
  final String? phone;
  final String? email;
  final int? profileVersion;
  final String? hireDate;
  final Tenure? tenure;
  final String? organizationName;
  final String? organizationTimeZone;
  final bool mustChangePassword;
  final int? authzVersion;

  bool get isFounder => role == 'founder';

  bool get isManagerRole =>
      role == 'founder' || role == 'department_head' || role == 'team_head' || placementType == 'founder';

  /// 仅用于界面默认值：普通员工创建任务默认本人，三类管理者初始为空。
  bool get defaultsSelfAsAssignee => !isManagerRole;

  /// 实际职务路径：部门 ▸ 团队 ▸ 实际职位，缺层省略，不伪造。
  String get positionPath {
    final parts = <String>[
      if (departmentName != null && departmentName!.trim().isNotEmpty) departmentName!.trim(),
      if (teamName != null && teamName!.trim().isNotEmpty) teamName!.trim(),
      if (positionName != null && positionName!.trim().isNotEmpty) positionName!.trim(),
    ];
    return parts.join(' ▸ ');
  }

  factory EmployeeUser.fromJson(Map<String, Object?> json) {
    return EmployeeUser(
      id: _string(json['id']) ?? '',
      displayName: _string(json['displayName']) ?? '',
      role: _string(json['role']) ?? 'employee',
      organizationId: _string(json['organizationId']),
      accountType: _string(json['accountType']) ?? 'employee',
      active: json['active'] == true || json['active'] == 1,
      departmentId: _string(json['departmentId']),
      departmentName: _string(json['departmentName']),
      positionId: _string(json['positionId']),
      positionName: _string(json['positionName']),
      teamId: _string(json['teamId']),
      teamName: _string(json['teamName']),
      placementType: _string(json['placementType']),
      managerId: _string(json['managerId']),
      managerName: _string(json['managerName']),
      avatar: _string(json['avatar']),
      phone: _string(json['phone']),
      email: _string(json['email']),
      profileVersion: _int(json['profileVersion']),
      hireDate: _string(json['hireDate']),
      tenure: Tenure.tryParse(json['tenure']),
      organizationName: _string(json['organizationName']),
      organizationTimeZone: _string(json['organizationTimeZone']),
      mustChangePassword: json['mustChangePassword'] == true,
      authzVersion: _int(json['authzVersion']),
    );
  }

  EmployeeUser copyWith({
    String? displayName,
    String? avatar,
    String? email,
    bool? mustChangePassword,
    int? profileVersion,
  }) {
    return EmployeeUser(
      id: id,
      displayName: displayName ?? this.displayName,
      role: role,
      organizationId: organizationId,
      accountType: accountType,
      active: active,
      departmentId: departmentId,
      departmentName: departmentName,
      positionId: positionId,
      positionName: positionName,
      teamId: teamId,
      teamName: teamName,
      placementType: placementType,
      managerId: managerId,
      managerName: managerName,
      avatar: avatar ?? this.avatar,
      phone: phone,
      email: email ?? this.email,
      profileVersion: profileVersion ?? this.profileVersion,
      hireDate: hireDate,
      tenure: tenure,
      organizationName: organizationName,
      organizationTimeZone: organizationTimeZone,
      mustChangePassword: mustChangePassword ?? this.mustChangePassword,
      authzVersion: authzVersion,
    );
  }
}

/// 服务端入职时长投影，客户端只渲染，不自行重算。
class Tenure {
  const Tenure({required this.years, required this.months, required this.days, this.asOfDate});

  final int years;
  final int months;
  final int days;
  final String? asOfDate;

  static Tenure? tryParse(Object? value) {
    if (value is! Map) return null;
    return Tenure(
      years: _int(value['years']) ?? 0,
      months: _int(value['months']) ?? 0,
      days: _int(value['days']) ?? 0,
      asOfDate: _string(value['asOfDate']),
    );
  }

  String get label {
    if (years == 0 && months == 0 && days == 0) return '不满 1 天';
    final parts = <String>[
      if (years > 0) '$years 年',
      if (months > 0) '$months 个月',
      if (days > 0) '$days 天',
    ];
    return parts.join(' ');
  }
}

String? _string(Object? value) {
  if (value == null) return null;
  final text = value.toString();
  return text.isEmpty ? null : text;
}

int? _int(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '');
}
