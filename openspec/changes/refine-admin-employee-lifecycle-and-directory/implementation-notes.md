# Implementation Notes

- Change: `refine-admin-employee-lifecycle-and-directory`
- Schema: `spec-driven`
- Store: local repository
- Implementation roots: `/Users/aoxiang/Desktop/软件测试` (`backend/`)
- Updated: 2026-11-23T22:35:00+08:00
- Implementation revision: branch `ax/admin-employee-lifecycle` from `main` (`cd6d0bb`), §1 backend only (§2 admin pages pending)
- Progress: 8/20 tasks complete (all of section 1); sections 2–3 intentionally left for the admin pages and final regression

## Implementation Map

| Task / requirement / scenario | Code and tests | Decisions / context |
| --- | --- | --- |
| 1.1 prerequisite check | `backend/src/main/resources/db/migration/V37__task_soft_delete.sql`, `TaskService#delete` (`410 TASK_DELETED`), `TaskService#loadTaskBatch` (`deleted_at IS NULL` prefilter) | Employee App change contracts verified merged on `main` via PR #59 (`14ab88d`); Admin work started on top without duplicating the App surface. |
| 1.2 identity document table | `backend/src/main/resources/db/migration/V39__employee_identity_documents.sql` | `employee_identity_documents(organization_id, employee_id, id_card_no CHAR(18), row_version, created_at, updated_at)`; PK per employee, `uq_id_card_company` unique inside one company, FK to `users(organization_id,id)`, `ck_id_card_no_length`. Old employees keep no row; nothing except the two administrator projections queries the table. |
| 1.3 ID number validation/masking | `backend/src/main/java/cn/pandora/admin/IdCardNumbers.java`; `IdCardNumbersTest` | GB 11643-1999 format + birthdate (not future, ≥1900) + checksum, final `x` normalized to `X`; list shows `idCardNoMasked` (first 3 + 11 stars + last 4), admin detail carries the full `idCardNo` only; audit events record field names, never the number. |
| 1.4 employee list filters | `OrganizationService#employees`; `AdminEmployeeDirectoryTest` | `q` (name/department/login phone), `departmentId`, `teamId`, `placementType` (founder/department_head/team_head/employee), `active`, `positionId`; blank parameter = no filter, malformed UUID/boolean/type → 400; list and `total` are computed from the same condition chain; existing stable sort preserved; masked identity attached. |
| 1.5 independent onboarding | `OrganizationService#createEmployee`; `AdminEmployeeDirectoryTest` | `POST /admin/employees` now requires `idCardNo`, still builds the single-person minimal plan through `OrganizationPlans.save` (company lock, org version, phone uniqueness, one-time initial password); structural conflicts map `INVALID_ORGANIZATION_PLAN` → `ORGANIZATION_PLAN_REQUIRED` with “请到组织调整提交完整计划”; identity row inserted in the same write transaction, duplicate → `409 ID_CARD_TAKEN`. |
| 1.6 independent offboarding | `OrganizationService#offboard` + `AdminController` `POST /admin/employees/{id}/offboard`; `AdminOffboardTest` | Request accepts only `reason`, optional `successor{employeeId}`, `businessTransfers`, `cancelUnpublishedRequests`; server reads the employee with `FOR UPDATE`, rejects founders (`409 FOUNDER_CANNOT_OFFBOARD`) and head slots without successor (`409 SUCCESSOR_REQUIRED`), builds the restricted plan (`deactivateEmployees` + optional successor placement change) and reuses `OrganizationPlans.save`, `EmployeeDeactivations`, `BusinessTakeovers`, session revocation and approval refresh; any failure rolls back the whole offboarding. |
| 1.7 admin deleted-task projection | Already provided by the App change (`TaskService#adminTasks` `deleted` filter + `deleted/deletedAt/deletedBy/deletedByName/deleteReason`, `TaskService#taskHistory`); added `AdminDeletedTaskProjectionTest` | Interface tests now prove: `deleted=true/false` filters, no-filter keeps deleted tasks visible, invalid value rejected in Chinese, history keeps versions/entries for a deleted task. |
| 1.8 admin safe error mapping | `cn.pandora.common.ApiAdvice` (global catch-all from the App change); extended `ApiAdviceTest` | Admin-facing constraint/lock/argument failures return stable Chinese bodies; tests assert raw SQL fragment (`uq_id_card_company`), exception text (`idCardNo`) and lock details never reach the client. |

## Checks Run

| Command | Working directory / setup | Result / evidence | Run time or revision |
| --- | --- | --- | --- |
| `mvn test` | `backend/` | 267 tests, 0 failures, BUILD SUCCESS (baseline 238 + 29 new) | 2026-11-23 22:30 |
| Flyway rehearsal (empty database) | scratch schema `pandora_admin_lc_empty_20261123`, `scripts/flyway_migrate.py` | 39/39 migrations applied, V39 recorded, `all_success=1` | 2026-11-23 22:16 |
| V39 behaviour checks (MySQL 9.3, `.runtime` instance) | same scratch schema | normal insert OK; duplicate number in company → 1062; same number in another company OK; wrong length → 3819 CHECK; unknown employee → 1452 FK; second row per employee → 1062 PK | 2026-11-23 22:20 |

## Environment notes / residual risks

- The local `pandora` dev database on this machine is a **squashed V8 baseline** (flyway history V1–V8 with checksums that do not match the current files, and some later structures already inlined). A true V8→V39 upgrade rehearsal is therefore impossible here; the empty-database rehearsal (the repo's `run_check_isolated.sh` convention) is the authoritative structural verification for this change. A real upgrade-path rehearsal should be re-run against the genuine V36/V38 baseline on the machine that produced it (Windows side, same as the V37/V38 rehearsals). V39 is an additive `CREATE TABLE`, so upgrade risk is limited to “table already exists”, which Flyway versioning guards.
- Rehearsal scratch schemas created: `pandora_admin_lc_empty_20261123`, `pandora_admin_lc_upgrade_20261123` (the latter was rebuilt from the squashed baseline and is NOT a valid V39 upgrade rehearsal; safe to drop).
- The migration rehearsal needed `repair` because the clone inherited the squashed-baseline checksum mismatch; this was rehearsal-only and the real `pandora` database was never modified.
- `successor` handling keeps the successor's own `positionId` (display position belongs to the person) and only moves the `placementType/departmentId/teamId` head slot; cross-structure conflicts surface as `INVALID_ORGANIZATION_PLAN` and are mapped to the organization-adjustment hint.
- §2 (admin pages: filters UI, onboarding/offboarding wizards, deleted-task history, copy audit) and §3 (regression, browser checks, `openspec validate`) are still open.
