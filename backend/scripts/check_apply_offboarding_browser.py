#!/usr/bin/env python3
"""Real Chrome acceptance for the single-entry offboarding page, employee search and cleaned copy."""
import datetime as dt
import json
import os
import subprocess
import uuid
from pathlib import Path

from fixed_model_fixture import Fixture, PASSWORD, quote
from migration_precheck import BASE

AUDIT = BASE.parent / 'audit/refactor-pandora-organization-and-workflows'
OUTPUT = AUDIT / 'admin-offboarding-browser.json'
NODE_LOG = AUDIT / 'admin-offboarding-browser-node.log'
SERVICE_LOG = AUDIT / 'admin-offboarding-browser-service.log'
ID_CARD = '11010519491231002X'
ID_CARD_LOWER = '11010519491231002x'


def main() -> int:
    report = {'updated': dt.datetime.now(dt.timezone.utc).isoformat(), 'checks': []}
    fixture = Fixture(port=18205)
    fixture.log_path = SERVICE_LOG

    def check(name, passed):
        report['checks'].append({'check': name, 'pass': bool(passed), 'evidence': 'same disposable fixture, service API and database'})
        if not passed:
            raise AssertionError(name)

    try:
        with fixture as f:
            tokens = {key: f.login(key)[1]['token'] for key in f.identities}
            ids = {key: value['id'] for key, value in f.identities.items()}

            def call(method, path, body=None, who='admin', version=None, key=None):
                return f.call(method, path, body, tokens[who], key or 'browser-' + uuid.uuid4().hex, version)

            def create(title, owners, who='founder', approve=True):
                now = dt.datetime.now(dt.timezone.utc)
                status, result = call('POST', '/tasks', {
                    'title': title, 'description': 'browser acceptance', 'priority': 'medium', 'allDay': False,
                    'startAt': (now - dt.timedelta(hours=1)).isoformat(),
                    'dueAt': (now + dt.timedelta(days=2)).isoformat(),
                    'assigneeIds': [ids[key] for key in owners]}, who=who)
                if status != 201:
                    raise RuntimeError('task seed failed: ' + json.dumps(result, ensure_ascii=False))
                if approve and result.get('outcome') == 'pending':
                    reviewer = {'alpha-two-head': 'alpha-head', 'alpha-two-employee': 'alpha-two-head'}[who]
                    view = call('GET', '/approval-requests/' + result['requestId'], who=reviewer)[1]
                    call('PATCH', '/approval-requests/' + result['requestId'],
                         {'decision': 'approve', 'comment': 'seed'}, who=reviewer, version=view['rowVersion'])
                return result

            def rename(employee_id, name):
                detail = call('GET', '/admin/employees/' + employee_id)[1]
                status, result = call('PATCH', '/admin/employees/' + employee_id, {'displayName': name},
                                      version=detail['rowVersion'])
                if status != 200:
                    raise RuntimeError('rename failed: ' + json.dumps(result, ensure_ascii=False))

            rename(ids['beta-one-employee'], '同名员工')
            rename(ids['beta-two-employee'], '同名员工')
            detail = call('GET', '/admin/employees/' + ids['beta-two-employee'])[1]
            status, saved = call('PATCH', '/admin/employees/' + ids['beta-two-employee'], {'idCardNo': ID_CARD},
                                 version=detail['rowVersion'])
            if status != 200:
                raise RuntimeError('identity seed failed: ' + json.dumps(saved, ensure_ascii=False))

            shared = create('shared head task', ['alpha-two-head', 'beta-one-employee'])['taskId']
            unique = create('unique head task', ['alpha-two-head'])['taskId']
            owned_live = create('owned live head', ['alpha-two-head'], who='alpha-two-head')['taskId']
            owned_done = create('owned done head', ['alpha-two-head'], who='alpha-two-head')['taskId']
            view = call('GET', '/tasks/' + owned_done, who='alpha-two-head')[1]
            status, completion = call('PATCH', '/tasks/' + owned_done,
                                      {'command': 'complete', 'completionNote': 'done'}, who='alpha-two-head',
                                      version=view['rowVersion'])
            request = call('GET', '/approval-requests/' + completion['requestId'], who='alpha-head')[1]
            call('PATCH', '/approval-requests/' + completion['requestId'],
                 {'decision': 'approve', 'comment': 'seed'}, who='alpha-head', version=request['rowVersion'])
            own_creation = create('own pending creation', ['beta-one-employee'], who='alpha-two-head', approve=False)
            shared_view = call('GET', '/tasks/' + shared, who='alpha-two-head')[1]
            status, own_progress = call('PATCH', '/tasks/' + shared,
                                        {'command': 'progress', 'progressNote': 'own pending'},
                                        who='alpha-two-head', version=shared_view['rowVersion'])
            if status != 200:
                raise RuntimeError('own pending seed failed: ' + json.dumps(own_progress, ensure_ascii=False))
            subordinate = create('subordinate pending', ['alpha-two-employee'], who='alpha-two-employee', approve=False)
            original_proposal = f.db.rows('SELECT proposed_version_id FROM approval_requests WHERE id='
                                          + quote(subordinate['requestId']))[0][0]
            ordinary = create('ordinary employee handover after offboarding', ['beta-one-employee'])['taskId']
            blocked = create('third-party proposed owner', ['beta-two-employee'], who='alpha-two-employee', approve=False)
            expired = create('expired own request', ['beta-one-employee'], who='alpha-two-head', approve=False)
            f.db.server_side('UPDATE approval_requests SET applicable_deadline=UTC_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE id='
                             + quote(expired['requestId']))
            empty_team = 'fixture-company-abnormal-team'
            f.db.server_side('INSERT INTO teams(id,organization_id,department_id,name) VALUES('
                             + ','.join(map(quote, (empty_team, 'fixture-company', 'fixture-company-beta', '缺负责人测试组'))) + ')')
            for body in ('第一条公司信息', '第二条公司信息'):
                status, result = call('POST', '/admin/company/items', {'body': body})
                if status not in (200, 201):
                    raise RuntimeError('company item seed failed: ' + json.dumps(result, ensure_ascii=False))

            payload = {'base': f'http://127.0.0.1:{f.port}', 'identifier': f.identities['admin']['identifier'],
                       'password': PASSWORD, 'ids': ids, 'head': 'alpha-two-head', 'successor': 'alpha-two-employee',
                       'nonWork': 'alpha-one-employee', 'idCard': ID_CARD, 'idCardLower': ID_CARD_LOWER,
                       'idCardMasked': '110105********002X', 'fullTotal': 11,
                       'ownCount': 2, 'ownTitles': ['own pending creation', 'shared head task'],
                       'blockedEmployee': 'beta-two-employee', 'emptyTeam': empty_team, 'completedTask': owned_done,
                       'ordinaryTask': ordinary, 'employeeIdentifier': f.identities['beta-one-employee']['identifier'],
                       'requestIds': [request['requestId'] for request in (own_creation, own_progress, subordinate, blocked, expired)],
                       'kindCodes': ['create', 'change', 'progress', 'complete', 'reopen', 'handover']}
            result = subprocess.run(['node', str(BASE / 'scripts/check_apply_offboarding_browser.js')],
                                    env={**os.environ, 'PANDORA_OFFBOARDING_FIXTURE': json.dumps(payload)},
                                    capture_output=True, text=True)
            NODE_LOG.write_text(result.stdout + result.stderr)
            for line in result.stdout.splitlines():
                if line.startswith('PASS  ') or line.startswith('FAIL  '):
                    report['checks'].append({'check': line[6:], 'pass': line.startswith('PASS  '),
                                             'evidence': 'real Chrome'})
            if result.returncode != 0:
                print(result.stdout, result.stderr, flush=True)
                raise AssertionError('admin offboarding browser check failed')

            status, _ = call('GET', '/approval-requests/' + subordinate['requestId'], who='alpha-two-head')
            check('the departed reviewer session loses access', status == 401)
            status, refreshed = call('GET', '/approval-requests/' + subordinate['requestId'], who='alpha-head')
            check('the new reviewer sees the original applicant and proposal', status == 200
                  and f.db.rows('SELECT applicant_id,current_reviewer_id,status,proposed_version_id FROM approval_requests WHERE id='
                                + quote(subordinate['requestId'])) == [[ids['alpha-two-employee'], ids['alpha-head'], 'pending', original_proposal]])
            status, _ = call('PATCH', '/approval-requests/' + subordinate['requestId'],
                             {'decision': 'approve', 'comment': 'reviewed after reassignment'}, who='alpha-head',
                             version=refreshed['rowVersion'])
            check('the new reviewer can act on reassigned work', status == 200)
            own_rows = {row[0]: row[1:] for row in f.db.rows('SELECT id,status,applicant_id FROM approval_requests WHERE id IN ('
                        + ','.join(quote(item['requestId']) for item in (own_creation, own_progress, expired)) + ')')}
            check('own request history distinguishes administrator withdrawal from natural expiry',
                  own_rows == {item['requestId']: [state, ids['alpha-two-head']]
                               for item, state in ((own_creation, 'withdrawn'), (own_progress, 'withdrawn'), (expired, 'expired'))})
            status, history = call('GET', '/admin/tasks/' + owned_done + '/history')
            check('completed task keeps its creator while management alone transfers', status == 200
                  and history['originalCreatorId'] == ids['alpha-two-head']
                  and history['businessTransfers'][0]['nextEmployeeId'] == ids['beta-one-employee']
                  and all(version['assigneeIds'] == [ids['alpha-two-head']] for version in history['versions']))

            pending = f.db.rows('SELECT id,applicant_id,current_reviewer_id,status FROM approval_requests WHERE task_id='
                                + quote(ordinary) + " AND kind='handover'")
            check('ordinary employee handover submitted in Chrome still requires the direct manager', len(pending) == 1
                  and pending[0][1:] == [ids['beta-one-employee'], ids['beta-one-head'], 'pending'])
            request_id = pending[0][0]
            review = call('GET', '/approval-requests/' + request_id, who='beta-one-head')[1]
            status, _ = call('PATCH', '/approval-requests/' + request_id,
                             {'decision': 'approve', 'comment': 'ordinary approval'}, who='beta-one-head', version=review['rowVersion'])
            _, history = call('GET', '/admin/tasks/' + ordinary + '/history')
            check('ordinary approval records employee handover, not administrator takeover', status == 200
                  and any(row['targetUserId'] == ids['beta-two-employee'] for row in history['handovers'])
                  and not history['businessTransfers'])
            status, _ = call('POST', '/admin/business-takeovers', {'transfers': []})
            check('the retired administrator takeover route cannot write', status in (404, 405))
            check('the service log does not expose the complete identity query', ID_CARD not in SERVICE_LOG.read_text()
                  and ID_CARD_LOWER not in SERVICE_LOG.read_text())
    finally:
        report['updated'] = dt.datetime.now(dt.timezone.utc).isoformat()
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str))
        failed = [row for row in report['checks'] if not row['pass']]
        print(json.dumps({'total': len(report['checks']), 'failed': len(failed), 'report': str(OUTPUT)},
                         ensure_ascii=False), flush=True)
    return 1 if failed else 0


if __name__ == '__main__':
    raise SystemExit(main())
