enum HolidayCacheStatus { ready, stale, missing }

class HolidayDay {
  const HolidayDay({
    required this.date,
    required this.name,
    required this.isOffDay,
  });
  final String date;
  final String name;
  final bool isOffDay;

  factory HolidayDay.fromJson(Map<String, Object?> json) => HolidayDay(
    date: json['date']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
    isOffDay: json['isOffDay'] == true,
  );
}

class HolidayYear {
  const HolidayYear({
    required this.year,
    required this.region,
    required this.status,
    required this.days,
    required this.source,
    this.updatedAt,
    this.reason,
  });

  final int year;
  final String region;
  final HolidayCacheStatus status;
  final List<HolidayDay> days;
  final String source;
  final DateTime? updatedAt;
  final String? reason;

  Map<String, HolidayDay> get byDate => {for (final day in days) day.date: day};

  HolidayYear asStale(String failure) => HolidayYear(
    year: year,
    region: region,
    status: HolidayCacheStatus.stale,
    days: days,
    source: source,
    updatedAt: updatedAt,
    reason: failure,
  );

  factory HolidayYear.fromJson(Map<String, Object?> json) {
    final rawStatus = json['status']?.toString();
    return HolidayYear(
      year: (json['year'] as num?)?.toInt() ?? 0,
      region: json['region']?.toString() ?? 'CN',
      status: switch (rawStatus) {
        'ready' => HolidayCacheStatus.ready,
        'stale' => HolidayCacheStatus.stale,
        _ => HolidayCacheStatus.missing,
      },
      days: [
        for (final value in json['days'] as List? ?? const [])
          if (value is Map)
            HolidayDay.fromJson(Map<String, Object?>.from(value)),
      ],
      source: json['source']?.toString() ?? '项目节假日缓存',
      updatedAt: DateTime.tryParse(json['updatedAt']?.toString() ?? ''),
      reason: json['reason']?.toString(),
    );
  }
}
