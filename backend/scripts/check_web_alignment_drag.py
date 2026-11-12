#!/usr/bin/env python3
"""Owned disposable-service checks for mobile long-press, 2D month hit, edge scrolling and day boundaries."""
import json, os, subprocess, uuid
from fixed_model_fixture import Fixture
from migration_precheck import BASE

OUT = BASE.parent / 'output/web-alignment-drag'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    fixture = Fixture(port=18260)
    fixture.log_path = OUT / 'service.log'
    with fixture as f:
        token = f.login('founder')[1]['token']
        founder = f.identities['founder']['id']

        def ok(method, path, body=None, key=None):
            status, data = f.call(method, path, body, token, key or uuid.uuid4().hex)
            assert status in (200, 201), (method, path, status, data)
            return data

        def create(title, start, due):
            return ok('POST', '/tasks', {
                'title': title, 'description': 'Web 客户端对齐夹具', 'priority': 'medium', 'allDay': False,
                'startAt': start, 'dueAt': due, 'assigneeIds': [founder]})['taskId']

        # Company timezone is Asia/Shanghai; the fixture organization keeps the default zone.
        month_day = '2032-04-14'
        month = create('二维月历移动', month_day + 'T09:00:00+08:00', month_day + 'T11:00:00+08:00')
        edge = create('边缘补载拖动', '2032-04-02T09:00:00+08:00', '2032-04-02T11:00:00+08:00')
        late = create('临近午夜任务', '2032-04-16T22:30:00+08:00', '2032-04-16T23:30:00+08:00')
        span = create('跨周续接移动', '2032-04-05T09:00:00+08:00', '2032-04-26T11:00:00+08:00')
        midnight = create('午夜截止任务', '2032-04-16T22:00:00+08:00', '2032-04-17T00:00:00+08:00')
        manifest = {
            'base': f'http://127.0.0.1:{fixture.port}', 'identities': f.identities,
            'monthDay': month_day, 'month': month, 'edge': edge,
            'lateDay': '2032-04-16', 'late': late, 'midnight': midnight, 'span': span,
            'targetDay': '2032-04-21',
        }
        subprocess.run(['node', str(BASE / 'scripts/check_web_alignment_drag_browser.js')],
                       env={**os.environ, 'PANDORA_DRAG_FIXTURE': json.dumps(manifest)}, check=True)
        # 8.6: the day-axis draft boundary is front-end only; a normal authorized detail/API
        # cross-day reschedule must still succeed.
        cross = create('合法跨日排期', '2032-04-18T22:00:00+08:00', '2032-04-19T02:00:00+08:00')
        current = f.call('GET', '/tasks/' + cross, token=token)[1]
        status, moved = f.call('PATCH', '/tasks/' + cross, {
            'command': 'reschedule', 'allDay': False,
            'startAt': '2032-04-19T22:00:00+08:00', 'dueAt': '2032-04-20T02:00:00+08:00',
            'reason': '通用详情合法跨日调整'}, token, uuid.uuid4().hex, current['rowVersion'])
        assert status == 200, (status, moved)
        after = f.call('GET', '/tasks/' + cross, token=token)[1]
        assert after['startAt'] == '2032-04-19T14:00:00Z' and after['dueAt'] == '2032-04-19T18:00:00Z', after
        print(json.dumps({'result': 'PASS', 'output': str(OUT), 'crossDayApi': {'status': status}}, ensure_ascii=False))


if __name__ == '__main__':
    main()
