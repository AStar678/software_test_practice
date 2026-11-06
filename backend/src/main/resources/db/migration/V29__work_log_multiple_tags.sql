-- Preserve the log row and its original creation instant: only its tag relation changes.
CREATE TABLE work_log_tags (
  organization_id VARCHAR(36) NOT NULL,
  log_id VARCHAR(36) NOT NULL,
  tag_id VARCHAR(36) NOT NULL,
  ordinal INT NOT NULL,
  tag_name_snapshot VARCHAR(40) NULL,
  tag_color_snapshot VARCHAR(16) NULL,
  PRIMARY KEY (organization_id,log_id,tag_id),
  UNIQUE KEY uq_log_tag_order (organization_id,log_id,ordinal),
  CONSTRAINT fk_work_log_tags_log FOREIGN KEY (organization_id,log_id) REFERENCES work_logs(organization_id,id),
  CONSTRAINT fk_work_log_tags_tag FOREIGN KEY (organization_id,tag_id) REFERENCES tags(organization_id,id),
  CONSTRAINT ck_work_log_tag_ordinal CHECK (ordinal >= 0)
) ENGINE=InnoDB;

INSERT INTO work_log_tags(organization_id,log_id,tag_id,ordinal,tag_name_snapshot,tag_color_snapshot)
SELECT w.organization_id,w.id,w.tag_id,0,t.name,t.color
FROM work_logs w JOIN tags t ON t.organization_id=w.organization_id AND t.id=w.tag_id
WHERE w.tag_id IS NOT NULL;

-- This guard aborts before dropping the old column if any legacy reference was not copied.
CREATE TABLE work_log_tag_migration_guard (
  invalid_count BIGINT NOT NULL,
  CONSTRAINT ck_work_log_tag_migration_guard CHECK (invalid_count=0)
) ENGINE=InnoDB;
INSERT INTO work_log_tag_migration_guard(invalid_count)
SELECT COUNT(*) FROM work_logs w
WHERE w.tag_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM work_log_tags wt
  WHERE wt.organization_id=w.organization_id AND wt.log_id=w.id AND wt.tag_id=w.tag_id AND wt.ordinal=0
);
DROP TABLE work_log_tag_migration_guard;

ALTER TABLE work_logs DROP FOREIGN KEY fk_log_tag;
ALTER TABLE work_logs DROP INDEX idx_log_tag;
ALTER TABLE work_logs DROP COLUMN tag_id;
