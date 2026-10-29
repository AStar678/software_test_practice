#!/usr/bin/env python3
"""Real Flyway fresh/V20 upgrade, admin conflict, constraint parity and backup recovery rehearsal."""
import datetime as dt
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import uuid
from migration_precheck import BASE, Mysql, MysqlError, DEFAULT_OPTION_FILE, fingerprint
from fixed_model_fixture import quote
from prepare_demo import database_env
from flyway_migrate import migrate

OUTPUT=BASE.parent/'audit/refactor-pandora-organization-and-workflows/final-migration.json'


def structure(db):
    result={}
    for name,fields,order in (
        ('columns','table_name,column_name,column_type,is_nullable,column_default,extra,generation_expression','table_name,ordinal_position'),
        ('statistics','table_name,index_name,non_unique,seq_in_index,column_name,collation,sub_part,index_type','table_name,index_name,seq_in_index'),
        ('key_column_usage','table_name,constraint_name,column_name,ordinal_position,referenced_table_name,referenced_column_name','table_name,constraint_name,ordinal_position'),
        ('check_constraints','constraint_name,check_clause','constraint_name')):
        column='constraint_schema' if name in ('key_column_usage','check_constraints') else 'table_schema'
        result[name]=db.rows('SELECT '+fields+' FROM information_schema.'+name+' WHERE '+column+'=DATABASE() ORDER BY '+order)
    return result

def main():
    admin=Mysql(None,DEFAULT_OPTION_FILE);names=['pandora_precheck_final_'+uuid.uuid4().hex[:12] for _ in range(4)]
    fresh,upgrade,recovered,conflict=[Mysql(name,DEFAULT_OPTION_FILE) for name in names]
    report={'updated':dt.datetime.now(dt.timezone.utc).isoformat(),'serverVersion':admin.rows('SELECT VERSION()')[0][0],'checks':[]}
    def check(name,condition):
        report['checks'].append({'check':name,'pass':bool(condition)});print(('PASS ' if condition else 'FAIL ')+name,flush=True)
        if not condition:raise AssertionError(name)
    def legacy(db):
        db.server_side("INSERT INTO organizations(id,name) VALUES('o','Upgrade')")
        db.server_side("INSERT INTO users(id,organization_id,username,password_hash,display_name,role,rank_level,phone,login_phone) VALUES('employee','o','legacy-private-name','unchanged-hash','Person','lower',3,'13977770001','13977770001'),('admin','o','upgrade-admin','unchanged-admin-hash','Admin','admin',0,NULL,NULL)")
        db.server_side("INSERT INTO audit_logs(id,organization_id,actor_id,action,details_json) VALUES('audit','o','admin','historical','{}')")
        db.server_side("INSERT INTO tasks(id,organization_id,original_creator_id) VALUES('task','o','employee')")
        db.server_side("INSERT INTO work_logs(id,organization_id,author_id,business_date,body) VALUES('log','o','employee','2026-10-28','original body')")
    try:
        values=database_env()
        for name in names:
            admin.server_side(f'CREATE DATABASE `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
            for host in ('localhost','127.0.0.1'):
                admin.server_side(f'GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,REFERENCES,DROP ON `{name}`.* TO '+quote(values['PANDORA_DB_USER'])+'@'+quote(host))
        subprocess.run([sys.executable,str(BASE/'scripts/flyway_migrate.py'),'--database',fresh.database,'--target','26','--log',str(OUTPUT.with_suffix('.log'))],check=True)
        check('empty database completes the full Flyway chain',fresh.rows('SELECT MAX(CAST(version AS UNSIGNED)) FROM flyway_schema_history')[0][0]=='26')
        migrate(upgrade,20);legacy(upgrade)
        before={table:upgrade.rows(query) for table,query in {
            'employee':"SELECT id,password_hash,created_at FROM users WHERE id='employee'",
            'task':'SELECT id,original_creator_id,created_at FROM tasks','log':'SELECT id,author_id,business_date,body,created_at FROM work_logs',
            'adminAudit':'SELECT id,actor_id,action,created_at FROM audit_logs'}.items()}
        with tempfile.TemporaryDirectory(prefix='pandora-backup-') as temporary:
            backup=Path(temporary)/'before.sql'
            with backup.open('w') as stream:
                subprocess.run(['mysqldump','--defaults-file='+str(DEFAULT_OPTION_FILE),'--no-tablespaces','--single-transaction','--set-gtid-purged=OFF','--column-statistics=0',upgrade.database],stdout=stream,stderr=subprocess.PIPE,text=True,check=True)
            before_fingerprint=fingerprint(upgrade)
            admin.import_sql(backup,recovered.database)
            check('backup restores an independent V20 database with identical row fingerprints',fingerprint(recovered)['digest']==before_fingerprint['digest'])
            report['backupSha256']=hashlib.sha256(backup.read_bytes()).hexdigest()
        migrate(upgrade)
        check('fresh and upgraded columns, FK, indexes, unique keys and CHECK constraints are identical',structure(fresh)==structure(upgrade))
        OUTPUT.with_name('final-schema.json').write_text(json.dumps(structure(upgrade),indent=2)+'\n')
        after={table:upgrade.rows(query) for table,query in {
            'employee':"SELECT id,password_hash,created_at FROM users WHERE id='employee'",
            'task':'SELECT id,original_creator_id,created_at FROM tasks','log':'SELECT id,author_id,business_date,body,created_at FROM work_logs',
            'adminAudit':'SELECT id,actor_id,action,created_at FROM audit_logs'}.items()}
        check('upgrade preserves stable employee/task/log/admin-audit IDs, original hashes, text and creation times',before==after)
        check('independent administrator extraction preserves identity without an employee row',upgrade.rows("SELECT id,account_name,password_hash FROM admin_accounts")==[['admin','upgrade-admin','unchanged-admin-hash']] and upgrade.scalar("SELECT COUNT(*) FROM users WHERE id='admin'")==0)
        check('historical admin audit still resolves through principals',upgrade.scalar("SELECT COUNT(*) FROM audit_logs a JOIN principals p ON p.id=a.actor_id WHERE p.account_type='admin'")==1)
        check('upgrade does not infer an arbitrary founder or placement',upgrade.scalar('SELECT COUNT(*) FROM employee_placements')==0 and upgrade.scalar('SELECT COUNT(*) FROM organizations WHERE founder_employee_id IS NOT NULL')==0)
        columns={row[0] for row in upgrade.rows("SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users'")}
        check('final employee schema has no username, role, rank or editable organization chain',not columns.intersection(('username','role','rank_level','manager_id','department_id','team_id','position_id')))
        check('final schema removes old role grants and username mappings',not {row[0] for row in upgrade.rows('SHOW TABLES')}.intersection(('roles','role_scopes','role_capabilities','user_role_grants','organization_mapping_config')))
        try:upgrade.server_side("INSERT INTO users(id,organization_id,password_hash,display_name) VALUES('admin','o','x','Not staff')")
        except MysqlError as error:check('SQL rejects a pseudo employee for an admin principal','1452' in str(error))
        else:check('SQL rejects a pseudo employee for an admin principal',False)
        migrate(conflict,20);legacy(conflict)
        conflict.server_side("INSERT INTO work_logs(id,organization_id,author_id,business_date,body) VALUES('admin-business','o','admin','2026-10-28','must retain')")
        result=migrate(conflict,expected=False)
        check('unresolvable admin business history blocks final cleanup',result.returncode!=0 and conflict.scalar("SELECT COUNT(*) FROM migration_findings WHERE category='admin_business_reference' AND resolved_at IS NULL")>0)
        check('blocked cleanup retains old administrator identity and real business source for repair',conflict.rows("SELECT username FROM users WHERE id='admin'")==[['upgrade-admin']] and conflict.rows("SELECT body FROM work_logs WHERE id='admin-business'")==[['must retain']])
        history=BASE/'src/main/resources/db/migration'
        checksums={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in history.glob('V*__*.sql') if int(p.name.split('__')[0][1:])<=20}
        check('V1-V20 files match the committed historical versions',all(subprocess.run(['git','show','HEAD:backend/src/main/resources/db/migration/'+name],cwd=BASE,capture_output=True,check=True).stdout==(history/name).read_bytes() for name in checksums))
        report['historicalChecksums']=checksums
        report['databases']=names;report['result']='PASS'
    except Exception as error:
        report['result']='FAIL';report['errorType']=type(error).__name__;raise
    finally:
        for name in names:admin.server_side(f'DROP DATABASE IF EXISTS `{name}`')
        OUTPUT.parent.mkdir(parents=True,exist_ok=True);OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
