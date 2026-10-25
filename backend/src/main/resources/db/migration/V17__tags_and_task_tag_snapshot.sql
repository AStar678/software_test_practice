-- Chapter 1.3: company-level tag catalogue, single tag association and immutable audit snapshots.
--
-- A tag belongs to one company. Tasks and logs hold at most one tag through a single nullable
-- column, so "multiple tags" is not representable, and the composite (organization_id, tag_id)
-- foreign key makes a cross-company reference impossible at the storage layer. Task versions keep a
-- name/colour snapshot so a later rename changes the live reference without rewriting the audit
-- record. Existing tasks, versions and logs are not modified: every tag_id starts NULL, which is the
-- documented "no tag" state.

CREATE TABLE tags (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  name VARCHAR(40) NOT NULL,
  color VARCHAR(16) NOT NULL,
  deleted_at DATETIME(6) NULL,
  row_version BIGINT NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_tag_org_id (organization_id,id),
  UNIQUE KEY uq_tag_name (organization_id,name),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT ck_tag_version CHECK (row_version>0),
  CONSTRAINT ck_tag_color CHECK (color REGEXP '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT ck_tag_name CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 40)
) ENGINE=InnoDB;

-- One nullable tag per task version plus the value snapshot used by differentials and history.
ALTER TABLE task_versions
  ADD COLUMN tag_id VARCHAR(36) NULL,
  ADD COLUMN tag_name_snapshot VARCHAR(40) NULL,
  ADD COLUMN tag_color_snapshot VARCHAR(16) NULL,
  ADD CONSTRAINT fk_version_tag FOREIGN KEY (organization_id,tag_id) REFERENCES tags(organization_id,id),
  ADD KEY idx_version_tag (organization_id,tag_id);

-- One nullable tag per log; an existing log keeps its (absence of) tag.
ALTER TABLE work_logs
  ADD COLUMN tag_id VARCHAR(36) NULL,
  ADD CONSTRAINT fk_log_tag FOREIGN KEY (organization_id,tag_id) REFERENCES tags(organization_id,id),
  ADD KEY idx_log_tag (organization_id,tag_id);

-- Keep the tag snapshot with audit entries as well, so an entry stays readable after the catalogue
-- changes. Existing entries keep NULL and are not rewritten.
ALTER TABLE task_history_entries
  ADD COLUMN tag_name_snapshot VARCHAR(40) NULL,
  ADD COLUMN tag_color_snapshot VARCHAR(16) NULL;

INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
SELECT REPLACE(UUID(),'-',''), t.organization_id, 'V17', 'tag_catalogue_empty', 'limitation', NULL,
       CONCAT('公司已有 ', COUNT(*), ' 个任务版本，标签目录初始为空；既有任务与日志均按“无标签”保留，未回填任何标签值。')
FROM task_versions t GROUP BY t.organization_id HAVING COUNT(*)>0;
