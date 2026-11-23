import '../../../core/company/company_date.dart';

/// 范围每日事项：一条真实记录、公司日期首尾包含、纯文本、完成状态和版本。
class DailyItem {
  const DailyItem({
    required this.id,
    required this.body,
    required this.startDate,
    required this.endDate,
    required this.completed,
    required this.status,
    required this.rowVersion,
    this.allDay = true,
    this.startTime,
    this.endTime,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String body;
  final CompanyDate startDate;
  final CompanyDate endDate;
  final bool completed;
  final bool allDay;

  /// 公司时区下的 `HH:mm`；全天事项为 null。
  final String? startTime;
  final String? endTime;

  /// `completed | open | overdue`，由服务端按公司今天/当前时刻裁决。
  final String status;
  final int rowVersion;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  bool covers(CompanyDate day) =>
      !day.isBefore(startDate) && !day.isAfter(endDate);

  Iterable<CompanyDate> get coveredDates sync* {
    for (var day = startDate; !day.isAfter(endDate); day = day.addDays(1)) {
      yield day;
    }
  }

  DailyItem shifted(int days) => DailyItem(
    id: id,
    body: body,
    startDate: startDate.addDays(days),
    endDate: endDate.addDays(days),
    completed: completed,
    status: status,
    rowVersion: rowVersion,
    allDay: allDay,
    startTime: startTime,
    endTime: endTime,
    createdAt: createdAt,
    updatedAt: updatedAt,
  );

  bool get isOverdue => status == 'overdue';

  bool get isCompleted => status == 'completed' || completed;

  /// 全天/定时的可读摘要；时刻始终按公司时区解释。
  String get modeLabel =>
      allDay ? '全天' : '${startTime ?? '--'} 至 ${endTime ?? '--'}';

  /// 三态：完成优先，过期次之，其余未完成。
  String get stateLabel => isCompleted ? '已完成' : (isOverdue ? '已逾期' : '未完成');

  factory DailyItem.fromJson(Map<String, Object?> json) {
    final start = CompanyDate.tryParse(
      _string(json['startDate']) ?? _string(json['date']),
    );
    final end = CompanyDate.tryParse(
      _string(json['endDate']) ?? _string(json['date']),
    );
    if (start == null || end == null) {
      throw const FormatException('每日事项缺少有效的公司日期');
    }
    final completed = json['completed'] == true;
    final allDay = json['allDay'] != false;
    return DailyItem(
      id: _string(json['id']) ?? '',
      body: _string(json['body']) ?? '',
      startDate: start,
      endDate: end,
      completed: completed,
      allDay: allDay,
      startTime: allDay ? null : _string(json['startTime']),
      endTime: allDay ? null : _string(json['endTime']),
      status: _string(json['status']) ?? (completed ? 'completed' : 'open'),
      rowVersion: _int(json['rowVersion']) ?? 1,
      createdAt: _instant(json['createdAt']),
      updatedAt: _instant(json['updatedAt']),
    );
  }
}

class DailyItemPage {
  const DailyItemPage({
    required this.items,
    required this.total,
    this.nextOffset,
    this.businessDate,
    this.organizationTimeZone,
    this.from,
    this.to,
    this.date,
  });

  final List<DailyItem> items;
  final int total;
  final int? nextOffset;
  final String? businessDate;
  final String? organizationTimeZone;
  final CompanyDate? from;
  final CompanyDate? to;
  final CompanyDate? date;
}

class DailyDayCount {
  const DailyDayCount({
    required this.date,
    required this.openCount,
    required this.completedCount,
  });

  final CompanyDate date;
  final int openCount;
  final int completedCount;

  int get total => openCount + completedCount;
}

class DailyItemSummary {
  const DailyItemSummary({required this.days, this.businessDate});

  final Map<CompanyDate, DailyDayCount> days;
  final String? businessDate;

  DailyDayCount? countFor(CompanyDate day) => days[day];
}

DateTime? _instant(Object? value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString())?.toUtc();
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
