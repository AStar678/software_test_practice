#!/usr/bin/env python3
"""HTTP verification for chapter 9: formal admin console task history, notification management,
restricted team management and the cross-surface isolation matrix (tasks 9.1-9.5).

Runs against a live backend on a scratch database seeded with ``PANDORA_SEED=true``. Every check
prints PASS/FAIL and the whole run is written as JSON evidence.

    CHECK_FIXED_TIME=2026-10-25T04:00:00Z CHECK_WORKER=true \
      ./scripts/run_check_isolated.sh python3 scripts/check_admin_console.py --base-url {base}
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

RESULTS: list[dict] = []
RUN = uuid.uuid4().hex[:6]

# Employees authenticate by phone number (chapter 2.1/2.3); demo accounts keep stable numbers.
DEMO_PHONE = {'upper': '13800000001', 'middle': '13800000002', 'market': '13800000003',
              'employee': '13800000004', 'colleague': '13800000005', 'marketing': '13800000006',
              'admin': 'admin'}


def login_identity(account: str) -> str:
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
        return 'chapter9-' + uuid.uuid4().hex


def check(name: str, condition: bool, evidence) -> None:
    RESULTS.append({'check': name, 'pass': bool(condition), 'evidence': evidence})
    print(('PASS  ' if condition else 'FAIL  ') + name + ('' if condition else f'  -> {evidence}'))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:18091')
    parser.add_argument('--password', default='Demo@123456')
    parser.add_argument('--output', type=Path, default=None)
    args = parser.parse_args()
    api = Api(args.base_url, args.password)

    for who in ('admin', 'upper', 'middle', 'employee', 'colleague', 'marketing'):
        api.login(who)
    admin = api.token('admin')

    employees = api.call('GET', '/api/v1/admin/employees', admin)[1].get('items', [])
    by_username = {row['username']: row for row in employees}
    ids = {name: row['id'] for name, row in by_username.items()}
    middle_id = ids['middle']
    employee_id = ids['employee']
    colleague_id = ids['colleague']

    def employee_detail(person_id: str):
        status, body, headers = api.call('GET', f'/api/v1/admin/employees/{person_id}', admin)
        return status, body, headers

    def set_reviewer_available(person_id: str, available: bool):
        _, detail, headers = employee_detail(person_id)
        return api.call('PATCH', f'/api/v1/admin/employees/{person_id}', admin,
                        {'reviewerAvailable': available}, Api.key(), headers.get('ETag'))

    def decide(request_id: str, decision: str, comment: str, viewer: str = 'middle'):
        """Decide as the recorded reviewer while reading the request as a real participant.

        The administrator has no business authority over applications (canSeeRequest returns false),
        so the read must use an applicant/reviewer session; the write then uses the reviewer of record.
        """
        viewer_token = api.token(viewer)
        status, body, headers = api.call('GET', f'/api/v1/approval-requests/{request_id}', viewer_token)
        if status != 200:
            return status, body
        reviewer = body.get('reviewerId') or body.get('currentReviewerId')
        token = next((api.tokens[name] for name, person in ids.items() if person == reviewer), None)
        if token is None:
            return 404, {'code': 'REVIEWER_SESSION_MISSING', 'reviewerId': reviewer}
        return api.call('PATCH', f'/api/v1/approval-requests/{request_id}', token,
                        {'decision': decision, 'comment': comment}, Api.key(), headers.get('ETag'))[:2]

    def admin_tasks(params: str = 'limit=100'):
        status, body, _ = api.call('GET', '/api/v1/admin/tasks?' + params, admin)
        return status, body

    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)

    # ---------------- 9.1 administrator task locator ----------------
    status, listing = admin_tasks()
    items = listing.get('items', [])
    serialized = json.dumps(listing, ensure_ascii=False)
    check('9.1 the administrator locates company tasks through the dedicated paged interface',
          status == 200 and listing.get('total', 0) >= 12 and items, {'status': status, 'total': listing.get('total')})
    check('9.1 the locator returns a minimum projection with ordered assignee and creator names',
          all('ownerNames' in row and 'creatorName' in row and 'published' in row for row in items)
          and any(row.get('ownerNames') for row in items),
          {'sample': {key: items[0].get(key) for key in ('taskId', 'title', 'ownerNames', 'creatorName')} if items else None})
    check('9.1 the task locator exposes no phone, e-mail or password field',
          not any(marker in serialized for marker in ('"phone"', '"email"', '"password"', '"loginPhone"')),
          {'bytes': len(serialized)})
    for who in ('employee', 'upper', 'middle'):
        status, body, _ = api.call('GET', '/api/v1/admin/tasks?limit=10', api.token(who))
        check(f'9.1 a business account ({who}) is refused by the task locator', status == 403,
              {'status': status, 'body': body})
    status_page_one = admin_tasks('limit=5&offset=0')[1]
    status_page_two = admin_tasks('limit=5&offset=5')[1]
    page_one = [row['taskId'] for row in status_page_one.get('items', [])]
    page_two = [row['taskId'] for row in status_page_two.get('items', [])]
    check('9.1 pagination is stable and does not repeat a task across pages',
          len(page_one) == 5 and len(page_two) == 5 and not set(page_one) & set(page_two)
          and status_page_two.get('nextOffset') == 10,
          {'pageOne': page_one, 'pageTwo': page_two, 'nextOffset': status_page_two.get('nextOffset')})
    status, filtered, _ = api.call('GET', '/api/v1/admin/tasks?q=' + urllib.parse.quote('上线素材'), admin)
    check('9.1 the name filter narrows the result without hiding the matching row',
          status == 200 and filtered.get('total') == 1
          and filtered['items'][0]['title'] == '上线素材校对',
          {'status': status, 'total': filtered.get('total')})
    status, doing, _ = api.call('GET', '/api/v1/admin/tasks?state=doing&limit=100', admin)
    check('9.1 the execution-state filter only returns doing tasks',
          status == 200 and doing.get('items') and all(row['executionState'] == 'doing' for row in doing['items']),
          {'states': sorted({row['executionState'] for row in doing.get('items', [])})})
    status, unpublished, _ = api.call('GET', '/api/v1/admin/tasks?q=' + urllib.parse.quote('待创建审核'), admin)
    pending_row = next((row for row in unpublished.get('items', []) if not row['published']), None)
    check('9.1 an unpublished creation can be located with its pending request',
          status == 200 and pending_row is not None and pending_row.get('pendingRequestId')
          and pending_row.get('pendingKind') == 'create',
          {'row': pending_row})
    status, employee_tasks, _ = api.call('GET', '/api/v1/tasks?limit=100', api.token('employee'))
    employee_titles = {row['title'] for row in employee_tasks.get('items', [])}
    status, market_task, _ = api.call('GET', '/api/v1/admin/tasks?q=' + urllib.parse.quote('市场活动方案'), admin)
    check('9.1 the locator finds a task outside the employee visible set without widening that set',
          status == 200 and market_task.get('total') == 1 and '市场活动方案' not in employee_titles,
          {'employeeHasMarket': '市场活动方案' in employee_titles, 'total': market_task.get('total')})

    # ---------------- 9.2 complete operation history data ----------------
    created = api.call('POST', '/api/v1/tasks', api.token('middle'), {
        'title': f'控制台历史-{RUN}', 'description': '管理端历史核验', 'priority': 'medium', 'allDay': False,
        'assigneeIds': [employee_id],
        'startAt': (now + dt.timedelta(days=1)).isoformat().replace('+00:00', 'Z'),
        'dueAt': (now + dt.timedelta(days=3)).isoformat().replace('+00:00', 'Z'),
    }, Api.key())
    check('9.2 a task for the history scenario is created (its creation may need review)',
          created[0] in (200, 201), {'status': created[0], 'body': created[1]})
    task_id = created[1].get('taskId')
    if created[1].get('requestId'):
        decide(created[1]['requestId'], 'approve', f'历史场景创建审核-{RUN}', 'middle')

    # The creator (middle) changes the title and the ordered assignees.
    status, changed, headers = api.call('GET', f'/api/v1/tasks/{task_id}', api.token('middle'))
    status, change, _ = api.call('PATCH', f'/api/v1/tasks/{task_id}', api.token('middle'), {
        'command': 'change', 'title': f'控制台历史-{RUN}-改序',
        'assigneeIds': [colleague_id, employee_id], 'reason': f'调整负责人顺序-{RUN}'
    }, Api.key(), headers.get('ETag'))
    check('9.2 an ordered assignee change is accepted for review', status == 200,
          {'status': status, 'body': change})
    if change.get('requestId'):
        decide(change['requestId'], 'approve', f'历史场景改序审核-{RUN}', 'middle')

    status, history, _ = api.call('GET', f'/api/v1/admin/tasks/{task_id}/history', admin)
    entry_types = [entry['entryType'] for entry in history.get('entries', [])]
    order_entry = next((entry for entry in history['entries'] if entry['entryType'] == 'assignee_order'), None)
    check('9.2 the history records field values and the ordered assignee change',
          status == 200 and {'version_created', 'request_submitted', 'request_decided', 'assignee_order', 'field_change'} <= set(entry_types),
          {'entryTypes': sorted(set(entry_types))})
    check('9.2 the ordered change keeps both orders and resolves the real names',
          order_entry is not None and order_entry.get('detail', {}).get('beforeOrder')
          and order_entry.get('detail', {}).get('afterOrder')
          and history['people'].get(employee_id) == '张涛'
          and history['people'].get(colleague_id) == '赵蕾',
          {'entry': order_entry, 'people': {key: history['people'].get(key) for key in (employee_id, colleague_id)}})
    decided_entry = next((entry for entry in history['entries'] if entry['entryType'] == 'request_decided'
                           and f'历史场景改序审核-{RUN}' in json.dumps(entry, ensure_ascii=False)), None)
    check('9.2 the decision entry keeps the opinion text',
          decided_entry is not None and f'历史场景改序审核-{RUN}' in json.dumps(decided_entry, ensure_ascii=False),
          {'entry': decided_entry})
    version_order = next((version['assigneeIds'] for version in history['versions']
                          if version['status'] == 'applied' and version.get('versionNo', 0) > 1), None)
    check('9.2 the version rows keep the submitted assignee order',
          version_order == [colleague_id, employee_id], {'order': version_order})

    # A genuine exemption (the creator has no direct manager) must be readable with its reason.
    exempt_create = api.call('POST', '/api/v1/tasks', api.token('upper'), {
        'title': f'控制台免审-{RUN}', 'description': '免审历史核验', 'priority': 'low', 'allDay': False,
        'assigneeIds': [employee_id],
        'startAt': (now + dt.timedelta(days=2)).isoformat().replace('+00:00', 'Z'),
        'dueAt': (now + dt.timedelta(days=4)).isoformat().replace('+00:00', 'Z'),
    }, Api.key())
    exempt_task = exempt_create[1].get('taskId')
    status, exempt_history, _ = api.call('GET', f'/api/v1/admin/tasks/{exempt_task}/history', admin)
    exempt_entry = next((entry for entry in exempt_history.get('entries', []) if entry['entryType'] == 'no_reviewer'), None)
    check('9.2 a legal no-review route is shown with its recorded reason',
          status == 200 and exempt_entry is not None and exempt_entry.get('afterValue'),
          {'entry': exempt_entry, 'entryTypes': sorted({entry['entryType'] for entry in exempt_history.get('entries', [])})})

    # Reassignment: remove the reviewer's availability while a request is pending.
    status, detail_task, headers = api.call('GET', f'/api/v1/tasks/{task_id}', api.token('middle'))
    status, pending_change, _ = api.call('PATCH', f'/api/v1/tasks/{task_id}', api.token('middle'), {
        'command': 'change', 'title': f'控制台历史-{RUN}-改派前', 'reason': f'等待改派-{RUN}'
    }, Api.key(), headers.get('ETag'))
    pending_request = pending_change.get('requestId')
    check('9.2 a pending request exists before the organization change',
          status == 200 and pending_request, {'status': status, 'requestId': pending_request})
    set_reviewer_available(middle_id, False)
    status, reassigned_history, _ = api.call('GET', f'/api/v1/admin/tasks/{task_id}/history', admin)
    reassign_entry = next((entry for entry in reassigned_history.get('entries', [])
                           if entry['entryType'] == 'reviewer_reassigned'
                           and entry.get('requestId') == pending_request), None)
    reassign_row = next((row for row in reassigned_history.get('reassignments', [])
                         if row.get('requestId') == pending_request), None)
    check('9.2 a reviewer reassignment is recorded with both people and the reason',
          reassign_entry is not None and reassign_entry.get('beforeValue') and reassign_entry.get('afterValue')
          and reassign_row is not None and reassign_row.get('reason')
          and reassigned_history['people'].get(reassign_entry['beforeValue']) == '李敏',
          {'entry': reassign_entry, 'row': reassign_row})
    if pending_request:
        decide(pending_request, 'reject', f'改派后拒绝-{RUN}', 'middle')
    set_reviewer_available(middle_id, True)

    # Handover: one position moves from the employee to the colleague.
    status, detail_task, headers = api.call('GET', f'/api/v1/tasks/{task_id}', api.token('middle'))
    status, handover, _ = api.call('POST', f'/api/v1/tasks/{task_id}/handover', api.token('middle'), {
        'sourceUserId': employee_id, 'targetUserId': middle_id, 'reason': f'交接核验-{RUN}'
    }, Api.key(), headers.get('ETag'))
    check('9.2 a legal handover is accepted', status == 200, {'status': status, 'body': handover})
    if handover.get('requestId'):
        decide(handover['requestId'], 'approve', f'交接审核-{RUN}', 'middle')

    # Completion then reopen with the new schedule, so the history keeps both rounds.
    status, detail_task, headers = api.call('GET', f'/api/v1/tasks/{task_id}', api.token('colleague'))
    complete = api.call('PATCH', f'/api/v1/tasks/{task_id}', api.token('colleague'), {
        'command': 'complete', 'completionNote': f'完成待审-{RUN}'
    }, Api.key(), headers.get('ETag'))
    if complete[1].get('requestId'):
        decide(complete[1]['requestId'], 'approve', f'完成审核-{RUN}', 'colleague')
    status, detail_task, headers = api.call('GET', f'/api/v1/tasks/{task_id}', api.token('middle'))
    reopened = api.call('PATCH', f'/api/v1/tasks/{task_id}', api.token('middle'), {
        'command': 'reopen', 'reason': f'补充数据后重开-{RUN}', 'allDay': False,
        'startAt': (now + dt.timedelta(days=5)).isoformat().replace('+00:00', 'Z'),
        'dueAt': (now + dt.timedelta(days=7)).isoformat().replace('+00:00', 'Z'),
    }, Api.key(), headers.get('ETag'))
    if reopened[1].get('requestId'):
        decide(reopened[1]['requestId'], 'approve', f'重开审核-{RUN}', 'middle')

    status, final_history, _ = api.call('GET', f'/api/v1/admin/tasks/{task_id}/history', admin)
    final_types = {entry['entryType'] for entry in final_history.get('entries', [])}
    check('9.2 handover, completion and reopen are all traceable in the operation history',
          {'handover_requested', 'handover', 'reopen', 'completion_returned'}.issubset(final_types)
          or {'handover_requested', 'handover', 'reopen'}.issubset(final_types),
          {'entryTypes': sorted(final_types)})
    reopen_entry = next((entry for entry in final_history.get('entries', []) if entry['entryType'] == 'reopen'), None)
    check('9.2 the reopen entry keeps the round change and its recorded reason',
          reopen_entry is not None and reopen_entry.get('beforeValue') and reopen_entry.get('afterValue')
          and reopen_entry.get('detail', {}).get('reason'),
          {'entry': reopen_entry})
    serialized_history = json.dumps(final_history, ensure_ascii=False)
    check('9.2 the history payload exposes no contact or credential field',
          not any(marker in serialized_history for marker in ('"phone"', '"email"', '"password"')),
          {'bytes': len(serialized_history)})
    status, body, _ = api.call('GET', f'/api/v1/admin/tasks/{task_id}/history', api.token('employee'))
    check('9.2 an employee cannot read the complete operation history', status == 403,
          {'status': status, 'body': body})

    # Deliver notifications so a message copy can be deleted while the history stays intact.
    api.call('POST', '/api/v1/admin/worker/run-once', admin, {}, Api.key())
    status, notifications, _ = api.call('GET', '/api/v1/notifications?limit=100', api.token('employee'))
    related = [row for row in notifications.get('items', []) if row.get('taskId') == task_id]
    entries_before = len(final_history.get('entries', []))
    if related:
        target = related[0]
        status, body, headers = api.call('GET', f"/api/v1/notifications/{target['id']}", api.token('employee'))
        api.call('PATCH', f"/api/v1/notifications/{target['id']}", api.token('employee'),
                 {'hidden': True}, Api.key(), headers.get('ETag'))
        _, after_hide, _ = api.call('GET', f'/api/v1/admin/tasks/{task_id}/history', admin)
        check('9.2 deleting a message copy keeps the complete task history',
              len(after_hide.get('entries', [])) == entries_before,
              {'before': entries_before, 'after': len(after_hide.get('entries', []))})
    else:
        check('9.2 deleting a message copy keeps the complete task history', False,
              {'reason': 'no delivered notification referenced the scenario task'})

    # ---------------- 9.3 notification management ----------------
    status, admin_notifications, _ = api.call('GET', '/api/v1/admin/notifications?limit=100', admin)
    rows = admin_notifications.get('items', [])
    check('9.3 the administrator reads receive, read, withdraw and retention state',
          status == 200 and rows and all(key in rows[0] for key in
                                         ('recipientName', 'deliveredAt', 'readAt', 'revokedAt', 'expiresAt', 'expired')),
          {'status': status, 'total': admin_notifications.get('total'), 'keys': sorted(rows[0].keys()) if rows else []})
    status, body, _ = api.call('GET', '/api/v1/admin/notifications?limit=10', api.token('employee'))
    check('9.3 an employee cannot use notification management', status == 403,
          {'status': status, 'body': body})

    candidates = [row for row in rows if not row.get('revokedAt')]
    event_id = candidates[0]['eventId'] if candidates else None
    task_before = api.call('GET', f'/api/v1/admin/tasks/{task_id}/history', admin)[1]
    status, withdrawn, _ = api.call('POST', f'/api/v1/admin/notifications/{event_id}/withdraw', admin,
                                 {'reason': f'管理端撤回-{RUN}'}, Api.key())
    check('9.3 an event inside 180 seconds is withdrawn by the administrator',
          status == 200 and withdrawn.get('withdrawn') is True, {'status': status, 'body': withdrawn})
    _, after_withdraw, _ = api.call('GET', '/api/v1/admin/notifications?limit=100', admin)
    copies = [row for row in after_withdraw.get('items', []) if row.get('eventId') == event_id]
    check('9.3 withdrawn copies keep a placeholder, lose the jump and record the state',
          copies and all(row.get('revokedAt') and row.get('summary') == '该通知已被撤回。'
                         and row.get('taskId') is None and row.get('title') is None for row in copies),
          {'copies': copies[:2]})
    task_after = api.call('GET', f'/api/v1/admin/tasks/{task_id}/history', admin)[1]
    check('9.3 withdrawal does not change the task application or the operation history',
          len(task_after.get('entries', [])) == len(task_before.get('entries', [])),
          {'before': len(task_before.get('entries', [])), 'after': len(task_after.get('entries', []))})
    _, audit, _ = api.call('GET', '/api/v1/admin/audit-logs?action=notification.withdrawn&limit=100', admin)
    audit_rows = [row for row in audit.get('items', []) if row.get('objectId') == event_id]
    check('9.3 the withdrawal keeps an audit record with its reason',
          bool(audit_rows) and f'管理端撤回-{RUN}' in json.dumps(audit_rows[0], ensure_ascii=False),
          {'audit': audit_rows[:1]})

    # Strict 180-second boundary: advance the controllable clock, then a fresh event is too old.
    _, clock, _ = api.call('GET', '/api/v1/admin/clock', admin)
    controllable = bool(clock.get('controllable'))
    if controllable:
        _, latest, _ = api.call('GET', '/api/v1/admin/notifications?limit=100', admin)
        fresh = next((row for row in latest.get('items', []) if not row.get('revokedAt')
                      and row.get('eventId') != event_id), None)
        api.call('POST', '/api/v1/admin/clock/advance', admin, {'seconds': 181}, Api.key())
        status, body, _ = api.call('POST', f"/api/v1/admin/notifications/{fresh['eventId']}/withdraw", admin,
                                   {'reason': '超时撤回'}, Api.key())
        check('9.3 withdrawal at or after 180 seconds is refused',
              status == 409 and body.get('code') == 'WITHDRAW_WINDOW_CLOSED', {'status': status, 'body': body})
    else:
        check('9.3 withdrawal at or after 180 seconds is refused', False,
              {'reason': 'controllable clock disabled for this run'})

    # ---------------- 9.4 restricted team management ----------------
    status, team_management, _ = api.call('GET', '/api/v1/me/team-management', api.token('middle'))
    departments = team_management.get('departments', [])
    teams = team_management.get('teams', [])
    members = team_management.get('members', [])
    serialized_teams = json.dumps(team_management, ensure_ascii=False)
    check('9.4 an authorized department lead reads only the own department, its teams and lead candidates',
          status == 200 and [row['name'] for row in departments] == ['产品部']
          and teams and members and all(member.get('displayName') for member in members),
          {'status': status, 'departments': [row['name'] for row in departments],
           'teams': len(teams), 'members': len(members)})
    forbidden_markers = [marker for marker in ('"phone"', '"email"', '"password"', '市场部')
                         if marker in serialized_teams]
    check('9.4 the restricted read exposes no contact or full organization data',
          not forbidden_markers, {'found': forbidden_markers})
    for who in ('employee', 'upper'):
        status, body, _ = api.call('GET', '/api/v1/me/team-management', api.token(who))
        check(f'9.4 an unauthorized business account ({who}) cannot read or manage teams', status == 403,
              {'status': status, 'body': body})
    status, body, _ = api.call('GET', '/api/v1/me/team-management', admin)
    check('9.4 the administrator identity does not gain the restricted employee team entry', status == 403,
          {'status': status, 'body': body})

    status, created_team, _ = api.call('POST', '/api/v1/admin/teams', api.token('middle'),
                                    {'name': f'控制台团队-{RUN}', 'departmentId': departments[0]['id']}, Api.key())
    team_id = created_team.get('teamId')
    check('9.4 the department lead creates a team and becomes its default lead',
          status == 200 and created_team.get('leadUserId') == middle_id, {'status': status, 'body': created_team})
    _, refreshed, _ = api.call('GET', '/api/v1/me/team-management', api.token('middle'))
    team_row = next((row for row in refreshed.get('teams', []) if row['id'] == team_id), None)
    check('9.4 the new team appears in the restricted read with its row version',
          team_row is not None and team_row.get('leadUserId') == middle_id and team_row.get('rowVersion') is not None,
          {'team': team_row})
    status, transfer, _ = api.call('PATCH', f'/api/v1/admin/teams/{team_id}', api.token('middle'),
                                {'leadUserId': employee_id}, Api.key(), f'"{team_row["rowVersion"]}"')
    _, refreshed, _ = api.call('GET', '/api/v1/me/team-management', api.token('middle'))
    team_row = next((row for row in refreshed.get('teams', []) if row['id'] == team_id), None)
    check('9.4 a legal transfer to a department member persists and refreshes the read',
          status == 200 and team_row is not None and team_row.get('leadUserId') == employee_id,
          {'status': status, 'lead': team_row.get('leadUserId') if team_row else None})
    status, body, _ = api.call('PATCH', f'/api/v1/admin/teams/{team_id}', api.token('middle'),
                               {'leadUserId': ids['marketing']}, Api.key(), f'"{team_row["rowVersion"]}"')
    check('9.4 a transfer to a person outside the department is refused', status in (400, 403),
          {'status': status, 'body': body})
    status, body, _ = api.call('POST', '/api/v1/admin/teams', api.token('employee'),
                               {'name': f'员工越权团队-{RUN}', 'departmentId': departments[0]['id']}, Api.key())
    check('9.4 an ordinary employee cannot create a team', status == 403, {'status': status, 'body': body})
    market_department = next(row for row in api.call('GET', '/api/v1/admin/organization', admin)[1]['departments']
                             if row['name'] == '市场部')
    status, body, _ = api.call('POST', '/api/v1/admin/teams', api.token('middle'),
                            {'name': f'跨部门团队-{RUN}', 'departmentId': market_department['id']}, Api.key())
    check('9.4 a department lead cannot create a team in another department', status == 403,
          {'status': status, 'body': body})
    _, employee_me, _ = api.call('GET', '/api/v1/me', api.token('employee'))
    _, employee_candidates, _ = api.call('GET', '/api/v1/assignee-candidates?purpose=edit', api.token('employee'))
    check('9.4 being a team lead adds no team-management or dispatch authority',
          employee_me.get('canManageTeam') is False
          and [row['username'] for row in employee_candidates.get('items', [])] == ['employee'],
          {'canManageTeam': employee_me.get('canManageTeam'),
           'candidates': [row['username'] for row in employee_candidates.get('items', [])]})

    # A role change must refresh the entry without a new login.
    _, colleague_detail, colleague_headers = employee_detail(colleague_id)
    status, granted, _ = api.call('PATCH', f'/api/v1/admin/employees/{colleague_id}', admin,
                               {'roleCodes': ['manager']}, Api.key(), colleague_headers.get('ETag'))
    _, colleague_me, _ = api.call('GET', '/api/v1/me', api.token('colleague'))
    status_manage = api.call('GET', '/api/v1/me/team-management', api.token('colleague'))[0]
    check('9.4 a role change refreshes the restricted entry and its scope',
          status == 200 and colleague_me.get('canManageTeam') is True and status_manage == 200,
          {'status': status, 'canManageTeam': colleague_me.get('canManageTeam'), 'manageStatus': status_manage})
    _, colleague_detail, colleague_headers = employee_detail(colleague_id)
    api.call('PATCH', f'/api/v1/admin/employees/{colleague_id}', admin,
             {'roleCodes': ['employee']}, Api.key(), colleague_headers.get('ETag'))

    # ---------------- 9.5 session isolation and combined matrix ----------------
    status, admin_tasks_view, _ = api.call('GET', '/api/v1/tasks?limit=5', admin)
    check('9.5 the administrator session gains no employee task data',
          status == 403 or (status == 200 and admin_tasks_view.get('total') == 0),
          {'status': status, 'total': admin_tasks_view.get('total')})
    status, body, _ = api.call('GET', '/api/v1/work-logs?scope=self', admin)
    check('9.5 the administrator session cannot use the employee log API', status == 403,
          {'status': status, 'code': body.get('code')})
    for path, who in (('/api/v1/admin/organization', 'employee'), ('/api/v1/admin/tasks?limit=5', 'employee'),
                      ('/api/v1/admin/notifications?limit=5', 'employee'), ('/api/v1/me/team-management', 'employee')):
        status, body, _ = api.call('GET', path, api.token(who))
        check(f'9.5 a business session is refused by the management API {path}', status == 403,
              {'status': status, 'code': body.get('code')})
    status, team_management, _ = api.call('GET', '/api/v1/me/team-management', api.token('middle'))
    check('9.5 the organization, notification and history management surfaces stay separate from the employee entry',
          status == 200 and team_management.get('departments') and len(team_management['departments']) == 1,
          {'departments': [row['name'] for row in team_management.get('departments', [])]})

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
