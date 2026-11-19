"""从当前用例关联的原始请求和响应提取证据，不以预期值代替实际输出。"""
import json,re
from urllib.parse import urlsplit,parse_qs
from pathlib import Path
from IPython.display import display,Markdown

def scalar(value):
    if value is None:return 'null'
    if isinstance(value,bool):return 'true' if value else 'false'
    return str(value)

def analyze_method(run,spec,report):
    out=Path(run)/spec['id']
    requests=[json.loads(line) for line in (out/'requests.jsonl').read_text().splitlines()]
    cases=[json.loads(line) for line in (out/'cases.jsonl').read_text().splitlines()]
    method,path=spec['endpoint'].split(' ',1)
    evidence=[]
    for case_row in cases:
        case=case_row['input']['case']
        related=[(i+1,row) for i,row in enumerate(requests) if row['testId']==case_row['id'] and row['phase']=='call']
        case_path=case.get('path',path)
        pattern='^/api/v1'+re.escape(case_path).replace(r'\{id\}',r'[^/]+')+'$'
        primary=[(i,row) for i,row in related if row['method']==method and re.match(pattern,urlsplit(row['url']).path)]
        if len(primary)!=1:
            evidence.append({'caseId':case['id'],'kind':case['kind'],'pytest':case_row['result'],'observed':'原始请求未能唯一关联，不能据预期推测实际结果','expected':case['expected'],'requestLines':[]});continue
        line,row=primary[0];body=row.get('requestBody');data=row.get('responseBody') or {}
        query={k:v[0] for k,v in parse_qs(urlsplit(row['url']).query,keep_blank_values=True).items()}
        input_parts=[];actual=[];metrics={}
        if query:
            for key,value in query.items():
                input_parts.append(f'q长度={len(value)}' if key=='q' else f'{key}={value}')
        if spec['method']=='AuthService.login':
            key='accountName' if body.get('accountType')=='admin' else 'phone'
            raw=body.get(key);input_parts=[f"accountType={body.get('accountType')}",f'{key}原始长度={len(raw)}' if isinstance(raw,str) else f'{key}类型={type(raw).__name__}']
            sessions=[(i,r) for i,r in related if r['method']=='GET' and urlsplit(r['url']).path.endswith('/auth/session')]
            exits=[(i,r) for i,r in related if r['method']=='DELETE']
            if sessions:actual.append('会话accountType='+scalar(sessions[-1][1]['responseBody'].get('accountType')))
            if exits:actual.append('退出revoked='+scalar(exits[-1][1]['responseBody'].get('revoked')))
        elif isinstance(body,dict) and 'body' in body:
            value=body['body'];input_parts.append(f'正文={len(value)}码点' if isinstance(value,str) else f'正文类型={type(value).__name__}')
        if method in ['PATCH','DELETE']:
            input_parts.append('If-Match='+scalar(row.get('requestHeaders',{}).get('If-Match')))
        if isinstance(data,dict):
            if isinstance(data.get('items'),list):
                metrics['items']=len(data['items']);actual.append('items='+str(metrics['items']))
                for key in ['total','nextOffset','purpose']:
                    if key in data:actual.append(key+'='+scalar(data[key]));metrics[key]=data[key]
            if isinstance(data.get('days'),list):
                metrics['dayRows']=len(data['days']);actual+=['from='+scalar(data.get('from')),'to='+scalar(data.get('to')),'maxDays='+scalar(data.get('maxDays')),'days记录数='+str(metrics['dayRows'])]
            if data.get('code'):actual.append('code='+scalar(data['code']))
        if method in ['POST','PATCH','DELETE'] and '/daily-items' in path:
            # 只使用本用例call阶段的创建和读回；排除会话级清理的后续404。
            reads=[(i,r) for i,r in related if r['method']=='GET' and '/daily-items/' in urlsplit(r['url']).path]
            created=[(i,r) for i,r in related if r['method']=='POST' and urlsplit(r['url']).path=='/api/v1/daily-items']
            if reads:
                read_line,read=reads[-1];current=read.get('responseBody') or {}
                actual.append('读回HTTP='+str(read['status']));metrics['readStatus']=read['status']
                if read['status']==200:
                    text=current.get('body');metrics['readBodyLength']=len(text) if isinstance(text,str) else None
                    metrics['rowVersion']=current.get('rowVersion')
                    actual+=['读回正文长度='+scalar(metrics['readBodyLength']),'rowVersion='+scalar(metrics['rowVersion'])]
                    if isinstance(body,dict) and isinstance(body.get('body'),str) and row['status']==200:
                        metrics['bodyMatchesInput']=text==body['body'];actual.append('正文与输入一致='+scalar(metrics['bodyMatchesInput']))
                    if method=='PATCH' and row['status']!=200 and created:
                        original=created[0][1]['requestBody']['body'];metrics['unchanged']=text==original
                        actual.append('拒绝后原文未变='+scalar(metrics['unchanged']))
                metrics['readRequestLine']=read_line
            if 'deleted' in data:actual.append('deleted='+scalar(data['deleted']))
        input_text='，'.join(input_parts) or '见本用例原始请求'
        observed=f"HTTP {row['status']}"+('；'+'，'.join(actual) if actual else '')
        evidence.append({'caseId':case['id'],'kind':case['kind'],'input':input_text,'expected':case['expected'],'actualStatus':row['status'],'observed':observed,'pytest':case_row['result'],'requestLines':[line]+([metrics['readRequestLine']] if 'readRequestLine' in metrics else []),'metrics':metrics})
    sentences=[]
    for kind in ['正常','边界','异常']:
        selected=[e for e in evidence if e['kind']==kind]
        # 明确给出真实输入、输出，不用“按预期接受/拒绝”替代证据。
        examples=selected if kind!='正常' else selected[:2]
        text='；'.join(f"{e['caseId']}（{e.get('input','输入证据缺失')}）实际{e['observed']}" for e in examples)
        sentences.append(kind+'输入：'+text+'。')
    all_matched=all(e.get('actualStatus')==e['expected'] and e['pytest']=='passed' for e in evidence)
    conclusion='以上实际状态均与各用例预期吻合，且pytest业务后置条件全部通过，因此本轮所列三类用例通过。' if all_matched else '实际记录存在状态不符、用例失败或证据缺失，当前不能判定本方法完整通过。'
    successful=[e for e in evidence if e.get('actualStatus')==200]
    if successful and all(e['metrics'].get('items')==0 for e in successful if 'items' in e['metrics']) and any('items' in e['metrics'] for e in successful):
        conclusion+=' 成功响应的items均为0，本轮没有验证非空列表的分页内容或筛选正确性。'
    if successful and all(e['metrics'].get('dayRows')==0 for e in successful if 'dayRows' in e['metrics']) and any('dayRows' in e['metrics'] for e in successful):
        conclusion+=' 成功响应days记录数均为0，验证了日期范围及空汇总行为，尚未验证非零事项的逐日计数。'
    full_page=[e for e in successful if 'limit=100' in e.get('input','') and 'items' in e['metrics']]
    short=[e for e in full_page if 0<e['metrics']['items']<100]
    if short:
        actual_counts='、'.join(str(e['metrics']['items']) for e in short)
        conclusion+=f' limit=100时实际仅返回{actual_counts}条，本轮未覆盖装满100条的满页场景，不能由此推断满页数据正确性。'
    analysis='\n\n'.join(sentences+[conclusion])
    report['analysis']=analysis;report['actualEvidence']=evidence
    (out/'结论.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    (out/'结果分析.md').write_text(analysis+'\n')
    (out/'分析依据.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2))
    return analysis,evidence

def display_analysis(run,spec,report):
    analysis,evidence=analyze_method(run,spec,report)
    table='|类别/用例|实际输入|预期HTTP|实际输出摘要|pytest|原始记录行|\n|---|---|---:|---|---|---|\n'
    for e in evidence:
        values=[e['kind']+'/'+e['caseId'],e.get('input','证据缺失'),str(e['expected']),e['observed'],e['pytest'],','.join(map(str,e['requestLines']))]
        table+='|'+'|'.join(x.replace('|','\\|').replace('\n',' ') for x in values)+'|\n'
    display(Markdown('**实际数据对照：**\n\n'+table))
    display(Markdown('**测试结论与简析：**\n\n'+analysis))

def display_overall_analysis(run,summary,reports):
    from collections import Counter
    run=Path(run)
    paths=[run/'auth/requests.jsonl',*sorted(run.glob('M*/requests.jsonl'))]
    rows=[json.loads(line) for path in paths if path.exists() for line in path.read_text().splitlines()]
    statuses=Counter(row['status'] for row in rows)
    categories={kind:sum(r['categoryCoverage'][kind]['passed'] for r in reports) for kind in ['正常','边界','异常']}
    text=f"本次原始记录共{len(rows)}次HTTP请求，状态分布为"+'、'.join(f'{key}={value}次' for key,value in sorted(statuses.items(),key=lambda x:str(x[0])))+'。'
    text+=f" pytest实际通过{summary['counts']['passed']}项、失败{summary['counts']['failed']}项、跳过{summary['counts']['skipped']}项，其中正常{categories['正常']}、合法边界{categories['边界']}、异常{categories['异常']}项；{len(reports)}个方法三类均实际执行并通过。"
    text+=f" 清理记录显示创建{summary['cleanup']['created']}条事项、未决{len(summary['cleanup']['unresolved'])}条；共享会话退出HTTP200为{sum(v==200 for v in summary['logout'].values())}/{len(summary['logout'])}个。"
    empty=[]
    for report in reports:
        values=[e for e in report.get('actualEvidence',[]) if e.get('actualStatus')==200 and 'items' in e.get('metrics',{})]
        if values and all(e['metrics']['items']==0 for e in values):empty.append(report['method'])
    if empty:text+=' '+ '、'.join(empty)+'的成功响应均为0条列表，仅证明空结果与参数校验路径，不能推断非空分页内容已验证。'
    metrics=summary.get('javaCoverage',{})
    if metrics:
        line=metrics['LINE'];branch=metrics['BRANCH']
        text+=f" JaCoCo实际行覆盖为{line['covered']}/{line['total']}（{line['percent']}%），分支覆盖为{branch['covered']}/{branch['total']}（{branch['percent']}%）；因此用例全通过不等于全部业务代码或分支已覆盖。"
    summary['analysis']=text
    (run/'总体结果分析.md').write_text(text+'\n')
    (run/'结论.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
    display(Markdown('**总体分析（基于本次实际数据）：** '+text))
