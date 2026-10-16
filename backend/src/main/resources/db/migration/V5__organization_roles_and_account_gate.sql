-- Task 1.2 (DEV-001..003): independent organization, team lead, role grants and account gate.
--
-- Staged by design. This migration only *adds* structure and backfills from an explicit,
-- operator-supplied mapping. It never invents a department or a position from a legacy team
-- name, and it never fabricates an order, a dispatch time or a notification source.
--
-- Because the repository V4 snapshot has seven users with no real department mapping, the
-- NOT NULL tightening cannot run here without inventing data. `cn.pandora.admin.OrganizationConstraints`
-- applies that tightening idempotently as soon as the mapping is complete (see V5 findings and
-- scripts/migration_precheck.py). V1..V4 checksums are untouched.

CREATE TABLE departments (
 id VARCHAR(36) PRIMARY KEY,
 organization_id VARCHAR(36) NOT NULL,
 name VARCHAR(100) NOT NULL,
 parent_id VARCHAR(36) NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_department_org(organization_id,id),
 UNIQUE KEY uq_department_name(organization_id,name),
 FOREIGN KEY(organization_id) REFERENCES organizations(id),
 FOREIGN KEY(organization_id,parent_id) REFERENCES departments(organization_id,id)
) ENGINE=InnoDB;

CREATE TABLE positions (
 id VARCHAR(36) PRIMARY KEY,
 organization_id VARCHAR(36) NOT NULL,
 name VARCHAR(100) NOT NULL,
 sort_order INT NOT NULL DEFAULT 0,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_position_org(organization_id,id),
 UNIQUE KEY uq_position_name(organization_id,name),
 FOREIGN KEY(organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB;

-- Explicit operator-supplied mapping. Empty by default: a missing mapping stays missing and is
-- reported, instead of being guessed from teams. One row maps one legacy team, or one legacy
-- username, to a real department and position name.
CREATE TABLE organization_mapping_config (
 id VARCHAR(36) PRIMARY KEY,
 organization_id VARCHAR(36) NOT NULL,
 legacy_team_id VARCHAR(36) NULL,
 legacy_team_name VARCHAR(100) NULL,
 legacy_username VARCHAR(80) NULL,
 department_name VARCHAR(100) NOT NULL,
 position_name VARCHAR(100) NOT NULL,
 note VARCHAR(500) NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_mapping_team(organization_id,legacy_team_id),
 UNIQUE KEY uq_mapping_username(organization_id,legacy_username),
 FOREIGN KEY(organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB;

-- Capability bundles. `administrator` marks the single account-administration identity; it does
-- not imply any business scope (those live in role_scopes and are absent for the administrator).
CREATE TABLE roles (
 id VARCHAR(36) PRIMARY KEY,
 organization_id VARCHAR(36) NOT NULL,
 code VARCHAR(40) NOT NULL,
 name VARCHAR(100) NOT NULL,
 administrator BOOLEAN NOT NULL DEFAULT FALSE,
 system_role BOOLEAN NOT NULL DEFAULT FALSE,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_role_org(organization_id,id),
 UNIQUE KEY uq_role_code(organization_id,code),
 FOREIGN KEY(organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB;

CREATE TABLE role_capabilities (
 organization_id VARCHAR(36) NOT NULL,
 role_id VARCHAR(36) NOT NULL,
 capability VARCHAR(60) NOT NULL,
 PRIMARY KEY(organization_id,role_id,capability),
 FOREIGN KEY(organization_id,role_id) REFERENCES roles(organization_id,id)
) ENGINE=InnoDB;

-- View and dispatch authority are configured separately, each with its own range.
CREATE TABLE role_scopes (
 organization_id VARCHAR(36) NOT NULL,
 role_id VARCHAR(36) NOT NULL,
 scope_type VARCHAR(24) NOT NULL,
 scope_level VARCHAR(16) NOT NULL,
 PRIMARY KEY(organization_id,role_id,scope_type),
 FOREIGN KEY(organization_id,role_id) REFERENCES roles(organization_id,id),
 CONSTRAINT ck_role_scope_type CHECK(scope_type IN ('task_view','task_dispatch','log_read','profile_read')),
 CONSTRAINT ck_role_scope_level CHECK(scope_level IN ('self','reports','department','company'))
) ENGINE=InnoDB;

CREATE TABLE user_role_grants (
 organization_id VARCHAR(36) NOT NULL,
 user_id VARCHAR(36) NOT NULL,
 role_id VARCHAR(36) NOT NULL,
 granted_by VARCHAR(36) NULL,
 granted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(organization_id,user_id,role_id),
 FOREIGN KEY(organization_id,user_id) REFERENCES users(organization_id,id),
 FOREIGN KEY(organization_id,role_id) REFERENCES roles(organization_id,id),
 FOREIGN KEY(organization_id,granted_by) REFERENCES users(organization_id,id)
) ENGINE=InnoDB;

-- Auditable outcome of the staged migration. Rows are inserted by this migration and updated by
-- OrganizationConstraints once the mapping is resolved.
CREATE TABLE migration_findings (
 id VARCHAR(36) PRIMARY KEY,
 organization_id VARCHAR(36) NULL,
 migration VARCHAR(40) NOT NULL,
 category VARCHAR(60) NOT NULL,
 severity VARCHAR(12) NOT NULL,
 subject VARCHAR(200) NULL,
 detail TEXT NOT NULL,
 resolved_at DATETIME(6) NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 KEY idx_finding_open(severity,category,resolved_at),
 CONSTRAINT ck_finding_severity CHECK(severity IN ('blocker','limitation'))
) ENGINE=InnoDB;

ALTER TABLE organizations
 ADD COLUMN off_work_time TIME NOT NULL DEFAULT '18:00:00';

ALTER TABLE users
 ADD COLUMN department_id VARCHAR(36) NULL,
 ADD COLUMN position_id VARCHAR(36) NULL,
 ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN credential_version BIGINT NOT NULL DEFAULT 1,
 ADD COLUMN reviewer_available BOOLEAN NOT NULL DEFAULT TRUE,
 ADD CONSTRAINT fk_users_department FOREIGN KEY(organization_id,department_id) REFERENCES departments(organization_id,id),
 ADD CONSTRAINT fk_users_position FOREIGN KEY(organization_id,position_id) REFERENCES positions(organization_id,id),
 ADD CONSTRAINT ck_users_credential_version CHECK(credential_version>0);

ALTER TABLE teams
 ADD COLUMN department_id VARCHAR(36) NULL,
 ADD COLUMN lead_user_id VARCHAR(36) NULL,
 ADD CONSTRAINT fk_teams_department FOREIGN KEY(organization_id,department_id) REFERENCES departments(organization_id,id),
 ADD CONSTRAINT fk_teams_lead FOREIGN KEY(organization_id,lead_user_id) REFERENCES users(organization_id,id);

-- Staged backfill 1/3: materialize the departments and positions named by the explicit mapping.
INSERT INTO departments(id,organization_id,name)
 SELECT REPLACE(UUID(),'-',''), c.organization_id, c.department_name
 FROM (SELECT DISTINCT organization_id,department_name FROM organization_mapping_config) c
 WHERE NOT EXISTS (SELECT 1 FROM departments d
   WHERE d.organization_id=c.organization_id AND d.name=c.department_name);

INSERT INTO positions(id,organization_id,name)
 SELECT REPLACE(UUID(),'-',''), c.organization_id, c.position_name
 FROM (SELECT DISTINCT organization_id,position_name FROM organization_mapping_config) c
 WHERE NOT EXISTS (SELECT 1 FROM positions p
   WHERE p.organization_id=c.organization_id AND p.name=c.position_name);

-- Staged backfill 2/3: only rows with a provable mapping. Team membership, then a direct
-- username mapping as a fallback for users that have no team.
UPDATE users u
 JOIN teams t ON t.organization_id=u.organization_id AND t.id=u.team_id
 JOIN organization_mapping_config c ON c.organization_id=u.organization_id
   AND (c.legacy_team_id=t.id OR (c.legacy_team_id IS NULL AND c.legacy_username IS NULL AND c.legacy_team_name=t.name))
 JOIN departments d ON d.organization_id=u.organization_id AND d.name=c.department_name
 JOIN positions p ON p.organization_id=u.organization_id AND p.name=c.position_name
 SET u.department_id=COALESCE(u.department_id,d.id), u.position_id=COALESCE(u.position_id,p.id)
 WHERE u.department_id IS NULL OR u.position_id IS NULL;

UPDATE users u
 JOIN organization_mapping_config c ON c.organization_id=u.organization_id AND c.legacy_username=u.username
 JOIN departments d ON d.organization_id=u.organization_id AND d.name=c.department_name
 JOIN positions p ON p.organization_id=u.organization_id AND p.name=c.position_name
 SET u.department_id=COALESCE(u.department_id,d.id), u.position_id=COALESCE(u.position_id,p.id)
 WHERE u.department_id IS NULL OR u.position_id IS NULL;

UPDATE teams t
 JOIN organization_mapping_config c ON c.organization_id=t.organization_id
   AND (c.legacy_team_id=t.id OR (c.legacy_team_id IS NULL AND c.legacy_username IS NULL AND c.legacy_team_name=t.name))
 JOIN departments d ON d.organization_id=t.organization_id AND d.name=c.department_name
 SET t.department_id=COALESCE(t.department_id,d.id)
 WHERE t.department_id IS NULL;

-- Staged backfill 3/3: role definitions and grants for the legacy `users.role` column. The legacy
-- role value is a provable source of the account's current authority, so this is a real backfill
-- rather than invented data. Administrator gets management capabilities and no business scope.
INSERT INTO roles(id,organization_id,code,name,administrator,system_role)
 SELECT REPLACE(UUID(),'-',''), o.id, r.code, r.name, r.administrator, TRUE
 FROM organizations o
 JOIN (SELECT 'admin' code,'管理员' name,TRUE administrator
       UNION ALL SELECT 'executive','上层',FALSE
       UNION ALL SELECT 'manager','中层',FALSE
       UNION ALL SELECT 'employee','下层',FALSE) r
 WHERE NOT EXISTS (SELECT 1 FROM roles x WHERE x.organization_id=o.id AND x.code=r.code);

INSERT INTO role_capabilities(organization_id,role_id,capability)
 SELECT r.organization_id,r.id,c.capability FROM roles r
 JOIN (SELECT 'admin' code,'manage_organization' capability
       UNION ALL SELECT 'admin','manage_accounts'
       UNION ALL SELECT 'admin','manage_company_info'
       UNION ALL SELECT 'admin','manage_notifications'
       UNION ALL SELECT 'admin','view_task_history'
       UNION ALL SELECT 'executive','create_task'
       UNION ALL SELECT 'executive','handover_own'
       UNION ALL SELECT 'executive','handover_reports'
       UNION ALL SELECT 'manager','create_task'
       UNION ALL SELECT 'manager','handover_own'
       UNION ALL SELECT 'manager','handover_reports'
       UNION ALL SELECT 'manager','manage_team'
       UNION ALL SELECT 'employee','create_task'
       UNION ALL SELECT 'employee','handover_own') c ON c.code=r.code
 WHERE NOT EXISTS (SELECT 1 FROM role_capabilities x
   WHERE x.organization_id=r.organization_id AND x.role_id=r.id AND x.capability=c.capability);

INSERT INTO role_scopes(organization_id,role_id,scope_type,scope_level)
 SELECT r.organization_id,r.id,s.scope_type,s.scope_level FROM roles r
 JOIN (SELECT 'executive' code,'task_view' scope_type,'company' scope_level
       UNION ALL SELECT 'executive','task_dispatch','company'
       UNION ALL SELECT 'executive','log_read','company'
       UNION ALL SELECT 'executive','profile_read','company'
       UNION ALL SELECT 'manager','task_view','department'
       UNION ALL SELECT 'manager','task_dispatch','department'
       UNION ALL SELECT 'manager','log_read','reports'
       UNION ALL SELECT 'manager','profile_read','reports'
       UNION ALL SELECT 'employee','task_view','self'
       UNION ALL SELECT 'employee','task_dispatch','self'
       UNION ALL SELECT 'employee','log_read','self'
       UNION ALL SELECT 'employee','profile_read','self') s ON s.code=r.code
 WHERE NOT EXISTS (SELECT 1 FROM role_scopes x
   WHERE x.organization_id=r.organization_id AND x.role_id=r.id AND x.scope_type=s.scope_type);

INSERT INTO user_role_grants(organization_id,user_id,role_id)
 SELECT u.organization_id,u.id,r.id FROM users u
 JOIN roles r ON r.organization_id=u.organization_id
   AND r.code=CASE u.role WHEN 'admin' THEN 'admin' WHEN 'upper' THEN 'executive'
                          WHEN 'middle' THEN 'manager' ELSE 'employee' END
 WHERE NOT EXISTS (SELECT 1 FROM user_role_grants g
   WHERE g.organization_id=u.organization_id AND g.user_id=u.id AND g.role_id=r.id);

-- Persist the unresolved gaps so the administrator interface and the verifier can both read them.
INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
 SELECT REPLACE(UUID(),'-',''), o.id, 'V5', 'organization_mapping', 'blocker', NULL,
   CONCAT('员工部门和职位必填约束尚未收紧：', COUNT(u.id), ' 个账号缺少真实部门/职位映射。'
          '需管理员按组织维护流程补齐后由 OrganizationConstraints 收紧；迁移不会用旧团队名伪造部门。')
 FROM organizations o LEFT JOIN users u ON u.organization_id=o.id
   AND (u.department_id IS NULL OR u.position_id IS NULL)
 GROUP BY o.id HAVING COUNT(u.id)>0;

INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
 SELECT REPLACE(UUID(),'-',''), o.id, 'V5', 'team_department_mapping', 'blocker', NULL,
   CONCAT('团队部门归属缺失：', COUNT(t.id), ' 个团队没有真实部门映射。')
 FROM organizations o LEFT JOIN teams t ON t.organization_id=o.id AND t.department_id IS NULL
 GROUP BY o.id HAVING COUNT(t.id)>0;

INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
 SELECT REPLACE(UUID(),'-',''), w.organization_id, 'V5', 'duplicate_work_logs', 'blocker',
   CONCAT(w.author_id, '@', w.business_date),
   CONCAT('同一作者同一业务日存在 ', COUNT(*), ' 篇日志，唯一键启用前必须无损归并并保留全部原文。')
 FROM work_logs w GROUP BY w.organization_id,w.author_id,w.business_date HAVING COUNT(*)>1;

INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
 SELECT REPLACE(UUID(),'-',''), a.organization_id, 'V5', 'assignee_order_unknown', 'limitation', NULL,
   CONCAT(COUNT(*), ' 条负责人记录没有可证明的提交顺序，首次正式编辑前按确定性顺序兼容读取并标记 legacy-order-unknown。')
 FROM task_version_assignees a GROUP BY a.organization_id HAVING COUNT(*)>0;

INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
 SELECT REPLACE(UUID(),'-',''), a.organization_id, 'V5', 'dispatch_time_missing', 'limitation', NULL,
   CONCAT(COUNT(*), ' 条有效负责人记录缺少真实派发时间，迁移仅按可证明来源回填，其余标记 legacy-estimate。')
 FROM task_version_assignees a JOIN tasks t
   ON t.organization_id=a.organization_id AND t.current_version_id=a.version_id
 GROUP BY a.organization_id HAVING COUNT(*)>0;

INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
 SELECT REPLACE(UUID(),'-',''), n.organization_id, 'V5', 'notification_source_unbound', 'limitation', NULL,
   CONCAT(COUNT(*), ' 条站内消息无法绑定原申请，仅可依据可证明来源迁移，其余保持只读且不提供审核按钮。')
 FROM notifications n LEFT JOIN domain_events e
   ON e.organization_id=n.organization_id AND e.id=n.event_id
 WHERE e.id IS NULL OR JSON_EXTRACT(e.details_json,'$.requestId') IS NULL
 GROUP BY n.organization_id HAVING COUNT(*)>0;

INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
 SELECT REPLACE(UUID(),'-',''), r.organization_id, 'V5', 'expired_pending_request', 'blocker', r.id,
   '待审申请已超过适用截止，迁移后必须按失效规则处理，不能批准生效。'
 FROM approval_requests r
 JOIN task_versions v ON v.organization_id=r.organization_id AND v.id=r.proposed_version_id
 WHERE r.status='pending' AND v.due_at<=UTC_TIMESTAMP(6);
