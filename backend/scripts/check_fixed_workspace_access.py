#!/usr/bin/env python3
"""Exercise fixed-position task/log/profile/analysis reads against the built JAR in a scratch DB."""
import datetime as dt
import json
from pathlib import Path
from fixed_model_fixture import Fixture, quote
from migration_precheck import BASE

OUTPUT=BASE.parent/'audit/refactor-pandora-organization-and-workflows/workspace-access.json'

def main():
    report={'updated':dt.datetime.now(dt.timezone.utc).isoformat(),'checks':[]}
    def check(name,condition):
        report['checks'].append({'check':name,'pass':bool(condition)})
        print(('PASS ' if condition else 'FAIL ')+name,flush=True)
        if not condition: raise AssertionError(name)
    fixture=Fixture(port=18176)
    fixture.log_path=OUTPUT.with_name('workspace-service.log')
    try:
        with fixture as f:
            report['database']=f.database
            ids={key:value['id'] for key,value in f.identities.items()}
            tokens={key:f.login(key)[1]['token'] for key in ids}
            org='fixture-company'
            employees={key for key in ids if not key.startswith('other-') and key!='admin'}
            for key in employees:
                f.db.server_side('UPDATE users SET email='+quote(key+'@private.example.test')+' WHERE id='+quote(ids[key]))
                f.db.server_side('INSERT INTO work_logs(id,organization_id,author_id,business_date,body) VALUES('
                        +','.join(map(quote,('log-'+key,org,ids[key])))+",DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+08:00')),"+quote('Private log '+key)+')')
            # All old manager/rank fields in this fixture are deliberately empty/uniform.
            def descendants(key):
                if key=='founder': return employees-{key}
                if key in ('alpha-head','beta-head'): return {x for x in employees if x.startswith(key.split('-')[0]+'-') and x!=key}
                if key.endswith('-head'): return {key.removesuffix('-head')+'-employee'}
                return set()
            for key in ('founder','alpha-head','alpha-one-head','alpha-one-employee'):
                expected=descendants(key)
                status,result=f.call('GET','/me/reports',token=tokens[key])
                check(key+' reports include exactly all actual descendants',status==200 and {r['id'] for r in result['items']}=={ids[x] for x in expected})
                status,result=f.call('GET','/work-log-authors',token=tokens[key])
                check(key+' log author directory includes self and actual descendants',status==200 and {r['id'] for r in result['items']}=={ids[x] for x in expected|{key}})
                check(key+' log author directory contains no private fields or username',not any(field in json.dumps(result) for field in ('"phone"','"email"','"username"','"passwordHash"')))
                status,result=f.call('GET','/work-logs?scope=visible&limit=100',token=tokens[key])
                check(key+' visible log list uses the same full descendant range',status==200 and {r['authorId'] for r in result['items']}=={ids[x] for x in expected|{key}})
                status,result=f.call('GET','/me',token=tokens[key])
                check(key+' self profile derives fixed identity and retains only own contacts',status==200 and result.get('phone')==f.identities[key]['identifier'] and result.get('email')==key+'@private.example.test' and result.get('canManageTeam') is False and 'username' not in result)
            for reader,target,allowed in (('alpha-head','alpha-one-employee',True),('alpha-one-head','alpha-one-employee',True),
                    ('alpha-one-employee','alpha-one-head',False),('alpha-one-employee','alpha-two-employee',False),
                    ('alpha-head','beta-one-employee',False),('alpha-one-head','alpha-two-employee',False)):
                status,person=f.call('GET','/users/'+ids[target],token=tokens[reader])
                check(reader+' profile access to '+target+' matches current chain',(status==200 and person.get('phone')==f.identities[target]['identifier'] and 'email' not in person) if allowed else status==404)
                status,_=f.call('GET','/work-logs/log-'+target,token=tokens[reader])
                check(reader+' log detail access to '+target+' matches current chain',status==(200 if allowed else 404))
                status,_=f.call('GET','/work-logs?scope=visible&authorId='+ids[target],token=tokens[reader])
                check(reader+' targeted log query cannot broaden authority',status==(200 if allowed else 404))
            for reader in ('founder','alpha-head','alpha-one-head'):
                status,_=f.call('PATCH','/work-logs/log-alpha-one-employee',{'body':'forged'},tokens[reader],'reject-log-'+reader,1)
                check(reader+' cannot edit another author log',status in (403,404))
            status,directory=f.call('GET','/users?limit=100',token=tokens['founder'])
            check('employee directory excludes independent administrators and contacts',status==200 and len(directory['items'])==len(employees) and not any(field in json.dumps(directory) for field in ('"phone"','"email"','"username"')))
            # Seed normal effective tasks only; no workflow shortcut is being asserted here.
            task_specs=[('alpha-task','alpha-one-employee',['alpha-one-employee']),
                        ('beta-task','beta-one-employee',['beta-one-employee']),
                        ('cross-created','alpha-head',['beta-one-employee']),
                        ('team-cross-created','alpha-one-head',['beta-two-employee']),
                        ('multi-task','beta-head',['alpha-two-employee','beta-two-employee'])]
            for name,creator,assignees in task_specs:
                f.db.server_side('INSERT INTO tasks(id,organization_id,original_creator_id) VALUES('+','.join(map(quote,(name,org,ids[creator])))+')')
                f.db.server_side('INSERT INTO task_versions(id,organization_id,task_id,version_no,title,description,acceptance_criteria,priority,start_at,due_at,execution_state,progress_note,status,created_by) VALUES('
                    +','.join(map(quote,(name+'-v1',org,name)))+",1,"+quote(name)+","+quote('word'+name.replace('-',''))+",'criteria','urgent',UTC_TIMESTAMP()-INTERVAL 1 HOUR,UTC_TIMESTAMP()+INTERVAL 4 HOUR,'todo','','applied',"+quote(ids[creator])+')')
                f.db.server_side('UPDATE tasks SET current_version_id='+quote(name+'-v1')+' WHERE id='+quote(name))
                for ordinal,key in enumerate(assignees):
                    f.db.server_side('INSERT INTO task_version_assignees(organization_id,version_id,user_id,ordinal) VALUES('+','.join(map(quote,(org,name+'-v1',ids[key])))+','+str(ordinal)+')')
            expected_tasks={'founder':{r[0] for r in task_specs},'alpha-head':{'alpha-task','cross-created','multi-task'},
                    'alpha-one-head':{'alpha-task','team-cross-created'},'alpha-one-employee':{'alpha-task'}}
            for key,expected in expected_tasks.items():
                status,result=f.call('GET','/tasks?limit=100',token=tokens[key])
                check(key+' task list uses assignee scope plus personal relations',status==200 and {r['id'] for r in result['items']}==expected)
                expected_count={'founder':5,'alpha-head':2,'alpha-one-head':1,'alpha-one-employee':1}[key]
                status,result=f.call('GET','/analytics/task-summary',token=tokens[key])
                check(key+' analysis excludes personal tasks outside its organizational range',status==200 and result['total']==expected_count)
                status,job=f.call('POST','/ai-jobs',{'scopeType':'auto'},tokens[key],'analysis-'+key)
                check(key+' analysis job can be created',status==200)
                status,result=f.call('GET','/ai-jobs/'+job['jobId'],token=tokens[key])
                expected_scope={'founder':'company','alpha-head':'department','alpha-one-head':'team','alpha-one-employee':'self'}[key]
                check(key+' analysis and suggestions have separate fixed scopes',status==200 and result['result']['statisticsScope']==expected_scope and result['result']['suggestionScope']==('company' if key=='founder' else 'self'))
                if key=='alpha-head': old_job=job['jobId']
            # Exchange two whole teams between departments with their heads/employees intact.
            f.db.server_side("START TRANSACTION; DELETE FROM employee_placements WHERE team_id IN ('fixture-company-alpha-one','fixture-company-beta-one');"
                    "UPDATE teams SET department_id=CASE id WHEN 'fixture-company-alpha-one' THEN 'fixture-company-beta' ELSE 'fixture-company-alpha' END WHERE id IN ('fixture-company-alpha-one','fixture-company-beta-one');"
                    "INSERT INTO employee_placements(organization_id,employee_id,placement_type,department_id,team_id,position_id) VALUES"
                    +','.join('('+','.join(map(quote,(org,ids[key],kind,org+'-'+dep,org+'-'+team,org+'-title')))+')'
                        for key,kind,dep,team in [('alpha-one-head','team_head','beta','alpha-one'),('alpha-one-employee','employee','beta','alpha-one'),('beta-one-head','team_head','alpha','beta-one'),('beta-one-employee','employee','alpha','beta-one')])
                    +"; UPDATE organizations SET authz_version=authz_version+1 WHERE id='fixture-company'; COMMIT;")
            check('former department manager loses old subordinate profile immediately',f.call('GET','/users/'+ids['alpha-one-employee'],token=tokens['alpha-head'])[0]==404)
            check('former department manager loses old subordinate log immediately',f.call('GET','/work-logs/log-alpha-one-employee',token=tokens['alpha-head'])[0]==404)
            check('new department manager gains actual subordinate read',f.call('GET','/work-logs/log-alpha-one-employee',token=tokens['beta-head'])[0]==200)
            status,result=f.call('GET','/ai-jobs/'+old_job,token=tokens['alpha-head'])
            check('old aggregate is rejected after authorization changes',status==409 and result.get('code')=='ANALYSIS_SCOPE_CHANGED')
            report['result']='PASS'
    except BaseException as error:
        report['result']='FAIL';report['errorType']=type(error).__name__;raise
    finally:
        OUTPUT.parent.mkdir(parents=True,exist_ok=True)
        OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__': main()
