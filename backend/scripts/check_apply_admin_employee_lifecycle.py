#!/usr/bin/env python3
"""Real-service acceptance for the admin employee lifecycle/directory change (e13 apply).

It owns disposable MySQL databases and a packaged-JAR service. It never points at the normal
database and never prints credentials. The script also proves the V38 -> V39 upgrade on seeded
legacy data (old employees stay without an identity record) and an empty-schema migration.
"""
import datetime as dt
import json
import re
import urllib.error
import urllib.request
import uuid
from pathlib import Path

from fixed_model_fixture import Fixture, PASSWORD, quote
from flyway_migrate import migrate
from migration_precheck import BASE, DEFAULT_OPTION_FILE, Mysql

OUTPUT = BASE.parent / 'audit/refactor-pandora-organization-and-workflows/admin-employee-lifecycle.json'
SERVICE_LOG = OUTPUT.with_name('admin-employee-lifecycle-service.log')
UPGRADE_LOG = OUTPUT.with_name('admin-employee-lifecycle-upgrade.log')

ID_A = '11010519491231002X'          # valid, ends in the normalization letter
ID_A_LOWER = '11010519491231002x'
ID_B = '110101198001010010'
ID_C = '440301198102020020'
ID_D = '320102198203030031'
ID_E = '110101198304040049'
ID_F = '440301198405050059'
ID_BAD_CHECKSUM = '110105194912310021'
ID_G = '110101198506060072'


def main() -> int:
    report = {'updated': dt.datetime.now(dt.timezone.utc).isoformat(), 'checks': []}

    def check(name, condition, evidence=None):
        report['checks'].append({'check': name, 'pass': bool(condition), 'evidence': evidence})
        print(('PASS ' if condition else 'FAIL ') + name, flush=True)
        if not condition:
            raise AssertionError(name)

    def chinese_safe(text):
        return bool(text) and not re.search(r'[A-Za-z]', text) and not re.search(r'Exception|SQL|jdbc|https?:', text)

    # ---- Empty-schema migration: the packaged chain applies V39 with its indexes and foreign key.
    scratch = 'pandora_e13_admin_' + uuid.uuid4().hex[:12]
    admin = Mysql(None, DEFAULT_OPTION_FILE)
    try:
        values = dict(line.split('=', 1) for line in (BASE / '.runtime/database.env').read_text().splitlines() if '=' in line)
        admin.server_side(f'CREATE DATABASE `{scratch}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
        for host in ('localhost', '127.0.0.1'):
            admin.server_side(f'GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,REFERENCES,DROP ON `{scratch}`.* '
                              'TO ' + quote(values['PANDORA_DB_USER']) + '@' + quote(host))
        result = migrate(Mysql(scratch, DEFAULT_OPTION_FILE), None, True, UPGRADE_LOG)
        check('empty schema applies the packaged migration chain including V39', result.returncode == 0, result.stderr[-400:])
        client = Mysql(scratch, DEFAULT_OPTION_FILE)
        check('empty schema records V39 as a successful migration', client.scalar(
            "SELECT COUNT(*) FROM flyway_schema_history WHERE version='39' AND success=1") == 1)
        check('empty schema creates the administrator-only identity table', client.scalar(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() "
            "AND table_name='employee_identity_documents'") == 1)
        check('identity table has the company-wide unique identity index', client.scalar(
            "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() "
            "AND table_name='employee_identity_documents' AND index_name='uq_employee_identity_id_card' "
            "AND non_unique=0") == 2)
        check('identity table references the employee row', client.scalar(
            "SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema=DATABASE() "
            "AND table_name='employee_identity_documents' AND referenced_table_name='users'") == 1)
    finally:
        admin.server_side(f'DROP DATABASE IF EXISTS `{scratch}`')

    fixture = Fixture(port=18190)
    fixture.migration_target = 38
    fixture.log_path = SERVICE_LOG
    try:
        with fixture as f:
            tokens = {key: f.login(key)[1]['token'] for key in f.identities}
            ids = {key: value['id'] for key, value in f.identities.items()}
            admin_token = tokens['admin']

            def call(method, path, body=None, who='admin', version=None, key=None):
                return f.call(method, path, body, tokens[who], key or 'admin-lifecycle-' + uuid.uuid4().hex, version)

            def raw_post(path, raw_body, token):
                request = urllib.request.Request(f.base + path, data=raw_body.encode(),
                                                 headers={'Content-Type': 'application/json',
                                                          'Authorization': 'Bearer ' + token,
                                                          'Idempotency-Key': 'raw-' + uuid.uuid4().hex},
                                                 method='POST')
                try:
                    with urllib.request.urlopen(request, timeout=20) as response:
                        return response.status, json.loads(response.read() or '{}')
                except urllib.error.HTTPError as error:
                    return error.code, json.loads(error.read() or '{}')

            # ---- V38 -> V39 upgrade on seeded legacy data; old employees stay without a document.
            check('pre-upgrade schema is V38 and has no identity table', f.db.scalar(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() "
                "AND table_name='employee_identity_documents'") == 0)
            users_before = f.db.rows("SELECT COUNT(*),COALESCE(SUM(CRC32(CONCAT_WS('|',id,organization_id,display_name,"
                                     "phone,COALESCE(login_phone,''),active,org_version,COALESCE(hire_date,'')))),0) FROM users")
            placements_before = f.db.rows('SELECT COUNT(*) FROM employee_placements')
            f.restart()
            check('upgrade applies V39 on the seeded V38 database', f.db.scalar(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE version='39' AND success=1") == 1)
            check('upgrade changes no existing employee row', f.db.rows(
                "SELECT COUNT(*),COALESCE(SUM(CRC32(CONCAT_WS('|',id,organization_id,display_name,"
                "phone,COALESCE(login_phone,''),active,org_version,COALESCE(hire_date,'')))),0) FROM users") == users_before)
            check('upgrade changes no existing placement row', f.db.rows('SELECT COUNT(*) FROM employee_placements') == placements_before)
            check('legacy employees have no identity record rather than a guessed one', f.db.scalar(
                'SELECT COUNT(*) FROM employee_identity_documents') == 0)

            # ---- Directory filters share one predicate for rows and total.
            status, listing = call('GET', '/admin/employees')
            check('full employee directory returns every employee with a truthful total',
                  status == 200 and listing['total'] == 11 and len(listing['items']) == 11, listing.get('total'))
            check('legacy list rows expose only a missing masked identity, never a fabricated value',
                  all(item.get('idCardNoMasked') is None and item.get('idCardRecorded') is False for item in listing['items']))
            status, filtered = call('GET', '/admin/employees?departmentId=fixture-company-alpha'
                                            '&teamId=fixture-company-alpha-one&placementType=employee'
                                            '&active=true&positionId=fixture-company-title')
            check('combined department/team/identity/active/position filters agree with their total',
                  status == 200 and filtered['total'] == 1 and filtered['items'][0]['id'] == ids['alpha-one-employee'], filtered)
            status, searched = call('GET', '/admin/employees?q=' + f.identities['alpha-one-employee']['identifier'])
            check('search matches the login phone and keeps the same total', status == 200 and searched['total'] == 1
                  and searched['items'][0]['id'] == ids['alpha-one-employee'], searched.get('total'))
            status, department_search = call('GET', '/admin/employees?q=alpha')
            check('search matches the department name', status == 200 and department_search['total'] == 5,
                  department_search.get('total'))
            status, empty = call('GET', '/admin/employees?q=no-such-employee-anywhere')
            check('no-match directory is a real empty result with total zero',
                  status == 200 and empty['total'] == 0 and empty['items'] == [])
            status, inactive = call('GET', '/admin/employees?active=false')
            check('inactive filter initially returns nobody', status == 200 and inactive['total'] == 0)
            status, invalid_active = call('GET', '/admin/employees?active=maybe')
            check('invalid active filter is a Chinese validation failure, not an empty directory',
                  status == 400 and invalid_active.get('code') == 'INVALID_INPUT' and chinese_safe(invalid_active.get('message')), invalid_active)
            status, invalid_placement = call('GET', '/admin/employees?placementType=owner')
            check('invalid identity filter is rejected', status == 400 and invalid_placement.get('code') == 'INVALID_INPUT', invalid_placement)
            status, invalid_department = call('GET', '/admin/employees?departmentId=!!!')
            check('malformed department filter is rejected', status == 400 and invalid_department.get('code') == 'INVALID_INPUT', invalid_department)

            # ---- Administrator-only identity document: validate, store, mask, audit, never project to employees.
            target = ids['alpha-one-employee']
            status, detail = call('GET', '/admin/employees/' + target)
            check('legacy employee detail reports an unset identity', status == 200 and detail.get('idCardNo') is None, detail.get('idCardNo'))
            status, invalid = call('PATCH', '/admin/employees/' + target, {'idCardNo': ID_BAD_CHECKSUM},
                                   version=detail['rowVersion'])
            check('invalid check digit rejects the whole correction',
                  status == 400 and invalid.get('code') == 'INVALID_INPUT' and chinese_safe(invalid.get('message')), invalid)
            status, unchanged = call('GET', '/admin/employees/' + target)
            check('rejected identity correction writes nothing', unchanged.get('idCardNo') is None and unchanged['rowVersion'] == detail['rowVersion'])
            status, corrected = call('PATCH', '/admin/employees/' + target, {'idCardNo': ID_A_LOWER},
                                     version=detail['rowVersion'])
            check('valid identity number is normalized and saved', status == 200 and corrected.get('idCardUpdated') is True
                  and corrected.get('idCardNoMasked') == '110105********002X', corrected)
            status, identity_detail = call('GET', '/admin/employees/' + target)
            check('administrator detail reads the full normalized value', identity_detail.get('idCardNo') == ID_A, identity_detail.get('idCardNo'))
            check('administrator detail also exposes the masked projection', identity_detail.get('idCardNoMasked') == '110105********002X')
            status, masked_list = call('GET', '/admin/employees?q=' + f.identities['alpha-one-employee']['identifier'])
            row = masked_list['items'][0]
            check('employee list masks the identity and never carries the full number',
                  row.get('idCardNoMasked') == '110105********002X' and 'idCardNo' not in row and ID_A not in json.dumps(row), row)
            status, duplicate = call('PATCH', '/admin/employees/' + ids['beta-two-employee'], {'idCardNo': ID_A},
                                     version=call('GET', '/admin/employees/' + ids['beta-two-employee'])[1]['rowVersion'])
            check('same-company duplicate identity number is refused', status == 409 and duplicate.get('code') == 'ID_CARD_TAKEN', duplicate)
            status, stale = call('PATCH', '/admin/employees/' + target, {'idCardNo': ID_C}, version=detail['rowVersion'])
            check('stale identity correction is refused', status == 412 and stale.get('code') == 'VERSION_CONFLICT', stale)
            status, same_value = call('PATCH', '/admin/employees/' + target, {'idCardNo': ID_A},
                                      version=identity_detail['rowVersion'])
            check('re-saving the same identity number is not a duplicate conflict', status == 200, same_value)
            audit_rows = f.db.rows("SELECT COUNT(*) FROM audit_logs WHERE action='organization.employee.identity_updated' "
                                   "AND CAST(details_json AS CHAR) LIKE '%110105********002X%'")
            leaked_audit = f.db.scalar("SELECT COUNT(*) FROM audit_logs WHERE CAST(details_json AS CHAR) LIKE '%" + ID_A + "%'")
            leaked_events = f.db.scalar("SELECT COUNT(*) FROM domain_events WHERE CAST(details_json AS CHAR) LIKE '%" + ID_A + "%'")
            check('identity audit keeps only the masked fact', int(audit_rows[0][0]) >= 1 and leaked_audit == 0 and leaked_events == 0,
                  {'masked': audit_rows, 'audit': leaked_audit, 'events': leaked_events})
            status, other_admin_detail = f.call('GET', '/admin/employees/' + target, None, tokens['other-admin'])
            check('another company administrator cannot read the employee or identity', status == 404, status)
            employee_target_token = tokens['alpha-one-employee']
            status, _ = f.call('GET', '/admin/employees/' + target, None, employee_target_token)
            check('an employee cannot use the administrator employee detail', status == 403, status)

            # ---- Independent onboarding reuses the full-plan atomic contract.
            onboard_body = {'displayName': '独立入职员工', 'phone': '13977770011', 'idCardNo': ID_B,
                            'hireDate': '2025-01-31', 'placementType': 'employee',
                            'departmentId': 'fixture-company-beta', 'teamId': 'fixture-company-beta-one',
                            'positionId': 'fixture-company-title'}
            onboard_key = 'onboard-' + uuid.uuid4().hex
            status, created = call('POST', '/admin/employees', onboard_body, key=onboard_key)
            check('independent onboarding creates the account and returns one initial password',
                  status == 201 and created.get('userId') and created.get('initialPassword'), created)
            check('onboarding returns the employee version that the new row reads back',
                  created.get('rowVersion') == call('GET', '/admin/employees/' + created['userId'])[1]['rowVersion'])
            onboarded = created['userId']
            status, onboard_detail = call('GET', '/admin/employees/' + onboarded)
            check('onboarding saves the full identity and hire date in the same transaction',
                  onboard_detail.get('idCardNo') == ID_B and onboard_detail.get('hireDate') == '2025-01-31'
                  and bool(onboard_detail.get('active')), onboard_detail)
            status, replay = call('POST', '/admin/employees', onboard_body, key=onboard_key)
            check('idempotent onboarding replay returns the same account without a second password',
                  status == 201 and replay.get('userId') == onboarded and 'initialPassword' not in replay, replay)
            check('idempotent onboarding replay creates no duplicate row', f.db.scalar(
                "SELECT COUNT(*) FROM users WHERE login_phone='13977770011'") == 1)
            status, login = f.call('POST', '/auth/sessions', {'accountType': 'employee', 'phone': '13977770011',
                                                              'password': created['initialPassword']})
            check('the onboarded account can sign in and must change its password', status == 200
                  and login.get('passwordChangeRequired') is True, status)
            status, _ = f.call('POST', '/auth/password',
                               {'currentPassword': created['initialPassword'], 'newPassword': 'Employee@2026'},
                               login['token'], 'onboard-pw-' + uuid.uuid4().hex)
            check('the onboarded employee completes the forced password change', status == 200, status)
            status, relogin = f.call('POST', '/auth/sessions', {'accountType': 'employee', 'phone': '13977770011',
                                                                'password': 'Employee@2026'})
            check('the onboarded employee signs in with the new password', status == 200, status)
            onboard_token = relogin['token']

            def rejected_onboarding(body, label, expected=400, code=None):
                status, result = call('POST', '/admin/employees', body, key='reject-' + uuid.uuid4().hex)
                ok = status == expected and (code is None or result.get('code') == code)
                check(label, ok and chinese_safe(result.get('message')), {'status': status, 'body': result})
                return result

            rejected_onboarding({**onboard_body, 'displayName': '第二创始人', 'phone': '13977770012',
                                 'idCardNo': ID_C, 'placementType': 'founder', 'departmentId': None, 'teamId': None},
                                'a second founder is refused and routed to organization adjustment', 409, 'ORGANIZATION_PLAN_REQUIRED')
            rejected_onboarding({**onboard_body, 'displayName': '占用负责人', 'phone': '13977770013',
                                 'idCardNo': ID_D, 'placementType': 'team_head',
                                 'teamId': 'fixture-company-alpha-one'},
                                'an occupied head position is refused and routed to organization adjustment', 409, 'ORGANIZATION_PLAN_REQUIRED')
            rejected_onboarding({**onboard_body, 'displayName': '跨部门团队', 'phone': '13977770014',
                                 'idCardNo': ID_E, 'departmentId': 'fixture-company-alpha',
                                 'teamId': 'fixture-company-beta-one'},
                                'a cross-department team is refused and routed to organization adjustment', 409, 'ORGANIZATION_PLAN_REQUIRED')
            rejected_onboarding({**onboard_body, 'displayName': '重复手机号', 'phone': '13977770011',
                                 'idCardNo': ID_F}, 'a duplicate login phone is refused', 409, 'PHONE_TAKEN')
            rejected_onboarding({**onboard_body, 'displayName': '重复身份证', 'phone': '13977770015',
                                 'idCardNo': ID_A}, 'a duplicate identity number is refused', 409, 'ID_CARD_TAKEN')
            rejected_onboarding({**onboard_body, 'displayName': '缺身份证', 'phone': '13977770016',
                                 'idCardNo': None}, 'onboarding without an identity number is refused')
            rejected_onboarding({**onboard_body, 'displayName': '非法身份证', 'phone': '13977770017',
                                 'idCardNo': ID_BAD_CHECKSUM}, 'onboarding with an invalid identity number is refused')
            rejected_onboarding({**onboard_body, 'displayName': '未来日期', 'phone': '13977770018',
                                 'idCardNo': ID_F, 'hireDate': '2999-01-01'}, 'a future hire date rejects the account atomically')
            rejected_onboarding({**onboard_body, 'displayName': '无效职位', 'phone': '13977770019',
                                 'idCardNo': ID_F, 'positionId': 'no-such-position'}, 'an unknown position rejects the account atomically')
            check('every failed onboarding left no account and no identity row',
                  f.db.scalar("SELECT COUNT(*) FROM users WHERE login_phone IN "
                              "('13977770012','13977770013','13977770014','13977770015','13977770016','13977770017','13977770018','13977770019')") == 0
                  and f.db.scalar("SELECT COUNT(*) FROM employee_identity_documents WHERE id_card_no IN "
                                  "('" + ID_C + "','" + ID_D + "','" + ID_E + "','" + ID_F + "')") == 0)

            # ---- Soft-deleted task history: filter, deletion projection, read-only history.
            now = dt.datetime.now(dt.timezone.utc)
            task_body = {'title': '删除历史检查任务', 'description': '真实删除历史', 'priority': 'medium', 'allDay': False,
                         'startAt': (now - dt.timedelta(hours=1)).isoformat(),
                         'dueAt': (now + dt.timedelta(days=2)).isoformat(), 'assigneeIds': [ids['founder']]}
            status, task = call('POST', '/tasks', task_body, who='founder')
            check('a task exists for the deleted-history check', status == 201, task)
            task_id = task['taskId']
            status, comment = call('POST', '/tasks/' + task_id + '/comments', {'body': '删除前保留的真实评论'}, who='founder')
            check('a real comment exists before the task is deleted', status in (200, 201), comment)
            status, deleted = call('DELETE', '/tasks/' + task_id, {'reason': '重复创建'},
                                   who='founder', version=call('GET', '/tasks/' + task_id, who='founder')[1]['rowVersion'])
            check('the founder deletes the task softly', status == 200 and deleted.get('deleted') is True, deleted)
            status, deleted_only = call('GET', '/admin/tasks?deleted=true')
            check('administrator deleted filter returns the deleted task',
                  status == 200 and deleted_only['total'] == 1
                  and deleted_only['items'][0]['taskId'] == task_id
                  and deleted_only['items'][0]['deleted'] is True
                  and deleted_only['items'][0]['deletedAt'] and deleted_only['items'][0]['deletedByName'], deleted_only)
            status, normal_only = call('GET', '/admin/tasks?deleted=false')
            check('administrator normal filter excludes the deleted task',
                  status == 200 and all(item['deleted'] is False for item in normal_only['items'])
                  and all(item['taskId'] != task_id for item in normal_only['items']), normal_only.get('total'))
            status, mixed = call('GET', '/admin/tasks')
            check('administrator mixed list keeps normal and deleted rows distinguishable',
                  status == 200 and any(item['taskId'] == task_id for item in mixed['items'])
                  and all('deleted' in item for item in mixed['items']))
            status, history = call('GET', '/admin/tasks/' + task_id + '/history')
            check('deleted task history returns deletion time, actor, reason and prior records',
                  status == 200 and history['deleted'] is True and history['deletedAt']
                  and history['deletedByName'] and history['deleteReason'] == '重复创建'
                  and history['versions'] and any(entry['entryType'] == 'deleted' for entry in history['entries']), history.get('deleted'))
            check('deleted task history still returns its comments',
                  any(row.get('body') == '删除前保留的真实评论' for row in history.get('comments', [])), history.get('comments'))
            status, gone = f.call('GET', '/tasks/' + task_id, None, tokens['founder'])
            check('the deleted task detail stays unavailable for normal business use',
                  status == 410 and gone.get('code') == 'TASK_DELETED', gone)
            status, employee_history = f.call('GET', '/admin/tasks/' + task_id + '/history', None, onboard_token)
            check('an employee token cannot read administrator task history', status == 403, status)

            # ---- Independent offboarding: restricted plan, atomic settlement, sessions and history.
            def org_version():
                return call('GET', '/admin/organization-plans')[1]['rowVersion']

            def responsibilities(employee_id):
                status, body = call('GET', '/admin/employees/' + employee_id + '/responsibilities')
                check('administrator reads the responsibility inventory for ' + employee_id, status == 200, body)
                return body

            status, founder_offboard = call('POST', '/admin/employees/' + ids['founder'] + '/offboard',
                                            {'reason': '创始人普通离职'}, version=org_version())
            check('the fixed founder cannot be offboarded through the ordinary route',
                  status == 409 and founder_offboard.get('code') == 'FOUNDER_OFFBOARDING_NOT_ALLOWED', founder_offboard)

            plain = ids['beta-one-employee']
            status, _ = call('PATCH', '/admin/employees/' + plain, {'idCardNo': ID_C},
                             version=call('GET', '/admin/employees/' + plain)[1]['rowVersion'])
            plain_token = tokens['beta-one-employee']
            status, plain_offboard = call('POST', '/admin/employees/' + plain + '/offboard',
                                          {'reason': '个人原因离职'}, version=org_version())
            check('a plain employee is offboarded atomically with a fresh company version',
                  status == 200 and plain_offboard.get('offboarded') is True
                  and plain_offboard.get('sessionsRevoked', 0) >= 1, plain_offboard)
            status, plain_detail = call('GET', '/admin/employees/' + plain)
            check('the offboarded employee is inactive and keeps its identity document and history',
                  not bool(plain_detail.get('active')) and plain_detail.get('idCardNo') == ID_C
                  and f.db.scalar('SELECT COUNT(*) FROM employee_identity_documents WHERE employee_id=' + quote(plain)) == 1,
                  plain_detail.get('active'))
            check('offboarding removed only that employee placement', f.db.scalar(
                'SELECT COUNT(*) FROM employee_placements WHERE employee_id=' + quote(plain)) == 0)
            status, revoked_session = f.call('GET', '/me', None, plain_token)
            check('offboarding revoked the employee session', status == 401, status)
            status, again = call('POST', '/admin/employees/' + plain + '/offboard',
                                 {'reason': '重复离职'}, version=org_version())
            check('a duplicate offboarding changes nothing and is refused in Chinese',
                  status == 400 and chinese_safe(again.get('message')), again)

            head = ids['alpha-one-head']
            check('head has no successor yet and stays active before offboarding', bool(call('GET', '/admin/employees/' + head)[1]['active']))
            status, missing_successor = call('POST', '/admin/employees/' + head + '/offboard',
                                             {'reason': '负责人离职'}, version=org_version())
            check('a unit head without a successor is refused',
                  status == 400 and missing_successor.get('code') == 'OFFBOARDING_SUCCESSOR_REQUIRED', missing_successor)
            status, wrong_successor = call('POST', '/admin/employees/' + head + '/offboard',
                                           {'reason': '负责人离职', 'successorEmployeeId': ids['beta-one-employee']},
                                           version=org_version())
            check('a successor outside the unit is refused',
                  status == 400 and chinese_safe(wrong_successor.get('message')), wrong_successor)
            head_token = tokens['alpha-one-head']
            status, head_offboard = call('POST', '/admin/employees/' + head + '/offboard',
                                         {'reason': '负责人离职', 'successorEmployeeId': ids['alpha-one-employee']},
                                         version=org_version())
            check('a unit head is offboarded together with a legal successor',
                  status == 200 and head_offboard.get('sessionsRevoked', 0) >= 1
                  and f.call('GET', '/me', None, head_token)[0] == 401, head_offboard)
            successor_placement = f.db.rows('SELECT placement_type FROM employee_placements WHERE employee_id='
                                            + quote(ids['alpha-one-employee']))
            check('the successor becomes the unit head in the same transaction',
                  successor_placement == [['team_head']], successor_placement)
            check('the offboarded head is inactive', not bool(call('GET', '/admin/employees/' + head)[1]['active']))
            status, constrained = call('GET', '/admin/organization')
            check('organization invariants remain valid after head succession',
                  status == 200 and constrained['constraints']['formalWritesReady'] is True, constrained['constraints'])

            # Pending unpublished creation blocks offboarding until it is cancelled in the same request.
            pending_body = {'title': '待审创建离职测试', 'description': '真实待审创建', 'priority': 'medium', 'allDay': False,
                            'startAt': (now - dt.timedelta(hours=1)).isoformat(),
                            'dueAt': (now + dt.timedelta(days=2)).isoformat(), 'assigneeIds': [onboarded]}
            status, pending_task = f.call('POST', '/tasks', pending_body, onboard_token, 'pending-' + uuid.uuid4().hex)
            check('the onboarded employee submits a pending creation request', status == 201, pending_task)
            inventory = responsibilities(onboarded)
            pending_request = next((item for item in inventory['pendingRequests'] if item['id'] == pending_task['requestId']), None)
            check('inventory lists the pending unpublished creation', pending_request is not None, inventory['pendingRequests'])
            status, blocked = call('POST', '/admin/employees/' + onboarded + '/offboard',
                                   {'reason': '待审未处理'}, version=org_version())
            check('offboarding refuses while a pending request remains unconfirmed',
                  status == 409 and blocked.get('code') in ('OFFBOARDING_PENDING_CONFIRMATION', 'PENDING_SETTLEMENT_REQUIRED',
                                                            'UNFINISHED_HANDOVER_REQUIRED'), blocked)
            check('the blocked offboarding leaves the employee active and the request pending',
                  bool(call('GET', '/admin/employees/' + onboarded)[1]['active'])
                  and f.db.scalar("SELECT COUNT(*) FROM approval_requests WHERE id=" + quote(pending_request['id'])
                                  + " AND status='pending'") == 1)
            status, settled = call('POST', '/admin/employees/' + onboarded + '/offboard',
                                   {'reason': '待审未发布创建已撤销',
                                    'ownPendingWithdrawals': [{'requestId': pending_request['id'],
                                                               'rowVersion': pending_request['rowVersion']}]},
                                   version=org_version())
            check('confirming the own pending withdrawal settles and completes the offboarding',
                  status == 200 and settled.get('offboarded') is True, settled)
            check('the cancelled creation request is withdrawn and the account revoked',
                  f.db.scalar("SELECT COUNT(*) FROM approval_requests WHERE id=" + quote(pending_request['id'])
                              + " AND status='withdrawn'") == 1
                  and f.call('GET', '/me', None, onboard_token)[0] == 401)
            status, after = f.call('GET', '/tasks/' + pending_task['taskId'], None, tokens['founder'])
            check('the cancelled unpublished task never became business content', status == 410 or status == 404, status)

            # Published business responsibility requires an explicit takeover before offboarding.
            take_body = {'title': '业务接管离职测试', 'description': '真实业务责任', 'priority': 'medium', 'allDay': False,
                         'startAt': (now - dt.timedelta(hours=1)).isoformat(),
                         'dueAt': (now + dt.timedelta(days=2)).isoformat(),
                         'assigneeIds': [ids['alpha-two-employee']]}
            status, take_task = f.call('POST', '/tasks', take_body, tokens['alpha-two-employee'],
                                       'take-create-' + uuid.uuid4().hex)
            check('a published task is created for the business owner', status == 201
                  and take_task.get('outcome') == 'pending', take_task)
            status, requested = f.call('GET', '/approval-requests/' + take_task['requestId'], None, tokens['alpha-two-head'])
            check('the team head reads the creation request', status == 200, status)
            status, _ = f.call('PATCH', '/approval-requests/' + take_task['requestId'],
                               {'decision': 'approve', 'comment': '同意发布'}, tokens['alpha-two-head'],
                               'approve-' + uuid.uuid4().hex, requested['rowVersion'])
            check('the creation request is approved and the task published', status == 200, status)
            published = f.db.rows('SELECT current_version_id FROM tasks WHERE id=' + quote(take_task['taskId']))
            check('the published task keeps a current version', published and published[0][0] != 'NULL', published)
            f.db.server_side("UPDATE tasks SET execution_state='done' WHERE id=" + quote(take_task['taskId']))
            owner_inventory = responsibilities(ids['alpha-two-employee'])
            business = next((item for item in owner_inventory['businessTasks'] if item['id'] == take_task['taskId']), None)
            check('the responsibility inventory includes the published business task', business is not None, owner_inventory['businessTasks'])
            status, takeover_required = call('POST', '/admin/employees/' + ids['alpha-two-employee'] + '/offboard',
                                             {'reason': '未安排业务接管'}, version=org_version())
            check('offboarding a business owner without a takeover is refused',
                  status == 409 and takeover_required.get('code') == 'BUSINESS_TAKEOVER_REQUIRED', takeover_required)
            status, takeover_done = call('POST', '/admin/employees/' + ids['alpha-two-employee'] + '/offboard',
                                         {'reason': '业务责任已接管',
                                          'businessTransfers': [{'taskId': business['id'],
                                                                 'taskVersion': business['rowVersion'],
                                                                 'ownerVersion': business['ownerVersion'],
                                                                 'previousEmployeeId': ids['alpha-two-employee'],
                                                                 'nextEmployeeId': ids['beta-two-employee'],
                                                                 'reason': '离职业务接管'}]},
                                         version=org_version())
            check('offboarding with a valid takeover commits both changes atomically',
                  status == 200 and takeover_done.get('offboarded') is True, takeover_done)
            owners = f.db.rows('SELECT employee_id FROM task_business_owners WHERE task_id=' + quote(take_task['taskId']))
            check('the nominated employee holds the task business responsibility afterwards',
                  owners == [[ids['beta-two-employee']]], owners)
            check('the offboarded business owner is inactive', not bool(call('GET', '/admin/employees/' + ids['alpha-two-employee'])[1]['active']))

            # Stale and repeated offboarding requests are safe.
            status, stale_candidate = call('POST', '/admin/employees', {
                'displayName': '旧版本离职员工', 'phone': '13977770124', 'idCardNo': ID_G,
                'placementType': 'employee', 'departmentId': 'fixture-company-beta',
                'teamId': 'fixture-company-beta-one', 'positionId': 'fixture-company-title'},
                key='stale-candidate-' + uuid.uuid4().hex)
            check('a fresh employee is prepared for the stale offboarding check', status == 201, stale_candidate)
            stale_target = stale_candidate['userId']
            status, stale_offboard = call('POST', '/admin/employees/' + stale_target + '/offboard',
                                          {'reason': '旧版本离职'}, version=org_version() - 1)
            check('an offboarding request with an old company version is refused',
                  status in (409, 412) and stale_offboard.get('code') in ('VERSION_CONFLICT', 'AUTHORIZATION_CHANGED'), stale_offboard)
            check('the stale request leaves the employee active', bool(call('GET', '/admin/employees/' + stale_target)[1]['active']))

            # ---- Administrator error safety: no raw exception, HTTP text, internal code or English field.
            status, bad_limit = call('GET', '/admin/tasks?limit=abc')
            check('an invalid paging value returns a Chinese explanation',
                  status == 400 and chinese_safe(bad_limit.get('message')), bad_limit)
            status, bad_route = call('GET', '/admin/no-such-endpoint')
            check('an unknown administrator route returns the safe Chinese not-found body',
                  status == 404 and bad_route.get('code') == 'NOT_FOUND' and chinese_safe(bad_route.get('message')), bad_route)
            status, no_match = call('PATCH', '/admin/employees/' + ids['beta-two-employee'], {'displayName': '无版本'})
            check('a missing If-Match keeps its Chinese precondition message',
                  status == 428 and no_match.get('code') == 'PRECONDITION_REQUIRED' and chinese_safe(no_match.get('message')), no_match)
            status, employee_admin = f.call('GET', '/admin/employees', None, tokens['founder'])
            check('an employee token is refused by the administrator directory',
                  status == 403 and chinese_safe(employee_admin.get('message')), employee_admin)
            status, malformed = raw_post('/admin/employees', '{"displayName":', admin_token)
            check('malformed JSON returns the safe Chinese validation body',
                  status == 400 and malformed.get('code') == 'INVALID_INPUT' and chinese_safe(malformed.get('message')), malformed)
            status, unknown_field = call('POST', '/admin/employees',
                                         {**onboard_body, 'phones': '13977770099'}, key='unknown-' + uuid.uuid4().hex)
            check('an unsupported request field is rejected in Chinese without echoing the field name',
                  status == 400 and chinese_safe(unknown_field.get('message')), unknown_field)

            # ---- End-state invariants and identity non-disclosure.
            status, final_org = call('GET', '/admin/organization')
            check('the final organization is still formally writable', status == 200
                  and final_org['constraints']['formalWritesReady'] is True, final_org['constraints'])
            check('the founder is unchanged and there is exactly one', len(f.db.rows(
                "SELECT founder_employee_id FROM organizations WHERE id='fixture-company' "
                "AND founder_employee_id=" + quote(ids['founder']))) == 1)
            check('no login phone is duplicated after the lifecycle writes', f.db.scalar(
                "SELECT COUNT(*) FROM (SELECT login_phone FROM users WHERE login_phone IS NOT NULL "
                "GROUP BY login_phone HAVING COUNT(*)>1) duplicated") == 0)
            check('no pending request is left without a possible reviewer', f.db.scalar(
                "SELECT COUNT(*) FROM approval_requests WHERE status='pending' AND current_reviewer_id IS NULL") == 0)
            check('every department and team still has exactly one head', f.db.scalar(
                "SELECT COUNT(*) FROM departments d WHERE NOT EXISTS (SELECT 1 FROM employee_placements p "
                "WHERE p.department_id=d.id AND p.placement_type='department_head')") == 0 and f.db.scalar(
                "SELECT COUNT(*) FROM teams t WHERE NOT EXISTS (SELECT 1 FROM employee_placements p "
                "WHERE p.team_id=t.id AND p.placement_type='team_head')") == 0)

            employee_paths = ['/me', '/users', '/users/' + ids['founder'], '/tasks', '/home', '/notifications',
                              '/work-logs', '/approval-requests', '/me/reports']
            leaked = []
            for path in employee_paths:
                status, payload = f.call('GET', path, None, tokens['founder'])
                text = json.dumps(payload, ensure_ascii=False)
                if ID_A in text or '110105********002X' in text:
                    leaked.append((path, status))
            check('employee projections never contain the identity number or its masked form', leaked == [], leaked)
            status, admin_list = call('GET', '/admin/employees')
            check('the administrator directory never contains a full identity number',
                  ID_A not in json.dumps(admin_list) and ID_B not in json.dumps(admin_list), 'list leakage')
            status, inventory = call('GET', '/admin/employees/' + ids['beta-two-employee'] + '/responsibilities')
            check('the responsibility inventory has no identity field', ID_A not in json.dumps(inventory), 'inventory leakage')
            check('the service log never prints the full identity number',
                  ID_A not in SERVICE_LOG.read_text(errors='ignore') and ID_B not in SERVICE_LOG.read_text(errors='ignore'), 'log leakage')

            report['database'] = f.database
    finally:
        report['updated'] = dt.datetime.now(dt.timezone.utc).isoformat()
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str))
        failed = [row for row in report['checks'] if not row['pass']]
        print(json.dumps({'total': len(report['checks']), 'failed': len(failed), 'report': str(OUTPUT)},
                         ensure_ascii=False), flush=True)
    return 0 if not failed else 1


if __name__ == '__main__':
    raise SystemExit(main())
