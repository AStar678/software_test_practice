import '../../../core/company/company_date.dart';
import '../../../core/company/company_time.dart';

/// 公司业务日/时区上下文：优先使用服务端响应中的 businessDate，
/// 缺失时按公司 IANA 时区推导，绝不使用设备本地日期。
class WorkspaceClock {
  WorkspaceClock({DateTime Function()? now}) : now = now ?? DateTime.now;

  final DateTime Function() now;

  CompanyTimeZone _zone = CompanyTimeZone.fallback;
  CompanyDate? _serverBusinessDate;

  CompanyTimeZone get zone => _zone;

  String? get organizationTimeZone => _zone.name;

  bool get hasServerBusinessDate => _serverBusinessDate != null;

  CompanyDate get businessDate => _serverBusinessDate ?? _zone.dateOf(now().toUtc());

  void updateZone(String? name) {
    if (name == null || name.trim().isEmpty) return;
    _zone = CompanyTimeZone.fromName(name);
  }

  /// 任意响应带的 businessDate 都可更新；跨零点后由前台恢复重新读取。
  void updateBusinessDate(String? value) {
    final parsed = CompanyDate.tryParse(value);
    if (parsed != null) _serverBusinessDate = parsed;
  }

  void reset() {
    _serverBusinessDate = null;
  }

  /// 应用在前台停留跨过公司零点时，服务端业务日可能已变化。
  bool get mayHaveRolledOver {
    if (_serverBusinessDate == null) return false;
    return _zone.dateOf(now().toUtc()) != _serverBusinessDate;
  }

  DateTime dayStart(CompanyDate date) => _zone.dayStart(date);

  DateTime nextDayStart(CompanyDate date) => _zone.nextDayStart(date);

  DateTime at(CompanyDate date, {int hour = 0, int minute = 0}) => _zone.at(date, hour: hour, minute: minute);

  String format(DateTime instant) => _zone.formatDateTime(instant);
}
