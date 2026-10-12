#!/usr/bin/env python3
"""Verify company read-only access and personal ownership, replay and limits.

Only creates uniquely named personal items; removes those items in finally. Seed
and user-owned items are never edited or deleted. Requires the V4 local backend.
Company permission probes run only after confirming the read-only capability.
"""
import argparse
import json
import uuid
from pathlib import Path
from smoke_test import Client


def run(base, password, report):
    checks, created, clients = [], [], {}
    prefix = "首页接口检查 " + str(uuid.uuid4())[:8]

    def call(client, label, method, path, body=None, **kwargs):
        result = client.call(method, path, body, **kwargs)
        checks.append({"check": label, "status": result[0], "passed": True})
        return result

    def create(client, kind, suffix):
        body = {"kind": kind, "body": prefix + " " + suffix}
        key = str(uuid.uuid4())
        _, item, _ = call(client, kind + " create", "POST", "/home/items", body, key=key)
        created.append((client, item["id"]))
        return item, body, key

    try:
        for username in ("upper", "middle", "employee", "colleague"):
            client = Client(base)
            _, session, _ = client.call("POST", "/auth/sessions", {"username": username, "password": password})
            client.token = session["token"]
            clients[username] = client
        upper, owner, other = clients["upper"], clients["employee"], clients["colleague"]
        _, initial, _ = call(owner, "initial own home", "GET", "/home")
        _, initial_company, _ = call(upper, "initial company home", "GET", "/home")
        # Refuse to probe an old server that still allows company writes.
        _, profile, _ = call(owner, "V4 profile capability", "GET", "/me/profile")
        assert "profileVersion" in profile, "The V4 backend is required"
        assert initial_company["companyItems"], "A company seed item is required for read-only checks"
        company_path = "/home/items/" + initial_company["companyItems"][0]["id"]
        for username in ("upper", "middle", "employee"):
            client = clients[username]
            _, detail, _ = call(client, username + " can read company", "GET", company_path)
            assert detail.get("editable") is False, "Company write probes refused: backend is not read-only"
            company_etag = '"' + str(detail["rowVersion"]) + '"'
            call(client, username + " cannot publish company", "POST", "/home/items", {"kind": "company", "body": prefix}, expected=(403,))
            call(client, username + " cannot edit company", "PATCH", company_path, {"body": detail["body"]}, etag=company_etag, expected=(403,))
            call(client, username + " cannot delete company", "DELETE", company_path, etag=company_etag, expected=(403,))
        _, unchanged_company, _ = call(upper, "company items unchanged after denied writes", "GET", "/home")
        assert unchanged_company["companyItems"] == initial_company["companyItems"]
        call(owner, "blank text rejected", "POST", "/home/items", {"kind": "personal", "body": " "}, expected=(400,))
        call(owner, "unknown kind rejected", "POST", "/home/items", {"kind": "other", "body": prefix}, expected=(400,))
        call(owner, "owner cannot be supplied", "POST", "/home/items", {"kind": "personal", "body": prefix, "ownerId": "other"}, expected=(400,))
        for kind, client, baseline in (("personal", owner, initial["personalItems"]),):
            if len(baseline) >= 10:
                call(client, kind + " preexisting limit enforced", "POST", "/home/items", {"kind": kind, "body": prefix}, expected=(409,))
                continue
            item, body, key = create(client, kind, "版本与重放")
            path = "/home/items/" + item["id"]
            _, replay, _ = call(client, kind + " same-key replay", "POST", "/home/items", body, key=key)
            assert replay == item
            call(client, kind + " reused-key conflict", "POST", "/home/items", {**body, "body": prefix + " different"}, key=key, expected=(409,))
            _, detail, headers = call(client, kind + " detail and etag", "GET", path)
            etag = headers.get("ETag") or headers.get("Etag") or headers.get("etag")
            assert etag == '"1"' and detail["rowVersion"] == 1
            call(client, kind + " missing etag", "PATCH", path, {"body": prefix + " update"}, expected=(428,))
            call(client, kind + " edit", "PATCH", path, {"body": prefix + " update"}, etag=etag)
            call(client, kind + " stale edit rejected", "PATCH", path, {"body": prefix + " stale"}, etag=etag, expected=(412,))
            call(client, kind + " stale delete rejected", "DELETE", path, etag=etag, expected=(412,))
            call(other, "another user cannot read personal", "GET", path, expected=(404,))
            call(other, "another user cannot edit personal", "PATCH", path, {"body": prefix}, etag='"2"', expected=(404,))
            call(other, "another user cannot delete personal", "DELETE", path, etag='"2"', expected=(404,))
            _, home, _ = call(other, "another user home is isolated", "GET", "/home")
            assert item["id"] not in {row["id"] for row in home["personalItems"]}
            for number in range(9 - len(baseline)):
                create(client, kind, "上限 " + str(number))
            _, home, _ = call(client, kind + " all ten are visible", "GET", "/home")
            assert len(home[kind + "Items"]) == 10
            call(client, kind + " eleventh rejected", "POST", "/home/items", {"kind": kind, "body": prefix + " overflow"}, expected=(409,))
            delete_key = str(uuid.uuid4())
            _, deleted, _ = call(client, kind + " current delete", "DELETE", path, etag='"2"', key=delete_key)
            _, replay, _ = call(client, kind + " delete replay", "DELETE", path, etag='"2"', key=delete_key)
            assert replay == deleted
            call(client, kind + " deleted item absent", "GET", path, expected=(404,))
            created.remove((client, item["id"]))
    finally:
        cleanup_errors = []
        for client, item_id in reversed(created):
            try:
                _, row, _ = client.call("GET", "/home/items/" + item_id)
                client.call("DELETE", "/home/items/" + item_id, etag='"' + str(row["rowVersion"]) + '"')
            except Exception as exc:
                cleanup_errors.append({"id": item_id, "error": str(exc)})
        for client in clients.values():
            client.call("DELETE", "/auth/sessions/current")
        result = {"checks": checks, "passed": len(checks), "cleanupErrors": cleanup_errors}
        Path(report).parent.mkdir(parents=True, exist_ok=True)
        Path(report).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        if cleanup_errors:
            raise AssertionError("Test-created item cleanup failed; see report")
    print(json.dumps({"passed": len(checks), "cleanupErrors": 0, "report": str(Path(report).resolve())}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8080/api/v1")
    parser.add_argument("--password", default="Demo@123456")
    parser.add_argument("--report", default="output/verification/home-integration.json")
    args = parser.parse_args()
    run(args.base_url, args.password, args.report)
