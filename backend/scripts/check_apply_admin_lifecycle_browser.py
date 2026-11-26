#!/usr/bin/env python3
"""Real Chrome acceptance for the refined administrator employee lifecycle and directory page."""
import datetime as dt
import json
import os
import subprocess
import uuid
from pathlib import Path

from fixed_model_fixture import Fixture, PASSWORD
from migration_precheck import BASE

AUDIT = BASE.parent / 'audit/refactor-pandora-organization-and-workflows'
OUTPUT = AUDIT / 'admin-employee-lifecycle-browser.json'
NODE_LOG = AUDIT / 'admin-employee-lifecycle-browser-node.log'
SERVICE_LOG = AUDIT / 'admin-employee-lifecycle-browser-service.log'
ID_CARD = '11010519491231002X'


def main() -> int:
    report = {'updated': dt.datetime.now(dt.timezone.utc).isoformat(), 'checks': []}
    fixture = Fixture(port=18191)
    fixture.log_path = SERVICE_LOG
    try:
        with fixture as f:
            tokens = {key: f.login(key)[1]['token'] for key in f.identities}
            ids = {key: value['id'] for key, value in f.identities.items()}

            def call(method, path, body=None, who='admin', version=None, key=None):
                return f.call(method, path, body, tokens[who], key or 'browser-' + uuid.uuid4().hex, version)

            detail = call('GET', '/admin/employees/' + ids['alpha-one-employee'])[1]
            status, saved = call('PATCH', '/admin/employees/' + ids['alpha-one-employee'], {'idCardNo': ID_CARD},
                                 version=detail['rowVersion'])
            if status != 200:
                raise RuntimeError('identity seed failed: ' + json.dumps(saved, ensure_ascii=False))
            now = dt.datetime.now(dt.timezone.utc)
            status, task = call('POST', '/tasks', {
                'title': '浏览器删除历史任务', 'description': '真实删除历史', 'priority': 'medium', 'allDay': False,
                'startAt': (now - dt.timedelta(hours=1)).isoformat(),
                'dueAt': (now + dt.timedelta(days=2)).isoformat(), 'assigneeIds': [ids['founder']]}, who='founder')
            if status != 201:
                raise RuntimeError('task seed failed: ' + json.dumps(task, ensure_ascii=False))
            version = call('GET', '/tasks/' + task['taskId'], who='founder')[1]['rowVersion']
            status, deleted = call('DELETE', '/tasks/' + task['taskId'], {'reason': '重复创建'},
                                   who='founder', version=version)
            if status != 200:
                raise RuntimeError('task delete seed failed: ' + json.dumps(deleted, ensure_ascii=False))
            payload = {'base': 'http://127.0.0.1:' + str(f.port), 'identifier': f.identities['admin']['identifier'],
                       'password': PASSWORD, 'ids': ids, 'idCard': ID_CARD,
                       'deletedTitle': '浏览器删除历史任务'}
            result = subprocess.run(['node', str(BASE / 'scripts/check_apply_admin_lifecycle_browser.js')],
                                    env={**os.environ, 'PANDORA_ADMIN_LIFECYCLE_FIXTURE': json.dumps(payload)},
                                    capture_output=True, text=True)
            NODE_LOG.write_text(result.stdout + result.stderr)
            for line in result.stdout.splitlines():
                if line.startswith('PASS  ') or line.startswith('FAIL  '):
                    report['checks'].append({'check': line[6:], 'pass': line.startswith('PASS  '),
                                             'evidence': 'real Chrome'})
            if result.returncode != 0:
                print(result.stdout, result.stderr, flush=True)
                raise AssertionError('admin lifecycle browser check failed')
    finally:
        report['updated'] = dt.datetime.now(dt.timezone.utc).isoformat()
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str))
        failed = [row for row in report['checks'] if not row['pass']]
        print(json.dumps({'total': len(report['checks']), 'failed': len(failed), 'report': str(OUTPUT)},
                         ensure_ascii=False), flush=True)
    return 0 if not failed else 1


if __name__ == '__main__':
    raise SystemExit(main())
