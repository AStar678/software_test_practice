-- Dedicated handover preset (V-010 / DEV-004): the person or their direct manager may store the
-- successor to use for that person's current tasks. The target is revalidated when the handover is
-- submitted, so an organization change or an inactive target cannot silently keep working.
CREATE TABLE handover_presets (
  organization_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  target_user_id VARCHAR(36) NOT NULL,
  set_by_user_id VARCHAR(36) NOT NULL,
  row_version BIGINT NOT NULL DEFAULT 1,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (organization_id,user_id),
  KEY idx_handover_preset_target (organization_id,target_user_id),
  FOREIGN KEY (organization_id,user_id) REFERENCES users(organization_id,id),
  FOREIGN KEY (organization_id,target_user_id) REFERENCES users(organization_id,id),
  FOREIGN KEY (organization_id,set_by_user_id) REFERENCES users(organization_id,id)
) ENGINE=InnoDB;
