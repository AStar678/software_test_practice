#!/usr/bin/env python3
"""Fixed-scope tags/comments/notification lifecycle and historical access through real APIs/worker."""
import datetime as dt
import json
import uuid
from fixed_model_fixture import Fixture,quote
from migration_precheck import BASE

OUTPUT=BASE.parent/'audit/refactor-pandora-organization-and-workflows/fixed-notifications.json'

def main():
 report={'updated':dt.datetime.now(dt.timezone.utc).isoformat(),'checks':[]}
 def check(name,condition,evidence=None):
  report['checks'].append({'check':name,'pass':bool(condition),'evidence':evidence});print(('PASS ' if condition else 'FAIL ')+name,flush=True)
  if not condition:raise AssertionError(name)
 fixture=Fixture(port=18196,worker=True,controllable=True);fixture.log_path=OUTPUT.with_name('fixed-notifications-service.log')
 try:
  with fixture as f:
   tokens={key:f.login(key)[1]['token'] for key in f.identities};ids={key:value['id'] for key,value in f.identities.items()}
   def call(method,path,body=None,who='founder',version=None,key=None):
    return f.call(method,path,body,tokens[who],key or 'notice-'+uuid.uuid4().hex,version)
   def ok(method,path,body=None,who='founder',version=None,key=None):
    status,result=call(method,path,body,who,version,key)
    if status not in (200,201):raise AssertionError((path,status,result))
    return result
   def worker():ok('POST','/admin/worker/run-once',{},'admin')
   def create(owners=('alpha-one-employee',),who='founder'):
    now=dt.datetime.now(dt.timezone.utc)
    result=ok('POST','/tasks',{'title':'Notification boundary fixture','description':'Effective private content','priority':'medium','allDay':False,
       'assigneeIds':[ids[x] for x in owners],'startAt':(now-dt.timedelta(hours=1)).isoformat(),'dueAt':(now+dt.timedelta(days=7)).isoformat()},who)
    if result['outcome']=='pending':
     request=ok('GET','/approval-requests/'+result['requestId'],who='alpha-one-head')
     ok('PATCH','/approval-requests/'+result['requestId'],{'decision':'approve'},'alpha-one-head',request['rowVersion'])
    return result['taskId']
   def change(task,body,who='founder'):
    detail=ok('GET','/tasks/'+task,who=who);return ok('PATCH','/tasks/'+task,body,who,detail['rowVersion'])
   def notices(who):return ok('GET','/notifications?limit=100',who=who)['items']
   def comment_notice(comment,who):
    worker()
    rows=f.db.rows("SELECT n.id,n.event_id FROM notifications n JOIN domain_events e ON e.id=n.event_id WHERE n.recipient_id="+quote(ids[who])+" AND JSON_UNQUOTE(JSON_EXTRACT(e.details_json,'$.commentId'))="+quote(comment))
    check('new comment delivers exactly one copy to the targeted recipient',len(rows)==1)
    return rows[0]
   def redacted(notice,who):
    status,value=call('GET','/notifications/'+notice,who=who)
    return status==200 and not value.get('canOpenTask') and not value.get('canReview') and all(value.get(k) is None for k in ('taskId','requestId','objectId','objectType','commentId','changeSummary','title'))
   # Tags are maintained by the explicitly fixed founder only, independent of management title.
   tag=ok('POST','/tags',{'name':'共享重点','color':'#F6D5D2'})['tagId']
   for who in ('alpha-head','alpha-one-head','alpha-one-employee','admin','other-founder'):
    check(who+' cannot maintain another company/founder tag',call('PATCH','/tags/'+tag,{'name':'unauthorized','color':'#D8EAF4'},who,1)[0] in (403,404))
   task=create()
   change(task,{'command':'change','tagId':tag,'reason':'Tag uses normal business owner rule'})
   check('task tag changes directly when applicant is current business owner',ok('GET','/tasks/'+task)['tag']['name']=='共享重点')
   check('multiple task tags are refused',call('PATCH','/tasks/'+task,{'command':'change','tagIds':[tag,tag],'reason':'reject'},version=ok('GET','/tasks/'+task)['rowVersion'])[0]==400)
   ok('PATCH','/tags/'+tag,{'name':'已改名','color':'#D8EAF4'},version=1)
   check('catalog rename/recolor updates current task reference',ok('GET','/tasks/'+task)['tag']['name']=='已改名')
   ok('DELETE','/tags/'+tag,version=2)
   check('logical tag deletion preserves referenced name/color snapshot',ok('GET','/tasks/'+task)['tag'].get('deleted') is True)
   check('deleted tag is absent from selection catalogue',tag not in [row['id'] for row in ok('GET','/tags')['items']])
   # Ordinary delivered task notifications keep their distinct historical-only exception.
   worker();ordinary=next(row for row in notices('alpha-one-employee') if row.get('taskId')==task and row['eventType']!='comment.created')
   body='Secret comment must disappear after revocation'
   posted=ok('POST','/tasks/'+task+'/comments',{'body':body})
   notice,event=comment_notice(posted['commentId'],'alpha-one-employee')
   check('comment does not notify its author',f.db.scalar('SELECT COUNT(*) FROM notifications WHERE event_id='+quote(event)+' AND recipient_id='+quote(ids['founder']))==0)
   check('notification exposes current valid comment and its purpose',body in json.dumps(ok('GET','/notifications/'+notice,who='alpha-one-employee')))
   check('comment hierarchy is rejected',call('POST','/tasks/'+task+'/comments',{'body':'nested','parentId':posted['commentId']})[0]==400)
   check('non-author cannot edit a comment',call('PATCH','/comments/'+posted['commentId'],{'body':'forged'},'alpha-one-employee',1)[0]==403)
   change(task,{'command':'change','assigneeIds':[ids['beta-one-employee']],'reason':'revoke old relation'});worker()
   check('normal task detail refuses removed employee',call('GET','/tasks/'+task,who='alpha-one-employee')[0]==404)
   check('removed employee loses comment reads/writes despite delivered task history',call('GET','/tasks/'+task+'/comments',who='alpha-one-employee')[0]==404 and call('POST','/tasks/'+task+'/comments',{'body':'cannot write'},'alpha-one-employee')[0]==404)
   check('comment notification detail masks body and every jump after object revocation',redacted(notice,'alpha-one-employee') and body not in json.dumps(notices('alpha-one-employee')))
   check('comment notification cannot grant historical task access',call('GET','/notifications/'+notice+'/task',who='alpha-one-employee')[0]==404)
   delivered=ok('GET','/notifications/'+ordinary['id'],who='alpha-one-employee')
   check('ordinary previously delivered notification marks later authority loss for the UI',delivered.get('readonly') is True and delivered.get('relationLost') is True and delivered.get('canOpenTask') is True)
   historical=ok('GET','/notifications/'+ordinary['id']+'/task',who='alpha-one-employee')
   check('ordinary task notification still opens only current effective read-only data',historical.get('readonly') is True and historical.get('accessRevoked') is True and historical.get('historical') is True and not any(key in historical for key in ('diff','proposedVersion','phone','email','pendingRequest')))
   check('historical-only task remains excluded from normal task list',task not in [row['id'] for row in ok('GET','/tasks',who='alpha-one-employee')['items']])
   for kind in ('deleted','missing'):
    t=create();c=ok('POST','/tasks/'+t+'/comments',{'body':'Deleted secret '+kind});n,e=comment_notice(c['commentId'],'alpha-one-employee')
    if kind=='deleted':ok('DELETE','/comments/'+c['commentId'],version=1)
    else:f.db.server_side('DELETE FROM task_log_comments WHERE id='+quote(c['commentId']))
    check(kind+' comment notification hides old excerpt/jumps while object is otherwise visible',redacted(n,'alpha-one-employee'))
    check(kind+' comment never grants a notification historical entry',call('GET','/notifications/'+n+'/task',who='alpha-one-employee')[0]==404)
   # A withdrawn comment may be read by the actual manager only while its comment/object remain valid.
   t=create(('alpha-one-employee','alpha-one-head'));c=ok('POST','/tasks/'+t+'/comments',{'body':'Manager-only retained comment'},'alpha-one-employee');n,e=comment_notice(c['commentId'],'alpha-one-head')
   # Withdrawal uses a copy owned by the receiver for lookup; the administrator may revoke the event.
   ok('POST','/admin/notifications/'+e+'/withdraw',{'reason':'withdraw test'},'admin')
   retained=ok('GET','/notifications/'+n,who='alpha-one-head')
   check('withdrawn summary exception is limited to actual manager and has no jumps',retained.get('canReadWithdrawnDetails') is True and not retained.get('canOpenTask') and not retained.get('canReview'))
   ok('DELETE','/comments/'+c['commentId'],who='alpha-one-employee',version=1)
   check('manager withdrawn exception cannot revive a deleted comment',redacted(n,'alpha-one-head'))
   # Stable paging, edit without new delivery, comments on frozen business objects and frozen logs.
   t=create(('alpha-one-employee',));before=ok('GET','/tasks/'+t)
   pending=change(t,{'command':'progress','progressNote':'Pending business progress'},'alpha-one-employee')
   check('progress uses current business owner review',pending.get('outcome')=='pending')
   c=ok('POST','/tasks/'+t+'/comments',{'body':'Independent while pending'},'alpha-one-employee');worker()
   event_count=f.db.scalar("SELECT COUNT(*) FROM domain_events WHERE event_type='comment.created'")
   ok('PATCH','/comments/'+c['commentId'],{'body':'Edited independently'},'alpha-one-employee',1)
   check('comment edit neither changes pending business version nor emits another notification',ok('GET','/tasks/'+t)['currentVersionId']==before['currentVersionId'] and f.db.scalar("SELECT COUNT(*) FROM domain_events WHERE event_type='comment.created'")==event_count)
   paged=create()
   published=[ok('POST','/tasks/'+paged+'/comments',{'body':'Publication '+str(i)})['commentId'] for i in range(23)]
   first=ok('GET','/tasks/'+paged+'/comments?limit=10')
   ok('DELETE','/comments/'+published[0],version=1)
   ok('DELETE','/comments/'+first['nextCursor'],version=1)
   ok('PATCH','/comments/'+published[12],{'body':'Edited without moving'},version=1)
   second=ok('GET','/tasks/'+paged+'/comments?limit=10&cursor='+first['nextCursor'])
   third=ok('GET','/tasks/'+paged+'/comments?limit=10&cursor='+second['nextCursor'])
   check('immutable publication cursor survives deleted first row/anchor and an edited unseen row',
         [row['id'] for row in second['items']+third['items']]==published[10:]
         and any(row.get('edited') for row in second['items']))
   business_day=dt.datetime.fromisoformat(ok('GET','/admin/clock',who='admin')['now'].replace('Z','+00:00')).astimezone(dt.timezone(dt.timedelta(hours=8))).date()
   log=ok('POST','/work-logs',{'body':'Frozen original log','businessDate':str(business_day)},'alpha-one-employee')['logId']
   lc=ok('POST','/work-logs/'+log+'/comments',{'body':'Manager comment on subordinate log'},'alpha-one-head')
   ln,le=comment_notice(lc['commentId'],'alpha-one-employee')
   recipients=f.db.rows('SELECT recipient_id FROM notifications WHERE event_id='+quote(le))
   check('log comment targets only its author, without broad management delivery',recipients==[[ids['alpha-one-employee']]])
   ok('POST','/admin/clock/advance',{'seconds':25*3600},'admin')
   frozen=ok('GET','/work-logs/'+log,who='alpha-one-employee')
   check('log body freezes at its first creation window',frozen['frozen'] and not frozen['editable'] and call('PATCH','/work-logs/'+log,{'body':'Forbidden edit'},'alpha-one-employee',frozen['rowVersion'])[0]==409)
   ok('PATCH','/comments/'+lc['commentId'],{'body':'Editable after log freeze'},'alpha-one-head',1)
   newer=ok('POST','/work-logs/'+log+'/comments',{'body':'Author can still discuss frozen log'},'alpha-one-employee')
   check('frozen log comments stay independent of body/version/freeze and support author control',
         ok('GET','/work-logs/'+log,who='alpha-one-employee')['rowVersion']==frozen['rowVersion']
         and len(ok('GET','/work-logs/'+log+'/comments',who='alpha-one-head')['items'])==2)
   ok('DELETE','/comments/'+newer['commentId'],who='alpha-one-employee',version=1)
   # Notification open-as-read, individual hide and strict withdrawal/retention boundaries.
   live=next(row for row in notices('alpha-one-employee') if row.get('canOpenTask'))
   ok('POST','/notifications/'+live['id']+'/open',{},'alpha-one-employee')
   check('opening notification persists read time',ok('GET','/notifications/'+live['id'],who='alpha-one-employee').get('readAt') is not None)
   v=ok('GET','/notifications/'+ordinary['id'],who='alpha-one-employee')['rowVersion']
   ok('PATCH','/notifications/'+ordinary['id'],{'action':'hide'},'alpha-one-employee',v)
   check('personal hide ends ordinary historical task exception',call('GET','/notifications/'+ordinary['id']+'/task',who='alpha-one-employee')[0]==404)
   for age,expected in ((179,200),(180,409)):
    t=create();worker();n=next(row for row in notices('alpha-one-employee') if row.get('taskId')==t)
    now=ok('GET','/admin/clock',who='admin')['now'];occurred=dt.datetime.fromisoformat(now.replace('Z','+00:00'))-dt.timedelta(seconds=age)
    f.db.server_side('UPDATE domain_events SET occurred_at='+quote(occurred.replace(tzinfo=None).isoformat(sep=' '))+' WHERE id='+quote(n['eventId']))
    status,value=call('POST','/admin/notifications/'+n['eventId']+'/withdraw',{'reason':'withdraw boundary'},'admin')
    check('withdrawal at '+str(age)+' seconds follows strict 180-second rule',status==expected,{'status':status,'code':value.get('code')})
   t=create();worker();n=next(row for row in notices('alpha-one-employee') if row.get('taskId')==t)
   source=f.db.scalar('SELECT COUNT(*) FROM task_history_entries WHERE task_id='+quote(t))
   f.db.server_side('UPDATE notifications SET expires_at=UTC_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE id='+quote(n['id']))
   check('expired notification cannot be read or grant historical entry',call('GET','/notifications/'+n['id'],who='alpha-one-employee')[0]==404 and call('GET','/notifications/'+n['id']+'/task',who='alpha-one-employee')[0]==404)
   worker();check('notification cleanup leaves business history intact',f.db.scalar('SELECT COUNT(*) FROM task_history_entries WHERE task_id='+quote(t))==source)
   report['result']='PASS'
 except Exception as error:report['result']='FAIL';report['errorType']=type(error).__name__;raise
 finally:OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
