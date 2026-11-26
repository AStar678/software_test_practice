#!/usr/bin/env python3
"""Real-service acceptance for separate administrator offboarding and organization adjustment.

Owns disposable MySQL databases and packaged-JAR services; never points at the normal database and never
prints credentials. Covers the organization-adjustment contract, the single-employee offboarding inventory
and atomic command, execution handover, pending withdrawal/reassignment, standalone organization adjustment
scope, administrator-only exact identity search and rollback/idempotency behavior.
"""
import concurrent.futures
import datetime as dt
import json
import re
import threading
import urllib.error
import urllib.request
import uuid
from pathlib import Path

from fixed_model_fixture import Fixture, PASSWORD, quote
from migration_precheck import BASE

AUDIT = BASE.parent / 'audit/refactor-pandora-organization-and-workflows'
OUTPUT = AUDIT / 'admin-offboarding.json'
SERVICE_LOG = AUDIT / 'admin-offboarding-service.log'
SERVICE_LOG_HEAD = AUDIT / 'admin-offboarding-head-service.log'
SERVICE_LOG_ORG = AUDIT / 'admin-offboarding-org-service.log'
SERVICE_LOG_CONCURRENT = AUDIT / 'admin-offboarding-concurrent-service.log'

ID_CARD = '11010519491231002X'
ID_CARD_LOWER = '11010519491231002x'
OTHER_ID = '320102198203030031'
VALID_ID_1 = '110101198001010010'
VALID_ID_2 = '440301198102020020'


def main() -> int:
    report = {'updated': dt.datetime.now(dt.timezone.utc).isoformat(), 'checks': []}

    def check(name, condition, evidence=None):
        report['checks'].append({'check': name, 'pass': bool(condition), 'evidence': evidence})
        print(('PASS  ' if condition else 'FAIL  ') + name, flush=True)
        if not condition:
            raise AssertionError(name + ' -> ' + json.dumps(evidence, ensure_ascii=False, default=str)[:800])

    class Client:
        def __init__(self, fixture, log_path):
            self.f = fixture
            fixture.log_path = log_path
            self.ids = {key: value['id'] for key, value in fixture.identities.items()}
            self.tokens = {key: fixture.login(key)[1]['token'] for key in fixture.identities}

        def call(self, method, path, body=None, who='admin', version=None, key=None):
            return self.f.call(method, path, body, self.tokens[who], key or 'offboarding-' + uuid.uuid4().hex, version)

        @staticmethod
        def form(title, owners, ids):
            now = dt.datetime.now(dt.timezone.utc)
            return {'title': title, 'description': 'offboarding acceptance', 'priority': 'medium', 'allDay': False,
                    'startAt': (now - dt.timedelta(hours=1)).isoformat(),
                    'dueAt': (now + dt.timedelta(days=2)).isoformat(), 'assigneeIds': [ids[key] for key in owners]}

        def create(self, title, owners, who='founder', approve=True):
            status, result = self.call('POST', '/tasks', self.form(title, owners, self.ids), who=who)
            if status != 201:
                raise RuntimeError('create failed: ' + json.dumps(result, ensure_ascii=False))
            if approve and result.get('outcome') == 'pending':
                reviewer = self.approver(who)
                view = self.call('GET', '/approval-requests/' + result['requestId'], who=reviewer)[1]
                status, decided = self.call('PATCH', '/approval-requests/' + result['requestId'],
                                            {'decision': 'approve', 'comment': 'acceptance'}, who=reviewer,
                                            version=view['rowVersion'])
                if status != 200:
                    raise RuntimeError('approval failed: ' + json.dumps(decided, ensure_ascii=False))
            return result

        def approver(self, who):
            return {'alpha-one-employee': 'alpha-one-head', 'alpha-two-employee': 'alpha-two-head',
                    'alpha-one-head': 'alpha-head', 'alpha-two-head': 'alpha-head',
                    'alpha-head': 'founder', 'beta-one-employee': 'beta-one-head',
                    'beta-two-employee': 'beta-two-head', 'beta-one-head': 'beta-head',
                    'beta-two-head': 'beta-head', 'beta-head': 'founder'}[who]

        def complete(self, task, who):
            view = self.call('GET', '/tasks/' + task, who=who)[1]
            status, result = self.call('PATCH', '/tasks/' + task, {'command': 'complete', 'completionNote': 'done'},
                                       who=who, version=view['rowVersion'])
            if status != 200:
                raise RuntimeError('complete failed: ' + json.dumps(result, ensure_ascii=False))
            if result.get('outcome') == 'pending':
                reviewer = self.approver(who)
                request = self.call('GET', '/approval-requests/' + result['requestId'], who=reviewer)[1]
                self.call('PATCH', '/approval-requests/' + result['requestId'],
                          {'decision': 'approve', 'comment': 'acceptance'}, who=reviewer,
                          version=request['rowVersion'])
            return result

        def inventory(self, who):
            status, body = self.call('GET', '/admin/employees/' + self.ids[who] + '/offboarding')
            if status != 200:
                raise RuntimeError('inventory failed: ' + json.dumps(body, ensure_ascii=False))
            return body

    # ---------------------------------------------------------------- organization write contract
    fixture = Fixture(port=18197)
    fixture.log_path = SERVICE_LOG
    try:
        with fixture as f:
            c = Client(f, SERVICE_LOG)
            status, draft = c.call('GET', '/admin/organization-plans')
            check('administrator reads the organization draft', status == 200, status)
            version = draft['rowVersion']
            base_plan = {key: draft[key] for key in ('departments', 'teams', 'placements', 'expectedEmployees')}
            base_plan['reason'] = 'contract check'
            for field, payload in (
                    ('deactivateEmployees', [{'employeeId': c.ids['alpha-one-employee'], 'rowVersion': 1, 'reason': 'x'}]),
                    ('newEmployees', [{'id': str(uuid.uuid4()), 'displayName': 'x', 'phone': '13911112222',
                                       'idCardNo': VALID_ID_1}]),
                    ('businessTransfers', [{'taskId': str(uuid.uuid4())}]),
                    ('cancelUnpublishedRequests', [{'requestId': str(uuid.uuid4()), 'rowVersion': 1, 'reason': 'x'}])):
                status, rejected = c.call('POST', '/admin/organization-plans', {**base_plan, field: payload},
                                          version=version)
                check('organization adjustment rejects legacy lifecycle field ' + field,
                      status == 400 and rejected.get('code') == 'INVALID_INPUT', {'status': status, 'code': rejected.get('code')})
                check('rejected lifecycle plan writes nothing for ' + field,
                      f.db.scalar('SELECT COUNT(*) FROM users WHERE active=0') == 0
                      and c.call('GET', '/admin/organization-plans')[1]['rowVersion'] == version)
            legal = {key: draft[key] for key in ('departments', 'teams', 'placements', 'expectedEmployees')}
            legal['reason'] = 'rename a team'
            legal['teams'][0]['name'] = legal['teams'][0]['name'] + ' 调整'
            status, saved = c.call('POST', '/admin/organization-plans', legal, version=version, key='legal-structure')
            check('a legal structure-only organization plan still saves', status == 200 and saved.get('rowVersion') > version,
                  {'status': status, 'code': saved.get('code')})
            check('saved structure is visible', c.call('GET', '/admin/organization-plans')[1]['teams'][0]['name'].endswith('调整'))

            status, onboard = c.call('POST', '/admin/employees', {
                'displayName': '入职回归员工', 'phone': '13988881111', 'idCardNo': VALID_ID_2,
                'hireDate': '2025-01-02', 'placementType': 'employee',
                'departmentId': 'fixture-company-beta', 'teamId': 'fixture-company-beta-one',
                'positionId': 'fixture-company-title'})
            check('independent onboarding still works beside the narrowed organization command',
                  status == 201 and onboard.get('initialPassword'), {'status': status, 'code': onboard.get('code')})
            token = c.tokens['admin']
            for method, path in (('POST', '/admin/business-takeovers'),):
                status, body = c.call(method, path, {'transfers': []}, version=saved['rowVersion'])
                check('standalone administrator takeover write endpoint is retired', status in (404, 405), status)
            status, history = c.call('GET', '/admin/employees/' + c.ids['alpha-one-employee'] + '/responsibilities')
            check('read-only responsibility history remains available', status == 200 and 'businessTasks' in history, status)
            status, body = c.call('GET', '/admin/employees/' + c.ids['alpha-one-employee'] + '/offboarding', who='alpha-one-employee')
            check('a business account cannot read the offboarding inventory', status == 403, status)
            status, body = c.call('POST', '/admin/employees/' + c.ids['alpha-one-employee'] + '/offboard',
                                  {'reason': 'x'}, who='alpha-one-employee', version=saved['rowVersion'])
            check('a business account cannot invoke offboarding', status == 403, status)

            # ---------------------------------------------------- inventory and atomic offboarding
            t1 = c.create('共享进行中任务', ['alpha-one-employee', 'alpha-two-employee'])['taskId']
            t2 = c.create('唯一负责人任务', ['alpha-one-employee'])['taskId']
            t3 = c.create('已完成且有管理权', ['alpha-one-employee'], who='alpha-one-employee')['taskId']
            c.complete(t3, 'alpha-one-employee')
            t4 = c.create('在建且带管理权', ['alpha-one-employee'], who='alpha-one-employee')['taskId']
            deleted = c.create('软删除任务', ['alpha-one-employee'], who='alpha-one-employee')['taskId']
            view = c.call('GET', '/tasks/' + deleted, who='alpha-one-employee')[1]
            status, body = c.call('DELETE', '/tasks/' + deleted, {'reason': 'acceptance delete'},
                                  who='alpha-one-employee', version=view['rowVersion'])
            check('a published task can be soft-deleted before the inventory', status == 200, body)
            own_creation = c.create('本人未发布创建', ['alpha-two-employee'], who='alpha-one-employee', approve=False)
            progress_view = c.call('GET', '/tasks/' + t2, who='alpha-one-employee')[1]
            status, progress = c.call('PATCH', '/tasks/' + t2, {'command': 'progress', 'progressNote': '待处理'},
                                      who='alpha-one-employee', version=progress_view['rowVersion'])
            check('a departing employee can have different own pending request kinds',
                  status == 200 and progress.get('outcome') == 'pending' and own_creation.get('outcome') == 'pending')
            foreign = c.create('他人提案指向离职人', ['alpha-one-employee'], who='alpha-two-employee', approve=False)
            check('a third-party proposal can name the departing employee', foreign.get('outcome') == 'pending')

            inventory = c.inventory('alpha-one-employee')
            check('inventory binds the current company version', isinstance(inventory['rowVersion'], int), inventory['rowVersion'])
            assignment_ids = {row['taskId'] for row in inventory['executionAssignments']}
            check('inventory lists live unfinished assignments', {t1, t2, t4} <= assignment_ids, sorted(assignment_ids))
            check('soft-deleted work is excluded from the active handover', deleted not in assignment_ids)
            check('a multi-owner task may be removed and a unique owner must be replaced',
                  next(row for row in inventory['executionAssignments'] if row['taskId'] == t1)['replacementRequired'] is False
                  and next(row for row in inventory['executionAssignments'] if row['taskId'] == t2)['replacementRequired'] is True)
            managed_ids = {row['taskId'] for row in inventory['managedTasks']}
            check('management inventory includes completed and live tasks', {t3, t4} <= managed_ids, sorted(managed_ids))
            check('soft-deleted management history needs no takeover', deleted not in managed_ids)
            pending = {row['requestId']: row for row in inventory['pendingRequests']}
            check('inventory distinguishes self-submitted pending requests',
                  pending[progress['requestId']]['result'] == 'withdraw'
                  and pending[own_creation['requestId']]['result'] == 'withdraw')
            check('inventory marks a third-party proposed-assignee conflict as blocked',
                  pending[foreign['requestId']]['result'] == 'blocked'
                  and pending[foreign['requestId']]['proposedAssignee'] is True)
            check('blocked inventory disables offboarding', inventory['canOffboard'] is False
                  and any(row['code'] == 'PENDING_REQUEST' for row in inventory['blockers']))
            check('candidate projections carry department/team but no identity data',
                  all('idCardNoMasked' not in row and 'idCardNo' not in row for row in inventory['handoverCandidates'])
                  and all('departmentName' in row for row in inventory['handoverCandidates']))

            # The third-party proposal blocks the whole command without a single write.
            status, rejected = c.call('POST', '/admin/employees/' + c.ids['alpha-one-employee'] + '/offboard',
                                      {'reason': 'blocked', 'ownPendingWithdrawals': [
                                          {'requestId': row['requestId'], 'rowVersion': row['requestVersion']}
                                          for row in inventory['pendingRequests'] if row['selfSubmitted']]},
                                      version=inventory['rowVersion'])
            check('a third-party proposed-assignee request blocks offboarding',
                  status == 409 and rejected.get('code') == 'OFFBOARDING_PENDING_BLOCKED', rejected)
            blocked_snapshot = {
                'versions': f.db.scalar('SELECT COUNT(*) FROM task_versions'),
                'pending': f.db.scalar("SELECT COUNT(*) FROM approval_requests WHERE status='pending'"),
                'org': f.db.scalar('SELECT authz_version FROM organizations WHERE id=' + quote('fixture-company')),
            }
            check('a blocked command keeps requests, versions and organization unchanged',
                  blocked_snapshot['versions'] == 9 and blocked_snapshot['pending'] == 3 and blocked_snapshot['org'] >= 3,
                  blocked_snapshot)

            foreign_view = c.call('GET', '/approval-requests/' + foreign['requestId'], who='alpha-two-employee')[1]
            c.call('PATCH', '/approval-requests/' + foreign['requestId'],
                   {'decision': 'withdraw', 'comment': 'acceptance'}, who='alpha-two-employee',
                   version=foreign_view['rowVersion'])
            inventory = c.inventory('alpha-one-employee')
            check('the inventory clears the blocker after the proposal is withdrawn', inventory['canOffboard'] is True,
                  inventory['blockers'])
            own = [row for row in inventory['pendingRequests'] if row['selfSubmitted']]
            stale_version = inventory['rowVersion']
            stale_task = next(row for row in inventory['executionAssignments'] if row['taskId'] == t1)
            body = {
                'reason': 'acceptance offboarding',
                'executionHandovers': [
                    {'taskId': t1, 'taskVersion': stale_task['taskVersion'], 'action': 'remove'},
                    {'taskId': t2, 'taskVersion': next(row['taskVersion'] for row in inventory['executionAssignments'] if row['taskId'] == t2),
                     'action': 'replace', 'replacementEmployeeId': c.ids['beta-one-employee']},
                    {'taskId': t4, 'taskVersion': next(row['taskVersion'] for row in inventory['executionAssignments'] if row['taskId'] == t4),
                     'action': 'replace', 'replacementEmployeeId': c.ids['beta-one-employee']},
                ],
                'businessTransfers': [
                    {'taskId': task, 'taskVersion': next(row['taskVersion'] for row in inventory['managedTasks'] if row['taskId'] == task),
                     'ownerVersion': next(row['ownerVersion'] for row in inventory['managedTasks'] if row['taskId'] == task),
                     'previousEmployeeId': c.ids['alpha-one-employee'], 'nextEmployeeId': c.ids['beta-two-employee'],
                     'reason': 'acceptance takeover'} for task in (t3, t4)],
                'ownPendingWithdrawals': [{'requestId': row['requestId'], 'rowVersion': row['requestVersion']} for row in own],
            }

            # Missing a live execution assignment is refused.
            status, rejected = c.call('POST', '/admin/employees/' + c.ids['alpha-one-employee'] + '/offboard',
                                      {**body, 'executionHandovers': body['executionHandovers'][:1]},
                                      version=inventory['rowVersion'])
            check('offboarding requires a decision for every live assignment',
                  status == 409 and rejected.get('code') == 'OFFBOARDING_ASSIGNMENT_REQUIRED', rejected)
            # Removing the only valid owner is refused.
            unique = next(row for row in inventory['executionAssignments'] if row['taskId'] == t2)
            status, rejected = c.call('POST', '/admin/employees/' + c.ids['alpha-one-employee'] + '/offboard',
                                      {**body, 'executionHandovers': [
                                          {'taskId': t1, 'taskVersion': stale_task['taskVersion'], 'action': 'remove'},
                                          {'taskId': t2, 'taskVersion': unique['taskVersion'], 'action': 'remove'},
                                          {'taskId': t4, 'taskVersion': next(row['taskVersion'] for row in inventory['executionAssignments'] if row['taskId'] == t4),
                                           'action': 'replace', 'replacementEmployeeId': c.ids['beta-one-employee']}]},
                                      version=inventory['rowVersion'])
            check('a unique live owner cannot be removed without a replacement',
                  status == 409 and rejected.get('message', '').startswith('任务至少需要保留'), rejected)
            # Missing management takeover is refused.
            status, rejected = c.call('POST', '/admin/employees/' + c.ids['alpha-one-employee'] + '/offboard',
                                      {**body, 'businessTransfers': body['businessTransfers'][:1]},
                                      version=inventory['rowVersion'])
            check('offboarding requires management takeover for completed tasks too',
                  status == 409 and rejected.get('code') == 'BUSINESS_TAKEOVER_REQUIRED', rejected)
            # Own pending confirmation must match exactly.
            status, rejected = c.call('POST', '/admin/employees/' + c.ids['alpha-one-employee'] + '/offboard',
                                      {**body, 'ownPendingWithdrawals': body['ownPendingWithdrawals'][:1]},
                                      version=inventory['rowVersion'])
            check('offboarding refuses an incomplete own-pending confirmation set',
                  status == 409 and rejected.get('code') == 'OFFBOARDING_PENDING_CONFIRMATION', rejected)
            # An invalid takeover executes no partial write, even after structure/handover/withdrawal work.
            snapshot = {
                'versions': f.db.scalar('SELECT COUNT(*) FROM task_versions'),
                'pending': f.db.scalar("SELECT COUNT(*) FROM approval_requests WHERE status='pending'"),
                'org': f.db.scalar('SELECT authz_version FROM organizations WHERE id=' + quote('fixture-company')),
            }
            broken = [dict(row) for row in body['businessTransfers']]
            broken[0]['ownerVersion'] = 999
            status, rejected = c.call('POST', '/admin/employees/' + c.ids['alpha-one-employee'] + '/offboard',
                                      {**body, 'businessTransfers': broken}, version=inventory['rowVersion'])
            check('a late takeover validation failure rejects the whole offboarding',
                  status == 412 and rejected.get('code') == 'VERSION_CONFLICT', rejected)
            after = {
                'versions': f.db.scalar('SELECT COUNT(*) FROM task_versions'),
                'pending': f.db.scalar("SELECT COUNT(*) FROM approval_requests WHERE status='pending'"),
                'active': f.db.scalar('SELECT active FROM users WHERE id=' + quote(c.ids['alpha-one-employee'])),
                'sessions': f.db.scalar('SELECT COUNT(*) FROM auth_sessions WHERE user_id=' + quote(c.ids['alpha-one-employee']) + ' AND revoked_at IS NULL'),
            }
            check('no partial withdrawal, version or deactivation survives a late failure',
                  snapshot['versions'] == after['versions'] and snapshot['pending'] == after['pending']
                  and str(after['active']) == '1' and int(after['sessions']) == 1, {'before': snapshot, 'after': after})
            # Stale company version is refused and writes nothing.
            status, rejected = c.call('POST', '/admin/employees/' + c.ids['alpha-one-employee'] + '/offboard',
                                      body, version=inventory['rowVersion'] - 1)
            check('a stale company version is refused before any final write',
                  status == 412 and rejected.get('code') == 'VERSION_CONFLICT', rejected)
            # Employees cannot invoke the command.
            status, rejected = c.call('POST', '/admin/employees/' + c.ids['alpha-one-employee'] + '/offboard',
                                      body, who='alpha-one-employee', version=inventory['rowVersion'])
            check('a business account cannot submit the offboarding command', status == 403, status)

            status, result = c.call('POST', '/admin/employees/' + c.ids['alpha-one-employee'] + '/offboard',
                                    body, version=inventory['rowVersion'], key='offboarding-plain-success')
            check('a complete offboarding succeeds', status == 200 and result.get('offboarded') is True, result)
            check('offboarding reports own withdrawals and expired requests',
                  result.get('withdrawnOwnRequests') == 2 and result.get('expiredOwnRequests') == 0, result)
            check('the employee is deactivated and every session is revoked',
                  int(f.db.scalar('SELECT active FROM users WHERE id=' + quote(c.ids['alpha-one-employee']))) == 0
                  and int(f.db.scalar('SELECT COUNT(*) FROM auth_sessions WHERE user_id=' + quote(c.ids['alpha-one-employee']) + ' AND revoked_at IS NULL')) == 0)
            status, _ = c.call('GET', '/tasks/' + t1, who='alpha-one-employee')
            check('the former employee token loses access immediately', status == 401, status)
            def owners(task):
                return f.db.rows('SELECT u.display_name FROM task_version_assignees a JOIN tasks t ON t.organization_id=a.organization_id '
                                 'AND t.current_version_id=a.version_id JOIN users u ON u.id=a.user_id WHERE t.id=' + quote(task) + ' ORDER BY a.ordinal')
            check('a live task with another owner keeps that owner after removal', owners(t1) == [['alpha-two-employee']], owners(t1))
            check('a unique owner is replaced in the same position', owners(t2) == [['beta-one-employee']], owners(t2))
            check('the replacement of a multi-owner task is inserted in place', owners(t4) == [['beta-one-employee']], owners(t4))
            check('a completed task keeps its historical assignee', owners(t3) == [['alpha-one-employee']], owners(t3))
            check('completed-task management moves to the chosen administrator-selected owner',
                  f.db.rows('SELECT COALESCE(b.employee_id,t.original_creator_id) FROM tasks t LEFT JOIN task_business_owners b '
                            'ON b.organization_id=t.organization_id AND b.task_id=t.id WHERE t.id=' + quote(t3))[0][0] == c.ids['beta-two-employee'])
            check('the takeover receiver is not added as an execution owner',
                  'beta-two-employee' not in [row[0] for row in owners(t4)])
            check('own pending requests are withdrawn with the offboarding source',
                  f.db.scalar('SELECT COUNT(*) FROM approval_requests WHERE id=' + quote(progress['requestId'])
                              + " AND status='withdrawn' AND decided_by=" + quote(c.ids['admin'])) == 1
                  and f.db.scalar('SELECT COUNT(*) FROM approval_requests WHERE id=' + quote(own_creation['requestId'])
                                  + " AND status='withdrawn'") == 1)
            check('unrelated decided requests are untouched',
                  f.db.scalar("SELECT COUNT(*) FROM approval_requests WHERE id=" + quote(foreign['requestId']) + " AND status='withdrawn'") == 1)
            check('the execution handover writes an ordered history entry and a version authored by the administrator',
                  f.db.scalar('SELECT COUNT(*) FROM task_history_entries WHERE task_id=' + quote(t2)
                              + " AND entry_type='offboarding_handover'") == 1
                  and f.db.rows('SELECT created_by FROM task_versions WHERE organization_id=' + quote('fixture-company')
                                + ' AND task_id=' + quote(t2) + " AND status='applied' ORDER BY version_no DESC LIMIT 1")[0][0] == c.ids['admin'])
            check('the takeover history keeps the original creator and records the administrator',
                  f.db.rows('SELECT original_creator_id FROM tasks WHERE id=' + quote(t3))[0][0] == c.ids['alpha-one-employee']
                  and f.db.scalar('SELECT COUNT(*) FROM task_business_transfers WHERE task_id=' + quote(t3)
                                  + ' AND administrator_id=' + quote(c.ids['admin'])) == 1)
            versions_after = f.db.scalar('SELECT COUNT(*) FROM task_versions')
            status, replay = c.call('POST', '/admin/employees/' + c.ids['alpha-one-employee'] + '/offboard',
                                    body, version=inventory['rowVersion'], key='offboarding-plain-success')
            check('an idempotent replay returns the committed result', status == 200 and replay.get('offboarded') is True, replay)
            check('an idempotent replay writes no extra version', versions_after == f.db.scalar('SELECT COUNT(*) FROM task_versions'))
            status, duplicate = c.call('POST', '/admin/employees/' + c.ids['alpha-one-employee'] + '/offboard',
                                       body, version=inventory['rowVersion'])
            check('a second offboarding of the same employee is refused', status in (400, 409, 412), {'status': status, 'code': duplicate.get('code')})
            check('the fixed founder refuses offboarding',
                  c.call('POST', '/admin/employees/' + c.ids['founder'] + '/offboard',
                         {'reason': 'x'}, version=f.db.scalar('SELECT authz_version FROM organizations WHERE id=' + quote('fixture-company')))[0] == 409)
            # The old responsibility inventory stays a read-only history surface.
            status, history = c.call('GET', '/admin/employees/' + c.ids['alpha-one-employee'] + '/responsibilities')
            check('responsibility history remains readable after offboarding', status == 200, status)

        # ---------------------------------------------------------------- unit-head offboarding
        head_fixture = Fixture(port=18198)
        head_fixture.log_path = SERVICE_LOG_HEAD
        try:
            with head_fixture as f:
                c = Client(f, SERVICE_LOG_HEAD)
                head, successor = 'alpha-two-head', 'alpha-two-employee'
                h1 = c.create('head shared live', [head, 'beta-one-employee'])['taskId']
                h2 = c.create('head completed owned', [head], who=head)['taskId']
                c.complete(h2, head)
                h3 = c.create('head live owned', [head], who=head)['taskId']
                h4 = c.create('dedupe replacement', [head, successor])['taskId']
                h5 = c.create('pending on handover task', [head, successor])['taskId']
                # Own pending creation past its deadline: it must expire, never become an attributed withdrawal.
                own_expiring = c.create('expired own creation', [head], who=head, approve=False)
                f.db.server_side("UPDATE approval_requests SET applicable_deadline=UTC_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE id="
                                 + quote(own_expiring['requestId']))
                # A subordinate creation pending on the departing reviewer is reassigned by the final organization.
                subordinate_pending = c.create('subordinate pending creation', [successor], who=successor, approve=False)
                # A third-party progress request on a task that also needs execution handover blocks the command.
                h5_view = c.call('GET', '/tasks/' + h5, who=successor)[1]
                status, conflict_pending = c.call('PATCH', '/tasks/' + h5,
                                                  {'command': 'progress', 'progressNote': 'blocking pending'},
                                                  who=successor, version=h5_view['rowVersion'])
                check('a third-party pending request exists on a task needing execution handover',
                      status == 200 and conflict_pending.get('outcome') == 'pending', conflict_pending)

                inventory = c.inventory(head)
                check('inventory marks an own request past its deadline as expiring',
                      next(row for row in inventory['pendingRequests'] if row['requestId'] == own_expiring['requestId'])['result'] == 'expire')
                check('inventory shows the successor candidate for a team head',
                      [row['id'] for row in inventory['successorCandidates']] == [c.ids[successor]], inventory['successorCandidates'])
                check('a third-party pending request on a handover task is a blocker',
                      inventory['canOffboard'] is False
                      and any(row['code'] == 'PENDING_ON_TASK' for row in inventory['blockers']), inventory['blockers'])
                # The blocking progress request is decided by the departing reviewer before the departure.
                request = c.call('GET', '/approval-requests/' + conflict_pending['requestId'], who=head)[1]
                status, decided = c.call('PATCH', '/approval-requests/' + conflict_pending['requestId'],
                                         {'decision': 'approve', 'comment': 'settled'}, who=head, version=request['rowVersion'])
                check('the departing reviewer can settle the blocking request first', status == 200, decided)
                inventory = c.inventory(head)
                check('settling the request clears the handover blocker', inventory['canOffboard'] is True, inventory['blockers'])
                snapshot = {'versions': f.db.scalar('SELECT COUNT(*) FROM task_versions'),
                            'pending': f.db.scalar("SELECT COUNT(*) FROM approval_requests WHERE status='pending'"),
                            'active': f.db.scalar('SELECT active FROM users WHERE id=' + quote(c.ids[head]))}
                handovers = [
                    {'taskId': h1, 'taskVersion': next(row['taskVersion'] for row in inventory['executionAssignments'] if row['taskId'] == h1), 'action': 'remove'},
                    {'taskId': h3, 'taskVersion': next(row['taskVersion'] for row in inventory['executionAssignments'] if row['taskId'] == h3), 'action': 'replace', 'replacementEmployeeId': c.ids['beta-two-employee']},
                    {'taskId': h4, 'taskVersion': next(row['taskVersion'] for row in inventory['executionAssignments'] if row['taskId'] == h4), 'action': 'replace', 'replacementEmployeeId': c.ids[successor]},
                    {'taskId': h5, 'taskVersion': next(row['taskVersion'] for row in inventory['executionAssignments'] if row['taskId'] == h5), 'action': 'remove'},
                ]
                transfers = [
                    {'taskId': task, 'taskVersion': next(row['taskVersion'] for row in inventory['managedTasks'] if row['taskId'] == task),
                     'ownerVersion': next(row['ownerVersion'] for row in inventory['managedTasks'] if row['taskId'] == task),
                     'previousEmployeeId': c.ids[head], 'nextEmployeeId': c.ids['beta-two-employee'], 'reason': 'head takeover'}
                    for task in (h2, h3)]
                own = [row for row in inventory['pendingRequests'] if row['selfSubmitted']]
                body = {'reason': 'head offboarding', 'successorEmployeeId': c.ids[successor],
                        'executionHandovers': handovers, 'businessTransfers': transfers,
                        'ownPendingWithdrawals': [{'requestId': row['requestId'], 'rowVersion': row['requestVersion']} for row in own]}

                status, rejected = c.call('POST', '/admin/employees/' + c.ids[head] + '/offboard',
                                          {**body, 'successorEmployeeId': None}, version=inventory['rowVersion'])
                check('a unit head departure requires a successor', status == 400 and rejected.get('code') == 'OFFBOARDING_SUCCESSOR_REQUIRED', rejected)
                check('a missing successor leaves deactivation, versions and pending requests untouched',
                      snapshot == {'versions': f.db.scalar('SELECT COUNT(*) FROM task_versions'),
                                   'pending': f.db.scalar("SELECT COUNT(*) FROM approval_requests WHERE status='pending'"),
                                   'active': f.db.scalar('SELECT active FROM users WHERE id=' + quote(c.ids[head]))},
                      {'before': snapshot,
                       'after': {'versions': f.db.scalar('SELECT COUNT(*) FROM task_versions'),
                                 'pending': f.db.scalar("SELECT COUNT(*) FROM approval_requests WHERE status='pending'"),
                                 'active': f.db.scalar('SELECT active FROM users WHERE id=' + quote(c.ids[head]))}})

                status, result = c.call('POST', '/admin/employees/' + c.ids[head] + '/offboard', body,
                                        version=inventory['rowVersion'], key='head-offboarding-success')
                check('a head offboarding with succession, handover, takeover and expiry succeeds',
                      status == 200 and result.get('offboarded') is True, result)
                check('an expired own request is expired rather than attributed as withdrawn',
                      result.get('withdrawnOwnRequests') == 0 and result.get('expiredOwnRequests') == 1, result)
                check('the expired request keeps the terminal expired status',
                      int(f.db.scalar("SELECT COUNT(*) FROM approval_requests WHERE id=" + quote(own_expiring['requestId'])
                                      + " AND status='expired'")) == 1)
                check('the successor becomes the team head and keeps the department',
                      f.db.rows('SELECT placement_type,department_id,team_id FROM employee_placements WHERE employee_id='
                                + quote(c.ids[successor])) == [['team_head', 'fixture-company-alpha', 'fixture-company-alpha-two']])
                check('the reassigned pending request now routes to the department head',
                      int(f.db.scalar("SELECT COUNT(*) FROM approval_requests r WHERE r.id=" + quote(subordinate_pending['requestId'])
                                      + " AND r.status='pending' AND r.current_reviewer_id=" + quote(c.ids['alpha-head']))) == 1,
                      f.db.rows('SELECT status,current_reviewer_id FROM approval_requests WHERE id=' + quote(subordinate_pending['requestId'])))
                check('the reassignment is recorded with its organization-refresh source',
                      int(f.db.scalar("SELECT COUNT(*) FROM request_reassignments WHERE request_id="
                                      + quote(subordinate_pending['requestId']) + " AND source='route_refresh'")) == 1)
                def owners(task):
                    return [row[0] for row in f.db.rows('SELECT u.display_name FROM task_version_assignees a '
                                                        'JOIN tasks t ON t.organization_id=a.organization_id AND t.current_version_id=a.version_id '
                                                        'JOIN users u ON u.id=a.user_id WHERE t.id=' + quote(task) + ' ORDER BY a.ordinal')]
                check('a shared task keeps its other owner after the head leaves', owners(h1) == ['beta-one-employee'], owners(h1))
                check('a head-only live task is replaced by the chosen employee', owners(h3) == ['beta-two-employee'], owners(h3))
                check('a replacement that is already an owner is deduplicated', owners(h4) == [successor], owners(h4))
                check('completed management transfers without touching the historical assignee',
                      owners(h2) == [head]
                      and f.db.rows('SELECT COALESCE(b.employee_id,t.original_creator_id) FROM tasks t LEFT JOIN task_business_owners b '
                                    'ON b.organization_id=t.organization_id AND b.task_id=t.id WHERE t.id=' + quote(h2))[0][0] == c.ids['beta-two-employee'])
                status, _ = c.call('GET', '/tasks/' + h1, who=head)
                check('the departed head loses API access immediately', status == 401, status)
                status, _ = c.call('GET', '/approval-requests/' + subordinate_pending['requestId'], who=head)
                check('the departed head can no longer read the pending request', status in (401, 404), status)
                status, _ = c.call('GET', '/approval-requests/' + subordinate_pending['requestId'], who='alpha-head')
                check('the new reviewer can read the reassigned request', status == 200, status)
        finally:
            pass


        # ---------------------------------------------------------------- standalone organization adjustment
        org_fixture = Fixture(port=18199)
        org_fixture.log_path = SERVICE_LOG_ORG
        try:
            with org_fixture as f:
                c = Client(f, SERVICE_LOG_ORG)
                pending_creation = c.create('调整中待审创建', ['alpha-one-employee'], who='alpha-one-employee', approve=False)
                approved = c.create('已批准的历史任务', ['alpha-one-employee'], who='alpha-one-employee')['taskId']
                c.complete(approved, 'alpha-one-employee')
                assigned = c.create('可见范围任务', ['alpha-one-employee'])['taskId']
                owned = c.create('调岗不应改写管理权', ['alpha-one-employee'], who='alpha-one-employee')['taskId']
                before_version = f.db.rows('SELECT current_version_id FROM tasks WHERE id=' + quote(assigned))[0][0]
                before_owners = f.db.rows('SELECT user_id FROM task_version_assignees WHERE version_id=' + quote(before_version) + ' ORDER BY ordinal')
                before_owner = f.db.rows('SELECT COALESCE(b.employee_id,t.original_creator_id) FROM tasks t LEFT JOIN task_business_owners b '
                                         'ON b.organization_id=t.organization_id AND b.task_id=t.id WHERE t.id=' + quote(owned))[0][0]
                before_approved = f.db.rows('SELECT status,decided_by FROM approval_requests WHERE task_id=' + quote(approved) + " AND kind='complete'")
                def visible(who, task):
                    status, listing = c.call('GET', '/tasks?relation=all', who=who)
                    if status != 200:
                        return False
                    return task in [row['id'] for row in listing['items']]
                check('a team head initially sees a task belonging to the same team', visible('alpha-one-head', assigned))
                check('a different team head does not see that task initially', not visible('beta-one-head', assigned))
                status, draft = c.call('GET', '/admin/organization-plans')
                moved = next(row for row in draft['placements'] if row['employeeId'] == c.ids['alpha-one-employee'])
                moved['departmentId'] = 'fixture-company-beta'
                moved['teamId'] = 'fixture-company-beta-one'
                plan = {'reason': 'transfer only', 'departments': draft['departments'], 'teams': draft['teams'],
                        'placements': draft['placements'], 'expectedEmployees': draft['expectedEmployees']}
                status, result = c.call('POST', '/admin/organization-plans', plan, version=draft['rowVersion'], key='org-transfer-only')
                check('a standalone organization adjustment saves', status == 200, {'status': status, 'code': result.get('code')})
                check('the pending request follows the applicant new direct manager',
                      int(f.db.scalar("SELECT COUNT(*) FROM approval_requests WHERE id=" + quote(pending_creation['requestId'])
                                      + " AND status='pending' AND current_reviewer_id=" + quote(c.ids['beta-one-head']))) == 1,
                      f.db.rows('SELECT status,current_reviewer_id FROM approval_requests WHERE id=' + quote(pending_creation['requestId'])))
                check('the reassignment is recorded as an organization route refresh',
                      int(f.db.scalar("SELECT COUNT(*) FROM request_reassignments WHERE request_id=" + quote(pending_creation['requestId'])
                                      + " AND source='route_refresh'")) >= 1)
                check('organization adjustment does not rewrite task execution owners',
                      f.db.rows('SELECT current_version_id FROM tasks WHERE id=' + quote(assigned))[0][0] == before_version
                      and f.db.rows('SELECT user_id FROM task_version_assignees WHERE version_id=' + quote(before_version) + ' ORDER BY ordinal') == before_owners)
                check('organization adjustment does not rewrite task management',
                      f.db.rows('SELECT COALESCE(b.employee_id,t.original_creator_id) FROM tasks t LEFT JOIN task_business_owners b '
                                'ON b.organization_id=t.organization_id AND b.task_id=t.id WHERE t.id=' + quote(owned))[0][0] == before_owner)
                check('organization adjustment does not rewrite decided approvals',
                      f.db.rows('SELECT status,decided_by FROM approval_requests WHERE task_id=' + quote(approved) + " AND kind='complete'") == before_approved)
                check('the old team head loses visibility after the transfer', not visible('alpha-one-head', assigned))
                check('the new team head gains visibility after the transfer', visible('beta-one-head', assigned))
                status, rejected = c.call('POST', '/admin/organization-plans',
                                          {**plan, 'deactivateEmployees': [{'employeeId': c.ids['alpha-two-employee'], 'rowVersion': 1, 'reason': 'x'}]},
                                          version=result['rowVersion'])
                check('the narrowed organization command still rejects lifecycle fields after a transfer',
                      status == 400 and rejected.get('code') == 'INVALID_INPUT', rejected)

                # -------------------------------------------------------- administrator-only identity search
                detail = c.call('GET', '/admin/employees/' + c.ids['beta-two-employee'])[1]
                status, saved = c.call('PATCH', '/admin/employees/' + c.ids['beta-two-employee'],
                                       {'idCardNo': ID_CARD}, version=detail['rowVersion'])
                check('an administrator can record a validated identity number', status == 200, saved)
                status, found = c.call('POST', '/admin/employees/search',
                                       {'q': ID_CARD_LOWER, 'departmentId': 'fixture-company-beta'})
                check('a complete lower-case identity number finds the employee inside the filter',
                      status == 200 and found['total'] == 1 and found['items'][0]['id'] == c.ids['beta-two-employee'],
                      {'status': status, 'total': found.get('total'), 'code': found.get('code')})
                check('the list projection stays masked', found['items'][0]['idCardNoMasked'] == '110105********002X'
                      and ID_CARD not in json.dumps(found, ensure_ascii=False))
                check('an explicit idCardNo body field also performs an exact lookup',
                      c.call('POST', '/admin/employees/search', {'idCardNo': ID_CARD})[1]['total'] == 1)
                check('a complete identity number combined with a non-matching filter returns nothing',
                      c.call('POST', '/admin/employees/search', {'q': ID_CARD, 'departmentId': 'fixture-company-alpha'})[1]['total'] == 0)
                check('an identity fragment never matches the identity document',
                      c.call('POST', '/admin/employees/search', {'q': ID_CARD[-6:]})[1]['total'] == 0)
                invalid = ID_CARD[:-1] + ('0' if ID_CARD[-1] != '0' else '1')
                check('a complete-shaped but invalid identity number returns no match',
                      c.call('POST', '/admin/employees/search', {'q': invalid})[1]['total'] == 0)
                check('the ordinary GET search never matches an identity number',
                      c.call('GET', '/admin/employees?q=' + ID_CARD)[1]['total'] == 0)
                status, foreign = c.call('POST', '/admin/employees/search', {'q': ID_CARD}, who='other-admin')
                check('another company administrator cannot find the employee by identity document',
                      status == 200 and foreign['total'] == 0, {'status': status, 'total': foreign.get('total')})
                status, _ = c.call('POST', '/admin/employees/search', {'q': ID_CARD}, who='alpha-one-employee')
                check('a business account cannot use the identity search', status == 403, status)
                check('ordinary name search still works in the body endpoint',
                      c.call('POST', '/admin/employees/search', {'q': 'beta-one-employee'})[1]['total'] == 1)
                check('identity search responses never echo the full number',
                      ID_CARD not in json.dumps(found, ensure_ascii=False) and ID_CARD_LOWER not in json.dumps(found, ensure_ascii=False))
                log_text = SERVICE_LOG_ORG.read_text(errors='replace')
                check('the service log never receives the full identity number',
                      ID_CARD not in log_text and ID_CARD_LOWER not in log_text)
                audit_text = json.dumps(f.db.rows('SELECT details_json FROM domain_events'), ensure_ascii=False)
                check('domain events and audit rows never receive the full identity number', ID_CARD not in audit_text)
                check('the recorded detail shows only a masked value',
                      int(f.db.scalar("SELECT COUNT(*) FROM domain_events WHERE JSON_EXTRACT(details_json,'$.idCardMasked')='110105********002X'")) >= 1)
        finally:
            pass

        # ---------------------------------------------------------------- concurrent offboarding
        concurrent_fixture = Fixture(port=18200)
        concurrent_fixture.log_path = SERVICE_LOG_CONCURRENT
        try:
            with concurrent_fixture as f:
                c = Client(f, SERVICE_LOG_CONCURRENT)
                head, successor = 'beta-one-head', 'beta-one-employee'
                live = c.create('concurrent shared live', [head, 'beta-two-employee'])['taskId']
                done = c.create('concurrent completed', [head], who=head)['taskId']
                c.complete(done, head)
                inventory = c.inventory(head)
                handovers = [{'taskId': live, 'taskVersion': next(row['taskVersion'] for row in inventory['executionAssignments'] if row['taskId'] == live), 'action': 'remove'}]
                transfers = [{'taskId': done, 'taskVersion': next(row['taskVersion'] for row in inventory['managedTasks'] if row['taskId'] == done),
                              'ownerVersion': next(row['ownerVersion'] for row in inventory['managedTasks'] if row['taskId'] == done),
                              'previousEmployeeId': c.ids[head], 'nextEmployeeId': c.ids['alpha-one-employee'], 'reason': 'concurrent takeover'}]
                body = {'reason': 'concurrent offboarding', 'successorEmployeeId': c.ids[successor],
                        'executionHandovers': handovers, 'businessTransfers': transfers, 'ownPendingWithdrawals': []}
                def attempt(key):
                    return c.call('POST', '/admin/employees/' + c.ids[head] + '/offboard', body,
                                  version=inventory['rowVersion'], key=key)
                with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                    outcomes = list(pool.map(attempt, ['concurrent-offboarding-a', 'concurrent-offboarding-b']))
                successes = [row for row in outcomes if row[0] == 200]
                failures = [row for row in outcomes if row[0] != 200]
                check('concurrent identical offboarding commits exactly one legal result',
                      len(successes) == 1 and len(failures) == 1 and failures[0][0] in (400, 409, 412),
                      {'outcomes': [row[0] for row in outcomes], 'failure': failures[0][1].get('code') if failures else None})
                check('the concurrent loser writes no second deactivation or takeover',
                      int(f.db.scalar('SELECT COUNT(*) FROM task_business_transfers WHERE task_id=' + quote(done))) == 1
                      and int(f.db.scalar('SELECT COUNT(*) FROM organizations WHERE id=' + quote('fixture-company'))) == 1
                      and int(f.db.scalar('SELECT authz_version FROM organizations WHERE id=' + quote('fixture-company'))) == inventory['rowVersion'] + 1)
        finally:
            pass

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
