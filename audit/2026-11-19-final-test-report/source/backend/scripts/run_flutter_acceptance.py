#!/usr/bin/env python3
"""Run both Flutter real-backend suites on owned random databases; optionally test a phone."""
import argparse
from contextlib import contextmanager
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import uuid
from fixed_model_fixture import Fixture, PASSWORD, quote
from migration_precheck import Mysql, DEFAULT_OPTION_FILE, BASE
from prepare_demo import database_env, prepare
from check_helpers import running_database

ROOT = BASE.parent


def flutter_test(output, name, args, env):
    path = output / (name + '.jsonl')
    with path.open('w') as log, path.with_suffix('.stderr').open('w') as errors:
        result = subprocess.run([env['FLUTTER_BIN'], 'test', '--no-pub', '--reporter', 'json', *args],
                                cwd=ROOT / 'flutter', env=env, stdout=log, stderr=errors)
    return {'phase': name, 'exitCode': result.returncode, 'log': path.name}


@contextmanager
def demo_service(output, temporary):
    with socket.socket() as probe:
        if probe.connect_ex(('127.0.0.1', 8080)) == 0:
            raise RuntimeError('Refusing to replace an existing service on 8080')
    admin = Mysql(None, DEFAULT_OPTION_FILE)
    database = 'pandora_precheck_flutter_' + uuid.uuid4().hex[:16]
    values = database_env()
    admin.server_side(f'CREATE DATABASE `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
    try:
        for host in ('localhost', '127.0.0.1'):
            admin.server_side(f'GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,REFERENCES,DROP ON `{database}`.* TO ' + quote(values['PANDORA_DB_USER']) + '@' + quote(host))
        manifest_path = Path(temporary) / 'demo-manifest.json'
        prepare(database, 'comprehensive-' + uuid.uuid4().hex, True, 18584, manifest_path)
        with running_database(database, 8080, output / 'flutter-real-service.log', worker=True,
                              extra=['--pandora.worker.initial-delay-ms=3600000', '--pandora.worker.delay-ms=3600000']):
            yield manifest_path
    finally:
        admin.server_side(f'DROP DATABASE IF EXISTS `{database}`')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--phone-command', type=Path)
    parser.add_argument('--only-phone', action='store_true')
    args = parser.parse_args()
    output = args.output.resolve(); output.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, PANDORA_DEMO_PASSWORD=PASSWORD, PANDORA_FIXTURE_PASSWORD=PASSWORD)
    os.environ['PANDORA_DEMO_PASSWORD'] = PASSWORD
    phases = []
    with tempfile.TemporaryDirectory(prefix='pandora-flutter-acceptance-') as temporary:
        if not args.only_phone:
            fixture = Fixture(port=18582, worker=True, controllable=True)
            fixture.log_path = output / 'flutter-managed-service.log'
            with fixture as f:
                config = Path(temporary) / 'fixture.json'
                config.write_text(json.dumps({'base': f.base, 'identities': f.identities}))
                config.chmod(0o600)
                phases.append(flutter_test(output, 'flutter-managed', ['tool/tests/managed_backend_test.dart'],
                                           dict(env, PANDORA_CLIENT_FIXTURE=str(config))))
        with demo_service(output, temporary) as manifest:
            if not args.only_phone:
                phases.append(flutter_test(output, 'flutter-real-backend', ['test/integration/real_backend_test.dart'], env))
            if args.phone_command:
                result = subprocess.run([os.environ.get('PYTHON_BIN', 'python3'), str(args.phone_command)],
                    cwd=ROOT, env=dict(env, PANDORA_TEST_DEMO_MANIFEST=str(manifest), PANDORA_TEST_OUTPUT=str(output)))
                phases.append({'phase': 'phone', 'exitCode': result.returncode})
    (output / 'flutter-integration-summary.json').write_text(json.dumps(phases, indent=2) + '\n')
    return int(any(p['exitCode'] for p in phases))


if __name__ == '__main__':
    raise SystemExit(main())
