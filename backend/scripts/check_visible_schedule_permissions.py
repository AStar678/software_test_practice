#!/usr/bin/env python3
"""Real-service permissions for schedule-only edits; owns a disposable fixture database."""
import json,uuid
from fixed_model_fixture import Fixture,quote
from migration_precheck import BASE
OUT=BASE.parent/'output/visible-schedule'
def main():
 OUT.mkdir(parents=True,exist_ok=True);checks=[]
 def check(name,value):
  checks.append({'name':name,'pass':bool(value)});(OUT/'permissions.json').write_text(json.dumps({'checks':checks},indent=2));print(('PASS ' if value else 'FAIL ')+name);assert value,name
 f=Fixture(port=18212);f.log_path=OUT/'service.log'
 with f:
  tokens={k:f.login(k)[1]['token'] for k in f.identities};ids={k:p['id'] for k,p in f.identities.items()}
  def call(who,method,url,body=None,version=None):return f.call(method,url,body,tokens[who],uuid.uuid4().hex,version)
  def ok(who,method,url,body=None,version=None):
   code,row=call(who,method,url,body,version);assert code in (200,201),(code,row);return row
  def detail(task,who='founder'):return ok(who,'GET','/tasks/'+task)
  def create():return ok('founder','POST','/tasks',{'title':'可见任务仅调时','description':'其他资料必须保持','assigneeIds':[ids['alpha-one-employee']],'allDay':False,'startAt':'2030-12-31T01:20:00Z','dueAt':'2030-12-31T10:20:00Z'})['taskId']
  task=create();base=detail(task);body={'command':'reschedule','allDay':False,'startAt':'2030-12-31T02:20:00Z','dueAt':'2031-01-01T11:20:00Z','reason':'可见人调整'}
  check('visible assignee gets schedule permission',detail(task,'alpha-one-employee')['canReschedule'])
  check('visible-only manager gets schedule permission',detail(task,'alpha-one-head')['canReschedule'])
  for who in ['beta-one-head','other-founder','admin']:
   check('unrelated or admin cannot reschedule '+who,call(who,'PATCH','/tasks/'+task,body,base['rowVersion'])[0] in (403,404))
  for field,value in [('title','恶意改名'),('assigneeIds',[ids['alpha-one-head']]),('tagIds',[]),('progressNote','非法进展')]:
   check('schedule endpoint refuses '+field,call('alpha-one-head','PATCH','/tasks/'+task,{**body,field:value},base['rowVersion'])[0]==400)
  viewer_edit_code,_=call('alpha-one-head','PATCH','/tasks/'+task,{'command':'change','title':'越权','reason':'不允许'},base['rowVersion'])
  check('visible-only manager cannot edit ordinary metadata',viewer_edit_code in (403,409))
  owner_task=create();owner_base=detail(owner_task)
  owner_change=ok('alpha-one-employee','PATCH','/tasks/'+owner_task,{'command':'change','title':'负责人可改资料','reason':'负责人修改'},owner_base['rowVersion'])
  check('effective owner can propose ordinary metadata',owner_change['outcome']=='pending')
  check('stale reschedule is rejected',call('alpha-one-head','PATCH','/tasks/'+task,body,base['rowVersion']+1)[0]==412)
  preview=ok('alpha-one-head','POST','/tasks/reviewer-preview',{'taskId':task,'operation':'reschedule'})
  check('viewer preview routes to operator manager',preview['reviewerId']==ids['alpha-head'])
  change=ok('alpha-one-head','PATCH','/tasks/'+task,body,base['rowVersion']);pending=detail(task)
  check('viewer creates a normal pending review',change['outcome']=='pending' and pending['frozen'] and pending['dueAt']==base['dueAt'])
  check('frozen schedule permission removed',not pending['canReschedule'] and call('alpha-one-head','PATCH','/tasks/'+task,body,pending['rowVersion'])[0]==409)
  request=ok('alpha-head','GET','/approval-requests/'+change['requestId'])
  ok('alpha-head','PATCH','/approval-requests/'+change['requestId'],{'decision':'approve'},request['rowVersion']);after=detail(task)
  check('viewer schedule applies after correct approval',after['dueAt']==body['dueAt'] and not after['frozen'])
  check('schedule-only write preserves metadata and owners',all(after[k]==base[k] for k in ['title','description','priority','assigneeIds','tagIds','parentTaskId','executionState','progressNote','businessOwnerId']))
  # Losing the selected task's visibility before approval must prevent applying the proposal.
  lost=create();old=detail(lost);change=ok('alpha-one-head','PATCH','/tasks/'+lost,body,old['rowVersion'])
  f.db.server_side('UPDATE task_version_assignees SET user_id='+quote(ids['beta-one-employee'])+' WHERE version_id='+quote(old['currentVersionId']))
  check('viewer loses task visibility',call('alpha-one-head','GET','/tasks/'+lost)[0]==404)
  request=ok('alpha-head','GET','/approval-requests/'+change['requestId'])
  check('approval rechecks applicant authority',call('alpha-head','PATCH','/approval-requests/'+change['requestId'],{'decision':'approve'},request['rowVersion'])[0]==409)
  check('failed approval keeps effective schedule',detail(lost)['dueAt']==old['dueAt'])
  # Completed tasks retain their existing reopen boundary.
  done=create();old=detail(done);result=ok('alpha-one-employee','PATCH','/tasks/'+done,{'command':'complete','completionNote':'完成'},old['rowVersion']);request=ok('alpha-one-head','GET','/approval-requests/'+result['requestId']);ok('alpha-one-head','PATCH','/approval-requests/'+result['requestId'],{'decision':'approve'},request['rowVersion'])
  row=detail(done);check('completed tasks cannot reschedule',not row['canReschedule'] and call('founder','PATCH','/tasks/'+done,body,row['rowVersion'])[0]==409)
  # An unpublished create request never becomes a rescheduleable effective task.
  pending=ok('alpha-one-employee','POST','/tasks',{'title':'尚未发布','description':'不允许调时','assigneeIds':[ids['alpha-one-employee']],'allDay':False,'startAt':'2030-12-31T01:20:00Z','dueAt':'2030-12-31T10:20:00Z'})
  row=detail(pending['taskId'],'alpha-one-employee');check('unpublished tasks do not grant schedule permission',not row.get('canReschedule',False) and call('alpha-one-employee','PATCH','/tasks/'+pending['taskId'],body,row['rowVersion'])[0] in (403,409))
 print('TOTAL',len(checks))
if __name__=='__main__':main()
