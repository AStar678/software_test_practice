import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:pandora_employee/core/company/company_date.dart';
import 'package:pandora_employee/core/company/company_time.dart';
import 'package:pandora_employee/features/approvals/domain/approval_request.dart';
import 'package:pandora_employee/features/comments/domain/comment_record.dart';
import 'package:pandora_employee/features/tasks/data/tasks_api.dart';
import 'package:pandora_employee/features/daily_items/domain/daily_item.dart';
import 'package:pandora_employee/features/home/domain/home_data.dart';
import 'package:pandora_employee/features/people/domain/person_summary.dart';
import 'package:pandora_employee/features/tasks/domain/task_record.dart';

Map<String, Object?> fixture(String name) {
  final file = File('test/fixtures/api/$name.json');
  return Map<String, Object?>.from(jsonDecode(file.readAsStringSync()) as Map);
}

void main() {
  group('真实 API 样例适配', () {
    test('任务列表与详情：偏移字符串、明确时刻与字段资格', () {
      final tasks = fixture('tasks');
      final items = (tasks['items'] as List).cast<Map>();
      expect(items, isNotEmpty);
      final records = [
        for (final item in items) TaskRecord.fromJson(Map<String, Object?>.from(item)),
      ];
      final first = records.first;
      expect(first.id, isNotEmpty);
      expect(first.title, isNotEmpty);
      expect(first.startAt, isNotNull);
      expect(first.dueAt, isNotNull);
      expect(first.rowVersion, greaterThan(0));
      expect(first.editableFields, isNotEmpty);

      final detail = TaskRecord.fromJson(fixture('task_detail'));
      expect(detail.allDay, isFalse);
      expect(detail.startAt!.isUtc, isTrue);
      expect(detail.dueAt!.isUtc, isTrue);
      expect(detail.participants, isNotEmpty);
      expect(detail.route?.reasonText, isNotEmpty);
    });

    test('旧全天使用日期对，不被转成设备日期', () {
      final record = TaskRecord.fromJson({
        'id': 'all-day',
        'title': '全天任务',
        'allDay': true,
        'startDate': '2026-11-08',
        'dueDate': '2026-11-10',
        'startAt': '2026-11-07T16:00:00Z',
        'dueAt': '2026-11-10T10:00:00Z',
        'rowVersion': 2,
      });
      expect(record.allDayStart, const CompanyDate(2026, 11, 8));
      expect(record.allDayEnd, const CompanyDate(2026, 11, 10));
      expect(record.allDay, isTrue);
      expect(record.scheduleText(CompanyTimeZone.fromName('Asia/Shanghai')), contains('2026-11-08'));
    });

    test('每日事项范围与单日分页字段分别处理', () {
      final range = fixture('daily_items_range');
      final page = DailyItemPage(
        items: [
          for (final raw in range['items'] as List)
            DailyItem.fromJson(Map<String, Object?>.from(raw)),
        ],
        total: (range['total'] as num).toInt(),
        nextOffset: (range['nextOffset'] as num?)?.toInt(),
      );
      expect(page.items, isNotEmpty);
      expect(page.items.first.startDate.isBefore(page.items.first.endDate) || page.items.first.startDate == page.items.first.endDate, isTrue);
      expect(page.total, greaterThanOrEqualTo(page.items.length));

      final day = fixture('daily_items_day');
      expect(day['date'], isNotNull);
      final dayItems = [
        for (final raw in day['items'] as List)
          DailyItem.fromJson(Map<String, Object?>.from(raw)),
      ];
      final queried = CompanyDate.parse(day['date'] as String);
      for (final item in dayItems) {
        expect(item.covers(queried), isTrue, reason: '单日查询只返回覆盖该日的记录');
      }
    });

    test('未知/缺字段不会导致解析崩溃', () {
      final record = TaskRecord.fromJson({'id': 'x', 'title': '最小任务'});
      expect(record.description, '');
      expect(record.assigneeIds, isEmpty);
      expect(record.editableFields, isEmpty);
      expect(record.scheduleText(CompanyTimeZone.fromName('Asia/Shanghai')), '排期未设置');

      final empty = HomeData.fromJson({});
      expect(empty.companyItems, isEmpty);
      expect(empty.assignedTasks, isEmpty);
    });

    test('首页最多十项且任务看板带派发时间', () {
      final home = HomeData.fromJson(fixture('home'));
      expect(home.companyItems.length, lessThanOrEqualTo(10));
      expect(home.companyItems.first.sortOrder, greaterThan(0));
      expect(home.assignedTasks.length, lessThanOrEqualTo(10));
      if (home.assignedTasks.isNotEmpty) {
        expect(home.assignedTasks.first.assignedAt, isNotNull);
      }
      expect(home.businessDate, isNotNull);
    });

    test('申请详情区分审核人 diff 与申请人提议', () {
      final reviewer = ApprovalRequest.fromJson(fixture('approval_request_reviewer'));
      expect(reviewer.requestId, isNotEmpty);
      expect(reviewer.proposedVersion, isNotNull);
      for (final diff in reviewer.diff) {
        expect(diff.field, isNotEmpty);
      }
      expect(reviewer.participants, isNotEmpty);
      expect(reviewer.isPending, isFalse);
    });

    test('候选摘要不含联系方式字段', () {
      final candidates = fixture('assignee_candidates');
      final people = [
        for (final raw in candidates['items'] as List)
          PersonSummary.fromJson(Map<String, Object?>.from(raw)),
      ];
      expect(people, isNotEmpty);
      for (final person in people) {
        expect(person.displayName, isNotEmpty);
        expect(person.id, isNotEmpty);
      }
      final rawFirst = Map<String, Object?>.from((candidates['items'] as List).first as Map);
      expect(rawFirst.containsKey('phone'), isFalse);
      expect(rawFirst.containsKey('email'), isFalse);
      expect(rawFirst.containsKey('hireDate'), isFalse);
      expect(rawFirst.containsKey('tenure'), isFalse);
    });

    test('评论使用稳定 ID 游标，正序且可分页', () {
      final page = CommentPage(
        items: [
          for (final raw in (fixture('task_comments')['items'] as List))
            CommentRecord.fromJson(Map<String, Object?>.from(raw)),
        ],
        total: (fixture('task_comments')['total'] as num?)?.toInt() ?? 1,
        nextCursor: fixture('task_comments')['nextCursor']?.toString(),
        nextOffset: (fixture('task_comments')['nextOffset'] as num?)?.toInt(),
      );
      expect(page.items, isNotEmpty);
      final comment = page.items.first;
      expect(comment.id, isNotEmpty);
      expect(comment.authorName, isNotEmpty);
      expect(comment.objectType, 'task');
      expect(comment.rowVersion, greaterThan(0));
      // 评论不使用数字 nextOffset 作为续页契约，而是在有更多时给出 ID 游标。
      expect(page.nextCursor == null || page.nextCursor!.isNotEmpty, isTrue);
    });

    test('不同游标类型独立：任务偏移字符串、申请 nextOffset、事项 nextOffset', () {
      final tasksPage = TaskCursorPage.fromJson(fixture('tasks'));
      expect(tasksPage.items, isNotEmpty);
      expect(tasksPage.nextCursor == null || int.tryParse(tasksPage.nextCursor!) != null, isTrue);
      final tasks = fixture('tasks');
      expect(tasks['nextCursor'], anyOf(isNull, isA<String>()));
      final approvals = fixture('approval_mine_reviewer');
      expect(approvals['nextOffset'], anyOf(isNull, isA<num>()));
      final daily = fixture('daily_items_paged');
      expect(daily['nextOffset'], anyOf(isNull, isA<num>()));
      expect(daily['items'], hasLength(2));
    });
  });
}
