#!/usr/bin/env python3
"""Run Flutter adapters against an owned local MySQL/JAR fixture; no downloads or demo reset."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend/scripts'))
from fixed_model_fixture import Fixture, PASSWORD


def main():
    output = ROOT / 'output/flutter-client-2026-11-17/managed'
    output.mkdir(parents=True, exist_ok=True)
    fixture = Fixture(port=18295, worker=True, controllable=True)
    fixture.log_path = output / 'service.log'
    with fixture as backend, tempfile.TemporaryDirectory(prefix='pandora-client-') as temporary:
        config = Path(temporary) / 'fixture.json'
        config.write_text(json.dumps({'base': backend.base, 'identities': backend.identities}))
        env = dict(os.environ, PANDORA_CLIENT_FIXTURE=str(config), PANDORA_FIXTURE_PASSWORD=PASSWORD)
        with (output / 'flutter-tests.log').open('w') as log:
            result = subprocess.run([
                env.get('FLUTTER_BIN', '/opt/homebrew/share/flutter/bin/flutter'),
                'test', '--no-pub', '--reporter', 'expanded', 'tool/tests/managed_backend_test.dart',
            ], cwd=ROOT / 'flutter', env=env, stdout=log, stderr=subprocess.STDOUT)
        print((output / 'flutter-tests.log').read_text())
        return result.returncode


if __name__ == '__main__':
    raise SystemExit(main())
