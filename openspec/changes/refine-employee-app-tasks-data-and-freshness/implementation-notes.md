# Implementation Notes

- Change: `refine-employee-app-tasks-data-and-freshness`
- Schema: `spec-driven`
- Store: local repository
- Implementation roots: `C:\Users\20943\Desktop\software_test_practice` (`backend/`, `flutter/`)
- Updated: 2026-11-23T19:40:00+08:00
- Implementation revision: `1a792a4f` + dirty worktree (no commit created)
- Progress: 19/25 tasks complete (sections 1 and 2); sections 3–4 intentionally left for compatibility/verification handoff

## Implementation Map

| Task / requirement / scenario | Code and tests | Decisions / context |
| --- | --- | --- |
| 1.1 task soft-delete migration | `backend/src/main/resources/db/migration/V37__task_soft_delete.sql` | Adds `deleted_at/deleted_by/delete_reason` and `idx_tasks_org_live`; no data rewrite. |
| 1.2 DELETE task with version/pending/permission | `TaskController#delete`, `TaskService#delete`, `Writes.run`/`checkVersion`; `backend/src/test/java/cn/pandora/task/TaskSoftDeleteTest.java` | `If-Match` + `Idempotency-Key` required; current business owner or original creator; pending request returns `409 TASK_HAS_PENDING_REQUEST`; already deleted returns `410 TASK_DELETED`; row version increments and no cascade. |
| 1.3 employee reads exclude/identify deleted tasks | `TaskService#loadTaskBatch/candidateTaskVisibility/canSeeEffective/validateParent`, `WorkspaceService#fillSource`, `ReminderService`, `ExpiryService`, detail `410`; notification/log/approval projections carry `taskDeleted` | List/table/statistics/calendar/form/search/parent candidates exclude; detail returns stable `410 {code:TASK_DELETED}`; references keep their rows and expose a deleted flag instead of disappearing. |
| 1.4 history and domain event | `TaskService#delete` (`deleted` history entry, previous source/version), `Events.record("task.deleted")`; `TaskService#taskHistory` exposes deleted fields | Versions, assignments, requests, comments, logs, notifications, handovers are untouched. |
| 1.5 daily-item timed migration | `V38__daily_item_all_day_and_times.sql` | Adds `all_day DEFAULT TRUE`, nullable `start_time/end_time`; old rows remain whole-day. |
| 1.6 daily-item read/write/status compatibility | `backend/src/main/java/cn/pandora/workspace/DailyItemService.java`; `DailyItemTimedStatusTest` | Legacy date-only payload stays whole-day; timed payload requires both `HH:mm` values and end not before start; status is `completed` first, then whole-day by inclusive end date, timed strictly after company-local deadline. Range queries and the 93-day window remain date-based. |
| 1.7 leadership-first candidate ordering | `backend/src/main/java/cn/pandora/auth/Access.java` (`creationCandidates` sort), `CandidateOrderingTest` | Sort by tree rank (founder/department head/team head/employee), then display name, then id; query search only filters. |
| 1.8 unexpected-error fallback and message cleanup | `backend/src/main/java/cn/pandora/common/ApiAdvice.java` (catch-all `INTERNAL_ERROR`, 404 route handler), TaskService/DailyItemService Chinese labels; `ApiAdviceTest` | Raw exceptions/stacks/SQL/English field names are not returned; internal detail is logged server-side. |
| 2.1 inline tag creation | `flutter/lib/features/tasks/presentation/task_form_page.dart` (`_createInlineTag`), `TagsApi.create`; `flutter/test/features/employee_refinements_test.dart` | Founder-only button inside the form; dialog reuses 40-char and 8-colour rules; success appends to `_tagCatalog` and selects it without leaving the page. |
| 2.2 Flutter deleted-task model/API/actions | `TasksApi.delete`, `ApiErrorKind.deleted`, `mapHttpError(410)`; delete actions in `task_detail_page.dart`, `task_form_page.dart`, `task_calendar_page.dart` day list; `employee_refinements_test.dart` | Permission check mirrors business owner/original creator; confirmation explains references remain; failures keep page/draft. |
| 2.3 deleted notices | `ErrorView` maps 410 to “任务已删除”; notification detail shows disabled “任务已删除”; approval detail shows deleted banner and hides decisions; work-log entry shows “任务已删除” instead of a link | Notification/log/approval DTOs parse `taskDeleted`; historical notification task read propagates 410. |
| 2.4 daily-item timed UI | `daily_item.dart`, `daily_items_api.dart`, `daily_items_providers.dart`, `daily_item_pages.dart` | Create/edit/detail support all-day switch, `showTimePicker`, both-time requirement, same-day end-before-start rejection; month calendar stays day-level. |
| 2.5 overdue boundary display | `DailyItem.modeLabel/isOverdue`; server-derived status consumed by `visualStateOf`; `DailyItemTimedStatusTest`, `employee_refinements_test.dart` | Exact deadline remains open; only strictly after deadline becomes overdue; completed always wins. |
| 2.6 home ordinals | `core/widgets/common.dart#ListOrdinal`, `home_page.dart` previews, `home_lists.dart` event/board full lists; ordinal widget test | 1..N per preview/list, separate left column, semantics “第 N 条”, no sorting/limit change. |
| 2.7 candidate order in Flutter | `assignee_picker.dart` already consumes backend order without re-sorting; backend ordering above | Selected order remains user-controlled; search only filters. |
| 2.8 fade ghost fix | `core/widgets/fading_name_text.dart#NameFadeLayout.prefixOf`; `employee_refinements_test.dart` | Prefix now excludes the single faded grapheme, so only the mask draws it once. |
| 2.9 tab refresh coordinator | `core/navigation/tab_refresh.dart`, `pandora_shell.dart`, listeners in home/calendar/logs/analytics/me; `employee_refinements_test.dart` | Every tap (including current) bumps the target generation; `goBranch(initialLocation:false)` keeps branch state; refresh re-reads data. |
| 2.10 refresh entries and write visibility | Existing `RefreshIndicator` on notifications/people; existing write invalidations reused; `home_providers.dart` preserves previous data on failed refresh | No new refresh gaps were introduced; person work browsing continues to use the work-log page refresh. |
| 2.11 unified user-facing errors | `core/errors/app_error.dart` (`userMessageFor`, `errorAllowsRetry`, technical-text guard), `state_views.dart`, `common.dart#showErrorSnack`, replaced raw `error.toString()` uses; `employee_refinements_test.dart` | Chinese actionable messages; network/timeout/validation/auth/not-found/conflict/server remain distinguishable; technical text is filtered. |

## Checks Run

| Command | Working directory / setup | Result / evidence | Run time or revision |
| --- | --- | --- | --- |
| `mvn test` | `backend/` | 238 tests, 0 failures, BUILD SUCCESS | 2026-11-23 19:2x |
| `mvn -Dtest=TaskSoftDeleteTest,DailyItemTimedStatusTest,ApiAdviceTest,CandidateOrderingTest test` | `backend/` | 13 tests, 0 failures | 2026-11-23 19:19 |
| `java -cp "target\classes;<dependency cp>" scripts/Migrate.java` | empty `pandora_v38_empty` on local MySQL 9.7 | 38 migrations applied, final version 38 | 2026-11-23 17:20 |
| same Migrate on V36 clone `pandora_v36_upgrade` | cloned from `pandora_demo` (V36, 16 daily items, 61 tasks) | V37+V38 applied; daily item row hash before/after identical; 16/16 old rows `all_day=1` with null times | 2026-11-23 17:21 |
| Manual API (curl) on `pandora_v36_upgrade`, port 18080 | founder `13800000001`, password reset in test DB only | create task → DELETE 200 → detail 410 `TASK_DELETED` → list excludes it; versions/history/assignments preserved; history has `deleted`, event has `task.deleted`. Timed daily item 18:00–19:00 open, 09:00–10:00 overdue, legacy date payload all-day, patch to all-day clears times, `25:00` returns 400. | 2026-11-23 17:23 |
| `flutter analyze` | `flutter/` | No issues found | 2026-11-23 19:38 |
| `flutter test --concurrency=1` | `flutter/` | 272 passed, 32 skipped (real-backend integration skipped because `127.0.0.1:8080` was not running), 0 failed | 2026-11-23 19:5x |
| `flutter test test/features/employee_refinements_test.dart` | `flutter/` | 9 passed (410 mapping, error text safety, fade prefix, daily item modes, ordinal, tab refresh, delete request, founder inline tag, employee hiding) | 2026-11-23 19:39 |
| `openspec validate "refine-employee-app-tasks-data-and-freshness" --type change --strict --no-interactive` | repository root | Fails on one pre-existing planning warning: the ADDED requirement text is >500 characters. Planning artifacts were not edited by this implementation. | 2026-11-23 19:4x |
| `git diff --check` | repository root | No whitespace errors | 2026-11-23 19:4x |

## Verification Reminders

- Section 3 tasks are untouched: employee-Web compatibility smoke, full Flutter suite is green but APK build/emulator smoke, `openspec validate`, and `git diff --check` still belong to the compatibility/verification handoff.
- Deleted-task UI coverage is focused on the detail/form/calendar, notification, approval and log entry points. Widget tests for every deleted-reference permutation (history-read-only, relation lost, parent unavailable) were not written; the DTO/flag plumbing and 410 mapping are tested.
- 2.9/2.10 preserve page state by not resetting `StatefulShellRoute` branches and by retaining previous home data on failed refresh. There is no dedicated widget test for scroll/filter/page preservation across all five tabs yet.
- 2.7 frontend behavior relies on the existing picker preserving candidate order; a strong widget assertion for leadership-first ordering and manual reorder was not added.
- Migration checksums of V1–V36 were not explicitly re-read; those files were not modified, and Flyway reports success on both empty and upgrade databases.
- The backend was manually exercised on `pandora_v36_upgrade`; that database and `pandora_v38_empty` are disposable test databases created in this session.
- Work-log linked-task deletion is displayed as “任务已删除”; the work-log editor itself does not expose a separate delete-task action beyond the task detail/form/calendar entries.
