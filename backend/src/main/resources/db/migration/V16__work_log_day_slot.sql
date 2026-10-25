-- Chapter 1.2: keep the per-author/per-business-day log position instead of physically deleting it.
--
-- The product rule is that a person's log for one business day is a single slot: deleting it must not
-- hand back a fresh slot, because a later "delete then recreate" would otherwise reset the freeze
-- clock. The row therefore stays in place and is marked deleted; the existing
-- uq_log_day(organization_id,author_id,business_date) key continues to enforce one row per day.
--
-- Historical data is never rewritten here: every existing row already stores its real created_at, and
-- this migration does not touch it. Rows whose real first-creation time can only be proven from a
-- recorded log.created/log.deleted event pair are materialised by
-- cn.pandora.workspace.WorkLogSlots after Flyway finishes, because turning the stored UTC instant
-- into the company-local business date needs the organization's zone (SQL has no reliable tz table
-- loaded here). Those reconstructed rows keep an empty body and deleted_at set, so they can never be
-- read as content; restoring the slot on a later write only fills the body and clears deleted_at.

ALTER TABLE work_logs
  ADD COLUMN deleted_at DATETIME(6) NULL,
  ADD COLUMN recovered_from VARCHAR(24) NOT NULL DEFAULT 'log-row';

ALTER TABLE work_logs
  ADD CONSTRAINT ck_log_recovered_from CHECK (recovered_from IN ('log-row','deleted-event')),
  ADD KEY idx_log_day_slot (organization_id,author_id,business_date,deleted_at);

-- Record what the migration itself can prove without inventing a business date: how many delete
-- events exist that no longer have a row. WorkLogSlots resolves each one or records why it cannot.
INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
SELECT REPLACE(UUID(),'-',''), e.organization_id, 'V16', 'work_log_delete_event_pending', 'limitation', NULL,
       CONCAT('存在 ', COUNT(*), ' 条日志删除事件，其日志行已被物理删除；'
              '迁移只依据可证明的 log.created/log.deleted 事件恢复日位置，无法证明的记录保持缺失并单独登记。')
FROM domain_events e
WHERE e.event_type='log.deleted'
  AND NOT EXISTS (SELECT 1 FROM work_logs w
    WHERE w.organization_id=e.organization_id
      AND w.id=JSON_UNQUOTE(JSON_EXTRACT(e.details_json,'$.logId')))
GROUP BY e.organization_id HAVING COUNT(*)>0;
