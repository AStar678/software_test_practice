#!/usr/bin/env python3
"""Prepare twice, reject wrong targets, restart the real JAR and exercise every demo account/scenario."""
import datetime as dt
import hashlib
import json
import os
import subprocess
import uuid
from migration_precheck import BASE, Mysql, DEFAULT_OPTION_FILE, fixed_precheck
from fixed_model_fixture import Fixture, quote
from prepare_demo import prepare,database_env
from check_helpers import running_database

OUTPUT=BASE.parent/'audit/refactor-pandora-organization-and-workflows/final-demo.json'

def main():
    name='pandora_precheck_demo_'+uuid.uuid4().hex[:12];admin=Mysql(None,DEFAULT_OPTION_FILE);db=Mysql(name,DEFAULT_OPTION_FILE)
    report={'updated':dt.datetime.now(dt.timezone.utc).isoformat(),'database':name,'checks':[]}
    def check(name,condition,evidence=None):
        report['checks'].append({'check':name,'pass':bool(condition),'evidence':evidence});print(('PASS ' if condition else 'FAIL ')+name,flush=True)
        if not condition:raise AssertionError(name)
    def snapshot():
        return {table:db.rows('SELECT * FROM '+table+' ORDER BY '+key) for table,key in
                (('users','id'),('employee_placements','employee_id'),('tasks','id'),('task_versions','id'),
                 ('demo_seed_keys','seed_key'),('task_business_transfers','id'),('home_items','id'),('work_logs','id'))}
    try:
        admin.server_side(f'CREATE DATABASE `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
        values=database_env()
        for host in ('localhost','127.0.0.1'):
            admin.server_side(f'GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,REFERENCES,DROP ON `{name}`.* TO '+quote(values['PANDORA_DB_USER'])+'@'+quote(host))
        for args in ([],['--database',name]):
            result=subprocess.run(['python3',str(BASE/'scripts/prepare_demo.py'),*args],capture_output=True,text=True)
            check('preparation refuses missing explicit database/marker arguments',result.returncode!=0)
        manifest=prepare(name,'owned-demo-v2',True,18194)
        before=snapshot();repeat=prepare(name,'owned-demo-v2',False,18194)
        check('two preparations preserve all business rows, placements, stable seed keys and IDs',before==snapshot())
        check('two preparations preserve original business date, seed completion and counts',manifest['businessDate']==repeat['businessDate'] and manifest['counts']==repeat['counts'])
        try:prepare(name,'wrong-marker',False,18194)
        except ValueError:check('mismatched demo marker refuses preparation without business mutation',before==snapshot())
        else:check('mismatched demo marker refuses preparation without business mutation',False)
        # The startup seed itself also rejects missing/mismatched targets. No command can bypass
        # Python's guards by merely setting PANDORA_SEED on an existing database.
        env={**os.environ,**values,'PANDORA_DB_URL':f'jdbc:mysql://127.0.0.1:13306/{name}?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true&allowPublicKeyRetrieval=true&sslMode=DISABLED',
             'PANDORA_SEED':'true','PANDORA_WORKER_ENABLED':'false','PANDORA_PORT':'18194'}
        for extra in ([],['--pandora.demo-target=wrong-target','--pandora.demo-marker=owned-demo-v2']):
            with OUTPUT.with_name('demo-refused-startup.log').open('a') as log:
                result=subprocess.run(['java','-jar',str(BASE/'target/pandora-backend-0.1.0.jar'),*extra],env=env,stdout=log,stderr=subprocess.STDOUT,timeout=45)
            check('startup seed refuses missing/mismatched explicit target without touching business data',result.returncode!=0 and before==snapshot())
        check('read-only current precheck accepts the stored fixed organization',fixed_precheck(db)['status']=='ready')
        result=subprocess.run(['python3',str(BASE/'scripts/check_database.py'),'--database',name,'--output',str(OUTPUT.with_name('demo-integrity.json'))],capture_output=True,text=True)
        check('persistent demo satisfies all read-only database integrity checks',result.returncode==0)
        check('demo has two departments, four teams and complete single-position staff',db.scalar('SELECT COUNT(*) FROM departments')==2 and db.scalar('SELECT COUNT(*) FROM teams')==4 and db.scalar('SELECT COUNT(*) FROM users')==db.scalar('SELECT COUNT(*) FROM employee_placements'))
        check('every department and team has exactly one head',db.scalar("SELECT COUNT(*) FROM employee_placements WHERE placement_type='department_head'")==2 and db.scalar("SELECT COUNT(*) FROM employee_placements WHERE placement_type='team_head'")==4)
        check('administrator is independent and absent from staff/placements',db.scalar('SELECT COUNT(*) FROM admin_accounts')==1 and db.scalar('SELECT COUNT(*) FROM admin_accounts a JOIN users u ON a.id=u.id')==0)
        statuses={row[0] for row in db.rows('SELECT DISTINCT status FROM approval_requests')}
        check('seed contains approved, direct, pending, rejected, withdrawn and expired applications',statuses=={'approved','direct','pending','rejected','withdrawn','expired'},sorted(statuses))
        check('seed has both completed work and a real reopened execution round',db.scalar("SELECT COUNT(*) FROM tasks WHERE execution_state='done'")>0 and db.scalar('SELECT COUNT(*) FROM tasks WHERE execution_round>1')>0)
        check('dedicated handover and formal takeover retain real separate histories',db.scalar('SELECT COUNT(*) FROM handover_requests')>0 and db.scalar('SELECT COUNT(*) FROM task_business_transfers')==1)
        f=Fixture(port=18195);f.database=name;f.db=db;f.base='http://127.0.0.1:18195/api/v1';f.identities=manifest['identities']
        with running_database(name,18195,OUTPUT.with_name('demo-restart-service.log'),True) as process:
            tokens={}
            for key,identity in manifest['identities'].items():
                status,session=f.login(key,'Demo@123456');tokens[key]=session.get('token')
                check(key+' authenticates through its real declared account namespace after restart',status==200 and session['user']['id']==identity['id'] and 'username' not in session['user'])
            ids={key:value['id'] for key,value in f.identities.items()}
            def call(method,path,body=None,who='upper',version=None):
                return f.call(method,path,body,tokens[who],'demo-check-'+uuid.uuid4().hex,version)
            for who,role in (('upper','founder'),('middle','department_head'),('product-head-1','team_head'),('employee','employee')):
                status,me=call('GET','/me',who=who);check(who+' has the derived fixed position',status==200 and me.get('role')==role)
            status,directory=call('GET','/users?limit=100')
            check('company employee directory excludes admin and all contacts',status==200 and ids['admin'] not in json.dumps(directory) and not any(field in json.dumps(directory) for field in ('"phone"','"email"','"username"')))
            check('admin cannot read employee task business APIs',call('GET','/tasks',who='admin')[0]==403)
            check('employee cannot read admin management APIs',call('GET','/admin/employees',who='employee')[0]==403)
            status,rows=call('GET','/tasks?limit=100&offset=0',who='employee')
            status2,second=call('GET','/tasks?limit=100&offset=100',who='employee')
            check('employee task table has more than two 50-row pages after restart',status==status2==200 and len(rows['items'])==100 and len(second['items'])>0,{'first':len(rows.get('items',[])),'second':len(second.get('items',[]))})
            check('company retains ten ordered managed items',len(call('GET','/admin/company',who='admin')[1]['items'])==10)
            task=lambda key:manifest['objects']['task-'+key]['id']
            created=call('GET','/tasks/'+task('creator-only'),who='employee')[1]
            check('creator-only demo retains original creator and excludes creator from effective assignees',created.get('originalCreatorId')==ids['employee'] and ids['employee'] not in created.get('assigneeIds',[]))
            takeover=call('GET','/tasks/'+task('takeover'),who='colleague')[1]
            check('takeover recipient can read without being rewritten as original creator',takeover.get('originalCreatorId')==ids['middle'] and takeover.get('businessOwnerId')==ids['colleague'])
            for who,expected in (('middle',6),('product-head-1',3)):
                status,authors=call('GET','/work-log-authors',who=who)
                check(who+' log directory includes indirect/direct subordinate demo authors',status==200 and len(authors.get('items',[]))>=expected)
            frozen=manifest['objects']['log-marketing-2']['id']
            status,log=call('GET','/work-logs/'+frozen,who='marketing')
            check('frozen log is read-only from its real first creation instant',status==200 and log.get('frozen') is True and log.get('editable') is False)
            check('deletion/recreation keeps one day slot and first-creation history',db.scalar("SELECT row_version FROM work_logs WHERE id="+quote(manifest['objects']['log-colleague-1']['id']))==3)
            objects=manifest['objects']
            for key in ('cross-month','cross-year','full-coverage','midnight','point'):
                detail=call('GET','/tasks/'+task(key),who='employee')[1]
                check(key+' schedule demo is present and readable as the real employee',detail.get('id')==task(key) or detail.get('taskId')==task(key))
            check('eight real concurrent timed and eight all-day tasks exist',all('task-overlap-'+str(i) in objects and 'task-all-day-'+str(i) in objects for i in range(1,9)))
            changed=call('GET','/tasks/'+task('takeover'),who='colleague')[1]
            status,result=call('PATCH','/tasks/'+task('takeover'),{'command':'change','description':'Persisted real demo edit','reason':'restart persistence'},'colleague',changed['rowVersion'])
            check('taken-over task remains directly editable by its business owner',status==200 and result.get('outcome')=='direct')
            status,history=call('GET','/admin/tasks/'+task('takeover')+'/history',who='admin')
            check('admin task history can trace takeover after restart',status==200 and 'business_takeover' in json.dumps(history))
            account=call('GET','/admin/account',who='admin')[1]
            status,result=call('PATCH','/admin/account',{'accountName':'demo-admin-edited','displayName':'Edited demo admin'},'admin',account['rowVersion'])
            check('administrator can persist a real account-name edit before repeat preparation',status==200)
        prepare(name,'owned-demo-v2',False,18194)
        check('repeat preparation preserves a real user edit instead of resetting demo data',db.rows('SELECT v.description FROM tasks t JOIN task_versions v ON v.id=t.current_version_id WHERE t.id='+quote(task('takeover')))==[['Persisted real demo edit']])
        check('repeat preparation preserves independent administrator account edits',db.rows('SELECT account_name,display_name FROM admin_accounts')==[['demo-admin-edited','Edited demo admin']])
        report['businessDate']=manifest['businessDate'];report['counts']=manifest['counts'];report['result']='PASS'
    except Exception as error:
        report['result']='FAIL';report['errorType']=type(error).__name__;raise
    finally:
        admin.server_side(f'DROP DATABASE IF EXISTS `{name}`')
        OUTPUT.parent.mkdir(parents=True,exist_ok=True);OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
