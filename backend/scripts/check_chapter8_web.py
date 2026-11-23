#!/usr/bin/env python3
"""Chapter 8 real-browser acceptance: ranged daily items, server-side task table and profile fields.

Owns a disposable database/service and a local real-Chrome run. The task table is exercised through
the real `/tasks/table` endpoint, including a later-page pin, not a client-side page re-sort.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import subprocess
import sys
import uuid

from fixed_model_fixture import Fixture

AUDIT = pathlib.Path(__file__).resolve().parents[2] / "audit/prepare-employee-client-contracts-and-business-upgrade"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=18270)
    args = parser.parse_args()
    AUDIT.mkdir(parents=True, exist_ok=True)
    fixture = Fixture(port=args.port)
    fixture.log_path = AUDIT / "chapter8-service.log"
    try:
        with fixture as f:
            founder = f.login("founder")[1]["token"]
            employee = f.identities["alpha-one-employee"]
            employee_token = f.login("alpha-one-employee")[1]["token"]
            admin = f.login("admin")[1]["token"]
            org = employee["organizationId"]
            base = "2027-01-05"
            tasks = []
            titles = ["阿波罗分镜", "波塞冬分镜", "分镜2", "分镜10", "a lower", "A upper"]
            for i in range(55):
                title = titles[i] if i < len(titles) else f"动画交付任务 {i:03d}"
                status, task = f.call("POST", "/tasks", {
                    "title": title, "description": "第八章真实浏览器任务",
                    "priority": ["urgent", "high", "medium", "low"][i % 4],
                    "allDay": False,
                    "startAt": f"{base}T09:00:00+08:00",
                    "dueAt": f"{base}T18:00:00+08:00",
                    "assigneeIds": [employee["id"]],
                }, founder, "chapter8-task-" + uuid.uuid4().hex)
                if status not in (200, 201):
                    raise RuntimeError((status, task))
                tasks.append(task["taskId"])
            # A later-page task is pinned from the detail page by the browser script.
            pin_candidate = tasks[50]
            # A ranged daily item plus one single-day item for the list/detail/form checks.
            for start, end, body in (("2027-01-08", "2027-01-10", "跨日事项：整理三天的动画分镜"),
                                     ("2027-01-11", "2027-01-11", "单日事项：检查合成输出")):
                status, item = f.call("POST", "/daily-items", {"startDate": start, "endDate": end, "body": body},
                                      employee_token, "chapter8-item-" + uuid.uuid4().hex)
                if status not in (200, 201):
                    raise RuntimeError((status, item))
            profile = f.call("GET", "/me/profile", token=employee_token)[1]
            f.call("PATCH", "/me/profile", {"email": "employee@example.test"}, employee_token,
                   "chapter8-email-" + uuid.uuid4().hex, profile["rowVersion"])
            employee_detail = f.call("GET", "/admin/employees/" + employee["id"], token=admin)[1]
            f.call("PATCH", "/admin/employees/" + employee["id"], {"hireDate": "2024-02-29"}, admin,
                   "chapter8-hire-" + uuid.uuid4().hex, employee_detail["rowVersion"])
            manifest = {
                "base": f"http://127.0.0.1:{f.port}",
                "identities": f.identities,
                "tasks": tasks,
                "pinCandidate": pin_candidate,
                "ranged": {"start": "2027-01-08", "end": "2027-01-10", "body": "跨日事项：整理三天的动画分镜"},
                "single": {"date": "2027-01-11", "body": "单日事项：检查合成输出"},
                "adminToken": admin,
                "employee": employee["id"],
            }
            env = {**os.environ, "PANDORA_BROWSER_FIXTURE": json.dumps(manifest, ensure_ascii=False)}
            subprocess.run(["node", str(pathlib.Path(__file__).resolve().parent / "check_chapter8_browser.js")],
                           env=env, check=True)
    finally:
        report = AUDIT / "chapter8-browser.json"
        print(json.dumps({"report": str(report), "exists": report.exists()}, ensure_ascii=False))


if __name__ == "__main__":
    main()
