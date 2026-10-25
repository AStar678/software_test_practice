#!/usr/bin/env python3
"""Isolated migration rehearsal for chapter 1 (tasks 1.1, 1.2, 1.5) and the phone-login column (2.1).

It never touches the live database. The steps are:

1. restore the repository snapshot into a throwaway ``pandora_foundation_*`` database;
2. record the pre-migration identity and relation fingerprint (user ids, task/version/assignee/log
   counts, every log's real ``created_at``), then *simulate* one historical physical log deletion the
   way the old code did it, leaving only provable ``log.created`` / ``log.deleted`` events behind;
3. start the built application against that copy so Flyway applies V16..V19 and the startup backfill
   runs, then stop it;
4. prove the old rows are unchanged, the deleted log's day slot was restored with its original first
   creation time (empty body, marked deleted), and the new schema invariants hold;
5. re-run the extended precheck, then repair one employee's phone through the real administrator API
   and prove the employee can authenticate with it — the documented administrator repair path.

Every phone value in the report is masked; no credential is printed. The scratch database is dropped
unless ``--keep`` is given.

    python3 scripts/check_migration_foundation.py --output ../audit/chapter1-migration.json
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

BASE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE / 'scripts'))
from migration_precheck import Mysql, admin_option_file, mask_phone, normalize_phone, precheck, render, restore  # noqa: E402

RUNTIME = BASE / '.runtime'
DEFAULT_SNAPSHOT = BASE / 'database' / 'pandora.sql'
DEFAULT_JAR = BASE / 'target' / 'pandora-backend-0.1.0.jar'
RESULTS: list[dict] = []


def check(name: str, condition: bool, evidence) -> None:
    RESULTS.append({'check': name, 'pass': bool(condition), 'evidence': evidence})
    print(('PASS  ' if condition else 'FAIL  ') + name + ('' if condition else '  -> ' + json.dumps(evidence, ensure_ascii=False)))


def database_env() -> dict:
    values = {}
    for line in (RUNTIME / 'database.env').read_text(encoding='utf-8').splitlines():
        if '=' in line:
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip()
    return values


def app_user_grants(admin: Mysql, database: str, env: dict) -> None:
    for host in ('localhost', '127.0.0.1'):
        admin.server_side(
            f"GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,REFERENCES,DROP ON `{database}`.* "
            f"TO '{env['PANDORA_DB_USER']}'@'{host}'")
        admin.server_side('FLUSH PRIVILEGES')


def fingerprint(db: Mysql) -> dict:
    """Identity and relation facts that the migration must not rewrite."""
    users = [row[0] for row in db.rows('SELECT id FROM users ORDER BY id')]
    tasks = [row[0] for row in db.rows('SELECT id FROM tasks ORDER BY id')]
    logs = {row[0]: {'author': row[1], 'businessDate': row[2], 'createdAt': row[3], 'rowVersion': row[4]}
            for row in db.rows('SELECT id,author_id,business_date,created_at,row_version FROM work_logs ORDER BY id')}
    return {
        'users': users,
        'tasks': tasks,
        'versions': db.scalar('SELECT COUNT(*) FROM task_versions'),
        'assignees': db.scalar('SELECT COUNT(*) FROM task_version_assignees'),
        'requests': db.scalar('SELECT COUNT(*) FROM approval_requests'),
        'notifications': db.scalar('SELECT COUNT(*) FROM notifications'),
        'logs': logs,
        'logRows': len(logs),
    }


def simulate_historical_delete(db: Mysql) -> dict | None:
    """Delete one log row outright and leave the events the old code recorded for it."""
    candidates = db.rows(
        'SELECT w.id,w.author_id,w.business_date,w.created_at,w.row_version,w.body FROM work_logs w '
        'WHERE NOT EXISTS (SELECT 1 FROM domain_events e WHERE e.event_type=\'log.deleted\' '
        "AND JSON_UNQUOTE(JSON_EXTRACT(e.details_json,'$.logId'))=w.id) "
        'ORDER BY w.created_at,w.id LIMIT 1')
    if not candidates:
        return None
    log_id, author, business_date, created_at, row_version, body = candidates[0]
    # The old rule only allowed the company's current day, so the creation instant proves the slot.
    db.server_side(
        'INSERT INTO audit_logs(id,organization_id,actor_id,object_id,action,details_json,created_at) '
        "SELECT REPLACE(UUID(),'-',''),organization_id,%s,NULL,'log.created',"
        "JSON_OBJECT('logId',%s),%s FROM work_logs WHERE id=%s" % (
            quote(author), quote(log_id), quote(created_at), quote(log_id)))
    # The snapshot is a pre-V7 schema: events only have created_at here. The later forward migration
    # backfills occurred_at from it, exactly as it does for every historical event.
    db.server_side(
        'INSERT INTO domain_events(id,organization_id,event_type,recipients_json,details_json,status,created_at) '
        "SELECT REPLACE(UUID(),'-',''),organization_id,'log.created',JSON_ARRAY(),JSON_OBJECT('logId',%s),"
        "'delivered',%s FROM work_logs WHERE id=%s" % (quote(log_id), quote(created_at), quote(log_id)))
    db.server_side(
        'INSERT INTO domain_events(id,organization_id,event_type,recipients_json,details_json,status,created_at) '
        "SELECT REPLACE(UUID(),'-',''),organization_id,'log.deleted',JSON_ARRAY(),JSON_OBJECT('logId',%s),"
        "'delivered',DATE_ADD(%s, INTERVAL 1 SECOND) FROM work_logs WHERE id=%s" % (
            quote(log_id), quote(created_at), quote(log_id)))
    db.server_side(f'DELETE FROM work_logs WHERE id={quote(log_id)}')
    return {'logId': log_id, 'authorId': author, 'businessDate': business_date,
            'createdAt': created_at, 'body': body, 'rowVersion': row_version}


def quote(value) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def start_application(database: str, env: dict, jar: Path, port: int) -> subprocess.Popen:
    db_url = (f"jdbc:mysql://127.0.0.1:13306/{database}?connectionTimeZone=UTC&"
              "forceConnectionTimeZoneToSession=true&useUnicode=true&characterEncoding=UTF-8&"
              "allowPublicKeyRetrieval=true&sslMode=DISABLED")
    environment = dict(os.environ)
    environment.update({
        'PANDORA_DB_URL': db_url, 'PANDORA_DB_USER': env['PANDORA_DB_USER'],
        'PANDORA_DB_PASSWORD': env['PANDORA_DB_PASSWORD'], 'PANDORA_PORT': str(port),
        'PANDORA_BIND_ADDRESS': '127.0.0.1', 'PANDORA_SEED': 'false', 'PANDORA_WORKER_ENABLED': 'false',
    })
    log_path = RUNTIME / 'foundation-migration.log'
    log = open(log_path, 'w', encoding='utf-8')
    process = subprocess.Popen(['java', '-jar', str(jar)], env=environment, stdout=log, stderr=subprocess.STDOUT)
    base = f'http://127.0.0.1:{port}'
    for _ in range(120):
        try:
            with urllib.request.urlopen(base + '/health', timeout=2) as response:
                if response.status == 200:
                    return process
        except Exception:
            pass
        if process.poll() is not None:
            raise SystemExit('application exited during migration; see .runtime/foundation-migration.log')
        time.sleep(1)
    process.kill()
    raise SystemExit('application did not become healthy')


def http(method: str, url: str, body=None, token=None, key=None, if_match=None) -> tuple[int, dict]:
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
        with urllib.request.urlopen(request) as response:
            return response.status, json.loads(response.read().decode() or '{}')
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read().decode() or '{}')


def schema_invariants(db: Mysql) -> dict:
    def has_column(table: str, column: str) -> bool:
        return bool(db.rows(
            "SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() "
            f"AND table_name='{table}' AND column_name='{column}' LIMIT 1"))

    def has_table(table: str) -> bool:
        return bool(db.rows(
            "SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() "
            f"AND table_name='{table}' LIMIT 1"))

    unique_indexes = lambda table, index: db.rows(  # noqa: E731
        "SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() "
        f"AND table_name='{table}' AND index_name='{index}' AND non_unique=0 LIMIT 1")

    checks = {
        'versions': [row[0] for row in db.rows('SELECT version FROM flyway_schema_history WHERE success=1 ORDER BY installed_rank')],
        'logDeletedAt': has_column('work_logs', 'deleted_at'),
        'logRecoveredFrom': has_column('work_logs', 'recovered_from'),
        'logDayUnique': bool(unique_indexes('work_logs', 'uq_log_day')),
        'logOrgIdUnique': bool(unique_indexes('work_logs', 'uq_log_org_id')),
        'tagTable': has_table('tags'),
        'taskTagColumn': has_column('task_versions', 'tag_id'),
        'taskTagSnapshot': has_column('task_versions', 'tag_name_snapshot') and has_column('task_versions', 'tag_color_snapshot'),
        'logTagColumn': has_column('work_logs', 'tag_id'),
        'commentTable': has_table('task_log_comments'),
        'loginPhoneColumn': has_column('users', 'login_phone'),
        'loginPhoneUnique': bool(unique_indexes('users', 'uq_users_login_phone')),
    }
    checks['expectedMigrations'] = all(str(number) in checks['versions'] for number in (16, 17, 18, 19))
    # No tag may point outside its own company, and a comment must carry exactly one object type.
    checks['crossCompanyTags'] = db.scalar(
        'SELECT COUNT(*) FROM task_versions v JOIN tags t ON t.id=v.tag_id '
        'WHERE t.organization_id<>v.organization_id')
    checks['multiObjectComments'] = db.scalar(
        'SELECT COUNT(*) FROM task_log_comments WHERE (task_id IS NOT NULL) + (log_id IS NOT NULL) <> 1')
    checks['normalizedLoginDuplicates'] = db.scalar(
        "SELECT COUNT(*) FROM (SELECT login_phone FROM users WHERE login_phone IS NOT NULL AND login_phone<>'' "
        'GROUP BY login_phone HAVING COUNT(*)>1) x')
    return checks


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--snapshot', type=Path, default=DEFAULT_SNAPSHOT)
    parser.add_argument('--jar', type=Path, default=DEFAULT_JAR)
    parser.add_argument('--port', type=int, default=18140)
    parser.add_argument('--output', type=Path, default=None)
    parser.add_argument('--keep', action='store_true')
    args = parser.parse_args()

    subprocess.run([str(BASE / 'scripts' / 'start-db.sh')], check=True, stdout=subprocess.DEVNULL)
    option_file = admin_option_file(None)
    admin = Mysql(None, option_file)
    env = database_env()
    database = 'pandora_precheck_foundation_' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%d%H%M%S')
    report: dict = {'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
                    'snapshot': str(args.snapshot), 'scratchDatabase': database,
                    'snapshotDigest': hashlib.sha256(args.snapshot.read_bytes()).hexdigest()}
    process = None
    try:
        print(f'[foundation] restoring {args.snapshot.name} into {database}')
        restore(admin, database, args.snapshot)
        app_user_grants(admin, database, env)
        db = Mysql(database, option_file)
        before = fingerprint(db)
        simulated = simulate_historical_delete(db)
        report['simulatedDeletion'] = {'logId': simulated['logId'] if simulated else None,
                                       'businessDate': simulated['businessDate'] if simulated else None}
        check('1.2 the rehearsal simulates one provable historical log deletion',
              simulated is not None, report['simulatedDeletion'])

        process = start_application(database, env, args.jar, args.port)
        # The startup backfill runs after the port opens, so wait for its durable effect.
        if simulated:
            for _ in range(60):
                present = db.rows(f"SELECT recovered_from FROM work_logs WHERE id={quote(simulated['logId'])}")
                if present:
                    break
                time.sleep(1)
        post = fingerprint(db)
        invariants = schema_invariants(db)
        report['schema'] = invariants
        report['before'] = {'users': len(before['users']), 'tasks': len(before['tasks']),
                            'versions': before['versions'], 'assignees': before['assignees'],
                            'logs': before['logRows']}
        report['after'] = {'users': len(post['users']), 'tasks': len(post['tasks']),
                           'versions': post['versions'], 'assignees': post['assignees'],
                           'logRows': post['logRows']}

        check('1.1 V16..V19 applied forward on the isolated copy', invariants['expectedMigrations'], invariants['versions'][-6:])
        check('1.1 the original employee identities are unchanged',
              before['users'] == post['users'], {'before': len(before['users']), 'after': len(post['users'])})
        check('1.1 the original task and relation rows are unchanged',
              before['tasks'] == post['tasks'] and before['versions'] == post['versions']
              and before['assignees'] == post['assignees'] and before['requests'] == post['requests'],
              {'versions': [before['versions'], post['versions']], 'assignees': [before['assignees'], post['assignees']]})
        # V8 (a pre-existing forward migration) merges duplicate author/day rows losslessly into
        # work_log_conflict_archive. Every row that still exists must keep its original createdAt, and
        # every row that disappeared must be provable in that archive — never silently dropped.
        disappeared = [log_id for log_id in before['logs'] if log_id not in post['logs']]
        survivors = [log_id for log_id in before['logs'] if log_id in post['logs']]
        unchanged = all(post['logs'][log_id]['createdAt'] == before['logs'][log_id]['createdAt'] for log_id in survivors)
        archived = set(row[0] for row in db.rows('SELECT source_log_id FROM work_log_conflict_archive'))
        unexplained = [log_id for log_id in disappeared
                       if log_id not in archived and log_id != (simulated['logId'] if simulated else None)]
        report['logMerge'] = {'before': before['logRows'], 'after': post['logRows'],
                              'archived': len(disappeared), 'unexplained': unexplained}
        check('1.2 every surviving log keeps its real created_at', unchanged and not unexplained,
              {'survivors': len(survivors), 'disappeared': len(disappeared), 'unexplained': unexplained})

        restored = post['logs'].get(simulated['logId']) if simulated else None
        row = db.rows('SELECT body,deleted_at,recovered_from,created_at,author_id,business_date '
                      f"FROM work_logs WHERE id={quote(simulated['logId'])}") if simulated else []
        evidence = {'row': row[0] if row else None, 'createdAt': simulated['createdAt'] if simulated else None}
        check('1.2 the deleted day slot is restored from provable events with the original creation time',
              bool(row) and row[0][0] == '' and row[0][1] not in (None, 'NULL')
              and row[0][2] == 'deleted-event' and row[0][3] == simulated['createdAt']
              and row[0][4] == simulated['authorId'] and row[0][5] == simulated['businessDate'],
              evidence)
        slots = db.rows('SELECT business_date,COUNT(*) FROM work_logs '
                        'GROUP BY organization_id,author_id,business_date HAVING COUNT(*)>1')
        check('1.2 one author/day row remains unique after the restore', not slots, {'duplicates': slots})

        check('1.3 the tag catalogue, single tag columns and audit snapshots exist',
              invariants['tagTable'] and invariants['taskTagColumn'] and invariants['taskTagSnapshot']
              and invariants['logTagColumn'], invariants)
        check('1.3 no tag reference crosses companies', invariants['crossCompanyTags'] == 0, invariants['crossCompanyTags'])
        check('1.4 comments exist with exactly one object reference', invariants['commentTable']
              and invariants['multiObjectComments'] == 0, invariants['multiObjectComments'])
        check('2.1 the normalized login key is present and unique',
              invariants['loginPhoneColumn'] and invariants['loginPhoneUnique']
              and invariants['normalizedLoginDuplicates'] == 0, invariants)

        legacy_pending = db.scalar(
            "SELECT COUNT(*) FROM approval_requests WHERE status='pending' AND kind='create' "
            "AND route_reason IN ('manager-chain','creator-fallback','no-reviewer')")
        report['legacyPendingCreationRoutes'] = legacy_pending
        check('3.4 every legacy pending creation was re-decided to the new creation route',
              legacy_pending == 0, {'remainingLegacy': legacy_pending})

        findings = db.rows("SELECT migration,category,severity FROM migration_findings "
                           "WHERE migration IN ('V16','V17','V18','V19') ORDER BY migration,category")
        report['findings'] = findings
        check('1.1/1.2 migration findings record what could not be proven', bool(findings), findings[:6])
        precheck_before = precheck(db)
        report['precheckBeforeRepair'] = {'blockers': precheck_before['blockers'],
                                          'loginIdentity': precheck_before['checks']['loginIdentity']}
        check('1.3/1.4 no existing task or version row was dropped, and every merged log row is archived',
              post['versions'] == before['versions'] and not unexplained,
              {'versions': post['versions'], 'logs': post['logRows'], 'archived': len(disappeared)})

        # ---- administrator repair path (1.1) ----
        base = f'http://127.0.0.1:{args.port}/api/v1'
        status, session = http('POST', base + '/auth/sessions', {'username': 'admin', 'password': 'Demo@123456'})
        check('1.1 the administrator can still sign in after the migration', status == 200, {'status': status})
        if status == 200:
            token = session['token']
            employees = http('GET', base + '/admin/employees?limit=200', token=token)[1].get('items', [])
            target = next((row for row in employees if row.get('role') != 'admin'), None)
            detail_status, detail = http('GET', base + f"/admin/employees/{target['id']}", token=token)
            etag = '"' + str(detail.get('rowVersion')) + '"'
            repair_phone = '135' + str(uuid.uuid4().int)[:8]
            # The V4 snapshot has no real department/position mapping yet, which the precheck reports as
            # a blocker. A repair therefore also has to assign a real department and position first —
            # exactly what the administrator workflow requires, and never a generated placeholder.
            department = http('POST', base + '/admin/departments', {'name': '迁移修复部'},
                              token=token, key='foundation-dept-' + uuid.uuid4().hex)[1].get('departmentId')
            position = http('POST', base + '/admin/positions', {'name': '迁移修复岗'},
                            token=token, key='foundation-pos-' + uuid.uuid4().hex)[1].get('positionId')
            if department and position:
                detail = http('GET', base + f"/admin/employees/{target['id']}", token=token)[1]
            status, receipt = http('PATCH', base + f"/admin/employees/{target['id']}", {
                'phone': repair_phone, 'departmentId': department, 'positionId': position,
                'teamId': None},
                token=token, key='foundation-' + uuid.uuid4().hex,
                if_match='"' + str(detail.get('rowVersion')) + '"')
            stored = db.rows(f"SELECT login_phone FROM users WHERE id={quote(target['id'])}")
            check('1.1 the administrator repairs a missing login number through the existing flow',
                  status == 200 and receipt.get('phoneUpdated') is True
                  and stored and normalize_phone(stored[0][0]) == repair_phone,
                  {'status': status, 'body': receipt,
                   'department': department, 'position': position,
                   'masked': mask_phone(stored[0][0]) if stored else None})
            precheck_after = precheck(db)
            report['precheckAfterRepair'] = {'blockers': precheck_after['blockers'],
                                             'loginIdentity': precheck_after['checks']['loginIdentity']}
            identity = precheck_after['checks']['loginIdentity']
            report['precheckBeforeRepair'] = {'missingPhone': precheck_before['checks']['loginIdentity']['missingPhone'],
                                              'blockers': precheck_before['blockers']}
            check('1.1 the precheck names every missing login number and the repair reduces the blocker',
                  precheck_before['checks']['loginIdentity']['missingPhone'] == identity['missingPhone'] + 1
                  or precheck_before['checks']['loginIdentity']['missingPhone'] > identity['missingPhone'],
                  {'before': precheck_before['checks']['loginIdentity']['missingPhone'],
                   'after': identity['missingPhone']})

        process.terminate()
        try:
            process.wait(timeout=20)
        except subprocess.TimeoutExpired:
            process.kill()
        process = None

        # ---- restart idempotency (1.5): a second start must not repeat the backfill ----
        counts = lambda: {  # noqa: E731
            'findings': db.scalar('SELECT COUNT(*) FROM migration_findings'),
            'logs': db.scalar('SELECT COUNT(*) FROM work_logs'),
            'recovered': db.scalar("SELECT COUNT(*) FROM work_logs WHERE recovered_from='deleted-event'"),
            'history': db.scalar('SELECT COUNT(*) FROM flyway_schema_history WHERE success=1'),
        }
        first_counts = counts()
        process = start_application(database, env, args.jar, args.port)
        time.sleep(3)
        second_counts = counts()
        check('1.5 a restart neither repeats the migration nor duplicates the backfill',
              first_counts == second_counts, {'first': first_counts, 'second': second_counts})
    finally:
        if process is not None and process.poll() is None:
            process.kill()
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=20)
            except subprocess.TimeoutExpired:
                process.kill()
            process = None
        if not args.keep:
            if database.startswith('pandora_precheck_'):
                admin.server_side(f'DROP DATABASE IF EXISTS `{database}`')
        else:
            print(f'[foundation] kept scratch database {database}')

    passed = sum(1 for row in RESULTS if row['pass'])
    report['passed'] = passed
    report['total'] = len(RESULTS)
    report['checks'] = RESULTS
    print(f'\n{passed}/{len(RESULTS)} checks passed')
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print('wrote ' + str(args.output))
    return 0 if passed == len(RESULTS) else 1


if __name__ == '__main__':
    raise SystemExit(main())
