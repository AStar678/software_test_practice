#!/usr/bin/env python3
"""Start this project's servers in a separate process session; preserve data on stop."""
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

base = Path(__file__).resolve().parent.parent
runtime = base / '.runtime'
name = sys.argv[2]
if name not in {'mysql', 'backend', 'demo'}:
    raise SystemExit('unknown project service')
pidfile = runtime / (name + '.pid')
if sys.argv[1] == 'start':
    log_path = runtime / (name + '-console.log')
    with log_path.open('ab') as log:
        log_start = log.tell()
        try:
            process = subprocess.Popen(sys.argv[3:], cwd=base, stdin=subprocess.DEVNULL,
                                       stdout=log, stderr=log, start_new_session=True, close_fds=True)
        except OSError as error:
            raise SystemExit(f'{name} 无法启动：{error}')
    # Loader errors and invalid server options often terminate before a readiness probe.
    # Show only this attempt's output, so an old failure cannot masquerade as the cause.
    time.sleep(0.25)
    if process.poll() is not None:
        print(f'{name} 启动进程已退出（退出码 {process.returncode}），日志：{log_path}', file=sys.stderr)
        with log_path.open('rb') as log:
            log.seek(max(log_start, log_path.stat().st_size - 8192))
            print(log.read().decode(errors='replace'), file=sys.stderr)
        raise SystemExit(1)
    if name in {'backend', 'demo'}:
        pidfile.write_text(str(process.pid))
        pidfile.chmod(0o600)
elif sys.argv[1] == 'stop' and pidfile.exists():
    pid = int(pidfile.read_text())
    expected = str(runtime / 'mysql') if name == 'mysql' else str(base / 'target/pandora-backend-0.1.0.jar')

    def owned_by_project():
        """Confirm the PID still belongs to this project before signalling it."""
        try:
            command = subprocess.run(['ps', '-p', str(pid), '-o', 'command='],
                                     capture_output=True, text=True).stdout
        except OSError:
            command = None
        if command is not None:
            if not command.strip():
                return None  # process is already gone
            return expected in command
        # Some sandboxes deny executing `ps`. Identify the process by the resources this project
        # started it with instead: mysqld holds the project datadir open, and every service is
        # launched with this repository as its working directory. Refuse when neither matches.
        try:
            listed = subprocess.run(['lsof', '-nP', '-p', str(pid), '-Fn'],
                                    capture_output=True, text=True).stdout
        except OSError:
            return False
        names = [line[1:] for line in listed.splitlines() if line.startswith('n')]
        if any(item.startswith(expected) for item in names):
            return True
        return any(item == str(base) for item in names)

    owned = owned_by_project()
    if owned is None:
        pidfile.unlink(missing_ok=True)
        raise SystemExit(0)
    if not owned:
        raise SystemExit('Refusing to stop a process not owned by this project')
    os.kill(pid, signal.SIGTERM)
    for _ in range(50):
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            break
        time.sleep(0.1)
    pidfile.unlink(missing_ok=True)
