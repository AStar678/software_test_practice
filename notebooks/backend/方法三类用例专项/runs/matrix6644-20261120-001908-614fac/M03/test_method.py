import os,uuid,datetime as dt
from urllib.parse import urlencode
import pytest
DAY='2026-11-20'
def create_owned(cloud,text='matrix-test'):
    status,data=cloud.request('POST','/daily-items',{'date':DAY,'body':text},actor='A4',key=uuid.uuid4().hex)
    assert status==200
    return data

CASES=[{'id': 'N_days30',
  'kind': '正常',
  'value': 30,
  'expected': 200,
  'equivalenceClass': '有效的含首尾日期范围',
  'boundaryBasis': '内部代表值30天'},
 {'id': 'B_days1',
  'kind': '边界',
  'value': 1,
  'expected': 200,
  'equivalenceClass': '最短合法区间',
  'boundaryBasis': '精确下界1天，from=to'},
 {'id': 'B_days93',
  'kind': '边界',
  'value': 93,
  'expected': 200,
  'equivalenceClass': '最长合法区间',
  'boundaryBasis': '精确上界93天'},
 {'id': 'E_days0',
  'kind': '异常',
  'value': 0,
  'expected': 400,
  'equivalenceClass': '倒序区间',
  'boundaryBasis': '下界外相邻值0天'},
 {'id': 'E_days94',
  'kind': '异常',
  'value': 94,
  'expected': 400,
  'equivalenceClass': '超长区间',
  'boundaryBasis': '上界外相邻值94天'},
 {'id': 'E_invalid_date',
  'kind': '异常',
  'value': '1900-02-29',
  'expected': 400,
  'equivalenceClass': '非法公历日期',
  'boundaryBasis': '1900年不是闰年'}]

@pytest.mark.parametrize('case',CASES,ids=lambda case:case['id'])
def test_summary_three_classes(cloud,case):
    start=dt.date(2024,2,1)
    query={'from':str(start),'to':str(start+dt.timedelta(days=case['value']-1))} if isinstance(case['value'],int) else {'from':case['value'],'to':'1900-03-01'}
    status,data=cloud.request('GET','/daily-items/summary?'+urlencode(query),actor='A4')
    assert status==case['expected']
    if status==200:
        assert data['from']==query['from'] and data['to']==query['to']
        assert data['maxDays']==93
        assert all(query['from']<=row['date']<=query['to'] for row in data['days'])

