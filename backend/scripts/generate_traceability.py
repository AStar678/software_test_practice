#!/usr/bin/env python3
"""Generate the chapter 11 implementation traceability handoff.

This intentionally records apply-stage implementation evidence only.  It does
not turn historical audit conclusions into a new verification verdict.
"""

from __future__ import annotations

import re
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHANGE = ROOT / "openspec/changes/archive/2026-10-21-fix-pandora-formal-requirement-deviations"
AUDIT = ROOT / "audit/2026-10-20/chapter11"


def read(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def clean_cell(value: str) -> str:
    return value.strip().replace("\n", " ").replace("|", "\\|")


def parse_rows(text: str, id_pattern: str) -> dict[str, list[str]]:
    rows: dict[str, list[str]] = {}
    for line in text.splitlines():
        if not re.match(rf"^\|\s*{id_pattern}\s*\|", line):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        rows.setdefault(cells[0], cells)
    return rows


checklist = read("docs/reviews/潘多拉-正式需求审计清单.md")
deviations = read("docs/reviews/潘多拉-正式需求偏差报告.md")
prd = read("docs/requirements/潘多拉-产品需求文档-V2正式版.md")
tasks_text = (CHANGE / "tasks.md").read_text(encoding="utf-8")

dev_matches = list(
    re.finditer(r"^###\s+(DEV-\d{3})\s+·\s+([^\r\n]+)", deviations, re.MULTILINE)
)
devs = {match.group(1): match.group(2).strip() for match in dev_matches}
aud_requirements = parse_rows(checklist, r"AUD-[A-Z]+-\d{3}")
aud_results = parse_rows(deviations, r"AUD-[A-Z]+-\d{3}")
a_requirements = parse_rows(prd, r"A-\d{2}")
a_coverage = parse_rows(checklist, r"A-\d{2}")

assert len(devs) == 35, f"expected 35 DEV rows, got {len(devs)}"
assert len(aud_requirements) == 150, f"expected 150 AUD rows, got {len(aud_requirements)}"
assert len(a_requirements) == 25, f"expected 25 A rows, got {len(a_requirements)}"
assert set(aud_requirements) <= set(aud_results), "deviation report lacks AUD result rows"
assert set(a_requirements) <= set(a_coverage), "audit checklist lacks A coverage rows"

task_refs: dict[str, list[str]] = defaultdict(list)
for line in tasks_text.splitlines():
    match = re.match(r"^- \[[ x]\] (\d+\.\d+)\s+(.+)$", line)
    if not match:
        continue
    task_id, body = match.groups()
    for start, end in re.findall(r"DEV-(\d{3})(?:[—-](\d{3}))?", body):
        for number in range(int(start), int(end or start) + 1):
            task_refs[f"DEV-{number:03d}"].append(task_id)


EVIDENCE_BY_DEV: list[tuple[range, str]] = [
    (range(1, 6), "organization-admin.json；account-lifecycle.json；profile-phone.json"),
    (range(6, 12), "review-routing.json；smoke.json；chapter11-browser.json"),
    (range(12, 17), "deadline-reminder-notification.json；review-routing.json；database-event.json"),
    (range(17, 25), "home-calendar.json；home-calendar-three-viewports.json；chapter11-browser.json"),
    (range(25, 29), "work-logs.json；logs-profile-*.json；chapter11-browser.json"),
    (range(30, 34), "deadline-reminder-notification.json；notification-*.json；chapter11-browser.json"),
    (range(34, 35), "ai-analysis.json；chapter11-browser.json"),
    (range(35, 36), "smoke.json；database.json；database-event.json；chapter11-browser.json"),
]


def evidence_for_dev(dev_id: str) -> str:
    number = int(dev_id[-3:])
    if number == 29:
        return "无系统推送/真机证据（授权延期）"
    for numbers, evidence in EVIDENCE_BY_DEV:
        if number in numbers:
            return evidence
    raise AssertionError(dev_id)


EVIDENCE_BY_PREFIX = {
    "SCP": "chapter11-browser.json；smoke.json",
    "ORG": "organization-admin.json；database.json；chapter11-browser.json",
    "ACC": "account-lifecycle.json；account-*.json；chapter11-browser.json",
    "PER": "organization-admin.json；profile-phone.json；review-routing.json",
    "ADM": "organization-admin.json；deadline-reminder-notification.json；chapter11-browser.json",
    "TSK": "review-routing.json；smoke.json；database-event.json",
    "REV": "review-routing.json；smoke.json；chapter11-browser.json",
    "FLW": "review-routing.json；deadline-reminder-notification.json；chapter11-browser.json",
    "HIS": "review-routing.json；deadline-reminder-notification.json；database-event.json",
    "HOM": "home-calendar.json；home-calendar-three-viewports.json",
    "CAL": "home-calendar.json；home-calendar-three-viewports.json；chapter11-browser.json",
    "TMV": "home-calendar-three-viewports.json；chapter11-browser.json；screenshots/",
    "LOG": "work-logs.json；logs-profile-*.json；chapter11-browser.json",
    "ME": "profile-phone.json；logs-profile-*.json；chapter11-browser.json",
    "AIM": "ai-analysis.json；chapter11-browser.json",
    "NTF": "deadline-reminder-notification.json；notification-*.json；chapter11-browser.json",
    "MSG": "deadline-reminder-notification.json；notification-*.json；database-event.json",
    "NTH": "deadline-reminder-notification.json；notification-*.json；database-event.json",
    "TIM": "deadline-reminder-notification.json；database-event.json",
    "UX": "chapter11-browser.json；home-calendar-three-viewports.json；screenshots/",
}


def audit_prefix(aud_id: str) -> str:
    return aud_id.split("-")[1]


def audit_status(aud_id: str, requirement: str, dev_refs: str) -> str:
    if aud_id == "AUD-UX-004":
        return "延期：A-25 真机专项，未验证"
    if "DEV-029" in dev_refs or "系统推送" in requirement:
        return "部分已实现：站内链路有证据；系统推送延期，未验证"
    if aud_id in {"AUD-UX-001", "AUD-UX-002", "AUD-UX-003", "AUD-UX-005"}:
        return "浏览器视口证据已产出；真机部分延期，待独立核验"
    return "已实现并有当前证据；待独立 e13 verify"


lines = [
    "# 正式需求修复复验追踪表",
    "",
    "> 生成日期：2026-10-20。本文是 apply 阶段的实现与证据索引，不是独立验证报告，也不把历史审计结论改写为 PASS。原始《正式需求审计清单》《正式需求偏差报告》《产品需求文档》均保持不变。",
    "",
    "## 口径与当前证据",
    "",
    "- 当前代码/证据基线：仓库当前工作树；构建测试为 Java 21、MySQL 9.7、Flyway V1—V12。",
    "- HTTP/数据库脚本均使用隔离数据库；受控时钟套件会改变测试时间，因此不能在同一数据库上无条件串跑。",
    "- 浏览器证据来自桌面版 headless Chrome 的 320×740、390×844、1440×900 视口模拟，不是真机证据。",
    "- DEV-029（系统推送）与 A-25/相关真机部分经授权延期；这些项保持‘未验证/延期’，不计作完成。",
    "- JSON 与截图证据位于本目录；详细命令、迁移结果、失败修复过程见 `implementation-notes.md`。",
    "",
    "## DEV-001—035",
    "",
    "| DEV | 历史偏差 | OpenSpec 任务 | 当前实现证据 | apply 状态 |",
    "| --- | --- | --- | --- | --- |",
]

for dev_id, title in devs.items():
    status = (
        "授权延期：系统推送/真机未实现、未验证"
        if dev_id == "DEV-029"
        else "已实现并有当前证据；待独立 e13 verify"
    )
    refs = ", ".join(dict.fromkeys(task_refs[dev_id])) or "—"
    lines.append(
        f"| {dev_id} | {clean_cell(title)} | {refs} | {evidence_for_dev(dev_id)} | {status} |"
    )

lines += [
    "",
    "## AUD 150 项",
    "",
    "历史结论列仅用于追溯原审计，不代表本轮独立复验结论。",
    "",
    "| AUD | 来源 | 判定要点（摘要） | 历史关联 DEV | 当前证据 | apply 状态 |",
    "| --- | --- | --- | --- | --- | --- |",
]

for aud_id, cells in aud_requirements.items():
    source = cells[1]
    requirement = cells[2]
    result_cells = aud_results[aud_id]
    dev_refs = result_cells[-1]
    prefix = audit_prefix(aud_id)
    lines.append(
        f"| {aud_id} | {clean_cell(source)} | {clean_cell(requirement)} | "
        f"{clean_cell(dev_refs)} | {EVIDENCE_BY_PREFIX[prefix]} | "
        f"{audit_status(aud_id, requirement, dev_refs)} |"
    )

lines += [
    "",
    "## A-01—25",
    "",
    "| A | 正式验收要点 | AUD 覆盖 | 当前证据/状态 |",
    "| --- | --- | --- | --- |",
]

for a_id, cells in a_requirements.items():
    requirement = cells[1]
    coverage = a_coverage[a_id][1]
    if a_id == "A-19":
        state = "站内通知有当前证据；系统推送（DEV-029）延期，未验证"
    elif a_id == "A-25":
        state = "授权延期：只有多视口浏览器证据，没有真机证据，未验证"
    else:
        state = "对应实现与当前证据已建立；待独立 e13 verify"
    lines.append(
        f"| {a_id} | {clean_cell(requirement)} | {clean_cell(coverage)} | {state} |"
    )

lines += [
    "",
    "## 独立验证边界",
    "",
    "独立 verify 应重新执行 `implementation-notes.md` 中的命令并检查当前工作树，不应仅依据本表判定通过。尤其要保留以下边界：",
    "",
    "- DEV-029、A-25、AUD-UX-004：延期/未验证。",
    "- A-19 及涉及系统推送的 AUD：只能将站内通知部分纳入当前证据，不能声称系统推送通过。",
    "- AUD-UX-001/002/003/005：浏览器视口行为可核验，真机体验部分仍延期。",
    "- V4 历史快照迁移仍有数据映射阻断；新空库 V1—V12 成功不能替代历史快照清障。",
    "- 本文不修改 `verification.md`，也不授权归档。",
    "",
]

output = AUDIT / "traceability.md"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text("\n".join(lines), encoding="utf-8")
print(f"wrote {output}")
print(f"counts: DEV={len(devs)} AUD={len(aud_requirements)} A={len(a_requirements)}")
