import 'person_summary.dart';

class ReportPerson extends PersonSummary {
  const ReportPerson({
    required super.id,
    required super.displayName,
    super.departmentName,
    super.teamName,
    super.positionName,
    super.placementType,
    this.managerId,
    this.canReadLogs = false,
  });

  final String? managerId;
  final bool canReadLogs;

  factory ReportPerson.fromJson(Map<String, Object?> json) => ReportPerson(
    id: json['id']?.toString() ?? '',
    displayName: json['displayName']?.toString() ?? '',
    departmentName: json['departmentName']?.toString(),
    teamName: json['teamName']?.toString(),
    positionName: json['positionName']?.toString(),
    placementType: json['placementType']?.toString(),
    managerId: json['managerId']?.toString(),
    canReadLogs: json['canReadLogs'] == true,
  );
}

class ReportTree {
  const ReportTree(this.people);

  final List<ReportPerson> people;

  List<ReportPerson> rootsFor(String currentUserId) {
    final ids = people.map((person) => person.id).toSet();
    return people
        .where(
          (person) =>
              person.managerId == currentUserId ||
              person.managerId == null ||
              !ids.contains(person.managerId),
        )
        .toList();
  }

  List<ReportPerson> childrenOf(String parentId) =>
      people.where((person) => person.managerId == parentId).toList();
}
