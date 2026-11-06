#!/usr/bin/env python3
"""V30 must fail closed when a private tag is corruptly linked to a shared log."""
import datetime as dt
import uuid

from fixed_model_fixture import Fixture,quote


def main():
    f=Fixture(port=18230)
    f.migration_target=29
    with f:
        owner=f.identities['alpha-one-employee']
        token=f.login('alpha-one-employee')[1]['token']
        status,created=f.call('POST','/work-logs',{'body':'guard source','businessDate':dt.datetime.now().date().isoformat()},token,uuid.uuid4().hex)
        assert status in (200,201),(status,created)
        tag_id=str(uuid.uuid4())
        f.db.server_side('INSERT INTO tags(id,organization_id,owner_id,name,color) VALUES('
                         +','.join(map(quote,(tag_id,owner['organizationId'],owner['id'],'私有异常','#F6D5D2')))+')')
        f.db.server_side('INSERT INTO work_log_tags(organization_id,log_id,tag_id,ordinal,tag_name_snapshot,tag_color_snapshot) VALUES('
                         +','.join(map(quote,(owner['organizationId'],created['logId'],tag_id,0,'私有异常','#F6D5D2')))+')')
        try:
            f.restart()
        except RuntimeError:
            pass
        else:
            raise AssertionError('V30 unexpectedly accepted a private shared reference')
        assert f.db.scalar('SELECT COUNT(*) FROM tags WHERE id='+quote(tag_id))==1
        assert f.db.scalar('SELECT COUNT(*) FROM work_log_tags WHERE tag_id='+quote(tag_id))==1
        assert f.db.scalar('SELECT COUNT(*) FROM flyway_schema_history WHERE version=30 AND success=1')==0
        print('PASS V30 aborts and preserves private data on malformed shared reference',flush=True)
    healthy=Fixture(port=18231)
    healthy.migration_target=29
    with healthy as f:
        owner=f.identities['alpha-one-employee']
        founder_token=f.login('founder')[1]['token']
        owner_token=f.login('alpha-one-employee')[1]['token']
        def create(path,body,token):
            status,row=f.call('POST',path,body,token,uuid.uuid4().hex)
            assert status in (200,201),(status,row)
            return row
        shared=create('/tags',{'name':'保留共用','color':'#D8EAF4'},founder_token)['tagId']
        task=create('/tasks',{'title':'迁移保留任务','description':'正文保留','assigneeIds':[owner['id']],
            'tagIds':[shared],'allDay':False,'startAt':'2030-12-31T01:00:00Z','dueAt':'2030-12-31T03:00:00Z'},founder_token)['taskId']
        status,pinned=f.call('PUT','/tasks/'+task+'/pin',{},owner_token,uuid.uuid4().hex)
        assert status in (200,201),(status,pinned)
        log=create('/work-logs',{'body':'迁移保留日志','businessDate':dt.datetime.now().date().isoformat(),'tagIds':[shared]},owner_token)['logId']
        private_id=str(uuid.uuid4())
        f.db.server_side('INSERT INTO tags(id,organization_id,owner_id,name,color) VALUES('
                         +','.join(map(quote,(private_id,owner['organizationId'],owner['id'],'保留共用','#F6D5D2')))+')')
        f.db.server_side('INSERT INTO personal_task_tags(organization_id,user_id,task_id,tag_id) VALUES('
                         +','.join(map(quote,(owner['organizationId'],owner['id'],task,private_id)))+')')
        tables=('tasks','task_versions','task_version_tags','work_logs','work_log_tags','domain_events','audit_logs','user_task_pins')
        before={table:f.db.scalar('SELECT COUNT(*) FROM '+table) for table in tables}
        task_schedule=f.db.rows('SELECT start_at,due_at FROM task_versions WHERE task_id='+quote(task)+' ORDER BY version_no DESC LIMIT 1')
        log_body=f.db.rows('SELECT body FROM work_logs WHERE id='+quote(log))
        f.restart()
        after={table:f.db.scalar('SELECT COUNT(*) FROM '+table) for table in tables}
        assert before==after,(before,after)
        assert f.db.rows('SELECT start_at,due_at FROM task_versions WHERE task_id='+quote(task)+' ORDER BY version_no DESC LIMIT 1')==task_schedule
        assert f.db.rows('SELECT body FROM work_logs WHERE id='+quote(log))==log_body
        assert f.db.scalar('SELECT COUNT(*) FROM tags WHERE id='+quote(private_id))==0
        assert f.db.scalar('SELECT COUNT(*) FROM tags WHERE id='+quote(shared))==1
        assert f.db.scalar("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='personal_task_tags'")==0
        assert f.db.scalar('SELECT COUNT(*) FROM flyway_schema_history WHERE version=30 AND success=1')==1
        print('PASS V30 removes healthy private catalogue and overrides without changing shared tasks, log, events, audit or pins',flush=True)


if __name__=='__main__':main()
