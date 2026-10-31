CREATE TABLE task_version_tags (
 organization_id VARCHAR(36) NOT NULL,
 version_id VARCHAR(36) NOT NULL,
 tag_id VARCHAR(36) NOT NULL,
 ordinal INT NOT NULL,
 tag_name_snapshot VARCHAR(40) NULL,
 tag_color_snapshot VARCHAR(16) NULL,
 PRIMARY KEY (organization_id,version_id,tag_id),
 UNIQUE KEY uq_version_tag_order (organization_id,version_id,ordinal),
 FOREIGN KEY (organization_id,version_id) REFERENCES task_versions(organization_id,id),
 FOREIGN KEY (organization_id,tag_id) REFERENCES tags(organization_id,id),
 CONSTRAINT ck_version_tag_ordinal CHECK (ordinal >= 0)
) ENGINE=InnoDB;

INSERT INTO task_version_tags(organization_id,version_id,tag_id,ordinal,tag_name_snapshot,tag_color_snapshot)
SELECT organization_id,id,tag_id,0,tag_name_snapshot,tag_color_snapshot
FROM task_versions WHERE tag_id IS NOT NULL;
