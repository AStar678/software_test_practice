"""测试报告版式：只调整呈现与章节，不改测试代码或原始数据。"""
import re
CSS='''
:root{--report-ink:#172c46;--report-accent:#246d82;--report-muted:#607084;--report-line:#dbe4ec}
body{background:#f3f6f9!important;color:var(--report-ink)}
.jp-Notebook{max-width:1240px!important;margin:26px auto!important;padding:32px 40px!important;background:white;border:1px solid #e4eaf0;border-radius:14px;box-shadow:0 12px 38px #19324b0b}
.jp-RenderedMarkdown{color:#23384e;line-height:1.85;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;font-size:15px}
.jp-RenderedMarkdown h1{font-size:38px!important;font-weight:750;letter-spacing:2px;color:#142c46;margin:10px 0 18px}
.jp-RenderedMarkdown h2{font-size:23px!important;color:#18364f;border-left:4px solid #267b8c;padding:12px 16px;background:#f0f6f8;border-radius:0 7px 7px 0;margin:42px 0 18px}
.jp-RenderedMarkdown h3{font-size:17px!important;font-weight:650;color:#265268;margin:25px 0 12px}
.jp-RenderedMarkdown p{margin:10px 0 14px}
.jp-RenderedMarkdown a{color:#246d82;text-decoration:none}.jp-RenderedMarkdown a:hover{text-decoration:underline}
.jp-RenderedMarkdown table{width:100%;font-size:13px;border-collapse:separate;border-spacing:0;line-height:1.65;margin:14px 0 22px;border:1px solid #dbe4ec;border-radius:8px;overflow:hidden}
.jp-RenderedMarkdown thead{background:#ecf3f6;color:#24455a}.jp-RenderedMarkdown th,.jp-RenderedMarkdown td{padding:10px 12px!important;text-align:left!important;border-bottom:1px solid #e6edf2;vertical-align:top;word-break:break-word}
.jp-RenderedMarkdown tbody tr:nth-child(even){background:#f8fafc}.jp-RenderedMarkdown tbody tr:last-child td{border-bottom:0}
.jp-RenderedMarkdown code{background:#eff4f7;border-radius:4px;padding:2px 5px;font-size:.88em;color:#20516a}
.jp-CodeCell{margin:12px 0 20px}.jp-InputArea-editor{border:1px solid #dfe7ee!important;border-radius:8px;background:#f7f9fc!important;max-height:510px;overflow:auto}
.jp-InputArea-editor pre{font-size:12.5px!important;line-height:1.6!important;padding:14px!important}.jp-InputPrompt,.jp-OutputPrompt{color:#8a99aa!important;font-size:11px}
.jp-RenderedText pre{white-space:pre-wrap;font-size:12.5px!important;color:#4a5e73;line-height:1.6}
.raw-test-output{border:1px solid #dbe5ed;background:#fafcfd;border-radius:8px;margin:14px 0 20px;padding:4px 10px}
.report-execution-code{margin:10px 0 18px;color:#708598;font-size:12px}.report-execution-code>summary{cursor:pointer;padding:7px 10px}.raw-test-output summary{color:#386177;font-size:13px}.raw-test-output[open]{background:#f5f9fc}.raw-test-output pre{font-size:12px;line-height:1.65;background:white}
.report-kicker{font-size:12px;letter-spacing:2px;color:#527589;text-transform:uppercase;margin:8px 0}.report-subtitle{color:#60758b;font-size:16px;margin-bottom:25px}
.report-nav{padding:14px 0;border-top:1px solid #e1e8ef;border-bottom:1px solid #e1e8ef;line-height:2.2;margin:18px 0 26px}
.report-badges{display:flex;gap:12px;flex-wrap:wrap;margin:22px 0}.report-badge{flex:1;min-width:160px;background:#f2f7f9;border:1px solid #dbe8ed;border-radius:9px;padding:16px 20px}.report-badge b{display:block;font-size:25px;line-height:1.3;color:#20566c}.report-badge span{font-size:12px;color:#698092}
.report-note{border-left:3px solid #81a9b8;background:#f6f9fb;padding:13px 17px;color:#506b7f;margin:18px 0;line-height:1.8}
@media(max-width:760px){.jp-Notebook{margin:0!important;padding:16px 10px!important;border:0;border-radius:0}.jp-RenderedMarkdown h1{font-size:30px!important}.jp-RenderedMarkdown table{display:block;overflow:auto}.report-badge{min-width:120px}}
@media print{body{background:white!important}.jp-Notebook{box-shadow:none;border:0;max-width:none!important;margin:0!important;padding:0!important}.jp-RenderedMarkdown h2{break-after:avoid}.raw-test-output:not([open]){display:none}.jp-InputArea-editor{max-height:none;overflow:visible}}
'''

TITLES=['登录认证','个人事项列表','个人事项日期汇总','新增个人事项','更新个人事项','删除个人事项','员工目录查询','工作日志查询','个人通知查询','管理员小组查询','管理员审计查询','管理员通知查询','任务列表查询','个人任务表查询','管理员任务定位','负责人候选查询','申请列表查询']

def format_report(nb,specs):
    import nbformat
    nb.metadata['title']='测试报告'
    if nb.metadata.get('reportLayout')=='v2':return nb
    if nb.metadata.get('reportLayout')=='v1':return remove_intro_labels(nb)
    overview='''# 测试报告

<div class="report-subtitle">云端后端接口 · 等价类划分与边界值分析</div>

<div class="report-badges"><div class="report-badge"><b>17</b><span>核心被测方法</span></div><div class="report-badge"><b>126</b><span>设计用例</span></div><div class="report-badge"><b>3 类</b><span>正常 · 边界 · 异常</span></div><div class="report-badge"><b>6644</b><span>云端后端端口</span></div></div>

<div class="report-nav"><a href="#methods">方法测试</a>　·　<a href="#conclusion">总体结论</a>　·　<a href="#coverage">代码覆盖率</a>　·　<a href="#reproduce">复现说明</a></div>


|项目|说明|
|---|---|
|被测地址|`https://8.141.96.122:6644/api/v1`|
|测试层次|通过真实 HTTP 请求验证 Service 入口的集成测试|
|设计方法|等价类划分＋边界值分析|
|达标规则|每个方法至少 3 例，正常、合法边界、异常各至少 1 例|
|身份范围|6 个员工账号及独立管理员账号|
|证据形式|pytest 结果、原始请求/响应、业务读回、JaCoCo 报告|

每个方法按**功能与输入约束 → 用例设计 → 测试代码 → 实际数据 → 结论分析**展开。正常与合法边界输入预期成功，异常输入按契约拒绝；以实际返回和业务后置条件判定结果。

<div class="report-note">原始日志和请求响应默认折叠，点击即可查看完整记录；测试摘要、数据对照表与分析保持可见。密码和令牌已脱敏。</div>

范围为所列 17 个核心方法。数据写入限于本次创建的个人事项，并按登记 ID 清理。覆盖率与用例通过率分别报告。
'''
    nb.cells[0].source=overview
    cells=[];inserted=False
    for i,cell in enumerate(nb.cells):
        if cell.cell_type=='markdown':
            match=re.match(r'## (M\d+)\. ',cell.source)
            if match:
                if not inserted:
                    cells.append(nbformat.v4.new_markdown_cell('<a id="methods"></a>\n## 01　方法测试\n\n下列章节逐方法核对正常、边界和异常输入。实际数据对照表中的记录行号可在对应方法的 `requests.jsonl` 中定位。'));inserted=True
                index=int(match.group(1)[1:])-1;spec=specs[index]
                cell.source=f"### 01.{index+1:02d}　{TITLES[index]}\n\n|项目|说明|\n|---|---|\n|方法|`{spec['method']}`|\n|接口|`{spec['endpoint']}`|\n|功能|{spec['description']}|\n|输入约束|{spec['domain']}|\n|代码依据|`{spec['sourceReference']}`|\n\n#### A　用例设计"
            elif cell.source.startswith('### 测试代码与过程'):cell.source='#### B　测试代码与过程\n\n修改下方 `CASES` 与断言后，从新内核完整运行。逐例核对 HTTP 状态和读回数据，并保留独立结果目录。'
            elif cell.source.startswith('### 测试结果与结论分析'):cell.source='#### C　实际结果与分析\n\n先查看执行摘要和三类达标情况，再结合逐用例实际数据判断结论。'
            elif cell.source.startswith('## 总体测试结论'):cell.source='<a id="conclusion"></a>\n## 02　总体测试结论\n\n汇总每个方法三类用例的实际执行情况，并核对临时事项清理及共享会话退出结果。'
            elif cell.source.startswith('## 真实云端代码覆盖率'):cell.source='<a id="coverage"></a>\n## 03　代码覆盖率\n\nJaCoCo 从 6644 实际 JVM 采集，使用对应部署类文件生成报告；测试前重置、测试后导出。完整报告、截图及入口方法统计如下。\n\n工具说明：[JaCoCo Agent](https://www.jacoco.org/jacoco/trunk/doc/agent.html) · [JaCoCo CLI](https://www.jacoco.org/jacoco/trunk/doc/cli.html)。'
        if cell.cell_type=='code':
            if i==1 or cell.source.startswith(('SPEC=','await show_coverage','from playwright.async_api')):
                cell.metadata.setdefault('jupyter',{})['source_hidden']=True
                cell.metadata['tags']=list(set(cell.metadata.get('tags',[])+['report-support-code']))
        cells.append(cell)
    cells.append(nbformat.v4.new_markdown_cell('<a id="reproduce"></a>\n## 04　复现说明\n\n1. 打开 `测试报告.ipynb`，选择已安装依赖的 Python 内核。\n2. 重启内核并运行全部单元格，在隐藏输入框提供应用凭据；需要重新采集覆盖率时再提供 SSH 凭据。\n3. 查看每个方法的数据对照表和结论；详细请求、响应与 pytest 日志可点击展开。\n4. 完成后核对总体结果、清理状态和覆盖率记录。\n\n每次运行创建独立目录，保存原始数据和报告。安装依赖与证据文件说明见同目录 `README.md`。'))
    nb.cells=cells
    for i,c in enumerate(nb.cells):
        if not c.get('id'):c['id']=f'report-layout-{i:03d}'
    nb.metadata['reportLayout']='v2'
    return nb

def style_html(path):
    path=__import__('pathlib').Path(path)
    text=path.read_text()
    text=re.sub(r'<title>.*?</title>','<title>测试报告</title>',text,count=1,flags=re.S)
    text=text.replace('</head>','<style id="test-report-theme">'+CSS+'</style>\n</head>',1)
    from bs4 import BeautifulSoup
    soup=BeautifulSoup(text,'html.parser')
    for cell in soup.select('.celltag_report-support-code'):
        wrapper=cell.find('div',class_='jp-Cell-inputWrapper',recursive=False)
        if wrapper:
            details=soup.new_tag('details',attrs={'class':'report-execution-code'})
            summary=soup.new_tag('summary');summary.string='查看运行配置与执行步骤'
            wrapper.insert_before(details);details.append(summary);details.append(wrapper.extract())
    path.write_text(str(soup))


def remove_intro_labels(nb):
    cells=[]
    for cell in nb.cells:
        if cell.cell_type=='markdown':
            if '<a id="preparation"></a>' in cell.source:continue
            cell.source=cell.source.replace('<a href="#overview">报告概览</a>　·　<a href="#preparation">运行准备</a>　·　','')
            cell.source=cell.source.replace('<a id="overview"></a>\n## 01　报告概览\n','')
            for old,new in [('## 03　方法测试','## 01　方法测试'),('### 03.','### 01.'),('## 04　总体测试结论','## 02　总体测试结论'),('## 05　代码覆盖率','## 03　代码覆盖率'),('## 06　复现说明','## 04　复现说明')]:cell.source=cell.source.replace(old,new)
        cells.append(cell)
    nb.cells=cells;nb.metadata['reportLayout']='v2'
    return nb
