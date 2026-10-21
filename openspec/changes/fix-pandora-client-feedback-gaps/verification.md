# Implementation Verification

- Change: fix-pandora-client-feedback-gaps
- Schema: spec-driven
- Verdict: FAIL
- Verified at: 2026-10-21T20:24:31.244280+08:00
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice` (frontend), `/Users/watuji/MyGitDev/software_test_practice/backend` (backend/build/checks)
- Verified revision: `24e650a9acd128c514c8cfaad04a0359948a923a`; clean worktree at start. This run changes only this report.

## Summary

One confirmed implementation deviation remains: returning to an already-open task table from another main page renders cached rows and counts without re-querying current authorization (V-001). Independent browser reproduction showed 13 retained rows and zero requests on return; manual refresh consumed the same simulated empty authorized response and removed all rows.

Strict OpenSpec validation, all 66 backend tests, packaging, the 82-check task-form suite, and all named regression suites passed after resolving the local Python proxy setup. Passing suites do not cover V-001. All eight delta requirements and 53 scenarios are mapped below; supplementary execution checked the four simultaneous filters, overlapping counts, and pin-independent sorting. No implementation, test, planning, task, or handoff files were edited.

Residual limits: browser evidence covers desktop and narrow layouts, not real devices, keyboards, or system push (explicitly deferred). Production-scale performance and cross-request transactional task snapshots are outside this change. Some retained calendar/admin behavior is supported by code inspection plus HTTP tests rather than a separate browser gesture for each alias scenario; this is identified below. The report does not approve archive.

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| Both implementation roots and repository planning/context | Git HEAD `24e650a9acd128c514c8cfaad04a0359948a923a` |
| Source/configuration/test/document/planning inventory | 166 paths; aggregate SHA-256 `77dd70fdfcd226e39c848431a88d0b7cd7cb40921490ee5a82c91fbf589e504e` |
| Start versus final snapshot | Same 166 paths and same aggregate hash after all checks; no relevant input changes |
| Selected planning basis | `proposal.md`, `design.md`, `tasks.md`, `specs/pandora-requirements-aligned-prototype/spec.md`, `.openspec.yaml` in this change; main specs, V3, current project documentation included in inventory |
| Exclusions | `audit/`, `.agents/`, `.codex/`, all `implementation-notes.md` and `verification.md`; ignored build/runtime output and disposable fixtures are not acceptance source |

The inventory includes all tracked and nonignored untracked paths in scope; tracked deletions are represented by `MISSING`. Paths and content hashes are combined, detecting additions, deletions, and dirty content. Reproduce from the repository root:

```python
import subprocess, hashlib, pathlib
paths = subprocess.check_output([
    'git', 'ls-files', '-c', '-o', '--exclude-standard', '-z'
]).decode().split('\0')
paths = sorted(set(p for p in paths if p
    and not p.startswith(('audit/', '.agents/', '.codex/'))
    and pathlib.Path(p).name not in ('implementation-notes.md', 'verification.md')))
rows = [p + '\0' + (hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
        if pathlib.Path(p).is_file() else 'MISSING') + '\n' for p in paths]
print(len(paths), hashlib.sha256(''.join(rows).encode()).hexdigest())
```

`openspec status` and `instructions apply` resolved repo-local `spec-driven` artifacts and reported 23/23 checked tasks. There is no external store. No applicable AGENTS.md was found in the project or ancestor directories. Checked tasks and apply-stage audit evidence were treated as claims, not independent proof.

## Apply Handoff Review

Read `implementation-notes.md` in this change. It identifies the correct change and implementation roots. Its `a8b655f + dirty` revision label is stale: the implementation is now committed in child revision `24e650a`; code locations/claims were checked against that commit. The map also names nonexistent `潘多拉-任务集成.js`; the actual loaded file is `潘多拉-任务接入.js`. These are handoff metadata discrepancies, not application defects. No prior verification report or repair notes existed.

Every reminder was reviewed:

| Handoff reminder | Disposition and independent evidence |
| --- | --- |
| Restart after packaging before judging static resources | Confirmed setup: packaged first, then every HTTP/browser run started a new scratch Java process; new table assets executed through HTTP |
| Complete client-side task set, more than 200 rows, future large-data limit | Confirmed: TF created 205 bulk tasks plus matrix; fetched all pages; all 12 sort sequences and counts checked globally. Very-large-data optimization remains a non-goal |
| Missing/invalid company timezone must stop display | Confirmed by trace: `companyZone`, `ensureCompanyZone`, `refreshTable`, `paintResults` guard invalid/missing zone before rows/counts; `/me` timezone verified by TF and unit test. Missing-zone retry was not separately injected in the browser |
| Company-date boundaries, midnight due, invalid ranges | Confirmed by TF pure and real-browser checks with company Asia/Shanghai versus device America/New_York |
| Ascending ID ties even descending; pins ignored in table | Confirmed by six-column/two-direction TF tests, supplementary pin probe, and calendar-sort regression |
| Session-reset hooks clear authorized caches | Confirmed hook and epoch/sequence inspection plus TF logout-in-flight check; new-login-before-old-response and forced-expiry variants were not separately injected |
| Wait for seeded users, never use current database | Confirmed runner inspection; every service used a fresh `pandora_check_*` database and waited for users; original database was not a fixture |
| Notification/historical fixtures need worker | Confirmed: `CHECK_WORKER=true`; notifications 21/21 and TF historical access checks passed |
| Updated calendar tests should not restore old search/count assertions | Confirmed: calendar browser 35/35, HTTP 12/12, sort 4/4; own-only projection and absence of search/count UI checked |
| Detail rechecks backend; 403/404 discards row | Confirmed TF old-detail 404 and row-discard/requery checks, plus `P.request` wrapper and normal detail trace. Navigation that avoids a detail/requery is V-001 |
| Push and real-device deferrals | Confirmed V3/delta/status documentation retains them; not claimed as passed |
| Apply evidence is not an independent verdict | Confirmed: all relevant commands rerun; this report uses current-run outputs |

The handoff's broader entry-refresh claim is incomplete: V-001 covers return via main navigation. `P.reload` and refresh hooks were inspected independently of the map.

## Checks

Commands below run from `backend` unless noted. Each `ISO` command means `CHECK_WORKER=true NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost ./scripts/run_check_isolated.sh`; `{base}` and `{db}` are runner substitutions. Initial comprehensive run used default port 18130; regression/reproduction runs used `PORT=18131`. Each invocation creates and removes its own scratch database. No check used production or user business data.

| Command or inspection | Result | Notes |
| --- | --- | --- |
| `openspec validate fix-pandora-client-feedback-gaps --type change --strict --json --no-interactive` (root) | PASS | Valid, zero issues |
| `mvn -B -ntp -Dmaven.repo.local="$PWD/.runtime/m2" package` | PASS | Executes test phase: 66 tests, zero failures/errors/skips; BUILD SUCCESS. No redundant second test run needed |
| `ISO node scripts/check_task_form.js --base-url {base} --output /tmp/pandora-e13-task-form.json --screenshot-dir /tmp/pandora-e13-shots` | PASS 82/82 | More than 200 effective tasks; real authenticated HTTP + Chrome, desktop/narrow screenshots reviewed |
| `node scripts/check_calendar_sort.js` | PASS 4/4 | Time, ID ties, personal pins |
| `ISO node scripts/check_home_calendar_browser.js --base-url {base}` | PASS 35/35 | Calendar layouts, own-only data, hidden counts, spans, concurrency, gestures, table entry/return |
| `ISO python3 scripts/check_home_calendar.py --base-url {base}` | PASS 12/12 | Passed on proxy-corrected rerun |
| `ISO node scripts/check_chapter11_browser.js --base-url {base} --output /tmp/pandora-e13-chapter11.json --screenshot-dir /tmp/pandora-e13-chapter11-shots` | PASS 36/36 | Three viewports; fullscreen logs, related-task return, PC management tabs/dialog, frozen effective data |
| `ISO node scripts/check_notification_browser.js --base-url {base}` | PASS 21/21 | Empty/populated notifications, header close, business actions, historical readonly |
| `ISO node scripts/check_logs_profile_browser.js --base-url {base}` | PASS 22/22 | Add/edit/save log, full editor and profiles |
| `ISO python3 scripts/check_profile_phone_matrix.py --base-url {base}` | PASS 26/26 | Self/actual chain, forbidden roles, summary/analysis privacy, transfer reauthorization |
| `ISO python3 scripts/check_phone_cycle.py --base-url {base} --database {db}` | PASS 5/5 | Invalid management cycle and restored chain |
| `ISO python3 scripts/check_account_lifecycle.py --base-url {base} --database {db}` | PASS 47/47 | Admin-created credentials, first change, session invalidation, no registration |
| `ISO node scripts/check_account_browser.js --base-url {base}` | PASS 15/15 | Actual login/change/reset screens |
| `ISO python3 scripts/check_organization_admin.py --base-url {base}` | PASS 58/58 | Organizational validation, scopes, teams, transfer, company information, concurrency |
| Supplementary in-memory execution of source pipeline | PASS | Four filters together retained only `good`; total=1, own=1, created=1, visible=0, pendingComplete=1, done=0, overdue=1. Pin flag did not change descending tie order `a,b` |
| Supplementary source-module navigation execution | FAIL contract | Initial open issued one reload; log → view issued zero while preserving table/filter |
| Supplementary authenticated Chrome navigation reproduction | FAIL contract (probe exited 0) | Return: requests=0, rows=13, rendered=13; manual refresh: requests=1, rows=0. V-001 |
| Loading chain, stylesheet, pom, backend authorization/privacy traces | Supported | New assets included and exercised from packaged services; semantic table/sticky containers/escaping verified in source and screenshot/browser checks |

Environment recovery: the sandbox denied the MySQL socket, so local integration checks ran with approved access. Outside the sandbox, Python detected system HTTP/HTTPS proxies with no loopback bypass and initially raised `RemoteDisconnected`. Setting both `NO_PROXY` and `no_proxy` to loopback fixed all five affected Python suites. Original failures remain in `/tmp/pandora-e13-*-log` files (actual names end `.log`); successful reruns are `/tmp/pandora-e13-*-retry.log`. No unresolved environment finding remains. An initial supplemental browser harness failed to parse a shebang in `new Function`; removing the shebang in memory allowed the successful reproduction. No repository test was altered.

Current-run evidence is in `/tmp/pandora-e13-maven.log`, `/tmp/pandora-e13-task-form.{log,json}`, `/tmp/pandora-e13-shots/`, `/tmp/pandora-e13-chapter11.json`, `/tmp/pandora-e13-<suite>.log`, matching `-retry.log` files, and `/tmp/pandora-e13-navigation.log`. These temporary paths may be cleaned later; decisive results are preserved here. Historical `audit/2026-10-21/` evidence was not overwritten.

## Requirement Coverage

Evidence abbreviations: **TF** = current 82-check task-form run; **CAL** = calendar browser 35 + calendar HTTP 12 + calendar sort 4; **CH11** = chapter11 36; **LOG** = logs/profile 22; **NOT** = notifications 21; **PHONE** = matrix 26 + cycle 5; **ACCOUNT** = lifecycle 47 + browser 15; **ORG** = organization/admin HTTP 58. “Supported” combines observed executable evidence with the named code trace; it does not mean the overall change passes.

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| **Authorized task table page** | `潘多拉-任务表单.js:203-407,530-584`, table CSS; TF fields, pending effective snapshots, hidden parent, detail/full text, paging/scroll; packaged HTTP + screenshots | Supported |
| ↳ Browse the authorized spreadsheet on a narrow screen | TF 17 fields, sticky header/name, 390px and 1440px screenshots, five navs; CAL context return; semantic table/CSS trace | Supported (execution + trace) |
| ↳ Inspect effective data while review is pending | TF pending change keeps effective title/frozen marker; completion pending remains open; unpublished/history-only excluded; TaskService.taskView/snapshotView inspection | Supported (execution + trace) |
| ↳ Open detail and return without losing context | TF original detail/full text and successful pin write retain page/filter/scroll; hidden parent test; detail backend reauthorization trace | Supported (execution + trace) |
| **Combined task table filters and search** | `潘多拉-任务表单.js:28-99,495-527`; TF relation/completion/title/date cases; supplementary four-filter AND probe | Supported |
| ↳ Find a task created and assigned to oneself | TF independent own/created/visible relation filters; supplementary single-task overlap counts | Supported (execution + trace) |
| ↳ Apply relation completion title and date together | Supplementary five-fixture execution sets all four filters, returns only good (pending completion); `matchesTaskFilters` AND trace | Supported (execution + trace) |
| ↳ Search beyond the first API page | TF bulk001 task found beyond two API pages with default empty date filters; full-set local name match | Supported (execution + trace) |
| ↳ Use company dates independently of device timezone | TF America/New_York versus Asia/Shanghai, all-day boundaries, timed midnight, single end, invalid range retains previous counts | Supported (execution + trace) |
| **Global task table sorting and counts** | `潘多拉-任务表单.js:100-159,248-303`; TF global six-column ordering/counts; supplementary one-task overlap and pin probe | Supported |
| ↳ Sort all filtered rows before paging | TF all rendered pages checked for all six columns in both directions, stable ID tie, aria-sort; supplementary pinned comparison | Supported (execution + trace) |
| ↳ Count overlapping relationships without duplicate totals | Supplementary cross-day good task: total=1 own=1 created=1 visible=0; dedup at commitTaskRows plus TF distinct-ID counts | Supported (execution + trace) |
| ↳ Recompute counts after all filters | Supplementary four-filter counts; TF counts invariant through every sort and paging; source computes before page slicing | Supported (execution + trace) |
| ↳ Separate pending completion done and overdue | TF pure pending/done/all-day dueAt checks and live due-soon browser fixture; completed excluded from overdue | Supported (execution + trace) |
| **Task table refresh and account isolation** | `潘多拉-api.js:22-33,223-285`; `潘多拉-任务表单.js:409-478,530-584`; TF failure/retry/revocation/races; navigation reproduction | FAIL — V-001 (main-navigation re-entry misses refresh) |
| ↳ Apply effective assignee changes | TF approved owner removal leaves calendar but remains created; month/week/day common viewTasks/dayTasks projection traced; effective-only pending owner semantics traced | Supported (execution + trace) |
| ↳ Revoke all normal access | TF actual employee owner removal, normal row/count exclusion, old detail 404/discard, historical notification readonly without upsert; NOT historical readonly | Supported (execution + trace) |
| ↳ Fail a later page and retry | TF offset=100 failure masks rows/counts, no partial commit, retry succeeds; distinct no-task/no-match states and clear filter controls | Supported (execution + trace) |
| ↳ Ignore stale account and refresh responses | TF slower earlier refresh and logout during in-flight task read; epoch/shared sequence/reset traced. New-account-before-response and forced-expiry variants not separately injected | Supported with stated execution limits |
| **Five-page navigation** | `潘多拉-交互原型.js:2420`; table dispatch `潘多拉-任务表单.js:567-584`; TF/CAL/CH11/ACCOUNT real identities and five nav buttons | Supported navigation shape; V-001 affects freshness |
| ↳ Navigate with an authenticated identity | TF/CAL/CH11/ACCOUNT authenticated navigation; actual five buttons; NOT opens review without a sixth tab; setPage does not change identity | Supported (execution + trace) |
| ↳ Navigate across the prototype | Same authenticated navigation evidence as preceding scenario (identical acceptance text) | Supported (execution + trace) |
| ↳ Enter the task table as a secondary view | TF/CAL entry, original detail, close, calendar context return; table dispatch remains page-view with five tabs | Supported (execution + trace) |
| **Calendar task views** | `潘多拉-日程视图.js:14-20,37-353`; CAL and TF own-only matrix; global TASKS/visibleTasks scope retained | Supported |
| ↳ Use the required calendar entry points | CAL actual panel/modes/date selector/table/my-applications/create controls; toolbar/panel/year-month/date-confirm handler and default state inspected; alias text shares this contract | Supported (execution + trace) |
| ↳ Read a month and open a complete day list | CAL fixed cells, <=5 capacity/direct clipping/actual hidden count/full day list; monthWeek/monthHTML and shared own-only dayTasks inspection | Supported (execution + trace) |
| ↳ Pin only one's own ordering | CAL browser pin persistence/toggle and sort; HTTP private pin for second user; month/day comparator uses pinned then actual start/ID; timedEvents positions independent | Supported (execution + trace) |
| ↳ Split a timed cross day task | CAL timed cross-day slices, midnight and zero-duration cases; timedEvents clipping inspected | Supported (execution + trace) |
| ↳ Display every overlapping and all day task | CAL four clickable overlapping columns, separate all-day rows, full-height scrollable axis; groupsFor/weekSpans/dayAll inspection | Supported (execution + trace) |
| ↳ Switch a whole week while preserving weekday | CAL horizontal whole-week swipe/weekday preservation, vertical no-switch and task-detail click isolation; schedule actions inspected | Supported (execution + trace) |
| ↳ Count mutually exclusive relationships | TF month/week/day effective-own matrix and hidden count; CAL no search/count UI; viewTasks only filters assignees, TASKS stays complete; unpublished/history excluded by task source | Supported (execution + trace) |
| ↳ Open the default month view | CAL actual panel/modes/date selector/table/my-applications/create controls; toolbar/panel/year-month/date-confirm handler and default state inspected; alias text shares this contract | Supported (execution + trace) |
| ↳ Select a year and month | CAL actual panel/modes/date selector/table/my-applications/create controls; toolbar/panel/year-month/date-confirm handler and default state inspected; alias text shares this contract | Supported (execution + trace) |
| ↳ Drill from month to week | CAL overflow/day list plus month cell schedule-day-list and task-button propagation handlers inspected; V3 day-list behavior replaces old drill-down | Supported (execution + trace) |
| ↳ Ignore blank month task space | CAL overflow/day list plus month cell schedule-day-list and task-button propagation handlers inspected; V3 day-list behavior replaces old drill-down | Supported (execution + trace) |
| ↳ Drill from week to day | weekHTML date-heading schedule-open-day and day handler inspected; CAL task-click/date isolation. Separate week-header click not independently asserted | Supported with stated execution limits |
| ↳ Ignore blank week task space | CAL vertical gesture no-switch; week blank area has no task/navigation action; delegated click and swipe guards inspected | Supported (execution + trace) |
| ↳ Switch time granularity | CAL actual panel/modes/date selector/table/my-applications/create controls; toolbar/panel/year-month/date-confirm handler and default state inspected; alias text shares this contract | Supported (execution + trace) |
| ↳ Keep task clicks distinct from drill-down | CAL horizontal whole-week swipe/weekday preservation, vertical no-switch and task-detail click isolation; schedule actions inspected | Supported (execution + trace) |
| ↳ Navigate and return from a week | CAL horizontal whole-week swipe/weekday preservation, vertical no-switch and task-detail click isolation; schedule actions inspected | Supported (execution + trace) |
| ↳ Navigate and return from a day | CAL horizontal whole-week swipe/weekday preservation, vertical no-switch and task-detail click isolation; schedule actions inspected | Supported (execution + trace) |
| ↳ Render a spanning task bar | CAL timed cross-day slices, midnight and zero-duration cases; timedEvents clipping inspected | Supported (execution + trace) |
| ↳ Render an all-day task | CAL four clickable overlapping columns, separate all-day rows, full-height scrollable axis; groupsFor/weekSpans/dayAll inspection | Supported (execution + trace) |
| ↳ Distinguish visible tasks | CAL non-color relation badges; stable low-saturation palette and task color mapping inspected; screenshot review | Supported (execution + trace) |
| ↳ Identify the current user's task relationship | TF month/week/day effective-own matrix and hidden count; CAL no search/count UI; viewTasks only filters assignees, TASKS stays complete; unpublished/history excluded by task source | Supported (execution + trace) |
| ↳ Show only task names in bars | CAL clipped titles and click-to-original-detail; bar/event HTML inspected for title/relation markers and no description/progress | Supported (execution + trace) |
| ↳ Order visible task lanes | CAL browser pin persistence/toggle and sort; HTTP private pin for second user; month/day comparator uses pinned then actual start/ID; timedEvents positions independent | Supported (execution + trace) |
| ↳ Fill five monthly task rows | CAL fixed cells, <=5 capacity/direct clipping/actual hidden count/full day list; monthWeek/monthHTML and shared own-only dayTasks inspection | Supported (execution + trace) |
| ↳ Handle crowded time slots | CAL fixed cells, <=5 capacity/direct clipping/actual hidden count/full day list; monthWeek/monthHTML and shared own-only dayTasks inspection | Supported (execution + trace) |
| ↳ Open overflow tasks for one date | CAL fixed cells, <=5 capacity/direct clipping/actual hidden count/full day list; monthWeek/monthHTML and shared own-only dayTasks inspection | Supported (execution + trace) |
| ↳ Preserve calendar navigation after table return | CAL table return restores mode/anchor; off-today shortcut; date picker/create/my-applications preserved; TF own-only hidden counts; fitSchedule exits in table mode | Supported (execution + trace) |
| **Strict prototype scope** | Packaged services, authenticated TF/CAL/ACCOUNT/ORG/NOT/LOG, current V3/status/proposal, index redirect and script chain | Supported; declared push/real-device exclusions remain deferred |
| ↳ Validate the real service and declared scope | Fresh packaged Java service/isolated MySQL, actual authentication, persisted HTTP actions, worker-driven notifications; V3/status deferrals inspected | Supported (execution + trace) |
| ↳ Inspect available actions | Same real-service evidence plus current documentation/scope and action tracing; no deferred push/real-device PASS claim | Supported (execution + trace) |
| ↳ Open the split static prototype | index.html HTTP redirect and runtime login gate inspected; all acceptance executions used packaged HTTP service, never file-open demo data | Supported (execution + trace) |
| **Organization and administration** | `admin.html`, OrganizationService/OrganizationConstraints/Access; ORG/ACCOUNT/PHONE/CH11; TF admin prompt | Supported via HTTP + browser + inspection |
| ↳ Maintain an employee through the administrator interface | ORG creates/persists employee and rejects missing department/position, second admin, cycles; ACCOUNT first login; CH11 PC admin dialog. Not every form submit separately driven in browser | Supported with stated execution limits |
| ↳ Maintain teams independently of departments | ORG two independent teams, lead transfer/persistence and no added dispatch authority; OrganizationService/Access trace | Supported (execution + trace) |
| ↳ Transfer updates independent scopes | ORG authorization-version change, previous dispatch idempotency refusal and task/candidate/log scope recalculation; PHONE old/new management-chain reauthorization | Supported (execution + trace) |
| ↳ Maintain and reorder company information | ORG CRUD/order/concurrent ten-item cap/business 403; home read-only rendering and company query inspected | Supported (execution + trace) |
| ↳ Use the independent PC administration interface | CH11 PC admin seven tabs/dialog; ORG/ACCOUNT admin APIs and persistence; TF prompt points to /admin.html, employee app lacks admin module. Full handover/history/notification browser workflows inspected, not all separately submitted | Supported with stated execution limits |

Additional promised work: tasks 1.1–1.3 are covered by `/me` tests/TF and loader/session inspection; 2.1–2.7 by TF and supplementary probes except V-001; 3.1–3.4 by CAL/TF/shared projection inspection; 4.1–4.5 by package plus HTTP assets/browser/PHONE/ACCOUNT/ORG/CH11/LOG/NOT; 5.1–5.4 by current isolated scripts, updated calendar assertions, V3/status delivery docs and this handoff review. The design constraints of no new dependency/schema/storage, complete authorized TASKS, effective data only, company timezone, 50-row pages, no sixth nav and no direct cell editing were checked against the committed diff and loaded source. Existing privacy and account behavior is covered by the named regressions. No planning contradiction requiring a new product decision was found.

## Findings

### V-001: Returning from another main page reuses the task table without refreshing authorization

- Category: implementation
- Severity: medium
- Requirement: delta **Task table refresh and account isolation**, first paragraph: entering the table must retrieve current authorized normal tasks; **Authorized task table page** limits rows/search/counts to current normal access. Design decisions 2 and 5 combine retained conditions across main pages with entry re-query. Tasks 2.7/3.3 claim this behavior.
- Evidence: `潘多拉-交互原型.js:2420` `setPage` only changes `state.page` and renders. `潘多拉-任务表单.js:567` dispatches `state.viewPage === 'table'` directly to rendering; the render wrapper at line 574 only changes classes. A complete query is triggered by `openTable` at line 429, manual refresh, lifecycle listeners and successful reloads, but none is triggered by main-navigation return. No session/lifecycle event fires for an in-document tab change.
- Expected: when the user returns to the retained table through the View tab, preserve filters/sort/usable page/scroll while re-querying the full current authorized task set, showing loading/error states and recomputing rows/counts from the completed result.
- Actual: current rows and counts remain visible without any query; changes made by another client while the user was on Logs are not discovered at this entry point. Ordinary detail still rechecks backend permission, so this is a list/search/count freshness failure, not evidence of a backend authorization bypass.
- Repair guidance: make the transition from another main page into the retained task table invoke its normal complete refresh while preserving table state. Avoid querying on every internal render, sort, paint or ResizeObserver callback; preserve existing request/session race guards and loading/error masking.
- Acceptance checks: authenticate on an isolated service; enter table and set filters/page; go to Logs; change the authorized task response (or actually revoke a fixture's access externally); return using View. Assert a new complete `/tasks` load, loading masks old rows/counts, removed tasks disappear, retained conditions/page remain usable, and failures show retry. Repeat with slow older queries and account reset. Rerun TF, CAL and backend package/tests.
- Repair status: addressed-awaiting-verification
- Repair notes: `潘多拉-任务表单.js` now wraps `setPage`: returning to a retained task table from another main page sets the loading state before the first render, then calls the existing complete `refreshTable`, so old rows/counters are masked and the full authorized set is re-queried; loading/error paints retain scroll memory, and internal renders/sorts/pages/ResizeObserver callbacks do not trigger queries. `backend/scripts/check_task_form.js` gained V-001 checks for (a) successful return with filter/page/scroll retained and 50 rows restored, (b) empty current authorization dropping old rows and clamping the page, (c) failed return showing retry with recovery, plus a navigation-started logout/in-flight-response race. Pre-repair Chrome probe: `requests=0`, retained 15 rows; post-repair: `requests=1`, empty result rows follow the new response. Checks: `mvn -B -ntp -Dmaven.repo.local="$PWD/.runtime/m2" package` (66 tests, BUILD SUCCESS); `CHECK_WORKER=true ./scripts/run_check_isolated.sh node scripts/check_task_form.js --base-url {base} --output ../audit/2026-10-21/task-form-fix/comprehensive.json --screenshot-dir ../audit/2026-10-21/task-form-fix` 85/85; `./scripts/run_check_isolated.sh node scripts/check_home_calendar_browser.js --base-url {base}` 35/35; `node scripts/check_calendar_sort.js` 4/4; `./scripts/run_check_isolated.sh python3 scripts/check_home_calendar.py --base-url {base}` 12/12. All browser/HTTP checks used fresh scratch databases; no planning, spec, task, verdict, or historical-evidence changes.
- Reverification notes: first independent finding; reproduced both by executing the entire source module in a minimal navigation harness and by Chrome on a newly seeded packaged service. Chrome observed `RETURN {"requests":0,"rows":13,"rendered":13,"table":"table"} initialRows 13`; explicit refresh then observed `MANUAL_REFRESH {"requests":1,"rows":0}`. The browser probe replaced only `/tasks?` responses with an empty normal authorization set; it did not mutate backend authorization or user data. The source proves that real external permission changes are likewise not queried on this transition.

Reproduce the decisive browser observation after a real login and opening the table on a scratch service (execute in the browser context; this only changes this page's test fetch):

```javascript
setPage('log');
window.savedFetch = window.fetch;
window.taskGets = 0;
window.fetch = function (input, init) {
  if (String(input).includes('/tasks?')) {
    window.taskGets++;
    return Promise.resolve(new Response(JSON.stringify({
      items: [], total: 0, nextCursor: null
    }), {status: 200, headers: {'Content-Type': 'application/json'}}));
  }
  return window.savedFetch(input, init);
};
setPage('view');
// After settling: taskGets === 0, prior rows and counters are still rendered.
// await window.Pandora.taskForm.refresh();
// Then: taskGets === 1, taskForm.state.rows.length === 0.
// Restore window.fetch = window.savedFetch, or close the disposable browser.
```

Next action: `$openspec-e13-fix-change fix-pandora-client-feedback-gaps`, then independently verify again. Relevant edits invalidate this recorded basis; archive requires a fresh independent PASS.
