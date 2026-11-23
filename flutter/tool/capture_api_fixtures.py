#!/usr/bin/env python3
"""Capture sanitized real-backend samples for the Flutter adapter tests.

Usage (demo backend on 127.0.0.1:8080):
    python3 tool/capture_api_fixtures.py

Tokens are never written. Only demo business data is captured.
"""
import json
import pathlib
import urllib.request

BASE = "http://127.0.0.1:8080/api/v1"
PASSWORD = "Demo@123456"
OUT = pathlib.Path(__file__).resolve().parent.parent / "test" / "fixtures" / "api"
OUT.mkdir(parents=True, exist_ok=True)


def call(method, path, token=None, body=None, extra=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    for k, v in (extra or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode()
            return json.loads(raw), r.headers.get("ETag"), r.status
    except urllib.error.HTTPError as e:
        return {"error": e.read().decode()}, e.headers.get("ETag"), e.code


def login(phone):
    payload, _, _ = call("POST", "/auth/sessions", body={
        "accountType": "employee", "phone": phone, "password": PASSWORD})
    return payload["token"], payload["user"]


def save(name, payload):
    (OUT / (name + ".json")).write_text(
        json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")


def main():
    employee_token, employee = login("13800000004")
    manager_token, manager = login("13800000011")

    session, _, _ = call("GET", "/auth/session", employee_token)
    save("auth_session", {"user": session, "passwordChangeRequired": False})
    me, _, _ = call("GET", "/me", employee_token)
    save("me", me)

    home, _, _ = call("GET", "/home", employee_token)
    save("home", home)

    tasks, tasks_etag, _ = call("GET", "/tasks?limit=20&offset=0", employee_token)
    save("tasks", tasks)
    table, _, _ = call("GET", "/tasks/table?relation=all&completion=all&sort=title&direction=asc&limit=50&offset=0", employee_token)
    save("tasks_table", table)

    first = tasks["items"][0]["id"]
    detail, detail_etag, _ = call("GET", "/tasks/" + first, employee_token)
    save("task_detail", detail)
    save("task_detail_headers", {"etag": detail_etag})

    preview, _, _ = call("POST", "/tasks/reviewer-preview", employee_token,
                         body={"command": "create", "assigneeIds": [employee["id"]],
                               "title": "样例", "allDay": False})
    save("reviewer_preview", preview)

    targets, _, _ = call("GET", "/handover-targets", employee_token)
    save("handover_targets", targets)
    preset, _, _ = call("GET", "/users/%s/handover-preset" % employee["id"], employee_token)
    save("handover_preset", preset)

    mine, _, _ = call("GET", "/approval-requests?mine=applicant&limit=20&offset=0", employee_token)
    save("approval_mine_applicant", mine)
    if mine.get("items"):
        rid = mine["items"][0]["requestId"]
        save("approval_request_id", {"requestId": rid, "mine": "applicant"})
        req, etag, _ = call("GET", "/approval-requests/" + rid, employee_token)
        save("approval_request", req)
        save("approval_request_headers", {"etag": etag})

    review, _, _ = call("GET", "/approval-requests?mine=reviewer&limit=20&offset=0", manager_token)
    save("approval_mine_reviewer", review)
    if review.get("items"):
        rid = review["items"][0]["requestId"]
        req, etag, status = call("GET", "/approval-requests/" + rid, manager_token)
        if status == 200:
            save("approval_request_reviewer", req)
            save("approval_request_reviewer_headers", {"etag": etag})

    daily, _, _ = call("GET", "/daily-items?from=2026-11-01&to=2026-11-30&limit=50&offset=0", employee_token)
    save("daily_items_range", daily)
    summary, _, _ = call("GET", "/daily-items/summary?from=2026-11-01&to=2026-11-30", employee_token)
    save("daily_items_summary", summary)
    day, _, _ = call("GET", "/daily-items?date=2026-11-10&limit=50&offset=0", employee_token)
    save("daily_items_day", day)
    dnum, _, _ = call("GET", "/daily-items?from=2026-10-01&to=2026-12-31&limit=2&offset=0", employee_token)
    save("daily_items_paged", dnum)

    candidates, _, _ = call("GET", "/assignee-candidates?q=&purpose=create", employee_token)
    save("assignee_candidates", candidates)
    authors, _, _ = call("GET", "/work-log-authors", manager_token)
    save("work_log_authors", authors)

    notifications, _, _ = call("GET", "/notifications?limit=5&offset=0", manager_token)
    save("notifications", notifications)
    if notifications.get("items"):
        nid = notifications["items"][0]["id"]
        note, etag, _ = call("GET", "/notifications/" + nid, manager_token)
        save("notification_detail", note)
        save("notification_headers", {"etag": etag})

    (OUT / "capture_meta.json").write_text(json.dumps({
        "businessDate": home.get("businessDate"),
        "organizationTimeZone": me.get("organizationTimeZone"),
        "capturedFrom": "pandora_demo @ http://127.0.0.1:8080",
        "demoPasswordPublic": True,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print("captured", len(list(OUT.glob('*.json'))), "files in", OUT)


if __name__ == "__main__":
    main()
