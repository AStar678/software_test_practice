-- Tasks 5.1-7.8 (DEV-012, 014, 015, 030-033):
-- schedule snapshots, proportional reminder node ledger and notification lifecycle columns.

-- 1. Every version keeps the all-day cut-off snapshot that was in force when its schedule was
-- submitted. Existing all-day versions inherit the effective task snapshot or the 18:00 default so
-- they keep the behaviour they were created with; the setting itself only applies to later versions.
ALTER TABLE task_versions ADD COLUMN all_day_cutoff_time TIME NULL;
UPDATE task_versions v JOIN tasks t
   ON t.organization_id=v.organization_id AND t.id=v.task_id
 SET v.all_day_cutoff_time=COALESCE(t.all_day_cutoff_time,'18:00:00')
 WHERE v.all_day=1 AND v.all_day_cutoff_time IS NULL;

-- 2. Reminder node ledger. A receipt row is written for every node decision: 'sent' produced an
-- event, 'skipped' records a node that was already stale when the scan first caught up, so a later
-- scan cannot backfill it. The dedupe key itself still carries task/recipient/round/schedule/node.
ALTER TABLE reminder_receipts
 ADD COLUMN node VARCHAR(16) NULL,
 ADD COLUMN state VARCHAR(12) NOT NULL DEFAULT 'sent',
 ADD COLUMN schedule_version BIGINT NULL,
 ADD COLUMN execution_round INT NULL,
 ADD COLUMN event_id VARCHAR(36) NULL,
 ADD COLUMN detail VARCHAR(500) NULL,
 ADD CONSTRAINT ck_reminder_state CHECK(state IN ('sent','skipped')),
 ADD CONSTRAINT ck_reminder_node CHECK(node IS NULL OR node IN ('20','10','5','overdue'));

-- 3. Message copies carry their own display title and the actual change summary, and mark copies
-- that only survive through the delivered-notification read-only exception. The existing
-- summary/expires_at/revoked columns stay in use; request_id/task_version_id already exist.
ALTER TABLE notifications
 ADD COLUMN title VARCHAR(200) NULL,
 ADD COLUMN change_summary VARCHAR(1000) NULL,
 ADD COLUMN relation_lost BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE notifications n JOIN domain_events e
   ON e.organization_id=n.organization_id AND e.id=n.event_id
 SET n.title=e.title, n.change_summary=e.change_summary
 WHERE n.title IS NULL AND e.title IS NOT NULL;

-- 4. Deadline scans look up pending requests by applicable deadline inside the organization lock.
ALTER TABLE approval_requests
 ADD KEY idx_request_deadline(organization_id,status,applicable_deadline);
ALTER TABLE domain_events
 ADD KEY idx_event_expiry(organization_id,expires_at);
