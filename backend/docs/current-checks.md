# Current fixed-organization checks

Build first (`cd backend && mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package`), start the project MySQL, then from the repository root run:

```sh
python3 backend/scripts/check_final_workflow.py --phase all
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
| Home, calendar, task creation/form | `check_fixed_web.py`, `check_calendar_drawer.py`: 320×740, 390×844, 1440×900, independent quadrants, priority visibility, complete global sort/filter/paging, effective version, nested returns, drawers/sheets/focus/touch, full-day projection and concurrency, continuous months/year/retry |
| Tags, flat comments, notifications and historical entry | `check_fixed_notifications.py` plus Maven `NotificationCommentAccessTest`, `WithdrawnNotificationTest`, `EventsRetentionTest`: founder catalogue, normal task-tag authority, logical deletion, author control, targeted delivery, independent comment edits, revocation/deletion/missing-comment redaction, withdrawn-manager exception, ordinary-task read-only history, open/hide, 180-second withdrawal and retention. `check_fixed_communication_web.py` / `check_fixed_communication_browser.js` additionally drive real catalogue create/rename/color/delete, comment submit/edit/delete and recipient controls, notification comment jumps, revoked-comment redaction and ordinary historical read-only detail. The former notification/tag browser commands delegate to this real Chrome suite; screenshots are separately named. |
| Demo and database integrity | `check_final_demo.py`, `check_database.py`: explicit target/marker guards, repeated prepare/restart, stable seed keys and edited data, real accounts/144 tasks/scenarios, read-only structural/data invariants |
| Full migration and restore | `check_final_migration.py` with `flyway_migrate.py` / `Migrate.java`: packaged Flyway chain on empty and V20 databases, structure comparison, real backup restore, unchanged historical IDs/checksums, conflicted administrator blocking |

`check_final_workflow.py --phase migration|demo|api|browser` selects a group. `--only <filenames...>` selects specific suites in that group. The browser phase uses current suites that launch Chrome; it is separate from the former browser-named API entry points above. Existing historical reports are references only; check the current `final-*-run.json` timestamps and each result.
