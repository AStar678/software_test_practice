#!/usr/bin/env python3
"""Isolated verification for the employee-client contract baseline (tasks 1.2 and 2.1-6.4).

The suite owns random databases and temporary services; it never selects the normal business
database. It captures an upgrade witness at V31, upgrades to V34, then exercises the real daily-item
range contract, the server-side personal task table and its independent pin, the read-only log fill
source, and the hire-date/tenure/e-mail projections.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import uuid
from zoneinfo import ZoneInfo

from fixed_model_fixture import Fixture
from migration_precheck import BASE, DEFAULT_OPTION_FILE, Mysql, MysqlError

AUDIT = BASE.parent / "audit/prepare-employee-client-contracts-and-business-upgrade"
REPORT: list[dict] = []
PASSWORD = "Fixture@123456"


def check(name, condition, evidence=None):
    REPORT.append({"check": name, "pass": bool(condition), "evidence": evidence})
    print(("PASS  " if condition else "FAIL  ") + name +
          ("" if condition else "  -> " + json.dumps(evidence, ensure_ascii=False, default=str)[:1500]), flush=True)
    if not condition:
        raise AssertionError(name)


def call(f, method, path, body=None, token=None, key=None, version=None):
    return f.call(method, path, body, token, key, version)


def ok(f, method, path, body=None, token=None, key=None, version=None):
    status, result = call(f, method, path, body, token, key, version)
    check(method + " " + path.split("?")[0] + " succeeds",
          status in (200, 201), {"status": status, "code": result.get("code"), "message": result.get("message")})
    return result


def expect(status, result, code, name):
    check(name, status in (400, 401, 403, 404, 409, 412, 502) and result.get("code") == code,
          {"status": status, "code": result.get("code")})


def witness(port: int):
    """Task 1.2: repeatable upgrade witness on an isolated V31 -> V34 fixture."""
    path = AUDIT / "upgrade-witness.json"
    fixture = Fixture(port=port)
    fixture.migration_target = 31
    fixture.log_path = AUDIT / "upgrade-witness-service.log"
    with fixture as f:
        check("the witness runs on a disposable random database, never the normal business database",
              f.database.startswith("pandora_precheck_model_") and f.database != "pandora", f.database)
        founder = f.login("founder")[1]["token"]
        org = f.identities["founder"]["organizationId"]
        owner = f.identities["alpha-one-employee"]["id"]
        business_day = call(f, "GET", "/home", token=founder)[1]["businessDate"]
        witness_day = (dt.date.fromisoformat(business_day) + dt.timedelta(days=1)).isoformat()
        task = ok(f, "POST", "/tasks", {"title": "升级见证任务", "description": "任务与标签在升级后不变",
                    "priority": "high", "allDay": False,
                    "startAt": witness_day + "T09:00:00+08:00", "dueAt": witness_day + "T10:00:00+08:00",
                    "assigneeIds": [f.identities["founder"]["id"]]}, founder, "witness-task-" + uuid.uuid4().hex)
        tag = ok(f, "POST", "/tags", {"name": "升级见证标签", "color": "#F6D5D2"}, founder,
                 "witness-tag-" + uuid.uuid4().hex)
        log = ok(f, "POST", "/work-logs", {"businessDate": business_day, "body": "升级见证日志", "tagIds": [tag["tagId"]]},
                 founder, "witness-log-" + uuid.uuid4().hex)
        ok(f, "PUT", "/tasks/" + task["taskId"] + "/pin", None, founder, "witness-pin-" + uuid.uuid4().hex)
        f.db.server_side("INSERT INTO daily_items(id,organization_id,owner_id,item_date,body,completed,row_version) "
                         "VALUES('witness-daily','" + org + "','" + owner + "','2026-11-01','升级见证事项',1,3)")

        def checksums():
            return {row[0]: row[1] for row in f.db.rows(
                "SELECT version,checksum FROM flyway_schema_history WHERE success=1 AND version IS NOT NULL ORDER BY installed_rank")}

        def daily():
            return f.db.rows("SELECT id,organization_id,owner_id,item_date,body,completed,row_version FROM daily_items WHERE id='witness-daily'")

        before = {"checksums": checksums(), "daily": daily(),
                  "tasks": f.db.rows("SELECT * FROM tasks WHERE id='" + task["taskId"] + "'"),
                  "taskVersions": f.db.rows("SELECT * FROM task_versions WHERE task_id='" + task["taskId"] + "'"),
                  "logs": f.db.rows("SELECT * FROM work_logs WHERE id='" + log["logId"] + "'"),
                  "logTags": f.db.rows("SELECT * FROM work_log_tags WHERE log_id='" + log["logId"] + "' ORDER BY ordinal"),
                  "pins": f.db.rows("SELECT * FROM user_task_pins WHERE task_id='" + task["taskId"] + "'"),
                  "users": f.db.rows("SELECT id,display_name,phone,login_phone FROM users ORDER BY id")}
        check("witness fixture starts at V31 with a real task, tag, log, calendar pin and single-day item",
              before["checksums"].get("31") is not None and len(before["daily"]) == 1 and len(before["pins"]) == 1,
              {"v31": before["checksums"].get("31"), "daily": before["daily"], "pins": before["pins"]})
        f.restart()
        after = {"checksums": checksums(), "daily": f.db.rows(
                     "SELECT id,organization_id,owner_id,start_date,end_date,body,completed,row_version FROM daily_items WHERE id='witness-daily'"),
                 "tasks": f.db.rows("SELECT * FROM tasks WHERE id='" + task["taskId"] + "'"),
                 "taskVersions": f.db.rows("SELECT * FROM task_versions WHERE task_id='" + task["taskId"] + "'"),
                 "logs": f.db.rows("SELECT * FROM work_logs WHERE id='" + log["logId"] + "'"),
                 "logTags": f.db.rows("SELECT * FROM work_log_tags WHERE log_id='" + log["logId"] + "' ORDER BY ordinal"),
                 "pins": f.db.rows("SELECT * FROM user_task_pins WHERE task_id='" + task["taskId"] + "'"),
                 "users": f.db.rows("SELECT id,display_name,phone,login_phone FROM users ORDER BY id"),
                 "columns": {table: [row[0] for row in f.db.rows(
                     "SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='" + table + "' ORDER BY ordinal_position")]
                     for table in ("daily_items", "user_task_table_pins", "holiday_calendar_years", "holiday_calendar_days")},
                 "tablePins": f.db.rows("SELECT * FROM user_task_table_pins"),
                 "holidayRows": f.db.rows("SELECT * FROM holiday_calendar_days"),
                 "hireDates": f.db.rows("SELECT COUNT(*) FROM users WHERE hire_date IS NOT NULL"),
                 "holidayColumns": [row[0] for row in f.db.rows(
                     "SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() "
                     "AND table_name='holiday_calendar_years' ORDER BY ordinal_position")],
                 "constraints": {table: f.db.rows(
                     "SELECT constraint_name,constraint_type FROM information_schema.table_constraints "
                     "WHERE table_schema=DATABASE() AND table_name='" + table + "' ORDER BY constraint_name")
                     for table in ("daily_items", "user_task_table_pins")}}
        check("V32-V35 are applied and historical checksums never change",
              all(after["checksums"].get(version) == checksum for version, checksum in before["checksums"].items())
              and all(after["checksums"].get(version) for version in ("32", "33", "34", "35")),
              {"before": before["checksums"], "after": after["checksums"]})
        before_row = dict(zip(["id", "organization_id", "owner_id", "item_date", "body", "completed", "row_version"], before["daily"][0]))
        row = after["daily"][0]
        values = dict(zip(["id", "organization_id", "owner_id", "start_date", "end_date", "body", "completed", "row_version"], row))
        check("the single-day witness maps losslessly to start=end=original date",
              values.get("start_date") == "2026-11-01" and values.get("end_date") == "2026-11-01"
              and values.get("id") == before_row.get("id") and values.get("owner_id") == before_row.get("owner_id")
              and values.get("body") == before_row.get("body") and values.get("completed") == before_row.get("completed")
              and values.get("row_version") == before_row.get("row_version"),
              {"before": before_row, "after": values})
        check("task, version, log, shared tag and calendar pin rows stay byte-identical",
              after["tasks"] == before["tasks"] and after["taskVersions"] == before["taskVersions"]
              and after["logs"] == before["logs"] and after["logTags"] == before["logTags"]
              and after["pins"] == before["pins"] and after["users"] == before["users"],
              {"tasks": after["tasks"] == before["tasks"], "logs": after["logs"] == before["logs"],
               "pins": after["pins"] == before["pins"], "users": after["users"] == before["users"]})
        check("new structures start empty and hire_date stays null rather than derived from created_at",
              after["tablePins"] == [] and after["holidayRows"] == [] and after["hireDates"][0][0] == "0"
              and {"start_date", "end_date"} <= set(after["columns"]["daily_items"])
              and "hire_date" in [row[0] for row in f.db.rows(
                  "SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users'")],
              {"tablePins": after["tablePins"], "holiday": after["holidayRows"], "hire": after["hireDates"], "daily": after["columns"]["daily_items"]})
        path.write_text(json.dumps({"updated": dt.datetime.now(dt.timezone.utc).isoformat(), "before": before, "after": after},
                                   ensure_ascii=False, indent=2, default=str))
        # Backup/restore rehearsal on the upgraded database: dump, import into a throwaway database
        # and compare the business rows the migration must never rewrite.
        def fingerprint(database_client):
            return {table: database_client.rows("SELECT * FROM " + table + " ORDER BY 1") for table in
                    ("daily_items", "tasks", "task_versions", "work_logs", "work_log_tags", "user_task_pins", "users")}

        scratch = "pandora_witness_restore_" + uuid.uuid4().hex[:12]
        f.admin.server_side("CREATE DATABASE `" + scratch + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci")
        try:
            with tempfile.TemporaryDirectory(prefix="pandora-witness-backup-") as temporary:
                backup = pathlib.Path(temporary) / "witness.sql"
                with backup.open("w") as stream:
                    subprocess.run(["mysqldump", "--defaults-file=" + str(DEFAULT_OPTION_FILE), "--no-tablespaces",
                                    "--single-transaction", "--set-gtid-purged=OFF", "--column-statistics=0",
                                    f.database], stdout=stream, stderr=subprocess.PIPE, text=True, check=True)
                f.admin.import_sql(backup, scratch)
                restored = Mysql(scratch, DEFAULT_OPTION_FILE)
                check("a real backup restores the upgraded witness database with identical business rows",
                      fingerprint(restored) == fingerprint(f.db),
                      {"size": os.path.getsize(backup)})
        finally:
            f.admin.server_side("DROP DATABASE IF EXISTS `" + scratch + "`")
        try:
            f.db.server_side("INSERT INTO daily_items(id,organization_id,owner_id,start_date,end_date,body,completed,row_version) "
                             "VALUES('bad-range','" + org + "','" + owner + "','2026-11-05','2026-11-01','非法范围',0,1)")
            invalid_range = False
        except MysqlError:
            invalid_range = True
        check("the database rejects an inverted item range", invalid_range,
              after["constraints"]["daily_items"])
        check("the independent table-pin structure has a composite uniqueness key and the holiday header stores source/refresh state",
              any(row[0] == "PRIMARY" for row in after["constraints"]["user_task_table_pins"])
              and {"source", "fetched_at", "last_failure_code", "official_notice"} <= set(after["holidayColumns"]),
              {"pins": after["constraints"]["user_task_table_pins"], "holiday": after["holidayColumns"]})
        check("the witness artefact is written for independent review", path.exists() and path.stat().st_size > 1000, str(path))
    # Empty-database chain: every new structure must converge from an empty schema too.
    empty = Fixture(port=port + 2)
    empty.log_path = AUDIT / "empty-database-service.log"
    with empty as f:
        version = f.db.rows("SELECT MAX(CAST(version AS UNSIGNED)) FROM flyway_schema_history WHERE success=1")[0][0]
        columns = {table: {row[0] for row in f.db.rows(
            "SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='" + table + "'")}
            for table in ("daily_items", "user_task_table_pins", "holiday_calendar_years", "holiday_calendar_days")}
        check("an empty database completes the full chain and converges on the new structures",
              version == "35" and {"start_date", "end_date"} <= columns["daily_items"]
              and columns["user_task_table_pins"] and columns["holiday_calendar_years"] and columns["holiday_calendar_days"],
              {"version": version, "columns": {key: sorted(value) for key, value in columns.items()}})


def daily_items(f, ids, business_day):
    """Task 3.1-3.5 on the real service."""
    employee = f.login("alpha-one-employee")[1]["token"]
    peer = f.login("alpha-two-employee")[1]["token"]
    head = f.login("alpha-one-head")[1]["token"]
    admin = f.login("admin")[1]["token"]
    other = f.login("other-founder")[1]["token"]
    start, end = "2026-10-30", "2026-11-03"
    created = ok(f, "POST", "/daily-items", {"startDate": start, "endDate": end, "body": "跨周事项\n第二行"}, employee,
                 "daily-create-" + uuid.uuid4().hex)
    check("creation returns the explicit date pair and a legacy start projection",
          created["startDate"] == start and created["endDate"] == end and created["date"] == start
          and created["rowVersion"] == 1, created)
    item_id = created["id"]
    detail = call(f, "GET", "/daily-items/" + item_id, token=employee)[1]
    check("detail exposes completed/open/overdue and keeps the complete body",
          detail["status"] in ("open", "overdue") and detail["body"] == "跨周事项\n第二行"
          and detail["startDate"] == start and detail["endDate"] == end, detail)
    status, result = call(f, "POST", "/daily-items", {"date": "2026-11-01", "startDate": "2026-11-02", "body": "mixed"}, employee,
                          "daily-mixed-" + uuid.uuid4().hex)
    expect(status, result, "INVALID_INPUT", "mixed legacy and pair dates are rejected")
    status, result = call(f, "POST", "/daily-items", {"startDate": "2026-11-03", "endDate": "2026-11-02", "body": "inverted"}, employee,
                          "daily-inverted-" + uuid.uuid4().hex)
    expect(status, result, "INVALID_INPUT", "an inverted range is rejected without partial save")
    legacy = ok(f, "POST", "/daily-items", {"date": "2026-11-05", "body": "旧单日"}, employee, "daily-legacy-" + uuid.uuid4().hex)
    check("a legacy date still saves a single-day record", legacy["startDate"] == legacy["endDate"] == "2026-11-05", legacy)
    listed = call(f, "GET", "/daily-items?date=2026-11-01", token=employee)[1]
    check("the day list returns a ranged record once and the legacy record only on its own day",
          [item["id"] for item in listed["items"]] == [item_id] and listed["total"] == 1, listed)
    ranged = call(f, "GET", "/daily-items?from=2026-11-02&to=2026-11-04", token=employee)[1]
    check("range mode returns intersecting records with the original full pair",
          [item["id"] for item in ranged["items"]] == [item_id]
          and ranged["items"][0]["startDate"] == start and ranged["items"][0]["endDate"] == end
          and ranged["from"] == "2026-11-02" and ranged["to"] == "2026-11-04", ranged)
    check("range mode pagination metadata and company date are explicit",
          {"items", "total", "limit", "offset", "nextOffset", "businessDate", "organizationTimeZone"} <= set(ranged),
          sorted(ranged))
    status, result = call(f, "GET", "/daily-items?from=2026-01-01&to=2026-12-31", token=employee)
    expect(status, result, "INVALID_INPUT", "a query window above 93 days is rejected, not an empty success")
    status, result = call(f, "GET", "/daily-items?date=2026-11-01&from=2026-11-01&to=2026-11-02", token=employee)
    expect(status, result, "INVALID_INPUT", "date and from/to cannot be mixed")
    status, result = call(f, "GET", "/daily-items?from=2026-11-01", token=employee)
    expect(status, result, "INVALID_INPUT", "a missing range endpoint is rejected")
    long_item = ok(f, "POST", "/daily-items", {"startDate": "2025-12-01", "endDate": "2026-12-31", "body": "跨年长事项"},
                   employee, "daily-long-" + uuid.uuid4().hex)
    long_list = call(f, "GET", "/daily-items?from=2026-06-01&to=2026-06-05", token=employee)[1]
    check("a record longer than the window is returned, never dropped for its own span",
          any(item["id"] == long_item["id"] for item in long_list["items"]), long_list)
    before = call(f, "GET", "/daily-items/" + item_id, token=employee)[1]
    status, result = call(f, "PATCH", "/daily-items/" + item_id, {"date": "2026-11-02"}, employee,
                          "daily-legacy-change-" + uuid.uuid4().hex, before["rowVersion"])
    expect(status, result, "DAILY_ITEM_RANGE_REQUIRED", "a ranged item rejects an old single-date reschedule")
    after = call(f, "GET", "/daily-items/" + item_id, token=employee)[1]
    check("the rejected legacy change writes nothing", after == before, {"before": before, "after": after})
    changed = ok(f, "PATCH", "/daily-items/" + item_id, {"startDate": "2026-10-31", "endDate": "2026-11-04", "body": "编辑后正文"},
                 employee, "daily-pair-change-" + uuid.uuid4().hex, after["rowVersion"])
    check("the pair update changes only the selected record and returns the new range",
          changed["startDate"] == "2026-10-31" and changed["endDate"] == "2026-11-04" and changed["rowVersion"] == after["rowVersion"] + 1,
          changed)
    status, result = call(f, "PATCH", "/daily-items/" + item_id, {"body": "old version"}, employee,
                          "daily-stale-" + uuid.uuid4().hex, after["rowVersion"])
    check("an old row version is rejected", status == 412, {"status": status, "code": result.get("code")})
    completed = ok(f, "PATCH", "/daily-items/" + item_id, {"completed": True}, employee,
                   "daily-complete-" + uuid.uuid4().hex, changed["rowVersion"])
    check("completing from one covered day keeps the full range", completed["startDate"] == "2026-10-31"
          and completed["endDate"] == "2026-11-04", completed)
    for day in ("2026-10-31", "2026-11-01", "2026-11-04"):
        item = next(row for row in call(f, "GET", "/daily-items?date=" + day, token=employee)[1]["items"] if row["id"] == item_id)
        check("the same completed record is visible on " + day, item["completed"] is True and item["status"] == "completed", item)
    summary = call(f, "GET", "/daily-items/summary?from=2026-10-30&to=2026-11-05", token=employee)[1]
    by_date = {row["date"]: row for row in summary["days"]}
    check("the summary counts the ranged record once on every covered day",
          all(by_date.get(day, {}).get("completedCount") == 1 for day in ("2026-10-31", "2026-11-01", "2026-11-04"))
          and by_date.get("2026-10-30", {}).get("completedCount", 0) == 0
          and by_date.get("2026-11-05", {}).get("completedCount", 0) == 0, summary["days"])
    reopened = ok(f, "PATCH", "/daily-items/" + item_id, {"completed": False}, employee,
                  "daily-reopen-" + uuid.uuid4().hex, completed["rowVersion"])
    check("reopening keeps the range and returns the same record", reopened["startDate"] == "2026-10-31"
          and reopened["endDate"] == "2026-11-04" and reopened["completed"] is False, reopened)
    deleted = ok(f, "DELETE", "/daily-items/" + item_id, None, employee,
                 "daily-delete-" + uuid.uuid4().hex, reopened["rowVersion"])
    check("delete removes only the selected record", deleted.get("deleted") is True, deleted)
    remaining = call(f, "GET", "/daily-items/summary?from=2026-10-31&to=2026-11-04", token=employee)[1]["days"]
    check("all old covered days lose the deleted count",
          sum(row["completedCount"] for row in remaining) == 0, remaining)
    for label, token in (("peer", peer), ("head", head), ("other company", other)):
        status, _ = call(f, "GET", "/daily-items?date=2026-11-05", token=token)
        items = call(f, "GET", "/daily-items?date=2026-11-05", token=token)[1]["items"] if status == 200 else []
        check(label + " cannot read another person's items", all(row["id"] != legacy["id"] for row in items), items)
        status, _ = call(f, "PATCH", "/daily-items/" + legacy["id"], {"body": "hijack"}, token, "hijack-" + uuid.uuid4().hex, 1)
        check(label + " cannot write another person's item", status == 404, status)
    status, result = call(f, "GET", "/daily-items?date=2026-11-05", token=admin)
    expect(status, result, "BUSINESS_ROLE_REQUIRED", "the independent administrator cannot use the item API")
    key = "daily-idem-" + uuid.uuid4().hex
    first = ok(f, "POST", "/daily-items", {"startDate": "2026-11-06", "endDate": "2026-11-06", "body": "幂等"}, employee, key)
    second = ok(f, "POST", "/daily-items", {"startDate": "2026-11-06", "endDate": "2026-11-06", "body": "幂等"}, employee, key)
    check("the same payload and idempotency key never creates a duplicate record", first["id"] == second["id"], {"first": first, "second": second})


def task_table(f, ids, business_day):
    """Task 4.1-4.5 and 4.2 collation on the real service."""
    founder = f.login("founder")[1]["token"]
    employee = f.login("alpha-one-employee")[1]["token"]
    head = f.login("alpha-one-head")[1]["token"]
    titles = ["阿分镜", "波分镜", "分镜10", "分镜2", "a任务", "A任务", "café", "cafe\u0301"]
    titles += ["批量条目%03d" % index for index in range(100)]
    day = "2026-11-12"
    created = []
    for index, title in enumerate(titles):
        result = ok(f, "POST", "/tasks", {"title": title, "description": "表单排序夹具", "priority": "medium",
                    "allDay": False, "startAt": day + "T09:%02d:00+08:00" % (index % 60),
                    "dueAt": day + "T10:%02d:00+08:00" % (index % 60),
                    "assigneeIds": [ids["alpha-one-employee"]]}, founder, "table-task-%03d-" % index + uuid.uuid4().hex)
        created.append(result["taskId"])
    check("the isolated table fixture has more than two backend pages", len(created) > 100, len(created))
    unpublished = ok(f, "POST", "/tasks", {"title": "未发布置顶拒绝", "description": "待审", "priority": "low",
                     "allDay": False, "startAt": "2026-11-22T09:00:00+08:00", "dueAt": "2026-11-22T10:00:00+08:00",
                     "assigneeIds": [ids["alpha-two-employee"]]}, employee, "unpublished-pin-" + uuid.uuid4().hex)
    status, result = call(f, "PUT", "/tasks/" + unpublished["taskId"] + "/table-pin", None, employee,
                          "unpublished-pin-attempt-" + uuid.uuid4().hex)
    expect(status, result, "TASK_NOT_PUBLISHED", "an unpublished task cannot be table-pinned")
    check("the unpublished task is absent from the personal table",
          call(f, "GET", "/tasks/table?relation=created&limit=100", token=employee)[1]["total"] == 0, "absent")
    first = call(f, "GET", "/tasks/table?relation=assigned&sort=title&direction=asc&limit=100", token=employee)[1]
    check("the table reports the full de-duplicated total before paging", first["total"] >= 100 and len(first["items"]) == 100, first["total"])
    pages = []
    for offset in (0, 100):
        page = call(f, "GET", "/tasks/table?relation=assigned&sort=title&direction=asc&limit=100&offset=" + str(offset), token=employee)[1]
        pages.extend(page["items"])
        if page["nextOffset"] is None:
            break
    check("all pages concatenate to one complete global sequence", len(pages) == first["total"], {"pages": len(pages), "total": first["total"]})
    chinese = [row["title"] for row in first["items"] if row["title"] in ("阿分镜", "波分镜", "分镜10", "分镜2")]
    check("the simplified-Chinese collator puts 阿 before 波 and 分镜10 before 分镜2",
          chinese == ["阿分镜", "波分镜", "分镜10", "分镜2"], chinese)
    desc = call(f, "GET", "/tasks/table?relation=assigned&sort=title&direction=desc&limit=100", token=employee)[1]
    desc_titles = [row["title"] for row in desc["items"]]
    check("descending reverses the title comparison without changing the total",
          desc_titles[:2] == ["批量条目099", "批量条目098"] or len(desc_titles) == desc["total"], desc_titles[:4])
    # Query-count evidence for the batch pipeline: one request for 10 rows must not repeat the
    # version/assignee/tag/pin loads once per row.
    f.admin.server_side("SET GLOBAL log_output='TABLE'")
    f.admin.server_side("SET GLOBAL general_log=ON")
    try:
        f.admin.server_side("TRUNCATE TABLE mysql.general_log")
        batched = call(f, "GET", "/tasks/table?relation=assigned&sort=title&direction=asc&limit=10", token=employee)[1]
        f.admin.server_side("SET GLOBAL general_log=OFF")
        queries = [row[0] for row in f.admin.rows("SELECT argument FROM mysql.general_log WHERE command_type='Query'")]
        counts = {name: sum(1 for query in queries if name in query) for name in
                  ("SELECT * FROM task_versions", "SELECT * FROM task_version_tags",
                   "SELECT version_id,user_id FROM task_version_assignees", "SELECT task_id FROM user_task_table_pins")}
        check("the multi-page table query is batched rather than N+1 and returns only the current page",
              len(batched["items"]) == 10 and batched["total"] > 100
              and all(count <= 2 for count in counts.values()), counts)
    finally:
        f.admin.server_side("SET GLOBAL general_log=OFF")
    again = call(f, "GET", "/tasks/table?relation=assigned&sort=title&direction=asc&limit=100", token=employee)[1]
    check("the same request is deterministic", [row["id"] for row in again["items"]] == [row["id"] for row in first["items"]],
          "stable")
    later = first["items"][-1]["id"]
    total_before = first["total"]
    ok(f, "PUT", "/tasks/" + later + "/table-pin", None, employee, "table-pin-" + uuid.uuid4().hex)
    pinned_page = call(f, "GET", "/tasks/table?relation=assigned&sort=title&direction=asc&limit=10", token=employee)[1]
    check("a task pinned from a later page moves to the first page and total is unchanged",
          pinned_page["items"][0]["id"] == later and pinned_page["items"][0]["tablePinned"] is True
          and pinned_page["total"] == total_before, {"id": later, "first": pinned_page["items"][0]["id"], "total": pinned_page["total"]})
    check("a pin does not change the task version or schedule",
          call(f, "GET", "/tasks/" + later, token=employee)[1]["rowVersion"] ==
          next(row["rowVersion"] for row in first["items"] if row["id"] == later), later)
    ok(f, "DELETE", "/tasks/" + later + "/table-pin", None, employee, "table-unpin-" + uuid.uuid4().hex)
    search = call(f, "GET", "/tasks/table?q=%20%E5%88%86%E9%95%9C%20&limit=100", token=employee)[1]
    check("search trims whitespace and matches all four scripted titles",
          search["total"] == 4 and {row["title"] for row in search["items"]} == {"阿分镜", "波分镜", "分镜10", "分镜2"}, search["total"])
    deep_search = call(f, "GET", "/tasks/table?q=%E6%89%B9%E9%87%8F%E6%9D%A1%E7%9B%AE099&limit=100", token=employee)[1]
    check("search reaches a matching task on a later page", deep_search["total"] == 1
          and deep_search["items"][0]["title"] == "批量条目099", deep_search.get("total"))
    check("relation and completion filters compose",
          call(f, "GET", "/tasks/table?relation=created&limit=100", token=employee)[1]["total"] == 0
          and call(f, "GET", "/tasks/table?completion=completed", token=employee)[1]["total"] == 0, "empty")
    single = call(f, "GET", "/tasks/table?from=2026-11-12", token=employee)[1]
    check("a single-ended date filter uses the company date intersection", single["total"] >= 100, single["total"])
    for query, code in (("bogus=1", "INVALID_INPUT"), ("relation=visible", "INVALID_INPUT"),
                        ("sort=title&direction=sideways", "INVALID_INPUT"), ("limit=101", "INVALID_INPUT"),
                        ("from=2026-11-13&to=2026-11-12", "INVALID_INPUT")):
        status, result = call(f, "GET", "/tasks/table?" + query, token=employee)
        expect(status, result, code, "invalid table parameter " + query + " is rejected")
    status, result = call(f, "GET", "/tasks/table?q=" + "x" * 201, token=employee)
    expect(status, result, "INVALID_INPUT", "a query longer than 200 characters is rejected")
    legacy = call(f, "GET", "/tasks?limit=2", token=employee)[1]
    check("the general /tasks list keeps its nextCursor shape and visibility",
          "nextCursor" in legacy and "items" in legacy and isinstance(legacy["nextCursor"], (str, type(None))), legacy)
    # Creator-only provenance: the employee creates for a peer, the direct manager approves, and then
    # the employee may table-pin but never calendar-pin it.
    created_only = ok(f, "POST", "/tasks", {"title": "仅创建待审核", "description": "接管来源", "priority": "low",
                        "allDay": False, "startAt": "2026-11-20T09:00:00+08:00", "dueAt": "2026-11-20T10:00:00+08:00",
                        "assigneeIds": [ids["alpha-two-employee"]]}, employee, "created-only-" + uuid.uuid4().hex)
    request = ok(f, "GET", "/approval-requests/" + created_only["requestId"], token=head)
    ok(f, "PATCH", "/approval-requests/" + created_only["requestId"], {"decision": "approve"}, head,
       "approve-created-" + uuid.uuid4().hex, request["rowVersion"])
    only = call(f, "GET", "/tasks/table?relation=created&limit=100", token=employee)[1]
    check("the published created-but-not-owned task is in the creator relation",
          any(row["id"] == created_only["taskId"] for row in only["items"]), [row["id"] for row in only["items"]][:5])
    status, result = call(f, "PUT", "/tasks/" + created_only["taskId"] + "/table-pin", None, employee,
                          "created-table-pin-" + uuid.uuid4().hex)
    check("a created-but-unassigned task accepts the independent table pin", status == 200 and result["tablePinned"] is True, result)
    status, result = call(f, "PUT", "/tasks/" + created_only["taskId"] + "/pin", None, employee,
                          "created-calendar-pin-" + uuid.uuid4().hex)
    check("the same task cannot be calendar-pinned without being a current owner", status == 403, status)
    detail = call(f, "GET", "/tasks/" + created_only["taskId"], token=employee)[1]
    check("normal detail carries both independent pin capabilities",
          detail["tablePinned"] is True and detail["canTablePin"] is True and detail["canPin"] is False, detail)
    completed = ok(f, "PATCH", "/tasks/" + created_only["taskId"], {"command": "complete", "completionNote": "完成待审"},
                   f.login("alpha-two-employee")[1]["token"], "complete-pending-" + uuid.uuid4().hex,
                   detail["rowVersion"])
    unfin = call(f, "GET", "/tasks/table?completion=unfinished&limit=100", token=employee)[1]
    check("a completion pending review still counts as unfinished",
          any(row["id"] == created_only["taskId"] for row in unfin["items"]), completed)
    # Re-login keeps both preferences independent.
    founder_task = ok(f, "POST", "/tasks", {"title": "双置顶独立", "description": "双偏好", "priority": "medium",
                       "allDay": False, "startAt": "2026-11-21T09:00:00+08:00", "dueAt": "2026-11-21T10:00:00+08:00",
                       "assigneeIds": [ids["alpha-one-employee"]]}, founder, "double-pin-task-" + uuid.uuid4().hex)
    ok(f, "PUT", "/tasks/" + founder_task["taskId"] + "/pin", None, employee, "cal-pin-" + uuid.uuid4().hex)
    ok(f, "PUT", "/tasks/" + founder_task["taskId"] + "/table-pin", None, employee, "tab-pin-" + uuid.uuid4().hex)
    relogin = f.login("alpha-one-employee")[1]["token"]
    both = call(f, "GET", "/tasks/" + founder_task["taskId"], token=relogin)[1]
    check("both pin preferences survive a new session independently", both["pinned"] is True and both["tablePinned"] is True, both)
    ok(f, "DELETE", "/tasks/" + founder_task["taskId"] + "/table-pin", None, relogin, "tab-unpin-" + uuid.uuid4().hex)
    after_unpin = call(f, "GET", "/tasks/" + founder_task["taskId"], token=relogin)[1]
    check("clearing the table pin leaves the calendar pin untouched",
          after_unpin["tablePinned"] is False and after_unpin["pinned"] is True, after_unpin)
    # No residual preference may widen access after the relationship is gone.
    ok(f, "PUT", "/tasks/" + later + "/table-pin", None, employee, "residual-pin-" + uuid.uuid4().hex)
    f.db.server_side("DELETE FROM task_version_assignees WHERE version_id=(SELECT current_version_id FROM tasks WHERE id='" + later + "') AND user_id='" + ids["alpha-one-employee"] + "'")
    removed = call(f, "GET", "/tasks/table?limit=100&offset=0", token=employee)
    check("a task removed from the current relationship cannot be restored by a stale pin",
          all(row["id"] != later for page in (0, 100, 200)
              for row in call(f, "GET", "/tasks/table?limit=100&offset=" + str(page), token=employee)[1]["items"]),
          removed[0])


def fill_source(f, ids, business_day=None):
    """Task 5.1-5.3 on the real service."""
    employee = f.login("alpha-one-employee")[1]["token"]
    admin = f.login("admin")[1]["token"]
    founder = f.login("founder")[1]["token"]
    base = dt.date.fromisoformat(business_day)
    # Future business days are valid for the read-only source and avoid the task deadline rule.
    target = base + dt.timedelta(days=2)
    target_text = target.isoformat()
    long_body = "长正文\n" + "测" * 1993
    created_items = []
    for index in range(55):
        body = long_body + str(index) if index < 6 else "填充事项%02d" % index
        created_items.append(ok(f, "POST", "/daily-items", {"startDate": target_text, "endDate": target_text, "body": body},
                                employee, "fill-item-%02d-" % index + uuid.uuid4().hex))
    check("the fill-source fixture has more personal items than one list page", len(created_items) > 50, len(created_items))
    spanning = ok(f, "POST", "/daily-items", {"startDate": (target - dt.timedelta(days=1)).isoformat(),
                 "endDate": (target + dt.timedelta(days=1)).isoformat(), "body": "跨日事项"}, employee, "fill-span-" + uuid.uuid4().hex)
    timed = ok(f, "POST", "/tasks", {"title": "填充定时任务", "description": "覆盖", "priority": "medium", "allDay": False,
                "startAt": target_text + "T09:00:00+08:00", "dueAt": target_text + "T10:00:00+08:00",
                "assigneeIds": [ids["alpha-one-employee"]]}, founder, "fill-timed-" + uuid.uuid4().hex)
    midnight = ok(f, "POST", "/tasks", {"title": "午夜截止", "description": "覆盖", "priority": "medium", "allDay": False,
                   "startAt": target_text + "T23:00:00+08:00", "dueAt": (target + dt.timedelta(days=1)).isoformat() + "T00:00:00+08:00",
                   "assigneeIds": [ids["alpha-one-employee"]]}, founder, "fill-midnight-" + uuid.uuid4().hex)
    zero = ok(f, "POST", "/tasks", {"title": "零时长", "description": "覆盖", "priority": "medium", "allDay": False,
               "startAt": (target + dt.timedelta(days=1)).isoformat() + "T00:00:00+08:00",
               "dueAt": (target + dt.timedelta(days=1)).isoformat() + "T00:00:00+08:00",
               "assigneeIds": [ids["alpha-one-employee"]]}, founder, "fill-zero-" + uuid.uuid4().hex)
    all_day = ok(f, "POST", "/tasks", {"title": "全天跨日", "description": "覆盖", "priority": "medium", "allDay": True,
                  "startDate": (target - dt.timedelta(days=1)).isoformat(), "dueDate": (target + dt.timedelta(days=1)).isoformat(),
                  "assigneeIds": [ids["alpha-one-employee"]]}, founder, "fill-allday-" + uuid.uuid4().hex)
    state_before = {
        "items": f.db.scalar("SELECT COUNT(*) FROM daily_items"),
        "tasks": f.db.scalar("SELECT COUNT(*) FROM tasks"),
        "logs": f.db.scalar("SELECT COUNT(*) FROM work_logs"),
        "events": f.db.scalar("SELECT COUNT(*) FROM domain_events"),
    }
    source = call(f, "GET", "/work-logs/fill-source?businessDate=" + target_text, token=employee)[1]
    check("the fill source returns both complete groups without pagination truncation",
          source["complete"] is True and len(source["dailyItems"]) >= 56 and len(source["tasks"]) >= 3, 
          {"items": len(source["dailyItems"]), "tasks": len(source["tasks"])})
    names = [row["name"] for row in source["dailyItems"]]
    check("one item spanning the day is included once and long multi-line text is complete",
          names.count("跨日事项") == 1 and any(len(name) > 1990 for name in names), {"longest": max(map(len, names))})
    check("the complete name source can exceed the log body's 10000 UTF-16 code-unit ceiling",
          sum(len(name) for name in names) > 10000, sum(len(name) for name in names))
    task_ids = [row["id"] for row in source["tasks"]]
    check("task coverage includes the timed, midnight and all-day tasks but excludes the zero-length next-day task",
          timed["taskId"] in task_ids and midnight["taskId"] in task_ids and all_day["taskId"] in task_ids
          and zero["taskId"] not in task_ids, task_ids)
    next_day = call(f, "GET", "/work-logs/fill-source?businessDate=" + (target + dt.timedelta(days=1)).isoformat(), token=employee)[1]
    next_ids = [row["id"] for row in next_day["tasks"]]
    check("a midnight due task does not spill into the next day and the all-day task covers it",
          midnight["taskId"] not in next_ids and all_day["taskId"] in next_ids and zero["taskId"] in next_ids, next_ids)
    source_ids = [row["id"] for row in source["dailyItems"]]
    positions = [source_ids.index(row["id"]) for row in created_items]
    check("items keep creation order with stable identifiers and the spanning item appears once",
          positions == sorted(positions) and source_ids.count(spanning["id"]) == 1
          and len({row["id"] for row in source["tasks"]}) == len(source["tasks"]), "stable")
    status, result = call(f, "GET", "/work-logs/fill-source?businessDate=2026-02-30", token=employee)
    expect(status, result, "INVALID_INPUT", "an invalid business date is rejected")
    status, result = call(f, "GET", "/work-logs/fill-source?businessDate=" + target_text + "&userId=" + ids["alpha-two-employee"], token=employee)
    expect(status, result, "INVALID_INPUT", "the fill source never accepts another person's userId")
    status, result = call(f, "GET", "/work-logs/fill-source?businessDate=" + target_text, token=admin)
    expect(status, result, "BUSINESS_ROLE_REQUIRED", "the administrator cannot read employee fill sources")
    state_after = {
        "items": f.db.scalar("SELECT COUNT(*) FROM daily_items"),
        "tasks": f.db.scalar("SELECT COUNT(*) FROM tasks"),
        "logs": f.db.scalar("SELECT COUNT(*) FROM work_logs"),
        "events": f.db.scalar("SELECT COUNT(*) FROM domain_events"),
    }
    check("the fill source is a pure read", state_before == state_after, {"before": state_before, "after": state_after})
    # Log edit semantics are not widened by the new source contract.
    log_text = "边" * 10000
    ok(f, "POST", "/work-logs", {"businessDate": (base - dt.timedelta(days=2)).isoformat(), "body": log_text},
       employee, "fill-log-10000-" + uuid.uuid4().hex)
    status, result = call(f, "POST", "/work-logs", {"businessDate": business_day, "body": log_text + "边"},
                          employee, "fill-log-10001-" + uuid.uuid4().hex)
    expect(status, result, "INVALID_INPUT", "the existing 10000 code-unit log limit still rejects 10001")
    status, result = call(f, "GET", "/work-logs/fill-source?businessDate=" + (base - dt.timedelta(days=2)).isoformat(), token=employee)
    check("a backfilled still-editable log day can still read its source", status == 200 and result["complete"] is True, status)


def hire_date(f, ids, business_day=None):
    """Task 6.1-6.3 on the real service."""
    admin = f.login("admin")[1]["token"]
    employee = f.login("alpha-one-employee")[1]["token"]
    head = f.login("alpha-one-head")[1]["token"]
    peer = f.login("alpha-two-employee")[1]["token"]
    target = ids["alpha-one-employee"]
    before = call(f, "GET", "/admin/employees/" + target, token=admin)[1]
    check("existing employees start with an unset real hire date and no fabricated tenure",
          before.get("hireDate") is None, before.get("hireDate"))
    set_result = ok(f, "PATCH", "/admin/employees/" + target, {"hireDate": "2024-02-29"}, admin,
                    "hire-set-" + uuid.uuid4().hex, before["rowVersion"])
    employee = f.login("alpha-one-employee")[1]["token"]
    head = f.login("alpha-one-head")[1]["token"]
    peer = f.login("alpha-two-employee")[1]["token"]
    check("the administrator can set a leap-day hire date", set_result["hireDate"] == "2024-02-29", set_result)
    status, result = call(f, "PATCH", "/admin/employees/" + target, {"hireDate": "2999-01-01"}, admin,
                          "hire-future-" + uuid.uuid4().hex, set_result["rowVersion"])
    expect(status, result, "INVALID_INPUT", "a future hire date is rejected")
    status, result = call(f, "PATCH", "/admin/employees/" + target, {"displayName": "改名保留"}, admin,
                          "hire-omit-" + uuid.uuid4().hex, set_result["rowVersion"])
    check("omitting hireDate preserves the stored value and still saves the name",
          status == 200 and call(f, "GET", "/admin/employees/" + target, token=admin)[1]["hireDate"] == "2024-02-29",
          result)
    me = call(f, "GET", "/me", token=employee)[1]
    profile = call(f, "GET", "/me/profile", token=employee)[1]
    check("self /me and /me/profile share the same company-date tenure",
          me["hireDate"] == "2024-02-29" and me["tenure"] == profile["tenure"]
          and me["tenure"]["asOfDate"] == profile["tenure"]["asOfDate"]
          and {"years", "months", "days", "asOfDate"} == set(me["tenure"]), {"me": me["tenure"], "profile": profile["tenure"]})
    subordinate = call(f, "GET", "/users/" + target, token=head)[1]
    check("an actual chain manager receives the same hire date and tenure in the authorized detail",
          subordinate.get("hireDate") == "2024-02-29" and subordinate.get("tenure") == me["tenure"], subordinate.get("tenure"))
    peer_detail = call(f, "GET", "/users/" + target, token=peer)[1]
    check("a same-level peer receives neither hire projection nor e-mail",
          "hireDate" not in peer_detail and "tenure" not in peer_detail and "email" not in peer_detail, peer_detail)
    directory = call(f, "GET", "/users", token=head)[1]["items"]
    check("ordinary directory summaries never carry phone, e-mail, hire date or tenure",
          all(not ({"phone", "email", "hireDate", "tenure"} & set(row)) for row in directory), "clean")
    profile = call(f, "GET", "/me/profile", token=employee)[1]
    ok(f, "PATCH", "/me/profile", {"email": "employee@example.test"}, employee, "profile-email-" + uuid.uuid4().hex,
       profile["rowVersion"])
    head_detail = call(f, "GET", "/users/" + target, token=head)[1]
    check("the authorized management-chain ancestor can read the e-mail in the detail",
          head_detail.get("email") == "employee@example.test", head_detail.get("email"))
    peer_detail = call(f, "GET", "/users/" + target, token=peer)[1]
    check("a peer still cannot read that e-mail", "email" not in peer_detail, peer_detail)
    check("a direct employee cannot maintain hireDate through the administrator route",
          call(f, "PATCH", "/admin/employees/" + target, {"hireDate": "2020-01-01"}, employee,
               "hire-forbid-" + uuid.uuid4().hex, call(f, "GET", "/admin/employees/" + target, token=admin)[1]["rowVersion"])[0] == 403,
          "forbidden")
    current = call(f, "GET", "/admin/employees/" + target, token=admin)[1]
    cleared = ok(f, "PATCH", "/admin/employees/" + target, {"hireDate": None}, admin,
                 "hire-clear-" + uuid.uuid4().hex, current["rowVersion"])
    check("an explicit null clears the date without fabricating a duration",
          cleared["hireDate"] is None and call(f, "GET", "/me", token=employee)[1]["tenure"] is None, cleared)
    # Direct employee creation carries the same rule.
    create_key = "hire-create-" + uuid.uuid4().hex
    create_body = {"displayName": "入职新员工", "phone": "13977770011",
                   "placementType": "employee", "departmentId": "fixture-company-alpha",
                   "teamId": "fixture-company-alpha-one", "positionId": "fixture-company-title", "hireDate": "2025-01-31"}
    created = ok(f, "POST", "/admin/employees", create_body, admin, create_key)
    read_back = call(f, "GET", "/admin/employees/" + created["userId"], token=admin)[1]
    check("direct creation persists the submitted hire date and returns the one-time password",
          read_back.get("hireDate") == "2025-01-31" and created.get("initialPassword"), read_back.get("hireDate"))
    replay = ok(f, "POST", "/admin/employees", create_body, admin, create_key)
    check("an idempotent replay never returns the initial password twice",
          replay.get("userId") == created["userId"] and "initialPassword" not in replay, replay)
    status, result = call(f, "POST", "/admin/employees", {"displayName": "未来入职", "phone": "13977770012",
                          "placementType": "employee", "departmentId": "fixture-company-alpha", "teamId": "fixture-company-alpha-one",
                          "positionId": "fixture-company-title", "hireDate": "2999-01-01"}, admin, "hire-create-bad-" + uuid.uuid4().hex)
    expect(status, result, "INVALID_INPUT", "a future hire date on direct creation rejects the whole account")
    check("the rejected direct creation wrote no account",
          f.db.scalar("SELECT COUNT(*) FROM users WHERE login_phone='13977770012'") == 0, "no half-created account")
    # The organization-plan newEmployees path uses the same rule.
    draft = call(f, "GET", "/admin/organization-plans", token=admin)[1]
    plan = {key: draft[key] for key in ("departments", "teams", "placements", "expectedEmployees")}
    plan["reason"] = "入职日期计划验证"
    plan["newEmployees"] = [{"id": str(uuid.uuid4()), "displayName": "计划新员工", "phone": "13977770013", "hireDate": "2023-12-31"}]
    plan["placements"] = plan["placements"] + [{"employeeId": plan["newEmployees"][0]["id"], "placementType": "employee",
                    "departmentId": "fixture-company-beta", "teamId": "fixture-company-beta-one", "positionId": "fixture-company-title"}]
    planned = ok(f, "POST", "/admin/organization-plans", plan, admin, "hire-plan-" + uuid.uuid4().hex, draft["rowVersion"])
    bad_draft = call(f, "GET", "/admin/organization-plans", token=admin)[1]
    bad_plan = {key: bad_draft[key] for key in ("departments", "teams", "placements", "expectedEmployees")}
    bad_plan["reason"] = "计划非法入职日期"
    bad_plan["newEmployees"] = [{"id": str(uuid.uuid4()), "displayName": "计划未来员工", "phone": "13977770014",
                                 "hireDate": "2999-01-01"}]
    bad_plan["placements"] = bad_plan["placements"] + [{"employeeId": bad_plan["newEmployees"][0]["id"],
                               "placementType": "employee", "departmentId": "fixture-company-beta",
                               "teamId": "fixture-company-beta-one", "positionId": "fixture-company-title"}]
    status, result = call(f, "POST", "/admin/organization-plans", bad_plan, admin,
                          "hire-plan-bad-" + uuid.uuid4().hex, bad_draft["rowVersion"])
    expect(status, result, "INVALID_INPUT", "an invalid planned hire date rejects the whole plan")
    check("the rejected plan creates no partial account",
          f.db.scalar("SELECT COUNT(*) FROM users WHERE login_phone='13977770014'") == 0, "no half-write")
    planned_id = planned["createdEmployeeIds"][0]
    check("the organization plan creates the employee with the submitted hire date in one transaction",
          call(f, "GET", "/admin/employees/" + planned_id, token=admin)[1]["hireDate"] == "2023-12-31", planned)
    # Reassignment must re-evaluate the current chain: the old manager loses the detail and the new
    # actual manager gains the e-mail, never a cached copy.
    draft = call(f, "GET", "/admin/organization-plans", token=admin)[1]
    move = {key: draft[key] for key in ("departments", "teams", "placements", "expectedEmployees")}
    move["reason"] = "组织改派后重验邮箱"
    for placement in move["placements"]:
        if placement["employeeId"] == target:
            placement["departmentId"] = "fixture-company-beta"
            placement["teamId"] = "fixture-company-beta-one"
    ok(f, "POST", "/admin/organization-plans", move, admin, "hire-move-" + uuid.uuid4().hex, draft["rowVersion"])
    reports = call(f, "GET", "/me/reports", token=head)[1]["items"]
    check("subordinate summaries and the reports tree carry no private fields",
          all(not ({"phone", "email", "hireDate", "tenure"} & set(row)) for row in reports), "clean")
    old_head = f.login("alpha-one-head")[1]["token"]
    new_head = f.login("beta-one-head")[1]["token"]
    check("after reassignment the old chain manager loses the detail",
          call(f, "GET", "/users/" + target, token=old_head)[0] == 404, "404")
    check("the new actual chain manager reads the current e-mail and hire projection",
          call(f, "GET", "/users/" + target, token=new_head)[1].get("email") == "employee@example.test",
          call(f, "GET", "/users/" + target, token=new_head)[1].get("email"))
    # The formal PC page itself, not only the API, must set/save/cancel/clear the real date.
    browser = subprocess.run(["node", str(BASE / "scripts/check_admin_hire_browser.js")],
                   env={**os.environ, "PANDORA_ADMIN_HIRE_FIXTURE": json.dumps({
                       "base": "http://127.0.0.1:" + str(f.port),
                       "identifier": f.identities["admin"]["identifier"],
                       "password": PASSWORD,
                       "employeeId": target})}, capture_output=True, text=True)
    (AUDIT / "admin-hire-browser.log").write_text(browser.stdout + browser.stderr)
    for line in browser.stdout.splitlines():
        if line.startswith("PASS  ") or line.startswith("FAIL  "):
            REPORT.append({"check": "admin.html: " + line[6:], "pass": line.startswith("PASS  "), "evidence": "real Chrome"})
    if browser.returncode != 0:
        print(browser.stdout, browser.stderr, flush=True)
        raise AssertionError("admin.html hire-date browser check failed")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=18240)
    parser.add_argument("--skip-witness", action="store_true")
    parser.add_argument("--only", choices=("daily", "table", "fill", "hire"), help="run one API group only")
    args = parser.parse_args()
    AUDIT.mkdir(parents=True, exist_ok=True)
    try:
        if not args.skip_witness:
            witness(args.port)
        fixture = Fixture(port=args.port + 1)
        fixture.log_path = AUDIT / "employee-contracts-service.log"
        with fixture as f:
            ids = {key: value["id"] for key, value in f.identities.items()}
            business_day = call(f, "GET", "/home", token=f.login("founder")[1]["token"])[1]["businessDate"]
            groups = {"daily": daily_items, "table": task_table, "fill": fill_source, "hire": hire_date}
            for name in ([args.only] if args.only else ["daily", "table", "fill", "hire"]):
                groups[name](f, ids, business_day)
    finally:
        report = AUDIT / "employee-contracts-check.json"
        report.write_text(json.dumps({"updated": dt.datetime.now(dt.timezone.utc).isoformat(), "checks": REPORT},
                                     ensure_ascii=False, indent=2, default=str))
        failed = [row for row in REPORT if not row["pass"]]
        print(json.dumps({"total": len(REPORT), "failed": len(failed), "report": str(report)}, ensure_ascii=False), flush=True)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
