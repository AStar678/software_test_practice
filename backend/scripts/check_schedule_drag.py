#!/usr/bin/env python3
"""Owned disposable database and browser checks for explicit schedules, drag editing and the
lightweight schedule confirmation's pending projection / result recovery."""
import json,os,subprocess,uuid
from fixed_model_fixture import Fixture, quote
from migration_precheck import BASE
OUT=BASE.parent/'output/task-schedule'

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    f=Fixture(port=18210,worker=True,controllable=True); f.log_path=OUT/'service.log'
    with f:
        tokens={k:f.login(k)[1]['token'] for k in ('founder','alpha-one-employee','alpha-one-head')}
        ids={k:v['id'] for k,v in f.identities.items()}
        def ok(method,path,body=None,who='founder',version=None):
            status,data=f.call(method,path,body,tokens[who],uuid.uuid4().hex,version)
            assert status in (200,201),(status,data)
            return data
        def create(title,start,due,who='founder',legacy=False,tags=None):
            body={'title':title,'description':'横向排期验证','assigneeIds':[ids[who]],'allDay':legacy}
            body.update({'startDate':start,'dueDate':due} if legacy else {'startAt':start,'dueAt':due})
            if tags: body['tagIds']=tags
            result=ok('POST','/tasks',body,who)
            if result['outcome']=='pending':
                request=ok('GET','/approval-requests/'+result['requestId'],who='alpha-one-head')
                ok('PATCH','/approval-requests/'+result['requestId'],{'decision':'approve'},'alpha-one-head',request['rowVersion'])
            return result['taskId']
        day='2030-12-31'
        task=create('跨年排期调整',day+'T01:20:00Z',day+'T10:20:00Z')
        point=create('零时长会议',day+'T04:00:00Z',day+'T04:00:00Z')
        # A three-hour task must occupy the same single company date cell as a full-day task on a quiet day.
        quiet='2031-01-10'
        short=create('三小时短任务',quiet+'T01:00:00Z',quiet+'T04:00:00Z')
        shortFull=create('短任务同日整日',quiet+'T00:00:00+08:00','2031-01-11T00:00:00+08:00')
        full=create('整日排期',day+'T00:00:00+08:00','2031-01-01T00:00:00+08:00')
        legacy=create('历史全天任务',day,day,legacy=True)
        # Tuesday 20:00 to Thursday 10:00 in the company zone: clipped first/middle/tail segments.
        crossDay='2031-02-10'
        cross=create('跨三日任务','2031-02-09T12:00:00Z','2031-02-11T02:00:00Z')
        # Real midnight end: it must stay on its start day and still allow an hourly endpoint drag.
        midnight=create('午夜截止任务',crossDay+'T06:00:00Z',crossDay+'T16:00:00Z')
        retryDay='2031-02-12'
        retry=create('轻量确认重试任务',retryDay+'T01:00:00Z',retryDay+'T03:00:00Z','alpha-one-employee')
        # Shared first tag gives a deterministic pending-bar colour in every presentation.
        tag=ok('POST','/tags',{'name':'排期投影标签','color':'#F6D5D2'})['tagId']
        proposalDay='2031-02-20'; expireDay='2031-02-26'
        proposal=create('待审排期投影任务',proposalDay+'T01:00:00Z',proposalDay+'T03:00:00Z','alpha-one-employee',tags=[tag])
        expire=create('过期排期投影任务',expireDay+'T01:00:00Z',expireDay+'T03:00:00Z','alpha-one-employee',tags=[tag])
        employee=create('员工排期待审核',day+'T01:00:00Z',day+'T10:00:00Z','alpha-one-employee')
        forbidden=ok('POST','/tasks',{'title':'他人创建仅负责','description':'不可修改排期','assigneeIds':[ids['alpha-one-employee']],'allDay':False,'startAt':day+'T01:00:00Z','dueAt':day+'T10:00:00Z'})['taskId']
        manifest={'base':f'http://127.0.0.1:{f.port}','identities':f.identities,'tokens':{'head':tokens['alpha-one-head']},
                  'task':task,'point':point,'full':full,'short':short,'shortFull':shortFull,'quiet':quiet,'legacy':legacy,
                  'employee':employee,'forbidden':forbidden,'day':day,'cross':cross,'crossDay':crossDay,'midnight':midnight,
                  'retry':retry,'retryDay':retryDay,'proposal':proposal,'proposalDay':proposalDay,'expire':expire,'expireDay':expireDay,
                  'tag':{'id':tag,'color':'#F6D5D2'}}
        subprocess.run(['node',str(BASE/'scripts/check_schedule_drag_browser.js')],env={**os.environ,'PANDORA_SCHEDULE_FIXTURE':json.dumps(manifest)},check=True)
        retry_requests=f.db.scalar("SELECT COUNT(*) FROM approval_requests WHERE task_id="+quote(retry)+" AND kind='change'")
        pending_requests=f.db.scalar("SELECT COUNT(*) FROM approval_requests WHERE task_id="+quote(retry)+" AND status='pending'")
        assert retry_requests==1,(retry_requests,pending_requests)
        print('PASS response-loss retry created exactly one change request',flush=True)
        handoff=json.loads((OUT/'handoff.json').read_text())
        # Only the applicant's expiry task is left pending; make its deadline pass before the next review attempt.
        f.db.server_side("UPDATE approval_requests SET applicable_deadline=UTC_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE id="+quote(handoff['requestId']))
        manifest['phase']='expire'
        subprocess.run(['node',str(BASE/'scripts/check_schedule_drag_browser.js')],env={**os.environ,'PANDORA_SCHEDULE_FIXTURE':json.dumps(manifest)},check=True)
        assert f.db.scalar("SELECT COUNT(*) FROM approval_requests WHERE id="+quote(handoff['requestId'])+" AND status='expired'")==1
        print('PASS expired schedule proposal stayed unpublished',flush=True)
if __name__=='__main__':main()
