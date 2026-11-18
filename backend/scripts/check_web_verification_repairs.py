#!/usr/bin/env python3
"""Real-service regressions for Web verification findings V-002 through V-004."""
import json
import os
import subprocess
import uuid
from fixed_model_fixture import Fixture, quote
from migration_precheck import BASE


def main():
    out = BASE.parent / 'output/web-verification-repairs'
    out.mkdir(parents=True, exist_ok=True)
    fixture = Fixture(port=18287, controllable=True)
    fixture.log_path = out / 'service.log'
    with fixture as f:
        token = f.login('founder')[1]['token']
        admin = f.login('admin')[1]['token']
        day = f.call('GET', '/home', token=token)[1]['businessDate']
        status, log = f.call('POST', '/work-logs', {'businessDate': day, 'body': 'Original log'}, token, uuid.uuid4().hex)
        assert status == 200, (status, log)
        status, item = f.call('POST', '/daily-items', {'date': day, 'body': 'Source item'}, token, uuid.uuid4().hex)
        assert status == 200, (status, item)
        for i in range(125):
            event, notice = str(uuid.uuid4()), str(uuid.uuid4())
            f.db.server_side('INSERT INTO domain_events(id,organization_id,event_type,recipients_json,details_json,status) VALUES(' +
                             ','.join(map(quote, [event, 'fixture-company', 'account.created', '[]', '{}', 'delivered'])) + ')')
            f.db.server_side('INSERT INTO notifications(id,organization_id,event_id,recipient_id,event_type,summary) VALUES(' +
                             ','.join(map(quote, [notice, 'fixture-company', event, f.identities['founder']['id'], 'account.created', 'Inbox record ' + str(i)])) + ')')
        data = {'base': 'http://127.0.0.1:18287', 'identities': f.identities, 'log': log['logId'], 'adminToken': admin}
        subprocess.run(['node', str(BASE / 'scripts/check_web_verification_repairs_browser.js')],
                       env={**os.environ, 'PANDORA_REPAIR_FIXTURE': json.dumps(data)}, check=True)


if __name__ == '__main__':
    main()
