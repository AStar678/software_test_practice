# Implementation Notes

- Change: `update-pandora-web-admin-from-oct25-checklist`
- Schema: `spec-driven`
- Store: local repo (`/Users/watuji/MyGitDev/software_test_practice/openspec`)
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice` (employee Web, `admin.html`, check scripts) and
  `/Users/watuji/MyGitDev/software_test_practice/backend` (Java/MySQL/Flyway, HTTP/browser checks)
- Updated: 2026-10-27T16:07:00+08:00
- Implementation revision: `79d583329ca2cc7377624a5e373e73969275fd03`. The worktree is dirty only with the 2026-10-27 planning revision
  (`proposal.md`, `design.md`, `specs/**`, `tasks.md`), this note, the new `audit/2026-10-27/` evidence, the supplemental
  `backend/scripts/check_demo_home_style.js` (untracked) and untracked `docs/reviews/更改指导.md`. Apart from that new check
  script, product code (`backend/**`, root Web `*.js/*.html/*.css/*.svg`, `admin.html`) is byte-identical to HEAD.
- Progress: **51/51 tasks complete**. This round closed 11.2 (re-run at the current revision) and 11.3 (this file).
  S01, the former tasks 10.4—10.8 and the shell half of 11.2 are out-of-scope handoff items: not implemented, not verified,
  and not part of this change's completion criteria.

## Current scope and handoff (supersedes the earlier "shell blocks this change" statement)

- In scope: employee Web, the standalone PC `admin.html`, the backend/data needed by them, and the demo preparation. Mobile
  **browser** adaptation is in scope; Android WebView/device behaviour is not.
- Out of scope by the 2026-10-27 planning revision: S01 and the former 10.4—10.8 plus the shell half of 11.2 — i.e. full
  employee-Web asset sync into `android-shell/`, navigation/bridge/keyboard/container patches, APK rebuild with the original
  signature and increased version, upgrade installation and real-device/WebView verification. These are handed to another
  implementer with the required signing key, Android SDK/build tools, apktool, adb and a device carrying the existing package.
- Consequence: **no Android package is produced or claimed**, and none is required to finish or archive this change. The two
  Android trees were not modified (`git diff --name-only ba0cb89..HEAD -- android android-shell` is empty).
  The handoff work is still unimplemented and unverified — it must not be recorded as delivered, fixed or PASS.
- The earlier note "旧套壳整体未交付（最重要）… 不能据此归档" described the old scope and is superseded as the current statement.
  Its historical fact remains true: the shell work was never done in this change; it is now out of scope instead of blocking.
- `verification.md` was not edited. It still holds the old-scope FAIL and V-004/V-005. The verify workflow must re-evaluate it
  against the revised planning and explain V-004/V-005 as removed from the current acceptance scope without marking them fixed.
- `docs/reviews/更改指导.md` (2026-10-27) is guidance for a **future new change**; it says so itself and is not a task
  attachment to this change. Its items (workspace button removal, drawer, four-layer organization model, username removal, etc.)
  were not implemented here and must not be read into this change's acceptance.
- Historical evidence boundary: old runs are not merged into one timeline. `audit/2026-10-25` was produced in
  earlier sessions, some of it **before** the 2026-10-25 fix commit `c6766fd`; the `*-fix.json` files there belong to the fix
  round. Nothing in `audit/2026-10-25` is relabelled as a result of this session. New evidence for this round is under
  `audit/2026-10-27/` only.

## Modified files at a glance

- Employee Web (repo root): 8 业务脚本 (`潘多拉-api.js`, `潘多拉-交互原型.js`, `潘多拉-任务接入.js`, `潘多拉-工作区接入.js`,
  `潘多拉-日程视图.js`, `潘多拉-任务表单.js`, `潘多拉-个人资料.js`, `潘多拉-标签评论.js`), `潘多拉-交互原型.html` and
  `潘多拉-日历.css` / `潘多拉-正式版.css` (cache-busting versions updated in the HTML).
- Admin: `admin.html` (task-history and notification tabs, employee creation with phone, no fabricated employee username).
- Backend: 20 main classes under `backend/src/main/java/cn/pandora/{auth,admin,task,workspace,profile,common,seed}` and
  5 tests under `backend/src/test/java`; `backend/src/main/resources/db/migration/V16`—`V20`; `backend/pom.xml` (explicit static
  resource list); `backend/database/README.md` and `backend/docs/migration-v16-20261025.md`; check/demo scripts under
  `backend/scripts/` (new `prepare_demo.py`, `check_demo_flow_browser.js`, this round's supplemental `check_demo_home_style.js`,
  plus the phone/login/comment/reports checks listed below).
- Not modified: `android/`, `android-shell/`, main specs, historical PRD, `verification.md`.

## Implementation Map (revised C01—C25, S01)

| 清单项 | Requirements / scenarios | Code and tests | Evidence / notes |
| --- | --- | --- | --- |
| C01 | Calendar shows only the current user's effective responsible normal tasks; 5.1, 10.2 | `潘多拉-日程视图.js` (personal projection; global authorized set untouched), `check_home_calendar_browser.js`, `check_mobile_calendar.js` | `audit/2026-10-25/chapter5-calendar-browser.json`, `chapter10-home-calendar.json` (historical) |
| C02 | Vertical 00:00—24:00 day axis; 5.4, 5.6 | `潘多拉-日程视图.js`, `潘多拉-日历.css` | same calendar evidence (historical) |
| C03 | Every overlapping and all-day task visible, no five-item cap; 5.5, 5.6 | `layoutDayEvents`, `p-allday-scroll`, `check_home_calendar_browser.js` | same calendar evidence (historical) |
| C04 | Sidebar and floating create entry points; 5.2, 5.6 | `潘多拉-日程视图.js`, `潘多拉-日历.css` | same calendar evidence (historical) |
| C05 | Task form opens/returns from the calendar; 6.1, 6.3 | `潘多拉-任务表单.js`, `check_task_form.js` (85) | `audit/2026-10-25/chapter10-task-form.json` (historical) |
| C06 | Company-wide effective employee creation candidates; 3.1, 3.6 | `Access.creationCandidates`, `TaskService`, `check_review_routing.py` (79) | `audit/2026-10-25/chapter10-review-routing.json` (historical) |
| C07 | Creation reviewed only by the creator's direct manager; 3.2—3.4, 3.6 | `TaskService.creationRoute`, `CompanyTree`, `TaskServiceTest`, `check_review_routing.py` | same routing evidence (historical) |
| C08 | Founder/creation exemption and non-creation prompts agree; 3.5, 4.5 | `潘多拉-任务接入.js`, `TaskService`, `check_task_creation_flow.js` (20) | `audit/2026-10-25/chapter10-task-creation-flow.json` (historical) |
| C09 | Reopen carries a new schedule; 4.3, 4.5 | `TaskService.reopen`, `潘多拉-任务接入.js`, `TaskServiceTest` | same creation-flow evidence (historical) |
| C10 | Expired creation/resubmission; 4.4, 4.5 | `TaskService`, `潘多拉-任务接入.js`, `LegacyCreationRoutes` | same creation-flow evidence (historical) |
| C11 | Authorized item diff with ordered assignees; 4.6, 10.2 | `TaskService.diff`, `differenceHTML`, `check_review_routing.py`, `check_task_form.js` | historical routing/task-form evidence |
| C12 | PC task history search; 9.1, 9.2, 9.5 | `TaskService.adminTasks`, `TaskService.taskHistory`, `AdminController GET /api/v1/admin/tasks`, `admin.html`, `check_admin_console.py` (53), `check_admin_console_browser.js` (28) | `audit/2026-10-25/chapter9-admin-{console,browser}.json` (historical) |
| C13 | PC notification management with the 180-second withdrawal boundary; 9.3, 9.5 | `admin.html` tab, `WorkspaceService.adminNotifications`, `withdrawEvent`, `check_admin_console*.js/py` | same admin evidence (historical) |
| C14 | Restricted team entry for an authorized department head; 9.4, 9.5 | `TeamManagementController GET /api/v1/me/team-management`, `OrganizationService.teamManagement`, `潘多拉-个人资料.js`, write reuses `/api/v1/admin/teams` | same admin evidence (historical) |
| C15 | Employee phone login and account consistency; 1.1, 2.1—2.4 | `PhoneNumbers`, `AuthService`, `LoginKeyConstraints`, `V19`, `admin.html`, `check_account_lifecycle.py`, `check_account_browser.js` (18), `AuthServiceLoginTest`, `PhoneNumbersTest` | `audit/2026-10-25/chapter10-account-browser.json`, `chapter2-*.json` incl. `-fix` (historical) |
| C16 | Persistent demo data and a continuous Web demo; 11.1—11.3 | `prepare_demo.py`, `check_demo_flow_browser.js` (15), `check_demo_home_style.js` (5), `DemoSeed` identity/organization | **new** `audit/2026-10-27/` (15/15 + 5/5 + DB counts + screenshot); see Checks Run |
| C17 | Continuous cross-month waterfall; 5.3, 5.6 | `monthStream`/`appendStreamMonth`, `check_home_calendar_browser.js` | historical calendar evidence |
| C18 | Creation without acceptance criteria, creator may not be an assignee; 4.1, 4.5 | `TaskService.rejectCreationCriteria` (removed validation), `潘多拉-任务接入.js`, `check_task_form.js` | historical task-form/creation-flow evidence |
| C19 | Web time control instead of the system picker (mobile browser); 4.2, 4.5, 10.3 | `潘多拉-api.js timeControl`, `TaskService` schedule validation, `check_task_creation_flow.js` | historical creation-flow evidence; shell/device part out of scope, so none claimed |
| C20 | Notification list explains purpose with object name/summary; 8.5, 8.6, 10.3 | `潘多拉-工作区接入.js`, `WorkspaceService.notificationPurpose`, `check_notification_browser.js` (23×2) | `audit/2026-10-25/chapter10-notification-{mobile,desktop}.json` (historical) |
| C21 | Log naming and department→team→person search; 7.3, 7.4, 10.3 | `潘多拉-工作区接入.js`, `WorkspaceService.logAuthors`, `check_logs_profile_browser.js` (26×2) | `audit/2026-10-25/chapter10-logs-profile-{mobile,desktop}.json` (historical) |
| C22 | Three-day backfill and 24-hour freeze from first creation; 1.2, 7.1, 7.2, 7.4 | `WorkspaceService`, `WorkLogSlots`, `V16`, `WorkspaceLogAndReportsTest`, `check_work_logs.py` (34) | `audit/2026-10-25/chapter7-work-logs.json` (historical) |
| C23 | Shared single tag and founder maintenance; 1.3, 8.1—8.3, 10.3 | `Tags`, `V17`, `潘多拉-标签评论.js`, `check_tags_comments.py` (41), `check_tags_comments_browser.js` (23×2) | historical chapter8/10 tag evidence |
| C24 | Flat comments, author control, targeted notifications; 1.4, 8.4—8.6, 10.3 | `CommentService`, `EventsWorker`, `V18`, `V20`, browser/HTTP tag-comment checks | historical chapter8/10 evidence; comment fix files under `*-fix.json` |
| C25 | Mobile task-form column priority; 6.2, 6.3 | `潘多拉-任务表单.js`/`.css` (17 columns, title-first), `check_task_form.js` (85) | historical task-form evidence |
| S01（范围外） | Legacy shell asset sync, adaptation, APK and device verification | none — handed off | Not implemented, not verified; requires signing key, Android tooling, apktool, adb and a device. Not a prerequisite for this change. |

## Migrations, data and shared-backend compatibility

Forward-only Flyway migrations, added on top of the existing V1—V15 (no historical migration rewritten):

| Migration | Purpose |
| --- | --- |
| `V16__work_log_day_slot.sql` | Adds `deleted_at` + `recovered_from` to `work_logs` and the day-slot index; keeps one slot per author/business day and never resets the real `created_at`. Reconstructable historical deletes are materialised by `WorkLogSlots`; unrecoverable ones are recorded in `migration_findings`. |
| `V17__tags_and_task_tag_snapshot.sql` | Company-level tag catalogue, single nullable `tag_id` on task versions/logs plus name/color snapshots, single-tag constraints. |
| `V18__flat_comments.sql` | `task_log_comments` with object type/reference, author, body, edited/deleted timestamps, row version and pagination indexes. |
| `V19__employee_phone_login.sql` | Adds the separate `login_phone` authentication key and its unique index, with staged backfill and blockers instead of invented numbers. |
| `V20__notification_object_refs.sql` | Adds `object_type`/`object_id` to `domain_events`/`notifications`, backfills task references only, records messages without an object reference as a limitation. |

Migration support: `backend/scripts/migration_precheck.py`, `check_migration_foundation.py`, `check_database.py`,
`backend/docs/migration-v16-20261025.md`, `backend/database/README.md`. Historical evidence: `audit/2026-10-25/chapter1-*.json`,
`chapter2-*.json`.

Shared-backend compatibility impact (recorded, not hidden):

- **Employee authentication**: `POST /api/v1/auth/sessions` keeps the `username`/`password` body shape, but an employee must send a
  normalized phone number in `username`; the single administrator keeps the original account name. `username` remains a public
  display field and is **not** replaced by the phone; `login_phone` is auth-only. Old employee clients/scripts that log in with a
  username fail, and no migration invents phone numbers.
- **Work logs**: only company today/yesterday/the day before can be written; editing/deleting freezes 24 hours after the first
  `created_at` instead of midnight; deletion keeps the day slot (delete + recreate cannot reset the clock); responses expose
  `editable`/`deletable`/`frozenAt`. Clients assuming physical deletion or midnight freeze see different results.
- **Tags**: a task/log carries at most one tag; multi-tag writes are rejected; task diffs/history keep name/colour snapshots while
  current references resolve through the catalogue. Additive for readers, but old clients cannot submit multiple tags.
- **Comments**: new list/post/edit/delete endpoints and independent persistence; business freeze does not lock comments.
- **Notifications**: task messages keep their `task_id`; comment messages use the new object reference. The new columns are
  additive; historical messages without an object reference cannot jump to an object.
- **Admin/team endpoints**: `GET /api/v1/admin/tasks` (paginated admin task lookup) and `GET /api/v1/me/team-management`
  (minimal restricted read) are new. Team writes still reuse `POST/PATCH /api/v1/admin/teams` with server-side
  `manage_team` + department re-authorization; the `admin` path prefix does not mean admin-only.
- **Creation review routing**: only creation/creation-resubmission moved to the creator's direct manager (founder or a proven
  root exempt); existing non-creation ordered routing, reassignment and handover remain. Existing pending creation requests are
  re-decided under the new rule.
- **Creation payload**: `acceptanceCriteria` is no longer required or requested for creation; historical values are preserved and
  still displayed by the task form.
- **Web delivery**: cache-busting `?v=` values changed and `backend/pom.xml` has an explicit static-resource list; the old Android
  shell still contains stale Web assets and is affected by the backend contract changes — a handoff risk, not something this
  change fixes.

## Checks Run

Backend cwd `backend/` unless noted. `{base}`/`{db}` stand in for the isolated URL/database. This session had no write to the
project `pandora` database; the dedicated demo DB was dropped after the run.

| Command | Working directory / setup | Result / evidence | Run time / revision |
| --- | --- | --- | --- |
| `mvn -B -ntp -o -Dmaven.repo.local=.runtime/m2 -DskipTests package` | `backend/` | BUILD SUCCESS; jar rebuilt from `79d5833`, sha256 `e12b3b69…61b` | 2026-10-27 15:53, `79d5833` |
| `python3 scripts/check_web_resources.py --repo .. --jar target/pandora-backend-0.1.0.jar --output ../audit/2026-10-27/chapter10-web-resources.json` | `backend/` | 14/14 — cache versions, override order, Maven list, jar bytes | 2026-10-27 15:53, `79d5833` |
| `prepare_demo.py --base-url {base}` ×2 on dedicated DB `pandora_demo_e13_1793088020` | `backend/`; `PANDORA_SEED=true`, `PANDORA_WORKER_ENABLED=true`, port 18130 | run 1 created 7 company items / 76 tasks / 1 comment / 0 tags; run 2 created 0 and reused 76 tasks / 1 comment / 1 tag | 2026-10-27 16:00, `79d5833` |
| `node scripts/check_demo_flow_browser.js --base-url {base} --output ../audit/2026-10-27/chapter11-demo-web.json` | headless Chrome 390×844, worker on | **15/15**: `middle` session home → notification → approval → task form filter/sort/page/detail → subordinate logs → full reload; no role switch; no script errors | 2026-10-27 16:00, `79d5833` |
| Row counts via `mysql --defaults-file=.runtime/mysql-admin.cnf` after stopping the backend | same DB | `audit/2026-10-27/chapter11-demo-db.txt`: 6 phone-login employees, 10 company items, 76 demo tasks, 3 pending demo tasks, 2 tags, 3 comments, 256 notifications; 张涛 3 logs; middle 1 current assignment + 3 logs | 2026-10-27 16:00, `79d5833` |
| Restart backend on the same DB, then `node scripts/check_demo_home_style.js … --screenshot ../audit/2026-10-27/chapter11-demo-home.png` | headless Chrome 390×844 | **5/5**: ten company items as ten visible rows in four styled cards, two-column grid, no 390px overflow, no script errors; data survived the restart | 2026-10-27 16:00, `79d5833` |
| `node --check scripts/check_demo_home_style.js`; `git status --porcelain -- backend '*.js' '*.html' '*.css' '*.svg' admin.html`; `git diff --name-only ba0cb89..HEAD -- android android-shell` | repo root / `backend` | syntax OK; only the new supplemental script is untracked (no other product-code changes); zero Android-tree changes | 2026-10-27 16:06 |

Historical checks (earlier sessions, **not rerun this round**; kept with their original evidence paths):

| Check | Result | Evidence |
| --- | --- | --- |
| `mvn test` | 77 tests, 0 failures | run 2026-10-25 15:28, `ba0cb89` dirty |
| `check_admin_console.py` / `check_admin_console_browser.js` | 53 / 28 | `audit/2026-10-25/chapter9-admin-*.json` |
| `check_task_creation_flow.js` (20), `check_review_routing.py` (79), `check_handover_preset.py` (29), `check_submit_lock_deadline.py` (5), `check_task_form.js` (85), `check_handover_browser.js` (23), `check_deadline_reminder_notification.py` (91) | as listed | `audit/2026-10-25/chapter10-*.json` |
| `check_logs_profile_browser.js` 26×2, `check_tags_comments_browser.js` 23×2, `check_notification_browser.js` 23×2, `check_home_calendar_browser.js` 34, `check_account_browser.js` 18 | as listed | `audit/2026-10-25/chapter10-*.json` |
| `check_mobile_calendar.js` (13), `check_calendar_sort.js` (4), chapter 5/7/8 HTTP checks (`check_work_logs.py` 34, `check_tags_comments.py` 41) | as listed | `audit/2026-10-25/chapter{5,7,8}-*.json` |
| Fix-round files `chapter1-migration-fix.json`, `chapter2-*-fix.json`, `chapter8-*-fix.json`, `chapter10-web-resources-fix.json` | produced after commit `c6766fd` | `audit/2026-10-25/` |

Not run / not applicable this round:

- S01 / former 10.4—10.8 / shell half of 11.2: **out of scope**, not run; no APK, signature, upgrade or device evidence exists and
  none is claimed. The machine also lacks the original keystore, Android SDK/apktool and adb/test device.
- No production deployment, no destructive data migration rehearsal beyond the isolated databases, no real old-client (shell)
  regression: only the Web and backend behaviour was exercised.
- `check_chapter11_browser.js` (old layout script) still aborts after its task-form section because closing the create sheet is
  re-shown by current interaction; it is not used as acceptance evidence for 10.3 and was not repaired here.
- Chapters 1—10 checks were not re-run this round. The product code is unchanged since `79d5833` and the current-run evidence is
  limited to 11.2 plus the 10.1 resource packaging check; do not present the historical rows as this session's results.

## Verification Reminders

- **Scope re-evaluation is required.** The spec/tasks now exclude Android delivery. Re-verify against `tasks.md` and the delta spec,
  not against the old FAIL rationale. V-004/V-005 must be described as removed from the current acceptance scope (handoff), never
  as fixed or verified. `verification.md` is untouched by apply.
- **11.2 evidence is fresh** at `79d5833` and supersedes the old `audit/2026-10-25/chapter11-demo-web.json`. Reproduce with
  `audit/2026-10-27/chapter11-demo-web-version.txt`; the demo DB was dropped. `prepare_demo.py` is idempotent by title/date and uses
  the current date, so reruns create new dates; notification counts drift with worker retries (256 is not a fixed assertion).
- **Home-style evidence is supplemental**, not a task requirement: `backend/scripts/check_demo_home_style.js` (added this round)
  proves the ten company items are real styled rows after a backend restart, and produced the screenshot. It needs the prepared
  demo data and worker; do not confuse it with the Android shell demo, which is out of scope.
- **Historical evidence is mixed-old.** Some `audit/2026-10-25` files predate the fix commit; use the `*-fix.json` files for
  post-fix claims or rerun the relevant script. This round reran only the 10.1 resource check and 11.2; historical counts above are
  not this session's results.
- **Compatibility surface to watch**: employee login now uses the phone value in the `username` request field; `login_phone` must
  stay out of public DTOs; the `admin` path prefix on team writes is not admin-only; `GET /api/v1/admin/tasks` must keep returning
  display fields only; task/log details in the admin console must not leak phone/email/password.
- **Browser ≠ device.** All new results are headless Chrome on mobile/desktop sizes; they say nothing about Android WebView, system
  keyboard/back behaviour, safe areas or upgrade installation — that is precisely the out-of-scope S01 handoff.
- **Worktree dirty.** The plan revision, this note, `audit/2026-10-27/` and `docs/reviews/更改指导.md` are uncommitted. Commit (or
  explicitly decide otherwise) before archive, then re-run verify against the committed tree; note that `AGENTS.md` is also modified.
- **These notes are apply self-checks, not an independent e13 verdict.** Do not treat them as PASS, do not edit `verification.md`,
  and do not back-fill the PRD as accepted.

## User-directed closure and deferred finding (2026-10-27)

用户在独立复验后明确指示：若日志问题已记录于 `docs/reviews/更改指导.md`，即结束当前 change，尽快提交推送；PR 由用户自行创建。已核对该文档第 7 节及验收清单，完整记录 `dateKey` 私有作用域错误、修复方向和真实页面验证要求。

因此本 change 按用户接受已知问题的明确例外结束并归档，偏离 e13 archive 技能的当前 PASS 门槛。`verification.md` 原样保留 **FAIL**；V-006 仍为未修复的日志 Web 缺陷，交由后续 change 处理，不声明已修复或已通过。报告其余 Partial 证据边界也保留，不将本次结束解释为全场景验证通过。后续新 change 尚未创建。

安卓 V-004/V-005 已按修订规划移出当前范围、另行交接，未实施且未验证。主规格同步的是行为契约，不是无缺陷验收声明。本次收尾不修改业务实现、不创建 PR、不合并 main。
