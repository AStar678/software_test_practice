CREATE TABLE user_task_table_pins (
 organization_id VARCHAR(36) NOT NULL,
 user_id VARCHAR(36) NOT NULL,
 task_id VARCHAR(36) NOT NULL,
 PRIMARY KEY(organization_id,user_id,task_id),
 FOREIGN KEY(organization_id,user_id) REFERENCES users(organization_id,id),
 FOREIGN KEY(organization_id,task_id) REFERENCES tasks(organization_id,id)
) ENGINE=InnoDB;
