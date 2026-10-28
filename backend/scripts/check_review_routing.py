#!/usr/bin/env python3
"""Current fixed-position routing and direct-application checks in a disposable real JAR/MySQL fixture."""
import datetime as dt
import json
import uuid
from fixed_model_fixture import Fixture, quote
from migration_precheck import BASE

OUTPUT=BASE.parent/'audit/refactor-pandora-organization-and-workflows/review-routing.json'

def main():
    report={'updated':dt.datetime.now(dt.timezone.utc).isoformat(),'checks':[]}
    def check(name,condition,evidence=None):
        report['checks'].append({'check':name,'pass':bool(condition),'evidence':evidence})
        print(('PASS ' if condition else 'FAIL ')+name,flush=True)
        if not condition: raise AssertionError(name)
    fixture=Fixture(port=18177);fixture.log_path=OUTPUT.with_name('review-service.log')
    try:
        with fixture as f:
            tokens={key:f.login(key)[1]['token'] for key in f.identities}
            ids={key:value['id'] for key,value in f.identities.items()}
            def call(method,path,body=None,who='founder',version=None):
                return f.call(method,path,body,tokens[who],'review-'+uuid.uuid4().hex,version)
            def preview(who,owners,operation='create',task=None):
                body={'operation':operation,'assigneeIds':[ids[x] for x in owners]}
                if task: body['taskId']=task
                return call('POST','/tasks/reviewer-preview',body,who)
            def form(owners):
                now=dt.datetime.now(dt.timezone.utc)
                return {'title':'Fixed review fixture','description':'Real operation','priority':'medium','allDay':False,
                        'assigneeIds':[ids[x] for x in owners],'startAt':(now-dt.timedelta(hours=1)).isoformat(),
                        'dueAt':(now+dt.timedelta(days=2)).isoformat()}
            def create(who,owners):
                status,result=call('POST','/tasks',form(owners),who)
                check('create '+who+' submits a real task',status==201,{'status':status,'code':result.get('code')})
                return result
            def detail(task,who='founder'): return call('GET','/tasks/'+task,who=who)[1]
            def decide(request,who,decision='approve'):
                status,request_view=call('GET','/approval-requests/'+request,who=who)
                check('current participant reads request '+decision,status==200,{'status':status})
                return call('PATCH','/approval-requests/'+request,{'decision':decision,'comment':'Test decision'},who,request_view['rowVersion'])
            def change(task,who,body,expected='direct'):
                version=detail(task,who)['rowVersion']
                status,result=call('PATCH','/tasks/'+task,body,who,version)
                check(who+' '+body['command']+' has expected outcome '+expected,status==200 and result.get('outcome')==expected,{'status':status,'code':result.get('code'),'outcome':result.get('outcome')})
                return result
            for who,manager in (('alpha-head','founder'),('alpha-one-head','alpha-head'),('alpha-one-employee','alpha-one-head')):
                for owners in (['beta-one-employee','alpha-one-employee'],['alpha-one-employee','beta-one-employee']):
                    status,result=preview(who,owners)
                    check(who+' creation routes to direct manager regardless of owner order',status==200 and result['reviewerId']==ids[manager] and result['requiresApproval'] is True)
            status,result=preview('founder',['beta-one-employee'])
            check('only explicit fixed founder creation is directly applied',status==200 and result['requiresApproval'] is False and result['route']['reason']=='founder-exempt')
            f.db.server_side('UPDATE users SET reviewer_available=0 WHERE id='+quote(ids['alpha-one-head']))
            status,result=preview('alpha-one-employee',['beta-one-employee'])
            check('unavailable direct manager blocks creation without escalation or exemption',status==200 and result['blocked'] is True and result['requiresApproval'] is False)
            f.db.server_side('UPDATE users SET reviewer_available=1 WHERE id='+quote(ids['alpha-one-head']))
            for candidate in ('admin','other-founder'):
                status,_=preview('alpha-one-employee',[candidate])
                check(candidate+' is not an employee assignee candidate',status==400)
            pending=create('alpha-one-employee',['beta-one-employee'])
            check('employee creation remains unpublished and pending',pending['outcome']=='pending' and detail(pending['taskId'],'alpha-one-employee')['published'] is False)
            check('unpublished assignee and founder cannot read pending creation',call('GET','/tasks/'+pending['taskId'],who='beta-one-employee')[0]==404 and call('GET','/tasks/'+pending['taskId'])[0]==404)
            check('creation applicant receives no comparison snapshot', 'diff' not in call('GET','/approval-requests/'+pending['requestId'],who='alpha-one-employee')[1])
            check('creation reviewer has comparison snapshot', 'diff' in call('GET','/approval-requests/'+pending['requestId'],who='alpha-one-head')[1])
            check('direct manager approves creation',decide(pending['requestId'],'alpha-one-head')[0]==200)
            task=pending['taskId']
            for owners in (['beta-one-employee','alpha-two-employee'],['alpha-two-employee','beta-one-employee']):
                status,result=preview('alpha-one-employee',owners,'change',task)
                check('non-creation routes solely to current business owner with self direct application',status==200 and result['reviewerId']==ids['alpha-one-employee'] and result['requiresApproval'] is False and result['route']['reason']=='self-reviewer')
            check('viewing authority does not grant basic edit preview',preview('founder',['beta-one-employee'],'change',task)[0]==409)
            changed=change(task,'alpha-one-employee',{'command':'change','title':'Owner changed cross department','reason':'Current owner maintenance','assigneeIds':[ids['beta-one-employee'],ids['alpha-two-employee']]})
            check('direct change is not left pending',f.db.scalar('SELECT COUNT(*) FROM approval_requests WHERE task_id='+quote(task)+" AND status='pending'")==0)
            current=detail(task,'alpha-one-employee')['rowVersion']
            status,_=call('PATCH','/tasks/'+task,{'command':'change','title':'Stale overwrite','reason':'stale'},'alpha-one-employee',current-1)
            check('self direct apply cannot bypass task version',status==412)
            status,_=call('PATCH','/tasks/'+task,{'command':'change','assigneeIds':[],'reason':'empty'},'alpha-one-employee',current)
            check('self direct apply cannot remove every assignee',status==400)
            status,_=call('PATCH','/tasks/'+task,{'command':'progress','progressNote':'Creator is not assignee'},'alpha-one-employee',current)
            check('business owner is not automatically entitled to submit progress',status==403)
            check('direct history records actual applicant and exemption reason',f.db.scalar('SELECT COUNT(*) FROM approval_requests WHERE id='+quote(changed['requestId'])+" AND status='direct' AND decided_by=applicant_id AND exemption_reason IS NOT NULL")==1)
            progress=change(task,'beta-one-employee',{'command':'progress','progressNote':'Progress requires current owner review'},'pending')
            check('pending progress keeps old effective content',detail(task,'beta-one-employee')['progressNote']=='')
            status,_=call('PATCH','/tasks/'+task,{'command':'change','title':'Frozen overwrite','reason':'frozen'},'alpha-one-employee',detail(task,'alpha-one-employee')['rowVersion'])
            check('self direct apply cannot bypass unique pending freeze',status==409)
            check('unrelated scope viewer cannot obtain proposal',call('GET','/approval-requests/'+progress['requestId'])[0]==404)
            check('current business owner approves cross-department progress',decide(progress['requestId'],'alpha-one-employee')[0]==200)
            check('approved progress becomes effective',detail(task,'beta-one-employee')['progressNote']=='Progress requires current owner review')
            completed=change(task,'beta-one-employee',{'command':'complete','completionNote':'Ready'},'pending')
            check('business owner approves completion',decide(completed['requestId'],'alpha-one-employee')[0]==200 and detail(task,'alpha-one-employee')['executionState']=='done')
            status,_=call('PATCH','/tasks/'+task,{'command':'reopen','reason':'Missing schedule'},'alpha-one-employee',detail(task,'alpha-one-employee')['rowVersion'])
            check('self reopen requires a complete explicit schedule',status==400)
            reopened=change(task,'alpha-one-employee',{'command':'reopen','reason':'New execution round',**{k:v for k,v in form([]).items() if k in ('allDay','startAt','dueAt')}})
            check('self reopen publishes doing state and advances round',detail(task,'alpha-one-employee')['executionState']=='doing' and detail(task,'alpha-one-employee')['executionRound']==2)
            own=create('founder',['founder'])
            change(own['taskId'],'founder',{'command':'progress','progressNote':'Self progress'})
            change(own['taskId'],'founder',{'command':'complete','completionNote':'Self complete'})
            check('self operations cannot be approved again',decide(own['requestId'],'founder')[0]==409)
            # Dedicated handover remains narrower than ordinary assignee editing.
            target=create('founder',['alpha-one-employee'])
            for who in ('founder','alpha-head'):
                status,_=call('POST','/tasks/'+target['taskId']+'/handover',{'sourceUserId':ids['alpha-one-employee'],'targetUserId':ids['alpha-two-employee']},who,detail(target['taskId'],who)['rowVersion'])
                check(who+' cannot delegate handover for an indirect report',status==403)
            status,_=call('POST','/tasks/'+target['taskId']+'/handover',{'sourceUserId':ids['alpha-one-employee'],'targetUserId':ids['beta-one-employee']},'alpha-one-head',detail(target['taskId'],'alpha-one-head')['rowVersion'])
            check('direct manager cannot use company-wide edit scope for dedicated handover',status==400)
            status,handed=call('POST','/tasks/'+target['taskId']+'/handover',{'sourceUserId':ids['alpha-one-employee'],'targetUserId':ids['alpha-two-employee']},'alpha-one-head',detail(target['taskId'],'alpha-one-head')['rowVersion'])
            check('direct manager handover awaits business owner approval',status==200 and handed['outcome']=='pending')
            check('business owner approves dedicated handover',decide(handed['requestId'],'founder')[0]==200 and detail(target['taskId'])['assigneeIds']==[ids['alpha-two-employee']])
            report['result']='PASS'
    except BaseException as error:
        report['result']='FAIL';report['errorType']=type(error).__name__;raise
    finally:
        OUTPUT.parent.mkdir(parents=True,exist_ok=True);OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__': main()
