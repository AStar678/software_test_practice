-- Task 1.5 (DEV-025, 026): lossless duplicate work-log merge and the per-day unique key.
--
-- Duplicates are grouped strictly by (organization, author, business date), so two different authors
-- who wrote on the same day are never merged. The earliest copy stays canonical and untouched; every
-- other copy is preserved verbatim in work_log_conflict_archive together with its source id and
-- timestamps before the row is removed. Nothing is silently deleted and no body is rewritten.

CREATE TABLE work_log_conflict_archive (
 id VARCHAR(36) PRIMARY KEY,
 organization_id VARCHAR(36) NOT NULL,
 author_id VARCHAR(36) NOT NULL,
 business_date DATE NOT NULL,
 source_log_id VARCHAR(36) NOT NULL,
 kept_log_id VARCHAR(36) NOT NULL,
 body TEXT NOT NULL,
 task_id VARCHAR(36) NULL,
 source_row_version BIGINT NOT NULL,
 source_created_at DATETIME(6) NOT NULL,
 source_updated_at DATETIME(6) NULL,
 merge_batch VARCHAR(36) NOT NULL,
 archived_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_archive_source(organization_id,source_log_id),
 KEY idx_archive_group(organization_id,author_id,business_date),
 FOREIGN KEY(organization_id,author_id) REFERENCES users(organization_id,id),
 FOREIGN KEY(organization_id,task_id) REFERENCES tasks(organization_id,id)
) ENGINE=InnoDB;

-- One batch id per migration run so the merge is auditable as a single reviewed operation.
SET @merge_batch := REPLACE(UUID(),'-','');

INSERT INTO work_log_conflict_archive(id,organization_id,author_id,business_date,source_log_id,
  kept_log_id,body,task_id,source_row_version,source_created_at,source_updated_at,merge_batch)
 SELECT REPLACE(UUID(),'-',''), w.organization_id, w.author_id, w.business_date, w.id,
   k.kept_id, w.body, w.task_id, w.row_version, w.created_at, w.updated_at, @merge_batch
 FROM work_logs w
 JOIN (SELECT organization_id,author_id,business_date,
              SUBSTRING_INDEX(MIN(CONCAT(DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%f'),'|',id)),'|',-1) AS kept_id,
              COUNT(*) AS copies
       FROM work_logs GROUP BY organization_id,author_id,business_date HAVING COUNT(*)>1) k
   ON k.organization_id=w.organization_id AND k.author_id=w.author_id AND k.business_date=w.business_date
 WHERE w.id<>k.kept_id;

DELETE w FROM work_logs w
 JOIN work_log_conflict_archive a
   ON a.organization_id=w.organization_id AND a.source_log_id=w.id;

INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
 SELECT REPLACE(UUID(),'-',''), a.organization_id, 'V8', 'duplicate_work_log_merged', 'limitation', a.merge_batch,
   CONCAT('重复日志已无损归并：', COUNT(*), ' 篇重复原文连同来源 ID、版本与时间保留在 work_log_conflict_archive，'
          '仅保留最早一篇为当日唯一记录，原文未被改写。')
 FROM work_log_conflict_archive a GROUP BY a.organization_id,a.merge_batch;

-- The unique key is added only when no unresolved duplicate remains; otherwise it stays off and the
-- blocker below explains why, so the constraint is never enabled over conflicting data.
SET @remaining := (SELECT COUNT(*) FROM (SELECT organization_id,author_id,business_date
  FROM work_logs GROUP BY organization_id,author_id,business_date HAVING COUNT(*)>1) x);
SET @ddl := IF(@remaining=0,
  'ALTER TABLE work_logs ADD UNIQUE KEY uq_log_day(organization_id,author_id,business_date)',
  'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
 SELECT REPLACE(UUID(),'-',''), o.id, 'V8', 'work_log_day_unique', 'blocker', NULL,
   CONCAT('仍有 ', @remaining, ' 组重复日志未解决，业务日期唯一约束未启用。')
 FROM organizations o WHERE @remaining>0;

-- Resolve the earlier V5 duplicate blocker once the lossless merge has actually run.
UPDATE migration_findings SET resolved_at=UTC_TIMESTAMP(6)
 WHERE migration='V5' AND category='duplicate_work_logs' AND resolved_at IS NULL AND @remaining=0;
