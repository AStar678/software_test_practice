#!/usr/bin/env python3
"""HTTP verification for section 9: dispatch-time ordering, home shape, search, pins and pending kind.

Runs against a freshly seeded database. Creates a few uniquely titled tasks; the test database is
disposable. No credentials are written to the report.

    python3 scripts/check_home_calendar.py --base-url http://127.0.0.1:18130
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

RESULTS: list[dict] = []
PASSWORD = "Demo@123456"
RUN = uuid.uuid4().hex[:8]


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
                                    body={"username": username, "password": PASSWORD})
        if status != 200:
            raise SystemExit(f"login failed for {username}: {status} {body}")
        self.tokens[username] = body["token"]
        return body["token"]

    def re_login(self):
        for username in list(self.tokens):
            self.login(username)

    @staticmethod
    def key(prefix="section9"):
        return prefix + "-" + uuid.uuid4().hex

    @staticmethod
    def etag(body, headers):
        return headers.get("ETag") or '"' + str(body.get("rowVersion")) + '"'


def check(name: str, condition: bool, evidence=None) -> None:
    RESULTS.append({"check": name, "pass": bool(condition), "evidence": evidence})
    print(("PASS  " if condition else "FAIL  ") + name + ("" if condition else f"  -> {evidence}"))


def iso(hours: int) -> str:
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=hours)).isoformat()


def ids_of(body):
    return {row.get("id") for row in body.get("items", [])}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:18130")
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    api = Api(args.base_url)
    code = 1
    try:
        for username in ("admin", "upper", "middle", "employee", "colleague", "market"):
            api.login(username)
        ids = {}
        for username in api.tokens:
            status, me, _ = api.call("GET", "/api/v1/me", api.tokens[username])
            if status == 200:
                ids[username] = me["id"]
        employee = ids["employee"]
        colleague = ids["colleague"]

        def approve(request_id: str) -> None:
            status, request, headers = api.call("GET", "/api/v1/approval-requests/" + request_id, api.tokens["middle"])
            if status != 200:
                raise SystemExit(f"approval read failed: {status} {request}")
            status, body, _ = api.call("PATCH", "/api/v1/approval-requests/" + request_id, api.tokens["middle"],
                                       {"decision": "approve", "comment": "section9 fixture"}, api.key(), Api.etag(request, headers))
            if status != 200:
                raise SystemExit(f"approval failed: {status} {body}")

        def create(title: str, owners: list[str]) -> str:
            body = {"title": title, "description": "section9", "acceptanceCriteria": "check",
                    "priority": "medium", "allDay": False, "assigneeIds": owners,
                    "startAt": iso(1), "dueAt": iso(48)}
            status, result, _ = api.call("POST", "/api/v1/tasks", api.tokens["upper"], body, api.key("create"))
            if status != 201:
                raise SystemExit(f"create failed: {status} {result}")
            if result.get("requestId"):
                status, request, _ = api.call("GET", "/api/v1/approval-requests/" + result["requestId"], api.tokens["middle"])
                if status == 200 and request.get("status") == "pending":
                    approve(result["requestId"])
            return result["taskId"]

        def change(task_id: str, owners: list[str]) -> None:
            status, task, headers = api.call("GET", "/api/v1/tasks/" + task_id, api.tokens["upper"])
            if status != 200:
                raise SystemExit(f"task read failed: {status} {task}")
            status, result, _ = api.call("PATCH", "/api/v1/tasks/" + task_id, api.tokens["upper"],
                                         {"command": "change", "assigneeIds": owners, "reason": "section9 reorder"},
                                         api.key("change"), Api.etag(task, headers))
            if status != 200:
                raise SystemExit(f"change failed: {status} {result}")
            if result.get("requestId"):
                status, request, _ = api.call("GET", "/api/v1/approval-requests/" + result["requestId"], api.tokens["middle"])
                if status == 200 and request.get("status") == "pending":
                    approve(result["requestId"])

        def home_rows():
            status, home, _ = api.call("GET", "/api/v1/home", api.tokens["employee"])
            if status != 200:
                raise SystemExit(f"home failed: {status} {home}")
            return home.get("assignedTasks", [])

        def assigned_at(task_id: str):
            row = next((row for row in home_rows() if row.get("taskId") == task_id), None)
            return row.get("assignedAt") if row else None

        first = create("S9 old assignment " + RUN, [employee, colleague])
        time.sleep(0.05)
        second = create("S9 new assignment " + RUN, [employee])
        rows = home_rows()
        order = [row.get("taskId") for row in rows]
        check("9.1 a newly dispatched task ranks before the older assignment",
              second in order and first in order and order.index(second) < order.index(first), order)
        check("9.1 home limits to ten and carries assignment metadata",
              len(rows) <= 10 and all({"taskId", "title", "priority", "assignedAt", "assignedSource"} <= set(row) for row in rows), rows)

        old_at = assigned_at(first)
        change(first, [colleague, employee])
        after_reorder = assigned_at(first)
        check("9.1 reordering owners does not reset the dispatch time", after_reorder == old_at,
              {"before": old_at, "after": after_reorder})

        change(first, [colleague])
        time.sleep(0.05)
        change(first, [colleague, employee])
        readded = assigned_at(first)
        check("9.1 removing and re-adding an owner creates a new dispatch time",
              readded is not None and old_at is not None and readded > old_at,
              {"before": old_at, "readded": readded})
        rows = home_rows()
        order = [row.get("taskId") for row in rows]
        check("9.1 the re-added task returns to the top", first in order and order.index(first) < order.index(second), order)

        status, home, _ = api.call("GET", "/api/v1/home", api.tokens["employee"])
        logs = home.get("recentLogs", [])
        company_today = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
        log_dates = [dt.date.fromisoformat(log["businessDate"]) for log in logs if log.get("businessDate")]
        check("9.2 recent logs are limited and inside the ten-day window",
              status == 200 and len(logs) <= 10 and all(company_today - dt.timedelta(days=9) <= day <= company_today for day in log_dates), logs)

        status, employee_search, _ = api.call("GET", "/api/v1/tasks?q=" + urllib.parse.quote("市场活动方案"), api.tokens["employee"])
        status2, upper_search, _ = api.call("GET", "/api/v1/tasks?q=" + urllib.parse.quote("市场活动方案"), api.tokens["upper"])
        check("9.3 task search is permission-scoped",
              status == 200 and not employee_search.get("items") and status2 == 200 and upper_search.get("items"),
              {"employee": employee_search, "upper": upper_search})

        status, pinned, _ = api.call("PUT", "/api/v1/tasks/" + first + "/pin", api.tokens["employee"], key=api.key("pin"))
        check("9.4 an employee can pin a visible task", status == 200 and pinned.get("pinned") is True, pinned)
        status, detail, _ = api.call("GET", "/api/v1/tasks/" + first, api.tokens["employee"])
        check("9.4 the owner reads the pinned flag", status == 200 and detail.get("pinned") is True, detail)
        status, other, _ = api.call("GET", "/api/v1/tasks/" + first, api.tokens["middle"])
        check("9.4 another user does not inherit the pin", status == 200 and other.get("pinned") is False, other)
        status, unpinned, _ = api.call("DELETE", "/api/v1/tasks/" + first + "/pin", api.tokens["employee"], key=api.key("unpin"))
        check("9.4 pinning can be cleared", status == 200 and unpinned.get("pinned") is False, unpinned)

        status, tasks, _ = api.call("GET", "/api/v1/tasks?limit=100", api.tokens["employee"])
        pending_complete = [task for task in tasks.get("items", []) if task.get("pendingKind") == "complete"]
        check("9.8 pending completion is exposed independently of execution state",
              status == 200 and pending_complete, pending_complete)
        code = 0 if all(item["pass"] for item in RESULTS) else 1
    except Exception as error:  # noqa: BLE001 - preserve the failure in the evidence file
        RESULTS.append({"check": "run completed", "pass": False, "evidence": str(error)})
        print("FAIL", error)
    finally:
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps({"checks": RESULTS}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{'PASS' if code == 0 else 'FAIL'}: {len(RESULTS)} checks")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
