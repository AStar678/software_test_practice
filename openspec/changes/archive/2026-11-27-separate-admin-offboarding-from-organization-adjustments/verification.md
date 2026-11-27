# Implementation Verification

- Change: `separate-admin-offboarding-from-organization-adjustments`
- Schema: `spec-driven`
- Verdict: PASS
- Verified at: `2026-11-27T13:42:23+08:00`
- Implementation roots: `/home/rmy/桌面/panDuola` (`admin.html`, `backend/`)
- Verified revision: `f426be7` plus uncommitted App remediation and main-spec sync

## Summary

Strict OpenSpec validation, Maven tests, the independent offboarding service check, the demo-seed check and the real-Chrome offboarding workflow all pass. No actionable findings remain. Historical scripts that still exercise retired lifecycle contracts were not rerun; the current dedicated scripts cover the new contract and report the retired behavior explicitly. Concurrent identical offboarding is verified, while a simultaneous ordinary approval/organization write remains a residual race risk not separately exercised.

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| Implementation and planning root: `/home/rmy/桌面/panDuola` | 832 files after excluding build outputs, caches, generated audit reports and logs. Includes `admin.html`, backend sources/tests and this change's artifacts. |
| Planning artifacts | `proposal.md`, delta spec, `design.md`, `tasks.md` read from disk; all tasks complete but checkboxes treated as claims. |
| Snapshot before | `11e4c5c8e2bdd5d0d78669dd5a1921ead0393fc685fb378ceb77f3fb380d4202` (`/tmp/e13-offboarding-before.json`) |
| Snapshot after | `11e4c5c8e2bdd5d0d78669dd5a1921ead0393fc685fb378ceb77f3fb380d4202` (`/tmp/e13-offboarding-after.json`); compare returned `changed: false` |
| Exclusions | `flutter/build/**`, `flutter/.dart_tool/**`, `backend/target/**`, `backend/.runtime/**`, `notebooks/**`, `output/**`, `audit/**`, `*.log` |

## Apply Handoff Review

The handoff identifies this change and the admin/backend roots, but uses the historical macOS checkout and `28be41f` plus dirty worktree. It was used to locate implementation and checks; all decisive service/browser checks were rerun on the current Linux checkout. Reminder dispositions:

| Reminder | Disposition |
| --- | --- |
| Historical suites exercise retired contracts | Confirmed; current dedicated suites cover the new contract and explicitly assert retired writes are rejected. Residual risk only for old scripts. |
| “No legal reviewer” path not directly raced | Code inspection confirms `EmployeeOffboardings` aborts with `OFFBOARDING_PENDING_BLOCKED`; no concrete defect found. |
| Concurrent approval/organization adjustment only partially raced | Concurrent identical offboarding verified; broader interleaving remains a residual risk. |
| Head replacement not in new API script | Head succession is covered by the browser/service flows and the predecessor plan suite; no concrete defect found. |
| Archive ordering | Resolved; the predecessor admin change is archived and its requirements are in the main spec. |
| Version rebasing is intentional | Service checks cover own withdrawal/expiry and execution handover rebasing; no finding. |
| V40 required | Current Maven suite and fixtures pass with V40 applied. |
| Demo seed scope | Demo check proves fresh explicit preparation writes synthetic identities/positions and repeated/normal startup preserves data. |
| UI copy note | Browser check confirms required business labels remain and redundant filter/sort explanations are absent. |
| No commit was made in apply | Current checkout used for verification; this report records the actual basis rather than trusting the old revision. |

## Checks

| Command or inspection | Result | Notes |
| --- | --- | --- |
| `openspec validate "separate-admin-offboarding-from-organization-adjustments" --type change --strict --json --no-interactive` | PASS | `valid: true`, no issues; predecessor requirement is now present in the main spec. |
| `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package` | PASS | 250 tests, 0 failures/errors/skips; BUILD SUCCESS. |
| `python3 backend/scripts/check_apply_offboarding.py` | PASS | **108/108 checks**: split commands, inventory, execution handover, management takeover, pending withdrawal/reassignment/blocking, atomic rollback, stale/concurrent replay, structure-only adjustment, identity search/privacy. |
| `python3 backend/scripts/check_apply_offboarding_demo.py` | PASS | **17/17 checks**: synthetic identities, founder title, exact search, masking, repeated/normal startup preservation. |
| `CHROME_BIN=/usr/bin/google-chrome python3 backend/scripts/check_apply_offboarding_browser.py` | PASS | **71/71 checks**: dedicated offboarding, candidate search, pending presentation, directory search, structure-only repair/copy and combined admin/employee flow. |
| Static inspection of `admin.html` and backend routes | PASS | No legacy takeover write navigation; employee search uses POST body; org adjustment rejects lifecycle fields; dedicated offboarding uses the restricted command. |
| Snapshot compare | PASS | Inputs unchanged during verification. |

## Requirement Coverage

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| **Synthetic identity documents in the default demo**: fresh seed; preserve existing data | `DemoSeed`, `check_apply_offboarding_demo.py` 17/17. | PASS |
| **Organization and administration**: structure-only command; lifecycle fields rejected; pending route/visibility refresh without rewriting task ownership | `OrganizationPlans` structure allow-list; `check_apply_offboarding.py` organization section and browser check. | PASS |
| **Atomic employee deactivation and formal business takeover**: execution handover, management takeover, own pending withdrawal, third-party reassignment/blocking, atomic failure | `EmployeeOffboardings`, `TaskService.applyOffboardingAssignments/withdrawOffboardingRequests`, service checks. | PASS |
| **Admin dedicated employee offboarding**: single entry, direct confirm vs handover page, candidate search, pending Chinese presentation, concurrency | `admin.html` offboarding dialogs; browser 71/71; service 108/108. | PASS |
| **Admin employee directory search and filters**: exclusive search row, exact full identity lookup, masked list, combined filters, narrow widths | `OrganizationService.searchEmployees`; browser directory section; service identity section. | PASS |
| **Admin console error and irrelevant copy safety**: safe errors; remove filter/sort explanations and defensive AI-style copy | `safeAdminMessage`; browser copy audit; static inspection. | PASS |

## Findings

No actionable findings.

## Residual Risks

- Historical scripts that still use retired lifecycle fields/write routes were not rerun; current dedicated suites supersede them for this contract.
- Concurrent offboarding with an independent ordinary approval or unrelated organization write was not separately raced.
- Non-Chrome browsers were not tested.
