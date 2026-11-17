import sys, os, json, subprocess, uuid, datetime as dt
from pathlib import Path
BASE = Path(__file__).resolve().parents[3]
SCRIPTS = str(BASE / 'backend' / 'scripts')
sys.path.insert(0, SCRIPTS)
from fixed_model_fixture import Fixture

PORT=18941
def main():
    fixture=Fixture(port=PORT)
    fixture.log_path=Path(__file__).with_name('service.log')
    with fixture as f:
        founder=f.login('founder')[1]['token']
        admin=f.login('admin')[1]['token']
        emp=f.login('alpha-one-employee')[1]['token']
        ids={k:v['id'] for k,v in f.identities.items()}
        day=f.call('GET','/home',token=emp)[1]['businessDate']
        today=dt.date.fromisoformat(day)
        year=today.year
        f.db.server_side("UPDATE users SET hire_date='2023-03-01' WHERE id='"+ids['alpha-one-employee']+"'")
        def iso(off,hm='09:00:00'):
            return (today+dt.timedelta(days=off)).isoformat()+'T'+hm+'+08:00'
        # 6 tasks assigned to the employee by the founder, plus founder's own.
        titles=['分镜初稿整理','角色设定复核','原画镜头检查','配音台本校对','合成预览审核','交付清单核对']
        for i,title in enumerate(titles):
            body={'title':title,'description':'smoke ' + title,'priority':'medium','allDay':False,
                  'startAt':iso(i+1),'dueAt':iso(i+1,'18:00:00'),'assigneeIds':[ids['alpha-one-employee']]}
            status,result=f.call('POST','/tasks',body,founder,'smoke-task-emp-'+str(i))
            print('task emp',i,status, result.get('code') if isinstance(result,dict) else '')
        status,result=f.call('POST','/tasks',{'title':'跨日镜头交接','description':'smoke','priority':'medium','allDay':False,
                  'startAt':iso(-1),'dueAt':iso(2,'18:00:00'),'assigneeIds':[ids['alpha-one-employee']]},founder,'smoke-task-cross')
        print('task cross',status)
        status,result=f.call('POST','/tasks',{'title':'部门镜头评审','description':'smoke','priority':'medium','allDay':False,
                  'startAt':iso(1),'dueAt':iso(3,'18:00:00'),'assigneeIds':[ids['alpha-head']]},founder,'smoke-task-head')
        print('task head',status)
        status,result=f.call('POST','/tasks',{'title':'分镜总览','description':'smoke','priority':'high','allDay':False,
                  'startAt':iso(0),'dueAt':iso(2,'18:00:00'),'assigneeIds':[ids['founder']]},founder,'smoke-task-founder')
        print('task founder',status)
        # ranged daily items
        def item(start,end,body,key):
            st,res=f.call('POST','/daily-items',{'startDate':(today+dt.timedelta(days=start)).isoformat(),
                'endDate':(today+dt.timedelta(days=end)).isoformat(),'body':body},emp,key)
            print('item',key,st)
            return res
        item(0,2,'整理分镜参考','smoke-daily-range')
        item(0,0,'交付清单核对','smoke-daily-single')
        item(-3,-1,'逾期镜头清单','smoke-daily-overdue')
        item(-1,-1,'昨日镜头备注','smoke-daily-yesterday')
        done=item(1,1,'已完成的配音清单','smoke-daily-done')
        if done.get('id'):
            f.call('PATCH','/daily-items/'+done['id'],{'completed':True},emp,'smoke-daily-complete',done['rowVersion'])
        # log for business day
        st,log=f.call('POST','/work-logs',{'businessDate':day,'body':'今天整理了分镜与角色设定。'},emp,'smoke-log-today')
        print('log',st)
        item(-50,40,'长期镜头计划','smoke-daily-long')
        bulk_day=(today+dt.timedelta(days=20)).isoformat()
        for i in range(105):
            st2,b2=f.call('POST','/daily-items',{'date':bulk_day,'body':'批量镜头条目 '+str(i)},emp,'smoke-bulk-'+str(i))
            if st2!=200:
                print('bulk fail',i,st2,b2); break
        # company items
        for i in range(4):
            f.call('POST','/admin/company/items',{'body':'公司信息 '+str(i)},admin,'smoke-company-'+str(i))
        # holiday cache for the current year
        f.db.server_side("DELETE FROM holiday_calendar_days WHERE region='CN' AND year="+str(year))
        f.db.server_side("INSERT INTO holiday_calendar_years(region,year,source,fetched_at,last_failure_at,last_failure_code) VALUES('CN',"+str(year)+",'smoke',NOW(6),NULL,NULL) ON DUPLICATE KEY UPDATE source='smoke',fetched_at=NOW(6),last_failure_at=NULL,last_failure_code=NULL")
        for off,name,offday in ((5,'测试节',1),(6,'测试调班',0)):
            d=(today+dt.timedelta(days=off)).isoformat()
            f.db.server_side("INSERT INTO holiday_calendar_days(region,year,holiday_date,name,is_off_day) VALUES('CN',"+str(year)+",'"+d+"','"+name+"',"+str(offday)+")")
        manifest={'base':f'http://127.0.0.1:{f.port}','identities':f.identities,'today':day,'port':f.port,'bulk':bulk_day}
        env={**os.environ,'PANDORA_BROWSER_FIXTURE':json.dumps(manifest)}
        result=subprocess.run(['node',str(Path(__file__).with_name('apply_smoke.js'))],env=env)
        if result.returncode!=0: raise SystemExit('browser smoke failed')

main()
