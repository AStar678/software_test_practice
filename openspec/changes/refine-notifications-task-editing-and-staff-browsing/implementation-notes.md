# Implementation Notes

- Change: `refine-notifications-task-editing-and-staff-browsing`
- Schema / store: `spec-driven` / local
- Implementation root: `C:\Users\20943\Desktop\software_test_practice`
- Updated: 2026-11-05 00:02 CST
- Revision: `39b06ff` on `codex/apply-notifications-task-staff`, dirty worktree; implementation is not committed.
- Progress: 7/38 tasks checked. Code spans later tasks, but their full acceptance checks remain open.

## Implementation Map

| Task / requirement | Code and checks | Decision / status |
| --- | --- | --- |
| 1.1 ordered log tag migration | `backend/src/main/resources/db/migration/V29__work_log_multiple_tags.sql` | Empty V1→V30 and isolated V28→V30 migrations passed. On cloned V28 data, all 36 `work_logs` retained IDs, body, business date, creation and deletion timestamps; pre/post aggregate CRC 3445985899 matched. Original tag backfilled. Old `tag_id` and its FK/index removed; five constraints inspected. |
| 1.2–1.3 log collection contract | `WorkspaceService.java`, `backend/scripts/check_apply_log_tags.py`, `潘多拉-工作区接入.js`, `WorkspaceBatchReadTest.java` | Ordered `tagIds/tags`, transactional replacement; 17 real API checks passed including home, manager pagination, omitted collection, stale edit, live rename and deleted snapshot. A one-row and 50-row page each used three database queries in the batch test. |
| 1.4–1.5 remove private tags | `V30__remove_private_tags.sql`, `Tags.java`, `TaskController.java`, `潘多拉-标签评论.js`, `潘多拉-api.js`, `check_calendar_tags.py` | Isolated V28 clone with private sample migrated successfully; malformed reference guard aborts safely. Rewritten 12 API + responsive browser checks passed for shared catalogue, removed private route, ordered display and deleted first tag. Additional preservation and pin checks remain. |
| 2.1–2.6 field rights, mixed edit and reviewer diff | `TaskService.java`, `潘多拉-任务接入.js`, `backend/scripts/check_apply_mixed_edit.py`, `check_apply_mixed_edit_browser.js` | 14 real API checks and reviewer browser at 320/390/1440 passed. Diff now shows original above proposed and starts with full snapshots collapsed. More lifecycle, ordered tag/owner diff and other identity cases remain. |
| 3.1–3.5 notification categories and request links | `WorkspaceService.java`, `潘多拉-工作区接入.js` | Reminder/overdue categories, original-request access, event result and structured changes implemented; worker-backed mixed edit notification check passed. Further access and browser matrices remain. |
| 4–7 people, subordinate view, drag, labels, admin login phone | `潘多拉-api.js`, `潘多拉-个人资料.js`, `潘多拉-日程视图.js`, `潘多拉-交互原型.js`, `admin.html`, `OrganizationService.java` | Subordinate browser checks passed including overlap comment-only and all three widths. Schedule browser checks passed including cancel, lightweight confirmation, exact hour/day changes, full-day gating and year boundary. Admin phone API/browser passed. Further matrix and copy cleanup remain. |
| 7.3 log detail copy | `潘多拉-工作区接入.js` | Permission row removed; short freeze state with lawful edit action. Own editable/frozen and superior read/comment paths passed in fixed employee/subordinate checks. |

## Checks Run

| Command / setup | Result |
| --- | --- |
| `mvn -o -B -ntp -f .runtime-apply-pom.xml -Dmaven.repo.local=.runtime/m2 -DskipTests package`, `backend/` | PASS. Temporary POM redirects build to ignored `.runtime/target-apply` because Windows holds the old `target` JAR open. |
| `mvn -o -B -ntp -f .runtime-apply-pom.xml -Dmaven.repo.local=.runtime/m2 test`, `backend/`, outside sandbox for Mockito self-attach | PASS, 111 tests, 0 failures/errors/skips. |
| `python backend/scripts/check_apply_log_tags.py`, `PANDORA_FIXTURE_JAR=backend/.runtime/target-apply/pandora-backend-0.1.0.jar` | PASS, 17 real API checks against disposable DB. |
| `mvn -o -B -ntp -f pom.xml -Dmaven.repo.local=.runtime/m2 -Dtest=WorkspaceBatchReadTest test`, `backend/` | PASS, 7 tests including one-row versus 50-row log tag query bound. |
| `python backend/scripts/check_apply_mixed_edit.py`, same JAR and `CHROME_BIN` | PASS, 14 API checks plus 320/390/1440 reviewer browser checks. |
| `python backend/scripts/check_visible_schedule_permissions.py`, same JAR | PASS, 22 real API checks; old metadata permission assertion updated to current rule. |
| `python backend/scripts/check_fixed_notifications.py`, same JAR | PASS, existing real API notification, comment, freeze and retention checks. |
| `python backend/scripts/check_review_routing.py`, same JAR | PASS, existing real API review and handover routing checks. |
| `python backend/scripts/check_work_logs.py`, same JAR | Its workspace API portion passed; subsequent old browser script failed on Windows GBK decoding. UTF-8 fix applied. |
| `python backend/scripts/check_fixed_web.py`, same JAR and `CHROME_BIN=C:\Program Files\Google\Chrome\Application\chrome.exe` | PASS, admin and employee browser suites including admin login phone. Generated tracked `audit/` output must be restored before handoff. |
| `python backend/scripts/check_subordinate_workspace.py`, same environment | PASS, direct/deep reports, card→work, month/day/log, delayed response, 320/390/1440 and overlap comment-only with comment write and old action blocked. |
| `python backend/scripts/check_schedule_drag.py`, same environment | PASS, lightweight confirmation, hour/day precision, cancel, full-day and cross-day gating, point task, year boundary and three widths; outputs under `output/task-schedule/`. |
| `python backend/scripts/check_calendar_tags.py`, same environment | PASS, 12 real API checks and shared-tag browser workflow at 320/390/1440. |
| `python backend/scripts/check_apply_private_migration_guard.py`, same JAR | PASS, malformed private reference blocks V30 and preserves existing data. |
| `python backend/scripts/check_apply_admin_login_phone.py`, same JAR | PASS, 8 real API checks. |
| `python backend/scripts/check_calendar_drawer.py`, same environment | PASS, real browser month/day drawer, focus, gesture, 320/390/1440 layout, full-day projection and continuous month stream. Its generated tracked audit outputs were restored to HEAD after inspection. |
| `python backend/scripts/check_fixed_workspace_access.py`, same environment | PASS, report/log/person scope, privacy and manager replacement. |
| `PANDORA_CHECK_OUTPUT=output/communication-apply python backend/scripts/check_fixed_communication_web.py`, same environment | PASS, real shared tag/comment/notification browser including revoked content and historical read-only view. |
| `python backend/scripts/check_web_resources.py --repo . --jar backend/.runtime/target-apply/pandora-backend-0.1.0.jar --output backend/.runtime/apply-web-resources.json` | PASS, 14/14 source, package and served resource checks after final reviewer/tag cleanup. |
| `node --check` for edited JS/browser scripts; `git diff --check` | PASS after latest script edits; rerun near handoff. |

## Verification Reminders

- Do not treat these notes as independent verification or archive authority. 31 tasks remain unchecked.
- Temporary `backend/.runtime-apply-pom.xml` was removed after the tests; ignored `.runtime/target-apply` remains a local build aid. `PANDORA_FIXTURE_JAR` support in the fixture is intentional for isolated package runs.
- Full cross-module browser flow, remainder of the permission/lifecycle matrix, batching query counts and copy audit remain open.
- Historical notification events without provable structure retain their summary; new task event details supply authorized structured changes.
- The new reviewer diff browser covers title/progress layout and three widths; ordered owner/tag differences and create-without-old-value remain to test.
- Native clients need a separate later adaptation to `tagIds/tags`, removed private-tag routes, task `editableFields`, and subordinate navigation contract; no legacy dual-write is planned.
