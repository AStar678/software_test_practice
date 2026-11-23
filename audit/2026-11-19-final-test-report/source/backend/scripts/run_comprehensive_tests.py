#!/usr/bin/env python3
"""Run current owned-fixture suites without overwriting historical audit evidence.

The staged scripts and resource links use the current working tree. Only fixture databases
with the existing random scratch prefix are created/dropped. Production endpoints are unused.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
SUITES = [
    'check_fixed_organization_migration.py', 'check_legacy_mapping.py', 'check_final_migration.py',
    'check_login_identity_collision.py', 'check_organization_plans.py', 'check_review_routing.py',
    'check_auto_apply_authorization.py', 'check_business_takeover.py', 'check_profile_phone_matrix.py',
    'check_fixed_workspace_access.py', 'check_fixed_notifications.py', 'check_visible_schedule_permissions.py',
    'check_holidays.py', 'check_employee_contracts_upgrade.py', 'check_task_refinement_upgrade.py',
    'check_apply_private_migration_guard.py', 'check_demo_extremes.py', 'check_final_demo.py',
    'check_admin_contract.py', 'check_handover_chain.py', 'check_fixed_web.py',
    'check_calendar_drawer.py', 'check_fixed_late_response.py', 'check_log_backfill_entry.py',
    'check_fixed_communication_web.py', 'check_daily_items.py', 'check_chapter8_web.py',
    'check_apply_notifications.py', 'check_apply_mixed_edit.py', 'check_apply_log_tags.py',
    'check_apply_admin_login_phone.py', 'check_apply_profile_pin_history.py', 'check_calendar_tags.py',
    'check_subordinate_workspace.py', 'check_schedule_drag.py', 'check_request_id_compat.py',
    'check_apply_copy_audit.py', 'check_web_alignment_drag.py', 'check_task_creation_refinement.py',
    'check_web_verification_repairs.py', 'check_founder_setup.py',
]


def stage_project(root: Path, output: Path) -> None:
    root.mkdir(parents=True)
    # Migration checks read historical files with `git show`; keep that evidence available.
    (root / '.git').symlink_to(ROOT / '.git', target_is_directory=True)
    for p in ROOT.iterdir():
        if p.name in {'.git', '.agents', '.codex', 'backend', 'audit', 'output'}:
            continue
        (root / p.name).symlink_to(p, target_is_directory=p.is_dir())
    backend = root / 'backend'
    backend.mkdir()
    shutil.copytree(ROOT / 'backend/scripts', backend / 'scripts', ignore=shutil.ignore_patterns('__pycache__'))
    for p in (ROOT / 'backend').iterdir():
        if p.name == 'scripts':
            continue
        (backend / p.name).symlink_to(p, target_is_directory=p.is_dir())
    for name in ('audit', 'output'):
        target = output / ('suite-artifacts' if name == 'audit' else 'suite-output')
        target.mkdir(parents=True, exist_ok=True)
        (root / name).symlink_to(target, target_is_directory=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--only', nargs='+', choices=SUITES)
    parser.add_argument('--timeout', type=int, default=600)
    parser.add_argument('--java-agent', type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    env.setdefault('CHROME_BIN', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge')
    report = {'startedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'suites': []}
    report_path = output / 'current-suites.json'
    suites = args.only or SUITES
    with tempfile.TemporaryDirectory(prefix='pandora-comprehensive-stage-') as temporary:
        staged = Path(temporary) / 'project'
        stage_project(staged, output)
        coverage = Path(temporary) / 'coverage'
        coverage.mkdir()
        if args.java_agent:
            shutil.copy2(args.java_agent, Path(temporary) / 'jacoco-agent.jar')
        for name in suites:
            started = time.monotonic()
            log_path = output / (Path(name).stem + '.log')
            print('RUN ' + name, flush=True)
            with log_path.open('w') as log:
                suite_env = dict(env)
                if args.java_agent:
                    agent = Path(temporary) / 'jacoco-agent.jar'
                    dest = coverage / (Path(name).stem + '.exec')
                    suite_env['JAVA_TOOL_OPTIONS'] = (
                        env.get('JAVA_TOOL_OPTIONS', '') +
                        f' -javaagent:{agent}=destfile={dest},append=true,includes=cn.pandora.*'
                    ).strip()
                try:
                    process = subprocess.Popen(
                        [sys.executable, str(staged / 'backend/scripts' / name)],
                        cwd=staged, env=suite_env, stdout=log, stderr=subprocess.STDOUT,
                        start_new_session=True,
                    )
                    code, timed_out = process.wait(timeout=args.timeout), False
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGTERM)
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL)
                        process.wait()
                    code, timed_out = 124, True
            text = log_path.read_text(errors='replace')
            checks = [line for line in text.splitlines() if re.match(r'^PASS\s+', line)]
            row = {'suite': name, 'exitCode': code, 'timedOut': timed_out,
                   'seconds': round(time.monotonic() - started, 3),
                   'passedAssertionsPrinted': len(checks), 'log': log_path.name,
                   'sourceSha256': hashlib.sha256((staged / 'backend/scripts' / name).read_bytes()).hexdigest(),
                   'finishedAt': dt.datetime.now(dt.timezone.utc).isoformat()}
            report['suites'].append(row)
            for p in coverage.glob('*.exec'):
                (output / 'integration-coverage').mkdir(exist_ok=True)
                shutil.copy2(p, output / 'integration-coverage' / p.name)
            report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
            print(('PASS ' if code == 0 else 'FAIL ') + name + ' assertions=' + str(len(checks)), flush=True)
    report['finishedAt'] = dt.datetime.now(dt.timezone.utc).isoformat()
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    return int(any(row['exitCode'] for row in report['suites']))


if __name__ == '__main__':
    raise SystemExit(main())
