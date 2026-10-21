#!/usr/bin/env python3
"""HTTP regression for V-008: the reviewer-less automatic path keeps current authority checks.

Scenario: an executive creates a pending task that includes an employee as assignee, then the
administrator withdraws the executive's company dispatch range. An explicit approval is already
refused; when the last reviewer is then marked unavailable, the automatic path must not publish the
same proposal either. A genuinely valid reviewer-less application still applies directly.

    python3 scripts/check_auto_apply_authorization.py --base-url http://127.0.0.1:18311
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
RUN = uuid.uuid4().hex[:6]
PASSWORD = "Demo@123456"
EXECUTIVE_SCOPES = {"task_view": "company", "task_dispatch": "company",
                    "log_read": "company", "profile_read": "company"}


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
    def key(prefix='auto') -> str:
        return prefix + '-' + uuid.uuid4().hex


def check(name: str, condition: bool, evidence) -> None:
    RESULTS.append({'check': name, 'pass': bool(condition), 'evidence': evidence})
    print(('PASS  ' if condition else 'FAIL  ') + name + ('' if condition else f'  -> {evidence}'))


def task_payload(title: str, assignees: list[str]) -> dict:
    start = dt.datetime.now(dt.timezone.utc).replace(microsecond=0) + dt.timedelta(days=1)
    return {'title': title, 'description': '自动生效授权核验', 'acceptanceCriteria': '可复核',
            'priority': 'medium', 'allDay': False,
            'startAt': start.isoformat().replace('+00:00', 'Z'),
            'dueAt': (start + dt.timedelta(days=2)).isoformat().replace('+00:00', 'Z'),
            'assigneeIds': assignees}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:18311')
    parser.add_argument('--output', type=Path, default=None)
    args = parser.parse_args()
    api = Api(args.base_url)
    admin = api.login('admin')
    upper = api.login('upper')
    api.login('employee')
    upper_id = api.me('upper')['id']
    employee_id = api.me('employee')['id']

    def set_scopes(scopes: dict) -> tuple[int, dict]:
        status, body, _ = api.call('PATCH', '/api/v1/admin/roles/executive/scopes', admin,
                                   {'scopes': scopes}, Api.key('scopes'))
        return status, body

    def set_reviewer_available(value: bool) -> tuple[int, dict]:
        _, _, headers = api.call('GET', f'/api/v1/admin/employees/{upper_id}', admin)
        status, body, _ = api.call('PATCH', f'/api/v1/admin/employees/{upper_id}', admin,
                                   {'reviewerAvailable': value}, Api.key('reviewer'),
                                   headers.get('ETag'))
        return status, body

    def request_view(request_id: str) -> dict:
        _, body, _ = api.call('GET', f'/api/v1/approval-requests/{request_id}', upper)
        return body

    try:
        # 1) A valid pending proposal created while the executive still has company dispatch.
        status, created, _ = api.call('POST', '/api/v1/tasks', upper,
                                      task_payload(f'越权自动生效-{RUN}', [upper_id, employee_id]),
                                      Api.key('create'))
        check('V-008 the executive creates a pending task with an employee assignee', status == 201,
              {'status': status, 'body': created})
        task_id, request_id = created['taskId'], created['requestId']
        view = request_view(request_id)
        check('V-008 the creator is the reviewer of record', view.get('currentReviewerId') == upper_id,
              {'reviewer': view.get('currentReviewerId')})

        # 2) Withdraw the dispatch range. Explicit approval must be refused.
        status, configured = set_scopes({'task_view': 'company', 'task_dispatch': 'self',
                                         'log_read': 'company', 'profile_read': 'company'})
        check('V-008 the dispatch range is revoked through the admin API', status == 200,
              {'status': status, 'body': configured})
        status, explicit, _ = api.call('PATCH', f'/api/v1/approval-requests/{request_id}', upper,
                                       {'decision': 'approve', 'comment': '越权显式批准'},
                                       Api.key('approve'), '"' + str(view['rowVersion']) + '"')
        check('V-008 explicit approval is refused after the range is revoked',
              status == 403 and explicit.get('code') == 'DISPATCH_NOT_ALLOWED',
              {'status': status, 'body': explicit})

        # 3) Remove the last reviewer. The automatic path must not publish the same proposal.
        status, updated = set_reviewer_available(False)
        check('V-008 the organization change itself still succeeds', status == 200,
              {'status': status, 'body': updated})
        after = request_view(request_id)
        check('V-008 the reviewer-less automatic path does not apply the revoked proposal',
              after.get('status') == 'pending', {'status': after.get('status'), 'body': after})
        _, detail, _ = api.call('GET', f'/api/v1/tasks/{task_id}', upper)
        check('V-008 the unpublished task is not published by the automatic path',
              detail.get('published') is False, {'published': detail.get('published')})
        _, history, _ = api.call('GET', f'/api/v1/admin/tasks/{task_id}/history', admin)
        check('V-008 no direct-application history was recorded',
              not any(entry.get('entryType') == 'no_reviewer' for entry in history.get('entries', [])),
              {'entries': [entry.get('entryType') for entry in history.get('entries', [])]})

        # 4) Restore authority; a genuinely valid reviewer-less application still applies directly.
        set_reviewer_available(True)
        set_scopes(EXECUTIVE_SCOPES)
        status, valid, _ = api.call('POST', '/api/v1/tasks', upper,
                                    task_payload(f'合法无审核人-{RUN}', [upper_id]),
                                    Api.key('valid-create'))
        check('V-008 a valid self-assigned proposal stays pending with its creator reviewer',
              status == 201, {'status': status, 'body': valid})
        valid_view = request_view(valid['requestId'])
        check('V-008 the valid proposal still waits for its explicit reviewer',
              valid_view.get('status') == 'pending', valid_view.get('status'))
        status, updated = set_reviewer_available(False)
        valid_after = request_view(valid['requestId'])
        _, valid_task, _ = api.call('GET', f"/api/v1/tasks/{valid['taskId']}", upper)
        check('V-008 a legitimate reviewer-less application applies directly with a reason',
              status == 200 and valid_after.get('status') == 'direct'
              and valid_after.get('currentReviewerId') is None and bool(valid_after.get('exemptionReason'))
              and valid_task.get('published') is True,
              {'status': status, 'request': valid_after.get('status'),
               'published': valid_task.get('published')})
    finally:
        set_reviewer_available(True)
        set_scopes(EXECUTIVE_SCOPES)

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
