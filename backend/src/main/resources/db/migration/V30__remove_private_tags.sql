-- Private catalogue rows must never be promoted to company-visible shared tags.
-- A corrupted shared reference blocks the migration before any personal data is removed.
CREATE TABLE private_tag_migration_guard (
  invalid_count BIGINT NOT NULL,
  CONSTRAINT ck_private_tag_migration_guard CHECK (invalid_count=0)
) ENGINE=InnoDB;
INSERT INTO private_tag_migration_guard(invalid_count)
SELECT
  (SELECT COUNT(*) FROM task_versions v JOIN tags t ON t.organization_id=v.organization_id AND t.id=v.tag_id WHERE t.owner_id IS NOT NULL)
  + (SELECT COUNT(*) FROM task_version_tags vt JOIN tags t ON t.organization_id=vt.organization_id AND t.id=vt.tag_id WHERE t.owner_id IS NOT NULL)
  + (SELECT COUNT(*) FROM work_log_tags wt JOIN tags t ON t.organization_id=wt.organization_id AND t.id=wt.tag_id WHERE t.owner_id IS NOT NULL);
DROP TABLE private_tag_migration_guard;

DROP TABLE personal_task_tags;
DELETE FROM tags WHERE owner_id IS NOT NULL;
ALTER TABLE tags
  DROP FOREIGN KEY fk_tag_owner,
  DROP INDEX uq_tag_owner_reference,
  DROP INDEX uq_tag_scope_name,
  DROP COLUMN owner_scope,
  DROP COLUMN owner_id,
  ADD UNIQUE KEY uq_tag_name (organization_id,name);
