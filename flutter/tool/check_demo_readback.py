import json,os,sys,urllib.request,urllib.error,uuid
from pathlib import Path
BASE='http://127.0.0.1:8080/api/v1'
OUT=Path(__file__).resolve().parents[2]/'output/flutter-client-2026-11-17';OUT.mkdir(parents=True,exist_ok=True)
def call(method,path,token=None,body=None,version=None):
 h={'Content-Type':'application/json','Idempotency-Key':str(uuid.uuid4())}
 if token:h['Authorization']='Bearer '+token
 if version is not None:h['If-Match']='"'+str(version)+'"'
 req=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,method=method,headers=h)
 try:
  with urllib.request.urlopen(req) as r:return json.load(r)
 except urllib.error.HTTPError as e:
  raise RuntimeError(path+' '+e.read().decode())
def login(phone):return call('POST','/auth/sessions',body={'accountType':'employee','phone':phone,'password':os.getenv('PANDORA_DEMO_PASSWORD','111')})['token']
if __name__=='__main__':
 rows=[]
 for role,phone in [('founder','13800000001'),('department','13800000002'),('team','13800000011'),('employee','13800000004')]:
  t=login(phone);me=call('GET','/me',t);home=call('GET','/home',t);table=call('GET','/tasks/table?relation=assigned&limit=50&offset=0',t);daily=call('GET','/daily-items?from=2026-11-01&to=2026-11-30&limit=100&offset=0',t);logs=call('GET','/work-logs?limit=50&offset=0',t);notices=call('GET','/notifications?limit=1&offset=0',t)
  details=[call('GET','/tasks/'+x['id'],t) for x in table['items']]
  rows.append({'role':role,'id':me['id'],'phone':phone,'name':me.get('displayName'),'ownTasks':table['total'],'meaningfulTaskCount':sum(not x['title'].startswith('完整执行与交接联调 ') for x in table['items']),'taskIds':[x['id'] for x in table['items']],'tablePinned':[x['id'] for x in table['items'] if x.get('tablePinned')],'tagCounts':sorted(set(len(x.get('tagIds',x.get('tags',[]))) for x in details)),'dailyItems':daily,'logIds':[x['id'] for x in logs['items']],'notificationsTotal':notices.get('total'),'companyBodies':[x['body'] for x in home['companyItems']]})
  assert 10<=rows[-1]['meaningfulTaskCount']<=20
  assert len(logs['items'])>=3 and notices.get('total',0)>0 and daily['items']
  rows[-1]['tasks']=[{'id':x['id'],'title':x['title']} for x in table['items']]
 (OUT/'demo-current.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2));print([(x['role'],x['ownTasks'],len(x['logIds']),x['notificationsTotal']) for x in rows])
