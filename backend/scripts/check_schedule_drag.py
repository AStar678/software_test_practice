#!/usr/bin/env python3
"""Owned disposable database and browser checks for explicit schedules and drag editing."""
import json,os,subprocess,uuid
from fixed_model_fixture import Fixture
from migration_precheck import BASE
OUT=BASE.parent/'output/task-schedule'

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    f=Fixture(port=18210); f.log_path=OUT/'service.log'
    with f:
        tokens={k:f.login(k)[1]['token'] for k in ('founder','alpha-one-employee','alpha-one-head')}
        ids={k:v['id'] for k,v in f.identities.items()}
        def ok(method,path,body=None,who='founder',version=None):
            status,data=f.call(method,path,body,tokens[who],uuid.uuid4().hex,version)
            assert status in (200,201),(status,data)
            return data
        def create(title,start,due,who='founder',legacy=False):
            body={'title':title,'description':'横向排期验证','assigneeIds':[ids[who]],'allDay':legacy}
            body.update({'startDate':start,'dueDate':due} if legacy else {'startAt':start,'dueAt':due})
            result=ok('POST','/tasks',body,who)
            if result['outcome']=='pending':
                request=ok('GET','/approval-requests/'+result['requestId'],who='alpha-one-head')
                ok('PATCH','/approval-requests/'+result['requestId'],{'decision':'approve'},'alpha-one-head',request['rowVersion'])
            return result['taskId']
        day='2030-12-31'
        task=create('跨年排期调整',day+'T01:00:00Z',day+'T10:00:00Z')
        point=create('零时长会议',day+'T04:00:00Z',day+'T04:00:00Z')
        full=create('整日排期',day+'T00:00:00+08:00','2031-01-01T00:00:00+08:00')
        legacy=create('历史全天任务',day,day,legacy=True)
        employee=create('员工排期待审核',day+'T01:00:00Z',day+'T10:00:00Z','alpha-one-employee')
        forbidden=ok('POST','/tasks',{'title':'他人创建仅负责','description':'不可修改排期','assigneeIds':[ids['alpha-one-employee']],'allDay':False,'startAt':day+'T01:00:00Z','dueAt':day+'T10:00:00Z'})['taskId']
        manifest={'base':f'http://127.0.0.1:{f.port}','identities':f.identities,'task':task,'point':point,'full':full,'legacy':legacy,'employee':employee,'forbidden':forbidden,'day':day}
        subprocess.run(['node',str(BASE/'scripts/check_schedule_drag_browser.js')],env={**os.environ,'PANDORA_SCHEDULE_FIXTURE':json.dumps(manifest)},check=True)
if __name__=='__main__':main()
