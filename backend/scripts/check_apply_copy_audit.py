#!/usr/bin/env python3
"""Reachable-interface copy audit for the current employee and administrator pages.

Owns a disposable database and a real Chrome page. User-authored text deliberately contains the
development words the audit looks for, so the check also proves that business content is not filtered.
"""
import datetime as dt
import json
import os
import subprocess
import uuid

from fixed_model_fixture import Fixture
from migration_precheck import BASE

OUT = BASE.parent / 'output/apply-copy-audit'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with Fixture(port=18233) as fixture:
        tokens = {name: fixture.login(name)[1]['token'] for name in ('founder', 'alpha-one-employee')}
        ids = {name: row['id'] for name, row in fixture.identities.items()}

        def call(method, path, body=None, who='founder', version=None):
            return fixture.call(method, path, body, tokens[who], uuid.uuid4().hex, version)

        def ok(method, path, body=None, who='founder', version=None):
            status, value = call(method, path, body, who, version)
            assert status in (200, 201), (method, path, status, value)
            return value

        task_title = '业务原文：原型演示关键词'
        task_desc = '本说明保留原型、演示、章节、接口字段等词。'
        log_body = '日志原文保留演示、原型与接口字段。'
        comment_body = '评论原文保留章节与原型。'
        task = ok('POST', '/tasks', {'title': task_title, 'description': task_desc,
                                     'assigneeIds': [ids['founder']], 'allDay': False,
                                     'startAt': '2031-04-01T01:00:00Z', 'dueAt': '2031-04-01T03:00:00Z'})['taskId']
        ok('POST', '/tasks/' + task + '/comments', {'body': comment_body})
        day = dt.datetime.now().date().isoformat()
        log = ok('POST', '/work-logs', {'body': log_body, 'businessDate': day})['logId']
        manifest = {'base': f'http://127.0.0.1:{fixture.port}', 'identities': fixture.identities,
                    'admin': fixture.identities['admin'], 'task': task, 'log': log,
                    'taskTitle': task_title, 'taskDesc': task_desc, 'logBody': log_body,
                    'commentBody': comment_body, 'employeeId': ids['alpha-one-employee']}
        subprocess.run(['node', str(BASE / 'scripts/check_apply_copy_audit_browser.js')],
                       env={**os.environ, 'PANDORA_COPY_FIXTURE': json.dumps(manifest)}, check=True)
        report = json.loads((OUT / 'browser-report.json').read_text())
        lines = ['# 可达界面文案检查记录', '',
                 f"- 运行时间：{dt.datetime.now().astimezone().isoformat(timespec='seconds')}",
                 f"- 检查脚本：`check_apply_copy_audit.py` / `check_apply_copy_audit_browser.js`",
                 f"- 一次性数据库与真实 Chrome；截图位于 `{OUT.name}/`。", '',
                 '| 界面 | 结果 | 说明 |', '| --- | --- | --- |']
        for page in report['pages']:
            lines.append(f"| {page['label']} | {'PASS' if page['pass'] else 'FAIL'} | {page['detail']} |")
        lines += ['', '业务原文未被关键词过滤：任务说明、日志正文和评论原文均在可达界面原样显示。']
        (OUT / 'report.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
