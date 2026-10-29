#!/usr/bin/env python3
"""Owned real-service browser check for task 4.5: account switches discard late responses."""
import json
import os
import subprocess
from pathlib import Path
from fixed_model_fixture import Fixture
from migration_precheck import BASE

OUTPUT = BASE.parent / 'audit/refactor-pandora-organization-and-workflows/late-response.json'


def main():
    fixture = Fixture(port=18184, worker=False, controllable=False)
    fixture.log_path = OUTPUT.with_name('late-response-service.log')
    with fixture as f:
        manifest = {'base': f'http://127.0.0.1:{f.port}', 'identities': f.identities}
        env = {**os.environ, 'PANDORA_BROWSER_FIXTURE': json.dumps(manifest)}
        subprocess.run(['node', str(BASE / 'scripts/check_fixed_late_response_browser.js')], env=env, check=True)


if __name__ == '__main__':
    main()
