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
  the creation form (chapter 1.1 / 4.1).

Every phone-derived figure is reported as an object id or a masked number; a full
contact number is never printed.

Every statement issued by ``precheck`` and ``fingerprint`` is a read-only
SELECT/SHOW/DESCRIBE statement; the runner refuses anything else. ``restore`` and
``rehearse`` create a *scratch* database only, never the live one, so the
original database is proven untouched by comparing fingerprints around the run.

Credentials come from the project option file (``.runtime/mysql-admin.cnf``) or a
caller-supplied ``--defaults-file``; they are never printed or passed on the
command line.

Examples
--------
    # Rehearse the whole migration precheck on a throwaway copy of the snapshot
    python3 scripts/migration_precheck.py rehearse

    # Precheck an existing database without touching it
    python3 scripts/migration_precheck.py precheck --database pandora

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
            'SELECT id,organization_id,role,active,NULL AS phone,username FROM users ORDER BY organization_id,id')
    else:
        rows = client.rows(
            'SELECT id,organization_id,role,active,phone,username FROM users ORDER BY organization_id,id')
    employees = [row for row in rows
                 if cell(row[2]) != 'admin' and str(cell(row[3])) in ('1', 'true', 'True')]
    missing, invalid = [], []
    groups: dict[str, list[str]] = {}
    for user_id, organization_id, _role, _active, phone, _username in employees:
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
        'administratorsKeepUsernameLogin': sum(1 for row in rows if cell(row[2]) == 'admin'),
        'note': ('The employee login key is the normalized contact number. A missing or colliding '
                 'number is a blocker: the migration never generates a number, creates another '
                 'account, or lets an ambiguous key authenticate. The administrator keeps its '
                 'original username login and has no employee key.'),
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
