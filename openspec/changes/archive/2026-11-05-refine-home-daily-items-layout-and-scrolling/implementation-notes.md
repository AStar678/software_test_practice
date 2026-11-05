# Implementation Notes

- Change: refine-home-daily-items-layout-and-scrolling
- Schema: spec-driven
- Store: local (nearest `openspec/` root, no `--store`)
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice` (employee web assets at the repository root; suites and packaged resources under `backend/`)
- Updated: 2026-11-05T15:06+08:00
- Implementation revision: `5998c3d` with a dirty worktree (modified: `潘多拉-每日事项.js`, `潘多拉-每日事项.css`, `潘多拉-交互原型.html`, `backend/scripts/check_daily_items.py`, `backend/scripts/check_daily_items_browser.js`, `backend/scripts/check_daily_items_repairs_browser.js`, `backend/scripts/check_fixed_employee_browser.js`, `backend/docs/current-checks.md`, this `tasks.md`; new: `backend/scripts/check_daily_items_refresh_browser.js`, `audit/refine-home-daily-items-layout-and-scrolling/`; shared-suite audit logs under `audit/refactor-pandora-organization-and-workflows/` are rewritten by their own suites).
- Progress: 18/18 tasks complete; handoff for independent verification (no verification verdict is claimed here).

## Implementation Map

| Task / requirement / scenario | Code and tests | Decisions / context |
| ----------------------------- | -------------- | ------------------- |
| 1.1 refreshed session + direct gesture without a month tool | `backend/scripts/check_daily_items_refresh_browser.js`, wired at the start of `check_daily_items_browser.js`; evidence `audit/refine-home-daily-items-layout-and-scrolling/refresh-before-fix.json` (pre-change jar) and `refresh-after-reload.json` (this run) | Uses `Page.reload` with the session kept in `sessionStorage`, then a real `Input.synthesizeScrollGesture` (touch source) left and right before touching any month control; no synthetic `scroll` events |
| Home layout: three complete single-line rows per upper card | `潘多拉-每日事项.css` (`grid-template-rows:minmax(188px,236px)`, `.company-quad/.tasks-quad{max-height:none}`); layout loop in `check_daily_items_browser.js`; `layout-*.json` | 44px row + 6px gap + 22px head + 18px card padding = 184px for three rows; the measured card is 236px, so three rows are fully visible and the fourth is visibly clipped (scroll affordance). Short screens scroll the page; 44px cells are never compressed |
| Compact single-row header, no subtitle / floating button / 52px gap | `calendarHTML()` and `.daily-head` in `潘多拉-每日事项.js` / `.css` | `#dailyAnchorLabel` and `.daily-fab` deleted; `.daily-body` padding-bottom removed; the add control reuses `data-action="daily-new"` and is placed between the title and `.daily-tools` |
| Mint glass add control shaped like the month tools | `.daily-head .btn.daily-add` (specificity over `.btn.tiny-btn` in `潘多拉-正式版.css`), `:hover`, `:focus-visible` in `潘多拉-每日事项.css` | Fill is `rgba(150,211,180,.5)` plus a white gradient highlight (never white); radius/min-height match the月 tools; screenshots `daily-header-390.png`, `daily-header-320.png`, `daily-header-created.png` |
| Independent month blocks, blanks instead of neighbouring dates | `monthBlock()`, `blockHTML()`, `gapHTML()` in `潘多拉-每日事项.js`; `.daily-gap` in the CSS | Each month owns the weeks of its 1st..last day; other positions are `span.daily-gap[aria-hidden]` (no `data-daily-date`, no tab stop). `block.from/to` are now the month's own 1st/last |
| Month heading above the 1st's own column | `.daily-month-head`/`.daily-month-label` (nowrap, `overflow:visible`) | Because a block starts at the 1st's week, the heading left edge equals the 1st's column; asserted per mounted month at every viewport and for 2024-02/2021-02/2026-06/2026-11 |
| Month-range summaries, ownership and invalidation | `block.from/to`, `blockContaining()`, `invalidateDate()`, `loadBlock()` | Summary requests are the month range (≤31 days, inside the API's 93-day limit); the sparse-zero and error/retry semantics are unchanged |
| Anchor independent of the removed subtitle | `setAnchorFromScroll()`, `stepMonth()`, `jumpToMonth()` | `S.anchor` is derived from the leftmost mounted month block; 上一月/下一月 step from that browsing month |
| Unified range padding on first render, refresh, jump, locate/today and resize | `layoutCalendar()`, `ensureMonth()`, `padWindow()`, `revealDate()`, `syncScroll()`, `goToDate()`, `scrollToDate()` | One viewport of real months is kept on each side of the anchor month, so the very first gesture can move both ways; the 12-month cap still bounds DOM and summary work |
| Bounded window, pixel compensation, restore and cleanup | `extend()` (prepend/trim compensation + `S.summaries.delete`), `layoutCalendar({date, offset})`, `S.layoutWidth`, `observeSize()`, `scheduleLayout()`, `clearSession()`, `closeSheet()` | A resize clamps `scrollLeft` before padding exists; the transient scroll event must not overwrite the anchor. Only a scroll at the width the anchor was measured at may replace it (`S.layoutWidth`); otherwise the layout is re-scheduled with the saved date+pixel offset. Timers/observer are cleared on session reset |
| Single total-based marker, colour from open state | `markWidth(total)`, `marksHTML()` | `total = open + completed`; 0 draws nothing; width `4+(min(total,5)-1)*3`; blue while any item is open, grey only when all are done. Completion round trips keep the width |
| Acceptance updates | `check_daily_items_browser.js`, `check_daily_items_repairs_browser.js`, `check_fixed_employee_browser.js`, `check_daily_items.py` seeding | Replaced the old two-segment marker, floating add, subtitle-month, shared-week and wide-screen-no-scroll expectations; the repairs suite now reads the block's own heading and asserts per-month continuity instead of a single continuous date run |

## Checks Run

| Command | Working directory / setup | Result / evidence | Run time or revision |
| ------- | ------------------------- | ----------------- | -------------------- |
| `python3 backend/scripts/check_daily_items.py` | repo root; disposable MySQL databases + temporary services (ports 18193/18194) + headless Chrome | exit 0; **73/73 API checks** in `audit/refine-home-daily-items-layout-and-scrolling/daily-items-run.json`, **249/249 browser checks** in `.../daily-items-browser.json`, plus screenshots and `layout-*.json` / `refresh-*.json` | 2026-11-05 15:00 (this run) |
| `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test` | `backend/` | 111 tests, 0 failures, BUILD SUCCESS | 2026-11-05 14:52 |
| `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package` | `backend/` | BUILD SUCCESS; `target/pandora-backend-0.1.0.jar` repackaged with the current web assets | 2026-11-05 14:5x |
| `python3 scripts/check_web_resources.py --repo .. --jar target/pandora-backend-0.1.0.jar --output ../audit/refine-home-daily-items-layout-and-scrolling/web-resources.json` | `backend/` | 15/15, including "every cache-busting version equals the current file hash" and "packaged resources are byte-identical to the sources"; `.../web-resources.json` | 2026-11-05 14:52 |
| `node --check 潘多拉-每日事项.js` and every touched `backend/scripts/*.js`; `git diff --check` | repo root | all clean | 2026-11-05 15:05 |
| `python3 backend/scripts/check_fixed_web.py` | repo root; disposable service + Chrome | exit 0, 181 PASS, includes "dashboard priority and three modules at 320/390/1440" and the updated "home retires the personal/log cards and exposes the independent daily calendar with its header add control"; log `.../fixed-web.log` (its own screenshots/reports remain in `audit/refactor-pandora-organization-and-workflows/`) | 2026-11-05 15:02 |
| `python3 backend/scripts/check_calendar_drawer.py` | repo root; disposable service + Chrome | exit 0, 102 PASS, incl. "month augmentation stays stable at 320/1440"; log `.../calendar-drawer.log` | 2026-11-05 15:04 |
| Pre-change regression run of the new entry against the unchanged jar | repo root | Failed as intended at 1440×900: `clientWidth 1052 == scrollWidth 1052`, `maxLeft 0`, both gestures left `scrollLeft` at 0 (`refresh-before-fix.json`). Honest limitation: in that pre-fix run the 390×600 gesture also reported no movement because the calendar was below the fold and the harness did not scroll it into view; that row is a measurement artifact, not the defect. The 320/390 rows already had a scroll range before the change | 2026-11-05 14:33 |

### Refresh defect: cause and fix

Two distinct causes were established with evidence rather than inference:

1. **Static three months.** The initial window was a fixed previous/current/next month set, and only a `scroll` event could extend it. On a wide screen the three blocks (about 1000px) did not exceed the viewport (1052px), so `scrollWidth == clientWidth` and no scroll event could ever fire — the calendar was not scrollable at all. The regression entry records exactly that pre-fix state at 1440×900.
2. **Anchor lost across a resize (found while verifying this change).** After padding was introduced, a 390→1440 viewport change clamped `scrollLeft` before the new months existed; the resulting scroll event ran `anchorFromDom` and replaced the saved anchor date (e.g. 2026-11-16 → 2026-10-01), so the position was "restored" to the wrong date. Fixed with `S.layoutWidth`: `anchorFromDom` only updates the anchor while the scroller keeps the width it was measured at, and `onScroll` re-schedules the layout instead. Re-verified: the anchor date survives 390→1440 (`refresh-after-reload.json`, `layout-*.json`).

## Verification Reminders

- The wide-screen view mounts about 11 months and the window cap is 12; long-distance browsing trims old blocks and drops their summaries (`S.summaries.delete`), so revisiting a trimmed month re-fetches it. Check that this never shows a false zero while loading.
- `.daily-add` wins over `.btn.tiny-btn{min-height:44px}` only because of the `.daily-head .btn.daily-add` selector in `潘多拉-每日事项.css`. Changing that selector or the `潘多拉-正式版.css` tiny-button rule would silently alter the header height and the three-row budget.
- Month labels intentionally use `overflow:visible` so they are never truncated; overlap is prevented only by a block being wider than its label. The suite asserts label width ≤ block width for mounted months, but not for an extreme font-scale scenario.
- The anchor guard relies on `S.layoutWidth`; an animation or transform that changes the scroller's effective width without a ResizeObserver notification would not be handled.
- `check_daily_items_repairs_browser.js` V-001/V-003 now read `.daily-month-label`; any test still looking for `#dailyAnchorLabel` will fail (the element no longer exists by design).
- The short-screen (390×600) reachability and gesture checks must scroll the page with `scrollTo({behavior:'instant'})` and then wait; assigning `scrollTop` alone leaves the rects stale because page scrolling is animated.
- Real input verification uses `Input.synthesizeScrollGesture` plus a mouse-drag isolation check; the calendar's own scroll listener is never triggered with a hand-made `scroll` event in the new entry.
- Deliberately unchanged: daily-item storage, API, versioning/paging algorithms, the company-page task calendar, and the mint/paper theme tokens. `backend/docs/current-checks.md` was updated to describe the new coverage.
- Shared-file coordination: the deferred change `refine-notifications-task-editing-and-staff-browsing` touches the same home area (`潘多拉-交互原型.html` fingerprints, `check_fixed_employee_browser.js`, home CSS). Any merge must keep this change's home contract (single-row header with the glass add control, independent month blocks, single total marker).
- The suite writes its own logs/screenshots into `audit/refactor-pandora-organization-and-workflows/`, which are tracked files; those diffs are produced by running the shared suites, not by hand edits.
