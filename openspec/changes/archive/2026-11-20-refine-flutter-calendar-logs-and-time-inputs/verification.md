# Implementation Verification

- Change: `refine-flutter-calendar-logs-and-time-inputs`
- Schema: `spec-driven`
- Verdict: PASS
- Verified at: `2026-11-20T09:31:20+08:00`
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice/flutter`
- Verified revision: `a80faee8c94436d0d3bcfc355f5c05fffadac8c3` with uncommitted Flutter implementation and tests, plus the local OpenSpec change.

## Summary

Independent re-verification resolved V-001, V-002, and V-003. Strict OpenSpec validation, 23 focused tests, 262 non-integration regression tests (including those 23), and Flutter analysis passed. No actionable findings remain in scope. Actual devices and the externally mutating real-backend suite were not run; the combined edge cases noted below were covered through constituent tests and code inspection, not as single end-to-end gestures or responses.

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| Repository and planning root: `/Users/watuji/MyGitDev/software_test_practice` | 3,736 Git-tracked or non-ignored files; includes `flutter/` sources, tests, manifests and the selected change metadata and planning artifacts. |
| `proposal.md`, `design.md`, `tasks.md`, `specs/pandora-requirements-aligned-prototype/spec.md` | All apply context files reviewed and unchanged since the prior independent verification. `tasks.md` checkmarks are not evidence. |

Incremental review against the preceding report: the prior state SHA-256 matched `a5bd065b2af9c52e4ccaba67a341f8e7f05219edca39914aae94837eb9c0911a`. The script's `compare <prior> <before>` returned exit 1 with only `task_calendar_page.dart` and the three focused test files modified; there were no added or deleted inputs. Scope therefore concentrated on the three repairs and shared calendar interactions. Unchanged static scope, authorization and field behavior evidence was retained; all non-integration Flutter tests were rerun, not carried over from the repair session. Before/after inventories were generated with `python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture --root /Users/watuji/MyGitDev/software_test_practice --output <temporary-json>` and `compare <before> <after>` returned exit 0, `changed: false`. Implementation and planning share one Git root; no custom exclusions. Git ignores generated dependencies and caches; the script excludes Git metadata and workflow handoff/report/state files. Current `verification-state.json` SHA-256: `9557f72f0b936e45f3113c5bc02078fde8451e788bd71fbd9ffdfcee3bc034b2`.

## Apply Handoff Review

`implementation-notes.md` names this change, the Flutter root and the verified commit. It describes the initial implementation, not the later repair; the repair notes in this report were treated as leads, not independent evidence.

| Reminder | Disposition |
| --- | --- |
| Narrow device, text scale, overflow and return focus | Confirmed in the rerun 320×450 / 1.25× widget fixture including Sunday overflow, Escape-to-trigger focus and personal creation without overlap; also reran month-date Close-to-trigger focus. No native device run. |
| Cross-year continuation, edge scrolling and quick release/cancel | Reran same-pointer continuation, pre-layout release, cancellation, background interruption, adjacent-month edge-scroll/placeholder fixtures, and cross-year date arithmetic. The interaction and boundary arithmetic pass separately; a single year-boundary gesture combining edge scrolling and handoff remains a residual check. V-001 was reverified. |
| Late responses, person/account changes, and retry after a partial boundary-week failure | Direct-day loading/503/retry independently exercised for self and subordinate with request assignee assertions; person state reset exercised. `_loadMonth` checks epoch, generation and assignee before publishing data; `_buildExpandedWeek` suppresses bars while either required month is missing or errored and `_loadWeek` retries missing/failed months. No combined delayed account-switch or one-half-week-failure widget fixture was run. |

## Checks

| Command or inspection | Result | Notes |
| --- | --- | --- |
| `openspec validate refine-flutter-calendar-logs-and-time-inputs --type change --strict --json --no-interactive` | PASS | `valid: true`, no issues. |
| `flutter test --no-pub test/features/task_calendar_drag_ui_test.dart test/features/calendar_week_expansion_test.dart test/features/calendar_day_entrance_test.dart --reporter expanded` | PASS | 23 tests. Initial sandboxed invocation could not write the Homebrew SDK cache; approved rerun completed. |
| `flutter test --no-pub test/core test/features test/widget_test.dart --reporter expanded` | PASS | 262 tests; local mocks, no real-backend test directory. |
| `flutter analyze --no-pub` | PASS | No issues found. |
| `git diff --check`; `git status --short --untracked-files=all` | PASS | No whitespace errors in tracked diffs. Application/test changes are in `flutter/`; no Web or backend implementation changes. |

## Requirement Coverage

Scenario names refer to the change's delta spec. In the shared calendar requirement, unchanged client-specific behaviors are not newly implemented by this change. Flutter regression evidence applies to the affected common behaviors; pre-existing Web layouts and unchanged platform-specific presentation were scoped by diff inspection, not rerun or certified here.

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| **Flutter monthly calendar week expansion and drop feedback**: Highlight today's header without tinting task lanes | Self/subordinate date-header, unchanged task-bar and day-tap tests in `calendar_day_entrance_test.dart:200`; cross-year week header assertion in `calendar_week_expansion_test.dart:99`. | PASS |
| Expand a boundary week without displacing the month calendar | `_expandWeek`, `_buildExpandedWeek`, `computeFullWeek`, and the 320×450 scaled self/subordinate fixture in `calendar_week_expansion_test.dart:36`: seven real dates, Jan 1 holiday, deduplication, continuation date, scrollable list, detail/list return, actual overflow, and exact month-cell geometry on collapse. Also exercises create entry and focus at `:200`. | PASS |
| Continue an eligible week drag in the month without releasing | `task_calendar_page.dart:1194`; `task_calendar_drag_ui_test.dart:92`: same pointer from non-start date, outline, one confirmed request with both shifted timestamps; `:161`: cancel, background and pre-layout release send no writes. `calendar_drag_test.dart:19` verifies cross-year date arithmetic separately. | PASS for exercised cases; combined cross-year edge-scroll handoff unverified. |
| Use the same drop feedback and reject placeholders | `task_calendar_drag_ui_test.dart:396` and `:456`: invalid endpoint has no outline or confirmation; moving back to a valid date matches outline, preview and confirmation. Adjacent-month real cells, edge scrolling, placeholder/title/out-of-viewport rejection and cancel remain covered. | PASS (V-001 resolved) |
| Keep read-only browsing and a stationary hold non-mutating | `task_calendar_drag_ui_test.dart:122` and `:207`: stationary hold, no subordinate drag/endpoint/keyboard change across views; permitted comment goes through the subordinate route. `task_calendar_page.dart:802` guards the new gesture. | PASS |
| **Flutter time pickers accept typing only**: Type a start or due time in each task flow | Only the two `showTimePicker` calls in `task_form_page.dart:536` and `task_action_pages.dart:206`; `time_picker_checks.dart`, `task_form_test.dart`, `task_actions_web_parity_test.dart`: no switch, invalid/cancel behavior, retained date picker access and submitted timestamps for create, edit and reopen. | PASS |
| **Calendar task views**: Filter the calendar without revoking other access; Count mutually exclusive relationships; Identify the current user's task relationship | Same authorized assignee-filtered `listCalendarTasks` calls and `TasksApi`; change does not expand task visibility. Day entrance/readonly fixtures assert request assignee. | PASS for changed Flutter paths; existing server filtering unchanged. |
| Reach sidebar creation applications and task table; Use the required calendar entry points; Open the default month view; Select a year and month; Switch time granularity; Navigate and return from a day; Preserve calendar navigation after table return; Overlay a narrow accessible schedule drawer | Shared normal month/day paths preserved; far-month return and company today tested in `calendar_day_entrance_test.dart:107`. Personal expanded-week create action opens the real form, returns to the same grid, and does not overlap it (`calendar_week_expansion_test.dart:200`). The Web/sidebar presentation is outside the change. | PASS for affected Flutter paths (V-002 resolved). |
| Scroll across month and year boundaries; Preserve adjustable cells and complete overflow access; Read a month and open a complete day list; Fill five monthly task rows; Open overflow tasks for one date | `task_calendar_ui_test.dart:273` and `:370`; `calendar_pinch_test.dart:118`; cross-year week fixture. Tests exercise monthly placement, dynamic capacity, continuous scrolling, and return anchors. Existing tool-specific row resizing/keyboard interactions not extended to expanded week. | PASS for affected Flutter paths. |
| Pin and color without moving time; Pin only one's own ordering; Distinguish visible tasks; Show only task names in bars; Order visible task lanes | Shared `_MonthBlock` task projection and `leadingIds`; `task_calendar_ui_test.dart` and `calendar_status_style_test.dart` run in the regression suite, with unchanged pin write guards / task styles and narrow board geometry. | PASS for affected Flutter paths. |
| Show timed cross-day midnight and point tasks; Show more than five overlapping and all-day tasks; Split a timed cross day task; Display every overlapping and all day task; Render a spanning task bar; Render an all-day task; Handle crowded time slots; Classify full-day coverage without changing schedules | Existing day-axis layout, day/full-coverage and drag tests run in non-integration regression; axis projection and scheduling rules unchanged. Flutter retains its existing vertical view; unchanged horizontal presentation not in scope. | No in-scope regression observed. |
| Switch a whole week while preserving weekday; Drill from month to week; Ignore blank month task space; Drill from week to day; Ignore blank week task space; Keep task clicks distinct from drill-down; Navigate and return from a week; Open a sheet from every part of a monthly date; Return through nested detail and dismiss without losing context | `task_calendar_ui_test.dart`, `calendar_day_entrance_test.dart:262`, and `calendar_week_expansion_test.dart` cover short-click dates, list/axis selection, detail/list scroll and anchors. No swipe-to-week introduced. Keyboard-trigger tests at `calendar_day_entrance_test.dart:75` and `calendar_week_expansion_test.dart:217` confirm restored focus and reactivation. | PASS for affected Flutter paths (V-003 resolved). |
| **Flutter calendar day entrances and anchored return**: Use both day entrances and return without jumping; Show optional real holiday marks across a year boundary | `calendar_day_entrance_test.dart:75`, `:107`, `:262`; `calendar_day_holiday_test.dart:110`–`:170` verify correct company day, error and retry, same-day list toggle, correct actual tapped date, preserved scroll, restored trigger focus and genuine-only holiday marks. | PASS |
| **Flutter log filtering previews and post-save freshness**: Distinguish an exact preview fit from a hidden fourth line; Return from a real save without manual refresh; Read the same shorter badge in both personal and subordinate logs | `work_logs_page.dart:419`, `:1148`; `work_logs_ui_test.dart:261`, `:313`, `:408`, `:505`; `work_log_freshness_test.dart:82` / `:218`. Badge comes from `log.frozen`, including frozen subordinate logs; read-only alone does not show it. | PASS |

## Findings

Historical findings retained for traceability. Original evidence and behavior below describe the pre-repair revision of the affected files.

### V-001: Invalid endpoint proposals get the valid-drop outline

- Category: implementation
- Severity: medium
- Requirement: `Flutter monthly calendar week expansion and drop feedback`, valid-drop feedback and `Use the same drop feedback and reject placeholders`.
- Evidence: `task_calendar_page.dart:858` assigns `_dragTarget` even when `_monthPreview` returns null. The outline uses `_dragTarget` alone (`:550`, `:1906`); the overlay says `调整无效` (`:934`), and release does not confirm (`:886`). `calendar_drag.dart:85` and `:109` reject inverted endpoints.
- Expected: The valid-drop outline identifies a date on which the active drag can be confirmed. An inverted interval must not receive the same valid outline.
- Actual: Drag the start handle of an eligible same-day task to the next real date in the month, past its unchanged due time. The next date gets the valid outline while the overlay says the adjustment is invalid; release does not open confirmation.
- Repair guidance: Separate the hit date (which can support invalid-position messaging) from the valid preview used to draw the outline. Preserve normal month/placeholder hit rules.
- Acceptance checks: An endpoint taken past the other endpoint has no valid outline or confirm; return it to a date that gives a valid interval and check the outline, preview and confirmation agree. Rerun `task_calendar_drag_ui_test.dart`.
- Repair status: verified-resolved
- Repair notes: `flutter/lib/features/schedule/presentation/task_calendar_page.dart` now draws the outline only when the hit date yields a schedule preview, while retaining invalid-hit messages. The regression in `flutter/test/features/task_calendar_drag_ui_test.dart` reproduced the invalid outline before the fix and now covers invalid release, recovery to a valid date, matching preview and confirmation, and no write on cancel. `flutter test --no-pub test/features/task_calendar_drag_ui_test.dart test/features/calendar_week_expansion_test.dart test/features/calendar_day_entrance_test.dart --reporter expanded` passed (23 tests); `flutter test --no-pub test/core test/features test/widget_test.dart --reporter expanded` passed (262 tests); `flutter analyze --no-pub` reported no issues.
- Reverification notes: Independently reran `task_calendar_drag_ui_test.dart:396` and `:456`; invalid drag displays the invalid status without an outline or confirmation, while a corrected target shows the same preview in confirmation, and cancel sends no write. Code gates the outline on `_dragPreview` at `task_calendar_page.dart:567`.

### V-002: Opening a week removes the personal new-task action

- Category: implementation
- Severity: medium
- Requirement: `Calendar task views` retains the available creation entry; proposal/design keep expanded week inside the existing Flutter month mode without changing unrelated interactions.
- Evidence: `task_calendar_page.dart:461` explicitly removes `新建任务` for an expanded week without a selected day. The remaining app-bar actions at `:418`–`:458` do not route to `/tasks/new`.
- Expected: An authorized personal user can still open the existing create-task form while browsing the expanded week, without covering task/date/overflow controls. No write entry for subordinate browsing.
- Actual: The personal create action disappears on expansion and returns only after exiting the expanded grid or entering the separate day panel.
- Repair guidance: Retain an accessible create action while the week is expanded without covering its date/overflow controls; preserve the existing subordinate restriction and source view on return.
- Acceptance checks: Open a dense week on a narrow screen, verify the last-column overflow and new-task action are both usable, open the existing form and return to the same week; subordinate still has no create action.
- Repair status: verified-resolved
- Repair notes: `flutter/lib/features/schedule/presentation/task_calendar_page.dart` exposes the existing personal creation action in the app bar while browsing the expanded week, outside the grid. The 320×450, 1.25× text-scale fixture in `flutter/test/features/calendar_week_expansion_test.dart` reproduced the missing entry and now opens the real create form, returns to the same week, activates Sunday overflow, and confirms the create action is absent for subordinate browsing. The focused suite passed (23 tests); the non-integration regression suite passed (262 tests); `flutter analyze --no-pub` reported no issues.
- Reverification notes: Independently reran `calendar_week_expansion_test.dart:36`; the app-bar action does not overlap the grid, opens `TaskFormPage`, and returns to the same week with a usable Sunday `+N`. Subordinate case still has no create action.

### V-003: Day-panel dismissal does not restore the calendar trigger's keyboard focus

- Category: implementation
- Severity: medium
- Requirement: `Flutter calendar day entrances and anchored return`, return to trigger, and `Calendar task views`, correct focus restoration when dismissing the day list.
- Evidence: On a date/overflow-triggered panel open, `task_calendar_page.dart:469`–`:498` replaces the month or week subtree (disposing its focused control). `_openDay` records only date/scroll state (`:1263`), and `_closeDay` restores only the month scroll anchor (`:1281`–`:1292`). Closing to an expanded week returns early with no focus work. The existing return tests (`calendar_week_expansion_test.dart:161`, `calendar_day_entrance_test.dart:156`) check geometry/date, not focus.
- Expected: After keyboard activation of a focusable date or `+N` and dismissal, focus returns to that control in the source view rather than a generic scope or another action.
- Actual: The opening control is removed and recreated without retaining its identity or requesting its focus. Scroll/geometry restoration alone cannot restore that focus node.
- Repair guidance: Track and restore the appropriate source control once the month or week has been laid out, including when the panel was reached from `+N`. Keep existing mouse/touch behavior.
- Acceptance checks: Keyboard-activate a month date and an expanded-week `+N`, dismiss with Close or Escape, and assert the corresponding control regains keyboard focus and can be reactivated without tabbing away.
- Repair status: verified-resolved
- Repair notes: `flutter/lib/features/schedule/presentation/task_calendar_page.dart` retains the focused date or overflow control's identity across the day panel and restores focus after the source grid and month scroll anchor are restored. The calendar focus scope also keeps Escape available after the opening control is removed. `flutter/test/features/calendar_day_entrance_test.dart` reproduced missing month focus and now verifies Close, anchor geometry, and Enter reactivation; `flutter/test/features/calendar_week_expansion_test.dart` reproduces the keyboard dismissal path and now verifies Escape and Enter reactivation on Sunday `+N`. The focused suite passed (23 tests); the non-integration regression suite passed (262 tests); `flutter analyze --no-pub` reported no issues.
- Reverification notes: Independently reran `calendar_day_entrance_test.dart:75` and `calendar_week_expansion_test.dart:217`. Both assert that the original control has primary focus and that Enter reopens the same date, after Close in the month and Escape in the expanded week. The generation and source-focus checks are in `task_calendar_page.dart:1300` and `:1317`.
