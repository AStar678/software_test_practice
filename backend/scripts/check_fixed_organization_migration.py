#!/usr/bin/env python3
"""Exercise forward organization DDL on a disposable V20 database, never the application database.

Uses the existing private MySQL option file; no credentials or contacts enter the evidence.
This is a SQL constraint check. The full Flyway fresh/upgrade rehearsal remains a separate check.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import subprocess
import uuid

from migration_precheck import Mysql, MysqlError, DEFAULT_OPTION_FILE, BASE


def run(output: Path) -> None:
    database = 'pandora_precheck_fixed_' + uuid.uuid4().hex[:16]
    admin = Mysql(None, DEFAULT_OPTION_FILE)
    db = Mysql(database, DEFAULT_OPTION_FILE)
    migrations = BASE / 'src/main/resources/db/migration'
    historical = sorted((p for p in migrations.glob('V*__*.sql')
                         if int(p.name.split('__')[0][1:]) <= 20),
                        key=lambda p: int(p.name.split('__')[0][1:]))
    before = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in historical}
    report = {'updated': dt.datetime.now(dt.timezone.utc).isoformat(),
              'database': database, 'serverVersion': admin.rows('SELECT VERSION()')[0][0],
              'historicalChecksums': before, 'checks': []}

    def check(name: str, condition: bool) -> None:
        report['checks'].append({'check': name, 'pass': condition})
        if not condition:
            raise AssertionError(name)
        print('PASS ' + name)

    def reject(name: str, sql: str, expected_code: int) -> None:
        try:
            db.server_side(sql)
        except MysqlError as error:
            check(name, f'ERROR {expected_code} ' in str(error))
        else:
            check(name, False)

    try:
        admin.server_side(f'CREATE DATABASE `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
        for path in historical:
            db.import_sql(path, database)
        db.server_side("INSERT INTO organizations(id,name) VALUES('o1','One'),('o2','Two')")
        db.server_side("INSERT INTO departments(id,organization_id,name) "
                       "VALUES('d1','o1','First'),('d2','o1','Second'),('d3','o2','Other')")
        db.server_side("INSERT INTO positions(id,organization_id,name) VALUES('p1','o1','Title'),('p2','o2','Title')")
        db.server_side("INSERT INTO teams(id,organization_id,name,department_id) "
                       "VALUES('t1','o1','First','d1'),('t2','o1','Second','d2'),('t3','o2','Other','d3')")
        for employee in ('founder', 'department', 'team', 'employee', 'spare'):
            db.server_side("INSERT INTO users(id,organization_id,username,password_hash,display_name,role,rank_level,department_id,position_id) "
                           f"VALUES('{employee}','o1','{employee}','unused','Person','lower',3,'d1','p1')")
        db.server_side("INSERT INTO users(id,organization_id,username,password_hash,display_name,role,rank_level,department_id,position_id) "
                       "VALUES('other','o2','other','unused','Other','lower',3,'d3','p2')")
        # Reproduce the runtime tightening used by the previous release before upgrading.
        db.server_side('ALTER TABLE users MODIFY department_id VARCHAR(36) NOT NULL, MODIFY position_id VARCHAR(36) NOT NULL')
        ids_before = db.rows('SELECT id,created_at FROM users ORDER BY id')
        db.import_sql(migrations / 'V21__fixed_employee_placements.sql', database)
        check('stable employee IDs and creation times survive V21', ids_before == db.rows('SELECT id,created_at FROM users ORDER BY id'))
        check('migration never infers a founder from legacy roots', db.scalar('SELECT COUNT(*) FROM organizations WHERE founder_employee_id IS NOT NULL') == 0)
        check('explicit mapping blockers exist for both companies', db.scalar("SELECT COUNT(*) FROM migration_findings WHERE migration='V21' AND severity='blocker'") == 2)
        db.server_side("UPDATE organizations SET founder_employee_id='founder' WHERE id='o1'")
        insert = 'INSERT INTO employee_placements(organization_id,employee_id,placement_type,department_id,team_id,position_id) VALUES '
        db.server_side(insert + "('o1','founder','founder',NULL,NULL,'p1'),"
                       "('o1','department','department_head','d1',NULL,'p1'),"
                       "('o1','team','team_head','d1','t1','p1'),"
                       "('o1','employee','employee','d1','t1','p1')")
        check('all four placement types including department head without team are legal', db.scalar('SELECT COUNT(*) FROM employee_placements') == 4)
        db.server_side("UPDATE users SET department_id=NULL WHERE id='founder'")
        check('company-level founder is not forced into a legacy department', db.scalar("SELECT COUNT(*) FROM users WHERE id='founder' AND department_id IS NULL") == 1)
        reject('one employee cannot occupy two placements', insert + "('o1','employee','employee','d2','t2','p1')", 1062)
        reject('one company cannot have two founder slots', insert + "('o1','spare','founder',NULL,NULL,'p1')", 1062)
        reject('one department cannot have two heads', insert + "('o1','spare','department_head','d1',NULL,'p1')", 1062)
        reject('one team cannot have two heads', insert + "('o1','spare','team_head','d1','t1','p1')", 1062)
        reject('ordinary employee requires a team', insert + "('o1','spare','employee','d1',NULL,'p1')", 3819)
        reject('department head cannot occupy a team', insert + "('o1','spare','department_head','d1','t1','p1')", 3819)
        reject('founder cannot occupy a department', insert + "('o1','spare','founder','d1',NULL,'p1')", 3819)
        reject('unknown placement type is rejected', insert + "('o1','spare','deputy','d1','t1','p1')", 3819)
        reject('display position is required', insert + "('o1','spare','employee','d1','t1',NULL)", 1048)
        reject('cross-company employee is rejected', insert + "('o1','other','employee','d1','t1','p1')", 1452)
        reject('cross-company display position is rejected', insert + "('o1','spare','employee','d1','t1','p2')", 1452)
        reject('team must belong to its placement department', insert + "('o1','spare','employee','d1','t2','p1')", 1452)
        reject('cross-company founder reference is rejected', "UPDATE organizations SET founder_employee_id='other' WHERE id='o1'", 1452)
        # Preserve shared administrative provenance while removing its employee row entirely.
        db.server_side("INSERT INTO users(id,organization_id,username,password_hash,display_name,role,rank_level) "
                       "VALUES('admin1','o1','administrator','unchanged-hash','Administrator','admin',0),"
                       "('admin2','o2','administrator2','other-hash','Conflicted admin','admin',0)")
        db.server_side("INSERT INTO audit_logs(id,organization_id,actor_id,action,details_json) "
                       "VALUES('audit','o1','admin1','account.created','{}')")
        db.server_side("INSERT INTO auth_sessions(id,organization_id,user_id,token_hash,expires_at) "
                       "VALUES('session','o1','admin1',REPEAT('a',64),'2030-01-01')")
        db.server_side("INSERT INTO idempotency_keys(organization_id,user_id,scope,key_value,request_hash,response_json) "
                       "VALUES('o1','admin1','/admin/employees','example-key',REPEAT('b',64),'{}')")
        db.server_side("INSERT INTO domain_events(id,organization_id,event_type,recipients_json,details_json,initiator_id,revoked_by) "
                       "VALUES('event','o1','account.created','[]','{}','admin1','admin1')")
        db.server_side("INSERT INTO notifications(id,organization_id,event_id,recipient_id,event_type,summary) "
                       "VALUES('notice','o1','event','admin1','account.created','History')")
        db.server_side("INSERT INTO tasks(id,organization_id,original_creator_id) VALUES('task','o1','founder')")
        db.server_side("INSERT INTO task_versions(id,organization_id,task_id,version_no,title,description,acceptance_criteria,priority,start_at,due_at,execution_state,progress_note,status,created_by) "
                       "VALUES('version','o1','task',1,'Original','Body','','medium','2030-01-01','2030-01-02','todo','','applied','founder')")
        db.server_side("UPDATE tasks SET current_version_id='version' WHERE id='task'")
        db.server_side("INSERT INTO approval_requests(id,organization_id,task_id,proposed_version_id,applicant_id,current_reviewer_id,kind,status,previous_state,decided_by) "
                       "VALUES('old-request','o1','task','version','founder','founder','create','approved','todo','admin1')")
        db.server_side("INSERT INTO task_records(id,organization_id,task_id,author_id,body,kind) "
                       "VALUES('record','o1','task','admin1','Historical actor','legacy')")
        db.server_side("INSERT INTO task_history_entries(id,organization_id,task_id,actor_id,entry_type,detail_json) "
                       "VALUES('history','o1','task','admin1','legacy','{}')")
        db.server_side("INSERT INTO work_logs(id,organization_id,author_id,business_date,body) "
                       "VALUES('conflicted-log','o2','admin2','2026-10-28','Historical business relation')")
        db.import_sql(migrations / 'V22__independent_account_principals.sql', database)
        check('clean administrator needs no pseudo employee row', db.scalar("SELECT COUNT(*) FROM users WHERE id='admin1'") == 0)
        check('administrator ID and credential source survive extraction', db.rows(
            "SELECT a.id,a.account_name,a.password_hash,p.account_type FROM admin_accounts a "
            "JOIN principals p ON p.id=a.id WHERE a.id='admin1'") == [['admin1', 'administrator', 'unchanged-hash', 'admin']])
        check('old administrator audit resolves via principal after employee removal', db.scalar(
            "SELECT COUNT(*) FROM audit_logs a JOIN principals p ON p.id=a.actor_id "
            "WHERE a.id='audit' AND p.account_type='admin'") == 1)
        for table, column in (('auth_sessions','user_id'), ('idempotency_keys','user_id'),
                              ('domain_events','initiator_id'), ('domain_events','revoked_by'),
                              ('notifications','recipient_id'), ('task_records','author_id'),
                              ('task_history_entries','actor_id'), ('approval_requests','decided_by')):
            check(f'{table}.{column} retains shared administrator provenance', db.scalar(
                f"SELECT COUNT(*) FROM {table} WHERE {column}='admin1'") == 1)
        check('employee business history occupied by legacy administrator is retained and blocked', db.scalar(
            "SELECT COUNT(*) FROM migration_findings WHERE migration='V22' AND category='admin_business_reference' "
            "AND subject='admin2' AND resolved_at IS NULL") == 1
            and db.scalar("SELECT COUNT(*) FROM users WHERE id='admin2'") == 1
            and db.scalar("SELECT COUNT(*) FROM work_logs WHERE id='conflicted-log' AND author_id='admin2'") == 1)
        reject('independent administrator cannot occupy an employee placement', insert + "('o1','admin1','employee','d1','t1','p1')", 1452)
        reject('independent administrator cannot author a business log',
               "INSERT INTO work_logs(id,organization_id,author_id,business_date,body) VALUES('bad-log','o1','admin1','2026-10-28','Rejected')", 1452)
        reject('independent administrator cannot be an original task creator',
               "INSERT INTO tasks(id,organization_id,original_creator_id) VALUES('bad-task','o1','admin1')", 1452)
        check('employee-only current reviewer FK remains restricted to users', db.scalar(
            "SELECT COUNT(*) FROM information_schema.key_column_usage WHERE constraint_schema=DATABASE() "
            "AND table_name='approval_requests' AND column_name='current_reviewer_id' AND referenced_table_name='users'") == 1)
        reject('independent administrator cannot be a current business reviewer',
               "UPDATE approval_requests SET current_reviewer_id='admin1' WHERE id='old-request'", 1452)
        reject('independent administrator cannot become an effective assignee',
               "INSERT INTO task_version_assignees(organization_id,version_id,user_id,ordinal) "
               "VALUES('o1','version','admin1',0)", 1452)
        reject('employee cannot be used as an administrator credential principal',
               "UPDATE admin_accounts SET id='other' WHERE id='admin2'", 1452)
        provenance = db.rows("SELECT original_creator_id,created_at FROM tasks WHERE id='task'")
        db.import_sql(migrations / 'V23__task_business_ownership.sql', database)
        check('initial business responsibility belongs to the original employee creator', db.rows(
            "SELECT employee_id,row_version FROM task_business_owners WHERE task_id='task'") == [['founder', '1']])
        check('ownership migration fabricates no takeover history', db.scalar('SELECT COUNT(*) FROM task_business_transfers') == 0)
        reject('one task cannot have two current business owners',
               "INSERT INTO task_business_owners(organization_id,task_id,employee_id) VALUES('o1','task','employee')", 1062)
        reject('current business owner must belong to the task company',
               "UPDATE task_business_owners SET employee_id='other' WHERE task_id='task'", 1452)
        reject('independent administrator cannot be the current business owner',
               "UPDATE task_business_owners SET employee_id='admin1' WHERE task_id='task'", 1452)
        transfer = ('INSERT INTO task_business_transfers(id,organization_id,task_id,previous_employee_id,'
                    'next_employee_id,administrator_id,reason,owner_version) VALUES ')
        reject('takeover history requires a nonblank reason', transfer + "('bad','o1','task','founder','employee','admin1',' ',2)", 3819)
        reject('takeover administrator must be an admin principal', transfer + "('bad','o1','task','founder','employee','employee','Reason',2)", 1452)
        reject('takeover next owner must belong to the company', transfer + "('bad','o1','task','founder','other','admin1','Reason',2)", 1452)
        reject('takeover history cannot name an administrator as business owner', transfer + "('bad','o1','task','founder','admin1','admin1','Reason',2)", 1452)
        db.server_side('START TRANSACTION; UPDATE task_business_owners SET employee_id=\'employee\',row_version=2 '
                       "WHERE task_id='task'; " + transfer + "('transfer','o1','task','founder','employee','admin1','Departure',2); COMMIT")
        check('takeover keeps object, before/after owners, admin actor, time and reason', db.rows(
            'SELECT task_id,previous_employee_id,next_employee_id,administrator_id,reason,owner_version,'
            "occurred_at IS NOT NULL FROM task_business_transfers WHERE id='transfer'") == [
                ['task','founder','employee','admin1','Departure','2','1']])
        check('business takeover does not overwrite original creator or creation time', provenance == db.rows(
            "SELECT original_creator_id,created_at FROM tasks WHERE id='task'"))
        reject('same ownership version cannot record two takeover results', transfer + "('again','o1','task','founder','employee','admin1','Departure',2)", 1062)
        check('V1–V20 files match Git HEAD', all(
            subprocess.run(['git', 'show', 'HEAD:backend/src/main/resources/db/migration/' + p.name],
                           cwd=BASE, capture_output=True, check=True).stdout == p.read_bytes() for p in historical))
        check('V1–V20 checksums remain unchanged during the check', before == {
            p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in historical})
        report['result'] = 'PASS'
    except Exception as error:
        report['result'] = 'FAIL'
        report['errorType'] = type(error).__name__
        raise
    finally:
        admin.server_side(f'DROP DATABASE IF EXISTS `{database}`')
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=BASE.parent / 'audit/refactor-pandora-organization-and-workflows/placement-migration.json')
    run(parser.parse_args().output)
