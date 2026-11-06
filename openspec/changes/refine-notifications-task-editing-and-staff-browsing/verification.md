# Implementation Verification

- Change: refine-notifications-task-editing-and-staff-browsing
- Schema: spec-driven
- Verdict: FAIL
- Verified at: 2026-11-06T08:54:55+08:00
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice`
- Verified revision: `f142a6ba59b8672ba6f2f2921e23a19af24c6318` (`xzs_refine_notifications`); worktree clean before verification. Only this report and the generated state are delivered.

## Summary

发现两项待修复 implementation findings：负责人选择器在资料刷新后仍使用旧人员对象（V-001，medium）；现行手机号隐私回归脚本仍断言管理员员工列表不能返回 `loginPhone`，与本 change 冲突并提前终止检查（V-002，low）。后者不是手机号泄露：本公司管理员专用读取已通过正向及越权矩阵。

本轮独立执行 Maven 111 tests 与 package、14 项 Web 资源检查、24 个专项脚本（23 PASS、1 FAIL）、真实空库/V20/V28 升级、原凭据登录及两个边界复现。覆盖 19 个 requirement、147 个 scenario；人员缓存刷新场景未满足，过时回归断言仍须修订。本轮未修复代码、测试或规划，不能归档。原生 Android、APK、部署和推送不在本轮范围。

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| `proposal.md`, `design.md`, `tasks.md`, delta `specs/pandora-requirements-aligned-prototype/spec.md` | Current on-disk artifacts returned by OpenSpec apply context; all read; 38 checked tasks treated as claims |
| Root employee Web, `admin.html`, `backend/src`, `backend/scripts`, manifests/config/current docs, main and delta specs | Generated inventory: 358 files; current revision above |
| `implementation-notes.md` | SHA-256 `7fdbb1f71eac5363bbcb3492306a43345767d22315e09dcfa447048c92e8ccff`; handoff read separately because snapshot helper excludes workflow files |
| `verification-state.json` | SHA-256 `b6b124e1e9bba55126d73c94b2e8b4c215fedd7dd2f22a0cb5775b281674ffab`; generated final inventory copied unchanged from after-check snapshot |

Full initial verification: no existing verification report or state was present, so there is no reusable independent baseline. No apply PASS or historical audit result was adopted as independent evidence. Focused change checks were followed by nearby routing, takeover, handover, workspace, identity, privacy and Web regressions because this change crosses authorization, persistence and shared navigation. Legacy credential/structure checks supplement the inherited account scenarios.

Snapshot commands (same roots/exclusions before and after):

```sh
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture --root /Users/watuji/MyGitDev/software_test_practice --exclude 'audit/*' --exclude 'output/*' --exclude 'android/*' --exclude 'android-shell/*' --exclude 'backend/target/*' --exclude 'backend/.runtime/*' --output /tmp/pandora-verify-before.json
# Repeat capture with --output /tmp/pandora-verify-after.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare /tmp/pandora-verify-before.json /tmp/pandora-verify-after.json
```

Compare exited 0 with `changed: false`; before/after SHA-256 are identical. `audit/*` and `output/*` are historical/generated evidence, native directories are explicit non-goals, and target/runtime contain builds/dependencies/caches/logs. Relevant code, tests, migrations, dependency manifests, configuration and controlling artifacts remain inventoried. Standard Git ignores and the helper's automatic workflow-file exclusions also apply. Existing tracked audit files were restored byte-for-byte from pre-run copies; no historical evidence is delivered changed.

Checks used the rebuilt current JAR, real authentication, local MySQL on 13306, random disposable databases and headless Google Chrome. MySQL initially was not running; sandbox connection denial was retried with authorization, then the existing local MySQL process was started. No normal business database was migrated or seeded. Fixtures cleaned up their own services/databases. Temporary orchestration/reproduction scripts and logs live under `/tmp`; decisive results and reproduction steps are recorded below so findings do not depend on temporary files.

## Apply Handoff Review

The handoff identifies the correct change/project and was updated at 2026-11-06 08:31 CST. Its `26900a0` reference is the main/base revision, not the verified implementation HEAD; the current implementation is `f142a6b`. Its implementation map is useful, but it does not establish a verdict.

| Handoff reminder / claim | Independent disposition |
| --- | --- |
| Notes are apply claims only | Confirmed; all results below were obtained this round |
| Schedule script needs both phases and `output/task-schedule/handoff.json` | Confirmed by T08: 129 checks including seven expiry-phase browser checks; expiry removes proposal and unfreezes task |
| Mixed edit needs separate reviewer and owner reports | Confirmed by T02: both `review-report.json` and `owner-report.json` were produced and checked, including stacked authorized diff and one mixed request |
| Copy scan excludes exact business fixture strings and AI business text | Confirmed by T21 and source inspection; 42 browser checks preserve real task/log/comment text and concise analysis provenance; exclusions are not evidence for arbitrary user text filtering |
| Admin phone change revokes session; browser uses new number and exits Chrome | Confirmed by T05 and T23 identity checks; real readback/new login/old-session rejection, three widths |
| Rebuild JAR after static edits | Confirmed: Maven package rebuilt resources; all 14 Web resource checks and all 30 packaged migration byte comparisons pass |
| Old tracked audit evidence must remain unchanged | Confirmed by byte-preserving restoration and final clean implementation worktree; temporary run logs were independently inspected |
| Recheck pending projection after mixed edits | T02 preserves effective title/progress/tags before approval and applies atomically; T08 independently verifies dashed proposed schedule, exact times/colour and approve/reject/withdraw/expire recovery |
| Recheck exact more-menu/action wording | T01 exercises `删除消息`, notification withdrawal and distinct `撤销本人申请`; native details/summary, confirmation handlers and sheet focus behavior inspected |
| Recheck admin phone wording and expired-request UI | T05 shows full real login phone without write-only copy; T08 expire phase returns to effective schedule, clears pending projection and unfreezes |
| Personnel safe-upsert/organization refresh complete | Direct merge/null/privacy cases pass T06; candidate selection refresh remains incorrect: V-001 |
| No old assertion conflicts remain | Not confirmed: T22 fails on an old admin-phone assertion: V-002 |
| Native adaptation remains separate | Confirmed as a scope boundary; no Android/APK result is claimed |

## Checks

OpenSpec strict validation: `openspec validate refine-notifications-task-editing-and-staff-browsing --type change --strict --json --no-interactive` → PASS, no issues. Resolve/status/apply instructions found complete planning and 38/38 claimed tasks.

`cd backend && mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package` → PASS: 111 tests, 0 failures/errors/skips; build succeeds. Unit evidence includes batched notification/log projections, bounded query counts (3 queries for both 1-row and 50-row log pages), comment authority, withdrawal redaction, phone boundaries and task authorization.

`python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /tmp/pandora-verify-web-resources.json` → PASS 14/14; source/package resources identical. A separate zip/source comparison confirms exactly 30 current migration files, no stale migration. `node --check` passes all 14 selected Web/current browser JS files; `git diff --check` passes.

All Txx commands below are `python3 backend/scripts/<script>` from the repository root and use the current packaged JAR. Counts include API and browser assertions, not independent test-case totals.

| ID | Script | Observed result |
| --- | --- | --- |
| T01 | `check_apply_notifications.py` | PASS (59 assertions) |
| T02 | `check_apply_mixed_edit.py` | PASS (66 assertions) |
| T03 | `check_apply_log_tags.py` | PASS (44 assertions) |
| T04 | `check_apply_private_migration_guard.py` | PASS (2 assertions) |
| T05 | `check_apply_admin_login_phone.py` | PASS (18 assertions) |
| T06 | `check_apply_profile_pin_history.py` | PASS (27 assertions) |
| T07 | `check_subordinate_workspace.py` | PASS (91 assertions) |
| T08 | `check_schedule_drag.py` | PASS (129 assertions) |
| T09 | `check_calendar_drawer.py` | PASS (102 assertions) |
| T10 | `check_calendar_tags.py` | PASS (26 assertions) |
| T11 | `check_visible_schedule_permissions.py` | PASS (22 assertions) |
| T12 | `check_review_routing.py` | PASS (204 assertions) |
| T13 | `check_business_takeover.py` | PASS (87 assertions) |
| T14 | `check_handover_chain.py` | PASS (24 assertions) |
| T15 | `check_handover_preset.py` | PASS (228 assertions) |
| T16 | `check_fixed_notifications.py` | PASS (49 assertions) |
| T17 | `check_fixed_communication_web.py` | PASS (32 assertions) |
| T18 | `check_task_creation_refinement.py` | PASS (77 assertions) |
| T19 | `check_fixed_web.py` | PASS (189 assertions) |
| T20 | `check_request_id_compat.py` | PASS (16 assertions) |
| T21 | `check_apply_copy_audit.py` | PASS (42 assertions) |
| T22 | `check_profile_phone_matrix.py` | FAIL after 13 passing assertions; V-002; subsequent assertions not executed |
| T23 | `check_login_identity_collision.py` | PASS (74 assertions) |
| T24 | `check_fixed_workspace_access.py` | PASS (62 assertions) |

| Manual check | Observed result |
| --- | --- |
| M01: V28 database with live/deleted/NULL single-tag logs → packaged V29/V30 | PASS: exact log ID/author/body/date/created_at/updated_at/deleted_at/row_version equality; first-created +24h freeze base unchanged; live/deleted tags become ordinal 0 snapshots, NULL becomes empty; old column gone; duplicate tag/order, negative ordinal and cross-company FK rejected |
| M02: Empty → V30 vs V20 → V30; original credential authentication | PASS: columns/indexes/FKs/CHECKs identical; original employee ID/password hash/creation time and original log identity/body/date/freeze base retained; after explicit legal placement, original phone/password authenticates as original employee ID |
| M03: Deleted tag update and personnel cache after administrator rename | Deleted-tag PATCH returns 409 and retained deleted log tag keeps deletion-time name/colour. Personnel reload returns new name, but reopened picker still returns/displays old name: V-001 |

M01/M02 were direct disposable-database experiments using the existing `Fixture`, `Mysql`, packaged Flyway runner and schema comparison helpers, not changes to project tests. M03 used real admin PATCH, authenticated employee Web, and headless Chrome.

## Requirement Coverage

The following rows cover each requirement's normative body and **every scenario** in that requirement. `L` numbers refer to scenario headings in `specs/pandora-requirements-aligned-prototype/spec.md`; duplicated inherited scenarios are deliberately retained. The selected spec's inherited “switch all-day” wording was evaluated with the established mobile date/time control and “设为全天” shortcut (current Web submits timed instants); legacy `allDay` reading and drag behavior were checked separately. No native-client claim is made.

| Requirement / explicit scenario references | Implementation and independent evidence | Result |
| --- | --- | --- |
| Task structure and attributes — L10, L14, L18, L22, L26, L30, L34, L38, L42, L46, L50, L54, L58, L62, L66 | `TaskService.validateForm/validateParent; task form and mobile time controls`; T18, T19, T12, T02 | PASS |
| Task editing and completion review — L79, L83, L87, L91, L95, L99, L103, L107, L111, L115, L119, L123, L127, L131, L135, L139 | `TaskService.change/validateRequestActor/validateApplicationEffect; unified editor and reviewer diff`; T02, T12, T11, T13 | PASS |
| Generated notification content and one object destination — L154, L158, L162, L166, L170, L174 | `WorkspaceService.safeNotification/requestAccess; notificationView and native details/summary menu`; T01, T16, T17 | PASS |
| Notification list presentation and combined filters — L183, L187, L191, L195 | `WorkspaceService.notificationCategory/Purpose and metadata filtering; notification list state`; T01, T18, T16 | PASS |
| Minimal profile page — L206, L210, L214, L218, L222 | `Pandora.rememberPeople, profile cards and TaskAdapter candidateCache`; T06, T07, T24, T23; M03; V-001 | FAIL at L222 (V-001); other four scenarios PASS |
| Hierarchical subordinate workspace — L235, L239, L243, L247, L251, L255, L259, L263 | `ProfileAdapter.staffView/refreshStaff; sheet stack; mutation comment guard`; T07, T24, T17 | PASS |
| Subordinate calendar month and day views — L272, L276, L280 | `ProfileAdapter.staffMonthHTML/staffDayHTML and calendar projection`; T07, T08 | PASS |
| Calendar dragging by presentation — L293, L297, L301, L305, L309, L313, L317, L321 | `CalendarAdapter.canDragDay/completeScheduleDrag; TaskAdapter.scheduleDraft`; T08, T09, T20 | PASS |
| Reschedule every visible active task — L330, L334 | `TaskService editableFieldsFor/change/reschedule; Web subordinate action guard`; T11, T07, T02 | PASS |
| Shared single-select tags for tasks and logs — L347, L351, L355, L359, L363, L367 | `WorkspaceService ordered log collections, Tags, V29; shared Web tag picker`; T03, T10, T18, T19; M01, M03; WorkspaceBatchReadTest | PASS |
| Role-scoped visibility — L376, L380, L384, L388, L392, L396, L400 | `Access/CompanyTree read scopes; TaskService and WorkspaceService projections`; T24, T05, T22, T16; T22 partial only, remainder corroborated by other checks | PASS |
| Account password lifecycle — L415, L419, L423, L427, L431, L435, L439, L443, L447, L451, L455, L459 | `AuthService/Credentials; OrganizationService management-only loginPhone; admin.html`; T23, T05, T19; M02; T22 stops at obsolete assertion (V-002) | Behavior PASS; test-suite conformance FAIL (V-002) |
| Complete task operation history — L470, L474, L478, L482, L486 | `TaskService admin history vs employee detail; admin.html history tab`; T06, T13, T12, T19, T16 | PASS |
| Production interface copy without redundant implementation explanations — L501, L505, L509, L513, L517, L521 | `Employee templates and admin.html; no filtering of business-authored text`; T21, T03, T01, T05, T19 | PASS |
| Calendar task views — L544, L548, L552, L556, L560, L564, L568, L572, L576, L580, L584, L588, L592, L596, L600, L604, L608, L612, L616, L620, L624, L628, L632, L636, L640, L644, L648, L652, L656, L660, L664, L668, L672, L676, L680, L684, L688, L692 | `CalendarAdapter month stream/day axes/drawer/day list and pendingSchedule`; T09, T08, T19, T10, T06 | PASS |
| Personal task table and founder-only tag maintenance — L700, L704 | `TaskAdapter personal table; founder-only Tags and profile tag management`; T19, T10, T17 | PASS |
| Personal calendar pin eligibility — L713 | `TaskService.taskView/setPinned; subordinate and history UI guards`; T06, T07, T17 | PASS |
| Stable shared tag color across task presentations — L720 | `taskColorVars, mapTask and ordered shared tag projection`; T10, T08, T07; M03 | PASS |
| Company shared tags without private overrides — L729, L733 | `V30 guard/cleanup; shared-only Tags and retired personal route`; T04, T10, T06; M01, M02 | PASS |

Proposal/design/task cross-check: the unified mixed transaction, field-level permissions, original-request access, comment-only subordinate context, sheet state, day-drag eligibility, lightweight version/idempotency confirmation, ordered log persistence, V29/V30 upgrade boundaries, shared first-tag colour, calendar-only pins, employee-history pruning, admin-only phone and visible copy were traced through current code and executable checks. Tasks 4.1–4.2 are incomplete at the candidate-cache boundary (V-001); task 8.2 still contains a conflicting current privacy assertion (V-002). No other confirmed implementation deviation or planning ambiguity was found. Residual limit: this is a local Web/backend verification basis, not a production deployment, native APK or real mobile WebView certification. The unexecuted tail of T22 is not counted as passing; equivalent identity/privacy behavior is covered by T05/T23/T24, Maven privacy tests and T19 Web checks.

## Findings

### V-001: Refreshed personnel remain stale in the assignee picker

- Category: implementation
- Severity: medium
- Requirement: delta `Minimal profile page`, scenario `Refresh a known person without losing organization fields` (L222), normative “组织或资料更新后重新读取 SHALL 刷新已有人员”; design decision 6 field-safe person refresh; tasks 4.1–4.2 explicitly include selectors.
- Evidence: `潘多拉-任务接入.js:121` caches create/edit arrays of person objects; `loadCandidates` at L124 only invalidates when `P.epoch` changes, and L133–137 retain object references. `潘多拉-api.js:479`–482 replaces `PEOPLE` objects on `Pandora.reload()` without invalidating those arrays. A real admin rename and Chrome reproduction returned `directory = "Updated employee name"`, `personById = "Updated employee name"`, but `assignablePeople(actor()) = "alpha-one-employee"`; actual picker search/render still displayed `alpha-one-employee` and no updated name.
- Expected: After an authorized personnel/profile refresh, existing selectors use the current safe personnel fields and search by the current name; the old selection state can remain, but stale identity/organization data cannot be retained until logout.
- Actual: A previously loaded picker survives a full current-data reload with its old person instances. Reopening the form/picker continues to display/search the old name.
- Reproduction: In an isolated fixture, sign in as founder and open creation once (`await openTaskForm('create')`) to fill the candidate cache; close the sheet. As the company admin, GET `/admin/employees/<employeeId>` then PATCH it with `{ "displayName": "Updated employee name" }`, fresh If-Match and Idempotency-Key. In the same founder browser, `await Pandora.reload(); await openTaskForm('create'); await openAssigneePicker()`. Compare `Pandora.data.users.find(p => p.id === employeeId).displayName`, `personById(employeeId).name`, and `assignablePeople(actor()).find(p => p.id === employeeId).name`; the first two are updated, the third is old. Search the old name to see the stale row; searching the new name cannot find it.
- Repair guidance: Make candidate caches track current authorized personnel/organization refreshes (and both create/edit modes), or resolve current safe person data instead of retaining stale objects. Preserve ordered selections and account/async isolation. Add meaningful coverage at this selector boundary; the current direct `rememberPeople` checks do not exercise it.
- Acceptance checks: Real admin rename/profile or organization update → employee refresh → reopen create/edit selector: updated name/identity/position/department/team must display and search correctly, removed candidates must not persist, existing legal selections remain. Re-run `check_apply_profile_pin_history.py`, `check_task_creation_refinement.py`, `check_apply_mixed_edit.py` and relevant late-response checks after repairing.
- Repair status: addressed-awaiting-verification
- Repair notes: Reproduced the real-admin rename in Chrome before editing: directory/personById refreshed while the picker still displayed/searched the old name. The new selector regression also failed against the old packaged implementation. Updated `潘多拉-任务接入.js` to invalidate both candidate modes when the authorized workspace snapshot/session changes, cache eligible IDs and resolve current safe person objects, and discard stale responses before merging/caching. Updated the script hash in `潘多拉-交互原型.html`. Added `backend/scripts/check_assignee_refresh_browser.js`, wired through `check_apply_profile_pin_history.py` and its browser script: real admin rename, position/identity/department/team change, candidate deactivation, both create/edit searches, ordered legal selections, safe-upsert refresh, delayed response after reload/logout and account isolation. Against the rebuilt JAR, `python3 backend/scripts/check_apply_profile_pin_history.py` passed 44 assertions; `check_task_creation_refinement.py` passed 77; `check_apply_mixed_edit.py` passed 66; `check_fixed_late_response.py` passed 9. Shared checks: `cd backend && mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package` passed 111 tests and packaged successfully; after the HTML hash update, `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 -DskipTests package` succeeded. `python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /tmp/pandora-repair-web-resources.json` passed 14/14. Changed JS syntax checks, Python compilation and `git diff --check` passed. Logs: `/tmp/pandora-repair-checks/`, Maven logs `/tmp/pandora-repair-maven.log` and `/tmp/pandora-repair-final-package.log`. Existing tracked audit evidence restored unchanged. Independent reverification remains required.
- Reverification notes: Reproduced independently three times against current JAR; one reproduction additionally opened/searched the actual Chrome picker and visually confirmed the stale row. No code/test fix was made.

### V-002: Current privacy regression rejects the newly authorized admin login phone

- Category: implementation
- Severity: low
- Requirement: delta `Account password lifecycle`, scenario `Verify the stored login phone after an administrator change` (L459); proposal explicitly replaces admin-phone write-only behavior; task 8.2 requires conflicting old assertions to be updated and affected privacy checks run.
- Evidence: `backend/scripts/check_profile_phone_matrix.py:29` includes `('admin','/admin/employees')` in the same blanket no-contact loop as public employee directories. L31 rejects any `"loginPhone"` in its response. Running `python3 backend/scripts/check_profile_phone_matrix.py` independently exits 1 after 13 passes with `FAIL /admin/employees summary has no contact, credential or username fields` / `AssertionError`. The remaining self-profile and phone-change assertions are never reached. T05 separately proves that the returned login phone is the authorized same-company admin-only behavior; employee/founder/cross-company reads are rejected.
- Expected: The current regression suite should allow and positively verify `loginPhone` on same-company administrator employee list/detail, while preserving no-phone assertions for public summaries, organization-plan projections and unrelated DTOs, plus employee/cross-company denial checks. It should run its remaining privacy/lifecycle cases to completion.
- Actual: The old write-only contract is still asserted for the administrator employee list, so a correct response fails the suite and prevents subsequent checks.
- Repair guidance: Narrow the blanket assertion to public projections and explicitly exercise the new administrator list/detail exception; retain all unrelated privacy, identity and session-revocation checks. Do not remove the legitimate management `loginPhone` field to satisfy this old assertion.
- Acceptance checks: `python3 backend/scripts/check_profile_phone_matrix.py` exits 0 and reaches every existing case under the updated contract; `python3 backend/scripts/check_apply_admin_login_phone.py` continues to pass, including cross-company/employee refusal and real login after change.
- Repair status: addressed-awaiting-verification
- Repair notes: Reproduced the original script failure after 13 passing assertions at the blanket `/admin/employees` no-loginPhone check. Updated only `backend/scripts/check_profile_phone_matrix.py`: kept public-directory/candidate/organization-plan redaction assertions, added positive same-company admin list/detail readback before and after normalized phone changes, checked absence of other private/credential fields, and added employee/founder route denial plus cross-company detail/list isolation. Preserved every existing self-profile, invalid-phone, stable-ID login, session-revocation and audit/event/idempotency privacy case. `python3 backend/scripts/check_profile_phone_matrix.py` now completes with exit 0 and 41 passing assertions; `python3 backend/scripts/check_apply_admin_login_phone.py` completes with exit 0 and 18 passing assertions, including employee/cross-company refusal, real changed-phone authentication, revoked old session and 320/390/1440 admin UI. Run logs are under `/tmp/pandora-repair-checks/`; existing tracked audit evidence restored unchanged. Independent reverification remains required.
- Reverification notes: This is a confirmed test-contract deviation, not an inferred privacy leak or environment failure. The test was not changed during verification.

Next action: `$openspec-e13-fix-change refine-notifications-task-editing-and-staff-browsing`, followed by independent re-verification. Relevant edits require comparing against this recorded state before archive.
