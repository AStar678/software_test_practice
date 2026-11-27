# Implementation Verification

- Change: `refine-employee-app-tasks-data-and-freshness`
- Schema: `spec-driven`
- Verdict: PASS
- Verified at: `2026-11-27T12:13:42+08:00`
- Implementation roots: `/home/rmy/桌面/panDuola` (`backend/`, `flutter/`)
- Verified revision: `f426be7` plus uncommitted repair changes

## Summary

Independent re-verification resolved V-001 and V-002. Strict OpenSpec validation, Maven tests, focused Flutter tests, full Flutter tests and Dart analysis pass. No actionable findings remain. The current worktree includes broad formatter changes accepted for this verification; they are non-semantic noise around the repaired files. No simulator was available on this Linux host, so device smoke evidence remains historical apply evidence rather than a rerun; this is recorded as a residual risk, not a confirmed defect.

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| Implementation and planning root: `/home/rmy/桌面/panDuola` | 832 Git-tracked or non-ignored files after excluding build outputs, caches, test reports and logs. Includes repaired `backend/` and `flutter/` files and this change's artifacts. |
| `proposal.md`, `specs/pandora-requirements-aligned-prototype/spec.md`, `design.md`, `tasks.md` | Read from disk; all planning artifacts complete. Task checkboxes were treated as claims, not evidence. |
| Snapshot before re-verification | `475dddff2e8d0cbda7ec7fdde7760dcdadde25c41d08abe4d45c007c5a046231` (`/tmp/e13-app-reverify-before.json`) |
| Snapshot after re-verification | `475dddff2e8d0cbda7ec7fdde7760dcdadde25c41d08abe4d45c007c5a046231` (`/tmp/e13-app-reverify-after.json`); compare returned `changed: false` |
| Exclusions | `flutter/build/**`, `flutter/.dart_tool/**`, `backend/target/**`, `backend/.runtime/**`, `notebooks/**`, `output/**`, `audit/**`, `*.log`; workflow report/state files auto-excluded |

The before/after inventory is unchanged. No implementation edits occurred during this verification round. The repair diff was reviewed as the affected input; the current verification basis is the current worktree, not the older implementation-notes revision.

## Apply Handoff Review

The handoff names this change and the Flutter/backend roots, but its paths/revision are historical (`/Users/watuji/...`, `dfc0504` plus dirty worktree). It was used to locate code, then every relevant claim was checked against current files and rerun checks. Reminder dispositions:

| Reminder | Disposition |
| --- | --- |
| Employee Web has no dedicated deleted banner | Confirmed residual compatibility limitation; this change excludes new Web delete UI and shared APIs retain deleted state. No finding. |
| No real-backend end-to-end Flutter suite on port 8080 | Confirmed; full suite skipped 32 real-backend integration cases. Backend API/error behavior passed Maven tests; residual risk only. |
| Deleted-reference permutations not all widget-tested | Inspected DTO/UI paths and focused tests; no concrete defect found. |
| No scroll/filter/page preservation test across all tabs | Addressed by V-002 repairs and the new work-log scroll regression; notifications/analytics preserve paths were inspected and full suite passed. |
| No strong widget assertion for leadership-first ordering | Backend sort and picker consumption were inspected; no concrete defect found. |
| V1–V36 checksums not re-read | Current Maven suite passed and migration files are unchanged; no finding. |
| Historical disposable databases | Not used as evidence. |
| Work-log editor has no inline delete action | Not required by the delta spec; deleted references remain readable and the linked task shows the deleted state. |

## Checks

| Command or inspection | Result | Notes |
| --- | --- | --- |
| `openspec validate "refine-employee-app-tasks-data-and-freshness" --type change --strict --json --no-interactive` | PASS | `valid: true`, no issues. |
| `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package` | PASS | 250 tests, 0 failures/errors/skips; BUILD SUCCESS. |
| `flutter test --no-pub --reporter expanded --concurrency=1 <focused suites>` | PASS | 23 tests after repair, including analytics, error safety, work-log scroll preservation and deleted-state paths. |
| `flutter test --no-pub --reporter expanded --concurrency=1` | PASS | 274 passed, 32 skipped (real-backend integration), 0 failures. |
| `dart analyze --fatal-infos` | PASS | No issues found. |
| `flutter analyze --no-pub` | BLOCKED BY ENVIRONMENT | Analysis server exits 255 with truncated LSP JSON on the non-ASCII workspace path; `dart analyze` is the working equivalent. |
| `git diff --check`; `git status --short --branch` | PASS | No whitespace errors; worktree has the repaired files and this report. |
| Snapshot capture/compare before and after | PASS | SHA-256 matches; `changed: false`. |
| Code inspection of repaired error paths | PASS | Primary flows now call `userMessageFor`; remaining `error.message` uses are non-`ApiException` session/avatar messages. |
| Code inspection of refresh paths | PASS | Work logs and notifications re-read the loaded window without clearing rows; analytics preserves summary/report while invalidating late reports. |

## Requirement Coverage

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| **Inline tag creation**: create/select without leaving; preserve draft on failure; hide from non-founders | `task_form_page.dart` inline dialog and founder guard; focused founder/ordinary tests; backend founder-only tag permission. | PASS |
| **Task soft deletion**: delete from calendar/form; pending blocked; deleted references; unauthorized rejected | `V37__task_soft_delete.sql`; `TaskService#delete/loadTaskBatch/detail/deleted`; `TaskSoftDeleteTest`; Flutter delete actions and 410 mapping. | PASS |
| **Navigation/page freshness**: every tab refresh; preserve content/scroll/filter/pagination/drafts; no-nav refresh | `tab_refresh.dart`, shell and page listeners; work-log scroll regression; in-place notification/analytics refresh; full suite. | PASS (V-002 resolved) |
| **Home ordinals**: preview and list 1..N; stable with long titles; no sort/limit change | `common.dart#ListOrdinal`; home previews/lists; ordinal widget test. | PASS |
| **Assignee leadership-first ordering**: same-group leaders first; search filters; selected order unchanged | `Access.creationCandidates` rank sort; `CandidateOrderingTest`; picker consumes server order without re-sorting. | PASS |
| **User-facing error safety**: no raw/technical text; Chinese labels; recoverable states | `ApiAdvice` catch-all; centralized `userMessageFor`; repaired page sinks; Chinese backend labels; technical-message widget regression. | PASS (V-001 resolved) |
| **Timed daily items**: all-day/timed; exact deadline; cross-day; legacy migration; private ownership | `V38` migration; `DailyItemService`; `DailyItemTimedStatusTest`; Flutter model/form/detail. | PASS |
| **Daily-item list/editing**: all-day default, timed validation, compact screens, versioning/privacy | `daily_item_pages.dart`; `daily_items_ui_test.dart`; existing daily-item tests. | PASS |
| **Fading names**: no ellipsis/extra slot; single faded glyph; no ghost; accessibility retains full text | `fading_name_text.dart` prefix/mask; `fading_name_test.dart`; focused test. | PASS |

## Findings

### V-001: User-visible errors still bypass the unified safety layer and backend field names remain English

- Category: implementation
- Severity: medium
- Requirement: `Employee app user-facing error safety`; `Translate validation and conflict states`; all primary flows use the unified error presentation.
- Evidence: Flutter previously rendered raw `ApiException.message` in daily items, task form/actions/review, approvals, profile, login, password change and schedule confirmation; backend validation messages still used `tagIds`, `businessDate`, `scope`, `unread`, `action`, `objectType`.
- Expected: Primary Flutter flows use the unified Chinese/actionable error layer, and known validation errors use Chinese labels rather than internal field names.
- Actual: Technical/English server messages could bypass the guard.
- Repair guidance: Route affected primary-flow error sinks through `userMessageFor`; replace user-visible field labels with Chinese business labels; add regression coverage.
- Acceptance checks: Focused error-path tests; backend message assertions; rendered-text test using an English/technical message.
- Repair status: verified-resolved
- Repair notes: Routed affected sinks through `userMessageFor`; replaced the remaining user-visible English validation labels in `WorkspaceService`, `CommentService` and `TaskService`; added a widget regression asserting a technical `startDate / tagIds` message renders the Chinese fallback.
- Reverification notes: Independently reran the focused error-safety/widget tests, full Flutter suite (274 passed, 32 skipped), Maven (250 passed) and `dart analyze` (no issues). Remaining `error.message` uses are non-`ApiException` session/avatar messages; no user-facing technical text path was found.

### V-002: Tab and no-nav refresh clears loaded content and loses scroll/pagination state

- Category: implementation
- Severity: high
- Requirement: `Employee app navigation and page data freshness`; `Preserve browsing state while refreshing`; `Refresh pages without bottom navigation`.
- Evidence: Work logs and notifications previously cleared `_items`/offset before refresh; analytics cleared summary/report content. This collapsed the list and lost loaded pages/scroll.
- Expected: Refresh reads new data while keeping current visible content, scroll offset, filters and loaded pages; failure keeps old content.
- Actual: Content and position were discarded on refresh.
- Repair guidance: Preserve current content while fetching, replace in place after success, restore scroll, and add a scroll/pagination regression.
- Acceptance checks: Focused widget tests for refresh preservation; full suite; failure path keeps prior content.
- Repair status: verified-resolved
- Repair notes: Added in-place refresh for work logs and notifications, preserving rows while re-reading the loaded window and restoring offset; analytics preserves summary/report while invalidating late reports. Added a work-log scroll regression.
- Reverification notes: Independently reran the new work-log scroll test, analytics regression suite, focused tests and full Flutter suite (274 passed, 32 skipped). No content-clearing reset remains on the affected refresh paths.
