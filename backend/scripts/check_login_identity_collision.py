#!/usr/bin/env python3
"""Real JAR checks for strict employee/admin namespaces and password sessions in a disposable DB.

Run from the project root after building the backend. Uses fixed_model_fixture.py and the private
local MySQL option file. Every database mutation is confined to that helper's random scratch DB.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
from pathlib import Path
from fixed_model_fixture import Fixture, PASSWORD, quote
from migration_precheck import BASE


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=BASE.parent/'audit/refactor-pandora-organization-and-workflows/account-contract.json')
    args=parser.parse_args()
    report={'updated':dt.datetime.now(dt.timezone.utc).isoformat(),'checks':[]}
    def check(name,condition,evidence=None):
        report['checks'].append({'check':name,'pass':bool(condition),'evidence':evidence})
        print(('PASS ' if condition else 'FAIL ')+name,flush=True)
        if not condition: raise AssertionError(name)
    try:
        with Fixture() as fixture:
            report['database']=fixture.database
            check('all current Flyway migrations applied to an empty isolated database',fixture.db.scalar('SELECT MAX(CAST(version AS UNSIGNED)) FROM flyway_schema_history WHERE success=1')>=23)
            employee=fixture.identities['alpha-one-employee']
            admin=fixture.identities['admin']
            status,employee_session=fixture.login('alpha-one-employee')
            check('employee phone login establishes the original employee principal',status==200 and employee_session.get('user',{}).get('id')==employee['id'],{'status':status})
            check('employee session carries fixed position and no employee username',employee_session['user']['role']=='employee' and 'username' not in employee_session['user'])
            employee_token=employee_session['token']
            status,admin_session=fixture.login('admin')
            check('independent administrator authenticates without a user row',status==200 and fixture.db.scalar('SELECT COUNT(*) FROM users WHERE id='+quote(admin['id']))==0,{'status':status})
            check('administrator has no employee organization placement',all(admin_session['user'].get(k) is None for k in ('departmentId','teamId','positionId','managerId')))
            admin_token=admin_session['token']
            for key,role in (('founder','founder'),('alpha-head','department_head'),('alpha-one-head','team_head')):
                status,session=fixture.login(key)
                check('real '+role+' identity comes from fixed placement',status==200 and session.get('user',{}).get('role')==role,{'status':status})
            for invalid in ({'username':employee['identifier'],'password':PASSWORD},
                            {'phone':employee['identifier'],'password':PASSWORD},
                            {'accountType':'employee','username':employee['identifier'],'password':PASSWORD},
                            {'accountType':'employee','phone':employee['identifier'],'accountName':admin['identifier'],'password':PASSWORD},
                            {'accountType':'admin','phone':employee['identifier'],'password':PASSWORD},
                            {'accountType':'unknown','phone':employee['identifier'],'password':PASSWORD}):
                before=fixture.db.scalar('SELECT COUNT(*) FROM auth_sessions')
                status,body=fixture.call('POST','/auth/sessions',invalid)
                check('old/missing/mixed login payload is rejected without a session: '+','.join(sorted(invalid)),
                      status==400 and body.get('code')=='INVALID_LOGIN_CONTRACT' and before==fixture.db.scalar('SELECT COUNT(*) FROM auth_sessions'),{'status':status,'code':body.get('code')})
            fixture.db.server_side('UPDATE admin_accounts SET account_name='+quote(employee['identifier'])+' WHERE id='+quote(admin['id']))
            admin['identifier']=employee['identifier']
            status,shared_admin=fixture.login('admin')
            check('same identifier and password explicitly choose admin namespace',status==200 and shared_admin['user']['id']==admin['id'],{'status':status})
            status,body=fixture.login('alpha-one-employee')
            check('same identifier and password explicitly choose employee namespace',status==200 and body['user']['id']==employee['id'],{'status':status})
            fixture.db.server_side('ALTER TABLE users DROP INDEX uq_users_login_phone')
            other=fixture.identities['other-founder']
            fixture.db.server_side('UPDATE users SET login_phone='+quote(employee['identifier'])+' WHERE id='+quote(other['id']))
            status,body=fixture.login('alpha-one-employee')
            check('duplicate employee phone across companies is refused',status==409 and body.get('code')=='LOGIN_KEY_AMBIGUOUS',{'status':status,'code':body.get('code')})
            status,body=fixture.login('admin')
            check('duplicate employee keys never prevent explicit admin repair login',status==200 and body['user']['id']==admin['id'],{'status':status})
            fixture.db.server_side('UPDATE users SET login_phone='+quote(other['identifier'])+' WHERE id='+quote(other['id']))
            fixture.db.server_side('ALTER TABLE users ADD UNIQUE KEY uq_users_login_phone(login_phone)')
            status,body=fixture.call('GET','/tasks',token=admin_token)
            check('administrator has no employee business API access',status==403,{'status':status})
            status,body=fixture.call('GET','/admin/employees',token=employee_token)
            check('employee has no admin API access',status==403,{'status':status})
            status,body=fixture.call('GET','/admin/employees/'+other['id'],token=admin_token)
            check('admin employee lookup remains company isolated',status==404,{'status':status})
            status,structure=fixture.call('GET','/admin/organization',token=admin_token)
            check('fixed company and independent admin satisfy readiness without legacy departments',
                  status==200 and structure.get('constraints',{}).get('formalWritesReady') is True,{'status':status})
            founder_id=fixture.identities['founder']['id']
            fixture.db.server_side("UPDATE organizations SET founder_employee_id=NULL WHERE id='fixture-company'")
            status,blocked=fixture.call('GET','/tasks',token=employee_token)
            check('missing explicit founder blocks normal business even for a previously valid session',
                  status==409 and blocked.get('code')=='ORGANIZATION_MAPPING_INCOMPLETE',{'status':status,'code':blocked.get('code')})
            check('admin repair read remains available while employee organization is blocked',fixture.call('GET','/admin/organization',token=admin_token)[0]==200)
            fixture.db.server_side("UPDATE organizations SET founder_employee_id="+quote(founder_id)+" WHERE id='fixture-company'")
            check('repair restores business access without runtime DDL or guessed identity',fixture.call('GET','/tasks',token=employee_token)[0]==200)
            for key in ('founder','alpha-head','alpha-one-head','alpha-one-employee'):
                layer_token=fixture.login(key)[1]['token']
                check(key+' cannot use former employee team maintenance',fixture.call('GET','/me/team-management',token=layer_token)[0]==403)
                check(key+' cannot write old admin team or role interfaces',
                      fixture.call('POST','/admin/teams',{},layer_token,'reject-team-'+key)[0]==403
                      and fixture.call('POST','/admin/employees/'+employee['id']+'/roles',{},layer_token,'reject-roles-'+key)[0]==403)
            status,_=fixture.call('PATCH','/admin/roles/employee/scopes',{'scopes':{'task_view':'company'}},admin_token,'retired-admin-roles')
            check('old custom authorization write is retired even for administrators',status==410,{'status':status})
            status,profile=fixture.call('GET','/me/profile',token=employee_token)
            check('self profile shows fixed position and contact only through its authorized endpoint',status==200 and profile.get('role')=='employee' and 'username' not in profile,{'status':status})
            for body in ({'phone':'13955551111'},{'displayName':'Injected'},{'email':'self@example.test','phone':'13955551111'}):
                status,_=fixture.call('PATCH','/me/profile',body,employee_token,'reject-profile-'+str(len(body))+next(iter(body)),profile.get('rowVersion'))
                check('employee identity or mixed identity/profile request is rejected: '+','.join(body),status==400,{'status':status})
            status,_=fixture.call('PATCH','/me/profile',{'avatar':'bear','email':'self@example.test'},employee_token,'self-profile-edit',profile.get('rowVersion'))
            check('self avatar and email remain editable',status==200,{'status':status})
            check('admin cannot change another employee email',fixture.call('PATCH','/admin/employees/'+employee['id'],{'email':'other@example.test'},admin_token,'reject-admin-email',1)[0]==400)
            old_token=fixture.login('alpha-one-employee')[1]['token']
            new_phone='139 5555 1111'
            status,receipt=fixture.call('PATCH','/admin/employees/'+employee['id'],{'displayName':'Renamed employee','phone':new_phone},admin_token,'admin-phone-change',1)
            check('admin phone/name change returns a receipt without contact values',status==200 and not any(k in receipt for k in ('phone','loginPhone','email')),{'status':status})
            check('admin phone change revokes existing employee sessions',fixture.call('GET','/auth/session',token=old_token)[0]==401)
            check('old phone no longer logs in after admin change',fixture.login('alpha-one-employee')[0]==401)
            employee['identifier']='13955551111'
            status,new_session=fixture.login('alpha-one-employee')
            check('normalized new phone logs into the same stable employee ID',status==200 and new_session.get('user',{}).get('id')==employee['id'],{'status':status})
            employee_session=new_session
            # The identity command saved its result under version 2. Any later permission version
            # invalidates that cache before its old success payload can be returned.
            fixture.db.server_side("UPDATE organizations SET authz_version=authz_version+1 WHERE id='fixture-company'")
            status,stale=fixture.call('PATCH','/admin/employees/'+employee['id'],{'displayName':'Renamed employee','phone':new_phone},admin_token,'admin-phone-change',1)
            check('authorization version is checked before replaying an old success',status==409 and stale.get('code')=='AUTHORIZATION_CHANGED',{'status':status,'code':stale.get('code')})
            for key,session in (('admin',shared_admin),('alpha-one-employee',employee_session)):
                status,refreshed=fixture.call('POST','/auth/sessions/refresh',{},session['token'])
                check(key+' refresh preserves selected account type',status==200 and refreshed['user']['accountType']==fixture.identities[key]['accountType'],{'status':status})
                check(key+' refresh consumes its previous token',fixture.call('GET','/auth/session',token=session['token'])[0]==401)
                check(key+' logout revokes refreshed token',fixture.call('DELETE','/auth/sessions/current',token=refreshed['token'])[0]==200
                      and fixture.call('GET','/auth/session',token=refreshed['token'])[0]==401)
            for key in ('admin','alpha-one-employee'):
                if key=='admin':
                    fixture.db.server_side('UPDATE admin_accounts SET must_change_password=1 WHERE id='+quote(admin['id']))
                status,session=fixture.login(key)
                if key=='admin':
                    check('administrator forced-password gate allows auth maintenance but blocks management',
                          session.get('passwordChangeRequired') is True and fixture.call('GET','/admin/account',token=session['token'])[0]==403
                          and fixture.call('GET','/auth/session',token=session['token'])[0]==200)
                token=session['token']
                for password in ('short1','NoDigitsAtAll','12345678901','长'*25+'A1'):
                    status,_=fixture.call('POST','/auth/password',{'currentPassword':PASSWORD,'newPassword':password},token)
                    check(key+' password policy rejects invalid form '+str(len(password)),status==400,{'status':status})
                status,_=fixture.call('POST','/auth/password',{'currentPassword':'Wrong@123456','newPassword':'Changed@123456'},token)
                check(key+' change requires the correct old password',status==400)
                second=fixture.login(key)[1]['token']
                status,changed=fixture.call('POST','/auth/password',{'currentPassword':PASSWORD,'newPassword':'Changed@123456'},token)
                check(key+' password change revokes all sessions',status==200 and fixture.call('GET','/auth/session',token=token)[0]==401
                      and fixture.call('GET','/auth/session',token=second)[0]==401,{'status':status})
                check(key+' old password no longer authenticates',fixture.login(key)[0]==401)
                check(key+' new password authenticates same principal',fixture.login(key,'Changed@123456')[1].get('user',{}).get('id')==fixture.identities[key]['id'])
            # Reset keeps one-time credentials out of replays and re-establishes the forced gate.
            admin_token=fixture.login('admin','Changed@123456')[1]['token']
            route='/admin/employees/'+employee['id']+'/password-reset'
            status,reset=fixture.call('POST',route,{},admin_token,'reset-fixture-one')
            check('administrator reset returns one initial password',status==200 and bool(reset.get('initialPassword')),{'status':status})
            status,replay=fixture.call('POST',route,{},admin_token,'reset-fixture-one')
            check('same reset idempotency key never replays a credential',status==200 and 'initialPassword' not in replay,{'status':status})
            status,restricted=fixture.login('alpha-one-employee',reset['initialPassword'])
            check('reset password requires first-login change',status==200 and restricted.get('passwordChangeRequired') is True,{'status':status})
            token=restricted['token']
            check('restricted session can read only its identity and cannot refresh/business-read',fixture.call('GET','/auth/session',token=token)[0]==200
                  and fixture.call('GET','/tasks',token=token)[0]==403 and fixture.call('POST','/auth/sessions/refresh',{},token)[0]==403)
            status,_=fixture.call('POST','/auth/password',{'currentPassword':reset['initialPassword'],'newPassword':'FinalEmployee@123456'},token)
            check('restricted employee can change password and must reauthenticate',status==200 and fixture.call('GET','/auth/session',token=token)[0]==401)
            check('passwords never enter audit or idempotency documents',fixture.db.scalar("SELECT COUNT(*) FROM audit_logs WHERE CAST(details_json AS CHAR) LIKE '%initialPassword%' OR CAST(details_json AS CHAR) LIKE '%Fixture@%' OR CAST(details_json AS CHAR) LIKE '%Changed@%'")==0
                  and fixture.db.scalar("SELECT COUNT(*) FROM idempotency_keys WHERE CAST(response_json AS CHAR) LIKE '%initialPassword%'")==0)
            report['result']='PASS'
    except BaseException as error:
        report['result']='FAIL';report['errorType']=type(error).__name__;raise
    finally:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    return 0

if __name__=='__main__': raise SystemExit(main())
