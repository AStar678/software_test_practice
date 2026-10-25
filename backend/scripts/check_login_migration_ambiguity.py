#!/usr/bin/env python3
"""V-001 migration rehearsal: duplicate normalized phones in a pre-V19 snapshot must not log in.

Restores the repository's pre-V19 snapshot into a throwaway database, makes two employees' existing
contact numbers format-equivalent, lets Flyway apply V19/V20, and verifies that neither duplicate can
obtain a session. It then repairs one number through the administrator flow, confirms the unique key
is established, and checks that the original IDs/relations/tasks/logs survive.

    python3 scripts/check_login_migration_ambiguity.py --output ../audit/2026-10-25/chapter2-login-migration.json
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

BASE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE / 'scripts'))
import check_migration_foundation as foundation  # noqa: E402
from migration_precheck import Mysql, admin_option_file, normalize_phone, restore  # noqa: E402

RESULTS: list[dict] = []
PASSWORD = 'Demo@123456'


def check(name: str, condition: bool, evidence=None) -> None:
    RESULTS.append({'check': name, 'pass': bool(condition), 'evidence': evidence})
    print(('PASS  ' if condition else 'FAIL  ') + name + ('' if condition else f'  -> {evidence}'))


def http(method: str, url: str, body=None, token=None, key=None, if_match=None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header('Content-Type', 'application/json')
    request.add_header('Accept', 'application/json')
    if token:
        request.add_header('Authorization', 'Bearer ' + token)
    if key:
        request.add_header('Idempotency-Key', key)
    if if_match:
        request.add_header('If-Match', if_match)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.status, json.loads(response.read().decode() or '{}')
    except urllib.error.HTTPError as error:
        payload = error.read().decode()
        try:
            return error.code, json.loads(payload or '{}')
        except json.JSONDecodeError:
            return error.code, {'raw': payload}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--snapshot', type=Path, default=foundation.DEFAULT_SNAPSHOT)
    parser.add_argument('--jar', type=Path, default=foundation.DEFAULT_JAR)
    parser.add_argument('--port', type=int, default=18145)
    parser.add_argument('--output', type=Path, default=None)
    args = parser.parse_args()
    subprocess.run([str(BASE / 'scripts' / 'start-db.sh')], check=True, stdout=subprocess.DEVNULL)
    option_file = admin_option_file(None)
    admin = Mysql(None, option_file)
    env = foundation.database_env()
    database = 'pandora_precheck_login_' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%d%H%M%S')
    process = None
    try:
        restore(admin, database, args.snapshot)
        foundation.app_user_grants(admin, database, env)
        db = Mysql(database, option_file)
        before = foundation.fingerprint(db)
        employees = db.rows(
            "SELECT id FROM users WHERE active=1 AND role<>'admin' ORDER BY id LIMIT 2")
        if len(employees) < 2:
            raise SystemExit('the snapshot needs at least two active employees')
        first_id, second_id = employees[0][0], employees[1][0]
        # The snapshot predates the normalized login key. Two legacy contact records are made
        # format-equivalent so V19 must detect the conflict and withhold the unique index.
        duplicate = '13800000004'
        formatted = '138-0000-0004'
        db.server_side(f"UPDATE users SET phone='{duplicate}' WHERE id='{first_id}'")
        db.server_side(f"UPDATE users SET phone='{formatted}' WHERE id='{second_id}'")
        check('V-001 the pre-V19 fixture contains two format-equivalent numbers',
              normalize_phone(formatted) == normalize_phone(duplicate),
              {'first': first_id, 'second': second_id, 'maskedKey': duplicate[:3] + '***'})

        process = foundation.start_application(database, env, args.jar, args.port)
        for _ in range(60):
            if db.scalar("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() "
                        "AND table_name='users' AND column_name='login_phone'") != '0':
                break
            time.sleep(1)
        duplicates = db.scalar(
            "SELECT COUNT(*) FROM (SELECT login_phone FROM users "
            "WHERE login_phone IS NOT NULL AND login_phone<>'' GROUP BY login_phone HAVING COUNT(*)>1) x")
        index = db.scalar("SELECT COUNT(DISTINCT index_name) FROM information_schema.statistics "
                          "WHERE table_schema=DATABASE() AND table_name='users' "
                          "AND index_name='uq_users_login_phone'")
        findings = db.scalar("SELECT COUNT(*) FROM migration_findings WHERE migration='V19' "
                            "AND category='employee_login_phone_duplicate'")
        check('V-001 V19 migrates with duplicate keys but withholds the unique index',
              duplicates == 1 and index == 0 and int(findings) >= 1,
              {'duplicates': duplicates, 'uniqueIndex': index, 'findings': findings})

        base = f'http://127.0.0.1:{args.port}/api/v1'
        status, session = http('POST', base + '/auth/sessions', {'username': 'admin', 'password': PASSWORD})
        check('V-001 the administrator still signs in after the migration', status == 200, {'status': status})
        admin_token = session['token'] if status == 200 else None
        status_raw, body_raw = http('POST', base + '/auth/sessions', {'username': duplicate, 'password': PASSWORD})
        status_formatted, body_formatted = http('POST', base + '/auth/sessions',
                                                {'username': formatted, 'password': PASSWORD})
        check('V-001 neither duplicate key can issue a session after migration',
              status_raw == 409 and body_raw.get('code') == 'LOGIN_KEY_AMBIGUOUS'
              and status_formatted == 409 and body_formatted.get('code') == 'LOGIN_KEY_AMBIGUOUS',
              {'raw': status_raw, 'formatted': status_formatted, 'body': body_raw})
        if admin_token:
            reset_status, reset_body = http('POST', base + f'/admin/employees/{second_id}/password-reset',
                                            token=admin_token, key='migration-ambiguity-' + uuid.uuid4().hex)
            different_password = reset_body.get('initialPassword')
            status_different, body_different = http('POST', base + '/auth/sessions',
                                                    {'username': duplicate, 'password': different_password or PASSWORD})
            check('V-001 a differing password for the other duplicate is also rejected',
                  reset_status == 200 and bool(different_password)
                  and status_different == 409 and body_different.get('code') == 'LOGIN_KEY_AMBIGUOUS',
                  {'reset': reset_status, 'status': status_different, 'body': body_different})

            # Administrator repair: a fresh number, plus a real department/position when the legacy
            # snapshot has no mapping yet (the normal employee flow requires both).
            _, detail = http('GET', base + f'/admin/employees/{second_id}', token=admin_token)
            department = http('POST', base + '/admin/departments', {'name': '登录键修复部'},
                              token=admin_token, key='ambiguity-dept-' + uuid.uuid4().hex)[1].get('departmentId')
            position = http('POST', base + '/admin/positions', {'name': '登录键修复岗'},
                            token=admin_token, key='ambiguity-pos-' + uuid.uuid4().hex)[1].get('positionId')
            if not detail.get('departmentId') and department:
                detail = http('GET', base + f'/admin/employees/{second_id}', token=admin_token)[1]
            new_phone = '132' + str(uuid.uuid4().int)[:8]
            payload = {'phone': new_phone, 'teamId': None}
            if department:
                payload['departmentId'] = department
            if position:
                payload['positionId'] = position
            status, repaired = http('PATCH', base + f'/admin/employees/{second_id}', payload,
                                    token=admin_token, key='ambiguity-repair-' + uuid.uuid4().hex,
                                    if_match='"' + str(detail.get('rowVersion')) + '"')
            check('V-001 the administrator repairs the duplicate through the employee flow',
                  status == 200 and repaired.get('phoneUpdated') is True,
                  {'status': status, 'body': repaired})
            index_after = db.scalar("SELECT COUNT(DISTINCT index_name) FROM information_schema.statistics "
                                    "WHERE table_schema=DATABASE() AND table_name='users' "
                                    "AND index_name='uq_users_login_phone'")
            check('V-001 the unique login key is established once the duplicate is repaired',
                  index_after == 1, {'uniqueIndex': index_after})
            # The repaired employee's new number signs in to the same identity; the other employee
            # still owns the original key.
            status_new, body_new = http('POST', base + '/auth/sessions',
                                        {'username': new_phone, 'password': different_password or PASSWORD})
            status_other, body_other = http('POST', base + '/auth/sessions',
                                            {'username': duplicate, 'password': PASSWORD})
            check('V-001 the repaired number keeps the original employee identity',
                  status_new == 200 and (body_new.get('user') or {}).get('id') == second_id,
                  {'status': status_new, 'userId': (body_new.get('user') or {}).get('id')})
            check('V-001 the original key now belongs unambiguously to the other employee',
                  status_other == 200 and (body_other.get('user') or {}).get('id') == first_id,
                  {'status': status_other, 'userId': (body_other.get('user') or {}).get('id')})

        after = foundation.fingerprint(db)
        disappeared = [log_id for log_id in before['logs'] if log_id not in after['logs']]
        archived = set(row[0] for row in db.rows('SELECT source_log_id FROM work_log_conflict_archive'))
        unexplained = [log_id for log_id in disappeared if log_id not in archived]
        survivors_unchanged = all(after['logs'][log_id]['createdAt'] == before['logs'][log_id]['createdAt']
                                  for log_id in after['logs'])
        check('V-001 original IDs, tasks, versions, assignees and logs survive the migration/repair',
              before['users'] == after['users'] and before['tasks'] == after['tasks']
              and before['versions'] == after['versions'] and before['assignees'] == after['assignees']
              and survivors_unchanged and not unexplained,
              {'before': {'users': len(before['users']), 'tasks': len(before['tasks']),
                          'logs': before['logRows']},
               'after': {'users': len(after['users']), 'tasks': len(after['tasks']),
                         'logs': after['logRows']}, 'archivedDuplicates': len(disappeared),
               'unexplained': unexplained})
    finally:
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=20)
            except subprocess.TimeoutExpired:
                process.kill()
        admin.server_side(f'DROP DATABASE IF EXISTS `{database}`')

    passed = sum(1 for row in RESULTS if row['pass'])
    print(f'\n{passed}/{len(RESULTS)} checks passed')
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps({
            'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
            'snapshot': str(args.snapshot), 'passed': passed, 'total': len(RESULTS),
            'results': RESULTS,
        }, ensure_ascii=False, indent=2) + '\n')
        print(f'wrote {args.output}')
    return 0 if passed == len(RESULTS) else 1


if __name__ == '__main__':
    raise SystemExit(main())
