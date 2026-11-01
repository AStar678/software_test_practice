#!/usr/bin/env python3
"""Verify write request IDs on a real non-localhost HTTP origin, with a disposable DB."""
import json,os,subprocess,uuid
from fixed_model_fixture import Fixture,quote
from migration_precheck import BASE
OUT=BASE.parent/'output/request-id-compat'
def main():
 OUT.mkdir(parents=True,exist_ok=True);f=Fixture(port=18213);f.log_path=OUT/'service.log'
 with f:
  tokens={k:f.login(k)[1]['token'] for k in ('alpha-one-employee','alpha-one-head')}
  def ok(who,method,path,body=None,version=None):
   code,row=f.call(method,path,body,tokens[who],uuid.uuid4().hex,version);assert code in (200,201),(code,row);return row
  task=ok('alpha-one-employee','POST','/tasks',{'title':'HTTP排期提交兼容','description':'隔离测试数据','assigneeIds':[f.identities['alpha-one-employee']['id']],'allDay':False,'startAt':'2030-12-31T01:20:00Z','dueAt':'2030-12-31T08:20:00Z'})
  request=ok('alpha-one-head','GET','/approval-requests/'+task['requestId']);ok('alpha-one-head','PATCH','/approval-requests/'+task['requestId'],{'decision':'approve'},request['rowVersion'])
  mode='before' if os.environ.get('PANDORA_COMPAT_EXPECT_BROKEN')=='1' else 'after'
  manifest={'base':f'http://127.0.0.1:{f.port}','httpBase':f'http://pandora-fixture.test:{f.port}','person':f.identities['alpha-one-employee'],'task':task['taskId'],'mode':mode}
  subprocess.run(['node',str(BASE/'scripts/check_request_id_compat_browser.js')],env={**os.environ,'PANDORA_COMPAT_FIXTURE':json.dumps(manifest)},check=True)
  count=f.db.scalar('SELECT COUNT(*) FROM approval_requests WHERE task_id='+quote(task['taskId']))
  expected=1 if mode=='before' else 2
  assert count==expected,(count,expected)
  print('PASS one new request despite response-loss retry' if mode=='after' else 'PASS broken submission created no new request')
  report=json.loads((OUT/(mode+'.json')).read_text());report['persistedRequestCount']=count;(OUT/(mode+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
