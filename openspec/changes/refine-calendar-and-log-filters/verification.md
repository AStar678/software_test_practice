# Implementation Verification

- Change: refine-calendar-and-log-filters
- Schema: spec-driven
- Verdict: FAIL
- Verified revision: 40c472b (implementation worktree clean before this report; `verification.md` added by this run)

## Summary

OpenSpec structure, static checks, direct `file://` loading, role-scoped log finding, compact task encoding, current fixture interactions, responsive geometry, and visual screenshots passed. Of 29 normative scenarios, 28 have sufficient passing evidence. The crowded-month scenario fails for a reproducible valid task arrangement: the interval allocator can place a task segment and that date's `+N` control in the same fifth lane, causing overlap. No repository-owned automated test suite exists, so the browser/CDP matrix and deterministic helper probes are the primary executable evidence.

## Checks

| Command or inspection | Result | Notes |
| --------------------- | ------ | ----- |
| `openspec validate "refine-calendar-and-log-filters" --type change --strict --json --no-interactive` | PASS | Change is structurally valid with no issues. |
| `node --check 潘多拉-交互原型.js` | PASS | JavaScript syntax valid. |
| Inline resource PCRE scan | PASS | No inline application `<style>` or source-less `<script>` remains in the HTML. |
| External-runtime/network source scan | PASS | No HTTP URL, `fetch`, XHR, WebSocket, dynamic import, or module runtime found in the prototype files. |
| Headless Chrome/CDP, direct `file://`, 390x844 mobile viewport | PASS | CSS/JS loaded from adjacent files; media query active; no runtime, log, or resource-loading failures. |
| Month/date helper boundary probe | PASS | 0 tasks -> 0/0; 5 tasks -> 5 direct/0 overflow; 6 tasks -> 4 direct/2 overflow. |
| Month interaction and role/log matrix | PASS | Date/task/blank click separation, overflow detail, month picker, week/day drill-down, role reset, search intersection, unauthorized author query, command sheet, and return-to-top behaved as specified. |
| 3,000 deterministic valid weekly interval layouts | FAIL | Iteration 126 assigned task `f126-1` and `ov:2026-09-16` to lane 4 over the same date. |
| Mobile and desktop geometry/screenshots | PASS | Current seeded month/log views had no overlap or horizontal overflow; date band measured 1.5 task-row heights. |
| Source inspection of implementation commit | PASS WITH FINDING | Confirms authorization-first log filtering and identifies the lane allocator defect documented as V-001. |

## Requirement Coverage

| Requirement / scenario | Evidence | Result |
| ---------------------- | -------- | ------ |
| Calendar task views (overall) | Source trace plus mobile/desktop CDP matrix; V-001 violates crowded layout behavior. | FAIL |
| Open the default month view | Initial `viewMode` is month; CDP rendered 5 complete weeks/35 named date buttons with no horizontal overflow. | PASS |
| Select a year and month | Picker selected January 2026, updated the range label, anchor month, and 35-date grid. | PASS |
| Drill from month to week | First date header moved to week mode with anchor equal to its `data-drill-week`. | PASS |
| Ignore blank month task space | Clicking `.g-weekbody` kept month mode and opened no sheet. | PASS |
| Drill from week to day | A week day hit target moved to day mode with the requested date anchor. | PASS |
| Switch time granularity | Month -> week -> day and upward day -> week -> month transitions were exercised. | PASS |
| Keep task clicks distinct from drill-down | Month task click opened detail, retained month mode, and exposed the full task description. | PASS |
| Navigate and return from a week | Event-source inspection confirms seven-day previous/next movement and return to month; upward transition exercised in CDP. | PASS |
| Navigate and return from a day | CDP observed one-day previous/next movement and return to week. | PASS |
| Render a spanning task bar | Current cross-day bars were continuous across selected dates, clipped at boundaries, and retained complete detail targets. | PASS |
| Distinguish visible tasks | Current month rendered 8 visible task IDs with 8 stable low-saturation colors; relationship meaning remained separate. | PASS |
| Identify the current user's task relationship | Direct helper probes returned assigned/own/other as expected; DOM legend and ARIA names contained all three labels and emoji. | PASS |
| Show only task names in bars | Month/week/day bars contained only `.bar-kind` and `.bar-t`; descriptions remained in ARIA/detail content. | PASS |
| Order visible task lanes | `dateOccurrences` calls the specified stable span/urgency/due sorter before selection; rendered overflow IDs matched that selection. | PASS |
| Fill five monthly task rows | Boundary probe returned five direct tasks and zero overflow; every rendered week had exactly five lanes. | PASS |
| Handle crowded time slots | Deterministic interval fixture placed a visible task and `+N` in the same fifth lane/date. | FAIL |
| Open overflow tasks for one date | Seeded `+2` for 2026-09-15 opened exactly task IDs `t18` and `t3`; selecting one opened its detail. | PASS |
| Log page single-content filtering and scroll return (overall) | Authorization-first source trace and upper/middle/lower CDP matrix. | PASS |
| Enter the log page | Role changes reset to `logs`, false self toggle, and empty author query; upper/middle saw the finding card. | PASS |
| Select pending reviews | Upper review filter became the sole content list and rendered two review items. | PASS |
| Switch between role-specific content filters | Logs/reviews transitions replaced rather than stacked content; shared handler covers all allowed filters. | PASS |
| Invoke a log-page command | “写日志” opened its sheet without changing the `logs` content-filter state. | PASS |
| Toggle own logs | Upper self toggle reduced results to two Wang Hai logs and exposed `aria-pressed=true`. | PASS |
| Restore the visible log scope | Second toggle restored author-query-scoped results; clearing the query restored authorized scope. | PASS |
| Search logs by author | “李敏” returned three Li Min logs and retained input focus; conditions composed by intersection. | PASS |
| Show no matching authors | Middle search for unauthorized Sun Yue returned zero cards and the explicit no-match message. | PASS |
| Keep log finding separate and scoped | Finding card disappeared on reviews; review count/list were unaffected; lower role never displayed it. | PASS |
| Return to the top of log content | Button appeared after scrolling, restored scrollTop 0, and preserved self/query/filter state. | PASS |
| Strict prototype scope (overall) | Static source/resource scan and browser traversal found only scoped author search and local static assets. | PASS |
| Inspect available actions | Main pages, details, overflow, search, review, and command paths were inspected; unauthorized author query returned no records. | PASS |
| Open the split static prototype | Direct `file://` load resolved adjacent CSS/JS, rendered successfully, and made no network requests. | PASS |

## Findings

### V-001: Crowded month segments can overlap in the fifth lane

- Category: implementation
- Severity: medium
- Requirement: `Calendar task views` / `Handle crowded time slots`
- Evidence: `潘多拉-交互原型.js:724` emits segments grouped by task key, so their start positions are not globally ordered after a task is split by overflow. `assignLanes` at `潘多拉-交互原型.js:737` uses only each lane's last end as if segments were start-ordered, then line 742 forcibly falls back to lane 4 when all lanes appear occupied. In the deterministic 2026-09-14 fixture, task `f126-1` spans columns 2-4 in lane 4 while `ov:2026-09-16` also occupies column 2 in lane 4. The collision appeared at iteration 126 of a fixed-seed 3,000-layout probe.
- Expected: Each date has five non-overlapping rows; when crowded, the first four rows show tasks and the fifth row shows an independently operable `+N`.
- Actual: A valid crowded arrangement can place both a task and `+N` in the same fifth row and date, visually obscuring one control and violating the fixed-row capacity model.
- Repair guidance: Make interval allocation independent of key-group emission order, and never silently force an unplaced segment into lane 4. Preserve stable task continuity while guaranteeing that no two segments sharing a date share a lane.
- Acceptance checks: Re-run the fixed 2026-09-14 fixture documented above and assert zero same-lane interval intersections; run at least 3,000 fixed-seed mixed interval/overflow layouts; render the fixture at 390px and confirm all four direct tasks plus `+N` are separately visible and operable.
- Repair status: pending
- Repair notes: None yet.
- Reverification notes: First verification at revision 40c472b; reproducible failure remains.
