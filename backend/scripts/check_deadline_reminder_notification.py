#!/usr/bin/env python3
"""HTTP verification for sections 5-7: deadlines, proportional reminders and notification lifecycle.

Runs against a real backend and, when the controlled clock and worker endpoints are enabled, advances
time deterministically and drives one worker pass at a time. Every check prints PASS/FAIL and the run
is written as JSON evidence.

    PANDORA_WORKER_ENABLED=true PANDORA_WORKER_DELAY_MS=60000 PANDORA_CLOCK_CONTROLLABLE=true \
      java -jar target/pandora-backend-0.1.0.jar
    python3 scripts/check_deadline_reminder_notification.py --base-url http://127.0.0.1:18100
"""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request
import uuid

RESULTS: list[dict] = []
PASSWORD = "Demo@123456"



# Employees authenticate by phone number (chapter 2.1/2.3); demo accounts keep stable numbers.
DEMO_PHONE = {'upper': '13800000001', 'middle': '13800000002', 'market': '13800000003',
              'employee': '13800000004', 'colleague': '13800000005', 'marketing': '13800000006',
              'admin': 'admin'}


def login_identity(account):
    """Map a demo account name to the phone number it now authenticates with."""
    return DEMO_PHONE.get(account, account)

class Api:
    def __init__(self, base: str):
        self.base = base.rstrip("/")
        self.tokens: dict[str, str] = {}

    def call(self, method, path, token=None, body=None, key=None, if_match=None):
        data = None if body is None else json.dumps(body).encode()
        target = urllib.parse.quote(self.base + path, safe=":/?&=%")
        request = urllib.request.Request(target, data=data, method=method)
        request.add_header("Content-Type", "application/json")
        if token:
            request.add_header("Authorization", "Bearer " + token)
        if key:
            request.add_header("Idempotency-Key", key)
        if if_match:
            request.add_header("If-Match", if_match)
        try:
            with urllib.request.urlopen(request) as response:
                payload = response.read().decode()
                return response.status, (json.loads(payload) if payload else {}), dict(response.headers)
        except urllib.error.HTTPError as error:
            payload = error.read().decode()
            try:
                parsed = json.loads(payload) if payload else {}
            except json.JSONDecodeError:
                parsed = {"raw": payload}
            return error.code, parsed, dict(error.headers)

    def login(self, username):
        status, body, _ = self.call("POST", "/api/v1/auth/sessions",
                                    body={'username': login_identity(username), 'password': PASSWORD})
        if status != 200:
            raise SystemExit(f"login failed for {username}: {status} {body}")
        token = body["token"]
        self.tokens[username] = token
        return token

    @staticmethod
    def key(prefix="check"):
        return prefix + "-" + uuid.uuid4().hex

    @staticmethod
    def etag(body, headers):
        return headers.get("ETag") or '"' + str(body.get("rowVersion")) + '"'


def check(name: str, condition: bool, evidence=None) -> None:
    RESULTS.append({"check": name, "pass": bool(condition), "evidence": evidence})
    print(("PASS  " if condition else "FAIL  ") + name + ("" if condition else f"  -> {evidence}"))


def iso(value: dt.datetime) -> str:
    return value.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "+00:00")


def server_now(api: Api) -> dt.datetime:
    status, body, _ = api.call("GET", "/api/v1/admin/clock", api.tokens["admin"])
    if status != 200:
        raise SystemExit(f"controlled clock unavailable: {status} {body}")
    return dt.datetime.fromisoformat(body["now"].replace("Z", "+00:00"))


def advance(api: Api, seconds: int) -> None:
    status, body, _ = api.call("POST", "/api/v1/admin/clock/advance", api.tokens["admin"], {"seconds": seconds})
    if status != 200:
        raise SystemExit(f"clock advance failed: {status} {body}")


def run_worker(api: Api) -> None:
    status, body, _ = api.call("POST", "/api/v1/admin/worker/run-once", api.tokens["admin"])
    if status != 200:
        raise SystemExit(f"worker run failed: {status} {body}")


def all_notifications(api: Api, username: str) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        status, body, _ = api.call("GET", f"/api/v1/notifications?limit=100&offset={offset}", api.tokens[username])
        if status != 200:
            raise SystemExit(f"notification list failed: {status} {body}")
        rows.extend(body.get("items", []))
        if body.get("nextOffset") is None:
            return rows
        offset = int(body["nextOffset"])


def notification_matches(api: Api, username: str, task_id: str, event_type: str | None = None) -> list[dict]:
    return [row for row in all_notifications(api, username)
            if row.get("taskId") == task_id and (event_type is None or row.get("eventType") == event_type)]


def notification_count(api: Api, username: str, task_id: str, event_type: str) -> int:
    return len(notification_matches(api, username, task_id, event_type))


def users(api: Api, token: str) -> dict[str, dict]:
    status, body, _ = api.call("GET", "/api/v1/users?limit=100", token)
    if status != 200:
        raise SystemExit(f"user directory failed: {status} {body}")
    return {row["username"]: row for row in body["items"]}


def task(api: Api, token: str, task_id: str):
    return api.call("GET", "/api/v1/tasks/" + task_id, token)


def approval(api: Api, token: str, request_id: str):
    return api.call("GET", "/api/v1/approval-requests/" + request_id, token)


def decide(api: Api, token: str, request_id: str, decision="approve", comment="核验通过"):
    status, body, headers = approval(api, token, request_id)
    if status != 200:
        return status, body, headers
    return api.call("PATCH", "/api/v1/approval-requests/" + request_id, token,
                    {"decision": decision, "comment": comment}, api.key("decide"),
                    api.etag(body, headers))


def submit(api: Api, token: str, task_id: str, body: dict, prefix="submit"):
    status, current, headers = task(api, token, task_id)
    if status != 200:
        return status, current, headers
    return api.call("PATCH", "/api/v1/tasks/" + task_id, token, body, api.key(prefix),
                    api.etag(current, headers))


def create_task(api: Api, token: str, title: str, assignees: list[str], start: dt.datetime,
                due: dt.datetime, priority="medium", all_day=False) -> tuple[int, dict]:
    body = {"title": title, "description": "核验任务", "priority": priority, "allDay": all_day, "assigneeIds": assignees,
            "startAt": iso(start), "dueAt": iso(due)}
    status, payload, _ = api.call("POST", "/api/v1/tasks", token, body, api.key("create"))
    return status, payload


def reviewer_token(api: Api, request_id: str) -> str:
    """The account that currently owns this request's decision, resolved from the recorded reviewer.

    Chapter 3.2 routes a creation by the creator's direct manager instead of the creator, so a fixture
    must not assume a fixed role approves it. The reviewer of record is the authority either way.
    """
    candidates = ("upper", "middle", "employee", "colleague", "market", "admin")
    ids = {}
    for name in candidates:
        if name not in api.tokens:
            continue
        status, me_row, _ = api.call("GET", "/api/v1/me", api.tokens[name])
        if status == 200:
            ids[me_row["id"]] = name
    for name in candidates:
        if name not in api.tokens:
            continue
        status, view, _ = api.call("GET", f"/api/v1/approval-requests/{request_id}", api.tokens[name])
        if status == 200:
            reviewer = view.get("currentReviewerId")
            if reviewer in ids:
                return api.tokens[ids[reviewer]]
    return api.tokens["upper"]


def approve_by_reviewer(api: Api, request_id: str, comment="核验通过"):
    return decide(api, reviewer_token(api, request_id), request_id, "approve", comment)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:18100")
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    api = Api(args.base_url)
    for username in ("admin", "upper", "middle", "employee", "colleague", "market"):
        api.login(username)
    ids = {}
    for username, token in api.tokens.items():
        status, me, _ = api.call("GET", "/api/v1/me", token)
        if status == 200:
            ids[username] = me["id"]
    employee = ids["employee"]
    colleague = ids["colleague"]
    middle = ids["middle"]
    upper = ids["upper"]
    today = server_now(api).astimezone(dt.timezone(dt.timedelta(hours=8))).date()

    # ---------------- 5.1 / 5.2: expired submission and decide-time expiry ----------------
    base = server_now(api)
    status, expired_create = create_task(api, api.tokens["middle"], "已过期排期拒绝", [employee],
                                         base - dt.timedelta(hours=2), base - dt.timedelta(hours=1))
    check("5.2 rejects a submission whose proposed deadline already passed", status == 409
          and expired_create.get("code") == "DEADLINE_PASSED", expired_create)
    status, found, _ = api.call("GET", "/api/v1/tasks?q=" + urllib.parse.quote("已过期排期拒绝"), api.tokens["middle"])
    check("5.2 the rejected creation is rolled back and never appears", status == 200 and found.get("total", 0) == 0, found)

    status, created = create_task(api, api.tokens["middle"], "截止前审核任务", [employee],
                                  base + dt.timedelta(minutes=10), base + dt.timedelta(minutes=70))
    deadline_task = created["taskId"]
    deadline_request = created["requestId"]
    status, approved, _ = approve_by_reviewer(api, deadline_request)
    check("5.1 a valid creation is approved before its deadline", status == 200 and approved.get("outcome") == "approved",
          approved)
    status, progress, _ = submit(api, api.tokens["employee"], deadline_task,
                                 {"command": "progress", "progressNote": "开始核验"})
    check("5.1 progress submission succeeds before the effective deadline", status == 200, progress)
    status, request_view, _ = approval(api, api.tokens["middle"], progress["requestId"])
    check("5.1 the request stores an applicable deadline", status == 200 and request_view.get("applicableDeadline"),
          request_view.get("applicableDeadline"))
    advance(api, 71 * 60)
    status, refusal, _ = approve_by_reviewer(api, progress["requestId"])
    check("5.2 decide after the deadline is refused", status == 409 and refusal.get("code") == "REQUEST_EXPIRED", refusal)
    status, expired_request, _ = approval(api, api.tokens["middle"], progress["requestId"])
    check("5.2 the expiry terminal state survives the error response", status == 200
          and expired_request.get("status") == "expired" and expired_request.get("expiredAt"), expired_request.get("status"))
    run_worker(api)
    status, deadline_detail, _ = task(api, api.tokens["middle"], deadline_task)
    check("5.2 expiry unfreezes the task and keeps the pre-submission effective version", status == 200
          and deadline_detail.get("pending") is False and deadline_detail.get("executionState") == "todo",
          deadline_detail.get("pending"))
    check("5.2 expiry notifies the applicant and reviewer", notification_count(api, "employee", deadline_task, "task.progress.expired") >= 1)

    # ---------------- 5.2 submission entries commit expiry before a stale-page error ----------------
    base = server_now(api)
    status, created = create_task(api, api.tokens["middle"], "提交入口失效落库", [employee],
                                  base + dt.timedelta(seconds=20), base + dt.timedelta(seconds=40))
    stale_task = created["taskId"]
    stale_request = created["requestId"]
    _, stale_detail, stale_headers = task(api, api.tokens["middle"], stale_task)
    stale_etag = api.etag(stale_detail, stale_headers)
    advance(api, 41)
    status, stale_submit, _ = api.call("PATCH", "/api/v1/tasks/" + stale_task, api.tokens["middle"],
                                       {"command": "change", "title": "跨截止重提", "reason": "过期页面重提"},
                                       api.key("stale-submit"), stale_etag)
    check("5.2 a submission from a page older than expiry is refused", status == 412,
          {"status": status, "body": stale_submit})
    status, stale_view, _ = approval(api, api.tokens["middle"], stale_request)
    check("5.2 the submission-entry expiry terminal state survives the 4xx",
          status == 200 and stale_view.get("status") == "expired", stale_view.get("status"))
    _, stale_after, _ = task(api, api.tokens["middle"], stale_task)
    check("5.2 the unpublished task stays unpublished and unfrozen after the refusal",
          stale_after.get("published") is False and stale_after.get("pending") is False
          and stale_after.get("frozen") is False
          and (stale_after.get("proposedVersion") or {}).get("executionState") == "todo",
          {key: stale_after.get(key) for key in ("published", "pending", "frozen", "proposedVersion")})
    status, stale_decision, _ = approve_by_reviewer(api, stale_request)
    check("5.2 the expired submission can no longer be approved", status == 409,
          {"status": status, "code": stale_decision.get("code")})

    base = server_now(api)
    status, created = create_task(api, api.tokens["middle"], "交接入口失效落库", [employee],
                                  base + dt.timedelta(seconds=25), base + dt.timedelta(seconds=45))
    handover_task = created["taskId"]
    approve_by_reviewer(api, created["requestId"])
    _, handover_detail, handover_headers = task(api, api.tokens["employee"], handover_task)
    status, first_handover, _ = api.call(
        "POST", "/api/v1/tasks/" + handover_task + "/handover", api.tokens["employee"],
        {"sourceUserId": employee, "targetUserId": colleague, "reason": "交接失效验证"},
        api.key("handover-first"), api.etag(handover_detail, handover_headers))
    check("5.2 a valid handover is pending before the deadline",
          status == 200 and first_handover.get("outcome") == "pending",
          {"status": status, "body": first_handover})
    handover_request = first_handover.get("requestId")
    _, frozen_handover, frozen_headers = task(api, api.tokens["employee"], handover_task)
    frozen_etag = api.etag(frozen_handover, frozen_headers)
    advance(api, 46)
    status, stale_handover, _ = api.call(
        "POST", "/api/v1/tasks/" + handover_task + "/handover", api.tokens["employee"],
        {"sourceUserId": employee, "targetUserId": colleague, "reason": "旧页面重提"},
        api.key("handover-stale"), frozen_etag)
    check("5.2 a handover from a page older than expiry is refused", status == 412,
          {"status": status, "body": stale_handover})
    status, handover_view, _ = approval(api, api.tokens["employee"], handover_request)
    check("5.2 the handover expiry terminal state survives the 4xx",
          status == 200 and handover_view.get("status") == "expired", handover_view.get("status"))
    _, handover_after, _ = task(api, api.tokens["employee"], handover_task)
    check("5.2 the handover expiry unfreezes the still-effective task",
          handover_after.get("pending") is False and handover_after.get("frozen") is False
          and handover_after.get("executionState") == "todo",
          {key: handover_after.get(key) for key in ("pending", "frozen", "executionState")})

    # Worker-driven expiry and exactly-on-deadline boundary.
    base = server_now(api)
    status, created = create_task(api, api.tokens["middle"], "扫描失效任务", [employee],
                                  base + dt.timedelta(minutes=1), base + dt.timedelta(seconds=65))
    worker_task = created["taskId"]
    approve_by_reviewer(api, created["requestId"])
    submit(api, api.tokens["employee"], worker_task, {"command": "progress", "progressNote": "扫描前进展"})
    advance(api, 66)
    run_worker(api)
    status, worker_request, _ = approval(api, api.tokens["middle"], created["requestId"])
    # The creation request's own deadline was 65 seconds; the progress request is the one that expires.
    status_list, list_body, _ = api.call("GET", "/api/v1/approval-requests?mine=reviewer&limit=100", api.tokens["middle"])
    progress_request = next((row for row in list_body.get("items", [])
                             if row.get("taskId") == worker_task and row.get("kind") == "progress"), None)
    check("5.3 the scheduled scan expires a pending request at the deadline", progress_request is not None
          and progress_request.get("status") == "expired", progress_request and progress_request.get("status"))
    check("5.3 the scan backfills one overdue notice for a published unfinished task",
          notification_count(api, "employee", worker_task, "task.overdue") >= 1)
    before = notification_count(api, "employee", worker_task, "task.progress.expired")
    run_worker(api)
    after = notification_count(api, "employee", worker_task, "task.progress.expired")
    check("5.3 repeated scans do not create a duplicate expiry result", before == after and before >= 1, (before, after))

    # ---------------- 5.4: only one terminal state under a deadline race ----------------
    base = server_now(api)
    status, race = create_task(api, api.tokens["middle"], "截止竞争任务", [employee],
                               base + dt.timedelta(seconds=30), base + dt.timedelta(seconds=60))
    race_task = race["taskId"]
    approve_by_reviewer(api, race["requestId"])
    status, race_progress, _ = submit(api, api.tokens["employee"], race_task, {"command": "progress", "progressNote": "竞争前进展"})
    race_progress_request = race_progress["requestId"]
    advance(api, 61)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(lambda _: approve_by_reviewer(api, race_progress_request), range(2)))
    statuses = [status for status, _, _ in outcomes]
    check("5.4 concurrent decisions after the deadline never approve the old request",
          all(status in (409, 412) for status in statuses) and 409 in statuses, statuses)
    status, race_request, _ = approval(api, api.tokens["middle"], race_progress_request)
    check("5.4 the race ends in exactly one expired terminal state", status == 200
          and race_request.get("status") == "expired", race_request.get("status"))
    status, retry, _ = approve_by_reviewer(api, race_progress_request)
    check("5.4 a later retry cannot revive the expired request", status == 409, retry.get("code"))

    # ---------------- 6.1: schedule version and all-day cut-off snapshot ----------------
    status, _, _ = api.call("PUT", "/api/v1/admin/company/off-work-time", api.tokens["admin"],
                            {"offWorkTime": "23:59"}, api.key("cutoff"))
    check("6.1 the administrator can set the company cut-off", status == 200, status)
    tomorrow = today + dt.timedelta(days=1)
    status, all_day, _ = api.call("POST", "/api/v1/tasks", api.tokens["middle"], {
        "title": "全天快照任务", "description": "全天核验", "priority": "medium", "allDay": True, "assigneeIds": [employee],
        "startDate": tomorrow.isoformat(), "dueDate": tomorrow.isoformat()}, api.key("allday"))
    all_day_task = all_day["taskId"]
    approve_by_reviewer(api, all_day["requestId"])
    status, all_day_detail, _ = task(api, api.tokens["middle"], all_day_task)
    cutoff = all_day_detail.get("allDayCutoffTime")
    check("6.1 the new all-day schedule snapshots the configured cut-off", status == 200 and str(cutoff).startswith("23:59"),
          cutoff)
    check("6.1 an all-day task keeps the complete first and last calendar dates", all_day_detail.get("startDate") == tomorrow.isoformat()
          and all_day_detail.get("dueDate") == tomorrow.isoformat())
    before_schedule = all_day_detail.get("scheduleVersion")
    status, change, _ = submit(api, api.tokens["middle"], all_day_task, {"command": "change", "title": "全天快照任务 改名", "reason": "标题核验"})
    approve_by_reviewer(api, change["requestId"])
    status, named, _ = task(api, api.tokens["middle"], all_day_task)
    check("6.1 a non-schedule edit keeps the schedule and cut-off snapshot", named.get("scheduleVersion") == before_schedule
          and str(named.get("allDayCutoffTime")).startswith("23:59"), (before_schedule, named.get("scheduleVersion")))
    status, rescheduled, _ = submit(api, api.tokens["middle"], all_day_task, {
        "command": "change", "startDate": (tomorrow + dt.timedelta(days=1)).isoformat(),
        "dueDate": (tomorrow + dt.timedelta(days=1)).isoformat(), "reason": "排期核验"})
    approve_by_reviewer(api, rescheduled["requestId"])
    status, revised, _ = task(api, api.tokens["middle"], all_day_task)
    check("6.1 a real schedule change increments the schedule version", revised.get("scheduleVersion") == before_schedule + 1,
          (before_schedule, revised.get("scheduleVersion")))
    api.call("PUT", "/api/v1/admin/company/off-work-time", api.tokens["admin"], {"offWorkTime": "18:00"}, api.key("cutoff2"))

    base = server_now(api)
    only_start = base + dt.timedelta(minutes=10)
    only_due = only_start + dt.timedelta(hours=10)
    status, start_only = create_task(api, api.tokens["middle"], "仅改开始时间任务", [employee], only_start, only_due)
    start_only_task = start_only["taskId"]
    approve_by_reviewer(api, start_only["requestId"])
    status, start_before, _ = task(api, api.tokens["middle"], start_only_task)
    status, start_change, _ = submit(api, api.tokens["middle"], start_only_task, {
        "command": "change", "startAt": iso(only_start + dt.timedelta(hours=1)), "reason": "仅开始时间核验"})
    approve_by_reviewer(api, start_change["requestId"])
    status, start_after, _ = task(api, api.tokens["middle"], start_only_task)
    check("6.1 changing only the start time recalculates the schedule version",
          start_after.get("scheduleVersion") == start_before.get("scheduleVersion") + 1
          and start_after.get("dueAt") == start_before.get("dueAt"),
          (start_before.get("scheduleVersion"), start_after.get("scheduleVersion")))

    # ---------------- 6.2 / 6.3: proportional nodes and late scans ----------------
    base = server_now(api)
    start = base + dt.timedelta(seconds=600)
    due = start + dt.timedelta(hours=10)
    status, ten = create_task(api, api.tokens["middle"], "十小时比例提醒", [employee], start, due)
    ten_task = ten["taskId"]
    approve_by_reviewer(api, ten["requestId"])
    run_worker(api)
    check("6.2 no reminder is sent before the first reached node", notification_count(api, "employee", ten_task, "task.reminder_20") == 0)
    advance(api, int((start + dt.timedelta(hours=8) - server_now(api)).total_seconds()) + 2)
    run_worker(api)
    check("6.2 the 20% node fires first for a ten-hour task", notification_count(api, "employee", ten_task, "task.reminder_20") == 1)
    check("6.2 no 90% reminder is produced", notification_count(api, "employee", ten_task, "task.reminder_10") == 0)
    reminder = notification_matches(api, "employee", ten_task, "task.reminder_20")[0]
    status, automatic_withdraw, _ = api.call("POST", "/api/v1/notifications/" + reminder["id"] + "/withdraw",
                                             api.tokens["employee"], {}, api.key("withdraw3"))
    check("7.4 an ordinary recipient cannot withdraw an automatic reminder", status == 403)
    status, admin_withdraw, _ = api.call("POST", "/api/v1/admin/notifications/" + reminder["eventId"] + "/withdraw",
                                         api.tokens["admin"], {"reason": "管理核验"}, api.key("withdraw4"))
    check("7.4 a notification manager can withdraw an automatic reminder", status == 200
          and admin_withdraw.get("withdrawn") is True, admin_withdraw)
    status, non_manager, _ = api.call("GET", "/api/v1/admin/notifications?limit=10", api.tokens["upper"])
    check("7.4 notification administration is denied to ordinary accounts", status == 403)
    status, admin_list, _ = api.call("GET", "/api/v1/admin/notifications?limit=10", api.tokens["admin"])
    check("7.4 the administrator can list notification copies", status == 200 and "items" in admin_list)
    advance(api, int((start + dt.timedelta(hours=9) - server_now(api)).total_seconds()) + 2)
    run_worker(api)
    check("6.2 the 10% node fires next", notification_count(api, "employee", ten_task, "task.reminder_10") == 1)
    advance(api, int((start + dt.timedelta(hours=9, minutes=30) - server_now(api)).total_seconds()) + 2)
    run_worker(api)
    check("6.2 the 5% node fires next", notification_count(api, "employee", ten_task, "task.reminder_5") == 1)
    advance(api, int((due - server_now(api)).total_seconds()) + 2)
    run_worker(api)
    check("6.2 a finished schedule becomes overdue exactly once", notification_count(api, "employee", ten_task, "task.overdue") == 1)
    count_before = notification_count(api, "employee", ten_task, "task.overdue")
    run_worker(api)
    check("6.2 a repeated scan does not repeat the overdue reminder",
          notification_count(api, "employee", ten_task, "task.overdue") == count_before)

    base = server_now(api)
    late_start = base + dt.timedelta(seconds=600)
    late_due = late_start + dt.timedelta(hours=10)
    status, late = create_task(api, api.tokens["middle"], "晚扫描跳节点任务", [employee], late_start, late_due)
    late_task = late["taskId"]
    approve_by_reviewer(api, late["requestId"])
    # First scan at 18:10 local-shaped offset: start + 9h10m.
    advance(api, int((late_start + dt.timedelta(hours=9, minutes=10) - server_now(api)).total_seconds()) + 2)
    run_worker(api)
    check("6.3 a late first scan sends only the nearest reached node (10%)",
          notification_count(api, "employee", late_task, "task.reminder_10") == 1
          and notification_count(api, "employee", late_task, "task.reminder_20") == 0,
          (notification_count(api, "employee", late_task, "task.reminder_10"),
           notification_count(api, "employee", late_task, "task.reminder_20")))
    advance(api, int((late_start + dt.timedelta(hours=9, minutes=20) - server_now(api)).total_seconds()) + 2)
    run_worker(api)
    check("6.3 a second scan does not backfill the skipped 20% node",
          notification_count(api, "employee", late_task, "task.reminder_20") == 0)
    advance(api, int((late_start + dt.timedelta(hours=9, minutes=30) - server_now(api)).total_seconds()) + 2)
    run_worker(api)
    check("6.3 the following 5% node still fires normally",
          notification_count(api, "employee", late_task, "task.reminder_5") == 1)

    base = server_now(api)
    zero_start = base + dt.timedelta(minutes=5)
    status, zero = create_task(api, api.tokens["middle"], "零工期提醒任务", [employee], zero_start, zero_start)
    zero_task = zero["taskId"]
    approve_by_reviewer(api, zero["requestId"])
    advance(api, 6 * 60)
    run_worker(api)
    check("6.3 a zero-duration task sends only one overdue notice",
          notification_count(api, "employee", zero_task, "task.overdue") == 1
          and notification_count(api, "employee", zero_task, "task.reminder_20") == 0)

    # ---------------- 6.4: pending/done/removed exclusions and new-schedule dedupe ----------------
    base = server_now(api)
    pending_start = base + dt.timedelta(seconds=600)
    pending_due = pending_start + dt.timedelta(hours=10)
    status, pending_reminder = create_task(api, api.tokens["middle"], "待审暂停提醒任务", [employee], pending_start, pending_due)
    pending_task = pending_reminder["taskId"]
    approve_by_reviewer(api, pending_reminder["requestId"])
    advance(api, int((pending_start + dt.timedelta(hours=8) - server_now(api)).total_seconds()) + 2)
    status, pending_progress, _ = submit(api, api.tokens["employee"], pending_task, {"command": "progress", "progressNote": "待审期间"})
    run_worker(api)
    check("6.4 a pending request suspends normal reminders",
          notification_count(api, "employee", pending_task, "task.reminder_20") == 0)
    status, withdrawn_progress, _ = decide(api, api.tokens["employee"], pending_progress["requestId"], "withdraw")
    check("6.4 the applicant can withdraw and unfreeze the task", status == 200, withdrawn_progress)
    run_worker(api)
    check("6.4 reminders resume after the withdrawal", notification_count(api, "employee", pending_task, "task.reminder_20") == 1)

    base = server_now(api)
    done_start = base + dt.timedelta(seconds=600)
    done_due = done_start + dt.timedelta(hours=10)
    status, done_reminder = create_task(api, api.tokens["middle"], "完成后不提醒任务", [employee], done_start, done_due)
    done_task = done_reminder["taskId"]
    approve_by_reviewer(api, done_reminder["requestId"])
    status, done_change, _ = submit(api, api.tokens["employee"], done_task, {"command": "complete", "completionNote": "提前完成"})
    approve_by_reviewer(api, done_change["requestId"])
    advance(api, int((done_start + dt.timedelta(hours=8) - server_now(api)).total_seconds()) + 2)
    run_worker(api)
    check("6.4 a completed task gets no proportional reminder",
          notification_count(api, "employee", done_task, "task.reminder_20") == 0)

    base = server_now(api)
    removed_start = base + dt.timedelta(seconds=600)
    removed_due = removed_start + dt.timedelta(hours=10)
    status, sharing = create_task(api, api.tokens["middle"], "移除后不提醒任务", [employee, colleague], removed_start, removed_due)
    sharing_task = sharing["taskId"]
    approve_by_reviewer(api, sharing["requestId"])
    status, remove_assignee, _ = submit(api, api.tokens["middle"], sharing_task, {"command": "change", "assigneeIds": [employee], "reason": "撤权提醒核验"})
    approve_by_reviewer(api, remove_assignee["requestId"])
    advance(api, int((removed_start + dt.timedelta(hours=8) - server_now(api)).total_seconds()) + 2)
    run_worker(api)
    check("6.4 a removed recipient does not receive a new reminder",
          notification_count(api, "colleague", sharing_task, "task.reminder_20") == 0
          and notification_count(api, "employee", sharing_task, "task.reminder_20") == 1)

    base = server_now(api)
    schedule_start = base + dt.timedelta(seconds=600)
    schedule_due = schedule_start + dt.timedelta(hours=10)
    status, reschedule_reminder = create_task(api, api.tokens["middle"], "新排期重新去重任务", [employee], schedule_start, schedule_due)
    reschedule_task = reschedule_reminder["taskId"]
    approve_by_reviewer(api, reschedule_reminder["requestId"])
    advance(api, int((schedule_start + dt.timedelta(hours=8) - server_now(api)).total_seconds()) + 2)
    run_worker(api)
    first_schedule_count = notification_count(api, "employee", reschedule_task, "task.reminder_20")
    base = server_now(api)
    new_start = base + dt.timedelta(hours=2)
    new_due = new_start + dt.timedelta(hours=10)
    status, reschedule, _ = submit(api, api.tokens["middle"], reschedule_task, {
        "command": "change", "startAt": iso(new_start), "dueAt": iso(new_due), "reason": "新排期去重"})
    approve_by_reviewer(api, reschedule["requestId"])
    advance(api, int((new_start + dt.timedelta(hours=8) - server_now(api)).total_seconds()) + 2)
    run_worker(api)
    check("6.4 a new effective schedule gets its own reminder identity",
          first_schedule_count == 1 and notification_count(api, "employee", reschedule_task, "task.reminder_20") == 2)

    # Reopen creates a new execution round, so the same schedule fires its own nodes again.
    base = server_now(api)
    reopen_start = base + dt.timedelta(seconds=600)
    reopen_due = reopen_start + dt.timedelta(hours=10)
    status, reopen_fixture = create_task(api, api.tokens["middle"], "重开轮次提醒去重任务", [employee], reopen_start, reopen_due)
    reopen_task = reopen_fixture["taskId"]
    approve_by_reviewer(api, reopen_fixture["requestId"])
    advance(api, int((reopen_start + dt.timedelta(hours=8) - server_now(api)).total_seconds()) + 2)
    run_worker(api)
    first_round = notification_count(api, "employee", reopen_task, "task.reminder_20")
    status, completion, _ = submit(api, api.tokens["employee"], reopen_task, {"command": "complete", "completionNote": "第一轮完成"})
    approve_by_reviewer(api, completion["requestId"])
    status, reopened, _ = submit(api, api.tokens["middle"], reopen_task, {
        "command": "reopen", "reason": "第二轮核验", "allDay": False,
        "startAt": iso(reopen_start), "dueAt": iso(reopen_due)})
    status, reopened_result, _ = approve_by_reviewer(api, reopened["requestId"])
    run_worker(api)
    check("6.4 a reopen creates a new round with its own reminder identity",
          first_round == 1 and status == 200 and notification_count(api, "employee", reopen_task, "task.reminder_20") == 2,
          (first_round, status, notification_count(api, "employee", reopen_task, "task.reminder_20")))

    # ---------------- 7: event matrix, notification lifecycle and historical access ----------------
    base = server_now(api)
    status, matrix = create_task(api, api.tokens["middle"], "通知矩阵任务", [employee],
                                 base + dt.timedelta(hours=1), base + dt.timedelta(days=2), priority="high")
    matrix_task = matrix["taskId"]
    create_request = matrix["requestId"]
    run_worker(api)
    check("7.1 an unpublished creation notifies the applicant and reviewer only",
          notification_count(api, "middle", matrix_task, "task.create.submitted") >= 1
          and notification_count(api, "employee", matrix_task, "task.create.submitted") == 0)
    approve_by_reviewer(api, create_request)
    run_worker(api)
    check("7.1 creation approval notifies the task people", notification_count(api, "employee", matrix_task,
                                                                               "task.create.approved") >= 1)
    status, self_dedupe = create_task(api, api.tokens["middle"], "自通知去重任务", [employee],
                                      server_now(api) + dt.timedelta(hours=1), server_now(api) + dt.timedelta(days=2))
    self_task = self_dedupe["taskId"]
    approve_by_reviewer(api, self_dedupe["requestId"])
    status, self_change, _ = submit(api, api.tokens["middle"], self_task, {
        "command": "change", "description": "自通知去重核验", "reason": "自通知"})
    run_worker(api)
    check("7.1 one event delivers once even when applicant and reviewer are the same identity",
          notification_count(api, "middle", self_task, "task.change.submitted") == 1
          and notification_count(api, "employee", self_task, "task.change.submitted") == 0)
    approve_by_reviewer(api, self_change["requestId"])

    status, change, _ = submit(api, api.tokens["middle"], matrix_task, {
        "command": "change", "title": "通知矩阵任务 已更新", "priority": "urgent",
        "assigneeIds": [employee, colleague], "reason": "多字段核验"})
    run_worker(api)
    change_request = change["requestId"]
    check("7.1 a published submission notifies only the reviewer", notification_count(api, "middle", matrix_task,
                                                                                    "task.change.submitted") >= 1
          and notification_count(api, "employee", matrix_task, "task.change.submitted") == 0)
    approve_by_reviewer(api, change_request)
    run_worker(api)
    approved_rows = notification_matches(api, "employee", matrix_task, "task.change.approved")
    check("7.1 one event carries one actual multi-field summary", len(approved_rows) == 1
          and "标题" in (approved_rows[0].get("changeSummary") or "")
          and "紧急程度" in (approved_rows[0].get("changeSummary") or ""),
          approved_rows[0].get("changeSummary") if approved_rows else None)
    check("7.1 the new assignee receives the applied change", notification_count(api, "colleague", matrix_task,
                                                                                 "task.change.approved") >= 1)

    # Removing an assignee keeps a delivered read-only historical entry for that person.
    status, removal, _ = submit(api, api.tokens["middle"], matrix_task, {
        "command": "change", "assigneeIds": [employee], "reason": "移除负责人核验"})
    approve_by_reviewer(api, removal["requestId"])
    run_worker(api)
    removed_rows = notification_matches(api, "colleague", matrix_task, "task.change.approved")
    removed_row = next((row for row in removed_rows if row.get("relationLost")), None)
    check("7.2 a removed assignee receives a delivered read-only summary", removed_row is not None)
    status, old_task, _ = task(api, api.tokens["colleague"], matrix_task)
    check("7.2 the removed assignee loses normal task access", status == 404)
    status, history_task, _ = api.call("GET", "/api/v1/notifications/" + removed_row["id"] + "/task",
                                       api.tokens["colleague"]) if removed_row else (0, {}, {})
    check("7.6 the dedicated historical DTO is read-only and shows the revocation",
          status == 200 and history_task.get("readonly") is True and history_task.get("accessRevoked") is True,
          status)
    check("7.6 the historical DTO leaks no proposal, diff, phone or log",
          not {"proposedVersion", "diff", "phone", "records", "logs"}.intersection(history_task))
    status, ticket_task, _ = api.call("GET", "/api/v1/tasks?q=" + urllib.parse.quote("通知矩阵任务"),
                                      api.tokens["colleague"])
    check("7.6 historical access does not rejoin normal task lists", status == 200
          and all(row.get("id") != matrix_task for row in ticket_task.get("items", [])))

    # Open-as-read and original-request binding.
    employee_rows = notification_matches(api, "employee", matrix_task, "task.create.approved")
    open_row = employee_rows[0]
    status, before_list, _ = api.call("GET", "/api/v1/notifications?limit=100", api.tokens["employee"])
    unread_before = before_list.get("unreadCount")
    status, opened, _ = api.call("POST", "/api/v1/notifications/" + open_row["id"] + "/open",
                                 api.tokens["employee"], key=api.key("open"))
    check("7.3 opening a message marks it read and refreshes the unread count",
          status == 200 and opened.get("readAt") and opened.get("unreadCount") == unread_before - 1,
          (unread_before, opened.get("unreadCount")))
    status, opened_again, _ = api.call("POST", "/api/v1/notifications/" + open_row["id"] + "/open",
                                        api.tokens["employee"], key=api.key("open2"))
    check("7.3 opening is idempotent", status == 200 and opened_again.get("readAt") == opened.get("readAt"))
    status, unchanged, _ = api.call("GET", "/api/v1/notifications?limit=100", api.tokens["employee"])
    check("7.3 a list GET does not change read state", unchanged.get("unreadCount") == opened.get("unreadCount"))
    old_submitted = notification_matches(api, "middle", matrix_task, "task.create.submitted")[0]
    check("7.3 an old review message keeps its own completed request", old_submitted.get("requestId") == create_request
          and old_submitted.get("requestStatus") == "approved" and old_submitted.get("canReview") is False,
          (old_submitted.get("requestId"), old_submitted.get("requestStatus")))

    # Withdrawal window and placeholder.
    base = server_now(api)
    status, withdraw_change, _ = submit(api, api.tokens["middle"], matrix_task, {
        "command": "change", "description": "撤回窗口核验", "reason": "撤回窗口"})
    run_worker(api)
    withdraw_notice = notification_matches(api, "middle", matrix_task, "task.change.submitted")[0]
    advance(api, 179)
    status, withdrawn, _ = api.call("POST", "/api/v1/notifications/" + withdraw_notice["id"] + "/withdraw",
                                    api.tokens["middle"], {"reason": "核验撤回"}, api.key("withdraw"))
    check("7.4 a business initiator can withdraw strictly before 180 seconds", status == 200
          and withdrawn.get("withdrawn") is True, withdrawn)
    status, placeholder, _ = api.call("GET", "/api/v1/notifications/" + withdraw_notice["id"], api.tokens["middle"])
    check("7.4 withdrawal keeps a placeholder without body or jump", status == 200
          and placeholder.get("revoked") is True and placeholder.get("taskId") is None
          and placeholder.get("summary") == "该通知已被撤回。", placeholder)
    status, after_withdraw_task, _ = task(api, api.tokens["middle"], matrix_task)
    check("7.4 withdrawal does not change the business task", status == 200)

    # The second event is withdrawn after the closed window.
    status, closed_change, _ = submit(api, api.tokens["middle"], matrix_task, {
        "command": "change", "description": "180秒边界核验", "reason": "边界"})
    run_worker(api)
    closed_notice = notification_matches(api, "middle", matrix_task, "task.change.submitted")[0]
    advance(api, 180)
    status, closed, _ = api.call("POST", "/api/v1/notifications/" + closed_notice["id"] + "/withdraw",
                                 api.tokens["middle"], {"reason": "过期"}, api.key("withdraw2"))
    check("7.4 a 180-second-old event can no longer be withdrawn", status == 409
          and closed.get("code") == "WITHDRAW_WINDOW_CLOSED", closed)

    # Personal delete isolation.
    shared = notification_matches(api, "employee", matrix_task, "task.change.approved")[0]
    status, deleted, _ = api.call("PATCH", "/api/v1/notifications/" + shared["id"], api.tokens["employee"],
                                  {"action": "delete"}, api.key("delete"), '"' + str(shared["rowVersion"]) + '"')
    check("7.4 a recipient can delete only their own copy", status == 200)
    status, own_after_delete, _ = api.call("GET", "/api/v1/notifications/" + shared["id"], api.tokens["employee"])
    check("7.4 a personally deleted copy is gone for that recipient", status == 404)
    check("7.4 the other recipients still hold their copies", notification_count(api, "middle", matrix_task,
                                                                                 "task.change.approved") >= 1)
    status, deleted_history, _ = api.call("GET", "/api/v1/notifications/" + shared["id"] + "/task",
                                          api.tokens["employee"])
    check("7.5 a personally deleted message cannot be used as a historical entry", status == 404)

    # Retention and history preservation.
    status, timed_notice, _ = api.call("GET", "/api/v1/notifications?limit=100", api.tokens["employee"])
    expiring = next((row for row in timed_notice.get("items", []) if row.get("expiresAt")), None)
    check("7.1 notification copies carry an explicit retention instant", expiring is not None)
    status, history_before, _ = api.call("GET", "/api/v1/admin/tasks/" + matrix_task + "/history", api.tokens["admin"])
    entries_before = len(history_before.get("entries", []))
    if expiring:
        target = dt.datetime.fromisoformat(expiring["expiresAt"].replace("Z", "+00:00"))
        seconds = max(1, int((target - server_now(api)).total_seconds()) + 1)
        advance(api, seconds)
        status, at_expiry, _ = api.call("GET", "/api/v1/notifications/" + expiring["id"], api.tokens["employee"])
        check("7.5 the read interface rejects a message at/after its retention instant without waiting for cleanup",
              status == 404, status)
    advance(api, 93 * 24 * 3600)
    run_worker(api)
    status, expired_read, _ = api.call("GET", "/api/v1/notifications/" + expiring["id"], api.tokens["employee"]) if expiring else (0, {}, {})
    check("7.5 a message past three calendar months is no longer readable", status == 404, status)
    status, history_after, _ = api.call("GET", "/api/v1/admin/tasks/" + matrix_task + "/history", api.tokens["admin"])
    before_ids = {row["id"] for row in history_before.get("entries", [])}
    after_ids = {row["id"] for row in history_after.get("entries", [])}
    check("7.8 retention cleanup keeps the complete task history",
          status == 200 and entries_before > 0 and before_ids <= after_ids,
          (entries_before, len(history_after.get("entries", []))))
    status, still_task, _ = task(api, api.tokens["middle"], matrix_task)
    check("7.8 retention cleanup keeps the effective task", status == 200)

    # 7.1 reassignment event: an organization change moves the reviewer of record and notifies both sides.
    base = server_now(api)
    status, reassign_fixture = create_task(api, api.tokens["middle"], "改派事件任务", [employee],
                                           base + dt.timedelta(hours=1), base + dt.timedelta(days=2))
    reassign_task = reassign_fixture["taskId"]
    approve_by_reviewer(api, reassign_fixture["requestId"])
    status, reassign_pending, _ = submit(api, api.tokens["middle"], reassign_task, {
        "command": "change", "title": "改派事件任务 待审", "reason": "改派核验"})
    status, employee_row, employee_headers = api.call("GET", "/api/v1/admin/employees/" + employee, api.tokens["admin"])
    status, moved, _ = api.call("PATCH", "/api/v1/admin/employees/" + employee, api.tokens["admin"],
                                {"managerId": upper}, api.key("reassign-manager"),
                                api.etag(employee_row, employee_headers))
    check("7.1 an organization change is accepted for a pending request", status == 200, moved)
    for username in ("admin", "upper", "middle", "employee", "colleague", "market"):
        api.login(username)
    status, reassigned_request, _ = approval(api, api.tokens["upper"], reassign_pending["requestId"])
    check("7.1 the pending request moves to the new reviewer of record",
          status == 200 and reassigned_request.get("currentReviewerId") == upper,
          reassigned_request.get("currentReviewerId"))
    run_worker(api)
    check("7.1 the reassignment event reaches the new reviewer",
          notification_count(api, "upper", reassign_task, "task.change.reassigned") == 1)
    status, reassign_history, _ = api.call("GET", "/api/v1/admin/tasks/" + reassign_task + "/history", api.tokens["admin"])
    reassignments = reassign_history.get("reassignments", [])
    check("7.1 the reassignment keeps previous/new reviewer and source",
          status == 200 and any(row.get("previousReviewerId") == middle and row.get("newReviewerId") == upper
                                and row.get("source") == "organization_change" for row in reassignments),
          reassignments)

    # ---------------- 7.2 ordinary undelivered event losing authority (V-001) ----------------
    _, before_list, _ = api.call("GET", "/api/v1/notifications?limit=100", api.tokens["employee"])
    known_ids = {row["id"] for row in before_list.get("items", [])}
    base = server_now(api)
    status, created = create_task(api, api.tokens["middle"], "E13 confidential undelivered title", [employee],
                                  base + dt.timedelta(minutes=5), base + dt.timedelta(minutes=65))
    undelivered_task = created["taskId"]
    # The earlier reassignment scenario moved the employee to the upper chain, so resolve the actual
    # reviewer of record instead of assuming the original manager.
    _, create_view, _ = approval(api, api.tokens["middle"], created["requestId"])
    create_reviewer = api.tokens["upper"] if create_view.get("currentReviewerId") == upper else api.tokens["middle"]
    status, approved_create, _ = decide(api, create_reviewer, created["requestId"])
    check("7.2 the ordinary create notice is queued before the owner changes",
          status == 200 and approved_create.get("outcome") == "approved",
          {"status": status, "body": approved_create})
    status, changed, _ = submit(api, api.tokens["middle"], undelivered_task,
                                {"command": "change", "title": "E13 reassigned visible title",
                                 "assigneeIds": [colleague], "reason": "改派后失权"})
    check("7.2 the ordinary create notification is still queued when the owner changes",
          status == 200 and changed.get("outcome") == "pending", changed)
    approve_by_reviewer(api, changed["requestId"])
    status, _after_removal, _ = task(api, api.tokens["employee"], undelivered_task)
    check("7.2 the removed owner can no longer read the task", status == 404, status)
    run_worker(api)
    _, after_list, _ = api.call("GET", "/api/v1/notifications?limit=100", api.tokens["employee"])
    fresh = [row for row in after_list.get("items", []) if row["id"] not in known_ids]
    masked = [row for row in fresh if row.get("eventType") == "task.create.approved"]
    check("7.2 the undelivered ordinary notice keeps no restricted title or change summary",
          len(masked) == 1 and masked[0].get("taskId") is None and masked[0].get("title") is None
          and masked[0].get("changeSummary") is None and masked[0].get("requestId") is None
          and masked[0].get("requestStatus") is None and masked[0].get("canOpenTask") is False
          and "E13" not in json.dumps(masked[0], ensure_ascii=False),
          masked)
    if masked:
        status, masked_detail, _ = api.call("GET", "/api/v1/notifications/" + masked[0]["id"], api.tokens["employee"])
        check("7.2 the message detail cannot refill restricted content from the event",
              status == 200 and masked_detail.get("title") is None and masked_detail.get("changeSummary") is None
              and masked_detail.get("taskId") is None and masked_detail.get("requestId") is None,
              masked_detail)
        status, historical, _ = api.call("GET", "/api/v1/notifications/" + masked[0]["id"] + "/task",
                                         api.tokens["employee"])
        check("7.2 the undelivered copy grants no historical task entry", status in (404, 409),
              {"status": status, "body": historical})
        status, opened, _ = api.call("POST", "/api/v1/notifications/" + masked[0]["id"] + "/open",
                                     api.tokens["employee"], {}, api.key("open-masked"))
        check("7.2 the read response repeats no restricted content",
              status == 200 and "E13" not in json.dumps(opened, ensure_ascii=False)
              and "title" not in opened and "changeSummary" not in opened,
              opened)
    removal = [row for row in fresh
               if row.get("eventType") == "task.change.approved" and row.get("relationLost") is True]
    check("7.2 a real removal event still keeps its read-only summary",
          len(removal) == 1 and removal[0].get("title") == "E13 reassigned visible title", removal)

    report = {"success": all(row["pass"] for row in RESULTS), "checksPassed": sum(1 for row in RESULTS if row["pass"]),
              "checksFailed": sum(1 for row in RESULTS if not row["pass"]), "checks": RESULTS}
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(("PASS" if report["success"] else "FAIL") + f": {report['checksPassed']} passed, {report['checksFailed']} failed")
    return 0 if report["success"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
