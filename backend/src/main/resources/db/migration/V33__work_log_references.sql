CREATE TABLE work_log_task_references (
 organization_id VARCHAR(36) NOT NULL,
 log_id VARCHAR(36) NOT NULL,
 task_id VARCHAR(36) NOT NULL,
 PRIMARY KEY(organization_id,log_id,task_id),
 FOREIGN KEY(organization_id,log_id) REFERENCES work_logs(organization_id,id),
 FOREIGN KEY(organization_id,task_id) REFERENCES tasks(organization_id,id)
) ENGINE=InnoDB;

CREATE TABLE work_log_daily_references (
 organization_id VARCHAR(36) NOT NULL,
 log_id VARCHAR(36) NOT NULL,
 item_id VARCHAR(36) NOT NULL,
 PRIMARY KEY(organization_id,log_id,item_id),
 FOREIGN KEY(organization_id,log_id) REFERENCES work_logs(organization_id,id),
 FOREIGN KEY(organization_id,item_id) REFERENCES daily_items(organization_id,id) ON DELETE CASCADE
) ENGINE=InnoDB;
