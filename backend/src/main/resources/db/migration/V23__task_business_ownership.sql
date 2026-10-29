-- Current business responsibility is independent of original creation provenance.
CREATE TABLE task_business_owners (
 organization_id VARCHAR(36) NOT NULL,
 task_id VARCHAR(36) NOT NULL,
 employee_id VARCHAR(36) NOT NULL,
 row_version BIGINT NOT NULL DEFAULT 1,
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 principal_type VARCHAR(12) GENERATED ALWAYS AS ('employee') STORED,
 PRIMARY KEY(organization_id,task_id),
 KEY idx_business_owner(organization_id,employee_id,task_id),
 CONSTRAINT fk_business_owner_task FOREIGN KEY(organization_id,task_id)
   REFERENCES tasks(organization_id,id),
 CONSTRAINT fk_business_owner_employee FOREIGN KEY(organization_id,employee_id)
   REFERENCES users(organization_id,id),
 CONSTRAINT fk_business_owner_type FOREIGN KEY(organization_id,employee_id,principal_type)
   REFERENCES principals(organization_id,id,account_type),
 CONSTRAINT ck_business_owner_version CHECK(row_version>0)
) ENGINE=InnoDB;

CREATE TABLE task_business_transfers (
 id VARCHAR(36) PRIMARY KEY,
 organization_id VARCHAR(36) NOT NULL,
 task_id VARCHAR(36) NOT NULL,
 previous_employee_id VARCHAR(36) NOT NULL,
 next_employee_id VARCHAR(36) NOT NULL,
 administrator_id VARCHAR(36) NOT NULL,
 reason VARCHAR(500) NOT NULL,
 owner_version BIGINT NOT NULL,
 occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 employee_type VARCHAR(12) GENERATED ALWAYS AS ('employee') STORED,
 administrator_type VARCHAR(12) GENERATED ALWAYS AS ('admin') STORED,
 UNIQUE KEY uq_transfer_owner_version(organization_id,task_id,owner_version),
 KEY idx_business_transfer_task(organization_id,task_id,occurred_at,id),
 CONSTRAINT fk_business_transfer_task FOREIGN KEY(organization_id,task_id)
   REFERENCES tasks(organization_id,id),
 CONSTRAINT fk_business_transfer_previous FOREIGN KEY(organization_id,previous_employee_id)
   REFERENCES users(organization_id,id),
 CONSTRAINT fk_business_transfer_next FOREIGN KEY(organization_id,next_employee_id)
   REFERENCES users(organization_id,id),
 CONSTRAINT fk_business_transfer_previous_type FOREIGN KEY(organization_id,previous_employee_id,employee_type)
   REFERENCES principals(organization_id,id,account_type),
 CONSTRAINT fk_business_transfer_next_type FOREIGN KEY(organization_id,next_employee_id,employee_type)
   REFERENCES principals(organization_id,id,account_type),
 CONSTRAINT fk_business_transfer_administrator FOREIGN KEY(organization_id,administrator_id,administrator_type)
   REFERENCES principals(organization_id,id,account_type),
 CONSTRAINT ck_business_transfer_distinct CHECK(previous_employee_id<>next_employee_id),
 CONSTRAINT ck_business_transfer_reason CHECK(CHAR_LENGTH(TRIM(reason))>0),
 CONSTRAINT ck_business_transfer_version CHECK(owner_version>1)
) ENGINE=InnoDB;

-- No transfer history is fabricated: pre-existing responsibility remains with its real creator.
-- A legacy administrator occupying a business creator relation stays a V22 mapping blocker.
INSERT INTO task_business_owners(organization_id,task_id,employee_id)
 SELECT t.organization_id,t.id,t.original_creator_id FROM tasks t JOIN principals p
 ON p.organization_id=t.organization_id AND p.id=t.original_creator_id AND p.account_type='employee';
