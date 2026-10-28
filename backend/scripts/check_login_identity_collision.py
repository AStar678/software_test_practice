#!/usr/bin/env python3
"""Verify administrator username / employee phone collisions in a throwaway seeded database.

The script temporarily renames the seeded administrator and changes its password, then restores
the original credential columns. Password changes revoke existing administrator sessions, so run
this only against the isolated test database, never the normal application database.

    ./scripts/run_check_isolated.sh python3 scripts/check_login_identity_collision.py \
        --base-url {base} --database {db} --output ../audit/login-identity-collision.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import subprocess
import urllib.error
import urllib.request


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:18130')
    parser.add_argument('--database', required=True)
    parser.add_argument('--defaults-file', default='.runtime/mysql-admin.cnf')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9_]+', args.database):
        parser.error('invalid database identifier')
    checks = []
    base = args.base_url.rstrip('/')
    password = 'Demo@123456'
    changed_password = 'ReviewAdmin@123456'

    def sql(statement):
        result = subprocess.run(['mysql', f'--defaults-file={args.defaults_file}',
                                 f'--database={args.database}', '-N', '-B', '-e', statement],
                                capture_output=True, text=True, check=True)
        return result.stdout.strip()

    def quoted(value):
        return "'" + str(value).replace('\\', '\\\\').replace("'", "''") + "'"

    def call(route, body, token=None):
        request = urllib.request.Request(base + route, data=json.dumps(body).encode(),
                                         headers={'Content-Type': 'application/json'}, method='POST')
        if token:
            request.add_header('Authorization', 'Bearer ' + token)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def login(identifier, secret=password, account_type=None):
        body = {'username': identifier, 'password': secret}
        if account_type is not None:
            body['accountType'] = account_type
        return call('/api/v1/auth/sessions', body)

    def check(name, response, expected_status, expected_user=None, expected_code=None):
        status, body = response
        evidence = {'status': status, 'userId': body.get('user', {}).get('id'), 'code': body.get('code')}
        passed = (status == expected_status and (expected_user is None or evidence['userId'] == expected_user)
                  and (expected_code is None or evidence['code'] == expected_code))
        checks.append({'check': name, 'pass': passed, 'evidence': evidence})
        print(('PASS  ' if passed else 'FAIL  ') + name, flush=True)

    admin = json.loads(sql("SELECT JSON_OBJECT('id',id,'username',username,'passwordHash',password_hash,"
                           "'credentialVersion',credential_version,'mustChangePassword',must_change_password) "
                           "FROM users WHERE username='admin' AND role='admin' AND active=1"))
    employee = json.loads(sql("SELECT JSON_OBJECT('id',id,'phone',login_phone) FROM users "
                              "WHERE username='employee' AND role<>'admin' AND active=1"))
    phone = employee['phone']
    if not phone:
        raise RuntimeError('seeded employee has no login phone')

    try:
        check('ordinary administrator legacy login succeeds', login('admin'), 200, admin['id'])
        check('ordinary employee legacy login succeeds', login(phone), 200, employee['id'])
        sql(f"UPDATE users SET username={quoted(phone)} WHERE id={quoted(admin['id'])}")

        check('shared identifier and password requires an explicit entry point', login(phone), 409,
              expected_code='LOGIN_IDENTITY_AMBIGUOUS')
        admin_login = login(phone, account_type='admin')
        check('administrator entry selects administrator with a shared password', admin_login, 200, admin['id'])
        check('employee entry selects employee with a shared password', login(phone, account_type='employee'),
              200, employee['id'])
        check('wrong password does not authenticate either identity', login(phone, 'wrong-password'), 401,
              expected_code='BAD_CREDENTIALS')
        check('unknown account type is rejected', login(phone, account_type='other'), 400,
              expected_code='INVALID_INPUT')

        if admin_login[0] != 200:
            raise RuntimeError('explicit administrator login failed; cannot continue password fixture')
        changed = call('/api/v1/auth/password', {'currentPassword': password, 'newPassword': changed_password},
                       admin_login[1]['token'])
        check('administrator password fixture changes through the normal API', changed, 200)
        if changed[0] != 200:
            raise RuntimeError('administrator password fixture failed')

        check('legacy numeric administrator login matches its own password', login(phone, changed_password),
              200, admin['id'])
        check('legacy employee login matches its own password', login(phone), 200, employee['id'])
        check('administrator entry cannot fall back to employee credentials', login(phone, account_type='admin'),
              401, expected_code='BAD_CREDENTIALS')
        check('employee entry cannot fall back to administrator credentials',
              login(phone, changed_password, 'employee'), 401, expected_code='BAD_CREDENTIALS')
        check('administrator entry accepts its own changed password', login(phone, changed_password, 'admin'),
              200, admin['id'])
    finally:
        sql(f"UPDATE users SET username={quoted(admin['username'])},password_hash={quoted(admin['passwordHash'])},"
            f"credential_version={int(admin['credentialVersion'])},must_change_password={int(admin['mustChangePassword'])} "
            f"WHERE id={quoted(admin['id'])}")
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps({'checks': checks}, ensure_ascii=False, indent=2) + '\n')

    check('administrator original login is restored after the fixture', login('admin'), 200, admin['id'])
    if args.output:
        args.output.write_text(json.dumps({'checks': checks}, ensure_ascii=False, indent=2) + '\n')
    passed = sum(row['pass'] for row in checks)
    print(f'\n{passed}/{len(checks)} checks passed')
    return 0 if passed == len(checks) else 1


if __name__ == '__main__':
    raise SystemExit(main())
