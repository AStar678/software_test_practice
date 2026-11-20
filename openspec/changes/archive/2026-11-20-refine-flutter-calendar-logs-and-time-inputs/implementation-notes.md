# Implementation Notes

- Change: `refine-flutter-calendar-logs-and-time-inputs`
- Schema: `spec-driven`
- Store: local
- Implementation root: `/Users/watuji/MyGitDev/software_test_practice/flutter`
- Updated: `2026-11-20T09:11:56+08:00`
- Implementation revision: `a80faee8c94436d0d3bcfc355f5c05fffadac8c3`, with uncommitted Flutter changes and local OpenSpec files.
- Progress: 10/10 tasks complete; independent verification is pending.

## Implementation Map

| Tasks / scenarios | Code and tests | Decisions |
| --- | --- | --- |
| 1.1-1.2: today header, both day entrances, anchored return | `flutter/lib/features/schedule/presentation/task_calendar_page.dart`; `flutter/test/features/calendar_day_entrance_test.dart` | Keep the date cell's hit area; render pink only on its header. The toolbar reads the company date and requests its month independently of the visible month window. The day panel distinguishes loading, failure, and a true empty result. |
| 2.1-2.2: full boundary week, real overflow, navigation and person isolation | `flutter/lib/features/schedule/presentation/task_calendar_page.dart`; `flutter/lib/features/daily_items/domain/month_layout.dart`; `flutter/test/features/calendar_week_expansion_test.dart` | Week selection is an in-page expansion, not a new route. Merge authorized month results by task ID before using the shared week layout. The home calendar keeps its original month-clipping behavior. The source month anchor is separate from the day-panel date. |
| 2.3-2.4: shared drop feedback and week-to-month continuation | `flutter/lib/features/schedule/presentation/task_calendar_page.dart`; `flutter/lib/features/schedule/domain/task_calendar.dart`; `flutter/test/features/task_calendar_drag_ui_test.dart` | The page retains the active pointer after the source week unmounts. A hold alone does not collapse the week. Once the pointer moves, the month is positioned at the selected week and geometry is checked after layout. The same real, visible date drives the outline and confirmation preview; placeholders and clipped cells are rejected. |
| 2.5: subordinate browsing and comments without scheduling writes | `flutter/lib/features/schedule/presentation/task_calendar_page.dart`; `flutter/test/features/task_calendar_drag_ui_test.dart` | Gate adjustment controls and handlers on the read context, including for tasks that are otherwise reschedulable. The subordinate detail route still permits an authorized comment. |
| 3.1: frozen log badge in list and detail | `flutter/lib/features/work_logs/presentation/work_logs_page.dart`; `flutter/test/features/work_logs_ui_test.dart` | Only the `frozen` flag produces `已不能编辑`; read-only status alone does not. |
| 3.2: keyboard-only start and due time fields | `flutter/lib/features/tasks/presentation/task_form_page.dart`; `flutter/lib/features/tasks/presentation/task_action_pages.dart`; `flutter/test/features/task_form_test.dart`; `flutter/test/features/task_actions_web_parity_test.dart`; `flutter/test/support/time_picker_checks.dart` | Both existing time dialogs use `TimePickerEntryMode.inputOnly`. Tests exercise invalid input, cancellation, date picker access, and the outbound timestamps for create, edit, and reopen. |

## Checks Run

All results below are from this apply session. Flutter used the installed Flutter 3.47.9 / Dart 3.13.7 SDK and existing dependencies. Earlier focused runs exposed and helped resolve a misplaced test import, finder and timing assertions, and analyzer lints.

| Command | Working directory / setup | Result / evidence |
| --- | --- | --- |
| `flutter test --no-pub` | `flutter/`; existing local demo backend on `127.0.0.1:8080` was available to the integration tests; no credentials recorded here. | 293 passed. `/tmp/e13-flutter-suite.log`. Run after layout cleanup and before the final analyzer-only shortcut syntax fix. |
| `flutter test --no-pub test/features/task_calendar_drag_ui_test.dart test/features/calendar_week_expansion_test.dart test/features/calendar_day_entrance_test.dart` | `flutter/`; fake backends provided by the test harness. | 22 passed after the shortcut syntax fix. `/tmp/e13-calendar-final-focused.log`. |
| `flutter analyze --no-pub` | `flutter/` | No issues found after the shortcut syntax fix. `/tmp/e13-calendar-analyze.log`. |
| `git diff --check`; `git status --short --untracked-files=all` | Repository root | No whitespace errors. All modified or new application and test files are in `flutter/`; outside it only the selected OpenSpec change is present. |

## Verification Reminders

- On a narrow device or emulator, check the title control and task hit areas with enlarged text, and check the expanded week's last-column overflow and return focus. The widget fixture uses a 320 x 450 viewport with 1.25x text scale; no manual device run was performed.
- Exercise a cross-year continuation drag after edge scrolling, especially a quick release or cancellation just after the view switch. Confirm the visible target matches the proposed change and that invalid releases do not write. See design decisions 1-4 and `task_calendar_drag_ui_test.dart`.
- Review late responses when changing person or account, especially when the direct day entry is uncached or one half of a boundary week fails. Retry must use the same person's authorized task scope and must not show partial data as complete.
