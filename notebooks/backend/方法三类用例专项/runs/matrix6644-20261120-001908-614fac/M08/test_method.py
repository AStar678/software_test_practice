import os,uuid,datetime as dt
from urllib.parse import urlencode
import pytest
DAY='2026-11-20'
def create_owned(cloud,text='matrix-test'):
    status,data=cloud.request('POST','/daily-items',{'date':DAY,'body':text},actor='A4',key=uuid.uuid4().hex)
    assert status==200
    return data

CASES=[{'id': 'N_limit20',
  'kind': '正常',
  'value': 20,
  'expected': 200,
  'equivalenceClass': '允许范围内的分页长度',
  'boundaryBasis': '内部代表值20'},
 {'id': 'B_limit1',
  'kind': '边界',
  'value': 1,
  'expected': 200,
  'equivalenceClass': '合法最小分页长度',
  'boundaryBasis': '精确下界1'},
 {'id': 'B_limit100',
  'kind': '边界',
  'value': 100,
  'expected': 200,
  'equivalenceClass': '合法最大分页长度',
  'boundaryBasis': '精确上界100'},
 {'id': 'E_limit0',
  'kind': '异常',
  'value': 0,
  'expected': 400,
  'equivalenceClass': '小于允许范围',
  'boundaryBasis': '下界外相邻值0'},
 {'id': 'E_limit101',
  'kind': '异常',
  'value': 101,
  'expected': 400,
  'equivalenceClass': '大于允许范围',
  'boundaryBasis': '上界外相邻值101'},
 {'id': 'E_limit_text',
  'kind': '异常',
  'value': 'x',
  'expected': 400,
  'equivalenceClass': '分页值非整数',
  'boundaryBasis': '无效类型/格式等价类'},
 {'id': 'B_offset_max',
  'kind': '边界',
  'value': 20,
  'expected': 200,
  'equivalenceClass': '最大合法分页偏移',
  'boundaryBasis': 'offset的Integer.MAX_VALUE=2147483647',
  'offset': 2147483647},
 {'id': 'E_offset_overflow',
  'kind': '异常',
  'value': 20,
  'expected': 400,
  'equivalenceClass': '偏移数值溢出',
  'boundaryBasis': 'offset首次越界2147483648',
  'offset': 2147483648}]

@pytest.mark.parametrize('case',CASES,ids=lambda case:case['id'])
def test_paging_three_classes(cloud,case):
    # 等价类：有效整数、越界整数、无效字符串；同时检查精确上下界。
    query={'scope': 'self'}.copy()
    query.update(limit=case['value'],offset=case.get('offset',0))
    actor=case.get('actor','A4')
    status,data=cloud.request('GET','/work-logs'+'?'+urlencode(query),actor=actor)
    # 理想结果：正常与合法边界200；越界或非整数400。
    assert status==case['expected']
    if status==200:
        assert isinstance(data['items'],list)
        assert len(data['items'])<=case['value']
        if case.get('offset')==2147483647:assert data['items']==[]

