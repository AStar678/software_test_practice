#!/usr/bin/env python3
"""Exercise workspace refinements against an isolated, seeded MySQL database."""
from collections import Counter
from contextlib import contextmanager
import datetime as dt
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import tempfile
from threading import Thread
import time
import uuid

from check_helpers import running_database
from fixed_model_fixture import Fixture, quote
from migration_precheck import BASE, DEFAULT_OPTION_FILE, Mysql
from prepare_demo import database_env, prepare


@contextmanager
def holiday_source():
    hits = Counter()
    unavailable = set()
    years = {
        2027: [{"date": "2027-01-01", "name": "元旦", "isOffDay": True},
               {"date": "2027-01-31", "name": "春节", "isOffDay": False}],
        2035: [{"date": "2034-12-31", "name": "元旦", "isOffDay": True},
               {"date": "2035-01-02", "name": "接口验收节日", "isOffDay": True}],
        2036: [{"date": "2036-02-30", "name": "错误日期", "isOffDay": True}]
    }

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            year = int(self.path.rsplit("/", 1)[-1].removesuffix(".json"))
            hits[year] += 1
            if year in unavailable:
                self.send_error(502)
                return
            if year not in years:
                self.send_error(404)
                return
            payload = json.dumps({"year": year, "days": years[year]}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *_):
            pass

    with ThreadingHTTPServer(("127.0.0.1", 0), Handler) as server:
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{server.server_port}/", hits, unavailable, years
        finally:
            server.shutdown()
            thread.join()


def check_upgrade(scratch):
    fixture = Fixture(port=18198)
    fixture.migration_target = 31
    fixture.log_path = Path(scratch) / "upgrade.log"
    with fixture:
        founder = fixture.identities["founder"]
        token = fixture.login("founder")[1]["token"]
        org, author = founder["organizationId"], founder["id"]
        status, task = fixture.call("POST", "/tasks", {
            "title": "旧库任务与日志关联",
            "description": "迁移前已有业务",
            "priority": "medium",
            "allDay": False,
            "startAt": "2040-02-29T09:00:00+08:00",
            "dueAt": "2040-02-29T18:00:00+08:00",
            "assigneeIds": [author]
        }, token, uuid.uuid4().hex)
        assert status in (200,201), (status, task)
        task_id, log_id = task["taskId"], uuid.uuid4().hex
        fixture.db.server_side(
            "INSERT INTO work_logs(id,organization_id,author_id,business_date,body,task_id,created_at) VALUES(" +
            ",".join(map(quote, (log_id, org, author, "2024-02-29", "存量补写日志", task_id, "2024-03-01 04:00:00"))) + ")"
        )
        fixture.db.server_side("INSERT INTO user_task_pins(organization_id,user_id,task_id) VALUES(" +
                               ",".join(map(quote, (org, author, task_id))) + ")")
        fixture.restart()
        assert fixture.db.scalar("SELECT MAX(CAST(version AS UNSIGNED)) FROM flyway_schema_history WHERE success=1") >= 34
        status, log = fixture.call("GET", "/work-logs/" + log_id, token=token)
        assert status == 200 and log["taskId"] == task_id and log["businessDate"] == "2024-02-29"
        assert log["createdAt"] == "2024-03-01T04:00:00Z" and log["frozen"]
        status, task = fixture.call("GET", "/tasks/" + task_id, token=token)
        assert status == 200 and task["pinned"] and not task["tablePinned"]
        status, person = fixture.call("GET", "/me", token=token)
        assert status == 200 and person["employmentStartDate"] is None
        print("PASS V31 upgrade preserves legacy log reference, freeze and calendar pin", flush=True)


def main():
    name = "pandora_precheck_workspace_" + uuid.uuid4().hex[:12]
    admin = Mysql(None, DEFAULT_OPTION_FILE)
    with tempfile.TemporaryDirectory(prefix="pandora-workspace-") as scratch, holiday_source() as (source, hits, unavailable, years):
        check_upgrade(scratch)
        admin.server_side(f"CREATE DATABASE `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci")
        try:
            user = database_env()["PANDORA_DB_USER"]
            for host in ("localhost", "127.0.0.1"):
                admin.server_side(f"GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,REFERENCES,DROP ON `{name}`.* TO {quote(user)}@{quote(host)}")
            manifest = prepare(name, "workspace-refinement", True, 18196)
            password = database_env().get("PANDORA_DEMO_PASSWORD", "Demo@123456")
            with running_database(name, 18197, Path(scratch) / "service.log",
                                  extra=("--pandora.holidays.source="+source, "--pandora.clock.controllable=true",
                                         "--pandora.holidays.sync-delay-ms=250")):
                fixture = Fixture(port=18197)
                fixture.identities = manifest["identities"]
                tokens = {}
                for role in ("upper", "middle", "product-head-1", "employee", "admin"):
                    status, session = fixture.login(role, password)
                    assert status == 200, (role, status)
                    tokens[role] = session["token"]

                def call(role, method, path, body=None, version=None, key=None, expected=200):
                    status, result = fixture.call(method, path, body, tokens[role], key or uuid.uuid4().hex, version)
                    assert status == expected, (role, method, path, status, result)
                    return result

                def wait_for_hits(year, expected):
                    deadline = time.monotonic() + 8
                    while hits[year] < expected and time.monotonic() < deadline:
                        time.sleep(.05)
                    assert hits[year] == expected, (year, expected, hits[year])

                def china_now():
                    now = call("admin", "GET", "/admin/clock")["now"]
                    return dt.datetime.fromisoformat(now.replace("Z", "+00:00")).astimezone(dt.timezone(dt.timedelta(hours=8)))

                current_year = china_now().year
                for year in (current_year, current_year + 1):
                    wait_for_hits(year, 1)
                holiday = call("employee", "GET", "/holidays/2027")
                assert holiday["status"] == "available" and [day["work"] for day in holiday["days"]] == [False, True]
                assert call("upper", "GET", "/holidays/2027") == holiday and hits[2027] == 1
                assert call("employee", "GET", "/holidays/2035")["days"][0]["name"] == "接口验收节日"
                assert call("employee", "GET", "/holidays/2034")["days"] == [{"date": "2034-12-31", "name": "元旦", "work": False}]
                assert call("employee", "GET", "/holidays/2036")["status"] == "unavailable"
                unavailable.add(2038)
                assert call("employee", "GET", "/holidays/2037")["status"] == "unpublished"
                assert call("employee", "GET", "/holidays/2038")["status"] == "unavailable"
                print("PASS annual API normalization, cache, unpublished year and upstream failure", flush=True)

                def object_id(key):
                    return manifest["objects"][key]["id"]

                validation = object_id("task-rollout-validation")
                creator_only = object_id("task-creator-only")
                unrelated = object_id("task-rollout-product")
                pin_path = f"/tasks/{creator_only}/table-pin"
                replay_key = uuid.uuid4().hex
                for _ in range(2):
                    assert call("employee", "PUT", pin_path, key=replay_key)["tablePinned"]
                call("employee", "PUT", f"/tasks/{unrelated}/table-pin", expected=404)
                employee_rows = call("employee", "GET", "/tasks?creatorId=" + fixture.identities["employee"]["id"])["items"]
                row = next(task for task in employee_rows if task["id"] == creator_only)
                assert row["tablePinned"] and not row["pinned"]
                upper_row = next(task for task in call("upper", "GET", "/tasks?creatorId=" + fixture.identities["employee"]["id"])["items"] if task["id"] == creator_only)
                assert not upper_row["tablePinned"]
                assert not call("employee", "DELETE", pin_path)["tablePinned"]
                print("PASS personal table pin, authorization, replay and calendar isolation", flush=True)

                yesterday = (dt.date.fromisoformat(manifest["businessDate"]) - dt.timedelta(days=1)).isoformat()
                path = f"/work-logs/{object_id('log-employee-1')}"
                before = call("employee", "GET", path)
                preview = call("employee", "GET", "/work-logs/reference-preview?businessDate=" + yesterday)
                assert preview["dailyItems"] and validation in {task["id"] for task in preview["tasks"]}
                assert all(item["date"] == yesterday for item in preview["dailyItems"])
                for role in ("upper", "middle", "product-head-1"):
                    refs = call(role, "GET", path)["references"]
                    assert "dailyItems" not in refs
                call("employee", "DELETE", path, version=before["rowVersion"])
                body = {"businessDate": yesterday, "body": "补写试点校验与客户反馈"}
                replay_key = uuid.uuid4().hex
                restored = call("employee", "POST", "/work-logs", body, key=replay_key)
                assert restored == call("employee", "POST", "/work-logs", body, key=replay_key)
                after = call("employee", "GET", path)
                assert after["createdAt"] == before["createdAt"] and after["businessDate"] == yesterday
                assert after["references"] == preview
                call("employee", "PATCH", path, {"body": "补充开通记录"}, version=after["rowVersion"])
                assert call("employee", "GET", path)["references"] == preview
                print("PASS business-date log references, privacy, edit and restore replay", flush=True)

                employee_id = fixture.identities["employee"]["id"]
                date = "2024-02-29"
                employee_path = "/admin/employees/" + employee_id
                entry = call("admin", "GET", employee_path)
                call("admin", "PATCH", employee_path, {"employmentStartDate": "2025-02-29"}, version=entry["rowVersion"], expected=400)
                call("admin", "PATCH", employee_path, {"employmentStartDate": date}, version=entry["rowVersion"])
                # Employment updates invalidate old authority snapshots. Open fresh sessions.
                for role in ("employee", "upper"):
                    status, session = fixture.login(role, password)
                    assert status == 200
                    tokens[role] = session["token"]
                me = call("employee", "GET", "/me")
                staff = call("upper", "GET", "/users/" + employee_id)
                days = (dt.date.fromisoformat(manifest["businessDate"]) - dt.date.fromisoformat(date)).days + 1
                assert me["employmentDays"] == staff["employmentDays"] == days and staff["employmentStartDate"] == date
                directory = call("upper", "GET", "/users?limit=100")["items"]
                assert all("employmentStartDate" not in person for person in directory)
                print("PASS authorized employment date, leap day and directory privacy", flush=True)

                missing_path = f"/work-logs/{object_id('log-employee-2')}"
                existing = call("employee", "GET", missing_path)
                call("employee", "DELETE", missing_path, version=existing["rowVersion"])
                browser = BASE / "scripts/check_workspace_refinement_browser.js"
                if os.environ.get("CHROME_BIN"):
                    subprocess.run(["node", str(browser), "http://127.0.0.1:18197/"], check=True,
                                   env={**os.environ, "PANDORA_DEMO_PASSWORD": password})
                else:
                    print("SKIP browser checks. Set CHROME_BIN to run them.", flush=True)
                unavailable.add(2027)
                call("admin", "POST", "/admin/clock/advance", {"seconds": 3601})
                stale = call("employee", "GET", "/holidays/2027")
                assert stale["stale"] and stale["days"] == holiday["days"] and hits[2027] == 2
                unavailable.remove(2027)
                call("admin", "POST", "/admin/clock/advance", {"seconds": 121})
                assert call("employee", "GET", "/holidays/2027") == holiday and hits[2027] == 3
                print("PASS cached holidays survive outage and refresh after recovery", flush=True)

                now = china_now()
                rollover = dt.datetime(now.year + 1, 1, 1, 0, 0, 3, tzinfo=now.tzinfo)
                following = rollover.year + 1
                before = {year: hits[year] for year in (rollover.year, following)}
                call("admin", "POST", "/admin/clock/advance", {"seconds": int((rollover - now).total_seconds())})
                for year in before:
                    wait_for_hits(year, before[year] + 1)
                path = f"/holidays/{following}"
                assert call("employee", "GET", path)["status"] == "unpublished"
                years[following] = [{"date": f"{following}-01-01", "name": "元旦", "isOffDay": True}]
                call("admin", "POST", "/admin/clock/advance", {"seconds": 3601})
                wait_for_hits(following, before[following] + 2)
                assert call("employee", "GET", path)["days"][0]["work"] is False
                years[following] = [{"date": f"{following}-01-02", "name": "元旦", "isOffDay": False}]
                call("admin", "POST", "/admin/clock/advance", {"seconds": 3601})
                wait_for_hits(following, before[following] + 3)
                assert call("employee", "GET", path)["days"] == [{"date": f"{following}-01-02", "name": "元旦", "work": True}]
                print("PASS background sync without calendar requests, China year rollover, new notice and revised dates", flush=True)
        finally:
            admin.server_side(f"DROP DATABASE IF EXISTS `{name}`")


if __name__ == "__main__":
    main()
