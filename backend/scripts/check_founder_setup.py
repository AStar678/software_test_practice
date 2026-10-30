#!/usr/bin/env python3
"""Verify first-founder setup against a new disposable database and isolated service.

Build the current JAR first, then run:
    python3 backend/scripts/check_founder_setup.py

Never accepts an existing database or service URL. All credentials are fixture-only.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import urllib.request

from fixed_model_fixture import Fixture, quote
from migration_precheck import BASE

OUT = BASE / '.runtime/founder-setup-check'
ORG = 'founder-setup-company'
PORT = 18189


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    report = {'updated': dt.datetime.now(dt.timezone.utc).isoformat(), 'checks': []}

    def check(name, condition, evidence=None):
        report['checks'].append({'check': name, 'pass': bool(condition), 'evidence': evidence})
        print(('PASS ' if condition else 'FAIL ') + name, flush=True)
        if not condition:
            raise AssertionError(name)

    fixture = Fixture(port=PORT)
    fixture.log_path = OUT / 'service.log'
    try:
        # Refuse to contact another process, even if it happens to occupy the test port.
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', PORT))
        check('test owns a random disposable database', fixture.database.startswith('pandora_precheck_model_'))
        with fixture as f:
            f.db.server_side('INSERT INTO organizations(id,name) VALUES(' + quote(ORG) + ",'Founder Setup Fixture')")
            f.db.server_side('INSERT INTO positions(id,organization_id,name) VALUES('
                             + ','.join(map(quote, (ORG + '-title', ORG, 'Founder display title'))) + ')')
            admin_id = ORG + '-admin'
            f.db.server_side('INSERT INTO principals(id,organization_id,account_type) VALUES('
                             + ','.join(map(quote, (admin_id, ORG, 'admin'))) + ')')
            f.db.server_side('INSERT INTO admin_accounts(id,organization_id,account_name,password_hash,display_name) '
                             'SELECT ' + ','.join(map(quote, (admin_id, ORG, admin_id)))
                             + ",password_hash,'Setup Administrator' FROM admin_accounts WHERE id='fixture-company-admin'")
            existing_founder = f.identities['founder']['id']
            source = (BASE.parent / 'admin.html').read_bytes()
            with urllib.request.urlopen(f'http://127.0.0.1:{PORT}/admin.html', timeout=10) as response:
                served = response.read()
            check('isolated service serves the current admin page', served == source,
                  {'sha256': hashlib.sha256(served).hexdigest()})
            manifest = {'base': f'http://127.0.0.1:{PORT}', 'database': f.database, 'output': str(OUT),
                        'emptyAdmin': admin_id, 'emptyOrg': ORG, 'positionId': ORG + '-title',
                        'existingAdmin': f.identities['admin']['identifier'], 'existingFounder': existing_founder}
            env = dict(os.environ, PANDORA_FOUNDER_FIXTURE=json.dumps(manifest))
            with (OUT / 'browser.log').open('w') as log:
                node = subprocess.run(['node', str(BASE / 'scripts/check_founder_setup_browser.mjs')],
                                      env=env, stdout=log, stderr=subprocess.STDOUT, timeout=180)
            browser_path = OUT / 'browser-report.json'
            browser = json.loads(browser_path.read_text()) if browser_path.exists() else {}
            report['browser'] = browser
            check('real browser founder setup regression passes', node.returncode == 0 and browser.get('passed'),
                  {'exitCode': node.returncode, 'checks': len(browser.get('checks', [])), 'report': str(browser_path)})
            founder_id = browser['createdEmployeeId']
            rows = f.db.rows('SELECT o.founder_employee_id,u.id,p.placement_type,p.department_id,p.team_id '
                             'FROM organizations o JOIN users u ON u.organization_id=o.id '
                             'JOIN employee_placements p ON p.employee_id=u.id AND p.organization_id=o.id '
                             'WHERE o.id=' + quote(ORG))
            check('database contains exactly the committed founder and company-level placement',
                  rows == [[founder_id, founder_id, 'founder', 'NULL', 'NULL']], rows)
            for employee_id in browser['cancelledEmployeeIds']:
                count = f.db.scalar('SELECT COUNT(*) FROM principals WHERE id=' + quote(employee_id))
                check('cancelled draft leaves no principal: ' + employee_id, count == 0)
            check('failed second-founder command leaves no principal', f.db.scalar(
                'SELECT COUNT(*) FROM principals WHERE id=' + quote(browser['rejectedSecondEmployeeId'])) == 0)
            check('existing organization retains its original unique founder', f.db.rows(
                "SELECT o.founder_employee_id,p.employee_id FROM organizations o JOIN employee_placements p "
                "ON p.organization_id=o.id AND p.placement_type='founder' WHERE o.id='fixture-company'")
                == [[existing_founder, existing_founder]])
    except Exception as error:
        report['error'] = f'{type(error).__name__}: {error}'
        report['checks'].append({'check': 'isolated regression completes', 'pass': False})
    report['passed'] = bool(report['checks']) and all(row['pass'] for row in report['checks'])
    (OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(('PASS' if report['passed'] else 'FAIL') + ': ' + str(OUT / 'report.json'))
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    sys.exit(main())
