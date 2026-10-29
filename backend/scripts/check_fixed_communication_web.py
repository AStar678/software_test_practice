#!/usr/bin/env python3
"""Own a real packaged fixture for shared tag/comment/notification browser regression."""
import datetime as dt
import json
import os
import subprocess
import uuid
from fixed_model_fixture import Fixture
from migration_precheck import BASE

def main():
    fixture=Fixture(port=18197,worker=True)
    fixture.log_path=BASE.parent/'audit/refactor-pandora-organization-and-workflows/communication-web-service.log'
    with fixture as f:
        token=f.login('founder')[1]['token'];now=dt.datetime.now(dt.timezone.utc)
        status,task=f.call('POST','/tasks',{'title':'Communication browser task','description':'Current effective task',
            'priority':'medium','allDay':False,'startAt':now.isoformat(),'dueAt':(now+dt.timedelta(days=4)).isoformat(),
            'assigneeIds':[f.identities['alpha-one-employee']['id']]},token,'web-communication-'+uuid.uuid4().hex)
        if status!=201:raise AssertionError((status,task))
        manifest={'base':f'http://127.0.0.1:{f.port}','identities':f.identities,'taskId':task['taskId']}
        subprocess.run(['node',str(BASE/'scripts/check_fixed_communication_browser.js')],
            env={**os.environ,'PANDORA_BROWSER_FIXTURE':json.dumps(manifest)},check=True)
if __name__=='__main__':main()
