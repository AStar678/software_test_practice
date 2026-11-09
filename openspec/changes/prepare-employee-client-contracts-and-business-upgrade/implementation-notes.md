# Implementation Notes

- Change: prepare-employee-client-contracts-and-business-upgrade
- Schema: spec-driven
- Store: local repo (`/Users/watuji/MyGitDev/software_test_practice`)
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice/backend`, `/Users/watuji/MyGitDev/software_test_practice/admin.html`
- Updated: 2026-11-09T08:17:00+08:00
- Implementation revision: `dc0cae4` plus uncommitted working-tree changes (all files below are dirty/untracked, not committed)
- Progress: 23/46 tasks complete. This session covered chapters 1–6 only, as requested; chapters 7–11 are untouched.

## Implementation Map

| Task / requirement / scenario | Code and tests | Decisions / context |
| --- | --- | --- |
| 1.1 90-item / 54-requirement handoff index | `backend/docs/employee-client-contracts.md` | One row per inventory ID, 54 requirement rows, 12 guidance rows. Verified programmatically: 90 unique IDs, 54 unique requirement rows. A/B/PC responsibility and J paths recorded; no new-API-only view. |
| 1.2 upgrade witness | `backend/scripts/check_employee_contracts_upgrade.py::witness`; `audit/prepare-employee-client-contracts-and-business-upgrade/upgrade-witness.json` | V31 fixture with real task/tag/log/calendar pin/single-day item; restart to V34; row/checksum comparison; backup dump/restore; disposable random DB only. |
| 2.1 range item migration | `V32__daily_item_date_range.sql` | Renames `item_date` to `start_date`, nullable `end_date` → backfill → NOT NULL, range CHECK and owner/range index. New index added before dropping the FK-supporting old index. |
| 2.2 independent table pins | `V33__user_task_table_pins.sql` | New composite-PK table only; no copy/dual-write of `user_task_pins`. |
| 2.3 hire date + holiday cache structure | `V34__hire_date_and_holiday_cache.sql` | `users.hire_date` nullable, no backfill; `holiday_calendar_years` (source/version/hash/notice/fetched/failure) + `holiday_calendar_days`. Runtime holiday logic is chapter 7, not implemented here. |
| 2.4 upgrade/empty/backup evidence | witness script and contract doc §4.9 | Baseline V31→V34, empty DB→V34, `mysqldump`+isolated import+fingerprint compare, historical checksums unchanged; rollback conditions documented. |
| 3.1 range CRUD / status / company date | `DailyItemService.java` | `startDate/endDate`, inclusive range, `completed/open/overdue`, `businessDate/organizationTimeZone`; legacy `date` create maps to one day. |
| 3.2 date and from/to listing | `DailyItemService.list` | `date` and `from/to` mutually exclusive; ≤93-day window; intersection query; original pair returned; complete pagination metadata. |
| 3.3 per-covered-day summary | `DailyItemService.summary` | Iterates each item's overlap with the query window; counts open+overdue and completed separately; absent zero days stay absent. |
| 3.4 legacy compatibility | `DailyItemService.change` | Mixed formats 400; half pair 400; legacy `date` only for current single-day; ranged record returns `409 DAILY_ITEM_RANGE_REQUIRED` before any write. |
| 3.5 real-service item checks | Python `daily_items` group | Peer/head/other-company/admin denial, stale version 412, same-key replay, cross-day completion/reopen, deletion, long-span record. J05/J06/J29 evidence in final report. |
| 4.1 `/tasks/table` route/contract | `TaskController.java`, `TaskService.table` | Literal route wins over `/tasks/{id}`; strict parameter whitelist; `items/total/limit/offset/nextOffset`; `/tasks` and `nextCursor` unchanged. |
| 4.2 table filters/sort/pin grouping | `TaskService.table`, `tableOrder`, `compareTitle`, `scheduleDate` | Creator/current-owner union; relation/completion/q/single-end dates; ID de-dup; pinned group first; six sorts with ID-ascending ties; in-memory batch after full filtering. Collator locked in code and `TaskTableCollationTest`; runtime in `collator-runtime.txt`. |
| 4.3 independent table pin | `TaskService.setTablePinned`, `TaskController` PUT/DELETE, `taskView` fields | Separate table, no task If-Match, no task version/schedule/approval/notification changes; `tablePinned/canTablePin` added while `pinned/canPin` stay calendar-only. |
| 4.4 negative pin/permission boundaries | Python `task_table` group | Unpublished pin 409; created-but-unassigned table pin allowed and calendar pin 403; lost relationship cannot be restored by residual pin; pending completion counts unfinished; proposal schedule removed from table rows. Historical-notification and nested read-only UI gating are client-side; `notificationTask` has no pin fields. |
| 4.5 table scale/batch evidence | Python general-log query count; `ReadBatch.tablePins` | 108-task multi-page fixture; one request for 10 rows issues ≤2 queries for each of versions/tags/assignees/pins; only current page returned. No claim of an untested performance ceiling. |
| 5.1 fill-source contract | `WorkspaceController`, `WorkspaceService.fillSource` | `businessDate` only, no `userId`; complete id/name groups, company zone, `complete:true`; 400 for invalid/unknown params; 403 for admin. |
| 5.2 business-day coverage | `WorkspaceService.coversBusinessDay`, `FillSourceCoverageTest`, Python `fill_source` group | All-day inclusive; timed half-open; midnight does not spill; zero length belongs to start day; completed included; unpublished/non-owner excluded; 55+ items and long multi-line bodies; sum >10000 UTF-16 units demonstrated. |
| 5.3 log semantics not widened | Python fill source checks, `WorkspaceLogLengthTest` | Pure read (counts/domain events unchanged); 10000 accepted / 10001 rejected; supplementary-plane characters use two UTF-16 units; backfilled day still readable; existing freeze/window code untouched. |
| 6.1 hireDate every admin path | `OrganizationService`, `OrganizationPlans`, `V34`, `admin.html` | Direct create, plan `newEmployees`, PATCH; strict ISO, company-today ceiling, omitted keeps/null clears; version and one transaction; validated before any DML; initial password replay not returned twice. |
| 6.2 unified tenure | `Tenure.java`, `ProfileService`, `WorkspaceService.meRead/personRead`, `TenureTest` | Complete years → complete months (month-end clamping) → days; leap-day anniversary uses last day of month; same company `asOfDate` in `/me`, `/me/profile`, `/users/{id}`; null for missing/future. |
| 6.3 authorized e-mail | `Access.canReadEmail`, `WorkspaceService.personRead` | Self or current actual management-chain ancestor with profile visibility; directory/reports/candidates unchanged; reassignment re-evaluates the chain; peer/other-chain/cross-company denied. |
| 6.4 PC admin browser flow | `admin.html`, `check_admin_hire_browser.js` | Real Chrome: login, column, dialog prefill, save/readback, cancel no-write, future-date error with input retained, clear, organization draft carries date but creates no account before plan save, no console errors. |

## Checks Run

| Command | Working directory / setup | Result / evidence | Run time or revision |
| --- | --- | --- | --- |
| `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test` | `backend/`; project MySQL running (`scripts/start-db.sh`) | 118 tests, 0 failures, 0 errors | 2026-11-09T08:16+08:00, working tree |
| `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 -DskipTests package` | `backend/` | Jar built for fixtures | 2026-11-09T08:15+08:00 |
| `python3 backend/scripts/check_employee_contracts_upgrade.py` | `backend/scripts/`; random fixture DBs on ports 18240/18241/18242; normal `pandora` DB not selected | 322 checks, 0 failures; 13 of them are real-Chrome admin.html checks | 2026-11-09T08:16+08:00 |
| `java -version` + `jshell` Collator probe | repo root | OpenJDK 21.0.7 Homebrew; `java.text.RuleBasedCollator`, TERTIARY, canonical decomposition; saved in `audit/.../collator-runtime.txt` | 2026-11-09T08:14+08:00 |

Evidence files:
- `audit/prepare-employee-client-contracts-and-business-upgrade/employee-contracts-check.json` — full 322-check report.
- `audit/prepare-employee-client-contracts-and-business-upgrade/upgrade-witness.json` — V31→V34 row/checksum witness.
- `audit/prepare-employee-client-contracts-and-business-upgrade/admin-hire-browser.log` — real Chrome output.
- `audit/prepare-employee-client-contracts-and-business-upgrade/collator-runtime.txt` — JDK/collator lock.
- `audit/prepare-employee-client-contracts-and-business-upgrade/*service.log` — fixture service logs.

## Verification Reminders

- Chapters 7–11 are **not implemented**: holiday source/refresh/API (7.x), employee Web adapters/resources (8.x), animation demo/extreme fixture (9.x), full shared-business regression (10.x), final API examples/current-checks/independent-verification handoff (11.x). Do not mark those complete or archive on this session's evidence.
- `V34` creates the holiday cache tables only. No holiday fetch, validation, cache replacement, GET route, admin refresh, or scheduler exists yet. `holiday_calendar_years/days` are empty by design; `hire_date` stays NULL.
- Historical-notification and subordinate-nested read-only pin actions are enforced by client presentation; `TaskService.detail` still exposes `canTablePin` for an owner/creator when reached through a normal authorized context. `WorkspaceService.notificationTask` intentionally has no pin fields. Verify the Web/B gating and do not treat a normal detail's `canTablePin` as authority for those read-only paths.
- The table endpoint's first version uses the batch in-memory pipeline. The evidence proves batched reads for a 108-task fixture and current-page-only responses; it does **not** prove an unlimited-data performance ceiling. Future SQL pushdown must keep the same semantics and collation.
- The fill-source can exceed the existing 10000 UTF-16 log-body limit (six near-2000-character items). A/B must merge/truncate in the client presentation; A deliberately did not relax the log write limit or truncate the source.
- `hireDate` is exposed in `/me`, `/me/profile`, authorized `/users/{id}`, and admin employee list/detail. It is intentionally absent from `/users` directory, `/me/reports`, assignee candidates and task participant summaries.
- `admin.html` browser evidence covers direct employee edit/clear and draft-entry date capture, not a complete organization-plan save through the browser UI; the plan-save/readback path is covered through the real service API, including invalid-date atomic rejection.
- The migration witness and all API/Chrome checks run on disposable random databases. No normal/demo database was selected, migrated, or mutated this session.
- `android/`, `android-shell/`, Flutter, APK, device gestures and system push were not touched and are not evidence for this change.
- The working tree is uncommitted at `dc0cae4` plus the files above; the verifier should use the working tree, not the base commit, and must not treat these apply checks as an independent PASS.
