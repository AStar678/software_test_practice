#!/usr/bin/env python3
"""Collect observed test results; reruns supersede the same suite, never inflate totals."""
import argparse
from collections import Counter
import csv
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    out = args.output.resolve(); rows = []; summary = {}
    evidence = out / 'framework-reports'; evidence.mkdir(exist_ok=True)
    def xml_cases(pattern, category, dest):
        total = Counter()
        target = evidence / dest; target.mkdir(exist_ok=True)
        for p in sorted(ROOT.glob(pattern)):
            shutil.copy2(p, target / p.name)
            root = ET.parse(p).getroot()
            for case in root.iter('testcase'):
                fail = case.find('failure'); error = case.find('error'); skip = case.find('skipped')
                node = fail if fail is not None else error
                status = 'FAIL' if node is not None else 'SKIP' if skip is not None else 'PASS'
                total[status] += 1
                rows.append({'layer': category, 'suite': case.get('classname'), 'id': case.get('name'),
                    'status': status, 'seconds': case.get('time'), 'purpose': '', 'input': '',
                    'detail': (node.text or node.get('message',''))[:4000] if node is not None else '',
                    'evidence': str((target / p.name).relative_to(out))})
        summary[category] = dict(total)
    xml_cases('backend/target/surefire-reports/TEST-*.xml', 'JUnit', 'junit')
    xml_cases('android/app/build/test-results/testDebugUnitTest/TEST-*.xml', 'Android JVM', 'android')
    for p in sorted((ROOT / 'android/app/build/reports').glob('lint-results-debug.*')):
        shutil.copy2(p, evidence / p.name)
    lint_file = evidence / 'lint-results-debug.xml'
    if lint_file.exists():
        summary['Android lint'] = dict(Counter(n.get('severity') for n in ET.parse(lint_file).getroot().findall('issue')))
    for filename, category in [('flutter-expanded.jsonl', 'Flutter unit/widget'),
                                ('flutter-managed.jsonl','Flutter managed real API'),
                                ('flutter-real-backend.jsonl','Flutter demo real API')]:
        starts = {}; errors = {}; total = Counter()
        for line in (out / filename).read_text().splitlines():
            try: item = json.loads(line)
            except ValueError: continue
            if item.get('type') == 'testStart': starts[item['test']['id']] = item['test']
            if item.get('type') == 'error': errors.setdefault(item['testID'],[]).append(item.get('error',''))
            if item.get('type') != 'testDone' or item.get('hidden'): continue
            case = starts.get(item['testID'],{})
            status = 'SKIP' if item.get('skipped') else 'PASS' if item['result'] == 'success' else 'FAIL'
            total[status] += 1
            rows.append({'layer':category, 'suite':case.get('url',''), 'id':case.get('name',str(item['testID'])),
                'status':status, 'seconds':'', 'input':'', 'purpose':'', 'detail':'\n'.join(errors.get(item['testID'],[])), 'evidence':filename})
        summary[category] = dict(total)
    total=Counter()
    pytest_cases = next((p for p in [out / 'pytest-complete/pytest-cases.jsonl',
                                   out / 'pytest-expanded/pytest-cases.jsonl', out / 'pytest-cases.jsonl'] if p.exists()))
    for line in pytest_cases.read_text().splitlines():
        case = json.loads(line); status={'passed':'PASS','failed':'FAIL','skipped':'SKIP'}[case['outcome']]; total[status]+=1
        rows.append({'layer':'pytest real API', 'suite':case['id'].split('::')[0], 'id':case['id'], 'status':status,
            'seconds':case['seconds'], 'input':json.dumps(case['input'],ensure_ascii=False), 'purpose':case['purpose'],
            'detail':case['failure'] or '', 'evidence':str(pytest_cases.relative_to(out))})
    summary['pytest real API']=dict(total)
    latest={}
    # Explicit rerun order: a long batch can finish after a correction rerun although the
    # affected suite actually ran earlier. Report-file mtime would select stale failures.
    run_order = ['', 'migration-recheck', 'oracle-recheck', 'schema-final-recheck',
                 'browser-recheck', 'task-ui-recheck', 'forms-final', 'notifications-final', 'drag-final']
    for run in run_order:
        report_path = out / run / 'current-suites.json'
        if not report_path.exists():
            continue
        report=json.loads(report_path.read_text())
        for case in report['suites']:
            latest[case['suite']]={**case,'report':str(report_path.relative_to(out)),
                'log':str((report_path.parent / case['log']).relative_to(out))}
    (out/'final-suite-results.json').write_text(json.dumps(list(latest.values()),ensure_ascii=False,indent=2)+'\n')
    summary['API/browser/migration suites']={'PASS':sum(c['exitCode']==0 for c in latest.values()),
        'FAIL':sum(c['exitCode']!=0 for c in latest.values()), 'total':len(latest)}
    printed=Counter()
    for suite,case in sorted(latest.items()):
        count=0
        for line in (out/case['log']).read_text(errors='replace').splitlines():
            match=re.match(r'^(PASS|FAIL)\s+(.+)$',line)
            if not match: continue
            status,name=match.groups(); printed[status]+=1;count+=1
            rows.append({'layer':'API/browser printed assertion','suite':suite,'id':str(count)+': '+name,
                'status':status,'seconds':'','purpose':'','input':'','detail':'','evidence':case['log']})
        if case['exitCode'] and not re.search(r'^FAIL\s', (out/case['log']).read_text(errors='replace'),re.M):
            rows.append({'layer':'Suite execution','suite':suite,'id':'execution','status':'ERROR',
                'seconds':case['seconds'],'purpose':'','input':'','detail':'Suite stopped; see log. This is not counted as a business assertion.','evidence':case['log']})
    summary['Printed assertions (lower bound)']=dict(printed)
    phone_reports=list(out.glob('**/phone-checks.json'))
    if phone_reports:
        phone=max(phone_reports,key=lambda p:p.stat().st_mtime); cases=json.loads(phone.read_text())
        summary['Phone recorded checks']=dict(Counter('PASS' if c['pass'] else 'FAIL' for c in cases))
        summary['Phone evidence']=str(phone.relative_to(out))
        for c in cases: rows.append({'layer':'Phone','suite':'physical Honor','id':c['check'],'status':'PASS' if c['pass'] else 'FAIL',
            'seconds':'','purpose':'','input':'','detail':json.dumps(c.get('detail'),ensure_ascii=False),'evidence':str(phone.relative_to(out))})
    coverage = out/'coverage'; coverage.mkdir(exist_ok=True)
    java=ET.parse(coverage/'jacoco.xml').getroot()
    def counter(n):
        missed,hit=int(n.get('missed')),int(n.get('covered'));return {'covered':hit,'missed':missed,'total':hit+missed,'percent':round(100*hit/(hit+missed),2) if hit+missed else None}
    summary['Java coverage']={c.get('type'):counter(c) for c in java.findall('counter')}
    unit=ROOT/'backend/target/site/jacoco/jacoco.xml'
    if unit.exists(): summary['Java unit-only coverage']={c.get('type'):counter(c) for c in ET.parse(unit).getroot().findall('counter')}
    method_rows=[]
    for pkg in java.findall('package'):
        for cls in pkg.findall('class'):
            for m in cls.findall('method'):
                method_rows.append({'class':cls.get('name').replace('/','.'),'method':m.get('name'),'signature':m.get('desc'),
                    'line':m.get('line'),'source':pkg.get('name')+'/'+cls.get('sourcefilename',''),
                    **{c.get('type').lower()+'_percent':counter(c)['percent'] for c in m.findall('counter')}})
    write_csv(coverage/'java-method-coverage.csv',method_rows)
    inventory=json.loads((out/'core-method-inventory.json').read_text())
    for item in inventory:
        matches=[m for m in method_rows if m['class'].split('.')[-1]==item['class'] and m['method']==item['method']]
        item['observedCoverage']=matches
        item['threeCasesHumanSignoff']='PENDING: executed module cases are catalogued separately; per-method traceability needs human review'
    (out/'core-method-coverage-review.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n')
    lcov=ROOT/'flutter/coverage/lcov.info';shutil.copy2(lcov,coverage/'flutter.lcov.info')
    flutterfiles=[]
    for record in lcov.read_text().split('end_of_record'):
        sf=next((s[3:] for s in record.splitlines() if s.startswith('SF:')),None)
        if not sf: continue
        lines=[tuple(map(int,s[3:].split(',')[:2])) for s in record.splitlines() if s.startswith('DA:')]
        flutterfiles.append({'file':sf,'covered':sum(h>0 for _,h in lines),'total':len(lines)})
    hit=sum(f['covered'] for f in flutterfiles);den=sum(f['total'] for f in flutterfiles)
    summary['Flutter unit/widget line coverage']={'covered':hit,'total':den,'percent':round(hit/den*100,2),'files':len(flutterfiles)}
    write_csv(coverage/'flutter-file-coverage.csv',flutterfiles)
    summary['generatedAt']=dt.datetime.now().astimezone().isoformat()
    (out/'results-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    (out/'test-cases.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
    write_csv(out/'test-cases.csv',rows)
    manifest={'gitHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'files':{}}
    for top in ['backend/src','backend/tests','backend/scripts','flutter/lib','flutter/test','flutter/tool','android/app/src']:
        for p in sorted((ROOT/top).rglob('*')):
            if not p.is_file() or '__pycache__' in p.parts: continue
            manifest['files'][str(p.relative_to(ROOT))]=hashlib.sha256(p.read_bytes()).hexdigest()
    for p in sorted(ROOT.glob('潘多拉-*')):
        if p.is_file():manifest['files'][p.name]=hashlib.sha256(p.read_bytes()).hexdigest()
    (out/'source-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(summary,ensure_ascii=False,indent=2))


def write_csv(path, rows):
    if not rows:return
    fields=list(dict.fromkeys(k for row in rows for k in row))
    with path.open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader();writer.writerows(rows)


if __name__=='__main__':main()
