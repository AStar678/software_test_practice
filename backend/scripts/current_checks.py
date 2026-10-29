"""Shared entry for superseded check names. Each replacement owns its isolated fixture and evidence.

The old external --base-url / demo-name fixture contract has been removed together with editable
roles. Current suites assert fixed positions, typed credentials, direct self application, privacy,
company isolation and version fencing. See backend/docs/current-checks.md for the coverage map.
"""
from pathlib import Path
import subprocess
import sys


def run(*scripts):
    if len(sys.argv)>1:
        if sys.argv[1:] in (['--help'],['-h']):
            print('This current-contract entry owns its disposable database/service. Run without arguments.\nSuites: '+', '.join(scripts))
            return 0
        raise SystemExit('External fixture arguments are retired. Run without arguments; see backend/docs/current-checks.md.')
    directory=Path(__file__).resolve().parent
    for script in scripts:
        result=subprocess.run([sys.executable,str(directory/script)])
        if result.returncode:return result.returncode
    return 0
