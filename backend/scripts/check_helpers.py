"""Current-check helpers: own the service process, never the lifecycle of a caller's database."""
from contextlib import contextmanager
import os
import subprocess
import time
import urllib.request
from migration_precheck import BASE
from prepare_demo import database_env

@contextmanager
def running_database(database,port,log_path,worker=False,extra=()):
    values=database_env()
    env={**os.environ,**values,'PANDORA_DB_URL':f'jdbc:mysql://127.0.0.1:13306/{database}?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true&allowPublicKeyRetrieval=true&sslMode=DISABLED',
         'PANDORA_PORT':str(port),'PANDORA_BIND_ADDRESS':'127.0.0.1','PANDORA_SEED':'false','PANDORA_WORKER_ENABLED':str(worker).lower()}
    with log_path.open('w') as log:
        process=subprocess.Popen(['java','-jar',str(BASE/'target/pandora-backend-0.1.0.jar'),*extra],env=env,stdout=log,stderr=subprocess.STDOUT)
    try:
        for _ in range(120):
            if process.poll() is not None:raise RuntimeError('Service failed; see '+str(log_path))
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{port}/health',timeout=1) as response:
                    if response.status==200:break
            except OSError:pass
            time.sleep(.5)
        else:raise RuntimeError('Service timed out; see '+str(log_path))
        yield process
    finally:
        if process.poll() is None:
            process.terminate()
            try:process.wait(timeout=10)
            except subprocess.TimeoutExpired:process.kill();process.wait(timeout=10)
