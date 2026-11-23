import os,uuid,datetime as dt
from urllib.parse import urlencode
import pytest
DAY='2026-11-20'
def create_owned(cloud,text='matrix-test'):
    status,data=cloud.request('POST','/daily-items',{'date':DAY,'body':text},actor='A4',key=uuid.uuid4().hex)
    assert status==200
    return data

CASES=[{'id': 'N_employee',
  'kind': '正常',
  'value': 'employee',
  'expected': 200,
  'equivalenceClass': '有效员工手机号和密码',
  'boundaryBasis': '通常长度11的有效登录标识'},
 {'id': 'N_admin',
  'kind': '正常',
  'value': 'admin',
  'expected': 200,
  'equivalenceClass': '有效独立管理员账号和密码',
  'boundaryBasis': '管理员与员工登录分支分开'},
 {'id': 'B_identifier80',
  'kind': '边界',
  'value': 80,
  'expected': 200,
  'equivalenceClass': '可规范化的合法员工标识',
  'boundaryBasis': '原始identifier长度上限80，69空格+11位手机号=80'},
 {'id': 'E_identifier81',
  'kind': '异常',
  'value': 81,
  'expected': 401,
  'equivalenceClass': '超长登录标识',
  'boundaryBasis': '上限80的首次越界81，规范化前应拒绝'},
 {'id': 'E_phone_type',
  'kind': '异常',
  'value': 'wrong_type',
  'expected': 400,
  'equivalenceClass': '手机号为数组而非字符串',
  'boundaryBasis': '无效JSON类型等价类'},
 {'id': 'E_password_wrong',
  'kind': '异常',
  'value': 'wrong_password',
  'expected': 401,
  'equivalenceClass': '身份格式有效但密码错误',
  'boundaryBasis': '无效凭据等价类'}]

@pytest.mark.parametrize('case',CASES,ids=lambda case:case['id'])
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

