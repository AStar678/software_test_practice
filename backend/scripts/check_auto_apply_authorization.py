#!/usr/bin/env python3
"""Task 5.3: direct self-application runs through the same version, deadline, freeze and authority checks.

The former V-008 script depended on editable role scopes and username logins, both retired by the
fixed-position contract. This version uses the current identity/login contract and a disposable
real JAR/MySQL fixture.
"""
import datetime as dt
import json
import uuid
from fixed_model_fixture import Fixture
from migration_precheck import BASE

OUTPUT = BASE.parent / 'audit/refactor-pandora-organization-and-workflows/auto-apply-authorization.json'


def main():
    report = {'updated': dt.datetime.now(dt.timezone.utc).isoformat(), 'checks': []}

    def check(name, condition, evidence=None):
        report['checks'].append({'check': name, 'pass': bool(condition), 'evidence': evidence})
        print(('PASS ' if condition else 'FAIL ') + name, flush=True)
        if not condition:
            print('EVIDENCE ' + json.dumps(evidence, ensure_ascii=False, default=str), flush=True)
            raise AssertionError(name)

    fixture = Fixture(port=18186, worker=False, controllable=True)
    fixture.log_path = OUTPUT.with_name('auto-apply-service.log')
    try:
        with fixture as f:
            tokens = {key: f.login(key)[1]['token'] for key in f.identities}
            ids = {key: value['id'] for key, value in f.identities.items()}

            def call(method, path, body=None, who='founder', version=None, key=None):
                return f.call(method, path, body, tokens[who], key or 'auto-' + uuid.uuid4().hex, version)

            def detail(task, who='founder'):
                return call('GET', '/tasks/' + task, who=who)[1]

            def now():
                return dt.datetime.fromisoformat(call('GET', '/admin/clock', who='admin')[1]['now'].replace('Z', '+00:00'))

            def create(who, owners, title='Auto apply fixture', start_offset=3600, due_offset=86400, key=None):
                base = now()
                body = {'title': title + ' ' + uuid.uuid4().hex[:6], 'description': 'Direct application contract',
                        'priority': 'medium', 'allDay': False,
                        'startAt': (base + dt.timedelta(seconds=start_offset)).isoformat(),
                        'dueAt': (base + dt.timedelta(seconds=due_offset)).isoformat(),
                        'assigneeIds': [ids[key] for key in owners]}
                return call('POST', '/tasks', body, who, key=key)

            own = create('founder', ['founder'])
            check('fixed founder creates directly without a pending request', own[0] == 201 and own[1]['outcome'] == 'direct', own)

            task = own[1]['taskId']
            version = detail(task)['rowVersion']
            status, changed = call('PATCH', '/tasks/' + task,
                                   {'command': 'change', 'title': 'Direct change accepted', 'reason': 'Self maintenance'},
                                   'founder', version)
            check('self change applies directly with a documented reason', status == 200 and changed['outcome'] == 'direct')
            request = f.db.rows('SELECT status,decided_by,exemption_reason FROM approval_requests WHERE id=' + repr(changed['requestId']))
            check('direct request stores applicant decision and exemption reason',
                  request and request[0][0] == 'direct' and request[0][1] == ids['founder'] and bool(request[0][2]), request)
            check('direct change records no self-review entry', not f.db.scalar(
                "SELECT COUNT(*) FROM approval_requests WHERE task_id=" + repr(task) + " AND status='pending'"))
            check('direct change history is durable', f.db.scalar(
                "SELECT COUNT(*) FROM task_history_entries WHERE task_id=" + repr(task) + " AND request_id=" + repr(changed['requestId']) + " AND entry_type='no_reviewer'") == 1)
            check('detail exposes no re-approval entry for the direct change', 'pendingRequestId' not in detail(task))

            status, _ = call('PATCH', '/tasks/' + task,
                             {'command': 'change', 'title': 'Stale direct change', 'reason': 'Stale'},
                             'founder', version)
            check('direct apply cannot bypass the task version', status == 412, {'status': status})
            status, _ = call('PATCH', '/tasks/' + task,
                             {'command': 'change', 'title': 'Missing precondition', 'reason': 'No version'},
                             'founder', None)
            check('direct apply requires If-Match', status == 428, {'status': status})

            status, empty = call('PATCH', '/tasks/' + task,
                                 {'command': 'change', 'assigneeIds': [], 'reason': 'Empty owners'},
                                 'founder', detail(task)['rowVersion'])
            check('direct apply refuses an empty effective owner list', status == 400, empty)
            status, _ = call('PATCH', '/tasks/' + task,
                             {'command': 'change', 'assigneeIds': [ids['other-founder']], 'reason': 'Cross company'},
                             'founder', detail(task)['rowVersion'])
            check('direct apply refuses a cross-company owner', status == 400)
            other = create('other-founder', ['other-founder'])
            status, _ = call('PATCH', '/tasks/' + task,
                             {'command': 'change', 'parentTaskId': other[1]['taskId'], 'reason': 'Foreign parent'},
                             'founder', detail(task)['rowVersion'])
            check('direct apply rechecks the parent-task relationship', status in (400, 404), {'status': status})

            direct_version = detail(task)['rowVersion']
            status, repeated = call('PATCH', '/tasks/' + task,
                                    {'command': 'change', 'title': 'Idempotent direct change', 'reason': 'Same request'},
                                    'founder', direct_version, key='auto-apply-idempotent')
            check('direct change succeeds with an idempotency key', status == 200 and repeated['outcome'] == 'direct')
            after_first = detail(task)['rowVersion']
            status, replay = call('PATCH', '/tasks/' + task,
                                  {'command': 'change', 'title': 'Idempotent direct change', 'reason': 'Same request'},
                                  'founder', direct_version, key='auto-apply-idempotent')
            check('same-key replay returns the cached direct result without a new version',
                  status == 200 and replay['requestId'] == repeated['requestId'] and detail(task)['rowVersion'] == after_first,
                  {'status': status, 'replay': replay, 'version': detail(task)['rowVersion']})

            reviewed = create('founder', ['beta-two-employee'])
            reviewed_task = reviewed[1]['taskId']
            status, pending = call('PATCH', '/tasks/' + reviewed_task,
                                   {'command': 'progress', 'progressNote': 'Requires owner review'},
                                   'beta-two-employee', detail(reviewed_task, 'beta-two-employee')['rowVersion'])
            check('different applicant and reviewer stays pending without direct publication', status == 200 and pending['outcome'] == 'pending')
            check('pending request leaves the old effective progress', detail(reviewed_task, 'beta-two-employee')['progressNote'] == '')
            status, _ = call('PATCH', '/tasks/' + reviewed_task,
                             {'command': 'change', 'title': 'Frozen direct change', 'reason': 'Frozen'},
                             'founder', detail(reviewed_task)['rowVersion'])
            check('direct apply cannot bypass the unique pending freeze', status == 409)

            expiring = create('founder', ['founder'], 'Auto expiry', 5, 10)
            expiring_task = expiring[1]['taskId']
            call('POST', '/admin/clock/advance', {'seconds': 20}, 'admin')
            status, expired = call('PATCH', '/tasks/' + expiring_task,
                                   {'command': 'change', 'title': 'Past deadline', 'reason': 'Expired schedule'},
                                   'founder', detail(expiring_task)['rowVersion'])
            check('direct self change cannot bypass the applicable deadline', status == 409 and expired.get('code') == 'DEADLINE_PASSED', expired)

            call('POST', '/admin/clock/advance', {'seconds': 7200}, 'admin')
            status, completion = call('PATCH', '/tasks/' + reviewed_task,
                                      {'command': 'complete', 'completionNote': 'Reviewer decides'},
                                      'beta-two-employee', detail(reviewed_task, 'beta-two-employee')['rowVersion'])
            # The task is still frozen by its pending progress, so a second pending operation is refused.
            check('a second operation cannot bypass an existing pending freeze', status == 409, completion)

            report['result'] = 'PASS'
    except BaseException as error:
        report['result'] = 'FAIL'
        report['errorType'] = type(error).__name__
        raise
    finally:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
