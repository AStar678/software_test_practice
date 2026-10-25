#!/usr/bin/env python3
"""HTTP verification for chapter 8: shared single-select tags, flat comments and their notifications.

Run against an isolated, freshly seeded database with the event worker and controllable clock:

    CHECK_WORKER=true CHECK_FIXED_TIME=2026-10-25T04:00:00Z ./scripts/run_check_isolated.sh \
        python3 scripts/check_tags_comments.py --base-url {base} --output ../audit/2026-10-25/chapter8-tags-comments.json

Covers: founder-only catalogue maintenance, single-tag writes through the task review lifecycle,
rename/recolour vs. immutable audit snapshots, logical deletion and retention, flat comment authority
(viewer vs. author), reply hierarchy refusal, stable publication paging, the waiting/frozen business
fields, and the comment-only notification matrix (recipients, dedupe, edit/delete, deleted excerpt,
lost authority at open time).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

RESULTS: list[dict] = []
REVIEWER_IDS: dict[str, str] = {}
PASSWORD = "Demo@123456"
DB_DATABASE: str | None = None
DB_DEFAULTS = ".runtime/mysql-admin.cnf"
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
    def key(prefix="tags"):
        return prefix + "-" + uuid.uuid4().hex

    @staticmethod
    def etag(body):
        return '"' + str(body.get("rowVersion")) + '"'


def check(name: str, condition: bool, evidence=None) -> None:
    RESULTS.append({"check": name, "pass": bool(condition), "evidence": evidence})
    print(("PASS  " if condition else "FAIL  ") + name + ("" if condition else f"  -> {evidence}"))


def db_sql(statement: str) -> str:
    if not DB_DATABASE:
        raise RuntimeError("an isolated database is required for the equal-timestamp paging fixture")
    result = subprocess.run(["mysql", f"--defaults-file={DB_DEFAULTS}", f"--database={DB_DATABASE}",
                             "-N", "-B", "-e", statement], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"sql failed: {result.stderr}")
    return result.stdout.strip()


def wait_for(predicate, timeout=20.0, interval=0.5):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        try:
            last = predicate()
        except Exception as error:  # noqa: BLE001 - transient reads are retried
            last = error
        if last:
            return last
        time.sleep(interval)
    return None


def iso_day(days: int = 0) -> str:
    return (dt.datetime.now(COMPANY).date() + dt.timedelta(days=days)).isoformat()


def create_task(api: Api, token: str, body: dict) -> dict:
    status, created, _ = api.call("POST", "/api/v1/tasks", token, body, api.key("task"))
    if status not in (200, 201):
        raise SystemExit(f"task create failed: {status} {created}")
    return created


def approve_current(api: Api, creator: str, result: dict, reviewer: str) -> None:
    """Decide as the reviewer of record. The applicant reads the request, then the real reviewer
    account (resolved from the request itself) decides — the non-creation route may differ per owner."""
    request_id = result.get("requestId")
    if not request_id:
        return
    status, request, headers = api.call("GET", "/api/v1/approval-requests/" + request_id, api.tokens[creator])
    if status != 200 or request.get("status") != "pending":
        return
    reviewer_id = request.get("currentReviewerId")
    account = next((name for name, uid in REVIEWER_IDS.items() if uid == reviewer_id), None)
    if account is None:
        raise SystemExit(f"reviewer {reviewer_id} is not a demo account")
    status, decided, _ = api.call("PATCH", "/api/v1/approval-requests/" + request_id, api.tokens[account],
                                  {"decision": "approve", "comment": "检查通过"}, api.key("decide"),
                                  Api.etag(request))
    if status != 200:
        raise SystemExit(f"approval failed: {status} {decided}")


def run(base: str) -> int:
    api = Api(base)
    for username in ("admin", "upper", "middle", "employee", "colleague", "marketing"):
        api.login(username)
    upper, middle, employee, colleague, marketing = (api.tokens[name] for name in
                                                     ("upper", "middle", "employee", "colleague", "marketing"))
    _, employee_me, _ = api.call("GET", "/api/v1/me", employee)
    _, middle_me, _ = api.call("GET", "/api/v1/me", middle)
    _, colleague_me, _ = api.call("GET", "/api/v1/me", colleague)
    _, upper_me, _ = api.call("GET", "/api/v1/me", upper)
    employee_id, middle_id, colleague_id = employee_me["id"], middle_me["id"], colleague_me["id"]
    REVIEWER_IDS.update({"upper": upper_me["id"], "middle": middle_id, "employee": employee_id, "colleague": colleague_id})
    marker = "8.x-" + uuid.uuid4().hex[:8]

    # ---------------- 8.1 catalogue authority and single selection ----------------
    status, catalogue, _ = api.call("GET", "/api/v1/tags", employee)
    palette = catalogue.get("palette") or []
    check("8.1 every business account can read the company catalogue and its fixed palette",
          status == 200 and len(palette) >= 4 and catalogue.get("canManage") is False
          and all(row["color"].startswith("#") for row in palette), catalogue.get("items"))
    check("8.1 the default unmarked pink is outside the palette",
          all(row["color"].lower() != (catalogue.get("defaultColor") or "").lower() for row in palette),
          catalogue.get("defaultColor"))
    status, denied, _ = api.call("POST", "/api/v1/tags", employee, {"name": marker, "color": palette[0]["color"]}, api.key())
    check("8.1 a non-founder employee cannot maintain the catalogue",
          status == 403 and denied.get("code") == "TAG_MAINTENANCE_FORBIDDEN", denied)
    status, denied, _ = api.call("POST", "/api/v1/tags", middle, {"name": marker, "color": palette[0]["color"]}, api.key())
    check("8.1 an upper identity that is not the unique root is still refused",
          status == 403 and denied.get("code") == "TAG_MAINTENANCE_FORBIDDEN", denied)
    status, admin_denied, _ = api.call("POST", "/api/v1/tags", api.tokens["admin"], {"name": marker, "color": palette[0]["color"]}, api.key())
    check("8.1 the independent administrator cannot impersonate the founder on the employee API",
          status == 403 and admin_denied.get("code") == "BUSINESS_ROLE_REQUIRED", admin_denied)
    status, bad_color, _ = api.call("POST", "/api/v1/tags", upper, {"name": marker, "color": "#123456"}, api.key())
    check("8.1 a colour outside the predefined palette is rejected", status == 400, bad_color)

    tag_a = marker + " 重点"
    tag_b = marker + " 例行"
    status, created_a, _ = api.call("POST", "/api/v1/tags", upper, {"name": tag_a, "color": palette[0]["color"]}, api.key())
    status_b, created_b, _ = api.call("POST", "/api/v1/tags", upper, {"name": tag_b, "color": palette[1]["color"]}, api.key())
    tag_a_id, tag_b_id = created_a.get("tagId"), created_b.get("tagId")
    check("8.1 the founder creates tags from the predefined palette",
          status in (200, 201) and status_b in (200, 201) and tag_a_id and tag_b_id, {"a": created_a, "b": created_b})
    status, duplicate_name, _ = api.call("POST", "/api/v1/tags", upper, {"name": tag_a, "color": palette[2]["color"]}, api.key())
    check("8.1 a duplicate tag name is refused", status == 409 and duplicate_name.get("code") == "TAG_NAME_TAKEN", duplicate_name)
    status, catalogue, _ = api.call("GET", "/api/v1/tags", middle)
    check("8.1 the founder sees the maintenance capability, other accounts do not",
          catalogue.get("canManage") is False
          and (api.call("GET", "/api/v1/tags", upper)[1].get("canManage") is True), {})

    # ---------------- task tag through creation + review ----------------
    title = marker + " 带标签任务"
    body = {"title": title, "description": "标签与审核生命周期验证。", "priority": "medium", "allDay": True,
            "startDate": iso_day(0), "dueDate": iso_day(3),
            "assigneeIds": [employee_id, colleague_id], "tagId": tag_a_id}
    created = create_task(api, middle, body)
    approve_current(api, "middle", created, "upper")
    status, detail, headers = api.call("GET", "/api/v1/tasks/" + created["taskId"], middle)
    task_etag = headers.get("ETag") or Api.etag(detail)
    check("8.1 a creation carries exactly one tag into the effective version",
          status == 200 and detail.get("tagId") == tag_a_id and detail.get("tag", {}).get("name") == tag_a,
          detail.get("tag"))
    status, multi, _ = api.call("POST", "/api/v1/tasks", middle,
                                {**body, "title": title + " 多标签", "tagIds": [tag_a_id, tag_b_id]}, api.key())
    check("8.1 a multi-tag submission is rejected before any write", status == 400, multi)
    status, unknown, _ = api.call("POST", "/api/v1/tasks", middle,
                                  {**body, "title": title + " 未知标签", "tagId": str(uuid.uuid4())}, api.key())
    check("8.1 an unknown/cross-company tag reference is rejected", status == 400, unknown)

    # Change the tag: the proposal waits for review and the effective version keeps the old tag.
    status, change, _ = api.call("PATCH", "/api/v1/tasks/" + created["taskId"], middle,
                                 {"command": "change", "tagId": tag_b_id, "reason": "调整标签",
                                  "title": title, "description": "标签与审核生命周期验证。", "priority": "medium",
                                  "allDay": True, "startDate": iso_day(0), "dueDate": iso_day(3),
                                  "assigneeIds": [employee_id, colleague_id]}, api.key(), task_etag)
    status, during, _ = api.call("GET", "/api/v1/tasks/" + created["taskId"], middle)
    check("8.1/8.3 a pending tag change does not alter the effective tag",
          status == 200 and during.get("tagId") == tag_a_id and during.get("frozen") is True, during.get("tag"))
    approve_current(api, "middle", change, "upper")
    status, after, _ = api.call("GET", "/api/v1/tasks/" + created["taskId"], middle)
    check("8.1 the approved tag change becomes the effective single tag",
          status == 200 and after.get("tagId") == tag_b_id, after.get("tag"))

    # History keeps the name used at submission even after the catalogue is renamed.
    status, history, _ = api.call("GET", "/api/v1/admin/tasks/" + created["taskId"] + "/history", api.tokens["admin"])
    entries = history.get("entries") or history.get("items") or []
    snapshot_entry = next((row for row in entries if row.get("fieldName") == "tagId"), None)
    status, renamed_a, _ = api.call("PATCH", "/api/v1/tags/" + tag_a_id, upper,
                                    {"name": tag_a + " 改名"}, api.key(), '"' + str(created_a["rowVersion"]) + '"')
    _, history_after, _ = api.call("GET", "/api/v1/admin/tasks/" + created["taskId"] + "/history", api.tokens["admin"])
    entries_after = history_after.get("entries") or history_after.get("items") or []
    snapshot_after = next((row for row in entries_after if row.get("fieldName") == "tagId"), None)
    check("8.3 renaming the tag does not rewrite the recorded audit snapshot",
          status == 200 and snapshot_entry is not None
          and snapshot_entry.get("beforeValue") == tag_a and snapshot_entry.get("afterValue") == tag_b
          and snapshot_after == snapshot_entry,
          {"before": snapshot_entry, "after": snapshot_after})

    # ---------------- 8.4 flat comments and author control ----------------
    status, posted, _ = api.call("POST", "/api/v1/tasks/" + created["taskId"] + "/comments", employee,
                                 {"body": marker + " 第一条评论"}, api.key("comment"))
    first_id = posted.get("commentId")
    check("8.4 a task viewer who is not the reviewer can publish a flat comment",
          status in (200, 201) and bool(first_id), posted)
    status, reply, _ = api.call("POST", "/api/v1/tasks/" + created["taskId"] + "/comments", colleague,
                                {"body": "回复", "parentId": first_id}, api.key("comment"))
    check("8.4 a reply/hierarchy field is rejected", status == 400, reply)
    status, list, _ = api.call("GET", "/api/v1/tasks/" + created["taskId"] + "/comments?limit=1&offset=0", middle)
    check("8.4 comments are readable by a normal task viewer with stable publication paging",
          status == 200 and list.get("total") == 1 and list.get("items")[0]["authorId"] == employee_id
          and list["items"][0].get("canManage") is False and list.get("nextOffset") is None, list)
    status, forbidden, _ = api.call("PATCH", "/api/v1/comments/" + first_id, colleague,
                                    {"body": "改别人的评论"}, api.key("comment"), Api.etag(list["items"][0]))
    check("8.4 only the author may edit a comment", status == 403 and forbidden.get("code") == "COMMENT_AUTHOR_ONLY", forbidden)
    status, forbidden, _ = api.call("DELETE", "/api/v1/comments/" + first_id, middle,
                                    key=api.key("comment"), if_match=Api.etag(list["items"][0]))
    check("8.4 a manager or task owner cannot delete another author's comment",
          status == 403 and forbidden.get("code") == "COMMENT_AUTHOR_ONLY", forbidden)
    status, edited, _ = api.call("PATCH", "/api/v1/comments/" + first_id, employee,
                                 {"body": marker + " 第一条评论已编辑"}, api.key("comment"), Api.etag(list["items"][0]))
    check("8.4 the author edits their own comment and it is marked edited", status == 200 and edited.get("edited") is True, edited)

    # Comments do not unfreeze or change the task business fields.
    status, detail_now, _ = api.call("GET", "/api/v1/tasks/" + created["taskId"], middle)
    check("8.4 comments leave the task version and its execution state untouched",
          detail_now.get("tagId") == tag_b_id and detail_now.get("executionState") == "todo", {})

    # Three comments, paged two at a time in publication order.
    ids = [first_id]
    for index in range(2):
        status, extra, _ = api.call("POST", "/api/v1/tasks/" + created["taskId"] + "/comments", colleague,
                                    {"body": marker + f" 补充评论 {index}"}, api.key("comment"))
        ids.append(extra.get("commentId"))
    status, page1, _ = api.call("GET", "/api/v1/tasks/" + created["taskId"] + "/comments?limit=2&offset=0", middle)
    status, page2, _ = api.call("GET", "/api/v1/tasks/" + created["taskId"] + "/comments?limit=2&offset=2", middle)
    check("8.4 stable publication-order paging is complete and free of duplicates",
          status == 200 and [row["id"] for row in page1["items"]] == ids[:2]
          and [row["id"] for row in page2["items"]] == ids[2:]
          and page1["nextOffset"] == 2 and page2["nextOffset"] is None, {"page1": page1, "page2": page2})

    # ---------------- V-002 deletion-stable continuation ----------------
    def paging_task(label: str) -> str:
        result = create_task(api, middle, {
            "title": marker + " " + label, "description": "评论分页回归。", "priority": "medium",
            "allDay": True, "startDate": iso_day(0), "dueDate": iso_day(3),
            "assigneeIds": [employee_id, colleague_id]})
        approve_current(api, "middle", result, "upper")
        return result["taskId"]

    def publish_comment(task_id: str, token: str, body: str) -> str:
        status, result, _ = api.call("POST", f"/api/v1/tasks/{task_id}/comments", token,
                                     {"body": body}, api.key("comment"))
        if status not in (200, 201):
            raise SystemExit(f"paging comment failed: {status} {result}")
        return result["commentId"]

    def comment_page(task_id: str, token: str, cursor=None, limit=2):
        suffix = f"?limit={limit}&" + (f"cursor={urllib.parse.quote(cursor)}" if cursor else "offset=0")
        status, result, _ = api.call("GET", f"/api/v1/tasks/{task_id}/comments{suffix}", token)
        if status != 200:
            raise SystemExit(f"comment page failed: {status} {result}")
        return result

    delete_task = paging_task("分页删除修复")


    delete_a = publish_comment(delete_task, employee, marker + " 删除场景A")
    delete_b = publish_comment(delete_task, colleague, marker + " 删除场景B")
    delete_c = publish_comment(delete_task, employee, marker + " 删除场景C")
    delete_page1 = comment_page(delete_task, middle)
    check("V-002 the first page returns a stable continuation cursor",
          [row["id"] for row in delete_page1["items"]] == [delete_a, delete_b]
          and bool(delete_page1.get("nextCursor")), delete_page1)
    status, deleted_paged, _ = api.call("DELETE", "/api/v1/comments/" + delete_a, employee,
                                       key=api.key("comment"), if_match=Api.etag(delete_page1["items"][0]))
    delete_page2 = comment_page(delete_task, middle, delete_page1.get("nextCursor"))
    check("V-002 deleting an already-paged comment still reaches every unseen comment",
          status == 200 and [row["id"] for row in delete_page2["items"]] == [delete_c]
          and delete_page2.get("nextCursor") is None
          and all("删除场景A" not in (row.get("body") or "") for row in delete_page2["items"]),
          {"page2": delete_page2})

    edit_task = paging_task("分页编辑修复")
    edit_d = publish_comment(edit_task, employee, marker + " 编辑场景D")
    edit_e = publish_comment(edit_task, colleague, marker + " 编辑场景E")
    edit_f = publish_comment(edit_task, employee, marker + " 编辑场景F")
    edit_page1 = comment_page(edit_task, middle)
    status, reedited, _ = api.call("PATCH", "/api/v1/comments/" + edit_e, colleague,
                                   {"body": marker + " 编辑场景E已编辑"}, api.key("comment"),
                                   Api.etag(edit_page1["items"][1]))
    edit_page2 = comment_page(edit_task, middle, edit_page1.get("nextCursor"))
    check("V-002 editing an already-paged comment does not change the continuation",
          status == 200 and reedited.get("edited") is True
          and [row["id"] for row in edit_page1["items"]] == [edit_d, edit_e]
          and [row["id"] for row in edit_page2["items"]] == [edit_f]
          and edit_page2.get("nextCursor") is None,
          {"page2": edit_page2, "edited": reedited})

    equal_task = paging_task("分页同时间修复")
    equal_ids = [publish_comment(equal_task, employee, marker + f" 同时间{index}")
                 for index in range(4)]
    db_sql("UPDATE task_log_comments SET created_at='2026-10-25 04:00:00.000001' "
           f"WHERE task_id='{equal_task}'")
    equal_expected = db_sql(f"SELECT id FROM task_log_comments WHERE task_id='{equal_task}' "
                            "AND deleted_at IS NULL ORDER BY created_at,id").splitlines()
    equal_page1 = comment_page(equal_task, middle)
    equal_page2 = comment_page(equal_task, middle, equal_page1.get("nextCursor"))
    equal_seen = [row["id"] for row in equal_page1["items"] + equal_page2["items"]]
    check("V-002 equal publication timestamps keep a stable, complete cursor order",
          bool(equal_page1.get("nextCursor")) and equal_page2.get("nextCursor") is None
          and equal_seen == equal_expected and len(set(equal_seen)) == len(equal_seen) == 4,
          {"seen": equal_seen, "expected": equal_expected, "page1Cursor": equal_page1.get("nextCursor"),
           "page2Cursor": equal_page2.get("nextCursor")})
    # Deleting one already-paged row under equal timestamps must still reach the rest.
    status, _, _ = api.call("DELETE", "/api/v1/comments/" + equal_seen[0], employee,
                            key=api.key("comment"),
                            if_match='"' + str(equal_page1["items"][0]["rowVersion"]) + '"')
    equal_after = comment_page(equal_task, middle, equal_page1.get("nextCursor"))
    equal_after_ids = [row["id"] for row in equal_after["items"]]
    check("V-002 a deletion between equal-time pages skips no unseen comment",
          status == 200 and equal_after_ids == equal_seen[2:] and equal_after.get("nextCursor") is None,
          {"after": equal_after_ids, "expected": equal_seen[2:]})

    many_task = paging_task("分页二十修复")
    many_ids = [publish_comment(many_task, employee if index % 2 else colleague,
                                marker + f" 多页{index:02d}") for index in range(25)]
    many_first = comment_page(many_task, middle, limit=10)
    status, _, _ = api.call("DELETE", "/api/v1/comments/" + many_ids[0], colleague,
                            key=api.key("comment"),
                            if_match='"' + str(many_first["items"][0]["rowVersion"]) + '"')
    collected = [row["id"] for row in many_first["items"]]
    cursor = many_first.get("nextCursor")
    while cursor:
        page = comment_page(many_task, middle, cursor, limit=10)
        collected.extend(row["id"] for row in page["items"])
        cursor = page.get("nextCursor")
    expected_many = db_sql(f"SELECT id FROM task_log_comments WHERE task_id='{many_task}' "
                           "AND deleted_at IS NULL ORDER BY created_at,id").splitlines()
    live_collected = [comment_id for comment_id in collected if comment_id != many_ids[0]]
    check("V-002 the UI page size reaches all >20 live comments after an early deletion",
          len(collected) == 25 and len(set(collected)) == 25
          and live_collected == expected_many and len(expected_many) == 24,
          {"collected": len(collected), "live": len(live_collected), "expected": len(expected_many)})

    # ---------------- 8.5/8.6 comment notifications ----------------
    def employee_comment_notifications():
        _, inbox, _ = api.call("GET", "/api/v1/notifications?limit=100", employee)
        return [row for row in inbox.get("items", []) if row.get("eventType") == "comment.created"
                and (row.get("objectId") or "") == created["taskId"]]

    delivered = wait_for(lambda: [row for row in employee_comment_notifications() if row.get("objectName") == title
                                  and row.get("purpose") == "新评论"], timeout=25)
    check("8.5 an effective assignee receives one comment notification with the real object and purpose",
          bool(delivered) and all(row.get("focus") == "comments" for row in delivered)
          and all("第一条评论已编辑" in (row.get("summary") or "") or "补充评论" in (row.get("summary") or "") for row in delivered),
          {"count": len(delivered or []), "first": (delivered or [None])[0]})
    check("8.5 the commenter and the task creator who is not an assignee receive no comment message",
          not any(row.get("eventType") == "comment.created" for row in api.call("GET", "/api/v1/notifications?limit=100", middle)[1].get("items", []))
          and not any(row.get("eventType") == "comment.created" for row in api.call("GET", "/api/v1/notifications?limit=100", upper)[1].get("items", [])),
          {})
    _, colleague_inbox, _ = api.call("GET", "/api/v1/notifications?limit=100", colleague)
    colleague_copies = [row for row in colleague_inbox.get("items", []) if row.get("eventType") == "comment.created"]
    check("8.5 the other effective assignee receives one copy per event and no duplicate per event",
          len(colleague_copies) >= 1
          and len({row.get("eventId") for row in colleague_copies}) == len(colleague_copies),
          {"commentCopies": len(colleague_copies)})

    # ---------------- V-003 unpublished-task comment recipients ----------------
    unpublished = create_task(api, employee, {
        "title": marker + " 未发布评论接收人", "description": "未发布评论接收矩阵。", "priority": "medium",
        "allDay": True, "startDate": iso_day(0), "dueDate": iso_day(2),
        "assigneeIds": [colleague_id]})
    unpublished_id = unpublished["taskId"]

    def comment_notifications(token: str, object_id: str):
        _, inbox, _ = api.call("GET", "/api/v1/notifications?limit=100", token)
        return [row for row in inbox.get("items", []) if row.get("eventType") == "comment.created"
                and (row.get("objectId") or "") == object_id]

    status_reviewer_comment, reviewer_comment, _ = api.call(
        "POST", f"/api/v1/tasks/{unpublished_id}/comments", middle,
        {"body": marker + " 未发布评审评论"}, api.key("comment"))
    status_applicant_comment, applicant_comment, _ = api.call(
        "POST", f"/api/v1/tasks/{unpublished_id}/comments", employee,
        {"body": marker + " 未发布申请人评论"}, api.key("comment"))
    worker_status = api.call("POST", "/api/v1/admin/worker/run-once", api.tokens["admin"],
                             {}, api.key("worker"))[0]
    check("V-003 an unpublished comment has no recipient by applicant/reviewer role",
          status_reviewer_comment in (200, 201) and status_applicant_comment in (200, 201)
          and worker_status == 200
          and not comment_notifications(employee, unpublished_id)
          and not comment_notifications(middle, unpublished_id),
          {"reviewerComment": status_reviewer_comment, "applicantComment": status_applicant_comment,
           "worker": worker_status,
           "employee": comment_notifications(employee, unpublished_id),
           "middle": comment_notifications(middle, unpublished_id)})

    approve_current(api, "employee", unpublished, "middle")
    status_published_comment, published_comment, _ = api.call(
        "POST", f"/api/v1/tasks/{unpublished_id}/comments", employee,
        {"body": marker + " 发布后评论"}, api.key("comment"))
    api.call("POST", "/api/v1/admin/worker/run-once", api.tokens["admin"], {}, api.key("worker"))
    assigned_copies = comment_notifications(colleague, unpublished_id)
    check("V-003 after publishing only the effective assignee receives the comment message",
          status_published_comment in (200, 201) and len(assigned_copies) == 1
          and not comment_notifications(employee, unpublished_id)
          and not comment_notifications(middle, unpublished_id)
          and (assigned_copies[0].get("objectId") or "") == unpublished_id,
          {"copies": len(assigned_copies), "comment": published_comment})

    status_self_comment, self_comment, _ = api.call(
        "POST", f"/api/v1/tasks/{unpublished_id}/comments", colleague,
        {"body": marker + " 负责人本人评论"}, api.key("comment"))
    api.call("POST", "/api/v1/admin/worker/run-once", api.tokens["admin"], {}, api.key("worker"))
    check("V-003 the only assignee commenting receives no copy and no role gains an extra one",
          status_self_comment in (200, 201)
          and len(comment_notifications(colleague, unpublished_id)) == 1
          and not comment_notifications(employee, unpublished_id)
          and not comment_notifications(middle, unpublished_id),
          {"selfComment": status_self_comment,
           "colleagueCopies": len(comment_notifications(colleague, unpublished_id))})

    # Editing and deleting never create a new notification.
    def employee_comment_events():
        _, inbox, _ = api.call("GET", "/api/v1/notifications?limit=100", employee)
        return [row for row in inbox.get("items", []) if row.get("eventType") == "comment.created"]
    count_before = len(employee_comment_events())
    status, edit_again, _ = api.call("PATCH", "/api/v1/comments/" + first_id, employee,
                                     {"body": marker + " 再次编辑"}, api.key("comment"), '"' + str(edited["rowVersion"]) + '"')
    _, before_delete, _ = api.call("GET", "/api/v1/tasks/" + created["taskId"] + "/comments?limit=100&offset=0", colleague)
    doomed = next(row for row in before_delete["items"] if row["id"] == ids[2])
    status, deleted, _ = api.call("DELETE", "/api/v1/comments/" + ids[2], colleague,
                                  key=api.key("comment"), if_match='"' + str(doomed["rowVersion"]) + '"')
    check("8.4 the author deletes their own comment", status == 200 and deleted.get("deleted") is True, deleted)
    time.sleep(1.5)
    check("8.5 editing or deleting a comment produces no additional notification",
          count_before == len(employee_comment_events()), {"before": count_before, "after": len(employee_comment_events())})
    status, list_after, _ = api.call("GET", "/api/v1/tasks/" + created["taskId"] + "/comments?limit=10&offset=0", employee)
    check("8.4 a deleted comment no longer exposes its body in the list",
          status == 200 and all(row["id"] != ids[2] for row in list_after["items"]), list_after.get("total"))

    def deleted_copy():
        _, inbox, _ = api.call("GET", "/api/v1/notifications?limit=100", employee)
        matches = [row for row in inbox.get("items", []) if row.get("eventType") == "comment.created"
                   and "该评论已删除" in (row.get("summary") or "")]
        return matches[0] if matches else None

    deleted_message = wait_for(deleted_copy, timeout=10)
    check("8.5 the existing message for a deleted comment is clipped and loses its object jump",
          bool(deleted_message) and deleted_message.get("objectId") is None and deleted_message.get("focus") is None,
          deleted_message)

    # Same idempotency key twice: one comment, one message.
    dedupe_body = {"body": marker + " 幂等评论"}
    dedupe_key = api.key("comment")
    status, once, _ = api.call("POST", "/api/v1/tasks/" + created["taskId"] + "/comments", employee, dedupe_body, dedupe_key)
    status2, twice, _ = api.call("POST", "/api/v1/tasks/" + created["taskId"] + "/comments", employee, dedupe_body, dedupe_key)
    _, dedupe_list, _ = api.call("GET", "/api/v1/tasks/" + created["taskId"] + "/comments?limit=100&offset=0", employee)
    check("8.5 a retried comment request creates exactly one comment",
          status == status2 and once.get("commentId") == twice.get("commentId")
          and len([row for row in dedupe_list["items"] if row["body"] == dedupe_body["body"]]) == 1,
          {"first": once, "second": twice})

    # ---------------- delivered comment messages re-verify current authority ----------------
    delivered_comment = next((row for row in employee_comment_events()
                              if row.get("objectId") == created["taskId"]), None)
    _, task_now, task_headers = api.call("GET", "/api/v1/tasks/" + created["taskId"], middle)
    status_change, change, _ = api.call("PATCH", "/api/v1/tasks/" + created["taskId"], middle,
                                        {"command": "change", "reason": "移除评论接收人", "title": title,
                                         "description": "标签与审核生命周期验证。", "priority": "medium", "allDay": True,
                                         "startDate": iso_day(0), "dueDate": iso_day(3), "assigneeIds": [colleague_id]},
                                        api.key("change"), Api.etag(task_now))
    approve_current(api, "middle", change, "upper")
    _, effective_after, _ = api.call("GET", "/api/v1/tasks/" + created["taskId"], middle)
    check("8.4 the removal of one assignee becomes the effective version",
          status_change in (200, 201) and employee_id not in (effective_after.get("assigneeIds") or []),
          {"status": status_change, "result": change, "assignees": effective_after.get("assigneeIds")})
    _, gone, _ = api.call("GET", "/api/v1/tasks/" + created["taskId"] + "/comments?limit=10&offset=0", employee)
    check("8.4 losing task authority removes normal comment access", gone.get("code") == "NOT_FOUND" or gone.get("message") or not gone.get("items"), gone)
    if delivered_comment:
        _, reopened, _ = api.call("GET", "/api/v1/notifications/" + delivered_comment["id"], employee)
        check("8.5 an already delivered comment message is re-verified and masked after authority loss",
              reopened.get("objectId") is None and reopened.get("focus") is None
              and "第一条评论" not in (reopened.get("summary") or "")
              and reopened.get("purpose") == "新评论", reopened)
    else:
        check("8.5 an already delivered comment message is re-verified and masked after authority loss", False, "no delivered comment message")

    # ---------------- log comments stay independent of the 24h freeze ----------------
    _, logs, _ = api.call("GET", "/api/v1/work-logs?scope=self&limit=10", employee)
    log_id = logs["items"][0]["id"]
    status, log_comment, _ = api.call("POST", "/api/v1/work-logs/" + log_id + "/comments", middle,
                                      {"body": marker + " 日志评论"}, api.key("comment"))
    check("8.4 a manager with log read authority can comment on a log without body edit rights",
          status in (200, 201), log_comment)
    status, outsider, _ = api.call("POST", "/api/v1/work-logs/" + log_id + "/comments", marketing,
                                   {"body": "越权评论"}, api.key("comment"))
    check("8.4 an account outside the log range cannot comment", status in (403, 404), outsider)
    def log_comment_messages():
        _, inbox, _ = api.call("GET", "/api/v1/notifications?limit=100", employee)
        return [row for row in inbox.get("items", []) if row.get("eventType") == "comment.created"
                and row.get("objectType") == "log" and row.get("objectId") == log_id]
    log_messages = wait_for(log_comment_messages, timeout=25) or []
    check("8.5 a log comment binds the log object (not a task) and locates the comment area",
          bool(log_messages) and all(row.get("focus") == "comments" for row in log_messages)
          and (log_messages[0].get("objectName") or "").startswith("日志"), log_messages[:1])
    check("8.5 the log author receives at most one copy of that comment message",
          len(log_messages) == 1, {"count": len(log_messages)})

    # Advancing past the log freeze keeps the comment area writable for the author's own comments.
    status, clock, _ = api.call("GET", "/api/v1/admin/clock", api.tokens["admin"])
    if status == 200 and clock.get("controllable"):
        _, before_freeze, _ = api.call("GET", "/api/v1/work-logs/" + log_id, employee)
        freeze_at = dt.datetime.fromisoformat(before_freeze["frozenAt"].replace("Z", "+00:00"))
        now = dt.datetime.fromisoformat(clock["now"].replace("Z", "+00:00"))
        seconds = max(1, int((freeze_at - now).total_seconds()) + 5)
        status, moved, _ = api.call("POST", "/api/v1/admin/clock/advance", api.tokens["admin"], {"seconds": seconds})
        if status != 200:
            raise SystemExit(f"clock advance failed: {status} {moved}")
        status, frozen_log, _ = api.call("GET", "/api/v1/work-logs/" + log_id, employee)
        check("8.4 the log body is frozen while its comment area stays independent",
              status == 200 and frozen_log.get("editable") is False, {k: frozen_log.get(k) for k in ("editable", "frozen")})
        status, late_comment, _ = api.call("POST", "/api/v1/work-logs/" + log_id + "/comments", middle,
                                           {"body": marker + " 冻结后的评论"}, api.key("comment"))
        check("8.4 a frozen log still accepts new comments", status in (200, 201), late_comment)
        status, own_late, _ = api.call("PATCH", "/api/v1/comments/" + log_comment["commentId"], middle,
                                       {"body": marker + " 日志评论（编辑）"}, api.key("comment"), '"1"')
        check("8.4 the author may still manage their own comment after the object freeze", status == 200, own_late)
    else:
        check("8.4 controlled clock unavailable for the frozen-log comment check", False, clock)

    return 0 if all(item["pass"] for item in RESULTS) else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:18120")
    parser.add_argument("--database", default=None)
    parser.add_argument("--defaults-file", default=".runtime/mysql-admin.cnf")
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    global DB_DATABASE, DB_DEFAULTS
    DB_DEFAULTS = args.defaults_file
    derived = re.search(r"/([A-Za-z0-9_]+)\?", os.environ.get("PANDORA_DB_URL", ""))
    DB_DATABASE = args.database or (derived.group(1) if derived else None)
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
