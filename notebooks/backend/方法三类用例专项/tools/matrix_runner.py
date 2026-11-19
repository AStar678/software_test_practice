"""每个方法独立执行pytest，逐用例校验正常/边界/异常三类覆盖。"""
import json,os,shutil,subprocess,sys,xml.etree.ElementTree as ET
from pathlib import Path
from IPython.display import display,Markdown
from output_display import fold_raw
COMMON='''import os,uuid,datetime as dt
from urllib.parse import urlencode
import pytest
DAY='2026-11-20'
def create_owned(cloud,text='matrix-test'):
    status,data=cloud.request('POST','/daily-items',{'date':DAY,'body':text},actor='A4',key=uuid.uuid4().hex)
    assert status==200
    return data
'''

def execute_method(root,run,spec,source,session,passwords=None):
    out=run/spec['id'];out.mkdir(exist_ok=False)
    test=out/'test_method.py';test.write_text(COMMON+'\n'+source)
    shutil.copy2(root/'tools/cloud_conftest.py',out/'conftest.py')
    env={**os.environ,'PYTHONPATH':str(root/'tools'),'PANDORA_CLOUD_OUTPUT':str(out),'PANDORA_CLOUD_SESSIONS':json.dumps(session.tokens),'PANDORA_CLOUD_LOGIN_RESULTS':json.dumps(session.login_results),'PANDORA_CLOUD_WRITES':'1','PYTEST_ADDOPTS':'','NO_COLOR':'1'}
    for key in ['PANDORA_CLOUD_PASSWORD','PANDORA_CLOUD_ADMIN_PASSWORD']:env.pop(key,None)
    if passwords:
        env['PANDORA_CLOUD_PASSWORD']=passwords['employee'];env['PANDORA_CLOUD_ADMIN_PASSWORD']=passwords['admin']
    with (out/'pytest.log').open('w') as log:
        result=subprocess.run([sys.executable,'-m','pytest',str(test),'-vv','--color=no','--tb=short','--junitxml='+str(out/'pytest.xml')],env=env,stdout=log,stderr=subprocess.STDOUT,timeout=300)
    env.clear()
    rows=[json.loads(x) for x in (out/'cases.jsonl').read_text().splitlines()] if (out/'cases.jsonl').exists() else []
    xml_cases=list(ET.parse(out/'pytest.xml').getroot().iter('testcase')) if (out/'pytest.xml').exists() else []
    counts={'passed':0,'failed':0,'skipped':0}
    for row in xml_cases:
        key='failed' if row.find('failure') is not None or row.find('error') is not None else 'skipped' if row.find('skipped') is not None else 'passed'
        counts[key]+=1
    coverage={}
    for kind in ['正常','边界','异常']:
        selected=[r for r in rows if r['input'].get('case',{}).get('kind')==kind]
        coverage[kind]={'designed':sum(c['kind']==kind for c in spec['cases']),'executed':sum(r['phase']=='call' for r in selected),'passed':sum(r['phase']=='call' and r['result']=='passed' for r in selected)}
    complete=all(v['designed']>=1 and v['executed']>=1 and v['passed']>=1 for v in coverage.values())
    cleanup=json.loads((out/'cleanup.json').read_text()) if (out/'cleanup.json').exists() else {'created':0,'unresolved':[]}
    passed=result.returncode==0 and not counts['failed'] and not counts['skipped'] and sum(counts.values())==len(spec['cases']) and complete and not cleanup['unresolved']
    report={'id':spec['id'],'method':spec['method'],'endpoint':spec['endpoint'],'status':'PASS' if passed else 'FAIL','counts':counts,'categoryCoverage':coverage,'threeCategoriesSatisfied':complete,'cleanup':cleanup}
    (out/'结论.json').write_text(json.dumps({k:v for k,v in report.items() if k not in ['analysis','actualEvidence']},ensure_ascii=False,indent=2))
    return report

def show_method(run,spec,report):
    assert report['id']==spec['id'],'禁止展示其他方法结果'
    out=run/spec['id']
    rows=[json.loads(x) for x in (out/'cases.jsonl').read_text().splitlines()] if (out/'cases.jsonl').exists() else []
    requests=[json.loads(x) for x in (out/'requests.jsonl').read_text().splitlines()] if (out/'requests.jsonl').exists() else []
    counts=report['counts']
    display(Markdown(f"**本方法实际结果：{report['status']}** — 通过{counts['passed']}、失败{counts['failed']}、跳过{counts['skipped']}。"))
    display(Markdown('|类别|设计数|实际执行|通过数|\n|---|---:|---:|---:|\n'+'\n'.join(f"|{kind}|{v['designed']}|{v['executed']}|{v['passed']}|" for kind,v in report['categoryCoverage'].items())))
    raw='测试过程：准备共享会话 → 本方法参数化用例 → 状态与业务断言 → 按本次ID清理。\n\n'
    raw+='pytest完整输出：\n'+(out/'pytest.log').read_text()+'\n逐用例设计与实际判定：\n'
    raw+='\n\n'.join(json.dumps(row,ensure_ascii=False,indent=2) for row in rows)
    raw+='\n\n完整原始HTTP请求与响应（认证脱敏）：\n'
    raw+='\n\n'.join(json.dumps(row,ensure_ascii=False,indent=2) for row in requests)
    raw+='\n\n实际结论与三类覆盖：\n'+json.dumps(report,ensure_ascii=False,indent=2)
    fold_raw(raw,f"展开 {spec['method']} 原始输出（{len(requests)}次请求）")
    from result_analysis import display_analysis
    display_analysis(run,spec,report)
