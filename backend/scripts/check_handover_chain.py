#!/usr/bin/env python3
"""Task 7.4: handover -> business approval -> administrator final deactivation -> takeover continuation."""
import datetime as dt
import json
import os
import subprocess
import uuid
from fixed_model_fixture import Fixture, quote
from migration_precheck import BASE

OUTPUT = BASE.parent / 'audit/refactor-pandora-organization-and-workflows/handover-chain.json'


def main():
    fixture = Fixture(port=18185)
    fixture.log_path = OUTPUT.with_name('handover-chain-service.log')
    with fixture as f:
        tokens = {key: f.login(key)[1]['token'] for key in f.identities}
        ids = {key: value['id'] for key, value in f.identities.items()}

        def call(method, path, body=None, who='founder', version=None, key=None):
            return f.call(method, path, body, tokens[who], key or 'chain-' + uuid.uuid4().hex, version)

        def detail(task, who):
            return call('GET', '/tasks/' + task, who=who)[1]

        def form(title, owners, offset=1):
            now = dt.datetime.now(dt.timezone.utc)
            return {'title': title, 'description': 'Real browser handover chain', 'priority': 'medium', 'allDay': False,
                    'startAt': (now + dt.timedelta(hours=offset)).isoformat(),
                    'dueAt': (now + dt.timedelta(days=3)).isoformat(),
                    'assigneeIds': [ids[key] for key in owners]}

        def create(who, owners, title, approve=True):
            status, result = call('POST', '/tasks', form(title, owners), who)
            if status != 201:
                raise AssertionError((status, result))
            if approve and result['outcome'] == 'pending':
                view = call('GET', '/approval-requests/' + result['requestId'], who='alpha-two-head')[1]
                status, decision = call('PATCH', '/approval-requests/' + result['requestId'],
                                        {'decision': 'approve', 'comment': 'Chain approval'}, 'alpha-two-head', view['rowVersion'])
                if status != 200:
                    raise AssertionError(('approve', status, decision))
            return result

        completed = create('alpha-two-employee', ['alpha-two-employee'], 'Chain completed departure work')
        view = detail(completed['taskId'], 'alpha-two-employee')
        status, done = call('PATCH', '/tasks/' + completed['taskId'],
                            {'command': 'complete', 'completionNote': 'Completed before departure'},
                            'alpha-two-employee', view['rowVersion'])
        if status != 200:
            raise AssertionError(('complete', status, done))

        active = create('alpha-two-employee', ['alpha-two-employee'], 'Chain active written-off work')
        detail_active = detail(active['taskId'], 'alpha-two-employee')
        status, progress = call('PATCH', '/tasks/' + active['taskId'],
                                {'command': 'progress', 'progressNote': 'Work in flight'},
                                'alpha-two-employee', detail_active['rowVersion'])
        if status != 200:
            raise AssertionError(('progress', status, progress))

        unpublished = create('alpha-two-employee', ['beta-one-employee'], 'Chain unpublished creation', approve=False)

        status, handover = call('POST', '/tasks/' + active['taskId'] + '/handover',
                                {'sourceUserId': ids['alpha-two-employee'], 'targetUserId': ids['alpha-one-employee'],
                                 'reason': 'Direct manager prepares departure handover'},
                                'alpha-two-head', detail(active['taskId'], 'alpha-two-head')['rowVersion'])
        if status != 200:
            raise AssertionError(('handover', status, handover))
        handover_view = call('GET', '/approval-requests/' + handover['requestId'], who='alpha-two-employee')[1]
        status, approved = call('PATCH', '/approval-requests/' + handover['requestId'],
                                {'decision': 'approve', 'comment': 'Business owner approves handover'},
                                'alpha-two-employee', handover_view['rowVersion'])
        if status != 200:
            raise AssertionError(('handover approve', status, approved))

        inventory = call('GET', '/admin/employees/' + ids['alpha-two-employee'] + '/responsibilities', who='admin')[1]
        unpublished_view = call('GET', '/approval-requests/' + unpublished['requestId'], who='alpha-two-employee')[1]
        manifest = {'base': f'http://127.0.0.1:{f.port}', 'identities': f.identities,
                    'completed': completed['taskId'], 'active': active['taskId'],
                    'unpublishedRequest': unpublished['requestId'],
                    'unpublishedRowVersion': unpublished_view['rowVersion'],
                    'inventory': inventory, 'handoverRequest': handover['requestId']}
        env = {**os.environ, 'PANDORA_BROWSER_FIXTURE': json.dumps(manifest)}
        subprocess.run(['node', str(BASE / 'scripts/check_fixed_handover_chain_browser.js')], env=env, check=True)


if __name__ == '__main__':
    main()
