-- task_versions.created_by records the actor who wrote the effective version. The dedicated
-- offboarding command is executed by the independent administrator (a principal, not a business
-- employee), so an administrator-authored execution handover version must be attributable without
-- inventing an employee author. History rows already reference principals; align the version row.
SET @principal_fk := (SELECT constraint_name FROM information_schema.key_column_usage
 WHERE constraint_schema=DATABASE() AND table_name='task_versions' AND column_name='created_by'
 AND referenced_table_name='users' LIMIT 1);
SET @principal_ddl := IF(@principal_fk IS NULL, 'SELECT 1',
 CONCAT('ALTER TABLE task_versions DROP FOREIGN KEY `',@principal_fk,
 '`, ADD CONSTRAINT fk_task_versions_created_by_principal FOREIGN KEY(organization_id,created_by) REFERENCES principals(organization_id,id)'));
PREPARE principal_statement FROM @principal_ddl;
EXECUTE principal_statement;
DEALLOCATE PREPARE principal_statement;
