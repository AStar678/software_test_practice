import os,uuid,datetime as dt
from urllib.parse import urlencode
import pytest
DAY='2026-11-20'
def create_owned(cloud,text='matrix-test'):
    status,data=cloud.request('POST','/daily-items',{'date':DAY,'body':text},actor='A4',key=uuid.uuid4().hex)
    assert status==200
    return data

CASES=[{'id': 'N_version2',
  'kind': '正常',
  'value': 2,
  'expected': 200,
  'equivalenceClass': '存在且版本匹配的本人对象',
  'boundaryBasis': '先将本次新建对象更新至版本2'},
 {'id': 'B_version1',
  'kind': '边界',
  'value': 1,
  'expected': 200,
  'equivalenceClass': '最小有效对象版本',
  'boundaryBasis': '对象刚创建时初始版本1'},
 {'id': 'E_version0',
  'kind': '异常',
  'value': 0,
  'expected': 412,
  'equivalenceClass': '陈旧版本',
  'boundaryBasis': '小于初始版本的相邻值0'},
 {'id': 'E_version_missing',
  'kind': '异常',
  'value': None,
  'expected': 428,
  'equivalenceClass': '缺少版本前置条件',
  'boundaryBasis': 'If-Match缺失'}]

@pytest.mark.parametrize('case',CASES,ids=lambda case:case['id'])
def test_delete_three_classes(cloud,case):
    row=create_owned(cloud,'delete-'+uuid.uuid4().hex)
    if case['value']==2:
        assert cloud.request('PATCH','/daily-items/'+row['id'],{'body':'updated'},actor='A4',key=uuid.uuid4().hex,version=1)[0]==200
    status,data=cloud.request('DELETE','/daily-items/'+row['id'],actor='A4',key=uuid.uuid4().hex,version=case['value'])
    assert status==case['expected']
    check_status,current=cloud.request('GET','/daily-items/'+row['id'],actor='A4')
    assert check_status==(404 if status==200 else 200)

