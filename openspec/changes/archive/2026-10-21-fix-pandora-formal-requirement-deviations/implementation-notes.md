# Implementation Notes

- Change: `fix-pandora-formal-requirement-deviations`
- Schema: `spec-driven`
- Store: local repository
- Repository: `C:\Users\20943\Desktop\software_test_practice`
- Updated: 2026-10-20 (Asia/Shanghai)
- Implementation revision: `29e3f99` plus the current uncommitted worktree
- Progress at handoff: 65/65 OpenSpec implementation tasks after task 11.6 is checked
- Scope exception: DEV-029 system push and A-25/real-device work were explicitly deferred and are not represented as implemented or verified
- Authority: this is an apply-stage implementation handoff. It is not an independent e13 verification result and does not authorize archive.

## Implemented scope

The change now contains reviewable implementation and evidence for the non-deferred portions of DEV-001—035:

- organization, role/scope authorization, team ownership, transfer and admin maintenance;
- account creation/reset, forced first password change, session invalidation and profile/phone privacy;
- reviewer routing, explicit self-review, proposed-route preview, reassignment, handover, reopen and durable history;
- deadline expiry, race-safe decisions, schedule versions, 20%/10%/5% reminders and organization cut-off snapshots;
- event/notification recipient rules, automatic read, original-request binding, withdrawal, personal deletion, retention and historical read-only access;
- one-log-per-day and midnight freeze, permission-scoped log browsing, profile/subordinate entry;
- home assignment ordering, calendar navigation/search/pins/cross-day rendering/full timelines/swipes/counts;
- authority-scoped AI statistics, real-text keywords, pending-complete/priority distribution, proportional/conflict/high-priority suggestions and stale-result reauthorization;
- current tests, scripts, static-resource allowlists, API examples and implementation documentation.

The generated one-row-per-requirement mapping is `audit/2026-10-20/chapter11/traceability.md`. It contains exactly 35 DEV rows, 150 AUD rows and 25 A rows and preserves the original audit documents unchanged.

## Build and unit-test baseline

Run with Java 21 from `backend/`:

```powershell
$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
mvn -B -ntp test
mvn -B -ntp package
```

Current result: **PASS, 60 tests**, with 0 failures, 0 errors and 0 skipped. The package command also passed and produced the served frontend/backend artifact.

## Integration evidence

All current JSON reports below are under `audit/2026-10-20/chapter11/`. HTTP suites used freshly created, seeded MySQL databases so that controlled-clock state, expired requests, existing daily logs and read notifications could not leak across suites.

| Area | Command from `backend/` | Current result |
| --- | --- | --- |
| Corrected smoke | `python scripts/smoke_test.py --base-url http://127.0.0.1:18095 --report ../audit/2026-10-20/chapter11/smoke.json` | PASS 53/53 |
| Organization/admin | `python scripts/check_organization_admin.py --base-url http://127.0.0.1:18095 --output ../audit/2026-10-20/chapter11/organization-admin.json` | PASS 48/48 |
| Account lifecycle | `python scripts/check_account_lifecycle.py --base-url http://127.0.0.1:18095 --output ../audit/2026-10-20/chapter11/account-lifecycle.json` | PASS 47/47 |
| Review routing | `python scripts/check_review_routing.py --base-url http://127.0.0.1:18095 --output ../audit/2026-10-20/chapter11/review-routing.json` | PASS 59/59 |
| Profile phone/privacy | `python scripts/check_profile_phone_matrix.py --base-url http://127.0.0.1:18095 --output ../audit/2026-10-20/chapter11/profile-phone.json` | PASS 26/26 |
| Work logs | `python scripts/check_work_logs.py --base-url http://127.0.0.1:18096 --output ../audit/2026-10-20/chapter11/work-logs.json` | PASS 17/17 |
| Home/calendar API | `python scripts/check_home_calendar.py --base-url http://127.0.0.1:18095 --output ../audit/2026-10-20/chapter11/home-calendar.json` | PASS 12/12 |
| AI analysis | `python scripts/check_ai_analysis.py --base-url http://127.0.0.1:18095 --output ../audit/2026-10-20/chapter11/ai-analysis.json` | PASS 18/18 |
| Deadline/reminder/notification | `python scripts/check_deadline_reminder_notification.py --base-url http://127.0.0.1:18097 --output ../audit/2026-10-20/chapter11/deadline-reminder-notification.json` | PASS 75/75 |
| Database integrity | `python scripts/check_database.py --base-url http://127.0.0.1:18097 --output ../audit/2026-10-20/chapter11/database-event.json` | PASS 18/18 |

The final event database was `pandora_event_20261020_2148`, running MySQL 9.7 with Flyway V1 through V12 applied. The database evidence checks constraints, idempotency secrecy, event/history persistence and the single terminal outcome expected by the race scenarios. Database names are disposable evidence identifiers; credentials remain only in ignored runtime configuration and are not copied here.

The suites are order-sensitive by design:

1. Create and seed a fresh database, then start the jar with the suite-specific port and test-only clock/worker flags.
2. Run non-time-mutating suites before any suite that advances the controlled clock.
3. Use a separate fresh database for `check_work_logs.py` and another for deadline/event checks. Reusing a time-mutated database changes the business date, expiry state, notification read state and uniqueness preconditions.
4. Never enable `pandora.clock.controllable=true` in a normal deployment.

## Browser evidence

The browser scripts discover Chrome on Windows and pass explicit viewport dimensions. They exercise the built jar's real pages with API-backed state.

| Area | Evidence | Current result |
| --- | --- | --- |
| Account flows | `account-320x740.json`, `account-390x844.json`, `account-1440x900.json` | PASS 15/15 at each viewport |
| Logs/profile | `logs-profile-320x740.json`, `logs-profile-390x844.json`, `logs-profile-1440x900.json` | PASS 22/22 at each viewport |
| Notification lifecycle | `notification-320x740.json`, `notification-390x844.json`, `notification-1440x900.json` | PASS 21/21 at each viewport |
| Home/calendar | `home-calendar-three-viewports.json` | PASS 33/33 over 320×740, 390×844 and 1440×900 |
| Chapter 11 integrated UI | `chapter11-browser.json` | PASS 45/45 over all three viewports |

`chapter11-browser.json` covers login, 234px task description/acceptance fields, full-screen log editing and task picker/back navigation, automatic AI analysis, admin tabs/new-employee dialog and frozen old-effective-version behavior. Screenshots are in `audit/2026-10-20/chapter11/screenshots/`.

These are desktop headless Chrome viewport simulations. They are not physical-device evidence and must not be used to close A-25 or the true-device portions of AUD-UX-001—005.

## Migration status

- Fresh empty databases: **PASS**, Flyway V1—V12 applied successfully with the current seed and application startup.
- Current final integration database: **PASS**, MySQL 9.7, V12 current.
- Historical V4 snapshot rehearsal: still reports explicit `organization_mapping`, `team_department_mapping` and `expired_pending_request` data blockers. The migration intentionally does not fabricate mappings or silently tighten constraints. Those source-data blockers must be resolved before that particular snapshot can reach the tightened state.
- Old migrations were not rewritten; the current work adds later migrations and validation scripts.

## Failures found and repaired during apply

The final PASS reports above supersede, but do not erase, these useful debugging facts:

- The first updated smoke run failed because it still expected the obsolete reviewer DTO/id and direct self-approval behavior. The assertions were replaced with explicit self-review and current route semantics; the current smoke report is 53/53.
- The first work-log boundary run advanced by a truncated fraction and could miss the intended last second before midnight. The script now uses a ceiling calculation; the current report is 17/17.
- The first database integrity run used an overbroad `.result` secret-field check. It now checks concrete sensitive fields rather than rejecting harmless result metadata.
- The first event run reached 74/75 because the command response timestamp and replay timestamp could differ at database precision. `openNotification` now rereads the committed row and returns minimal command metadata, avoiding notification/task text in the idempotency cache; the current event report is 75/75 and database report 18/18.

## Known deferrals and non-claims

- **DEV-029**: operating-system push subscriptions/adapters and physical-device delivery are not implemented or verified. Only in-app delivery is covered.
- **A-25 / AUD-UX-004**: no physical device model, OS or real-device run is recorded. It remains deferred and unverified.
- **AUD-UX-001/002/003/005**: browser viewport behavior has evidence; any physical-device interaction/experience part remains deferred.
- **A-19 / AUD-NTF-001 / AUD-NTF-009**: in-app notification behavior has evidence, but the system-push portion remains deferred; therefore the complete acceptance item is not claimed as verified.
- Apply does not declare any AUD, A or DEV item independently verified. `audit/2026-10-20/chapter11/traceability.md` deliberately uses “待独立 e13 verify” or a deferred/partial status.
- `openspec validate fix-pandora-formal-requirement-deviations --strict` parses the change but reports two planning-quality warnings: the added requirements “Account password lifecycle” and “Notification lifecycle and historical access” each exceed 500 characters. Apply did not rewrite planning artifacts to silence these warnings; an update-change pass may split examples/edge cases into scenarios before archive if required by the independent verifier.

## Independent e13 verify handoff

Before deciding a verdict, the independent verifier should:

1. Inspect this change's proposal, design, specs, tasks, current diff and `audit/2026-10-20/chapter11/traceability.md`.
2. Re-run the Java 21 test/package commands and the relevant HTTP/browser suites against fresh isolated databases using the ordering above.
3. Confirm V1—V12 on a new database and separately review the disclosed V4 snapshot blockers rather than treating a new-database run as proof of historical-data readiness.
4. Check the deferred rows remain deferred and that viewport simulation is not presented as system-push or physical-device evidence.
5. Write the independent verdict through `$openspec-e13-verify-change fix-pandora-formal-requirement-deviations`.

No `verification.md` was edited by apply, and the change has not been archived.
