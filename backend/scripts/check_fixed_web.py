#!/usr/bin/env python3
"""Owns a disposable current-schema service for real-browser fixed-model checks."""
import datetime as dt
import uuid
import json
import os
import subprocess
from fixed_model_fixture import Fixture
from migration_precheck import BASE

def main():
    fixture=Fixture(port=18181)
    fixture.log_path=BASE.parent/'audit/refactor-pandora-organization-and-workflows/web-service.log'
    with fixture as f:
        manifest={'base':f'http://127.0.0.1:{f.port}','identities':f.identities}
        tokens={key:f.login(key)[1]['token'] for key in ('founder','alpha-two-employee','alpha-two-head')}
        ids={key:value['id'] for key,value in f.identities.items()}
        now=dt.datetime.now(dt.timezone.utc);zone=dt.timezone(dt.timedelta(hours=8));day=(now.astimezone(zone)+dt.timedelta(days=3)).date()
        def instant(offset,hour=0):return dt.datetime.combine(day+dt.timedelta(days=offset),dt.time(hour),zone).isoformat()
        def call(method,path,body=None,who='founder',version=None):
            status,result=f.call(method,path,body,tokens[who],'web-'+uuid.uuid4().hex,version)
            if status not in (200,201):raise AssertionError((path,status,result.get('code')))
            return result
        def form(title,owners):return {'title':title,'description':'Browser acceptance real task','priority':'medium','allDay':False,'startAt':instant(0,9),'dueAt':instant(3,18),'assigneeIds':[ids[key] for key in owners]}
        for index in range(105):call('POST','/tasks',form('Browser task '+str(index).zfill(3)+' very long title '*3,['alpha-one-employee']))
        special={}
        for key,start,end in (('cross',instant(0,20),instant(2,10)),('midnight',instant(0,12),instant(1)),('point',instant(1),instant(1))):
            body=form('Calendar '+key,['alpha-one-employee']);body.update(startAt=start,dueAt=end)
            special[key]=call('POST','/tasks',body)['taskId']
        body=form('All day original',['alpha-one-employee']);body.update(allDay=True,startDate=str(day),dueDate=str(day+dt.timedelta(days=2)));body.pop('startAt');body.pop('dueAt')
        special['allDay']=call('POST','/tasks',body)['taskId']
        completed=call('POST','/tasks',form('Completed departure work',['alpha-two-employee']),'alpha-two-employee')
        request=call('GET','/approval-requests/'+completed['requestId'],who='alpha-two-head')
        call('PATCH','/approval-requests/'+completed['requestId'],{'decision':'approve'},'alpha-two-head',request['rowVersion'])
        view=call('GET','/tasks/'+completed['taskId'],who='alpha-two-employee')
        call('PATCH','/tasks/'+completed['taskId'],{'command':'complete','completionNote':'Finished before departure'},'alpha-two-employee',view['rowVersion'])
        call('POST','/tasks',form('Unpublished departure creation',['beta-one-employee']),'alpha-two-employee')
        manifest.update(day=str(day),special=special,completedTask=completed['taskId'])
        env={**os.environ,'PANDORA_BROWSER_FIXTURE':json.dumps(manifest)}
        subprocess.run(['node',str(BASE/'scripts/check_fixed_admin_browser.js')],env=env,check=True)
        subprocess.run(['node',str(BASE/'scripts/check_fixed_employee_browser.js')],env=env,check=True)
if __name__=='__main__':main()
