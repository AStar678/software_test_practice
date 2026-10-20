#!/usr/bin/env python3
"""HTTP regression for V-004: corrupted management chains fail closed for phone access.

The public administration API refuses to create a management cycle, so this probe writes the same
corrupt fixture the independent verification used directly into a scratch database: employee ->
middle -> upper -> middle. It asserts that a viewer who appears before the repeated node still does
not receive the phone number, then restores the original manager links.

    python3 scripts/check_phone_cycle.py --base-url http://127.0.0.1:18204 \
        --database e13r_phone
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess
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


def check(name: str, condition: bool, evidence) -> None:
    RESULTS.append({'check': name, 'pass': bool(condition), 'evidence': evidence})
    print(('PASS  ' if condition else 'FAIL  ') + name + ('' if condition else f'  -> {evidence}'))


class Sql:
    def __init__(self, option_file: str, database: str):
        self.option_file = option_file
        self.database = database

    def run(self, statement: str) -> str:
        result = subprocess.run(
            ['mysql', f'--defaults-file={self.option_file}', f'--database={self.database}',
             '-N', '-B', '-e', statement],
            capture_output=True, text=True)
        if result.returncode != 0:
            raise SystemExit(f'sql failed: {result.stderr}')
        return result.stdout.strip()

    def manager_of(self, user_id: str) -> str:
        return self.run(f"SELECT COALESCE(manager_id,'') FROM users WHERE id='{user_id}'")

    def set_manager(self, user_id: str, manager_id: str | None) -> None:
        value = 'NULL' if not manager_id else f"'{manager_id}'"
        self.run(f'UPDATE users SET manager_id={value} WHERE id=\'{user_id}\'')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:18204')
    parser.add_argument('--defaults-file', default='.runtime/mysql-admin.cnf')
    parser.add_argument('--database', required=True)
    parser.add_argument('--output', type=Path, default=None)
    args = parser.parse_args()
    api = Api(args.base_url)
    sql = Sql(args.defaults_file, args.database)
    api.login('middle')
    api.login('upper')
    api.login('employee')
    employee = api.me('employee')['id']
    middle = api.me('middle')['id']
    upper = api.me('upper')['id']

    original = {user: sql.manager_of(user) or None for user in (employee, middle, upper)}
    test_phone = '13900009999'
    _, profile, profile_headers = api.call('GET', '/api/v1/me/profile', api.tokens['employee'])
    original_phone = profile.get('phone')
    etag = profile_headers.get('ETag') or '"' + str(profile.get('rowVersion')) + '"'
    status, saved, _ = api.call('PATCH', '/api/v1/me/profile', api.tokens['employee'],
                                {'phone': test_phone}, key='phone-cycle-' + uuid.uuid4().hex, if_match=etag)
    check('V-004 the owner can set a phone for the cycle check', status == 200, saved)
    try:
        # employee -> middle -> upper -> middle: the viewer (middle) sits before the repeated node.
        sql.set_manager(employee, middle)
        sql.set_manager(middle, upper)
        sql.set_manager(upper, middle)
        status, middle_view, _ = api.call('GET', f'/api/v1/users/{employee}', api.tokens['middle'])
        check('V-004 a viewer inside a cyclic chain receives no phone number',
              status == 200 and not middle_view.get('phone'), {'status': status, 'phone': middle_view.get('phone')})
        status, upper_view, _ = api.call('GET', f'/api/v1/users/{employee}', api.tokens['upper'])
        check('V-004 a viewer above the cycle receives no phone number',
              status in (200, 404) and not upper_view.get('phone'),
              {'status': status, 'phone': upper_view.get('phone')})
        status, self_view, _ = api.call('GET', f'/api/v1/users/{employee}', api.tokens['employee'])
        check('V-004 the owner still reads their own phone',
              status == 200 and self_view.get('phone') == test_phone,
              {'status': status, 'phone': self_view.get('phone')})
    finally:
        for user, manager in original.items():
            sql.set_manager(user, manager)
    status, restored, _ = api.call('GET', f'/api/v1/users/{employee}', api.tokens['middle'])
    check('V-004 restoring the valid chain restores the authorised phone read',
          status == 200 and restored.get('phone') == test_phone,
          {'status': status, 'phone': restored.get('phone')})
    _, current_profile, current_headers = api.call('GET', '/api/v1/me/profile', api.tokens['employee'])
    restore_etag = current_headers.get('ETag') or '"' + str(current_profile.get('rowVersion')) + '"'
    api.call('PATCH', '/api/v1/me/profile', api.tokens['employee'], {'phone': original_phone},
             key='phone-cycle-restore-' + uuid.uuid4().hex, if_match=restore_etag)

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
