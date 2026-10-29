#!/usr/bin/env python3
"""Rehearse explicit stable-ID legacy mapping on a disposable V20 database (task 1.4).

The check creates a random MySQL database, imports the historical V1-V20 files, inserts two
companies with departments, teams, positions, employees, administrators and business history,
then applies V21-V24. It validates the mapping tool on that database, applies the generated plan
to the isolated schema, and proves that malformed mappings are refused without a write.

This is a SQL/tool contract check. It does not start the application JAR, so the HTTP
``POST /api/v1/admin/organization-plans`` endpoint is not exercised here; the generated payload is
compared against the request contract enforced by ``OrganizationPlans``/``CompanyTree`` instead.
"""
from __future__ import annotations

import argparse
import copy
import datetime as dt
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import uuid

from migration_precheck import (
    BASE,
    DEFAULT_OPTION_FILE,
    Mysql,
    fingerprint,
    mapping_report,
    mask_phone,
    normalize_phone,
)


OUTPUT = BASE.parent / 'audit/refactor-pandora-organization-and-workflows/legacy-mapping.json'
PHONE_NUMBERS = (
    '13800000001', '13800000002', '13800000003', '13800000004', '13800000005',
    '13800000006', '13800000007', '13800000008', '13800000009', '13800000010',
    '13800000011', '13800000020', '13800000021', '13800000022', '13800000023',
    '+8613800000006',
)


def quote(value) -> str:
    return 'NULL' if value is None else "'" + str(value).replace("'", "''") + "'"


def insert_user(db: Mysql, organization_id: str, user_id: str, username: str, display_name: str,
                phone: str | None, role: str, rank: int, department_id: str | None,
                team_id: str | None, position_id: str | None, manager_id: str | None,
                active: int = 1) -> None:
    login_phone = normalize_phone(phone) if phone else None
    db.server_side(
        'INSERT INTO users(id,organization_id,username,password_hash,display_name,role,rank_level,'
        'active,department_id,team_id,position_id,manager_id,phone,login_phone) VALUES ('
        f'{quote(user_id)},{quote(organization_id)},{quote(username)},'
        f"'unused',{quote(display_name)},{quote(role)},{rank},{active},"
        f'{quote(department_id)},{quote(team_id)},{quote(position_id)},{quote(manager_id)},'
        f'{quote(phone)},{quote(login_phone)})')


def legal_mapping() -> dict:
    employees = [
        ('founder', '13800000001'),
        ('dh1', '13800000002'),
        ('th1', '138 0000 0003'),
        ('e1', '13800000004'),
        ('dh2', '13800000005'),
        ('th2', '+86-13800000006'),
        ('th3', '13800000007'),
        ('th4', '13800000009'),
        ('e2', '13800000008'),
        ('e3', '13800000010'),
    ]
    placements = [
        {'employeeId': 'founder', 'placementType': 'founder', 'positionId': 'o1-p1'},
        {'employeeId': 'dh1', 'placementType': 'department_head',
         'departmentId': 'o1-d1', 'positionId': 'o1-p2'},
        {'employeeId': 'dh2', 'placementType': 'department_head',
         'departmentId': 'o1-d2', 'positionId': 'o1-p2'},
        {'employeeId': 'th1', 'placementType': 'team_head',
         'departmentId': 'o1-d1', 'teamId': 'o1-t1', 'positionId': 'o1-p4'},
        {'employeeId': 'th4', 'placementType': 'team_head',
         'departmentId': 'o1-d1', 'teamId': 'o1-t2', 'positionId': 'o1-p4'},
        {'employeeId': 'th2', 'placementType': 'team_head',
         'departmentId': 'o1-d2', 'teamId': 'o1-t3', 'positionId': 'o1-p4'},
        {'employeeId': 'th3', 'placementType': 'team_head',
         'departmentId': 'o1-d2', 'teamId': 'o1-t4', 'positionId': 'o1-p4'},
        {'employeeId': 'e1', 'placementType': 'employee',
         'departmentId': 'o1-d1', 'teamId': 'o1-t1', 'positionId': 'o1-p1'},
        {'employeeId': 'e2', 'placementType': 'employee',
         'departmentId': 'o1-d1', 'teamId': 'o1-t2', 'positionId': 'o1-p1'},
        {'employeeId': 'e3', 'placementType': 'employee',
         'departmentId': 'o1-d2', 'teamId': 'o1-t3', 'positionId': 'o1-p1'},
    ]
    return {
        'reason': 'Explicit stable-ID mapping rehearsal',
        'companies': [{
            'organizationId': 'o1',
            'founderEmployeeId': 'founder',
            'employees': [{'employeeId': employee_id, 'phone': phone}
                          for employee_id, phone in employees],
            'departments': ['o1-d1', 'o1-d2'],
            'teams': [
                {'id': 'o1-t1', 'departmentId': 'o1-d1'},
                {'id': 'o1-t2', 'departmentId': 'o1-d1'},
                {'id': 'o1-t3', 'departmentId': 'o1-d2'},
                {'id': 'o1-t4', 'departmentId': 'o1-d2'},
            ],
            'placements': placements,
            'administrator': {'adminId': 'admin1', 'accountName': 'administrator'},
        }],
    }


def o2_mapping() -> dict:
    return {
        'reason': 'Conflicted administrator mapping rehearsal',
        'companies': [{
            'organizationId': 'o2',
            'founderEmployeeId': 'other',
            'employees': [
                {'employeeId': 'other', 'phone': '13800000020'},
                {'employeeId': 'dh9', 'phone': '13800000021'},
                {'employeeId': 'th9', 'phone': '13800000022'},
                {'employeeId': 'e9', 'phone': '13800000023'},
            ],
            'departments': ['o2-d1'],
            'teams': [{'id': 'o2-t1', 'departmentId': 'o2-d1'}],
            'placements': [
                {'employeeId': 'other', 'placementType': 'founder', 'positionId': 'o2-p1'},
                {'employeeId': 'dh9', 'placementType': 'department_head',
                 'departmentId': 'o2-d1', 'positionId': 'o2-p1'},
                {'employeeId': 'th9', 'placementType': 'team_head',
                 'departmentId': 'o2-d1', 'teamId': 'o2-t1', 'positionId': 'o2-p1'},
                {'employeeId': 'e9', 'placementType': 'employee',
                 'departmentId': 'o2-d1', 'teamId': 'o2-t1', 'positionId': 'o2-p1'},
            ],
            'administrator': {'adminId': 'admin21'},
        }],
    }


def blocker_codes(report: dict, organization_id: str | None = None) -> list[str]:
    codes = []
    for company in report.get('companies', []):
        if organization_id and company['organizationId'] != organization_id:
            continue
        codes.extend(blocker['code'] for blocker in company['blockers'])
    if organization_id is None:
        codes.extend(blocker['code'] for blocker in report.get('blockers', []))
    return codes


def apply_plan(db: Mysql, organization_id: str, plan: dict) -> None:
    statements = [
        'START TRANSACTION',
        f'UPDATE organizations SET founder_employee_id={quote(plan["founderEmployeeId"])},'
        f'authz_version=authz_version+1 WHERE id={quote(organization_id)}',
        f'DELETE FROM employee_placements WHERE organization_id={quote(organization_id)}',
        'UPDATE users SET department_id=NULL,team_id=NULL,manager_id=NULL,position_id=NULL '
        f'WHERE organization_id={quote(organization_id)}',
        'UPDATE teams SET parent_id=NULL,lead_user_id=NULL '
        f'WHERE organization_id={quote(organization_id)}',
        'UPDATE departments SET parent_id=NULL '
        f'WHERE organization_id={quote(organization_id)}',
    ]
    for department in plan['departments']:
        statements.append(
            f'UPDATE departments SET name={quote(department["name"])},'
            'row_version=row_version+1 WHERE '
            f'organization_id={quote(organization_id)} AND id={quote(department["id"])}')
    for team in plan['teams']:
        statements.append(
            f'UPDATE teams SET name={quote(team["name"])},'
            f'department_id={quote(team["departmentId"])},row_version=row_version+1 WHERE '
            f'organization_id={quote(organization_id)} AND id={quote(team["id"])}')
    for placement in plan['placements']:
        statements.append(
            'INSERT INTO employee_placements(organization_id,employee_id,placement_type,'
            'department_id,team_id,position_id) VALUES ('
            f'{quote(organization_id)},{quote(placement["employeeId"])},'
            f'{quote(placement["placementType"])},{quote(placement.get("departmentId"))},'
            f'{quote(placement.get("teamId"))},{quote(placement["positionId"])})')
        statements.append(
            'UPDATE users SET org_version=org_version+1 WHERE '
            f'organization_id={quote(organization_id)} AND id={quote(placement["employeeId"])}')
    statements.append('COMMIT')
    db.server_side('; '.join(statements))


def plan_contract_errors(plan: dict, employees: list[dict], departments: dict, teams: dict,
                         positions: dict, active_ids: set[str]) -> list[str]:
    """Independently mirror the OrganizationPlans/CompanyTree request contract."""
    errors = []
    allowed_top = {'reason', 'founderEmployeeId', 'departments', 'teams', 'placements',
                   'expectedEmployees', 'newEmployees', 'deactivateEmployees',
                   'businessTransfers', 'cancelUnpublishedRequests'}
    if not isinstance(plan, dict):
        return ['plan is not an object']
    if set(plan) - allowed_top:
        errors.append('unknown plan fields: ' + ','.join(sorted(set(plan) - allowed_top)))
    if not isinstance(plan.get('reason'), str) or not plan['reason'].strip():
        errors.append('reason is required')
    if plan.get('founderEmployeeId') not in {row['id'] for row in employees}:
        errors.append('founder is not an employee')
    expected = plan.get('expectedEmployees')
    if not isinstance(expected, list) or {row.get('id') for row in expected} != {
            row['id'] for row in employees}:
        errors.append('expectedEmployees does not exactly cover the employee directory')
    for row in expected or []:
        if set(row) != {'id', 'rowVersion'} or not isinstance(row.get('rowVersion'), int):
            errors.append('expectedEmployees row shape is invalid')
            break
    if {row.get('id') for row in plan.get('departments', [])} != set(departments):
        errors.append('departments are not the complete final list')
    if {row.get('id') for row in plan.get('teams', [])} != set(teams):
        errors.append('teams are not the complete final list')
    for row in plan.get('departments', []):
        if set(row) - {'id', 'name', 'rowVersion'} or not isinstance(row.get('rowVersion'), int):
            errors.append('department row shape is invalid')
            break
    for row in plan.get('teams', []):
        if set(row) - {'id', 'name', 'departmentId', 'rowVersion'} \
                or not isinstance(row.get('rowVersion'), int):
            errors.append('team row shape is invalid')
            break
    placements = plan.get('placements')
    if not isinstance(placements, list) or {row.get('employeeId') for row in placements} != active_ids:
        errors.append('placements are not one-per-active-employee')
    seen_types = set()
    dept_heads: dict[str, int] = {}
    team_heads: dict[str, int] = {}
    for row in placements or []:
        if set(row) - {'employeeId', 'placementType', 'departmentId', 'teamId',
                       'positionId', 'rowVersion'}:
            errors.append('placement row has unknown fields')
            break
        seen_types.add(row.get('placementType'))
        if row.get('positionId') not in positions:
            errors.append('placement position is missing')
        if row.get('placementType') == 'founder':
            if row.get('departmentId') is not None or row.get('teamId') is not None:
                errors.append('founder is not company-level')
        elif row.get('placementType') == 'department_head':
            if row.get('teamId') is not None or row.get('departmentId') not in departments:
                errors.append('department head shape is invalid')
            dept_heads[row.get('departmentId')] = dept_heads.get(row.get('departmentId'), 0) + 1
        elif row.get('placementType') in ('team_head', 'employee'):
            team = row.get('teamId')
            if team not in teams or teams[team]['departmentId'] != row.get('departmentId'):
                errors.append('team placement shape is invalid')
            if row.get('placementType') == 'team_head':
                team_heads[team] = team_heads.get(team, 0) + 1
        else:
            errors.append('unknown placement type')
    if set(dept_heads) != set(departments) or any(value != 1 for value in dept_heads.values()):
        errors.append('department heads are not exactly one per department')
    if set(team_heads) != set(teams) or any(value != 1 for value in team_heads.values()):
        errors.append('team heads are not exactly one per team')
    return errors


def run(output: Path, keep: bool = False) -> None:
    database = 'pandora_precheck_legacy_' + uuid.uuid4().hex[:16]
    admin = Mysql(None, DEFAULT_OPTION_FILE)
    db = Mysql(database, DEFAULT_OPTION_FILE)
    migrations = BASE / 'src/main/resources/db/migration'
    historical = sorted((path for path in migrations.glob('V*__*.sql')
                         if int(path.name.split('__')[0][1:]) <= 20),
                        key=lambda path: int(path.name.split('__')[0][1:]))
    checksums = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in historical}
    report: dict = {
        'updated': dt.datetime.now(dt.timezone.utc).isoformat(),
        'database': database,
        'result': 'FAIL',
        'checks': [],
        'historicalChecksums': checksums,
        'http': {
            'exercised': False,
            'reason': ('The check runs the mapping tool and SQL contract checks directly. No JAR '
                       'was started, so POST /api/v1/admin/organization-plans is not exercised.'),
        },
        'contract': {
            'source': 'backend/src/main/java/cn/pandora/admin/OrganizationPlans.java + CompanyTree.java',
            'checked': ['request key whitelist', 'complete expectedEmployees with row versions',
                        'complete departments/teams with row versions', 'placement shapes',
                        'one placement per active employee', 'unique department/team heads'],
        },
        'validationLayers': {
            'sqlConstraints': ('SQL executed on the isolated V20+V21-V24 database: foreign keys, '
                               'CHECK shapes, unique founder/head slots and cross-company rejection.'),
            'toolValidation': ('migration_precheck.py mapping: stable IDs, ownership by company, '
                               'placement types, positions, one placement per active employee, '
                               'one head per unit, fixed founder, one administrator and normalized '
                               'phone uniqueness; blockers refuse the plan.'),
            'planContract': ('The generated payload is compared in Python with the documented '
                             'OrganizationPlans/CompanyTree request contract; no Java method is run.'),
            'http': 'Not exercised: no application JAR or HTTP request was started by this check.',
        },
    }

    def check(name: str, condition: bool, evidence=None) -> None:
        report['checks'].append({'check': name, 'pass': bool(condition),
                                 'evidence': evidence})
        print(('PASS ' if condition else 'FAIL ') + name, flush=True)
        if not condition:
            raise AssertionError(name)

    def mapping_blocked(name: str, mapping: dict, expected_code: str,
                        company: str = 'o1') -> dict:
        result = mapping_report(db, mapping)
        codes = blocker_codes(result, company)
        check(name, result['status'] == 'blocked' and expected_code in codes,
              {'status': result['status'], 'codes': sorted(set(codes))})
        company_report = next((item for item in result['companies']
                               if item['organizationId'] == company), None)
        check(name + ' (no submittable plan)',
              company_report is not None and company_report['plan'] is None
              and company_report['submittable'] is False)
        return result

    try:
        admin.server_side(f'CREATE DATABASE `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
        for path in historical:
            db.import_sql(path, database)

        db.server_side("INSERT INTO organizations(id,name) VALUES('o1','Alpha'),('o2','Beta')")
        db.server_side(
            "INSERT INTO departments(id,organization_id,name) VALUES"
            "('o1-d1','o1','Engineering'),('o1-d2','o1','Sales'),('o2-d1','o2','Beta Department')")
        db.server_side(
            "INSERT INTO positions(id,organization_id,name) VALUES"
            "('o1-p1','o1','Engineer'),('o1-p2','o1','Engineering Manager'),"
            "('o1-p3','o1','Director'),('o1-p4','o1','Team Lead'),('o2-p1','o2','Beta Engineer')")
        db.server_side(
            "INSERT INTO teams(id,organization_id,name,department_id) VALUES"
            "('o1-t1','o1','Platform','o1-d1'),('o1-t2','o1','Mobile','o1-d1'),"
            "('o1-t3','o1','Enterprise','o1-d2'),('o1-t4','o1','SMB','o1-d2'),"
            "('o2-t1','o2','Beta Team','o2-d1')")

        insert_user(db, 'o1', 'founder', 'founder', 'Founder', '13800000001', 'lower', 1,
                    'o1-d1', None, 'o1-p1', None)
        insert_user(db, 'o1', 'dh1', 'dh1', 'Engineering Head', '13800000002', 'lower', 2,
                    'o1-d1', None, 'o1-p2', 'founder')
        insert_user(db, 'o1', 'th1', 'th1', 'Platform Lead', '138-0000-0003', 'lower', 3,
                    'o1-d1', 'o1-t1', 'o1-p4', 'dh1')
        insert_user(db, 'o1', 'e1', 'e1', 'Platform Engineer', '13800000004', 'lower', 4,
                    'o1-d1', 'o1-t1', 'o1-p1', 'th1')
        insert_user(db, 'o1', 'th4', 'th4', 'Mobile Lead', '13800000009', 'lower', 3,
                    'o1-d1', 'o1-t2', 'o1-p4', 'dh1')
        insert_user(db, 'o1', 'e2', 'e2', 'Mobile Engineer', '13800000008', 'lower', 4,
                    'o1-d1', 'o1-t2', 'o1-p1', 'th4')
        insert_user(db, 'o1', 'dh2', 'dh2', 'Sales Head', '13800000005', 'lower', 2,
                    'o1-d2', None, 'o1-p2', 'founder')
        insert_user(db, 'o1', 'th2', 'th2', 'Enterprise Lead', '+86 13800000006', 'lower', 3,
                    'o1-d2', 'o1-t3', 'o1-p4', 'dh2')
        insert_user(db, 'o1', 'e3', 'e3', 'Enterprise Engineer', '13800000010', 'lower', 4,
                    'o1-d2', 'o1-t3', 'o1-p1', 'th2')
        insert_user(db, 'o1', 'th3', 'th3', 'SMB Lead', '13800000007', 'lower', 3,
                    'o1-d2', 'o1-t4', 'o1-p4', 'dh2')
        insert_user(db, 'o1', 'inactive1', 'inactive1', 'Former Employee', '13800000011', 'lower', 4,
                    'o1-d1', 'o1-t1', 'o1-p1', 'th1', active=0)
        insert_user(db, 'o1', 'admin1', 'administrator', 'Administrator', None, 'admin', 0,
                    'o1-d1', None, 'o1-p1', None)

        insert_user(db, 'o2', 'other', 'other', 'Other Founder', '13800000020', 'lower', 1,
                    'o2-d1', None, 'o2-p1', None)
        insert_user(db, 'o2', 'dh9', 'dh9', 'Other Head', '13800000021', 'lower', 2,
                    'o2-d1', None, 'o2-p1', 'other')
        insert_user(db, 'o2', 'th9', 'th9', 'Other Lead', '13800000022', 'lower', 3,
                    'o2-d1', 'o2-t1', 'o2-p1', 'dh9')
        insert_user(db, 'o2', 'e9', 'e9', 'Other Engineer', '13800000023', 'lower', 4,
                    'o2-d1', 'o2-t1', 'o2-p1', 'th9')
        insert_user(db, 'o2', 'admin21', 'admin21', 'First Admin', None, 'admin', 0,
                    'o2-d1', None, 'o2-p1', None)
        insert_user(db, 'o2', 'admin22', 'admin22', 'Second Admin', None, 'admin', 0,
                    'o2-d1', None, 'o2-p1', None)

        # Reproduce the previous release's runtime tightening before V21 relaxes it.
        db.server_side('ALTER TABLE users MODIFY department_id VARCHAR(36) NOT NULL, '
                       'MODIFY position_id VARCHAR(36) NOT NULL')
        db.server_side(
            "INSERT INTO tasks(id,organization_id,original_creator_id,created_at) VALUES"
            "('task1','o1','founder','2026-01-02 03:04:05.123456'),"
            "('task2','o1','e1','2026-02-03 04:05:06.234567'),"
            "('task3','o2','other','2026-03-04 05:06:07.345678')")
        db.server_side(
            "INSERT INTO task_versions(id,organization_id,task_id,version_no,title,description,"
            "acceptance_criteria,priority,start_at,due_at,execution_state,progress_note,status,"
            "created_by) VALUES"
            "('version1','o1','task1',1,'Original','Body','','medium','2026-01-02 03:04:05',"
            "'2026-01-03 03:04:05','todo','','applied','founder')")
        db.server_side("UPDATE tasks SET current_version_id='version1' WHERE id='task1'")
        db.server_side(
            "INSERT INTO approval_requests(id,organization_id,task_id,proposed_version_id,"
            "applicant_id,current_reviewer_id,kind,status,previous_state,decided_at,decided_by) VALUES"
            "('request1','o1','task1','version1','founder','founder','create','approved','todo',"
            "'2026-01-02 04:00:00','admin1')")
        db.server_side(
            "INSERT INTO task_records(id,organization_id,task_id,author_id,body,kind) VALUES"
            "('record1','o1','task1','admin1','Historical actor','legacy')")
        db.server_side(
            "INSERT INTO task_history_entries(id,organization_id,task_id,actor_id,entry_type,"
            "detail_json) VALUES('history1','o1','task1','admin1','legacy','{}')")
        db.server_side(
            "INSERT INTO audit_logs(id,organization_id,actor_id,action,details_json) VALUES"
            "('audit1','o1','admin1','organization.plan.applied','{}')")
        db.server_side(
            "INSERT INTO work_logs(id,organization_id,author_id,business_date,body) VALUES"
            "('log1','o1','founder','2026-01-02','Founder log'),"
            "('log3','o2','other','2026-03-04','Other log')")
        db.server_side(
            "INSERT INTO auth_sessions(id,organization_id,user_id,token_hash,expires_at) VALUES"
            "('session1','o1','admin1',REPEAT('a',64),'2030-01-01')")
        db.server_side(
            "INSERT INTO idempotency_keys(organization_id,user_id,scope,key_value,request_hash,"
            "response_json) VALUES('o1','admin1','/admin/organization-plans','example-key',"
            "REPEAT('b',64),'{}')")
        db.server_side(
            "INSERT INTO domain_events(id,organization_id,event_type,recipients_json,details_json,"
            "initiator_id,revoked_by) VALUES('event1','o1','organization.plan.applied','[]','{}',"
            "'admin1','admin1')")
        db.server_side(
            "INSERT INTO notifications(id,organization_id,event_id,recipient_id,event_type,summary) "
            "VALUES('notice1','o1','event1','admin1','organization.plan.applied','History')")

        users_before = db.rows(
            "SELECT id,created_at FROM users WHERE organization_id='o1' AND role<>'admin' ORDER BY id")
        admin_before = db.rows(
            "SELECT id,created_at FROM users WHERE organization_id='o1' AND role='admin' ORDER BY id")
        tasks_before = db.rows(
            "SELECT id,original_creator_id,created_at FROM tasks WHERE organization_id='o1' ORDER BY id")
        audit_before = db.rows(
            "SELECT id,actor_id FROM audit_logs WHERE organization_id='o1' ORDER BY id")

        mapping = legal_mapping()
        v20_before = fingerprint(db)
        v20 = mapping_report(db, mapping)
        v20_after = fingerprint(db)
        v20_company = v20['companies'][0]
        check('V20 legacy fields are recognised and produce a plan', v20['schema']['phase'] == 'v20'
              and v20['status'] == 'ready' and v20_company['submittable'] is True,
              {'phase': v20['schema']['phase'], 'status': v20['status'],
               'codes': sorted(set(blocker_codes(v20, 'o1')))})
        check('V20 plan has no placement row versions and keeps the legacy founder unset',
              v20_company['state']['founderEmployeeId'] is None
              and v20_company['state']['existingPlacements'] == 0
              and all('rowVersion' not in row for row in v20_company['plan']['placements']))
        check('V20 administrator mapping uses the unique legacy admin without a fake employee placement',
              v20_company['administrator']['principalId'] == 'admin1'
              and v20_company['administrator']['hasIndependentAccountRow'] is False
              and 'admin1' not in {row['employeeId'] for row in v20_company['plan']['placements']})
        check('V20 plan excludes the legacy administrator from the post-V22 employee directory',
              len(v20_company['plan']['expectedEmployees']) == 11
              and 'admin1' not in {row['id'] for row in v20_company['plan']['expectedEmployees']})
        check('V20 mapping command is read-only', v20_before['digest'] == v20_after['digest'])

        db.import_sql(migrations / 'V21__fixed_employee_placements.sql', database)
        db.import_sql(migrations / 'V22__independent_account_principals.sql', database)
        db.import_sql(migrations / 'V23__task_business_ownership.sql', database)
        db.import_sql(migrations / 'V24__explicit_blocked_review_routes.sql', database)

        check('V1-V20 files still match Git HEAD', all(
            subprocess.run(['git', 'show', 'HEAD:backend/src/main/resources/db/migration/' + path.name],
                           cwd=BASE, capture_output=True, check=True).stdout == path.read_bytes()
            for path in historical))
        check('V1-V20 checksums are unchanged by the rehearsal', checksums == {
            path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in historical})
        check('stable employee IDs and creation times survive V21-V24',
              users_before == db.rows(
                  "SELECT u.id,u.created_at FROM users u JOIN principals p "
                  "ON p.organization_id=u.organization_id AND p.id=u.id "
                  "WHERE u.organization_id='o1' AND p.account_type='employee' ORDER BY u.id"))
        check('stable administrator ID and historical rows survive V22',
              admin_before == [row for row in db.rows(
                  "SELECT id,created_at FROM admin_accounts WHERE organization_id='o1' ORDER BY id")]
              and audit_before == db.rows(
                  "SELECT id,actor_id FROM audit_logs WHERE organization_id='o1' ORDER BY id"))
        check('task original creators and creation times are unchanged',
              tasks_before == db.rows(
                  "SELECT id,original_creator_id,created_at FROM tasks "
                  "WHERE organization_id='o1' ORDER BY id"))
        check('V21 leaves every founder unproven', db.scalar(
            "SELECT COUNT(*) FROM organizations WHERE founder_employee_id IS NOT NULL") == 0)
        check('V21 writes one mapping blocker per company', db.scalar(
            "SELECT COUNT(*) FROM migration_findings WHERE migration='V21' "
            "AND severity='blocker' AND resolved_at IS NULL") == 2)
        check('V22 creates exactly one administrator for the clean company', db.scalar(
            "SELECT COUNT(*) FROM admin_accounts WHERE organization_id='o1' AND id='admin1'") == 1)
        check('V22 refuses to guess between two legacy administrators', db.scalar(
            "SELECT COUNT(*) FROM admin_accounts WHERE organization_id='o2'") == 0
            and db.scalar(
                "SELECT COUNT(*) FROM migration_findings WHERE migration='V22' "
                "AND category='admin_identity_mapping' AND organization_id='o2' "
                "AND resolved_at IS NULL") == 1)

        before_mapping = fingerprint(db)
        legal = mapping_report(db, mapping)
        after_mapping = fingerprint(db)
        check('mapping command is read-only', before_mapping['digest'] == after_mapping['digest'])
        check('legal explicit mapping is ready', legal['status'] == 'ready'
              and legal['blockers'] == [], {'status': legal['status']})
        company = legal['companies'][0]
        plan = company['plan']
        check('legal mapping produces a submittable plan with If-Match',
              company['submittable'] and isinstance(plan, dict)
              and company['ifMatch'] == '"1"',
              {'ifMatch': company['ifMatch']})
        check('four placement types, company founder and department head without team are present',
              {row['placementType'] for row in plan['placements']}
              == {'founder', 'department_head', 'team_head', 'employee'}
              and any(row['placementType'] == 'founder'
                      and row['departmentId'] is None and row['teamId'] is None
                      for row in plan['placements'])
              and any(row['placementType'] == 'department_head'
                      and row['teamId'] is None for row in plan['placements']))
        check('founder is fixed to the explicit stable ID',
              plan['founderEmployeeId'] == 'founder'
              and company['state']['legacyRoots']['roots'] == ['founder']
              and company['state']['legacyRoots']['founderInferredFromLegacyGraph'] is False)
        check('administrator is exactly the explicit independent account',
              company['administrator']['principalId'] == 'admin1'
              and company['administrator']['hasIndependentAccountRow'] is True
              and company['administrator']['accountName'] == 'administrator')
        check('one placement per active employee and none for the inactive employee',
              {row['employeeId'] for row in plan['placements']}
              == {'founder', 'dh1', 'th1', 'e1', 'dh2', 'th2', 'th3', 'th4', 'e2', 'e3'}
              and 'inactive1' not in {row['employeeId'] for row in plan['placements']})
        check('expectedEmployees covers active and inactive employees but no administrator',
              {row['id'] for row in plan['expectedEmployees']}
              == {'founder', 'dh1', 'th1', 'e1', 'dh2', 'th2', 'th3', 'th4', 'e2', 'e3', 'inactive1'}
              and 'admin1' not in {row['id'] for row in plan['expectedEmployees']})
        employees_state = [{'id': row['id']} for row in plan['expectedEmployees']]
        departments_state = {row['id']: row for row in plan['departments']}
        teams_state = {row['id']: row for row in plan['teams']}
        positions_state = {row[0]: {'id': row[0], 'name': row[1]} for row in db.rows(
            "SELECT id,name FROM positions WHERE organization_id='o1' ORDER BY id")}
        active_ids = {row['employeeId'] for row in plan['placements']}
        contract_errors = plan_contract_errors(
            plan, employees_state, departments_state, teams_state, positions_state, active_ids)
        check('generated plan matches the OrganizationPlans/CompanyTree request contract',
              contract_errors == [], {'errors': contract_errors[:5]})
        check('normalized phones are unique and reported masked only',
              [row for row in company['mapping']['employees'] if row['employeeId'] == 'th1'][0]['phone']
              == mask_phone('13800000003')
              and all(not row['phone'].isdigit() for row in company['mapping']['employees']))
        serialized = json.dumps(legal, ensure_ascii=False)
        check('mapping report contains no full contact number',
              all(number not in serialized for number in PHONE_NUMBERS))
        with tempfile.TemporaryDirectory() as temporary:
            mapping_path = Path(temporary) / 'mapping.json'
            cli_report_path = Path(temporary) / 'report.json'
            mapping_path.write_text(json.dumps(mapping), encoding='utf-8')
            cli = subprocess.run(
                [sys.executable, str(BASE / 'scripts/migration_precheck.py'),
                 '--database', database, 'mapping', '--mapping', str(mapping_path),
                 '--output', str(cli_report_path)],
                cwd=BASE, capture_output=True, text=True)
            cli_report = json.loads(cli_report_path.read_text(encoding='utf-8')) \
                if cli_report_path.exists() else {}
            check('mapping subcommand CLI returns the same ready plan',
                  cli.returncode == 0 and cli_report.get('status') == 'ready'
                  and cli_report['companies'][0]['plan'] == plan,
                  {'returncode': cli.returncode})

        # Invalid mappings: each is refused with a structured blocker and no plan.
        missing_founder = copy.deepcopy(mapping)
        missing_founder['companies'][0].pop('founderEmployeeId')
        result = mapping_blocked('missing founder is not inferred from the legacy root',
                                 missing_founder, 'FOUNDER_REQUIRED')
        check('missing founder still records the legacy root as diagnostic only',
              result['companies'][0]['state']['legacyRoots']['roots'] == ['founder']
              and result['companies'][0]['state']['legacyRoots'][
                  'founderInferredFromLegacyGraph'] is False)
        wrong_company = copy.deepcopy(mapping)
        wrong_company['companies'][0]['founderEmployeeId'] = 'other'
        mapping_blocked('cross-company founder is rejected', wrong_company, 'FOUNDER_UNKNOWN')
        inactive_founder = copy.deepcopy(mapping)
        inactive_founder['companies'][0]['founderEmployeeId'] = 'inactive1'
        mapping_blocked('inactive founder is rejected', inactive_founder, 'FOUNDER_INACTIVE')
        duplicate_head = copy.deepcopy(mapping)
        for row in duplicate_head['companies'][0]['placements']:
            if row['employeeId'] == 'dh2':
                row.update(placementType='department_head', departmentId='o1-d1', teamId=None)
        mapping_blocked('two department heads are rejected', duplicate_head,
                        'DUPLICATE_DEPARTMENT_HEAD')
        cross_company = copy.deepcopy(mapping)
        cross_company['companies'][0]['placements'].append(
            {'employeeId': 'other', 'placementType': 'employee',
             'departmentId': 'o1-d1', 'teamId': 'o1-t1', 'positionId': 'o1-p1'})
        mapping_blocked('cross-company placement is rejected', cross_company,
                        'PLACEMENT_EMPLOYEE_UNKNOWN')
        duplicate_phone = copy.deepcopy(mapping)
        for row in duplicate_phone['companies'][0]['employees']:
            if row['employeeId'] == 'e1':
                row['phone'] = '138-0000-0001'
        result = mapping_blocked('duplicate normalized phone is rejected', duplicate_phone,
                                 'PHONE_DUPLICATE')
        duplicate_blocker = next(blocker for blocker in result['companies'][0]['blockers']
                                 if blocker['code'] == 'PHONE_DUPLICATE')
        check('duplicate phone blocker masks the number and keeps stable IDs',
              duplicate_blocker['subject'] == mask_phone('13800000001')
              and duplicate_blocker['relatedIds'] == ['e1', 'founder']
              and '13800000001' not in json.dumps(result, ensure_ascii=False))
        founder_shape = copy.deepcopy(mapping)
        for row in founder_shape['companies'][0]['placements']:
            if row['employeeId'] == 'founder':
                row['departmentId'] = 'o1-d1'
        mapping_blocked('founder forced into a department is rejected', founder_shape,
                        'FOUNDER_COMPANY_ONLY')
        orphan_root = copy.deepcopy(mapping)
        for row in orphan_root['companies'][0]['placements']:
            if row['employeeId'] == 'founder':
                row['placementType'] = 'department_head'
                row['departmentId'] = 'o1-d1'
        mapping_blocked('a mapping without a company root is rejected', orphan_root, 'ORPHAN_ROOT')
        cycle = copy.deepcopy(mapping)
        cycle['companies'][0]['founderEmployeeId'] = 'dh1'
        mapping_blocked('a derived manager cycle is rejected', cycle, 'MANAGEMENT_CYCLE')
        missing_position = copy.deepcopy(mapping)
        for row in missing_position['companies'][0]['placements']:
            if row['employeeId'] == 'founder':
                row.pop('positionId')
        mapping_blocked('missing display position is rejected', missing_position,
                        'POSITION_REQUIRED')
        missing_placement = copy.deepcopy(mapping)
        missing_placement['companies'][0]['placements'] = [
            row for row in missing_placement['companies'][0]['placements']
            if row['employeeId'] != 'e3']
        mapping_blocked('missing active employee placement is rejected', missing_placement,
                        'PLACEMENT_REQUIRED')
        omitted_department = copy.deepcopy(mapping)
        omitted_department['companies'][0]['departments'].remove('o1-d2')
        mapping_blocked('omitted existing department is rejected', omitted_department,
                        'DEPARTMENT_OMITTED')
        wrong_admin = copy.deepcopy(mapping)
        wrong_admin['companies'][0]['administrator'] = {'adminId': 'dh1'}
        mapping_blocked('employee cannot be mapped as administrator', wrong_admin,
                        'ADMIN_NOT_FOUND')
        missing_admin = copy.deepcopy(mapping)
        missing_admin['companies'][0].pop('administrator')
        mapping_blocked('missing administrator mapping is rejected', missing_admin,
                        'ADMIN_MAPPING_REQUIRED')
        repair_admin = copy.deepcopy(mapping)
        repair_admin['companies'][0]['administrator'] = {
            'repair': 'two legacy administrators need controlled resolution'}
        mapping_blocked('administrator repair marker remains a blocker', repair_admin,
                        'ADMIN_REPAIR_REQUIRED')
        o2 = mapping_report(db, o2_mapping())
        check('company with two legacy administrators is blocked',
              o2['status'] == 'blocked'
              and 'ADMIN_NOT_UNIQUE' in blocker_codes(o2, 'o2')
              and o2['companies'][0]['plan'] is None,
              {'codes': sorted(set(blocker_codes(o2, 'o2')))})
        mixed = copy.deepcopy(mapping)
        mixed['companies'].append(copy.deepcopy(o2_mapping()['companies'][0]))
        mixed_result = mapping_report(db, mixed)
        check('a blocked company does not corrupt another company plan',
              mixed_result['status'] == 'blocked'
              and mixed_result['companies'][0]['submittable'] is True
              and mixed_result['companies'][1]['submittable'] is False)

        # Apply the legal plan inside the isolated database, then read the V21+ structure again.
        check('mapping still leaves the database untouched after invalid cases',
              fingerprint(db)['digest'] == before_mapping['digest'])
        apply_plan(db, 'o1', plan)
        check('plan application keeps every placement SQL-legal', db.scalar(
            "SELECT COUNT(*) FROM employee_placements WHERE organization_id='o1'") == 10)
        check('four placement types and company-level founder are stored',
              db.rows("SELECT placement_type,COUNT(*) FROM employee_placements "
                      "WHERE organization_id='o1' GROUP BY placement_type ORDER BY placement_type")
              == [['department_head', '2'], ['employee', '3'], ['founder', '1'], ['team_head', '4']]
              and db.scalar("SELECT COUNT(*) FROM organizations WHERE id='o1' "
                            "AND founder_employee_id='founder'") == 1)
        check('no inactive employee holds a placement', db.scalar(
            "SELECT COUNT(*) FROM employee_placements p JOIN users u ON u.id=p.employee_id "
            "WHERE p.organization_id='o1' AND u.active=0") == 0)
        check('every department and team has exactly one head', db.scalar(
            "SELECT COUNT(*) FROM (SELECT department_id FROM employee_placements "
            "WHERE organization_id='o1' AND placement_type='department_head' "
            "GROUP BY department_id HAVING COUNT(*)<>1) x") == 0
            and db.scalar(
                "SELECT COUNT(*) FROM (SELECT team_id FROM employee_placements "
                "WHERE organization_id='o1' AND placement_type='team_head' "
                "GROUP BY team_id HAVING COUNT(*)<>1) x") == 0)
        rerun = mapping_report(db, mapping)
        check('V21+ current structure is recognised and the same mapping stays ready',
              rerun['status'] == 'ready' and rerun['schema']['phase'] == 'v22+'
              and rerun['companies'][0]['state']['existingPlacements'] == 10)
        rerun_plan = rerun['companies'][0]['plan']
        check('re-read plan preserves stored placement row versions and IDs',
              all('rowVersion' in row for row in rerun_plan['placements'])
              and {row['employeeId'] for row in rerun_plan['placements']}
              == {row['employeeId'] for row in plan['placements']})
        changed_founder = copy.deepcopy(mapping)
        changed_founder['companies'][0]['founderEmployeeId'] = 'dh1'
        mapping_blocked('stored founder cannot be replaced', changed_founder,
                        'FOUNDER_FIXED_CONFLICT')
        changed_placement = copy.deepcopy(mapping)
        for row in changed_placement['companies'][0]['placements']:
            if row['employeeId'] == 'e1':
                row['placementType'] = 'team_head'
        mapping_blocked('stored placement cannot be silently overwritten', changed_placement,
                        'EXISTING_PLACEMENT_CONFLICT')
        check('staffed rerun does not change stored placement state',
              db.scalar("SELECT COUNT(*) FROM employee_placements WHERE organization_id='o1'") == 10)

        check('employee stable IDs and creation times survive the applied plan',
              users_before == db.rows(
                  "SELECT u.id,u.created_at FROM users u JOIN principals p "
                  "ON p.organization_id=u.organization_id AND p.id=u.id "
                  "WHERE u.organization_id='o1' AND p.account_type='employee' ORDER BY u.id"))
        check('administrator is still the original principal/account ID',
              db.rows("SELECT a.id,a.account_name,p.account_type FROM admin_accounts a "
                      "JOIN principals p ON p.id=a.id WHERE a.organization_id='o1'")
              == [['admin1', 'administrator', 'admin']])
        check('task original creators and creation times survive the applied plan',
              tasks_before == db.rows(
                  "SELECT id,original_creator_id,created_at FROM tasks "
                  "WHERE organization_id='o1' ORDER BY id"))
        check('historical task version, record, history and work log keep their IDs',
              db.scalar("SELECT COUNT(*) FROM task_versions WHERE id='version1' "
                        "AND created_by='founder'") == 1
              and db.scalar("SELECT COUNT(*) FROM task_records WHERE id='record1' "
                            "AND author_id='admin1'") == 1
              and db.scalar("SELECT COUNT(*) FROM task_history_entries WHERE id='history1' "
                            "AND actor_id='admin1'") == 1
              and db.scalar("SELECT COUNT(*) FROM work_logs WHERE id='log1' "
                            "AND author_id='founder'") == 1)
        check('retired administrator audit still resolves through the principal',
              db.scalar("SELECT COUNT(*) FROM audit_logs a JOIN principals p "
                        "ON p.organization_id=a.organization_id AND p.id=a.actor_id "
                        "WHERE a.id='audit1' AND p.account_type='admin'") == 1
              and db.scalar("SELECT COUNT(*) FROM users WHERE id='admin1'") == 0)
        check('V23 business ownership keeps every real task creator',
              db.rows("SELECT task_id,employee_id FROM task_business_owners "
                      "WHERE organization_id='o1' ORDER BY task_id")
              == [['task1', 'founder'], ['task2', 'e1']])
        check('open mapping findings remain evidence, not silent success',
              db.scalar("SELECT COUNT(*) FROM migration_findings WHERE migration='V21' "
                        "AND organization_id='o1' AND resolved_at IS NULL") == 1)
        check('V1-V20 files still match Git HEAD after the applied plan', all(
            subprocess.run(['git', 'show', 'HEAD:backend/src/main/resources/db/migration/' + path.name],
                           cwd=BASE, capture_output=True, check=True).stdout == path.read_bytes()
            for path in historical))
        check('V1-V20 checksums remain unchanged after the applied plan', checksums == {
            path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in historical})
        report['validMapping'] = {
            'company': 'o1',
            'founderEmployeeId': plan['founderEmployeeId'],
            'administratorPrincipalId': company['administrator']['principalId'],
            'placementTypes': sorted({row['placementType'] for row in plan['placements']}),
            'placements': len(plan['placements']),
            'expectedEmployees': len(plan['expectedEmployees']),
            'departments': len(plan['departments']),
            'teams': len(plan['teams']),
            'phoneEvidence': company['mapping']['employees'],
            'ifMatch': company['ifMatch'],
        }
        report['invalidMappings'] = [
            {'case': 'missing founder', 'expectedBlocker': 'FOUNDER_REQUIRED'},
            {'case': 'cross-company founder', 'expectedBlocker': 'FOUNDER_UNKNOWN'},
            {'case': 'inactive founder', 'expectedBlocker': 'FOUNDER_INACTIVE'},
            {'case': 'duplicate department head', 'expectedBlocker': 'DUPLICATE_DEPARTMENT_HEAD'},
            {'case': 'cross-company placement', 'expectedBlocker': 'PLACEMENT_EMPLOYEE_UNKNOWN'},
            {'case': 'duplicate normalized phone', 'expectedBlocker': 'PHONE_DUPLICATE'},
            {'case': 'founder with department', 'expectedBlocker': 'FOUNDER_COMPANY_ONLY'},
            {'case': 'orphan root', 'expectedBlocker': 'ORPHAN_ROOT'},
            {'case': 'derived manager cycle', 'expectedBlocker': 'MANAGEMENT_CYCLE'},
            {'case': 'missing display position', 'expectedBlocker': 'POSITION_REQUIRED'},
            {'case': 'missing active placement', 'expectedBlocker': 'PLACEMENT_REQUIRED'},
            {'case': 'omitted department', 'expectedBlocker': 'DEPARTMENT_OMITTED'},
            {'case': 'employee as administrator', 'expectedBlocker': 'ADMIN_NOT_FOUND'},
            {'case': 'missing administrator', 'expectedBlocker': 'ADMIN_MAPPING_REQUIRED'},
            {'case': 'explicit administrator repair', 'expectedBlocker': 'ADMIN_REPAIR_REQUIRED'},
            {'case': 'two legacy administrators', 'expectedBlocker': 'ADMIN_NOT_UNIQUE'},
            {'case': 'stored founder replacement', 'expectedBlocker': 'FOUNDER_FIXED_CONFLICT'},
            {'case': 'stored placement overwrite', 'expectedBlocker': 'EXISTING_PLACEMENT_CONFLICT'},
        ]
        report['result'] = 'PASS'
    except BaseException as error:
        report['result'] = 'FAIL'
        report['errorType'] = type(error).__name__
        raise
    finally:
        if not keep:
            admin.server_side(f'DROP DATABASE IF EXISTS `{database}`')
        report['cleanup'] = {'databaseDropped': not keep, 'processStarted': False,
                             'keptDatabase': database if keep else None}
        report['checksTotal'] = len(report['checks'])
        report['checksPassed'] = sum(1 for item in report['checks'] if item['pass'])
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n',
                          encoding='utf-8')
        if keep:
            print(f'[check] kept isolated database {database}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=OUTPUT)
    parser.add_argument('--keep', action='store_true',
                        help='keep the random database for a manual follow-up (default: drop it)')
    arguments = parser.parse_args()
    run(arguments.output, arguments.keep)
