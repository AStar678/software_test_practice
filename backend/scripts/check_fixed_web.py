#!/usr/bin/env python3
"""Owns a disposable current-schema service for real-browser fixed-model checks."""
import datetime as dt
import uuid
import json
import os
import subprocess
import urllib.parse
import urllib.request
from fixed_model_fixture import Fixture
from migration_precheck import BASE
from check_web_resources import references, without_query

def main():
    fixture=Fixture(port=18181)
    fixture.log_path=BASE.parent/'audit/refactor-pandora-organization-and-workflows/web-service.log'
    with fixture as f:
        root=BASE.parent
        names={without_query(name)[0] for _,name in references((root/'潘多拉-交互原型.html').read_text())}
        names.update(('潘多拉-交互原型.html','admin.html','index.html','debug.html'))
        resource_report={'updated':dt.datetime.now(dt.timezone.utc).isoformat(),'checks':[]}
        for name in sorted(names):
            source=(BASE/'src/main/resources/static/debug.html') if name=='debug.html' else root/name
            with urllib.request.urlopen(f'http://127.0.0.1:{f.port}/'+urllib.parse.quote(name)) as response:
                same=response.read()==source.read_bytes()
            resource_report['checks'].append({'resource':name,'pass':same})
        (root/'audit/refactor-pandora-organization-and-workflows/served-resources-final.json').write_text(json.dumps(resource_report,ensure_ascii=False,indent=2)+'\n')
        if not all(row['pass'] for row in resource_report['checks']):raise AssertionError('Served resources differ from repository')
        manifest={'base':f'http://127.0.0.1:{f.port}','identities':f.identities}
        tokens={key:f.login(key)[1]['token'] for key in ('founder','alpha-one-head','alpha-head','beta-one-employee','alpha-two-employee','alpha-two-head')}
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
        # A published task whose completion is waiting for review: the task form and detail must keep
        # showing the effective execution state/current progress, never the proposed completion text,
        # until the business owner decides.
        pending=call('POST','/tasks',form('Effective version pending task',['beta-one-employee']),'alpha-one-head')
        request=call('GET','/approval-requests/'+pending['requestId'],who='alpha-head')
        call('PATCH','/approval-requests/'+pending['requestId'],{'decision':'approve'},'alpha-head',request['rowVersion'])
        view=call('GET','/tasks/'+pending['taskId'],who='beta-one-employee')
        call('PATCH','/tasks/'+pending['taskId'],{'command':'complete',
            'completionNote':'Proposed completion must not appear'},'beta-one-employee',view['rowVersion'])
        manifest.update(day=str(day),special=special,completedTask=completed['taskId'],database=f.database,
            pendingTask=pending['taskId'],pendingOldTitle='Effective version pending task',
            pendingProposedTitle='Proposed completion must not appear')
        env={**os.environ,'PANDORA_BROWSER_FIXTURE':json.dumps(manifest)}
        subprocess.run(['node',str(BASE/'scripts/check_fixed_admin_browser.js')],env=env,check=True)
        subprocess.run(['node',str(BASE/'scripts/check_fixed_employee_browser.js')],env=env,check=True)
if __name__=='__main__':main()
