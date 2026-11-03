#!/usr/bin/env python3
"""Owned real-service checks for inbox entries, personnel and subordinate return context."""
import datetime as dt,json,os,subprocess,uuid
from fixed_model_fixture import Fixture,quote
from migration_precheck import BASE
OUT=BASE.parent/'output/notification-personnel'
def main():
 OUT.mkdir(parents=True,exist_ok=True);report={'checks':[]}
 def check(name,value):
  report['checks'].append({'name':name,'pass':bool(value)});print(('PASS ' if value else 'FAIL ')+name,flush=True)
  assert value,name
 f=Fixture(port=18215,worker=True,controllable=True);f.log_path=OUT/'service.log'
 try:
  with f:
   tokens={key:f.login(key)[1]['token'] for key in f.identities};ids={key:value['id'] for key,value in f.identities.items()}
   def call(method,path,body=None,who='founder',version=None):return f.call(method,path,body,tokens[who],uuid.uuid4().hex,version)
   def ok(method,path,body=None,who='founder',version=None):
    status,result=call(method,path,body,who,version);assert status in (200,201),(path,status,result);return result
   def now():return dt.datetime.fromisoformat(ok('GET','/admin/clock',who='admin')['now'].replace('Z','+00:00'))
   def worker():ok('POST','/admin/worker/run-once',{},'admin')
   def create(title,owners,who='founder',start=None,end=None):
    start=start or (now()+dt.timedelta(days=3)).replace(hour=1,minute=0,second=0,microsecond=0)
    end=end or start+dt.timedelta(hours=8)
    result=ok('POST','/tasks',{'title':title,'description':'浏览器回归资料','priority':'medium','allDay':False,'startAt':start.isoformat(),'dueAt':end.isoformat(),'assigneeIds':[ids[x] for x in owners]},who)
    if result['outcome']=='pending':
     req=ok('GET','/approval-requests/'+result['requestId'],who='alpha-one-head')
     ok('PATCH','/approval-requests/'+result['requestId'],{'decision':'approve'},'alpha-one-head',req['rowVersion'])
    return result['taskId']
   # Exercise the actual scheduler's four event names, not synthetic list rows.
   start=now();reminder=create('四节点提醒任务',['alpha-one-employee'],start=start,end=start+dt.timedelta(seconds=10000))
   for seconds in (8001,1000,500,500):ok('POST','/admin/clock/advance',{'seconds':seconds},'admin');worker()
   notices=ok('GET','/notifications?category=reminder&limit=100',who='alpha-one-employee')
   expected={'task.reminder_20','task.reminder_10','task.reminder_5','task.overdue'}
   reminder_rows=[n for n in notices['items'] if n.get('taskId')==reminder]
   check('real scheduler reminders all classified and counted',len(reminder_rows)==4 and {n['eventType'] for n in reminder_rows}==expected and notices['total']==4)
   for n in reminder_rows:
    detail=ok('GET','/notifications/'+n['id'],who='alpha-one-employee')
    check(n['eventType']+' list detail purpose agree',detail==n and n['category']=='reminder' and n['purpose'] in ('临期提醒','逾期提醒'))
   task=create('原申请结果任务',['alpha-one-employee','alpha-two-employee'])
   raw=ok('GET','/tasks/'+task,who='alpha-one-employee')
   result=ok('PATCH','/tasks/'+task,{'command':'progress','progressNote':'第一份申请说明'},'alpha-one-employee',raw['rowVersion'])
   request_id=result['requestId'];request=ok('GET','/approval-requests/'+request_id,who='alpha-one-head')
   ok('PATCH','/approval-requests/'+request_id,{'decision':'approve'},'alpha-one-head',request['rowVersion']);worker()
   bound={}
   for who,allowed in [('alpha-one-employee',True),('alpha-one-head',True),('alpha-two-employee',False),('founder',False)]:
    n=next(n for n in ok('GET','/notifications?limit=100',who=who)['items'] if n.get('requestId')==request_id and n['eventType']=='task.progress.approved')
    bound[who]=n['id'];check(who+' original request capability matches detail access',n['canOpenRequest']==allowed and not n['canReview'] and call('GET','/approval-requests/'+request_id,who=who)[0]==(200 if allowed else 404))
    check(who+' retains correct result summary',n['requestStatus']=='approved' and n['requestKind']=='progress' and bool(n['summary']))
   check('unrelated company cannot read notification or request',call('GET','/notifications/'+bound['alpha-one-employee'],who='other-founder')[0]==404 and call('GET','/approval-requests/'+request_id,who='other-founder')[0]==404)
   raw=ok('GET','/tasks/'+task,who='alpha-one-employee')
   later=ok('PATCH','/tasks/'+task,{'command':'progress','progressNote':'第二份申请仍待审'},'alpha-one-employee',raw['rowVersion'])
   old=ok('GET','/notifications/'+bound['alpha-one-employee'],who='alpha-one-employee')
   check('old notification stays bound when new request pending',old['requestId']==request_id and old['requestStatus']=='approved' and not old['canReview'] and later['requestId']!=request_id)
   rejected_task=create('退回意见结果任务',['alpha-one-employee','alpha-two-employee'])
   raw=ok('GET','/tasks/'+rejected_task,who='alpha-one-employee')
   rejected=ok('PATCH','/tasks/'+rejected_task,{'command':'progress','progressNote':'应补充的进展'},'alpha-one-employee',raw['rowVersion'])
   rejected_request=ok('GET','/approval-requests/'+rejected['requestId'],who='alpha-one-head')
   ok('PATCH','/approval-requests/'+rejected['requestId'],{'decision':'reject','comment':'请补充验收材料再提交'},'alpha-one-head',rejected_request['rowVersion']);worker()
   rejected_notice=next(n for n in ok('GET','/notifications?limit=100',who='alpha-two-employee')['items'] if n.get('requestId')==rejected['requestId'] and n['eventType']=='task.progress.rejected')
   check('ordinary result retains original rejection opinion without request access',rejected_notice['requestStatus']=='rejected' and rejected_notice['requestComment']=='请补充验收材料再提交' and not rejected_notice['canOpenRequest'] and call('GET','/approval-requests/'+rejected['requestId'],who='alpha-two-employee')[0]==404)
   # Another co-owner loses normal object access; only lawful historical summary remains.
   historical=create('已失权结果任务',['alpha-one-employee','alpha-two-employee'])
   raw=ok('GET','/tasks/'+historical,who='alpha-one-employee')
   r=ok('PATCH','/tasks/'+historical,{'command':'progress','progressNote':'历史进展'},'alpha-one-employee',raw['rowVersion'])
   v=ok('GET','/approval-requests/'+r['requestId'],who='alpha-one-head')
   ok('PATCH','/approval-requests/'+r['requestId'],{'decision':'approve'},'alpha-one-head',v['rowVersion']);worker()
   lost=next(n for n in ok('GET','/notifications?limit=100',who='alpha-two-employee')['items'] if n.get('requestId')==r['requestId'] and n['eventType']=='task.progress.approved')
   raw=ok('GET','/tasks/'+historical);ok('PATCH','/tasks/'+historical,{'command':'change','assigneeIds':[ids['alpha-one-employee']],'reason':'撤销测试关系'},version=raw['rowVersion'])
   lost=ok('GET','/notifications/'+lost['id'],who='alpha-two-employee')
   check('lost recipient keeps only lawful historical access',lost['relationLost'] and lost['readonly'] and not lost['canOpenRequest'] and not lost['canReview'] and call('GET','/tasks/'+historical,who='alpha-two-employee')[0]==404)
   # A new result event can still be withdrawn inside its own 180-second window.
   withdrawn=create('撤回结果通知',['alpha-one-employee'])
   worker();wn=next(n for n in ok('GET','/notifications?limit=100',who='founder')['items'] if n.get('taskId')==withdrawn and n.get('canOpenRequest'))
   ok('POST','/admin/notifications/'+wn['eventId']+'/withdraw',{'reason':'专项撤回检查'},'admin')
   check('withdrawn result has no original request jump',not ok('GET','/notifications/'+wn['id'])['canOpenRequest'])
   # Long calendar spanning several weeks allows scroll restoration to be exercised.
   day=(now()+dt.timedelta(days=4)).astimezone(dt.timezone(dt.timedelta(hours=8))).date()
   begin=dt.datetime.combine(day,dt.time(9),dt.timezone(dt.timedelta(hours=8)))
   staff_task=create('下属日程返回测试',['alpha-one-employee'],start=begin,end=begin+dt.timedelta(days=19,hours=8))
   own_task=create('本人月历置顶任务',['founder'],start=begin,end=begin+dt.timedelta(hours=8))
   personal=ok('POST','/work-logs',{'businessDate':ok('GET','/home')['businessDate'],'body':'本人日志可编辑测试'})['logId']
   employee_log=ok('POST','/work-logs',{'businessDate':ok('GET','/home',who='alpha-one-employee')['businessDate'],'body':'下属日志只读测试'},'alpha-one-employee')['logId']
   frozen=ok('POST','/work-logs',{'businessDate':str(dt.date.fromisoformat(ok('GET','/home')['businessDate'])-dt.timedelta(days=1)),'body':'冻结日志测试'})['logId']
   f.db.server_side('UPDATE work_logs SET created_at=UTC_TIMESTAMP(6)-INTERVAL 2 DAY WHERE id='+quote(frozen))
   manifest={'base':f'http://127.0.0.1:{f.port}','identities':f.identities,'day':str(day),'staffTask':staff_task,'ownTask':own_task,'resultTask':task,'requestId':request_id,'laterRequestId':later['requestId'],'notices':bound,'rejectedNotice':rejected_notice['id'],'lostNotice':lost['id'],'withdrawnNotice':wn['id'],'personalLog':personal,'staffLog':employee_log,'frozenLog':frozen}
   subprocess.run(['node',str(BASE/'scripts/check_notification_personnel_browser.js')],env={**os.environ,'PANDORA_NOTIFICATION_PERSONNEL_FIXTURE':json.dumps(manifest)},check=True)
   report['result']='PASS'
 except Exception as e:report['result']='FAIL';report['errorType']=type(e).__name__;raise
 finally:(OUT/'api-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
