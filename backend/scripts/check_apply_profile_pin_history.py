#!/usr/bin/env python3
"""Section 4 people cache, profile, pin and employee-history checks."""
import datetime as dt
import json
import os
import subprocess
import uuid

from fixed_model_fixture import Fixture, quote
from migration_precheck import BASE


def main():
    out = BASE.parent / 'output/apply-profile-pin-history'
    out.mkdir(parents=True, exist_ok=True)
    report = {'checks': []}
    fixture = Fixture(port=18235, worker=True, controllable=True)
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

            def call(who, method, path, body=None, version=None):
                return f.call(method, path, body, tokens[who], uuid.uuid4().hex, version)

            def ok(who, method, path, body=None, version=None):
                status, row = call(who, method, path, body, version)
                assert status in (200, 201), (method, path, status, row)
                return row

            def worker():
                ok('admin', 'POST', '/admin/worker/run-once', {})

            def create(title, owners, start, due):
                return ok('founder', 'POST', '/tasks', {
                    'title': title, 'description': '原说明', 'priority': 'medium',
                    'allDay': False, 'startAt': start.isoformat(), 'dueAt': due.isoformat(),
                    'assigneeIds': owners
                })['taskId']

            def detail(task_id, who='founder'):
                return ok(who, 'GET', '/tasks/' + task_id)

            def approve(request_id, who):
                request = ok(who, 'GET', '/approval-requests/' + request_id)
                return ok(who, 'PATCH', '/approval-requests/' + request_id, {'decision': 'approve'}, request['rowVersion'])

            base = dt.datetime.fromisoformat(ok('admin', 'GET', '/admin/clock')['now'].replace('Z', '+00:00'))
            pin_task = create('置顶资格验证', [ids['alpha-one-employee']],
                              base + dt.timedelta(seconds=100), base + dt.timedelta(hours=2))
            owner_view = detail(pin_task, 'alpha-one-employee')
            manager_view = detail(pin_task, 'alpha-one-head')
            check('effective owner gets the personal pin action', owner_view['canPin'] is True, owner_view)
            check('visible manager without ownership gets no pin action', manager_view['canPin'] is False, manager_view)
            check('non-owner pin write is rejected', call('alpha-one-head', 'PUT', '/tasks/' + pin_task + '/pin')[0] == 403)
            ok('alpha-one-employee', 'PUT', '/tasks/' + pin_task + '/pin')
            check('owner pin is private to that owner', detail(pin_task, 'alpha-one-employee')['pinned'] is True
                  and detail(pin_task, 'founder')['pinned'] is False)
            before_pin_schedule = detail(pin_task, 'alpha-one-employee')
            ok('alpha-one-employee', 'DELETE', '/tasks/' + pin_task + '/pin')
            after_pin_schedule = detail(pin_task, 'alpha-one-employee')
            check('pin and unpin do not change the task schedule',
                  before_pin_schedule['startAt'] == after_pin_schedule['startAt']
                  and before_pin_schedule['dueAt'] == after_pin_schedule['dueAt'])

            completed = create('已完成置顶验证', [ids['alpha-one-employee']],
                               base + dt.timedelta(seconds=200), base + dt.timedelta(hours=3))
            completion = ok('alpha-one-employee', 'PATCH', '/tasks/' + completed, {
                'command': 'complete', 'completionNote': '完成置顶验证'
            }, detail(completed, 'alpha-one-employee')['rowVersion'])
            approve(completion['requestId'], 'alpha-one-head')
            done = detail(completed, 'alpha-one-employee')
            check('completed effective task remains pin-eligible', done['executionState'] == 'done' and done['canPin'] is True, done)
            ok('alpha-one-employee', 'PUT', '/tasks/' + completed + '/pin')
            check('completed task can be pinned without changing state',
                  detail(completed, 'alpha-one-employee')['pinned'] is True
                  and detail(completed, 'alpha-one-employee')['executionState'] == 'done')

            unpublished = ok('alpha-one-employee', 'POST', '/tasks', {
                'title': '未发布置顶验证', 'description': '原说明', 'priority': 'medium',
                'allDay': False, 'startAt': (base + dt.timedelta(seconds=300)).isoformat(),
                'dueAt': (base + dt.timedelta(hours=4)).isoformat(),
                'assigneeIds': [ids['alpha-one-employee']]
            })
            unpublished_detail = detail(unpublished['taskId'], 'alpha-one-employee')
            check('unpublished task has no pin action', not unpublished_detail.get('canPin', False), unpublished_detail)
            check('unpublished pin write is rejected',
                  call('alpha-one-employee', 'PUT', '/tasks/' + unpublished['taskId'] + '/pin')[0] in (403, 409))

            history_task = create('员工历史投影', [ids['alpha-one-employee']],
                                  base + dt.timedelta(seconds=400), base + dt.timedelta(hours=5))
            for note in ('第一轮进展', '第二轮进展'):
                pending = ok('alpha-one-employee', 'PATCH', '/tasks/' + history_task, {
                    'command': 'progress', 'progressNote': note
                }, detail(history_task, 'alpha-one-employee')['rowVersion'])
                approve(pending['requestId'], 'alpha-one-head')
            complete = ok('alpha-one-employee', 'PATCH', '/tasks/' + history_task, {
                'command': 'complete', 'completionNote': '历史完成'
            }, detail(history_task, 'alpha-one-employee')['rowVersion'])
            approve(complete['requestId'], 'alpha-one-head')
            employee_history = detail(history_task, 'alpha-one-employee')
            check('employee detail exposes only the current progress and no records timeline',
                  employee_history['progressNote'] == '第二轮进展' and 'records' not in employee_history, employee_history)
            check('employee cannot query the administrator history endpoint',
                  call('alpha-one-employee', 'GET', '/admin/tasks/' + history_task + '/history')[0] in (403, 404))
            admin_history = ok('admin', 'GET', '/admin/tasks/' + history_task + '/history')
            check('administrator retains the complete operation history',
                  len(admin_history.get('entries', [])) >= 6 and 'progress' in json.dumps(admin_history), admin_history)

            manifest = {
                'base': f'http://127.0.0.1:{fixture.port}',
                'employeeId': ids['alpha-one-employee'],
                'employee': f.identities['alpha-one-employee']['identifier'],
                'founder': f.identities['founder']['identifier'],
                'founderId': ids['founder'],
                'ownerPerson': f.identities['alpha-one-employee']['identifier'],
                'pinTask': pin_task,
                'completedTask': completed,
                'historyTask': history_task,
                'historyText': '第二轮进展',
                'adminToken': tokens['admin'],
                'replacementHeadId': ids['beta-one-head'],
                'removedCandidateId': ids['beta-two-employee']
            }
            subprocess.run(['node', str(BASE / 'scripts/check_apply_profile_pin_history_browser.js')],
                           env={**os.environ, 'PANDORA_PROFILE_FIXTURE': json.dumps(manifest)}, check=True)
            report['result'] = 'PASS'
    except BaseException as error:
        report['result'] = 'FAIL'
        report['error'] = str(error)
        raise
    finally:
        (out / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
