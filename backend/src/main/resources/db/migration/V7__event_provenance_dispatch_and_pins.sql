-- Task 1.4 (DEV-017, 020, 030-033): event/message provenance, dispatch records and personal pins.
--
-- Legacy messages are bound only from a provable domain_event -> request reference. Anything that
-- cannot be proven is marked legacy-unbound and stays read-only, instead of being guessed from the
-- task's current pending request.

-- 1. Events carry their own provenance: originating request, the versions involved, the initiator,
-- the actual change summary, occurrence time and the withdrawal/retention state.
ALTER TABLE domain_events
 ADD COLUMN request_id VARCHAR(36) NULL,
 ADD COLUMN task_version_id VARCHAR(36) NULL,
 ADD COLUMN initiator_id VARCHAR(36) NULL,
 ADD COLUMN title VARCHAR(200) NULL,
 ADD COLUMN change_summary VARCHAR(1000) NULL,
 ADD COLUMN occurred_at DATETIME(6) NULL,
 ADD COLUMN revoked_at DATETIME(6) NULL,
 ADD COLUMN revoked_by VARCHAR(36) NULL,
 ADD COLUMN revocation_reason VARCHAR(500) NULL,
 ADD COLUMN expires_at DATETIME(6) NULL;
UPDATE domain_events SET occurred_at=created_at WHERE occurred_at IS NULL;
ALTER TABLE domain_events MODIFY occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
UPDATE domain_events e
 JOIN approval_requests r
   ON r.organization_id=e.organization_id
  AND r.id=JSON_UNQUOTE(JSON_EXTRACT(e.details_json,'$.requestId'))
 SET e.request_id=r.id, e.task_version_id=r.proposed_version_id, e.initiator_id=r.applicant_id
 WHERE e.request_id IS NULL;
UPDATE domain_events e JOIN task_versions v
   ON v.organization_id=e.organization_id AND v.task_id=e.task_id
 SET e.title=v.title
 WHERE e.title IS NULL AND e.request_id IS NOT NULL AND v.id=e.task_version_id;
ALTER TABLE domain_events
 ADD CONSTRAINT fk_event_request FOREIGN KEY(organization_id,request_id) REFERENCES approval_requests(organization_id,id),
 ADD CONSTRAINT fk_event_version FOREIGN KEY(organization_id,task_version_id) REFERENCES task_versions(organization_id,id),
 ADD CONSTRAINT fk_event_initiator FOREIGN KEY(organization_id,initiator_id) REFERENCES users(organization_id,id),
 ADD CONSTRAINT fk_event_revoked_by FOREIGN KEY(organization_id,revoked_by) REFERENCES users(organization_id,id);

-- 2. Message copies bind to their event, request, version and lifecycle timestamps. Retention is
-- three company calendar months from occurrence with month-end truncation; Asia/Shanghai has no DST
-- so adding the interval to the stored UTC instant preserves the company-local moment, and the
-- service recomputes the same rule with the organization's zone for other zones.
ALTER TABLE notifications
 ADD COLUMN request_id VARCHAR(36) NULL,
 ADD COLUMN task_version_id VARCHAR(36) NULL,
 ADD COLUMN delivered_at DATETIME(6) NULL,
 ADD COLUMN expires_at DATETIME(6) NULL,
 ADD COLUMN row_version BIGINT NOT NULL DEFAULT 1,
 ADD COLUMN source VARCHAR(24) NOT NULL DEFAULT 'legacy-unbound',
 ADD COLUMN readonly BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE notifications n JOIN domain_events e
   ON e.organization_id=n.organization_id AND e.id=n.event_id
 SET n.request_id=e.request_id, n.task_version_id=e.task_version_id
 WHERE e.request_id IS NOT NULL;
UPDATE notifications n JOIN domain_events e
   ON e.organization_id=n.organization_id AND e.id=n.event_id
 SET n.delivered_at=COALESCE(e.delivered_at,e.occurred_at),
     n.expires_at=DATE_ADD(COALESCE(e.occurred_at,e.delivered_at,n.created_at), INTERVAL 3 MONTH),
     n.source=CASE WHEN e.request_id IS NOT NULL OR e.task_id IS NULL THEN 'event' ELSE 'legacy-unbound' END,
     n.readonly=CASE WHEN e.request_id IS NULL AND e.task_id IS NOT NULL THEN TRUE ELSE FALSE END;

ALTER TABLE notifications
 ADD CONSTRAINT fk_notification_request FOREIGN KEY(organization_id,request_id) REFERENCES approval_requests(organization_id,id),
 ADD CONSTRAINT fk_notification_version FOREIGN KEY(organization_id,task_version_id) REFERENCES task_versions(organization_id,id),
 ADD CONSTRAINT ck_notification_source CHECK(source IN ('event','legacy-unbound')),
 ADD KEY idx_notification_expiry(organization_id,recipient_id,expires_at);

-- 3. Assignment records: the moment a task actually reached a given assignee, with the source of
-- that time. Only an approved decision proves the time; everything else is an explicit estimate so
-- the dashboard ranking can distinguish proven dispatches from compatibility ordering.
CREATE TABLE task_assignments (
 id VARCHAR(36) PRIMARY KEY,
 organization_id VARCHAR(36) NOT NULL,
 task_id VARCHAR(36) NOT NULL,
 version_id VARCHAR(36) NOT NULL,
 user_id VARCHAR(36) NOT NULL,
 assigned_at DATETIME(6) NOT NULL,
 assigned_source VARCHAR(24) NOT NULL,
 schedule_version BIGINT NOT NULL DEFAULT 1,
 execution_round INT NOT NULL DEFAULT 1,
 active BOOLEAN NOT NULL DEFAULT FALSE,
 active_task_user VARCHAR(36) GENERATED ALWAYS AS (CASE WHEN active THEN user_id ELSE NULL END) STORED,
 removed_at DATETIME(6) NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_assignment_active(organization_id,task_id,active_task_user),
 FOREIGN KEY(organization_id,task_id) REFERENCES tasks(organization_id,id),
 FOREIGN KEY(organization_id,version_id) REFERENCES task_versions(organization_id,id),
 FOREIGN KEY(organization_id,user_id) REFERENCES users(organization_id,id),
 CONSTRAINT ck_assignment_source CHECK(assigned_source IN ('approval','legacy-estimate','created'))
) ENGINE=InnoDB;

INSERT INTO task_assignments(id,organization_id,task_id,version_id,user_id,assigned_at,
  assigned_source,schedule_version,execution_round,active)
 SELECT REPLACE(UUID(),'-',''), a.organization_id,v.task_id,a.version_id,a.user_id,
   COALESCE(r.decided_at, v.applied_at, v.created_at),
   CASE WHEN r.decided_at IS NOT NULL THEN 'approval' ELSE 'legacy-estimate' END,
   t.schedule_version, t.execution_round,
   (t.current_version_id IS NOT NULL AND t.current_version_id=v.id)
 FROM task_version_assignees a
 JOIN task_versions v ON v.organization_id=a.organization_id AND v.id=a.version_id
 JOIN tasks t ON t.organization_id=v.organization_id AND t.id=v.task_id
 LEFT JOIN approval_requests r ON r.organization_id=v.organization_id
   AND r.proposed_version_id=v.id AND r.status IN ('approved','direct');

-- 4. Personal calendar pins. Per-user, so one person's ordering never changes another's.
CREATE TABLE user_task_pins (
 organization_id VARCHAR(36) NOT NULL,
 user_id VARCHAR(36) NOT NULL,
 task_id VARCHAR(36) NOT NULL,
 pinned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(organization_id,user_id,task_id),
 FOREIGN KEY(organization_id,user_id) REFERENCES users(organization_id,id),
 FOREIGN KEY(organization_id,task_id) REFERENCES tasks(organization_id,id)
) ENGINE=InnoDB;

-- 5. Record the provenance gaps that remain after the provable backfill.
INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
 SELECT REPLACE(UUID(),'-',''), n.organization_id, 'V7', 'legacy_notification_unbound', 'limitation', NULL,
   CONCAT(COUNT(*), ' 条旧消息没有可证明的原申请绑定，已标记 legacy-unbound 并保持只读，不提供审核入口。')
 FROM notifications n WHERE n.source='legacy-unbound' GROUP BY n.organization_id HAVING COUNT(*)>0;

INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
 SELECT REPLACE(UUID(),'-',''), a.organization_id, 'V7', 'legacy_assignment_estimate', 'limitation', NULL,
   CONCAT(COUNT(*), ' 条派发时间只能按版本生效时间估计，已标记 legacy-estimate 以便与真实派发区分。')
 FROM task_assignments a WHERE a.assigned_source='legacy-estimate' GROUP BY a.organization_id HAVING COUNT(*)>0;
