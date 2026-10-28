-- Preserve subject IDs while separating shared actor provenance from employee business references.
CREATE TABLE principals (
 id VARCHAR(36) PRIMARY KEY,
 organization_id VARCHAR(36) NOT NULL,
 account_type VARCHAR(12) NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_principal_org(organization_id,id),
 UNIQUE KEY uq_principal_type(organization_id,id,account_type),
 FOREIGN KEY(organization_id) REFERENCES organizations(id),
 CONSTRAINT ck_principal_type CHECK(account_type IN ('employee','admin'))
) ENGINE=InnoDB;

INSERT INTO principals(id,organization_id,account_type,active,created_at)
 SELECT id,organization_id,CASE WHEN role='admin' THEN 'admin' ELSE 'employee' END,active,created_at FROM users;

CREATE TABLE admin_accounts (
 id VARCHAR(36) PRIMARY KEY,
 organization_id VARCHAR(36) NOT NULL,
 account_name VARCHAR(80) NOT NULL,
 password_hash VARCHAR(100) NOT NULL,
 display_name VARCHAR(100) NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
 credential_version BIGINT NOT NULL DEFAULT 1,
 row_version BIGINT NOT NULL DEFAULT 1,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 principal_type VARCHAR(12) GENERATED ALWAYS AS ('admin') STORED,
 UNIQUE KEY uq_admin_company(organization_id),
 UNIQUE KEY uq_admin_account_name(account_name),
 CONSTRAINT fk_admin_principal FOREIGN KEY(organization_id,id,principal_type)
   REFERENCES principals(organization_id,id,account_type),
 CONSTRAINT ck_admin_credential_version CHECK(credential_version>0),
 CONSTRAINT ck_admin_row_version CHECK(row_version>0)
) ENGINE=InnoDB;

-- Multiple old admins require explicit resolution; never silently select the first.
INSERT INTO admin_accounts(id,organization_id,account_name,password_hash,display_name,active,
 must_change_password,credential_version,created_at)
 SELECT u.id,u.organization_id,u.username,u.password_hash,u.display_name,u.active,
   u.must_change_password,u.credential_version,u.created_at
 FROM users u WHERE u.role='admin'
 AND (SELECT COUNT(*) FROM users a WHERE a.organization_id=u.organization_id AND a.role='admin')=1;

INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
 SELECT REPLACE(UUID(),'-',''),o.id,'V22','admin_identity_mapping','blocker',o.id,
   'Exactly one independent administrator must be explicitly identified for this company.'
 FROM organizations o
 WHERE (SELECT COUNT(*) FROM admin_accounts a WHERE a.organization_id=o.id)<>1;

-- auth_sessions.user_id records an actor/recipient, not current employee eligibility.
SET @principal_fk := (SELECT constraint_name FROM information_schema.key_column_usage
 WHERE constraint_schema=DATABASE() AND table_name='auth_sessions' AND column_name='user_id'
 AND referenced_table_name='users' LIMIT 1);
SET @principal_ddl := CONCAT('ALTER TABLE auth_sessions DROP FOREIGN KEY `',@principal_fk,
 '`, ADD CONSTRAINT fk_auth_sessions_user_id_principal FOREIGN KEY(organization_id,user_id) REFERENCES principals(organization_id,id)');
PREPARE principal_statement FROM @principal_ddl;
EXECUTE principal_statement;
DEALLOCATE PREPARE principal_statement;

-- audit_logs.actor_id records an actor/recipient, not current employee eligibility.
SET @principal_fk := (SELECT constraint_name FROM information_schema.key_column_usage
 WHERE constraint_schema=DATABASE() AND table_name='audit_logs' AND column_name='actor_id'
 AND referenced_table_name='users' LIMIT 1);
SET @principal_ddl := CONCAT('ALTER TABLE audit_logs DROP FOREIGN KEY `',@principal_fk,
 '`, ADD CONSTRAINT fk_audit_logs_actor_id_principal FOREIGN KEY(organization_id,actor_id) REFERENCES principals(organization_id,id)');
PREPARE principal_statement FROM @principal_ddl;
EXECUTE principal_statement;
DEALLOCATE PREPARE principal_statement;

-- idempotency_keys.user_id records an actor/recipient, not current employee eligibility.
SET @principal_fk := (SELECT constraint_name FROM information_schema.key_column_usage
 WHERE constraint_schema=DATABASE() AND table_name='idempotency_keys' AND column_name='user_id'
 AND referenced_table_name='users' LIMIT 1);
SET @principal_ddl := CONCAT('ALTER TABLE idempotency_keys DROP FOREIGN KEY `',@principal_fk,
 '`, ADD CONSTRAINT fk_idempotency_keys_user_id_principal FOREIGN KEY(organization_id,user_id) REFERENCES principals(organization_id,id)');
PREPARE principal_statement FROM @principal_ddl;
EXECUTE principal_statement;
DEALLOCATE PREPARE principal_statement;

-- domain_events.initiator_id records an actor/recipient, not current employee eligibility.
SET @principal_fk := (SELECT constraint_name FROM information_schema.key_column_usage
 WHERE constraint_schema=DATABASE() AND table_name='domain_events' AND column_name='initiator_id'
 AND referenced_table_name='users' LIMIT 1);
SET @principal_ddl := CONCAT('ALTER TABLE domain_events DROP FOREIGN KEY `',@principal_fk,
 '`, ADD CONSTRAINT fk_domain_events_initiator_id_principal FOREIGN KEY(organization_id,initiator_id) REFERENCES principals(organization_id,id)');
PREPARE principal_statement FROM @principal_ddl;
EXECUTE principal_statement;
DEALLOCATE PREPARE principal_statement;

-- domain_events.revoked_by records an actor/recipient, not current employee eligibility.
SET @principal_fk := (SELECT constraint_name FROM information_schema.key_column_usage
 WHERE constraint_schema=DATABASE() AND table_name='domain_events' AND column_name='revoked_by'
 AND referenced_table_name='users' LIMIT 1);
SET @principal_ddl := CONCAT('ALTER TABLE domain_events DROP FOREIGN KEY `',@principal_fk,
 '`, ADD CONSTRAINT fk_domain_events_revoked_by_principal FOREIGN KEY(organization_id,revoked_by) REFERENCES principals(organization_id,id)');
PREPARE principal_statement FROM @principal_ddl;
EXECUTE principal_statement;
DEALLOCATE PREPARE principal_statement;

-- task_history_entries.actor_id records an actor/recipient, not current employee eligibility.
SET @principal_fk := (SELECT constraint_name FROM information_schema.key_column_usage
 WHERE constraint_schema=DATABASE() AND table_name='task_history_entries' AND column_name='actor_id'
 AND referenced_table_name='users' LIMIT 1);
SET @principal_ddl := CONCAT('ALTER TABLE task_history_entries DROP FOREIGN KEY `',@principal_fk,
 '`, ADD CONSTRAINT fk_task_history_entries_actor_id_principal FOREIGN KEY(organization_id,actor_id) REFERENCES principals(organization_id,id)');
PREPARE principal_statement FROM @principal_ddl;
EXECUTE principal_statement;
DEALLOCATE PREPARE principal_statement;

-- task_records.author_id records an actor/recipient, not current employee eligibility.
SET @principal_fk := (SELECT constraint_name FROM information_schema.key_column_usage
 WHERE constraint_schema=DATABASE() AND table_name='task_records' AND column_name='author_id'
 AND referenced_table_name='users' LIMIT 1);
SET @principal_ddl := CONCAT('ALTER TABLE task_records DROP FOREIGN KEY `',@principal_fk,
 '`, ADD CONSTRAINT fk_task_records_author_id_principal FOREIGN KEY(organization_id,author_id) REFERENCES principals(organization_id,id)');
PREPARE principal_statement FROM @principal_ddl;
EXECUTE principal_statement;
DEALLOCATE PREPARE principal_statement;

-- approval_requests.decided_by records an actor/recipient, not current employee eligibility.
SET @principal_fk := (SELECT constraint_name FROM information_schema.key_column_usage
 WHERE constraint_schema=DATABASE() AND table_name='approval_requests' AND column_name='decided_by'
 AND referenced_table_name='users' LIMIT 1);
SET @principal_ddl := CONCAT('ALTER TABLE approval_requests DROP FOREIGN KEY `',@principal_fk,
 '`, ADD CONSTRAINT fk_approval_requests_decided_by_principal FOREIGN KEY(organization_id,decided_by) REFERENCES principals(organization_id,id)');
PREPARE principal_statement FROM @principal_ddl;
EXECUTE principal_statement;
DEALLOCATE PREPARE principal_statement;

-- notifications.recipient_id records an actor/recipient, not current employee eligibility.
SET @principal_fk := (SELECT constraint_name FROM information_schema.key_column_usage
 WHERE constraint_schema=DATABASE() AND table_name='notifications' AND column_name='recipient_id'
 AND referenced_table_name='users' LIMIT 1);
SET @principal_ddl := CONCAT('ALTER TABLE notifications DROP FOREIGN KEY `',@principal_fk,
 '`, ADD CONSTRAINT fk_notifications_recipient_id_principal FOREIGN KEY(organization_id,recipient_id) REFERENCES principals(organization_id,id)');
PREPARE principal_statement FROM @principal_ddl;
EXECUTE principal_statement;
DEALLOCATE PREPARE principal_statement;

-- user_role_grants.granted_by records an actor/recipient, not current employee eligibility.
SET @principal_fk := (SELECT constraint_name FROM information_schema.key_column_usage
 WHERE constraint_schema=DATABASE() AND table_name='user_role_grants' AND column_name='granted_by'
 AND referenced_table_name='users' LIMIT 1);
SET @principal_ddl := CONCAT('ALTER TABLE user_role_grants DROP FOREIGN KEY `',@principal_fk,
 '`, ADD CONSTRAINT fk_user_role_grants_granted_by_principal FOREIGN KEY(organization_id,granted_by) REFERENCES principals(organization_id,id)');
PREPARE principal_statement FROM @principal_ddl;
EXECUTE principal_statement;
DEALLOCATE PREPARE principal_statement;

-- Grants are retired current configuration, not historical audit. The granting actor remains
-- traceable through principals; no administrator needs an employee placeholder for these grants.
DELETE g FROM user_role_grants g JOIN users u ON u.id=g.user_id AND u.organization_id=g.organization_id
 WHERE u.role='admin';

-- Audit every remaining employee-only FK, including self management and old assignment history.
-- An admin in one of these relations is a mapping blocker; do not delete that history, widen the
-- business FK to principals, or impersonate a replacement employee.
SET @saved_group_concat_limit := @@SESSION.group_concat_max_len;
SET SESSION group_concat_max_len=65536;
SELECT GROUP_CONCAT(CONCAT(
 'SELECT b.',IF(table_name='organizations','id','organization_id'),
 ' AS organization_id,u.id AS employee_id,''',table_name,'.',column_name,
 ''' AS source FROM `',table_name,'` b JOIN users u ON u.id=b.`',column_name,
 '` AND u.role=''admin''')
 SEPARATOR ' UNION ALL ') INTO @admin_business_references
 FROM information_schema.key_column_usage
 WHERE constraint_schema=DATABASE() AND referenced_table_name='users' AND referenced_column_name='id';

SET @principal_ddl := CONCAT(
 'INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail) ',
 'SELECT REPLACE(UUID(),''-'',''''),organization_id,''V22'',''admin_business_reference'',''blocker'',employee_id,',
 'CONCAT(''Administrator occupies employee-only relation: '',source,''. Explicit repair required; historical source is retained.'') ',
 'FROM (',@admin_business_references,') admin_refs');
PREPARE principal_statement FROM @principal_ddl;
EXECUTE principal_statement;
DEALLOCATE PREPARE principal_statement;
SET SESSION group_concat_max_len=@saved_group_concat_limit;

-- Only a provably independent admin may leave users. Conflicted rows remain blocked until a
-- controlled repair; the final cleanup migration will require every such blocker to be resolved.
DELETE u FROM users u JOIN admin_accounts a ON a.id=u.id AND a.organization_id=u.organization_id
 WHERE u.role='admin' AND NOT EXISTS (
 SELECT 1 FROM migration_findings f WHERE f.migration='V22'
 AND f.category='admin_business_reference' AND f.subject=u.id AND f.resolved_at IS NULL);

ALTER TABLE users
 ADD CONSTRAINT fk_employee_principal FOREIGN KEY(organization_id,id)
   REFERENCES principals(organization_id,id);

