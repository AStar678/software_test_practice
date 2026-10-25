#!/usr/bin/env python3
"""HTTP + SQL regression for V-001: ambiguous normalized employee login keys must fail closed.

Reproduces the staged post-V19 state in a throwaway database (the unique index is withheld while a
duplicate normalized key exists), verifies that neither employee can obtain a session through that
key even when the password matches, adds a cross-company duplicate, repairs the data through the
administrator flow, and checks that the original identities/relations/data survive while the unique
index is re-established.

    ./scripts/run_check_isolated.sh python3 scripts/check_login_ambiguity.py \
        --base-url {base} --database {db} --output ../audit/2026-10-25/chapter2-login-ambiguity.json
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
PASSWORD = "Demo@123456"
DEMO_PHONE = {'upper': '13800000001', 'middle': '13800000002', 'market': '13800000003',
              'employee': '13800000004', 'colleague': '13800000005', 'marketing': '13800000006',
              'admin': 'admin'}


def login_identity(account: str) -> str:
    return DEMO_PHONE.get(account, account)


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

    def login(self, username: str, identifier: str | None = None, password: str | None = None):
        status, body, _ = self.call('POST', '/api/v1/auth/sessions', body={
            'username': identifier or login_identity(username), 'password': password or PASSWORD})
        if status != 200:
            raise SystemExit(f'login failed for {username}: {status} {body}')
        self.tokens[username] = body['token']
        return body

    @staticmethod
    def key(prefix='ambiguity') -> str:
        return prefix + '-' + uuid.uuid4().hex


def check(name: str, condition: bool, evidence=None) -> None:
    RESULTS.append({'check': name, 'pass': bool(condition), 'evidence': evidence})
    print(('PASS  ' if condition else 'FAIL  ') + name + ('' if condition else f'  -> {evidence}'))


def sql(option_file: str, database: str, statement: str) -> str:
    result = subprocess.run(['mysql', f'--defaults-file={option_file}', f'--database={database}',
                             '-N', '-B', '-e', statement], capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f'sql failed: {result.stderr}\n{statement}')
    return result.stdout.strip()


def scalar(option_file: str, database: str, statement: str) -> str:
    return sql(option_file, database, statement) or '0'


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:18130')
    parser.add_argument('--database', required=True)
    parser.add_argument('--defaults-file', default='.runtime/mysql-admin.cnf')
    parser.add_argument('--output', type=Path, default=None)
    args = parser.parse_args()
    api = Api(args.base_url)
    for who in ('admin', 'employee', 'colleague'):
        api.login(who)
    admin, employee, colleague = (api.tokens[name] for name in ('admin', 'employee', 'colleague'))
    employee_id = api.call('GET', '/api/v1/me', employee)[1]['id']
    colleague_id = api.call('GET', '/api/v1/me', colleague)[1]['id']

    def q(statement: str) -> str:
        return scalar(args.defaults_file, args.database, statement)

    original = {
        'employee': sql(args.defaults_file, args.database,
                        f"SELECT id,organization_id,department_id,position_id,team_id,manager_id,username,phone,login_phone "
                        f"FROM users WHERE id='{employee_id}'"),
        'colleague': sql(args.defaults_file, args.database,
                         f"SELECT id,organization_id,department_id,position_id,team_id,manager_id,username,phone,login_phone "
                         f"FROM users WHERE id='{colleague_id}'"),
    }
    before_counts = {
        'tasks': q('SELECT COUNT(*) FROM tasks'),
        'versions': q('SELECT COUNT(*) FROM task_versions'),
        'assignments': q('SELECT COUNT(*) FROM task_version_assignees'),
        'logs': q('SELECT COUNT(*) FROM work_logs'),
        'sessions': q(f"SELECT COUNT(*) FROM auth_sessions WHERE user_id IN ('{employee_id}','{colleague_id}')"),
    }
    duplicate_key = q(f"SELECT login_phone FROM users WHERE id='{employee_id}'")
    check('V-001 the seeded employee has a normalized login key to duplicate', bool(duplicate_key),
          {'employee': employee_id, 'keyPrefix': duplicate_key[:3] + '***'})

    # Reproduce the staged post-V19 state: no unique index, and two normalized keys collide.
    if q("SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() "
         "AND table_name='users' AND index_name='uq_users_login_phone'") != '0':
        sql(args.defaults_file, args.database, 'ALTER TABLE users DROP INDEX uq_users_login_phone')
    sql(args.defaults_file, args.database,
        f"UPDATE users SET login_phone='{duplicate_key}', phone='{duplicate_key[:3]}-{duplicate_key[3:7]}-{duplicate_key[7:]}' "
        f"WHERE id='{colleague_id}'")
    duplicate_count = q(f"SELECT COUNT(*) FROM users WHERE login_phone='{duplicate_key}' AND role<>'admin' AND active=1")
    check('V-001 the fixture reproduces a normalized duplicate key without the unique index',
          duplicate_count == '2' and q("SELECT COUNT(*) FROM information_schema.statistics "
                                       "WHERE table_schema=DATABASE() AND table_name='users' "
                                       "AND index_name='uq_users_login_phone'") == '0',
          {'matchingActiveEmployees': duplicate_count})

    def attempt(identifier: str, password: str):
        return api.call('POST', '/api/v1/auth/sessions', body={'username': identifier, 'password': password})

    # Give the second duplicate a different password first, so both identical and different
    # credentials can be attempted against the same ambiguous key.
    status_reset, reset_body, _ = api.call('POST', f'/api/v1/admin/employees/{colleague_id}/password-reset',
                                           admin, None, Api.key('reset'))
    new_password = reset_body.get('initialPassword')
    sessions_before_attempts = q(f"SELECT COUNT(*) FROM auth_sessions WHERE user_id IN ('{employee_id}','{colleague_id}')")
    status_same, body_same, _ = attempt(duplicate_key, PASSWORD)
    formatted = f"{duplicate_key[:3]}-{duplicate_key[3:7]}-{duplicate_key[7:]}"
    status_formatted, body_formatted, _ = attempt(formatted, PASSWORD)
    check('V-001 an ambiguous key cannot authenticate even when the password matches an employee',
          status_same == 409 and body_same.get('code') == 'LOGIN_KEY_AMBIGUOUS'
          and status_formatted == 409 and body_formatted.get('code') == 'LOGIN_KEY_AMBIGUOUS',
          {'status': status_same, 'formattedStatus': status_formatted, 'body': body_same})

    status_different, body_different, _ = attempt(duplicate_key, new_password or PASSWORD)
    check('V-001 a different password for the other duplicate is also rejected',
          status_reset == 200 and bool(new_password) and status_different == 409
          and body_different.get('code') == 'LOGIN_KEY_AMBIGUOUS',
          {'reset': status_reset, 'status': status_different, 'body': body_different})

    # Cross-company duplicate: the login contract is global, so a second organization sharing the
    # normalized key must also block the session. This synthetic organization is removed afterwards.
    other_org, other_department, other_position = (str(uuid.uuid4()) for _ in range(3))
    other_user = str(uuid.uuid4())
    password_hash = q(f"SELECT password_hash FROM users WHERE id='{employee_id}'")
    sql(args.defaults_file, args.database,
        f"INSERT INTO organizations(id,name,time_zone) VALUES('{other_org}','E13 跨公司核验','Asia/Shanghai')")
    sql(args.defaults_file, args.database,
        f"INSERT INTO departments(id,organization_id,name) VALUES('{other_department}','{other_org}','跨公司部')")
    sql(args.defaults_file, args.database,
        f"INSERT INTO positions(id,organization_id,name) VALUES('{other_position}','{other_org}','跨公司职位')")
    sql(args.defaults_file, args.database,
        f"INSERT INTO users(id,organization_id,username,password_hash,display_name,role,rank_level,active,"
        f"department_id,position_id,login_phone,phone,must_change_password) "
        f"VALUES('{other_user}','{other_org}','cross-company','{password_hash}','跨公司员工','lower',3,1,"
        f"'{other_department}','{other_position}','{duplicate_key}','{duplicate_key}',FALSE)")
    status_cross, body_cross, _ = attempt(duplicate_key, PASSWORD)
    check('V-001 a cross-company duplicate key is rejected under the global login contract',
          status_cross == 409 and body_cross.get('code') == 'LOGIN_KEY_AMBIGUOUS',
          {'status': status_cross, 'body': body_cross})
    sql(args.defaults_file, args.database, f"DELETE FROM users WHERE id='{other_user}'")
    sql(args.defaults_file, args.database, f"DELETE FROM departments WHERE id='{other_department}'")
    sql(args.defaults_file, args.database, f"DELETE FROM positions WHERE id='{other_position}'")
    sql(args.defaults_file, args.database, f"DELETE FROM organizations WHERE id='{other_org}'")

    sessions_after_attempts = q(f"SELECT COUNT(*) FROM auth_sessions WHERE user_id IN ('{employee_id}','{colleague_id}')")
    check('V-001 rejected ambiguity issues no session for either employee',
          sessions_after_attempts == sessions_before_attempts,
          {'beforeAttempts': sessions_before_attempts, 'afterAttempts': sessions_after_attempts})

    # Administrator repair through the existing employee flow: a fresh unique number for the colleague.
    new_phone = '137' + str(uuid.uuid4().int)[:8]
    status, detail, headers = api.call('GET', f'/api/v1/admin/employees/{colleague_id}', admin)
    status, repaired, _ = api.call('PATCH', f'/api/v1/admin/employees/{colleague_id}', admin,
                                   {'phone': new_phone}, Api.key('repair'), headers.get('ETag'))
    check('V-001 the administrator repairs the duplicate through the normal employee flow',
          status == 200 and repaired.get('phoneUpdated') is True, {'status': status, 'body': repaired})
    unique_index = q("SELECT COUNT(DISTINCT index_name) FROM information_schema.statistics "
                     "WHERE table_schema=DATABASE() AND table_name='users' AND index_name='uq_users_login_phone'")
    check('V-001 the unique employee login key is safely re-established after repair',
          unique_index == '1', {'uniqueIndex': unique_index})
    status, findings, _ = api.call('GET', '/api/v1/admin/organization', admin)
    open_login_blockers = [row for row in findings.get('constraints', {}).get('openBlockers', [])
                           if 'login_phone' in (row.get('category') or '')]
    check('V-001 the resolved migration blockers are closed in the console',
          not open_login_blockers, {'openBlockers': open_login_blockers})

    # After repair the original key belongs uniquely to the employee and both identities still log in.
    status_original, body_original, _ = attempt(duplicate_key, PASSWORD)
    status_new, body_new, _ = attempt(new_phone, new_password or PASSWORD)
    check('V-001 the original employee still logs in to the same ID and relations',
          status_original == 200 and body_original['user']['id'] == employee_id,
          {'status': status_original, 'userId': (body_original.get('user') or {}).get('id')})
    check('V-001 the repaired number logs in to the repaired employee ID',
          status_new == 200 and body_new['user']['id'] == colleague_id,
          {'status': status_new, 'userId': (body_new.get('user') or {}).get('id')})
    status, admin_session, _ = api.call('POST', '/api/v1/auth/sessions', body={'username': 'admin', 'password': PASSWORD})
    check('V-001 the administrator keeps the username login', status == 200, {'status': status})

    employee_after = sql(args.defaults_file, args.database,
                         f"SELECT id,organization_id,department_id,position_id,team_id,manager_id,username,phone,login_phone "
                         f"FROM users WHERE id='{employee_id}'")
    colleague_after = sql(args.defaults_file, args.database,
                          f"SELECT id,organization_id,department_id,position_id,team_id,manager_id,username,phone,login_phone "
                          f"FROM users WHERE id='{colleague_id}'")
    employee_identity = original['employee'].split('\t')[:6]
    colleague_identity = original['colleague'].split('\t')[:6]
    after_counts = {
        'tasks': q('SELECT COUNT(*) FROM tasks'),
        'versions': q('SELECT COUNT(*) FROM task_versions'),
        'assignments': q('SELECT COUNT(*) FROM task_version_assignees'),
        'logs': q('SELECT COUNT(*) FROM work_logs'),
    }
    check('V-001 the original IDs and organization relations are unchanged',
          employee_after.split('\t')[:6] == employee_identity
          and colleague_after.split('\t')[:6] == colleague_identity,
          {'employee': employee_after, 'colleague': colleague_after})
    check('V-001 tasks, versions, assignments and logs are not rewritten by the repair',
          all(after_counts[key] == before_counts[key] for key in after_counts),
          {'before': before_counts, 'after': after_counts})

    passed = sum(1 for row in RESULTS if row['pass'])
    print(f'\n{passed}/{len(RESULTS)} checks passed')
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps({
            'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
            'baseUrl': args.base_url, 'passed': passed, 'total': len(RESULTS),
            'results': RESULTS,
        }, ensure_ascii=False, indent=2) + '\n')
        print(f'wrote {args.output}')
    return 0 if passed == len(RESULTS) else 1


if __name__ == '__main__':
    raise SystemExit(main())
