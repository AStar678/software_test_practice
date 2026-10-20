-- Task 9.1 (DEV-017): backfill assignment rows for published tasks created after V7.
--
-- V7 could only backfill rows that existed when the migration ran. Seed and later tasks were
-- inserted afterwards, so their current owners have no active assignment record. This migration is
-- deliberately an estimate: the current version's applied/created time is the best provable source,
-- and the rows are marked legacy-estimate rather than presented as exact dispatch times.

INSERT INTO task_assignments(id,organization_id,task_id,version_id,user_id,assigned_at,
  assigned_source,schedule_version,execution_round,active)
 SELECT REPLACE(UUID(),'-',''), t.organization_id, t.id, t.current_version_id, a.user_id,
   COALESCE(v.applied_at, v.created_at), 'legacy-estimate',
   COALESCE(t.schedule_version,1), COALESCE(t.execution_round,1), TRUE
 FROM tasks t
 JOIN task_versions v ON v.organization_id=t.organization_id AND v.id=t.current_version_id
 JOIN task_version_assignees a ON a.organization_id=v.organization_id AND a.version_id=v.id
 WHERE t.current_version_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM task_assignments x
     WHERE x.organization_id=t.organization_id AND x.task_id=t.id
       AND x.user_id=a.user_id AND x.active=TRUE
   );
SET @backfilled := ROW_COUNT();

-- Active rows for people who are no longer current owners must not keep ranking tasks for them.
UPDATE task_assignments a
 JOIN tasks t ON t.organization_id=a.organization_id AND t.id=a.task_id
 JOIN task_versions v ON v.organization_id=t.organization_id AND v.id=t.current_version_id
 LEFT JOIN task_version_assignees cur
   ON cur.organization_id=t.organization_id AND cur.version_id=t.current_version_id AND cur.user_id=a.user_id
 SET a.active=FALSE, a.removed_at=COALESCE(a.removed_at, COALESCE(v.applied_at, v.created_at))
 WHERE a.active=TRUE AND t.current_version_id IS NOT NULL AND cur.user_id IS NULL;

INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
 SELECT REPLACE(UUID(),'-',''), o.id, 'V12', 'assignment_time_backfilled', 'limitation', NULL,
   CONCAT('为 ', @backfilled, ' 条缺少派发记录的当前负责人按版本生效/创建时间回填，标记为 legacy-estimate。')
 FROM organizations o WHERE @backfilled>0;
