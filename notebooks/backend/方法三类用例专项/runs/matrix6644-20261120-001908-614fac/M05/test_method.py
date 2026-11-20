import os,uuid,datetime as dt
from urllib.parse import urlencode
import pytest
DAY='2026-11-20'
def create_owned(cloud,text='matrix-test'):
    status,data=cloud.request('POST','/daily-items',{'date':DAY,'body':text},actor='A4',key=uuid.uuid4().hex)
    assert status==200
    return data

CASES=[{'id': 'N_text20',
  'kind': '正常',
  'value': 20,
  'expected': 200,
  'equivalenceClass': '非空且在长度内的正文',
  'boundaryBasis': '内部代表值20码点'},
 {'id': 'B_text1',
  'kind': '边界',
  'value': 1,
  'expected': 200,
  'equivalenceClass': '最短合法正文',
  'boundaryBasis': '精确下界1码点'},
 {'id': 'B_text2000',
  'kind': '边界',
  'value': 2000,
  'expected': 200,
  'equivalenceClass': '最长合法正文',
  'boundaryBasis': '精确上界2000码点'},
 {'id': 'E_text0',
  'kind': '异常',
  'value': 0,
  'expected': 400,
  'equivalenceClass': '空正文',
  'boundaryBasis': '下界外相邻值0'},
 {'id': 'E_text2001',
  'kind': '异常',
  'value': 2001,
  'expected': 400,
  'equivalenceClass': '超长正文',
  'boundaryBasis': '上界外相邻值2001'},
 {'id': 'E_text_type',
  'kind': '异常',
  'value': 'number',
  'expected': 400,
  'equivalenceClass': '正文为数字',
  'boundaryBasis': '无效JSON类型等价类'},
 {'id': 'E_version_missing',
  'kind': '异常',
  'value': 20,
  'expected': 428,
  'equivalenceClass': '版本前置条件缺失',
  'boundaryBasis': 'If-Match未提供',
  'version': None},
 {'id': 'E_version_stale',
  'kind': '异常',
  'value': 20,
  'expected': 412,
  'equivalenceClass': '版本前置条件陈旧',
  'boundaryBasis': '初始版本为1，输入0',
  'version': 0}]

@pytest.mark.parametrize('case',CASES,ids=lambda case:case['id'])
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

