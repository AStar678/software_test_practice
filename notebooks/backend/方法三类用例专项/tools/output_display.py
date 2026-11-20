"""默认折叠原始输出，保留完整内容供Jupyter/HTML展开查看。"""
import json
from html import escape
from IPython.display import display,HTML

def fold_raw(text,title='展开原始数据与pytest详细日志'):
    # 不截断原始正文；details不带open，初始即为折叠状态。
    html='<details class="raw-test-output"><summary style="cursor:pointer;font-weight:600;padding:8px">'+escape(title)+'</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:650px;overflow:auto;border:1px solid #ddd;padding:12px">'+escape(text)+'</pre></details>'
    display(HTML(html))

def fold_records(records,title='展开原始HTTP请求与响应'):
    fold_raw('\n\n'.join(json.dumps(row,ensure_ascii=False,indent=2) for row in records),title+f'（{len(records)}条）')
