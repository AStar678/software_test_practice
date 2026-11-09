# Implementation Notes

- Change: prepare-employee-client-contracts-and-business-upgrade
- Schema: spec-driven
- Store: local repo (`C:\Users\20943\Desktop\software_test_practice`)
- Implementation roots: `backend/`, repository-root employee Web (`潘多拉-*.js`, `admin.html`), `backend/scripts/`, `backend/docs/`
- Updated: 2026-11-09T22:00:00+08:00
- Implementation revision: `ab0f355` plus uncommitted working-tree changes (all listed files are dirty/untracked, not committed)
- Progress: 46/46 tasks complete; chapters 1–6 were implemented in the earlier session, chapters 7–11 in this session. Independent e13 verification has not yet been run at the time these notes were written; these notes are an apply-owned handoff, not a PASS.

## Implementation Map

| Task / requirement / scenario | Code and tests | Decisions / context |
| --- | --- | --- |
| 1.1 90-item / 54-requirement handoff index | `backend/docs/employee-client-contracts.md` | One row per inventory ID, 54 requirement rows, 12 guidance rows; updated in chapter 11 for the now-implemented holiday/Web/demo/regression sections. |
| 1.2 upgrade witness | `backend/scripts/check_employee_contracts_upgrade.py::witness`; `audit/prepare-employee-client-contracts-and-business-upgrade/upgrade-witness.json` | V31 fixture with real task/tag/log/calendar pin/single-day item; restart to V34; row/checksum comparison; backup dump/restore. Historical evidence was captured before V35; see reminders. |
| 2.1–2.4 migrations | `V32__daily_item_date_range.sql`, `V33__user_task_table_pins.sql`, `V34__hire_date_and_holiday_cache.sql`, `V35__holiday_cache_failure_state.sql` | V35 (new in chapter 7) makes `holiday_calendar_years.fetched_at` nullable so a missing year can persist its failed attempt/retry interval. Historical V1–V34 untouched. |
| 3.1–3.5 ranged daily items | `DailyItemService.java`, `WorkspaceController` `/daily-items` | Explicit `startDate/endDate`, inclusive coverage, `completed/open/overdue`, legacy `date` mapping, 409 `DAILY_ITEM_RANGE_REQUIRED` for old ranged reschedules, 93-day query window. |
| 4.1–4.5 server task table + independent pin | `TaskController/TaskService` `/tasks/table`, `/tasks/{id}/table-pin`, `TaskTableCollationTest` | Creator/current-owner union, complete filters, pinned group first, six stable sorts, Java simplified-Chinese Collator, count-before-page, no task If-Match for pin. |
| 5.1–5.3 log fill source | `WorkspaceController/WorkspaceService` `/work-logs/fill-source`, `FillSourceCoverageTest` | Read-only complete name groups for one business date; all-day inclusive, timed half-open, zero-length on its start day, complete source may exceed the 10000 UTF-16 log-body limit. |
| 6.1–6.4 hire date / tenure / email | `Tenure.java`, `ProfileService`, `OrganizationService`, `admin.html` | Same company `asOfDate`, leap/month-end clamping, authorized actual-chain email, direct create/plan/PATCH hire date. |
| 7.1 holiday source record | `backend/docs/holiday-calendar-source.md` | Candidate `NateScarlet/holiday-cn` format (year/papers/days), MIT, official 2026 notice (国办发明电〔2025〕7号) cross-check. The Windows host cannot reach GitHub raw; the live external fetch is **not** claimed as verified. |
| 7.2 bounded source/validation | `calendar/HolidayPayload.java`, `HttpHolidaySource.java`, `HolidayPayloadTest`, `HttpHolidaySourceTest` | Fixed server template only; year/date/name/boolean/papers validation; 1 MiB cap, connect/request timeouts, limited retries, 4xx no retry; all-or-nothing parse. |
| 7.3 atomic cache/failure state | `HolidayCalendarService.store/recordFailure/read`; `check_holidays.py` | Whole-year short transaction with header+days; old complete data survives failed refresh; concurrent readers see complete old or new; restart persistence. |
| 7.4 protected GET | `calendar/HolidayCalendarController`, `AuthFilter` admin holiday-read exception | `GET /api/v1/calendar/holidays/{year}` for active employees and independent admins; ready/stale/missing, `days=[]`/`updatedAt=null` for missing, safe `reason`. |
| 7.5 background refresh | `calendar/HolidayCalendarScheduler`, `HolidayCalendarService.scheduleIfDue` | Startup/daily current+next year; per-year in-flight de-duplication; 24 h failure interval; repeated GET does not amplify source calls. |
| 7.6 admin refresh | `calendar/HolidayCalendarAdminController`, `Writes.replayIfPresent` | Admin-only, Idempotency-Key, `audit_logs` `holiday.calendar.refreshed`, 502 + reason on failure, old cache preserved. |
| 8.1 ranged daily-item Web | `潘多拉-每日事项.js`, `潘多拉-每日事项.css` | Two date fields, covered-day list with full range/status, completion from any covered day, range edit/delete invalidates every old/new day; horizontal transition appearance retained. |
| 8.2 server task table Web | `潘多拉-任务表单.js`, `潘多拉-任务接入.js`, `潘多拉-api.js` | Form now calls `/tasks/table` with server relation/completion/q/from/to/sort/limit/offset; no current-page local re-sort; later-page pin returns to first page and refreshes; row pin indicator. |
| 8.3 profile details | `潘多拉-个人资料.js` | Self/subordinate details show hire date, unified tenure and authorized email; missing date renders `入职日期未设置`; directory/candidate summaries unchanged. |
| 8.4 API/resource versions | `update_web_resource_versions.py`, `潘多拉-交互原型.html`, `check_web_resources.py` | All content hashes refreshed; `/tasks` nextCursor, comment ID cursor and other `nextOffset` paths unchanged; packaged JAR bytes verified. No Android build. |
| 8.5 browser integration | `backend/scripts/check_chapter8_web.py`, `check_chapter8_browser.js` | Real Chrome: server table/paging/sort, later-page pin, ranged daily item create/edit/complete, profile, 320/390/1440, five nav/three modules, logout/account switch. |
| 9.1 animation organization | `seed/DemoSeed.java` | 光屿动画: 苏景昕→苏格拉底→柏拉图→亚里士多德; 故事部/制作部 and 分镜/剧本/原画/合成 teams; independent admin; stable seed keys/physical IDs. |
| 9.2 meaningful demo data | `DemoSeed.prepareBusiness`; `check_final_demo.py` | Ten shared animation company items; 10–20 created tasks per lead, own ranged/daily items, recent logs, notifications; real create/approve/progress/complete/reopen/handover/takeover paths; no test-word titles for default data. |
| 9.3 isolated extreme fixture | `backend/scripts/check_demo_extremes.py` | 105 page tasks + 101 same-day items + six timed/five+ overlaps + six all-day + cross-year/midnight/zero-length + cross-account denial; default demo no longer contains these. |
| 9.4 prepare/rebuild evidence | `check_final_demo.py`, `backend/README.md` | Two prepares and restart preserve rows/IDs/edits; mismatched target/marker refused; normal startup/migration no reset; explicit destructive `start-demo.sh` rebuild and backup/restore notes. |
| 10.1–10.5 regression | Maven test, `check_account_lifecycle.py`, contract/holiday/Web/final-demo/extreme suites | See `audit/prepare-employee-client-contracts-and-business-upgrade/chapter10-regression.md` for command/result/limitation table. |
| 11.1 handoff docs | `backend/docs/employee-client-contracts.md` | Updated holiday/source/Web/demo sections; 90/54/12 and J01–J32 responsibility mapping retained; no credentials or real private contact data. |
| 11.2 examples/current checks | `backend/docs/api-examples.http`, `backend/docs/current-checks.md`, `backend/README.md`, `backend/docs/holiday-calendar-source.md` | Added ranged daily item, `/tasks/table`, table-pin, fill-source, holiday GET/refresh examples; updated demo/check mappings; explicit upgrade/rollback conditions. |
| 11.3 apply handoff | this file; `audit/.../chapter10-regression.md` | Prepared evidence for independent e13 verification. No archive and no B change created. |

## Checks Run

| Command | Working directory / setup | Result / evidence | Run time or revision |
| --- | --- | --- | --- |
| `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test` | `backend/`; project MySQL on 13306 | 128 tests, 0 failures/errors | 2026-11-09T21:58+08:00 |
| `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 -DskipTests package` | `backend/` | JAR built with current source and Web assets | 2026-11-09 |
| `python backend/scripts/check_account_lifecycle.py` | repo root; disposable random DB | all PASS (namespaces, refresh/logout, password policy, forced-change, reset) | 2026-11-09 |
| `python backend/scripts/check_employee_contracts_upgrade.py --skip-witness` | repo root; random DBs, real Chrome | 307 checks, 0 failures | 2026-11-09 |
| `python backend/scripts/check_holidays.py` | repo root; local annual-source server | 37 checks, 0 failures | 2026-11-09 |
| `python backend/scripts/check_chapter8_web.py` | repo root; real Chrome, disposable DB | 33 checks, 0 failures | 2026-11-09 |
| `python backend/scripts/check_final_demo.py` | repo root; prepared random demo DB | all PASS; 58 tasks, 14 users, 2 departments, 4 teams, 10 company items | 2026-11-09 |
| `python backend/scripts/check_demo_extremes.py` | repo root; disposable fixture | 130 checks, 0 failures | 2026-11-09 |
| `python backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar` | repo root | 15/15 checks | 2026-11-09 |
| `python backend/scripts/check_database.py --database <demo>` | through `check_final_demo.py` | read-only integrity PASS; global holiday day FK exempted from organization-scoped FK rule | 2026-11-09 |

Evidence: `audit/prepare-employee-client-contracts-and-business-upgrade/*.json`, `chapter10-regression.md`, `output/task-creation-refinement/final-demo.json`, and `.runtime/demo-prepare.log` / service logs.

## Verification Reminders

- Holiday live egress: `raw.githubusercontent.com`/jsDelivr could not be reached from this Windows host; the default template remains the candidate, and the local official-2026 fixture is the test source. A deployment must validate real source reachability or configure a self-hosted mirror. Do not treat the local fixture as proof of public network access.
- V35 is new after the earlier upgrade witness and contract evidence. The upgrade witness still covers V31→V34; the final empty-chain/current checks pass, but an independent verifier should re-run the upgrade witness through V35 if byte-level witness continuity is required.
- Chrome requires full machine access on this Windows host (named-pipe sandbox restriction). Browser checks were run with real Chrome and are not device/APK evidence.
- `check_final_demo.py` and `current-checks.md` were updated to the animation demo; old historical reports claiming 144 tasks or a 110-row default dump are superseded for A.
- The isolated extreme fixture (105 tasks/items >100, six overlap/all-day, cross-year/midnight/zero) is intentionally separate from the default demo; do not re-add it to `DemoSeed`.
- `check_database.py` now exempts the global `holiday_calendar_days → holiday_calendar_years` FK from the organization-scoped FK rule; this is a global cache table, not organization data.
- The Web task form now requires `/tasks/table`; old browser scripts that assume `state.result.sorted` are historical and should not be used as current A evidence. `check_chapter8_web.py` is the current Web form check.
- No Android/Flutter/APK/device/system-push evidence exists in this change. A is not B; do not archive B or claim Flutter delivery.
