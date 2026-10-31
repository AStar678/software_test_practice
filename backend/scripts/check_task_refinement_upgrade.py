#!/usr/bin/env python3
"""Upgrade an owned V27 database, including legacy labels and pending review routing."""
import datetime as dt
import json
import time
import uuid
from fixed_model_fixture import Fixture, quote
from migration_precheck import BASE

def main():
    output=BASE.parent/'output/task-creation-refinement'
    output.mkdir(parents=True,exist_ok=True)
    results=[]
    def check(name,value):
        results.append({'check':name,'pass':bool(value)})
        print(('PASS ' if value else 'FAIL ')+name,flush=True)
        if not value: raise AssertionError(name)
    fixture=Fixture(port=18208);fixture.migration_target=27;fixture.log_path=output/'upgrade-service.log'
    try:
        with fixture as f:
            org='fixture-company';creator=f.identities['founder']['id']
            tag,task,version,empty=(str(uuid.uuid4()) for _ in range(4))
            f.db.server_side('INSERT INTO tags(id,organization_id,name,color,deleted_at) VALUES('+','.join(map(quote,(tag,org,'历史删除标签','#F6D5D2')))+',UTC_TIMESTAMP(6))')
            f.db.server_side('INSERT INTO tasks(id,organization_id,original_creator_id) VALUES('+','.join(map(quote,(task,org,creator)))+')')
            for number,vid,tagid in [(1,version,tag),(2,empty,None)]:
                columns='id,organization_id,task_id,version_no,title,description,acceptance_criteria,priority,start_at,due_at,execution_state,progress_note,status,created_by,tag_id,tag_name_snapshot,tag_color_snapshot'
                vals=[vid,org,task,number,'旧版本','保留原文','','medium','2030-01-01 09:00:00','2030-01-03 18:00:00','todo','','applied',creator,tagid,'历史删除标签' if tagid else None,'#F6D5D2' if tagid else None]
                f.db.server_side('INSERT INTO task_versions('+columns+') VALUES('+','.join(map(quote,vals))+')')
            before=f.db.rows('SELECT id,title,description,tag_id,tag_name_snapshot,tag_color_snapshot FROM task_versions ORDER BY id')
            f.restart()
            check('old version fields unchanged',before==f.db.rows('SELECT id,title,description,tag_id,tag_name_snapshot,tag_color_snapshot FROM task_versions ORDER BY id'))
            rows=f.db.rows('SELECT version_id,tag_id,ordinal,tag_name_snapshot,tag_color_snapshot FROM task_version_tags')
            check('single deleted tag backfilled with snapshot',len(rows)==1 and rows[0]==[version,tag,'0','历史删除标签','#F6D5D2'])
            check('null tag remains empty',f.db.scalar('SELECT COUNT(*) FROM task_version_tags WHERE version_id='+quote(empty))==0)
            tokens={key:f.login(key)[1]['token'] for key in ('founder','alpha-one-employee','alpha-one-head')}
            now=dt.datetime.now(dt.timezone.utc)
            body={'title':'旧待审升级','description':'原操作者保持不变','allDay':False,'startAt':now.isoformat(),'dueAt':(now+dt.timedelta(days=3)).isoformat(),'assigneeIds':[f.identities['alpha-one-employee']['id']]}
            status,pending=f.call('POST','/tasks',body,tokens['alpha-one-employee'],'upgrade-'+uuid.uuid4().hex)
            check('pending fixture created',status==201 and pending['outcome']=='pending')
            rid=pending['requestId'];applicant=f.identities['alpha-one-employee']['id'];reviewer=f.identities['alpha-one-head']['id']
            f.db.server_side('UPDATE approval_requests SET current_reviewer_id='+quote(creator)+",route_reason='business-owner' WHERE id="+quote(rid))
            f.restart()
            for _ in range(40):
                current=f.db.rows('SELECT applicant_id,current_reviewer_id,route_reason FROM approval_requests WHERE id='+quote(rid))[0]
                if current[1]==reviewer: break
                time.sleep(.2)
            check('legacy reviewer rerouted without rewriting applicant',current==[applicant,reviewer,'direct-manager'])
            count=f.db.scalar('SELECT COUNT(*) FROM request_reassignments WHERE request_id='+quote(rid))
            check('legacy refresh recorded once',count==1)
            f.restart();time.sleep(1)
            check('repeat startup is idempotent',f.db.scalar('SELECT COUNT(*) FROM request_reassignments WHERE request_id='+quote(rid))==count and f.db.scalar('SELECT COUNT(*) FROM task_version_tags')==1)
            check('old reviewer cannot decide',f.call('PATCH','/approval-requests/'+rid,{'decision':'approve'},tokens['founder'],'old-'+uuid.uuid4().hex,2)[0] in (403,404))
            request=f.call('GET','/approval-requests/'+rid,token=tokens['alpha-one-head'])[1]
            check('new manager can approve migrated request',f.call('PATCH','/approval-requests/'+rid,{'decision':'approve'},tokens['alpha-one-head'],uuid.uuid4().hex,request['rowVersion'])[0]==200)
            closed=f.db.rows('SELECT status,applicant_id,current_reviewer_id,decided_at FROM approval_requests WHERE id='+quote(rid))
            task_id=pending['taskId'];detail=f.call('GET','/tasks/'+task_id,token=tokens['alpha-one-employee'])[1]
            status,progress=f.call('PATCH','/tasks/'+task_id,{'command':'progress','progressNote':'旧进展审核'},tokens['alpha-one-employee'],uuid.uuid4().hex,detail['rowVersion'])
            check('non-creation pending fixture created',status==200 and progress['outcome']=='pending')
            progress_id=progress['requestId']
            f.db.server_side('UPDATE approval_requests SET current_reviewer_id='+quote(creator)+",route_reason='business-owner' WHERE id="+quote(progress_id))
            f.restart();time.sleep(1)
            check('non-creation legacy reviewer also refreshed',f.db.rows('SELECT applicant_id,current_reviewer_id,route_reason FROM approval_requests WHERE id='+quote(progress_id))==[[applicant,reviewer,'direct-manager']])
            check('closed historical approval is unchanged',f.db.rows('SELECT status,applicant_id,current_reviewer_id,decided_at FROM approval_requests WHERE id='+quote(rid))==closed)
            f.db.server_side('UPDATE users SET active=0 WHERE id='+quote(applicant))
            f.db.server_side("UPDATE approval_requests SET route_reason='business-owner' WHERE id="+quote(progress_id))
            f.restart();time.sleep(1)
            check('inactive original applicant remains blocked',f.db.scalar('SELECT COUNT(*) FROM approval_requests WHERE id='+quote(progress_id)+" AND status='pending' AND current_reviewer_id IS NULL AND applicant_id="+quote(applicant))==1)
    finally:
        (output/'upgrade-report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
