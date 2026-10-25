#!/usr/bin/env python3
"""HTTP verification for chapter 7: the company three-day log window, a real 24-hour freeze and the
layered authorised author directory.

Run against an isolated, freshly seeded database with the controllable clock enabled:

    CHECK_FIXED_TIME=2026-10-25T04:00:00Z ./scripts/run_check_isolated.sh \
        python3 scripts/check_work_logs.py --base-url {base} --output ../audit/2026-10-25/chapter7-work-logs.json

The script only moves the application clock; the operating-system time is never changed. It exercises
the real service: creation, deletion/recreation of the same day slot, the exact freeze instant, the
concurrent first write, the layered author directory and tag freezing.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
import math
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request
import uuid

RESULTS: list[dict] = []
PASSWORD = "Demo@123456"
COMPANY = dt.timezone(dt.timedelta(hours=8))
DEMO_PHONE = {'upper': '13800000001', 'middle': '13800000002', 'market': '13800000003',
              'employee': '13800000004', 'colleague': '13800000005', 'marketing': '13800000006',
              'admin': 'admin'}


def login_identity(account: str) -> str:
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
        self.tokens[username] = body["token"]
        return body["token"]

    @staticmethod
    def key(prefix="logs"):
        return prefix + "-" + uuid.uuid4().hex

    @staticmethod
    def etag(body, headers=None):
        if headers and headers.get("ETag"):
            return headers["ETag"]
        return '"' + str(body.get("rowVersion")) + '"'


def check(name: str, condition: bool, evidence=None) -> None:
    RESULTS.append({"check": name, "pass": bool(condition), "evidence": evidence})
    print(("PASS  " if condition else "FAIL  ") + name + ("" if condition else f"  -> {evidence}"))


def server_now(api: Api) -> dt.datetime:
    status, body, _ = api.call("GET", "/api/v1/admin/clock", api.tokens["admin"])
    if status != 200 or not body.get("controllable"):
        raise SystemExit(f"controlled clock unavailable: {status} {body}")
    return dt.datetime.fromisoformat(body["now"].replace("Z", "+00:00"))


def advance_to(api: Api, target: dt.datetime) -> None:
    seconds = math.ceil((target - server_now(api)).total_seconds())
    if seconds <= 0:
        return
    status, body, _ = api.call("POST", "/api/v1/admin/clock/advance", api.tokens["admin"], {"seconds": seconds})
    if status != 200:
        raise SystemExit(f"clock advance failed: {status} {body}")


def advance(api: Api, seconds: int) -> None:
    status, body, _ = api.call("POST", "/api/v1/admin/clock/advance", api.tokens["admin"], {"seconds": seconds})
    if status != 200:
        raise SystemExit(f"clock advance failed: {status} {body}")


def day_log(api: Api, token: str, date: dt.date):
    status, body, _ = api.call("GET", f"/api/v1/work-logs?scope=self&from={date}&to={date}&limit=1", token)
    if status != 200:
        raise SystemExit(f"log lookup failed: {status} {body}")
    return (body.get("items") or [None])[0]


def run(base: str) -> int:
    api = Api(base)
    for username in ("admin", "upper", "middle", "employee", "colleague", "marketing", "market"):
        api.login(username)
    employee = api.tokens["employee"]
    colleague = api.tokens["colleague"]
    _, employee_me, _ = api.call("GET", "/api/v1/me", employee)
    employee_id = employee_me["id"]
    marker = "7.x-" + uuid.uuid4().hex[:8]
    now = server_now(api).astimezone(COMPANY)
    today = now.date()
    yesterday = today - dt.timedelta(days=1)
    before_yesterday = today - dt.timedelta(days=2)

    # ---- the three-day window ----
    seeded_today = day_log(api, employee, today)
    check("7.1 the seeded author already has today's log",
          bool(seeded_today) and seeded_today.get("authorId") == employee_id, seeded_today)
    status, edited, _ = api.call("PATCH", "/api/v1/work-logs/" + seeded_today["id"], employee,
                                 {"body": marker + " edited today"}, api.key(),
                                 '"' + str(seeded_today["rowVersion"]) + '"')
    check("7.1 an existing unfrozen log for the day is edited rather than duplicated", status == 200, edited)
    status, detail, headers = api.call("GET", "/api/v1/work-logs/" + seeded_today["id"], employee)
    created = dt.datetime.fromisoformat(detail["createdAt"].replace("Z", "+00:00"))
    freeze_at = created + dt.timedelta(hours=24)
    stored_freeze = dt.datetime.fromisoformat(detail["frozenAt"].replace("Z", "+00:00"))
    check("7.1 the detail publishes the real freeze instant and the current editability",
          status == 200 and detail.get("editable") is True and detail.get("frozen") is False
          and stored_freeze == freeze_at,
          {k: detail.get(k) for k in ("editable", "frozen", "frozenAt", "createdAt")})

    status, duplicate, _ = api.call("POST", "/api/v1/work-logs", employee,
                                    {"body": marker + " duplicate"}, api.key())
    check("7.1 a second live create for the same day returns the existing id",
          status == 409 and duplicate.get("code") == "WORK_LOG_EXISTS"
          and duplicate.get("logId") == seeded_today["id"], duplicate)

    seeded_yesterday = day_log(api, employee, yesterday)
    status, deleted, _ = api.call("DELETE", "/api/v1/work-logs/" + seeded_yesterday["id"], employee,
                                  key=api.key(), if_match='"' + str(seeded_yesterday["rowVersion"]) + '"')
    check("7.2 deleting an editable log keeps the day slot (logical delete)", status == 200 and deleted.get("deleted"), deleted)
    status, hidden, _ = api.call("GET", "/api/v1/work-logs?scope=self&from=" + str(yesterday) + "&to=" + str(yesterday), employee)
    check("7.2 the deleted slot is no longer listed", status == 200 and not hidden.get("items"), hidden)
    status, restored, _ = api.call("POST", "/api/v1/work-logs", employee,
                                   {"body": marker + " restored", "businessDate": str(yesterday)}, api.key())
    check("7.2 rewriting the same day restores that row instead of creating a new one",
          status in (200, 201) and restored.get("restored") is True and restored.get("logId") == seeded_yesterday["id"], restored)
    status, restored_detail, _ = api.call("GET", "/api/v1/work-logs/" + seeded_yesterday["id"], employee)
    check("7.2 recreating keeps the original first creation time (the freeze clock is not reset)",
          restored_detail.get("createdAt") == seeded_yesterday.get("createdAt")
          and restored_detail.get("rowVersion") > seeded_yesterday["rowVersion"], {
              "before": seeded_yesterday.get("createdAt"), "after": restored_detail.get("createdAt")})

    status, too_old, _ = api.call("POST", "/api/v1/work-logs", employee,
                                  {"body": marker + " old", "businessDate": str(before_yesterday - dt.timedelta(days=1))},
                                  api.key())
    check("7.1 a date older than the three-day window is rejected", status == 400, too_old)
    status, future, _ = api.call("POST", "/api/v1/work-logs", employee,
                                 {"body": marker + " future", "businessDate": str(today + dt.timedelta(days=1))}, api.key())
    check("7.1 a future business date is rejected", status == 400, future)

    # ---- the freeze is 24h after the real creation, not midnight ----
    end_of_day = dt.datetime.combine(today + dt.timedelta(days=1), dt.time(0, 0), COMPANY) - dt.timedelta(seconds=1)
    if end_of_day < freeze_at:
        advance_to(api, end_of_day)
        status, before_midnight, _ = api.call("GET", "/api/v1/work-logs/" + seeded_today["id"], employee)
        check("7.1 a log created in the morning is still editable at 23:59:59",
              status == 200 and before_midnight.get("editable") is True, before_midnight)
        advance(api, 2)
        status, after_midnight, _ = api.call("GET", "/api/v1/work-logs/" + seeded_today["id"], employee)
        check("7.1 crossing midnight does not freeze a log that is younger than 24 hours",
              status == 200 and after_midnight.get("editable") is True, after_midnight)
    # Freeze the employee's today slot just before its own boundary, after deleting it once.
    advance_to(api, freeze_at - dt.timedelta(seconds=2))
    status, live, _ = api.call("GET", "/api/v1/work-logs/" + seeded_today["id"], employee)
    check("7.1 one second before its own 24-hour boundary the log is still editable", live.get("editable") is True, live)
    status, deleted_today, _ = api.call("DELETE", "/api/v1/work-logs/" + seeded_today["id"], employee,
                                        key=api.key(), if_match=Api.etag(live, {}))
    check("7.2 the author can delete the log while still inside the window", status == 200, deleted_today)
    advance(api, 4)
    status, frozen, _ = api.call("GET", "/api/v1/work-logs?scope=self&from=" + str(yesterday) + "&to=" + str(yesterday), employee)
    yesterday_row = (frozen.get("items") or [None])[0]
    check("7.1 at the 24-hour boundary the restored log becomes read-only",
          bool(yesterday_row) and yesterday_row.get("editable") is False and yesterday_row.get("frozen") is True, yesterday_row)
    status, blocked, _ = api.call("PATCH", "/api/v1/work-logs/" + yesterday_row["id"], employee,
                                  {"body": marker + " too late"}, api.key(), Api.etag(yesterday_row))
    check("7.1 a frozen log rejects edits with WORK_LOG_FROZEN", status == 409 and blocked.get("code") == "WORK_LOG_FROZEN", blocked)
    status, blocked_delete, _ = api.call("DELETE", "/api/v1/work-logs/" + yesterday_row["id"], employee,
                                         key=api.key(), if_match=Api.etag(yesterday_row))
    check("7.1 a frozen log rejects deletes with WORK_LOG_FROZEN",
          status == 409 and blocked_delete.get("code") == "WORK_LOG_FROZEN", blocked_delete)
    # The slot deleted just before the boundary is today's original business date, which is now
    # "yesterday" (still inside the two backfill days) but must refuse a new window.
    status, recreate, _ = api.call("POST", "/api/v1/work-logs", employee,
                                   {"body": marker + " recycle", "businessDate": str(today)}, api.key())
    check("7.2 a deleted slot whose original window is over cannot be recreated",
          status == 409 and recreate.get("code") == "WORK_LOG_FROZEN", recreate)

    # A colleague's log is frozen too and proves the frozen rule is the real creation time.
    colleague_today = day_log(api, colleague, today)
    status, frozen_row, _ = api.call("GET", "/api/v1/work-logs/" + colleague_today["id"], colleague)
    check("7.1 another author's log is frozen at the same real boundary", frozen_row.get("editable") is False, frozen_row)

    # ---- a fresh day: one row under concurrent distinct keys ----
    new_today = yesterday + dt.timedelta(days=2)  # company "today" after the advance
    status, current, _ = api.call("GET", f"/api/v1/work-logs?scope=self&from={new_today}&to={new_today}", employee)
    check("7.2 the new company day starts empty for this author", status == 200 and not current.get("items"), current)
    body = {"body": marker + " concurrent", "businessDate": str(new_today)}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(api.call, "POST", "/api/v1/work-logs", employee, body, api.key())
        second = pool.submit(api.call, "POST", "/api/v1/work-logs", employee, body, api.key())
        results = [first.result(), second.result()]
    statuses = sorted(row[0] for row in results)
    winner = next((row for row in results if row[0] in (200, 201)), None)
    loser = next((row for row in results if row[0] == 409), None)
    check("7.2 concurrent creates with distinct idempotency keys persist exactly one log",
          statuses == [200, 409] and loser is not None and loser[1].get("code") == "WORK_LOG_EXISTS"
          and winner is not None and loser[1].get("logId") == winner[1].get("logId"),
          {"statuses": statuses, "bodies": [row[1] for row in results]})
    status, rows, _ = api.call("GET", f"/api/v1/work-logs?scope=self&from={new_today}&to={new_today}", employee)
    check("7.2 only one active log exists for the new day", status == 200 and len(rows.get("items", [])) == 1, rows)

    # ---- layered authorised author directory ----
    status, authors, _ = api.call("GET", "/api/v1/work-log-authors", api.tokens["middle"])
    names = {row["username"] for row in authors.get("items", [])}
    departments = authors.get("departments") or []
    teams = authors.get("teams") or []
    check("7.3 the author directory keeps self and direct reports only",
          status == 200 and {"middle", "employee", "colleague"}.issubset(names)
          and "marketing" not in names and "upper" not in names, sorted(names))
    check("7.3 departments and teams with real names and permission-filtered counts",
          status == 200 and any(row.get("name") == "产品部" and row.get("count") >= 2 for row in departments)
          and any(row.get("name") == "产品部" and row.get("count") >= 2 for row in teams),
          {"departments": departments, "teams": teams})
    check("7.3 no unauthorized author or department leaks through the directory",
          all(person["username"] in ("middle", "employee", "colleague") for person in authors.get("items", []))
          and all(row.get("name") != "市场部" for row in departments), {"departments": departments})
    status, searched, _ = api.call("GET", "/api/v1/work-log-authors?q=" + urllib.parse.quote("张"), api.tokens["middle"])
    check("7.3 person search keeps only matches inside the log range",
          status == 200 and [row["username"] for row in searched.get("items", [])] == ["employee"], searched)
    status, no_match, _ = api.call("GET", "/api/v1/work-log-authors?q=" + urllib.parse.quote("不存在的人"), api.tokens["middle"])
    check("7.3 a person search with no authorized match returns an explicit empty state",
          status == 200 and not no_match.get("items") and no_match.get("empty") is True, no_match)
    status, dept_search, _ = api.call("GET", "/api/v1/work-log-authors?departmentQ=" + urllib.parse.quote("产品"), api.tokens["middle"])
    check("7.3 the department level can be searched independently",
          status == 200 and [row["name"] for row in dept_search.get("departments", [])] == ["产品部"], dept_search.get("departments"))
    status, team_search, _ = api.call("GET", "/api/v1/work-log-authors?teamQ=" + urllib.parse.quote("产品"), api.tokens["middle"])
    check("7.3 the team level can be searched independently",
          status == 200 and any("产品" in row["name"] for row in team_search.get("teams", [])), team_search.get("teams"))
    status, outside, _ = api.call("GET", "/api/v1/work-logs?scope=visible&authorId=" + api.tokens["marketing"], api.tokens["middle"])
    check("7.3 an author outside the log range is refused", status in (404, 400), outside)

    # ---- tags on logs follow the same freeze ----
    _, tags_body, _ = api.call("GET", "/api/v1/tags", api.tokens["upper"])
    palette = tags_body.get("palette") or []
    tag_name = "日志标签 " + uuid.uuid4().hex[:4]
    status, created_tag, _ = api.call("POST", "/api/v1/tags", api.tokens["upper"],
                                      {"name": tag_name, "color": palette[0]["color"]}, api.key())
    tag_id = created_tag.get("tagId")
    check("8.1 the founder creates a log tag from the predefined palette", status in (200, 201) and bool(tag_id), created_tag)
    new_day_log = rows["items"][0]
    status, tagged, _ = api.call("PATCH", "/api/v1/work-logs/" + new_day_log["id"], employee,
                                 {"tagId": tag_id}, api.key(), Api.etag(new_day_log))
    status, tagged_detail, _ = api.call("GET", "/api/v1/work-logs/" + new_day_log["id"], employee)
    check("8.1 a log keeps one selected tag and exposes it on read",
          status == 200 and tagged_detail.get("tag", {}).get("id") == tag_id, tagged_detail.get("tag"))
    status, renamed, _ = api.call("PATCH", "/api/v1/tags/" + tag_id, api.tokens["upper"],
                                  {"name": tag_name + " 改"}, api.key(), '"' + str(created_tag["rowVersion"]) + '"')
    status, after_rename, _ = api.call("GET", "/api/v1/work-logs/" + new_day_log["id"], employee)
    check("8.3 renaming the tag updates the current log reference immediately",
          status == 200 and after_rename.get("tag", {}).get("name") == tag_name + " 改", after_rename.get("tag"))
    status, frozen_tag, _ = api.call("PATCH", "/api/v1/work-logs/" + colleague_today["id"], colleague,
                                     {"tagId": tag_id}, api.key(), '"' + str(frozen_row["rowVersion"]) + '"')
    check("8.3 a frozen log cannot change its tag", status == 409 and frozen_tag.get("code") == "WORK_LOG_FROZEN", frozen_tag)

    return 0 if all(item["pass"] for item in RESULTS) else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:18120")
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    code = 1
    try:
        code = run(args.base_url)
    except Exception as error:  # noqa: BLE001 - keep the real failure in the evidence
        RESULTS.append({"check": "run completed", "pass": False, "evidence": str(error)})
        print("FAIL", error)
    finally:
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps({"checks": RESULTS}, ensure_ascii=False, indent=2) + "\n",
                                   encoding="utf-8")
    print(f"{'PASS' if code == 0 else 'FAIL'}: {len(RESULTS)} checks")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
