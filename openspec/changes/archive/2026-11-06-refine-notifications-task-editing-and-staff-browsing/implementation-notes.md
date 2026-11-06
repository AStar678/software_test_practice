# Implementation Notes

- Change: `refine-notifications-task-editing-and-staff-browsing`
- Schema: `spec-driven`
- Store: local (`/Users/watuji/MyGitDev/software_test_practice`)
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice` (employee Web, `admin.html`, `backend/`)
- Updated: 2026-11-06 08:31 CST
- Branch / revision: `xzs_refine_notifications`, implementation commit immediately after `main` at `26900a0`; worktree clean at handoff.
- Progress: 38/38 tasks complete. Apply checks passed; independent verification is still pending.

## Implementation Map

| Task / requirement / scenario | Code and tests | Decisions / context |
| --- | --- | --- |
| 1.1 ordered log-tag migration | `backend/src/main/resources/db/migration/V29__work_log_multiple_tags.sql` | Earlier session evidence: V28 upgrade and empty-database paths preserved log IDs, body, dates, first-created/freeze instants and tag snapshots. |
| 1.2–1.3 log collection contract | `WorkspaceService.java`, `潘多拉-工作区接入.js`, `check_apply_log_tags.py` | Ordered `tagIds/tags`, transactional replacement, omitted/empty semantics, batch reads and deleted snapshots. Re-run in this session: 44 checks PASS. |
| 1.4–1.5 remove private tags | `V30__remove_private_tags.sql`, `Tags.java`, `TaskController.java`, `潘多拉-标签评论.js`, `check_apply_private_migration_guard.py`, `check_calendar_tags.py` | Shared-only catalogue; private route/field/override removed; first shared tag drives colour. Re-run PASS. |
| 2.1 unified field eligibility | `TaskService.java` (`editableFieldsFor`, preview/approve checks), `潘多拉-任务接入.js`, `check_apply_mixed_edit.py` | One policy for metadata/progress/schedule/owner order; submit, pending refresh and approve revalidate. |
| 2.2 mixed metadata + progress | `TaskService.change/submit/validateApplicationEffect`, `check_apply_mixed_edit.py` | One request and one proposed version; atomic apply; rejection/withdrawal/expiry publish nothing; founder direct apply and idempotent retry. |
| 2.3 dedicated flows | `TaskService` completion/handover/reopen, `check_visible_schedule_permissions.py`, `check_review_routing.py`, takeover/handover checks | Ordinary edits cannot write state/round/source; dedicated flows and schedule-only authority retained. Re-run PASS. |
| 2.4 unified edit UI | `潘多拉-任务接入.js` (`adapterTaskFormView`, `openTaskForm`, `saveTask`) | One edit entry, field-projected form, owner picker hidden without authority, failed draft retained. Browser re-run PASS. |
| 2.5 reviewer display | `潘多拉-任务接入.js` (`finish`, task/approval detail) | No internal owner or fixed reviewer rows; saved current reviewer read back; direct/blocked wording accurate. |
| 2.6 reviewer diff | `潘多拉-任务接入.js` (`differenceHTML`, `demo diff`), `check_apply_mixed_edit_browser.js` | Changed fields only, original above proposed, ordered owners/tags, no fabricated old value; 320/390/1440. |
| 3.1 reminder classification | `WorkspaceService` (`notificationCategory/Purpose/Result`), `check_apply_notifications.py` | Real `task.reminder_20/10/5` and `task.overdue`; filters/counts/detail agree; old messages not redelivered. |
| 3.2 independent request access | `WorkspaceService` (`safeNotification`, `requestAccess`), `check_apply_notifications.py` + browser | `canReadRequest` separate from `canReview`; applicant/reviewer/ordinary recipient/removed owner/mismatched binding covered. |
| 3.3 result and structured changes | `WorkspaceService` event `changes` projection, `check_apply_notifications.py` | Legal before/after values, historical summary fallback, withdrawal/redaction pruning. |
| 3.4 notification detail layout | `潘多拉-工作区接入.js` (`notificationView`, summary/change layout) | Result first, changes next, object/time once, one primary action, accessible more menu; widths. |
| 3.5 more actions | `潘多拉-工作区接入.js`, `check_apply_notifications_browser.js` | Delete, withdraw notification and withdraw own request separately named/confirmed; 180-second limit preserved. |
| 4.1 safe people cache | `潘多拉-api.js` (`rememberPeople`), `check_apply_profile_pin_history.py` | Field-safe upsert; name summaries cannot overwrite organization fields; explicit null clears; no phone/email in general cache. |
| 4.2 people display | `潘多拉-个人资料.js` (`readonlyRows`, `staffOrgLine`) | Company row removed for self/subordinate; identity/position/department/team separate; company-level placeholder. |
| 4.3 stable task colour | `潘多拉-交互原型.js` (`taskColorVars`), `潘多拉-api.js` (`mapTask`), `check_calendar_tags.py` | Shared first tag, default pink, deleted snapshot retained, no private override. Re-run PASS. |
| 4.4 personal pin | `TaskService` (`taskView.canPin`, `setPinned`), `潘多拉-任务接入.js`, `check_apply_profile_pin_history.py` | Effective owner in the normal calendar only; completed owned task still pin-eligible; subordinate path has no action. |
| 4.5 employee history | `TaskService.detail` (no records), `潘多拉-任务接入.js`; `check_apply_profile_pin_history.py` | Employee sees current progress only; administrator history keeps full records; no full-history API for employees. |
| 5.1 person card and work split | `潘多拉-个人资料.js` (`openPerson`, `staffCardView`, `staffView`), `check_subordinate_workspace.py` | Card first, then schedule/log; subject-scoped work data; own calendar/log untouched. |
| 5.2 subordinate month/day/list | `潘多拉-个人资料.js` (`staffMonthHTML`, `staffDayHTML`, `refreshStaff`) | Hit-date lists, day view, pagination, cross-day/midnight/point/completed/pending; no drag; widths. |
| 5.3 comment-only chain | `潘多拉-任务接入.js`, `潘多拉-工作区接入.js`, `潘多拉-api.js` (`P.mutation`), `check_subordinate_workspace_browser.js` | Task/log/child/related/application details in subordinate path only allow comments; direct API still independently enforced. |
| 5.4 sheet stack and restoration | `潘多拉-交互原型.js` (`openSheet`, `backSheet`), `潘多拉-个人资料.js` | Each layer saves source; back/close/Esc/overlay pop one layer; person/mode/date/scroll/focus restored. |
| 5.5 reauthorization and async isolation | `潘多拉-个人资料.js` (`refreshStaff`), stale-response guards | Lost authority clears rows and cached work data; delayed responses discarded by epoch/subject/mode. |
| 6.1 day-axis drag eligibility | `潘多拉-日程视图.js` (`canDragDay`, `resizeHandle`, axis/horizontal render), `check_schedule_drag.py` | Only complete ordinary intra-day timed/zero-length tasks get move/endpoint/keyboard bindings. All-day, full-day coverage and every clipped cross-day segment (first/middle/tail) get none; ordinary clicks still open details. Minute-of-hour and real endpoints preserved; midnight end has no next-day copy. |
| 6.2 lightweight schedule confirmation | `潘多拉-任务接入.js` (`openScheduleChange`, `scheduleConfirmationView`), `check_schedule_drag.py` | Independent draft/sheet shows only effective/proposed schedule, reason and submit. All-day tasks show complete dates rather than invented times; the sheet always reads the latest task version. Month day steps and day hour steps share it; dropping no longer opens the full form. |
| 6.3 version/failure/idempotency | `潘多拉-任务接入.js` (`saveScheduleDraft`, slot reuse), `潘多拉-日程视图.js` (`completeScheduleDrag`) | First submit rechecks version/freeze/completion/authority; retry reuses the same payload and idempotency key so a lost response commits once; 412/409 marks the draft stale instead of applying the old delta. Esc/pointercancel/lost capture/zero movement/reverse write nothing. A zero-movement endpoint press no longer bubbles into detail/day-list. |
| 6.4 pending projection and result recovery | `潘多拉-api.js` (`calendarTask`), `潘多拉-日程视图.js`, `check_schedule_drag.py` (two browser phases) | Dashed proposal at the proposed month/day position with the proposed title time and shared first-tag colour; effective detail/API keep the old schedule. Approve publishes it, reject/withdraw restore the effective position, expiry (deadline passed before a reviewer decision) restores it and unfreezes the task; founder direct apply still publishes immediately. |
| 7.1 shared tag picker in logs | `潘多拉-标签评论.js` (`P.tagCollectionHTML`, `p-task-tag` action), `潘多拉-工作区接入.js` (create/edit forms), `check_apply_log_tags.py` + `check_apply_log_tags_browser.js` | Task and log forms share one renderer/state. Stable selection order (cancel/re-add appends), keyboard toggle, read-only edit date beside tags, deleted retained references removable but not re-addable, nested task-picker return keeps body/tags/task, failed save keeps the draft, 320/390/1440 no horizontal overflow; list/detail show all tags in order. |
| 7.2 admin login phone | `OrganizationService.java`, `admin.html`, `check_apply_admin_login_phone.py` + browser | Same-company admins read full `loginPhone` in list/detail; public directory/business DTOs unchanged; change updates the login key, revokes old sessions; browser readback at 320/390/1440; no “only write” wording. |
| 7.3 log permission row | `潘多拉-工作区接入.js` (`logDetailView`) | “编辑权限” row removed; edit button and short freeze/read-only state express authority; server checks unchanged. |
| 7.4 reachable copy | `潘多拉-交互原型.js`, `潘多拉-任务接入.js`, `潘多拉-工作区接入.js`, `潘多拉-标签评论.js`, `admin.html`, `index.html`; `check_apply_copy_audit.py` + browser | Removed development/rule paragraphs (assignee selection routing, parent/child execution rules, fixed reviewer rules, timezone internals, private/shared tag hint, long admin descriptions). Kept field labels, empty states, validation, danger confirmation, pending/frozen/read-only states, statistics scope/generated time/source. User-authored task/log/comment text containing the same words is displayed unchanged and excluded from the static scan. Record: `output/apply-copy-audit/report.md`. |
| 8.1 documentation | `backend/docs/hourly-schedule-drag.md`, `backend/docs/calendar-tags.md`, `backend/docs/current-checks.md`, `backend/docs/subordinate-workspace.md`, `docs/reviews/潘多拉-2026-11-04-变更对照.md` | Current interfaces, replaced rules, check mapping and native-client follow-up items recorded; archived evidence/history not rewritten. |
| 8.2 affected checks | Command/result table below; logs archived in `output/apply-checks-final/` | Real isolated MySQL + authenticated service + Chrome; Maven test/package and web-resource consistency; no old assertion conflicts remain unresolved. |
| 8.3 cross-module acceptance | `check_apply_final_acceptance.py`, `output/apply-acceptance/acceptance.md` | Roll-up verifies the six required scenarios and three widths from real reports/screenshots; worktree boundary checked (no `android/`, `android-shell/`, old migration changes). |
| 8.4 handoff | This file | Apply-owned handoff only; not an independent verification verdict. |

## Checks Run

| Command | Working directory / setup | Result / evidence | Run time |
| --- | --- | --- | --- |
| `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test` | `backend/` | PASS, 111 tests, 0 failures/errors/skips (`output/apply-checks-final/mvn-test-final.log`) | 2026-11-06 08:25 CST |
| `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 -DskipTests package` | `backend/` | PASS; final JAR includes all static changes; stale target V29 removed before rebuild | 08:25 CST |
| `python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar` | repository root | PASS 14/14; packaged resources byte-identical (`output/apply-checks-final/apply-web-resources-final.json`) | 08:25 CST |
| `PANDORA_FIXTURE_JAR=... python3 backend/scripts/check_apply_notifications.py` | repository root; disposable fixture port 18231 | PASS 59 checks incl. real worker reminders, request-access matrix, browser original-request entry and widths (`/tmp/rerun-notifications2.log`) | 08:28 CST |
| `PANDORA_FIXTURE_JAR=... python3 backend/scripts/check_apply_mixed_edit.py` | repository root; disposable fixture | PASS 66 checks; reviewer diff + owner form; split reports `review-report.json` / `owner-report.json` | 08:29 CST |
| `PANDORA_FIXTURE_JAR=... python3 backend/scripts/check_apply_log_tags.py` | repository root; disposable fixture | PASS 44 checks incl. log create/edit picker browser phase | 08:27 CST |
| `PANDORA_FIXTURE_JAR=... python3 backend/scripts/check_apply_admin_login_phone.py` | repository root; disposable fixture | PASS; API matrix plus admin console browser readback at 320/390/1440 | 08:26 CST |
| `PANDORA_FIXTURE_JAR=... python3 backend/scripts/check_apply_private_migration_guard.py` | repository root; disposable fixture | PASS | 08:18 CST |
| `PANDORA_FIXTURE_JAR=... python3 backend/scripts/check_apply_profile_pin_history.py` | repository root; disposable fixture | PASS | 08:18 CST |
| `PANDORA_FIXTURE_JAR=... python3 backend/scripts/check_calendar_tags.py` | repository root; disposable fixture | PASS (shared first tag, deleted snapshot, no private override, widths) | 08:18 CST |
| `PANDORA_FIXTURE_JAR=... python3 backend/scripts/check_subordinate_workspace.py` | repository root; disposable fixture | PASS 91 checks incl. comment-only chain, return state, widths | 08:19 CST |
| `PANDORA_FIXTURE_JAR=... python3 backend/scripts/check_schedule_drag.py` | repository root; disposable fixture port 18210; two browser phases | PASS 129 checks; cross-day/all-day exclusions, lightweight confirmation, retry idempotency, pending projection, approve/reject/withdraw/expire, widths | 08:19–08:20 CST |
| `PANDORA_FIXTURE_JAR=... python3 backend/scripts/check_calendar_drawer.py` | repository root; disposable fixture | PASS 102 checks; drawer/day-sheet/month stream/full-day projection/widths | 08:21 CST |
| `PANDORA_FIXTURE_JAR=... python3 backend/scripts/check_visible_schedule_permissions.py` | repository root; disposable fixture | PASS; schedule-only authority and field-level editing boundary | 08:21 CST |
| `PANDORA_FIXTURE_JAR=... python3 backend/scripts/check_review_routing.py` | repository root; disposable fixture | PASS | 08:20 CST |
| `PANDORA_FIXTURE_JAR=... python3 backend/scripts/check_business_takeover.py` | repository root; disposable fixture | PASS | 08:20 CST |
| `PANDORA_FIXTURE_JAR=... python3 backend/scripts/check_handover_chain.py` / `check_handover_preset.py` | repository root; disposable fixture | PASS | 08:20–08:21 CST |
| `PANDORA_FIXTURE_JAR=... python3 backend/scripts/check_fixed_notifications.py` | repository root; disposable fixture | PASS | 08:21 CST |
| `PANDORA_FIXTURE_JAR=... python3 backend/scripts/check_fixed_communication_web.py` | repository root; disposable fixture | PASS (final JAR) | 08:27 CST |
| `PANDORA_FIXTURE_JAR=... python3 backend/scripts/check_task_creation_refinement.py` | repository root; disposable fixture | PASS (shared multi-tag component, copy updates) | 08:22 CST |
| `PANDORA_FIXTURE_JAR=... python3 backend/scripts/check_fixed_web.py` | repository root; disposable fixture | PASS 189 checks (final JAR/resources) | 08:26 CST |
| `PANDORA_FIXTURE_JAR=... python3 backend/scripts/check_request_id_compat.py` | repository root; disposable fixture | PASS (response-loss retry identity) | 08:22 CST |
| `PANDORA_FIXTURE_JAR=... python3 backend/scripts/check_apply_copy_audit.py` | repository root; disposable fixture | PASS 42 checks; record `output/apply-copy-audit/report.md` | 08:27 CST |
| `python3 backend/scripts/check_apply_final_acceptance.py` | repository root; reads the reports above | PASS; record `output/apply-acceptance/acceptance.md` | 08:30 CST |
| `node --check` on every edited/new JS file; `node --check` browser checks; `git diff --check` | repository root | PASS | 08:30 CST |

## Verification Reminders

- These notes are an apply handoff only; they do not establish an independent verification verdict or archive readiness.
- `check_schedule_drag.py` now runs two browser phases and writes `output/task-schedule/handoff.json` to pass the expiry request to the second phase. Keep the handoff file path/phase logic together.
- `check_apply_mixed_edit_browser.js` writes `review-report.json` for the reviewer run and `owner-report.json` for the owner run; `browser-report.json` is the last run only. Use the split reports for evidence.
- `check_apply_copy_audit_browser.js` removes exact business strings before scanning; if the fixture business text changes, update both the fixture and the exclusion list. The AI page excludes the word cloud/suggestion bodies because they render real task text.
- `check_apply_admin_login_phone.py` changes the employee phone and revokes the old session; its browser phase checks the new value and explicitly exits the node process after killing Chrome.
- `check_fixed_web.py` and `check_web_resources.py` require the JAR to be rebuilt after any static edit; the final run used the rebuilt JAR.
- Tracked `audit/` evidence modified by the check runs was restored with `git restore audit/`; detailed logs are archived under `output/apply-checks-final/` (ignored by Git).
- Independent review should re-check: pending projection after mixed edits, the exact copy of the more-menu/action names, the admin phone wording, and the expired-request UI transition.
- Native Android adaptation remains separate: ordered `tagIds/tags`, removed private-tag route, field-level `editableFields`, current-progress-only employee projection, subordinate comment-only navigation and admin-only `loginPhone`.
