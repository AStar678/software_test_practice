# 加载该测试实际使用的模块；不连接服务器。
import os,json
# 加载该测试实际使用的模块；不连接服务器。
from pathlib import Path
# 加载该测试实际使用的模块；不连接服务器。
import pytest
# 加载该测试实际使用的模块；不连接服务器。
from cloud_client import Cloud,redact
# 数据 / 执行步骤：OUT=Path(os.environ['PANDORA_CLOUD_OUTPUT'])
OUT=Path(os.environ['PANDORA_CLOUD_OUTPUT'])
# 公共辅助方法：复用准备、请求或数据构造，不额外计作测试用例。
def pytest_configure(config):config.addinivalue_line('markers','cloud_write: only owned personal daily-items, removed in session teardown')
# 公共辅助方法：复用准备、请求或数据构造，不额外计作测试用例。
def pytest_collection_modifyitems(items):
    # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
    if os.environ.get('PANDORA_CLOUD_WRITES','1')!='1':
        # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
        for item in items:
            # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
            if 'cloud_write' in item.keywords:item.add_marker(pytest.mark.skip(reason='写用例关闭；不能声明全部测试通过'))
# 数据 / 执行步骤：@pytest.fixture(scope='session')
@pytest.fixture(scope='session')
# 公共辅助方法：复用准备、请求或数据构造，不额外计作测试用例。
def public():return Cloud(OUT)
# 数据 / 执行步骤：@pytest.fixture(scope='session')
@pytest.fixture(scope='session')
# 公共辅助方法：复用准备、请求或数据构造，不额外计作测试用例。
def cloud():
    # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
    if not os.environ.get('PANDORA_CLOUD_PASSWORD') and not os.environ.get('PANDORA_CLOUD_SESSIONS'):pytest.skip('未提供应用凭据；没有执行认证用例')
    # 数据 / 执行步骤：client=Cloud(OUT)
    client=Cloud(OUT)
    # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
    try:
        # 数据 / 执行步骤：client.login();yield client
        # 同一Notebook各接口复用内存会话；令牌只传入子进程环境，不落盘。
        if os.environ.get('PANDORA_CLOUD_SESSIONS'):
            client.tokens=json.loads(os.environ['PANDORA_CLOUD_SESSIONS'])
            client.login_results=json.loads(os.environ['PANDORA_CLOUD_LOGIN_RESULTS'])
            client.owns_sessions=False
        else:client.login()
        yield client
    # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
    finally:
        # 数据 / 执行步骤：client.cleanup()
        client.cleanup()
        # 理想结果：下面断言成立；否则本条测试 FAIL，保留实际值与堆栈。
        assert not client.cleanup_errors,'云端测试条目清理未完成，见 cleanup.json'
# 每个参数用例独立检查前置账号；失败账号的正向登录用例仍执行并标为 FAIL。
@pytest.fixture(autouse=True)
def available_accounts(request):
    # 公开接口无凭据依赖，直接运行。
    if 'cloud' not in request.fixturenames:return
    # session 夹具对每个指定账号只登录一次。
    client=request.getfixturevalue('cloud')
    # 不跳过登录断言，否则会掩盖无效凭据。
    if request.node.originalname=='test_supplied_account_authentication':return
    # 带 actor 参数的用例需要该账号；其余业务边界用例使用 A4。
    actor=getattr(getattr(request.node,'callspec',None),'params',{}).get('actor','ADMIN' if request.node.originalname.startswith('test_admin') else 'A4')
    # 私有权限用例还需要 A4 创建本次事项。
    needed={actor,'A4'} if request.node.originalname=='test_private_item_scope' else {actor}
    # 缺少会话仅影响对应依赖，不把未执行请求算业务通过。
    needed.discard(None)
    if not needed.issubset(client.tokens):pytest.skip('依赖账号登录失败，见正向登录用例和 account-logins.json')
# 数据 / 执行步骤：@pytest.hookimpl(hookwrapper=True)
@pytest.hookimpl(hookwrapper=True)
# 公共辅助方法：复用准备、请求或数据构造，不额外计作测试用例。
def pytest_runtest_makereport(item,call):
    # 数据 / 执行步骤：outcome=yield;r=outcome.get_result()
    outcome=yield;r=outcome.get_result()
    # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
    if r.when=='call' or (r.when=='setup' and (r.skipped or r.failed)):
        # 数据 / 执行步骤：row={'id':item.nodeid,'result':r.outcome,'phase':r.when,'input':{k:(v if not isinstance(v,str) or len(v)<100 else f'{len(v)} characters') for k,v in getattr(getattr(item,
        row={'id':item.nodeid,'result':r.outcome,'phase':r.when,'seconds':round(r.duration,4),'input':redact(getattr(getattr(item,'callspec',None),'params',{}))}
        # 测试过程：按此条件执行或清理；理想结果由下方断言核对。
        with (OUT/'cases.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
