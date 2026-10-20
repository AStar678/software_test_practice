#!/usr/bin/env python3
"""HTTP verification for tasks 8.1-8.3: one log per author/day, midnight freeze and log scope.

Run against an isolated, freshly seeded database with the controlled clock enabled and fixed near
23:59:30 Asia/Shanghai. The script advances only the application clock; it never changes the OS time.

    PANDORA_CLOCK_CONTROLLABLE=true java -Dpandora.clock.fixed-time=... -jar target/pandora-backend-0.1.0.jar
    python3 scripts/check_work_logs.py --base-url http://127.0.0.1:18120
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

    @staticmethod
    def key(prefix="logs"):
        return prefix + "-" + uuid.uuid4().hex

    @staticmethod
    def etag(body, headers):
        return headers.get("ETag") or '"' + str(body.get("rowVersion")) + '"'


def check(name: str, condition: bool, evidence=None) -> None:
    RESULTS.append({"check": name, "pass": bool(condition), "evidence": evidence})
    print(("PASS  " if condition else "FAIL  ") + name + ("" if condition else f"  -> {evidence}"))


def server_now(api: Api) -> dt.datetime:
    status, body, _ = api.call("GET", "/api/v1/admin/clock", api.tokens["admin"])
    if status != 200 or not body.get("controllable"):
        raise SystemExit(f"controlled clock unavailable: {status} {body}")
    return dt.datetime.fromisoformat(body["now"].replace("Z", "+00:00"))


def advance(api: Api, seconds: int) -> None:
    status, body, _ = api.call("POST", "/api/v1/admin/clock/advance",
                               api.tokens["admin"], {"seconds": seconds})
    if status != 200:
        raise SystemExit(f"clock advance failed: {status} {body}")


def run(base: str) -> int:
    api = Api(base)
    for username in ("admin", "upper", "middle", "employee", "colleague", "marketing"):
        api.login(username)
    employee = api.tokens["employee"]
    _, employee_me, _ = api.call("GET", "/api/v1/me", employee)
    employee_id = employee_me["id"]
    marker = "8.1-8.3-" + uuid.uuid4().hex[:8]
    now = server_now(api).astimezone(COMPANY)
    today = now.date()
    midnight = dt.datetime.combine(today + dt.timedelta(days=1), dt.time(0, 0), COMPANY)
    old_log_id = None

    status, body, _ = api.call("GET", f"/api/v1/work-logs?scope=self&from={today}&to={today}&limit=1", employee)
    check("8.1 the self scope returns only the current author's day",
          status == 200 and all(row.get("authorId") == employee_id for row in body.get("items", [])), body)
    if body.get("items"):
        old_log_id = body["items"][0]["id"]
        old_etag = '"' + str(body["items"][0]["rowVersion"]) + '"'
        status, edited, _ = api.call("PATCH", "/api/v1/work-logs/" + old_log_id,
                                     employee, {"body": marker + " edited"}, api.key(), old_etag)
        check("8.1 an existing today log is edited rather than duplicated", status == 200, edited)
    else:
        status, created, _ = api.call("POST", "/api/v1/work-logs", employee,
                                      {"body": marker + " created", "businessDate": today.isoformat()},
                                      api.key())
        old_log_id = created.get("logId")
        check("8.1 a first today log can be created", status in (200, 201), created)

    status, detail, _ = api.call("GET", "/api/v1/work-logs/" + old_log_id, employee)
    check("8.1 the editable flag is true on the company day", status == 200 and detail.get("editable") is True, detail)

    status, conflict, _ = api.call("POST", "/api/v1/work-logs", employee,
                                   {"body": marker + " duplicate"}, api.key())
    check("8.1 a second today create returns 409 with the existing id",
          status == 409 and conflict.get("code") == "WORK_LOG_EXISTS"
          and conflict.get("logId") == old_log_id, conflict)

    status, changed, _ = api.call("PATCH", "/api/v1/work-logs/" + old_log_id, employee,
                                  {"businessDate": (today - dt.timedelta(days=1)).isoformat()},
                                  api.key(), '"' + str(detail["rowVersion"]) + '"')
    check("8.2 changing the recorded date is rejected", status == 400, changed)

    # The controllable clock keeps the startup microseconds. Round upward so the first
    # advance reaches 23:59:59.x instead of truncating to 23:59:58.x.
    seconds_to_last = math.ceil((midnight - dt.timedelta(seconds=1) - server_now(api).astimezone(COMPANY)).total_seconds())
    advance(api, max(0, seconds_to_last))
    status, before_midnight, _ = api.call("GET", "/api/v1/work-logs/" + old_log_id, employee)
    check("8.2 the log is still editable at 23:59:59", status == 200 and before_midnight.get("editable") is True,
          before_midnight)

    advance(api, 1)
    status, after_midnight, _ = api.call("GET", "/api/v1/work-logs/" + old_log_id, employee)
    check("8.2 the log is frozen at 00:00:00", status == 200 and after_midnight.get("editable") is False,
          after_midnight)
    status, frozen, _ = api.call("PATCH", "/api/v1/work-logs/" + old_log_id, employee,
                                 {"body": marker + " too late"}, api.key(), Api.etag(after_midnight, {}))
    check("8.2 a frozen log cannot be edited", status == 409 and frozen.get("code") == "WORK_LOG_FROZEN", frozen)
    status, frozen, _ = api.call("DELETE", "/api/v1/work-logs/" + old_log_id, employee,
                                 key=api.key(), if_match=Api.etag(after_midnight, {}))
    check("8.2 a frozen log cannot be deleted", status == 409 and frozen.get("code") == "WORK_LOG_FROZEN", frozen)

    new_today = today + dt.timedelta(days=1)
    status, backdated, _ = api.call("POST", "/api/v1/work-logs", employee,
                                    {"body": marker + " backdated", "businessDate": today.isoformat()},
                                    api.key())
    check("8.2 an old day cannot be recreated after midnight", status == 400, backdated)

    status, current, headers = api.call("GET", "/api/v1/work-logs?scope=self&from="
                                        f"{new_today}&to={new_today}", employee)
    check("8.1 the new day starts empty for this author", status == 200 and not current.get("items"), current)

    body = {"body": marker + " concurrent", "businessDate": new_today.isoformat()}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(api.call, "POST", "/api/v1/work-logs", employee, body, api.key())
        second = pool.submit(api.call, "POST", "/api/v1/work-logs", employee, body, api.key())
        results = [first.result(), second.result()]
    statuses = sorted([row[0] for row in results])
    winner = next((row for row in results if row[0] in (200, 201)), None)
    loser = next((row for row in results if row[0] == 409), None)
    check("8.1 concurrent creates with distinct keys produce one row",
          statuses == [200, 409] and loser is not None and loser[1].get("code") == "WORK_LOG_EXISTS"
          and winner is not None and loser[1].get("logId") == winner[1].get("logId"),
          {"statuses": statuses, "bodies": [row[1] for row in results]})
    status, after, _ = api.call("GET", f"/api/v1/work-logs?scope=self&from={new_today}&to={new_today}", employee)
    check("8.1 only one persisted log exists for the new day",
          status == 200 and len(after.get("items", [])) == 1, after)

    utc_date = server_now(api).astimezone(dt.timezone.utc).date()
    status, wrong_zone, _ = api.call("POST", "/api/v1/work-logs", employee,
                                     {"body": marker + " utc", "businessDate": utc_date.isoformat()},
                                     api.key())
    check("8.2 a client timezone date is not accepted as today",
          status == 400 if utc_date != new_today else True, {"utcDate": str(utc_date), "body": wrong_zone})

    # Log scope and author tree are permission-filtered; removed tabs are a browser concern.
    status, authors, _ = api.call("GET", "/api/v1/work-log-authors", api.tokens["middle"])
    names = {row["username"] for row in authors.get("items", [])}
    check("8.3 the author tree contains self and direct reports only",
          status == 200 and {"middle", "employee", "colleague"}.issubset(names)
          and "marketing" not in names and "upper" not in names, sorted(names))
    status, filtered, _ = api.call("GET", "/api/v1/work-log-authors?q=" + urllib.parse.quote("张"), api.tokens["middle"])
    check("8.3 author search keeps only matches inside the permission tree",
          status == 200 and [row["username"] for row in filtered.get("items", [])] == ["employee"], filtered)
    status, outside, _ = api.call("GET", "/api/v1/work-logs?scope=visible&authorId=" + api.tokens["marketing"], api.tokens["middle"])
    check("8.3 an author outside the log range is refused", status in (404, 400), outside)

    return 0 if all(item["pass"] for item in RESULTS) else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:18120")
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    api = Api(args.base_url)
    code = 1
    try:
        code = run(args.base_url)
    except Exception as error:  # noqa: BLE001 - report the real failure in the JSON evidence
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
