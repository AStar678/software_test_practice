#!/usr/bin/env python3
"""Isolated extreme fixture for chapter 9.3.

The default animation demo must stay small. This disposable service owns the >100-row pagination,
dense overlap and all-day data, cross-year/midnight/zero-length schedules and cross-account denial.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import uuid

from fixed_model_fixture import Fixture

AUDIT = pathlib.Path(__file__).resolve().parents[2] / "audit/prepare-employee-client-contracts-and-business-upgrade"
REPORT: list[dict] = []


def check(name, condition, evidence=None):
    REPORT.append({"check": name, "pass": bool(condition), "evidence": evidence})
    print(("PASS  " if condition else "FAIL  ") + name, flush=True)
    if not condition:
        raise AssertionError(name + " " + json.dumps(evidence, ensure_ascii=False, default=str)[:1200])


def call(f, method, path, body=None, token=None, key=None):
    return f.call(method, path, body, token, key)


def ok(f, method, path, body=None, token=None, key=None):
    status, result = call(f, method, path, body, token, key)
    check(method + " " + path.split("?")[0] + " succeeds", status in (200, 201),
          {"status": status, "code": result.get("code")})
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=18280)
    args = parser.parse_args()
    AUDIT.mkdir(parents=True, exist_ok=True)
    fixture = Fixture(port=args.port)
    fixture.log_path = AUDIT / "demo-extremes-service.log"
    try:
        with fixture as f:
            founder = f.login("founder")[1]["token"]
            employee = f.identities["alpha-one-employee"]
            employee_token = f.login("alpha-one-employee")[1]["token"]
            other = f.login("other-founder")[1]["token"]
            day = "2027-03-10"
            for i in range(105):
                status, result = call(f, "POST", "/tasks", {
                    "title": f"极限分页镜头 {i:03d}", "description": "隔离极限夹具",
                    "priority": "medium", "allDay": False,
                    "startAt": f"{day}T09:00:00+08:00", "dueAt": f"{day}T18:00:00+08:00",
                    "assigneeIds": [employee["id"]],
                }, founder, "extreme-task-" + uuid.uuid4().hex)
                if status not in (200, 201):
                    raise RuntimeError((status, result))
            for i in range(6):
                ok(f, "POST", "/tasks", {
                    "title": f"Extreme overlap {i}", "description": "same six-way timed overlap", "priority": "high",
                    "allDay": False, "startAt": f"{day}T10:00:00+08:00", "dueAt": f"{day}T12:00:00+08:00",
                    "assigneeIds": [employee["id"]],
                }, founder, "extreme-overlap-" + uuid.uuid4().hex)
                ok(f, "POST", "/tasks", {
                    "title": f"Extreme all-day {i}", "description": "same six all-day rows", "priority": "low",
                    "allDay": True, "startDate": day, "dueDate": day,
                    "assigneeIds": [employee["id"]],
                }, founder, "extreme-allday-" + uuid.uuid4().hex)
            special = {}
            for key, body in (
                ("cross-year", {"allDay": False, "startAt": "2026-12-31T20:00:00+08:00", "dueAt": "2027-01-01T10:00:00+08:00"}),
                ("midnight", {"allDay": False, "startAt": f"{day}T10:00:00+08:00", "dueAt": "2027-03-11T00:00:00+08:00"}),
                ("point", {"allDay": False, "startAt": f"{day}T00:00:00+08:00", "dueAt": f"{day}T00:00:00+08:00"}),
            ):
                schedule = {"title": "极限档期 " + key, "description": "极端档期夹具", "priority": "urgent",
                            "assigneeIds": [employee["id"]], **body}
                result = ok(f, "POST", "/tasks", schedule, founder, "extreme-special-" + key + uuid.uuid4().hex)
                special[key] = result["taskId"]
            for i in range(101):
                ok(f, "POST", "/daily-items", {
                    "startDate": day, "endDate": day,
                    "body": f"极限事项 {i:03d}：同一天的长清单。",
                }, employee_token, "extreme-item-" + uuid.uuid4().hex)

            table = ok(f, "GET", "/tasks/table?relation=all&limit=100&offset=0", token=founder)
            check("the isolated fixture has more than 100 table rows",
                  table["total"] >= 111 and len(table["items"]) == 100 and table["nextOffset"] == 100, table["total"])
            second = ok(f, "GET", "/tasks/table?relation=all&limit=100&offset=100", token=founder)
            check("the second page contains the remaining extreme rows",
                  len(second["items"]) >= 11 and second["total"] == table["total"], len(second["items"]))
            items = ok(f, "GET", f"/daily-items?date={day}&limit=100&offset=0", token=employee_token)
            check("the same day holds more than one page of personal items",
                  items["total"] > 100 and len(items["items"]) == 100 and items["nextOffset"] == 100, items["total"])
            overlap = ok(f, "GET", "/tasks/table?relation=all&q=Extreme%20overlap&limit=100", token=founder)
            allDay = ok(f, "GET", "/tasks/table?relation=all&q=Extreme%20all-day&limit=100", token=founder)
            check("six overlapping timed tasks and six all-day tasks are real rows",
                  overlap.get("total") == 6 and allDay.get("total") == 6,
                  {"overlap": overlap.get("total"), "allDay": allDay.get("total")})
            check("cross-year/midnight/zero-length tasks are readable with real ids",
                  all(ok(f, "GET", "/tasks/" + task, token=founder)["id"] == task for task in special.values()))
            deny = call(f, "GET", f"/daily-items?date={day}", token=other)
            check("another organization cannot read the extreme personal items",
                  deny[0] == 404 or (deny[0] == 200 and deny[1].get("total") == 0), deny[0])
    finally:
        (AUDIT / "demo-extremes.json").write_text(json.dumps(
            {"updated": dt.datetime.now(dt.timezone.utc).isoformat(), "checks": REPORT},
            ensure_ascii=False, indent=2, default=str))
        failed = [row for row in REPORT if not row["pass"]]
        print(json.dumps({"total": len(REPORT), "failed": len(failed),
                          "report": str(AUDIT / "demo-extremes.json")}, ensure_ascii=False), flush=True)
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
