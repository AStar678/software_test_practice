#!/usr/bin/env python3
"""HTTP regression for the dedicated handover preset and command (V-010 / DEV-004).

Covers the persisted preset for self and the direct manager, the legal target range, non-direct
authorization, preset-based handover submission, new-route approval, provenance and the prohibition
on smuggling base fields.

    python3 scripts/check_handover_preset.py --base-url http://127.0.0.1:18500
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request
import uuid

RESULTS: list[dict] = []
PASSWORD = "Demo@123456"


class Api:
    def __init__(self, base: str):
        self.base = base.rstrip('/')
        self.tokens: dict[str, str] = {}

    def call(self, method: str, path: str, token: str | None = None, body=None,
             key: str | None = None, if_match: str | None = None):
        data = None if body is None else json.dumps(body).encode()
        target = urllib.parse.quote(self.base + path, safe=":/?&=%")
        request = urllib.request.Request(target, data=data, method=method)
        request.add_header('Content-Type', 'application/json')
        if token:
            request.add_header('Authorization', 'Bearer ' + token)
        if key:
            request.add_header('Idempotency-Key', key)
        if if_match:
            request.add_header('If-Match', if_match)
        try:
            with urllib.request.urlopen(request) as response:
                payload = response.read().decode()
                return response.status, (json.loads(payload) if payload else {}), dict(response.headers)
        except urllib.error.HTTPError as error:
            payload = error.read().decode()
            try:
                parsed = json.loads(payload) if payload else {}
            except json.JSONDecodeError:
                parsed = {'raw': payload}
            return error.code, parsed, dict(error.headers)

    def login(self, username: str) -> str:
        status, body, _ = self.call('POST', '/api/v1/auth/sessions',
                                    body={'username': username, 'password': PASSWORD})
        if status != 200:
            raise SystemExit(f'login failed for {username}: {status} {body}')
        self.tokens[username] = body['token']
        return body['token']

    def me(self, username: str) -> dict:
        _, body, _ = self.call('GET', '/api/v1/me', self.tokens[username])
        return body

    @staticmethod
    def key(prefix='handover') -> str:
        return prefix + '-' + uuid.uuid4().hex


def check(name: str, condition: bool, evidence) -> None:
    RESULTS.append({'check': name, 'pass': bool(condition), 'evidence': evidence})
    print(('PASS  ' if condition else 'FAIL  ') + name + ('' if condition else f'  -> {evidence}'))


def task_payload(title: str, assignees: list[str]) -> dict:
    start = dt.datetime.now(dt.timezone.utc).replace(microsecond=0) + dt.timedelta(days=1)
    return {'title': title, 'description': '交接受权核验', 'acceptanceCriteria': '可复核',
            'priority': 'medium', 'allDay': False,
            'startAt': start.isoformat().replace('+00:00', 'Z'),
            'dueAt': (start + dt.timedelta(days=2)).isoformat().replace('+00:00', 'Z'),
            'assigneeIds': assignees}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:18500')
    parser.add_argument('--output', type=Path, default=None)
    args = parser.parse_args()
    api = Api(args.base_url)
    for username in ('admin', 'employee', 'middle', 'upper', 'colleague'):
        api.login(username)
    employee = api.me('employee')['id']
    middle = api.me('middle')['id']
    upper = api.me('upper')['id']
    colleague = api.me('colleague')['id']
    admin = api.me('admin')['id']

    status, targets, _ = api.call('GET', '/api/v1/handover-targets?subjectId=' + employee,
                                  api.tokens['employee'])
    names = {row['id'] for row in targets.get('items', [])}
    check('V-010 the legal target range contains the department colleague and the direct manager',
          status == 200 and colleague in names and middle in names, {'items': sorted(names)})
    check('V-010 the target range excludes the person, the administrator and unrelated departments',
          employee not in names and admin not in names and upper not in names, {'items': sorted(names)})

    status, saved, _ = api.call('PUT', f'/api/v1/users/{employee}/handover-preset', api.tokens['employee'],
                                {'targetUserId': colleague}, Api.key('self-preset'))
    check('V-010 the person saves their own preset',
          status == 200 and saved.get('targetUserId') == colleague,
          {'status': status, 'body': saved})
    status, read_back, _ = api.call('GET', f'/api/v1/users/{employee}/handover-preset', api.tokens['employee'])
    check('V-010 the preset is readable after a fresh login',
          status == 200 and read_back.get('targetUserId') == colleague,
          {'status': status, 'body': read_back})
    api.login('employee')
    status, after_login, _ = api.call('GET', f'/api/v1/users/{employee}/handover-preset', api.tokens['employee'])
    check('V-010 the preset survives re-login', status == 200 and after_login.get('targetUserId') == colleague,
          after_login)

    status, manager_saved, _ = api.call('PUT', f'/api/v1/users/{employee}/handover-preset', api.tokens['middle'],
                                        {'targetUserId': colleague}, Api.key('manager-preset'))
    check('V-010 the direct manager saves the subordinate preset',
          status == 200 and manager_saved.get('targetUserId') == colleague
          and manager_saved.get('setByUserId') == middle,
          {'status': status, 'body': manager_saved})
    status, forbidden_setter, _ = api.call('PUT', f'/api/v1/users/{employee}/handover-preset', api.tokens['upper'],
                                           {'targetUserId': colleague}, Api.key('upper-preset'))
    check('V-010 a non-direct manager cannot set the preset', status == 403,
          {'status': status, 'body': forbidden_setter})
    status, unrelated_setter, _ = api.call('PUT', f'/api/v1/users/{colleague}/handover-preset',
                                           api.tokens['employee'], {'targetUserId': middle},
                                           Api.key('colleague-preset'))
    check('V-010 an unrelated colleague cannot set another person preset', status == 403,
          {'status': status, 'body': unrelated_setter})

    status, self_target, _ = api.call('PUT', f'/api/v1/users/{employee}/handover-preset',
                                      api.tokens['employee'], {'targetUserId': employee},
                                      Api.key('self-target'))
    check('V-010 the target cannot be the person being handed over', status == 400,
          {'status': status, 'body': self_target})
    status, admin_target, _ = api.call('PUT', f'/api/v1/users/{employee}/handover-preset',
                                       api.tokens['employee'], {'targetUserId': admin},
                                       Api.key('admin-target'))
    check('V-010 an administrator cannot be a handover target', status == 400,
          {'status': status, 'body': admin_target})
    status, outside_target, _ = api.call('PUT', f'/api/v1/users/{employee}/handover-preset',
                                         api.tokens['employee'], {'targetUserId': upper},
                                         Api.key('upper-target'))
    check('V-010 a target outside the legal working circle is rejected', status == 400,
          {'status': status, 'body': outside_target})

    # An inactive account is no longer a legal successor. Create a temporary colleague in the
    # employee's own department, deactivate it, and try to store it as the preset.
    _, structure, _ = api.call('GET', '/api/v1/admin/organization', api.tokens['admin'])
    _, employees, _ = api.call('GET', '/api/v1/admin/employees?limit=200', api.tokens['admin'])
    employee_row = next(row for row in employees['items'] if row['id'] == employee)
    status, inactive_created, _ = api.call('POST', '/api/v1/admin/employees', api.tokens['admin'],
                                           {'username': 'ho-inactive-' + uuid.uuid4().hex[:8],
                                            'displayName': '交接失效账号',
                                            'departmentId': employee_row['departmentId'],
                                            'positionId': employee_row['positionId'],
                                            'level': 3, 'roleCodes': ['employee']}, Api.key('inactive-create'))
    inactive = inactive_created.get('userId')
    _, inactive_detail, inactive_headers = api.call('GET', f'/api/v1/admin/employees/{inactive}',
                                                   api.tokens['admin'])
    api.call('PATCH', f'/api/v1/admin/employees/{inactive}', api.tokens['admin'], {'active': False},
             Api.key('inactive-off'), inactive_headers.get('ETag'))
    status, inactive_target, _ = api.call('PUT', f'/api/v1/users/{employee}/handover-preset',
                                          api.tokens['employee'], {'targetUserId': inactive},
                                          Api.key('inactive-target'))
    check('V-010 an inactive account is rejected as a handover target', status == 400,
          {'status': status, 'body': inactive_target})


    # A pending task created by the direct manager and owned by the employee.
    status, created, _ = api.call('POST', '/api/v1/tasks', api.tokens['middle'],
                                  task_payload(f'预设交接任务-{uuid.uuid4().hex[:6]}', [employee]),
                                  Api.key('create'))
    task_id, request_id = created['taskId'], created['requestId']
    status, approved, _ = api.call('PATCH', f'/api/v1/approval-requests/{request_id}', api.tokens['middle'],
                                   {'decision': 'approve', 'comment': '初始通过'}, Api.key('approve'), '"1"')
    check('V-010 the handover fixture is published', status == 200, {'status': status, 'body': approved})
    status, detail, headers = api.call('GET', f'/api/v1/tasks/{task_id}', api.tokens['employee'])
    check('V-010 the task detail exposes the dedicated handover source and preset',
          status == 200 and detail.get('canHandover') is True
          and detail.get('handoverSources') == [employee]
          and detail.get('handoverPresets', {}).get(employee) == colleague,
          {key: detail.get(key) for key in ('canHandover', 'handoverSources', 'handoverPresets')})
    etag = headers.get('ETag') or '"' + str(detail['rowVersion']) + '"'
    status, handover, _ = api.call('POST', f'/api/v1/tasks/{task_id}/handover', api.tokens['employee'],
                                   {'sourceUserId': employee, 'reason': '使用预设交接'},
                                   Api.key('handover-preset'), etag)
    check('V-010 the command uses the persisted preset when no target is supplied',
          status == 200 and handover.get('outcome') == 'pending', {'status': status, 'body': handover})
    status, handover_view, _ = api.call('GET', f"/api/v1/approval-requests/{handover['requestId']}",
                                        api.tokens['middle'])
    check('V-010 the handover routes by the new owner and waits for explicit review',
          status == 200 and handover_view.get('currentReviewerId') == middle
          and handover_view.get('kind') == 'handover', handover_view)
    status, approved_handover, _ = api.call('PATCH', f"/api/v1/approval-requests/{handover['requestId']}",
                                            api.tokens['middle'], {'decision': 'approve', 'comment': '同意交接'},
                                            Api.key('approve-handover'),
                                            '"' + str(handover_view['rowVersion']) + '"')
    check('V-010 the new route approves the handover', status == 200,
          {'status': status, 'body': approved_handover})
    status, after, _ = api.call('GET', f'/api/v1/tasks/{task_id}', api.tokens['colleague'])
    check('V-010 the target owns the task and the source no longer does',
          status == 200 and colleague in after.get('assigneeIds', []) and employee not in after.get('assigneeIds', []),
          {'assigneeIds': after.get('assigneeIds')})
    status, history, _ = api.call('GET', f'/api/v1/admin/tasks/{task_id}/history', api.tokens['admin'])
    handovers = history.get('handovers', [])
    check('V-010 the source, target, setter and approval remain traceable',
          status == 200 and any(row.get('sourceUserId') == employee and row.get('targetUserId') == colleague
                                and row.get('setByUserId') == employee for row in handovers),
          {'handovers': handovers})

    # A second task lets the manager exercise the same preset-based command.
    # A second task created by someone else proves the direct manager does not need to be the original
    # creator to use the preset and submit the handover.
    status, created2, _ = api.call('POST', '/api/v1/tasks', api.tokens['upper'],
                                   task_payload(f'领导预设交接-{uuid.uuid4().hex[:6]}', [employee]),
                                   Api.key('create2'))
    task2, request2 = created2['taskId'], created2['requestId']
    api.call('PATCH', f'/api/v1/approval-requests/{request2}', api.tokens['middle'],
             {'decision': 'approve', 'comment': '初始通过'}, Api.key('approve2'), '"1"')
    _, detail2, headers2 = api.call('GET', f'/api/v1/tasks/{task2}', api.tokens['middle'])
    check('V-010 the manager handling the second task is not its original creator',
          detail2.get('originalCreatorId') == upper,
          {'originalCreatorId': detail2.get('originalCreatorId'), 'manager': middle})
    status, manager_handover, _ = api.call('POST', f'/api/v1/tasks/{task2}/handover', api.tokens['middle'],
                                           {'sourceUserId': employee, 'reason': '领导按预设交接'},
                                           Api.key('handover-manager'),
                                           headers2.get('ETag') or '"' + str(detail2['rowVersion']) + '"')
    check('V-010 the direct manager can use the same preset for the subordinate task',
          status == 200 and manager_handover.get('outcome') == 'pending',
          {'status': status, 'body': manager_handover})

    status, smuggle, _ = api.call('POST', f'/api/v1/tasks/{task2}/handover', api.tokens['middle'],
                                  {'sourceUserId': employee, 'targetUserId': colleague, 'title': '夹带标题'},
                                  Api.key('smuggle'), '"1"')
    check('V-010 a handover still cannot carry a base field', status == 400,
          {'status': status, 'body': smuggle})

    # Resolve the pending manager handover so the non-direct check reaches the authority rule rather
    # than the freeze/version precondition.
    _, manager_view, _ = api.call('GET', f"/api/v1/approval-requests/{manager_handover['requestId']}",
                                  api.tokens['middle'])
    api.call('PATCH', f"/api/v1/approval-requests/{manager_handover['requestId']}", api.tokens['middle'],
             {'decision': 'approve', 'comment': '同意交接'}, Api.key('approve-manager'),
             '"' + str(manager_view['rowVersion']) + '"')
    _, upper_detail, upper_headers = api.call('GET', f'/api/v1/tasks/{task2}', api.tokens['upper'])
    status, non_direct, _ = api.call('POST', f'/api/v1/tasks/{task2}/handover', api.tokens['upper'],
                                     {'sourceUserId': employee, 'targetUserId': colleague},
                                     Api.key('non-direct'),
                                     upper_headers.get('ETag') or '"' + str(upper_detail['rowVersion']) + '"')
    check('V-010 a non-direct manager cannot hand the task over', status == 403,
          {'status': status, 'body': non_direct})

    # Rejection and withdrawal keep the original ordered owners and only release the freeze.
    api.call('PUT', f'/api/v1/users/{employee}/handover-preset', api.tokens['employee'],
             {'targetUserId': middle}, Api.key('preset-for-reject'))
    status, created3, _ = api.call('POST', '/api/v1/tasks', api.tokens['middle'],
                                   task_payload(f'交接拒绝保留-{uuid.uuid4().hex[:6]}', [employee, colleague]),
                                   Api.key('create3'))
    task3, request3 = created3['taskId'], created3['requestId']
    _, create3_view, _ = api.call('GET', f'/api/v1/approval-requests/{request3}', api.tokens['middle'])
    api.call('PATCH', f'/api/v1/approval-requests/{request3}', api.tokens['middle'],
             {'decision': 'approve', 'comment': '初始通过'}, Api.key('approve3'),
             '"' + str(create3_view['rowVersion']) + '"')
    _, detail3, headers3 = api.call('GET', f'/api/v1/tasks/{task3}', api.tokens['employee'])
    check('V-010 the ordered effective owners start as submitted',
          detail3.get('assigneeIds') == [employee, colleague], detail3.get('assigneeIds'))
    status, handover3, _ = api.call('POST', f'/api/v1/tasks/{task3}/handover', api.tokens['employee'],
                                    {'sourceUserId': employee, 'reason': '拒绝保留验证'},
                                    Api.key('handover-reject'),
                                    headers3.get('ETag') or '"' + str(detail3['rowVersion']) + '"')
    _, frozen3, _ = api.call('GET', f'/api/v1/tasks/{task3}', api.tokens['employee'])
    check('V-010 a pending handover freezes the task but keeps the effective owners',
          status == 200 and handover3.get('outcome') == 'pending' and frozen3.get('frozen') is True
          and frozen3.get('assigneeIds') == [employee, colleague],
          {'frozen': frozen3.get('frozen'), 'assigneeIds': frozen3.get('assigneeIds')})
    _, handover3_view, handover3_headers = api.call('GET', f"/api/v1/approval-requests/{handover3['requestId']}",
                                                    api.tokens['upper'])
    check('V-010 the pending handover routes by the new ordered owners',
          handover3_view.get('currentReviewerId') == upper, handover3_view.get('currentReviewerId'))
    status, rejected_handover, _ = api.call('PATCH', f"/api/v1/approval-requests/{handover3['requestId']}",
                                            api.tokens['upper'], {'decision': 'reject', 'comment': '不同意交接'},
                                            Api.key('reject-handover'),
                                            '"' + str(handover3_view['rowVersion']) + '"')
    _, restored3, _ = api.call('GET', f'/api/v1/tasks/{task3}', api.tokens['employee'])
    check('V-010 rejecting a handover keeps the old ordered owners and unfreezes',
          status == 200 and restored3.get('frozen') is False
          and restored3.get('assigneeIds') == [employee, colleague],
          {'status': status, 'frozen': restored3.get('frozen'), 'assigneeIds': restored3.get('assigneeIds')})

    _, detail3b, headers3b = api.call('GET', f'/api/v1/tasks/{task3}', api.tokens['employee'])
    status, handover3b, _ = api.call('POST', f'/api/v1/tasks/{task3}/handover', api.tokens['employee'],
                                     {'sourceUserId': employee, 'reason': '撤销保留验证'},
                                     Api.key('handover-withdraw'),
                                     headers3b.get('ETag') or '"' + str(detail3b['rowVersion']) + '"')
    _, withdraw_view, _ = api.call('GET', f"/api/v1/approval-requests/{handover3b['requestId']}",
                                   api.tokens['employee'])
    status, withdrawn_handover, _ = api.call('PATCH', f"/api/v1/approval-requests/{handover3b['requestId']}",
                                             api.tokens['employee'], {'decision': 'withdraw'},
                                             Api.key('withdraw-handover'),
                                             '"' + str(withdraw_view['rowVersion']) + '"')
    _, restored3b, _ = api.call('GET', f'/api/v1/tasks/{task3}', api.tokens['employee'])
    check('V-010 withdrawing a handover keeps the old ordered owners and unfreezes',
          status == 200 and withdrawn_handover.get('outcome') == 'withdrawn'
          and restored3b.get('frozen') is False
          and restored3b.get('assigneeIds') == [employee, colleague],
          {'status': status, 'body': withdrawn_handover, 'assigneeIds': restored3b.get('assigneeIds')})

    status, cleared, _ = api.call('DELETE', f'/api/v1/users/{employee}/handover-preset', api.tokens['middle'],
                                  key=Api.key('clear'))
    status2, cleared_get, _ = api.call('GET', f'/api/v1/users/{employee}/handover-preset', api.tokens['employee'])
    check('V-010 the preset can be cleared and no longer applies',
          status == 200 and cleared.get('cleared') is True and cleared_get.get('targetUserId') is None,
          {'clear': cleared, 'read': cleared_get})

    report = {'success': all(row['pass'] for row in RESULTS),
              'checksPassed': sum(1 for row in RESULTS if row['pass']),
              'checksFailed': sum(1 for row in RESULTS if not row['pass']), 'checks': RESULTS}
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(('PASS' if report['success'] else 'FAIL') + f": {report['checksPassed']} passed, {report['checksFailed']} failed")
    return 0 if report['success'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
