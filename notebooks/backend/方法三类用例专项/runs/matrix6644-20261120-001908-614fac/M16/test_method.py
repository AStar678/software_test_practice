import os,uuid,datetime as dt
from urllib.parse import urlencode
import pytest
DAY='2026-11-20'
def create_owned(cloud,text='matrix-test'):
    status,data=cloud.request('POST','/daily-items',{'date':DAY,'body':text},actor='A4',key=uuid.uuid4().hex)
    assert status==200
    return data

CASES=[{'id': 'N_query',
  'kind': '正常',
  'value': 10,
  'expected': 200,
  'equivalenceClass': '合法检索字符串',
  'boundaryBasis': '长度10的普通检索'},
 {'id': 'B_query0',
  'kind': '边界',
  'value': 0,
  'expected': 200,
  'equivalenceClass': '空检索返回允许候选范围',
  'boundaryBasis': '精确下界0字符'},
 {'id': 'B_query100',
  'kind': '边界',
  'value': 100,
  'expected': 200,
  'equivalenceClass': '最长合法检索',
  'boundaryBasis': '精确上界100字符'},
 {'id': 'E_query101',
  'kind': '异常',
  'value': 101,
  'expected': 400,
  'equivalenceClass': '检索过长',
  'boundaryBasis': '上界外相邻值101'},
 {'id': 'E_purpose',
  'kind': '异常',
  'value': 10,
  'expected': 400,
  'equivalenceClass': '无效操作场景枚举',
  'boundaryBasis': 'purpose不属于create/edit',
  'purpose': 'invalid'}]

@pytest.mark.parametrize('case',CASES,ids=lambda case:case['id'])
def test_candidates_three_classes(cloud,case):
    query={'q':'汉'*case['value'],'purpose':case.get('purpose','create')}
    status,data=cloud.request('GET','/assignee-candidates?'+urlencode(query),actor='A4')
    assert status==case['expected']
    if status==200:assert isinstance(data['items'],list)

