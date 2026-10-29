#!/usr/bin/env python3
"""Run the selected current-contract checks on owned disposable databases; record every exit code.

No normal development database/process is changed. Maven package is a prerequisite.
"""
import argparse
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path
from migration_precheck import BASE

AUDIT=BASE.parent/'audit/refactor-pandora-organization-and-workflows'
PHASES={
 'migration':['check_fixed_organization_migration.py','check_legacy_mapping.py','check_final_migration.py'],
 'demo':['check_final_demo.py'],
 'api':['check_login_identity_collision.py','check_profile_phone_matrix.py','check_organization_plans.py',
        'check_review_routing.py','check_auto_apply_authorization.py','check_business_takeover.py',
        'check_fixed_workspace_access.py','check_fixed_notifications.py'],
 'browser':['check_admin_contract.py','check_handover_chain.py','check_fixed_web.py','check_calendar_drawer.py',
            'check_fixed_late_response.py','check_log_backfill_entry.py','check_fixed_communication_web.py'],
}
def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--phase',choices=[*PHASES,'all'],default='all')
 parser.add_argument('--only',nargs='*',help='Explicit filenames within the selected phase')
 args=parser.parse_args();AUDIT.mkdir(parents=True,exist_ok=True)
 scripts=sum(PHASES.values(),[]) if args.phase=='all' else PHASES[args.phase]
 if args.only:
  unknown=set(args.only)-set(scripts)
  if unknown:parser.error('Unknown check filenames: '+','.join(sorted(unknown)))
  scripts=[s for s in scripts if s in args.only]
 report={'updated':dt.datetime.now(dt.timezone.utc).isoformat(),'phase':args.phase,'checks':[]}
 for script in scripts:
  print('RUN '+script,flush=True)
  with (AUDIT/('final-'+Path(script).stem+'.log')).open('w') as log:
   result=subprocess.run([sys.executable,str(BASE/'scripts'/script)],cwd=BASE.parent,stdout=log,stderr=subprocess.STDOUT)
  report['checks'].append({'command':'python3 backend/scripts/'+script,'exitCode':result.returncode,
                          'log':'final-'+Path(script).stem+'.log','pass':result.returncode==0})
  print(('PASS ' if result.returncode==0 else 'FAIL ')+script,flush=True)
  (AUDIT/('final-'+args.phase+'-run.json')).write_text(json.dumps(report,indent=2)+'\n')
  if result.returncode:return result.returncode
 return 0
if __name__=='__main__':raise SystemExit(main())
