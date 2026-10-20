#!/usr/bin/env python3
"""Read-only MySQL integrity inspection. Does not insert, update, delete, or reset data.

Uses the local mysql client and a protected option file; credentials are never
printed or put on the command line. Run after the HTTP smoke suite.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys


CHECKS = {
    "current_pointer_is_applied_same_task_and_state": """
        SELECT COUNT(*) FROM tasks t LEFT JOIN task_versions v
          ON v.organization_id=t.organization_id AND v.task_id=t.id AND v.id=t.current_version_id
        WHERE t.current_version_id IS NOT NULL
          AND (v.id IS NULL OR v.status<>'applied' OR v.execution_state<>t.execution_state)""",
    "one_pending_request_per_task": """
        SELECT COUNT(*) FROM (SELECT organization_id,task_id FROM approval_requests
        WHERE status='pending' GROUP BY organization_id,task_id HAVING COUNT(*)>1) x""",
    "pending_base_matches_current_pointer": """
        SELECT COUNT(*) FROM approval_requests r JOIN tasks t ON t.organization_id=r.organization_id AND t.id=r.task_id
        WHERE r.status='pending' AND NOT (r.base_version_id <=> t.current_version_id)""",
    "request_and_snapshot_statuses_agree": """
        SELECT COUNT(*) FROM approval_requests r JOIN task_versions v
          ON v.organization_id=r.organization_id AND v.task_id=r.task_id AND v.id=r.proposed_version_id
        WHERE (r.status='pending' AND v.status<>'proposed')
           OR (r.status IN ('approved','direct') AND v.status<>'applied')
           OR (r.status IN ('rejected','withdrawn') AND v.status<>r.status)""",
    "every_snapshot_has_assignee": """
        SELECT COUNT(*) FROM task_versions v WHERE NOT EXISTS
          (SELECT 1 FROM task_version_assignees a WHERE a.organization_id=v.organization_id AND a.version_id=v.id)""",
    "direct_requests_have_reason_and_no_fictional_reviewer_decision": """
        SELECT COUNT(*) FROM approval_requests WHERE status='direct'
          AND (exemption_reason IS NULL OR CHAR_LENGTH(TRIM(exemption_reason))=0 OR decided_by IS NOT NULL)""",
    "settled_requests_have_decision_timestamp": """
        SELECT COUNT(*) FROM approval_requests WHERE status<>'pending' AND decided_at IS NULL""",
    "pending_requests_have_no_decision_timestamp": """
        SELECT COUNT(*) FROM approval_requests WHERE status='pending' AND (decided_at IS NOT NULL OR decided_by IS NOT NULL)""",
    "task_records_reference_the_same_task_as_request": """
        SELECT COUNT(*) FROM task_records r JOIN approval_requests a
          ON a.organization_id=r.organization_id AND a.id=r.request_id WHERE a.task_id<>r.task_id""",
    "disclosed_notification_task_matches_event": """
        SELECT COUNT(*) FROM notifications n JOIN domain_events e
          ON e.organization_id=n.organization_id AND e.id=n.event_id
        WHERE n.task_id IS NOT NULL AND NOT (n.task_id <=> e.task_id)""",
    "no_duplicate_notification_recipient": """
        SELECT COUNT(*) FROM (SELECT event_id,recipient_id FROM notifications
          GROUP BY event_id,recipient_id HAVING COUNT(*)>1) x""",
    "all_business_foreign_keys_include_organization": """
        SELECT COUNT(*) FROM (SELECT TABLE_NAME,CONSTRAINT_NAME,
          MAX(REFERENCED_TABLE_NAME) target,SUM(COLUMN_NAME='organization_id') scoped
          FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
          GROUP BY TABLE_NAME,CONSTRAINT_NAME) x WHERE target<>'organizations' AND scoped=0""",
    "all_checks_are_enforced": """
        SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
          WHERE TABLE_SCHEMA=DATABASE() AND CONSTRAINT_TYPE='CHECK' AND ENFORCED<>'YES'""",
    "pending_uniqueness_index_exists": """
        SELECT IF(COUNT(*)=2,0,1) FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='approval_requests'
          AND INDEX_NAME='uq_one_pending' AND NON_UNIQUE=0
          AND COLUMN_NAME IN ('organization_id','pending_task_id')""",
    "pending_unique_column_is_generated": """
        SELECT IF(COUNT(*)=1,0,1) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='approval_requests' AND COLUMN_NAME='pending_task_id'
          AND EXTRA LIKE '%GENERATED%' AND GENERATION_EXPRESSION LIKE '%pending%'""",
    "idempotency_keys_are_case_sensitive": """
        SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
          AND TABLE_NAME='idempotency_keys' AND COLUMN_NAME IN ('key_value','scope')
          AND COLLATION_NAME NOT LIKE '%_bin' AND COLLATION_NAME NOT LIKE '%_cs'""",
    "idempotency_results_contain_no_task_text_or_credentials": """
        SELECT COUNT(*) FROM idempotency_keys WHERE JSON_CONTAINS_PATH(response_json,'one',
          '$.title','$.description','$.body','$.token','$.accessToken','$.password',
          '$.initialPassword','$.passwordHash','$.credential')=1""",
    "tokens_are_only_sha256_hashes": """
        SELECT COUNT(*) FROM auth_sessions WHERE token_hash NOT REGEXP '^[0-9a-f]{64}$'""",
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    root = Path(__file__).resolve().parents[1]
    parser.add_argument("--defaults-file", type=Path, default=root / ".runtime/mysql-admin.cnf")
    parser.add_argument("--database", default="pandora")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    mysql = shutil.which("mysql")
    if not mysql:
        parser.error("mysql client is required")
    if not args.defaults_file.is_file():
        parser.error("MySQL client option file is unavailable; start the project database first")
    statements = ["SET TRANSACTION READ ONLY", "START TRANSACTION WITH CONSISTENT SNAPSHOT",
                  "SELECT 'mysql_version',VERSION()"]
    for name, query in CHECKS.items():
        statements.append("SELECT '" + name + "',(" + query.strip() + ")")
    statements.append("COMMIT")
    process = subprocess.run(
        [mysql, "--defaults-file=" + str(args.defaults_file.resolve()), "--batch", "--skip-column-names", args.database],
        input=";\n".join(statements) + ";\n", text=True, capture_output=True, timeout=30)
    if process.returncode:
        print("Read-only database inspection failed: " + process.stderr.strip(), file=sys.stderr)
        return 2
    rows = [line.split("\t", 1) for line in process.stdout.splitlines() if "\t" in line]
    values = dict(rows)
    results = [{"check": name, "violations": int(values[name]), "passed": int(values[name]) == 0} for name in CHECKS]
    report = {"mode": "read_only", "mysqlVersion": values.get("mysql_version"),
              "passed": all(item["passed"] for item in results), "checks": results}
    output = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output + "\n", encoding="utf-8")
    print(output)
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
