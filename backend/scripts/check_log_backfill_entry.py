#!/usr/bin/env python3
"""Task 8.4: the log page can backfill yesterday/the day before after today's log already exists."""
import json
import os
import subprocess
import datetime as dt
import uuid
from fixed_model_fixture import Fixture
from migration_precheck import BASE

OUTPUT = BASE.parent / 'audit/refactor-pandora-organization-and-workflows/log-backfill-entry.json'


def main():
    fixture = Fixture(port=18187)
    fixture.log_path = OUTPUT.with_name('log-backfill-service.log')
    with fixture as f:
        tokens={k:f.login(k)[1]['token'] for k in ('founder','alpha-head','alpha-one-employee','alpha-one-head')}
        ids={k:v['id'] for k,v in f.identities.items()}
        def call(method,path,body=None,who='founder',version=None):
            return f.call(method,path,body,tokens[who],uuid.uuid4().hex,version)
        def ok(method,path,body=None,who='founder',version=None):
            status,result=call(method,path,body,who,version)
            assert status in (200,201),(status,result)
            return result
        tag=ok('POST','/tags',{'name':'保留日历颜色','color':'#D8EAF4'})['tagId']
        for who in ('alpha-head','alpha-one-employee'):
            for scope in ('shared','personal'):
                assert call('POST','/tags',{'name':'不允许新建','color':'#D8EAF4','scope':scope},who)[0]==403
            assert call('PATCH','/tags/'+tag,{'name':'不允许改名'},who,1)[0]==403
            assert call('DELETE','/tags/'+tag,who=who,version=1)[0]==403
            assert not ok('GET','/tags',who=who)['canManage']
            assert all(not row['canEdit'] for row in ok('GET','/tags',who=who)['items'])
        # Preexisting private labels retain their color data but no longer grant maintenance rights.
        from fixed_model_fixture import quote
        private=str(uuid.uuid4())
        f.db.server_side('INSERT INTO tags(id,organization_id,name,color,owner_id) VALUES('+','.join(map(quote,[private,'fixture-company','旧私人标签','#E4DEF3',ids['alpha-head']]))+')')
        assert call('PATCH','/tags/'+private,{'name':'私有也不能维护'},'alpha-head',1)[0]==403
        assert call('DELETE','/tags/'+private,who='alpha-head',version=1)[0]==403
        now=dt.datetime.now(dt.timezone.utc)
        schedule={'allDay':False,'startAt':now.isoformat(),'dueAt':(now+dt.timedelta(days=3)).isoformat()}
        def task(title,owners,who='founder'):
            r=ok('POST','/tasks',{**schedule,'title':title,'description':'入口范围验证','assigneeIds':[ids[k] for k in owners],'tagIds':[tag]},who)
            if r['outcome']=='pending':
                req=ok('GET','/approval-requests/'+r['requestId'])
                ok('PATCH','/approval-requests/'+r['requestId'],{'decision':'approve'},version=req['rowVersion'])
            return r['taskId']
        created=task('本人创建但不负责',['alpha-one-employee'],'alpha-head')
        assigned=task('本人负责但不创建',['alpha-head'])
        subordinate=task('下属专属仅授权可见',['alpha-one-employee'])
        today=ok('GET','/home',who='alpha-one-head')['businessDate']
        foreign=ok('POST','/work-logs',{'businessDate':today,'body':'下属日志只从资料阅读'},'alpha-one-head')['logId']
        env = {**os.environ, 'PANDORA_BROWSER_FIXTURE': json.dumps({'base': f'http://127.0.0.1:{f.port}', 'identities': f.identities,'personalTasks':[created,assigned],'subordinateTask':subordinate,'colorTask':assigned,'tagId':tag,'foreignLog':foreign,'foreignAuthor':ids['alpha-one-head']})}
        subprocess.run(['node', str(BASE / 'scripts/check_log_backfill_entry_browser.js')], env=env, check=True)


if __name__ == '__main__':
    main()
