#!/usr/bin/env python3
"""Read-only migration precheck and isolated rehearsal entry point (task 1.1).

Reports the gaps the formal-requirement migration must resolve before constraints
can be tightened:

* departments/positions missing for active users and teams,
* duplicate personal work logs that block the per-day unique key,
* assignee order that has no durable proof in the V4 schema,
* dispatch (assignment) timestamps with no recorded source,
* notifications whose durable event cannot be bound to the originating request,
* employee phone numbers that are missing or collide after the shared normalization
  (chapter 1.1 / 2.1: the login key is derived, never invented),
* the company employee organization tree: a unique root, no dangling or cyclic
  manager reference (chapter 1.1 / 3.2: the founder is proven, never guessed),
* the historical acceptance-criteria population that must survive its removal from
  the creation form (chapter 1.1 / 4.1),
* explicit stable-ID mapping of the legacy organization: founder, every active
  employee placement, department/team heads, display positions, administrators and
  normalized phone -> employee IDs (task 1.4). The mapping command emits a complete
  organization-plan payload only when the whole final state has no blocker.

Every phone-derived figure is reported as an object id or a masked number; a full
contact number is never printed.

Every statement issued by ``precheck``, ``mapping`` and ``fingerprint`` is a
read-only SELECT/SHOW/DESCRIBE statement; the runner refuses anything else.
``restore`` and ``rehearse`` create a *scratch* database only, never the live one, so
the original database is proven untouched by comparing fingerprints around the run.

Credentials come from the project option file (``.runtime/mysql-admin.cnf``) or a
caller-supplied ``--defaults-file``; they are never printed or passed on the
command line.

Examples
--------
    # Rehearse the whole migration precheck on a throwaway copy of the snapshot
    python3 scripts/migration_precheck.py rehearse

    # Precheck an existing database without touching it
    python3 scripts/migration_precheck.py precheck --database pandora

    # Validate an explicit stable-ID mapping and write the plan report
    python3 scripts/migration_precheck.py mapping --database pandora \\
        --mapping legacy-mapping.json --output mapping-report.json

Mapping file shape (all references are stable IDs read from the database)::

    {
      "reason": "reviewed legacy mapping",
      "companies": [{
        "organizationId": "company-id",
        "founderEmployeeId": "employee-id",
        "employees": [{"employeeId": "employee-id", "phone": "138..."}],
        "departments": ["department-id"],
        "teams": [{"id": "team-id", "departmentId": "department-id"}],
        "placements": [
          {"employeeId": "employee-id", "placementType": "founder",
           "positionId": "position-id"},
          {"employeeId": "head-id", "placementType": "department_head",
           "departmentId": "department-id", "positionId": "position-id"},
          {"employeeId": "lead-id", "placementType": "team_head",
           "departmentId": "department-id", "teamId": "team-id",
           "positionId": "position-id"},
          {"employeeId": "employee-id", "placementType": "employee",
           "departmentId": "department-id", "teamId": "team-id",
           "positionId": "position-id"}
        ],
        "administrator": {"adminId": "admin-id", "accountName": "administrator"}
      }]
    }

The administrator may instead be marked ``{"repair": "reason"}`` to keep an
unresolved identity blocker. A plan is emitted only when the company has no
blocker; phones in the report are always masked.

    # Print only the data fingerprint
    python3 scripts/migration_precheck.py fingerprint --database pandora
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys


BASE = Path(__file__).resolve().parent.parent
RUNTIME = BASE / '.runtime'
DEFAULT_OPTION_FILE = RUNTIME / 'mysql-admin.cnf'
DEFAULT_SNAPSHOT = BASE / 'database' / 'pandora.sql'
EVIDENCE_DIR = BASE.parent / 'audit'
SCRATCH_PREFIX = 'pandora_precheck_'

# Statements the read-only guard accepts. `WITH` covers read-only CTEs.
READ_ONLY_PREFIXES = ('select', 'show', 'describe', 'desc', 'explain', 'with')

# Tables whose row counts and content digest make up the data fingerprint.
FINGERPRINT_TABLES = (
    'organizations', 'teams', 'users', 'tasks', 'task_versions',
    'task_version_assignees', 'approval_requests', 'task_records',
    'work_logs', 'home_items', 'domain_events', 'notifications',
    'audit_logs', 'idempotency_keys', 'ai_jobs', 'reminder_receipts',
    'principals', 'admin_accounts', 'departments', 'positions', 'employee_placements',
    'task_business_owners', 'task_business_transfers', 'demo_database_identity', 'demo_seed_keys',
    'flyway_schema_history',
)


class MysqlError(RuntimeError):
    """A read-only statement or client invocation failed."""


class ReadOnlyViolation(RuntimeError):
    """A non read-only statement was about to be issued."""


def _guard(statement: str) -> str:
    stripped = statement.strip().lstrip('(').strip().lower()
    if not stripped.startswith(READ_ONLY_PREFIXES):
        raise ReadOnlyViolation(f'refusing non read-only statement: {statement[:80]}')
    return statement


class Mysql:
    """Thin wrapper over the mysql CLI that only issues read-only statements."""

    def __init__(self, database: str | None, option_file: Path, host: str = '127.0.0.1',
                 port: int = 13306):
        self.database = database
        self.option_file = option_file
        self.host = host
        self.port = port

    def scalar(self, sql: str, default: int = 0) -> int:
        rows = self.rows(_guard(sql))
        if not rows or not rows[0]:
            return default
        value = rows[0][0]
        return default if value in (None, 'NULL') else int(value)

    def rows(self, sql: str) -> list[list[str | None]]:
        _guard(sql)
        command = ['mysql', '--defaults-file=' + str(self.option_file), '--batch',
                   '--raw', '--skip-column-names', '-h', self.host, '-P', str(self.port)]
        if self.database:
            command.append('--database=' + self.database)
        command += ['-e', sql]
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0:
            raise MysqlError(result.stderr.strip() or 'mysql client failed')
        rows = []
        for line in result.stdout.splitlines():
            if line == '':
                continue
            rows.append(['NULL' if cell == 'NULL' else cell for cell in line.split('\t')])
        return rows

    def server_side(self, sql: str) -> None:
        """Run a write statement. Only used for scratch-database setup."""
        command = ['mysql', '--defaults-file=' + str(self.option_file),
                   '-h', self.host, '-P', str(self.port)]
        if self.database:
            command.append('--database=' + self.database)
        command += ['-e', sql]
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0:
            raise MysqlError(result.stderr.strip() or 'mysql client failed')

    def import_sql(self, path: Path, database: str) -> None:
        command = ['mysql', '--defaults-file=' + str(self.option_file),
                   '--database=' + database, '-h', self.host, '-P', str(self.port)]
        with path.open('rb') as handle:
            result = subprocess.run(command, stdin=handle, capture_output=True, text=True)
        if result.returncode != 0:
            raise MysqlError(result.stderr.strip() or 'snapshot import failed')


def tables(client: Mysql) -> list[str]:
    return [row[0] for row in client.rows(
        "SELECT table_name FROM information_schema.tables "
        f"WHERE table_schema='{client.database}' AND table_type='BASE TABLE' "
        "ORDER BY table_name")]


def columns(client: Mysql, table: str) -> list[str]:
    return [row[0] for row in client.rows(
        "SELECT column_name FROM information_schema.columns "
        f"WHERE table_schema='{client.database}' AND table_name='{table}' "
        "ORDER BY ordinal_position")]


def primary_key(client: Mysql, table: str) -> list[str]:
    rows = client.rows(
        "SELECT column_name FROM information_schema.statistics "
        f"WHERE table_schema='{client.database}' AND table_name='{table}' AND index_name='PRIMARY' "
        "ORDER BY seq_in_index")
    return [row[0] for row in rows]


def has_table(client: Mysql, table: str) -> bool:
    return bool(client.rows(
        "SELECT 1 FROM information_schema.tables "
        f"WHERE table_schema='{client.database}' AND table_name='{table}' LIMIT 1"))


def has_column(client: Mysql, table: str, column: str) -> bool:
    return bool(client.rows(
        "SELECT 1 FROM information_schema.columns "
        f"WHERE table_schema='{client.database}' AND table_name='{table}' "
        f"AND column_name='{column}' LIMIT 1"))


# --------------------------------------------------------------------------- #
# Data fingerprint
# --------------------------------------------------------------------------- #

def fingerprint(client: Mysql) -> dict:
    """Per-table row counts plus a content digest, so a run can prove no writes."""
    present = tables(client)
    result: dict[str, object] = {'database': client.database, 'tables': {}, 'digest': ''}
    digest = hashlib.sha256()
    for table in sorted(present):
        count = client.scalar(f'SELECT COUNT(*) FROM `{table}`')
        key = primary_key(client, table) or columns(client, table)
        order = ','.join(f'`{name}`' for name in key)
        rows = client.rows(f'SELECT * FROM `{table}` ORDER BY {order}') if key else []
        table_hash = hashlib.sha256()
        for row in rows:
            table_hash.update(('\x1f'.join('' if cell == 'NULL' else cell for cell in row)).encode())
            table_hash.update(b'\x1e')
        result['tables'][table] = {'rows': count, 'sha256': table_hash.hexdigest()}
        digest.update(f'{table}:{count}:{table_hash.hexdigest()}\n'.encode())
    result['digest'] = digest.hexdigest()
    return result


# --------------------------------------------------------------------------- #
# Shared phone normalization (same rule as cn.pandora.auth.PhoneNumbers)
# --------------------------------------------------------------------------- #

PHONE_SEPARATORS = (' ', '\u3000', '\t', '-', '(', ')', '.')


def normalize_phone(value: str | None) -> str | None:
    """Remove the display separators the profile form allows and keep one leading '+'.

    Mirrors the Java implementation so the precheck reports exactly the collisions the
    application will refuse. It never rewrites a number into a different range.
    """
    if value is None:
        return None
    text = ''.join(ch for ch in value if ch not in PHONE_SEPARATORS)
    if not re.fullmatch(r'\+?[0-9]{3,20}', text):
        return None
    return text


def cell(value):
    """The mysql client prints NULL as the text 'NULL'; keep the real absence instead."""
    return None if value is None or value == 'NULL' else value


def mask_phone(value: str | None) -> str:
    """An identifier safe to put in a report: never the full number."""
    text = normalize_phone(value) or ''
    if not text:
        return '(none)'
    if len(text) <= 6:
        return text[0] + '***'
    return text[:3] + '***' + text[-4:]


# --------------------------------------------------------------------------- #
# Gap checks
# --------------------------------------------------------------------------- #

def check_organization(client: Mysql) -> dict:
    """Departments/positions required by the formal organization model."""
    users = client.scalar('SELECT COUNT(*) FROM users')
    active = client.scalar('SELECT COUNT(*) FROM users WHERE active=1')
    teams = client.scalar('SELECT COUNT(*) FROM teams')
    departments_defined = client.scalar('SELECT COUNT(*) FROM departments') if has_table(client, 'departments') else 0
    positions_defined = client.scalar('SELECT COUNT(*) FROM positions') if has_table(client, 'positions') else 0

    users_missing_department = (
        client.scalar('SELECT COUNT(*) FROM users WHERE department_id IS NULL')
        if has_column(client, 'users', 'department_id') else active)
    users_missing_position = (
        client.scalar('SELECT COUNT(*) FROM users WHERE position_id IS NULL')
        if has_column(client, 'users', 'position_id') else active)
    teams_missing_department = (
        client.scalar('SELECT COUNT(*) FROM teams WHERE department_id IS NULL')
        if has_column(client, 'teams', 'department_id') else teams)

    return {
        'users': users,
        'activeUsers': active,
        'teams': teams,
        'departmentsDefined': departments_defined,
        'positionsDefined': positions_defined,
        'usersMissingDepartment': users_missing_department,
        'usersMissingPosition': users_missing_position,
        'teamsMissingDepartment': teams_missing_department,
        'legacyTeams': [{'id': row[0], 'name': row[1],
                         'users': int(row[2] or 0)}
                        for row in client.rows(
                            'SELECT t.id,t.name,COUNT(u.id) FROM teams t '
                            'LEFT JOIN users u ON u.organization_id=t.organization_id AND u.team_id=t.id '
                            'GROUP BY t.id,t.name ORDER BY t.name,t.id')],
        'note': ('V4 teams are not proof of a real department; a human administrator must '
                 'supply the department/position mapping before NOT NULL is enforced.'),
    }


def check_work_logs(client: Mysql) -> dict:
    """Duplicate (organization, author, business_date) logs block the unique key."""
    duplicate_groups = client.rows(
        'SELECT organization_id,author_id,business_date,COUNT(*) FROM work_logs '
        'GROUP BY organization_id,author_id,business_date HAVING COUNT(*)>1 '
        'ORDER BY organization_id,author_id,business_date')
    duplicates = []
    for org, author, date, count in duplicate_groups:
        details = client.rows(
            'SELECT w.id,w.body,w.task_id,w.row_version,w.created_at,u.display_name '
            'FROM work_logs w JOIN users u ON u.id=w.author_id AND u.organization_id=w.organization_id '
            f"WHERE w.organization_id='{org}' AND w.author_id='{author}' AND w.business_date='{date}' "
            'ORDER BY w.created_at,w.id')
        duplicates.append({
            'organizationId': org,
            'authorId': author,
            'authorName': details[0][5] if details else None,
            'businessDate': date,
            'copies': int(count),
            'rows': [{'id': row[0], 'body': row[1], 'taskId': row[2] or None,
                      'rowVersion': row[3], 'createdAt': row[4]} for row in details],
        })
    cross_author_groups = client.scalar(
        'SELECT COUNT(*) FROM (SELECT organization_id,business_date FROM work_logs '
        'GROUP BY organization_id,business_date HAVING COUNT(DISTINCT author_id)>1) x')
    return {
        'total': client.scalar('SELECT COUNT(*) FROM work_logs'),
        'duplicateGroups': len(duplicates),
        'duplicateRows': sum(item['copies'] for item in duplicates),
        'sameDayDifferentAuthors': cross_author_groups,
        'duplicates': duplicates,
        'note': ('Duplicate groups must be merged with every original body and source preserved '
                 'in an archive row before the per-day unique key is enabled. Authors are never '
                 'merged across each other.'),
    }


def check_assignee_order(client: Mysql) -> dict:
    """Ordered reviewer routing needs a durable ordinal the V4 schema never stored."""
    ordered = has_column(client, 'task_version_assignees', 'ordinal')
    total = client.scalar('SELECT COUNT(*) FROM task_version_assignees')
    missing = (client.scalar('SELECT COUNT(*) FROM task_version_assignees WHERE ordinal IS NULL')
               if ordered else total)
    multi = client.rows(
        'SELECT organization_id,version_id,COUNT(*) FROM task_version_assignees '
        'GROUP BY organization_id,version_id HAVING COUNT(*)>1 ORDER BY organization_id,version_id')
    recoverable = 0
    samples = []
    for org, version, count in multi[:200]:
        # The only durable proof of submission order would be a stored sequence. V4 has
        # none, so the deterministic compatibility order is user_id (today's read path).
        rows = client.rows(
            'SELECT user_id FROM task_version_assignees '
            f"WHERE organization_id='{org}' AND version_id='{version}' ORDER BY user_id")
        samples.append({
            'versionId': version,
            'assignees': count,
            'orderRecoverable': False,
            'legacyCompatOrder': [row[0] for row in rows],
            'legacyOrderUnknown': True,
        })
    return {
        'ordinalColumnPresent': ordered,
        'rows': total,
        'rowsMissingOrdinal': missing,
        'multiAssigneeVersions': len(multi),
        'orderRecoverableVersions': recoverable,
        'samples': samples,
        'note': ('No persisted submission order exists in V4. The first formal edit per version '
                 'must save an explicit order; reads fall back to the deterministic user_id order '
                 'and mark legacy-order-unknown rather than claiming the real order was restored.'),
    }


def check_dispatch(client: Mysql) -> dict:
    """Dashboard ranking needs the moment a task actually reached each assignee."""
    has_records = has_table(client, 'task_assignments')
    current_assignees = client.scalar(
        'SELECT COUNT(*) FROM task_version_assignees a JOIN tasks t '
        'ON t.organization_id=a.organization_id AND t.current_version_id=a.version_id')
    recoverable = client.scalar(
        "SELECT COUNT(*) FROM task_version_assignees a "
        'JOIN tasks t ON t.organization_id=a.organization_id AND t.current_version_id=a.version_id '
        'WHERE EXISTS (SELECT 1 FROM approval_requests r WHERE r.organization_id=t.organization_id '
        "AND r.task_id=t.id AND r.status IN ('approved','direct') AND r.decided_at IS NOT NULL)")
    return {
        'dispatchTablePresent': has_records,
        'rows': client.scalar('SELECT COUNT(*) FROM task_assignments') if has_records else 0,
        'rowsMissingAssignedAt': (
            client.scalar('SELECT COUNT(*) FROM task_assignments WHERE assigned_at IS NULL')
            if has_records else 0),
        'currentAssigneeRows': current_assignees,
        'recoverableFromApprovalTime': recoverable,
        'estimatedOnly': current_assignees - recoverable,
        'note': ('Assignment timestamps recoverable from an approved request decision keep that '
                 'proven source; the rest are stored as legacy-estimate so compatibility ordering '
                 'is explicit and new dispatches get an exact time.'),
    }


def check_notifications(client: Mysql) -> dict:
    """In-app messages must bind to the request that produced them."""
    total = client.scalar('SELECT COUNT(*) FROM notifications')
    with_event = client.scalar(
        'SELECT COUNT(*) FROM notifications n JOIN domain_events e '
        'ON e.organization_id=n.organization_id AND e.id=n.event_id')
    bound = client.scalar(
        'SELECT COUNT(*) FROM notifications n JOIN domain_events e '
        'ON e.organization_id=n.organization_id AND e.id=n.event_id '
        "WHERE JSON_EXTRACT(e.details_json,'$.requestId') IS NOT NULL")
    unbindable_review = client.scalar(
        'SELECT COUNT(*) FROM notifications n JOIN domain_events e '
        'ON e.organization_id=n.organization_id AND e.id=n.event_id '
        "WHERE JSON_EXTRACT(e.details_json,'$.requestId') IS NULL "
        "AND n.event_type LIKE '%review%'")
    shared_task = client.scalar(
        'SELECT COUNT(*) FROM (SELECT e.task_id FROM notifications n JOIN domain_events e '
        'ON e.organization_id=n.organization_id AND e.id=n.event_id '
        'WHERE JSON_EXTRACT(e.details_json,\'$.requestId\') IS NULL AND e.task_id IS NOT NULL '
        'GROUP BY e.task_id HAVING COUNT(DISTINCT e.id)>1) x')
    return {
        'total': total,
        'withEvent': with_event,
        'boundToRequest': bound,
        'unbound': total - bound,
        'unbindableReviewMessages': unbindable_review,
        'tasksWithAmbiguousSource': shared_task,
        'note': ('Only a provable domain_event/request binding may migrate. Messages that cannot '
                 'be bound stay read-only and keep no review action; they are never guessed from '
                 "the task's current pending request."),
    }


def check_request_routes(client: Mysql) -> dict:
    """Pending routes must be recomputed and already-expired pending must be expired."""
    pending = client.scalar("SELECT COUNT(*) FROM approval_requests WHERE status='pending'")
    expired_candidates = client.scalar(
        'SELECT COUNT(*) FROM approval_requests r JOIN tasks t '
        'ON t.organization_id=r.organization_id AND t.id=r.task_id '
        'JOIN task_versions v ON v.organization_id=r.organization_id AND v.id=r.proposed_version_id '
        'WHERE r.status=\'pending\' AND v.due_at<=UTC_TIMESTAMP(6)')
    direct = client.scalar("SELECT COUNT(*) FROM approval_requests WHERE status='direct'")
    reviewer_nullable = has_column(client, 'approval_requests', 'reviewer_nullable')
    return {
        'pending': pending,
        'direct': direct,
        'expiredPendingCandidates': expired_candidates,
        'reviewerNullablePresent': reviewer_nullable,
        'note': ('Every pending request gets a migration route reassignment record. Requests whose '
                 'applicable deadline already passed are expired, not approved.'),
    }


def check_login_identity(client: Mysql) -> dict:
    """Employee login keys: missing numbers and normalized collisions block phone login."""
    if not has_column(client, 'users', 'phone'):
        rows = client.rows(
            'SELECT id,organization_id,role,active,NULL AS phone FROM users ORDER BY organization_id,id')
    else:
        rows = client.rows(
            'SELECT id,organization_id,role,active,phone FROM users ORDER BY organization_id,id')
    employees = [row for row in rows
                 if cell(row[2]) != 'admin' and str(cell(row[3])) in ('1', 'true', 'True')]
    missing, invalid = [], []
    groups: dict[str, list[str]] = {}
    for user_id, organization_id, _role, _active, phone in employees:
        phone = cell(phone)
        key = normalize_phone(phone)
        if key is None:
            (missing if phone is None or str(phone).strip() == '' else invalid).append(user_id)
            continue
        groups.setdefault(key, []).append(user_id)
    duplicates = [
        {'phone': mask_phone(key), 'userId': None, 'userIds': sorted(ids)}
        for key, ids in sorted(groups.items()) if len(ids) > 1]
    return {
        'activeEmployees': len(employees),
        'missingPhone': len(missing),
        'invalidPhone': len(invalid),
        'missingPhoneUserIds': sorted(missing)[:200],
        'invalidPhoneUserIds': sorted(invalid)[:200],
        'distinctLoginKeys': len(groups),
        'duplicateGroups': len(duplicates),
        'duplicates': duplicates,
        'legacyAdministratorRows': sum(1 for row in rows if cell(row[2]) == 'admin'),
        'note': ('The employee login key is the normalized contact number. A missing or colliding '
                 'number is a blocker: the migration never generates a number, creates another '
                 'account, or lets an ambiguous key authenticate. The administrator keeps its '
                 'independent account namespace after extraction and has no employee key.'),
    }


def check_organization_roots(client: Mysql) -> dict:
    """Prove a single employee organization root and no dangling/cyclic manager reference."""
    rows = client.rows(
        'SELECT id,role,active,manager_id FROM users ORDER BY id')
    nodes = {row[0]: cell(row[3]) for row in rows
             if cell(row[1]) != 'admin' and str(cell(row[2])) in ('1', 'true', 'True')}
    dangling = sorted(node for node, manager in nodes.items()
                      if manager is not None and manager not in nodes)
    roots = sorted(node for node, manager in nodes.items() if manager is None)

    # Iterative cycle detection over the employee-only manager graph.
    state: dict[str, int] = {}  # 0 unvisited, 1 in progress, 2 done
    cyclic: set[str] = set()
    for start in nodes:
        path, cursor = [], start
        while cursor is not None and cursor in nodes:
            if state.get(cursor) == 1:
                cyclic.update(path[path.index(cursor):])
                break
            if state.get(cursor) == 2:
                break
            state[cursor] = 1
            path.append(cursor)
            cursor = nodes.get(cursor)
        for node in path:
            state[node] = 2

    unique_root = len(roots) == 1 and not dangling and not cyclic
    return {
        'employees': len(nodes),
        'roots': roots,
        'uniqueRoot': unique_root,
        'founderId': roots[0] if unique_root else None,
        'danglingManagerUserIds': dangling[:200],
        'cyclicUserIds': sorted(cyclic)[:200],
        'note': ('The founder is the unique root of the active employee manager tree, never a role '
                 'name or an administrator. Multiple roots, a dangling reference or a cycle mean no '
                 'founder can be proven; the precheck reports it instead of guessing.'),
    }


def check_acceptance_criteria(client: Mysql) -> dict:
    """Historical completion criteria must survive removal from the creation form."""
    if not has_table(client, 'task_versions'):
        return {'note': 'task_versions missing'}
    total = client.scalar('SELECT COUNT(*) FROM task_versions')
    non_empty = client.scalar(
        "SELECT COUNT(*) FROM task_versions "
        "WHERE acceptance_criteria IS NOT NULL AND CHAR_LENGTH(TRIM(acceptance_criteria))>0")
    tasks_with_value = client.scalar(
        'SELECT COUNT(*) FROM (SELECT t.id FROM tasks t JOIN task_versions v '
        'ON v.organization_id=t.organization_id AND v.id=t.current_version_id '
        "WHERE CHAR_LENGTH(TRIM(v.acceptance_criteria))>0) x")
    column_nullable = client.rows(
        "SELECT IS_NULLABLE FROM information_schema.columns WHERE table_schema=DATABASE() "
        "AND table_name='task_versions' AND column_name='acceptance_criteria'")
    return {
        'versions': total,
        'versionsWithValue': non_empty,
        'versionsEmpty': total - non_empty,
        'effectiveTasksWithValue': tasks_with_value,
        'columnNullable': bool(column_nullable and str(column_nullable[0][0]).upper() == 'YES'),
        'note': ('A new task or creation resubmission carries an empty value, because the form no '
                 'longer asks for one. Existing values are preserved and remain editable and '
                 'auditable; nothing is cleared or backfilled empty by the migration.'),
    }


# --------------------------------------------------------------------------- #
# Explicit stable-ID mapping (task 1.4)
# --------------------------------------------------------------------------- #

PLACEMENT_TYPES = ('founder', 'department_head', 'team_head', 'employee')
MAPPING_ID = re.compile(r'[A-Za-z0-9_-]{1,36}')
DEFAULT_MAPPING_REASON = 'Explicit legacy stable-ID organization mapping'


def mapping_schema(client: Mysql) -> dict:
    """Recognise a V20 database and every later structure the mapping has to preserve."""
    placements = has_table(client, 'employee_placements')
    principals = has_table(client, 'principals')
    return {
        'phase': 'v25+' if principals and not has_column(client, 'users', 'username') else ('v22+' if placements and principals else ('v21' if placements else 'v20')),
        'hasPlacements': placements,
        'hasFounderColumn': has_column(client, 'organizations', 'founder_employee_id'),
        'hasPrincipals': principals,
        'hasAdminAccounts': has_table(client, 'admin_accounts'),
        'hasLoginPhone': has_column(client, 'users', 'login_phone'),
        'hasFindings': has_table(client, 'migration_findings'),
    }


def _mapping_blocker(blockers: list[dict], code: str, organization_id: str | None,
                     subject: str | None = None, detail: str = '',
                     related_ids: list[str] | None = None) -> None:
    entry = {'code': code, 'organizationId': organization_id, 'subject': subject,
             'detail': detail, 'relatedIds': list(related_ids or [])}
    if entry not in blockers:
        blockers.append(entry)


def _sql_text(value: str) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def _read_employees(client: Mysql, organization_id: str, schema: dict) -> list[dict]:
    phone = 'u.login_phone' if schema['hasLoginPhone'] else 'NULL'
    manager = 'u.manager_id' if has_column(client, 'users', 'manager_id') else 'NULL'
    if schema['hasPrincipals']:
        rows = client.rows(
            'SELECT u.id,u.active,u.org_version,u.phone,' + phone + ',' + manager + ',u.created_at,'
            'p.account_type,p.active FROM users u JOIN principals p '
            'ON p.organization_id=u.organization_id AND p.id=u.id '
            f"WHERE u.organization_id={_sql_text(organization_id)} ORDER BY u.id")
    else:
        rows = client.rows(
            'SELECT u.id,u.active,u.org_version,u.phone,' + phone + ',u.manager_id,u.created_at,'
            'u.role,NULL FROM users u '
            f"WHERE u.organization_id={_sql_text(organization_id)} ORDER BY u.id")
    employees = []
    for row in rows:
        account_type = cell(row[7])
        if not schema['hasPrincipals']:
            account_type = 'admin' if account_type == 'admin' else 'employee'
        principal_active = cell(row[8])
        employees.append({
            'id': row[0],
            'active': (str(row[1]) in ('1', 'true', 'True')
                       and (principal_active is None
                            or str(cell(principal_active)) in ('1', 'true', 'True'))),
            'rowVersion': int(row[2] or 1),
            'phone': cell(row[3]),
            'loginPhone': cell(row[4]),
            'managerId': cell(row[5]),
            'createdAt': row[6],
            'accountType': account_type,
        })
    return employees


def _read_admins(client: Mysql, organization_id: str, schema: dict) -> list[dict]:
    if schema['hasAdminAccounts']:
        rows = client.rows(
            'SELECT p.id,a.account_name,p.active,a.id IS NOT NULL FROM principals p '
            'LEFT JOIN admin_accounts a ON a.organization_id=p.organization_id AND a.id=p.id '
            f"WHERE p.organization_id={_sql_text(organization_id)} AND p.account_type='admin' "
            'ORDER BY p.id')
        return [{'id': row[0], 'accountName': cell(row[1]),
                 'active': str(cell(row[2])) in ('1', 'true', 'True'),
                 'accountRow': str(cell(row[3])) in ('1', 'true', 'True')} for row in rows]
    if schema['hasPrincipals']:
        rows = client.rows(
            'SELECT id,NULL,active FROM principals '
            f"WHERE organization_id={_sql_text(organization_id)} AND account_type='admin' ORDER BY id")
        return [{'id': row[0], 'accountName': None,
                 'active': str(cell(row[2])) in ('1', 'true', 'True'),
                 'accountRow': False} for row in rows]
    rows = client.rows(
        'SELECT id,username,active FROM users '
        f"WHERE organization_id={_sql_text(organization_id)} AND role='admin' ORDER BY id")
    return [{'id': row[0], 'accountName': cell(row[1]),
             'active': str(cell(row[2])) in ('1', 'true', 'True'),
             'accountRow': False} for row in rows]


def _read_open_findings(client: Mysql, organization_id: str, schema: dict) -> list[dict]:
    if not schema['hasFindings']:
        return []
    rows = client.rows(
        'SELECT migration,category,severity,subject FROM migration_findings '
        f"WHERE organization_id={_sql_text(organization_id)} AND resolved_at IS NULL "
        'ORDER BY migration,category,subject')
    return [{'migration': row[0], 'category': row[1], 'severity': row[2],
             'subject': cell(row[3])} for row in rows]


def _read_company_state(client: Mysql, company: dict, schema: dict) -> dict:
    organization_id = company['id']
    founder = company['founderEmployeeId'] if schema['hasFounderColumn'] else None
    departments = {
        row[0]: {'id': row[0], 'name': row[1], 'rowVersion': int(row[2] or 1)}
        for row in client.rows(
            'SELECT id,name,row_version FROM departments '
            f"WHERE organization_id={_sql_text(organization_id)} ORDER BY id")}
    teams = {
        row[0]: {'id': row[0], 'name': row[1], 'departmentId': cell(row[2]),
                 'rowVersion': int(row[3] or 1)}
        for row in client.rows(
            'SELECT id,name,department_id,row_version FROM teams '
            f"WHERE organization_id={_sql_text(organization_id)} ORDER BY id")}
    positions = {
        row[0]: {'id': row[0], 'name': row[1]}
        for row in client.rows(
            'SELECT id,name FROM positions '
            f"WHERE organization_id={_sql_text(organization_id)} ORDER BY id")}
    placements = {}
    if schema['hasPlacements']:
        for row in client.rows(
                'SELECT employee_id,placement_type,department_id,team_id,position_id,row_version '
                'FROM employee_placements '
                f"WHERE organization_id={_sql_text(organization_id)} ORDER BY employee_id"):
            placements[row[0]] = {
                'employeeId': row[0], 'placementType': row[1],
                'departmentId': cell(row[2]), 'teamId': cell(row[3]),
                'positionId': cell(row[4]), 'rowVersion': int(row[5] or 1)}
    return {
        'organizationId': organization_id,
        'name': company['name'],
        'authzVersion': company['authzVersion'],
        'founderEmployeeId': founder,
        'departments': departments,
        'teams': teams,
        'positions': positions,
        'employees': _read_employees(client, organization_id, schema),
        'admins': _read_admins(client, organization_id, schema),
        'placements': placements,
        'openFindings': _read_open_findings(client, organization_id, schema),
    }


def _legacy_root_analysis(employees: list[dict]) -> dict:
    """Read the legacy manager graph as evidence only; it is never a founder choice."""
    nodes = {row['id']: row['managerId'] for row in employees
             if row['active'] and row['accountType'] == 'employee'}
    dangling = sorted(node for node, manager in nodes.items()
                      if manager is not None and manager not in nodes)
    roots = sorted(node for node, manager in nodes.items() if manager is None)
    state: dict[str, int] = {}
    cyclic: set[str] = set()
    for start in nodes:
        path, cursor = [], start
        while cursor is not None and cursor in nodes:
            if state.get(cursor) == 1:
                cyclic.update(path[path.index(cursor):])
                break
            if state.get(cursor) == 2:
                break
            state[cursor] = 1
            path.append(cursor)
            cursor = nodes.get(cursor)
        for node in path:
            state[node] = 2
    return {
        'roots': roots,
        'danglingManagerIds': dangling,
        'cyclicIds': sorted(cyclic),
        'uniqueRoot': len(roots) == 1 and not dangling and not cyclic,
        'founderInferredFromLegacyGraph': False,
        'note': ('Legacy manager roots are diagnostic only. A founder is accepted only when the '
                 'mapping names it explicitly; a unique root is never promoted silently.'),
    }


def _normalize_mapping_phones(state: dict, entry: dict, blockers: list[dict]) -> dict:
    """Validate the explicit phone -> stable employee ID map and return masked evidence."""
    organization_id = state['organizationId']
    active = [row for row in state['employees']
              if row['active'] and row['accountType'] != 'admin']
    known = {row['id']: row for row in state['employees']}
    raw = entry.get('employees')
    if not isinstance(raw, list):
        _mapping_blocker(blockers, 'EMPLOYEE_PHONE_MAPPING_REQUIRED', organization_id,
                         detail='An explicit employee phone -> stable ID list is required.')
        raw = []
    mapped: dict[str, str | None] = {}
    for item in raw:
        employee_id = item.get('employeeId') if isinstance(item, dict) else None
        if not isinstance(employee_id, str) or not MAPPING_ID.fullmatch(employee_id):
            _mapping_blocker(blockers, 'EMPLOYEE_MAPPING_ENTRY_INVALID', organization_id,
                             detail='Each employee mapping needs a stable employeeId.')
            continue
        if employee_id in mapped:
            _mapping_blocker(blockers, 'EMPLOYEE_MAPPING_DUPLICATE', organization_id,
                             subject=employee_id)
            continue
        employee = known.get(employee_id)
        if employee is None:
            _mapping_blocker(blockers, 'EMPLOYEE_UNKNOWN', organization_id,
                             subject=employee_id,
                             detail='The stable employee ID does not exist in this company.')
            continue
        if employee['accountType'] == 'admin':
            _mapping_blocker(blockers, 'EMPLOYEE_IS_ADMIN', organization_id,
                             subject=employee_id,
                             detail='An administrator principal is not an employee placement.')
        if not employee['active']:
            _mapping_blocker(blockers, 'EMPLOYEE_NOT_ACTIVE', organization_id,
                             subject=employee_id,
                             detail='Only an active employee can be mapped to a login key.')
        phone = item.get('phone')
        normalized = normalize_phone(phone) if isinstance(phone, str) else None
        if normalized is None:
            _mapping_blocker(blockers, 'EMPLOYEE_PHONE_INVALID', organization_id,
                             subject=employee_id,
                             detail='A valid normalized contact number is required; it is never invented.')
        mapped[employee_id] = normalized

    for employee in active:
        employee_id = employee['id']
        if employee_id not in mapped:
            _mapping_blocker(blockers, 'EMPLOYEE_PHONE_MAPPING_MISSING', organization_id,
                             subject=employee_id,
                             detail='Every active employee needs one explicit phone -> stable ID entry.')
            continue
        normalized = mapped[employee_id]
        stored = normalize_phone(employee['loginPhone'] or employee['phone'])
        if stored is None:
            _mapping_blocker(blockers, 'DATABASE_PHONE_MISSING', organization_id,
                             subject=employee_id,
                             detail='The database has no usable login key; the mapping cannot invent one.')
        elif normalized is not None and normalized != stored:
            _mapping_blocker(blockers, 'EMPLOYEE_PHONE_MISMATCH', organization_id,
                             subject=employee_id,
                             detail='The mapped number is not the stored login key; it is never rewritten.')

    groups: dict[str, list[str]] = {}
    for employee in active:
        key = mapped.get(employee['id'])
        if key:
            groups.setdefault(key, []).append(employee['id'])
    stored_groups: dict[str, list[str]] = {}
    for employee in active:
        key = normalize_phone(employee['loginPhone'] or employee['phone'])
        if key:
            stored_groups.setdefault(key, []).append(employee['id'])
    for key, ids in sorted(groups.items()):
        if len(ids) > 1:
            _mapping_blocker(blockers, 'PHONE_DUPLICATE', organization_id,
                             subject=mask_phone(key),
                             detail='The normalized login key is shared by multiple employees.',
                             related_ids=sorted(ids))
    for key, ids in sorted(stored_groups.items()):
        if len(ids) > 1:
            _mapping_blocker(blockers, 'DATABASE_PHONE_DUPLICATE', organization_id,
                             subject=mask_phone(key),
                             detail='The database already shares one normalized login key.',
                             related_ids=sorted(ids))
    return {'employees': [{'employeeId': employee_id, 'phone': mask_phone(phone)}
                          for employee_id, phone in sorted(mapped.items())],
            'keys': {employee_id: phone for employee_id, phone in mapped.items() if phone}}


def _derived_tree(active_ids: set[str], placements: dict[str, dict],
                  department_heads: dict[str, str], team_heads: dict[str, str],
                  founder_id: str | None) -> dict:
    """Derive the fixed four-level manager graph and expose orphan roots or cycles."""
    managers: dict[str, str | None] = {}
    for employee_id in sorted(active_ids):
        placement = placements.get(employee_id)
        if placement is None:
            managers[employee_id] = None
            continue
        placement_type = placement['placementType']
        if placement_type == 'founder':
            managers[employee_id] = None
        elif placement_type == 'department_head':
            managers[employee_id] = founder_id
        elif placement_type == 'team_head':
            managers[employee_id] = department_heads.get(placement['departmentId'])
        elif placement_type == 'employee':
            managers[employee_id] = team_heads.get(placement['teamId'])
        else:
            managers[employee_id] = None
    roots = sorted(node for node, manager in managers.items() if manager is None)
    dangling = sorted(node for node, manager in managers.items()
                      if manager is not None and manager not in managers)
    state: dict[str, int] = {}
    cyclic: set[str] = set()
    for start in managers:
        path, cursor = [], start
        while cursor is not None and cursor in managers:
            if state.get(cursor) == 1:
                cyclic.update(path[path.index(cursor):])
                break
            if state.get(cursor) == 2:
                break
            state[cursor] = 1
            path.append(cursor)
            cursor = managers.get(cursor)
        for node in path:
            state[node] = 2
    return {
        'roots': roots,
        'danglingManagerIds': dangling,
        'cyclicIds': sorted(cyclic),
        'valid': len(roots) == 1 and not dangling and not cyclic,
    }


def _validate_company_mapping(client: Mysql, state: dict, entry: dict, schema: dict) -> dict:
    organization_id = state['organizationId']
    blockers: list[dict] = []
    employees = state['employees']
    known = {row['id']: row for row in employees}
    active = {row['id']: row for row in employees
              if row['active'] and row['accountType'] != 'admin'}
    if schema['hasPrincipals']:
        for employee in employees:
            if employee['accountType'] == 'admin':
                _mapping_blocker(
                    blockers, 'ADMIN_REMAINS_IN_EMPLOYEE_DIRECTORY', organization_id,
                    subject=employee['id'],
                    detail=('A conflicted administrator still occupies a users row, so no complete '
                            'employee plan can be submitted until controlled repair resolves it.'))

    phone_mapping = _normalize_mapping_phones(state, entry, blockers)
    phone_keys = phone_mapping.pop('keys', {})

    # Final department/team coverage is explicit; the plan replaces the complete result.
    mapped_departments: list[str] = []
    raw_departments = entry.get('departments')
    if not isinstance(raw_departments, list):
        _mapping_blocker(blockers, 'DEPARTMENT_MAPPING_REQUIRED', organization_id,
                         detail='The complete final department ID list is required.')
        raw_departments = []
    for item in raw_departments:
        department_id = item if isinstance(item, str) else (
            item.get('id') if isinstance(item, dict) else None)
        if not isinstance(department_id, str) or not MAPPING_ID.fullmatch(department_id):
            _mapping_blocker(blockers, 'DEPARTMENT_ENTRY_INVALID', organization_id,
                             detail='Each department needs a stable ID.')
            continue
        if department_id in mapped_departments:
            _mapping_blocker(blockers, 'DEPARTMENT_DUPLICATE', organization_id,
                             subject=department_id)
            continue
        if department_id not in state['departments']:
            _mapping_blocker(blockers, 'DEPARTMENT_UNKNOWN', organization_id,
                             subject=department_id,
                             detail='The department ID does not exist in this company.')
            continue
        mapped_departments.append(department_id)
    for department_id in sorted(set(state['departments']) - set(mapped_departments)):
        _mapping_blocker(blockers, 'DEPARTMENT_OMITTED', organization_id,
                         subject=department_id,
                         detail='An existing department cannot be dropped by a migration mapping.')

    mapped_teams: dict[str, str] = {}
    raw_teams = entry.get('teams')
    if not isinstance(raw_teams, list):
        _mapping_blocker(blockers, 'TEAM_MAPPING_REQUIRED', organization_id,
                         detail='The complete final team ID/department mapping is required.')
        raw_teams = []
    for item in raw_teams:
        if isinstance(item, str):
            team_id, department_id = item, None
        elif isinstance(item, dict):
            team_id, department_id = item.get('id'), item.get('departmentId')
        else:
            team_id, department_id = None, None
        if not isinstance(team_id, str) or not MAPPING_ID.fullmatch(team_id):
            _mapping_blocker(blockers, 'TEAM_ENTRY_INVALID', organization_id,
                             detail='Each team needs a stable ID.')
            continue
        if team_id in mapped_teams:
            _mapping_blocker(blockers, 'TEAM_DUPLICATE', organization_id, subject=team_id)
            continue
        if team_id not in state['teams']:
            _mapping_blocker(blockers, 'TEAM_UNKNOWN', organization_id, subject=team_id,
                             detail='The team ID does not exist in this company.')
            continue
        if not isinstance(department_id, str) or not MAPPING_ID.fullmatch(department_id):
            _mapping_blocker(blockers, 'TEAM_DEPARTMENT_REQUIRED', organization_id,
                             subject=team_id,
                             detail='Every team must name its final department explicitly.')
            continue
        if department_id not in mapped_departments:
            _mapping_blocker(blockers, 'TEAM_DEPARTMENT_UNKNOWN', organization_id,
                             subject=team_id,
                             detail='The team department is not in the final department list.')
            continue
        mapped_teams[team_id] = department_id
    for team_id in sorted(set(state['teams']) - set(mapped_teams)):
        _mapping_blocker(blockers, 'TEAM_OMITTED', organization_id, subject=team_id,
                         detail='An existing team cannot be dropped by a migration mapping.')

    mapped_placements: dict[str, dict] = {}
    raw_placements = entry.get('placements')
    if not isinstance(raw_placements, list):
        _mapping_blocker(blockers, 'PLACEMENT_MAPPING_REQUIRED', organization_id,
                         detail='One placement for every active employee is required.')
        raw_placements = []
    for item in raw_placements:
        if not isinstance(item, dict):
            _mapping_blocker(blockers, 'PLACEMENT_ENTRY_INVALID', organization_id,
                             detail='Each placement must be an object.')
            continue
        employee_id = item.get('employeeId')
        if not isinstance(employee_id, str) or not MAPPING_ID.fullmatch(employee_id):
            _mapping_blocker(blockers, 'PLACEMENT_ENTRY_INVALID', organization_id,
                             detail='Each placement needs a stable employee ID.')
            continue
        if employee_id in mapped_placements:
            _mapping_blocker(blockers, 'PLACEMENT_DUPLICATE', organization_id,
                             subject=employee_id)
            continue
        employee = known.get(employee_id)
        if employee is None:
            _mapping_blocker(blockers, 'PLACEMENT_EMPLOYEE_UNKNOWN', organization_id,
                             subject=employee_id,
                             detail='The employee ID does not exist in this company.')
            continue
        if employee['accountType'] == 'admin':
            _mapping_blocker(blockers, 'PLACEMENT_EMPLOYEE_IS_ADMIN', organization_id,
                             subject=employee_id,
                             detail='An administrator cannot occupy an employee position.')
        if not employee['active']:
            _mapping_blocker(blockers, 'PLACEMENT_EMPLOYEE_INACTIVE', organization_id,
                             subject=employee_id,
                             detail='An inactive employee has no active placement.')
        placement = {
            'employeeId': employee_id,
            'placementType': item.get('placementType'),
            'departmentId': item.get('departmentId'),
            'teamId': item.get('teamId'),
            'positionId': item.get('positionId'),
        }
        mapped_placements[employee_id] = placement

        placement_type = placement['placementType']
        department_id = placement['departmentId']
        team_id = placement['teamId']
        position_id = placement['positionId']
        if placement_type not in PLACEMENT_TYPES:
            _mapping_blocker(blockers, 'INVALID_PLACEMENT_TYPE', organization_id,
                             subject=employee_id,
                             detail='Only founder/department_head/team_head/employee are legal.')
        if not isinstance(position_id, str) or not position_id:
            _mapping_blocker(blockers, 'POSITION_REQUIRED', organization_id,
                             subject=employee_id,
                             detail='Every placement needs a display position ID.')
        elif position_id not in state['positions']:
            _mapping_blocker(blockers, 'POSITION_UNKNOWN', organization_id,
                             subject=employee_id,
                             detail='The display position does not exist in this company.')
        if department_id is not None and department_id not in mapped_departments:
            _mapping_blocker(blockers, 'PLACEMENT_DEPARTMENT_UNKNOWN', organization_id,
                             subject=employee_id)
        if team_id is not None:
            if team_id not in mapped_teams:
                _mapping_blocker(blockers, 'PLACEMENT_TEAM_UNKNOWN', organization_id,
                                 subject=employee_id)
            elif department_id is not None and mapped_teams[team_id] != department_id:
                _mapping_blocker(blockers, 'TEAM_DEPARTMENT_MISMATCH', organization_id,
                                 subject=employee_id,
                                 detail='The placement team is not in the placement department.')
        if placement_type == 'founder':
            if department_id is not None or team_id is not None:
                _mapping_blocker(blockers, 'FOUNDER_COMPANY_ONLY', organization_id,
                                 subject=employee_id,
                                 detail='The founder is a company-level placement with no unit.')
        elif placement_type == 'department_head':
            if not isinstance(department_id, str) or team_id is not None:
                _mapping_blocker(blockers, 'DEPARTMENT_HEAD_SHAPE', organization_id,
                                 subject=employee_id,
                                 detail='A department head has a department and no team.')
        elif placement_type in ('team_head', 'employee'):
            if not isinstance(department_id, str) or not isinstance(team_id, str):
                _mapping_blocker(blockers, 'TEAM_REQUIRED', organization_id,
                                 subject=employee_id,
                                 detail='A team head/employee needs both department and team.')

    for employee_id in sorted(set(active) - set(mapped_placements)):
        _mapping_blocker(blockers, 'PLACEMENT_REQUIRED', organization_id,
                         subject=employee_id,
                         detail='Every active employee needs exactly one placement.')

    department_heads: dict[str, str] = {}
    team_heads: dict[str, str] = {}
    founders: list[str] = []
    for employee_id, placement in sorted(mapped_placements.items()):
        if placement['placementType'] == 'founder':
            founders.append(employee_id)
        elif placement['placementType'] == 'department_head':
            department_id = placement['departmentId']
            if department_id in department_heads:
                _mapping_blocker(blockers, 'DUPLICATE_DEPARTMENT_HEAD', organization_id,
                                 subject=department_id,
                                 related_ids=[department_heads[department_id], employee_id])
            else:
                department_heads[department_id] = employee_id
        elif placement['placementType'] == 'team_head':
            team_id = placement['teamId']
            if team_id in team_heads:
                _mapping_blocker(blockers, 'DUPLICATE_TEAM_HEAD', organization_id,
                                 subject=team_id,
                                 related_ids=[team_heads[team_id], employee_id])
            else:
                team_heads[team_id] = employee_id
    for department_id in sorted(mapped_departments):
        if department_id not in department_heads:
            _mapping_blocker(blockers, 'DEPARTMENT_HEAD_REQUIRED', organization_id,
                             subject=department_id)
    for team_id in sorted(mapped_teams):
        if team_id not in team_heads:
            _mapping_blocker(blockers, 'TEAM_HEAD_REQUIRED', organization_id,
                             subject=team_id)

    founder_id = entry.get('founderEmployeeId')
    if not isinstance(founder_id, str) or not MAPPING_ID.fullmatch(founder_id):
        _mapping_blocker(blockers, 'FOUNDER_REQUIRED', organization_id,
                         detail='An explicit stable founder employee ID is required; none was inferred.')
    else:
        founder = known.get(founder_id)
        if founder is None:
            _mapping_blocker(blockers, 'FOUNDER_UNKNOWN', organization_id, subject=founder_id,
                             detail='The founder ID does not exist in this company.')
        elif founder['accountType'] == 'admin':
            _mapping_blocker(blockers, 'FOUNDER_IS_ADMIN', organization_id, subject=founder_id)
        elif not founder['active']:
            _mapping_blocker(blockers, 'FOUNDER_INACTIVE', organization_id, subject=founder_id)
        if len(founders) != 1:
            _mapping_blocker(blockers, 'FOUNDER_PLACEMENT_REQUIRED' if not founders
                             else 'FOUNDER_DUPLICATE', organization_id, subject=founder_id,
                             detail='Exactly one company-level founder placement is required.')
        elif founders[0] != founder_id:
            _mapping_blocker(blockers, 'FOUNDER_PLACEMENT_MISMATCH', organization_id,
                             subject=founder_id, related_ids=list(founders),
                             detail='The founder placement and the explicit founder ID differ.')
        if state['founderEmployeeId'] is not None and state['founderEmployeeId'] != founder_id:
            _mapping_blocker(blockers, 'FOUNDER_FIXED_CONFLICT', organization_id,
                             subject=founder_id,
                             detail='The company already has a fixed founder; it cannot be replaced.',
                             related_ids=[state['founderEmployeeId']])

    tree = _derived_tree(set(active), mapped_placements, department_heads, team_heads,
                         founder_id if isinstance(founder_id, str) else None)
    expected_roots = ([founder_id] if isinstance(founder_id, str)
                      and MAPPING_ID.fullmatch(founder_id) else [])
    if tree['roots'] != expected_roots:
        _mapping_blocker(blockers, 'ORPHAN_ROOT', organization_id,
                         subject=founder_id if isinstance(founder_id, str) else None,
                         detail='The derived manager tree must have exactly the explicit founder as root.',
                         related_ids=tree['roots'])
    if tree['danglingManagerIds']:
        _mapping_blocker(blockers, 'ORPHAN_MANAGER', organization_id,
                         detail='A derived manager reference does not resolve to an active employee.',
                         related_ids=tree['danglingManagerIds'])
    if tree['cyclicIds']:
        _mapping_blocker(blockers, 'MANAGEMENT_CYCLE', organization_id,
                         detail='The derived manager graph contains a cycle.',
                         related_ids=tree['cyclicIds'])

    # Existing placements are current facts; a mapping may only fill empty rows or agree with them.
    for employee_id, existing in sorted(state['placements'].items()):
        mapped = mapped_placements.get(employee_id)
        if mapped is None:
            _mapping_blocker(blockers, 'EXISTING_PLACEMENT_OMITTED', organization_id,
                             subject=employee_id,
                             detail='An existing placement cannot be silently removed.')
            continue
        for field in ('placementType', 'departmentId', 'teamId', 'positionId'):
            if mapped[field] != existing[field]:
                _mapping_blocker(blockers, 'EXISTING_PLACEMENT_CONFLICT', organization_id,
                                 subject=employee_id, detail=f'{field} differs from the stored placement.')
                break

    administrator = _validate_admin_mapping(state, entry, blockers)
    for finding in state['openFindings']:
        if finding['migration'] != 'V22':
            continue
        if finding['category'] == 'admin_business_reference':
            _mapping_blocker(blockers, 'ADMIN_BUSINESS_REFERENCE_UNRESOLVED', organization_id,
                             subject=finding['subject'],
                             detail=('An administrator still occupies an employee-only relation; '
                                     'this needs controlled repair and cannot be fixed by the plan.'))
        elif finding['category'] == 'admin_identity_mapping':
            _mapping_blocker(blockers, 'ADMIN_MAPPING_UNRESOLVED', organization_id,
                             detail='The migration left the administrator identity unresolved.')

    legacy = _legacy_root_analysis(employees)
    plan = None
    if not blockers:
        reason = entry.get('reason', None)
        if reason is None:
            reason = DEFAULT_MAPPING_REASON
        if not isinstance(reason, str) or not reason.strip() or len(reason) > 500:
            _mapping_blocker(blockers, 'REASON_INVALID', organization_id,
                             detail='The plan reason must be a non-empty string of at most 500 characters.')
        else:
            plan = {
                'reason': reason.strip(),
                'founderEmployeeId': founder_id,
                'departments': [
                    {'id': department_id,
                     'name': state['departments'][department_id]['name'],
                     'rowVersion': state['departments'][department_id]['rowVersion']}
                    for department_id in sorted(mapped_departments)],
                'teams': [
                    {'id': team_id, 'name': state['teams'][team_id]['name'],
                     'departmentId': mapped_teams[team_id],
                     'rowVersion': state['teams'][team_id]['rowVersion']}
                    for team_id in sorted(mapped_teams)],
                'placements': [],
                'expectedEmployees': [
                    {'id': row['id'], 'rowVersion': row['rowVersion']}
                    for row in sorted(
                        (item for item in employees
                         if schema['hasPrincipals'] or item['accountType'] != 'admin'),
                        key=lambda item: item['id'])],
            }
            for employee_id in sorted(mapped_placements):
                placement = mapped_placements[employee_id]
                payload = {
                    'employeeId': employee_id,
                    'placementType': placement['placementType'],
                    'departmentId': placement['departmentId'],
                    'teamId': placement['teamId'],
                    'positionId': placement['positionId'],
                }
                if employee_id in state['placements']:
                    payload['rowVersion'] = state['placements'][employee_id]['rowVersion']
                plan['placements'].append(payload)

    task_ids = [row[0] for row in client.rows(
        'SELECT id FROM tasks '
        f"WHERE organization_id={_sql_text(organization_id)} ORDER BY id LIMIT 200")]
    preservation = {
        'employeeIds': [row['id'] for row in employees if row['accountType'] == 'employee'],
        'administratorIds': [row['id'] for row in state['admins']],
        'departmentIds': sorted(state['departments']),
        'teamIds': sorted(state['teams']),
        'positionIds': sorted(state['positions']),
        'taskIds': task_ids,
        'note': ('These stable IDs are read from the current database; the mapping plan never '
                 'renumbers or rewrites them. Creation times and original creator IDs are not '
                 'part of the plan and remain untouched.'),
    }
    return {
        'organizationId': organization_id,
        'name': state['name'],
        'status': 'ready' if plan is not None else 'blocked',
        'submittable': plan is not None,
        'companyRowVersion': state['authzVersion'],
        'ifMatch': f'"{state["authzVersion"]}"',
        'plan': plan,
        'blockers': blockers,
        'administrator': administrator,
        'mapping': {
            'founderEmployeeId': founder_id if isinstance(founder_id, str) else None,
            'employees': phone_mapping['employees'],
            'departments': mapped_departments,
            'teams': [{'id': team_id, 'departmentId': mapped_teams[team_id]}
                      for team_id in sorted(mapped_teams)],
            'placements': [mapped_placements[employee_id]
                           for employee_id in sorted(mapped_placements)],
        },
        'state': {
            'founderEmployeeId': state['founderEmployeeId'],
            'employees': len(employees),
            'activeEmployees': len(active),
            'existingPlacements': len(state['placements']),
            'legacyRoots': legacy,
            'derivedTree': tree,
            'openFindings': state['openFindings'],
        },
        'preservation': preservation,
        '_phoneKeys': phone_keys,
    }


def _validate_admin_mapping(state: dict, entry: dict, blockers: list[dict]) -> dict:
    organization_id = state['organizationId']
    admins = state['admins']
    raw = entry.get('administrator')
    admin_id = None
    repair_reason = None
    if isinstance(raw, str):
        admin_id = raw
    elif isinstance(raw, dict):
        admin_id = raw.get('adminId')
        if raw.get('repair'):
            repair_reason = raw.get('repair') if isinstance(raw.get('repair'), str) else 'requested'
    else:
        _mapping_blocker(blockers, 'ADMIN_MAPPING_REQUIRED', organization_id,
                         detail='Map the company to exactly one admin principal/account ID or mark repair.')
        return {'repairRequired': True, 'reason': 'missing mapping'}
    if repair_reason is not None:
        _mapping_blocker(blockers, 'ADMIN_REPAIR_REQUIRED', organization_id,
                         detail='The administrator identity is marked for controlled repair; it is never guessed.',
                         related_ids=[row['id'] for row in admins])
        return {'repairRequired': True, 'reason': repair_reason}
    if not isinstance(admin_id, str) or not MAPPING_ID.fullmatch(admin_id):
        _mapping_blocker(blockers, 'ADMIN_MAPPING_REQUIRED', organization_id,
                         detail='administrator.adminId must be a stable ID.')
        return {'repairRequired': False, 'principalId': None}
    if len(admins) != 1:
        _mapping_blocker(blockers, 'ADMIN_NOT_UNIQUE', organization_id,
                         subject=admin_id,
                         detail='Exactly one independent administrator must exist for the company.',
                         related_ids=[row['id'] for row in admins])
    matches = [row for row in admins if row['id'] == admin_id]
    if not matches:
        _mapping_blocker(blockers, 'ADMIN_NOT_FOUND', organization_id, subject=admin_id,
                         detail='The mapped ID is not a current administrator principal/account.',
                         related_ids=[row['id'] for row in admins])
        return {'repairRequired': False, 'principalId': admin_id}
    admin = matches[0]
    if not admin['active']:
        _mapping_blocker(blockers, 'ADMIN_INACTIVE', organization_id, subject=admin_id)
    if len(admins) == 1 and admins[0]['id'] != admin_id:
        _mapping_blocker(blockers, 'ADMIN_CONFLICT', organization_id, subject=admin_id,
                         related_ids=[admins[0]['id']])
    requested_name = raw.get('accountName') if isinstance(raw, dict) else None
    if requested_name is not None and admin['accountName'] is not None \
            and requested_name != admin['accountName']:
        _mapping_blocker(blockers, 'ADMIN_ACCOUNT_NAME_MISMATCH', organization_id,
                         subject=admin_id,
                         detail='The administrator account name differs from the stored account.')
    return {'repairRequired': False, 'principalId': admin_id,
            'accountName': admin['accountName'],
            'hasIndependentAccountRow': admin['accountRow']}


def mapping_report(client: Mysql, mapping: dict, company_filter: str | None = None) -> dict:
    """Validate caller-supplied stable-ID mappings and emit server-shaped plans.

    Read-only: every database access goes through ``Mysql.rows``. A plan is emitted only for a
    company whose complete final state has no blocker; otherwise ``plan`` is null and the caller
    receives structured blockers. Nothing is written or guessed.
    """
    schema = mapping_schema(client)
    companies = {
        row[0]: {'id': row[0], 'name': row[1], 'authzVersion': int(row[2] or 1),
                 'founderEmployeeId': cell(row[3]) if schema['hasFounderColumn'] else None}
        for row in client.rows(
            'SELECT id,name,authz_version' + (',founder_employee_id' if schema['hasFounderColumn'] else '')
            + ' FROM organizations ORDER BY id')}
    report = {
        'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
        'database': client.database,
        'schema': schema,
        'status': 'blocked',
        'blockers': [],
        'companies': [],
        'unmappedCompanies': [],
        'notes': [
            'The mapping is validated in memory; this command never writes the database or a migration.',
            'Only stable object IDs and masked phone numbers are reported.',
            'An unmapped company is listed for explicit follow-up, never repaired implicitly.',
            'Administrator ambiguity is reported and can be marked repair; it is never resolved by choosing one.',
        ],
    }
    raw_companies = mapping.get('companies') if isinstance(mapping, dict) else None
    if not isinstance(raw_companies, list) or not raw_companies:
        _mapping_blocker(report['blockers'], 'MAPPING_COMPANIES_REQUIRED', None,
                         detail='The mapping file needs a non-empty companies array.')
        return report
    seen: set[str] = set()
    phone_owners: dict[str, list[tuple[str, str]]] = {}
    for entry in raw_companies:
        if not isinstance(entry, dict):
            _mapping_blocker(report['blockers'], 'MAPPING_COMPANY_INVALID', None,
                             detail='Each company mapping must be an object.')
            continue
        organization_id = entry.get('organizationId')
        if not isinstance(organization_id, str) or not MAPPING_ID.fullmatch(organization_id):
            _mapping_blocker(report['blockers'], 'MAPPING_COMPANY_INVALID', None,
                             detail='Each company mapping needs a stable organizationId.')
            continue
        if company_filter and organization_id != company_filter:
            continue
        if organization_id in seen:
            _mapping_blocker(report['blockers'], 'MAPPING_COMPANY_DUPLICATE', organization_id)
            continue
        seen.add(organization_id)
        if organization_id not in companies:
            _mapping_blocker(report['blockers'], 'COMPANY_UNKNOWN', organization_id,
                             detail='The organization ID does not exist in this database.')
            continue
        state = _read_company_state(client, companies[organization_id], schema)
        if 'reason' not in entry and isinstance(mapping.get('reason'), str):
            entry = dict(entry, reason=mapping['reason'])
        company_report = _validate_company_mapping(client, state, entry, schema)
        for employee_id, key in company_report.pop('_phoneKeys', {}).items():
            phone_owners.setdefault(key, []).append((organization_id, employee_id))
        report['companies'].append(company_report)
        for blocker in company_report['blockers']:
            if blocker not in report['blockers']:
                report['blockers'].append(blocker)
    for key, owners in sorted(phone_owners.items()):
        if len({organization_id for organization_id, _employee_id in owners}) <= 1:
            continue
        for organization_id in sorted({owner[0] for owner in owners}):
            employee_ids = sorted(employee_id for owner, employee_id in owners
                                  if owner == organization_id)
            blocker = {'code': 'PHONE_DUPLICATE_ACROSS_COMPANIES',
                       'organizationId': organization_id,
                       'subject': mask_phone(key),
                       'detail': 'The normalized login key is shared across companies.',
                       'relatedIds': employee_ids}
            if blocker not in report['blockers']:
                report['blockers'].append(blocker)
            company_report = next(item for item in report['companies']
                                  if item['organizationId'] == organization_id)
            company_report['blockers'].append(blocker)
            company_report['status'] = 'blocked'
            company_report['submittable'] = False
            company_report['plan'] = None
    report['unmappedCompanies'] = sorted(set(companies) - seen)
    if not report['companies']:
        report['status'] = 'blocked'
    elif not report['blockers'] and all(item['submittable'] for item in report['companies']):
        report['status'] = 'ready'
    return report


def load_mapping(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except OSError as error:
        raise SystemExit(f'cannot read mapping {path}: {error}')
    except json.JSONDecodeError as error:
        raise SystemExit(f'invalid mapping JSON {path}: {error}')
    if not isinstance(data, dict):
        raise SystemExit(f'mapping {path} must be a JSON object')
    return data


def render_mapping(report: dict) -> str:
    lines = [f"# Stable-ID mapping: {report['database']}",
             '',
             f"- Generated: {report['generatedAt']}",
             f"- Schema phase: {report['schema']['phase']}",
             f"- Status: {report['status']}",
             f"- Blockers: {len(report['blockers'])}",
             '']
    for company in report['companies']:
        lines.append(f"## Company {company['organizationId']}")
        lines.append('')
        lines.append(f"- Plan: {'ready (If-Match ' + company['ifMatch'] + ')' if company['submittable'] else 'refused'}")
        lines.append(f"- Employees: {company['state']['employees']} "
                     f"({company['state']['activeEmployees']} active)")
        lines.append(f"- Existing placements: {company['state']['existingPlacements']}")
        lines.append(f"- Legacy manager roots (diagnostic only): "
                     f"{', '.join(company['state']['legacyRoots']['roots']) or '(none)'}")
        if company['administrator'].get('principalId'):
            lines.append(f"- Administrator: {company['administrator']['principalId']}")
        for blocker in company['blockers']:
            subject = f" [{blocker['subject']}]" if blocker.get('subject') else ''
            lines.append(f"- BLOCKER {blocker['code']}{subject}: {blocker['detail']}")
        lines.append('')
    if report.get('unmappedCompanies'):
        lines.append('Unmapped database companies: ' + ', '.join(report['unmappedCompanies']))
        lines.append('')
    return '\n'.join(lines)


def fixed_precheck(client: Mysql) -> dict:
    """Validate the stored fixed model, with no legacy-root or all-staff department assumption."""
    schema=mapping_schema(client)
    companies=[]
    for org,founder in client.rows('SELECT id,founder_employee_id FROM organizations ORDER BY id'):
        employees=_read_employees(client,org,schema)
        admins=_read_admins(client,org,schema)
        placements=[{'employeeId':row[0],'placementType':row[1],'departmentId':cell(row[2]),
                     'teamId':cell(row[3]),'positionId':row[4]} for row in client.rows(
            'SELECT employee_id,placement_type,department_id,team_id,position_id FROM employee_placements WHERE organization_id='+_sql_text(org))]
        companies.append({'organizationId':org,'founderEmployeeId':cell(founder),
            'employees':[{'employeeId':person['id'],'phone':person['loginPhone'] or person['phone']} for person in employees if person['active'] and person['accountType']=='employee'],
            'departments':[row[0] for row in client.rows('SELECT id FROM departments WHERE organization_id='+_sql_text(org))],
            'teams':[{'id':row[0],'departmentId':cell(row[1])} for row in client.rows('SELECT id,department_id FROM teams WHERE organization_id='+_sql_text(org))],
            'placements':placements,
            'administrator':{'adminId':admins[0]['id'],'accountName':admins[0]['accountName']} if len(admins)==1 else {'repair':'Explicit independent administrator required'}})
    report=mapping_report(client,{'companies':companies})
    report['fixedModel']=True
    report['checks']={'workLogs':check_work_logs(client),'requestRoutes':check_request_routes(client),
                      'acceptanceCriteria':check_acceptance_criteria(client)}
    report['limitations']=[]
    return report


def precheck(client: Mysql) -> dict:
    present = tables(client)
    report = {
        'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
        'database': client.database,
        'tables': present,
        'checks': {},
        'blockers': [],
        'limitations': [],
    }
    if 'users' in present and 'principals' in present:
        return fixed_precheck(client)
    if 'users' not in present:
        report['blockers'].append('users table missing: the database is not a Pandora V4 schema')
        return report

    check_checks = {
        'organization': check_organization,
        'workLogs': check_work_logs,
        'assigneeOrder': check_assignee_order,
        'dispatch': check_dispatch,
        'notifications': check_notifications,
        'requestRoutes': check_request_routes,
        'loginIdentity': check_login_identity,
        'organizationRoots': check_organization_roots,
        'acceptanceCriteria': check_acceptance_criteria,
    }
    for name, function in check_checks.items():
        report['checks'][name] = function(client)

    organization = report['checks']['organization']
    work_logs = report['checks']['workLogs']
    assignee_order = report['checks']['assigneeOrder']
    dispatch = report['checks']['dispatch']
    notifications = report['checks']['notifications']

    if organization['usersMissingDepartment'] or organization['usersMissingPosition']:
        report['blockers'].append(
            f"{organization['usersMissingDepartment']} user(s) lack a department and "
            f"{organization['usersMissingPosition']} lack a position; the NOT NULL tightening and "
            'the formal organization write flow stay disabled until an administrator supplies the mapping.')
    if work_logs['duplicateGroups']:
        report['blockers'].append(
            f"{work_logs['duplicateGroups']} duplicate work-log group(s) "
            f"({work_logs['duplicateRows']} rows) must be merged losslessly before the per-day unique key.")
    if assignee_order['rowsMissingOrdinal']:
        report['limitations'].append(
            f"{assignee_order['rowsMissingOrdinal']} assignee row(s) have no provable submission order; "
            'they keep the deterministic compatibility order marked legacy-order-unknown.')
    if dispatch['estimatedOnly']:
        report['limitations'].append(
            f"{dispatch['estimatedOnly']} assignment row(s) only get a legacy-estimate dispatch time.")
    if notifications['unbound']:
        report['limitations'].append(
            f"{notifications['unbound']} notification(s) cannot be bound to an originating request and "
            'stay read-only.')
    if report['checks']['requestRoutes']['expiredPendingCandidates']:
        report['blockers'].append(
            f"{report['checks']['requestRoutes']['expiredPendingCandidates']} pending request(s) are past "
            'their applicable deadline and must be expired, not approved.')
    login = report['checks']['loginIdentity']
    if login['missingPhone']:
        report['blockers'].append(
            f"{login['missingPhone']} active employee(s) have no phone number, so they cannot log in "
            'until an administrator records a real one; the migration never invents a number.')
    if login['invalidPhone']:
        report['blockers'].append(
            f"{login['invalidPhone']} active employee phone number(s) do not normalize to a usable "
            'login key after removing display separators; an administrator must correct them.')
    if login['duplicateGroups']:
        report['blockers'].append(
            f"{login['duplicateGroups']} normalized phone number group(s) are shared by more than one "
            'employee account; ambiguous login keys stay disabled until the administrator resolves them.')
    roots = report['checks']['organizationRoots']
    if not roots['uniqueRoot']:
        report['blockers'].append(
            f"the employee manager tree has {len(roots['roots'])} root(s), "
            f"{len(roots['danglingManagerUserIds'])} dangling manager reference(s) and "
            f"{len(roots['cyclicUserIds'])} cyclic member(s); no founder can be proven and the "
            'creation route stays unavailable until an administrator repairs the organization.')
    else:
        report['limitations'].append(
            "a unique employee organization root was proven; only that founder is exempt from "
            'creation review, and every other creator routes to their direct manager.')
    return report


def render(report: dict) -> str:
    if report.get('fixedModel'):
        return render_mapping(report)
    lines = [f"# Migration precheck: {report['database']}",
             '',
             f"- Generated: {report.get('generatedAt', 'n/a')}",
             f"- Tables: {len(report.get('tables', []))}",
             f"- Blockers: {len(report.get('blockers', []))}",
             f"- Limitations: {len(report.get('limitations', []))}",
             '']
    if report.get('blockers'):
        lines += ['## Blockers', '']
        lines += [f'- {item}' for item in report['blockers']]
        lines += ['']
    if report.get('limitations'):
        lines += ['## Limitations', '']
        lines += [f'- {item}' for item in report['limitations']]
        lines += ['']
    checks = report.get('checks', {})
    if checks:
        lines += ['## Gap summary', '',
                  '| Check | Key figures |', '| --- | --- |']
        organization = checks['organization']
        lines.append(f"| Organization | users missing department {organization['usersMissingDepartment']}, "
                     f"missing position {organization['usersMissingPosition']}, "
                     f"teams missing department {organization['teamsMissingDepartment']} |")
        work_logs = checks['workLogs']
        lines.append(f"| Work logs | total {work_logs['total']}, duplicate groups {work_logs['duplicateGroups']}, "
                     f"duplicate rows {work_logs['duplicateRows']} |")
        order = checks['assigneeOrder']
        lines.append(f"| Assignee order | rows {order['rows']}, missing ordinal {order['rowsMissingOrdinal']}, "
                     f"recoverable {order['orderRecoverableVersions']} |")
        dispatch = checks['dispatch']
        lines.append(f"| Dispatch time | current assignee rows {dispatch['currentAssigneeRows']}, "
                     f"recoverable {dispatch['recoverableFromApprovalTime']}, estimated {dispatch['estimatedOnly']} |")
        notifications = checks['notifications']
        lines.append(f"| Notifications | total {notifications['total']}, bound {notifications['boundToRequest']}, "
                     f"unbound {notifications['unbound']}, unbindable review {notifications['unbindableReviewMessages']} |")
        routes = checks['requestRoutes']
        lines.append(f"| Request routes | pending {routes['pending']}, expired candidates "
                     f"{routes['expiredPendingCandidates']}, direct {routes['direct']} |")
        login = checks['loginIdentity']
        lines.append(f"| Employee login key | active employees {login['activeEmployees']}, missing "
                     f"{login['missingPhone']}, invalid {login['invalidPhone']}, duplicate groups "
                     f"{login['duplicateGroups']}, distinct keys {login['distinctLoginKeys']} |")
        roots = checks['organizationRoots']
        lines.append(f"| Organization roots | employees {roots['employees']}, roots "
                     f"{len(roots['roots'])}, unique {roots['uniqueRoot']}, dangling "
                     f"{len(roots['danglingManagerUserIds'])}, cyclic {len(roots['cyclicUserIds'])} |")
        criteria = checks['acceptanceCriteria']
        lines.append(f"| Acceptance criteria | versions {criteria.get('versions', 0)}, with value "
                     f"{criteria.get('versionsWithValue', 0)}, empty "
                     f"{criteria.get('versionsEmpty', 0)}, effective with value "
                     f"{criteria.get('effectiveTasksWithValue', 0)} |")
        lines.append('')
    return '\n'.join(lines)


# --------------------------------------------------------------------------- #
# Scratch database rehearsal
# --------------------------------------------------------------------------- #

def scratch_name() -> str:
    return SCRATCH_PREFIX + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%d%H%M%S')


def admin_option_file(explicit: Path | None) -> Path:
    if explicit is not None:
        return explicit
    if DEFAULT_OPTION_FILE.exists():
        return DEFAULT_OPTION_FILE
    raise SystemExit(f'missing option file {DEFAULT_OPTION_FILE}; run scripts/start-db.sh first')


def ensure_snapshot(path: Path) -> None:
    if not path.exists():
        raise SystemExit(f'missing snapshot {path}')


def restore(admin: Mysql, database: str, snapshot: Path) -> None:
    ensure_snapshot(snapshot)
    if not re.fullmatch(r'[A-Za-z0-9_]+', database):
        raise SystemExit(f'unsafe database name: {database}')
    if not database.startswith(SCRATCH_PREFIX):
        raise SystemExit(f'refusing to restore into non-scratch database {database}')
    admin.server_side(f'DROP DATABASE IF EXISTS `{database}`')
    admin.server_side(f'CREATE DATABASE `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
    admin.import_sql(snapshot, database)


def drop(admin: Mysql, database: str) -> None:
    if not database.startswith(SCRATCH_PREFIX):
        raise SystemExit(f'refusing to drop non-scratch database {database}')
    admin.server_side(f'DROP DATABASE IF EXISTS `{database}`')


def rehearsal(args: argparse.Namespace) -> int:
    option_file = admin_option_file(args.defaults_file)
    admin = Mysql(None, option_file)
    ensure_snapshot(args.snapshot)
    original = args.original
    original_client = Mysql(original, option_file)

    before = fingerprint(original_client)
    database = args.scratch or scratch_name()
    print(f'[rehearse] restoring {args.snapshot.name} into scratch database {database}')
    restore(admin, database, args.snapshot)
    scratch = Mysql(database, option_file)
    restored = fingerprint(scratch)
    print(f'[rehearse] restored {sum(t["rows"] for t in restored["tables"].values())} rows '
          f'across {len(restored["tables"])} tables')

    report = precheck(scratch)
    after = fingerprint(scratch)
    original_after = fingerprint(original_client)

    report['rehearsal'] = {
        'scratchDatabase': database,
        'snapshot': str(args.snapshot),
        'snapshotDigest': hashlib.sha256(args.snapshot.read_bytes()).hexdigest(),
        'scratchFingerprintBefore': restored['digest'],
        'scratchFingerprintAfterPrecheck': after['digest'],
        'scratchUnchangedByPrecheck': restored['digest'] == after['digest'],
        'originalDatabase': original,
        'originalFingerprintBefore': before['digest'],
        'originalFingerprintAfter': original_after['digest'],
        'originalUnchanged': before['digest'] == original_after['digest'],
        'restoreVerified': len(restored['tables']) > 0,
    }
    report['fingerprint'] = restored

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(f'[rehearse] wrote {args.output}')

    print(render(report))
    print('[rehearse] verification:',
          f"restore={'ok' if report['rehearsal']['restoreVerified'] else 'FAILED'}",
          f"scratch_unchanged={report['rehearsal']['scratchUnchangedByPrecheck']}",
          f"original_unchanged={report['rehearsal']['originalUnchanged']}")
    if not args.keep:
        drop(admin, database)
        print(f'[rehearse] dropped scratch database {database}')
    else:
        print(f'[rehearse] kept scratch database {database}')

    healthy = (report['rehearsal']['restoreVerified']
               and report['rehearsal']['scratchUnchangedByPrecheck']
               and report['rehearsal']['originalUnchanged'])
    return 0 if healthy else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--defaults-file', type=Path, default=None,
                        help='MySQL option file with credentials (default .runtime/mysql-admin.cnf)')
    parser.add_argument('--database', default='pandora', help='target database name')
    parser.add_argument('--json', type=Path, default=None, help='write the JSON report here')
    sub = parser.add_subparsers(dest='command', required=True)

    sub.add_parser('fingerprint', help='print the data fingerprint of one database')
    pre = sub.add_parser('precheck', help='run the read-only gap checks against one database')
    pre.add_argument('--output', type=Path, default=None, help='also write the JSON report here')
    sub.add_parser('tables', help='list base tables')

    mapping = sub.add_parser('mapping', help='validate an explicit stable-ID mapping and build an organization plan')
    mapping.add_argument('--mapping', type=Path, required=True,
                         help='JSON file with explicit company/founder/placement/phone/admin mappings')
    mapping.add_argument('--company', default=None, help='only validate one organization ID')
    mapping.add_argument('--output', type=Path, default=None, help='write the JSON report here')

    restore_parser = sub.add_parser('restore', help='restore the snapshot into a scratch database')
    restore_parser.add_argument('--snapshot', type=Path, default=DEFAULT_SNAPSHOT)
    restore_parser.add_argument('--scratch', default=None, help='scratch database name')

    rehearse = sub.add_parser('rehearse', help='restore the snapshot into a scratch database and precheck it')
    rehearse.add_argument('--snapshot', type=Path, default=DEFAULT_SNAPSHOT)
    rehearse.add_argument('--scratch', default=None, help='scratch database name')
    rehearse.add_argument('--original', default='pandora',
                          help='live database whose fingerprint must stay unchanged')
    rehearse.add_argument('--output', type=Path, default=None, help='write the JSON report here')
    rehearse.add_argument('--keep', action='store_true', help='keep the scratch database')

    args = parser.parse_args(argv)
    option_file = admin_option_file(args.defaults_file)

    if args.command == 'rehearse':
        return rehearsal(args)

    if args.command == 'restore':
        admin = Mysql(None, option_file)
        database = args.scratch or scratch_name()
        restore(admin, database, args.snapshot)
        print(f'restored {args.snapshot} into scratch database {database}')
        return 0

    client = Mysql(args.database, option_file)
    if args.command == 'fingerprint':
        print(json.dumps(fingerprint(client), ensure_ascii=False, indent=2))
        return 0
    if args.command == 'tables':
        print('\n'.join(tables(client)))
        return 0
    if args.command == 'mapping':
        report = mapping_report(client, load_mapping(args.mapping), args.company)
        target = args.output or args.json
        if target:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            print(f'wrote {target}')
        print(render_mapping(report))
        return 0 if report['status'] == 'ready' else 1

    report = precheck(client)
    if args.json or args.output:
        target = args.output or args.json
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(f'wrote {target}')
    print(render(report))
    return 0


if __name__ == '__main__':
    sys.exit(main())
