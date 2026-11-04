#!/usr/bin/env python3
"""Current field permissions and mixed progress edit through real review APIs."""
import datetime as dt
import json
import os
import subprocess
import uuid

from fixed_model_fixture import Fixture
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
        task=ok('founder','POST','/tasks',{'title':'混合编辑原题','description':'原说明','assigneeIds':[ids['alpha-one-employee'],ids['beta-one-employee']],
            'allDay':False,'startAt':now.isoformat(),'dueAt':(now+dt.timedelta(days=2)).isoformat()})['taskId']
        def detail(who='founder'):return ok(who,'GET','/tasks/'+task)
        base=detail()
        owner=detail('alpha-one-employee')
        manager=detail('alpha-one-head')
        check('owner may edit ordinary fields and progress but not owner order',{'title','progressNote'}.issubset(owner['editableFields']) and 'assigneeIds' not in owner['editableFields'])
        check('visible manager has schedule access only',set(manager['editableFields']).isdisjoint({'title','progressNote','assigneeIds'}) and manager['canReschedule'])
        check('creator may reorder owners but not their progress','assigneeIds' in base['editableFields'] and 'progressNote' not in base['editableFields'])
        changed=ok('alpha-one-employee','PATCH','/tasks/'+task,{'command':'change','title':'混合编辑新题','progressNote':'完成首轮','reason':'同步资料与进展'},owner['rowVersion'])
        check('mixed edit creates one pending request',changed['outcome']=='pending' and bool(changed['requestId']))
        pending=detail()
        check('pending request keeps both effective fields',pending['title']=='混合编辑原题' and pending['progressNote']=='' and pending['executionState']=='todo')
        request=ok('alpha-one-head','GET','/approval-requests/'+changed['requestId'])
        check('reviewer sees both changed fields',{'title','progressNote'}.issubset({field['field'] for field in request['diff']}))
        check('applicant receives no reviewer comparison',not ok('alpha-one-employee','GET','/approval-requests/'+changed['requestId']).get('diff'))
        subprocess.run(['node',str(BASE/'scripts/check_apply_mixed_edit_browser.js')],
            env={**os.environ,'PANDORA_MIXED_FIXTURE':json.dumps({'base':f'http://127.0.0.1:{f.port}',
                'reviewer':f.identities['alpha-one-head']['identifier'],'requestId':changed['requestId']})},check=True)
        ok('alpha-one-head','PATCH','/approval-requests/'+changed['requestId'],{'decision':'approve'},request['rowVersion'])
        applied=detail()
        check('approval applies title and progress together',applied['title']=='混合编辑新题' and applied['progressNote']=='完成首轮' and applied['executionState']=='doing')
        ok('admin','POST','/admin/worker/run-once',{})
        notices=ok('alpha-one-employee','GET','/notifications?limit=100')['items']
        result_notice=next(item for item in notices if item.get('requestId')==changed['requestId'] and item['eventType'].endswith('.approved'))
        check('approved notification carries structured legal changes',{'title','progressNote'}.issubset({change['field'] for change in result_notice['changes']}))
        check('employee task detail omits execution record timeline','records' not in detail('alpha-one-employee'))
        check('owner cannot reorder the same assignee IDs',call('alpha-one-employee','PATCH','/tasks/'+task,{'command':'change','assigneeIds':[ids['beta-one-employee'],ids['alpha-one-employee']],'reason':'越权换序'},applied['rowVersion'])[0] in (403,409))
        check('creator cannot write owner progress',call('founder','PATCH','/tasks/'+task,{'command':'change','progressNote':'伪造进展','reason':'越权'},applied['rowVersion'])[0] in (403,409))
        check('visible manager cannot write owner progress',call('alpha-one-head','PATCH','/tasks/'+task,{'command':'change','progressNote':'伪造进展','reason':'越权'},applied['rowVersion'])[0] in (403,409))
        check('creator can reorder effective assignees',ok('founder','PATCH','/tasks/'+task,{'command':'change','assigneeIds':[ids['beta-one-employee'],ids['alpha-one-employee']],'reason':'调整顺序'},applied['rowVersion'])['outcome']=='direct')


if __name__=='__main__':main()
