# Implementation Verification

- Change: fix-pandora-client-feedback-gaps
- Schema: spec-driven
- Verdict: PASS
- Verified at: 2026-10-21T20:39:02.010403+08:00
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice` (frontend), `/Users/watuji/MyGitDev/software_test_practice/backend` (backend/build/checks)
- Verified revision: `99ed264529657ab1714bb08af2fd7cc3cee758f7`; clean worktree at start. This run changes only this report.

## Summary

Independent focused re-verification **PASS**. V-001 is `verified-resolved`: returning from another main page now starts a complete authorized-task reload, masks retained rows/counts before the first render, preserves conditions and usable position, removes revoked rows, and exposes retry on failure. No actionable findings remain.

The user authorized concentrating on changed work. Git/content comparison with the previous independent run at `24e650a` proves that the only changed acceptance inputs are `潘多拉-任务表单.js` and `backend/scripts/check_task_form.js`; planning artifacts, backend, calendar, account, phone/privacy, logs, notifications, build configuration and other frontend modules are unchanged. Their earlier independent evidence remains applicable. Repair-stage PASS claims and audit files were not substituted for independent checks.

This run independently passed strict OpenSpec validation, Maven package including 66 tests, the updated 85-check task-form HTTP/browser suite, calendar browser 35/35, calendar HTTP 12/12 and calendar sort 4/4. A supplementary execution of the complete task-form module confirmed loading before render, preserved sort/filter/page, and no redundant queries on ordinary repaint or same-tab selection. All eight requirements and 53 scenarios retain the coverage matrix below; affected paths have fresh evidence and unaffected paths explicitly retain the previous independent evidence.

Residual limits remain unchanged: desktop/narrow browser evidence does not establish deferred real-device/keyboard or system-push acceptance. Production-scale performance and cross-request transactional snapshots remain outside scope. Some unchanged calendar/admin variants use code tracing combined with executable HTTP/browser coverage rather than a distinct gesture test for every alias. These limits do not leave an actionable deviation or mandatory behavior without supporting evidence. This PASS applies only to the recorded basis; relevant edits require re-verification.

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| Both implementation roots and repository planning/context | Git HEAD `99ed264529657ab1714bb08af2fd7cc3cee758f7` |
| Source/configuration/test/document/planning inventory | 166 paths; aggregate SHA-256 `eda5aa48d105adceea3bd181003ee4eaa64c008b6ea85e612f84b9c8ab22b82e` |
| Start versus final snapshot | Same 166 paths and same current aggregate hash after all checks; no relevant input changes |
| Prior independent basis, reproduced from Git | `24e650a9acd128c514c8cfaad04a0359948a923a`, 166 paths, SHA-256 `77dd70fdfcd226e39c848431a88d0b7cd7cb40921490ee5a82c91fbf589e504e` |
| Inputs changed since prior basis | Only `潘多拉-任务表单.js` and `backend/scripts/check_task_form.js`; report and added repair audit evidence are excluded by the documented inventory rule |
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

`openspec status` and `instructions apply` resolved repo-local `spec-driven` artifacts and reported 23/23 checked tasks. There is no external store. No applicable AGENTS.md was found in the project or ancestor directories. Checked tasks and apply/repair-stage audit evidence were treated as claims, not independent proof. The previous report is available in Git commit `99ed264`; its 2026-10-21T20:24:31+08:00 independent evidence is retained only for unchanged inputs.

## Apply Handoff Review

Read `implementation-notes.md` in this change. It identifies the correct change and implementation roots. Its `a8b655f + dirty` revision label is stale: the implementation and repair are now committed through `99ed264`; current code was compared with the prior verified `24e650a` basis. The map also names nonexistent `潘多拉-任务集成.js`; the actual loaded file is `潘多拉-任务接入.js`. These are handoff metadata discrepancies, not application defects. The existing FAIL report and V-001 repair notes were read before this run. The repair notes are preserved verbatim below; their claimed results were independently rerun for affected coverage.

Every reminder was reviewed. TF and CAL below now refer to this run; unchanged LOG/NOT/PHONE/ACCOUNT/ORG/CH11 evidence is retained from the previous independent run after verifying input identity:

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
| Detail rechecks backend; 403/404 discards row | Confirmed TF old-detail 404 and row-discard/requery checks, plus `P.request` wrapper and normal detail trace. Main-navigation re-entry now re-queries too (V-001 verified-resolved) |
| Push and real-device deferrals | Confirmed V3/delta/status documentation retains them; not claimed as passed |
| Apply evidence is not an independent verdict | Confirmed: affected checks rerun; unchanged prior independent evidence is explicitly identified and retained |

The handoff predates the repair and its task-form line numbers/count of 82 checks are stale; current module/check script were read. The repaired main-navigation transition, loading/error scroll retention, existing workspace setPage wrapper, load order, refresh sequence guards and reset hooks were traced independently. V-001 is now verified-resolved.

## Checks

Commands run from `backend` unless noted. `ISO` means `CHECK_WORKER=true NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost ./scripts/run_check_isolated.sh`; `{base}` and `{db}` are runner substitutions. The fresh task-form run used `PORT=18131`, calendar runs `PORT=18132`. Every integration run started a fresh packaged Java process after packaging and used its own disposable `pandora_check_*` database. The normal business database was not a fixture. Approved local MySQL/Chrome access was used; loopback proxy bypass was retained from the earlier environment diagnosis. No unresolved environment issue occurred.

| Command or inspection | Result | Notes |
| --- | --- | --- |
| `openspec validate fix-pandora-client-feedback-gaps --type change --strict --json --no-interactive` (root) | PASS, current run | Valid; zero issues |
| `node --check 潘多拉-任务表单.js` and `node --check backend/scripts/check_task_form.js` (root) | PASS, current run | Both changed scripts parse |
| `mvn -B -ntp -Dmaven.repo.local="$PWD/.runtime/m2" package` | PASS, current run | 66 tests, zero failures/errors/skips; BUILD SUCCESS; rebuilt static resources |
| `ISO node scripts/check_task_form.js --base-url {base} --output /tmp/pandora-e13-reverify-task-form.json --screenshot-dir /tmp/pandora-e13-reverify-shots` | PASS 85/85, current run | Entire affected suite rerun; 205 bulk tasks plus matrix; cross-timezone, global sorting/counts, pagination failure, permission/history, detail and session regressions; new return checks described below |
| `ISO node scripts/check_home_calendar_browser.js --base-url {base}` | PASS 35/35, current run | Adjacent calendar/navigation, own-only projection, retained mode/date, overlap/spans/gestures and layouts |
| `ISO python3 scripts/check_home_calendar.py --base-url {base}` | PASS 12/12, current run | Authenticated HTTP calendar/pin/pending behavior |
| `node scripts/check_calendar_sort.js` | PASS 4/4, current run | Time/ID order and personal pins |
| In-memory execution of full current task-form module with minimal DOM/navigation setup | PASS, current run | One initial reload and one return reload; loading set before first render; filter/status-desc sort/page retained; repaint and same-view setPage do not fetch; reset session does not fetch. This supplements the browser run; it does not replace it |
| Reproduce previous inventory from Git; compare all acceptance paths with current Git/worktree | PASS, current run | Reproduced previous 166-path hash; only task-form module and its comprehensive checker changed; no dirty/untracked acceptance inputs |
| CH11 `check_chapter11_browser.js` | RETAINED independent 36/36 at `24e650a`, not rerun | Unchanged logs/AI/admin UI modules, tests, dependencies/configuration; table change only retains loading/error scroll and wraps View re-entry, delegating other main navigation unchanged |
| NOT `check_notification_browser.js` | RETAINED independent 21/21 at `24e650a`, not rerun | Notification/backend/worker inputs unchanged; current TF also rechecks historical readonly exclusion |
| LOG `check_logs_profile_browser.js` | RETAINED independent 22/22 at `24e650a`, not rerun | Log/profile inputs unchanged; current TF drives Logs → View transitions |
| PHONE `check_profile_phone_matrix.py`, `check_phone_cycle.py` | RETAINED independent 26/26 and 5/5 at `24e650a`, not rerun | Privacy service, management authorization, scripts and settings unchanged |
| ACCOUNT `check_account_lifecycle.py`, `check_account_browser.js` | RETAINED independent 47/47 and 15/15 at `24e650a`, not rerun | Authentication/account inputs unchanged; current TF independently checks logout during navigation refresh |
| ORG `check_organization_admin.py` | RETAINED independent 58/58 at `24e650a`, not rerun | Admin/organization/backend and check inputs unchanged |
| Prior supplemental four-filter AND/one-task relation overlap/pin-independence execution | RETAINED independent PASS at `24e650a` | Relevant pure pipeline functions are byte-for-byte unchanged; current TF reruns relation/date/sort/count checks |

Fresh V-001 browser evidence:

- Success: retained page=2, query=`TFbulk`, 240 authorized rows, scroll=160. The first loading observation had zero rendered task rows and loading-only counters. After the three API page requests completed, page=2/query/scroll=160 were retained and 50 rows were rendered.
- Empty current authorization: loading masked rows, one request completed, then rows=0/page=0/query=`TFbulk`, with the no-authorized-tasks empty state.
- Failure/retry: one failed return request showed explicit error, no statistics and retry; retry restored 240 rows, the query and a usable 50-row page.
- Navigation-started logout race: a slow return request was actually started (requests=1); logout cleared rows/filters and returned to login/calendar; its late response did not repopulate state.

The empty/failure responses are deterministic browser fixtures; the same fresh TF suite separately performs real backend permission removal, old-detail denial and historical-readonly tests. Test assertions were inspected rather than trusting their labels. No code/test/planning/handoff file was edited by verification.

Current-run evidence: `/tmp/pandora-e13-reverify-maven.log`, `/tmp/pandora-e13-reverify-task-form.log`, `/tmp/pandora-e13-reverify-task-form.json`, `/tmp/pandora-e13-reverify-shots/`, `/tmp/pandora-e13-reverify-calendar-browser.log`, `/tmp/pandora-e13-reverify-calendar-http.log`. Temporary evidence may later be cleaned; decisive outputs and dispositions are recorded here. Previous independent results and commands remain recoverable from this report at Git `99ed264`; repair audit files were not overwritten or treated as independent evidence.

## Requirement Coverage

Evidence abbreviations: **TF** = current 85-check task-form run; **CAL** = current calendar browser 35 + calendar HTTP 12 + calendar sort 4; **CH11** = retained independent chapter11 36; **LOG** = retained logs/profile 22; **NOT** = retained notifications 21; **PHONE** = retained matrix 26 + cycle 5; **ACCOUNT** = retained lifecycle 47 + browser 15; **ORG** = retained organization/admin HTTP 58. “Retained” always means the earlier independent run at the proven unchanged `24e650a` basis, not an apply/repair claim. “Supported” combines this executable evidence with the recorded code trace. The supplemental pure-pipeline probes are also retained for unchanged function bodies.

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
| **Task table refresh and account isolation** | `潘多拉-api.js:22-33,223-285`; `潘多拉-任务表单.js:409-478,530-584`; TF failure/retry/revocation/races; navigation reproduction | Supported — V-001 verified-resolved; fresh return/masking/empty/error/retry/race checks |
| ↳ Apply effective assignee changes | TF approved owner removal leaves calendar but remains created; month/week/day common viewTasks/dayTasks projection traced; effective-only pending owner semantics traced | Supported (execution + trace) |
| ↳ Revoke all normal access | TF actual employee owner removal, normal row/count exclusion, old detail 404/discard, historical notification readonly without upsert; NOT historical readonly | Supported (execution + trace) |
| ↳ Fail a later page and retry | TF offset=100 failure masks rows/counts, no partial commit, retry succeeds; distinct no-task/no-match states and clear filter controls | Supported (execution + trace) |
| ↳ Ignore stale account and refresh responses | TF slower earlier refresh and logout during in-flight task read; epoch/shared sequence/reset traced. New-account-before-response and forced-expiry variants not separately injected | Supported with stated execution limits |
| **Five-page navigation** | `潘多拉-交互原型.js:2420`; table dispatch `潘多拉-任务表单.js:567-584`; TF/CAL/CH11/ACCOUNT real identities and five nav buttons | Supported — fresh main-navigation re-entry checks and retained unaffected identity coverage |
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

Additional promised work: tasks 1.1–1.3 are covered by `/me` tests/TF and loader/session inspection; 2.1–2.7 by TF and supplementary probes, including newly verified V-001 return behavior; 3.1–3.4 by CAL/TF/shared projection inspection; 4.1–4.5 by fresh package/TF plus retained unaffected HTTP assets/browser/PHONE/ACCOUNT/ORG/CH11/LOG/NOT; 5.1–5.4 by isolated scripts with fresh affected checks and retained unchanged regressions, updated calendar assertions, V3/status delivery docs and this handoff review. The design constraints of no new dependency/schema/storage, complete authorized TASKS, effective data only, company timezone, 50-row pages, no sixth nav and no direct cell editing were checked against the committed diff and loaded source. Existing privacy and account behavior is covered by the named regressions. No planning contradiction requiring a new product decision was found.

## Findings

### V-001: Returning from another main page reuses the task table without refreshing authorization

- Category: implementation
- Severity: medium
- Requirement: delta **Task table refresh and account isolation**, first paragraph: entering the table must retrieve current authorized normal tasks; **Authorized task table page** limits rows/search/counts to current normal access. Design decisions 2 and 5 combine retained conditions across main pages with entry re-query. Tasks 2.7/3.3 claim this behavior.
- Evidence (original defect at `24e650a`): `潘多拉-交互原型.js:2420` `setPage` only changes `state.page` and renders. `潘多拉-任务表单.js:567` dispatches `state.viewPage === 'table'` directly to rendering; the render wrapper at line 574 only changes classes. A complete query is triggered by `openTable` at line 429, manual refresh, lifecycle listeners and successful reloads, but none is triggered by main-navigation return. No session/lifecycle event fires for an in-document tab change.
- Expected: when the user returns to the retained table through the View tab, preserve filters/sort/usable page/scroll while re-querying the full current authorized task set, showing loading/error states and recomputing rows/counts from the completed result.
- Actual (original defect at `24e650a`): current rows and counts remain visible without any query; changes made by another client while the user was on Logs are not discovered at this entry point. Ordinary detail still rechecks backend permission, so this is a list/search/count freshness failure, not evidence of a backend authorization bypass.
- Repair guidance: make the transition from another main page into the retained task table invoke its normal complete refresh while preserving table state. Avoid querying on every internal render, sort, paint or ResizeObserver callback; preserve existing request/session race guards and loading/error masking.
- Acceptance checks: authenticate on an isolated service; enter table and set filters/page; go to Logs; change the authorized task response (or actually revoke a fixture's access externally); return using View. Assert a new complete `/tasks` load, loading masks old rows/counts, removed tasks disappear, retained conditions/page remain usable, and failures show retry. Repeat with slow older queries and account reset. Rerun TF, CAL and backend package/tests.
- Repair status: verified-resolved
- Repair notes: `潘多拉-任务表单.js` now wraps `setPage`: returning to a retained task table from another main page sets the loading state before the first render, then calls the existing complete `refreshTable`, so old rows/counters are masked and the full authorized set is re-queried; loading/error paints retain scroll memory, and internal renders/sorts/pages/ResizeObserver callbacks do not trigger queries. `backend/scripts/check_task_form.js` gained V-001 checks for (a) successful return with filter/page/scroll retained and 50 rows restored, (b) empty current authorization dropping old rows and clamping the page, (c) failed return showing retry with recovery, plus a navigation-started logout/in-flight-response race. Pre-repair Chrome probe: `requests=0`, retained 15 rows; post-repair: `requests=1`, empty result rows follow the new response. Checks: `mvn -B -ntp -Dmaven.repo.local="$PWD/.runtime/m2" package` (66 tests, BUILD SUCCESS); `CHECK_WORKER=true ./scripts/run_check_isolated.sh node scripts/check_task_form.js --base-url {base} --output ../audit/2026-10-21/task-form-fix/comprehensive.json --screenshot-dir ../audit/2026-10-21/task-form-fix` 85/85; `./scripts/run_check_isolated.sh node scripts/check_home_calendar_browser.js --base-url {base}` 35/35; `node scripts/check_calendar_sort.js` 4/4; `./scripts/run_check_isolated.sh python3 scripts/check_home_calendar.py --base-url {base}` 12/12. All browser/HTTP checks used fresh scratch databases; no planning, spec, task, verdict, or historical-evidence changes.
- Reverification notes: independently rechecked at `99ed264` in the focused run described above. The wrapper at `潘多拉-任务表单.js:590` sets loading before delegating the first render and then calls complete refresh; loading/error paint retains scroll at lines 352/360. Fresh Chrome success: 3 page requests, 240 rows, page=2, query=TFbulk, scroll=160, 50 rendered rows. During loading: 0 rows rendered and counters masked. Empty authorization: 1 request, 0 rows, page clamped to 0, query retained. Failure/retry and logout during return refresh passed. Full affected TF 85/85, CAL 35/35 + HTTP 12/12 + sort 4/4 and package/tests 66/66 passed. Supplemental full-module execution established no reload on repaint/same-tab selection and retained sort. No new findings; V-001 is verified-resolved.

Original reproduction, retained for regression use after a real login and opening the table on a scratch service (only this page's fetch changes; the expected result below is updated for the repair):

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
// Immediately: loading masks prior rows and counters.
// After settling: taskGets === 1, taskForm.state.rows.length === 0.
// Before the repair: taskGets stayed 0 and prior rows remained rendered.
// Restore window.fetch = window.savedFetch, or close the disposable browser.
```

Next action: `$openspec-e13-archive-change fix-pandora-client-feedback-gaps`. Independent verification passed for the recorded basis; relevant edits require re-verification before archive.
