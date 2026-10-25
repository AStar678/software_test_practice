-- Chapter 8.5/8.6: a notification (and the durable event behind it) must know its business object.
--
-- Until now a message only carried task_id, which cannot express a log comment: a log has no task.
-- Comment events therefore record their own object reference (object_type + object_id). Existing
-- rows are backfilled from task_id only — no title, summary, task or audit value is rewritten — so a
-- task message keeps exactly the object it had before this migration.
--
-- The object reference is presentation/authorization metadata, not a new foreign key: a log comment
-- message must be re-verified against the current task/log authority when it is delivered and opened,
-- and a deleted comment must stop exposing its excerpt. Keeping it FK-free also means removing a
-- message copy or a business object never cascades into the other aggregate.

ALTER TABLE domain_events
  ADD COLUMN object_type VARCHAR(12) NULL,
  ADD COLUMN object_id VARCHAR(36) NULL;

ALTER TABLE notifications
  ADD COLUMN object_type VARCHAR(12) NULL,
  ADD COLUMN object_id VARCHAR(36) NULL;

UPDATE domain_events SET object_type='task', object_id=task_id WHERE task_id IS NOT NULL;

UPDATE notifications SET object_type='task', object_id=task_id WHERE task_id IS NOT NULL;

ALTER TABLE notifications
  ADD KEY idx_notification_object (organization_id,object_type,object_id);

INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
SELECT REPLACE(UUID(),'-',''), n.organization_id, 'V20', 'notification_object_missing', 'limitation', NULL,
       CONCAT('有 ', COUNT(*), ' 条通知没有可识别的业务对象引用（历史非任务事件）；这些消息保留原摘要，'
              '但不提供对象跳转，也未写入任何对象引用。')
FROM notifications n WHERE n.object_type IS NULL GROUP BY n.organization_id HAVING COUNT(*)>0;
