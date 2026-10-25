#!/usr/bin/env python3
"""HTTP verification for the organization/administration surface (tasks 2.1-2.7).

Runs against a live backend on a scratch database seeded with ``PANDORA_SEED=true``. Every check
prints PASS/FAIL and the whole run is written as JSON evidence.

    python3 scripts/check_organization_admin.py --base-url http://127.0.0.1:18091
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
import threading
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
             key: str | None = None, if_match: str | None = None, raw: bool = False):
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
                if raw:
                    return response.status, {'raw': payload}, dict(response.headers)
                return response.status, (json.loads(payload) if payload else {}), dict(response.headers)
        except urllib.error.HTTPError as error:
            payload = error.read().decode()
            try:
                parsed = json.loads(payload) if payload else {}
            except json.JSONDecodeError:
                parsed = {'raw': payload}
            return error.code, parsed, dict(error.headers)

    def login(self, username: str, password: str | None = None):
        status, body, _ = self.call('POST', '/api/v1/auth/sessions',
                                    body={'username': login_identity(username), 'password': password or self.password})
        if status != 200:
            raise SystemExit(f'login failed for {username}: {status} {body}')
        self.tokens[username] = body['token']
        return body

    def token(self, username: str) -> str:
        return self.tokens.get(username) or self.login(username)['token']

    @staticmethod
    def key() -> str:
        return 'check-' + uuid.uuid4().hex


def check(name: str, condition: bool, evidence) -> None:
    RESULTS.append({'check': name, 'pass': bool(condition), 'evidence': evidence})
    print(('PASS  ' if condition else 'FAIL  ') + name + ('' if condition else f'  -> {evidence}'))


def structure(api: Api) -> dict:
    _, body, _ = api.call('GET', '/api/v1/admin/organization', api.token('admin'))
    return body


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:18091')
    parser.add_argument('--password', default='Demo@123456')
    parser.add_argument('--output', type=Path, default=None)
    args = parser.parse_args()
    api = Api(args.base_url, args.password)

    for who in ('admin', 'upper', 'middle', 'employee', 'colleague', 'marketing'):
        api.login(who)

    # Captured before any write so the documented seed default is asserted on a genuinely fresh database.
    _, initial_company, _ = api.call('GET', '/api/v1/admin/company', api.token('admin'))

    # ---------------- 2.6 administration entry ----------------
    status, page, _ = api.call('GET', '/admin.html', raw=True)
    markup = page.get('raw', '')
    sections = ['员工', '部门', '职位', '团队', '角色与授权', '公司信息']
    check('2.6 the administration page is served from the build with every maintenance area',
          status == 200 and all(section in markup for section in sections),
          {'status': status, 'missing': [s for s in sections if s not in markup]})
    check('2.6 the role editor exposes independent view/dispatch scope selectors',
          'data-scope-type' in markup and 'data-save-scopes' in markup
          and '/scopes' in markup,
          {'hasSelectors': 'data-scope-type' in markup})

    # ---------------- 2.1 organization maintenance ----------------
    data = structure(api)
    departments = {d['name']: d for d in data.get('departments', [])}
    positions = {p['name']: p for p in data.get('positions', [])}
    teams = {t['name']: t for t in data.get('teams', [])}
    check('2.1 admin reads the organization structure',
          bool(departments) and bool(positions) and bool(teams),
          {'departments': list(departments), 'positions': list(positions), 'teams': list(teams)})

    status, body, _ = api.call('POST', '/api/v1/admin/departments', api.token('admin'),
                               {'name': f'质检部-{RUN}'}, Api.key())
    new_department = body.get('departmentId')
    check('2.1 admin creates a department', status == 200 and new_department, {'status': status, 'body': body})

    status, body, _ = api.call('POST', '/api/v1/admin/departments', api.token('admin'),
                               {'name': f'质检部-{RUN}'}, Api.key())
    check('2.1 a duplicate department name is rejected', status == 409, {'status': status, 'body': body})

    status, body, _ = api.call('POST', '/api/v1/admin/positions', api.token('admin'),
                               {'name': f'质检专员-{RUN}', 'sortOrder': 5}, Api.key())
    new_position = body.get('positionId')
    check('2.1 admin creates a position', status == 200 and new_position, {'status': status, 'body': body})

    status, body, _ = api.call('POST', '/api/v1/admin/departments', api.token('admin'),
                               {'name': f'循环部-{RUN}', 'parentId': new_department}, Api.key())
    child_department = body.get('departmentId')
    check('2.1 a department can be placed under another department',
          status == 200 and child_department, {'status': status, 'body': body})
    status, body, _ = api.call('PATCH', f'/api/v1/admin/departments/{new_department}', api.token('admin'),
                               {'parentId': child_department}, Api.key(), '"1"')
    check('2.1 a department hierarchy cycle is rejected', status == 400, {'status': status, 'body': body})

    status, body, _ = api.call('POST', '/api/v1/admin/employees', api.token('admin'),
                               {'username': f'qa1-{RUN}', 'displayName': '质检一号', 'positionId': new_position, 'level': 3},
                               Api.key())
    check('2.1 an employee without a department is rejected', status == 400, {'status': status, 'body': body})
    status, body, _ = api.call('POST', '/api/v1/admin/employees', api.token('admin'),
                               {'username': f'qa1-{RUN}', 'displayName': '质检一号', 'departmentId': new_department, 'level': 3},
                               Api.key())
    check('2.1 an employee without a position is rejected', status == 400, {'status': status, 'body': body})
    status, body, _ = api.call('POST', '/api/v1/admin/employees', api.token('admin'),
                               {'username': f'qa1-{RUN}', 'displayName': '质检一号', 'departmentId': new_department,
                                'positionId': new_position, 'level': 200}, Api.key())
    check('2.1 an out-of-range organization level is rejected', status == 400, {'status': status, 'body': body})

    product = departments['产品部']
    product_team = next((t for t in teams.values() if t.get('departmentName') == '产品部'), None)
    status, body, _ = api.call('POST', '/api/v1/admin/employees', api.token('admin'),
                               {'username': f'qa1-{RUN}', 'displayName': '质检一号', 'departmentId': new_department,
                                'positionId': new_position, 'teamId': product_team['id'], 'level': 3}, Api.key())
    check('2.1 a team outside the employee department is rejected', status == 400, {'status': status, 'body': body})

    status, body, _ = api.call('POST', '/api/v1/admin/employees', api.token('admin'),
                               {'username': f'staff-{RUN}', 'displayName': '甲方员工', 'departmentId': new_department,
                                'positionId': new_position, 'level': 0, 'roleCodes': ['admin']}, Api.key())
    check('2.1 a second administrator is rejected',
          status == 409 and body.get('code') == 'SECOND_ADMINISTRATOR', {'status': status, 'body': body})

    key = Api.key()
    qa1_phone = '134' + str(uuid.uuid4().int)[:8]
    payload = {'username': f'qa1-{RUN}', 'displayName': '质检一号', 'departmentId': new_department,
               'positionId': new_position, 'level': 3, 'roleCodes': ['employee'], 'phone': qa1_phone}
    status, created, _ = api.call('POST', '/api/v1/admin/employees', api.token('admin'), payload, key)
    new_user = created.get('userId')
    initial_password = created.get('initialPassword')
    check('2.1 admin creates an employee through the interface',
          status == 201 and new_user and initial_password, {'status': status, 'body': created})

    status, replay, _ = api.call('POST', '/api/v1/admin/employees', api.token('admin'), payload, key)
    check('2.1 a repeated request never re-displays the initial password',
          status == 201 and replay.get('userId') == new_user and 'initialPassword' not in replay,
          {'status': status, 'body': replay})

    status, session, _ = api.call('POST', '/api/v1/auth/sessions',
                                  body={'username': qa1_phone, 'password': initial_password})
    check('2.1 the generated initial password works and forces a change',
          status == 200 and session['user']['mustChangePassword'] is True,
          {'status': status, 'mustChangePassword': session.get('user', {}).get('mustChangePassword')})

    status, body, _ = api.call('POST', '/api/v1/admin/employees', api.token('admin'),
                               {'username': f'qa2-{RUN}', 'displayName': '质检二号', 'departmentId': new_department,
                                'positionId': new_position, 'level': 3, 'managerId': new_user,
                                'phone': '131' + str(uuid.uuid4().int)[:8]}, Api.key())
    qa2 = body.get('userId')
    _, qa2_detail, headers = api.call('GET', f'/api/v1/admin/employees/{qa2}', api.token('admin'))
    status, body, _ = api.call('PATCH', f'/api/v1/admin/employees/{new_user}', api.token('admin'),
                               {'managerId': qa2}, Api.key(), headers.get('ETag'))
    check('2.1 a management cycle is rejected', status == 400, {'status': status, 'body': body})

    status, employees, _ = api.call('GET', '/api/v1/admin/employees', api.token('admin'))
    qa1_row = next(item for item in employees['items'] if item['id'] == new_user)
    check('2.1 the employee directory reports contact presence without echoing the number',
          qa1_row.get('hasPhone') is True and 'phone' not in qa1_row, {'row': qa1_row})

    # ---------------- 2.2 independent view / dispatch ranges ----------------
    _, candidates, _ = api.call('GET', '/api/v1/assignee-candidates?purpose=edit', api.token('employee'))
    check('2.2 an employee may only dispatch to themselves',
          [item['username'] for item in candidates.get('items', [])] == ['employee'],
          {'items': [item['username'] for item in candidates.get('items', [])]})

    _, candidates, _ = api.call('GET', '/api/v1/assignee-candidates?purpose=edit', api.token('middle'))
    names = {item['username'] for item in candidates.get('items', [])}
    check('2.2 a department lead sees self and own-department staff only',
          'middle' in names and 'employee' in names and 'colleague' in names
          and 'marketing' not in names and 'upper' not in names, {'items': sorted(names)})

    status, body, _ = api.call('GET', '/api/v1/admin/organization', api.token('employee'))
    check('2.2 a business account has no administration access', status == 403, {'status': status})
    status, body, _ = api.call('POST', '/api/v1/admin/departments', api.token('middle'),
                               {'name': f'越权部门-{RUN}'}, Api.key())
    check('2.2 a middle manager cannot write organization data', status == 403, {'status': status})

    # ---------------- 2.2 configurable independent view / dispatch ranges (V-006) ----------------
    _, before_structure, _ = api.call('GET', '/api/v1/admin/organization', api.token('admin'))
    version_before = before_structure['organization']['authzVersion']
    replay_key = Api.key()
    status, replay_create, _ = api.call('POST', '/api/v1/home/items', api.token('upper'),
                                        {'kind': 'personal', 'body': '范围配置前的幂等样例'}, replay_key)
    check('2.2 a business write before the scope change succeeds', status == 200,
          {'status': status, 'body': replay_create})
    status, configured, _ = api.call('PATCH', '/api/v1/admin/roles/executive/scopes', api.token('admin'),
                                     {'scopes': {'task_view': 'company', 'task_dispatch': 'self',
                                                 'log_read': 'company', 'profile_read': 'company'}}, Api.key())
    check('2.2 the administrator configures company view with self-only dispatch',
          status == 200 and configured.get('scopes', {}).get('task_view') == 'company'
          and configured.get('scopes', {}).get('task_dispatch') == 'self',
          {'status': status, 'body': configured})
    _, after_structure, _ = api.call('GET', '/api/v1/admin/organization', api.token('admin'))
    executive_role = next(row for row in after_structure['roles'] if row['code'] == 'executive')
    check('2.2 the independent ranges persist and advance the authorization version',
          executive_role['scopes'].get('task_view') == 'company'
          and executive_role['scopes'].get('task_dispatch') == 'self'
          and after_structure['organization']['authzVersion'] > version_before,
          {'scopes': executive_role['scopes'], 'before': version_before,
           'after': after_structure['organization']['authzVersion']})
    status, replay_body, _ = api.call('POST', '/api/v1/home/items', api.token('upper'),
                                      {'kind': 'personal', 'body': '范围配置前的幂等样例'}, replay_key)
    check('2.2 an idempotent replay from before the scope change is rejected',
          status == 409 and replay_body.get('code') == 'AUTHORIZATION_CHANGED',
          {'status': status, 'body': replay_body})
    _, limited_candidates, _ = api.call('GET', '/api/v1/assignee-candidates?purpose=edit', api.token('upper'))
    check('2.2 the executive can now see company tasks but only dispatch to themselves',
          [row['username'] for row in limited_candidates.get('items', [])] == ['upper'],
          {'items': [row['username'] for row in limited_candidates.get('items', [])]})
    _, visible_tasks, _ = api.call('GET', '/api/v1/tasks?limit=100', api.token('upper'))
    check('2.2 the configured company view still returns the company task set',
          visible_tasks.get('total', 0) > 0, {'total': visible_tasks.get('total')})
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    _, employee_me, _ = api.call('GET', '/api/v1/me', api.token('employee'))
    # Chapter 3.1: a creation may now assign any active business member, so this attempt is accepted
    # and becomes the published task used to check that the narrower dispatch rule still guards the
    # modification of an existing task.
    status, allowed_create, _ = api.call('POST', '/api/v1/tasks', api.token('upper'),
                                         {'title': f'创建派发-{RUN}', 'description': '核验',
                                          'priority': 'medium', 'allDay': False,
                                          'startAt': now.isoformat().replace('+00:00', 'Z'),
                                          'dueAt': (now + dt.timedelta(days=1)).isoformat().replace('+00:00', 'Z'),
                                          'assigneeIds': [employee_me['id']]}, Api.key())
    check('3.1 a creation may assign an employee outside the old dispatch range',
          status == 201, {'status': status, 'body': allowed_create})
    dispatch_task = allowed_create.get('taskId')
    _, dispatch_detail, dispatch_headers = api.call('GET', f'/api/v1/tasks/{dispatch_task}', api.token('upper'))
    status, forbidden_change, _ = api.call('PATCH', f'/api/v1/tasks/{dispatch_task}', api.token('upper'),
                                           {'command': 'change', 'assigneeIds': [employee_me['id']],
                                            'reason': '越权修改派发'}, Api.key(), dispatch_headers.get('ETag'))
    check('2.2 modifying a published task stays inside the configured dispatch range',
          status == 403 and forbidden_change.get('code') == 'DISPATCH_NOT_ALLOWED',
          {'status': status, 'body': forbidden_change})
    status, admin_scope_body, _ = api.call('PATCH', '/api/v1/admin/roles/admin/scopes', api.token('admin'),
                                           {'scopes': {'task_view': 'self'}}, Api.key())
    check('2.2 the administrator role cannot be given employee business ranges', status == 400,
          {'status': status, 'body': admin_scope_body})
    status, restored, _ = api.call('PATCH', '/api/v1/admin/roles/executive/scopes', api.token('admin'),
                                   {'scopes': {'task_view': 'company', 'task_dispatch': 'company',
                                               'log_read': 'company', 'profile_read': 'company'}}, Api.key())
    _, restored_candidates, _ = api.call('GET', '/api/v1/assignee-candidates?purpose=edit', api.token('upper'))
    restored_names = {row['username'] for row in restored_candidates.get('items', [])}
    check('2.2 restoring the dispatch range restores the candidate set',
          status == 200 and 'employee' in restored_names,
          {'status': status, 'items': sorted(restored_names)})

    # ---------------- 2.3 log author range ----------------
    _, authors, _ = api.call('GET', '/api/v1/work-log-authors', api.token('middle'))
    author_names = {item['username'] for item in authors.get('items', [])}
    check('2.3 the log author filter is limited to self and direct reports',
          'middle' in author_names and 'employee' in author_names and 'colleague' in author_names
          and 'marketing' not in author_names and 'upper' not in author_names, {'authors': sorted(author_names)})

    status, peer_body, _ = api.call('POST', '/api/v1/admin/employees', api.token('admin'),
                                    {'username': f'peer-{RUN}', 'displayName': '同部门他人', 'departmentId': product['id'],
                                     'positionId': new_position, 'level': 3,
                                     'phone': '139' + str(uuid.uuid4().int)[:8]}, Api.key())
    peer = peer_body.get('userId')
    _, authors, _ = api.call('GET', '/api/v1/work-log-authors', api.token('middle'))
    check('2.3 a same-department non-report is excluded from the log filter',
          f'peer-{RUN}' not in {item['username'] for item in authors.get('items', [])},
          {'authors': sorted({item['username'] for item in authors.get('items', [])})})

    _, logs, _ = api.call('GET', '/api/v1/work-logs?scope=visible', api.token('middle'))
    check('2.3 the log list excludes the same-department non-report',
          peer not in {row['authorId'] for row in logs.get('items', [])},
          {'authors': sorted({row['authorId'] for row in logs.get('items', [])})})

    status, body, _ = api.call('GET', f'/api/v1/work-logs?authorId={peer}', api.token('middle'))
    check('2.3 a direct author filter outside the log range is refused', status == 404, {'status': status})

    status, body, _ = api.call('GET', f'/api/v1/work-logs?scope=visible&authorId={new_user}', api.token('middle'))
    check('2.3 an author outside the log range is refused even with a visible scope', status == 404,
          {'status': status, 'body': body})

    # ---------------- 2.4 teams ----------------
    status, body, _ = api.call('GET', '/api/v1/admin/organization', api.token('middle'))
    check('2.4 a middle manager has no administration console access', status == 403, {'status': status})

    status, team_a, _ = api.call('POST', '/api/v1/admin/teams', api.token('middle'),
                                 {'name': f'产品一组-{RUN}', 'departmentId': product['id']}, Api.key())
    check('2.4 an authorized department lead creates a team and becomes its lead',
          status == 200 and team_a.get('leadUserId'), {'status': status, 'body': team_a})

    _, team_b, _ = api.call('POST', '/api/v1/admin/teams', api.token('middle'),
                            {'name': f'产品二组-{RUN}', 'departmentId': product['id']}, Api.key())
    data = structure(api)
    in_product = [t['name'] for t in data['teams'] if t.get('departmentName') == '产品部']
    check('2.4 one department holds several independent teams',
          f'产品一组-{RUN}' in in_product and f'产品二组-{RUN}' in in_product, {'teams': in_product})

    status, body, _ = api.call('POST', '/api/v1/admin/teams', api.token('employee'),
                               {'name': f'越权团队-{RUN}', 'departmentId': product['id']}, Api.key())
    check('2.4 an unauthorized account cannot create a team', status == 403, {'status': status})

    _, marketing_department, _ = api.call('GET', '/api/v1/admin/organization', api.token('admin'))
    marketing = {d['name']: d for d in marketing_department['departments']}['市场部']
    status, body, _ = api.call('POST', '/api/v1/admin/teams', api.token('middle'),
                               {'name': f'市场越权团队-{RUN}', 'departmentId': marketing['id']}, Api.key())
    check('2.4 a department lead cannot create a team in another department', status == 403, {'status': status})

    employee_id = next(item['id'] for item in candidates['items'] if item['username'] == 'employee')
    team_row = next(t for t in structure(api)['teams'] if t['id'] == team_a['teamId'])
    status, body, _ = api.call('PATCH', f"/api/v1/admin/teams/{team_a['teamId']}", api.token('middle'),
                               {'leadUserId': employee_id}, Api.key(), f'"{team_row["rowVersion"]}"')
    check('2.4 the team lead can be transferred and persists',
          status == 200 and body.get('leadUserId') == employee_id, {'status': status, 'body': body})
    team_row = next(t for t in structure(api)['teams'] if t['id'] == team_a['teamId'])
    check('2.4 the transferred lead is stored', team_row['leadUserId'] == employee_id,
          {'leadUserId': team_row['leadUserId']})

    _, candidates, _ = api.call('GET', '/api/v1/assignee-candidates?purpose=edit', api.token('employee'))
    check('2.4 a team lead gains no dispatch authority from being lead',
          [item['username'] for item in candidates.get('items', [])] == ['employee'],
          {'items': [item['username'] for item in candidates.get('items', [])]})

    # ---------------- 2.5 transfer invalidates authority ----------------
    _, before, _ = api.call('GET', '/api/v1/admin/organization', api.token('admin'))
    version_before = before['organization']['authzVersion']
    _, peer_detail, headers = api.call('GET', f'/api/v1/admin/employees/{peer}', api.token('admin'))
    status, body, _ = api.call('POST', f'/api/v1/admin/employees/{peer}/transfer', api.token('admin'),
                               {'departmentId': new_department, 'positionId': new_position, 'level': 4,
                                'roleCodes': ['employee'], 'reason': '组织调整'}, Api.key(), headers.get('ETag'))
    check('2.5 a transfer persists and reports invalidation',
          status == 200 and body.get('authorizationInvalidated'), {'status': status, 'body': body})
    _, after, _ = api.call('GET', '/api/v1/admin/organization', api.token('admin'))
    version_after = after['organization']['authzVersion']
    check('2.5 the organization authorization version increased',
          version_after > version_before, {'before': version_before, 'after': version_after})

    _, candidates_after, _ = api.call('GET', '/api/v1/assignee-candidates?purpose=edit', api.token('middle'))
    check('2.5 the transfer removes the person from the old department range',
          f'peer-{RUN}' not in {item['username'] for item in candidates_after.get('items', [])},
          {'items': [item['username'] for item in candidates_after.get('items', [])]})

    _, moved_authors, _ = api.call('GET', '/api/v1/work-log-authors', api.token('middle'))
    check('2.5 the moved person stays outside the old department log range',
          f'peer-{RUN}' not in {item['username'] for item in moved_authors.get('items', [])},
          {'authors': sorted({item['username'] for item in moved_authors.get('items', [])})})

    # A stale form replayed with an out-of-date version must not take effect.
    current = next(d for d in structure(api)['departments'] if d['id'] == new_department)
    status, first, _ = api.call('PATCH', f'/api/v1/admin/departments/{new_department}', api.token('admin'),
                                {'name': f'质检部-{RUN}-改名'}, 'check-rename-' + uuid.uuid4().hex,
                                f'"{current["rowVersion"]}"')
    check('2.5 a structure change succeeds with the current version', status == 200,
          {'status': status, 'body': first})
    status, body, _ = api.call('PATCH', f'/api/v1/admin/departments/{new_department}', api.token('admin'),
                               {'name': f'质检部-{RUN}-再次改名'}, 'check-stale-' + uuid.uuid4().hex,
                               f'"{current["rowVersion"]}"')
    check('2.5 a stale structure form cannot bypass the new state', status == 412,
          {'status': status, 'body': body})

    # ---------------- 2.7 company information and off-work time ----------------
    status, company, _ = api.call('GET', '/api/v1/admin/company', api.token('admin'))
    check('2.7 a freshly seeded company uses the 18:00 all-day cut-off',
          str(initial_company.get('offWorkTime', '')).startswith('18:00'),
          {'initial': initial_company.get('offWorkTime'),
           'note': 'a different value means this run reused a database an earlier run already changed'})

    status, body, _ = api.call('PUT', '/api/v1/admin/company/off-work-time', api.token('admin'),
                               {'offWorkTime': '17:30'}, Api.key())
    check('2.7 the all-day cut-off can be set',
          status == 200 and str(body.get('offWorkTime')).startswith('17:30'), {'status': status, 'body': body})
    status, body, _ = api.call('PUT', '/api/v1/admin/company/off-work-time', api.token('admin'),
                               {'offWorkTime': '25:00'}, Api.key())
    check('2.7 an invalid cut-off is rejected', status == 400, {'status': status, 'body': body})

    created_items = []
    for index in range(10 - len(company.get('items', []))):
        status, body, _ = api.call('POST', '/api/v1/admin/company/items', api.token('admin'),
                                   {'title': f'补充公司信息{index}', 'body': '用于验证十条上限。'}, Api.key())
        if status == 200:
            created_items.append(body['id'])
    status, body, _ = api.call('POST', '/api/v1/admin/company/items', api.token('admin'),
                               {'title': '第十一条', 'body': '应被拒绝。'}, Api.key())
    check('2.7 the eleventh company item is rejected', status == 409, {'status': status, 'body': body})

    status, body, _ = api.call('POST', '/api/v1/admin/company/items', api.token('upper'),
                               {'title': '上层越权', 'body': '应被拒绝。'}, Api.key())
    check('2.7 a business account cannot maintain company information', status == 403, {'status': status})

    all_ids = [item['id'] for item in company.get('items', [])] + created_items
    reversed_ids = list(reversed(all_ids))
    status, body, _ = api.call('POST', '/api/v1/admin/company/items/reorder', api.token('admin'),
                               {'orderedIds': reversed_ids}, Api.key())
    check('2.7 company information can be reordered manually', status == 200, {'status': status, 'body': body})
    _, after_reorder, _ = api.call('GET', '/api/v1/admin/company', api.token('admin'))
    check('2.7 the manual order is persisted', after_reorder['items'][0]['id'] == reversed_ids[0],
          {'first': after_reorder['items'][0]['id'], 'expected': reversed_ids[0]})

    # concurrent limit: free exactly one slot, then two parallel creates must produce one row
    while True:
        _, current, _ = api.call('GET', '/api/v1/admin/company', api.token('admin'))
        if len(current['items']) <= 9:
            break
        victim = current['items'][0]
        api.call('DELETE', f"/api/v1/admin/company/items/{victim['id']}", api.token('admin'),
                 key=Api.key(), if_match=f'"{victim["rowVersion"]}"')
    outcomes = []

    def create_concurrently():
        outcomes.append(api.call('POST', '/api/v1/admin/company/items', api.tokens['admin'],
                                 {'title': '并发新增', 'body': '并发上限验证。'},
                                 'check-concurrent-' + uuid.uuid4().hex)[0])

    threads = [threading.Thread(target=create_concurrently) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    check('2.7 concurrent creation cannot exceed ten items',
          sorted(outcomes) == [200, 409], {'outcomes': outcomes})

    passed = sum(1 for result in RESULTS if result['pass'])
    print(f'\n{passed}/{len(RESULTS)} checks passed')
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps({
            'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
            'baseUrl': args.base_url,
            'passed': passed,
            'total': len(RESULTS),
            'results': RESULTS,
        }, ensure_ascii=False, indent=2) + '\n')
        print(f'wrote {args.output}')
    return 0 if passed == len(RESULTS) else 1


if __name__ == '__main__':
    raise SystemExit(main())
