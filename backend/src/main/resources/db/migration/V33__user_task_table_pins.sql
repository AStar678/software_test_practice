-- 个人表单置顶与日历置顶是两个独立偏好：不迁移、不双写 user_task_pins，保留两侧各自的资格与语义。
CREATE TABLE user_task_table_pins (
 organization_id VARCHAR(36) NOT NULL,
 user_id VARCHAR(36) NOT NULL,
 task_id VARCHAR(36) NOT NULL,
 pinned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(organization_id,user_id,task_id),
 KEY idx_task_table_pin_task(organization_id,task_id),
 FOREIGN KEY(organization_id,user_id) REFERENCES users(organization_id,id),
 FOREIGN KEY(organization_id,task_id) REFERENCES tasks(organization_id,id)
) ENGINE=InnoDB;
