#!/usr/bin/env python3
"""HTTP + SQL regression for V-002: a submission that waits on the organization lock past its deadline
must still persist the expiry terminal state and unfreeze the task.

The script holds the organization row lock from a separate MySQL session, starts a PATCH that blocks
on that same lock, advances the controlled server clock past the applicable deadline, then releases
the lock. The submission must observe the post-wait clock (not its pre-wait time), expire the pending
request, unfreeze, and refuse the stale page without publishing.

    python3 scripts/check_submit_lock_deadline.py --base-url http://127.0.0.1:18312 \
        --defaults-file .runtime/mysql-admin.cnf --database e13v_lock
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
import subprocess
import threading
import time
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
            with urllib.request.urlopen(request, timeout=60) as response:
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

    @staticmethod
    def key(prefix='lock') -> str:
        return prefix + '-' + uuid.uuid4().hex


def check(name: str, condition: bool, evidence) -> None:
    RESULTS.append({'check': name, 'pass': bool(condition), 'evidence': evidence})
    print(('PASS  ' if condition else 'FAIL  ') + name + ('' if condition else f'  -> {evidence}'))


def sql(option_file: str, database: str, statement: str) -> str:
    result = subprocess.run(['mysql', f'--defaults-file={option_file}', f'--database={database}',
                             '-N', '-B', '-e', statement], capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f'sql failed: {result.stderr}')
    return result.stdout.strip()


def server_now(api: Api) -> dt.datetime:
    status, body, _ = api.call('GET', '/api/v1/admin/clock', api.tokens['admin'])
    if status != 200:
        raise SystemExit(f'controlled clock unavailable: {status} {body}')
    return dt.datetime.fromisoformat(body['now'].replace('Z', '+00:00'))


def advance(api: Api, seconds: int) -> None:
    status, body, _ = api.call('POST', '/api/v1/admin/clock/advance', api.tokens['admin'],
                               {'seconds': seconds})
    if status != 200:
        raise SystemExit(f'clock advance failed: {status} {body}')


def iso(value: dt.datetime) -> str:
    return value.astimezone(dt.timezone.utc).isoformat().replace('+00:00', 'Z')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:18312')
    parser.add_argument('--defaults-file', default='.runtime/mysql-admin.cnf')
    parser.add_argument('--database', required=True)
    parser.add_argument('--output', type=Path, default=None)
    parser.add_argument('--lock-seconds', type=int, default=5)
    args = parser.parse_args()
    api = Api(args.base_url)
    api.login('admin')
    api.login('middle')
    api.login('employee')
    _, middle_me, _ = api.call('GET', '/api/v1/me', api.tokens['middle'])
    _, employee_me, _ = api.call('GET', '/api/v1/me', api.tokens['employee'])
    organization = sql(args.defaults_file, args.database, 'SELECT id FROM organizations LIMIT 1')

    base = server_now(api)
    create_body = {'title': f'锁等待截止-{uuid.uuid4().hex[:6]}', 'description': '锁等待核验',
                   'acceptanceCriteria': '锁等待核验', 'priority': 'medium', 'allDay': False,
                   'startAt': iso(base + dt.timedelta(seconds=20)),
                   'dueAt': iso(base + dt.timedelta(seconds=60)),
                   'assigneeIds': [employee_me['id']]}
    status, created, _ = api.call('POST', '/api/v1/tasks', api.tokens['middle'], create_body,
                                  Api.key('create'))
    check('V-002 the deadline fixture is a pending creation', status == 201,
          {'status': status, 'body': created})
    task_id, request_id = created['taskId'], created['requestId']
    _, task, headers = api.call('GET', f'/api/v1/tasks/{task_id}', api.tokens['middle'])
    etag = headers.get('ETag') or '"' + str(task['rowVersion']) + '"'

    holder = subprocess.Popen(
        ['mysql', f'--defaults-file={args.defaults_file}', f'--database={args.database}', '-e',
         f"START TRANSACTION; SELECT id FROM organizations WHERE id='{organization}' FOR UPDATE; "
         f"SELECT SLEEP({args.lock_seconds}); COMMIT;"],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    time.sleep(1.5)  # the holder has acquired the organization row lock
    outcome: dict = {}

    def submit() -> None:
        started = time.monotonic()
        outcome['result'] = api.call('PATCH', f'/api/v1/tasks/{task_id}', api.tokens['middle'],
                                     {'command': 'change', 'title': '跨截止锁等待重提',
                                      'reason': '锁等待跨截止'}, Api.key('submit'), etag)
        outcome['elapsed'] = time.monotonic() - started

    thread = threading.Thread(target=submit)
    thread.start()
    time.sleep(1.0)  # the PATCH is now queued on the same organization lock
    advance(api, 61)
    thread.join(timeout=args.lock_seconds + 20)
    holder.wait(timeout=args.lock_seconds + 10)
    if thread.is_alive():
        raise SystemExit('submission thread did not finish after the lock was released')
    status, body, _ = outcome['result']
    check('V-002 the submission waited on the organization lock before deciding',
          outcome['elapsed'] >= 2.5, {'elapsedSeconds': round(outcome['elapsed'], 2)})
    check('V-002 the stale submission is refused after the wait', status in (409, 412),
          {'status': status, 'body': body})
    status, request_after, _ = api.call('GET', f'/api/v1/approval-requests/{request_id}',
                                        api.tokens['middle'])
    check('V-002 the waiting submission expires the old request after the lock is released',
          status == 200 and request_after.get('status') == 'expired',
          {'status': status, 'requestStatus': request_after.get('status')})
    _, task_after, _ = api.call('GET', f'/api/v1/tasks/{task_id}', api.tokens['middle'])
    check('V-002 the unpublished task stays unpublished and unfrozen',
          task_after.get('published') is False and task_after.get('pending') is False
          and task_after.get('frozen') is False,
          {key: task_after.get(key) for key in ('published', 'pending', 'frozen')})

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
