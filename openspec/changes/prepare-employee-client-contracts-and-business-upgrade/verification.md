# Implementation Verification

- Change: prepare-employee-client-contracts-and-business-upgrade
- Schema: spec-driven
- Verdict: PASS
- Verified at: 2026-11-09T22:14:00+08:00
- Implementation roots: `C:\Users\20943\Desktop\software_test_practice` (backend, repository-root employee Web, docs, scripts)
- Verified revision: `ab0f355` plus uncommitted working-tree changes (all implementation/planning files are dirty; evidence applies to this working tree, not the base commit)

## Summary

Independent verification PASS for the A contract in this change. The change's mandatory scenarios are covered by current real-service, migration, browser, Maven and demo checks: 128 Maven tests, 307 contract checks (including the V31→V35 witness), 37 holiday checks, 33 real-Chrome chapter-8 checks, 130 isolated extreme-fixture checks, the animation demo checks, and 15 Web resource checks all pass. OpenSpec strict validation passes.

Residual risks, not findings: the public holiday source could not be reached from this Windows host, so the live external endpoint remains deployment-verified only; A does not include Flutter/APK/real-device/system-push evidence by design.

## Verification Basis

- Implementation/planning root: `C:\Users\20943\Desktop\software_test_practice`
- Exclusions: `backend/target/**`, `backend/.runtime/**`, `.tmp-jar/**`, `.tmp-verify/**`, `audit/**`, `output/**` (build outputs, runtime databases/logs and generated evidence are not source inputs).
- Snapshot command: `python .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture --root C:\Users\20943\Desktop\software_test_practice ... --output %TEMP%\pandora-verify-baseline.json`
- Snapshot SHA-256: `89eb1d66f1b004719e6559ddecad000f945b96acf5a4e5cdb4369f042ac7dd8a` (9,247 files)
- Incremental/full scope: full verification for this session because chapters 1–6 were implemented earlier and chapters 7–11 were added now; all affected suites were rerun. No prior independent state existed.
- Reused evidence: none for the final verdict; the current round reran Maven, contract, holiday and chapter-8 checks. Demo/extreme/resource results were generated in this same session after the final implementation changes.

## Verification Basis / Compare

- Baseline captured with the exclusions above; a post-report capture is compared and copied to `verification-state.json` only if it is identical.
- OpenSpec strict validation: `openspec validate prepare-employee-client-contracts-and-business-upgrade --type change --strict --json --no-interactive` → valid, 1/1 passed, no issues.

## Apply Handoff Review

- Handoff: `openspec/changes/prepare-employee-client-contracts-and-business-upgrade/implementation-notes.md`, updated in this session to 46/46 tasks and the current working-tree revision. It is an apply-owned handoff, not a PASS.
- Reminder: holiday live egress unreachable from this host → confirmed environment limitation; the official-2026 local fixture and source record are present, live endpoint is not claimed. No behavioral deviation found.
- Reminder: V35 after the earlier witness → now covered by the current V31→V35 witness (PASS) and empty-chain check.
- Reminder: Chrome requires full machine access → confirmed; real Chrome checks ran and passed. This is not mobile/device evidence.
- Reminder: old 144/110 demo checks superseded → confirmed; `check_final_demo.py` now asserts the animation demo and a 58-task total, and extreme data is isolated.
- Reminder: old browser scripts assuming `state.result.sorted` are historical → confirmed; `check_chapter8_web.py` is the current server-table browser check.
- Reminder: holiday global FK exempted in `check_database.py` → confirmed as a global cache table, not organization data.
- Reminder: no Android/Flutter/APK evidence → confirmed scope boundary; A is not B.

## Checks

| Command or inspection | Result | Notes |
| --- | --- | --- |
| `openspec validate ... --strict` | PASS | No issues |
| `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test` | PASS | 128 tests, 0 failures/errors |
| `python backend/scripts/check_account_lifecycle.py` | PASS | All lifecycle/namespace/password checks |
| `python backend/scripts/check_employee_contracts_upgrade.py --only daily` | PASS | 56 checks, including V31→V35 witness, backup/restore, empty chain, daily range |
| `python backend/scripts/check_employee_contracts_upgrade.py --skip-witness` | PASS | 307 checks, 0 failures |
| `python backend/scripts/check_holidays.py` | PASS | 37 checks, 0 failures |
| `python backend/scripts/check_chapter8_web.py` | PASS | 33 real-Chrome checks, 0 failures |
| `python backend/scripts/check_final_demo.py` | PASS | animation demo, two prepares/restart, edit preservation, PC takeover |
| `python backend/scripts/check_demo_extremes.py` | PASS | 130 checks, 0 failures |
| `python backend/scripts/check_web_resources.py ...` | PASS | 15/15 checks; packaged bytes/hashes match |
| Code inspection | PASS | Holiday scheduler tolerates a V31 baseline without holiday tables; refresh outside write transaction; table-pin independent of task version; daily-item Web uses explicit pairs |

## Requirement Coverage

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| `china-holiday-calendar` / Authoritative annual arrangements (published year and unavailable future year) | Official 2026 notice sample, `holiday-calendar-source.md`, 37 holiday checks (ready/missing, make-up day) | PASS |
| `china-holiday-calendar` / Atomic validated annual cache (invalid/conflicting payload, concurrent replace) | `check_holidays.py` cross-year rejection, concurrent reader old/new, restart, failed refresh preserves old | PASS |
| `china-holiday-calendar` / Protected local annual read contract (source down, missing vs verified) | GET by founder/employee/other-company/admin; stale after failure; missing empty | PASS |
| `china-holiday-calendar` / Bounded refresh and explicit administration (coalescing, admin-only) | Startup current/next exactly once, repeated GET coalescing, 24 h/no retry, admin Idempotency-Key/502/audit | PASS |
| `china-holiday-calendar` / Labels do not change task semantics | Task start/due/version unchanged after refresh; holiday checks | PASS |
| Modified `pandora...` / Independent personal daily items (range, status, privacy, migration, time zones) | 307 contract checks: range create/list/summary/PATCH/delete, legacy mapping, 409, privacy, leap/edge metadata | PASS |
| Modified `pandora...` / Horizontal continuous daily-item calendar, status markers, lists/details/editing | Chapter-8 real Chrome: date reach, range list/detail/complete/edit return, 320/390/1440 no overflow; existing API summary checks | PASS |
| Modified `pandora...` / Global task table sorting/counts + server query + independent pin | 307 contract checks and chapter-8 browser: server total/order/paging, later-page pin to first page, title collation, both pins independent | PASS |
| Modified `pandora...` / Minimal profile, hire date/tenure/email | 307 contract checks plus chapter-8 browser date/tenure/email and peer/ordinary-summary denials | PASS |
| Modified `pandora...` / Strict prototype scope, account lifecycle, organization/admin | Account lifecycle suite and Maven auth/org tests; final demo PC/admin/takeover checks; no Android files touched | PASS |
| Modified `pandora...` / Persistent demonstration data (four animation roles, 10–20 tasks, ten items, two prepares) | `check_final_demo.py`: 14 users, two departments/four teams, 58 tasks, 10 company items, edit preservation; no page/overlap seeds | PASS |
| Added `Range daily-item retrieval and legacy compatibility` | Contract checks cover all scenarios and 93-day/window/legacy/409/version/idempotency | PASS |
| Added `Server-side personal task table query` | Contract checks cover filters, both directions, Chinese/mixed titles, later-page search/pin, effective data, revalidation | PASS |
| Added `Independent personal task table pin` | Contract + chapter-8 browser: created-unassigned pin, no task version/approval, stale pin denies, both preferences separate | PASS |
| Added `Read-only log date fill source` | Contract checks: complete groups, all-day/midnight/zero, >10000 source, backfill, admin/other-user denial, pure read | PASS |
| Added `Complete employee client contract handoff` | `employee-client-contracts.md` 90/54/12 mapping updated; `api-examples.http`/`current-checks.md` current; no credentials | PASS |
| V31→V35 migration / historical checksums / backup restore | Witness checks current round: V32–V35 applied, historical checksums unchanged, rows byte-identical, backup restore, empty chain | PASS |
| Web resource graph / packaged asset identity | `check_web_resources.py` 15/15 | PASS |
| Isolated extreme boundaries | `check_demo_extremes.py`: >100 tasks/items, six overlaps/all-day, cross-year/midnight/zero, cross-account denial | PASS |

## Findings

None. Residual risks are listed in the Summary and are not actionable conformance defects for A.
