#!/usr/bin/env python3
"""Current field permissions and mixed progress edit through real review APIs."""
import datetime as dt
import json
import os
import subprocess
import uuid

from fixed_model_fixture import Fixture, quote
from migration_precheck import BASE


def main():
    with Fixture(port=18228,worker=True,controllable=True) as f:
        tokens={name:f.login(name)[1]['token'] for name in ('admin','founder','alpha-one-employee','alpha-one-head','alpha-head','beta-one-employee')}
        ids={name:row['id'] for name,row in f.identities.items()}
        def call(who,method,path,body=None,version=None):
            return f.call(method,path,body,tokens[who],uuid.uuid4().hex if method!='GET' else None,version)
        def ok(who,method,path,body=None,version=None):
            code,row=call(who,method,path,body,version)
            assert code in (200,201),(method,path,code,row)
            return row
        def check(label,result):
            print(('PASS ' if result else 'FAIL ')+label,flush=True)
            assert result,label
        now=dt.datetime.now(dt.timezone.utc)
        first=ok('founder','POST','/tags',{'name':'混合首选','color':'#D8EAF4'})['tagId']
        second=ok('founder','POST','/tags',{'name':'混合次选','color':'#E4DEF3'})['tagId']
        task=ok('founder','POST','/tasks',{'title':'混合编辑原题','description':'原说明','assigneeIds':[ids['alpha-one-employee'],ids['beta-one-employee']],
            'tagIds':[first,second],'allDay':False,'startAt':now.isoformat(),'dueAt':(now+dt.timedelta(days=2)).isoformat()})['taskId']
        def detail(who='founder'):return ok(who,'GET','/tasks/'+task)
        def detail_of(task_id,who='founder'):return ok(who,'GET','/tasks/'+task_id)
        def founder_task(title,owners):
            return ok('founder','POST','/tasks',{'title':title,'description':'原说明','assigneeIds':owners,
                'allDay':False,'startAt':now.isoformat(),'dueAt':(now+dt.timedelta(days=2)).isoformat()})['taskId']
        base=detail()
        owner=detail('alpha-one-employee')
        manager=detail('alpha-one-head')
        check('owner may edit ordinary fields and progress but not owner order',{'title','progressNote'}.issubset(owner['editableFields']) and 'assigneeIds' not in owner['editableFields'])
        check('visible manager has schedule access only',set(manager['editableFields']).isdisjoint({'title','progressNote','assigneeIds'}) and manager['canReschedule'])
        check('creator may reorder owners but not their progress','assigneeIds' in base['editableFields'] and 'progressNote' not in base['editableFields'])
        owner_preview=ok('alpha-one-employee','POST','/tasks/reviewer-preview',{'taskId':task,'operation':'change','assigneeIds':base['assigneeIds'],'fields':['title','progressNote','tagIds']})
        check('owner change preview uses the current manager',owner_preview['reviewerId']==ids['alpha-one-head'] and owner_preview['requiresApproval'])
        check('owner cannot preview assignee replacement or reordering',call('alpha-one-employee','POST','/tasks/reviewer-preview',{'taskId':task,'operation':'change','assigneeIds':[ids['beta-one-employee'],ids['alpha-one-employee']],'fields':['assigneeIds']})[0]==409)
        check('creator cannot preview owner progress',call('founder','POST','/tasks/reviewer-preview',{'taskId':task,'operation':'change','assigneeIds':base['assigneeIds'],'fields':['progressNote']})[0]==409)
        check('visible-only manager cannot preview metadata',call('alpha-one-head','POST','/tasks/reviewer-preview',{'taskId':task,'operation':'change','assigneeIds':base['assigneeIds'],'fields':['title']})[0]==409)
        check('visible-only manager can preview schedule',ok('alpha-one-head','POST','/tasks/reviewer-preview',{'taskId':task,'operation':'reschedule','assigneeIds':base['assigneeIds']})['reviewerId']==ids['alpha-head'])
        changed=ok('alpha-one-employee','PATCH','/tasks/'+task,{'command':'change','title':'混合编辑新题','progressNote':'完成首轮','tagIds':[second,first],'reason':'同步资料与进展'},owner['rowVersion'])
        check('mixed edit creates one pending request',changed['outcome']=='pending' and bool(changed['requestId']))
        pending=detail()
        check('pending request keeps both effective fields',pending['title']=='混合编辑原题' and pending['progressNote']=='' and pending['executionState']=='todo')
        check('pending request keeps the effective tag order',pending['tagIds']==[first,second])
        request=ok('alpha-one-head','GET','/approval-requests/'+changed['requestId'])
        check('reviewer sees both changed fields',{'title','progressNote','tagIds'}.issubset({field['field'] for field in request['diff']}))
        check('pending request reads back the current reviewer',request['currentReviewerId']==ids['alpha-one-head'])
        check('reviewer diff keeps tag order distinct',[(row['field'],row['before'],row['after']) for row in request['diff'] if row['field']=='tagIds']==[('tagIds','混合首选、混合次选','混合次选、混合首选')])
        check('applicant receives no reviewer comparison',not ok('alpha-one-employee','GET','/approval-requests/'+changed['requestId']).get('diff'))
        creation_task=ok('alpha-one-employee','POST','/tasks',{'title':'浏览器创建无旧版','description':'创建差异','assigneeIds':[ids['alpha-one-employee']],
            'allDay':False,'startAt':now.isoformat(),'dueAt':(now+dt.timedelta(days=2)).isoformat()})
        subprocess.run(['node',str(BASE/'scripts/check_apply_mixed_edit_browser.js')],
            env={**os.environ,'PANDORA_MIXED_FIXTURE':json.dumps({'base':f'http://127.0.0.1:{f.port}',
                'reviewer':f.identities['alpha-one-head']['identifier'],'requestId':changed['requestId'],
                'creationRequestId':creation_task['requestId']})},check=True)
        ok('alpha-one-head','PATCH','/approval-requests/'+changed['requestId'],{'decision':'approve'},request['rowVersion'])
        applied=detail()
        check('approval applies title and progress together',applied['title']=='混合编辑新题' and applied['progressNote']=='完成首轮' and applied['executionState']=='doing')
        check('approval applies the proposed ordered tags',applied['tagIds']==[second,first])
        check('mixed approval records field and effective progress audit',f.db.scalar('SELECT COUNT(*) FROM task_history_entries WHERE task_id='+quote(task)+' AND request_id='+quote(changed['requestId'])+" AND field_name IN ('title','progressNote','tagIds')")>=3 and f.db.scalar('SELECT COUNT(*) FROM task_records WHERE request_id='+quote(changed['requestId'])+" AND kind='progress' AND effective_at IS NOT NULL")==1)
        check('mixed approval emits one result event',f.db.scalar('SELECT COUNT(*) FROM domain_events WHERE task_id='+quote(task)+' AND request_id='+quote(changed['requestId'])+" AND event_type='task.change.approved'")==1)
        ok('admin','POST','/admin/worker/run-once',{})
        notices=ok('alpha-one-employee','GET','/notifications?limit=100')['items']
        result_notice=next(item for item in notices if item.get('requestId')==changed['requestId'] and item['eventType'].endswith('.approved'))
        check('approved notification carries structured legal changes',{'title','progressNote'}.issubset({change['field'] for change in result_notice['changes']}))
        check('employee task detail omits execution record timeline','records' not in detail('alpha-one-employee'))
        check('owner cannot reorder the same assignee IDs',call('alpha-one-employee','PATCH','/tasks/'+task,{'command':'change','assigneeIds':[ids['beta-one-employee'],ids['alpha-one-employee']],'reason':'越权换序'},applied['rowVersion'])[0] in (403,409))
        check('creator cannot write owner progress',call('founder','PATCH','/tasks/'+task,{'command':'change','progressNote':'伪造进展','reason':'越权'},applied['rowVersion'])[0] in (403,409))
        check('visible manager cannot write owner progress',call('alpha-one-head','PATCH','/tasks/'+task,{'command':'change','progressNote':'伪造进展','reason':'越权'},applied['rowVersion'])[0] in (403,409))
        check('creator can reorder effective assignees',ok('founder','PATCH','/tasks/'+task,{'command':'change','assigneeIds':[ids['beta-one-employee'],ids['alpha-one-employee']],'reason':'调整顺序'},applied['rowVersion'])['outcome']=='direct')

        unchanged_owner=detail_of(founder_task('保留原负责人',[ids['alpha-one-employee'],ids['beta-one-employee']]),'alpha-one-employee')
        same_owner=ok('alpha-one-employee','PATCH','/tasks/'+unchanged_owner['taskId'],{'command':'change','title':'保留负责人改标题','assigneeIds':unchanged_owner['assigneeIds'],'reason':'保留列表'},unchanged_owner['rowVersion'])
        check('an unchanged owner list does not require owner-order authority',same_owner['outcome']=='pending')

        rejected_task=founder_task('拒绝原子性',[ids['alpha-one-employee']])
        rejected_base=detail_of(rejected_task)
        rejected=ok('alpha-one-employee','PATCH','/tasks/'+rejected_task,{'command':'change','title':'拒绝后不应生效','progressNote':'拒绝进展','reason':'拒绝验证'},rejected_base['rowVersion'])
        rejected_request=ok('alpha-one-head','GET','/approval-requests/'+rejected['requestId'])
        ok('alpha-one-head','PATCH','/approval-requests/'+rejected['requestId'],{'decision':'reject','comment':'保持原版'},rejected_request['rowVersion'])
        rejected_after=detail_of(rejected_task)
        check('rejection publishes neither metadata nor progress',rejected_after['title']=='拒绝原子性' and rejected_after['progressNote']=='' and rejected_after['executionState']=='todo')

        withdrawn_task=founder_task('撤销原子性',[ids['alpha-one-employee']])
        withdrawn_base=detail_of(withdrawn_task)
        withdrawn=ok('alpha-one-employee','PATCH','/tasks/'+withdrawn_task,{'command':'change','title':'撤销后不应生效','progressNote':'撤销进展','reason':'撤销验证'},withdrawn_base['rowVersion'])
        ok('alpha-one-employee','PATCH','/approval-requests/'+withdrawn['requestId'],{'decision':'withdraw'},ok('alpha-one-employee','GET','/approval-requests/'+withdrawn['requestId'])['rowVersion'])
        withdrawn_after=detail_of(withdrawn_task)
        check('withdrawal publishes neither metadata nor progress',withdrawn_after['title']=='撤销原子性' and withdrawn_after['progressNote']=='' and withdrawn_after['executionState']=='todo')

        expired_task=founder_task('失效原子性',[ids['alpha-one-employee']])
        expired_base=detail_of(expired_task)
        expired=ok('alpha-one-employee','PATCH','/tasks/'+expired_task,{'command':'change','title':'失效后不应生效','progressNote':'失效进展','reason':'失效验证'},expired_base['rowVersion'])
        f.db.server_side('UPDATE approval_requests SET applicable_deadline=UTC_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE id='+quote(expired['requestId']))
        expired_request=ok('alpha-one-head','GET','/approval-requests/'+expired['requestId'])
        check('expired mixed request returns a deadline error',call('alpha-one-head','PATCH','/approval-requests/'+expired['requestId'],{'decision':'approve'},expired_request['rowVersion'])[0]==409)
        expired_after=detail_of(expired_task)
        check('expiry publishes neither metadata nor progress',expired_after['title']=='失效原子性' and expired_after['progressNote']=='' and expired_after['executionState']=='todo' and f.db.scalar('SELECT COUNT(*) FROM approval_requests WHERE id='+quote(expired['requestId'])+" AND status='expired'")==1)

        direct_task=founder_task('创始人直接生效',[ids['founder']])
        direct=ok('founder','PATCH','/tasks/'+direct_task,{'command':'change','title':'创始人直接改题','progressNote':'创始人进展','reason':'直接生效'},detail_of(direct_task)['rowVersion'])
        direct_after=detail_of(direct_task)
        check('founder mixed edit applies directly in one step',direct['outcome']=='direct' and direct_after['title']=='创始人直接改题' and direct_after['progressNote']=='创始人进展' and direct_after['executionState']=='doing')

        retry_task=founder_task('幂等混合编辑',[ids['alpha-one-employee']])
        retry_version=detail_of(retry_task)['rowVersion']
        retry_body={'command':'change','title':'幂等新题','progressNote':'幂等进展','reason':'幂等验证'}
        key='mixed-edit-idempotency'
        first_status,first_retry=f.call('PATCH','/tasks/'+retry_task,retry_body,tokens['alpha-one-employee'],key,retry_version)
        second_status,second_retry=f.call('PATCH','/tasks/'+retry_task,retry_body,tokens['alpha-one-employee'],key,retry_version)
        retry_requests=ok('alpha-one-employee','GET','/approval-requests?mine=applicant&limit=100')['items']
        check('same idempotency key returns one mixed request',first_status==200 and second_status==200 and first_retry['requestId']==second_retry['requestId'] and sum(1 for row in retry_requests if row['taskId']==retry_task)==1)

        creator_task=ok('alpha-one-employee','POST','/tasks',{'title':'创建者换序','description':'原说明','assigneeIds':[ids['alpha-one-employee'],ids['beta-one-employee']],
            'allDay':False,'startAt':now.isoformat(),'dueAt':(now+dt.timedelta(days=2)).isoformat()})
        creator_request=ok('alpha-one-head','GET','/approval-requests/'+creator_task['requestId'])
        check('creation has no fabricated old version or diff',creator_request.get('diff')==[] and not creator_request.get('baseVersionId'))
        ok('alpha-one-head','PATCH','/approval-requests/'+creator_task['requestId'],{'decision':'approve'},creator_request['rowVersion'])
        reorder=ok('alpha-one-employee','PATCH','/tasks/'+creator_task['taskId'],{'command':'change','assigneeIds':[ids['beta-one-employee'],ids['alpha-one-employee']],'reason':'创建者换序'},detail_of(creator_task['taskId'],'alpha-one-employee')['rowVersion'])
        reorder_request=ok('alpha-one-head','GET','/approval-requests/'+reorder['requestId'])
        assignee_diff=[row for row in reorder_request['diff'] if row['field']=='assigneeIds']
        check('creator owner reorder produces an ordered reviewer diff',len(assignee_diff)==1 and assignee_diff[0]['before'].startswith(ids['alpha-one-employee']) and assignee_diff[0]['after'].startswith(ids['beta-one-employee']))

        lost_task=founder_task('批准前失权',[ids['alpha-one-employee']])
        lost_base=detail_of(lost_task)
        lost=ok('alpha-one-employee','PATCH','/tasks/'+lost_task,{'command':'change','title':'不应发布','progressNote':'不应发布进展','reason':'失权验证'},lost_base['rowVersion'])
        f.db.server_side('UPDATE task_version_assignees SET user_id='+quote(ids['beta-one-employee'])+' WHERE version_id='+quote(lost_base['currentVersionId']))
        lost_request=ok('alpha-one-head','GET','/approval-requests/'+lost['requestId'])
        check('approval blocks after the applicant loses the owner field',call('alpha-one-head','PATCH','/approval-requests/'+lost['requestId'],{'decision':'approve'},lost_request['rowVersion'])[0]==409)
        check('blocked approval keeps the effective version',detail_of(lost_task)['title']=='批准前失权' and detail_of(lost_task)['progressNote']=='')
        check('ordinary edit rejects source and status fields',call('founder','PATCH','/tasks/'+task,{'command':'change','executionState':'done','reason':'非法状态'},detail_of(task)['rowVersion'])[0]==400)
        current=detail_of(task,'alpha-one-employee')
        check('mixed edit still rejects a self parent',call('alpha-one-employee','PATCH','/tasks/'+task,{'command':'change','title':'父任务校验','parentTaskId':task,'reason':'父任务校验'},current['rowVersion'])[0]==400)

        ui_task=founder_task('浏览器混合编辑',[ids['alpha-one-employee']])
        subprocess.run(['node',str(BASE/'scripts/check_apply_mixed_edit_browser.js')],
            env={**os.environ,'PANDORA_MIXED_FIXTURE':json.dumps({'base':f'http://127.0.0.1:{f.port}',
                'reviewer':f.identities['alpha-one-head']['identifier'],'requestId':changed['requestId'],
                'owner':f.identities['alpha-one-employee']['identifier'],'ownerTask':ui_task,'skipReview':True})},check=True)
        ui_requests=ok('alpha-one-employee','GET','/approval-requests?mine=applicant&limit=100')['items']
        ui_pending=[row for row in ui_requests if row['taskId']==ui_task and row['status']=='pending']
        check('browser owner mixed edit created exactly one request',len(ui_pending)==1)
        ui_request=ok('alpha-one-head','GET','/approval-requests/'+ui_pending[0]['requestId'])
        check('browser owner request contains metadata and progress',{'title','progressNote'}.issubset({row['field'] for row in ui_request['diff']}))
        ok('alpha-one-head','PATCH','/approval-requests/'+ui_pending[0]['requestId'],{'decision':'approve'},ui_request['rowVersion'])
        ui_after=detail_of(ui_task)
        check('browser owner mixed edit applies once',ui_after['title']=='浏览器混合标题' and ui_after['progressNote']=='浏览器进展' and ui_after['executionState']=='doing')


if __name__=='__main__':main()
