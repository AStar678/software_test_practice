#!/usr/bin/env python3
"""Prepare twice, reject wrong targets, restart the real JAR and exercise every demo account/scenario."""
import datetime as dt
import hashlib
import json
import os
import subprocess
import sys
import uuid
from migration_precheck import BASE, Mysql, DEFAULT_OPTION_FILE, fixed_precheck
from fixed_model_fixture import Fixture, quote
from prepare_demo import prepare,database_env
from check_helpers import running_database

OUTPUT=BASE.parent/'output/task-creation-refinement/final-demo.json'

def main():
    name='pandora_precheck_demo_'+uuid.uuid4().hex[:12];admin=Mysql(None,DEFAULT_OPTION_FILE);db=Mysql(name,DEFAULT_OPTION_FILE)
    report={'updated':dt.datetime.now(dt.timezone.utc).isoformat(),'database':name,'checks':[]}
    def check(name,condition,evidence=None):
        report['checks'].append({'check':name,'pass':bool(condition),'evidence':evidence});print(('PASS ' if condition else 'FAIL ')+name,flush=True)
        if not condition:raise AssertionError(name)
    def snapshot():
        return {table:db.rows('SELECT * FROM '+table+' ORDER BY '+key) for table,key in
                (('users','id'),('employee_placements','employee_id'),('tasks','id'),('task_versions','id'),
                 ('demo_seed_keys','seed_key'),('task_business_transfers','id'),('home_items','id'),('work_logs','id'),
                 ('work_log_tags','log_id,ordinal'),('daily_items','id'))}
    try:
        admin.server_side(f'CREATE DATABASE `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
        values=database_env()
        for host in ('localhost','127.0.0.1'):
            admin.server_side(f'GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,REFERENCES,DROP ON `{name}`.* TO '+quote(values['PANDORA_DB_USER'])+'@'+quote(host))
        for args in ([],['--database',name]):
            result=subprocess.run([sys.executable,str(BASE/'scripts/prepare_demo.py'),*args],capture_output=True,text=True)
            check('preparation refuses missing explicit database/marker arguments',result.returncode!=0)
        manifest=prepare(name,'owned-demo-v3',True,18194)
        before=snapshot();repeat=prepare(name,'owned-demo-v3',False,18194)
        check('two preparations preserve all business rows, placements, stable seed keys and IDs',before==snapshot())
        check('two preparations preserve original business date, seed completion and counts',manifest['businessDate']==repeat['businessDate'] and manifest['counts']==repeat['counts'])
        try:prepare(name,'wrong-marker',False,18194)
        except ValueError:check('mismatched demo marker refuses preparation without business mutation',before==snapshot())
        else:check('mismatched demo marker refuses preparation without business mutation',False)
        # The startup seed itself also rejects missing/mismatched targets. No command can bypass
        # Python's guards by merely setting PANDORA_SEED on an existing database.
        env={**os.environ,**values,'PANDORA_DB_URL':f'jdbc:mysql://127.0.0.1:13306/{name}?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true&allowPublicKeyRetrieval=true&sslMode=DISABLED',
             'PANDORA_SEED':'true','PANDORA_WORKER_ENABLED':'false','PANDORA_PORT':'18194'}
        for extra in ([],['--pandora.demo-target=wrong-target','--pandora.demo-marker=owned-demo-v3']):
            with OUTPUT.with_name('demo-refused-startup.log').open('a') as log:
                result=subprocess.run(['java','-jar',str(BASE/'target/pandora-backend-0.1.0.jar'),*extra],env=env,stdout=log,stderr=subprocess.STDOUT,timeout=45)
            check('startup seed refuses missing/mismatched explicit target without touching business data',result.returncode!=0 and before==snapshot())
        check('read-only current precheck accepts the stored fixed organization',fixed_precheck(db)['status']=='ready')
        result=subprocess.run([sys.executable,str(BASE/'scripts/check_database.py'),'--database',name,'--output',str(OUTPUT.with_name('demo-integrity.json'))],capture_output=True,text=True)
        check('persistent demo satisfies all read-only database integrity checks',result.returncode==0)
        check('demo has two departments, four teams and complete single-position staff',db.scalar('SELECT COUNT(*) FROM departments')==2 and db.scalar('SELECT COUNT(*) FROM teams')==4 and db.scalar('SELECT COUNT(*) FROM users')==db.scalar('SELECT COUNT(*) FROM employee_placements'))
        check('every department and team has exactly one head',db.scalar("SELECT COUNT(*) FROM employee_placements WHERE placement_type='department_head'")==2 and db.scalar("SELECT COUNT(*) FROM employee_placements WHERE placement_type='team_head'")==4)
        check('administrator is independent and absent from staff/placements',db.scalar('SELECT COUNT(*) FROM admin_accounts')==1 and db.scalar('SELECT COUNT(*) FROM admin_accounts a JOIN users u ON a.id=u.id')==0)
        statuses={row[0] for row in db.rows('SELECT DISTINCT status FROM approval_requests')}
        check('seed contains approved, direct, pending, rejected, withdrawn and expired applications',statuses=={'approved','direct','pending','rejected','withdrawn','expired'},sorted(statuses))
        check('non-protagonists have no separately populated personal logs',
              db.scalar("SELECT COUNT(*) FROM work_logs l JOIN demo_seed_keys k ON k.object_id=l.author_id AND k.object_type='employee' WHERE k.seed_key NOT IN ('upper','middle','product-head-1','employee')")==0)
        for who in ('upper','middle','product-head-1','employee'):
            owner=quote(manifest['identities'][who]['id'])
            own=" FROM tasks t JOIN task_versions v ON v.id=t.current_version_id JOIN task_version_assignees a ON a.version_id=v.id AND a.user_id="+owner
            check(who+' has a same-day short ordinary actionable task',db.scalar("SELECT COUNT(*)"+own+" WHERE v.all_day=FALSE AND t.execution_state<>'done' AND v.due_at>UTC_TIMESTAMP(6) AND TIMESTAMPDIFF(MINUTE,v.start_at,v.due_at) BETWEEN 1 AND 120 AND DATE(v.start_at+INTERVAL 8 HOUR)=DATE(v.due_at+INTERVAL 8 HOUR)")>0)
            check(who+' has ordinary unfinished overdue work',db.scalar("SELECT COUNT(*)"+own+" WHERE t.execution_state<>'done' AND v.due_at<"+quote(manifest['businessDate'])+"-INTERVAL 8 HOUR")>0)
        check('historical overdue work keeps approval version and chronology consistent',
              db.scalar("SELECT COUNT(*) FROM demo_seed_keys k JOIN task_versions v ON v.task_id=k.object_id JOIN approval_requests a ON a.proposed_version_id=v.id WHERE k.seed_key IN ('task-upper-2','task-middle-2','task-product-head-1-2','task-employee-2') AND (a.applicable_deadline<>v.due_at OR a.created_at>=v.due_at OR a.decided_at>=v.due_at)")==0)
        check('seed has both completed work and a real reopened execution round',db.scalar("SELECT COUNT(*) FROM tasks WHERE execution_state='done'")>0 and db.scalar('SELECT COUNT(*) FROM tasks WHERE execution_round>1')>0)
        check('dedicated handover and formal takeover retain real separate histories',db.scalar('SELECT COUNT(*) FROM handover_requests')>0 and db.scalar('SELECT COUNT(*) FROM task_business_transfers')==1)
        f=Fixture(port=18195);f.database=name;f.db=db;f.base='http://127.0.0.1:18195/api/v1';f.identities=manifest['identities']
        with running_database(name,18195,OUTPUT.with_name('demo-restart-service.log'),True) as process:
            tokens={}
            for key,identity in manifest['identities'].items():
                status,session=f.login(key,'Demo@123456');tokens[key]=session.get('token')
                check(key+' authenticates through its real declared account namespace after restart',status==200 and session['user']['id']==identity['id'] and 'username' not in session['user'])
            browser=subprocess.run(['node',str(BASE/'scripts/check_demo_roles_browser.js')],
                env={**os.environ,'PANDORA_DEMO_FIXTURE':json.dumps({'base':'http://127.0.0.1:18195','identities':manifest['identities'],'objects':manifest['objects']})},
                capture_output=True,text=True)
            check('four demo roles open home, company/form, logs, notifications and legitimate subordinate pages',
                  browser.returncode==0,browser.stdout[-2000:]+browser.stderr[-2000:])
            ids={key:value['id'] for key,value in f.identities.items()}
            def call(method,path,body=None,who='upper',version=None):
                return f.call(method,path,body,tokens[who],'demo-check-'+uuid.uuid4().hex,version)
            status,tagged_log=call('GET','/work-logs/'+manifest['objects']['log-employee-0']['id'],who='employee')
            focus_tag=manifest['objects']['tag-focus']['id']
            check('demo log reads its seeded shared tag through the ordered collection',
                  status==200 and tagged_log.get('tagIds')==[focus_tag]
                  and [tag['id'] for tag in tagged_log.get('tags',[])]==[focus_tag])
            for who,role in (('upper','founder'),('middle','department_head'),('product-head-1','team_head'),('employee','employee')):
                status,me=call('GET','/me',who=who);check(who+' has the derived fixed position',status==200 and me.get('role')==role)
            status,directory=call('GET','/users?limit=100')
            check('company employee directory excludes admin and all contacts',status==200 and ids['admin'] not in json.dumps(directory) and not any(field in json.dumps(directory) for field in ('"phone"','"email"','"username"')))
            check('admin cannot read employee task business APIs',call('GET','/tasks',who='admin')[0]==403)
            check('employee cannot read admin management APIs',call('GET','/admin/employees',who='employee')[0]==403)
            status,rows=call('GET','/tasks?limit=100&offset=0',who='employee')
            check('the default demo no longer carries the retired 110-row pagination dump',
                  status==200 and len(rows['items']) < 100, len(rows.get('items',[])))
            for who in ('upper','middle','product-head-1','employee'):
                status,table=call('GET','/tasks/table?relation=created&limit=100',who=who)
                check(who+' has 10-20 meaningful created tasks',status==200 and 10 <= table.get('total',0) <= 20, table.get('total'))
            check('company retains ten ordered managed items',len(call('GET','/admin/company',who='admin')[1]['items'])==10)
            task=lambda key:manifest['objects']['task-'+key]['id']
            created=call('GET','/tasks/'+task('creator-only'),who='employee')[1]
            check('creator-only demo retains original creator and excludes creator from effective assignees',created.get('originalCreatorId')==ids['employee'] and ids['employee'] not in created.get('assigneeIds',[]))
            takeover=call('GET','/tasks/'+task('takeover'),who='colleague')[1]
            check('takeover recipient can read without being rewritten as original creator',takeover.get('originalCreatorId')==ids['middle'] and takeover.get('businessOwnerId')==ids['colleague'])
            for who,expected in (('middle',3),('product-head-1',1)):
                status,authors=call('GET','/work-log-authors',who=who)
                check(who+' log directory includes indirect/direct subordinate demo authors',status==200 and len(authors.get('items',[]))>=expected)
            business=manifest['businessDate']
            for who in ('upper','middle','product-head-1','employee'):
                status,items=call('GET','/daily-items?date='+business+'&limit=100',who=who)
                status2,logs=call('GET','/work-logs?scope=self&limit=100',who=who)
                status3,notes=call('GET','/notifications?limit=100',who=who)
                check(who+' has own ranged/daily items, recent logs and notifications',
                      status==200 and len(items.get('items',[]))>=2 and status2==200 and len(logs.get('items',[]))>=3
                      and status3==200 and len(notes.get('items',[]))>=1,
                      {'items':len(items.get('items',[])),'logs':len(logs.get('items',[])),'notes':len(notes.get('items',[]))})
            check('default demo keeps freeze/delete-rebuild edge samples out of the mainline',
                  db.scalar('SELECT COUNT(*) FROM work_logs WHERE deleted_at IS NOT NULL')==0
                  and db.scalar('SELECT COUNT(*) FROM work_logs WHERE created_at < UTC_TIMESTAMP(6)-INTERVAL 25 HOUR')==0)
            for who,expected in (('upper',1),('middle',1),('product-head-1',1),('employee',1)):
                check(who+' has one independent calendar pin and one independent table pin',
                      db.scalar('SELECT COUNT(*) FROM user_task_pins p JOIN demo_seed_keys k ON k.object_id=p.task_id AND k.object_type=\'task\' WHERE p.user_id='+quote(ids[who]))==expected
                      and db.scalar('SELECT COUNT(*) FROM user_task_table_pins p JOIN demo_seed_keys k ON k.object_id=p.task_id AND k.object_type=\'task\' WHERE p.user_id='+quote(ids[who]))==expected
                      and db.scalar('SELECT COUNT(*) FROM user_task_pins p JOIN user_task_table_pins q ON q.user_id=p.user_id AND q.task_id=p.task_id WHERE p.user_id='+quote(ids[who]))==0)
            for who in ('upper','middle','product-head-1','employee'):
                check(who+' has a real hire date',db.scalar('SELECT COUNT(*) FROM users WHERE id='+quote(ids[who])+' AND hire_date IS NOT NULL')==1)
                check(who+' has 10-20 meaningful personally assigned tasks',
                      10 <= db.scalar('SELECT COUNT(DISTINCT t.id) FROM tasks t JOIN task_version_assignees a ON a.organization_id=t.organization_id AND a.version_id=t.current_version_id AND a.user_id='+quote(ids[who])) <= 20,
                      db.scalar('SELECT COUNT(DISTINCT t.id) FROM tasks t JOIN task_version_assignees a ON a.organization_id=t.organization_id AND a.version_id=t.current_version_id AND a.user_id='+quote(ids[who])))
                check(who+' has both read and unread multi-type notifications',
                      db.scalar('SELECT COUNT(*) FROM notifications WHERE recipient_id='+quote(ids[who])+' AND read_at IS NULL')>0
                      and db.scalar('SELECT COUNT(*) FROM notifications WHERE recipient_id='+quote(ids[who])+' AND read_at IS NOT NULL')>0)
            check('the four-role parent chain links leaf to team, department and founder tasks',
                  db.scalar("SELECT COUNT(*) FROM task_versions v JOIN demo_seed_keys l ON l.object_id=v.task_id AND l.seed_key='task-chain-leaf' JOIN demo_seed_keys p ON p.object_id=v.parent_task_id AND p.seed_key='task-chain-team'")==1
                  and db.scalar("SELECT COUNT(*) FROM task_versions v JOIN demo_seed_keys l ON l.object_id=v.task_id AND l.seed_key='task-chain-team' JOIN demo_seed_keys p ON p.object_id=v.parent_task_id AND p.seed_key='task-chain-middle'")==1
                  and db.scalar("SELECT COUNT(*) FROM task_versions v JOIN demo_seed_keys l ON l.object_id=v.task_id AND l.seed_key='task-chain-middle' JOIN demo_seed_keys p ON p.object_id=v.parent_task_id AND p.seed_key='task-chain-parent'")==1)
            objects=manifest['objects']
            check('dense/overlap/cross-year/zero-length extremes stay out of the default demo',
                  not any(key.startswith(('task-page-','task-overlap-','task-all-day-')) or key in
                          ('task-cross-year','task-midnight','task-point','task-full-coverage') for key in objects),
                  sorted(key for key in objects if key.startswith('task-')))
            check('the default demo keeps a small cross-month task for realistic range coverage',
                  'task-cross-month' in objects, objects.get('task-cross-month'))
            changed=call('GET','/tasks/'+task('takeover'),who='colleague')[1]
            status,result=call('PATCH','/tasks/'+task('takeover'),{'command':'change','description':'Persisted real demo edit','reason':'restart persistence'},'colleague',changed['rowVersion'])
            check('taken-over task edit requires operator manager',status==200 and result.get('outcome')=='pending')
            request=call('GET','/approval-requests/'+result['requestId'],who='product-head-1')[1]
            check('actual manager approves takeover owner edit',call('PATCH','/approval-requests/'+result['requestId'],{'decision':'approve'},'product-head-1',request['rowVersion'])[0]==200)
            status,history=call('GET','/admin/tasks/'+task('takeover')+'/history',who='admin')
            check('admin task history can trace takeover after restart',status==200 and 'business_takeover' in json.dumps(history))
            account=call('GET','/admin/account',who='admin')[1]
            status,result=call('PATCH','/admin/account',{'accountName':'demo-admin-edited','displayName':'Edited demo admin'},'admin',account['rowVersion'])
            check('administrator can persist a real account-name edit before repeat preparation',status==200)
        prepare(name,'owned-demo-v3',False,18194)
        check('repeat preparation preserves a real user edit instead of resetting demo data',db.rows('SELECT v.description FROM tasks t JOIN task_versions v ON v.id=t.current_version_id WHERE t.id='+quote(task('takeover')))==[['Persisted real demo edit']])
        check('repeat preparation preserves independent administrator account edits',db.rows('SELECT account_name,display_name FROM admin_accounts')==[['demo-admin-edited','Edited demo admin']])
        report['businessDate']=manifest['businessDate'];report['counts']=manifest['counts'];report['result']='PASS'
    except Exception as error:
        report['result']='FAIL';report['errorType']=type(error).__name__;raise
    finally:
        admin.server_side(f'DROP DATABASE IF EXISTS `{name}`')
        OUTPUT.parent.mkdir(parents=True,exist_ok=True);OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
