#!/usr/bin/env python3
"""Profile persistence/privacy and company read-only checks against the real API.

Temporarily edits only the selected account's displayName/phone/email and restores
its original values in finally. It never changes another user's profile, roles,
departments, passwords, or company content. Credentials and contact values are
not written to the report. Run after the V4 migration/server restart.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
import uuid

from smoke_test import Client, Failure


FIELDS = ("displayName", "phone", "email")


def tag(body, headers):
    return next((value for key, value in headers.items() if key.lower() == "etag"), '"' + str(body["rowVersion"]) + '"')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=os.environ.get("PANDORA_BASE_URL", "http://localhost:8080"))
    parser.add_argument("--username", default="employee")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    password = os.environ.get("PANDORA_DEMO_PASSWORD", "Demo@123456")
    public = Client(args.base_url)
    clients = {}
    checks = []
    original = None
    last_written = None
    restored = False
    error = None

    def check(name, condition=True):
        if not condition:
            raise Failure(name)
        checks.append(name)
        print("PASS", name, flush=True)

    def login(username):
        _, result, _ = public.call("POST", "/api/v1/auth/sessions", {"username": username, "password": password})
        client = Client(args.base_url, result["token"])
        clients[username + ":" + str(len(clients))] = client
        return client

    try:
        public.call("GET", "/api/v1/me/profile", expected=(401,))
        check("profile requires authentication")
        client = login(args.username)
        _, original, original_headers = client.call("GET", "/api/v1/me/profile")
        original_tag = tag(original, original_headers)
        check("profile response includes a version ETag", bool(original_tag) and original["rowVersion"] == original["profileVersion"])
        check("profile contains no credential fields", not {"password", "passwordHash", "token", "tokenHash"}.intersection(original))
        _, same_user, _ = client.call("GET", "/api/v1/me/profile?userId=not-the-current-user")
        check("query parameters cannot select another profile", same_user["id"] == original["id"])

        for field in ("userId", "role", "teamId", "managerId", "username", "organizationId"):
            value = original.get(field, original["id"])
            client.call("PATCH", "/api/v1/me/profile", {field: value, "displayName": original["displayName"]}, etag=original_tag, expected=(400,))
        check("identity organization and authority fields rejected")
        for bad in ({"displayName": " "}, {"displayName": "a" * 101}, {"phone": 123456}, {"phone": "letters"}, {"email": "invalid-address"}, {}):
            client.call("PATCH", "/api/v1/me/profile", bad, etag=original_tag, expected=(400,))
        check("malformed profile data yields validation errors without writes")
        client.call("PATCH", "/api/v1/me/profile", {"displayName": original["displayName"]}, expected=(428,))
        check("missing If-Match is rejected")

        marker = uuid.uuid4().hex[:10]
        last_written = {"displayName": original["displayName"][:70] + " · Profile " + marker,
                        "phone": "13000000000", "email": "profile-" + marker + "@example.test"}
        key = str(uuid.uuid4())
        _, saved, _ = client.call("PATCH", "/api/v1/me/profile", last_written, key=key, etag=original_tag)
        _, replay, _ = client.call("PATCH", "/api/v1/me/profile", last_written, key=key, etag=original_tag)
        check("idempotent profile retry returns the original result", replay == saved)
        check("profile mutation response contains only safe identity/version fields", set(saved) == {"id", "rowVersion", "profileVersion"})
        client.call("PATCH", "/api/v1/me/profile", {"displayName": original["displayName"]}, key=key, etag=original_tag, expected=(409,))
        check("same key with a changed profile payload rejected")
        client.call("PATCH", "/api/v1/me/profile", {"displayName": original["displayName"]}, etag=original_tag, expected=(412,))
        check("stale profile version rejected")

        fresh = login(args.username)
        _, persisted, fresh_headers = fresh.call("GET", "/api/v1/me/profile")
        check("new login reads the persisted profile", all(persisted.get(field) == last_written[field] for field in FIELDS))
        check("idempotency does not increment profile version twice", persisted["rowVersion"] == original["rowVersion"] + 1)
        check("account and organization identity remain unchanged", all(persisted.get(field) == original.get(field) for field in ("id", "username", "role", "teamId", "managerId")))
        _, my_info, _ = fresh.call("GET", "/api/v1/me")
        check("my page receives private contacts", all(my_info.get(field) == last_written[field] for field in FIELDS))

        upper = login("upper")
        _, directory, _ = upper.call("GET", "/api/v1/users?limit=100")
        check("people directory omits all contact fields", all("phone" not in person and "email" not in person for person in directory["items"]))
        _, upper_profile, _ = upper.call("GET", "/api/v1/me/profile")
        check("other account profile endpoint still returns only itself", upper_profile["id"] != original["id"] or args.username == "upper")

        for role in ("upper", "middle", "employee"):
            business = upper if role == "upper" else client if role == args.username else login(role)
            _, home, _ = business.call("GET", "/api/v1/home")
            business.call("POST", "/api/v1/home/items", {"kind": "company", "body": "Read-only policy test"}, expected=(403,))
            if not home["companyItems"]:
                raise Failure("Company seed item required to verify PATCH/DELETE denial")
            item_id = home["companyItems"][0]["id"]
            _, item, headers = business.call("GET", "/api/v1/home/items/" + item_id)
            check(role + " reads company items as non-editable", item.get("editable") is False)
            business.call("PATCH", "/api/v1/home/items/" + item_id, {"body": item["body"]}, etag=tag(item, headers), expected=(403,))
            business.call("DELETE", "/api/v1/home/items/" + item_id, etag=tag(item, headers), expected=(403,))
            check(role + " cannot create modify or delete company items")

        fresh.call("PATCH", "/api/v1/me/profile", {"phone": "", "email": None}, etag=tag(persisted, fresh_headers))
        last_written = dict(last_written, phone=None, email=None)
        _, cleared, _ = fresh.call("GET", "/api/v1/me/profile")
        check("blank and null clear optional contacts", cleared["phone"] is None and cleared["email"] is None)
    except (Failure, KeyError, TypeError, ValueError) as exc:
        error = str(exc)
        print("FAIL", error, file=sys.stderr)
    finally:
        if original is not None:
            try:
                cleanup = next(value for key, value in clients.items() if key.startswith(args.username + ":"))
                _, current, headers = cleanup.call("GET", "/api/v1/me/profile")
                restore = {field: original.get(field) for field in FIELDS if current.get(field) != original.get(field)}
                if restore:
                    if last_written is None or any(current.get(field) != last_written.get(field) for field in restore):
                        raise Failure("Profile changed outside this test; restoration refused to avoid overwriting another edit")
                    cleanup.call("PATCH", "/api/v1/me/profile", restore, etag=tag(current, headers))
                _, final, _ = cleanup.call("GET", "/api/v1/me/profile")
                restored = all(final.get(field) == original.get(field) for field in FIELDS)
                if not restored:
                    raise Failure("Original profile values were not restored")
                check("original profile values restored")
            except Exception as cleanup_error:
                error = (error + "; " if error else "") + "Restoration: " + str(cleanup_error)
                print("FAIL", "Restoration could not be confirmed", file=sys.stderr)
        for client in clients.values():
            try:
                client.call("DELETE", "/api/v1/auth/sessions/current", expected=(200, 401))
            except Exception:
                pass
    report = {"success": error is None and restored, "username": args.username, "checksPassed": len(checks),
              "checks": checks, "profileRestored": restored, "error": error}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(("PASS" if report["success"] else "FAIL") + ": " + str(len(checks)) + " checks; profileRestored=" + str(restored))
    return 0 if report["success"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
