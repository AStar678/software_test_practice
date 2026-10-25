#!/usr/bin/env python3
"""HTTP verification for task 3.5: person-detail phone matrix and contact leakage boundaries.

The employee's phone is temporarily set through the real self-service endpoint and restored in
finally. The employee is temporarily transferred to the marketing chain to prove that the old
superior loses phone access and the new actual superior gains it, then restored. No password is
written to the report.

    python3 scripts/check_profile_phone_matrix.py --base-url http://127.0.0.1:18101
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request
import uuid

RESULTS: list[dict] = []
PASSWORD = "Demo@123456"



# Employees authenticate by phone number (chapter 2.1/2.3); demo accounts keep stable numbers.
DEMO_PHONE = {'upper': '13800000001', 'middle': '13800000002', 'market': '13800000003',
              'employee': '13800000004', 'colleague': '13800000005', 'marketing': '13800000006',
              'admin': 'admin'}


def login_identity(account):
    """Map a demo account name to the phone number it now authenticates with."""
    return DEMO_PHONE.get(account, account)

class Api:
    def __init__(self, base: str):
        self.identifiers = {}
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
        identity = self.identifiers.get(username, login_identity(username))
        status, body, _ = self.call("POST", "/api/v1/auth/sessions",
                                    body={'username': identity, 'password': PASSWORD})
        if status != 200:
            raise SystemExit(f"login failed for {username}: {status} {body}")
        self.tokens[username] = body["token"]
        return body["token"]

    @staticmethod
    def key(prefix="phone"):
        return prefix + "-" + uuid.uuid4().hex

    @staticmethod
    def etag(body, headers):
        return headers.get("ETag") or '"' + str(body.get("rowVersion")) + '"'


def check(name: str, condition: bool, evidence=None) -> None:
    RESULTS.append({"check": name, "pass": bool(condition), "evidence": evidence})
    print(("PASS  " if condition else "FAIL  ") + name + ("" if condition else f"  -> {evidence}"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:18101")
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    api = Api(args.base_url)
    for username in ("admin", "upper", "middle", "employee", "colleague", "market"):
        api.login(username)
    ids = {}
    for username, token in api.tokens.items():
        status, me, _ = api.call("GET", "/api/v1/me", token)
        if status == 200:
            ids[username] = me["id"]
    employee = ids["employee"]
    phone = "13900001111"
    original_phone = None
    original_employee = None
    profile_etag = None
    try:
        status, profile, headers = api.call("GET", "/api/v1/me/profile", api.tokens["employee"])
        if status != 200:
            raise SystemExit(f"employee profile unavailable: {status} {profile}")
        original_phone = profile.get("phone")
        profile_etag = api.etag(profile, headers)
        status, saved, _ = api.call("PATCH", "/api/v1/me/profile", api.tokens["employee"],
                                    {"phone": phone}, api.key("profile"), profile_etag)
        check("3.5 the owner can save their own phone", status == 200, saved)
        if status == 200:
            api.identifiers["employee"] = phone
        status, own, _ = api.call("GET", "/api/v1/users/" + employee, api.tokens["employee"])
        check("3.5 the owner reads their own phone from person details", status == 200 and own.get("phone") == phone,
              own.get("phone"))
        status, direct, _ = api.call("GET", "/api/v1/users/" + employee, api.tokens["middle"])
        check("3.5 the direct superior with current profile access reads the phone",
              status == 200 and direct.get("phone") == phone, status)
        status, indirect, _ = api.call("GET", "/api/v1/users/" + employee, api.tokens["upper"])
        check("3.5 the indirect actual superior reads the phone", status == 200 and indirect.get("phone") == phone,
              status)
        check("3.5 another person's detail never returns email", "email" not in direct and "email" not in indirect)
        for who, username in (("same-level colleague", "colleague"), ("other chain manager", "market")):
            status, body, _ = api.call("GET", "/api/v1/users/" + employee, api.tokens[username])
            check("3.5 " + who + " gets no person detail or phone", status == 404, status)
        status, superior, _ = api.call("GET", "/api/v1/users/" + ids["middle"], api.tokens["employee"])
        check("3.5 a subordinate cannot read a superior's phone", status == 404, status)
        status, admin, _ = api.call("GET", "/api/v1/users/" + employee, api.tokens["admin"])
        check("3.5 an administrator does not get employee person details", status in (403, 404), status)

        status, directory, _ = api.call("GET", "/api/v1/users?limit=100", api.tokens["upper"])
        check("3.5 the people directory contains no phone or email",
              status == 200 and all("phone" not in row and "email" not in row for row in directory.get("items", [])))
        status, tasks, _ = api.call("GET", "/api/v1/tasks?limit=100", api.tokens["upper"])
        serialized = json.dumps(tasks.get("items", []), ensure_ascii=False)
        check("3.5 task summaries contain no phone", phone not in serialized)
        status, notices, _ = api.call("GET", "/api/v1/notifications?limit=100", api.tokens["upper"])
        check("3.5 notification summaries contain no phone", phone not in json.dumps(notices, ensure_ascii=False))
        status, home, _ = api.call("GET", "/api/v1/home", api.tokens["upper"])
        check("3.5 home data contains no phone", phone not in json.dumps(home, ensure_ascii=False))
        status, admin_users, _ = api.call("GET", "/api/v1/admin/employees?limit=100", api.tokens["admin"])
        check("3.5 the administration roster returns no phone value",
              status == 200 and all("phone" not in row for row in admin_users.get("items", [])))
        status, audit, _ = api.call("GET", "/api/v1/admin/audit-logs?limit=100", api.tokens["admin"])
        check("3.5 audit output contains no phone", phone not in json.dumps(audit, ensure_ascii=False))
        status, logs, _ = api.call("GET", "/api/v1/work-logs?scope=visible&limit=100", api.tokens["upper"])
        check("3.5 log filtering contains no phone", status == 200 and phone not in json.dumps(logs, ensure_ascii=False))
        status, analytics, _ = api.call("GET", "/api/v1/analytics/task-summary?scope=visible", api.tokens["upper"])
        check("3.5 analytics output contains no phone", status == 200 and phone not in json.dumps(analytics, ensure_ascii=False))
        status, job, _ = api.call("POST", "/api/v1/ai-jobs", api.tokens["upper"], {"scopeType": "visible"}, api.key("ai"))
        if status == 200:
            status, analysis, _ = api.call("GET", "/api/v1/ai-jobs/" + job["jobId"], api.tokens["upper"])
            check("3.5 stored analysis detail contains no phone", status == 200 and phone not in json.dumps(analysis, ensure_ascii=False))
        else:
            check("3.5 stored analysis detail contains no phone", False, job)
        status, bad_org, _ = api.call("PATCH", "/api/v1/me/profile", api.tokens["employee"],
                                      {"departmentId": "10000000-0000-0000-0000-000000000099"},
                                      api.key("org"), profile_etag)
        check("3.5 the owner cannot edit organization fields", status == 400, bad_org)

        # Move the employee to the marketing chain and prove the old superior loses access.
        status, employee_admin, headers = api.call("GET", "/api/v1/admin/employees/" + employee, api.tokens["admin"])
        if status != 200:
            raise SystemExit(f"admin employee read failed: {status} {employee_admin}")
        original_employee = {
            "departmentId": employee_admin["departmentId"], "positionId": employee_admin["positionId"],
            "teamId": employee_admin.get("teamId"), "managerId": employee_admin.get("managerId"),
            "level": employee_admin["rankLevel"], "roleCodes": employee_admin.get("roles") or ["employee"],
            "rowVersion": api.etag(employee_admin, headers)}
        status, market_admin, _ = api.call("GET", "/api/v1/admin/employees?q=market", api.tokens["admin"])
        market_row = next((row for row in market_admin.get("items", []) if row["username"] == "market"), None)
        if market_row is None:
            raise SystemExit("marketing manager fixture missing")
        transfer = {"departmentId": market_row["departmentId"], "positionId": original_employee["positionId"],
                    "teamId": market_row.get("teamId"), "managerId": market_row["id"],
                    "level": original_employee["level"], "roleCodes": original_employee["roleCodes"],
                    "reason": "3.5 手机号管理链复验"}
        status, changed, _ = api.call("POST", "/api/v1/admin/employees/" + employee + "/transfer",
                                      api.tokens["admin"], transfer, api.key("transfer"),
                                      original_employee["rowVersion"])
        check("3.5 the organization change is accepted", status == 200, changed)
        for username in ("admin", "upper", "middle", "employee", "colleague", "market"):
            api.login(username)
        status, old_superior, _ = api.call("GET", "/api/v1/users/" + employee, api.tokens["middle"])
        check("3.5 the old superior loses the phone and person detail after transfer", status == 404, status)
        status, new_superior, _ = api.call("GET", "/api/v1/users/" + employee, api.tokens["market"])
        check("3.5 the new actual superior gains the phone after transfer",
              status == 200 and new_superior.get("phone") == phone, status)
        status, top, _ = api.call("GET", "/api/v1/users/" + employee, api.tokens["upper"])
        check("3.5 the higher actual superior still reads the phone through the new chain",
              status == 200 and top.get("phone") == phone, status)
        status, current, headers = api.call("GET", "/api/v1/admin/employees/" + employee, api.tokens["admin"])
        if status != 200:
            raise SystemExit(f"restore read failed: {status} {current}")
        status, restored, _ = api.call("POST", "/api/v1/admin/employees/" + employee + "/transfer",
                                       api.tokens["admin"],
                                       {"departmentId": original_employee["departmentId"],
                                        "positionId": original_employee["positionId"],
                                        "teamId": original_employee["teamId"],
                                        "managerId": original_employee["managerId"],
                                        "level": original_employee["level"],
                                        "roleCodes": original_employee["roleCodes"],
                                        "reason": "3.5 复验后恢复原组织"},
                                       api.key("restore"), api.etag(current, headers))
        check("3.5 the original organization is restored", status == 200, status)
        for username in ("admin", "upper", "middle", "employee", "market"):
            api.login(username)
        status, again, _ = api.call("GET", "/api/v1/users/" + employee, api.tokens["middle"])
        check("3.5 the restored superior reads the phone again", status == 200 and again.get("phone") == phone, status)
    finally:
        try:
            status, current, headers = api.call("GET", "/api/v1/me/profile", api.tokens.get("employee", ""))
            if status == 200:
                api.call("PATCH", "/api/v1/me/profile", api.tokens["employee"],
                         {"phone": original_phone}, api.key("restore-phone"), api.etag(current, headers))
                status, final, _ = api.call("GET", "/api/v1/me/profile", api.tokens["employee"])
                check("3.5 the original phone is restored", status == 200 and final.get("phone") == original_phone)
        except Exception as error:
            check("3.5 cleanup", False, str(error))

    report = {"success": all(row["pass"] for row in RESULTS), "checksPassed": sum(1 for row in RESULTS if row["pass"]),
              "checksFailed": sum(1 for row in RESULTS if not row["pass"]), "checks": RESULTS}
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(("PASS" if report["success"] else "FAIL") + f": {report['checksPassed']} passed, {report['checksFailed']} failed")
    return 0 if report["success"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
