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
    with (runtime / (name + '-console.log')).open('ab') as log:
        process = subprocess.Popen(sys.argv[3:], cwd=base, stdin=subprocess.DEVNULL,
                                   stdout=log, stderr=log, start_new_session=True, close_fds=True)
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
