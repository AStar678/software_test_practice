-- 员工身份证号：管理员专用证件资料，独立于 users 的宽投影表。
-- 旧员工可以没有记录（未设置），普通员工目录/任务/通知/日志/统计/App 接口不查询本表。
CREATE TABLE employee_identity_documents (
 organization_id VARCHAR(36) NOT NULL,
 employee_id VARCHAR(36) NOT NULL,
 id_card_no VARCHAR(18) NOT NULL,
 row_version BIGINT NOT NULL DEFAULT 1,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(organization_id,employee_id),
 UNIQUE KEY uq_employee_identity_id_card(organization_id,id_card_no),
 CONSTRAINT fk_employee_identity_employee FOREIGN KEY(organization_id,employee_id)
   REFERENCES users(organization_id,id) ON DELETE CASCADE,
 CONSTRAINT ck_employee_identity_version CHECK(row_version>0),
 CONSTRAINT ck_employee_identity_length CHECK(CHAR_LENGTH(id_card_no)=18)
) ENGINE=InnoDB;
