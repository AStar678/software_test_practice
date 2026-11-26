#!/usr/bin/env python3
"""Real demo-preparation acceptance for synthetic identity documents and the renamed demo position.

Creates a throwaway database, explicitly prepares it with the packaged demo seed, starts read-only services
against it and proves: every demo employee has a unique, format/check-digit valid synthetic identity number;
the founder display title is 创始人; a repeated preparation and a normal startup preserve existing edits and
write nothing; exact identity search works on the demo directory; and onboarding still refuses a missing
identity number.
"""
import contextlib
import datetime as dt
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

from fixed_model_fixture import quote
from migration_precheck import BASE, DEFAULT_OPTION_FILE, Mysql
from prepare_demo import database_env, prepare

AUDIT = BASE.parent / 'audit/refactor-pandora-organization-and-workflows'
OUTPUT = AUDIT / 'admin-offboarding-demo.json'
LOG = AUDIT / 'admin-offboarding-demo.log'
JAR = BASE / 'target/pandora-backend-0.1.0.jar'
WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
CODES = '10X98765432'


def valid_identity(value: str) -> bool:
    if len(value) != 18 or not value[:17].isdigit() or value[17] not in '0123456789X':
        return False
    if not value.startswith('9900'):
        return False
    total = sum(int(value[i]) * WEIGHTS[i] for i in range(17))
    return value[17] == CODES[total % 11]


@contextlib.contextmanager
def service(database, port):
    values = database_env()
    env = {**os.environ, **values,
           'PANDORA_DB_URL': f'jdbc:mysql://127.0.0.1:13306/{database}?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true&allowPublicKeyRetrieval=true&sslMode=DISABLED',
           'PANDORA_PORT': str(port), 'PANDORA_BIND_ADDRESS': '127.0.0.1', 'PANDORA_SEED': 'false',
           'PANDORA_WORKER_ENABLED': 'false'}
    with LOG.open('a') as log:
        process = subprocess.Popen(['java', '-jar', str(JAR)], env=env, stdout=log, stderr=subprocess.STDOUT)
    try:
        for _ in range(180):
            if process.poll() is not None:
                raise RuntimeError('service failed; see ' + str(LOG))
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{port}/health', timeout=1) as response:
                    if response.status == 200:
                        break
            except OSError:
                pass
            time.sleep(.5)
        else:
            raise RuntimeError('service startup timeout')
        yield f'http://127.0.0.1:{port}/api/v1'
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=10)


def call(base, method, path, body=None, token=None, key=None, version=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if key:
        headers['Idempotency-Key'] = key
    if version is not None:
        headers['If-Match'] = '"' + str(version) + '"' 
    request = urllib.request.Request(base + path, data=None if body is None else json.dumps(body).encode(),
                                     headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read() or '{}')
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read() or '{}')


def main() -> int:
    report = {'updated': dt.datetime.now(dt.timezone.utc).isoformat(), 'checks': []}

    def check(name, condition, evidence=None):
        report['checks'].append({'check': name, 'pass': bool(condition), 'evidence': evidence})
        print(('PASS  ' if condition else 'FAIL  ') + name, flush=True)
        if not condition:
            raise AssertionError(name + ' -> ' + json.dumps(evidence, ensure_ascii=False, default=str)[:800])

    database = 'pandora_e13_offboard_demo_' + uuid.uuid4().hex[:12]
    admin = Mysql(None, DEFAULT_OPTION_FILE)
    db = Mysql(database, DEFAULT_OPTION_FILE)
    manifest = Path('/tmp') / (database + '-manifest.json')
    password = os.environ.get('PANDORA_DEMO_PASSWORD', '111')
    try:
        admin.server_side(f'CREATE DATABASE `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
        values = database_env()
        for host in ('localhost', '127.0.0.1'):
            admin.server_side(f'GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,REFERENCES,DROP ON `{database}`.* '
                              'TO ' + quote(values['PANDORA_DB_USER']) + '@' + quote(host))
        prepare(database, 'e13-offboarding-demo', initialize=True, port=18201, output=manifest)

        employees = db.rows('SELECT id,display_name FROM users WHERE organization_id=' + quote('10000000-0000-0000-0000-000000000001'))
        documents = db.rows('SELECT employee_id,id_card_no FROM employee_identity_documents')
        check('a fresh explicit demo preparation records one identity document per demo employee',
              len(documents) == len(employees) and len(employees) == 14, {'employees': len(employees), 'documents': len(documents)})
        numbers = [row[1] for row in documents]
        check('every demo identity number is unique', len(set(numbers)) == len(numbers))
        check('every demo identity number passes the hire format and check digit', all(valid_identity(n) for n in numbers),
              [n for n in numbers if not valid_identity(n)])
        check('demo identity numbers use the reserved non-real region segment',
              all(n.startswith('9900') for n in numbers))
        admin_id = db.rows("SELECT object_id FROM demo_seed_keys WHERE seed_key='admin'")[0][0]
        check('the independent administrator receives no employee identity document',
              not any(row[0] == admin_id for row in documents)
              and db.scalar('SELECT COUNT(*) FROM employee_identity_documents d LEFT JOIN users u '
                            'ON u.organization_id=d.organization_id AND u.id=d.employee_id WHERE u.id IS NULL') == 0)
        titles = {row[0] for row in db.rows('SELECT name FROM positions')}
        check('the demo founder display title is 创始人', '创始人' in titles)
        check('the retired demo title 总导演 is not seeded', '总导演' not in titles)

        # Exact identity search and the unchanged onboarding rule on the prepared demo directory.
        base = None
        with service(database, 18202) as api:
            status, session = call(api, 'POST', '/auth/sessions', {'accountType': 'admin', 'accountName': 'admin', 'password': password})
            check('the prepared demo administrator can log in', status == 200 and session.get('token'), session)
            token = session['token']
            target = next(row for row in documents if row[0] ==
                          db.rows("SELECT object_id FROM demo_seed_keys WHERE seed_key='employee'")[0][0])
            status, found = call(api, 'POST', '/admin/employees/search', {'q': target[1].lower()}, token)
            check('a demo full identity number is exactly searchable', status == 200 and found.get('total') == 1,
                  {'status': status, 'total': found.get('total'), 'code': found.get('code')})
            check('the demo directory response stays masked and omits the full number',
                  found['items'][0]['idCardNoMasked'].endswith(target[1][-4:])
                  and target[1] not in json.dumps(found, ensure_ascii=False))
            status, listing = call(api, 'GET', '/admin/employees', token=token)
            check('the full demo directory never returns a complete identity number',
                  all(row.get('idCardNoMasked') and len(row['idCardNoMasked']) == 18 for row in listing['items'])
                  and all(row[1] not in json.dumps(listing, ensure_ascii=False) for row in documents))
            status, rejected = call(api, 'POST', '/admin/employees', {
                'displayName': '无证件入职', 'phone': '13977776666', 'placementType': 'employee',
                'departmentId': db.rows("SELECT object_id FROM demo_seed_keys WHERE seed_key='department-story'")[0][0],
                'teamId': db.rows("SELECT object_id FROM demo_seed_keys WHERE seed_key='team-story-board'")[0][0],
                'positionId': str(uuid.uuid4())}, token, key='demo-missing-id-' + uuid.uuid4().hex)
            check('formal onboarding still rejects a missing identity number', status == 400, rejected)

            # Edit a demo position and one identity document, so the repeated preparation can prove preservation.
            position = db.rows("SELECT object_id FROM demo_seed_keys WHERE seed_key='title-founder'")[0][0]
            position_version = db.rows('SELECT row_version FROM positions WHERE id=' + quote(position))[0][0]
            status, renamed = call(api, 'PATCH', '/admin/positions/' + position,
                                   {'name': '创始人（已编辑）'}, token, version=position_version,
                                   key='demo-position-' + uuid.uuid4().hex)
            check('the demo founder position can be edited', status == 200, renamed)
            employee_detail = call(api, 'GET', '/admin/employees/' + target[0], token=token)[1]
            status, identity = call(api, 'PATCH', '/admin/employees/' + target[0],
                                    {'idCardNo': '990099199001010019'}, token,
                                    version=employee_detail['rowVersion'], key='demo-identity-' + uuid.uuid4().hex)
            check('a demo identity document can be corrected by the administrator', status == 200, identity)

        before_docs = db.rows('SELECT employee_id,id_card_no,row_version FROM employee_identity_documents ORDER BY employee_id')
        before_prepared = db.rows('SELECT prepared_at FROM demo_database_identity')
        before_titles = db.rows('SELECT id,name,row_version FROM positions ORDER BY id')
        prepare(database, 'e13-offboarding-demo', initialize=False, port=18203, output=manifest)
        check('a repeated preparation preserves edited identity documents and the edited position',
              db.rows('SELECT employee_id,id_card_no,row_version FROM employee_identity_documents ORDER BY employee_id') == before_docs
              and db.rows('SELECT id,name,row_version FROM positions ORDER BY id') == before_titles)
        check('a repeated preparation does not prepare the demo database again',
              db.rows('SELECT prepared_at FROM demo_database_identity') == before_prepared)
        with service(database, 18204):
            pass
        check('a normal seeded startup writes neither identity documents nor positions',
              db.rows('SELECT employee_id,id_card_no,row_version FROM employee_identity_documents ORDER BY employee_id') == before_docs
              and db.rows('SELECT id,name,row_version FROM positions ORDER BY id') == before_titles)
    finally:
        try:
            admin.server_side(f'DROP DATABASE IF EXISTS `{database}`')
        except Exception:
            pass
        for path in (manifest,):
            try:
                path.unlink()
            except FileNotFoundError:
                pass
        report['updated'] = dt.datetime.now(dt.timezone.utc).isoformat()
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str))
        failed = [row for row in report['checks'] if not row['pass']]
        print(json.dumps({'total': len(report['checks']), 'failed': len(failed), 'report': str(OUTPUT)},
                         ensure_ascii=False), flush=True)
    return 0 if not failed else 1


if __name__ == '__main__':
    raise SystemExit(main())
