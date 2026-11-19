from pathlib import Path
import csv,datetime as dt,hashlib,json,shutil,subprocess,xml.etree.ElementTree as E,re
ROOT=Path('/Users/aoxiang/Desktop/软件测试');OUT=ROOT/'audit/2026-11-19-final-test-report';FIX=ROOT/'audit/2026-11-19-fixes';OLD=ROOT/'audit/2026-11-18-comprehensive-testing'
for folder in ('coverage','evidence','source'): (OUT/folder).mkdir(exist_ok=True)
# Keep the real logs next to the report so relative links remain usable when shared.
shutil.copytree(FIX,OUT/'evidence/final',dirs_exist_ok=True)
for name in ['findings.json','reference-documents.json','results-summary.json','core-method-inventory.json']:
 shutil.copy2(OLD/name,OUT/'evidence'/('initial-'+name))
for src in ['backend/src/test','backend/tests','flutter/test/core/acceptance_boundary_test.dart','flutter/test/features/login_page_test.dart']:
 p=ROOT/src;dest=OUT/'source'/src;dest.parent.mkdir(parents=True,exist_ok=True)
 if p.is_dir():shutil.copytree(p,dest,dirs_exist_ok=True,ignore=shutil.ignore_patterns('__pycache__'))
 else:shutil.copy2(p,dest)
files=[ROOT/'backend/target/jacoco.exec',*sorted((FIX/'regression/integration-coverage').glob('*.exec'))]
java='/opt/homebrew/opt/openjdk/bin/java';cli='/tmp/pandora-comprehensive-20261118/jacococli.jar';cov=OUT/'coverage'
with (cov/'generation.log').open('w') as log:
 subprocess.run([java,'-jar',cli,'merge',*map(str,files),'--destfile',str(cov/'combined.exec')],check=True,stdout=log,stderr=subprocess.STDOUT)
 subprocess.run([java,'-jar',cli,'report',str(cov/'combined.exec'),'--classfiles',str(ROOT/'backend/target/classes'),'--sourcefiles',str(ROOT/'backend/src/main/java'),'--html',str(cov/'java-combined'),'--xml',str(cov/'jacoco.xml'),'--csv',str(cov/'jacoco.csv')],check=True,stdout=log,stderr=subprocess.STDOUT)
shutil.copytree(ROOT/'backend/target/site/jacoco',cov/'java-unit',dirs_exist_ok=True);shutil.copy2(ROOT/'flutter/coverage/lcov.info',cov/'flutter.lcov.info')
(cov/'inputs.json').write_text(json.dumps([{'file':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files],indent=2))
def counts(root):
 return {c.get('type'):{'covered':int(c.get('covered')),'missed':int(c.get('missed')),'percent':round(100*int(c.get('covered'))/(int(c.get('covered'))+int(c.get('missed'))),2)} for c in root.findall('counter')}
summary=json.loads((FIX/'results-summary.json').read_text());summary['coverageCombined']=counts(E.parse(cov/'jacoco.xml').getroot());summary['coverageUnit']=counts(E.parse(cov/'java-unit/jacoco.xml').getroot())
lcov=(cov/'flutter.lcov.info').read_text();hit=total=0
for l in lcov.splitlines():
 if l.startswith('DA:'):
  total+=1;hit+=int(l[3:].split(',')[1])>0
summary['coverageFlutter']={'covered':hit,'total':total,'percent':round(hit*100/total,2)}
rows=[]
def xml_cases(dir,layer):
 for p in sorted(dir.glob('TEST-*.xml')):
  for c in E.parse(p).getroot().iter('testcase'):
   status='FAIL' if c.find('failure') is not None or c.find('error') is not None else 'SKIP' if c.find('skipped') is not None else 'PASS'
   rows.append(dict(layer=layer,suite=c.get('classname'),case=c.get('name'),status=status,input='',purpose='',evidence=str(p.relative_to(OUT))))
xml_cases(OUT/'evidence/final/junit-reports','JUnit');xml_cases(OUT/'evidence/final/native-reports','Android JVM')
for line in (FIX/'api/pytest-cases.jsonl').read_text().splitlines():
 r=json.loads(line);rows.append(dict(layer='pytest real API',suite=r['id'].split('::')[0],case=r['id'],status='PASS' if r['outcome']=='passed' else r['outcome'].upper(),input=json.dumps(r['input'],ensure_ascii=False),purpose=r['purpose'],evidence='evidence/final/api/pytest-cases.jsonl'))
skips=[]
for name,layer in [('flutter.jsonl','Flutter unit/widget'),('flutter-real/flutter-managed.jsonl','Flutter managed'),('flutter-real/flutter-real-backend.jsonl','Flutter real API')]:
 starts={}
 for line in (FIX/name).read_text().splitlines():
  try:r=json.loads(line)
  except ValueError:continue
  if r.get('type')=='testStart':starts[r['test']['id']]=r['test']
  if r.get('type')!='testDone' or r.get('hidden'):continue
  c=starts[r['testID']];row=dict(layer=layer,suite=c.get('url',''),case=c['name'],status='SKIP' if r.get('skipped') else 'PASS' if r['result']=='success' else 'FAIL',input='',purpose='',evidence='evidence/final/'+name)
  (skips if row['status']=='SKIP' else rows).append(row)
suites=json.loads((FIX/'final-suites.json').read_text());suite_rows=[]
for c in suites:
 name=c['suite'];folder='daily-recheck' if name=='check_daily_items.py' else 'log-tags-recheck' if name=='check_apply_log_tags.py' else 'regression'
 log=FIX/folder/c['log'];n=0
 for line in log.read_text(errors='replace').splitlines():
  m=re.match(r'^(PASS|FAIL)\s+(.+)',line)
  if not m:continue
  n+=1;rows.append(dict(layer='Business printed assertion',suite=name,case=f'{n}: '+m[2],status=m[1],input='',purpose='',evidence=f'evidence/final/{folder}/{c["log"]}'))
 suite_rows.append({'suite':name,'status':'PASS' if c['exitCode']==0 else 'FAIL','printedAssertions':n,'evidence':f'evidence/final/{folder}/{c["log"]}'})
for c in json.loads((FIX/'flutter-real/phone-checks.json').read_text()):
 rows.append(dict(layer='Phone',suite='Android 15 own-package fixture',case=c['check'],status='PASS' if c['pass'] else 'FAIL',input='',purpose='',evidence='evidence/final/flutter-real/phone-checks.json'))
assert len(rows)==3795 and all(r['status']=='PASS' for r in rows)
assert len(skips)==32

def csv_write(file,items):
 with file.open('w',encoding='utf-8-sig',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(dict.fromkeys(k for r in items for k in r)));w.writeheader();w.writerows(items)
csv_write(OUT/'逐项测试结果.csv',rows);csv_write(OUT/'默认运行跳过记录.csv',skips);csv_write(OUT/'41套回归结果.csv',suite_rows)
(OUT/'逐项测试结果.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2));(OUT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));(OUT/'suites.json').write_text(json.dumps(suite_rows,ensure_ascii=False,indent=2))
methods=[]
for pkg in E.parse(cov/'jacoco.xml').getroot().findall('package'):
 for cls in pkg.findall('class'):
  for m in cls.findall('method'):
   cs=counts(m);methods.append(dict(className=cls.get('name').replace('/','.'),method=m.get('name'),signature=m.get('desc'),line=m.get('line'),source=pkg.get('name')+'/'+cls.get('sourcefilename',''),lineCoverage=cs.get('LINE',{}).get('percent'),branchCoverage=cs.get('BRANCH',{}).get('percent'),threeCaseReview='待小组逐方法复核；不能由命中率自动推断'))
csv_write(OUT/'逐方法覆盖与复核.csv',methods)
print(json.dumps({'coverageCombined':summary['coverageCombined'],'coverageUnit':summary['coverageUnit'],'coverageFlutter':summary['coverageFlutter'],'catalog':len(rows),'methods':len(methods)},ensure_ascii=False))
