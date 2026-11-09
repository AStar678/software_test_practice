# Implementation Verification

- Change: refine-notifications-task-editing-and-staff-browsing
- Schema: spec-driven
- Verdict: PASS
- Verified at: 2026-11-06T09:25:45+08:00
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice`
- Verified revision: `6645417a19ac88960943d211f47f703fb10059c0` (`xzs_refine_notifications`); clean worktree at the repair-verification baseline; final basis includes the approved main-spec sync as an uncommitted documentation change. Verification edits only this report and generated state; spec edits were performed by the separate sync workflow.

## Summary

独立增量复验通过。V-001 的负责人选择器现在跟随最新合法人员资料及候选范围更新，并拒绝旧工作区/会话响应；V-002 的手机号隐私检查已按管理员专用读取例外修订，完整执行并保持普通目录及跨组织隐私边界。两项 finding 均为 `verified-resolved`，没有待处理发现或必需证据缺口。

本轮重新执行 OpenSpec 严格校验、Maven 111 tests/package、14 项 Web 资源检查及 8 个真实 API/Chrome 专项脚本；全部通过。19 个 requirement、147 个 scenario 的矩阵沿用上轮仍有效的独立证据，并更新受修复影响的行。原生 Android、APK、部署和推送不在验证范围。

## Verification Basis

Archive preparation synchronized the approved delta into the main spec. A further independent incremental verification checked that the only changed inventoried file since the 09:22 PASS was `openspec/specs/pandora-requirements-aligned-prototype/spec.md`. Its 19 affected requirement bodies and all 147 scenarios match the already verified delta exactly; the other 31 requirements, existing order, title and Purpose remain unchanged. Main-spec and change strict validation pass; main-spec output contains only informational long-text notices. No code, tests, dependency, configuration or execution conditions changed, so the API/browser/Maven evidence below remains applicable and was not rerun for this documentation-only merge. No new acceptance behavior or finding was introduced; verdict remains PASS.

The pre-sync saved-state SHA-256 was independently confirmed as `bfe851a3b51411fb168d92105f3640a2087bd813865bb6787c3cbdd10d96f868`. Post-sync captures use the identical root/exclusions, output `/tmp/pandora-sync-verify-before.json` and `/tmp/pandora-sync-verify-after.json`; comparison of the old saved state to the first capture exited 1 (only the main spec modified), and before/after comparison exited 0 (`changed: false`). Final state hash is recorded in the table below. Earlier “this round” test results below refer to the independently executed repair checks immediately before this sync follow-up.

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| `proposal.md`, `design.md`, `tasks.md`, delta `specs/pandora-requirements-aligned-prototype/spec.md` | All current context artifacts reread; delta/planning unchanged from repair verification; main spec now contains the approved delta merge; 38 checked tasks remain claims |
| Employee/admin Web, backend sources/scripts, manifests/config/docs and controlling specs | Generated inventory: 359 files; current revision above |
| `implementation-notes.md` | Reread; unchanged SHA-256 `7fdbb1f71eac5363bbcb3492306a43345767d22315e09dcfa447048c92e8ccff` |
| Previous independent baseline | `f142a6ba59b8672ba6f2f2921e23a19af24c6318`, 2026-11-06T08:54:55+08:00; saved-state hash independently matched prior report: `b6b124e1e9bba55126d73c94b2e8b4c215fedd7dd2f22a0cb5775b281674ffab` |
| Current `verification-state.json` | SHA-256 `c186624d4928947d51f4bf20055636b11f7e2a6afe00233d2f86d96feeaa1570`; generated final inventory copied unchanged from the after-check capture |

Incremental scope: comparison with the saved state exited 1 (changed, same inventory scope): new `backend/scripts/check_assignee_refresh_browser.js`; modified `check_apply_profile_pin_history.py`, its browser script, `check_profile_phone_matrix.py`, `潘多拉-任务接入.js` and its HTML cache hash. No other inventoried file changed. Git diff/history confirms this is the two-finding repair. All six inputs were inspected; planning, backend code, dependencies, migrations and environment setup remain applicable.

Candidate-cache changes also reach form validation and reopen selection, so this round reruns create/edit, mixed review, reopen/general Web, handover presets and late-response isolation, alongside both finding-specific suites. Other Txx evidence and M01/M02 below are reused from the prior independent run, not from repair claims. Backend build/unit checks were repeated, and all 30 migration resources were compared byte-for-byte against the current JAR. There is no reason to repeat unchanged full migration experiments or unrelated notification/calendar suites for this bounded repair.

Snapshot commands (same roots/exclusions before and after):

```sh
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture --root /Users/watuji/MyGitDev/software_test_practice --exclude 'audit/*' --exclude 'output/*' --exclude 'android/*' --exclude 'android-shell/*' --exclude 'backend/target/*' --exclude 'backend/.runtime/*' --output /tmp/pandora-reverify-before.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare openspec/changes/refine-notifications-task-editing-and-staff-browsing/verification-state.json /tmp/pandora-reverify-before.json
# Repeat capture with --output /tmp/pandora-reverify-after.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare /tmp/pandora-reverify-before.json /tmp/pandora-reverify-after.json
```

Before/after comparison exited 0 (`changed: false`), with identical SHA-256. `audit/*` and `output/*` are historical/generated evidence, native directories are explicit non-goals, and target/runtime are builds/dependencies/caches/logs. Relevant code, tests, migrations, dependencies, configuration and controlling artifacts remain inventoried. Standard Git ignores and automatic workflow-file exclusions apply. Tracked audit evidence was backed up before checks and restored byte-for-byte; newly generated audit files were removed. The verification workflow edited no implementation, tests, planning or handoff notes; the approved main-spec merge was performed separately by the sync workflow.

Checks used the newly packaged JAR, real authentication, local MySQL on 13306, random disposable databases and headless Chrome. Initial sandbox-denied MySQL connections executed no assertions; the same checks were rerun with approved local-service access and completed successfully. Fixtures cleaned up their services/databases. Logs: `/tmp/pandora-independent-reverification/`; Maven `/tmp/pandora-reverify-maven.log`; Web resource report `/tmp/pandora-reverify-web-resources.json`. Decisive results are retained below; temporary repair logs were not adopted as independent evidence.

## Apply Handoff Review

The unchanged handoff identifies the correct project/change and was updated at 2026-11-06 08:31 CST. Its `26900a0` base reference and implementation completion claims predate the independent baseline and repair; its implementation map remains applicable. It does not establish the verdict.

| Handoff reminder / claim | Independent disposition |
| --- | --- |
| Notes are apply claims only | Confirmed; evidence is independently obtained this round or explicitly reused from the prior independent baseline |
| Schedule check needs both phases and `output/task-schedule/handoff.json` | Reused T08: 129 checks including seven expiry-phase browser checks; expiry clears proposal and unfreezes task; code unchanged |
| Mixed edit needs separate reviewer and owner reports | Reconfirmed T02 this round: both split reports PASS; one atomic mixed request and authorized stacked diff |
| Copy scan excludes exact business fixture strings and AI business text | Reused T21 source/browser evidence: preserves authored text and concise provenance; unrelated code unchanged |
| Admin phone change revokes session; browser uses new number and exits Chrome | Reconfirmed T05/T22 this round: real readback, new login, revoked sessions and three widths |
| Rebuild JAR after static edits | Reconfirmed Maven package, Web resources 14/14 and all 30 migration bytes |
| Old tracked audit evidence remains unchanged | Confirmed byte-preserving restoration and final Git inspection |
| Pending projection after mixed edits | Reconfirmed effective-versus-proposed metadata/progress in T02; unchanged dashed schedule/approve/reject/withdraw/expire evidence reused from T08 |
| Exact more-menu/action wording | Reused T01: distinct delete/withdraw notification/withdraw own request labels and confirmations; affected source unchanged |
| Admin phone wording and expired-request UI | T05 reconfirmed current full phone wording; unchanged expiry UI evidence reused from T08 |
| Personnel safe-upsert/organization refresh complete | Reconfirmed T06 and T25; actual create/edit selectors now tested across rename, organization move, deactivation and delayed responses; V-001 verified-resolved |
| No old assertion conflicts remain | V-002 verified-resolved: revised T22 completes all 41 assertions; full prior failures are accounted for |
| Native adaptation remains separate | Scope boundary confirmed; no Android/APK result claimed |

## Checks

This round: `openspec validate refine-notifications-task-editing-and-staff-browsing --type change --strict --json --no-interactive` → PASS, no issues. Previously resolved status/apply context is complete, schema `spec-driven`, 38/38 claimed tasks.

`cd backend && mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package` → PASS: 111 tests, 0 failures/errors/skips; package succeeds. `python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /tmp/pandora-reverify-web-resources.json` → PASS 14/14. Source/package equality also passes for all 30 current migration files, without stale entries. Changed JavaScript syntax (`node --check` for the task adapter and both browser scripts), Python in-memory compilation and `git diff --check` pass.

Each Txx command is `python3 backend/scripts/<script>` from the repository root. Counts include API and browser assertions. Rows explicitly identify current reruns versus reused baseline evidence.

| ID | Script | Observed result |
| --- | --- | --- |
| T01 | `check_apply_notifications.py` | PASS (59 assertions); reused from independent baseline |
| T02 | `check_apply_mixed_edit.py` | PASS (66 assertions); rerun this round |
| T03 | `check_apply_log_tags.py` | PASS (44 assertions); reused from independent baseline |
| T04 | `check_apply_private_migration_guard.py` | PASS (2 assertions); reused from independent baseline |
| T05 | `check_apply_admin_login_phone.py` | PASS (18 assertions); rerun this round |
| T06 | `check_apply_profile_pin_history.py` | PASS (44 assertions); rerun this round |
| T07 | `check_subordinate_workspace.py` | PASS (91 assertions); reused from independent baseline |
| T08 | `check_schedule_drag.py` | PASS (129 assertions); reused from independent baseline |
| T09 | `check_calendar_drawer.py` | PASS (102 assertions); reused from independent baseline |
| T10 | `check_calendar_tags.py` | PASS (26 assertions); reused from independent baseline |
| T11 | `check_visible_schedule_permissions.py` | PASS (22 assertions); reused from independent baseline |
| T12 | `check_review_routing.py` | PASS (204 assertions); reused from independent baseline |
| T13 | `check_business_takeover.py` | PASS (87 assertions); reused from independent baseline |
| T14 | `check_handover_chain.py` | PASS (24 assertions); reused from independent baseline |
| T15 | `check_handover_preset.py` | PASS (228 assertions); rerun this round |
| T16 | `check_fixed_notifications.py` | PASS (49 assertions); reused from independent baseline |
| T17 | `check_fixed_communication_web.py` | PASS (32 assertions); reused from independent baseline |
| T18 | `check_task_creation_refinement.py` | PASS (77 assertions); rerun this round |
| T19 | `check_fixed_web.py` | PASS (189 assertions); rerun this round |
| T20 | `check_request_id_compat.py` | PASS (16 assertions); reused from independent baseline |
| T21 | `check_apply_copy_audit.py` | PASS (42 assertions); reused from independent baseline |
| T22 | `check_profile_phone_matrix.py` | PASS (41 assertions); rerun this round |
| T23 | `check_login_identity_collision.py` | PASS (74 assertions); reused from independent baseline |
| T24 | `check_fixed_workspace_access.py` | PASS (62 assertions); reused from independent baseline |
| T25 | `check_fixed_late_response.py` | PASS (9 assertions); rerun this round |

| Manual check | Independent evidence / disposition |
| --- | --- |
| M01: V28 database with live/deleted/NULL single-tag logs → V29/V30 | Reused PASS: exact log IDs/author/body/dates/create/update/delete/version and freeze base retained; ordinal-0 snapshots/empty set correct; old column removed; duplicate tag/order, negative ordinal and cross-company FK rejected |
| M02: Empty → V30 vs V20 → V30; original credential authentication | Reused PASS: final columns/indexes/FKs/CHECKs equal; original employee ID/password hash/creation time and log identity/body/date/freeze base retained; after legal placement, original credentials authenticate as original ID |
| M03: Deleted tag update; stale selector after real administrator rename | Deleted-tag 409/snapshot result reused. The original stale-selector FAIL is superseded by current T06: real admin rename + position/identity/department/team change → reload → both create/edit picker rows/search show current data, removed candidates disappear, ordered legal selections persist; safe summary upsert and reload/logout late-response checks pass |

M01/M02 were previous direct disposable-database experiments using the existing fixture, packaged Flyway runner and schema comparison helpers. M03's repaired selector behavior is established by a freshly executed real-admin API/Chrome regression, not by code shape alone.

## Requirement Coverage

The following rows cover each requirement's normative body and **every scenario** in that requirement. `L` numbers refer to scenario headings in `specs/pandora-requirements-aligned-prototype/spec.md`; duplicated inherited scenarios are deliberately retained. The selected spec's inherited “switch all-day” wording was evaluated with the established mobile date/time control and “设为全天” shortcut (current Web submits timed instants); legacy `allDay` reading and drag behavior were checked separately. No native-client claim is made.

| Requirement / explicit scenario references | Implementation and independent evidence | Result |
| --- | --- | --- |
| Task structure and attributes — L10, L14, L18, L22, L26, L30, L34, L38, L42, L46, L50, L54, L58, L62, L66 | `TaskService.validateForm/validateParent; task form and mobile time controls`; T18, T19, T12, T02 | PASS |
| Task editing and completion review — L79, L83, L87, L91, L95, L99, L103, L107, L111, L115, L119, L123, L127, L131, L135, L139 | `TaskService.change/validateRequestActor/validateApplicationEffect; unified editor and reviewer diff`; T02, T12, T11, T13 | PASS |
| Generated notification content and one object destination — L154, L158, L162, L166, L170, L174 | `WorkspaceService.safeNotification/requestAccess; notificationView and native details/summary menu`; T01, T16, T17 | PASS |
| Notification list presentation and combined filters — L183, L187, L191, L195 | `WorkspaceService.notificationCategory/Purpose and metadata filtering; notification list state`; T01, T18, T16 | PASS |
| Minimal profile page — L206, L210, L214, L218, L222 | `Pandora.rememberPeople, profile cards and TaskAdapter candidateCache`; T06 (rerun: real rename/organization/deactivation, safe upsert and delayed responses), T07, T24, T23, T25; V-001 verified-resolved | PASS |
| Hierarchical subordinate workspace — L235, L239, L243, L247, L251, L255, L259, L263 | `ProfileAdapter.staffView/refreshStaff; sheet stack; mutation comment guard`; T07, T24, T17 | PASS |
| Subordinate calendar month and day views — L272, L276, L280 | `ProfileAdapter.staffMonthHTML/staffDayHTML and calendar projection`; T07, T08 | PASS |
| Calendar dragging by presentation — L293, L297, L301, L305, L309, L313, L317, L321 | `CalendarAdapter.canDragDay/completeScheduleDrag; TaskAdapter.scheduleDraft`; T08, T09, T20 | PASS |
| Reschedule every visible active task — L330, L334 | `TaskService editableFieldsFor/change/reschedule; Web subordinate action guard`; T11, T07, T02 | PASS |
| Shared single-select tags for tasks and logs — L347, L351, L355, L359, L363, L367 | `WorkspaceService ordered log collections, Tags, V29; shared Web tag picker`; T03, T10, T18, T19; M01, M03; WorkspaceBatchReadTest | PASS |
| Role-scoped visibility — L376, L380, L384, L388, L392, L396, L400 | `Access/CompanyTree read scopes; TaskService and WorkspaceService projections`; T24, T05, T22 (full 41 assertions this round), T16 | PASS |
| Account password lifecycle — L415, L419, L423, L427, L431, L435, L439, L443, L447, L451, L455, L459 | `AuthService/Credentials; OrganizationService management-only loginPhone; admin.html`; T23, T05, T19; M02; T22 completes under current admin exception; V-002 verified-resolved | PASS |
| Complete task operation history — L470, L474, L478, L482, L486 | `TaskService admin history vs employee detail; admin.html history tab`; T06, T13, T12, T19, T16 | PASS |
| Production interface copy without redundant implementation explanations — L501, L505, L509, L513, L517, L521 | `Employee templates and admin.html; no filtering of business-authored text`; T21, T03, T01, T05, T19 | PASS |
| Calendar task views — L544, L548, L552, L556, L560, L564, L568, L572, L576, L580, L584, L588, L592, L596, L600, L604, L608, L612, L616, L620, L624, L628, L632, L636, L640, L644, L648, L652, L656, L660, L664, L668, L672, L676, L680, L684, L688, L692 | `CalendarAdapter month stream/day axes/drawer/day list and pendingSchedule`; T09, T08, T19, T10, T06 | PASS |
| Personal task table and founder-only tag maintenance — L700, L704 | `TaskAdapter personal table; founder-only Tags and profile tag management`; T19, T10, T17 | PASS |
| Personal calendar pin eligibility — L713 | `TaskService.taskView/setPinned; subordinate and history UI guards`; T06, T07, T17 | PASS |
| Stable shared tag color across task presentations — L720 | `taskColorVars, mapTask and ordered shared tag projection`; T10, T08, T07; M03 | PASS |
| Company shared tags without private overrides — L729, L733 | `V30 guard/cleanup; shared-only Tags and retired personal route`; T04, T10, T06; M01, M02 | PASS |


Proposal/design/task cross-check: prior independent tracing of unified atomic edits, field permissions, original-request access, comment-only subordinate navigation, day/month dragging, lightweight confirmation, log collections, V29/V30 upgrade, shared colour, pins, employee-history pruning, admin-only phone and copy remains applicable. This round additionally traces candidate IDs/current person resolution, snapshot/session invalidation, response sequencing, create/edit/reopen usage and the revised privacy matrix. Tasks 4.1–4.2 and 8.2 now have sufficient independent evidence. Every mandatory scenario has current or applicable prior independent evidence. Residual scope limit: local Web/backend verification does not certify deployment, native APK or actual mobile WebView.

## Findings

### V-001: Refreshed personnel remain stale in the assignee picker

- Category: implementation
- Severity: medium
- Requirement: `Minimal profile page`, `Refresh a known person without losing organization fields` (L222); design decision 6; tasks 4.1–4.2.
- Evidence: Prior baseline independently reproduced detached person-object caches after real admin rename. Current `潘多拉-任务接入.js:121`–145 stores IDs, resolves current safe people and invalidates on `P.data`/epoch; stale responses are rejected before merge/cache. T06 independently executes the original browser path and expanded boundary checks.
- Expected: Reopened selectors display/search current authorized name and organization fields, exclude removed candidates and preserve legal ordered selections; old account/query responses cannot restore stale data.
- Actual: All expectations above passed in both create/edit modes after real server-side rename, position/placement change and deactivation; safe upsert resolves current objects; held old responses after reload/logout do not repopulate cache or forms. Nearby create/edit/reopen/handover and account-isolation suites pass.
- Acceptance checks: T06 44, T18 77, T02 66, T25 9, T15 228 and T19 189 assertions PASS against rebuilt current JAR.
- Repair status: verified-resolved
- Repair notes: Reproduced the real-admin rename in Chrome before editing: directory/personById refreshed while the picker still displayed/searched the old name. The new selector regression also failed against the old packaged implementation. Updated `潘多拉-任务接入.js` to invalidate both candidate modes when the authorized workspace snapshot/session changes, cache eligible IDs and resolve current safe person objects, and discard stale responses before merging/caching. Updated the script hash in `潘多拉-交互原型.html`. Added `backend/scripts/check_assignee_refresh_browser.js`, wired through `check_apply_profile_pin_history.py` and its browser script: real admin rename, position/identity/department/team change, candidate deactivation, both create/edit searches, ordered legal selections, safe-upsert refresh, delayed response after reload/logout and account isolation. Against the rebuilt JAR, `python3 backend/scripts/check_apply_profile_pin_history.py` passed 44 assertions; `check_task_creation_refinement.py` passed 77; `check_apply_mixed_edit.py` passed 66; `check_fixed_late_response.py` passed 9. Shared checks: `cd backend && mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package` passed 111 tests and packaged successfully; after the HTML hash update, `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 -DskipTests package` succeeded. `python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /tmp/pandora-repair-web-resources.json` passed 14/14. Changed JS syntax checks, Python compilation and `git diff --check` passed. Logs: `/tmp/pandora-repair-checks/`, Maven logs `/tmp/pandora-repair-maven.log` and `/tmp/pandora-repair-final-package.log`. Existing tracked audit evidence restored unchanged. Independent reverification remains required.
- Reverification notes: Independently reran acceptance and nearby checks this round; no browser exceptions, candidate-refresh failures or new actionable deviations. Previous failure remains documented as baseline evidence, now resolved.

### V-002: Current privacy regression rejects the newly authorized admin login phone

- Category: implementation
- Severity: low
- Requirement: `Account password lifecycle`, `Verify the stored login phone after an administrator change` (L459); task 8.2.
- Evidence: Prior T22 failed after 13 passes on its obsolete blanket admin-list no-loginPhone assertion. Current `backend/scripts/check_profile_phone_matrix.py:29`–49 limits that assertion to public projections and positively verifies management-only readback plus employee/founder/cross-company denial.
- Expected: Allow and verify same-company management loginPhone while retaining public redaction, identity/privacy/session checks and completing the suite.
- Actual: T22 exits 0 after all 41 assertions, including the previously unexecuted lifecycle/audit/event/idempotency tail. T05 also exits 0 with 18 assertions, real login/readback/session revocation and 320/390/1440 admin UI.
- Acceptance checks: `check_profile_phone_matrix.py` and `check_apply_admin_login_phone.py` both PASS independently this round.
- Repair status: verified-resolved
- Repair notes: Reproduced the original script failure after 13 passing assertions at the blanket `/admin/employees` no-loginPhone check. Updated only `backend/scripts/check_profile_phone_matrix.py`: kept public-directory/candidate/organization-plan redaction assertions, added positive same-company admin list/detail readback before and after normalized phone changes, checked absence of other private/credential fields, and added employee/founder route denial plus cross-company detail/list isolation. Preserved every existing self-profile, invalid-phone, stable-ID login, session-revocation and audit/event/idempotency privacy case. `python3 backend/scripts/check_profile_phone_matrix.py` now completes with exit 0 and 41 passing assertions; `python3 backend/scripts/check_apply_admin_login_phone.py` completes with exit 0 and 18 passing assertions, including employee/cross-company refusal, real changed-phone authentication, revoked old session and 320/390/1440 admin UI. Run logs are under `/tmp/pandora-repair-checks/`; existing tracked audit evidence restored unchanged. Independent reverification remains required.
- Reverification notes: The regression now checks the accepted management exception without weakening public-directory or cross-company privacy. No implementation/test changes were made during verification.

Next action: `$openspec-e13-archive-change refine-notifications-task-editing-and-staff-browsing`. This PASS applies only to the recorded verification basis; relevant edits require re-verification before archive.
