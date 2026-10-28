#!/usr/bin/env python3
"""Real-service contract check for OpenSpec task 6.3.

This runner owns a disposable fixture database, prepares real business data through the public
API (plus explicit fixture-owned DB injections for notification timing and legacy authorization),
runs the real Chrome admin-console check, and cross-checks the same contract through direct API
calls. It never touches the normal development database.

    python3 backend/scripts/check_admin_contract.py

Evidence:
    audit/refactor-pandora-organization-and-workflows/admin-contract-check.json
    audit/refactor-pandora-organization-and-workflows/admin-contract-browser.json
    audit/refactor-pandora-organization-and-workflows/admin-browser.json (shared primary report)
    audit/refactor-pandora-organization-and-workflows/admin-contract-service.log
    audit/refactor-pandora-organization-and-workflows/admin-contract-browser-node.log

This file may write to its own random fixture only; it must not modify fixed_model_fixture.py.
"""
from __future__ import annotations

import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import uuid

from fixed_model_fixture import Fixture, PASSWORD, quote
from migration_precheck import BASE

AUDIT = BASE.parent / 'audit/refactor-pandora-organization-and-workflows'
REPORT_PATH = AUDIT / 'admin-contract-check.json'
BROWSER_REPORT_PATH = AUDIT / 'admin-browser.json'
CONTRACT_BROWSER_REPORT = AUDIT / 'admin-contract-browser.json'
SERVICE_LOG = AUDIT / 'admin-contract-service.log'
NODE_LOG = AUDIT / 'admin-contract-browser-node.log'
JAR = BASE / 'target/pandora-backend-0.1.0.jar'
ORG = 'fixture-company'

EXISTING_BROWSER_CHECKS = [
    'independent admin enters real management console',
    'retired role and manual manager controls are removed',
    'invalid final draft stays open with server error and no write',
    'cancel local draft restores saved positions',
    'browser saves full head swap with derived managers',
    'new employee is a local draft before final save',
    'new employee full plan returns one-time initial credential',
    'organization persists across browser reload without redisplaying credential',
    'founder inventory offers no deactivation control',
    'departure inventory includes completed work and pending unpublished creation',
    'browser commits completed responsibility takeover and employee deactivation',
    'admin account has independent account fields',
    'admin account save revokes console and requires new login',
    'renamed administrator logs in with same principal',
    'real admin interactions have no browser exceptions',
]
NEW_BROWSER_CHECKS = [
    'management console has no role/scope/rank/manual-manager editor',
    'position catalog is independent display metadata',
    'real employee identity is readable before the position rename',
    'admin creates a display position independently',
    'admin renames a display position independently',
    'renamed position is shown for assigned staff',
    'position rename keeps role, placement, manager and position id',
    'position rename changes no creation route or reviewer',
    'legacy role data and the new position name do not grant admin access',
    'employee token is refused by GET /admin/users',
    'employee token is refused by POST /admin/positions',
    'employee token is refused by GET /admin/notifications',
    'administrator still calls management APIs normally',
    'employee credentials cannot enter the admin console',
    'company info shows exactly ten managed entries',
    'company info admin order matches the managed list',
    'App reads company info in the same admin order',
    'admin reorders company info through the real console',
    'admin and App read the reordered company info identically',
    'eleventh company entry is refused at the ten-item limit',
    'notification management loads real notification rows',
    'notification management shows real withdrawn and unread statuses',
    'browser withdraws a real notification strictly under 180 seconds',
    'withdrawn notification keeps a placeholder and removes its withdraw action',
    'browser refuses notification withdrawal at or after 180 seconds',
    'closed-window notification remains unread and withdrawable',
    'admin task history lists real tasks',
    'admin task history opens complete real operation history',
]


def main() -> int:
    report: dict = {
        'updated': dt.datetime.now(dt.timezone.utc).isoformat(),
        'task': '6.3 admin console and notification contract',
        'checks': [],
    }

    def check(name: str, condition: bool, evidence=None) -> None:
        report['checks'].append({'check': name, 'pass': bool(condition), 'evidence': evidence})
        print(('PASS  ' if condition else 'FAIL  ') + name + ('' if condition else f'  -> {evidence}'))

    if not JAR.is_file():
        check('built backend JAR is available', False, str(JAR))
        return finish(report)
    fixture = Fixture(port=18183)
    fixture.log_path = SERVICE_LOG
    try:
        with fixture as f:
            run_checks(f, check, report)
    except Exception as error:  # noqa: BLE001 - the report must always record the real failure
        check('fixture-backed admin contract run completes', False, f'{type(error).__name__}: {error}')
    check('real fixture service log was produced', SERVICE_LOG.is_file(), str(SERVICE_LOG))
    return finish(report)


def finish(report: dict) -> int:
    report['result'] = 'PASS' if report['checks'] and all(row['pass'] for row in report['checks']) else 'FAIL'
    report['passed'] = sum(1 for row in report['checks'] if row['pass'])
    report['failed'] = sum(1 for row in report['checks'] if not row['pass'])
    AUDIT.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(f"\n{report['result']}: {report['passed']} passed, {report['failed']} failed -> {REPORT_PATH}")
    return 0 if report['result'] == 'PASS' else 1


def run_checks(f: Fixture, check, report: dict) -> None:
    check('disposable fixture service is healthy and seeded', bool(f.identities), {'identities': sorted(f.identities)})
    tokens = {key: f.login(key)[1]['token'] for key in (
        'admin', 'founder', 'beta-one-head', 'alpha-two-head', 'alpha-two-employee', 'alpha-one-employee', 'beta-one-employee')}
    ids = {key: value['id'] for key, value in f.identities.items()}
    admin = tokens['admin']

    def call(method: str, path: str, body=None, who: str = 'founder', version=None, key: str | None = None):
        status, result = f.call(method, path, body, tokens[who], key or 'contract-' + uuid.uuid4().hex, version)
        if status not in (200, 201):
            raise AssertionError((path, status, result.get('code'), result.get('message')))
        return result

    def raw(method: str, path: str, body=None, who: str = 'founder'):
        return f.call(method, path, body, tokens[who], 'contract-' + uuid.uuid4().hex)

    def sql_rows(query: str):
        return f.db.rows(query)

    def sql_one(query: str):
        rows = sql_rows(query)
        return rows[0] if rows else None

    def scalar(query: str, default: int = 0) -> int:
        row = sql_one(query)
        return default if not row or row[0] in (None, 'NULL') else int(row[0])

    def history_count(task_id: str) -> int:
        return scalar("SELECT COUNT(*) FROM task_history_entries WHERE organization_id=" + quote(ORG)
                      + " AND task_id=" + quote(task_id))

    def set_event_age(event_id: str, seconds: int) -> None:
        f.db.server_side("UPDATE domain_events SET occurred_at=UTC_TIMESTAMP(6)-INTERVAL " + str(seconds)
                         + " SECOND WHERE organization_id=" + quote(ORG) + " AND id=" + quote(event_id))

    def event_age_ms(event_id: str) -> int:
        return scalar("SELECT TIMESTAMPDIFF(MICROSECOND,occurred_at,UTC_TIMESTAMP(6)) FROM domain_events "
                      "WHERE organization_id=" + quote(ORG) + " AND id=" + quote(event_id)) // 1000

    def event_row(event_id: str):
        return f.db.rows("SELECT id,event_type,request_id,task_id,task_version_id,object_type,object_id,title,"
                         "change_summary,revoked_at,revocation_reason FROM domain_events WHERE organization_id="
                         + quote(ORG) + " AND id=" + quote(event_id))[0]

    now = dt.datetime.now(dt.timezone.utc)
    zone = dt.timezone(dt.timedelta(hours=8))
    day = (now.astimezone(zone) + dt.timedelta(days=3)).date()

    def instant(offset: int, hour: int = 0) -> str:
        return dt.datetime.combine(day + dt.timedelta(days=offset), dt.time(hour), zone).isoformat()

    def form(title: str, owners: list[str]) -> dict:
        return {'title': title, 'description': 'Contract acceptance real task', 'priority': 'medium',
                'allDay': False, 'startAt': instant(0, 9), 'dueAt': instant(3, 18),
                'assigneeIds': [ids[key] for key in owners]}

    # --- Legacy authorization data is injected in the fixture-owned database only. It must not be
    # --- read as current authority; the fixed placement stays the only source of business rights.
    user_columns = {row[0] for row in sql_rows(
        "SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() "
        "AND table_name='users'")}
    legacy_code = 'legacy_executive'
    if 'role' in user_columns:
        f.db.server_side("UPDATE users SET role='upper' WHERE organization_id=" + quote(ORG)
                         + " AND id=" + quote(ids['beta-one-head']))
    if 'rank_level' in user_columns:
        f.db.server_side("UPDATE users SET rank_level=1 WHERE organization_id=" + quote(ORG)
                         + " AND id=" + quote(ids['beta-one-head']))
    f.db.server_side("INSERT IGNORE INTO roles(id,organization_id,code,name,administrator,system_role) VALUES("
                     + ','.join([quote('fixture-legacy-executive'), quote(ORG), quote(legacy_code),
                                 quote('Legacy Executive'), '0', '1']) + ')')
    for capability in ('manage_organization', 'manage_accounts', 'manage_company_info',
                       'manage_notifications', 'view_task_history'):
        f.db.server_side("INSERT IGNORE INTO role_capabilities(organization_id,role_id,capability) VALUES("
                         + ','.join([quote(ORG), quote('fixture-legacy-executive'), quote(capability)]) + ')')
    for scope in ('task_view', 'task_dispatch', 'log_read', 'profile_read'):
        f.db.server_side("INSERT IGNORE INTO role_scopes(organization_id,role_id,scope_type,scope_level) VALUES("
                         + ','.join([quote(ORG), quote('fixture-legacy-executive'), quote(scope), quote('company')]) + ')')
    f.db.server_side("INSERT IGNORE INTO user_role_grants(organization_id,user_id,role_id,granted_by) VALUES("
                     + ','.join([quote(ORG), quote(ids['beta-one-head']), quote('fixture-legacy-executive'),
                                 quote(ids['founder'])]) + ')')
    legacy_grants = scalar("SELECT COUNT(*) FROM user_role_grants WHERE organization_id=" + quote(ORG)
                           + " AND user_id=" + quote(ids['beta-one-head']))
    legacy_scopes = scalar("SELECT COUNT(*) FROM role_scopes WHERE organization_id=" + quote(ORG)
                           + " AND role_id='fixture-legacy-executive' AND scope_level='company'")
    check('legacy company-wide authorization rows exist in the fixture',
          legacy_grants >= 1 and legacy_scopes == 4, {'grants': legacy_grants, 'companyScopes': legacy_scopes})

    # --- Retired admin writes stay retired through the direct API as well as the removed console UI.
    status, body = raw('GET', '/admin/roles', None, 'admin')
    check('GET /admin/roles is retired with 410', status == 410 and body.get('code') == 'ROLE_AUTHORIZATION_RETIRED',
          {'status': status, 'code': body.get('code')})
    status, body = raw('POST', '/admin/employees/' + ids['beta-one-head'] + '/roles', {'roleCodes': ['executive']}, 'admin')
    check('POST /admin/employees/{id}/roles is retired with 410',
          status == 410 and body.get('code') == 'ROLE_AUTHORIZATION_RETIRED', {'status': status, 'code': body.get('code')})
    status, body = raw('POST', '/admin/departments', {'name': 'Illegal Direct Department'}, 'admin')
    check('direct department creation requires the complete organization plan',
          status == 410 and body.get('code') == 'ORGANIZATION_PLAN_REQUIRED', {'status': status, 'code': body.get('code')})

    # --- A real employee's /me and creation route before the display-position rename.
    me_before = call('GET', '/me', who='beta-one-head')
    preview_before = call('POST', '/tasks/reviewer-preview', {'operation': 'create'}, 'beta-one-head')
    check('legacy role/rank rows do not change the fixed /me identity',
          me_before.get('role') == 'team_head' and me_before.get('placementType') == 'team_head'
          and me_before.get('managerId') == ids['beta-head'], {
              'role': me_before.get('role'), 'placementType': me_before.get('placementType'),
              'managerId': me_before.get('managerId'), 'positionId': me_before.get('positionId')})
    check('creation reviewer is the real direct manager before the position rename',
          preview_before.get('reviewerId') == ids['beta-head'], {
              'reviewerId': preview_before.get('reviewerId'), 'basis': preview_before.get('route', {}).get('basisAssigneeId')})

    # --- Company information: ten real rows, the eleventh refused, admin and App read the same order.
    for index in range(10):
        call('POST', '/admin/company/items', {'title': f'Company Notice {index + 1:02d}',
                                              'body': f'Real company information item {index + 1:02d}'}, 'admin')
    status, body = raw('POST', '/admin/company/items', {'title': 'Company Notice 11', 'body': 'Eleventh item'}, 'admin')
    check('sequential eleventh company item is refused with HOME_ITEM_LIMIT',
          status == 409 and body.get('code') == 'HOME_ITEM_LIMIT', {'status': status, 'code': body.get('code')})
    company = call('GET', '/admin/company', who='admin')
    company_titles = [item['title'] for item in company.get('items', [])]
    home_before = call('GET', '/home', who='founder')
    app_titles = [item['title'] for item in home_before.get('companyItems', [])]
    check('company information is capped at ten and admin/App order agree',
          company.get('limit') == 10 and len(company_titles) == 10 and app_titles == company_titles,
          {'limit': company.get('limit'), 'adminTitles': company_titles, 'appTitles': app_titles})

    # --- Real completed departure work and unpublished departure creation (preserves the existing
    # --- admin-browser inventory/departure checks).
    completed = call('POST', '/tasks', form('Completed departure work', ['alpha-two-employee']), 'alpha-two-employee')
    request = call('GET', '/approval-requests/' + completed['requestId'], who='alpha-two-head')
    call('PATCH', '/approval-requests/' + completed['requestId'], {'decision': 'approve'},
         'alpha-two-head', request['rowVersion'])
    view = call('GET', '/tasks/' + completed['taskId'], who='alpha-two-employee')
    call('PATCH', '/tasks/' + completed['taskId'],
         {'command': 'complete', 'completionNote': 'Finished before departure'},
         'alpha-two-employee', view['rowVersion'])
    unpublished = call('POST', '/tasks', form('Unpublished departure creation', ['beta-one-employee']), 'alpha-two-employee')
    check('real departure work and unpublished creation are prepared',
          bool(completed.get('taskId')) and bool(unpublished.get('requestId')))

    # --- Three real approval-request events, each with a real notification copy. Times are adjusted
    # --- only through the fixture-owned database; 179.x / 180 boundary is evaluated by the service.
    notification_specs = {
        'pass': 'Contract window open',
        'closed': 'Contract window closed',
        'edge': 'Contract window edge 179',
    }
    notification_rows: dict[str, dict] = {}
    for key, title in notification_specs.items():
        created = call('POST', '/tasks', form(title, ['beta-one-employee']), 'alpha-one-employee')
        event = f.db.rows("SELECT id,event_type,request_id,task_id,task_version_id,object_type,object_id,title,"
                          "change_summary,expires_at FROM domain_events WHERE organization_id=" + quote(ORG)
                          + " AND request_id=" + quote(created['requestId'])
                          + " ORDER BY created_at DESC,id DESC LIMIT 1")[0]
        notification_id = uuid.uuid4().hex
        summary = event[8] if event[8] not in (None, 'NULL') else title
        f.db.server_side("INSERT INTO notifications(id,organization_id,event_id,recipient_id,event_type,task_id,"
                         "summary,request_id,task_version_id,delivered_at,expires_at,source,readonly,title,"
                         "change_summary,relation_lost,content_masked,object_type,object_id,created_at) VALUES("
                         + ','.join([
                             quote(notification_id), quote(ORG), quote(event[0]), quote(ids['alpha-one-head']),
                             quote(event[1]), quote(event[3]), quote(summary), quote(event[2]),
                             quote(None if event[4] in (None, 'NULL') else event[4]),
                             'UTC_TIMESTAMP(6)', 'UTC_TIMESTAMP(6)+INTERVAL 3 MONTH', quote('event'), '0',
                             quote(title), quote(summary), '0', '0',
                             quote(None if event[5] in (None, 'NULL') else event[5]),
                             quote(None if event[6] in (None, 'NULL') else event[6]), 'UTC_TIMESTAMP(6)']) + ')')
        notification_rows[key] = {
            'eventId': event[0], 'notificationId': notification_id, 'title': title,
            'taskId': event[3], 'requestId': event[2], 'historyBefore': history_count(event[3]),
        }
    check('real approval requests and notification copies exist for boundary checks',
          all(row['eventId'] and row['taskId'] for row in notification_rows.values()),
          {key: {'eventId': row['eventId'], 'taskId': row['taskId']} for key, row in notification_rows.items()})

    # --- 179.x seconds is strictly inside the withdrawal window; remove one real copy through admin API.
    edge_age = None
    edge_status = edge_body = None
    for _ in range(3):
        set_event_age(notification_rows['edge']['eventId'], 179)
        edge_age = event_age_ms(notification_rows['edge']['eventId'])
        if 179000 <= edge_age < 179600:
            break
    edge_status, edge_body = raw('POST', '/admin/notifications/' + notification_rows['edge']['eventId'] + '/withdraw',
                                 {'reason': 'Contract 179 second boundary'}, 'admin')
    check('notification at 179.x seconds is withdrawable through the admin API',
          edge_status == 200 and edge_body.get('withdrawn') is True and edge_age is not None
          and 179000 <= edge_age < 180000, {'status': edge_status, 'ageMs': edge_age, 'body': edge_body})
    edge_event = event_row(notification_rows['edge']['eventId'])
    edge_copy = sql_one("SELECT summary,title,task_id,readonly FROM notifications WHERE event_id="
                        + quote(notification_rows['edge']['eventId']))
    edge_request = sql_one("SELECT status FROM approval_requests WHERE id="
                           + quote(notification_rows['edge']['requestId']))
    check('179.x withdrawal clears the copy but keeps the approval request and task history',
          edge_event[9] not in (None, 'NULL') and edge_copy[0] == '该通知已被撤回。'
          and edge_copy[1] in (None, 'NULL') and edge_copy[2] in (None, 'NULL') and edge_copy[3] == '1'
          and edge_request[0] == 'pending'
          and history_count(notification_rows['edge']['taskId']) == notification_rows['edge']['historyBefore'],
          {'revokedAt': edge_event[9], 'copy': edge_copy, 'requestStatus': edge_request[0],
           'historyBefore': notification_rows['edge']['historyBefore'],
           'historyAfter': history_count(notification_rows['edge']['taskId'])})
    check('withdrawal writes the immutable notification.withdrawn audit record', scalar(
        "SELECT COUNT(*) FROM audit_logs WHERE organization_id=" + quote(ORG)
        + " AND object_id=" + quote(notification_rows['edge']['eventId'])
        + " AND action='notification.withdrawn'") >= 1)
    history = call('GET', '/admin/tasks/' + notification_rows['edge']['taskId'] + '/history', who='admin')
    check('admin task history still opens after notification withdrawal',
          history.get('executionState') is not None and len(history.get('entries', [])) >= 1,
          {'entries': len(history.get('entries', [])), 'executionState': history.get('executionState')})

    # --- Exactly 180 seconds is outside the window.
    set_event_age(notification_rows['closed']['eventId'], 180)
    closed_age = event_age_ms(notification_rows['closed']['eventId'])
    closed_status, closed_body = raw('POST', '/admin/notifications/' + notification_rows['closed']['eventId'] + '/withdraw',
                                     {'reason': 'Contract 180 second boundary'}, 'admin')
    closed_event = event_row(notification_rows['closed']['eventId'])
    closed_copy = sql_one("SELECT summary,title,task_id FROM notifications WHERE event_id="
                          + quote(notification_rows['closed']['eventId']))
    closed_request = sql_one("SELECT status FROM approval_requests WHERE id="
                             + quote(notification_rows['closed']['requestId']))
    check('notification at 180 seconds is refused with WITHDRAW_WINDOW_CLOSED',
          closed_status == 409 and closed_body.get('code') == 'WITHDRAW_WINDOW_CLOSED' and closed_age >= 180000,
          {'status': closed_status, 'code': closed_body.get('code'), 'ageMs': closed_age})
    check('refused withdrawal leaves the event, copy and approval request untouched',
          closed_event[9] in (None, 'NULL')
          and closed_copy[1] == notification_rows['closed']['title'] and closed_request[0] == 'pending',
          {'revokedAt': closed_event[9], 'copy': closed_copy, 'requestStatus': closed_request[0]})

    # --- Employee direct API refuses every management surface; administrators still use them.
    for method, path, payload in (
            ('GET', '/admin/users', None),
            ('POST', '/admin/positions', {'name': 'Illegal Employee Position'}),
            ('GET', '/admin/notifications', None),
            ('GET', '/admin/company', None)):
        status, body = raw(method, path, payload, 'beta-one-head')
        check(f'employee token is refused by {method} {path}',
              status == 403 and body.get('code') == 'FORBIDDEN', {'status': status, 'code': body.get('code')})
    status, body = raw('GET', '/admin/users', None, 'admin')
    check('administrator can read the management employee list', status == 200, {'status': status})
    status, body = raw('GET', '/admin/notifications', None, 'admin')
    check('administrator can read notification management', status == 200, {'status': status})
    status, body = raw('GET', '/admin/company', None, 'admin')
    check('administrator can read company information', status == 200, {'status': status})

    # --- Employee pages never carry management endpoints; only admin.html is allowed to use them.
    root = BASE.parent
    employee_pages = [root / 'index.html'] + sorted(root.glob('潘多拉-*.js'))
    offenders = [page.name for page in employee_pages if '/api/v1/admin' in page.read_text(errors='ignore')]
    check('employee pages contain no management API path', not offenders, offenders)
    admin_markup = (root / 'admin.html').read_text()
    retired_markers = [marker for marker in ('角色与授权', 'updateRoleScopes', 'grantRoles', 'fManager', 'fLevel')
                       if marker in admin_markup]
    check('admin markup has no retired role/scope/rank/manual-manager editor', not retired_markers, retired_markers)

    # --- Real browser execution: position rename, company ordering, 179/180 UI withdrawal and the
    # --- complete pre-existing admin-browser suite in one run.
    set_event_age(notification_rows['pass']['eventId'], 0)
    manifest = {
        'base': f'http://127.0.0.1:{f.port}',
        'identities': f.identities,
        'tokens': {key: tokens[key] for key in ('admin', 'founder', 'beta-one-head')},
        'contract': {
            'position': {'id': 'fixture-company-title', 'oldName': 'Display title',
                         'newName': 'Browser Renamed Title'},
            'legacy': {'expectedRole': 'team_head'},
            'company': {'titles': company_titles},
            'notifications': {key: {'eventId': row['eventId'], 'notificationId': row['notificationId'],
                                    'title': row['title']}
                              for key, row in notification_rows.items()},
        },
    }
    node = None
    node_logs: list[str] = []
    browser_report: dict = {'checks': [], 'result': 'FAIL'}
    # A machine running several browser suites can lose the first CDP connection before any check
    # runs. Retry only an infrastructure failure with no recorded browser check; real assertion
    # failures are never hidden by a retry.
    for attempt in range(3):
        CONTRACT_BROWSER_REPORT.unlink(missing_ok=True)
        node = subprocess.run(['node', str(BASE / 'scripts/check_fixed_admin_browser.js')],
                              env={**os.environ, 'PANDORA_BROWSER_FIXTURE': json.dumps(manifest),
                                   'PANDORA_BROWSER_CONTRACT_REPORT': str(CONTRACT_BROWSER_REPORT)},
                              cwd=str(BASE / 'scripts'), capture_output=True, text=True)
        node_logs.append(f'--- attempt {attempt + 1} ---\n' + node.stdout + '\n--- STDERR ---\n' + node.stderr)
        try:
            browser_report = json.loads(CONTRACT_BROWSER_REPORT.read_text())
        except Exception as error:  # noqa: BLE001
            browser_report = {'checks': [], 'result': 'FAIL', 'error': str(error)}
        if node.returncode == 0 or browser_report.get('checks'):
            break
        if attempt < 2:
            time.sleep(2)
    NODE_LOG.write_text('\n'.join(node_logs))
    assert node is not None
    check('real Chrome admin browser suite exits successfully', node.returncode == 0, {
        'returncode': node.returncode, 'tail': (NODE_LOG.read_text())[-2000:]})
    browser_checks = {row['check']: bool(row['pass']) for row in browser_report.get('checks', [])}
    missing_existing = [name for name in EXISTING_BROWSER_CHECKS if not browser_checks.get(name)]
    missing_new = [name for name in NEW_BROWSER_CHECKS if not browser_checks.get(name)]
    check('browser report preserves every existing admin-browser check', not missing_existing, missing_existing)
    check('browser report ran every task 6.3 contract check', not missing_new, missing_new)
    check('browser report result is PASS', browser_report.get('result') == 'PASS', browser_report.get('result'))
    report['browser'] = browser_report

    # The preserved browser flow renames the administrator and revokes old sessions at the end.
    admin_status, admin_login = f.call('POST', '/auth/sessions', {
        'accountType': 'admin', 'accountName': 'browser-renamed-admin', 'password': PASSWORD}, None, None)
    if admin_status == 200:
        tokens['admin'] = admin_login['token']
    check('administrator re-authenticates after the preserved account-rename check',
          admin_status == 200 and bool(tokens.get('admin')), {'status': admin_status})

    # --- Post-browser assertions: the browser actions changed only display metadata and ordering.
    me_after = call('GET', '/me', who='beta-one-head')
    preview_after = call('POST', '/tasks/reviewer-preview', {'operation': 'create'}, 'beta-one-head')
    stable_fields = ('role', 'placementType', 'departmentId', 'teamId', 'positionId', 'managerId')
    stable = all(me_after.get(field) == me_before.get(field) for field in stable_fields)
    check('browser position rename left every authorization-relevant placement field unchanged',
          stable and me_after.get('positionName') == 'Browser Renamed Title', {
              'before': {field: me_before.get(field) for field in stable_fields + ('positionName',)},
              'after': {field: me_after.get(field) for field in stable_fields + ('positionName',)}})
    check('browser position rename left the creation reviewer and route basis unchanged',
          preview_after.get('reviewerId') == preview_before.get('reviewerId')
          and preview_after.get('route', {}).get('basisAssigneeId') == preview_before.get('route', {}).get('basisAssigneeId')
          and preview_after.get('requiresApproval') == preview_before.get('requiresApproval'),
          {'reviewerBefore': preview_before.get('reviewerId'), 'reviewerAfter': preview_after.get('reviewerId'),
           'basisBefore': preview_before.get('route', {}).get('basisAssigneeId'),
           'basisAfter': preview_after.get('route', {}).get('basisAssigneeId')})
    positions = {row[0]: row[1] for row in f.db.rows(
        "SELECT id,name FROM positions WHERE organization_id=" + quote(ORG))}
    created_position = any(name == 'Browser Catalog Analyst' for name in positions.values())
    check('browser created and renamed display positions without touching the placement id',
          positions.get('fixture-company-title') == 'Browser Renamed Title'
          and created_position
          and me_after.get('positionId') == 'fixture-company-title', positions)

    admin_company_after = call('GET', '/admin/company', who='admin')
    home_after = call('GET', '/home', who='founder')
    expected_titles = list(company_titles)
    expected_titles[8], expected_titles[9] = expected_titles[9], expected_titles[8]
    actual_admin_titles = [item['title'] for item in admin_company_after.get('items', [])]
    actual_app_titles = [item['title'] for item in home_after.get('companyItems', [])]
    check('browser reorder persists and the App reads the identical admin order',
          actual_admin_titles == expected_titles and actual_app_titles == expected_titles,
          {'expected': expected_titles, 'admin': actual_admin_titles, 'app': actual_app_titles})
    status, body = raw('POST', '/admin/company/items', {'title': 'Company Notice 11 again', 'body': 'Eleventh item'}, 'admin')
    check('eleventh company item is still refused after the browser reorder',
          status == 409 and body.get('code') == 'HOME_ITEM_LIMIT', {'status': status, 'code': body.get('code')})

    # --- Browser withdrawal and the 180+ refusal are proven against the same durable rows.
    pass_event = event_row(notification_rows['pass']['eventId'])
    pass_copy = sql_one("SELECT summary,title,task_id,readonly FROM notifications WHERE event_id="
                        + quote(notification_rows['pass']['eventId']))
    pass_request = sql_one("SELECT status FROM approval_requests WHERE id="
                           + quote(notification_rows['pass']['requestId']))
    pass_submitted = scalar("SELECT COUNT(*) FROM task_history_entries WHERE organization_id=" + quote(ORG)
                            + " AND task_id=" + quote(notification_rows['pass']['taskId'])
                            + " AND entry_type='request_submitted'")
    check('browser under-180 withdrawal clears the copy but keeps the approval request and task history',
          pass_event[9] not in (None, 'NULL') and pass_copy[0] == '该通知已被撤回。'
          and pass_copy[1] in (None, 'NULL') and pass_copy[2] in (None, 'NULL') and pass_copy[3] == '1'
          and pass_request[0] == 'pending' and pass_submitted >= 1
          and history_count(notification_rows['pass']['taskId']) >= notification_rows['pass']['historyBefore'],
          {'revokedAt': pass_event[9], 'copy': pass_copy, 'requestStatus': pass_request[0],
           'requestSubmittedEntries': pass_submitted,
           'historyBefore': notification_rows['pass']['historyBefore'],
           'historyAfter': history_count(notification_rows['pass']['taskId'])})
    closed_event_after = event_row(notification_rows['closed']['eventId'])
    closed_copy_after = sql_one("SELECT summary,title,task_id FROM notifications WHERE event_id="
                                + quote(notification_rows['closed']['eventId']))
    check('browser 180+ refusal left the closed-window notification unrevoked and readable',
          closed_event_after[9] in (None, 'NULL')
          and closed_copy_after[1] == notification_rows['closed']['title'],
          {'revokedAt': closed_event_after[9], 'copy': closed_copy_after})
    check('browser withdrawal wrote its own immutable audit record', scalar(
        "SELECT COUNT(*) FROM audit_logs WHERE organization_id=" + quote(ORG)
        + " AND object_id=" + quote(notification_rows['pass']['eventId'])
        + " AND action='notification.withdrawn'") >= 1)

    report['environment'] = {
        'port': f.port,
        'serviceLog': str(SERVICE_LOG),
        'browserReport': str(CONTRACT_BROWSER_REPORT),
        'nodeLog': str(NODE_LOG),
        'browserChecks': len(browser_checks),
        'existingBrowserChecks': len(EXISTING_BROWSER_CHECKS),
        'newBrowserChecks': len(NEW_BROWSER_CHECKS),
    }


if __name__ == '__main__':
    sys.exit(main())
