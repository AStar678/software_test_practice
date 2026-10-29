#!/usr/bin/env python3
"""Real business takeover/deactivation/continued work, in an owned disposable MySQL/JAR fixture."""
import concurrent.futures
import copy
import datetime as dt
import json
import uuid
from fixed_model_fixture import Fixture, quote
from migration_precheck import BASE

OUTPUT=BASE.parent/'audit/refactor-pandora-organization-and-workflows/business-takeover.json'

def main():
    report={'updated':dt.datetime.now(dt.timezone.utc).isoformat(),'checks':[]}
    def check(name,condition,evidence=None):
        report['checks'].append({'check':name,'pass':bool(condition),'evidence':evidence})
        print(('PASS ' if condition else 'FAIL ')+name,flush=True)
        if not condition: raise AssertionError(name)
    fixture=Fixture(port=18180);fixture.log_path=OUTPUT.with_name('takeover-service.log')
    try:
        with fixture as f:
            ids={key:value['id'] for key,value in f.identities.items()}
            tokens={key:f.login(key)[1]['token'] for key in f.identities}
            def call(method,path,body=None,who='admin',version=None,key=None):
                return f.call(method,path,body,tokens[who],key or 'takeover-'+uuid.uuid4().hex,version)
            def detail(task,who='founder'): return call('GET','/tasks/'+task,who=who)[1]
            def form(owners):
                now=dt.datetime.now(dt.timezone.utc)
                return {'title':'Takeover fixture','description':'Real continued work','priority':'medium','allDay':False,
                        'startAt':(now-dt.timedelta(hours=1)).isoformat(),'dueAt':(now+dt.timedelta(days=2)).isoformat(),
                        'assigneeIds':[ids[key] for key in owners]}
            def decide(request,who,decision='approve'):
                status,view=call('GET','/approval-requests/'+request,who=who)
                check('qualified participant reads '+decision,status==200,{'status':status,'code':view.get('code')})
                return call('PATCH','/approval-requests/'+request,{'decision':decision,'comment':'Business decision'},who,view['rowVersion'])
            def create(who,owners,approve=True):
                status,result=call('POST','/tasks',form(owners),who)
                check('create real task for '+who,status==201,{'status':status,'code':result.get('code')})
                if approve and result['outcome']=='pending':
                    manager={'alpha-one-employee':'alpha-one-head','alpha-one-head':'alpha-head'}[who]
                    check('creation follows direct manager decision',decide(result['requestId'],manager)[0]==200)
                return result
            def command(task,who,body): return call('PATCH','/tasks/'+task,body,who,detail(task,who)['rowVersion'])
            def inventory(who):
                status,result=call('GET','/admin/employees/'+ids[who]+'/responsibilities')
                check('admin reads minimal responsibility inventory',status==200)
                return result
            def arrangement(task,old,new):
                inv=inventory(old)
                item=next(row for row in inv['businessTasks'] if row['id']==task)
                return {'taskId':task,'taskVersion':item['rowVersion'],'ownerVersion':item['ownerVersion'],
                        'previousEmployeeId':ids[old],'nextEmployeeId':ids[new],'reason':'Formal responsibility takeover'}
            def transfer(item,version=None,key=None):
                if version is None: version=call('GET','/admin/organization-plans')[1]['rowVersion']
                return call('POST','/admin/business-takeovers',{'transfers':[item]},version=version,key=key)
            def plan(disabled=None,successor=None):
                draft=call('GET','/admin/organization-plans')[1]
                body={key:copy.deepcopy(draft[key]) for key in ('departments','teams','placements','expectedEmployees')}
                body['reason']='Final complete organization/deactivation plan'
                if disabled:
                    person=next(row for row in draft['expectedEmployees'] if row['id']==ids[disabled])
                    body['deactivateEmployees']=[{'employeeId':ids[disabled],'rowVersion':person['rowVersion'],'reason':'Prepared employee departure'}]
                    place=next(row for row in body['placements'] if row['employeeId']==ids[disabled])
                    body['placements']=[row for row in body['placements'] if row['employeeId']!=ids[disabled]]
                    if successor:
                        next_place=next(row for row in body['placements'] if row['employeeId']==ids[successor])
                        for field in ('placementType','departmentId','teamId'): next_place[field]=place[field]
                return draft['rowVersion'],body
            owner='alpha-one-employee';receiver='beta-one-employee'
            first=create(owner,[receiver])['taskId']
            provenance=f.db.rows('SELECT original_creator_id,created_at FROM tasks WHERE id='+quote(first))
            status,pending=command(first,receiver,{'command':'progress','progressNote':'Applicant becomes business reviewer'})
            check('non-owner progress begins pending',status==200 and pending['outcome']=='pending')
            item=arrangement(first,owner,receiver)
            for target in ('admin','other-founder'):
                invalid={**item,'nextEmployeeId':ids[target]}
                check('takeover rejects '+target+' target',transfer(invalid)[0]==400)
            check('takeover rejects changed task version',transfer({**item,'taskVersion':item['taskVersion']-1})[0]==412)
            check('takeover rejects changed owner version',transfer({**item,'ownerVersion':999})[0]==412)
            check('takeover rejects stale company version',transfer(item,0)[0]==412)
            check('employees cannot invoke administrative takeover',call('POST','/admin/business-takeovers',{'transfers':[item]},owner,1)[0]==403)
            status,receipt=transfer(item,key='takeover-direct-fixture')
            check('valid takeover directly applies qualified applicant becoming reviewer',status==200 and receipt['refreshedRequests']>=1,{'status':status,'code':receipt.get('code')})
            check('original creator and creation time remain stable',provenance==f.db.rows('SELECT original_creator_id,created_at FROM tasks WHERE id='+quote(first)))
            check('pending request has one direct terminal with original applicant decision',f.db.scalar('SELECT COUNT(*) FROM approval_requests WHERE id='+quote(pending['requestId'])+" AND status='direct' AND decided_by=applicant_id AND exemption_reason IS NOT NULL")==1)
            check('direct business event records applicant and administrative refresh separately',f.db.scalar('SELECT COUNT(*) FROM domain_events WHERE request_id='+quote(pending['requestId'])+" AND event_type='task.progress.direct' AND initiator_id="+quote(ids[receiver])+" AND JSON_UNQUOTE(JSON_EXTRACT(details_json,'$.refreshActorId'))="+quote(ids['admin']))==1)
            check('takeover applied progress exactly once',detail(first,receiver)['progressNote']=='Applicant becomes business reviewer')
            status,filtered=call('GET','/tasks?creatorId='+ids[receiver],who=receiver)
            check('taken-over work is absent from receiver original-created filter',status==200 and first not in [row['id'] for row in filtered['items']])
            check('old creator loses basic modification authority',command(first,owner,{'command':'change','title':'Unauthorized','reason':'Old creator'})[0]==403)
            check('receiver can continue base edits directly',command(first,receiver,{'command':'change','title':'Continued after takeover','reason':'New responsibility'})[0]==200)
            check('former idempotency success is not replayed after later responsibility mutation',transfer(item,key='takeover-direct-fixture')[0]==409)
            status,history=call('GET','/admin/tasks/'+first+'/history')
            check('management history resolves independent administrator and transfer provenance',status==200 and history.get('businessTransfers') and history['businessTransfers'][0]['administratorId']==ids['admin'])
            second=create(owner,[receiver])['taskId']
            status,pending2=command(second,receiver,{'command':'progress','progressNote':'Rerouted review'})
            old_view=call('GET','/approval-requests/'+pending2['requestId'],who=owner)[1]
            check('takeover to another employee reassigns active request',transfer(arrangement(second,owner,'beta-two-employee'))[0]==200)
            check('old reviewer cannot read old diff',call('GET','/approval-requests/'+pending2['requestId'],who=owner)[0]==404)
            check('old reviewer cannot decide from old page',call('PATCH','/approval-requests/'+pending2['requestId'],{'decision':'approve'},owner,old_view['rowVersion'])[0] in (404,412))
            check('new current business owner can approve',decide(pending2['requestId'],'beta-two-employee')[0]==200)
            expired=create(owner,[receiver])['taskId']
            _,expired_req=command(expired,receiver,{'command':'progress','progressNote':'Must never revive'})
            f.db.server_side('UPDATE approval_requests SET applicable_deadline=UTC_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE id='+quote(expired_req['requestId']))
            check('takeover completes after deadline scan',transfer(arrangement(expired,owner,receiver))[0]==200)
            check('expired applicant-becomes-reviewer request stays expired and ineffective',f.db.scalar('SELECT COUNT(*) FROM approval_requests WHERE id='+quote(expired_req['requestId'])+" AND status='expired'")==1 and detail(expired,receiver)['progressNote']=='')
            completed=create(owner,[owner])['taskId']
            check('self completion directly applies',command(completed,owner,{'command':'complete','completionNote':'Finished before departure'})[1]['outcome']=='direct')
            unfinished=create('founder',[owner])['taskId']
            unpublished=create(owner,['alpha-two-employee'],False)
            version,body=plan(owner)
            check('deactivation refuses unapproved unfinished assignment handover',call('POST','/admin/organization-plans',body,version=version)[1].get('code')=='UNFINISHED_HANDOVER_REQUIRED')
            status,handover=call('POST','/tasks/'+unfinished+'/handover',{'sourceUserId':ids[owner],'targetUserId':ids['alpha-two-employee']},owner,detail(unfinished,owner)['rowVersion'])
            check('departure handover awaits business approval',status==200 and handover['outcome']=='pending')
            check('pending handover does not satisfy final deactivation',call('POST','/admin/organization-plans',body,version=version)[1].get('code')=='UNFINISHED_HANDOVER_REQUIRED')
            check('business owner approves departure handover',decide(handover['requestId'],'founder')[0]==200)
            inv=inventory(owner)
            check('completed work remains in business responsibility inventory',completed in [row['id'] for row in inv['businessTasks']] and not inv['unfinishedAssignments'])
            version,body=plan(owner)
            active_sessions=f.db.scalar('SELECT COUNT(*) FROM auth_sessions WHERE user_id='+quote(ids[owner])+' AND revoked_at IS NULL')
            status,rejected=call('POST','/admin/organization-plans',body,version=version)
            check('missing completed-work takeover rejects entire final plan',status==409 and rejected.get('code')=='BUSINESS_TAKEOVER_REQUIRED',{'status':status,'code':rejected.get('code')})
            check('late validation failure rolls back employee placement and sessions',f.db.scalar('SELECT active FROM users WHERE id='+quote(ids[owner]))==1 and f.db.scalar('SELECT COUNT(*) FROM employee_placements WHERE employee_id='+quote(ids[owner]))==1 and active_sessions==f.db.scalar('SELECT COUNT(*) FROM auth_sessions WHERE user_id='+quote(ids[owner])+' AND revoked_at IS NULL'))
            body['businessTransfers']=[arrangement(completed,owner,receiver)]
            check('unsettled unpublished application refuses final plan',call('POST','/admin/organization-plans',body,version=version)[1].get('code')=='PENDING_SETTLEMENT_REQUIRED')
            request=call('GET','/approval-requests/'+unpublished['requestId'],who=owner)[1]
            body['cancelUnpublishedRequests']=[{'requestId':unpublished['requestId'],'rowVersion':request['rowVersion'],'reason':'Unpublished creation cannot proceed before departure'}]
            invalid=copy.deepcopy(body);invalid['cancelUnpublishedRequests'][0]['requestId']=pending2['requestId']
            check('admin cannot cancel a published employee business request',call('POST','/admin/organization-plans',invalid,version=version)[1].get('code')=='ADMIN_CANCELLATION_NOT_ALLOWED')
            stale=copy.deepcopy(body);stale['deactivateEmployees'][0]['rowVersion']+=1
            check('changed employee version refuses full final plan',call('POST','/admin/organization-plans',stale,version=version)[0]==412)
            status,final=call('POST','/admin/organization-plans',body,version=version,key='deactivation-final-fixture')
            check('complete deactivation atomically submits ownership and unpublished cancellation',status==200 and final['deactivatedEmployeeIds']==[ids[owner]],{'status':status,'code':final.get('code')})
            check('all employee sessions and old login are unusable',call('GET','/me',who=owner)[0]==401 and f.login(owner)[0]==401)
            check('disabled employee has no live position',f.db.scalar('SELECT COUNT(*) FROM employee_placements WHERE employee_id='+quote(ids[owner]))==0)
            check('admin cancellation preserves original unpublished applicant and source',f.db.scalar('SELECT COUNT(*) FROM approval_requests WHERE id='+quote(unpublished['requestId'])+" AND status='withdrawn' AND decided_by="+quote(ids['admin'])+' AND applicant_id='+quote(ids[owner]))==1)
            schedule={key:value for key,value in form([]).items() if key in ('allDay','startAt','dueAt')}
            reopen={'command':'reopen','reason':'Resume with active responsible employees',**schedule}
            check('reopen without replacement rejects the retained inactive assignee',command(completed,receiver,reopen)[0]==400)
            for owners in ([],[ids['admin']],[ids[owner]],[ids['other-founder']]):
                check('reopen rejects empty/nonemployee/inactive/cross-company assignees',command(completed,receiver,{**reopen,'assigneeIds':owners})[0]==400)
            status,resumed=command(completed,receiver,{**reopen,'assigneeIds':[ids['beta-two-employee'],ids['alpha-two-employee']]})
            check('takeover owner reopens completed work with ordered active replacements',status==200 and resumed['outcome']=='direct',{'status':status,'code':resumed.get('code')})
            view=detail(completed,receiver)
            check('reopen increments round and never automatically assigns takeover owner',view['executionRound']==2 and view['executionState']=='doing' and view['assigneeIds']==[ids['beta-two-employee'],ids['alpha-two-employee']])
            # A unit head cannot leave a vacant slot: succession is part of the same final result.
            version,body=plan('alpha-one-head')
            check('head departure without succession is rejected',call('POST','/admin/organization-plans',body,version=version)[1].get('code')=='INVALID_ORGANIZATION_PLAN')
            version,body=plan('alpha-one-head','alpha-two-employee')
            status,result=call('POST','/admin/organization-plans',body,version=version)
            check('head succession and direct-report placement commit together',status==200,{'status':status,'code':result.get('code')})
            check('successor now derives head identity without editable manager fields',call('GET','/me',who='alpha-two-employee')[1]['role']=='team_head')
            version,body=plan('founder')
            check('fixed founder cannot be deactivated',call('POST','/admin/organization-plans',body,version=version)[0]==400)
            version,body=plan('beta-two-head','beta-two-employee')
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                final_results=list(executor.map(lambda _:call('POST','/admin/organization-plans',body,version=version),range(2)))
            check('concurrent final deactivation commits one legal successor state',sum(row[0]==200 for row in final_results)==1 and all(row[0] in (200,409,412) for row in final_results)
                  and f.db.scalar('SELECT COUNT(*) FROM employee_placements WHERE employee_id='+quote(ids['beta-two-employee'])+" AND placement_type='team_head'")==1,
                  {'statuses':[row[0] for row in final_results]})
            # Concurrent ownership commands share company lock and version checks.
            race=create('founder',['founder'])['taskId']
            item=arrangement(race,'founder','beta-head');version=call('GET','/admin/organization-plans')[1]['rowVersion']
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                results=list(executor.map(lambda _:transfer(item,version),range(2)))
            check('concurrent takeovers commit one ownership transition',sum(row[0]==200 for row in results)==1 and all(row[0] in (200,409,412) for row in results) and f.db.scalar('SELECT COUNT(*) FROM task_business_transfers WHERE task_id='+quote(race))==1,{'statuses':[row[0] for row in results]})
            report['result']='PASS'
    except BaseException as error:
        report['result']='FAIL';report['errorType']=type(error).__name__;raise
    finally:
        OUTPUT.parent.mkdir(parents=True,exist_ok=True);OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__': main()
