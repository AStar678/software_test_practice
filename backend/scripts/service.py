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
if name not in {'mysql', 'backend'}:
    raise SystemExit('unknown project service')
pidfile = runtime / (name + '.pid')
if sys.argv[1] == 'start':
    with (runtime / (name + '-console.log')).open('ab') as log:
        process = subprocess.Popen(sys.argv[3:], cwd=base, stdin=subprocess.DEVNULL,
                                   stdout=log, stderr=log, start_new_session=True, close_fds=True)
    if name == 'backend':
        pidfile.write_text(str(process.pid))
        pidfile.chmod(0o600)
elif sys.argv[1] == 'stop' and pidfile.exists():
    pid = int(pidfile.read_text())
    command = subprocess.run(['ps', '-p', str(pid), '-o', 'command='], capture_output=True, text=True).stdout
    expected = str(runtime / 'mysql') if name == 'mysql' else str(base / 'target/pandora-backend-0.1.0.jar')
    if not command.strip():
        pidfile.unlink(missing_ok=True)
        raise SystemExit(0)
    if expected not in command:
        raise SystemExit('Refusing to stop a process not owned by this project')
    os.kill(pid, signal.SIGTERM)
    for _ in range(50):
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            break
        time.sleep(0.1)
    pidfile.unlink(missing_ok=True)
