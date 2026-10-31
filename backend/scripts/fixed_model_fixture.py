"""Disposable real-service fixture for the fixed organization contract (never a normal database).

This helper owns its random database and process. Public test credentials never enter reports.
"""
from __future__ import annotations
import contextlib
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from migration_precheck import BASE, DEFAULT_OPTION_FILE, Mysql

PASSWORD='Fixture@123456'

def quote(value):
    if value is None: return 'NULL'
    return "'"+str(value).replace('\\','\\\\').replace("'","''")+"'"

class Fixture:
    def __init__(self,port=18175,worker=False,controllable=False):
        self.worker=worker
        self.controllable=controllable
        self.database='pandora_precheck_model_'+uuid.uuid4().hex[:16]
        self.admin=Mysql(None,DEFAULT_OPTION_FILE)
        self.db=Mysql(self.database,DEFAULT_OPTION_FILE)
        self.port=port
        self.base=f'http://127.0.0.1:{port}/api/v1'
        self.process=None
        self.identities={}
        self.log_path=BASE.parent/'audit/refactor-pandora-organization-and-workflows/account-service.log'
    def call(self,method,path,body=None,token=None,key=None,version=None):
        headers={'Content-Type':'application/json'}
        if token: headers['Authorization']='Bearer '+token
        if key: headers['Idempotency-Key']=key
        if version is not None: headers['If-Match']='"'+str(version)+'"'
        request=urllib.request.Request(self.base+path,data=None if body is None else json.dumps(body).encode(),headers=headers,method=method)
        try:
            with urllib.request.urlopen(request,timeout=20) as response:
                return response.status,json.loads(response.read() or '{}')
        except urllib.error.HTTPError as error:
            return error.code,json.loads(error.read() or '{}')
    def login(self,key,password=PASSWORD):
        person=self.identities[key]
        body={'accountType':person['accountType'],'password':password}
        body['accountName' if person['accountType']=='admin' else 'phone']=person['identifier']
        return self.call('POST','/auth/sessions',body)
    def __enter__(self):
        # Fail before creating data if another fixture still owns the requested port.
        import socket
        with socket.socket() as probe:
            probe.settimeout(.3)
            if probe.connect_ex(('127.0.0.1', self.port)) == 0:
                raise RuntimeError('fixture port already in use: '+str(self.port))
        self.admin.server_side(f'CREATE DATABASE `{self.database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
        try:
            values={}
            for line in (BASE/'.runtime/database.env').read_text().splitlines():
                if '=' in line:
                    key,value=line.split('=',1);values[key]=value
            for host in ('localhost','127.0.0.1'):
                self.admin.server_side(f'GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,REFERENCES,DROP ON `{self.database}`.* TO '+quote(values['PANDORA_DB_USER'])+'@'+quote(host))
            env=dict(os.environ)
            env.update(values)
            env.update(PANDORA_DB_URL=f'jdbc:mysql://127.0.0.1:13306/{self.database}?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true&allowPublicKeyRetrieval=true&sslMode=DISABLED',
                       PANDORA_PORT=str(self.port),PANDORA_BIND_ADDRESS='127.0.0.1',PANDORA_SEED='false',
                       PANDORA_WORKER_ENABLED='true' if self.worker else 'false')
            args=['java','-jar',str(BASE/'target/pandora-backend-0.1.0.jar')]
            if getattr(self, 'migration_target', None):
                args.append('--spring.flyway.target='+str(self.migration_target))
            if self.controllable:
                # Keep the scheduler quiet; verification calls POST /admin/worker/run-once.
                args += ['--pandora.clock.controllable=true','--pandora.worker.delay-ms=3600000',
                         '--pandora.worker.initial-delay-ms=3600000']
            self.log_path.parent.mkdir(parents=True,exist_ok=True)
            self.launch_env, self.launch_args = env, args
            with self.log_path.open('w') as log:
                self.process=subprocess.Popen(args,env=env,stdout=log,stderr=subprocess.STDOUT)
            for _ in range(120):
                if self.process.poll() is not None: raise RuntimeError('fixture service failed; see '+str(self.log_path))
                try:
                    with urllib.request.urlopen(f'http://127.0.0.1:{self.port}/health',timeout=1) as response:
                        if response.status==200: break
                except (OSError,urllib.error.URLError): pass
                time.sleep(.5)
            else: raise RuntimeError('fixture service startup timed out')
            self.seed()
            return self
        except BaseException:
            self.__exit__(None,None,None)
            raise
    def __exit__(self,*args):
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try: self.process.wait(timeout=10)
            except subprocess.TimeoutExpired: self.process.kill();self.process.wait(timeout=10)
        self.admin.server_side(f'DROP DATABASE IF EXISTS `{self.database}`')
    def restart(self):
        """Restart this fixture only, allowing the next Flyway migration to run."""
        self.process.terminate()
        self.process.wait(timeout=20)
        args=[arg for arg in self.launch_args if not arg.startswith('--spring.flyway.target=')]
        with self.log_path.open('a') as log:
            self.process=subprocess.Popen(args,env=self.launch_env,stdout=log,stderr=subprocess.STDOUT)
        for _ in range(120):
            if self.process.poll() is not None: raise RuntimeError('fixture restart failed; see '+str(self.log_path))
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{self.port}/health',timeout=1) as response:
                    if response.status==200: return
            except (OSError,urllib.error.URLError): pass
            time.sleep(.5)
        raise RuntimeError('fixture restart timed out')
    def seed(self):
        encoded=subprocess.run(['htpasswd','-bnBC','12','fixture',PASSWORD],capture_output=True,text=True,check=True).stdout.strip().split(':',1)[1]
        encoded=encoded.replace('$2y$','$2a$')
        for org,base_phone in (('fixture-company',13900000000),('other-company',13900000100)):
            self.db.server_side('INSERT INTO organizations(id,name) VALUES('+quote(org)+','+quote(org)+')')
            self.db.server_side('INSERT INTO positions(id,organization_id,name) VALUES('+quote(org+'-title')+','+quote(org)+",'Display title')")
            admin_id=org+'-admin'
            self.db.server_side('INSERT INTO principals(id,organization_id,account_type) VALUES('+quote(admin_id)+','+quote(org)+",'admin')")
            self.db.server_side('INSERT INTO admin_accounts(id,organization_id,account_name,password_hash,display_name) VALUES('
                               +','.join(map(quote,(admin_id,org,admin_id,encoded,'Administrator')))+')')
            self.identities['admin' if org=='fixture-company' else 'other-admin']={'id':admin_id,'accountType':'admin','identifier':admin_id,'organizationId':org}
            people=[('founder','founder',None,None)]
            if org=='fixture-company':
                for dep in ('alpha','beta'):
                    department=org+'-'+dep
                    self.db.server_side('INSERT INTO departments(id,organization_id,name) VALUES('+','.join(map(quote,(department,org,dep)))+')')
                    people.append((dep+'-head','department_head',department,None))
                    for group in ('one','two'):
                        team=department+'-'+group
                        self.db.server_side('INSERT INTO teams(id,organization_id,department_id,name) VALUES('+','.join(map(quote,(team,org,department,dep+' '+group)))+')')
                        people.extend([(dep+'-'+group+'-head','team_head',department,team),(dep+'-'+group+'-employee','employee',department,team)])
            for index,(key,kind,dep,team) in enumerate(people,1):
                employee_id=str(uuid.uuid5(uuid.NAMESPACE_URL,'pandora.fixture/'+org+'/'+key))
                phone=str(base_phone+index)
                self.db.server_side('INSERT INTO principals(id,organization_id,account_type) VALUES('+quote(employee_id)+','+quote(org)+",'employee')")
                columns=['id','organization_id','password_hash','display_name','phone','login_phone']
                vals=[employee_id,org,encoded,key,phone,phone]
                self.db.server_side('INSERT INTO users('+','.join(columns)+') VALUES('+','.join(map(quote,vals))+')')
                self.db.server_side('INSERT INTO employee_placements(organization_id,employee_id,placement_type,department_id,team_id,position_id) VALUES('
                                   +','.join(map(quote,(org,employee_id,kind,dep,team,org+'-title')))+')')
                self.identities[key if org=='fixture-company' else 'other-'+key]={'id':employee_id,'accountType':'employee','identifier':phone,'organizationId':org}
                if kind=='founder': self.db.server_side('UPDATE organizations SET founder_employee_id='+quote(employee_id)+' WHERE id='+quote(org))
