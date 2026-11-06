#!/usr/bin/env python3
"""Daily items, three-section home board and V31 migration checks on disposable real services.

The suite owns random databases and temporary services; it never touches the normal database.
It first upgrades an empty database to V30, writes real tasks/logs/company information, runs the
V30 -> V31 migration, and proves that only old personal home items were removed. It then exercises
the daily-item API (private scope, date/body/boolean validation, stable paging, exact summaries,
declared completion, version fencing and idempotent replay) and the home task board contract.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
import sys
import uuid
from pathlib import Path

from fixed_model_fixture import Fixture
from migration_precheck import BASE

AUDIT = BASE.parent / "audit/refine-home-daily-items-layout-and-scrolling"
REPORT: list[dict] = []
PASSWORD = "Fixture@123456"


def check(name, condition, evidence=None):
    REPORT.append({"check": name, "pass": bool(condition), "evidence": evidence})
    print(("PASS  " if condition else "FAIL  ") + name + ("" if condition else "  -> " + json.dumps(evidence, ensure_ascii=False, default=str)[:1200]))
    if not condition:
        raise AssertionError(name)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-browser", action="store_true")
    args = parser.parse_args()
    AUDIT.mkdir(parents=True, exist_ok=True)

    # ---------------------------------------------------------------- migration + API
    upgrade = Fixture(port=18193)
    upgrade.migration_target = 30
    upgrade.log_path = AUDIT / "daily-items-service.log"
    with upgrade as f:
        founder = f.login("founder")[1]["token"]
        business_day = f.call("GET", "/home", token=founder)[1]["businessDate"]
        org = f.identities["founder"]["organizationId"]
        ids = {key: value["id"] for key, value in f.identities.items()}
        task_day = str(dt.date.fromisoformat(business_day) + dt.timedelta(days=1))
        start = task_day + "T09:00:00+08:00"
        due = task_day + "T18:00:00+08:00"
        task = f.call("POST", "/tasks", {"title": "V30 migration witness task", "description": "migration fixture",
            "priority": "medium", "allDay": False, "startAt": start, "dueAt": due,
            "assigneeIds": [ids["founder"]]}, founder, "migration-task-" + uuid.uuid4().hex)
        tag_status, tag = f.call("POST", "/tags", {"name": "Migration witness tag", "color": "#F6D5D2"},
            founder, "migration-tag-" + uuid.uuid4().hex)
        assert tag_status == 200, (tag_status, tag)
        log = f.call("POST", "/work-logs", {"businessDate": business_day, "body": "V30 migration witness log", "tagIds": [tag["tagId"]]},
            founder, "migration-log-" + uuid.uuid4().hex)
        check("V30 fixture writes a real task and log before the migration",
              task[0] in (200, 201) and log[0] == 200, {"task": task[0], "log": log[0]})
        f.db.server_side("INSERT INTO home_items(id,organization_id,owner_id,kind,title,body,sort_order) VALUES('upgrade-personal','" +
            org + "','" + ids["founder"] + "','personal','Legacy personal','legacy personal item',1)")
        f.db.server_side("INSERT INTO home_items(id,organization_id,owner_id,kind,title,body,sort_order) VALUES('upgrade-company','" +
            org + "',NULL,'company','Company notice','company item',1)")
        def q(sql):
            rows = f.db.rows(sql)
            return rows[0][0] if rows and rows[0] else None

        before = {
            "tasks": q("SELECT GROUP_CONCAT(id ORDER BY id) FROM tasks"),
            "logs": q("SELECT GROUP_CONCAT(id ORDER BY id) FROM work_logs"),
            "taskRows": f.db.rows("SELECT * FROM tasks ORDER BY id"),
            "logRows": f.db.rows("SELECT * FROM work_logs ORDER BY id"),
            "logTags": f.db.rows("SELECT * FROM work_log_tags ORDER BY organization_id,log_id,ordinal"),
            "company": q("SELECT GROUP_CONCAT(id ORDER BY id) FROM home_items WHERE kind='company'"),
            "personal": q("SELECT COUNT(*) FROM home_items WHERE kind='personal'"),
            "version": q("SELECT MAX(CAST(version AS UNSIGNED)) FROM flyway_schema_history WHERE success=1"),
        }
        check("baseline is V30 and still holds the old personal item",
              before["version"] == "30" and int(before["personal"]) == 1, before)

        f.restart()

        after = {
            "tasks": q("SELECT GROUP_CONCAT(id ORDER BY id) FROM tasks"),
            "logs": q("SELECT GROUP_CONCAT(id ORDER BY id) FROM work_logs"),
            "taskRows": f.db.rows("SELECT * FROM tasks ORDER BY id"),
            "logRows": f.db.rows("SELECT * FROM work_logs ORDER BY id"),
            "logTags": f.db.rows("SELECT * FROM work_log_tags ORDER BY organization_id,log_id,ordinal"),
            "company": q("SELECT GROUP_CONCAT(id ORDER BY id) FROM home_items WHERE kind='company'"),
            "personal": q("SELECT COUNT(*) FROM home_items WHERE kind='personal'"),
            "version": q("SELECT MAX(CAST(version AS UNSIGNED)) FROM flyway_schema_history WHERE success=1"),
            "daily": q("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='daily_items'"),
        }
        check("V31 creates daily_items and records the actual migration version",
              after["daily"] == "1" and after["version"] == "31", after)
        check("V31 removes only the old personal home items",
              after["personal"] == "0" and after["company"] == before["company"], {"before": before, "after": after})
        check("V31 leaves tasks and logs byte-identical",
              all(after[key] == before[key] for key in ("tasks", "logs", "taskRows", "logRows", "logTags")), {"before": before, "after": after})
        # The migration witness task stays out of the board contract assertions below.
        f.db.server_side("UPDATE tasks SET execution_state='done'")

        run_api_checks(f, ids, business_day)

    # ---------------------------------------------------------------- browser checks
    if not args.skip_browser:
        browser = Fixture(port=18194)
        browser.log_path = AUDIT / "daily-items-browser-service.log"
        with browser as f:
            founder = f.login("founder")[1]["token"]
            person = f.login("alpha-one-employee")[1]["token"]
            admin = f.login("admin")[1]["token"]
            day = f.call("GET", "/home", token=person)[1]["businessDate"]
            board_day = str(dt.date.fromisoformat(day) + dt.timedelta(days=1))
            board_ids = {key: value["id"] for key, value in f.identities.items()}
            for index in range(3):
                status, result = f.call("POST", "/tasks", {"title": "看板任务 " + str(index) + " with a long enough title",
                    "description": "browser board fixture", "priority": ["urgent", "high", "medium"][index],
                    "allDay": False, "startAt": board_day + "T09:00:00+08:00", "dueAt": board_day + "T18:00:00+08:00",
                    "assigneeIds": [board_ids["alpha-one-employee"]]}, founder, "browser-board-" + str(index) + "-" + uuid.uuid4().hex)
                if status not in (200, 201):
                    raise AssertionError(("board", index, status, result))
            # Four short single-line tasks, so the three-row budget is measured on normal rows
            # rather than on titles that wrap to two lines.
            for index in range(4):
                status, result = f.call("POST", "/tasks", {"title": "短任务 " + str(index),
                    "description": "browser short-row fixture", "priority": "low", "allDay": False,
                    "startAt": board_day + "T09:00:00+08:00", "dueAt": board_day + "T18:00:00+08:00",
                    "assigneeIds": [board_ids["alpha-one-employee"]]}, founder, "browser-short-" + str(index) + "-" + uuid.uuid4().hex)
                if status not in (200, 201):
                    raise AssertionError(("short-board", index, status, result))
            # Company information: five short single-line entries for the same row budget.
            for index in range(5):
                status, result = f.call("POST", "/admin/company/items", {"body": "公司信息 " + str(index)},
                    admin, "browser-company-" + str(index) + "-" + uuid.uuid4().hex)
                if status != 200:
                    raise AssertionError(("company", index, status, result))
            today = dt.date.fromisoformat(day)
            # Seeded markers, as (open, completed): 1..6 open items, a mixed day with one open and
            # four completed items, an all-completed day with five items. Day +8 stays empty.
            plans = {0: (1, 0), 1: (2, 0), 2: (3, 0), 3: (4, 0), 4: (5, 0), 5: (6, 0), 6: (1, 4), 7: (0, 5)}
            for offset, (open_count, done_count) in plans.items():
                date = str(today + dt.timedelta(days=offset))
                for index in range(open_count + done_count):
                    result = f.call("POST", "/daily-items", {"date": date, "body": f"Seeded item {offset}-{index}"},
                        person, f"browser-seed-{offset}-{index}-" + uuid.uuid4().hex)
                    if result[0] != 200:
                        raise AssertionError(("seed", result))
                    if index >= open_count:
                        item = result[1]
                        f.call("PATCH", "/daily-items/" + item["id"], {"completed": True}, person,
                            "browser-seed-complete-" + str(offset) + "-" + str(index) + "-" + uuid.uuid4().hex, item["rowVersion"])
            bulk = str(today + dt.timedelta(days=30))
            for index in range(105):
                status, result = f.call("POST", "/daily-items", {"date": bulk, "body": "Browser bulk " + str(index)},
                    person, "browser-bulk-" + str(index) + "-" + uuid.uuid4().hex)
                if status != 200:
                    raise AssertionError(("bulk", index, status, result))
            manifest = {"base": f"http://127.0.0.1:{f.port}", "identities": f.identities,
                        "database": f.database, "today": day, "port": f.port, "bulk": bulk}
            env = {"PANDORA_BROWSER_FIXTURE": json.dumps(manifest)}
            subprocess.run(["node", str(BASE / "scripts/check_daily_items_browser.js")], env={**__import__("os").environ, **env}, check=True)

    REPORT_PATH = AUDIT / "daily-items-run.json"
    REPORT_PATH.write_text(json.dumps({"updated": dt.datetime.now(dt.timezone.utc).isoformat(),
        "checks": REPORT}, ensure_ascii=False, indent=2, default=str) + "\n")
    print(f"\n{len(REPORT)} checks passed; wrote {REPORT_PATH}")


def run_api_checks(f: Fixture, ids, business_day):
    person = f.login("alpha-one-employee")[1]["token"]
    manager = f.login("alpha-one-head")[1]["token"]
    head = f.login("alpha-head")[1]["token"]
    founder = f.login("founder")[1]["token"]
    outsider = f.login("other-founder")[1]["token"]
    admin = f.login("admin")[1]["token"]
    today = dt.date.fromisoformat(business_day)

    def call(method, path, body=None, token=person, key=None, version=None, expect=200):
        status, result = f.call(method, path, body, token, key or ("daily-" + uuid.uuid4().hex), version)
        if expect == 200 and status != 200:
            raise AssertionError((method, path, status, result))
        return status, result

    def day(offset):
        return str(today + dt.timedelta(days=offset))

    # -- validation ---------------------------------------------------------
    created = call("POST", "/daily-items", {"date": "2024-02-29", "body": "闰日事项\n第二行"})[1]
    check("a valid leap-day item with internal newlines is created", created["rowVersion"] == 1 and created["date"] == "2024-02-29", created)
    detail_status, detail = call("GET", "/daily-items/" + created["id"])
    check("detail returns the exact leap date and plain text with rowVersion",
          detail["date"] == "2024-02-29" and detail["body"] == "闰日事项\n第二行" and detail["rowVersion"] == 1, detail)
    for label, body in (
        ("invalid leap date", {"date": "2023-02-29", "body": "x"}),
        ("impossible month", {"date": "2026-13-01", "body": "x"}),
        ("non-padded date", {"date": "2026-1-1", "body": "x"}),
        ("blank body", {"date": day(0), "body": "   "}),
        ("whitespace only", {"date": day(0), "body": "\n\t "}),
        ("unknown owner injection", {"date": day(0), "body": "x", "ownerId": ids["founder"]}),
        ("unknown task injection", {"date": day(0), "body": "x", "taskId": "task"}),
    ):
        status, result = call("POST", "/daily-items", body, expect=400)
        check("create rejects " + label, status == 400 and result.get("code") == "INVALID_INPUT", result)
    exact = call("POST", "/daily-items", {"date": day(0), "body": "字" * 2000})[1]
    check("2000-character body boundary is accepted", exact["rowVersion"] == 1, exact)
    status, result = call("POST", "/daily-items", {"date": day(0), "body": "字" * 2001}, expect=400)
    check("2001-character body is rejected without partial save", status == 400, result)
    status, result = call("PATCH", "/daily-items/" + exact["id"], {"completed": "yes"}, version=1, expect=400)
    check("completed must be an explicit boolean", status == 400, result)
    status, result = call("PATCH", "/daily-items/" + exact["id"], {"body": "changed"}, expect=428)
    check("update without If-Match is rejected with 428", status == 428, result)
    status, result = call("PATCH", "/daily-items/" + exact["id"], {"body": "changed"}, version=99, expect=412)
    check("stale version is rejected with 412 instead of silent overwrite", status == 412, result)

    # -- explicit completion, atomic date/body move -------------------------
    status, patched = call("PATCH", "/daily-items/" + exact["id"], {"completed": True, "body": "完成后的正文", "date": day(1)}, version=1)
    check("date, body and completed are saved atomically with a new version",
          patched["completed"] is True and patched["date"] == day(1) and patched["rowVersion"] == 2, patched)
    reopened = call("PATCH", "/daily-items/" + exact["id"], {"completed": False}, version=2)[1]
    check("completion is explicitly reversible", reopened["completed"] is False and reopened["rowVersion"] == 3, reopened)

    # -- paging and stable order -------------------------------------------
    page_day = day(3)
    total_items = 105
    created_ids = []
    for index in range(total_items):
        created_ids.append(call("POST", "/daily-items", {"date": page_day, "body": "Bulk " + str(index)}, key="bulk-" + str(index) + "-" + uuid.uuid4().hex)[1]["id"])
    f.db.server_side("UPDATE daily_items SET created_at='2026-01-01 00:00:00.000000' WHERE item_date='" + page_day + "'")
    first = call("GET", f"/daily-items?date={page_day}&limit=100&offset=0")[1]
    second = call("GET", f"/daily-items?date={page_day}&limit=100&offset=100")[1]
    expected = [row[0] for row in f.db.rows("SELECT id FROM daily_items WHERE item_date='" + page_day + "' ORDER BY created_at,id")]
    check("one page is capped at 100 and reports the complete total",
          len(first["items"]) == 100 and first["total"] == total_items and first["nextOffset"] == 100, {"total": first["total"], "next": first["nextOffset"]})
    check("the second page returns the remaining items without duplicates",
          len(second["items"]) == 5 and second["nextOffset"] is None and
          len({item["id"] for item in first["items"]} | {item["id"] for item in second["items"]}) == total_items,
          {"second": len(second["items"])})
    check("paging order is created_at then id, independent of completion",
          [item["id"] for item in first["items"]] + [item["id"] for item in second["items"]] == expected,
          {"expected": expected[:3]})
    check("items with identical bodies keep distinct real ids",
          len(set(created_ids)) == total_items, {"unique": len(set(created_ids))})

    # -- exact summaries ----------------------------------------------------
    counts = {}
    for offset, count in ((10, 0), (11, 1), (12, 2), (13, 3), (14, 4), (15, 5), (16, 7)):
        counts[offset] = count
        for index in range(count):
            call("POST", "/daily-items", {"date": day(offset), "body": f"Summary {offset}-{index}"})
    mixed = day(17)
    for index in range(3):
        call("POST", "/daily-items", {"date": mixed, "body": f"Mixed open {index}"})
    for index in range(2):
        item = call("POST", "/daily-items", {"date": mixed, "body": f"Mixed done {index}"}, key="mixed-" + str(index) + "-" + uuid.uuid4().hex)[1]
        call("PATCH", "/daily-items/" + item["id"], {"completed": True}, version=1)
    all_done = day(18)
    for index in range(4):
        item = call("POST", "/daily-items", {"date": all_done, "body": f"All done {index}"}, key="alldone-" + str(index) + "-" + uuid.uuid4().hex)[1]
        call("PATCH", "/daily-items/" + item["id"], {"completed": True}, version=1)
    summary = call("GET", f"/daily-items/summary?from={day(10)}&to={day(18)}")[1]
    by_date = {row["date"]: row for row in summary["days"]}
    check("summary omits a truly zero day, so absence means zero",
          day(10) not in by_date, {"days": sorted(by_date)})
    for offset, count in ((11, 1), (12, 2), (13, 3), (14, 4), (15, 5), (16, 7)):
        row = by_date.get(day(offset), {})
        check(f"summary counts {count} open item(s) on day {offset}",
              row.get("openCount") == count and row.get("completedCount") == 0, row)
    page_summary = call("GET", f"/daily-items/summary?from={page_day}&to={page_day}")[1]
    check("summary keeps 105 items independent of the 100-row list page",
          page_summary["days"][0]["openCount"] == 105 and page_summary["days"][0]["completedCount"] == 0,
          page_summary)
    check("summary reports mixed open/completed counts",
          by_date.get(mixed, {}).get("openCount") == 3 and by_date.get(mixed, {}).get("completedCount") == 2, by_date.get(mixed))
    check("summary reports an all-completed day as zero open",
          by_date.get(all_done, {}).get("openCount") == 0 and by_date.get(all_done, {}).get("completedCount") == 4, by_date.get(all_done))
    status, result = call("GET", f"/daily-items/summary?from={day(0)}&to={day(94)}", expect=400)
    check("summary rejects a range longer than 93 closed days", status == 400, result)
    status, result = call("GET", f"/daily-items/summary?from={day(5)}&to={day(1)}", expect=400)
    check("summary rejects an inverted range", status == 400, result)

    # -- private ownership for every operation ------------------------------
    mine = call("POST", "/daily-items", {"date": day(20), "body": "Private only"})[1]
    for label, token in (("same-team peer", manager), ("department head", head), ("founder", founder), ("other company", outsider)):
        status, _ = call("GET", "/daily-items?date=" + day(20), token=token)
        peer_items = call("GET", "/daily-items?date=" + day(20), token=token)[1]["items"] if status == 200 else []
        check(f"{label} cannot read another person's daily list", all(item["id"] != mine["id"] for item in peer_items), peer_items)
        status, _ = call("GET", "/daily-items/" + mine["id"], token=token, expect=404)
        check(f"{label} cannot read another person's detail", status == 404, status)
        status, _ = call("PATCH", "/daily-items/" + mine["id"], {"body": "hijack"}, token=token, version=1, expect=404)
        check(f"{label} cannot modify another person's item", status == 404, status)
        status, _ = call("DELETE", "/daily-items/" + mine["id"], token=token, version=1, expect=404)
        check(f"{label} cannot delete another person's item", status == 404, status)
        summary_peer = call("GET", f"/daily-items/summary?from={day(20)}&to={day(20)}", token=token)[1]
        check(f"{label} summary does not expose another person's count", summary_peer["days"] == [], summary_peer)
    status, result = call("GET", "/daily-items?date=" + day(20), token=admin, expect=403)
    check("an independent administrator cannot use the employee daily-item API", status == 403 and result.get("code") == "BUSINESS_ROLE_REQUIRED", result)
    status, _ = f.call("GET", "/daily-items?date=" + day(20), None, "not-a-session")
    check("an invalid session is rejected", status == 401, status)
    status, result = call("POST", "/home/items", {"kind": "personal", "body": "old path"}, expect=410)
    check("the retired personal home-item create path is rejected", status == 410 and result.get("code") == "HOME_ITEMS_PERSONAL_RETIRED", result)

    # -- audit and business isolation --------------------------------------
    org = f.identities["founder"]["organizationId"]
    notifications_before = int(f.db.rows("SELECT COUNT(*) FROM notifications WHERE organization_id='" + org + "'")[0][0])
    tasks_before = int(f.db.rows("SELECT COUNT(*) FROM tasks WHERE organization_id='" + org + "'")[0][0])
    logs_before = int(f.db.rows("SELECT COUNT(*) FROM work_logs WHERE organization_id='" + org + "'")[0][0])
    audit_item = call("POST", "/daily-items", {"date": day(23), "body": "审计正文不得写入"})[1]
    notifications_after = int(f.db.rows("SELECT COUNT(*) FROM notifications WHERE organization_id='" + org + "'")[0][0])
    task_rows = f.db.rows("SELECT details_json FROM audit_logs WHERE object_id='" + audit_item["id"] + "'")
    event_rows = f.db.rows("SELECT event_type,recipients_json FROM domain_events WHERE object_id='" + audit_item["id"] + "'")
    check("daily-item maintenance writes no notification and leaves tasks/logs untouched",
          notifications_after == notifications_before and
          int(f.db.rows("SELECT COUNT(*) FROM tasks WHERE organization_id='" + org + "'")[0][0]) == tasks_before and
          int(f.db.rows("SELECT COUNT(*) FROM work_logs WHERE organization_id='" + org + "'")[0][0]) == logs_before,
          {"notifications": (notifications_before, notifications_after), "tasks": (tasks_before, "same"), "logs": (logs_before, "same")})
    check("the audit event carries the item identity but never its body and has no recipients",
          len(task_rows) == 1 and "dailyItemId" in task_rows[0][0] and "审计正文不得写入" not in task_rows[0][0] and
          len(event_rows) == 1 and event_rows[0][0] == "daily_item.created" and event_rows[0][1] == "[]",
          {"audit": task_rows, "events": event_rows})

    # -- idempotent replay after a lost response ----------------------------
    replay_key = "daily-replay-" + uuid.uuid4().hex
    first_create = call("POST", "/daily-items", {"date": day(21), "body": "Replay once"}, key=replay_key)[1]
    replay = call("POST", "/daily-items", {"date": day(21), "body": "Replay once"}, key=replay_key)[1]
    again = call("GET", "/daily-items?date=" + day(21))[1]
    check("the same create request replays without a duplicate item",
          replay["id"] == first_create["id"] and again["total"] == 1, {"replay": replay, "total": again["total"]})
    delete_key = "daily-delete-" + uuid.uuid4().hex
    status, deleted = call("DELETE", "/daily-items/" + first_create["id"], key=delete_key, version=1)
    replay_delete = call("DELETE", "/daily-items/" + first_create["id"], key=delete_key, version=1)[1]
    check("deleting and replaying the same idempotent request returns the cached result",
          deleted.get("deleted") is True and replay_delete.get("deleted") is True, replay_delete)
    check("the deleted item is gone after the replayed delete",
          call("GET", "/daily-items?date=" + day(21))[1]["total"] == 0)
    conflict_item = call("POST", "/daily-items", {"date": day(22), "body": "Idempotency conflict"})[1]
    conflict_key = "daily-conflict-" + uuid.uuid4().hex
    first_status, _ = call("PATCH", "/daily-items/" + conflict_item["id"], {"body": "x"}, key=conflict_key, version=1)
    second_status, second_result = call("PATCH", "/daily-items/" + conflict_item["id"], {"body": "y"}, key=conflict_key, version=2, expect=409)
    check("one idempotency key cannot be reused for a different request",
          first_status == 200 and second_status == 409 and second_result.get("code") == "IDEMPOTENCY_CONFLICT",
          {"first": first_status, "second": second_status, "result": second_result})

    # -- home task board ----------------------------------------------------
    task_day = str(today + dt.timedelta(days=1))
    start = task_day + "T09:00:00+08:00"
    due = task_day + "T18:00:00+08:00"

    def new_task(title, owners, who=founder):
        status, result = f.call("POST", "/tasks", {"title": title, "description": "daily items board fixture",
            "priority": "medium", "allDay": False, "startAt": start, "dueAt": due,
            "assigneeIds": [ids[key] for key in owners]}, who, "board-" + uuid.uuid4().hex)
        if status not in (200, 201):
            raise AssertionError(("task", title, status, result))
        return result["taskId"]

    self_created = [new_task("Self-created assigned " + str(index), ["founder"]) for index in range(12)]
    other_created = [new_task("Founder assigned to employee " + str(index), ["alpha-one-employee"]) for index in range(2)]
    only_created = new_task("Founder created for another employee", ["beta-one-employee"])
    unpublished = new_task("Employee unpublished creation", ["alpha-one-employee"], who=f.login("alpha-one-employee")[1]["token"])
    f.db.server_side("UPDATE task_assignments SET assigned_at='2026-02-02 02:02:02.000000' WHERE task_id IN (" +
        ",".join("'" + item + "'" for item in self_created) + ")")
    done_id = self_created[0]
    f.db.server_side("UPDATE tasks SET execution_state='done' WHERE id='" + done_id + "'")
    inactive_id = self_created[1]
    f.db.server_side("UPDATE task_assignments SET active=FALSE WHERE task_id='" + inactive_id + "'")
    home = f.call("GET", "/home", token=founder)[1]
    board_ids = [row["taskId"] for row in home["assignedTasks"]]
    expected_ids = sorted([item for item in self_created if item not in (done_id, inactive_id)])[:10]
    check("the home board includes self-created tasks the actor currently owns",
          set(self_created[2:]) & set(board_ids) == set(self_created[2:]), {"board": board_ids})
    check("the home board excludes completed, removed and not-created tasks",
          done_id not in board_ids and inactive_id not in board_ids and only_created not in board_ids, {"board": board_ids})
    check("the home board is capped at ten and ordered by assignment time then id",
          len(board_ids) <= 10 and board_ids == expected_ids, {"board": board_ids, "expected": expected_ids})
    check("the home response no longer carries personalItems or recentLogs",
          "personalItems" not in home and "recentLogs" not in home and sorted(home) == ["assignedTasks", "businessDate", "companyItems"], sorted(home))
    employee_home = f.call("GET", "/home", token=f.login("alpha-one-employee")[1]["token"])[1]
    employee_board = [row["taskId"] for row in employee_home["assignedTasks"]]
    check("another employee's board shows tasks assigned by someone else",
          set(other_created) <= set(employee_board), {"board": employee_board})
    check("an unpublished creation never enters the board", unpublished not in employee_board, {"board": employee_board})

    # -- admin company information keeps its ten-item limit ----------------
    f.db.server_side("DELETE FROM home_items WHERE kind='company'")
    for index in range(10):
        status, result = f.call("POST", "/admin/company/items", {"body": "Company " + str(index)},
            admin, "company-" + str(index) + "-" + uuid.uuid4().hex)
        if status != 200:
            raise AssertionError(("company", index, status, result))
    status, result = f.call("POST", "/admin/company/items", {"body": "Company 11"}, admin, "company-11-" + uuid.uuid4().hex)
    check("the administrator company-information limit still rejects the eleventh item",
          status == 409 and result.get("code") == "HOME_ITEM_LIMIT", result)


if __name__ == "__main__":
    main()
