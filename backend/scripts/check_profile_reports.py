#!/usr/bin/env python3
"""HTTP verification for task 8.4: profile fields, subordinate intersection and independent log scope.

Uses a freshly seeded database. The employee phone is set through the real self-service endpoint and
restored in finally. One direct report is temporarily moved under another employee to prove that the
subordinate list and the log scope do not expand together; the original review chain is restored.

    python3 scripts/check_profile_reports.py --base-url http://127.0.0.1:18121
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

    def re_login(self):
        for username in list(self.tokens):
            self.login(username)

    @staticmethod
    def key(prefix="profile"):
        return prefix + "-" + uuid.uuid4().hex

    @staticmethod
    def etag(body, headers):
        return headers.get("ETag") or '"' + str(body.get("rowVersion")) + '"'


def check(name: str, condition: bool, evidence=None) -> None:
    RESULTS.append({"check": name, "pass": bool(condition), "evidence": evidence})
    print(("PASS  " if condition else "FAIL  ") + name + ("" if condition else f"  -> {evidence}"))


def items(body):
    return body.get("items", []) if isinstance(body, dict) else []


def ids_of(body):
    return {row.get("id") for row in items(body)}


def run(base: str) -> int:
    api = Api(base)
    for username in ("admin", "upper", "middle", "employee", "colleague", "market", "marketing"):
        api.login(username)
    ids = {}
    for username in api.tokens:
        status, me, _ = api.call("GET", "/api/v1/me", api.tokens[username])
        if status == 200:
            ids[username] = me["id"]
    employee = ids["employee"]
    colleague = ids["colleague"]
    original_phone = None
    original_colleague = None
    moved = False
    try:
        status, profile, headers = api.call("GET", "/api/v1/me/profile", api.tokens["employee"])
        if status != 200:
            raise SystemExit(f"profile unavailable: {status} {profile}")
        original_phone = profile.get("phone")
        for key in ("organizationName", "departmentName", "positionName", "teamName", "managerName"):
            check("8.4 the self profile contains " + key, bool(profile.get(key)), profile)
        phone = "139" + str(uuid.uuid4().int)[:8]
        status, saved, _ = api.call("PATCH", "/api/v1/me/profile", api.tokens["employee"],
                                    {"phone": phone}, api.key(), Api.etag(profile, headers))
        check("8.4 the employee saves a phone for the detail boundary", status == 200, saved)

        status, upper, _ = api.call("GET", "/api/v1/me/reports", api.tokens["upper"])
        upper_ids = ids_of(upper)
        check("8.4 the executive subordinate list includes direct and indirect chains",
              status == 200 and {ids["middle"], ids["employee"], ids["colleague"], ids["market"], ids["marketing"]} <= upper_ids,
              sorted(upper_ids))
        check("8.4 the executive list excludes the administrator and unrelated self",
              ids["admin"] not in upper_ids and ids["upper"] not in upper_ids, sorted(upper_ids))

        status, middle, _ = api.call("GET", "/api/v1/me/reports", api.tokens["middle"])
        middle_ids = ids_of(middle)
        check("8.4 the manager list contains direct reports only",
              status == 200 and middle_ids == {ids["employee"], ids["colleague"]}, sorted(middle_ids))
        check("8.4 non-chain people never enter the manager list",
              not ({ids["marketing"], ids["market"], ids["upper"]} & middle_ids), sorted(middle_ids))

        status, lower, _ = api.call("GET", "/api/v1/me/reports", api.tokens["employee"])
        check("8.4 an employee has no subordinate entry", status == 200 and not items(lower), lower)

        status, admin_reports, _ = api.call("GET", "/api/v1/me/reports", api.tokens["admin"])
        check("8.4 the administrator has no business subordinate list", status in (403, 404), admin_reports)

        for username in ("upper", "middle"):
            status, body, _ = api.call("GET", "/api/v1/me/reports", api.tokens[username])
            check("8.4 " + username + " subordinate rows carry no phone or email",
                  status == 200 and all("phone" not in row and "email" not in row for row in items(body)), body)

        status, direct, _ = api.call("GET", "/api/v1/users/" + employee, api.tokens["middle"])
        check("8.4 the direct manager reads the employee phone through person details",
              status == 200 and direct.get("phone") == phone, direct)
        check("8.4 person details expose the separate log authority",
              status == 200 and direct.get("canReadLogs") is True, direct)
        check("8.4 another person's detail never returns email", "email" not in direct, direct)

        status, indirect, _ = api.call("GET", "/api/v1/users/" + employee, api.tokens["upper"])
        check("8.4 the indirect executive reads the employee phone",
              status == 200 and indirect.get("phone") == phone, indirect)

        status, outside, _ = api.call("GET", "/api/v1/users/" + ids["marketing"], api.tokens["middle"])
        check("8.4 a non-chain person is refused even when the id is known", status == 404, outside)
        status, admin_person, _ = api.call("GET", "/api/v1/users/" + employee, api.tokens["admin"])
        check("8.4 the administrator gets no employee person detail", status in (403, 404), admin_person)

        # Move colleague under employee: middle now has an indirect report, but profile/log scopes
        # remain reports-only. The list and the log entry must not expand together.
        status, colleague_admin, headers = api.call("GET", "/api/v1/admin/employees/" + colleague, api.tokens["admin"])
        if status != 200:
            raise SystemExit(f"colleague admin detail failed: {status} {colleague_admin}")
        original_colleague = {
            "departmentId": colleague_admin["departmentId"], "positionId": colleague_admin["positionId"],
            "teamId": colleague_admin.get("teamId"), "managerId": colleague_admin.get("managerId"),
            "level": colleague_admin["rankLevel"], "roleCodes": colleague_admin.get("roles") or ["employee"],
        }
        transfer = dict(original_colleague, managerId=employee, reason="8.4 下属与日志权限矩阵")
        status, changed, _ = api.call("POST", "/api/v1/admin/employees/" + colleague + "/transfer",
                                      api.tokens["admin"], transfer, api.key("transfer"),
                                      Api.etag(colleague_admin, headers))
        check("8.4 the temporary organization change is accepted", status == 200, changed)
        moved = status == 200
        api.re_login()

        status, middle, _ = api.call("GET", "/api/v1/me/reports", api.tokens["middle"])
        check("8.4 the manager list does not gain the new indirect report",
              status == 200 and colleague not in ids_of(middle), sorted(ids_of(middle)))
        status, upper, _ = api.call("GET", "/api/v1/me/reports", api.tokens["upper"])
        check("8.4 the executive list still contains the new indirect report",
              status == 200 and colleague in ids_of(upper), sorted(ids_of(upper)))
        status, denied, _ = api.call("GET", "/api/v1/users/" + colleague, api.tokens["middle"])
        check("8.4 the manager cannot read the indirect person detail", status == 404, denied)
        status, denied_log, _ = api.call("GET", "/api/v1/work-logs?scope=visible&authorId=" + colleague,
                                         api.tokens["middle"])
        check("8.4 the manager cannot read the indirect report's logs", status == 404, denied_log)
        status, company_log, _ = api.call("GET", "/api/v1/work-logs?scope=visible&authorId=" + colleague,
                                          api.tokens["upper"])
        check("8.4 the executive still reads company logs from the log page", status == 200, company_log)
    finally:
        try:
            if moved:
                status, current, headers = api.call("GET", "/api/v1/admin/employees/" + colleague, api.tokens["admin"])
                if status == 200:
                    restore = dict(original_colleague, reason="8.4 恢复原组织关系")
                    api.call("POST", "/api/v1/admin/employees/" + colleague + "/transfer", api.tokens["admin"],
                             restore, api.key("restore"), Api.etag(current, headers))
                    api.re_login()
        except Exception as error:  # noqa: BLE001 - cleanup failures are reported below
            RESULTS.append({"check": "cleanup organization restore", "pass": False, "evidence": str(error)})
        try:
            status, current, headers = api.call("GET", "/api/v1/me/profile", api.tokens["employee"])
            if status == 200:
                api.call("PATCH", "/api/v1/me/profile", api.tokens["employee"],
                         {"phone": original_phone}, api.key("restore-phone"), Api.etag(current, headers))
        except Exception as error:  # noqa: BLE001
            RESULTS.append({"check": "cleanup phone restore", "pass": False, "evidence": str(error)})
    return 0 if all(item["pass"] for item in RESULTS) else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:18121")
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
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
