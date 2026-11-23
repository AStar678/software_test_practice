import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/features/work_logs/domain/work_log.dart';
import 'package:pandora_employee/features/work_logs/domain/work_log_fill.dart';

void main() {
  test('Java trim 仅移除首尾 U+0000–U+0020', () {
    expect(WorkLogFill.javaTrim('\u0000 \t正文\u001f\n\r'), '正文');
    expect(WorkLogFill.javaTrim('正文\u0021'), '正文\u0021');
  });

  test('合并保留原文并使用空行分隔', () {
    expect(WorkLogFill.merge('', '任务\nA'), '任务\nA');
    expect(WorkLogFill.merge('原文\n', '任务\nA'), '原文\n\n\n任务\nA');
  });

  test('UTF-16 10000 边界与 emoji 计数', () {
    expect(WorkLogFill.fits('a' * 10000), isTrue);
    expect(WorkLogFill.fits('a' * 10001), isFalse);
    expect(WorkLogFill.fits('a' * 9999 + '😀'), isFalse);
    expect(WorkLogFill.fits('  ${'a' * 10000}  '), isTrue);
  });

  test('填充源按每日事项、空行、任务分组', () {
    const source = FillSource(
      dailyItems: [FillName(id: 'd1', name: '事项一'), FillName(id: 'd2', name: '事项二')],
      tasks: [FillName(id: 't1', name: '任务一')],
      complete: true,
    );
    expect(WorkLogFill.sourceText(source), '每日事项\n事项一\n事项二\n\n任务\n任务一');
  });
}
