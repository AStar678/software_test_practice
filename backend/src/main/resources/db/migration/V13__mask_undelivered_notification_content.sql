-- Mark ordinary notification copies whose recipient could no longer read the task when the message was
-- delivered. Those copies keep only a generic delivery note; title, actual change summary and the
-- original-request/task-version binding are not stored and the read layer must not refill them from the
-- domain event (design §7, DEV-033).
ALTER TABLE notifications
 ADD COLUMN content_masked BOOLEAN NOT NULL DEFAULT FALSE;

-- Repair copies produced before this flag existed: an event copy that lost its task reference and the
-- delivered read-only exception (relation_lost) while the event itself is still live was masked at
-- delivery. Removal events (relation_lost=true) and withdrawn events keep their own semantics.
UPDATE notifications n
 JOIN domain_events e ON e.organization_id=n.organization_id AND e.id=n.event_id
 SET n.content_masked=TRUE,
     n.title=NULL,
     n.change_summary=NULL,
     n.request_id=NULL,
     n.task_version_id=NULL
 WHERE n.source='event'
   AND n.task_id IS NULL
   AND n.relation_lost=FALSE
   AND e.revoked_at IS NULL
   AND e.task_id IS NOT NULL;
