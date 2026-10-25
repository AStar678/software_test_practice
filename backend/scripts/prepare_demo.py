#!/usr/bin/env python3
"""Idempotently prepare the persistent demonstration data for the employee web and admin console.

Chapter 11.1: the demo account keeps its real phone login and organization relationships, and the
database carries ten company items, cross-month dense/all-day tasks, pending reviews, enough tasks to
page the task form, subordinate tasks and logs, a shared tag, flat comments and delivered
notifications. Running the script again must not duplicate any of it.

    CHECK_WORKER=true ./scripts/run_check_isolated.sh python3 scripts/prepare_demo.py --base-url {base}
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request
import uuid

DEMO_PHONE = {'upper': '13800000001', 'middle': '13800000002', 'market': '13800000003',
              'employee': '13800000004', 'colleague': '13800000005', 'marketing': '13800000006',
              'admin': 'admin'}
MARKER = '[演示]'
TZ = dt.timezone(dt.timedelta(hours=8))


def identity(account: str) -> str:
    return DEMO_PHONE.get(account, account)


class Api:
    def __init__(self, base: str, password: str):
        self.base = base.rstrip('/')
        self.password = password
        self.tokens: dict[str, str] = {}

    def call(self, method: str, path: str, token: str | None = None, body=None, key: str | None = None,
             if_match: str | None = None):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(self.base + path, data=data, method=method)
        request.add_header('Content-Type', 'application/json')
        if token:
            request.add_header('Authorization', 'Bearer ' + token)
        if key:
            request.add_header('Idempotency-Key', key)
        if if_match:
            request.add_header('If-Match', if_match)
        try:
            with urllib.request.urlopen(request) as response:
                payload = response.read().decode()
                return response.status, (json.loads(payload) if payload else {}), dict(response.headers)
        except urllib.error.HTTPError as error:
            payload = error.read().decode()
            try:
                parsed = json.loads(payload) if payload else {}
            except json.JSONDecodeError:
                parsed = {'raw': payload}
            return error.code, parsed, dict(error.headers)

    def login(self, name: str, password: str | None = None):
        status, body, _ = self.call('POST', '/api/v1/auth/sessions',
                                    body={'username': identity(name), 'password': password or self.password})
        if status != 200:
            raise SystemExit(f'login failed for {name}: {status} {body}')
        self.tokens[name] = body['token']
        return body

    def token(self, name: str) -> str:
        return self.tokens.get(name) or self.login(name)['token']

    @staticmethod
    def key() -> str:
        return 'demo-' + uuid.uuid4().hex


def iso(day: dt.date, hour: int, minute: int = 0) -> str:
    return dt.datetime(day.year, day.month, day.day, hour, minute, tzinfo=TZ).isoformat()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:18130')
    parser.add_argument('--password', default='Demo@123456')
    parser.add_argument('--output', type=Path, default=None)
    args = parser.parse_args()
    api = Api(args.base_url, args.password)
    for who in ('admin', 'upper', 'middle', 'employee', 'colleague'):
        api.login(who)
    admin = api.token('admin')

    employees = api.call('GET', '/api/v1/admin/employees', admin)[1].get('items', [])
    ids = {row['username']: row['id'] for row in employees}
    today = dt.datetime.now(TZ).date()
    created = {'companyItems': 0, 'tasks': 0, 'comments': 0, 'tags': 0}
    reused = {'companyItems': 0, 'tasks': 0, 'comments': 0, 'tags': 0}

    # ---------------- ten company items ----------------
    status, company, _ = api.call('GET', '/api/v1/admin/company', admin)
    if status != 200:
        raise SystemExit(f'cannot read company items: {status} {company}')
    items = company.get('items', [])
    titles = {item['title'] for item in items}
    for number in range(1, 11):
        if len(items) >= 10:
            break
        title = f'{MARKER} 公司事项 {number:02d}'
        if title in titles:
            reused['companyItems'] += 1
            continue
        status, body, _ = api.call('POST', '/api/v1/admin/company/items', admin,
                                   {'title': title, 'body': f'演示用公司事项 {number:02d}：展示列表与卡片样式。'},
                                   Api.key())
        if status != 200:
            raise SystemExit(f'company item failed: {status} {body}')
        created['companyItems'] += 1
        titles.add(title)
        items.append({'title': title})

    # ---------------- shared tag ----------------
    status, tags, _ = api.call('GET', '/api/v1/tags', api.token('upper'))
    tag_names = {row['name'] for row in tags.get('items', [])}
    tag_id = next((row['id'] for row in tags.get('items', []) if not row.get('deleted')), None)
    if not tag_names:
        status, body, _ = api.call('POST', '/api/v1/tags', api.token('upper'),
                                   {'name': f'{MARKER} 重点', 'color': '#F6D5D2'}, Api.key())
        if status == 200:
            created['tags'] += 1
            tag_id = body.get('tagId')
        else:
            raise SystemExit(f'tag failed: {status} {body}')
    else:
        reused['tags'] += 1

    # ---------------- demo tasks ----------------
    status, listed, _ = api.call('GET', '/api/v1/admin/tasks?limit=100&q=' + urllib.parse.quote(MARKER), admin)
    if status != 200:
        raise SystemExit(f'cannot read existing demo tasks: {status} {listed}')
    existing = {row['title']: row['taskId'] for row in listed.get('items', [])}

    def create_task(title: str, owners: list[str], start: dt.date, due: dt.date, *,
                    all_day: bool = False, hour: int = 9, tag: str | None = None) -> str | None:
        if title in existing:
            reused['tasks'] += 1
            return existing[title]
        payload = {'title': title, 'description': f'持久演示数据：{title}', 'priority': 'medium',
                   'allDay': all_day, 'assigneeIds': owners}
        if tag:
            payload['tagId'] = tag
        if all_day:
            payload['startDate'] = start.isoformat()
            payload['dueDate'] = due.isoformat()
        else:
            payload['startAt'] = iso(start, hour)
            payload['dueAt'] = iso(due, 18)
        status, body, _ = api.call('POST', '/api/v1/tasks', api.token('upper'), payload, Api.key())
        if status not in (200, 201):
            raise SystemExit(f'task {title} failed: {status} {body}')
        task_id = body.get('taskId')
        if body.get('requestId'):
            status, request, _ = api.call('GET', '/api/v1/approval-requests/' + body['requestId'],
                                          api.token('upper'))
            if status == 200 and request.get('status') == 'pending':
                reviewer = request.get('currentReviewerId') or request.get('reviewerId')
                reviewer_name = next((name for name, person in ids.items() if person == reviewer), 'upper')
                status, decided, headers = api.call('GET', '/api/v1/approval-requests/' + body['requestId'],
                                                    api.token(reviewer_name))
                api.call('PATCH', '/api/v1/approval-requests/' + body['requestId'], api.token(reviewer_name),
                         {'decision': 'approve', 'comment': '演示数据初始化'}, Api.key(),
                         headers.get('ETag') or '"' + str(decided.get('rowVersion')) + '"')
        created['tasks'] += 1
        existing[title] = task_id
        return task_id

    # Cross-month dense and all-day rows: late October, early November and the turn of the year.
    dense_days = [today + dt.timedelta(days=5), today + dt.timedelta(days=7)]
    for day_index, day in enumerate(dense_days):
        for slot in range(6):
            create_task(f'{MARKER} 密集排期 {day.strftime("%m%d")}-{slot + 1}',
                        [ids['employee'], ids['colleague']] if slot % 2 else [ids['employee']],
                        day, day, hour=9 + slot)
        create_task(f'{MARKER} 跨月全天 {day.strftime("%m%d")}', [ids['employee'], ids['colleague']],
                    day, day + dt.timedelta(days=1), all_day=True)
    cross_year = dt.date(today.year + 1, 1, 1)
    create_task(f'{MARKER} 跨年全天', [ids['employee']], cross_year, cross_year, all_day=True)

    # Enough rows to page the task form (50 per page) and to filter/sort across months.
    for number in range(1, 56):
        day = today + dt.timedelta(days=8 + number)
        create_task(f'{MARKER} 分页事项 {number:02d}', [ids['employee']], day, day + dt.timedelta(days=2),
                    hour=10 + (number % 6))

    # Pending creation requests owned by the demo employee and reviewed by the manager.
    for number in range(1, 4):
        title = f'{MARKER} 待审核任务 {number:02d}'
        if title in existing:
            reused['tasks'] += 1
            continue
        status, body, _ = api.call('POST', '/api/v1/tasks', api.token('employee'), {
            'title': title, 'description': f'持久演示数据：{title}', 'priority': 'high', 'allDay': False,
            'assigneeIds': [ids['employee']],
            'startAt': iso(today + dt.timedelta(days=2), 9), 'dueAt': iso(today + dt.timedelta(days=4), 18),
        }, Api.key())
        if status not in (200, 201):
            raise SystemExit(f'pending task {title} failed: {status} {body}')
        created['tasks'] += 1
        existing[title] = body.get('taskId')

    # Subordinate tasks so the manager's task form and log page have real reports' rows.
    for number in range(1, 4):
        day = today + dt.timedelta(days=12 + number)
        create_task(f'{MARKER} 下属任务 {number:02d}', [ids['colleague']], day, day + dt.timedelta(days=1),
                    hour=14)

    # ---------------- subordinate logs ----------------
    employee_logs = api.call('GET', '/api/v1/work-logs?scope=self&limit=100', api.token('employee'))[1]
    log_dates = {row.get('businessDate') for row in employee_logs.get('items', [])}
    for offset in (0, 1, 2):
        day = today - dt.timedelta(days=offset)
        if day.isoformat() in log_dates:
            continue
        api.call('POST', '/api/v1/work-logs', api.token('employee'),
                 {'businessDate': day.isoformat(), 'body': f'{MARKER} 第 {offset + 1} 天工作日志：记录进展与协作事项。',
                  **({'tagId': tag_id} if tag_id and offset == 0 else {})}, Api.key())

    # ---------------- comments and notifications ----------------
    focus = existing.get(f'{MARKER} 分页事项 01') or next(iter(existing.values()), None)
    if focus:
        comments = api.call('GET', f'/api/v1/tasks/{focus}/comments?limit=100', api.token('middle'))[1]
        bodies = {row.get('body') for row in comments.get('items', [])}
        if f'{MARKER} 演示评论文本：进度正常，请关注截止时间。' not in bodies:
            status, body, _ = api.call('POST', f'/api/v1/tasks/{focus}/comments', api.token('middle'),
                                       {'body': f'{MARKER} 演示评论文本：进度正常，请关注截止时间。'}, Api.key())
            if status in (200, 201):
                created['comments'] += 1
        else:
            reused['comments'] += 1

    if api.call('POST', '/api/v1/admin/worker/run-once', admin, {}, Api.key())[0] == 200:
        delivered = True
    else:
        delivered = False

    # ---------------- summary ----------------
    company_after = api.call('GET', '/api/v1/admin/company', admin)[1]
    tasks_after = api.call('GET', '/api/v1/admin/tasks?limit=100&q=' + urllib.parse.quote(MARKER), admin)[1]
    pending = api.call('GET', '/api/v1/admin/tasks?limit=100&requestStatus=pending&q='
                       + urllib.parse.quote(MARKER), admin)[1]
    notifications = api.call('GET', '/api/v1/notifications?limit=100', api.token('employee'))[1]
    logs_after = api.call('GET', '/api/v1/work-logs?scope=self&limit=100', api.token('employee'))[1]
    comments_after = api.call('GET', f'/api/v1/tasks/{focus}/comments?limit=100', api.token('middle'))[1] if focus else {'items': []}
    summary = {
        'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
        'baseUrl': args.base_url,
        'created': created,
        'reused': reused,
        'counts': {
            'companyItems': len(company_after.get('items', [])),
            'demoTasks': tasks_after.get('total', 0),
            'pendingDemoTasks': len([row for row in pending.get('items', []) if row.get('latestRequestStatus') == 'pending']),
            'employeeLogs': len(logs_after.get('items', [])),
            'tags': len(api.call('GET', '/api/v1/tags', api.token('upper'))[1].get('items', [])),
            'commentsOnFocus': len(comments_after.get('items', [])),
            'notifications': notifications.get('total', 0),
        },
        'flags': {'workerRan': delivered, 'focusTask': focus,
                  'denseDates': [day.isoformat() for day in dense_days],
                  'crossYear': cross_year.isoformat()},
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
        print(f'wrote {args.output}')
    # Counts that would fail before the data exists; the second consecutive run must not increase them.
    assert summary['counts']['companyItems'] == 10, summary['counts']
    assert summary['counts']['demoTasks'] >= 60, summary['counts']
    assert summary['counts']['employeeLogs'] >= 3, summary['counts']
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
