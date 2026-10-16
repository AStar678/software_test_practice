-- Task 2.1/2.4/2.5/2.7: concurrent-edit versions for the organization structure.
--
-- Departments, positions and teams are maintained from the administration console, so each needs
-- its own optimistic version for If-Match. `users.org_version` versions the organization and
-- authority fields separately from `profile_version`, which the employee edits for themselves, so a
-- contact edit can never silently overwrite a transfer.

ALTER TABLE departments
 ADD COLUMN row_version BIGINT NOT NULL DEFAULT 1,
 ADD CONSTRAINT ck_department_version CHECK(row_version>0);

ALTER TABLE positions
 ADD COLUMN row_version BIGINT NOT NULL DEFAULT 1,
 ADD CONSTRAINT ck_position_version CHECK(row_version>0);

ALTER TABLE teams
 ADD COLUMN row_version BIGINT NOT NULL DEFAULT 1,
 ADD CONSTRAINT ck_team_version CHECK(row_version>0);

ALTER TABLE users
 ADD COLUMN org_version BIGINT NOT NULL DEFAULT 1,
 ADD CONSTRAINT ck_users_org_version CHECK(org_version>0);
