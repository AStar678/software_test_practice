#!/usr/bin/env python3
"""Verify the employee/admin web resource graph and, optionally, the packaged Spring Boot jar.

Chapter 10.1 requires that the HTML actually loads every module in the intended order, that the
cache-busting version of each referenced file matches its content, that the Maven resource list ships
every referenced file, and that the packaged artifact really contains those bytes.

    python3 scripts/check_web_resources.py --repo .. \
        --jar target/pandora-backend-0.1.0.jar --output ../audit/2026-10-25/chapter10-web-resources.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

RESULTS: list[dict] = []
SCRIPT_ORDER = [
    "潘多拉-交互原型.js", "潘多拉-api.js", "潘多拉-任务接入.js", "潘多拉-工作区接入.js",
    "潘多拉-日程视图.js", "潘多拉-任务表单.js", "潘多拉-个人资料.js", "潘多拉-标签评论.js",
]


def check(name: str, condition: bool, evidence=None) -> None:
    RESULTS.append({"check": name, "pass": bool(condition), "evidence": evidence})
    print(("PASS  " if condition else "FAIL  ") + name + ("" if condition else f"  -> {evidence}"))


def references(html: str) -> list[tuple[str, str]]:
    """Return (kind, path) for local stylesheets, scripts and images, in document order."""
    found: list[tuple[str, str]] = []
    for match in re.finditer(r'<(link|script|img)\b[^>]*?(?:href|src)="([^"]+)"', html):
        kind, path = match.group(1), match.group(2)
        if re.match(r"^(https?:|data:|//)", path):
            continue
        found.append((kind, path))
    return found


def without_query(path: str) -> tuple[str, str | None]:
    if "?" not in path:
        return path, None
    name, query = path.split("?", 1)
    version = None
    for part in query.split("&"):
        if part.startswith("v="):
            version = part[2:]
    return name, version


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path(".."))
    parser.add_argument("--jar", type=Path, default=None)
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    repo = args.repo.resolve()
    employee = repo / "潘多拉-交互原型.html"
    admin = repo / "admin.html"
    pom = repo / "backend" / "pom.xml"
    html = employee.read_text()
    admin_html = admin.read_text()
    pom_text = pom.read_text()

    refs = references(html)
    names = [without_query(path)[0] for _, path in refs]
    check("10.1 the employee page references real local resources only",
          all((repo / name).is_file() for name in names), {"missing": [name for name in names if not (repo / name).is_file()]})
    matches = []
    for _, path in refs:
        name, version = without_query(path)
        if not name.endswith((".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".webp")):
            continue
        actual = hashlib.sha256((repo / name).read_bytes()).hexdigest()[:12]
        matches.append({"file": name, "query": version, "sha256Prefix": actual,
                        "matches": version is None or version == actual})
    check("10.1 every cache-busting version equals the current file hash",
          all(row["matches"] for row in matches), {"mismatched": [row for row in matches if not row["matches"]]})
    scripts = [without_query(path)[0] for kind, path in refs if kind == "script"]
    positions = [scripts.index(name) for name in SCRIPT_ORDER if name in scripts]
    check("10.1 the later modules load in dependency order so their overrides win",
          len(positions) == len(SCRIPT_ORDER) and positions == sorted(positions),
          {"scripts": scripts, "expected": SCRIPT_ORDER})
    check("10.1 the employee page loads the shared tag/comment and profile modules",
          "潘多拉-标签评论.js" in scripts and "潘多拉-个人资料.js" in scripts, {"scripts": scripts})
    check("10.1 the employee page no longer references an Android-only theme override",
          "android-material.css" not in html, {"found": "android-material.css" in html})
    check("10.1 the administrator page is standalone and loads no employee module",
          "潘多拉-交互原型.js" not in admin_html and "潘多拉-api.js" not in admin_html,
          {"employeeScripts": [name for name in ("潘多拉-交互原型.js", "潘多拉-api.js") if name in admin_html]})
    check("10.1 the administrator page starts with its own login and management tabs",
          all(label in admin_html for label in ("任务历史", "通知管理", "员工", "组织", "管理员账号"))
          and 'id="tab-roles"' not in admin_html,
          {"tabs": [label for label in ("员工", "任务历史", "通知管理") if label in admin_html]})
    missing_from_pom = [name for name in set(names) if name not in pom_text]
    check("10.1 every referenced web file is in the explicit Maven resource list",
          not missing_from_pom, {"missing": missing_from_pom})
    check("10.1 the packaged resource list includes the administrator page",
          "<include>admin.html</include>" in pom_text, {"pom": str(pom)})

    if args.jar:
        jar = args.jar.resolve()
        check("10.1 the built backend jar exists", jar.is_file(), {"jar": str(jar)})
        if jar.is_file():
            with zipfile.ZipFile(jar) as archive:
                packed = set(archive.namelist())
                missing = [name for name in set(names) if "BOOT-INF/classes/static/" + name not in packed]
                differing = []
                for name in set(names):
                    entry = "BOOT-INF/classes/static/" + name
                    if entry in packed and archive.read(entry) != (repo / name).read_bytes():
                        differing.append(name)
                check("10.1 the built jar contains every referenced web resource",
                      not missing, {"missing": sorted(missing)})
                check("10.1 packaged resources are byte-identical to the sources", not differing,
                      {"differing": sorted(differing)})
                check("10.1 the built jar serves the administrator page",
                      "BOOT-INF/classes/static/admin.html" in packed
                      and "任务历史".encode() in archive.read("BOOT-INF/classes/static/admin.html"))
                check("10.1 the built jar serves the updated employee profile module",
                      "BOOT-INF/classes/static/潘多拉-个人资料.js" in packed
                      and "p-edit-profile".encode() in archive.read("BOOT-INF/classes/static/潘多拉-个人资料.js")
                      and "p-open-teams".encode() not in archive.read("BOOT-INF/classes/static/潘多拉-个人资料.js"))

    passed = sum(1 for row in RESULTS if row["pass"])
    print(f"\n{passed}/{len(RESULTS)} checks passed")
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps({
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "passed": passed, "total": len(RESULTS), "checks": RESULTS,
        }, ensure_ascii=False, indent=2) + "\n")
        print(f"wrote {args.output}")
    return 0 if passed == len(RESULTS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
