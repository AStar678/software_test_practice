#!/usr/bin/env python3
"""Current fixed-position routing and direct-application checks in a disposable real JAR/MySQL fixture."""
import concurrent.futures
import copy
import datetime as dt
import json
import uuid
from fixed_model_fixture import Fixture, quote
from migration_precheck import BASE

OUTPUT=BASE.parent/'output/task-creation-refinement/review-routing.json'

def main():
    report={'updated':dt.datetime.now(dt.timezone.utc).isoformat(),'checks':[]}
    def check(name,condition,evidence=None):
        report['checks'].append({'check':name,'pass':bool(condition),'evidence':evidence})
        print(('PASS ' if condition else 'FAIL ')+name,flush=True)
        if not condition:
            print('EVIDENCE '+json.dumps(evidence,ensure_ascii=False,default=str),flush=True)
            raise AssertionError(name)
    fixture=Fixture(port=18177,worker=True,controllable=True);fixture.log_path=OUTPUT.with_name('review-service.log')
    try:
        with fixture as f:
            tokens={key:f.login(key)[1]['token'] for key in f.identities}
            ids={key:value['id'] for key,value in f.identities.items()}
            def call(method,path,body=None,who='founder',version=None,key=None):
                return f.call(method,path,body,tokens[who],key or 'review-'+uuid.uuid4().hex,version)
            def preview(who,owners,operation='create',task=None):
                body={'operation':operation,'assigneeIds':[ids[x] for x in owners]}
                if task: body['taskId']=task
                return call('POST','/tasks/reviewer-preview',body,who)
            def form(owners):
                now=dt.datetime.now(dt.timezone.utc)
                return {'title':'Fixed review fixture','description':'Real operation','priority':'medium','allDay':False,
                        'assigneeIds':[ids[x] for x in owners],'startAt':(now-dt.timedelta(hours=1)).isoformat(),
                        'dueAt':(now+dt.timedelta(days=2)).isoformat()}
            def create(who,owners):
                status,result=call('POST','/tasks',form(owners),who)
                check('create '+who+' submits a real task',status==201,{'status':status,'code':result.get('code')})
                return result
            def detail(task,who='founder'): return call('GET','/tasks/'+task,who=who)[1]
            def decide(request,who,decision='approve'):
                status,request_view=call('GET','/approval-requests/'+request,who=who)
                check('current participant reads request '+decision,status==200,{'status':status})
                return call('PATCH','/approval-requests/'+request,{'decision':decision,'comment':'Test decision'},who,request_view['rowVersion'])
            def change(task,who,body,expected='direct'):
                version=detail(task,who)['rowVersion']
                status,result=call('PATCH','/tasks/'+task,body,who,version)
                check(who+' '+body['command']+' has expected outcome '+expected,status==200 and result.get('outcome')==expected,{'status':status,'code':result.get('code'),'outcome':result.get('outcome')})
                return result
            for who,manager in (('alpha-head','founder'),('alpha-one-head','alpha-head'),('alpha-one-employee','alpha-one-head')):
                for owners in (['beta-one-employee','alpha-one-employee'],['alpha-one-employee','beta-one-employee']):
                    status,result=preview(who,owners)
                    check(who+' creation routes to direct manager regardless of owner order',status==200 and result['reviewerId']==ids[manager] and result['requiresApproval'] is True)
            status,result=preview('founder',['beta-one-employee'])
            check('only explicit fixed founder creation is directly applied',status==200 and result['requiresApproval'] is False and result['route']['reason']=='founder-exempt')
            f.db.server_side('UPDATE users SET reviewer_available=0 WHERE id='+quote(ids['alpha-one-head']))
            status,result=preview('alpha-one-employee',['beta-one-employee'])
            check('unavailable direct manager blocks creation without escalation or exemption',status==200 and result['blocked'] is True and result['requiresApproval'] is False)
            f.db.server_side('UPDATE users SET reviewer_available=1 WHERE id='+quote(ids['alpha-one-head']))
            for candidate in ('admin','other-founder'):
                status,_=preview('alpha-one-employee',[candidate])
                check(candidate+' is not an employee assignee candidate',status==400)
            pending=create('alpha-one-employee',['beta-one-employee'])
            check('employee creation remains unpublished and pending',pending['outcome']=='pending' and detail(pending['taskId'],'alpha-one-employee')['published'] is False)
            check('unpublished assignee and founder cannot read pending creation',call('GET','/tasks/'+pending['taskId'],who='beta-one-employee')[0]==404 and call('GET','/tasks/'+pending['taskId'])[0]==404)
            check('creation applicant receives no comparison snapshot', 'diff' not in call('GET','/approval-requests/'+pending['requestId'],who='alpha-one-employee')[1])
            check('creation reviewer has comparison snapshot', 'diff' in call('GET','/approval-requests/'+pending['requestId'],who='alpha-one-head')[1])
            check('direct manager approves creation',decide(pending['requestId'],'alpha-one-head')[0]==200)
            task=pending['taskId']
            for owners in (['beta-one-employee','alpha-two-employee'],['alpha-two-employee','beta-one-employee']):
                status,result=preview('alpha-one-employee',owners,'change',task)
                check('non-creation routes to operator manager regardless of owner order',status==200 and result['reviewerId']==ids['alpha-one-head'] and result['requiresApproval'] is True and result['route']['reason']=='direct-manager')
            check('viewing authority does not grant basic edit preview',preview('founder',['beta-one-employee'],'change',task)[0]==409)
            changed=change(task,'alpha-one-employee',{'command':'change','title':'Owner changed cross department','reason':'Current owner maintenance','assigneeIds':[ids['beta-one-employee'],ids['alpha-two-employee']]},'pending')
            check('manager approves creator change',decide(changed['requestId'],'alpha-one-head')[0]==200)
            check('approved creator change is not left pending',f.db.scalar('SELECT COUNT(*) FROM approval_requests WHERE task_id='+quote(task)+" AND status='pending'")==0)
            current=detail(task,'alpha-one-employee')['rowVersion']
            status,_=call('PATCH','/tasks/'+task,{'command':'change','title':'Stale overwrite','reason':'stale'},'alpha-one-employee',current-1)
            check('creator change cannot bypass task version',status==412)
            status,_=call('PATCH','/tasks/'+task,{'command':'change','assigneeIds':[],'reason':'empty'},'alpha-one-employee',current)
            check('creator change cannot remove every assignee',status==400)
            status,_=call('PATCH','/tasks/'+task,{'command':'progress','progressNote':'Creator is not assignee'},'alpha-one-employee',current)
            check('business owner is not automatically entitled to submit progress',status==403)
            check('creator change records applicant and actual manager',f.db.scalar('SELECT COUNT(*) FROM approval_requests WHERE id='+quote(changed['requestId'])+" AND status='approved' AND decided_by<>applicant_id AND exemption_reason IS NULL")==1)
            progress=change(task,'beta-one-employee',{'command':'progress','progressNote':'Progress requires current owner review'},'pending')
            check('pending progress keeps old effective content',detail(task,'beta-one-employee')['progressNote']=='')
            status,_=call('PATCH','/tasks/'+task,{'command':'change','title':'Frozen overwrite','reason':'frozen'},'alpha-one-employee',detail(task,'alpha-one-employee')['rowVersion'])
            check('creator change cannot bypass unique pending freeze',status==409)
            check('unrelated scope viewer cannot obtain proposal',call('GET','/approval-requests/'+progress['requestId'])[0]==404)
            check('operator manager approves cross-department progress',decide(progress['requestId'],'beta-one-head')[0]==200)
            check('approved progress becomes effective',detail(task,'beta-one-employee')['progressNote']=='Progress requires current owner review')
            completed=change(task,'beta-one-employee',{'command':'complete','completionNote':'Ready'},'pending')
            check('operator manager approves completion',decide(completed['requestId'],'beta-one-head')[0]==200 and detail(task,'alpha-one-employee')['executionState']=='done')
            status,_=call('PATCH','/tasks/'+task,{'command':'reopen','reason':'Missing schedule'},'alpha-one-employee',detail(task,'alpha-one-employee')['rowVersion'])
            check('self reopen requires a complete explicit schedule',status==400)
            reopened=change(task,'alpha-one-employee',{'command':'reopen','reason':'New execution round',**{k:v for k,v in form([]).items() if k in ('allDay','startAt','dueAt')}},'pending')
            check('operator manager approves reopen',decide(reopened['requestId'],'alpha-one-head')[0]==200)
            check('approved reopen publishes doing state and advances round',detail(task,'alpha-one-employee')['executionState']=='doing' and detail(task,'alpha-one-employee')['executionRound']==2)
            own=create('founder',['founder'])
            change(own['taskId'],'founder',{'command':'progress','progressNote':'Self progress'})
            change(own['taskId'],'founder',{'command':'complete','completionNote':'Self complete'})
            check('self operations cannot be approved again',decide(own['requestId'],'founder')[0]==409)
            # Dedicated handover remains narrower than ordinary assignee editing.
            target=create('founder',['alpha-one-employee'])
            for who in ('founder','alpha-head'):
                status,_=call('POST','/tasks/'+target['taskId']+'/handover',{'sourceUserId':ids['alpha-one-employee'],'targetUserId':ids['alpha-two-employee']},who,detail(target['taskId'],who)['rowVersion'])
                check(who+' cannot delegate handover for an indirect report',status==403)
            status,_=call('POST','/tasks/'+target['taskId']+'/handover',{'sourceUserId':ids['alpha-one-employee'],'targetUserId':ids['beta-one-employee']},'alpha-one-head',detail(target['taskId'],'alpha-one-head')['rowVersion'])
            check('direct manager cannot use company-wide edit scope for dedicated handover',status==400)
            status,handed=call('POST','/tasks/'+target['taskId']+'/handover',{'sourceUserId':ids['alpha-one-employee'],'targetUserId':ids['alpha-two-employee']},'alpha-one-head',detail(target['taskId'],'alpha-one-head')['rowVersion'])
            check('direct manager handover awaits their own manager',status==200 and handed['outcome']=='pending')
            check('operator manager approves dedicated handover',decide(handed['requestId'],'alpha-head')[0]==200 and detail(target['taskId'])['assigneeIds']==[ids['alpha-two-employee']])

            # ---------- 4.1 fixed-position task visibility matrix ----------
            def listed(task_id, who):
                status, body = call('GET', '/tasks?limit=100', who=who)
                return status == 200 and any(row.get('id') == task_id for row in body.get('items', []))
            def detail_status(task_id, who):
                return call('GET', '/tasks/' + task_id, who=who)[0]
            def draft_plan():
                status, body = call('GET', '/admin/organization-plans', who='admin')
                check('administrator reads the complete organization draft', status == 200, {'status': status})
                return body
            def save_plan(mutator):
                draft = draft_plan()
                body = {key: copy.deepcopy(draft[key]) for key in ('departments', 'teams', 'placements', 'expectedEmployees')}
                body['reason'] = 'Review matrix organization change'
                mutator(body)
                return call('POST', '/admin/organization-plans', body, 'admin', draft['rowVersion'])
            def move(employee_key, department, team, placement='employee'):
                def mutate(body):
                    row = next(item for item in body['placements'] if item['employeeId'] == ids[employee_key])
                    row['placementType'] = placement
                    row['departmentId'] = department
                    row['teamId'] = team
                return save_plan(mutate)

            check('cross-department task is visible to both effective-owner department heads', listed(task, 'alpha-head') and listed(task, 'beta-head'))
            check('team-head scope follows the effective owner, not the creator team', listed(task, 'alpha-two-head') and not listed(task, 'alpha-one-head'))
            check('ordinary employee sees own created work but not a teammate-owned task', listed(task, 'alpha-one-employee') and not listed(task, 'beta-two-employee'))
            check('fixed founder reads company tasks while independent administrator is refused', listed(task, 'founder') and call('GET', '/tasks?limit=5', who='admin')[0] == 403)
            check('direct ID access is refused outside the fixed scope', detail_status(task, 'beta-two-employee') == 404 and detail_status(task, 'alpha-one-head') == 404)
            cross = create('founder', ['alpha-one-employee', 'beta-one-employee'])
            check('cross-department task reaches both teams and both department heads',
                  all(listed(cross['taskId'], who) for who in ('alpha-head', 'beta-head', 'alpha-one-head', 'beta-one-head'))
                  and not listed(cross['taskId'], 'alpha-two-head') and not listed(cross['taskId'], 'beta-two-employee'))
            beta_only = create('founder', ['beta-one-employee'])
            check('creator department never decides the task department', not listed(beta_only['taskId'], 'alpha-head')
                  and listed(beta_only['taskId'], 'beta-head') and listed(beta_only['taskId'], 'founder'))
            manager_cross = create('alpha-head', ['beta-one-employee'])
            check('department head creation follows the direct manager route', manager_cross['outcome'] == 'pending' and decide(manager_cross['requestId'], 'founder')[0] == 200)
            check('manager keeps a cross-department task they created', listed(manager_cross['taskId'], 'alpha-head') and listed(manager_cross['taskId'], 'beta-head') and not listed(manager_cross['taskId'], 'alpha-one-head'))
            pending_cross = create('alpha-one-employee', ['beta-one-employee'])
            check('unpublished creation stays out of every normal list and detail', pending_cross['outcome'] == 'pending'
                  and not listed(pending_cross['taskId'], 'beta-one-employee') and not listed(pending_cross['taskId'], 'founder')
                  and detail_status(pending_cross['taskId'], 'beta-one-employee') == 404)
            decide(pending_cross['requestId'], 'alpha-one-head')

            before_move = create('founder', ['beta-one-employee'])
            check('old team head sees the current team owner before the move', listed(before_move['taskId'], 'beta-one-head'))
            status, moved = move('beta-one-employee', 'fixture-company-alpha', 'fixture-company-alpha-one')
            check('complete plan moves an employee to another team atomically', status == 200, {'status': status, 'code': moved.get('code')})
            check('old manager loses list, detail and handover ranges after the move',
                  not listed(before_move['taskId'], 'beta-one-head') and detail_status(before_move['taskId'], 'beta-one-head') == 404
                  and call('POST', '/tasks/' + before_move['taskId'] + '/handover',
                           {'sourceUserId': ids['beta-one-employee'], 'targetUserId': ids['alpha-one-employee']},
                           'beta-one-head', detail(before_move['taskId'], 'alpha-one-head')['rowVersion'])[0] in (403, 404))
            check('new team head and ordinary teammate scope follow the current placement',
                  listed(before_move['taskId'], 'alpha-one-head') and not listed(before_move['taskId'], 'alpha-one-employee'))
            teammate = create('founder', ['beta-one-employee'])
            check('ordinary employee cannot inherit a teammate-owned task', listed(teammate['taskId'], 'alpha-one-head') and not listed(teammate['taskId'], 'alpha-one-employee'))

            # A delivered notification is a dedicated read-only entry, never a normal task-list item.
            history_task = create('founder', ['beta-two-employee'])
            call('POST', '/admin/worker/run-once', {}, 'admin')
            call('PATCH', '/tasks/' + history_task['taskId'],
                 {'command': 'change', 'assigneeIds': [ids['alpha-one-employee']], 'reason': 'Remove delivered recipient'},
                 'founder', detail(history_task['taskId'], 'founder')['rowVersion'])
            check('history-only recipient is excluded from normal list and detail',
                  not listed(history_task['taskId'], 'beta-two-employee') and detail_status(history_task['taskId'], 'beta-two-employee') == 404)
            delivered = call('GET', '/notifications?limit=100', who='beta-two-employee')[1].get('items', [])
            notice = next((row for row in delivered if row.get('taskId') == history_task['taskId']), None)
            check('delivered task message remains in the notification inbox', notice is not None, delivered[:3])
            if notice:
                opened = call('GET', '/notifications/' + notice['id'] + '/task', who='beta-two-employee')
                check('dedicated history entry returns the current effective task read-only',
                      opened[0] == 200 and opened[1].get('readonly') is True and opened[1].get('accessRevoked') is True,
                      {'status': opened[0], 'readonly': opened[1].get('readonly') if opened[0] == 200 else None})

            # ---------- 4.5 consistent reads, version fencing and idempotency ----------
            replay_body = {'title': 'Idempotent organization fence', 'description': 'Same request across an organization change',
                           'priority': 'medium', 'allDay': False,
                           'startAt': (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=1)).isoformat(),
                           'dueAt': (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=2)).isoformat(),
                           'assigneeIds': [ids['beta-one-employee']]}
            status, replay_created = call('POST', '/tasks', replay_body, 'founder', key='matrix-org-fence')
            check('idempotent command succeeds before the organization change', status == 201 and replay_created.get('taskId'), {'status': status})
            status, _ = move('beta-one-employee', 'fixture-company-alpha', 'fixture-company-alpha-two')
            check('second complete plan keeps a legal final organization', status == 200)
            status, replay = call('POST', '/tasks', replay_body, 'founder', key='matrix-org-fence')
            check('old idempotency success is not replayed after the organization version changed', status == 409 and replay.get('code') == 'AUTHORIZATION_CHANGED', {'status': status, 'code': replay.get('code')})

            def consistent_read(_):
                return call('GET', '/admin/organization', who='admin')[0]
            def plan_read_race():
                def mutate(body):
                    row = next(item for item in body['placements'] if item['employeeId'] == ids['beta-one-employee'])
                    row['teamId'] = 'fixture-company-beta-one'
                    row['departmentId'] = 'fixture-company-beta'
                draft = draft_plan()
                body = {key: copy.deepcopy(draft[key]) for key in ('departments', 'teams', 'placements', 'expectedEmployees')}
                body['reason'] = 'Concurrent complete plan'
                mutate(body)
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as writer:
                    future = writer.submit(lambda: call('POST', '/admin/organization-plans', body, 'admin', draft['rowVersion']))
                    readers = [consistent_read(i) for i in range(8)]
                    write_status = future.result()[0]
                return write_status, readers
            write_status, readers = plan_read_race()
            check('concurrent organization plan and reads return only a legal observed state',
                  write_status in (200, 409, 412) and all(status in (200, 409) for status in readers), {'write': write_status, 'reads': readers})
            status, structure = call('GET', '/admin/organization', who='admin')
            placements = structure.get('placements', []) if status == 200 else []
            teams = {row['id']: row for row in structure.get('teams', [])} if status == 200 else {}
            check('a successful organization read is internally consistent',
                  status == 200 and len({row['employeeId'] for row in placements}) == len(placements)
                  and all(row.get('teamId') is None or teams.get(row['teamId'], {}).get('departmentId') == row.get('departmentId') for row in placements))

            # ---------- 5.4 preview, detail, diff, notification and decision share one rule ----------
            approval_task = create('founder', ['beta-two-employee'])
            status, preview_progress = call('POST', '/tasks/reviewer-preview',
                                            {'operation': 'progress', 'taskId': approval_task['taskId'], 'assigneeIds': [ids['beta-two-employee']]}, 'beta-two-employee')
            check('progress preview shows operator manager', status == 200 and preview_progress['reviewerId'] == ids['beta-two-head'] and preview_progress['requiresApproval'] is True)
            check('detail route matches the preview for the applicant', detail(approval_task['taskId'], 'beta-two-employee')['reviewerId'] == ids['beta-two-head'])
            status, progress_pending = call('PATCH', '/tasks/' + approval_task['taskId'],
                                            {'command': 'progress', 'progressNote': 'Matrix pending progress'}, 'beta-two-employee',
                                            detail(approval_task['taskId'], 'beta-two-employee')['rowVersion'])
            check('progress by a non-owner-business assignee becomes pending', status == 200 and progress_pending['outcome'] == 'pending')
            applicant_view = call('GET', '/approval-requests/' + progress_pending['requestId'], who='beta-two-employee')[1]
            reviewer_view = call('GET', '/approval-requests/' + progress_pending['requestId'], who='beta-two-head')[1]
            outsider_status = call('GET', '/approval-requests/' + progress_pending['requestId'], who='beta-head')[0]
            check('applicant sees submitted content but no reviewer comparison', 'diff' not in applicant_view and applicant_view['status'] == 'pending')
            check('only the actual reviewer receives the field-by-field diff', 'diff' in reviewer_view and reviewer_view['currentReviewerId'] == ids['beta-two-head'])
            check('a task viewer outside the request cannot obtain proposal content', outsider_status == 404)
            event_rows = f.db.rows('SELECT event_type,recipients_json FROM domain_events WHERE organization_id=' + quote('fixture-company') + ' AND task_id=' + quote(approval_task['taskId']) + " AND event_type='task.progress.submitted'")
            recipients = json.loads(event_rows[-1][1]) if event_rows else []
            check('published submission notifies only the reviewer of record', recipients == [ids['beta-two-head']], recipients)
            status, _ = call('PATCH', '/approval-requests/' + progress_pending['requestId'], {'decision': 'approve'}, 'beta-two-employee', reviewer_view['rowVersion'])
            check('applicant cannot decide their own reviewed request', status in (403, 404, 409), {'status': status})
            check('reviewer decides and the effective version changes', decide(progress_pending['requestId'], 'beta-two-head')[0] == 200
                  and detail(approval_task['taskId'], 'beta-two-employee')['progressNote'] == 'Matrix pending progress')
            approved_rows = f.db.rows('SELECT event_type,recipients_json FROM domain_events WHERE organization_id=' + quote('fixture-company') + ' AND task_id=' + quote(approval_task['taskId']) + " AND event_type='task.progress.approved'")
            approved_recipients = set(json.loads(approved_rows[-1][1])) if approved_rows else set()
            check('approval result reaches applicant, business owner and current owner only', {ids['founder'], ids['beta-two-employee']}.issubset(approved_recipients)
                  and not ({ids['alpha-head'], ids['alpha-one-employee']} & approved_recipients), sorted(approved_recipients))
            check('approved operation leaves no pending record or re-approval entry', 'pendingRequestId' not in detail(approval_task['taskId'], 'founder')
                  and f.db.scalar('SELECT COUNT(*) FROM approval_requests WHERE task_id=' + quote(approval_task['taskId']) + " AND status='pending'") == 0)

            # ---------- 5.5 pending-route refresh after takeover/organization change ----------
            def inventory(key):
                status, body = call('GET', '/admin/employees/' + ids[key] + '/responsibilities', who='admin')
                check('administrator reads responsibility inventory for ' + key, status == 200)
                return body
            def arrangement(task_id, previous, following):
                stock = inventory(previous)
                item = next(row for row in stock['businessTasks'] if row['id'] == task_id)
                return {'taskId': task_id, 'taskVersion': item['rowVersion'], 'ownerVersion': item['ownerVersion'],
                        'previousEmployeeId': ids[previous], 'nextEmployeeId': ids[following], 'reason': 'Matrix ownership refresh'}
            def takeover(item):
                draft = draft_plan()
                return call('POST', '/admin/business-takeovers', {'transfers': [item]}, 'admin', draft['rowVersion'])

            reroute_task = create('founder', ['beta-two-employee'])
            _, reroute_pending = call('PATCH', '/tasks/' + reroute_task['taskId'], {'command': 'progress', 'progressNote': 'Reroute review'}, 'beta-two-employee', detail(reroute_task['taskId'], 'beta-two-employee')['rowVersion'])
            old_view = call('GET', '/approval-requests/' + reroute_pending['requestId'], who='beta-two-head')[1]
            check('takeover does not replace operator manager', takeover(arrangement(reroute_task['taskId'], 'founder', 'alpha-one-employee'))[0] == 200
                  and call('GET', '/approval-requests/' + reroute_pending['requestId'], who='beta-two-head')[1]['currentReviewerId']==ids['beta-two-head'])
            check('organization change reassigns actual applicant manager',move('beta-two-employee','fixture-company-beta','fixture-company-beta-one')[0]==200)
            check('old reviewer loses read and decision after reassignment', call('GET', '/approval-requests/' + reroute_pending['requestId'], who='beta-two-head')[0] == 404
                  and call('PATCH', '/approval-requests/' + reroute_pending['requestId'], {'decision': 'approve'}, 'beta-two-head', old_view['rowVersion'])[0] in (403,404,412))
            check('new direct manager can decide refreshed request', decide(reroute_pending['requestId'], 'beta-one-head')[0] == 200)
            check('restore applicant placement',move('beta-two-employee','fixture-company-beta','fixture-company-beta-two')[0]==200)

            direct_task = create('founder', ['beta-two-employee'])
            _, direct_pending = call('PATCH', '/tasks/' + direct_task['taskId'], {'command': 'progress', 'progressNote': 'Applicant becomes business owner'}, 'beta-two-employee', detail(direct_task['taskId'], 'beta-two-employee')['rowVersion'])
            check('takeover by applicant still requires own manager', takeover(arrangement(direct_task['taskId'], 'founder', 'beta-two-employee'))[0] == 200
                  and f.db.scalar('SELECT COUNT(*) FROM approval_requests WHERE id=' + quote(direct_pending['requestId']) + " AND status='pending' AND current_reviewer_id="+quote(ids['beta-two-head'])) == 1)
            check('takeover cannot publish pending proposal', detail(direct_task['taskId'], 'beta-two-employee')['progressNote'] == '')
            check('manager approves after takeover',decide(direct_pending['requestId'],'beta-two-head')[0]==200)

            expired_task = create('founder', ['beta-two-employee'])
            _, expired_pending = call('PATCH', '/tasks/' + expired_task['taskId'], {'command': 'progress', 'progressNote': 'Never revive'}, 'beta-two-employee', detail(expired_task['taskId'], 'beta-two-employee')['rowVersion'])
            f.db.server_side('UPDATE approval_requests SET applicable_deadline=UTC_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE id=' + quote(expired_pending['requestId']))
            check('refresh checks expiry before a new direct route', takeover(arrangement(expired_task['taskId'], 'founder', 'alpha-one-employee'))[0] == 200
                  and f.db.scalar('SELECT COUNT(*) FROM approval_requests WHERE id=' + quote(expired_pending['requestId']) + " AND status='expired'") == 1
                  and detail(expired_task['taskId'], 'alpha-one-employee')['progressNote'] == '')

            blocked_task = create('founder', ['beta-two-employee'])
            _, blocked_pending = call('PATCH', '/tasks/' + blocked_task['taskId'], {'command': 'progress', 'progressNote': 'Blocked reviewer'}, 'beta-two-employee', detail(blocked_task['taskId'], 'beta-two-employee')['rowVersion'])
            f.db.server_side('UPDATE users SET reviewer_available=0 WHERE id=' + quote(ids['beta-two-head']))
            check('refresh blocks when operator manager cannot review', takeover(arrangement(blocked_task['taskId'], 'founder', 'alpha-one-employee'))[0] == 200
                  and f.db.scalar('SELECT COUNT(*) FROM approval_requests WHERE id=' + quote(blocked_pending['requestId']) + " AND status='pending' AND current_reviewer_id IS NULL AND route_reason='manager-unavailable'") == 1)
            blocked_detail = detail(blocked_task['taskId'], 'beta-two-employee')
            check('blocked route is visible and never fabricated as an exemption', blocked_detail.get('pendingRoute', {}).get('blocked') is True
                  and blocked_detail.get('frozen') is True and detail(blocked_task['taskId'], 'beta-two-employee')['progressNote'] == '')
            f.db.server_side('UPDATE users SET reviewer_available=1 WHERE id=' + quote(ids['beta-two-head']))

            race_task = create('founder', ['beta-two-employee'])
            _, race_pending = call('PATCH', '/tasks/' + race_task['taskId'], {'command': 'progress', 'progressNote': 'One terminal only'}, 'beta-two-employee', detail(race_task['taskId'], 'beta-two-employee')['rowVersion'])
            race_view = call('GET', '/approval-requests/' + race_pending['requestId'], who='beta-two-head')[1]
            def approve_once(_):
                return call('PATCH', '/approval-requests/' + race_pending['requestId'], {'decision': 'approve'}, 'beta-two-head', race_view['rowVersion'])[0]
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                race_results = list(executor.map(approve_once, range(2)))
            check('concurrent decisions produce exactly one terminal result',
                  sum(status == 200 for status in race_results) == 1 and all(status in (200, 409, 412) for status in race_results)
                  and f.db.scalar('SELECT COUNT(*) FROM approval_requests WHERE id=' + quote(race_pending['requestId']) + " AND status='approved'") == 1, race_results)

            handover_task = create('founder', ['alpha-one-employee'])
            status, manager_handover = call('POST', '/tasks/' + handover_task['taskId'] + '/handover',
                                             {'sourceUserId': ids['alpha-one-employee'], 'targetUserId': ids['alpha-two-employee']},
                                             'alpha-one-head', detail(handover_task['taskId'], 'alpha-one-head')['rowVersion'])
            check('direct-manager handover is pending for own manager', status == 200 and manager_handover['outcome'] == 'pending')
            check('organization move blocks a handover whose setter is no longer the direct manager',
                  move('alpha-one-employee', 'fixture-company-beta', 'fixture-company-beta-one')[0] == 200
                  and f.db.scalar('SELECT COUNT(*) FROM approval_requests WHERE id=' + quote(manager_handover['requestId']) + " AND status='pending' AND current_reviewer_id IS NULL AND route_reason='applicant-unavailable'") == 1)
            check('blocked handover keeps the original effective owners', detail(handover_task['taskId'], 'founder')['assigneeIds'] == [ids['alpha-one-employee']])

            # ---------- 5.6 dedicated handover preset and work-circle candidates ----------
            founder_targets = call('GET', '/handover-targets?subjectId=' + ids['founder'], who='founder')[1]
            founder_target_ids = {row['id'] for row in founder_targets['items']}
            check('fixed founder may hand over to any active company employee', ids['beta-one-employee'] in founder_target_ids
                  and ids['alpha-two-employee'] in founder_target_ids and ids['admin'] not in founder_target_ids
                  and ids['other-founder'] not in founder_target_ids)
            subject_targets = call('GET', '/handover-targets?subjectId=' + ids['alpha-two-employee'], who='alpha-two-employee')[1]
            subject_target_ids = {row['id'] for row in subject_targets['items']}
            check('ordinary-handover targets stay inside the work circle', ids['alpha-head'] in subject_target_ids
                  and ids['alpha-one-head'] in subject_target_ids and ids['beta-one-employee'] not in subject_target_ids
                  and ids['admin'] not in subject_target_ids)
            status, _ = call('PUT', '/users/' + ids['alpha-two-employee'] + '/handover-preset', {'targetUserId': ids['beta-one-employee']}, 'alpha-two-employee')
            check('preset refuses a recipient outside the work circle', status == 400)
            status, preset = call('PUT', '/users/' + ids['alpha-two-employee'] + '/handover-preset', {'targetUserId': ids['alpha-one-head']}, 'alpha-two-employee')
            check('self preset saves a legal recipient', status == 200 and preset['targetUserId'] == ids['alpha-one-head'])
            status, manager_preset = call('PUT', '/users/' + ids['alpha-two-employee'] + '/handover-preset', {'targetUserId': ids['alpha-one-head']}, 'alpha-head')
            check('indirect management cannot set a handover preset', status == 403, {'status': status})
            status, _ = call('POST', '/tasks/' + handover_task['taskId'] + '/handover', {'sourceUserId': ids['alpha-one-employee'], 'targetUserId': ids['alpha-two-employee'], 'title': 'Smuggled'}, 'founder', detail(handover_task['taskId'], 'founder')['rowVersion'])
            check('dedicated handover rejects smuggled base fields', status == 400)
            edit_task = create('founder', ['alpha-one-head'])
            check('ordinary owner editing remains company-wide without widening handover', call('PATCH', '/tasks/' + edit_task['taskId'], {'command': 'change', 'assigneeIds': [ids['alpha-one-head'], ids['beta-one-employee']], 'reason': 'Company-wide owner edit'}, 'founder', detail(edit_task['taskId'], 'founder')['rowVersion'])[0] == 200)
            after_edit_targets = call('GET', '/handover-targets?subjectId=' + ids['alpha-one-head'], who='alpha-one-head')[1]
            after_edit_ids = {row['id'] for row in after_edit_targets['items']}
            check('dedicated handover still refuses the wider ordinary-edit candidate', ids['beta-two-employee'] not in after_edit_ids and ids['alpha-two-head'] in after_edit_ids)
            call('DELETE', '/users/' + ids['alpha-two-employee'] + '/handover-preset', who='alpha-two-employee')


            # ---------- 5.7 current business owner drives notifications and reminders ----------
            def run_worker():
                status, body = call('POST', '/admin/worker/run-once', {}, 'admin')
                check('deterministic worker pass completes', status == 200, {'status': status, 'code': body.get('code')})
            def event_rows(task_id, event_type=None):
                sql = ("SELECT event_type,recipients_json,request_id FROM domain_events WHERE organization_id="
                       + quote('fixture-company') + " AND task_id=" + quote(task_id))
                if event_type:
                    sql += " AND event_type=" + quote(event_type)
                return f.db.rows(sql + ' ORDER BY created_at,id')
            def event_recipients(task_id, event_type):
                rows = event_rows(task_id, event_type)
                return set(json.loads(rows[-1][1])) if rows else set()
            def notifications_for(who, event_type=None):
                status, body = call('GET', '/notifications?limit=100', who=who)
                items = body.get('items', []) if status == 200 else []
                return [row for row in items if event_type is None or row.get('eventType') == event_type]
            def task_events(task_id):
                return [row[0] for row in event_rows(task_id)]

            pending_create = create('alpha-head', ['beta-one-employee'])
            create_submitted = event_rows(pending_create['taskId'], 'task.create.submitted')
            check('unpublished submission is addressed only to applicant and reviewer',
                  create_submitted and set(json.loads(create_submitted[-1][1])) == {ids['alpha-head'], ids['founder']},
                  [json.loads(row[1]) for row in create_submitted])
            run_worker()
            check('unpublished submission creates no copy for an uninvolved task participant',
                  not notifications_for('beta-one-employee', 'task.create.submitted'))
            check('reviewer receives the actionable creation request', notifications_for('founder', 'task.create.submitted'))
            check('direct manager approves creation and result reaches the applicant', decide(pending_create['requestId'], 'founder')[0] == 200
                  and notifications_for('alpha-head', 'task.create.approved'))
            create_result = event_recipients(pending_create['taskId'], 'task.create.approved')
            check('creation result recipient matrix includes applicant, reviewer and owner only',
                  {ids['alpha-head'], ids['founder'], ids['beta-one-employee']}.issubset(create_result)
                  and ids['alpha-one-employee'] not in create_result, sorted(create_result))

            self_task = create('founder', ['founder'])
            run_worker()
            check('direct self operation is an applied event, never a self-review request',
                  'task.create.applied' in task_events(self_task['taskId'])
                  and 'task.create.submitted' not in task_events(self_task['taskId'])
                  and not [row for row in notifications_for('founder') if row.get('taskId') == self_task['taskId'] and row.get('requestStatus') == 'pending'])
            check('direct self operation leaves no pending approval row', f.db.scalar(
                'SELECT COUNT(*) FROM approval_requests WHERE task_id=' + quote(self_task['taskId']) + " AND status='pending'") == 0)

            review_task = create('founder', ['beta-two-employee'])
            _, review_pending = call('PATCH', '/tasks/' + review_task['taskId'],
                                     {'command': 'progress', 'progressNote': 'Owner notification matrix'}, 'beta-two-employee',
                                     detail(review_task['taskId'], 'beta-two-employee')['rowVersion'])
            submitted_event = event_rows(review_task['taskId'], 'task.progress.submitted')
            check('published submission event carries only the current reviewer', submitted_event
                  and set(json.loads(submitted_event[-1][1])) == {ids['beta-two-head']}, [json.loads(row[1]) for row in submitted_event])
            run_worker()
            check('applicant receives no early proposal copy while the request is pending', not notifications_for('beta-two-employee', 'task.progress.submitted'))
            decide(review_pending['requestId'], 'beta-two-head')
            run_worker()
            check('approval result is delivered to applicant and current business owner', notifications_for('beta-two-employee', 'task.progress.approved')
                  and notifications_for('founder', 'task.progress.approved'))
            result_event = event_rows(review_task['taskId'], 'task.progress.approved')
            bound_request = submitted_event[-1][2] if submitted_event and submitted_event[-1][2] else None
            check('submission and result stay bound to the originating request',
                  bound_request is not None and result_event[-1][2] == bound_request, {'request': bound_request})

            takeover_task = create('founder', ['alpha-one-employee'])
            check('takeover changes the future business responsibility', takeover(arrangement(takeover_task['taskId'], 'founder', 'beta-two-employee'))[0] == 200)
            status, takeover_pending = call('PATCH', '/tasks/' + takeover_task['taskId'],
                                            {'command': 'progress', 'progressNote': 'After takeover responsibility'}, 'alpha-one-employee',
                                            detail(takeover_task['taskId'], 'alpha-one-employee')['rowVersion'])
            check('after takeover the active reviewer remains operator manager', status == 200 and takeover_pending['outcome'] == 'pending')
            takeover_submitted = event_rows(takeover_task['taskId'], 'task.progress.submitted')
            check('takeover review notification excludes the original creator', takeover_submitted
                  and set(json.loads(takeover_submitted[-1][1])) == {ids['beta-one-head']},
                  [json.loads(row[1]) for row in takeover_submitted])
            run_worker()
            check('original creator receives no new review request after takeover', not notifications_for('founder', 'task.progress.submitted') or
                  all(row.get('taskId') != takeover_task['taskId'] for row in notifications_for('founder', 'task.progress.submitted')))
            decide(takeover_pending['requestId'], 'beta-one-head')
            run_worker()
            check('takeover result reaches the current responsibility chain', notifications_for('alpha-one-employee', 'task.progress.approved')
                  and notifications_for('beta-two-employee', 'task.progress.approved'))

            status, clock_body = call('GET', '/admin/clock', who='admin')
            check('verification clock is controllable', status == 200 and clock_body.get('controllable') is True, clock_body)
            base = dt.datetime.fromisoformat(clock_body['now'].replace('Z', '+00:00'))
            reminder_form = {'title': 'Reminder responsibility fixture', 'description': 'Real proportional reminder',
                             'priority': 'high', 'allDay': False,
                             'startAt': base.isoformat(), 'dueAt': (base + dt.timedelta(seconds=100)).isoformat(),
                             'assigneeIds': [ids['alpha-one-employee']]}
            status, reminder_created = call('POST', '/tasks', reminder_form, 'founder')
            check('reminder fixture task is created directly', status == 201 and reminder_created['outcome'] == 'direct')
            reminder_task = reminder_created['taskId']
            check('reminder task is taken over before its node', takeover(arrangement(reminder_task, 'founder', 'beta-two-employee'))[0] == 200)
            call('POST', '/admin/clock/advance', {'seconds': 85}, 'admin')
            run_worker()
            receipts = f.db.rows('SELECT recipient_id,execution_round,schedule_version,node,dedupe_key FROM reminder_receipts WHERE organization_id='
                                 + quote('fixture-company') + ' AND task_id=' + quote(reminder_task) + ' ORDER BY created_at,id')
            receipt_recipients = {row[0] for row in receipts}
            check('reminder reaches the current business owner and effective assignee only',
                  receipt_recipients == {ids['beta-two-employee'], ids['alpha-one-employee']}, sorted(receipt_recipients))
            check('reminder does not keep the original creator responsibility slot', ids['founder'] not in receipt_recipients)
            before_dedupe = len(receipts)
            run_worker()
            after_dedupe = f.db.scalar('SELECT COUNT(*) FROM reminder_receipts WHERE task_id=' + quote(reminder_task))
            check('same round and schedule version are deduplicated on a second scan', after_dedupe == before_dedupe)
            schedule_before = {row[2] for row in receipts}
            check('reminder receipt carries the real schedule version and round', all(int(row[1]) == 1 for row in receipts) and len(schedule_before) == 1)

            status, _ = call('PATCH', '/tasks/' + reminder_task,
                             {'command': 'complete', 'completionNote': 'Reminder work complete'}, 'alpha-one-employee',
                             detail(reminder_task, 'alpha-one-employee')['rowVersion'])
            check('effective assignee completes and awaits their own manager', status == 200)
            pending_id = f.db.rows('SELECT id FROM approval_requests WHERE task_id=' + quote(reminder_task) + " AND status='pending'")
            check('completion request is pending for operator manager', bool(pending_id))
            decide(pending_id[-1][0], 'beta-one-head')
            reopen_now = dt.datetime.fromisoformat(call('GET', '/admin/clock', who='admin')[1]['now'].replace('Z', '+00:00'))
            status, reopened_reminder = call('PATCH', '/tasks/' + reminder_task,
                                             {'command': 'reopen', 'reason': 'New reminder round',
                                              'allDay': False,
                                              'startAt': (reopen_now + dt.timedelta(seconds=10)).isoformat(),
                                              'dueAt': (reopen_now + dt.timedelta(seconds=110)).isoformat(),
                                              'assigneeIds': [ids['alpha-one-employee']]},
                                             'beta-two-employee', detail(reminder_task, 'beta-two-employee')['rowVersion'])
            check('takeover owner reopen needs own manager', status == 200 and reopened_reminder['outcome'] == 'pending')
            check('takeover owner manager approves reopen',decide(reopened_reminder['requestId'],'beta-two-head')[0]==200)
            call('POST', '/admin/clock/advance', {'seconds': 95}, 'admin')
            run_worker()
            new_receipts = f.db.rows('SELECT recipient_id,execution_round,schedule_version,node FROM reminder_receipts WHERE organization_id='
                                     + quote('fixture-company') + ' AND task_id=' + quote(reminder_task) + ' AND execution_round=2')
            check('new round receives its own reminder keyed by the new schedule', bool(new_receipts)
                  and {row[0] for row in new_receipts} == {ids['beta-two-employee'], ids['alpha-one-employee']}
                  and all(int(row[1]) == 2 for row in new_receipts), new_receipts)
            check('completion and reopen write real result events', 'task.complete.approved' in task_events(reminder_task)
                  and 'task.reopen.approved' in task_events(reminder_task))


            # A frozen task must not emit a reminder for a reached node until its request is terminal.
            frozen_clock = dt.datetime.fromisoformat(call('GET', '/admin/clock', who='admin')[1]['now'].replace('Z', '+00:00'))
            frozen_form = {'title': 'Frozen reminder suppression', 'description': 'No reminder while pending',
                           'priority': 'medium', 'allDay': False,
                           'startAt': frozen_clock.isoformat(),
                           'dueAt': (frozen_clock + dt.timedelta(seconds=100)).isoformat(),
                           'assigneeIds': [ids['beta-two-employee']]}
            status, frozen_created = call('POST', '/tasks', frozen_form, 'founder')
            check('frozen-reminder fixture is published', status == 201)
            frozen_task = frozen_created['taskId']
            _, frozen_pending = call('PATCH', '/tasks/' + frozen_task,
                                     {'command': 'progress', 'progressNote': 'Freeze the reminder scan'},
                                     'beta-two-employee', detail(frozen_task, 'beta-two-employee')['rowVersion'])
            call('POST', '/admin/clock/advance', {'seconds': 85}, 'admin')
            run_worker()
            frozen_receipts = f.db.scalar('SELECT COUNT(*) FROM reminder_receipts WHERE task_id=' + quote(frozen_task))
            check('no reminder is emitted while the task is frozen by a pending request', frozen_receipts == 0)
            check('current reviewer can release the freeze', decide(frozen_pending['requestId'], 'beta-two-head')[0] == 200)
            run_worker()
            released_receipts = f.db.scalar('SELECT COUNT(*) FROM reminder_receipts WHERE task_id=' + quote(frozen_task))
            check('the reached node is emitted once after the pending request ends', released_receipts >= 1)

            report['result']='PASS'
    except BaseException as error:
        report['result']='FAIL';report['errorType']=type(error).__name__;raise
    finally:
        OUTPUT.parent.mkdir(parents=True,exist_ok=True);OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__': main()
