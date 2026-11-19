"""Real-service acceptance fixtures; never use a caller-supplied remote endpoint."""
import json
import os
from pathlib import Path
import sys
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend/scripts'))
from fixed_model_fixture import Fixture


@pytest.fixture(scope='session')
def service():
    output = Path(os.environ['PANDORA_TEST_OUTPUT']).resolve()
    fixture = Fixture(port=18581, worker=True, controllable=True)
    fixture.log_path = output / 'pytest-service.log'
    with fixture as f:
        assert f.database.startswith('pandora_precheck_model_')
        f.test_tokens = {who: f.login(who)[1]['token'] for who in f.identities}
        yield f


def compact(value):
    if isinstance(value, str) and len(value) > 100:
        return {'characters': len(value), 'utf16Units': len(value.encode('utf-16-le')) // 2,
                'utf8Bytes': len(value.encode()), 'prefix': value[:20]}
    if isinstance(value, (dict, list, tuple)):
        return str(value)[:250]
    return value


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    result = outcome.get_result()
    if result.when != 'call':
        return
    row = {'id': item.nodeid, 'outcome': result.outcome, 'seconds': result.duration,
           'input': {k: compact(v) for k, v in getattr(getattr(item, 'callspec', None), 'params', {}).items()},
           'purpose': item.function.__doc__, 'failure': str(result.longrepr) if result.failed else None}
    path = Path(os.environ['PANDORA_TEST_OUTPUT']) / 'pytest-cases.jsonl'
    with path.open('a') as out:
        out.write(json.dumps(row, ensure_ascii=False) + '\n')
