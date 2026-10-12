CREATE TABLE organizations (
 id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL, time_zone VARCHAR(40) NOT NULL DEFAULT 'Asia/Shanghai', authz_version BIGINT NOT NULL DEFAULT 1
) ENGINE=InnoDB;
CREATE TABLE teams (
 id VARCHAR(36) PRIMARY KEY, organization_id VARCHAR(36) NOT NULL, name VARCHAR(100) NOT NULL, parent_id VARCHAR(36),
 UNIQUE KEY uq_team_org(organization_id,id), FOREIGN KEY(organization_id) REFERENCES organizations(id),
 FOREIGN KEY(organization_id,parent_id) REFERENCES teams(organization_id,id)
) ENGINE=InnoDB;
CREATE TABLE users (
 id VARCHAR(36) PRIMARY KEY, organization_id VARCHAR(36) NOT NULL, team_id VARCHAR(36), manager_id VARCHAR(36),
 username VARCHAR(80) NOT NULL UNIQUE, password_hash VARCHAR(100) NOT NULL, display_name VARCHAR(100) NOT NULL,
 role VARCHAR(12) NOT NULL, rank_level INT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_user_org(organization_id,id), FOREIGN KEY(organization_id) REFERENCES organizations(id),
 FOREIGN KEY(organization_id,team_id) REFERENCES teams(organization_id,id), FOREIGN KEY(organization_id,manager_id) REFERENCES users(organization_id,id),
 CHECK(role IN ('admin','upper','middle','lower')), CHECK(rank_level BETWEEN 0 AND 100)
) ENGINE=InnoDB;
CREATE TABLE auth_sessions (
 id VARCHAR(36) PRIMARY KEY, organization_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NOT NULL,
 token_hash CHAR(64) NOT NULL UNIQUE, expires_at DATETIME(6) NOT NULL, revoked_at DATETIME(6), created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(organization_id,user_id) REFERENCES users(organization_id,id), KEY idx_session_user(user_id,expires_at)
) ENGINE=InnoDB;
CREATE TABLE tasks (
 id VARCHAR(36) PRIMARY KEY, organization_id VARCHAR(36) NOT NULL, original_creator_id VARCHAR(36) NOT NULL, current_version_id VARCHAR(36),
 execution_state VARCHAR(12) NOT NULL DEFAULT 'todo', row_version BIGINT NOT NULL DEFAULT 1, execution_round INT NOT NULL DEFAULT 1, due_version INT NOT NULL DEFAULT 1,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_task_org(organization_id,id), FOREIGN KEY(organization_id,original_creator_id) REFERENCES users(organization_id,id),
 CHECK(execution_state IN ('todo','doing','done')), CHECK(row_version>0 AND execution_round>0 AND due_version>0)
) ENGINE=InnoDB;
CREATE TABLE task_versions (
 id VARCHAR(36) PRIMARY KEY, organization_id VARCHAR(36) NOT NULL, task_id VARCHAR(36) NOT NULL, version_no INT NOT NULL,
 title VARCHAR(200) NOT NULL, description TEXT NOT NULL, acceptance_criteria TEXT NOT NULL, priority VARCHAR(12) NOT NULL,
 all_day BOOLEAN NOT NULL DEFAULT FALSE, start_at DATETIME(6) NOT NULL, due_at DATETIME(6) NOT NULL, start_date DATE, due_date DATE,
 execution_state VARCHAR(12) NOT NULL, progress_note TEXT NOT NULL, parent_task_id VARCHAR(36), status VARCHAR(12) NOT NULL,
 created_by VARCHAR(36) NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_version_org(organization_id,id), UNIQUE KEY uq_version_task(organization_id,task_id,id), UNIQUE KEY uq_version_no(task_id,version_no),
 FOREIGN KEY(organization_id,task_id) REFERENCES tasks(organization_id,id), FOREIGN KEY(organization_id,parent_task_id) REFERENCES tasks(organization_id,id),
 FOREIGN KEY(organization_id,created_by) REFERENCES users(organization_id,id),
 CHECK(start_at<=due_at), CHECK(priority IN ('urgent','high','medium','low')),
 CHECK(execution_state IN ('todo','doing','done')), CHECK(status IN ('proposed','applied','rejected','withdrawn')),
 CHECK((all_day=0 AND start_date IS NULL AND due_date IS NULL) OR (all_day=1 AND start_date IS NOT NULL AND due_date IS NOT NULL AND start_date<=due_date)),
 KEY idx_version_dates(organization_id,start_at,due_at)
) ENGINE=InnoDB;
ALTER TABLE tasks ADD CONSTRAINT fk_current_version FOREIGN KEY(organization_id,id,current_version_id) REFERENCES task_versions(organization_id,task_id,id);
CREATE TABLE task_version_assignees (
 organization_id VARCHAR(36) NOT NULL, version_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NOT NULL,
 PRIMARY KEY(organization_id,version_id,user_id), FOREIGN KEY(organization_id,version_id) REFERENCES task_versions(organization_id,id),
 FOREIGN KEY(organization_id,user_id) REFERENCES users(organization_id,id), KEY idx_assignee_user(organization_id,user_id,version_id)
) ENGINE=InnoDB;
CREATE TABLE approval_requests (
 id VARCHAR(36) PRIMARY KEY, organization_id VARCHAR(36) NOT NULL, task_id VARCHAR(36) NOT NULL, proposed_version_id VARCHAR(36) NOT NULL,
 applicant_id VARCHAR(36) NOT NULL, current_reviewer_id VARCHAR(36) NOT NULL, kind VARCHAR(12) NOT NULL, status VARCHAR(12) NOT NULL,
 comment TEXT, base_version_id VARCHAR(36), previous_state VARCHAR(12) NOT NULL, row_version BIGINT NOT NULL DEFAULT 1,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), decided_at DATETIME(6), decided_by VARCHAR(36), exemption_reason VARCHAR(500),
 pending_task_id VARCHAR(36) GENERATED ALWAYS AS (CASE WHEN status='pending' THEN task_id ELSE NULL END) STORED,
 UNIQUE KEY uq_request_org(organization_id,id), UNIQUE KEY uq_one_pending(organization_id,pending_task_id),
 FOREIGN KEY(organization_id,task_id) REFERENCES tasks(organization_id,id),
 FOREIGN KEY(organization_id,task_id,proposed_version_id) REFERENCES task_versions(organization_id,task_id,id),
 FOREIGN KEY(organization_id,task_id,base_version_id) REFERENCES task_versions(organization_id,task_id,id),
 FOREIGN KEY(organization_id,applicant_id) REFERENCES users(organization_id,id),
 FOREIGN KEY(organization_id,current_reviewer_id) REFERENCES users(organization_id,id),
 FOREIGN KEY(organization_id,decided_by) REFERENCES users(organization_id,id),
 CHECK(status IN ('pending','approved','rejected','withdrawn','direct')), CHECK(kind IN ('create','change','progress','complete','reopen')),
 CHECK(status<>'direct' OR exemption_reason IS NOT NULL),
 KEY idx_review_inbox(organization_id,current_reviewer_id,status), KEY idx_my_requests(organization_id,applicant_id,created_at)
) ENGINE=InnoDB;
CREATE TABLE task_records (
 id VARCHAR(36) PRIMARY KEY, organization_id VARCHAR(36) NOT NULL, task_id VARCHAR(36) NOT NULL, request_id VARCHAR(36), author_id VARCHAR(36) NOT NULL,
 body TEXT NOT NULL, kind VARCHAR(12) NOT NULL, effective_at DATETIME(6), created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(organization_id,task_id) REFERENCES tasks(organization_id,id), FOREIGN KEY(organization_id,request_id) REFERENCES approval_requests(organization_id,id),
 FOREIGN KEY(organization_id,author_id) REFERENCES users(organization_id,id)
) ENGINE=InnoDB;
CREATE TABLE work_logs (
 id VARCHAR(36) PRIMARY KEY, organization_id VARCHAR(36) NOT NULL, author_id VARCHAR(36) NOT NULL, business_date DATE NOT NULL, body TEXT NOT NULL,
 task_id VARCHAR(36), row_version BIGINT NOT NULL DEFAULT 1, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(organization_id,author_id) REFERENCES users(organization_id,id), FOREIGN KEY(organization_id,task_id) REFERENCES tasks(organization_id,id), KEY idx_logs_author(organization_id,author_id,business_date)
) ENGINE=InnoDB;
CREATE TABLE home_items (
 id VARCHAR(36) PRIMARY KEY, organization_id VARCHAR(36) NOT NULL, owner_id VARCHAR(36), kind VARCHAR(12) NOT NULL,
 title VARCHAR(200) NOT NULL, body TEXT NOT NULL, sort_order INT NOT NULL DEFAULT 0, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(organization_id) REFERENCES organizations(id), FOREIGN KEY(organization_id,owner_id) REFERENCES users(organization_id,id), CHECK(kind IN ('company','personal')),
 CHECK((kind='company' AND owner_id IS NULL) OR (kind='personal' AND owner_id IS NOT NULL))
) ENGINE=InnoDB;
CREATE TABLE domain_events (
 id VARCHAR(36) PRIMARY KEY, organization_id VARCHAR(36) NOT NULL, task_id VARCHAR(36), event_type VARCHAR(60) NOT NULL,
 recipients_json JSON NOT NULL, details_json JSON NOT NULL, status VARCHAR(12) NOT NULL DEFAULT 'pending',
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), delivered_at DATETIME(6),
 UNIQUE KEY uq_event_org(organization_id,id), FOREIGN KEY(organization_id) REFERENCES organizations(id), FOREIGN KEY(organization_id,task_id) REFERENCES tasks(organization_id,id),
 KEY idx_event_pending(status,created_at)
) ENGINE=InnoDB;
CREATE TABLE notifications (
 id VARCHAR(36) PRIMARY KEY, organization_id VARCHAR(36) NOT NULL, event_id VARCHAR(36) NOT NULL, recipient_id VARCHAR(36) NOT NULL,
 event_type VARCHAR(60) NOT NULL, task_id VARCHAR(36), summary VARCHAR(255) NOT NULL, read_at DATETIME(6), hidden_at DATETIME(6), created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_event_recipient(event_id,recipient_id), FOREIGN KEY(organization_id,event_id) REFERENCES domain_events(organization_id,id),
 FOREIGN KEY(organization_id,recipient_id) REFERENCES users(organization_id,id), FOREIGN KEY(organization_id,task_id) REFERENCES tasks(organization_id,id),
 KEY idx_inbox(organization_id,recipient_id,hidden_at,created_at)
) ENGINE=InnoDB;
CREATE TABLE audit_logs (
 id VARCHAR(36) PRIMARY KEY, organization_id VARCHAR(36) NOT NULL, actor_id VARCHAR(36) NOT NULL, object_id VARCHAR(36), action VARCHAR(60) NOT NULL,
 details_json JSON NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(organization_id,actor_id) REFERENCES users(organization_id,id), KEY idx_audit(organization_id,created_at)
) ENGINE=InnoDB;
CREATE TABLE idempotency_keys (
 organization_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NOT NULL, scope VARCHAR(140) NOT NULL, key_value VARCHAR(80) NOT NULL,
 request_hash CHAR(64) NOT NULL, response_json JSON NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(organization_id,user_id,scope,key_value), FOREIGN KEY(organization_id,user_id) REFERENCES users(organization_id,id)
) ENGINE=InnoDB;
CREATE TABLE ai_jobs (
 id VARCHAR(36) PRIMARY KEY, organization_id VARCHAR(36) NOT NULL, requested_by VARCHAR(36) NOT NULL, status VARCHAR(12) NOT NULL,
 scope_type VARCHAR(30) NOT NULL, result_json JSON NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), completed_at DATETIME(6),
 FOREIGN KEY(organization_id,requested_by) REFERENCES users(organization_id,id)
) ENGINE=InnoDB;
CREATE TABLE reminder_receipts (
 id VARCHAR(36) PRIMARY KEY, organization_id VARCHAR(36) NOT NULL, task_id VARCHAR(36) NOT NULL, recipient_id VARCHAR(36) NOT NULL,
 dedupe_key VARCHAR(220) NOT NULL UNIQUE, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(organization_id,task_id) REFERENCES tasks(organization_id,id), FOREIGN KEY(organization_id,recipient_id) REFERENCES users(organization_id,id)
) ENGINE=InnoDB;
