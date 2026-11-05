#!/usr/bin/env python3
"""Section 3 notification semantics, request access and structured-result checks."""
import datetime as dt
import json
import os
import subprocess
import uuid

from fixed_model_fixture import Fixture, quote
from migration_precheck import BASE


def main():
    out = BASE.parent / 'output/apply-notifications'
    out.mkdir(parents=True, exist_ok=True)
    report = {'checks': []}
    fixture = Fixture(port=18231, worker=True, controllable=True)
    fixture.log_path = out / 'service.log'
    try:
        with fixture as f:
            tokens = {key: f.login(key)[1]['token'] for key in f.identities}
            ids = {key: value['id'] for key, value in f.identities.items()}

            def check(name, condition, evidence=None):
                report['checks'].append({'check': name, 'pass': bool(condition), 'evidence': evidence})
                print(('PASS ' if condition else 'FAIL ') + name, flush=True)
                if not condition:
                    raise AssertionError(name)

            def call(who, method, path, body=None, version=None, key=None):
                return f.call(method, path, body, tokens[who], key or uuid.uuid4().hex, version)

            def ok(who, method, path, body=None, version=None, key=None):
                status, row = call(who, method, path, body, version, key)
                assert status in (200, 201), (method, path, status, row)
                return row

            def worker():
                ok('admin', 'POST', '/admin/worker/run-once', {})

            def now():
                return dt.datetime.fromisoformat(ok('admin', 'GET', '/admin/clock')['now'].replace('Z', '+00:00'))

            def advance(seconds):
                ok('admin', 'POST', '/admin/clock/advance', {'seconds': seconds})

            def notices(who, query=''):
                return ok(who, 'GET', '/notifications?limit=100' + query)['items']

            def notice_for(who, task_id, event_type, request_id=None):
                rows = [row for row in notices(who) if row.get('taskId') == task_id and row.get('eventType') == event_type]
                if request_id is not None:
                    rows = [row for row in rows if row.get('requestId') == request_id]
                return rows[-1] if rows else None

            def task(who, body):
                return ok(who, 'POST', '/tasks', body)['taskId']

            def change(task_id, who, body):
                current = ok(who, 'GET', '/tasks/' + task_id)
                return ok(who, 'PATCH', '/tasks/' + task_id, body, current['rowVersion'])

            def approve(request_id, who):
                request = ok(who, 'GET', '/approval-requests/' + request_id)
                ok(who, 'PATCH', '/approval-requests/' + request_id, {'decision': 'approve'}, request['rowVersion'])

            base = now()
            reminder_task = task('founder', {
                'title': '提醒分类验证', 'description': '真实 worker 节点', 'priority': 'medium',
                'allDay': False, 'startAt': base.isoformat(),
                'dueAt': (base + dt.timedelta(seconds=100)).isoformat(),
                'assigneeIds': [ids['alpha-one-employee']]
            })
            current = base
            for target, event_type in ((85, 'task.reminder_20'), (92, 'task.reminder_10'),
                                       (98, 'task.reminder_5'), (101, 'task.overdue')):
                advance((base + dt.timedelta(seconds=target) - current).total_seconds())
                current = base + dt.timedelta(seconds=target)
                worker()

            reminders = ok('alpha-one-employee', 'GET', '/notifications?category=reminder&limit=100')
            reminder_types = [row['eventType'] for row in reminders['items']]
            check('real worker emits 20/10/5/overdue reminder notifications',
                  set(reminder_types) == {'task.reminder_20', 'task.reminder_10', 'task.reminder_5', 'task.overdue'},
                  reminder_types)
            check('reminder list, total, purpose and result agree',
                  reminders['total'] == 4 and all(row['category'] == 'reminder' and row['purpose'] == '截止提醒'
                                                   and row['eventResult'] in ('任务即将截止', '任务已逾期')
                                                   for row in reminders['items']), reminders)
            full_unread = ok('alpha-one-employee', 'GET', '/notifications?limit=1')['unreadCount']
            filtered = ok('alpha-one-employee', 'GET', '/notifications?category=reminder&readStatus=unread&limit=2&offset=1')
            check('combined reminder filters are applied before total and keep global unread',
                  filtered['total'] == 4 and len(filtered['items']) == 2 and filtered['unreadCount'] == full_unread, filtered)
            before_open = ok('alpha-one-employee', 'GET', '/notifications?limit=1')['unreadCount']
            ok('alpha-one-employee', 'POST', '/notifications/' + reminders['items'][-1]['id'] + '/open', {})
            after_open = ok('alpha-one-employee', 'GET', '/notifications?limit=1')['unreadCount']
            check('opening a filtered reminder marks only that message read', after_open == before_open - 1, {'before': before_open, 'after': after_open})
            worker()
            check('reminder scans do not redeliver completed nodes',
                  ok('alpha-one-employee', 'GET', '/notifications?category=reminder&limit=100')['total'] == 4)
            overdue = next(row for row in reminders['items'] if row['eventType'] == 'task.overdue')
            overdue_detail = ok('alpha-one-employee', 'GET', '/notifications/' + overdue['id'])
            check('reminder detail uses the same purpose and result',
                  overdue_detail['category'] == 'reminder' and overdue_detail['purpose'] == '截止提醒'
                  and overdue_detail['eventResult'] == '任务已逾期' and overdue_detail['changes'] == [], overdue_detail)

            result_task = task('founder', {
                'title': '通知详情对象', 'description': '原说明', 'priority': 'medium',
                'allDay': False, 'startAt': (base + dt.timedelta(seconds=200)).isoformat(),
                'dueAt': (base + dt.timedelta(hours=2)).isoformat(),
                'assigneeIds': [ids['alpha-one-employee'], ids['beta-one-employee']]
            })
            pending = change(result_task, 'alpha-one-employee', {
                'command': 'change', 'description': '通知详情新说明', 'progressNote': '通知详情进展',
                'reason': '结构化结果验证'
            })
            workers = worker
            workers()
            submitted = notice_for('alpha-one-head', result_task, 'task.change.submitted', pending['requestId'])
            check('current reviewer receives the submitted request notification', submitted is not None)
            check('submitted notification exposes request access and review ability',
                  submitted['canReadRequest'] is True and submitted['canReview'] is True
                  and submitted['requestId'] == pending['requestId'], submitted)
            approve(pending['requestId'], 'alpha-one-head')
            workers()

            applicant_result = notice_for('alpha-one-employee', result_task, 'task.change.approved', pending['requestId'])
            reviewer_result = notice_for('alpha-one-head', result_task, 'task.change.approved', pending['requestId'])
            ordinary_result = next((row for row in notices('beta-one-employee') if row.get('taskId') == result_task and row.get('eventType') == 'task.change.approved'), None)
            check('applicant result keeps original request access without review ability',
                  applicant_result is not None and applicant_result['canReadRequest'] is True
                  and applicant_result['canReview'] is False and applicant_result['requestId'] == pending['requestId'], applicant_result)
            check('reviewer result keeps original request access after terminal decision',
                  reviewer_result is not None and reviewer_result['canReadRequest'] is True
                  and reviewer_result['canReview'] is False and reviewer_result['requestId'] == pending['requestId'], reviewer_result)
            check('ordinary result recipient cannot read the original request',
                  ordinary_result is not None and ordinary_result['canReadRequest'] is False
                  and ordinary_result.get('requestUnavailable') is True and ordinary_result.get('requestId') is None, ordinary_result)
            check('structured result carries only legal changed fields',
                  {'description', 'progressNote'}.issubset({row['field'] for row in applicant_result['changes']})
                  and 'diff' not in applicant_result and 'proposedVersion' not in applicant_result, applicant_result)
            check('result change values are the actual event values',
                  any(row['field'] == 'description' and row['after'] == '通知详情新说明' for row in applicant_result['changes'])
                  and any(row['field'] == 'progressNote' and row['after'] == '通知详情进展' for row in applicant_result['changes']), applicant_result)

            later = change(result_task, 'alpha-one-employee', {
                'command': 'change', 'description': '后续申请', 'reason': '后续申请验证'
            })
            workers()
            old_detail = ok('alpha-one-employee', 'GET', '/notifications/' + applicant_result['id'])
            check('old notification stays bound to its original request',
                  old_detail['requestId'] == pending['requestId'] and old_detail['requestId'] != later['requestId'], old_detail)

            removed_task = task('founder', {
                'title': '移除结果接收人', 'description': '原说明', 'priority': 'medium',
                'allDay': False, 'startAt': (base + dt.timedelta(seconds=250)).isoformat(),
                'dueAt': (base + dt.timedelta(hours=2, seconds=30)).isoformat(),
                'assigneeIds': [ids['alpha-one-employee'], ids['beta-one-employee']]
            })
            removed_current = ok('founder', 'GET', '/tasks/' + removed_task)
            ok('founder', 'PATCH', '/tasks/' + removed_task,
               {'command': 'change', 'assigneeIds': [ids['alpha-one-employee']], 'reason': '移除结果接收人'},
               removed_current['rowVersion'])
            workers()
            removed_notice = next((row for row in notices('beta-one-employee')
                                   if row.get('taskId') == removed_task and row.get('eventType') == 'task.change.applied'), None)
            check('removed owner result has no request access',
                  removed_notice is not None and removed_notice['canReadRequest'] is False
                  and removed_notice.get('requestId') is None and removed_notice.get('relationLost') is True, removed_notice)

            missing_task = task('founder', {
                'title': '缺失申请链接', 'description': '原说明', 'priority': 'medium',
                'allDay': False, 'startAt': (base + dt.timedelta(seconds=260)).isoformat(),
                'dueAt': (base + dt.timedelta(hours=2, seconds=40)).isoformat(),
                'assigneeIds': [ids['alpha-one-employee']]
            })
            workers()
            missing_notice = next((row for row in notices('alpha-one-employee')
                                   if row.get('taskId') == missing_task and row.get('eventType') == 'task.create.applied'), None)
            check('missing-request fixture exists', missing_notice is not None)
            if missing_notice:
                f.db.server_side('UPDATE notifications SET request_id=' + quote(pending['requestId']) + ' WHERE id=' + quote(missing_notice['id']))
                missing_detail = ok('alpha-one-employee', 'GET', '/notifications/' + missing_notice['id'])
                check('mismatched original request hides its entry and reveals no request payload',
                      missing_detail['canReadRequest'] is False and missing_detail.get('requestUnavailable') is True
                      and missing_detail.get('requestId') is None, missing_detail)

            redact_create = ok('alpha-one-employee', 'POST', '/tasks', {
                'title': '撤回裁剪对象', 'description': '撤回前说明', 'priority': 'medium',
                'allDay': False, 'startAt': (base + dt.timedelta(seconds=300)).isoformat(),
                'dueAt': (base + dt.timedelta(hours=3)).isoformat(),
                'assigneeIds': [ids['alpha-one-employee']]
            })
            workers()
            redact_notice = notice_for('alpha-one-employee', redact_create['taskId'], 'task.create.submitted', redact_create['requestId'])
            check('redaction fixture has a delivered event', redact_notice is not None)
            if redact_notice:
                ok('admin', 'POST', '/admin/notifications/' + redact_notice['eventId'] + '/withdraw', {'reason': '裁剪验证'})
                redacted = ok('alpha-one-employee', 'GET', '/notifications/' + redact_notice['id'])
                check('withdrawal removes result, changes, object name and request access',
                      redacted['revoked'] is True and redacted['eventResult'] is None and redacted['changes'] == []
                      and redacted.get('objectName') is None and redacted.get('taskId') is None
                      and redacted.get('requestId') is None and redacted.get('canReadRequest') is False, redacted)

            pending_create = ok('alpha-one-employee', 'POST', '/tasks', {
                'title': '通知撤销申请', 'description': '待创建申请', 'priority': 'medium',
                'allDay': False, 'startAt': (base + dt.timedelta(seconds=400)).isoformat(),
                'dueAt': (base + dt.timedelta(hours=4)).isoformat(),
                'assigneeIds': [ids['alpha-one-employee']]
            })
            workers()
            pending_notice = next((row for row in notices('alpha-one-employee')
                                   if row.get('eventType') == 'task.create.submitted'
                                   and row.get('requestId') == pending_create['requestId']), None)
            check('applicant pending creation notification exists for request withdrawal',
                  pending_notice is not None and pending_notice.get('canWithdrawRequest') is True, pending_notice)
            withdraw_create = ok('alpha-one-employee', 'POST', '/tasks', {
                'title': '通知撤回消息', 'description': '待创建撤回', 'priority': 'medium',
                'allDay': False, 'startAt': (base + dt.timedelta(seconds=500)).isoformat(),
                'dueAt': (base + dt.timedelta(hours=5)).isoformat(),
                'assigneeIds': [ids['alpha-one-employee']]
            })
            workers()
            withdraw_notice = next((row for row in notices('alpha-one-employee')
                                    if row.get('eventType') == 'task.create.submitted'
                                    and row.get('requestId') == withdraw_create['requestId']), None)
            check('applicant pending creation notification exists for notification withdrawal',
                  withdraw_notice is not None and withdraw_notice.get('canWithdraw') is True, withdraw_notice)
            delete_notice = next(row for row in reminders['items'] if row['id'] != overdue['id'])

            manifest = {
                'base': f'http://127.0.0.1:{fixture.port}',
                'employee': f.identities['alpha-one-employee']['identifier'],
                'resultTaskId': result_task,
                'resultTitle': '通知详情对象',
                'resultNoticeId': applicant_result['id'],
                'pendingNoticeId': pending_notice['id'],
                'pendingRequestId': pending_create['requestId'],
                'withdrawNoticeId': withdraw_notice['id'],
                'reminderNoticeId': delete_notice['id'],
                'reminderCount': 4,
            }
            subprocess.run(['node', str(BASE / 'scripts/check_apply_notifications_browser.js')],
                           env={**os.environ, 'PANDORA_NOTIFICATION_FIXTURE': json.dumps(manifest)}, check=True)
            withdrawn_request = ok('alpha-one-employee', 'GET', '/approval-requests/' + pending_create['requestId'])
            check('notification more action withdrew the applicant request', withdrawn_request['status'] == 'withdrawn', withdrawn_request)
            check('deleted notification is gone from the recipient inbox',
                  not any(row['id'] == delete_notice['id'] for row in notices('alpha-one-employee')))
            check('redaction leaves business request history intact',
                  f.db.scalar('SELECT COUNT(*) FROM approval_requests WHERE id=' + quote(redact_create['requestId'])) == 1)
            report['result'] = 'PASS'
    except BaseException as error:
        report['result'] = 'FAIL'
        report['error'] = str(error)
        raise
    finally:
        (out / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
