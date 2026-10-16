#!/usr/bin/env python3
"""Account, password and contact verification (tasks 3.1-3.5).

Runs against a live backend seeded with ``PANDORA_SEED=true``. Besides the HTTP assertions it reads
the audit / outbox / idempotency tables through the mysql client to prove that a generated password is
never persisted anywhere. Secrets are never placed on a command line: rows are fetched and searched in
process memory.

    python3 scripts/check_account_lifecycle.py --base-url http://127.0.0.1:18092
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
import subprocess
import urllib.error
import urllib.parse
import urllib.request
import uuid

RESULTS: list[dict] = []
RUN = uuid.uuid4().hex[:6]


class Api:
    def __init__(self, base: str, password: str):
        self.base = base.rstrip('/')
        self.password = password

    def call(self, method: str, path: str, token: str | None = None, body=None,
             key: str | None = None, if_match: str | None = None, raw: bool = False):
        data = None if body is None else json.dumps(body).encode()
        # Static page names contain non-ASCII characters, so the request target must be percent-encoded.
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

    def login(self, username: str, password: str):
        return self.call('POST', '/api/v1/auth/sessions', body={'username': username, 'password': password})

    @staticmethod
    def key() -> str:
        return 'acct-' + uuid.uuid4().hex


def check(name: str, condition: bool, evidence) -> None:
    RESULTS.append({'check': name, 'pass': bool(condition), 'evidence': evidence})
    print(('PASS  ' if condition else 'FAIL  ') + name + ('' if condition else f'  -> {evidence}'))


def sql(option_file: str, database: str, query: str) -> str:
    result = subprocess.run(
        ['mysql', '--defaults-file=' + option_file, '--batch', '--raw', '--skip-column-names',
         '--database=' + database, '-e', query],
        capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit('mysql query failed: ' + result.stderr.strip())
    return result.stdout


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:18092')
    parser.add_argument('--password', default='Demo@123456')
    parser.add_argument('--defaults-file', default='.runtime/mysql-admin.cnf')
    parser.add_argument('--database', default='pandora_phase3')
    parser.add_argument('--output', type=Path, default=None)
    parser.add_argument('--skip-sql', action='store_true',
                        help='skip the audit/outbox/idempotency leak assertions')
    args = parser.parse_args()
    api = Api(args.base_url, args.password)
    leaks = not args.skip_sql

    admin = api.login('admin', args.password)
    # Spring Boot opens the port before ApplicationRunners run, so the very first login can race the
    # demo seed. Retry briefly instead of failing the whole run.
    for _ in range(30):
        if admin[0] == 200:
            break
        import time
        time.sleep(1)
        admin = api.login('admin', args.password)
    if admin[0] != 200:
        raise SystemExit(f'admin login failed: {admin[0]} {admin[1]}')
    admin_token = admin[1]['token']
    departments = api.call('GET', '/api/v1/admin/organization', admin_token)[1]['departments']
    positions = api.call('GET', '/api/v1/admin/organization', admin_token)[1]['positions']
    department = departments[0]['id']
    position = positions[0]['id']

    # ---------------- 3.1 creation and one-time delivery ----------------
    username = f'acct-{RUN}'
    payload = {'username': username, 'displayName': '账户验证', 'departmentId': department,
               'positionId': position, 'level': 3, 'roleCodes': ['employee']}
    key = Api.key()
    status, created, _ = api.call('POST', '/api/v1/admin/employees', admin_token, payload, key)
    user_id = created.get('userId')
    first_password = created.get('initialPassword')
    check('3.1 creating an account returns a generated initial password once',
          status == 201 and user_id and first_password, {'status': status})

    status, replay, _ = api.call('POST', '/api/v1/admin/employees', admin_token, payload, key)
    check('3.1 a repeated create never re-displays the secret',
          status == 201 and replay.get('userId') == user_id and 'initialPassword' not in replay,
          {'status': status, 'body': replay})

    if leaks:
        dump = (sql(args.defaults_file, args.database, 'SELECT response_json FROM idempotency_keys')
                + sql(args.defaults_file, args.database, 'SELECT details_json FROM audit_logs')
                + sql(args.defaults_file, args.database, 'SELECT details_json FROM domain_events'))
        check('3.1 no plaintext initial password reaches idempotency/audit/outbox',
              first_password not in dump, {'searchedBytes': len(dump)})
        stored = sql(args.defaults_file, args.database,
                     "SELECT password_hash FROM users WHERE username='" + username + "'")
        check('3.1 only a BCrypt hash is stored for the account',
              stored.startswith('$2') and first_password not in stored, {'prefix': stored[:7]})

    # ---------------- 3.2 forced-change restricted session ----------------
    status, session, _ = api.login(username, first_password)
    restricted = session.get('token')
    check('3.2 login reports the password change requirement up front',
          status == 200 and session.get('passwordChangeRequired') is True
          and session['user']['mustChangePassword'] is True,
          {'status': status, 'passwordChangeRequired': session.get('passwordChangeRequired')})

    status, body, _ = api.call('GET', '/api/v1/auth/session', restricted)
    check('3.2 a restricted session may read its own identity', status == 200 and body.get('username') == username,
          {'status': status})
    status, body, _ = api.call('GET', '/api/v1/me', restricted)
    check('3.2 a restricted session cannot read business data', status == 403 and body.get('code') == 'PASSWORD_CHANGE_REQUIRED',
          {'status': status, 'body': body})
    status, body, _ = api.call('GET', '/api/v1/tasks', restricted)
    check('3.2 a restricted session cannot list tasks', status == 403, {'status': status})
    status, body, _ = api.call('GET', '/api/v1/admin/employees', restricted)
    check('3.2 a restricted session cannot reach the administration API', status == 403, {'status': status})
    status, body, _ = api.call('POST', '/api/v1/auth/sessions/refresh', restricted)
    check('3.2 refreshing cannot bypass the gate', status == 403, {'status': status, 'body': body})

    # ---------------- 3.3 password change rules ----------------
    status, body, _ = api.call('POST', '/api/v1/auth/password', restricted,
                               {'currentPassword': 'not-the-password', 'newPassword': 'Abcdefghi1'})
    check('3.3 a wrong current password is rejected',
          status == 400 and body.get('code') == 'INVALID_CURRENT_PASSWORD', {'status': status, 'body': body})

    for label, weak in (('fewer than ten characters', 'Ab1'),
                        ('letters only', 'abcdefghijkl'),
                        ('digits only', '1234567890123'),
                        ('more than 72 UTF-8 bytes', 'Abcdefghij1' + '汉' * 22)):
        status, body, _ = api.call('POST', '/api/v1/auth/password', restricted,
                                   {'currentPassword': first_password, 'newPassword': weak})
        check(f'3.3 a policy violation is rejected ({label})',
              status == 400 and body.get('code') == 'INVALID_PASSWORD', {'status': status, 'body': body})

    # A second session proves that a successful change revokes every session, not just the current one.
    status, second, _ = api.login(username, first_password)
    second_token = second.get('token')
    check('3.3 a second session can be established before the change', status == 200, {'status': status})

    new_password = 'Zx9' + uuid.uuid4().hex[:10]
    status, changed, _ = api.call('POST', '/api/v1/auth/password', restricted,
                                  {'currentPassword': first_password, 'newPassword': new_password})
    check('3.3 a valid change succeeds and demands a new login',
          status == 200 and changed.get('changed') is True and changed.get('reLoginRequired') is True
          and changed.get('sessionsRevoked', 0) >= 2,
          {'status': status, 'body': changed})

    status, body, _ = api.call('GET', '/api/v1/auth/session', restricted)
    check('3.3 the session that changed the password is revoked', status == 401, {'status': status})
    status, body, _ = api.call('GET', '/api/v1/auth/session', second_token)
    check('3.3 the other session is revoked too', status == 401, {'status': status})

    status, body, _ = api.login(username, first_password)
    check('3.3 the old password no longer works', status == 401, {'status': status})

    status, session, _ = api.login(username, new_password)
    business = session.get('token')
    check('3.3 the new password works and the gate is lifted',
          status == 200 and session.get('passwordChangeRequired') is False,
          {'status': status, 'passwordChangeRequired': session.get('passwordChangeRequired')})
    status, body, _ = api.call('GET', '/api/v1/me', business)
    check('3.3 business data is reachable after the change', status == 200, {'status': status})

    if leaks:
        dump = (sql(args.defaults_file, args.database, 'SELECT response_json FROM idempotency_keys')
                + sql(args.defaults_file, args.database, 'SELECT details_json FROM audit_logs'))
        check('3.3 the chosen new password is never persisted in clear text',
              new_password not in dump, {'searchedBytes': len(dump)})

    # ---------------- 3.1 administrator reset ----------------
    status, reset, _ = api.call('POST', f'/api/v1/admin/employees/{user_id}/password-reset',
                                admin_token, None, Api.key())
    reset_password = reset.get('initialPassword')
    check('3.1 an administrator reset issues a new one-time password',
          status == 200 and reset_password and reset.get('mustChangePassword') is True,
          {'status': status, 'body': {k: v for k, v in reset.items() if k != 'initialPassword'}})
    check('3.1 the reset is a different secret from the created one', reset_password != first_password,
          {'distinct': True})

    status, body, _ = api.call('GET', '/api/v1/me', business)
    check('3.1 the reset revokes the previously valid sessions', status == 401, {'status': status})
    status, body, _ = api.login(username, new_password)
    check('3.1 the password from before the reset no longer works', status == 401, {'status': status})

    status, session, _ = api.login(username, reset_password)
    check('3.1 the reset restores the forced change gate',
          status == 200 and session.get('passwordChangeRequired') is True,
          {'status': status, 'passwordChangeRequired': session.get('passwordChangeRequired')})

    status, body, _ = api.call('DELETE', '/api/v1/auth/sessions/current', session.get('token'))
    check('3.2 a restricted session may log out', status == 200, {'status': status})

    status, session, _ = api.login(username, reset_password)
    status, replay, _ = api.call('POST', f'/api/v1/admin/employees/{user_id}/password-reset',
                                 admin_token, None, Api.key())
    check('3.1 a later reset issues a fresh secret, never the previous one',
          status == 200 and replay.get('initialPassword') not in (None, reset_password),
          {'status': status})

    # ---------------- 3.5 contacts and privacy ----------------
    status, session, _ = api.login('employee', args.password)
    employee_token = session.get('token')
    check('3.5 the seeded employee can sign in normally', status == 200, {'status': status})

    status, profile, _ = api.call('GET', '/api/v1/me/profile', employee_token)
    check('3.5 the owner can read their own contacts',
          status == 200 and 'phone' in profile and 'email' in profile, {'status': status})

    own_phone = '139' + str(uuid.uuid4().int)[:8]
    admin_phone = '137' + str(uuid.uuid4().int)[:8]
    secrets = (own_phone, admin_phone)
    status, body, _ = api.call('PATCH', '/api/v1/me/profile', employee_token,
                               {'displayName': profile['displayName'], 'phone': own_phone, 'email': f'{RUN}@example.com'},
                               Api.key(), f'"{profile["rowVersion"]}"')
    check('3.5 the owner can write name, phone and email', status == 200, {'status': status, 'body': body})
    status, updated, _ = api.call('GET', '/api/v1/me/profile', employee_token)
    check('3.5 the owner sees their own saved phone',
          updated.get('phone') == own_phone, {'phone': updated.get('phone')})

    status, body, _ = api.call('PATCH', '/api/v1/me/profile', employee_token,
                               {'departmentId': department}, Api.key(), f'"{updated["rowVersion"]}"')
    check('3.5 the owner cannot change an organization field', status == 400, {'status': status, 'body': body})
    status, body, _ = api.call('PATCH', '/api/v1/me/profile', employee_token,
                               {'rankLevel': 1}, Api.key(), f'"{updated["rowVersion"]}"')
    check('3.5 the owner cannot change their organization level', status == 400, {'status': status, 'body': body})

    _, employee_detail, headers = api.call('GET', f'/api/v1/admin/employees/{user_id}', admin_token)
    status, body, _ = api.call('PATCH', f'/api/v1/admin/employees/{user_id}', admin_token,
                               {'phone': admin_phone}, Api.key(), headers.get('ETag'))
    check('3.5 the administrator writes a phone and gets a receipt without the number',
          status == 200 and admin_phone not in json.dumps(body) and body.get('phoneUpdated') is True,
          {'status': status, 'body': body})

    def clean(payload) -> bool:
        text = json.dumps(payload)
        return all(secret not in text for secret in secrets)

    status, directory, _ = api.call('GET', '/api/v1/users', employee_token)
    check('3.5 the employee directory never contains a phone number', clean(directory), {'status': status})

    status, tasks, _ = api.call('GET', '/api/v1/tasks', employee_token)
    items = tasks.get('items', [])
    detail = api.call('GET', f"/api/v1/tasks/{items[0]['id']}", employee_token)[1] if items else {}
    check('3.5 task detail and participant summaries contain no phone number', clean(detail), {'status': status})

    status, notifications, _ = api.call('GET', '/api/v1/notifications', employee_token)
    check('3.5 notifications contain no phone number', clean(notifications), {'status': status})

    status, analytics, _ = api.call('GET', '/api/v1/analytics/task-summary', employee_token)
    check('3.5 analytics contain no phone number', clean(analytics), {'status': status})

    status, audit, _ = api.call('GET', '/api/v1/admin/audit-logs', admin_token)
    check('3.5 the audit trail contains no phone number', clean(audit), {'status': status})

    if leaks:
        dump = (sql(args.defaults_file, args.database, 'SELECT details_json FROM audit_logs')
                + sql(args.defaults_file, args.database, 'SELECT details_json FROM domain_events')
                + sql(args.defaults_file, args.database, 'SELECT response_json FROM idempotency_keys'))
        check('3.5 no stored audit/outbox/idempotency payload contains a phone number',
              all(secret not in dump for secret in secrets), {'searchedBytes': len(dump)})

    # ---------------- 3.4 interface wiring ----------------
    status, page, _ = api.call('GET', '/潘多拉-api.js', raw=True)
    script = page.get('raw', '')
    check('3.4 the login page wires first-login and everyday password changes',
          status == 200 and '/auth/password' in script and 'passwordChangeRequired' in script
          and 'PASSWORD_CHANGE_REQUIRED' in script, {'status': status})
    status, profile_js, _ = api.call('GET', '/潘多拉-个人资料.js', raw=True)
    check('3.4 a normal account can change its password from the profile page',
          status == 200 and 'p-change-password' in profile_js.get('raw', ''), {'status': status})
    status, admin_page, _ = api.call('GET', '/admin.html', raw=True)
    check('3.4 the administrator console exposes password reset',
          status == 200 and 'password-reset' in admin_page.get('raw', ''), {'status': status})
    rogue = f'selfsignup-{RUN}'
    status, body, _ = api.call('POST', '/api/v1/auth/register', body={'username': rogue, 'password': 'Abcdefghi1'})
    _, roster, _ = api.call('GET', f'/api/v1/admin/employees?q={rogue}', admin_token)
    check('3.4 self-registration does not exist and creates no account',
          status in (401, 404, 405) and roster.get('total') == 0,
          {'status': status, 'accounts': roster.get('total')})

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
