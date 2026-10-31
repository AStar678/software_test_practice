#!/usr/bin/env python3
"""Isolated real API / browser subordinate workspace regression."""
import datetime as dt,json,os,subprocess,uuid
from pathlib import Path
from fixed_model_fixture import Fixture,quote
from migration_precheck import BASE
OUT=BASE.parent/'output/subordinate-workspace'
def main():
 OUT.mkdir(parents=True,exist_ok=True);f=Fixture(port=18211);f.log_path=OUT/'service.log'
 with f:
  tokens={k:f.login(k)[1]['token'] for k in f.identities};ids={k:v['id'] for k,v in f.identities.items()}
  def call(method,path,body=None,who='founder',version=None):return f.call(method,path,body,tokens[who],uuid.uuid4().hex,version)
  def ok(method,path,body=None,who='founder',version=None):
   status,value=call(method,path,body,who,version);assert status in (200,201),(status,value);return value
  today=dt.date.fromisoformat(ok('GET','/home')['businessDate']);day=today+dt.timedelta(days=3)
  def instant(date,hour):return dt.datetime.combine(date,dt.time(hour),dt.timezone(dt.timedelta(hours=8))).isoformat()
  def task(title,start,end,owner='alpha-one-employee'):
   return ok('POST','/tasks',{'title':title,'description':'独立人员工作页','assigneeIds':[ids[owner]],'allDay':False,'startAt':start,'dueAt':end})['taskId']
  normal=task('小屏任务：跨部门协作与材料整理的长标题',instant(day,9),instant(day,17))
  point=task('零时长时点',instant(day,12),instant(day,12))
  cross=task('前日延续到次日',instant(day-dt.timedelta(days=1),20),instant(day+dt.timedelta(days=1),10))
  midnight=task('午夜截止不应出现在次日',instant(day-dt.timedelta(days=1),18),instant(day,0))
  spanning=task('跨周跨月连续任务',instant(day-dt.timedelta(days=4),20),instant(day+dt.timedelta(days=8),10))
  overlaps=[task('重叠工作 '+str(i),instant(day,9),instant(day,17)) for i in range(6)]
  other=task('其他下属任务不可混入',instant(day,9),instant(day,17),'alpha-two-employee')
  # Old historical logs are intentionally fixture-only; create UI still enforces the real 3-day window.
  for offset in range(12):
   f.db.server_side('INSERT INTO work_logs(id,organization_id,author_id,business_date,body) VALUES('+','.join(map(quote,[str(uuid.uuid4()),'fixture-company',ids['alpha-one-employee'],str(today-dt.timedelta(days=offset)),'日志 '+str(offset)+'\n'+'跨天资料整理，下一步检查验收。'*12]))+')')
  reports=ok('GET','/me/reports')['items'];assert all('managerId' in p for p in reports)
  assert ids['alpha-one-employee'] in [p['id'] for p in ok('GET','/me/reports',who='alpha-head')['items']]
  assert ids['alpha-one-employee'] in [p['id'] for p in ok('GET','/me/reports',who='alpha-one-head')['items']]
  assert ok('GET','/me/reports',who='alpha-one-employee')['items']==[]
  assert call('GET','/work-logs?scope=visible&authorId='+ids['alpha-one-employee'],who='beta-one-head')[0]==404
  assert ok('GET','/tasks?assigneeId='+ids['alpha-one-employee'],who='beta-one-head')['items']==[]
  manifest={'base':f'http://127.0.0.1:{f.port}','identities':f.identities,'day':str(day),'normal':normal,'point':point,'cross':cross,'midnight':midnight,'other':other,'spanning':spanning,'overlaps':overlaps}
  subprocess.run(['node',str(BASE/'scripts/check_subordinate_workspace_browser.js')],env={**os.environ,'PANDORA_STAFF_FIXTURE':json.dumps(manifest)},check=True)
if __name__=='__main__':main()
