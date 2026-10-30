#!/usr/bin/env python3
"""Private calendar tags: real API and browser tests in an owned disposable database."""
import datetime as dt
import json
import os
import socket
import subprocess
import uuid
from fixed_model_fixture import Fixture, quote
from migration_precheck import BASE

OUT = BASE / '.runtime/calendar-tags-check'
PORT = 18199

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = {'checks': []}
    def check(name, result):
        report['checks'].append({'check': name, 'pass': bool(result)})
        print(('PASS ' if result else 'FAIL ') + name, flush=True)
        assert result, name
    fixture = Fixture(port=PORT)
    fixture.log_path = OUT / 'service.log'
    with socket.socket() as probe: probe.bind(('127.0.0.1', PORT))
    try:
        with fixture as f:
            tokens = {k: f.login(k)[1]['token'] for k in ['founder','alpha-one-employee','alpha-one-head','beta-one-employee','other-founder','admin']}
            owner='alpha-one-employee'; colleague='alpha-one-head'
            def call(method,path,body=None,who=owner,version=None):
                return f.call(method,path,body,tokens[who],uuid.uuid4().hex if method!='GET' else None,version)
            def ok(method,path,body=None,who=owner,version=None):
                status,result=call(method,path,body,who,version)
                assert status in (200,201),(method,path,status,result)
                return result
            shared=ok('POST','/tags',{'name':'项目工作','color':'#D8EAF4'},'founder')['tagId']
            private=ok('POST','/tags',{'name':'我的重点','color':'#E4DEF3','scope':'personal'})['tagId']
            other=ok('POST','/tags',{'name':'我的重点','color':'#DCEEE0','scope':'personal'},colleague)['tagId']
            ok('POST','/tags',{'name':'我的重点','color':'#FBE3CB'},'founder')
            check('names are unique within personal scope only',call('POST','/tags',{'name':'我的重点','color':'#E4DEF3','scope':'personal'})[0]==409)
            check('employee cannot create shared tags',call('POST','/tags',{'name':'Forbidden','color':'#E4DEF3'})[0]==403)
            check('null scope is a validation error',call('POST','/tags',{'name':'Invalid','color':'#E4DEF3','scope':None})[0]==400)
            for who in ['founder',colleague,'beta-one-employee','other-founder']:
                check('private catalogue hidden from '+who,private not in [t['id'] for t in ok('GET','/tags?includeDeleted=true',who=who)['items']])
                check('private edits hidden from '+who,call('PATCH','/tags/'+private,{'name':'Forbidden'},who,1)[0]==404)
                check('private deletion hidden from '+who,call('DELETE','/tags/'+private,who=who,version=1)[0]==404)
            check('admin has no business catalogue',call('GET','/tags',who='admin')[0]==403)
            check('employee cannot change shared catalogue',call('PATCH','/tags/'+shared,{'name':'Forbidden'},version=1)[0]==403)
            now=dt.datetime.now(dt.timezone.utc)
            body={'title':'项目进度讨论','description':'Calendar tag fixture','priority':'medium','allDay':False,
                  'startAt':now.replace(hour=1,minute=0,second=0,microsecond=0).isoformat(),
                  'dueAt':now.replace(hour=3,minute=0,second=0,microsecond=0).isoformat(),
                  'assigneeIds':[f.identities[owner]['id']],'tagId':shared}
            task=ok('POST','/tasks',body,'founder')['taskId']
            hidden=ok('POST','/tasks',{**body,'assigneeIds':[f.identities['beta-one-employee']['id']]},'founder')['taskId']
            before=f.db.rows('SELECT current_version_id,row_version FROM tasks WHERE id='+quote(task))
            counts=f.db.rows('SELECT (SELECT COUNT(*) FROM task_versions),(SELECT COUNT(*) FROM approval_requests),(SELECT COUNT(*) FROM domain_events)')
            check('private tag cannot enter shared task snapshots',call('POST','/tasks',{**body,'tagId':private})[0]==400)
            check('private tag cannot enter shared log snapshots',call('POST','/work-logs',{'body':'Private must stay private','businessDate':str(now.date()),'tagId':private})[0]==400)
            check('invisible task refuses private marks',call('PUT','/tasks/'+hidden+'/personal-tag',{'tagId':private})[0]==404)
            for tag in [shared,other]:
                check('only own private tag can be attached '+tag,call('PUT','/tasks/'+task+'/personal-tag',{'tagId':tag})[0]==404)
            ok('PUT','/tasks/'+task+'/personal-tag',{'tagId':private})
            check('owner sees personal tag alongside unchanged shared tag',ok('GET','/tasks/'+task)['personalTag']['id']==private and ok('GET','/tasks/'+task)['tag']['id']==shared)
            for who in [colleague,'founder']:
                check('coworker sees only shared colour '+who,ok('GET','/tasks/'+task,who=who)['personalTag'] is None)
            check('private mark preserves shared version and approval workflow',before==f.db.rows('SELECT current_version_id,row_version FROM tasks WHERE id='+quote(task)) and counts==f.db.rows('SELECT (SELECT COUNT(*) FROM task_versions),(SELECT COUNT(*) FROM approval_requests),(SELECT COUNT(*) FROM domain_events)'))
            check('task list includes own personal mark',any(t['id']==task and t['personalTag']['id']==private for t in ok('GET','/tasks?limit=100')['items']))
            changed=ok('PATCH','/tags/'+private,{'name':'本周专注','color':'#F6D5D2'},version=1)
            check('rename and recolour appear on owner task',ok('GET','/tasks/'+task)['personalTag']['name']=='本周专注' and ok('GET','/tasks/'+task)['personalTag']['color']=='#F6D5D2')
            ok('PUT','/tasks/'+task+'/personal-tag',{'tagId':None})
            check('clearing mark restores shared presentation',ok('GET','/tasks/'+task)['personalTag'] is None)
            ok('PUT','/tasks/'+task+'/personal-tag',{'tagId':private})
            ok('DELETE','/tags/'+private,version=changed['rowVersion'])
            check('deletion clears own task marks',ok('GET','/tasks/'+task)['personalTag'] is None and f.db.scalar('SELECT COUNT(*) FROM personal_task_tags WHERE tag_id='+quote(private))==0)
            check('deleted private tag cannot be attached',call('PUT','/tasks/'+task+'/personal-tag',{'tagId':private})[0]==409)
            manifest={'base':f'http://127.0.0.1:{PORT}','database':f.database,'output':str(OUT),'phone':f.identities[owner]['identifier'],'colleaguePhone':f.identities[colleague]['identifier'],'taskId':task,'sharedTag':shared}
            result=subprocess.run(['node',str(BASE/'scripts/check_calendar_tags_browser.mjs')],env={**os.environ,'PANDORA_TAG_FIXTURE':json.dumps(manifest)},timeout=240)
            check('real responsive browser workflow',result.returncode==0)
        report['passed']=True
    except Exception as error:
        report.update(passed=False,error=str(error))
        raise
    finally:
        (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__': main()
