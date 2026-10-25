#!/usr/bin/env python3
"""HTTP verification for section 4: ordered routing, review, handover, reopen and history.

Builds its own organization fixture through the administration API, then exercises the approval
surface against a live backend. Every check prints PASS/FAIL and the run is written as JSON evidence.

    python3 scripts/check_review_routing.py --base-url http://127.0.0.1:18093
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
import threading
import urllib.error
import urllib.parse
import urllib.request
import uuid

RESULTS: list[dict] = []
RUN = uuid.uuid4().hex[:6]
PASSWORD = "Aa1" + uuid.uuid4().hex[:10]



# Employees authenticate by phone number (chapter 2.1/2.3); demo accounts keep stable numbers.
DEMO_PHONE = {'upper': '13800000001', 'middle': '13800000002', 'market': '13800000003',
              'employee': '13800000004', 'colleague': '13800000005', 'marketing': '13800000006',
              'admin': 'admin'}


def login_identity(account):
    """Map a demo account name to the phone number it now authenticates with."""
    return DEMO_PHONE.get(account, account)

class Api:
    def __init__(self, base: str, admin_password: str):
        self.base = base.rstrip('/')
        self.admin_password = admin_password
        self.tokens: dict[str, str] = {}

    def call(self, method, path, token=None, body=None, key=None, if_match=None):
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
            with urllib.request.urlopen(request) as response:
                payload = response.read().decode()
                return response.status, (json.loads(payload) if payload else {}), dict(response.headers)
        except urllib.error.HTTPError as error:
            payload = error.read().decode()
            try:
                parsed = json.loads(payload) if payload else {}
            except json.JSONDecodeError:
                parsed = {'raw': payload}
            return error.code, parsed, dict(error.headers)

    @staticmethod
    def key() -> str:
        return 'review-' + uuid.uuid4().hex


def check(name: str, condition: bool, evidence) -> None:
    RESULTS.append({'check': name, 'pass': bool(condition), 'evidence': evidence})
    print(('PASS  ' if condition else 'FAIL  ') + name + ('' if condition else f'  -> {evidence}'))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:18093')
    parser.add_argument('--password', default='Demo@123456')
    parser.add_argument('--output', type=Path, default=None)
    args = parser.parse_args()
    api = Api(args.base_url, args.password)

    for _ in range(30):
        status, session, _ = api.call('POST', '/api/v1/auth/sessions',
                                      body={'username': 'admin', 'password': args.password})
        if status == 200:
            break
        import time
        time.sleep(1)
    if status != 200:
        raise SystemExit(f'admin login failed: {status} {session}')
    admin = session['token']
    api.tokens['admin'] = admin

    # ---------------- fixture through the administration API ----------------
    _, structure, _ = api.call('GET', '/api/v1/admin/organization', admin)
    department = structure['departments'][0]['id']
    position = structure['positions'][0]['id']

    def make_employee(username, level, manager, role):
        phone = '133' + str(uuid.uuid4().int)[:8]
        status, body, _ = api.call('POST', '/api/v1/admin/employees', admin,
                                   {'username': username, 'displayName': username, 'departmentId': department,
                                    'positionId': position, 'level': level, 'managerId': manager,
                                    'roleCodes': [role], 'phone': phone}, Api.key())
        if status != 201:
            raise SystemExit(f'fixture {username} failed: {status} {body}')
        return body['userId'], body['initialPassword'], phone

    def onboard(username, initial, phone):
        status, session, _ = api.call('POST', '/api/v1/auth/sessions',
                                      body={'username': phone, 'password': initial})
        if status != 200:
            raise SystemExit(f'onboard login failed for {username}: {status} {session}')
        token = session['token']
        status, body, _ = api.call('POST', '/api/v1/auth/password', token,
                                   {'currentPassword': initial, 'newPassword': PASSWORD})
        if status != 200:
            raise SystemExit(f'onboard change failed for {username}: {status} {body}')
        status, session, _ = api.call('POST', '/api/v1/auth/sessions',
                                      body={'username': phone, 'password': PASSWORD})
        if status != 200:
            raise SystemExit(f'onboard relogin failed for {username}: {status} {session}')
        api.tokens[username] = session['token']
        return session['token']

    boss_id, boss_pw, boss_phone = make_employee(f'boss-{RUN}', 0, None, 'executive')
    lead_a_id, lead_a_pw, lead_a_phone = make_employee(f'leada-{RUN}', 2, boss_id, 'manager')
    lead_b_id, lead_b_pw, lead_b_phone = make_employee(f'leadb-{RUN}', 2, boss_id, 'manager')
    w1_id, w1_pw, w1_phone = make_employee(f'w1-{RUN}', 3, lead_a_id, 'employee')
    w2_id, w2_pw, w2_phone = make_employee(f'w2-{RUN}', 3, lead_b_id, 'employee')
    w3_id, w3_pw, w3_phone = make_employee(f'w3-{RUN}', 3, None, 'employee')
    w4_id, w4_pw, w4_phone = make_employee(f'w4-{RUN}', 3, lead_a_id, 'employee')

    boss = onboard(f'boss-{RUN}', boss_pw, boss_phone)
    lead_a = onboard(f'leada-{RUN}', lead_a_pw, lead_a_phone)
    lead_b = onboard(f'leadb-{RUN}', lead_b_pw, lead_b_phone)
    w1 = onboard(f'w1-{RUN}', w1_pw, w1_phone)
    w2 = onboard(f'w2-{RUN}', w2_pw, w2_phone)
    w3 = onboard(f'w3-{RUN}', w3_pw, w3_phone)
    w4 = onboard(f'w4-{RUN}', w4_pw, w4_phone)

    def task_payload(title, owners, days=3):
        start = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
        return {'title': title, 'description': '路由验证任务',
                'priority': 'medium', 'allDay': False,
                'startAt': start.isoformat().replace('+00:00', 'Z'),
                'dueAt': (start + dt.timedelta(days=days)).isoformat().replace('+00:00', 'Z'),
                'assigneeIds': owners}

    def create(token, title, owners, days=3):
        return api.call('POST', '/api/v1/tasks', token, task_payload(title, owners, days), Api.key())

    def request_of(request_id, token):
        return api.call('GET', f'/api/v1/approval-requests/{request_id}', token)

    def decide(token, request_id, decision, comment=None):
        _, view, _ = request_of(request_id, token)
        body = {'decision': decision}
        if comment is not None:
            body['comment'] = comment
        return api.call('PATCH', f'/api/v1/approval-requests/{request_id}', token, body,
                        Api.key(), f'"{view["rowVersion"]}"')

    def decide_blind(token, request_id, decision, comment=None):
        # PATCH without reading first: an unauthorized reviewer is rejected before the version check.
        body = {'decision': decision}
        if comment is not None:
            body['comment'] = comment
        return api.call('PATCH', f'/api/v1/approval-requests/{request_id}', token, body, Api.key(), '"1"')

    def detail(token, task_id):
        status, body, headers = api.call('GET', f'/api/v1/tasks/{task_id}', token)
        return status, body, headers.get('ETag')

    # ---------------- 4.1 creation routes by the creator, not the assignees ----------------
    status, created, _ = create(lead_a, '有序负责人验证', [w1_id, w2_id])
    task_ordered = created.get('taskId')
    _, view, _ = request_of(created['requestId'], lead_a)
    check('4.1 a creation routes to the creator\'s direct manager, never the assignees',
          status == 201 and view['currentReviewerId'] == boss_id,
          {'status': status, 'reviewer': view.get('currentReviewerId')})
    decide(boss, created['requestId'], 'approve', '通过')
    _, ordered, _ = detail(lead_a, task_ordered)
    check('4.1 the submitted order is returned unchanged', ordered['assigneeIds'] == [w1_id, w2_id],
          {'assigneeIds': ordered['assigneeIds']})
    _, ordered_again, _ = detail(lead_a, task_ordered)
    check('4.1 a refresh returns the same order', ordered_again['assigneeIds'] == [w1_id, w2_id],
          {'assigneeIds': ordered_again['assigneeIds']})

    # Reordering the same two peers swaps the unique reviewer because they sit in different chains.
    _, detail_body, etag = detail(lead_a, task_ordered)
    status, changed, _ = api.call('PATCH', f'/api/v1/tasks/{task_ordered}', lead_a,
                                  {'command': 'change', 'assigneeIds': [w2_id, w1_id], 'reason': '交换顺序'},
                                  Api.key(), etag)
    check('4.1 a same-level reorder across chains changes the request reviewer',
          status == 200 and changed.get('outcome') == 'pending', {'status': status, 'body': changed})
    _, swapped_view, _ = request_of(changed['requestId'], lead_a)
    check('4.1 the new reviewer follows the new first assignee',
          swapped_view['currentReviewerId'] == lead_b_id, {'reviewer': swapped_view.get('currentReviewerId')})
    _, reorder_diff, _ = api.call('GET', f"/api/v1/approval-requests/{changed['requestId']}", lead_b)
    check('4.6 a pure assignee reorder stays visible in the reviewer\'s authorized diff',
          any(item.get('field') == 'assigneeIds' and item.get('before') != item.get('after')
              for item in (reorder_diff.get('diff') or [])),
          {'diff': reorder_diff.get('diff')})
    decide(lead_b, changed['requestId'], 'approve', '同意换序')
    _, swapped, _ = detail(lead_a, task_ordered)
    check('4.1 the swapped order persists after approval', swapped['assigneeIds'] == [w2_id, w1_id],
          {'assigneeIds': swapped['assigneeIds']})

    status, created, _ = create(boss, '创始人创建免审', [w1_id, boss_id])
    _, view, _ = request_of(created['requestId'], boss)
    check('4.1 the unique employee organization root is exempt with a recorded reason',
          status == 201 and view['status'] == 'direct' and bool(view.get('exemptionReason')),
          {'status': status, 'request': view.get('status'), 'reason': view.get('exemptionReason')})
    _, raised, _ = detail(boss, created['taskId'])
    check('4.2 a founder creation publishes without a self-review request',
          raised['executionState'] == 'todo' and raised['published'] is True,
          {'executionState': raised.get('executionState')})

    # ---------------- 4.2 unified routing, no automatic exemption ----------------
    status, created, _ = create(lead_a, '本人创建也须审核', [w1_id])
    _, view, _ = request_of(created['requestId'], lead_a)
    check('4.2 a task with a reviewer is never applied automatically',
          status == 201 and view['status'] == 'pending', {'status': status, 'request': view.get('status')})
    check('4.2 the creation reviewer is the creator\'s direct manager', view['currentReviewerId'] == boss_id,
          {'reviewer': view.get('currentReviewerId')})
    task_pending = created['taskId']

    status, body, _ = api.call('PATCH', f'/api/v1/tasks/{task_pending}', lead_a,
                               {'command': 'progress', 'progressNote': '等待中的进展'}, Api.key(), '"1"')
    check('4.2 a frozen task refuses another business command', status == 409 and body.get('code') == 'TASK_FROZEN',
          {'status': status, 'body': body})
    decide(boss, created['requestId'], 'approve', '通过')

    # progress and completion each need their own approval
    _, current, etag = detail(w1, task_pending)
    status, progress, _ = api.call('PATCH', f'/api/v1/tasks/{task_pending}', w1,
                                   {'command': 'progress', 'progressNote': '第一轮进展'}, Api.key(), etag)
    check('4.2 every progress also requires approval', status == 200 and progress.get('outcome') == 'pending',
          {'status': status, 'body': progress})
    decide(lead_a, progress['requestId'], 'approve', '继续')
    _, after_progress, etag = detail(w1, task_pending)
    check('4.2 the first approved progress moves the task to doing',
          after_progress['executionState'] == 'doing', {'executionState': after_progress.get('executionState')})

    status, completed, _ = api.call('PATCH', f'/api/v1/tasks/{task_pending}', w1,
                                    {'command': 'complete', 'completionNote': '完成待审'}, Api.key(), etag)
    check('4.2 completion requires approval too', status == 200 and completed.get('outcome') == 'pending',
          {'status': status, 'body': completed})

    # ---------------- 4.9 completion rejection and withdrawal semantics ----------------
    decide(lead_a, completed['requestId'], 'reject', '材料不足，退回继续')
    _, returned, etag = detail(w1, task_pending)
    check('4.9 a rejected completion returns to doing, never done',
          returned['executionState'] == 'doing', {'executionState': returned.get('executionState')})
    _, approval_after_reject, _ = request_of(completed['requestId'], w1)
    check('4.9 the rejection keeps its comment for the applicant',
          approval_after_reject['status'] == 'rejected' and approval_after_reject.get('comment'),
          {'status': approval_after_reject.get('status')})

    status, withdrawn_req, _ = api.call('PATCH', f'/api/v1/tasks/{task_pending}', w1,
                                        {'command': 'progress', 'progressNote': '将被撤销'}, Api.key(), etag)
    decide(w1, withdrawn_req['requestId'], 'withdraw')
    _, after_withdraw, _ = detail(w1, task_pending)
    check('4.9 a withdrawal restores the state from before the submission',
          after_withdraw['executionState'] == 'doing', {'executionState': after_withdraw.get('executionState')})

    # ---------------- 4.3 reviewer preview ----------------
    _, before_preview, _ = api.call('GET', '/api/v1/approval-requests', lead_a)
    status, preview, _ = api.call('POST', '/api/v1/tasks/reviewer-preview', lead_a,
                                  {'operation': 'create'}, Api.key())
    check('4.3 the creation preview reports the creator\'s direct manager',
          status == 200 and preview['reviewerId'] == boss_id and preview['requiresApproval'] is True
          and preview['mode'] == 'creation',
          {'status': status, 'body': preview})
    status, preview_progress, _ = api.call('POST', '/api/v1/tasks/reviewer-preview', lead_a,
                                           {'operation': 'progress', 'taskId': task_pending}, Api.key())
    check('4.3 a non-creation preview follows the effective assignee chain',
          status == 200 and preview_progress['reviewerId'] == lead_a_id
          and preview_progress['mode'] == 'non-creation',
          {'status': status, 'body': preview_progress})
    _, after_preview, _ = api.call('GET', '/api/v1/approval-requests', lead_a)
    check('4.3 the preview creates no request',
          after_preview['total'] == before_preview['total'],
          {'before': before_preview['total'], 'after': after_preview['total']})
    status, preview_swap, _ = api.call('POST', '/api/v1/tasks/reviewer-preview', lead_a,
                                       {'operation': 'change', 'taskId': task_pending,
                                        'assigneeIds': [w2_id, w1_id]}, Api.key())
    check('4.3 the modification preview follows the proposed order', preview_swap['reviewerId'] == lead_b_id,
          {'reviewer': preview_swap.get('reviewerId')})

    # Assignee change: the old reviewer loses the decision, the new one gains it.
    status, created, _ = create(lead_a, '换负责人改路线', [w1_id])
    task_route = created['taskId']
    decide(boss, created['requestId'], 'approve', '初始通过')
    _, body, etag = detail(lead_a, task_route)
    status, changed, _ = api.call('PATCH', f'/api/v1/tasks/{task_route}', lead_a,
                                  {'command': 'change', 'assigneeIds': [w2_id], 'reason': '改由他人负责'},
                                  Api.key(), etag)
    check('4.3 changing the assignee produces a pending request', status == 200, {'status': status, 'body': changed})
    status, old_reviewer_attempt, _ = decide_blind(boss, changed['requestId'], 'approve', '旧审核人尝试')
    _, live_view, _ = request_of(changed['requestId'], lead_a)
    check('4.3 the previous reviewer cannot decide the new route',
          status == 404 and live_view['status'] == 'pending' and live_view['currentReviewerId'] == lead_b_id,
          {'status': status, 'stillPending': live_view.get('status')})
    _, route_view, _ = request_of(changed['requestId'], lead_a)
    check('4.3 the request names the new reviewer', route_view['currentReviewerId'] == lead_b_id,
          {'reviewer': route_view.get('currentReviewerId')})
    _, frozen_detail, _ = detail(lead_a, task_route)
    check('4.3 the detail exposes the request route separately from the effective route',
          frozen_detail['pendingRoute']['reviewerId'] == lead_b_id
          and frozen_detail['route']['reviewerId'] == lead_a_id
          and frozen_detail['frozen'] is True,
          {'pending': frozen_detail['pendingRoute'].get('reviewerId'), 'effective': frozen_detail['route'].get('reviewerId')})
    decide(lead_b, changed['requestId'], 'reject', '暂不调整')
    _, kept, _ = detail(lead_a, task_route)
    check('4.3 a rejection keeps the original assignees', kept['assigneeIds'] == [w1_id],
          {'assigneeIds': kept['assigneeIds']})

    # ---------------- 4.5 request DTO trimming ----------------
    # Move the effective owner to w2 so the next modification has a reviewer other than the applicant.
    _, _, etag = detail(lead_a, task_route)
    status, moved_owner, _ = api.call('PATCH', f'/api/v1/tasks/{task_route}', lead_a,
                                      {'command': 'change', 'assigneeIds': [w2_id], 'reason': '改由他人负责'},
                                      Api.key(), etag)
    decide(lead_b, moved_owner['requestId'], 'approve', '同意改派')
    _, body, etag = detail(lead_a, task_route)
    status, changed, _ = api.call('PATCH', f'/api/v1/tasks/{task_route}', lead_a,
                                  {'command': 'change', 'title': '提议中的新标题', 'reason': '验证裁剪'},
                                  Api.key(), etag)
    applicant_view = request_of(changed['requestId'], lead_a)[1]
    reviewer_view = request_of(changed['requestId'], lead_b)[1]
    check('4.5 the applicant sees the submitted content but no comparison fields',
          'proposedVersion' in applicant_view and 'baseVersion' not in applicant_view
          and 'diff' not in applicant_view and 'baseVersionId' not in applicant_view,
          {'keys': sorted(applicant_view.keys())})
    check('4.5 only the reviewer receives the base snapshot and the diff',
          'baseVersion' in reviewer_view and isinstance(reviewer_view.get('diff'), list)
          and any(item['field'] == 'title' for item in reviewer_view['diff']),
          {'diff': reviewer_view.get('diff')})
    status, outsider_view, _ = request_of(changed['requestId'], w2)
    check('4.5 an ordinary viewer cannot read the request at all', status == 404, {'status': status})
    _, frozen_detail, _ = detail(lead_a, task_route)
    check('4.5 the ordinary task area keeps the effective version while frozen',
          frozen_detail['frozen'] is True and frozen_detail['title'] != '提议中的新标题'
          and 'proposedVersion' not in frozen_detail,
          {'title': frozen_detail.get('title'), 'frozen': frozen_detail.get('frozen')})
    api.call('PATCH', f"/api/v1/approval-requests/{changed['requestId']}", lead_a,
             {'decision': 'withdraw'}, Api.key(), f'"{request_of(changed["requestId"], lead_a)[1]["rowVersion"]}"')

    # ---------------- 4.4 persisted reassignment after an organization change ----------------
    status, created, _ = create(w4, '组织变更改派验证', [w2_id])
    task_reassign = created['taskId']
    reassign_request = created['requestId']
    _, view, _ = request_of(reassign_request, w4)
    check('4.4 the creation request starts with the creator\'s direct manager',
          view['currentReviewerId'] == lead_a_id, {'reviewer': view.get('currentReviewerId')})
    worker_etag = api.call('GET', f'/api/v1/admin/employees/{w4_id}', admin)[2].get('ETag')
    status, moved, _ = api.call('POST', f'/api/v1/admin/employees/{w4_id}/transfer', admin,
                                {'departmentId': department, 'positionId': position, 'managerId': lead_b_id,
                                 'level': 3, 'roleCodes': ['employee'], 'reason': '改派验证'},
                                Api.key(), worker_etag)
    check('4.4 the transfer succeeds and reports invalidation',
          status == 200 and moved.get('authorizationInvalidated') is True, {'status': status, 'body': moved})
    _, view_after, _ = request_of(reassign_request, w4)
    check('4.4 the pending creation follows the creator\'s new direct manager',
          view_after['currentReviewerId'] == lead_b_id, {'reviewer': view_after.get('currentReviewerId')})
    _, history, _ = api.call('GET', f'/api/v1/admin/tasks/{task_reassign}/history', admin)
    reassignments = history.get('reassignments', [])
    check('4.4 the reassignment is persisted with both reviewers and a reason',
          any(row['previousReviewerId'] == lead_a_id and row['newReviewerId'] == lead_b_id
              and row['source'] == 'organization_change' for row in reassignments),
          {'reassignments': reassignments})
    status, stale_attempt, _ = decide_blind(lead_a, reassign_request, 'approve', '旧审核人尝试')
    check('4.4 the previous reviewer can no longer decide', status == 404, {'status': status})
    status, new_attempt, _ = decide(lead_b, reassign_request, 'approve', '新审核人通过')
    check('4.4 the new reviewer can decide', status == 200,
          {'status': status, 'body': new_attempt, 'lead_b': lead_b_id})
    # Restore the fixture relationship so later checks keep their documented reviewer chain.
    restore_etag = api.call('GET', f'/api/v1/admin/employees/{w4_id}', admin)[2].get('ETag')
    api.call('POST', f'/api/v1/admin/employees/{w4_id}/transfer', admin,
             {'departmentId': department, 'positionId': position, 'managerId': lead_a_id,
              'level': 3, 'roleCodes': ['employee'], 'reason': '还原改派夹具'}, Api.key(), restore_etag)

    # ---------------- 4.6 dedicated handover ----------------
    status, created, _ = create(lead_a, '交接验证', [w1_id])
    task_handover = created['taskId']
    decide(boss, created['requestId'], 'approve', '初始通过')
    _, body, etag = detail(lead_a, task_handover)
    status, bad_handover, _ = api.call('POST', f'/api/v1/tasks/{task_handover}/handover', lead_a,
                                       {'sourceUserId': w1_id, 'targetUserId': w2_id, 'title': '夹带标题'},
                                       Api.key(), etag)
    check('4.6 a handover cannot smuggle a base field', status == 400, {'status': status, 'body': bad_handover})
    status, forbidden_handover, _ = api.call('POST', f'/api/v1/tasks/{task_handover}/handover', lead_b,
                                             {'sourceUserId': w1_id, 'targetUserId': w2_id}, Api.key(), etag)
    check('4.6 a non-direct manager has no handover authority', status == 403,
          {'status': status, 'body': forbidden_handover})
    _, before_handover, _ = detail(lead_a, task_handover)
    status, handover, _ = api.call('POST', f'/api/v1/tasks/{task_handover}/handover', lead_a,
                                   {'sourceUserId': w1_id, 'targetUserId': w2_id, 'reason': '本人请假'},
                                   Api.key(), etag)
    check('4.6 the direct manager can hand the task over', status == 200 and handover.get('outcome') == 'pending',
          {'status': status, 'body': handover})
    _, handover_view, _ = request_of(handover['requestId'], lead_a)
    check('4.6 the handover routes by the new owner', handover_view['currentReviewerId'] == lead_b_id,
          {'reviewer': handover_view.get('currentReviewerId')})
    status, handover_decision, _ = decide(lead_b, handover['requestId'], 'approve', '同意交接')
    check('4.6 the new route approves the handover', status == 200, {'status': status})
    _, handed_over, _ = detail(lead_a, task_handover)
    check('4.6 the target now owns the task and the source does not',
          w2_id in handed_over['assigneeIds'] and w1_id not in handed_over['assigneeIds'],
          {'assigneeIds': handed_over['assigneeIds']})
    _, handover_history, _ = api.call('GET', f'/api/v1/admin/tasks/{task_handover}/history', admin)
    check('4.6 provenance is preserved and recorded',
          handed_over['originalCreatorId'] == before_handover['originalCreatorId']
          and handed_over['createdAt'] == before_handover['createdAt']
          and any(entry['entryType'] == 'handover' for entry in handover_history['entries']),
          {'creator': handed_over['originalCreatorId'],
           'entries': [entry['entryType'] for entry in handover_history['entries']][:12]})

    # ---------------- 4.7 reopen with a complete schedule ----------------
    status, created, _ = create(lead_a, '重开排期验证', [w1_id])
    task_reopen = created['taskId']
    decide(boss, created['requestId'], 'approve', '初始通过')
    _, body, etag = detail(w1, task_reopen)
    status, done, _ = api.call('PATCH', f'/api/v1/tasks/{task_reopen}', w1,
                               {'command': 'complete', 'completionNote': '完成'}, Api.key(), etag)
    decide(lead_a, done['requestId'], 'approve', '通过完成')
    _, completed_task, etag = detail(lead_a, task_reopen)
    check('4.7 the task is done before the reopen', completed_task['executionState'] == 'done',
          {'executionState': completed_task['executionState']})
    round_before = completed_task['executionRound']

    status, not_creator, _ = api.call('PATCH', f'/api/v1/tasks/{task_reopen}', w1,
                                      {'command': 'reopen', 'reason': '负责人尝试重开'}, Api.key(), etag)
    check('4.7 only the creator may reopen', status == 403, {'status': status, 'body': not_creator})

    new_due = (dt.datetime.now(dt.timezone.utc).replace(microsecond=0) + dt.timedelta(days=9)).isoformat().replace('+00:00', 'Z')
    new_start = (dt.datetime.now(dt.timezone.utc).replace(microsecond=0) + dt.timedelta(days=8)).isoformat().replace('+00:00', 'Z')
    status, reopened, _ = api.call('PATCH', f'/api/v1/tasks/{task_reopen}', lead_a,
                                   {'command': 'reopen', 'reason': '需要补充材料', 'startAt': new_start, 'dueAt': new_due},
                                   Api.key(), etag)
    check('4.7 a reopen accepts a complete schedule', status == 200 and reopened.get('outcome') == 'pending',
          {'status': status, 'body': reopened})
    decide(lead_a, reopened['requestId'], 'reject', '暂不重开')
    _, still_done, _ = detail(lead_a, task_reopen)
    check('4.7 a rejected reopen keeps the task done and the round unchanged',
          still_done['executionState'] == 'done' and still_done['executionRound'] == round_before,
          {'executionState': still_done['executionState'], 'round': still_done['executionRound']})

    _, reopened_view, _ = request_of(reopened['requestId'], lead_a)
    status, reopened_again, _ = api.call('PATCH', f'/api/v1/tasks/{task_reopen}', lead_a,
                                         {'command': 'reopen', 'reason': '再次申请重开', 'startAt': new_start, 'dueAt': new_due},
                                         Api.key(), f'"{still_done["rowVersion"]}"')
    decide(lead_a, reopened_again['requestId'], 'approve', '同意重开')
    _, reopened_task, _ = detail(lead_a, task_reopen)
    check('4.7 an approved reopen atomically applies doing, the new round and the schedule',
          reopened_task['executionState'] == 'doing'
          and reopened_task['executionRound'] == round_before + 1
          and reopened_task['startAt'].startswith(new_start[:16]),
          {'executionState': reopened_task['executionState'], 'round': reopened_task['executionRound'],
           'startAt': reopened_task['startAt']})

    # ---------------- 4.8 complete operation history ----------------
    admin_only = api.call('GET', f'/api/v1/admin/tasks/{task_handover}/history', w1)
    check('4.8 the App cannot read the complete history', admin_only[0] == 403, {'status': admin_only[0]})
    _, app_detail, _ = detail(w1, task_handover)
    check('4.8 the App task projection carries no history payload', 'history' not in app_detail
          and 'versions' not in app_detail, {'keys': sorted(app_detail.keys())[:12]})
    entry_types = {entry['entryType'] for entry in handover_history['entries']}
    check('4.8 the history records fields, order, reviewer, decisions and the handover',
          {'request_submitted', 'request_decided', 'version_applied', 'handover_requested', 'handover'} <= entry_types,
          {'entryTypes': sorted(entry_types)})
    order_entry = next((entry for entry in handover_history['entries'] if entry['entryType'] == 'assignee_order'), None)
    check('4.8 the ordered assignee change keeps before and after values',
          order_entry is not None and order_entry['beforeValue'] and order_entry['afterValue'],
          {'entry': order_entry})
    _, routing_history, _ = api.call('GET', f'/api/v1/admin/tasks/{task_reassign}/history', admin)
    check('4.8 a reassignment is traceable entry by entry',
          any(entry['entryType'] == 'reviewer_reassigned' and entry['beforeValue'] and entry['afterValue']
              for entry in routing_history['entries']),
          {'entryTypes': sorted({entry['entryType'] for entry in routing_history['entries']})})
    _, no_reviewer_history, _ = api.call('GET', f'/api/v1/admin/tasks/{task_reopen}/history', admin)
    serialized = json.dumps(no_reviewer_history, ensure_ascii=False)
    check('4.8 the history exposes no contact fields',
          '"phone"' not in serialized and '"email"' not in serialized and '"password"' not in serialized,
          {'bytes': len(serialized)})

    # ---------------- 4.2 genuine exemption versus a blocked relationship ----------------
    # A creator with no configured manager is genuinely exempt and the reason is recorded.
    status, created, _ = create(w3, '无直属上级留因免审', [w3_id])
    check('4.2 a creator with no direct manager is exempt', status == 201, {'status': status, 'body': created})
    _, exempt_view, _ = request_of(created['requestId'], w3)
    check('4.2 the exemption is recorded with the creator as the route basis',
          exempt_view['status'] == 'direct' and bool(exempt_view.get('exemptionReason'))
          and exempt_view['currentReviewerId'] is None,
          {'status': exempt_view.get('status'), 'reason': exempt_view.get('exemptionReason')})
    _, exempt_task, _ = detail(w3, created['taskId'])
    check('4.2 the direct application publishes the task', exempt_task.get('published') is True,
          {'published': exempt_task.get('published')})

    # A configured manager that cannot review blocks; it is never skipped, escalated or exempted.
    boss_etag = api.call('GET', f'/api/v1/admin/employees/{boss_id}', admin)[2].get('ETag')
    api.call('PATCH', f'/api/v1/admin/employees/{boss_id}', admin, {'reviewerAvailable': False},
             Api.key(), boss_etag)
    status, blocked, _ = create(lead_a, '上级不可审核阻断', [w1_id])
    check('4.2 an unavailable direct manager blocks the creation instead of exempting it',
          status == 409 and blocked.get('code') == 'ROUTE_BLOCKED', {'status': status, 'body': blocked})
    status, blocked_preview, _ = api.call('POST', '/api/v1/tasks/reviewer-preview', lead_a,
                                          {'operation': 'create'}, Api.key())
    check('4.2 the blocked creation preview names no fallback reviewer and requires no approval',
          blocked_preview.get('blocked') is True and blocked_preview.get('reviewerId') is None
          and blocked_preview.get('requiresApproval') is False,
          {'preview': blocked_preview})
    api.call('PATCH', f'/api/v1/admin/employees/{boss_id}', admin, {'reviewerAvailable': True},
             Api.key(), api.call('GET', f'/api/v1/admin/employees/{boss_id}', admin)[2].get('ETag'))

    # ---------------- 4.4 a pending creation whose reviewer becomes unusable ----------------
    status, created, _ = create(lead_a, '最后审核人不可用验证', [w1_id])
    check('4.4 the pending creation starts at the direct manager', status == 201, {'status': status})
    _, last_reviewer_view, _ = request_of(created['requestId'], lead_a)
    check('4.4 the reviewer of record is the creator\'s direct manager',
          last_reviewer_view['currentReviewerId'] == boss_id, last_reviewer_view.get('currentReviewerId'))
    boss_etag = api.call('GET', f'/api/v1/admin/employees/{boss_id}', admin)[2].get('ETag')
    status, body, _ = api.call('PATCH', f'/api/v1/admin/employees/{boss_id}', admin,
                               {'reviewerAvailable': False}, Api.key(), boss_etag)
    check('4.4 making the creation reviewer unusable completes the organization change',
          status == 200, {'status': status, 'body': body})
    _, final_view, _ = request_of(created['requestId'], lead_a)
    check('4.4 the creation stays pending and is marked blocked instead of applying itself',
          final_view['status'] == 'pending' and final_view['currentReviewerId'] == boss_id
          and final_view['route'].get('reason') == 'manager-unavailable',
          {'status': final_view.get('status'), 'reviewer': final_view.get('currentReviewerId'),
           'reason': final_view.get('route', {}).get('reason')})
    _, still_unpublished, _ = detail(lead_a, created['taskId'])
    check('4.4 the blocked creation is not published', still_unpublished.get('published') is False,
          {'published': still_unpublished.get('published')})
    status, refused, _ = decide(boss, created['requestId'], 'approve', '旧审核人尝试')
    check('4.4 the blocked reviewer cannot approve the creation',
          status == 409 and refused.get('code') == 'ROUTE_BLOCKED', {'status': status, 'body': refused})
    api.call('PATCH', f'/api/v1/admin/employees/{boss_id}', admin, {'reviewerAvailable': True},
             Api.key(), api.call('GET', f'/api/v1/admin/employees/{boss_id}', admin)[2].get('ETag'))

    # ---------------- 4.9 unique pending under concurrency ----------------
    status, created, _ = create(lead_a, '并发唯一待审', [w1_id])
    task_concurrent = created['taskId']
    decide(boss, created['requestId'], 'approve', '通过')
    _, body, etag = detail(w1, task_concurrent)
    outcomes = []

    def submit_concurrently():
        outcomes.append(api.call('PATCH', f'/api/v1/tasks/{task_concurrent}', api.tokens[f'w1-{RUN}'],
                                 {'command': 'progress', 'progressNote': '并发提交' + uuid.uuid4().hex[:4]},
                                 'concurrent-' + uuid.uuid4().hex, etag)[0])

    threads = [threading.Thread(target=submit_concurrently) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    # The loser may be refused as frozen (409) or as a stale version (412); exactly one must win.
    check('4.9 concurrent submissions produce exactly one pending request',
          len(outcomes) == 2 and outcomes.count(200) == 1 and all(code in (200, 409, 412) for code in outcomes),
          {'outcomes': outcomes})
    _, frozen_after, _ = detail(w1, task_concurrent)
    check('4.9 the task stays frozen with a single pending request',
          frozen_after['frozen'] is True and bool(frozen_after.get('pendingRequestId')),
          {'frozen': frozen_after.get('frozen'), 'pending': frozen_after.get('pendingRequestId')})

    # parent and child keep independent states
    status, parent_created, _ = create(lead_a, '父任务状态独立', [w1_id])
    decide(boss, parent_created['requestId'], 'approve', '通过')
    parent_payload = task_payload('子任务状态独立', [w1_id])
    parent_payload['parentTaskId'] = parent_created['taskId']
    status, child_created, _ = api.call('POST', '/api/v1/tasks', lead_a, parent_payload, Api.key())
    decide(boss, child_created['requestId'], 'approve', '通过')
    _, child_body, child_etag = detail(w1, child_created['taskId'])
    api.call('PATCH', f"/api/v1/tasks/{child_created['taskId']}", w1,
             {'command': 'complete', 'completionNote': '子任务完成'}, Api.key(), child_etag)
    _, child_done, _ = detail(w1, child_created['taskId'])
    _, parent_state, _ = detail(boss, parent_created['taskId'])
    check('4.9 a child state change leaves the parent untouched',
          child_done['executionState'] in ('todo', 'doing', 'done') and parent_state['executionState'] == 'todo',
          {'parent': parent_state['executionState'], 'child': child_done['executionState']})

    # ---------------- creation matrix and negative cases (chapters 3.1, 3.2, 3.6) ----------------
    # An administrator has no business creation authority at all.
    status, admin_created, _ = api.call('POST', '/api/v1/tasks', admin,
                                        task_payload('管理员创建', [w1_id]), Api.key())
    check('3.1 the administrator cannot create a business task', status == 403,
          {'status': status, 'body': admin_created})

    # A normal employee may assign another department, a direct manager and the founder.
    status, span, _ = create(w2, '跨部门与上溯派发', [w1_id, lead_a_id, boss_id])
    _, span_view, _ = request_of(span['requestId'], w2)
    _, span_detail, _ = detail(w2, span['taskId'])
    span_owners = (span_detail.get('proposedVersion') or span_detail).get('assigneeIds')
    check('3.1 an employee may assign a peer, an upper level and the founder',
          status == 201 and span_owners == [w1_id, lead_a_id, boss_id],
          {'status': status, 'assigneeIds': span_owners})
    check('3.1 the creation still routes by the creator, not by the founder in the list',
          span_view['currentReviewerId'] == lead_b_id, {'reviewer': span_view.get('currentReviewerId')})
    decide(lead_b, span['requestId'], 'approve', '通过')

    # A non-company (therefore cross-company/unknown) identifier is refused.
    status, foreign, _ = api.call('POST', '/api/v1/tasks', w2,
                                  task_payload('跨公司人员验证', [str(uuid.uuid4())]), Api.key())
    check('3.1 a non-company assignee identifier is refused', status == 400,
          {'status': status, 'body': foreign})

    # Reordering or replacing assignees never moves the creation reviewer.
    _, route_a, _ = api.call('POST', '/api/v1/tasks/reviewer-preview', w2,
                             {'operation': 'create'}, Api.key())
    _, route_b, _ = api.call('POST', '/api/v1/tasks/reviewer-preview', w2,
                             {'operation': 'create', 'assigneeIds': [boss_id, w1_id]}, Api.key())
    check('3.2 reordering or replacing assignees never moves the creation reviewer',
          route_a.get('reviewerId') == route_b.get('reviewerId') == lead_b_id,
          {'first': route_a.get('reviewerId'), 'second': route_b.get('reviewerId')})

    # An inactive configured manager blocks instead of being skipped or exempted.
    lead_a_etag = api.call('GET', f'/api/v1/admin/employees/{lead_a_id}', admin)[2].get('ETag')
    api.call('PATCH', f'/api/v1/admin/employees/{lead_a_id}', admin, {'active': False}, Api.key(), lead_a_etag)
    status, inactive_blocked, _ = create(w1, '上级失效阻断', [w1_id])
    check('3.2 an inactive direct manager blocks the creation instead of escalating',
          status == 409 and inactive_blocked.get('code') == 'ROUTE_BLOCKED',
          {'status': status, 'body': inactive_blocked})
    api.call('PATCH', f'/api/v1/admin/employees/{lead_a_id}', admin, {'active': True},
             Api.key(), api.call('GET', f'/api/v1/admin/employees/{lead_a_id}', admin)[2].get('ETag'))

    # The organization interface itself refuses to introduce a manager cycle.
    lead_a_etag = api.call('GET', f'/api/v1/admin/employees/{lead_a_id}', admin)[2].get('ETag')
    status, cycle, _ = api.call('PATCH', f'/api/v1/admin/employees/{lead_a_id}', admin,
                                {'managerId': w1_id}, Api.key(), lead_a_etag)
    check('3.2 the organization interface refuses a manager cycle',
          status in (400, 409) and cycle.get('code') in ('INVALID_INPUT', 'ORGANIZATION_CYCLE', 'DATA_CONFLICT'),
          {'status': status, 'body': cycle})

    # A second organization root removes the provable founder but must not guess one.
    status, boss2, _ = api.call('POST', '/api/v1/admin/employees', admin,
                                {'displayName': '第二根节点', 'departmentId': department,
                                 'positionId': position, 'level': 0, 'roleCodes': ['executive'],
                                 'phone': '130' + str(uuid.uuid4().int)[:8]}, Api.key())
    check('3.2 a second isolated upper account is created as a second root', status == 201,
          {'status': status, 'body': boss2})
    status, boss_root, _ = create(boss, '多根创始人无法证明', [w1_id])
    _, boss_root_view, _ = request_of(boss_root['requestId'], boss)
    check('3.2 with multiple roots a root creation is exempt as "no manager", never as the founder',
          status == 201 and boss_root_view['status'] == 'direct'
          and '创始人' not in (boss_root_view.get('exemptionReason') or '')
          and '无直属上级' in (boss_root_view.get('exemptionReason') or ''),
          {'status': status, 'reason': boss_root_view.get('exemptionReason')})
    status, manager_ok, _ = create(lead_a, '多根下直属上级仍可审核', [w1_id])
    check('3.2 a provable direct manager still routes normally with multiple roots',
          status == 201 and manager_ok.get('outcome') == 'pending',
          {'status': status, 'body': manager_ok})

    passed = sum(1 for result in RESULTS if result['pass'])
    print(f'\n{passed}/{len(RESULTS)} checks passed')
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps({
            'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
            'baseUrl': args.base_url, 'passed': passed, 'total': len(RESULTS), 'results': RESULTS,
        }, ensure_ascii=False, indent=2) + '\n')
        print(f'wrote {args.output}')
    return 0 if passed == len(RESULTS) else 1


if __name__ == '__main__':
    raise SystemExit(main())
