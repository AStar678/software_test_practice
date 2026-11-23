from pathlib import Path
import ast,json,textwrap,re,pprint
ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parents[2]
specs=[]
def c(label,kind,value,expected,partition,reason,**kw):
    return {'id':label,'kind':kind,'value':value,'expected':expected,'equivalenceClass':partition,'boundaryBasis':reason,**kw}
def add(method,endpoint,description,domain,cases,source,interpretation):
    assert len(cases)>=3 and {x['kind'] for x in cases}=={'正常','边界','异常'}
    assert all(x['expected']==200 for x in cases if x['kind'] in ['正常','边界'])
    name=method.split('.')[0];path=next(REPO.glob('backend/src/main/java/**/'+name+'.java'))
    method_name=method.split('.')[1]
    signature_marker='requestedLimit' if method=='TaskService.approvals' else 'purpose' if method=='TaskService.assigneeCandidates' else ''
    lines=path.read_text().splitlines();line=next(i for i,l in enumerate(lines,1) if re.search(r'public .*\b'+method_name+r'\(',l) and signature_marker in l)
    specs.append({'id':f'M{len(specs)+1:02d}','method':method,'endpoint':endpoint,'description':description,'domain':domain,'cases':cases,'source':source,'sourceReference':str(path.relative_to(REPO))+':'+str(line),'sourceSha256':__import__('hashlib').sha256(path.read_bytes()).hexdigest(),'interpretation':interpretation})
login_cases=[
 c('N_employee','正常','employee',200,'有效员工手机号和密码','通常长度11的有效登录标识'),
 c('N_admin','正常','admin',200,'有效独立管理员账号和密码','管理员与员工登录分支分开'),
 c('B_identifier80','边界',80,200,'可规范化的合法员工标识','原始identifier长度上限80，69空格+11位手机号=80'),
 c('E_identifier81','异常',81,401,'超长登录标识','上限80的首次越界81，规范化前应拒绝'),
 c('E_phone_type','异常','wrong_type',400,'手机号为数组而非字符串','无效JSON类型等价类'),
 c('E_password_wrong','异常','wrong_password',401,'身份格式有效但密码错误','无效凭据等价类')]
add('AuthService.login','POST /auth/sessions','签发员工或独立管理员会话。','identifier为字符串且原始长度≤80；员工手机号可去除显示分隔符；凭据必须匹配。',login_cases,'''@pytest.mark.parametrize('case',CASES,ids=lambda case:case['id'])
def test_login_three_classes(cloud,case):
    # 使用隐藏输入的真实凭据，代码与结果文件不保存密码。
    admin=case['value']=='admin'
    payload={'accountType':'admin' if admin else 'employee','accountName' if admin else 'phone':os.environ.get('PANDORA_CLOUD_ADMIN_NAME','admin') if admin else '13800000001','password':os.environ['PANDORA_CLOUD_ADMIN_PASSWORD' if admin else 'PANDORA_CLOUD_PASSWORD']}
    if case['kind']=='边界' or case['value']==81:payload['phone']=' '*(case['value']-11)+'13800000001'
    if case['value']=='wrong_type':payload['phone']=[]
    if case['value']=='wrong_password':payload['password']='invalid-test-password'
    status,data=cloud.request('POST','/auth/sessions',payload)
    # 理想结果：普通和80字符边界可登录，81字符/类型错误/错误密码分别拒绝。
    assert status==case['expected']
    if status==200:
        alias='OWN-'+case['id'];cloud.tokens[alias]=data['token']
        try:
            session_status,session=cloud.request('GET','/auth/session',actor=alias)
            assert session_status==200
        finally:
            assert cloud.request('DELETE','/auth/sessions/current',actor=alias)[0]==200
            cloud.tokens.pop(alias,None)
''','80字符是原始输入长度边界，包含可去除空格；并不是把手机号数字长度伪造为80。每次成功登录的新会话均立即退出。')
page_cases=[c('N_limit20','正常',20,200,'允许范围内的分页长度','内部代表值20'),c('B_limit1','边界',1,200,'合法最小分页长度','精确下界1'),c('B_limit100','边界',100,200,'合法最大分页长度','精确上界100'),c('E_limit0','异常',0,400,'小于允许范围','下界外相邻值0'),c('E_limit101','异常',101,400,'大于允许范围','上界外相邻值101'),c('E_limit_text','异常','x',400,'分页值非整数','无效类型/格式等价类'),c('B_offset_max','边界',20,200,'最大合法分页偏移','offset的Integer.MAX_VALUE=2147483647',offset=2147483647),c('E_offset_overflow','异常',20,400,'偏移数值溢出','offset首次越界2147483648',offset=2147483648)]
def page_source(path,actor='A4',extra=None):
    return f'''@pytest.mark.parametrize('case',CASES,ids=lambda case:case['id'])
def test_paging_three_classes(cloud,case):
    # 等价类：有效整数、越界整数、无效字符串；同时检查精确上下界。
    query={extra or {}}.copy()
    query.update(limit=case['value'],offset=case.get('offset',0))
    actor=case.get('actor',{actor!r})
    status,data=cloud.request('GET',{path!r}+'?'+urlencode(query),actor=actor)
    # 理想结果：正常与合法边界200；越界或非整数400。
    assert status==case['expected']
    if status==200:
        assert isinstance(data['items'],list)
        assert len(data['items'])<=case['value']
        if case.get('offset')==2147483647:assert data['items']==[]
'''
add('DailyItemService.list','GET /daily-items','按日期分页读取本人事项。','limit∈[1,100]；offset∈[0,2147483647]；日期必须可解析。',page_cases,page_source('/daily-items',extra={'date':'2026-11-20'}),'边界输入真实落在1、100和2147483647，异常输入分别紧邻边界或属于非整数类；只读本人数据。')
summary_cases=[c('N_days30','正常',30,200,'有效的含首尾日期范围','内部代表值30天'),c('B_days1','边界',1,200,'最短合法区间','精确下界1天，from=to'),c('B_days93','边界',93,200,'最长合法区间','精确上界93天'),c('E_days0','异常',0,400,'倒序区间','下界外相邻值0天'),c('E_days94','异常',94,400,'超长区间','上界外相邻值94天'),c('E_invalid_date','异常','1900-02-29',400,'非法公历日期','1900年不是闰年')]
add('DailyItemService.summary','GET /daily-items/summary','汇总个人事项日期范围内的计数。','日期区间含首尾，长度必须为1–93天。',summary_cases,'''@pytest.mark.parametrize('case',CASES,ids=lambda case:case['id'])
def test_summary_three_classes(cloud,case):
    start=dt.date(2024,2,1)
    query={'from':str(start),'to':str(start+dt.timedelta(days=case['value']-1))} if isinstance(case['value'],int) else {'from':case['value'],'to':'1900-03-01'}
    status,data=cloud.request('GET','/daily-items/summary?'+urlencode(query),actor='A4')
    assert status==case['expected']
    if status==200:
        assert data['from']==query['from'] and data['to']==query['to']
        assert data['maxDays']==93
        assert all(query['from']<=row['date']<=query['to'] for row in data['days'])
''','按含首尾天数计算，93天接受、94天拒绝；不能误按两个日期相差值计算成92/93。')
text_cases=[c('N_text20','正常',20,200,'非空且在长度内的正文','内部代表值20码点'),c('B_text1','边界',1,200,'最短合法正文','精确下界1码点'),c('B_text2000','边界',2000,200,'最长合法正文','精确上界2000码点'),c('E_text0','异常',0,400,'空正文','下界外相邻值0'),c('E_text2001','异常',2001,400,'超长正文','上界外相邻值2001'),c('E_text_type','异常','number',400,'正文为数字','无效JSON类型等价类')]
add('DailyItemService.create','POST /daily-items','新建本人单日事项。','正文为字符串，长度按Unicode码点计算，允许1–2000；单日日期有效。',text_cases,'''@pytest.mark.parametrize('case',CASES,ids=lambda case:case['id'])
def test_create_three_classes(cloud,case):
    text='汉'*case['value'] if isinstance(case['value'],int) else 123
    status,data=cloud.request('POST','/daily-items',{'date':DAY,'body':text},actor='A4',key=uuid.uuid4().hex)
    assert status==case['expected']
    if status==200:
        read_status,current=cloud.request('GET','/daily-items/'+data['id'],actor='A4')
        assert read_status==200 and current['body']==text and current['rowVersion']==1
''','所有成功创建项由客户端立即登记ID，在本方法结束时逐条清理；验证读回正文，避免仅凭200判断保存成功。')
change_cases=text_cases+[c('E_version_missing','异常',20,428,'版本前置条件缺失','If-Match未提供',version=None),c('E_version_stale','异常',20,412,'版本前置条件陈旧','初始版本为1，输入0',version=0)]
add('DailyItemService.change','PATCH /daily-items/{id}','按行版本更新本人事项正文。','正文1–2000码点；If-Match必须等于对象当前版本。',change_cases,'''@pytest.mark.parametrize('case',CASES,ids=lambda case:case['id'])
def test_change_three_classes(cloud,case):
    # 每个用例新建独立对象，不让前一用例的版本变化影响后一用例。
    original='before-'+uuid.uuid4().hex
    row=create_owned(cloud,original)
    text='汉'*case['value'] if isinstance(case['value'],int) else 123
    status,data=cloud.request('PATCH','/daily-items/'+row['id'],{'body':text},actor='A4',key=uuid.uuid4().hex,version=case.get('version',1))
    assert status==case['expected']
    read_status,current=cloud.request('GET','/daily-items/'+row['id'],actor='A4')
    assert read_status==200
    if status==200:assert current['body']==text and current['rowVersion']==2
    else:assert current['body']==original and current['rowVersion']==1
''','正常和上下界更新后正文与版本必须吻合；异常更新读回仍为原文、版本1，证明拒绝没有覆盖数据。')
delete_cases=[c('N_version2','正常',2,200,'存在且版本匹配的本人对象','先将本次新建对象更新至版本2'),c('B_version1','边界',1,200,'最小有效对象版本','对象刚创建时初始版本1'),c('E_version0','异常',0,412,'陈旧版本','小于初始版本的相邻值0'),c('E_version_missing','异常',None,428,'缺少版本前置条件','If-Match缺失')]
add('DailyItemService.delete','DELETE /daily-items/{id}','按当前版本删除本人事项。','新对象行版本从1开始；删除时须提供匹配的版本。',delete_cases,'''@pytest.mark.parametrize('case',CASES,ids=lambda case:case['id'])
def test_delete_three_classes(cloud,case):
    row=create_owned(cloud,'delete-'+uuid.uuid4().hex)
    if case['value']==2:
        assert cloud.request('PATCH','/daily-items/'+row['id'],{'body':'updated'},actor='A4',key=uuid.uuid4().hex,version=1)[0]==200
    status,data=cloud.request('DELETE','/daily-items/'+row['id'],actor='A4',key=uuid.uuid4().hex,version=case['value'])
    assert status==case['expected']
    check_status,current=cloud.request('GET','/daily-items/'+row['id'],actor='A4')
    assert check_status==(404 if status==200 else 200)
''','版本1是对象生命周期的最小有效状态边界；版本2代表通常更新后对象。失败删除仍可读，成功删除后404。')
# 以下均为不同的后端方法；相同分页规则由各自真实HTTP入口验证。
page_methods=[('WorkspaceService.users','/users','读取员工可见目录','A4',{}),('WorkspaceService.logs','/work-logs','读取本人工作日志','A4',{'scope':'self'}),('WorkspaceService.notifications','/notifications','读取本人通知','A4',{}),('WorkspaceService.adminTeams','/admin/teams','管理员读取小组目录','ADMIN',{}),('WorkspaceService.audit','/admin/audit-logs','管理员读取审计记录','ADMIN',{}),('WorkspaceService.adminNotifications','/admin/notifications','管理员读取投递通知','ADMIN',{}),('TaskService.list','/tasks','读取本人任务列表','A4',{'scope':'self'}),('TaskService.table','/tasks/table','读取个人任务表单投影','A4',{}),('TaskService.adminTasks','/admin/tasks','管理员定位任务','ADMIN',{})]
for method,path,desc,actor,extra in page_methods:
    cases=[dict(x) for x in page_cases]
    if method=='WorkspaceService.users':
        cases += [c('N_admin20','正常',20,200,'管理员目录有效分页','管理员调用同一users方法的admin分支',actor='ADMIN',path='/admin/users'),c('B_admin100','边界',100,200,'管理员目录合法最大分页','精确上界100',actor='ADMIN',path='/admin/users'),c('E_admin101','异常',101,400,'管理员目录越界','上界外相邻值101',actor='ADMIN',path='/admin/users')]
    body=page_source(path,actor,extra)
    if method=='WorkspaceService.users':body=body.replace("'/users'+'?'","case.get('path','/users')+'?'")
    add(method,'GET '+path,desc+'。','limit∈[1,100]；offset∈[0,2147483647]；非整数或越界拒绝。',cases,body,'正常值20、精确边界1/100及偏移最大值应接受；0/101、非整数字符串及偏移溢出应拒绝。管理员方法使用独立管理员身份。')
candidates=[c('N_query','正常',10,200,'合法检索字符串','长度10的普通检索'),c('B_query0','边界',0,200,'空检索返回允许候选范围','精确下界0字符'),c('B_query100','边界',100,200,'最长合法检索','精确上界100字符'),c('E_query101','异常',101,400,'检索过长','上界外相邻值101'),c('E_purpose','异常',10,400,'无效操作场景枚举','purpose不属于create/edit',purpose='invalid')]
add('TaskService.assigneeCandidates','GET /assignee-candidates','读取有权限分派的负责人候选。','q长度0–100；purpose只能为create或edit。',candidates,'''@pytest.mark.parametrize('case',CASES,ids=lambda case:case['id'])
def test_candidates_three_classes(cloud,case):
    query={'q':'汉'*case['value'],'purpose':case.get('purpose','create')}
    status,data=cloud.request('GET','/assignee-candidates?'+urlencode(query),actor='A4')
    assert status==case['expected']
    if status==200:assert isinstance(data['items'],list)
''','0和100字符是q的真实边界；101字符和非法purpose分别覆盖长度越界与无效枚举等价类。')
add('TaskService.approvals','GET /approval-requests','读取本人相关的申请列表。','limit∈[1,100]；offset∈[0,2147483647]；mine可为all/reviewer/applicant。',page_cases,page_source('/approval-requests',extra={'mine':'all'}),'本章经HTTP验证四参数approvals重载；不将内部私有方法或其他重载重复计为已测方法。')
# 生成可复现的测试报告。
cells=[]
def md(s):cells.append({'cell_type':'markdown','metadata':{},'source':s})
def code(s):
    s=textwrap.dedent(s).strip();ast.parse(s);cells.append({'cell_type':'code','metadata':{},'source':s,'execution_count':None,'outputs':[]})
md('''# 后端方法专项：等价类划分与边界值分析

**被测目标仅为云端 `https://8.141.96.122:6644/api/v1`。**

本专项选择17个具有可通过HTTP验证的真实输入边界的方法，逐个满足“至少3例，且至少1例正常、1例合法边界、1例异常”。正常和合法边界均设计为200成功；异常需按明确状态码拒绝，不将鉴权失败或已退役410冒充正常输入。每例有编号、类别、等价类、边界依据、输入与理想结果。系统自动核对每个方法三类均实际执行并通过。

这是经HTTP验证对应Service入口的集成/黑盒测试，不是Java私有方法单元测试，也不宣称已覆盖项目全部方法。无业务输入、已退役或需改动真实组织/账号才能达到正向分支的接口，不在此严格三类专项中。管理员正向方法包含小组、审计、通知、任务定位，另验证管理员登录和users的管理分支。

**测试过程：** 先校验6644健康和7个会话 → 按方法设计表与源码运行pytest → 打印本方法全部原始输入/响应与三类统计 → 清理本人临时事项 → 逐方法分析 → 统一退出本次会话并给出结论。

只创建和删除本次新建个人事项，不改现有任务、组织、账号资料或密码。原始业务数据完整保留并默认折叠，点击可展开，密码与Token脱敏。提供SSH隐藏输入时临时采集云端Java行/分支覆盖；未提供时明确未采集，不复用历史结果。覆盖率与断言通过率分别报告。''')
code('''
import os,sys,json,uuid,getpass,pytest
from pathlib import Path
from datetime import datetime
from IPython.display import display,Markdown,HTML,Image
from html import escape
ROOT=Path.cwd().resolve()
if not (ROOT/'tools/matrix_runner.py').exists():
    candidates=[Path.cwd(),*Path.cwd().parents]
    ROOT=next(p/'notebooks/backend/方法三类用例专项' for p in candidates if (p/'notebooks/backend/方法三类用例专项/tools/matrix_runner.py').exists())
sys.path.insert(0,str(ROOT/'tools'))
from cloud_client import Cloud,BASE
from report_layout import CSS
display(HTML('<style>'+CSS+'</style>'))
from matrix_runner import execute_method,show_method
from result_analysis import display_overall_analysis
from output_display import fold_records
from cloud_coverage import CloudCoverage,show_coverage
SPECS=json.loads((ROOT/'方法用例设计.json').read_text())
assert BASE=='https://8.141.96.122:6644/api/v1'
RUN=ROOT/'runs'/('matrix6644-'+datetime.now().strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:6])
RUN.mkdir(parents=True)
AUTH=RUN/'auth';AUTH.mkdir()
SESSION=Cloud(AUTH)
CAPTURED={};REPORTS=[]
password=os.environ.get('PANDORA_CLOUD_PASSWORD')
if password is None:password=getpass.getpass('员工应用密码：')
admin_password=os.environ.get('PANDORA_CLOUD_ADMIN_PASSWORD')
if admin_password is None:admin_password=getpass.getpass('管理员应用密码（留空沿用员工密码）：') or password
PASSWORDS={'employee':password,'admin':admin_password}
# 需要真实覆盖率时临时给6644实例加载JaCoCo；留空仅做接口测试，覆盖率明确未采集。
ssh_password=os.environ.get('PANDORA_SSH_PASSWORD')
if ssh_password is None:ssh_password=getpass.getpass('覆盖率采集的服务器SSH密码（留空不采集）：')
COVERAGE=None
if ssh_password:
    COVERAGE=CloudCoverage(ROOT,RUN)
    try:COVERAGE.start(ssh_password)
    finally:ssh_password=None
status,health=SESSION.request('GET','/health')
assert status==200 and health['status']=='UP','云端不可用，停止，不切换到本地或443'
previous={key:os.environ.get(key) for key in ['PANDORA_CLOUD_PASSWORD','PANDORA_CLOUD_ADMIN_PASSWORD']}
os.environ.update(PANDORA_CLOUD_PASSWORD=password,PANDORA_CLOUD_ADMIN_PASSWORD=admin_password)
try:SESSION.login()
finally:
    for key,value in previous.items():
        if value is None:os.environ.pop(key,None)
        else:os.environ[key]=value
    password=admin_password=None
print('被测目标：',BASE,'；登录状态：',SESSION.login_results,'；结果目录：',RUN)
assert all(SESSION.login_results.get(key)==200 for key in ['A1','A2','A3','A4','A5','A6','ADMIN'])
fold_records([json.loads(line) for line in (AUTH/'requests.jsonl').read_text().splitlines()],'展开准备阶段原始数据（认证脱敏）')
''')
for spec in specs:
    md(f"## {spec['id']}. {spec['method']}\n\n**方法功能：** {spec['description']}\n\n**云端入口：** `{spec['endpoint']}`\n\n**输入域及边界：** {spec['domain']}\n\n**源码依据：** `{spec['sourceReference']}`。这里核对源码定义，再通过云端HTTP验证运行行为，不把本地代码检查记为云端执行。\n\n### 用例设计：等价类划分＋边界值分析")
    table='|编号|类别|输入/代表值|等价类|边界依据|理想HTTP|\n|---|---|---|---|---|---|\n'
    for row in spec['cases']:
        table+='|'+ '|'.join(str(row[k]).replace('|','\\|') for k in ['id','kind','value','equivalenceClass','boundaryBasis','expected'])+'|\n'
    md(table+'\n每条参数是独立pytest用例；正常与合法边界预期成功，异常预期明确拒绝。')
    md('### 测试代码与过程\n\n下面的CASES可编辑，测试函数逐条发送真实HTTP请求并核对状态及业务后置条件。')
    source='CASES='+pprint.pformat(spec['cases'],sort_dicts=False,width=100)+'\n\n'+spec['source']
    code(source+f'\n# METHOD_SOURCE\nCAPTURED[{spec["id"]!r}]=get_ipython().history_manager.input_hist_raw[-1].split("# METHOD_SOURCE")[0]')
    extra=',passwords=PASSWORDS' if spec['method']=='AuthService.login' else ''
    code(f"SPEC=next(item for item in SPECS if item['id']=={spec['id']!r})\nREPORTS.append(execute_method(ROOT,RUN,SPEC,CAPTURED[{spec['id']!r}],SESSION{extra}))"+ ('\nPASSWORDS.clear()' if extra else ''))
    md('### 测试结果与结论分析\n\n完整保留本方法用例执行过程和原始数据，结果后紧跟一段简短分析。')
    code('show_method(RUN,SPEC,REPORTS[-1])')
md('## 总体测试结论与三类用例达标检查\n\n逐方法检查正常、边界、异常各至少1例实际执行且通过；缺失、跳过、失败均不可声明达标。先退出本次共享会话，再生成汇总。')
code('''
logout={}
for actor in list(SESSION.tokens):logout[actor]=SESSION.request('DELETE','/auth/sessions/current',actor=actor)[0]
SESSION.tokens.clear()
print('共享会话退出状态：',logout)
fold_records([json.loads(line) for line in (AUTH/'requests.jsonl').read_text().splitlines() if json.loads(line)['method']=='DELETE'],'展开退出会话原始响应')
coverage_data=COVERAGE.finish(SPECS) if COVERAGE else None
counts={key:sum(report['counts'][key] for report in REPORTS) for key in ['passed','failed','skipped']}
complete=all(report['threeCategoriesSatisfied'] for report in REPORTS)
created=sum(report['cleanup']['created'] for report in REPORTS)
unresolved=[item for report in REPORTS for item in report['cleanup']['unresolved']]
state='PASS' if len(REPORTS)==len(SPECS) and all(report['status']=='PASS' for report in REPORTS) and complete and not unresolved and all(status==200 for status in logout.values()) else 'FAIL'
summary={'target':BASE,'status':state,'methods':len(REPORTS),'counts':counts,'eachMethodHasNormalBoundaryExceptional':complete,'cleanup':{'created':created,'unresolved':unresolved},'logout':logout,'cloudJavaCodeCoverage':'COLLECTED' if coverage_data else 'NOT_COLLECTED','localBackendExecuted':False}
if coverage_data:summary['javaCoverage']=coverage_data['counters']
(RUN/'结论.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
print(json.dumps(summary,ensure_ascii=False,indent=2))
html='<html><meta charset="utf-8"><body style="font:16px sans-serif;padding:24px"><h1>方法三类用例实际结果</h1><pre>'+escape(json.dumps(summary,ensure_ascii=False,indent=2))+'</pre><table border="1"><tr><th>方法</th><th>正常</th><th>边界</th><th>异常</th><th>结论</th></tr>'
for report in REPORTS:
    html+='<tr><td>'+report['method']+'</td>'+''.join('<td>'+str(report['categoryCoverage'][kind]['passed'])+'</td>' for kind in ['正常','边界','异常'])+'<td>'+report['status']+'</td></tr>'
html+='</table></body></html>'
(RUN/'测试结果.html').write_text(html)
display(HTML(html))
display_overall_analysis(RUN,summary,REPORTS)
''')
md('## 真实云端代码覆盖率报告与截图\n\n使用JaCoCo采集6644实际JVM，在测试前reset、测试后dump，以同一部署JAR的cn.pandora类生成HTML/XML/CSV。不是pytest驱动脚本的覆盖率。采集后恢复原启动配置。\n\n采集选项依据：[JaCoCo Agent](https://www.jacoco.org/jacoco/trunk/doc/agent.html)、[JaCoCo CLI](https://www.jacoco.org/jacoco/trunk/doc/cli.html)。')
code('await show_coverage(COVERAGE)')
code('''
from playwright.async_api import async_playwright
async with async_playwright() as pw:
    edge=Path('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge')
    browser=await pw.chromium.launch(executable_path=str(edge) if edge.exists() else None,headless=True)
    page=await browser.new_page(viewport={'width':1300,'height':1000})
    await page.goto((RUN/'测试结果.html').as_uri())
    await page.screenshot(path=str(RUN/'pytest三类用例结果.png'),full_page=True)
    await browser.close()
display(Image(filename=str(RUN/'pytest三类用例结果.png')))
assert summary['status']=='PASS','本次未完整达标，请核对逐方法三类覆盖和失败原始数据'
''')
for i,cell in enumerate(cells):cell['id']=f'method-matrix-{i:03d}'
nb={'nbformat':4,'nbformat_minor':5,'metadata':{'kernelspec':{'display_name':'Python 3 (6644 method matrix)','language':'python','name':'python3'},'language_info':{'name':'python'}},'cells':cells}
import nbformat
from report_layout import format_report
nb=format_report(nbformat.from_dict(nb),specs)
nbformat.write(nb,ROOT/'测试报告.ipynb')
(ROOT/'方法用例设计.json').write_text(json.dumps([{k:v for k,v in spec.items() if k!='source'} for spec in specs],ensure_ascii=False,indent=2))
print('Generated',len(specs),'methods,',sum(len(s['cases']) for s in specs),'cases,',len(cells),'cells')
