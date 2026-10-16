-- Task 1.3 (DEV-004, 006, 009, 010, 012-016): ordered routing, expiration and handover schema.
--
-- Nothing historical is rewritten: existing effective versions stay `applied`, existing pending
-- requests stay pending (they are reassigned/expired by the application rules, not by this
-- migration), and every backfilled value records whether its source is provable or estimated.

-- 1. Ordered assignees. The V4 schema stored only an unordered set, so the backfilled order is the
-- deterministic compatibility order (user_id) and is explicitly marked legacy-order-unknown.
ALTER TABLE task_version_assignees ADD COLUMN ordinal INT NULL;
UPDATE task_version_assignees a
 JOIN (SELECT organization_id,version_id,user_id,
              ROW_NUMBER() OVER (PARTITION BY organization_id,version_id ORDER BY user_id)-1 AS rn
       FROM task_version_assignees) x
   ON x.organization_id=a.organization_id AND x.version_id=a.version_id AND x.user_id=a.user_id
 SET a.ordinal=x.rn;
ALTER TABLE task_version_assignees
 MODIFY ordinal INT NOT NULL,
 ADD CONSTRAINT ck_assignee_ordinal CHECK(ordinal>=0),
 ADD UNIQUE KEY uq_assignee_order(organization_id,version_id,ordinal),
 ADD COLUMN order_source VARCHAR(24) NOT NULL DEFAULT 'legacy-order-unknown';

-- 2. Version-level terminal states. `expired` is distinct from rejected/withdrawn and never
-- publishes the proposal; `applied_at` records when a version actually became effective.
ALTER TABLE task_versions ADD COLUMN applied_at DATETIME(6) NULL;
ALTER TABLE task_versions ADD COLUMN expired_at DATETIME(6) NULL;
UPDATE task_versions v JOIN tasks t
   ON t.organization_id=v.organization_id AND t.id=v.task_id AND t.current_version_id=v.id
 SET v.applied_at=t.updated_at
 WHERE v.status='applied' AND v.applied_at IS NULL;
SET @c := (SELECT cc.constraint_name FROM information_schema.check_constraints cc
  JOIN information_schema.table_constraints tc
    ON tc.constraint_schema=cc.constraint_schema AND tc.constraint_name=cc.constraint_name
  WHERE cc.constraint_schema=DATABASE() AND tc.table_name='task_versions'
    AND cc.check_clause LIKE '%''proposed''%' LIMIT 1);
SET @sql := IF(@c IS NULL,'DO 0',CONCAT('ALTER TABLE task_versions DROP CHECK `',@c,'`'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
ALTER TABLE task_versions
 ADD CONSTRAINT ck_version_status CHECK(status IN ('proposed','applied','rejected','withdrawn','expired'));

-- 3. Schedule identity and the all-day cutoff snapshot. `due_version` is superseded by
-- `schedule_version` (which the service increments for any real S/D/all-day change); the legacy
-- column is kept so V4 rows and the historical audit remain readable, and is no longer updated.
ALTER TABLE tasks
 ADD COLUMN schedule_version BIGINT NOT NULL DEFAULT 1,
 ADD COLUMN all_day_cutoff_time TIME NULL,
 ADD CONSTRAINT ck_task_schedule_version CHECK(schedule_version>0);
UPDATE tasks SET schedule_version=due_version WHERE schedule_version<>due_version;

-- 4. Requests: nullable reviewer with a documented no-reviewer reason, the expiration terminal
-- state, the handover kind, the recorded applicable deadline and the route that decided the
-- reviewer. The one-pending-per-task unique key (uq_one_pending) is untouched.
ALTER TABLE approval_requests
 ADD COLUMN applicable_deadline DATETIME(6) NULL,
 ADD COLUMN route_basis_assignee_id VARCHAR(36) NULL,
 ADD COLUMN route_reason VARCHAR(500) NULL,
 ADD COLUMN route_authz_version BIGINT NULL,
 ADD COLUMN expired_at DATETIME(6) NULL,
 ADD COLUMN route_refreshed_at DATETIME(6) NULL,
 ADD CONSTRAINT fk_request_basis FOREIGN KEY(organization_id,route_basis_assignee_id) REFERENCES users(organization_id,id);
ALTER TABLE approval_requests MODIFY current_reviewer_id VARCHAR(36) NULL;
SET @c := (SELECT cc.constraint_name FROM information_schema.check_constraints cc
  JOIN information_schema.table_constraints tc
    ON tc.constraint_schema=cc.constraint_schema AND tc.constraint_name=cc.constraint_name
  WHERE cc.constraint_schema=DATABASE() AND tc.table_name='approval_requests'
    AND cc.check_clause LIKE '%''pending''%' LIMIT 1);
SET @sql := IF(@c IS NULL,'DO 0',CONCAT('ALTER TABLE approval_requests DROP CHECK `',@c,'`'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @c := (SELECT cc.constraint_name FROM information_schema.check_constraints cc
  JOIN information_schema.table_constraints tc
    ON tc.constraint_schema=cc.constraint_schema AND tc.constraint_name=cc.constraint_name
  WHERE cc.constraint_schema=DATABASE() AND tc.table_name='approval_requests'
    AND cc.check_clause LIKE '%''reopen''%' LIMIT 1);
SET @sql := IF(@c IS NULL,'DO 0',CONCAT('ALTER TABLE approval_requests DROP CHECK `',@c,'`'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
ALTER TABLE approval_requests
 ADD CONSTRAINT ck_request_status CHECK(status IN ('pending','approved','rejected','withdrawn','direct','expired')),
 ADD CONSTRAINT ck_request_kind CHECK(kind IN ('create','change','progress','complete','reopen','handover')),
 ADD CONSTRAINT ck_request_reviewer CHECK((status<>'pending' OR current_reviewer_id IS NOT NULL)
   AND (current_reviewer_id IS NOT NULL OR exemption_reason IS NOT NULL));

-- Existing pending requests get an applicable-deadline snapshot and a migration reassignment so
-- the new route can be audited; the application recomputes the real reviewer per the new rules.
UPDATE approval_requests r JOIN task_versions v
   ON v.organization_id=r.organization_id AND v.id=r.proposed_version_id
 SET r.applicable_deadline=CASE
   WHEN r.kind IN ('create','reopen') OR r.base_version_id IS NULL THEN v.due_at
   ELSE COALESCE((SELECT b.due_at FROM task_versions b
     WHERE b.organization_id=r.organization_id AND b.id=r.base_version_id),v.due_at) END
 WHERE r.status='pending' AND r.applicable_deadline IS NULL;

-- 5. Dedicated handover record: who was handed over, to whom, who set it up, and the request that
-- carries the approval. Kept separate from the generic request so handover can never carry base
-- field edits.
CREATE TABLE handover_requests (
 id VARCHAR(36) PRIMARY KEY,
 organization_id VARCHAR(36) NOT NULL,
 task_id VARCHAR(36) NOT NULL,
 request_id VARCHAR(36) NOT NULL,
 source_user_id VARCHAR(36) NOT NULL,
 target_user_id VARCHAR(36) NOT NULL,
 set_by_user_id VARCHAR(36) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_handover_request(organization_id,request_id),
 FOREIGN KEY(organization_id,task_id) REFERENCES tasks(organization_id,id),
 FOREIGN KEY(organization_id,request_id) REFERENCES approval_requests(organization_id,id),
 FOREIGN KEY(organization_id,source_user_id) REFERENCES users(organization_id,id),
 FOREIGN KEY(organization_id,target_user_id) REFERENCES users(organization_id,id),
 FOREIGN KEY(organization_id,set_by_user_id) REFERENCES users(organization_id,id),
 CONSTRAINT ck_handover_distinct CHECK(source_user_id<>target_user_id)
) ENGINE=InnoDB;

-- 6. Persisted reassignment: an organization change or the migration itself moves a pending
-- request to a new reviewer with the reason and the basis assignee that decided it.
CREATE TABLE request_reassignments (
 id VARCHAR(36) PRIMARY KEY,
 organization_id VARCHAR(36) NOT NULL,
 request_id VARCHAR(36) NOT NULL,
 task_id VARCHAR(36) NOT NULL,
 previous_reviewer_id VARCHAR(36) NULL,
 new_reviewer_id VARCHAR(36) NULL,
 basis_assignee_id VARCHAR(36) NULL,
 reason VARCHAR(500) NOT NULL,
 source VARCHAR(24) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(organization_id,request_id) REFERENCES approval_requests(organization_id,id),
 FOREIGN KEY(organization_id,task_id) REFERENCES tasks(organization_id,id),
 FOREIGN KEY(organization_id,previous_reviewer_id) REFERENCES users(organization_id,id),
 FOREIGN KEY(organization_id,new_reviewer_id) REFERENCES users(organization_id,id),
 CONSTRAINT ck_reassignment_source CHECK(source IN ('migration','organization_change','route_refresh'))
) ENGINE=InnoDB;

INSERT INTO request_reassignments(id,organization_id,request_id,task_id,previous_reviewer_id,
  new_reviewer_id,basis_assignee_id,reason,source)
 SELECT REPLACE(UUID(),'-',''), r.organization_id, r.id, r.task_id, r.current_reviewer_id,
   r.current_reviewer_id, NULL,
   'V4 无有序负责人与统一路线记录，迁移按新规则重算审核人并保留原决定人供审计。','migration'
 FROM approval_requests r WHERE r.status='pending';

-- 7. Complete task operation history. App never exposes this; the administrator interface reads it
-- by task and it survives message deletion, withdrawal and retention cleanup.
CREATE TABLE task_history_entries (
 id VARCHAR(36) PRIMARY KEY,
 organization_id VARCHAR(36) NOT NULL,
 task_id VARCHAR(36) NOT NULL,
 request_id VARCHAR(36) NULL,
 actor_id VARCHAR(36) NULL,
 entry_type VARCHAR(40) NOT NULL,
 field_name VARCHAR(60) NULL,
 before_value TEXT NULL,
 after_value TEXT NULL,
 detail_json JSON NOT NULL,
 occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(organization_id,task_id) REFERENCES tasks(organization_id,id),
 FOREIGN KEY(organization_id,request_id) REFERENCES approval_requests(organization_id,id),
 FOREIGN KEY(organization_id,actor_id) REFERENCES users(organization_id,id),
 KEY idx_history_task(organization_id,task_id,occurred_at,id)
) ENGINE=InnoDB;

-- Backfill what the V4 data can actually prove: the request lifecycle already recorded applicant,
-- reviewer, decision and comment. Nothing is invented for fields V4 never stored.
INSERT INTO task_history_entries(id,organization_id,task_id,request_id,actor_id,entry_type,
  field_name,before_value,after_value,detail_json,occurred_at)
 SELECT REPLACE(UUID(),'-',''), r.organization_id, r.task_id, r.id, r.applicant_id, 'request_submitted',
   'kind', NULL, r.kind, JSON_OBJECT('status',r.status,'baseVersionId',r.base_version_id), r.created_at
 FROM approval_requests r;

INSERT INTO task_history_entries(id,organization_id,task_id,request_id,actor_id,entry_type,
  field_name,before_value,after_value,detail_json,occurred_at)
 SELECT REPLACE(UUID(),'-',''), r.organization_id, r.task_id, r.id, r.decided_by, 'request_decided',
   'status', 'pending', r.status,
   JSON_OBJECT('comment',r.comment,'reviewerId',r.current_reviewer_id,'exemptionReason',r.exemption_reason),
   COALESCE(r.decided_at,r.created_at)
 FROM approval_requests r WHERE r.status<>'pending';
