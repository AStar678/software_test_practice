#!/usr/bin/env python3
"""Current fixed-contract replacement; see docs/current-checks.md for retained coverage."""
from current_checks import run

if __name__ == "__main__": raise SystemExit(run('check_final_migration.py','check_legacy_mapping.py','check_log_backfill_entry.py'))
