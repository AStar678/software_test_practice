-- Chapter 1.4: flat comments on tasks and logs.
--
-- A comment belongs to exactly one task or one log (never both, never a reply). The object type plus
-- the typed reference keeps the two aggregates separate, and every foreign key carries
-- organization_id so a comment can never point at another company's task, log or author. Ordering is
-- by real publication time and the stable id, which the composite index supports for paging.
-- Existing task versions and logs are untouched: this migration only adds a new table.

-- The log reference needs an organization-scoped unique key so comments cannot target another
-- company's log; id is already the primary key, so this adds no new data constraint.
ALTER TABLE work_logs ADD UNIQUE KEY uq_log_org_id (organization_id,id);

CREATE TABLE task_log_comments (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  object_type VARCHAR(12) NOT NULL,
  task_id VARCHAR(36) NULL,
  log_id VARCHAR(36) NULL,
  author_id VARCHAR(36) NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  edited_at DATETIME(6) NULL,
  deleted_at DATETIME(6) NULL,
  row_version BIGINT NOT NULL DEFAULT 1,
  UNIQUE KEY uq_comment_org_id (organization_id,id),
  KEY idx_comment_task_page (organization_id,object_type,task_id,created_at,id),
  KEY idx_comment_log_page (organization_id,log_id,created_at,id),
  KEY idx_comment_author (organization_id,author_id,created_at),
  FOREIGN KEY (organization_id,task_id) REFERENCES tasks(organization_id,id),
  FOREIGN KEY (organization_id,log_id) REFERENCES work_logs(organization_id,id),
  FOREIGN KEY (organization_id,author_id) REFERENCES users(organization_id,id),
  CONSTRAINT ck_comment_object CHECK (
    (object_type='task' AND task_id IS NOT NULL AND log_id IS NULL)
    OR (object_type='log' AND log_id IS NOT NULL AND task_id IS NULL)),
  CONSTRAINT ck_comment_version CHECK (row_version>0),
  CONSTRAINT ck_comment_body CHECK (CHAR_LENGTH(TRIM(body)) BETWEEN 1 AND 10000)
) ENGINE=InnoDB;
