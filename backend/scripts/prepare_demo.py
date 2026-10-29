#!/usr/bin/env python3
"""Prepare only an explicitly selected, marker-guarded demo database. Never clears data.

First run on an empty database:
  python3 backend/scripts/prepare_demo.py --database pandora_demo --demo-marker local-web-v2 --initialize
Repeat without --initialize. The marker and manifest version must match on every run.
The command owns a short-lived packaged service; it does not touch the normal application process.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.request
from migration_precheck import BASE, Mysql, DEFAULT_OPTION_FILE, cell
from fixed_model_fixture import quote


def database_env():
    values={}
    for line in (BASE/'.runtime/database.env').read_text().splitlines():
        if '=' in line:
            key,value=line.split('=',1);values[key]=value
    return values


def manifest(db):
    identity=db.rows('SELECT database_name,manifest_version,business_date,prepared_at FROM demo_database_identity WHERE singleton=1')
    people={}
    for key,object_id,kind,phone,account in db.rows(
            "SELECT k.seed_key,k.object_id,k.object_type,u.login_phone,a.account_name FROM demo_seed_keys k "
            "LEFT JOIN users u ON u.id=k.object_id AND k.object_type='employee' "
            "LEFT JOIN admin_accounts a ON a.id=k.object_id AND k.object_type='admin' "
            "WHERE k.object_type IN ('employee','admin') ORDER BY k.seed_key"):
        people[key]={'id':object_id,'accountType':kind,'identifier':cell(phone) or cell(account)}
    keys={key:{'id':obj,'type':kind} for key,obj,kind in db.rows('SELECT seed_key,object_id,object_type FROM demo_seed_keys ORDER BY seed_key')}
    return {'updated':dt.datetime.now(dt.timezone.utc).isoformat(),
            'database':db.database,'manifestVersion':int(identity[0][1]),'businessDate':identity[0][2],
            'preparedAt':identity[0][3],'identities':people,'objects':keys,
            'counts':{table:db.scalar('SELECT COUNT(*) FROM '+table) for table in
                      ('users','admin_accounts','employee_placements','departments','teams','tasks','task_versions',
                       'approval_requests','work_logs','home_items','task_business_transfers','handover_requests','task_log_comments','notifications')}}


def prepare(database,marker,initialize=False,port=18194,output=None):
    if not re.fullmatch(r'[A-Za-z0-9_]{1,64}',database) or not marker or len(marker)>100:
        raise ValueError('Explicit safe database name and nonempty demo marker are required')
    admin=Mysql(None,DEFAULT_OPTION_FILE);db=Mysql(database,DEFAULT_OPTION_FILE)
    if not admin.scalar('SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='+quote(database)):
        raise ValueError('Target database must already exist; this command never creates or drops databases')
    present={row[0] for row in db.rows('SHOW TABLES')}
    already_prepared=False
    if present:
        if 'demo_database_identity' not in present:
            raise ValueError('Target has existing data but no demo identity; refusing preparation')
        identity=db.rows('SELECT database_name,marker,manifest_version FROM demo_database_identity WHERE singleton=1')
        if identity:
            if identity[0]!=[database,marker,'2']:raise ValueError('Target demo identity does not match')
            already_prepared=bool(db.scalar('SELECT COUNT(*) FROM demo_database_identity WHERE prepared_at IS NOT NULL'))
        elif not initialize or ('organizations' in present and db.scalar('SELECT COUNT(*) FROM organizations')):
            raise ValueError('An empty target and --initialize are required for first preparation')
    elif not initialize:raise ValueError('First preparation requires --initialize')
    values=database_env()
    env={**os.environ,**values,'PANDORA_DB_URL':f'jdbc:mysql://127.0.0.1:13306/{database}?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true&allowPublicKeyRetrieval=true&sslMode=DISABLED',
         'PANDORA_PORT':str(port),'PANDORA_BIND_ADDRESS':'127.0.0.1','PANDORA_SEED':'true','PANDORA_WORKER_ENABLED':'true'}
    log_path=BASE/'.runtime/demo-prepare.log'
    args=['java','-jar',str(BASE/'target/pandora-backend-0.1.0.jar'),'--pandora.demo-target='+database,
          '--pandora.demo-marker='+marker,'--pandora.demo-initialize='+str(initialize).lower(),
          '--pandora.worker.initial-delay-ms=3600000','--pandora.worker.delay-ms=3600000']
    process=None
    try:
        with log_path.open('w') as log:process=subprocess.Popen(args,env=env,stdout=log,stderr=subprocess.STDOUT)
        for _ in range(240):
            if process.poll() is not None:raise RuntimeError('Preparation failed; see '+str(log_path))
            present={row[0] for row in db.rows('SHOW TABLES')}
            if 'demo_database_identity' in present and db.scalar('SELECT COUNT(*) FROM demo_database_identity WHERE prepared_at IS NOT NULL'):
                try:
                    with urllib.request.urlopen(f'http://127.0.0.1:{port}/health',timeout=1) as response:
                        if response.status==200:break
                except OSError:pass
            time.sleep(.5)
        else:raise RuntimeError('Preparation timeout; see '+str(log_path))
        # Only a new seed needs delivery. Repeated preparation must also work after the real
        # administrator has changed their name/password; never reset credentials to drain events.
        if not already_prepared:
            data=json.dumps({'accountType':'admin','accountName':'admin','password':env.get('PANDORA_DEMO_PASSWORD','Demo@123456')}).encode()
            with urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{port}/api/v1/auth/sessions',data=data,headers={'Content-Type':'application/json'})) as response:
                token=json.load(response)['token']
            for _ in range(10):
                if db.scalar("SELECT COUNT(*) FROM domain_events WHERE status='pending'")==0:break
                request=urllib.request.Request(f'http://127.0.0.1:{port}/api/v1/admin/worker/run-once',data=b'{}',headers={'Content-Type':'application/json','Authorization':'Bearer '+token,'Idempotency-Key':'demo-drain-'+str(time.time_ns())})
                with urllib.request.urlopen(request) as response:response.read()
        result=manifest(db)
        if output:
            output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');output.chmod(0o600)
        print(json.dumps({'database':database,'manifestVersion':2,'businessDate':result['businessDate'],'counts':result['counts']},ensure_ascii=False))
        return result
    finally:
        if process and process.poll() is None:
            process.terminate()
            try:process.wait(timeout=10)
            except subprocess.TimeoutExpired:process.kill();process.wait(timeout=10)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database',required=True)
    parser.add_argument('--demo-marker',required=True)
    parser.add_argument('--initialize',action='store_true')
    parser.add_argument('--port',type=int,default=18194)
    parser.add_argument('--output',type=Path,default=BASE/'.runtime/demo-manifest.json')
    args=parser.parse_args()
    prepare(args.database,args.demo_marker,args.initialize,args.port,args.output)
    return 0
if __name__=='__main__':raise SystemExit(main())
