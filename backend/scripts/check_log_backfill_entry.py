#!/usr/bin/env python3
"""Task 8.4: the log page can backfill yesterday/the day before after today's log already exists."""
import json
import os
import subprocess
from fixed_model_fixture import Fixture
from migration_precheck import BASE

OUTPUT = BASE.parent / 'audit/refactor-pandora-organization-and-workflows/log-backfill-entry.json'


def main():
    fixture = Fixture(port=18187)
    fixture.log_path = OUTPUT.with_name('log-backfill-service.log')
    with fixture as f:
        env = {**os.environ, 'PANDORA_BROWSER_FIXTURE': json.dumps({'base': f'http://127.0.0.1:{f.port}', 'identities': f.identities})}
        subprocess.run(['node', str(BASE / 'scripts/check_log_backfill_entry_browser.js')], env=env, check=True)


if __name__ == '__main__':
    main()
