#!/usr/bin/env python3
"""Admin-only full login-phone readback in an isolated authenticated service."""
import json
import os
import subprocess
import uuid

from fixed_model_fixture import Fixture, PASSWORD
from migration_precheck import BASE


def main():
    with Fixture(port=18229) as f:
        who='alpha-one-employee'
        person=f.identities[who]
        ids={name:row['id'] for name,row in f.identities.items()}
        tokens={name:f.login(name)[1]['token'] for name in ('admin','other-admin','founder',who)}
        def call(actor,method,path,body=None,version=None):
            return f.call(method,path,body,tokens[actor],uuid.uuid4().hex if method!='GET' else None,version)
        def ok(actor,method,path,body=None,version=None):
            code,row=call(actor,method,path,body,version)
            assert code in (200,201),(method,path,code,row)
            return row
        def check(label,result):
            print(('PASS ' if result else 'FAIL ')+label,flush=True)
            assert result,label
        path='/admin/employees/'+person['id']
        row=ok('admin','GET',path)
        listing=ok('admin','GET','/admin/employees')['items']
        listed=next(item for item in listing if item['id']==person['id'])
        check('same-company admin list and detail read full login phone',row['loginPhone']==person['identifier']==listed['loginPhone'])
        check('employee and founder cannot read admin phone route',call(who,'GET',path)[0] in (403,404) and call('founder','GET',path)[0] in (403,404))
        check('cross-company admin cannot read target detail',call('other-admin','GET',path)[0]==404)
        own_directory=ok('founder','GET','/users')
        check('business directory omits management login phone',all('loginPhone' not in item for item in own_directory['items']))
        new_phone='13912345678'
        ok('admin','PATCH',path,{'phone':new_phone},row['rowVersion'])
        updated=ok('admin','GET',path)
        listed=next(item for item in ok('admin','GET','/admin/employees')['items'] if item['id']==person['id'])
        check('admin readback reflects changed login key',updated['loginPhone']==new_phone==listed['loginPhone'] and updated['id']==person['id'])
        login=lambda phone:f.call('POST','/auth/sessions',{'accountType':'employee','phone':phone,'password':PASSWORD})
        new_login_code,new_login_body=login(new_phone)
        check('new phone authenticates the original employee',new_login_code==200 and new_login_body['user']['id']==ids[who])
        check('old phone stops authenticating',login(person['identifier'])[0] in (400,401,404))
        check('old employee session is revoked',call(who,'GET','/me/profile')[0]==401)
        manifest={'base':f'http://127.0.0.1:{f.port}','admin':f.identities['admin'],
                  'employeeName':updated['displayName'],'phone':new_phone}
        subprocess.run(['node',str(BASE/'scripts/check_apply_admin_login_phone_browser.js')],
                       env={**os.environ,'PANDORA_ADMIN_PHONE_FIXTURE':json.dumps(manifest)},check=True)


if __name__=='__main__':main()
