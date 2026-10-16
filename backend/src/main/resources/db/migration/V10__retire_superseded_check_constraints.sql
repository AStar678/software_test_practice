-- Task 4.2/4.6 correction: retire the superseded V1 CHECK constraints.
--
-- V6 intended to replace the `status` and `kind` checks on approval_requests (and the `status` check on
-- task_versions) so that `expired` and `handover` become legal values. Its lookup matched the stored
-- clause with `LIKE '%''reopen''%'`, but MySQL stores those literals as `\'reopen\'`, so the pattern never
-- matched and the drop silently did nothing. The narrower V1 constraints therefore stayed in force
-- alongside the new ones, and a handover request was rejected with "Check constraint
-- 'approval_requests_chk_2' is violated".
--
-- V6 is already applied in existing databases, so its checksum must not change; this migration corrects
-- the outcome instead. V1 is frozen, so the generated names below are deterministic, and each drop is
-- guarded by an existence check so the migration is safe on both a fresh and an upgraded database.

SET @c := (SELECT constraint_name FROM information_schema.table_constraints
  WHERE constraint_schema=DATABASE() AND table_name='approval_requests'
    AND constraint_type='CHECK' AND constraint_name='approval_requests_chk_1');
SET @sql := IF(@c IS NULL,'DO 0',CONCAT('ALTER TABLE approval_requests DROP CHECK `',@c,'`'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT constraint_name FROM information_schema.table_constraints
  WHERE constraint_schema=DATABASE() AND table_name='approval_requests'
    AND constraint_type='CHECK' AND constraint_name='approval_requests_chk_2');
SET @sql := IF(@c IS NULL,'DO 0',CONCAT('ALTER TABLE approval_requests DROP CHECK `',@c,'`'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- chk_3 is strictly weaker than ck_request_reviewer, which also requires a reviewer while pending.
SET @c := (SELECT constraint_name FROM information_schema.table_constraints
  WHERE constraint_schema=DATABASE() AND table_name='approval_requests'
    AND constraint_type='CHECK' AND constraint_name='approval_requests_chk_3');
SET @sql := IF(@c IS NULL,'DO 0',CONCAT('ALTER TABLE approval_requests DROP CHECK `',@c,'`'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT constraint_name FROM information_schema.table_constraints
  WHERE constraint_schema=DATABASE() AND table_name='task_versions'
    AND constraint_type='CHECK' AND constraint_name='task_versions_chk_4');
SET @sql := IF(@c IS NULL,'DO 0',CONCAT('ALTER TABLE task_versions DROP CHECK `',@c,'`'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Any surviving legacy constraint would silently narrow the new status and kind values again, so record
-- it as a blocker instead of leaving it undetected.
INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
SELECT REPLACE(UUID(),'-',''), NULL, 'V10', 'legacy_check_constraint', 'blocker', tc.constraint_name,
       CONCAT('表 ', tc.table_name, ' 上仍存在迁移前的检查约束 ', tc.constraint_name,
              '，会拒绝 expired/handover 等新状态值，必须人工确认后移除以恢复正式行为。')
FROM information_schema.table_constraints tc
WHERE tc.constraint_schema=DATABASE() AND tc.constraint_type='CHECK'
  AND tc.constraint_name IN ('approval_requests_chk_1','approval_requests_chk_2','approval_requests_chk_3','task_versions_chk_4');
