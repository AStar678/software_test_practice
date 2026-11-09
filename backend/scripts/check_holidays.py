#!/usr/bin/env python3
"""Isolated real-service verification for the annual holiday contract (tasks 7.1-7.6).

The suite owns a random database, a temporary backend and a local annual-source server. It never
contacts the public internet and never selects the normal business database. The local source serves
the official 2026 notice data in the holiday-cn JSON contract; the live default URL is documented
separately because this Windows host cannot reach raw.githubusercontent.com.
"""
from __future__ import annotations

import argparse
import datetime as dt
import http.server
import json
import os
import pathlib
import sys
import threading
import time
import uuid

from fixed_model_fixture import Fixture

AUDIT = pathlib.Path(__file__).resolve().parents[2] / "audit/prepare-employee-client-contracts-and-business-upgrade"
REPORT: list[dict] = []
NOTICE = "https://www.gov.cn/zhengce/content/202511/content_7047090.htm"


def check(name, condition, evidence=None):
    REPORT.append({"check": name, "pass": bool(condition), "evidence": evidence})
    print(("PASS  " if condition else "FAIL  ") + name +
          ("" if condition else "  -> " + json.dumps(evidence, ensure_ascii=False, default=str)[:1800]), flush=True)
    if not condition:
        raise AssertionError(name)


def call(f, method, path, body=None, token=None, key=None, version=None):
    return f.call(method, path, body, token, key, version)


def ok(f, method, path, body=None, token=None, key=None, version=None):
    status, result = call(f, method, path, body, token, key, version)
    check(method + " " + path.split("?")[0] + " succeeds", status in (200, 201),
          {"status": status, "code": result.get("code"), "message": result.get("message")})
    return result


def expect(status, result, code, name):
    check(name, status in (400, 401, 403, 404, 409, 412, 502) and result.get("code") == code,
          {"status": status, "code": result.get("code"), "message": result.get("message")})


def day(name, date, off):
    return {"name": name, "date": date, "isOffDay": off}


def official_2026():
    days = []
    for name, dates in (
        ("元旦", ["2026-01-01", "2026-01-02", "2026-01-03"]),
        ("春节", [f"2026-02-{d:02d}" for d in range(15, 24)]),
        ("清明节", ["2026-04-04", "2026-04-05", "2026-04-06"]),
        ("劳动节", [f"2026-05-{d:02d}" for d in range(1, 6)]),
        ("端午节", ["2026-06-19", "2026-06-20", "2026-06-21"]),
        ("中秋节", ["2026-09-25", "2026-09-26", "2026-09-27"]),
        ("国庆节", [f"2026-10-{d:02d}" for d in range(1, 8)]),
    ):
        for date in dates:
            days.append(day(name, date, True))
    for name, date in (
        ("元旦", "2026-01-04"),
        ("春节", "2026-02-14"), ("春节", "2026-02-28"),
        ("劳动节", "2026-05-09"),
        ("国庆节", "2026-09-20"), ("国庆节", "2026-10-10"),
    ):
        days.append(day(name, date, False))
    return {"year": 2026, "papers": [NOTICE], "days": sorted(days, key=lambda row: row["date"])}


def simple_year(year):
    return {"year": year,
            "papers": ["https://www.gov.cn/notice/" + str(year)],
            "days": [day("元旦", f"{year}-01-01", True), day("元旦", f"{year}-01-02", False)]}


class Source:
    def __init__(self):
        self.responses: dict[int, tuple[int, bytes]] = {}
        self.counts: dict[int, int] = {}
        self.delays: dict[int, float] = {}
        self.lock = threading.Lock()
        outer = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                year = None
                try:
                    year = int(pathlib.Path(self.path).stem)
                except ValueError:
                    pass
                with outer.lock:
                    outer.counts[year] = outer.counts.get(year, 0) + 1
                    status, body = outer.responses.get(year, (404, b'{"error":"not found"}'))
                    delay = outer.delays.get(year, 0)
                if delay:
                    time.sleep(delay)
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *_args):
                pass

        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def start(self):
        self.thread.start()
        return self

    def stop(self):
        self.server.shutdown()
        self.server.server_close()

    def set(self, year, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode() if not isinstance(payload, bytes) else payload
        with self.lock:
            self.responses[year] = (status, body)

    def set_delay(self, year, seconds):
        with self.lock:
            self.delays[year] = seconds

    def count(self, year):
        with self.lock:
            return self.counts.get(year, 0)

    def total(self):
        with self.lock:
            return sum(self.counts.values())


def header(f, year, token):
    status, result = call(f, "GET", f"/calendar/holidays/{year}", token=token)
    return status, result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=18262)
    parser.add_argument("--skip-background", action="store_true")
    args = parser.parse_args()
    AUDIT.mkdir(parents=True, exist_ok=True)
    source = Source().start()
    source.set(2026, 200, official_2026())
    source.set(2027, 200, simple_year(2027))
    source.set(2028, 404, b"{}")
    os.environ.update(
        PANDORA_HOLIDAY_SOURCE_URL_TEMPLATE=f"http://127.0.0.1:{source.port}/{{year}}.json",
        PANDORA_HOLIDAY_SOURCE_NAME="fixture-holiday-source",
        PANDORA_HOLIDAY_BACKGROUND_ENABLED="false",
    )
    fixture = Fixture(port=args.port)
    fixture.log_path = AUDIT / "holiday-service.log"
    try:
        with fixture as f:
            founder = f.login("founder")[1]["token"]
            employee = f.login("alpha-one-employee")[1]["token"]
            admin = f.login("admin")[1]["token"]
            other = f.login("other-founder")[1]["token"]

            status, missing = header(f, 2026, founder)
            check("an employee reads a missing year as a stable empty state",
                  status == 200 and missing["status"] == "missing" and missing["days"] == []
                  and missing["updatedAt"] is None, missing)
            check("a missing GET does not invoke the external source when background is disabled",
                  source.total() == 0, source.counts)
            status, admin_missing = header(f, 2026, admin)
            check("the independent administrator can read the shared holiday labels outside /admin",
                  status == 200 and admin_missing["status"] == "missing", admin_missing)

            expect(*call(f, "POST", "/admin/calendar/holidays/2026/refresh", token=employee,
                         key="holiday-employee-" + uuid.uuid4().hex),
                   "FORBIDDEN", "an employee cannot refresh a holiday year")
            expect(*call(f, "POST", "/admin/calendar/holidays/2026/refresh", token=admin),
                   "IDEMPOTENCY_KEY_REQUIRED", "an administrator refresh requires an idempotency key")
            expect(*call(f, "POST", "/admin/calendar/holidays/1899/refresh", token=admin,
                         key="holiday-year-" + uuid.uuid4().hex),
                   "INVALID_YEAR", "a year below 1900 is rejected")
            expect(*call(f, "POST", "/admin/calendar/holidays/10000/refresh", token=admin,
                         key="holiday-year-" + uuid.uuid4().hex),
                   "INVALID_YEAR", "a year above 9999 is rejected")

            key = "holiday-2026-" + uuid.uuid4().hex
            fetched = ok(f, "POST", "/admin/calendar/holidays/2026/refresh", token=admin, key=key)
            check("the validated 2026 official notice becomes a ready cache",
                  fetched["status"] == "ready" and fetched["source"] == "fixture-holiday-source"
                  and fetched["updatedAt"] and len(fetched["days"]) == 39, fetched)
            first = fetched["days"][0]
            check("the cache keeps the official New Year rest day and Spring Festival make-up workday",
                  first == {"date": "2026-01-01", "name": "元旦", "isOffDay": True}
                  and any(row["date"] == "2026-02-14" and row["name"] == "春节" and row["isOffDay"] is False
                          for row in fetched["days"]), fetched["days"][:3])
            check("days are sorted by date and contain only that year",
                  [row["date"] for row in fetched["days"]] == sorted(row["date"] for row in fetched["days"])
                  and all(row["date"].startswith("2026-") for row in fetched["days"]), len(fetched["days"]))
            check("the successful admin refresh is recorded in the audit trail",
                  any(row[0] == "holiday.calendar.refreshed" and row[1] == f.identities["admin"]["id"]
                      for row in f.db.rows("SELECT action,actor_id FROM audit_logs WHERE action='holiday.calendar.refreshed'")),
                  f.db.rows("SELECT action,actor_id FROM audit_logs WHERE action='holiday.calendar.refreshed'"))

            count = source.count(2026)
            status, replay = call(f, "POST", "/admin/calendar/holidays/2026/refresh", token=admin, key=key)
            check("an idempotent retry replays without another source request",
                  status == 200 and replay["updatedAt"] == fetched["updatedAt"] and source.count(2026) == count,
                  {"before": count, "after": source.count(2026)})

            # Readers must observe either the complete old year or the complete new year, never a
            # half-deleted/partially-inserted set while a refresh is committing.
            revised = official_2026()
            revised["days"] = [dict(row) for row in revised["days"]]
            revised["days"][0] = dict(revised["days"][0], name="元旦修订")
            source.set(2026, 200, revised)
            source.set_delay(2026, 0.8)
            outcome = []

            def refresh_slowly():
                outcome.append(call(f, "POST", "/admin/calendar/holidays/2026/refresh", token=admin,
                                    key="holiday-slow-" + uuid.uuid4().hex))

            thread = threading.Thread(target=refresh_slowly)
            thread.start()
            time.sleep(0.25)
            status, during = header(f, 2026, founder)
            check("a concurrent reader sees the complete old year before the replace commits",
                  status == 200 and during["status"] == "ready"
                  and during["days"] == fetched["days"] and during["updatedAt"] == fetched["updatedAt"], status)
            thread.join(timeout=10)
            source.set_delay(2026, 0)
            check("the slow refresh completes successfully", outcome and outcome[0][0] == 200, outcome)
            status, replaced = header(f, 2026, founder)
            check("after commit every reader sees the complete new year",
                  status == 200 and replaced["status"] == "ready" and len(replaced["days"]) == 39
                  and replaced["days"][0]["name"] == "元旦修订"
                  and replaced["updatedAt"] != fetched["updatedAt"], replaced["days"][0])
            fetched = replaced

            for label, token in (("founder", founder), ("employee", employee), ("other-company employee", other),
                                 ("independent administrator", admin)):
                status, view = header(f, 2026, token)
                check(f"the ready 2026 labels are readable by {label}",
                      status == 200 and view["status"] == "ready" and len(view["days"]) == 39, status)

            # The labels must not change task schedule/version/reminder semantics.
            scheduled = ok(f, "POST", "/tasks", {
                "title": "节假日排期不变", "description": "假期标签只用于日历标识",
                "priority": "medium", "allDay": False,
                "startAt": "2027-01-01T09:00:00+08:00", "dueAt": "2027-01-04T18:00:00+08:00",
                "assigneeIds": [f.identities["founder"]["id"]],
            }, founder, "holiday-task-" + uuid.uuid4().hex)
            before_task = ok(f, "GET", "/tasks/" + scheduled["taskId"], token=founder)
            fetched = ok(f, "POST", "/admin/calendar/holidays/2026/refresh", token=admin,
                         key="holiday-task-refresh-" + uuid.uuid4().hex)
            after_task = ok(f, "GET", "/tasks/" + scheduled["taskId"], token=founder)
            check("a holiday refresh does not change task start/due/version",
                  all(before_task.get(k) == after_task.get(k) for k in ("startAt", "dueAt", "rowVersion", "allDay")),
                  {k: (before_task.get(k), after_task.get(k)) for k in ("startAt", "dueAt", "rowVersion")})

            # Restart persists the year without another external call.
            restart_baseline = source.count(2026)
            f.restart()
            founder = f.login("founder")[1]["token"]
            status, after_restart = header(f, 2026, founder)
            check("the ready year survives a backend restart with the same source/updatedAt",
                  status == 200 and after_restart["status"] == "ready"
                  and after_restart["updatedAt"] == fetched["updatedAt"]
                  and after_restart["days"] == fetched["days"],
                  {"status": after_restart["status"], "beforeUpdated": fetched["updatedAt"],
                   "afterUpdated": after_restart["updatedAt"], "beforeDays": len(fetched["days"]),
                   "afterDays": len(after_restart["days"]),
                   "firstBefore": fetched["days"][0] if fetched["days"] else None,
                   "firstAfter": after_restart["days"][0] if after_restart["days"] else None})
            check("restart did not fetch the cached year again",
                  source.count(2026) == restart_baseline, {"before": restart_baseline, "after": source.count(2026)})

            # A failed refresh keeps the old complete year and marks stale.
            source.set(2026, 500, b"{}")
            failed_status, failed = call(f, "POST", "/admin/calendar/holidays/2026/refresh", token=admin,
                                         key="holiday-fail-" + uuid.uuid4().hex)
            check("a failed source refresh is a safe 502 with a reason code",
                  failed_status == 502 and failed.get("code") == "HOLIDAY_REFRESH_FAILED"
                  and failed.get("reason") in ("HOLIDAY_SOURCE_HTTP", "HOLIDAY_SOURCE_IO", "HOLIDAY_SOURCE_TIMEOUT"), failed)
            status, stale = header(f, 2026, founder)
            check("a failed refresh preserves the old days/source/updatedAt and reports stale",
                  status == 200 and stale["status"] == "stale" and stale["days"] == fetched["days"]
                  and stale["updatedAt"] == fetched["updatedAt"] and stale["source"] == "fixture-holiday-source",
                  {"status": stale["status"], "updatedAt": stale["updatedAt"], "days": len(stale["days"])})

            # An invalid year payload is rejected whole and leaves no partial data.
            source.set(2027, 200, {"year": 2027, "papers": [NOTICE],
                                  "days": [day("元旦", "2027-01-01", True), day("元旦", "2026-12-31", True)]})
            status, invalid = call(f, "POST", "/admin/calendar/holidays/2027/refresh", token=admin,
                                   key="holiday-invalid-" + uuid.uuid4().hex)
            check("a cross-year payload is rejected without publishing a partial year",
                  status == 502 and invalid.get("code") == "HOLIDAY_REFRESH_FAILED"
                  and invalid.get("reason") == "HOLIDAY_DATE_OUT_OF_YEAR", invalid)
            status, still_missing = header(f, 2027, founder)
            check("the rejected year stays missing and has no fabricated days",
                  status == 200 and still_missing["status"] in ("missing", "stale")
                  and still_missing["days"] == [], still_missing)

            source.set(2027, 200, simple_year(2027))
            repaired = ok(f, "POST", "/admin/calendar/holidays/2027/refresh", token=admin,
                          key="holiday-repair-" + uuid.uuid4().hex)
            check("a repaired 2027 payload replaces only the 2027 year",
                  repaired["status"] == "ready" and len(repaired["days"]) == 2
                  and header(f, 2026, founder)[1]["status"] in ("ready", "stale"), repaired)

            if not args.skip_background:
                # A second fixture exercises startup/daily scheduling and duplicate GET intent control.
                os.environ["PANDORA_HOLIDAY_BACKGROUND_ENABLED"] = "true"
                os.environ["PANDORA_HOLIDAY_WORKER_THREADS"] = "1"
                source.stop()
                source = Source().start()
                source.set(2026, 200, official_2026())
                source.set(2027, 200, simple_year(2027))
                source.set(2028, 404, b"{}")
                os.environ["PANDORA_HOLIDAY_SOURCE_URL_TEMPLATE"] = f"http://127.0.0.1:{source.port}/{{year}}.json"
                bg = Fixture(port=args.port + 1)
                bg.log_path = AUDIT / "holiday-background-service.log"
                with bg as g:
                    deadline = time.time() + 15
                    while time.time() < deadline and (source.count(2026) == 0 or source.count(2027) == 0):
                        time.sleep(.25)
                    check("startup checks the current and next year exactly once each",
                          source.count(2026) == 1 and source.count(2027) == 1, source.counts)
                    token = g.login("founder")[1]["token"]
                    first = header(g, 2028, token)
                    second = header(g, 2028, token)
                    check("repeated reads of a missing year coalesce into one bounded intent",
                          first[1]["status"] == "missing" and second[1]["status"] == "missing"
                          and source.count(2028) == 1, {"count": source.count(2028), "first": first[0]})
                    time.sleep(1)
                    check("an unavailable year is not retried on every GET",
                          source.count(2028) == 1, source.count(2028))
                    check("the background fixture still serves the ready cached years",
                          header(g, 2026, token)[1]["status"] == "ready"
                          and header(g, 2027, token)[1]["status"] == "ready", source.counts)
                os.environ["PANDORA_HOLIDAY_BACKGROUND_ENABLED"] = "false"
    finally:
        try:
            source.stop()
        except Exception:
            pass
        (AUDIT / "holiday-check.json").write_text(json.dumps(
            {"updated": dt.datetime.now(dt.timezone.utc).isoformat(), "checks": REPORT},
            ensure_ascii=False, indent=2, default=str))
        failed = [row for row in REPORT if not row["pass"]]
        print(json.dumps({"total": len(REPORT), "failed": len(failed),
                          "report": str(AUDIT / "holiday-check.json")}, ensure_ascii=False), flush=True)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
