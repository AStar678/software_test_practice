-- Shared tags retain their meaning. Personal tags and task marks belong to one employee.
ALTER TABLE tags
 ADD COLUMN owner_id VARCHAR(36) NULL,
 ADD COLUMN owner_scope VARCHAR(36) GENERATED ALWAYS AS (COALESCE(owner_id,'')) STORED,
 DROP INDEX uq_tag_name,
 ADD UNIQUE KEY uq_tag_scope_name(organization_id,owner_scope,name),
 ADD UNIQUE KEY uq_tag_owner_reference(organization_id,owner_id,id),
 ADD CONSTRAINT fk_tag_owner FOREIGN KEY(organization_id,owner_id) REFERENCES users(organization_id,id);

CREATE TABLE personal_task_tags (
 organization_id VARCHAR(36) NOT NULL,
 user_id VARCHAR(36) NOT NULL,
 task_id VARCHAR(36) NOT NULL,
 tag_id VARCHAR(36) NOT NULL,
 PRIMARY KEY(organization_id,user_id,task_id),
 CONSTRAINT fk_personal_tag_user FOREIGN KEY(organization_id,user_id) REFERENCES users(organization_id,id),
 CONSTRAINT fk_personal_tag_task FOREIGN KEY(organization_id,task_id) REFERENCES tasks(organization_id,id),
 CONSTRAINT fk_personal_tag_owner FOREIGN KEY(organization_id,user_id,tag_id) REFERENCES tags(organization_id,owner_id,id)
) ENGINE=InnoDB;

-- A calm six-colour work calendar. Existing shared names/colours are never overwritten.
INSERT INTO tags(id,organization_id,name,color)
SELECT UUID(),o.id,d.name,d.color FROM organizations o CROSS JOIN (
 SELECT '项目工作' name,'#D8EAF4' color UNION ALL
 SELECT '会议沟通','#FBE3CB' UNION ALL
 SELECT '专注处理','#E4DEF3' UNION ALL
 SELECT '交付验收','#F6D5D2' UNION ALL
 SELECT '学习成长','#DCEEE0' UNION ALL
 SELECT '日常事务','#F8EFC8'
) d WHERE NOT EXISTS (
 SELECT 1 FROM tags t WHERE t.organization_id=o.id AND t.owner_id IS NULL AND t.name=d.name
);
