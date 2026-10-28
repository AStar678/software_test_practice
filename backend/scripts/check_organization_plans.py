#!/usr/bin/env python3
"""Atomic final organization plans, controlled mapping repair and one-time employee credentials."""
import copy
import datetime as dt
import json
import uuid
from concurrent.futures import ThreadPoolExecutor
from fixed_model_fixture import Fixture, quote
from migration_precheck import BASE

OUTPUT=BASE.parent/'audit/refactor-pandora-organization-and-workflows/organization-plans.json'

def main():
    report={'updated':dt.datetime.now(dt.timezone.utc).isoformat(),'checks':[]}
    def check(name,condition,evidence=None):
        report['checks'].append({'check':name,'pass':bool(condition),'evidence':evidence})
        print(('PASS ' if condition else 'FAIL ')+name,flush=True)
        if not condition: raise AssertionError(name)
    fixture=Fixture(port=18178);fixture.log_path=OUTPUT.with_name('organization-service.log')
    try:
        with fixture as f:
            admin=f.login('admin')[1]['token'];employee=f.login('alpha-one-employee')[1]['token']
            ids={key:value['id'] for key,value in f.identities.items()}
            def draft():
                status,result=f.call('GET','/admin/organization-plans',token=admin)
                check('administrator can read complete versioned plan',status==200,{'status':status,'code':result.get('code')})
                plan={key:result[key] for key in ('departments','teams','placements','expectedEmployees')}
                plan['reason']='Isolated final-state validation';return result['rowVersion'],plan
            def save(version,plan,key=None): return f.call('POST','/admin/organization-plans',plan,admin,key or 'plan-'+uuid.uuid4().hex,version)
            def state():
                return f.db.rows("SELECT CONCAT('org:',authz_version) FROM organizations WHERE id='fixture-company' UNION ALL SELECT CONCAT(employee_id,':',placement_type,':',COALESCE(department_id,''),':',COALESCE(team_id,''),':',row_version) FROM employee_placements WHERE organization_id='fixture-company' ORDER BY 1")
            version,plan=draft();original=state()
            check('employee cannot access controlled mapping plan',f.call('GET','/admin/organization-plans',token=employee)[0]==403)
            bad=copy.deepcopy(plan);bad['placements']=[r for r in bad['placements'] if r['employeeId']!=ids['alpha-head']]
            status,result=save(version,bad)
            check('missing head is rejected without changing any original placement',status==409 and result.get('code')=='INVALID_ORGANIZATION_PLAN' and state()==original)
            bad=copy.deepcopy(plan);bad['founderEmployeeId']=ids['alpha-head']
            check('ordinary organization maintenance cannot replace fixed founder',save(version,bad)[0]==400 and state()==original)
            bad=copy.deepcopy(plan);bad['departments'][0]['rowVersion']=0
            check('stale unit version is rejected before writes',save(version,bad)[0]==412 and state()==original)
            bad=copy.deepcopy(plan);bad['expectedEmployees'].pop()
            check('incomplete expected employee versions cannot be saved',save(version,bad)[0]==412 and state()==original)
            bad=copy.deepcopy(plan)
            for row in bad['placements']:
                if row['employeeId']==ids['alpha-one-employee']: row['teamId']='fixture-company-beta-one'
            check('cross-department team placement is rejected atomically',save(version,bad)[0]==409 and state()==original)
            # Force a late audit failure after organization DML, and prove the enclosing Writes rollback.
            f.db.server_side("CREATE TRIGGER isolated_plan_failure BEFORE INSERT ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='isolated plan rollback'")
            status,_=save(version,plan)
            f.db.server_side('DROP TRIGGER isolated_plan_failure')
            check('late audit failure rolls back every organization write',status==500 and state()==original)
            now=dt.datetime.now(dt.timezone.utc)
            body={'title':'Pending organization route','description':'Created before head swap','priority':'medium','allDay':False,
                  'assigneeIds':[ids['beta-one-employee']],'startAt':now.isoformat(),'dueAt':(now+dt.timedelta(days=2)).isoformat()}
            status,pending=f.call('POST','/tasks',body,employee,'pending-before-swap')
            check('creation before organization change has a pending direct manager',status==201 and pending.get('outcome')=='pending')
            old_reviewer=f.login('alpha-one-head')[1]['token']
            old_request=f.call('GET','/approval-requests/'+pending['requestId'],token=old_reviewer)[1]
            # Swap both occupants in one final state; no transient unheaded team is committed.
            for row in plan['placements']:
                if row['employeeId']==ids['alpha-one-head']: row['placementType']='employee'
                if row['employeeId']==ids['alpha-one-employee']: row['placementType']='team_head'
            key='swap-'+uuid.uuid4().hex
            status,result=save(version,plan,key)
            check('head/employee swap succeeds as one full result',status==200 and result['rowVersion']==version+1,{'status':status,'code':result.get('code')})
            new_reviewer=f.login('alpha-head')[1]['token']
            status,rerouted=f.call('GET','/approval-requests/'+pending['requestId'],token=new_reviewer)
            check('same organization transaction reassigns pending creation to new direct manager',status==200 and rerouted.get('currentReviewerId')==ids['alpha-head'] and 'diff' in rerouted)
            status,_=f.call('PATCH','/approval-requests/'+pending['requestId'],{'decision':'approve'},old_reviewer,'stale-old-reviewer',old_request['rowVersion'])
            check('old reviewer and old page cannot approve after reassignment',status in (403,404,409,412))
            current=state()
            status,replayed=save(version,plan,key)
            check('same command replays without reapplying the swap',status==200 and state()==current and replayed['rowVersion']==result['rowVersion'])
            check('new command with old company version cannot overwrite swap',save(version,plan)[0]==412 and state()==current)
            # A new department and team may have only their first respective heads, with complete titles.
            version,plan=draft();dep,team=str(uuid.uuid4()),str(uuid.uuid4())
            new_ids=[str(uuid.uuid4()),str(uuid.uuid4())]
            plan['departments'].append({'id':dep,'name':'New staffed department'})
            plan['teams'].append({'id':team,'name':'New staffed team','departmentId':dep})
            plan['newEmployees']=[{'id':new_ids[0],'displayName':'New department head','phone':'13977770001'},
                                  {'id':new_ids[1],'displayName':'New team head','phone':'13977770002'}]
            for employee_id,kind,group in ((new_ids[0],'department_head',None),(new_ids[1],'team_head',team)):
                plan['placements'].append({'employeeId':employee_id,'placementType':kind,'departmentId':dep,'teamId':group,'positionId':'fixture-company-title'})
            key='new-heads-'+uuid.uuid4().hex
            status,result=save(version,plan,key)
            check('new units and their first employees are created atomically',status==200 and set(result.get('createdEmployeeIds',[]))==set(new_ids),{'status':status,'code':result.get('code')})
            check('initial credentials are returned only once outside replayable receipt',set(result.get('initialPasswords',{}))==set(new_ids) and 'initialPasswords' not in save(version,plan,key)[1])
            check('credentials and contacts never enter plan audit or idempotency',f.db.scalar("SELECT COUNT(*) FROM audit_logs WHERE action='organization.plan.applied' AND (CAST(details_json AS CHAR) LIKE '%initialPasswords%' OR CAST(details_json AS CHAR) LIKE '%1397777000%')")==0 and f.db.scalar("SELECT COUNT(*) FROM idempotency_keys WHERE CAST(response_json AS CHAR) LIKE '%initialPasswords%'")==0)
            status,session=f.call('POST','/auth/sessions',{'accountType':'employee','phone':'13977770001','password':result['initialPasswords'][new_ids[0]]})
            check('new independent employee identity is stable and first-login restricted',status==200 and session['user']['id']==new_ids[0] and session['passwordChangeRequired'] is True)
            # Deleting the units requires complete destinations for both heads, in the same plan.
            version,plan=draft();plan['departments']=[r for r in plan['departments'] if r['id']!=dep];plan['teams']=[r for r in plan['teams'] if r['id']!=team]
            for row in plan['placements']:
                if row['employeeId'] in new_ids:
                    row.update(placementType='employee',departmentId='fixture-company-alpha',teamId='fixture-company-alpha-two')
            status,result=save(version,plan)
            check('unit removal and every employee destination commit together',status==200 and f.db.scalar('SELECT COUNT(*) FROM departments WHERE id='+quote(dep))==0,{'status':status,'code':result.get('code')})
            # Two independent commands race at the same complete expected state.
            version,plan=draft();left=copy.deepcopy(plan);right=copy.deepcopy(plan)
            left['departments'][0]['name']='First competing result';right['departments'][0]['name']='Second competing result'
            with ThreadPoolExecutor(max_workers=2) as pool:
                results=list(pool.map(lambda p:save(version,p),(left,right)))
            codes=sorted(r[0] for r in results)
            check('concurrent complete plans commit exactly one result',codes[0]==200 and codes[1] in (409,412),{'statuses':codes})
            version_after,_=draft();check('concurrent loser leaves no extra authority version',version_after==version+1)
            check('readiness remains valid after competing head and unit changes',f.call('GET','/admin/organization',token=admin)[1]['constraints']['formalWritesReady'] is True)
            # Explicit mapping repair is available while the normal business gate is closed.
            f.db.server_side("UPDATE organizations SET founder_employee_id=NULL WHERE id='fixture-company'")
            check('missing founder blocks ordinary business',f.call('GET','/tasks',token=employee)[0]==409)
            version,plan=draft();plan['founderEmployeeId']=ids['founder']
            status,result=save(version,plan)
            check('explicit stable-ID founder mapping repairs readiness without inventing a root',status==200 and result['constraints']['formalWritesReady'] is True)
            check('controlled mapping repair restores normal business',f.call('GET','/tasks',token=employee)[0]==200)
            report['result']='PASS'
    except BaseException as error:
        report['result']='FAIL';report['errorType']=type(error).__name__;raise
    finally:
        OUTPUT.parent.mkdir(parents=True,exist_ok=True);OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__': main()
