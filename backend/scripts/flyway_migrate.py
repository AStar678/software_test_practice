#!/usr/bin/env python3
"""Run only packaged Flyway migrations on an explicit existing database; never seed or repair history."""
import argparse
import os
from pathlib import Path
import re
import subprocess
import tempfile
import zipfile
from migration_precheck import BASE, Mysql, DEFAULT_OPTION_FILE
from prepare_demo import database_env

def migrate(db,target=None,expected=True,log_path=None):
    log_path=log_path or BASE.parent/'audit/refactor-pandora-organization-and-workflows/final-migration.log'
    values=database_env()
    with tempfile.TemporaryDirectory(prefix='pandora-flyway-') as temporary:
        root=Path(temporary)
        with zipfile.ZipFile(BASE/'target/pandora-backend-0.1.0.jar') as jar:
            for entry in jar.namelist():
                if entry.startswith('BOOT-INF/lib/') and entry.endswith('.jar'):
                    (root/Path(entry).name).write_bytes(jar.read(entry))
                elif entry.startswith('BOOT-INF/classes/db/migration/') and not entry.endswith('/'):
                    output=root/'classes'/entry.removeprefix('BOOT-INF/classes/')
                    output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(jar.read(entry))
        env={**os.environ,**values,'PANDORA_DB_URL':f'jdbc:mysql://127.0.0.1:13306/{db.database}?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true&allowPublicKeyRetrieval=true&sslMode=DISABLED'}
        args=['java','--class-path',str(root/'classes')+os.pathsep+str(root/'*'),str(BASE/'scripts/Migrate.java')]+([] if target is None else [str(target)])
        result=subprocess.run(args,env=env,capture_output=True,text=True)
        log_path.parent.mkdir(parents=True,exist_ok=True)
        with log_path.open('a') as log:log.write(f'\nDatabase {db.database}; target {target}\n'+result.stdout+result.stderr)
        if expected and result.returncode:raise RuntimeError('Flyway failed; see '+str(log_path))
        return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database',required=True)
    parser.add_argument('--target',type=int,choices=range(20,27))
    parser.add_argument('--log',type=Path,default=BASE/'.runtime/flyway-migrate.log')
    args=parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9_]{1,64}',args.database):parser.error('Invalid database name')
    db=Mysql(args.database,DEFAULT_OPTION_FILE)
    db.rows('SELECT DATABASE()')
    result=migrate(db,args.target,False,args.log)
    print('Flyway '+('completed' if result.returncode==0 else 'failed')+'; log: '+str(args.log))
    return result.returncode
if __name__=='__main__':raise SystemExit(main())
