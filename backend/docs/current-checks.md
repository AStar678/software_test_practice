# Current fixed-organization checks

## 2026-11-04 change under implementation

`refine-notifications-task-editing-and-staff-browsing` replaces the earlier private-tag and single-log-tag behavior. The checks below document the historical fixed-organization baseline. Current targeted real-service entries are:

| Current suite | Coverage added or changed by this change |
| --- | --- |
| `check_apply_notifications.py` | Real reminder/overdue events, filters, result/changes projection, independent `canReadRequest`, more-menu request withdrawal, 320/390/1440 detail |
| `check_apply_mixed_edit.py` | Field-level `editableFields`, mixed metadata+progress request, reviewer diff, owner-order refusal, saved current reviewer |
| `check_apply_log_tags.py` | Ordered `tagIds/tags`, transactional writes, deleted/foreign/duplicate rejection, real Chrome shared picker in log create/edit |
| `check_apply_private_migration_guard.py` | V30 private-reference blocking and shared data preservation |
| `check_apply_admin_login_phone.py` | Admin-only list/detail `loginPhone`, real login after change, admin console browser readback at three widths |
| `check_apply_profile_pin_history.py` | Safe people upsert, profile labels, personal pin eligibility, employee current-progress-only detail |
| `check_calendar_tags.py` | Shared first-tag colour, deleted snapshot, no private override, widths |
| `check_subordinate_workspace.py` | Person card → schedule/log, read-only chain, comment-only writes, return/state and stale-response isolation |
| `check_schedule_drag.py` | Month/day geometry, all-day/clipped-segment drag exclusion, lightweight confirmation, response-loss retry, pending dashed projection and approve/reject/withdraw/expire recovery |
| `check_calendar_drawer.py` | Drawer/day sheet/month stream, full-day projection, widths |
| `check_visible_schedule_permissions.py` | Schedule-only authority beside field-level editing |
| `check_request_id_compat.py` | Response-loss retry identity and one saved request |
| `check_apply_copy_audit.py` | Reachable employee five pages, notification/application/task/log/person surfaces and admin console: no development explanations, required labels/validation/provenance retained, real business text unfiltered |

`check_visible_schedule_permissions.py` and `check_fixed_employee_browser.js` follow field-level owner editing, ordered log tags, and the person-card entry. Results and remaining acceptance work are recorded in the change's `implementation-notes.md`; no old report is relabeled as a current verdict.

The native clients must later consume `tagIds/tags`, remove the personal-tag route, honor `editableFields`, and adopt the subordinate read-only navigation. This implementation does not add a legacy dual-write API.

Build first (`cd backend && mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package`), start the project MySQL, then from the repository root run:

```sh
python3 backend/scripts/check_final_workflow.py --phase all
python3 backend/scripts/check_daily_items.py          # daily items + three-section home, API and Chrome
```

Each suite owns random databases, its temporary JAR/Chrome processes and cleanup. Reports and logs go to `audit/refactor-pandora-organization-and-workflows/`. No suite changes the normal database or uses employee usernames, editable role grants or explicit self-approval. Credentials stay in private runtime files. Historical V20 mapping/migration fixtures deliberately still construct the old schema to test real upgrades; they are not current API callers.

Old command filenames now delegate to the suites below. Their old external `--base-url`/fixture arguments are rejected rather than accidentally testing another database. Use the new suite directly to select coverage. This consolidates duplicated checks; it does not carry forward their old verdicts.

| Previous check area | Current suite / retained behavior |
| --- | --- |
| Account lifecycle, login collisions, migration ambiguity | `check_login_identity_collision.py`: strict namespaces, collision rejection, forced initial/reset gates, password policy, session refresh/logout/all-session revocation, credential-free receipts and replays, company boundaries; `check_legacy_mapping.py` and `check_final_migration.py`: real legacy identities/history |
| Organization, mapping write gate, old roles | `check_organization_plans.py`, `check_admin_contract.py`: fixed coverage, final drafts, head swaps, rollback/concurrency, readiness repair, retired writes, display-only positions, independent admin |
| Reviewer routing, deadline locks, phone-cycle changes | `check_review_routing.py`, `check_business_takeover.py`: create direct-manager/founder route, non-create current responsibility, strict direct apply, expiry, freeze, versions/idempotency, event/reminder matrix, reroute/old-page and takeover/deactivation races |
| Dedicated handover and presets | `check_review_routing.py`, `check_handover_chain.py`: self/direct-manager authority, work-circle recipients, no base-field injection, real admin/employee browser approval and departure/takeover chain |
| Profile privacy, reports, logs, analytics | `check_profile_phone_matrix.py`, `check_fixed_workspace_access.py`: direct/indirect hierarchy, private fields, administrator-only identity edits/session revocation, query/aggregate scopes and stale authorization; `check_fixed_web.py`, `check_log_backfill_entry.py`: real log editor/backfill/freeze/delete-recreate/person entry and personal-item IDs |
| Home, calendar, task creation/form | `check_fixed_web.py`, `check_calendar_drawer.py`, `check_schedule_drag.py`: 320×740, 390×844, 1440×900, three home modules, priority visibility, complete global sort/filter/paging, effective version, nested returns, drawers/sheets/focus/touch, full-day projection and concurrency, continuous months/year/retry, day-axis drag eligibility, lightweight confirmation and pending proposal recovery |
| Daily items and the three-section home | `check_daily_items.py` (API, V30→V31 upgrade and empty-chain migration) and `check_daily_items_browser.js` + `check_daily_items_refresh_browser.js` (real Chrome): 首页/公司 naming, event record/task board/daily items, at least three complete single-line rows per upper card with an independent scroll area, creator-inclusive board ordering and ten-item cap, private owner scope for every route, leap/invalid dates and 1–2000 body bounds, stable created_at/id paging past 100 rows, one total-based marker per day (width from open+completed, capped at five, blue while anything is open, grey only when all are done) that still counts every list page, explicit completion, version/Idempotency-Key fencing, separate month blocks whose heading sits above the month's own 1st column with non-interactive blanks instead of neighbouring dates, the mint glass header add control with its original form/focus behaviour, a preserved-session refresh followed by a direct real gesture in both directions before any month control is clicked, 320/390/1440 and short screens, horizontal swipe/click separation, nested list/detail/form returns |
| Tags, flat comments, notifications and historical entry | `check_fixed_notifications.py` plus Maven `NotificationCommentAccessTest`, `WithdrawnNotificationTest`, `EventsRetentionTest`: founder catalogue, normal task-tag authority, logical deletion, author control, targeted delivery, independent comment edits, revocation/deletion/missing-comment redaction, withdrawn-manager exception, ordinary-task read-only history, open/hide, 180-second withdrawal and retention. `check_fixed_communication_web.py` / `check_fixed_communication_browser.js` additionally drive real catalogue create/rename/color/delete, comment submit/edit/delete and recipient controls, notification comment jumps, revoked-comment redaction and ordinary historical read-only detail. The former notification/tag browser commands delegate to this real Chrome suite; screenshots are separately named. |
| Demo and database integrity | `check_final_demo.py`, `check_database.py`: explicit target/marker guards, repeated prepare/restart, stable seed keys and edited data, real accounts/144 tasks/scenarios, read-only structural/data invariants |
| Full migration and restore | `check_final_migration.py` with `flyway_migrate.py` / `Migrate.java`: packaged Flyway chain on empty and V20 databases, structure comparison, real backup restore, unchanged historical IDs/checksums, conflicted administrator blocking |

`check_final_workflow.py --phase migration|demo|api|browser` selects a group. `--only <filenames...>` selects specific suites in that group. The browser phase uses current suites that launch Chrome; it is separate from the former browser-named API entry points above. Existing historical reports are references only; check the current `final-*-run.json` timestamps and each result.
