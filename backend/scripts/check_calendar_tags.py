#!/usr/bin/env python3
"""Shared calendar tags and removed private-tag contract in an owned fixture."""
import json,os,subprocess,uuid
from fixed_model_fixture import Fixture
from migration_precheck import BASE

OUT=BASE/'.runtime/calendar-tags-check'
PORT=18199

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    report={'checks':[]}
    def check(name,condition):
        report['checks'].append({'check':name,'pass':bool(condition)})
        print(('PASS ' if condition else 'FAIL ')+name,flush=True)
        assert condition,name
    f=Fixture(port=PORT);f.log_path=OUT/'service.log'
    try:
        with f:
            tokens={k:f.login(k)[1]['token'] for k in ('founder','alpha-one-employee','alpha-one-head','other-founder','admin')}
            def call(method,path,body=None,who='founder',version=None):
                return f.call(method,path,body,tokens[who],uuid.uuid4().hex if method!='GET' else None,version)
            def ok(method,path,body=None,who='founder',version=None):
                status,data=call(method,path,body,who,version)
                assert status in (200,201),(method,path,status,data)
                return data
            first=ok('POST','/tags',{'name':'首选工作','color':'#D8EAF4'})['tagId']
            second=ok('POST','/tags',{'name':'其他工作','color':'#E4DEF3'})['tagId']
            check('personal tag creation rejected',call('POST','/tags',{'name':'私人','color':'#E4DEF3','scope':'personal'})[0]==400)
            check('employee cannot maintain company catalogue',call('POST','/tags',{'name':'员工新建','color':'#FBE3CB'},who='alpha-one-employee')[0]==403)
            check('admin has no business catalogue',call('GET','/tags',who='admin')[0]==403)
            check('catalogue is shared with employee',first in [t['id'] for t in ok('GET','/tags',who='alpha-one-employee')['items']])
            check('other organization has isolated catalogue',first not in [t['id'] for t in ok('GET','/tags',who='other-founder')['items']])
            body={'title':'多标签颜色验证','description':'Shared tags only','assigneeIds':[f.identities['alpha-one-employee']['id']],'tagIds':[first,second],
                  'allDay':False,'startAt':'2030-12-31T01:00:00Z','dueAt':'2030-12-31T03:00:00Z'}
            task=ok('POST','/tasks',body)['taskId']
            reordered=ok('POST','/tasks',{**body,'title':'标签换序验证','tagIds':[second,first]})['taskId']
            raw=ok('GET','/tasks/'+task)
            check('task retains ordered shared tags',raw['tagIds']==[first,second] and [t['id'] for t in raw['tags']]==[first,second])
            check('reordered task has a different shared first color',ok('GET','/tasks/'+reordered,who='alpha-one-employee')['tags'][0]['color']=='#E4DEF3')
            check('private task mark route is gone',call('PUT','/tasks/'+task+'/personal-tag',{'tagId':first},who='alpha-one-employee')[0] in (404,405))
            check('old personalTag field absent','personalTag' not in raw and all('personalTag' not in row for row in ok('GET','/tasks?limit=100')['items']))
            ok('PUT','/tasks/'+task+'/pin',{},who='alpha-one-employee')
            check('personal pin survives shared tag model',ok('GET','/tasks/'+task,who='alpha-one-employee')['pinned'] is True and ok('GET','/tasks/'+task)['pinned'] is False)
            changed=ok('PATCH','/tags/'+first,{'name':'首选更新','color':'#F6D5D2'},version=1)
            check('live first tag rename and recolor',ok('GET','/tasks/'+task)['tags'][0]['name']=='首选更新' and ok('GET','/tasks/'+task)['tags'][0]['color']=='#F6D5D2')
            ok('DELETE','/tags/'+first,version=changed['rowVersion'])
            check('deleted first tag keeps display snapshot',ok('GET','/tasks/'+task)['tags'][0]['deleted'])
            check('deleted tag unavailable for new task',call('POST','/tasks',{**body,'title':'不允许新引用'})[0] in (400,409))
            check('no personal override table',f.db.scalar("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='personal_task_tags'")==0)
            manifest={'base':f'http://127.0.0.1:{PORT}','taskId':task,'reordered':reordered,'first':first,'second':second,'employee':f.identities['alpha-one-employee']['identifier'],'founder':f.identities['founder']['identifier'],'output':str(OUT)}
            subprocess.run(['node',str(BASE/'scripts/check_calendar_tags_browser.mjs')],env={**os.environ,'PANDORA_TAG_FIXTURE':json.dumps(manifest)},check=True)
            check('shared-tag browser workflow',True)
        report['passed']=True
    except Exception as error:
        report.update(passed=False,error=str(error))
        raise
    finally:
        (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

if __name__=='__main__':main()
