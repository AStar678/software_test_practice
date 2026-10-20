#!/usr/bin/env python3
"""Exercise a running Pandora backend through HTTP; never resets the database.

Run against the local API connected to MySQL, not an in-memory test substitute.
Each invocation creates identifiable Smoke <UUID> records and leaves them in place.
Only Python's standard library is required.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid


class Failure(AssertionError):
    pass


class Client:
    def __init__(self, base_url: str, token: str | None = None):
        self.base_url = base_url.rstrip("/")
        self.token = token

    def call(self, method, path, body=None, *, key=None, etag=None, expected=(200,)):
        headers = {"Accept": "application/json"}
        if self.token:
            headers["Authorization"] = "Bearer " + self.token
        if body is not None:
            headers["Content-Type"] = "application/json"
        if method in ("POST", "PATCH", "PUT", "DELETE"):
            headers["Idempotency-Key"] = key or str(uuid.uuid4())
        if etag is not None:
            headers["If-Match"] = str(etag)
        data = None if body is None else json.dumps(body, ensure_ascii=False).encode()
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
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            raise Failure(f"{method} {path}: non-JSON response ({status}): {raw[:200]}")
        if expected is not None and status not in expected:
            raise Failure(f"{method} {path}: expected {expected}, received {status}: {str(payload)[:600]}")
        return status, payload, response_headers


class Smoke:
    def __init__(self, base_url, password):
        self.base_url = base_url
        self.password = password
        self.clients = {}
        self.users = {}
        self.prefix = "Smoke " + str(uuid.uuid4())
        self.checks = []
        self.created = {"tasks": [], "logs": []}
        self.start = time.monotonic()

    def check(self, label, condition, detail=""):
        if not condition:
            raise Failure(label + (": " + detail if detail else ""))
        self.checks.append(label)
        print("PASS", label, flush=True)

    def get(self, actor, path):
        _, body, headers = self.clients[actor].call("GET", "/api/v1" + path)
        return body, headers

    @staticmethod
    def tag(body, headers):
        return next((v for k, v in headers.items() if k.lower() == "etag"), None) or '"' + str(body["rowVersion"]) + '"'

    def task(self, actor, task_id):
        return self.get(actor, "/tasks/" + task_id)

    def approval(self, actor, request_id):
        return self.get(actor, "/approval-requests/" + request_id)

    def task_input(self, suffix, assignees, parent=None):
        now = dt.datetime.now(dt.timezone.utc)
        body = {
            "title": self.prefix + " " + suffix,
            "description": "HTTP integration verification; safe to retain as demo data.",
            "acceptanceCriteria": "Verify authorization and transactional task lifecycle.",
            "assigneeIds": [self.users[x]["id"] for x in assignees],
            "priority": "medium", "allDay": False,
            "startAt": (now - dt.timedelta(hours=1)).isoformat(),
            "dueAt": (now + dt.timedelta(days=4)).isoformat(),
        }
        if parent:
            body["parentTaskId"] = parent
        return body

    def create(self, actor, suffix, assignees, parent=None):
        body = self.task_input(suffix, assignees, parent)
        _, result, _ = self.clients[actor].call("POST", "/api/v1/tasks", body, expected=(200, 201, 202))
        self.created["tasks"].append(result["taskId"])
        return result

    def command(self, actor, task_id, command, **fields):
        before, headers = self.task(actor, task_id)
        _, result, _ = self.clients[actor].call(
            "PATCH", "/api/v1/tasks/" + task_id,
            {"command": command, **fields}, etag=self.tag(before, headers), expected=(200, 201, 202))
        return result

    def decide(self, actor, request_id, decision, comment=None):
        before, headers = self.approval(actor, request_id)
        body = {"decision": decision}
        if comment:
            body["comment"] = comment
        _, result, _ = self.clients[actor].call(
            "PATCH", "/api/v1/approval-requests/" + request_id,
            body, etag=self.tag(before, headers), expected=(200, 201, 202))
        return result

    def listed(self, actor):
        query = urllib.parse.urlencode({"q": self.prefix, "limit": 100})
        body, _ = self.get(actor, "/tasks?" + query)
        return body["items"]

    def forbidden(self, actor, path, method="GET", body=None, etag=None):
        self.clients[actor].call(method, "/api/v1" + path, body, etag=etag, expected=(403, 404))

    def wait_notification(self, actor, task_id):
        deadline = time.monotonic() + 15
        while True:
            body, _ = self.get(actor, "/notifications?limit=100")
            item = next((x for x in body["items"] if x.get("taskId") == task_id), None)
            if item:
                return item
            if time.monotonic() >= deadline:
                raise Failure("Worker did not deliver a task notification within 15 seconds")
            time.sleep(0.5)

    def run(self):
        public = Client(self.base_url)
        _, health, _ = public.call("GET", "/health")
        self.check("running API reports healthy MySQL connection", health.get("status") == "UP" and health.get("database") == "MySQL")
        for name in ("admin", "upper", "middle", "market", "employee", "colleague", "marketing"):
            _, login, _ = public.call("POST", "/api/v1/auth/sessions",
                                      {"username": name, "password": self.password})
            self.clients[name] = Client(self.base_url, login["token"])
            me, _ = self.get(name, "/me")
            self.users[name] = me
            self.check("login and server identity: " + name, bool(me.get("id")))
        public.call("GET", "/api/v1/tasks", expected=(401,))
        self.check("unauthenticated request rejected", True)

        baseline, _ = self.get("upper", "/analytics/task-summary")
        payload = self.task_input("pending-create", ["employee"])
        key = str(uuid.uuid4())
        _, create, _ = self.clients["employee"].call("POST", "/api/v1/tasks", payload, key=key, expected=(200, 201, 202))
        task_id, request_id = create["taskId"], create["requestId"]
        self.created["tasks"].append(task_id)
        _, replay, _ = self.clients["employee"].call("POST", "/api/v1/tasks", payload, key=key, expected=(200, 201, 202))
        self.check("same idempotency key replays the same task/request", replay == create)
        altered = dict(payload, title=self.prefix + " different-body")
        self.clients["employee"].call("POST", "/api/v1/tasks", altered, key=key, expected=(409,))
        self.check("same key with different body rejected", True)
        self.forbidden("upper", "/tasks/" + task_id)
        self.forbidden("upper", "/approval-requests/" + request_id)
        self.forbidden("colleague", "/tasks/" + task_id)
        self.check("pending creation hidden from upper and unrelated employee", True)
        self.check("pending creation absent from normal task list", not any(x["id"] == task_id for x in self.listed("upper")))
        after, _ = self.get("upper", "/analytics/task-summary")
        self.check("pending creation excluded from statistics", after["total"] == baseline["total"])
        pending, headers = self.approval("middle", request_id)
        self.check("creation routed to direct manager", pending["currentReviewerId"] == self.users["middle"]["id"])
        self.forbidden("employee", "/approval-requests/" + request_id, "PATCH", {"decision": "approve"}, self.tag(pending, headers))
        self.check("applicant cannot approve own non-exempt request", True)

        notification = self.wait_notification("middle", task_id)
        nid = notification["id"]
        notice_detail, notice_headers = self.get("middle", "/notifications/" + nid)
        self.clients["middle"].call("PATCH", "/api/v1/notifications/" + nid,
                                     {"action": "read"}, etag=self.tag(notice_detail, notice_headers))
        still_pending, _ = self.approval("middle", request_id)
        self.check("reading notification does not approve request", still_pending["status"] == "pending")
        notice_detail, notice_headers = self.get("middle", "/notifications/" + nid)
        self.clients["middle"].call("PATCH", "/api/v1/notifications/" + nid,
                                     {"action": "hide"}, etag=self.tag(notice_detail, notice_headers))
        queue, _ = self.get("middle", "/approval-requests?mine=reviewer&limit=100")
        self.check("hiding notification preserves approval queue", any(x["requestId"] == request_id for x in queue["items"]))
        self.decide("middle", request_id, "approve")
        initial, initial_headers = self.task("employee", task_id)
        self.check("approved creation publishes todo", initial["executionState"] == "todo" and bool(initial["currentVersionId"]))

        changed_title = self.prefix + " changed-title"
        change = self.command("employee", task_id, "change", title=changed_title, reason="Smoke change request")
        frozen, frozen_headers = self.task("employee", task_id)
        self.check("proposed change preserves old effective title", frozen["title"] == initial["title"])
        self.check("proposed change freezes the task", frozen["frozen"] is True)
        self.clients["employee"].call("PATCH", "/api/v1/tasks/" + task_id,
                                       {"command": "progress", "progressNote": "Blocked second request"},
                                       etag=self.tag(frozen, frozen_headers), expected=(409,))
        self.check("second pending command rejected", True)
        self.decide("middle", change["requestId"], "approve")
        current, _ = self.task("employee", task_id)
        self.check("approved change replaces effective version", current["title"] == changed_title and current["currentVersionId"] != initial["currentVersionId"])
        self.clients["employee"].call("PATCH", "/api/v1/tasks/" + task_id,
                                       {"command": "progress", "progressNote": "Stale write"},
                                       etag=self.tag(initial, initial_headers), expected=(412,))
        self.check("stale task version rejected", True)

        completed = self.command("employee", task_id, "complete", completionNote="Completed from todo for rejection test")
        before_reject, _ = self.task("employee", task_id)
        self.check("completion submission retains effective todo", before_reject["executionState"] == "todo")
        self.decide("middle", completed["requestId"], "reject", "Smoke return for changes")
        returned, _ = self.task("employee", task_id)
        self.check("completion rejection from todo publishes doing snapshot", returned["executionState"] == "doing" and returned["currentVersionId"] != before_reject["currentVersionId"])
        withdraw = self.command("employee", task_id, "complete", completionNote="Will withdraw")
        self.decide("employee", withdraw["requestId"], "withdraw")
        restored, _ = self.task("employee", task_id)
        self.check("completion withdrawal preserves doing and effective version", restored["executionState"] == "doing" and restored["currentVersionId"] == returned["currentVersionId"])
        progress = self.command("employee", task_id, "progress", progressNote="Verified progress must be reviewed")
        before_progress, _ = self.task("employee", task_id)
        self.check("progress requires review", before_progress["frozen"] is True)
        self.decide("middle", progress["requestId"], "approve")
        finished = self.command("employee", task_id, "complete", completionNote="Final verified completion")
        self.decide("middle", finished["requestId"], "approve")
        done, done_headers = self.task("employee", task_id)
        self.check("completion approval publishes done", done["executionState"] == "done")
        self.forbidden("middle", "/tasks/" + task_id, "PATCH", {"command": "reopen", "reason": "Not original creator"}, self.tag(done, done_headers))
        reopened = self.command("employee", task_id, "reopen", reason="Verify next execution round")
        self.decide("middle", reopened["requestId"], "approve")
        again, _ = self.task("employee", task_id)
        self.check("reopen publishes doing in next execution round", again["executionState"] == "doing" and again["executionRound"] == done["executionRound"] + 1)

        parent = self.create("middle", "parent-direct", ["employee"])
        parent_id = parent["taskId"]
        parent_request, _ = self.approval("middle", parent["requestId"])
        self.check("a creator who is also reviewer still receives an explicit request",
                   parent_request["status"] == "pending"
                   and parent_request["currentReviewerId"] == self.users["middle"]["id"])
        self.decide("middle", parent["requestId"], "approve")
        parent_before, parent_headers = self.task("employee", parent_id)
        self.check("self-reviewed creation publishes only after approval", parent_before["executionState"] == "todo" and not parent_before["frozen"])
        child = self.create("middle", "child-direct", ["employee"], parent_id)
        child_request, _ = self.approval("middle", child["requestId"])
        self.check("child creation uses the same explicit self-review rule", child_request["status"] == "pending")
        self.decide("middle", child["requestId"], "approve")
        self.forbidden("middle", "/tasks/" + parent_id, "PATCH", {"command": "complete", "completionNote": "Creator is not an assignee"}, self.tag(parent_before, parent_headers))
        self.check("creator cannot execute without being an assignee", True)
        parent_completion = self.command("employee", parent_id, "complete", completionNote="Will withdraw from todo")
        self.decide("employee", parent_completion["requestId"], "withdraw")
        restored_todo, _ = self.task("employee", parent_id)
        self.check("completion withdrawal restores todo", restored_todo["executionState"] == "todo")
        parent_completion = self.command("employee", parent_id, "complete", completionNote="Parent complete only")
        self.decide("middle", parent_completion["requestId"], "approve")
        child_state, _ = self.task("employee", child["taskId"])
        self.check("parent completion does not complete child", child_state["executionState"] == "todo")
        child_body, child_headers = self.task("middle", child["taskId"])
        self.clients["middle"].call("PATCH", "/api/v1/tasks/" + child["taskId"],
                                     {"command": "change", "parentTaskId": child["taskId"], "reason": "Self-cycle test"},
                                     etag=self.tag(child_body, child_headers), expected=(400, 409, 422))
        self.check("self-parent relation rejected", True)

        market = self.create("market", "market-private", ["marketing"])
        market_request, _ = self.approval("market", market["requestId"])
        self.check("department creator self-review remains explicit", market_request["status"] == "pending")
        self.decide("market", market["requestId"], "approve")
        for actor in ("employee", "middle"):
            self.forbidden(actor, "/tasks/" + market["taskId"])
        self.task("upper", market["taskId"])
        self.check("department task boundary enforced", True)

        transfer = self.create("upper", "assignee-transfer", ["employee"])
        self.decide("middle", transfer["requestId"], "approve")
        transferred = self.command("upper", transfer["taskId"], "change",
                                   assigneeIds=[self.users["marketing"]["id"]], reason="Review uses proposed route")
        transfer_request, _ = self.approval("market", transferred["requestId"])
        self.check("assignee change recomputes the proposed review route", transfer_request["currentReviewerId"] == self.users["market"]["id"])
        self.forbidden("marketing", "/tasks/" + transfer["taskId"])
        self.forbidden("middle", "/approval-requests/" + transferred["requestId"])
        self.check("proposed assignee receives no early task access", True)
        self.decide("market", transferred["requestId"], "approve")
        new_assignee_task, _ = self.task("marketing", transfer["taskId"])
        self.check("assignee change takes effect only after approval", new_assignee_task["assigneeIds"] == [self.users["marketing"]["id"]])
        self.forbidden("employee", "/tasks/" + transfer["taskId"])
        self.check("removed assignee loses task access", True)

        retry_create = self.create("employee", "creation-reject-resubmit", ["employee"])
        self.decide("middle", retry_create["requestId"], "reject", "Correct the task proposal")
        resubmission = self.command("employee", retry_create["taskId"], "create", title=self.prefix + " resubmitted")
        retried, _ = self.approval("middle", resubmission["requestId"])
        self.check("rejected creation can resubmit a new request", retried["status"] == "pending" and resubmission["requestId"] != retry_create["requestId"])
        self.decide("employee", resubmission["requestId"], "withdraw")

        business_date = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date().isoformat()
        _, today_logs, _ = self.clients["employee"].call(
            "GET", "/api/v1/work-logs?scope=self&from=" + business_date + "&to=" + business_date + "&limit=1")
        if today_logs.get("items"):
            log_id = today_logs["items"][0]["id"]
            log_etag = '"' + str(today_logs["items"][0]["rowVersion"]) + '"'
            self.clients["employee"].call("PATCH", "/api/v1/work-logs/" + log_id,
                                          {"body": self.prefix + " work log", "taskId": task_id},
                                          etag=log_etag, expected=(200,))
        else:
            _, log, _ = self.clients["employee"].call(
                "POST", "/api/v1/work-logs",
                {"body": self.prefix + " work log", "businessDate": business_date, "taskId": task_id},
                expected=(200, 201))
            log_id = log["logId"]
            self.created["logs"].append(log_id)
        self.forbidden("colleague", "/work-logs/" + log_id)
        manager_log, manager_log_headers = self.get("middle", "/work-logs/" + log_id)
        self.forbidden("middle", "/work-logs/" + log_id, "PATCH", {"body": "Manager cannot rewrite employee log"}, self.tag(manager_log, manager_log_headers))
        current, current_headers = self.get("employee", "/work-logs/" + log_id)
        self.clients["employee"].call("PATCH", "/api/v1/work-logs/" + log_id,
                                      {"body": self.prefix + " invalid relation", "taskId": market["taskId"]},
                                      etag=self.tag(current, current_headers), expected=(403, 404))
        self.check("log read/write and associated task permissions independent", True)

        race = self.create("employee", "approval-withdraw-race", ["employee"])
        race_id = race["requestId"]
        race_before, race_headers = self.approval("middle", race_id)
        race_etag = self.tag(race_before, race_headers)
        def race_call(actor, decision):
            return self.clients[actor].call("PATCH", "/api/v1/approval-requests/" + race_id,
                                            {"decision": decision}, etag=race_etag, expected=None)[0]
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            approve = pool.submit(race_call, "middle", "approve")
            cancel = pool.submit(race_call, "employee", "withdraw")
            statuses = [approve.result(), cancel.result()]
        self.check("concurrent approval/withdrawal has one winner", sum(200 <= x < 300 for x in statuses) == 1 and any(x in (409, 412) for x in statuses), str(statuses))
        race_after, _ = self.approval("employee", race_id)
        self.check("race leaves a terminal approval result", race_after["status"] in ("approved", "withdrawn"))

        _, ai, _ = self.clients["employee"].call("POST", "/api/v1/ai-jobs", {"scopeType": "self"}, expected=(200, 201, 202))
        ai_result, _ = self.get("employee", "/ai-jobs/" + ai["jobId"])
        self.check("analysis uses explicitly labelled rule fallback", ai.get("mode") == "rule_based" or ai_result.get("mode") == "rule_based" or ai_result.get("result", {}).get("mode") == "rule_based")
        self.forbidden("colleague", "/ai-jobs/" + ai["jobId"])
        self.check("analysis result owned and permission checked", True)
        admin_users, _ = self.get("admin", "/admin/users?limit=100")
        self.check("admin can inspect managed users", bool(admin_users["items"]))
        self.forbidden("employee", "/admin/users")
        self.check("business employee cannot access management API", True)

        # V2 uses a case-sensitive idempotency key collation. Keep this after
        # statistics checks: these are intentionally distinct new commands.
        case_suffix = str(uuid.uuid4())
        case_body = self.task_input("case-sensitive-key", ["employee"])
        case_keys = ("CaseProbe-" + case_suffix, "caseprobe-" + case_suffix)
        case_results = []
        for case_key in case_keys:
            _, case_result, _ = self.clients["employee"].call(
                "POST", "/api/v1/tasks", case_body, key=case_key, expected=(200, 201, 202))
            case_results.append(case_result)
            self.created["tasks"].append(case_result["taskId"])
        self.check("idempotency keys differing only in case remain distinct",
                   case_results[0]["taskId"] != case_results[1]["taskId"]
                   and case_results[0]["requestId"] != case_results[1]["requestId"])
        case_replays = []
        for case_key in case_keys:
            _, case_replay, _ = self.clients["employee"].call(
                "POST", "/api/v1/tasks", case_body, key=case_key, expected=(200, 201, 202))
            case_replays.append(case_replay)
        self.check("each case-sensitive key replays its own command", case_replays == case_results)

    def report(self, success, error=None):
        return {"success": success, "baseUrl": self.base_url, "prefix": self.prefix,
                "checksPassed": len(self.checks), "checks": self.checks,
                "created": self.created, "seconds": round(time.monotonic() - self.start, 2), "error": error}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=os.environ.get("PANDORA_BASE_URL", "http://localhost:8080"))
    parser.add_argument("--report", type=Path, help="Optional JSON verification report (contains no credentials).")
    args = parser.parse_args()
    password = os.environ.get("PANDORA_DEMO_PASSWORD", os.environ.get("DEMO_PASSWORD", "Demo@123456"))
    smoke = Smoke(args.base_url, password)
    success, error = True, None
    try:
        smoke.run()
    except (Failure, KeyError, TypeError, ValueError) as exc:
        success, error = False, str(exc)
        print("FAIL", error, file=sys.stderr, flush=True)
    report = smoke.report(success, error)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{'PASS' if success else 'FAIL'}: {report['checksPassed']} checks; prefix={smoke.prefix}; {report['seconds']}s")
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
