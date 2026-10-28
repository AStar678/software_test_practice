#!/usr/bin/env python3
"""Fixed organization contact privacy and administrator phone maintenance in a disposable service."""
import datetime as dt
import json
import uuid
from fixed_model_fixture import Fixture, quote
from migration_precheck import BASE

OUTPUT=BASE.parent/'audit/refactor-pandora-organization-and-workflows/profile-phone-matrix.json'

def main():
    report={'updated':dt.datetime.now(dt.timezone.utc).isoformat(),'checks':[]}
    def check(name,condition,evidence=None):
        report['checks'].append({'check':name,'pass':bool(condition),'evidence':evidence})
        print(('PASS ' if condition else 'FAIL ')+name,flush=True)
        if not condition: raise AssertionError(name)
    fixture=Fixture(port=18179);fixture.log_path=OUTPUT.with_name('profile-phone-service.log')
    try:
        with fixture as f:
            tokens={key:f.login(key)[1]['token'] for key in f.identities}
            ids={key:value['id'] for key,value in f.identities.items()}
            target=ids['alpha-one-employee'];old_phone=f.identities['alpha-one-employee']['identifier']
            for reader,allowed in (('founder',True),('alpha-head',True),('alpha-one-head',True),('alpha-one-employee',True),
                    ('alpha-two-employee',False),('alpha-two-head',False),('beta-head',False),('other-founder',False),('admin',False)):
                status,result=f.call('GET','/users/'+target,token=tokens[reader])
                check(reader+' contact detail follows actual management relationship',
                      (status==200 and result.get('phone')==old_phone and 'email' not in result and 'username' not in result) if allowed else status in (403,404))
            for who,path in (('founder','/users?limit=100'),('alpha-head','/work-log-authors'),('alpha-one-employee','/assignee-candidates?purpose=create'),
                    ('alpha-one-employee','/assignee-candidates?purpose=edit'),('admin','/admin/employees'),('admin','/admin/organization-plans')):
                status,result=f.call('GET',path,token=tokens[who])
                check(path+' summary has no contact, credential or username fields',status==200 and not any(field in json.dumps(result) for field in ('"phone"','"loginPhone"','"email"','"username"','"passwordHash"')))
            token=tokens['alpha-one-employee']
            status,profile=f.call('GET','/me/profile',token=token)
            for body in ({'phone':'13988880001'},{'displayName':'Injected'},{'email':'self@private.example.test','phone':'13988880001'}):
                status,_=f.call('PATCH','/me/profile',body,token,'deny-'+uuid.uuid4().hex,profile['rowVersion'])
                check('self identity or mixed payload is rejected: '+','.join(body),status==400)
            status,_=f.call('PATCH','/me/profile',{'avatar':'cat','email':'self@private.example.test'},token,'self-'+uuid.uuid4().hex,profile['rowVersion'])
            check('self avatar and email remain editable',status==200)
            check('even actual manager cannot read another employee email','email' not in f.call('GET','/users/'+target,token=tokens['alpha-head'])[1])
            check('administrator cannot edit employee email',f.call('PATCH','/admin/employees/'+target,{'email':'forged@example.test'},tokens['admin'],'deny-email-'+uuid.uuid4().hex,1)[0]==400)
            for phone in (None,'','invalid',f.identities['beta-one-employee']['identifier']):
                status,_=f.call('PATCH','/admin/employees/'+target,{'phone':phone},tokens['admin'],'deny-phone-'+uuid.uuid4().hex,1)
                check('empty, invalid or occupied login phone is rejected',status in (400,409))
            second=f.login('alpha-one-employee')[1]['token']
            body={'phone':'+86 (139) 8888-0001','displayName':'Administrator renamed employee'}
            status,receipt=f.call('PATCH','/admin/employees/'+target,body,tokens['admin'],'phone-'+uuid.uuid4().hex,1)
            check('administrator normalized phone/name command succeeds with contact-free receipt',status==200 and not any(key in receipt for key in ('phone','loginPhone','email')))
            check('phone change revokes all employee sessions',f.call('GET','/auth/session',token=token)[0]==401 and f.call('GET','/auth/session',token=second)[0]==401)
            check('old phone cannot log in after change',f.login('alpha-one-employee')[0]==401)
            status,session=f.call('POST','/auth/sessions',{'accountType':'employee','phone':'+8613988880001','password':'Fixture@123456'})
            check('new normalized phone logs into same stable ID',status==200 and session.get('user',{}).get('id')==target)
            for table,column in (('audit_logs','details_json'),('domain_events','details_json'),('idempotency_keys','response_json')):
                check(table+' never captures employee contact values',f.db.scalar('SELECT COUNT(*) FROM '+table+' WHERE CAST('+column+" AS CHAR) LIKE '%13988880001%' OR CAST("+column+" AS CHAR) LIKE '%self@private.example.test%'")==0)
            report['result']='PASS'
    except BaseException as error:
        report['result']='FAIL';report['errorType']=type(error).__name__;raise
    finally:
        OUTPUT.parent.mkdir(parents=True,exist_ok=True);OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__': main()
