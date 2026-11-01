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
        # A long title must never push the type, read state or time out of the compact row.
        long_title='跨部门紧急排期复核与供应商交付风险跟踪任务标题'*3
        long_status,long_task=f.call('POST','/tasks',{'title':long_title,'description':'Long title fixture',
            'priority':'medium','allDay':False,'startAt':now.isoformat(),'dueAt':(now+dt.timedelta(days=4)).isoformat(),
            'assigneeIds':[f.identities['alpha-one-employee']['id']]},token,'web-long-'+uuid.uuid4().hex)
        if long_status!=201:raise AssertionError((long_status,long_task))
        # A log comment notification exercises the log-object destination independently of tasks.
        alpha_token=f.login('alpha-one-employee')[1]['token']
        today=dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date().isoformat()
        log_status,log=f.call('POST','/work-logs',{'businessDate':today,'body':'Browser log body'},alpha_token,'web-log-'+uuid.uuid4().hex)
        if log_status not in (200,201):raise AssertionError((log_status,log))
        comment_status,log_comment=f.call('POST','/work-logs/'+log['logId']+'/comments',{'body':'Browser log comment'},token,'web-log-comment-'+uuid.uuid4().hex)
        if comment_status not in (200,201):raise AssertionError((comment_status,log_comment))
        manifest={'base':f'http://127.0.0.1:{f.port}','identities':f.identities,'taskId':task['taskId'],
            'longTaskId':long_task['taskId'],'logId':log['logId'],'logCommentId':log_comment['commentId']}
        subprocess.run(['node',str(BASE/'scripts/check_fixed_communication_browser.js')],
            env={**os.environ,'PANDORA_BROWSER_FIXTURE':json.dumps(manifest)},check=True)
if __name__=='__main__':main()
