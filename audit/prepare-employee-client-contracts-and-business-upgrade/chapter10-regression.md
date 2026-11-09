# Chapter 10 regression summary (A contract)

Date: 2026-11-09 (Asia/Shanghai). All commands below ran against disposable random databases and the
project JAR built from the current working tree; no normal/demo database was selected.

| Area | Command / suite | Result |
| --- | --- | --- |
| Maven rules | `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test` in `backend/` | 128 tests, 0 failures/errors |
| Account lifecycle | `python backend/scripts/check_account_lifecycle.py` | all checks PASS (strict phone/admin namespaces, refresh/logout/revocation, password policy, forced-change gate, cross-company isolation, one-time reset) |
| A contract | `python backend/scripts/check_employee_contracts_upgrade.py --skip-witness` | 307 checks, 0 failures (daily range, table/collation/pin, fill source, hire/tenure/e-mail, Chrome admin hire) |
| Holiday | `python backend/scripts/check_holidays.py` | 37 checks, 0 failures (source/validation/cache/GET/refresh/background) |
| Web | `python backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar` | 15/15; packaged bytes and content hashes match |
| Web browser | `python backend/scripts/check_chapter8_web.py` (real Chrome) | 33 checks, 0 failures (server table, later-page pin, ranged daily item create/edit/complete, profile, 320/390/1440, logout/account switch) |
| Default demo | `python backend/scripts/check_final_demo.py` | all checks PASS (animation four-role chain, 10–20 created tasks each, items/logs/notifications, two prepares, restart, edit preservation, PC admin/takeover) |
| Extreme fixture | `python backend/scripts/check_demo_extremes.py` | 130 checks, 0 failures (>100 tasks/items, six overlaps/all-day, cross-year/midnight/zero, cross-account denial) |

Evidence files are in `audit/prepare-employee-client-contracts-and-business-upgrade/`:
`employee-contracts-check.json`, `holiday-check.json`, `chapter8-browser.json`, `demo-extremes.json`,
`web-resources.json`, plus `output/task-creation-refinement/final-demo.json`.

Boundaries: this is A-only evidence. It does not claim Flutter, APK, real Android device gestures,
system push, or B implementation. Real-SMS/device and external holiday-source egress constraints are
recorded in `backend/docs/holiday-calendar-source.md` and the change implementation notes.
