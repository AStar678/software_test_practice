#!/usr/bin/env python3
"""HTTP verification for V-005: the reviewed V4 mapping gates formal business writes.

Run against a backend started on a database restored from ``database/pandora.sql`` (the V4 snapshot)
with ``PANDORA_SEED=false``. The script never issues SQL: it proves the business write is refused
while the mapping blockers are open, completes the mapping through the administration API, and then
proves the tightened schema accepts the same write while the repair path stayed available.

    python3 scripts/check_mapping_write_gate.py --base-url http://127.0.0.1:18220
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
import urllib.error
import urllib.request
import uuid

RESULTS: list[dict] = []
RUN = uuid.uuid4().hex[:6]



# Employees authenticate by phone number (chapter 2.1/2.3); demo accounts keep stable numbers.
DEMO_PHONE = {'upper': '13800000001', 'middle': '13800000002', 'market': '13800000003',
              'employee': '13800000004', 'colleague': '13800000005', 'marketing': '13800000006',
              'admin': 'admin'}


def login_identity(account):
    """Map a demo account name to the phone number it now authenticates with."""
    return DEMO_PHONE.get(account, account)

class Api:
    def __init__(self, base: str, password: str):
        self.base = base.rstrip('/')
        self.password = password
        self.tokens: dict[str, str] = {}

    def call(self, method: str, path: str, token: str | None = None, body=None,
             key: str | None = None, if_match: str | None = None):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(self.base + path, data=data, method=method)
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

    def login(self, username: str):
        status, body, _ = self.call('POST', '/api/v1/auth/sessions',
                                    body={'username': login_identity(username), 'password': self.password})
        if status != 200:
            raise SystemExit(f'login failed for {username}: {status} {body}')
        self.tokens[username] = body['token']
        return body['token']

    @staticmethod
    def key() -> str:
        return 'gate-' + uuid.uuid4().hex


def check(name: str, condition: bool, evidence) -> None:
    RESULTS.append({'check': name, 'pass': bool(condition), 'evidence': evidence})
    print(('PASS  ' if condition else 'FAIL  ') + name + ('' if condition else f'  -> {evidence}'))


def task_payload() -> dict:
    start = dt.datetime.now(dt.timezone.utc).replace(microsecond=0) + dt.timedelta(days=1)
    return {'title': f'映射门禁任务-{RUN}', 'description': '门禁核验', 'priority': 'medium', 'allDay': False,
            'startAt': start.isoformat().replace('+00:00', 'Z'),
            'dueAt': (start + dt.timedelta(days=1)).isoformat().replace('+00:00', 'Z'),
            'assigneeIds': []}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:18220')
    parser.add_argument('--password', default='Demo@123456')
    parser.add_argument('--order', choices=('teams-first', 'employees-first'), default='teams-first',
                        help='Which mapping completes last; both orders must release the gate (V-009)')
    parser.add_argument('--output', type=Path, default=None)
    args = parser.parse_args()
    api = Api(args.base_url, args.password)

    for _ in range(30):
        try:
            api.login('admin')
            break
        except SystemExit:
            import time
            time.sleep(1)
    admin = api.tokens.get('admin')
    employee = api.login('employee')

    _, me, _ = api.call('GET', '/api/v1/me', employee)
    payload = task_payload()
    payload['assigneeIds'] = [me['id']]
    status, refused, _ = api.call('POST', '/api/v1/tasks', employee, payload, Api.key())
    check('V-005 an unmapped V4 database refuses a formal task write',
          status == 409 and refused.get('code') == 'ORGANIZATION_MAPPING_INCOMPLETE',
          {'status': status, 'body': refused})
    status, home_refused, _ = api.call('POST', '/api/v1/home/items', employee,
                                       {'kind': 'personal', 'body': '映射未完成时的业务写'}, Api.key())
    check('V-005 the gate covers ordinary business writes beyond tasks',
          status == 409 and home_refused.get('code') == 'ORGANIZATION_MAPPING_INCOMPLETE',
          {'status': status, 'body': home_refused})

    status, structure, _ = api.call('GET', '/api/v1/admin/organization', admin)
    constraints = structure.get('constraints', {})
    check('V-005 the console still reads and reports the open mapping blockers',
          status == 200 and constraints.get('formalWritesReady') is False
          and constraints.get('usersMissingDepartment', 0) > 0,
          constraints)

    status, department, _ = api.call('POST', '/api/v1/admin/departments', admin,
                                     {'name': f'迁移补齐部-{RUN}'}, Api.key())
    department_id = department.get('departmentId')
    status_pos, position, _ = api.call('POST', '/api/v1/admin/positions', admin,
                                       {'name': f'迁移补齐职位-{RUN}', 'sortOrder': 1}, Api.key())
    position_id = position.get('positionId')
    check('V-005 an administrator can still create the missing department and position',
          status == 200 and status_pos == 200 and department_id and position_id,
          {'department': department, 'position': position})

    # Every legacy relation is mapped by an explicit administrator choice; the script never derives a
    # department from a team's old name. Both completion orders must release the gate: when employees
    # are mapped first their legacy team may still be unmapped, so they are explicitly detached from it
    # before the teams are mapped (V-009).
    def map_teams() -> None:
        _, current, _ = api.call('GET', '/api/v1/admin/organization', admin)
        for team in current.get('teams', []):
            if team.get('departmentId'):
                continue
            version = team.get('rowVersion', 1)
            patch_status, patch_body, _ = api.call('PATCH', f"/api/v1/admin/teams/{team['id']}", admin,
                                                   {'departmentId': department_id}, Api.key(), f'"{version}"')
            if patch_status != 200:
                check('V-005 the console can map every team', False,
                      {'teamId': team['id'], 'status': patch_status, 'body': patch_body})
                break

    def map_employees(detach_teams: bool) -> None:
        _, employees, _ = api.call('GET', '/api/v1/admin/employees?limit=200', admin)
        mapped = 0
        for row in employees.get('items', []):
            need_department = not row.get('departmentId')
            need_position = not row.get('positionId')
            if not (need_department or need_position):
                continue
            _, _, headers = api.call('GET', f"/api/v1/admin/employees/{row['id']}", admin)
            body = {}
            if need_department:
                body['departmentId'] = department_id
            if need_position:
                body['positionId'] = position_id
            if detach_teams and row.get('teamId'):
                body['teamId'] = None
            patch_status, patch_body, _ = api.call('PATCH', f"/api/v1/admin/employees/{row['id']}", admin,
                                                   body, Api.key(), headers.get('ETag'))
            if patch_status == 200:
                mapped += 1
            else:
                check('V-005 the console can map every employee', False,
                      {'userId': row['id'], 'status': patch_status, 'body': patch_body})
        check('V-005 the console maps the unmapped employees without SQL', mapped > 0, {'mapped': mapped})

    if args.order == 'teams-first':
        map_teams()
        map_employees(detach_teams=False)
    else:
        map_employees(detach_teams=True)
        map_teams()
    _, team_structure, _ = api.call('GET', '/api/v1/admin/organization', admin)
    check('V-005 every team receives a real department through the console',
          all(team.get('departmentId') for team in team_structure.get('teams', [])),
          {'teams': team_structure.get('teams', [])})

    _, final_structure, _ = api.call('GET', '/api/v1/admin/organization', admin)
    final = final_structure.get('constraints', {})
    check('V-009 both mapping completion orders resolve blockers and tighten without another edit',
          final.get('formalWritesReady') is True and final.get('usersMissingDepartment') == 0
          and final.get('teamsMissingDepartment') == 0 and final.get('mappingBlockers') == 0
          and final.get('tighteningApplied') is True,
          {'order': args.order, **final})

    status, created, _ = api.call('POST', '/api/v1/tasks', employee,
                                  {**task_payload(), 'assigneeIds': [me['id']]}, Api.key())
    check('V-005/V-009 the same formal task write succeeds after the mapping is cleared',
          status == 201 and created.get('taskId'), {'status': status, 'body': created})
    status, home_allowed, _ = api.call('POST', '/api/v1/home/items', employee,
                                       {'kind': 'personal', 'body': '映射完成后的业务写'}, Api.key())
    check('V-005 ordinary business writes resume together with tasks', status == 200,
          {'status': status, 'body': home_allowed})
    status, repair_still_open, _ = api.call('POST', '/api/v1/admin/departments', admin,
                                            {'name': f'映射完成后部门-{RUN}'}, Api.key())
    check('V-005 the administration repair path stays available', status == 200,
          {'status': status, 'body': repair_still_open})

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
