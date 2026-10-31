#!/usr/bin/env python3
"""Real API and browser regression, owned disposable database only."""
import datetime as dt
import json
import os
import subprocess
import uuid
from fixed_model_fixture import Fixture, quote
from migration_precheck import BASE

OUT = BASE.parent / 'output/task-creation-refinement'

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = {'checks': []}
    def check(name, value):
        report['checks'].append({'check': name, 'pass': bool(value)})
        print(('PASS ' if value else 'FAIL ') + name, flush=True)
        if not value: raise AssertionError(name)
    fixture = Fixture(port=18207, worker=True, controllable=True)
    fixture.log_path = OUT / 'service.log'
    try:
        with fixture as f:
            tokens = {k: f.login(k)[1]['token'] for k in f.identities}
            ids = {k: p['id'] for k, p in f.identities.items()}
            def call(method, path, body=None, who='founder', version=None):
                return f.call(method, path, body, tokens[who], 'refine-' + uuid.uuid4().hex, version)
            def ok(method, path, body=None, who='founder', version=None):
                status, data = call(method, path, body, who, version)
                if status not in (200, 201): raise AssertionError((method, path, status, data))
                return data
            def worker(): ok('POST', '/admin/worker/run-once', {}, 'admin')
            def approve(result, reviewer):
                request = ok('GET', '/approval-requests/' + result['requestId'], who=reviewer)
                check('reviewer ' + reviewer, request['currentReviewerId'] == ids[reviewer])
                return ok('PATCH', '/approval-requests/' + result['requestId'], {'decision':'approve'}, reviewer, request['rowVersion'])
            now = dt.datetime.now(dt.timezone.utc)
            schedule = {'allDay':False, 'startAt':now.isoformat(), 'dueAt':(now+dt.timedelta(days=4)).isoformat()}
            tag1 = ok('POST', '/tags', {'name':'研发重点', 'color':'#F6D5D2'})['tagId']
            tag2 = ok('POST', '/tags', {'name':'跨部门协作标签名称很长', 'color':'#D8EAF4'})['tagId']
            body = {**schedule, 'title':'多标签跨部门任务', 'description':'真实接口验证', 'assigneeIds':[ids['beta-one-employee']], 'tagIds':[tag1,tag2]}
            result = ok('POST', '/tasks', body, 'alpha-one-employee')
            task = result['taskId']
            check('employee creation pending', result['outcome']=='pending')
            approve(result, 'alpha-one-head')
            detail = ok('GET', '/tasks/'+task)
            check('multiple tags persisted in order', detail['tagIds']==[tag1,tag2] and len(detail['tags'])==2)
            check('legacy scalar cannot truncate tags', call('PATCH','/tasks/'+task, {'command':'change','tagId':tag1,'reason':'legacy'}, 'alpha-one-employee', detail['rowVersion'])[0]==409)
            result = ok('PATCH','/tasks/'+task, {'command':'change','description':'修改保留多个标签','reason':'验证'}, 'alpha-one-employee', detail['rowVersion'])
            check('creator still requires manager review', result['outcome']=='pending')
            approve(result,'alpha-one-head')
            check('omitted tags preserve full collection', ok('GET','/tasks/'+task)['tagIds']==[tag1,tag2])
            for operation in ('progress','complete'):
                detail=ok('GET','/tasks/'+task)
                result=ok('PATCH','/tasks/'+task, {'command':operation,('progressNote' if operation=='progress' else 'completionNote'):'办理进展'}, 'beta-one-employee', detail['rowVersion'])
                check(operation+' uses operator manager', ok('GET','/approval-requests/'+result['requestId'],who='beta-one-head')['currentReviewerId']==ids['beta-one-head'])
                check('creator cannot decide assignee request', call('PATCH','/approval-requests/'+result['requestId'], {'decision':'approve'}, 'alpha-one-employee', 1)[0] in (403,404))
                worker()
                reviews=ok('GET','/notifications?category=review&readStatus=unread&limit=1',who='beta-one-head')
                check('review filter and pagination', reviews['total']>=1 and all(n['category']=='review' and not n.get('readAt') for n in reviews['items']))
                notice=reviews['items'][0]
                ok('POST','/notifications/'+notice['id']+'/open',{},'beta-one-head')
                check('read filter after opening', any(n['id']==notice['id'] for n in ok('GET','/notifications?category=review&readStatus=read',who='beta-one-head')['items']))
                approve(result,'beta-one-head')
                check('completed request leaves review filter', not any(n.get('requestId')==result['requestId'] for n in ok('GET','/notifications?category=review',who='beta-one-head')['items']))
            detail=ok('GET','/tasks/'+task)
            result=ok('PATCH','/tasks/'+task,{**schedule,'command':'reopen','reason':'新一轮'},'alpha-one-employee',detail['rowVersion'])
            approve(result,'alpha-one-head')
            detail=ok('GET','/tasks/'+task)
            result=ok('POST','/tasks/'+task+'/handover',{'sourceUserId':ids['beta-one-employee'],'targetUserId':ids['beta-two-employee'],'reason':'上级代办'},'beta-one-head',detail['rowVersion'])
            approve(result,'beta-head')
            check('handover keeps tags',ok('GET','/tasks/'+task)['tagIds']==[tag1,tag2])
            candidates=ok('GET','/assignee-candidates',who='alpha-one-employee')['items']
            check('candidate tree has true parents and no contacts',next(p for p in candidates if p['id']==ids['beta-one-employee'])['managerId']==ids['beta-one-head'] and all('phone' not in p and 'email' not in p for p in candidates))
            check('invalid notification filters rejected',call('GET','/notifications?readStatus=bad')[0]==400 and call('GET','/notifications?readStatus=read&unread=true')[0]==400)
            worker()
            results=ok('GET','/notifications?category=result&limit=1',who='alpha-one-employee')
            check('result filter counts beyond first page',results['total']>1 and len(results['items'])==1 and results['items'][0]['category']=='result')
            founder_task=ok('POST','/tasks',{**body,'assigneeIds':[ids['founder']]})
            check('founder remains exempt',founder_task['outcome']=='direct')
            # Independent tag commands: rejected proposals never replace the effective collection.
            private=ok('POST','/tags',{'scope':'personal','name':'仅本人标签','color':'#E4DEF3'})['tagId']
            foreign=ok('POST','/tags',{'name':'其他公司','color':'#D8EAF4'},'other-founder')['tagId']
            deleted=ok('POST','/tags',{'name':'保留删除快照','color':'#FBE3CB'})['tagId']
            invalids=[{'tagIds':[tag1,tag1]},{'tagIds':[foreign]},{'tagIds':[private]},{'tagIds':[tag1],'tagId':tag2}]
            check('duplicate foreign private and conflicting tags rejected',all(call('POST','/tasks',{**body,**invalid})[0]==400 for invalid in invalids))
            delete_task=ok('POST','/tasks',{**body,'tagIds':[deleted,tag2]})['taskId']
            retained_deleted=ok('POST','/tasks',{**body,'tagIds':[deleted,tag2]})['taskId']
            ok('DELETE','/tags/'+deleted,version=1)
            check('deleted tag preserves other tags and snapshot',ok('GET','/tasks/'+delete_task)['tags'][0]['deleted'] and ok('GET','/tasks/'+delete_task)['tagIds']==[deleted,tag2])
            check('deleted tag cannot be newly attached',call('POST','/tasks',{**body,'tagIds':[deleted]})[0]==409)
            d=ok('GET','/tasks/'+delete_task)
            ok('PATCH','/tasks/'+delete_task,{'command':'change','description':'沿用删除标签','reason':'保留'},version=d['rowVersion'])
            check('omitted deleted reference retained',ok('GET','/tasks/'+delete_task)['tagIds']==[deleted,tag2])
            d=ok('GET','/tasks/'+delete_task)
            ok('PATCH','/tasks/'+delete_task,{'command':'change','tagIds':[],'reason':'清空'},version=d['rowVersion'])
            check('empty collection clears legacy projection too',ok('GET','/tasks/'+delete_task)['tagIds']==[] and ok('GET','/tasks/'+delete_task)['tagId'] is None)
            detail=ok('GET','/tasks/'+task)
            proposal=ok('PATCH','/tasks/'+task,{'command':'change','tagIds':[tag2],'reason':'标签审核'},'alpha-one-employee',detail['rowVersion'])
            request=ok('GET','/approval-requests/'+proposal['requestId'],who='alpha-one-head')
            check('unapproved tags stay out of effective task',ok('GET','/tasks/'+task)['tagIds']==[tag1,tag2])
            check('tag collection included in review diff','tagIds' in json.dumps(request['diff']))
            ok('PATCH','/approval-requests/'+proposal['requestId'],{'decision':'reject','comment':'保留原标签'},'alpha-one-head',request['rowVersion'])
            check('rejection preserves entire collection',ok('GET','/tasks/'+task)['tagIds']==[tag1,tag2])
            worker()
            ok('PUT','/tasks/'+founder_task['taskId']+'/personal-tag',{'tagId':private})
            check('private tag leaves shared collection intact',ok('GET','/tasks/'+founder_task['taskId'])['tagIds']==[tag1,tag2])
            manifest={'base':f'http://127.0.0.1:{f.port}','identities':f.identities,'taskId':founder_task['taskId'],'emptyTaskId':delete_task,'deletedTaskId':retained_deleted,'deletedTagId':deleted,'sharedTaskId':task,'tagIds':[tag1,tag2]}
            subprocess.run(['node',str(BASE/'scripts/check_task_creation_refinement_browser.js')],env={**os.environ,'PANDORA_BROWSER_FIXTURE':json.dumps(manifest)},check=True)
    finally:
        (OUT/'api-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
