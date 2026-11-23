-- Task soft delete: the task row and every historical reference stay in place. Lists exclude
-- deleted rows; detail returns an identifiable TASK_DELETED state and admin history keeps reading.
ALTER TABLE tasks
    ADD COLUMN deleted_at DATETIME(6) NULL AFTER updated_at,
    ADD COLUMN deleted_by VARCHAR(36) NULL AFTER deleted_at,
    ADD COLUMN delete_reason VARCHAR(500) NULL AFTER deleted_by,
    ADD KEY idx_tasks_org_live(organization_id, deleted_at, id);
