#!/usr/bin/env python3
"""HTTP verification for chapter 10 role-scoped task analysis.

Run against an isolated, seeded Pandora database. The script creates uniquely named tasks, approves
them through the real workflow, verifies statistics/keywords/rules for all three business scopes,
and bumps the organization authorization version to prove that a stored result is re-authorized.
It uses only the standard library and writes no credentials to its optional report.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid


# Employees authenticate by phone number (chapter 2.1/2.3); demo accounts keep stable numbers.
DEMO_PHONE = {'upper': '13800000001', 'middle': '13800000002', 'market': '13800000003',
              'employee': '13800000004', 'colleague': '13800000005', 'marketing': '13800000006',
              'admin': 'admin'}


def login_identity(account):
    """Map a demo account name to the phone number it now authenticates with."""
    return DEMO_PHONE.get(account, account)

class Failure(AssertionError):
    pass


class Client:
    def __init__(self, base_url: str, token: str | None = None):
        self.base_url = base_url.rstrip("/")
        self.token = token

    def call(self, method, path, body=None, *, etag=None, expected=(200,)):
        headers = {"Accept": "application/json"}
        if self.token:
            headers["Authorization"] = "Bearer " + self.token
        if body is not None:
            headers["Content-Type"] = "application/json"
        if method in {"POST", "PATCH", "PUT", "DELETE"}:
            headers["Idempotency-Key"] = str(uuid.uuid4())
        if etag is not None:
            headers["If-Match"] = etag
        data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(self.base_url + path, data=data, headers=headers, method=method)
        try:
            response = urllib.request.urlopen(request, timeout=20)
        except urllib.error.HTTPError as error:
            response = error
        except urllib.error.URLError as error:
            raise Failure(f"Cannot reach {self.base_url}: {error.reason}") from error
        with response:
            raw = response.read().decode("utf-8")
            status = response.status
            response_headers = dict(response.headers.items())
        payload = json.loads(raw) if raw else {}
        if status not in expected:
            raise Failure(f"{method} {path}: expected {expected}, received {status}: {str(payload)[:800]}")
        return status, payload, response_headers


class Check:
    def __init__(self, base_url: str, password: str):
        self.base_url = base_url.rstrip("/")
        self.password = password
        self.clients: dict[str, Client] = {}
        self.users: dict[str, dict] = {}
        self.checks: list[str] = []
        self.prefix = "AI-" + uuid.uuid4().hex[:10]
        self.created: list[str] = []
        self.started = time.monotonic()

    def check(self, label, condition, detail=""):
        if not condition:
            raise Failure(label + (": " + detail if detail else ""))
        self.checks.append(label)
        print("PASS", label, flush=True)

    @staticmethod
    def etag(body, headers):
        return next((value for key, value in headers.items() if key.lower() == "etag"), None) \
            or '"' + str(body["rowVersion"]) + '"'

    def login(self):
        public = Client(self.base_url)
        for name in ("admin", "upper", "middle", "employee", "colleague"):
            _, login, _ = public.call("POST", "/api/v1/auth/sessions",
                                      {"username": login_identity(name), "password": self.password})
            self.clients[name] = Client(self.base_url, login["token"])
            _, me, _ = self.clients[name].call("GET", "/api/v1/me")
            self.users[name] = me

    def all(self, actor, path):
        items, offset = [], 0
        while True:
            separator = "&" if "?" in path else "?"
            _, page, _ = self.clients[actor].call("GET", f"/api/v1{path}{separator}limit=100&offset={offset}")
            batch = page.get("items", [])
            items.extend(batch)
            next_offset = page.get("nextOffset", page.get("nextCursor"))
            if next_offset is None:
                return items
            offset = int(next_offset)

    def statistics(self, actor):
        status, body, _ = self.clients[actor].call("GET", "/api/v1/analytics/task-summary?scope=visible",
                                                   expected=(200, 403))
        return status, body

    def task_input(self, title, description, assignee, priority, start, due):
        return {
            "title": title,
            "description": description,
            "assigneeIds": [self.users[assignee]["id"]],
            "priority": priority,
            "allDay": False,
            "startAt": start.isoformat().replace("+00:00", "Z"),
            "dueAt": due.isoformat().replace("+00:00", "Z"),
        }

    def create(self, actor, body, reviewer="middle"):
        _, result, _ = self.clients[actor].call("POST", "/api/v1/tasks", body, expected=(200, 201, 202))
        self.created.append(result["taskId"])
        if result.get("requestId"):
            _, request, headers = self.clients[reviewer].call(
                "GET", "/api/v1/approval-requests/" + result["requestId"])
            self.clients[reviewer].call(
                "PATCH", "/api/v1/approval-requests/" + result["requestId"], {"decision": "approve"},
                etag=self.etag(request, headers), expected=(200, 201, 202))
        return result

    def change_description(self, actor, reviewer, task_id, description):
        _, task, headers = self.clients[actor].call("GET", "/api/v1/tasks/" + task_id)
        _, result, _ = self.clients[actor].call(
            "PATCH", "/api/v1/tasks/" + task_id,
            {"command": "change", "description": description, "reason": "验证真实文本词频刷新"},
            etag=self.etag(task, headers), expected=(200, 201, 202))
        _, request, request_headers = self.clients[reviewer].call(
            "GET", "/api/v1/approval-requests/" + result["requestId"])
        self.clients[reviewer].call(
            "PATCH", "/api/v1/approval-requests/" + result["requestId"], {"decision": "approve"},
            etag=self.etag(request, request_headers), expected=(200, 201, 202))

    def analysis(self, actor):
        _, created, _ = self.clients[actor].call(
            "POST", "/api/v1/ai-jobs", {"scopeType": "auto"}, expected=(200, 201, 202))
        _, saved, _ = self.clients[actor].call("GET", "/api/v1/ai-jobs/" + created["jobId"])
        return created["jobId"], saved["result"]

    @staticmethod
    def keyword_count(statistics, word):
        return next((int(item["count"]) for item in statistics.get("keywords", []) if item["word"] == word), 0)

    @staticmethod
    def parse_instant(value):
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))

    def assert_statistics_match_normal_tasks(self, actor, expected_scope):
        tasks = self.all(actor, "/tasks")
        _, statistics = self.statistics(actor)
        now = dt.datetime.now(dt.timezone.utc)
        priority = {key: 0 for key in ("urgent", "high", "medium", "low")}
        for task in tasks:
            priority[task["priority"]] += 1
        overdue = sum(task["executionState"] != "done" and self.parse_instant(task["dueAt"]) < now
                      for task in tasks)
        pending_complete = sum(task.get("pending") and task.get("pendingKind") == "complete" for task in tasks)
        self.check(actor + " statistics use the authorized normal-task scope",
                   statistics["scope"] == expected_scope and statistics["total"] == len(tasks))
        self.check(actor + " statistics expose pending-complete, strict overdue and four priorities",
                   statistics["pendingComplete"] == pending_complete
                   and statistics["overdue"] == overdue and statistics["priority"] == priority)
        return tasks, statistics

    def run(self):
        self.login()
        status, _ = self.statistics("admin")
        self.check("administrator has no default business analysis", status == 403)

        self.assert_statistics_match_normal_tasks("upper", "company")
        self.assert_statistics_match_normal_tasks("middle", "department")
        employee_tasks, employee_before = self.assert_statistics_match_normal_tasks("employee", "self")

        # An unpublished proposal is absent from normal tasks, totals and keywords.
        now = dt.datetime.now(dt.timezone.utc)
        pending_word = "未发布星舰词"
        pending_body = self.task_input(pending_word + " " + self.prefix, pending_word,
                                       "employee", "medium", now, now + dt.timedelta(hours=10))
        _, pending, _ = self.clients["employee"].call(
            "POST", "/api/v1/tasks", pending_body, expected=(200, 201, 202))
        self.created.append(pending["taskId"])
        _, pending_statistics = self.statistics("employee")
        self.check("unpublished proposals stay outside totals and keywords",
                   pending_statistics["total"] == len(employee_tasks)
                   and self.keyword_count(pending_statistics, pending_word) == 0)

        # A new, previously unknown term appears and its frequency changes after an approved edit.
        word = "星际酶谱"
        dynamic = self.create("employee", self.task_input(
            word + " " + self.prefix, word + " " + word, "employee", "medium",
            now - dt.timedelta(hours=1), now + dt.timedelta(days=3)))
        _, first_statistics = self.statistics("employee")
        first_count = self.keyword_count(first_statistics, word)
        self.check("an unregistered Chinese term is extracted from real title and description", first_count >= 3)
        self.change_description("employee", "middle", dynamic["taskId"], " ".join([word] * 5))
        _, changed_statistics = self.statistics("employee")
        self.check("keyword frequency changes after approved task content changes",
                   self.keyword_count(changed_statistics, word) > first_count)

        # Fixed schedules trigger the shared 20% node, overlap rule and high-priority rule.
        clock_now = dt.datetime.now(dt.timezone.utc)
        first = self.create("employee", self.task_input(
            "比例节点 " + self.prefix, "十小时排期", "employee", "medium",
            clock_now - dt.timedelta(hours=8), clock_now + dt.timedelta(hours=2)))
        second = self.create("employee", self.task_input(
            "冲突紧急 " + self.prefix, "与比例任务重叠", "employee", "urgent",
            clock_now - dt.timedelta(hours=1), clock_now + dt.timedelta(hours=1)))
        department_only = self.create("colleague", self.task_input(
            "部门专属急件 " + self.prefix, " ".join(["部门专属急件"] * 12), "colleague", "urgent",
            clock_now - dt.timedelta(hours=1), clock_now + dt.timedelta(hours=1)))

        _, lower = self.analysis("employee")
        lower_rules = lower["suggestions"]
        self.check("lower analysis is self-scoped and explicitly local rule based",
                   lower["statisticsScope"] == "self" and lower["suggestionScope"] == "self"
                   and lower["modelUsed"] is False and lower["method"] == "local_proportional_schedule_rules")
        self.check("proportional 20 percent advice includes its exact source",
                   any(item["rule"] == "remaining_20_percent" and item["sourceTaskIds"] == [first["taskId"]]
                       for item in lower_rules))
        self.check("schedule conflict advice includes both source tasks",
                   any(item["rule"] == "schedule_conflict"
                       and {first["taskId"], second["taskId"]}.issubset(set(item["sourceTaskIds"]))
                       for item in lower_rules))
        self.check("urgent task produces independent high-priority advice",
                   any(item["rule"] == "high_priority" and item["taskId"] == second["taskId"]
                       for item in lower_rules))
        self.check("lower advice excludes a department-only task",
                   all(department_only["taskId"] not in item["sourceTaskIds"] for item in lower_rules))

        _, middle = self.analysis("middle")
        middle_words = {item["word"] for item in middle["summary"]["keywords"]}
        self.check("middle analysis separates department statistics and personal suggestions",
                   middle["statisticsScope"] == "department" and middle["suggestionScope"] == "self"
                   and "部门专属急件" in middle_words
                   and all(department_only["taskId"] not in item["sourceTaskIds"] for item in middle["suggestions"]))

        stale_job, upper = self.analysis("upper")
        self.check("upper analysis uses company statistics, keywords and suggestions",
                   upper["statisticsScope"] == "company" and upper["suggestionScope"] == "company"
                   and any(department_only["taskId"] in item["sourceTaskIds"] for item in upper["suggestions"]))

        # Re-granting the same role is a harmless organization authority change, but must invalidate
        # the old analysis snapshot so stale source details cannot be returned after any revocation.
        colleague_id = self.users["colleague"]["id"]
        _, employee, headers = self.clients["admin"].call(
            "GET", "/api/v1/admin/employees/" + colleague_id)
        self.clients["admin"].call(
            "POST", "/api/v1/admin/employees/" + colleague_id + "/roles", {"roleCodes": ["employee"]},
            etag=self.etag(employee, headers), expected=(200, 201, 202))
        status, denied, _ = self.clients["upper"].call(
            "GET", "/api/v1/ai-jobs/" + stale_job, expected=(409,))
        self.check("stored analysis is re-authorized after organization authority changes",
                   status == 409 and denied.get("code") == "ANALYSIS_SCOPE_CHANGED")

    def report(self, success, error=None):
        return {
            "success": success,
            "baseUrl": self.base_url,
            "prefix": self.prefix,
            "checksPassed": len(self.checks),
            "checks": self.checks,
            "createdTaskIds": self.created,
            "seconds": round(time.monotonic() - self.started, 2),
            "error": error,
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=os.environ.get("PANDORA_BASE_URL", "http://127.0.0.1:8080"))
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    check = Check(args.base_url, os.environ.get("PANDORA_DEMO_PASSWORD", "Demo@123456"))
    success, error = True, None
    try:
        check.run()
    except Exception as exception:  # report the exact failed HTTP/assertion without hiding it
        success, error = False, str(exception)
        print("FAIL", error, flush=True)
    report = check.report(success, error)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(("PASS" if success else "FAIL") + f": {len(check.checks)} checks; prefix={check.prefix}; {report['seconds']}s")
    raise SystemExit(0 if success else 1)


if __name__ == "__main__":
    main()
