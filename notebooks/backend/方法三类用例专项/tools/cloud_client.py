# 测试意图：说明目标业务方法与本组用例覆盖点。
"""HTTPS-only client; no local server/database, detailed request/response evidence with credentials redacted."""
# 加载该测试实际使用的模块；不连接服务器。
import json,os,ssl,time,uuid,threading,urllib.request,urllib.error,urllib.parse
# 加载该测试实际使用的模块；不连接服务器。
from pathlib import Path
# 数据 / 执行步骤：ORIGIN='https://8.141.96.122:6644'
ORIGIN='https://8.141.96.122:6644'
# 数据 / 执行步骤：BASE=ORIGIN+'/api/v1'
BASE=ORIGIN+'/api/v1'
# 数据 / 执行步骤：LOCK=threading.RLock()
LOCK=threading.RLock()
# 递归识别认证字段；业务数据保持原值，不截断正文或集合。
def secret_key(key):
    key=str(key).lower().replace('_','').replace('-','')
    return any(x in key for x in ('password','token','authorization','cookie','secret','apikey'))
# 对结构化输入脱敏，避免测试参数、请求头、响应泄露凭据。
def redact(value):
    if isinstance(value,dict):return {k:('[REDACTED]' if secret_key(k) and not isinstance(v,bool) and v is not None else redact(v)) for k,v in value.items()}
    if isinstance(value,list):return [redact(v) for v in value]
    return value
# 原始响应只替换认证字段对应的字符串，保留其他原始文本和空白。
def redact_raw(raw,parsed,known=()):
    secrets=set(x for x in known if isinstance(x,str) and x)
    def collect(value):
        if isinstance(value,dict):
            for k,v in value.items():
                if secret_key(k) and isinstance(v,str) and v:secrets.add(v)
                else:collect(v)
        elif isinstance(value,list):
            for v in value:collect(v)
    collect(parsed)
    text=raw.decode('utf-8',errors='replace')
    for secret in sorted(secrets,key=len,reverse=True):
        text=text.replace(secret,'[REDACTED]').replace(json.dumps(secret,ensure_ascii=True)[1:-1],'[REDACTED]')
    return text
# 数据 / 执行步骤：class NoRedirect(urllib.request.HTTPRedirectHandler):
class NoRedirect(urllib.request.HTTPRedirectHandler):
    # 公共辅助方法：复用准备、请求或数据构造，不额外计作测试用例。
    def redirect_request(self,*args,**kwargs):
        # 数据 / 执行步骤：raise RuntimeError('禁止重定向：必须测试原始 6644，不允许跳转到 443/其他主机')
        raise RuntimeError('禁止重定向：必须测试原始 6644，不允许跳转到 443/其他主机')
# 数据 / 执行步骤：class Cloud:
class Cloud:
    # 公共辅助方法：复用准备、请求或数据构造，不额外计作测试用例。
    def __init__(self,output):
        # 数据 / 执行步骤：self.output=Path(output);self.tokens={};self.created=[];self.cleanup_errors=[];self.intents={};self.login_results={};self.owns_sessions=True
        self.output=Path(output);self.tokens={};self.created=[];self.cleanup_errors=[];self.intents={};self.login_results={};self.owns_sessions=True
        # 数据 / 执行步骤：self.manifest=self.output/'created-items.json'
        self.manifest=self.output/'created-items.json'
    # 公共辅助方法：复用准备、请求或数据构造，不额外计作测试用例。
    def request(self,method,path,body=None,actor=None,key=None,version=None):
        # 理想结果：下面断言成立；否则本条测试 FAIL，保留实际值与堆栈。
        assert path.startswith('/') and not path.startswith('//')
        # 数据 / 执行步骤：url=ORIGIN+path if path=='/health' else BASE+path
        url=ORIGIN+path if path=='/health' else BASE+path
        # 理想结果：下面断言成立；否则本条测试 FAIL，保留实际值与堆栈。
        assert urllib.parse.urlsplit(url).netloc=='8.141.96.122:6644'
        # 数据 / 执行步骤：headers={'Accept':'application/json','Content-Type':'application/json'}
        headers={'Accept':'application/json','Content-Type':'application/json'}
        # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
        if actor:headers['Authorization']='Bearer '+self.tokens[actor]
        # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
        if key:headers['Idempotency-Key']=key
        # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
        if version is not None:headers['If-Match']='"'+str(version)+'"'
        # 数据 / 执行步骤：proxy=os.environ.get('PANDORA_CLOUD_PROXY','')
        proxy=os.environ.get('PANDORA_CLOUD_PROXY','')
        # 数据 / 执行步骤：context=ssl.create_default_context()
        context=ssl.create_default_context()
        # 数据 / 执行步骤：opener=urllib.request.build_opener(urllib.request.ProxyHandler({'https':proxy} if proxy else {}),urllib.request.HTTPSHandler(context=context),NoRedirect())
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({'https':proxy} if proxy else {}),urllib.request.HTTPSHandler(context=context),NoRedirect())
        # 数据 / 执行步骤：req=urllib.request.Request(url,data=None if body is None else json.dumps(body).encode(),headers=headers,method=method)
        req=urllib.request.Request(url,data=None if body is None else json.dumps(body).encode(),headers=headers,method=method)
        # 数据 / 执行步骤：status=None;started=time.monotonic();raw=b'';result=None;response_headers={}
        status=None;started=time.monotonic();raw=b'';result=None;response_headers={}
        # 数据 / 执行步骤：intent_key=key if method=='POST' and path=='/daily-items' else None
        intent_key=key if method=='POST' and path=='/daily-items' else None
        # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
        if intent_key:
            # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
            with LOCK:
                # 数据 / 执行步骤：self.intents.setdefault(intent_key,{'key':key,'actor':actor,'body':body,'status':None})
                self.intents.setdefault(intent_key,{'key':key,'actor':actor,'body':body,'status':None})
                # 数据 / 执行步骤：(self.output/'write-intents.json').write_text(json.dumps(self.intents,ensure_ascii=False,indent=2))
                (self.output/'write-intents.json').write_text(json.dumps(self.intents,ensure_ascii=False,indent=2))
        # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
        try:
            # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
            try:
                # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
                with opener.open(req,timeout=20) as r:status=r.status;raw=r.read();final=r.url;response_headers=dict(r.headers)
            # 数据 / 执行步骤：except urllib.error.HTTPError as e:status=e.code;raw=e.read();final=e.url;response_headers=dict(e.headers)
            except urllib.error.HTTPError as e:status=e.code;raw=e.read();final=e.url;response_headers=dict(e.headers)
            # 理想结果：下面断言成立；否则本条测试 FAIL，保留实际值与堆栈。
            assert urllib.parse.urlsplit(final).netloc=='8.141.96.122:6644'
            # 数据 / 执行步骤：result=json.loads(raw or '{}')
            result=json.loads(raw or '{}')
            # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
            if method=='POST' and path=='/daily-items' and status in (200,201) and result.get('id'):
                # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
                with LOCK:
                    # 数据 / 执行步骤：item={'id':result['id'],'actor':actor}
                    item={'id':result['id'],'actor':actor}
                    # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
                    if item not in self.created:self.created.append(item)
                    # 数据 / 执行步骤：self.manifest.write_text(json.dumps(self.created,indent=2))
                    self.manifest.write_text(json.dumps(self.created,indent=2))
            # 返回实际结果 / 构造值，交由调用方断言，不将返回本身视为通过。
            return status,result
        # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
        finally:
            # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
            with LOCK:
                # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
                if intent_key:
                    # 数据 / 执行步骤：self.intents[intent_key]['status']=status
                    self.intents[intent_key]['status']=status
                    # 数据 / 执行步骤：(self.output/'write-intents.json').write_text(json.dumps(self.intents,ensure_ascii=False,indent=2))
                    (self.output/'write-intents.json').write_text(json.dumps(self.intents,ensure_ascii=False,indent=2))
                # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
                # pytest 提供当前用例和阶段；准备、业务断言、清理可以分别追溯。
                current=os.environ.get('PYTEST_CURRENT_TEST','')
                test_id,_,phase=current.rpartition(' (')
                # 完整输入、响应头、原始响应正文均记录；认证字段统一脱敏。
                row={'testId':test_id or '网络预检','phase':phase.rstrip(')') or 'precheck','method':method,'url':url,'actorAlias':actor,'idempotencyKey':key,'requestHeaders':redact(headers),'requestBody':redact(body),'status':status,'responseHeaders':redact(response_headers),'responseBody':redact(result),'responseRaw':redact_raw(raw,result,[os.environ.get('PANDORA_CLOUD_PASSWORD',''),os.environ.get('PANDORA_CLOUD_ADMIN_PASSWORD',''),*self.tokens.values()]),'seconds':round(time.monotonic()-started,3)}
                # 不裁剪长文本、不省略数组；JSONL 一行对应一次真实请求。
                with (self.output/'requests.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
    # 公共辅助方法：复用准备、请求或数据构造，不额外计作测试用例。
    def login(self):
        # 数据 / 执行步骤：password=os.environ.get('PANDORA_CLOUD_PASSWORD','')
        password=os.environ.get('PANDORA_CLOUD_PASSWORD','')
        # 理想结果：下面断言成立；否则本条测试 FAIL，保留实际值与堆栈。
        assert password,'请通过隐藏输入提供应用密码'
        # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
        for i in range(1,7):
            # 数据 / 执行步骤：alias='A'+str(i)
            alias='A'+str(i)
            # 数据 / 执行步骤：status,data=self.request('POST','/auth/sessions',{'accountType':'employee','phone':'1380000000'+str(i),'password':password})
            status,data=self.request('POST','/auth/sessions',{'accountType':'employee','phone':'1380000000'+str(i),'password':password})
            # 保存每个账号一次登录的实际状态；失败交给独立用例，不阻断其他账号。
            self.login_results[alias]=status
            # 理想结果：成功时取得会话；失败账号不保存令牌，也不重试密码。
            if status==200:self.tokens[alias]=data['token']
        # 管理员独立账号：只在提供其密码时登录，不修改凭据。
        admin_password=os.environ.get('PANDORA_CLOUD_ADMIN_PASSWORD','')
        if admin_password:
            status,data=self.request('POST','/auth/sessions',{'accountType':'admin','accountName':os.environ.get('PANDORA_CLOUD_ADMIN_NAME','admin'),'password':admin_password})
            self.login_results['ADMIN']=status
            if status==200:self.tokens['ADMIN']=data['token']
        # 仅记录别名和状态，不保存凭据或响应。
        (self.output/'account-logins.json').write_text(json.dumps(self.login_results,indent=2))
    # 公共辅助方法：复用准备、请求或数据构造，不额外计作测试用例。
    def cleanup(self):
        # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
        for item in list(self.created):
            # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
            try:
                # 数据 / 执行步骤：status,data=self.request('GET','/daily-items/'+item['id'],actor=item['actor'])
                status,data=self.request('GET','/daily-items/'+item['id'],actor=item['actor'])
                # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
                if status==404:continue
                # 理想结果：下面断言成立；否则本条测试 FAIL，保留实际值与堆栈。
                assert status==200
                # 数据 / 执行步骤：status,_=self.request('DELETE','/daily-items/'+item['id'],actor=item['actor'],key=uuid.uuid4().hex,version=data['rowVersion'])
                status,_=self.request('DELETE','/daily-items/'+item['id'],actor=item['actor'],key=uuid.uuid4().hex,version=data['rowVersion'])
                # 理想结果：下面断言成立；否则本条测试 FAIL，保留实际值与堆栈。
                assert status==200
                # 理想结果：下面断言成立；否则本条测试 FAIL，保留实际值与堆栈。
                assert self.request('GET','/daily-items/'+item['id'],actor=item['actor'])[0]==404
            # 数据 / 执行步骤：except Exception:self.cleanup_errors.append(item)
            except Exception:self.cleanup_errors.append(item)
        # 数据 / 执行步骤：self.cleanup_errors.extend({'unknownCreateKey':k} for k,v in self.intents.items() if v['status'] is None)
        self.cleanup_errors.extend({'unknownCreateKey':k} for k,v in self.intents.items() if v['status'] is None)
        # 数据 / 执行步骤：(self.output/'cleanup.json').write_text(json.dumps({'created':len(self.created),'unresolved':self.cleanup_errors},indent=2))
        (self.output/'cleanup.json').write_text(json.dumps({'created':len(self.created),'unresolved':self.cleanup_errors},indent=2))
        # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
        for alias in list(self.tokens) if self.owns_sessions else []:
            # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
            try:self.request('DELETE','/auth/sessions/current',actor=alias)
            # 数据 / 执行步骤：except Exception:pass
            except Exception:pass
        # 数据 / 执行步骤：self.tokens.clear()
        self.tokens.clear()
