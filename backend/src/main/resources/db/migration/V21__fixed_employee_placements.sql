-- Expansion only: legacy relationships are not evidence of a fixed founder or a position.
-- A reviewed stable-ID mapping must populate this structure before business access is enabled.
-- The final-plan validator enforces coverage, active employees and founder consistency.
ALTER TABLE users
 MODIFY department_id VARCHAR(36) NULL,
 MODIFY position_id VARCHAR(36) NULL;

ALTER TABLE organizations
 ADD COLUMN founder_employee_id VARCHAR(36) NULL,
 ADD CONSTRAINT fk_organization_founder FOREIGN KEY(id,founder_employee_id)
   REFERENCES users(organization_id,id);

-- A placement's department must be the team's actual department, including at the SQL boundary.
ALTER TABLE teams ADD UNIQUE KEY uq_team_department(organization_id,department_id,id);

CREATE TABLE employee_placements (
 organization_id VARCHAR(36) NOT NULL,
 employee_id VARCHAR(36) NOT NULL,
 placement_type VARCHAR(20) NOT NULL,
 department_id VARCHAR(36) NULL,
 team_id VARCHAR(36) NULL,
 position_id VARCHAR(36) NOT NULL,
 row_version BIGINT NOT NULL DEFAULT 1,
 founder_slot VARCHAR(36) GENERATED ALWAYS AS
   (CASE WHEN placement_type='founder' THEN organization_id ELSE NULL END) STORED,
 department_head_slot VARCHAR(36) GENERATED ALWAYS AS
   (CASE WHEN placement_type='department_head' THEN department_id ELSE NULL END) STORED,
 team_head_slot VARCHAR(36) GENERATED ALWAYS AS
   (CASE WHEN placement_type='team_head' THEN team_id ELSE NULL END) STORED,
 PRIMARY KEY(organization_id,employee_id),
 UNIQUE KEY uq_placement_employee(employee_id),
 UNIQUE KEY uq_placement_founder(founder_slot),
 UNIQUE KEY uq_placement_department_head(organization_id,department_head_slot),
 UNIQUE KEY uq_placement_team_head(organization_id,team_head_slot),
 CONSTRAINT fk_placement_employee FOREIGN KEY(organization_id,employee_id)
   REFERENCES users(organization_id,id),
 CONSTRAINT fk_placement_department FOREIGN KEY(organization_id,department_id)
   REFERENCES departments(organization_id,id),
 CONSTRAINT fk_placement_team FOREIGN KEY(organization_id,department_id,team_id)
   REFERENCES teams(organization_id,department_id,id),
 CONSTRAINT fk_placement_position FOREIGN KEY(organization_id,position_id)
   REFERENCES positions(organization_id,id),
 CONSTRAINT ck_placement_shape CHECK (
   (placement_type='founder' AND department_id IS NULL AND team_id IS NULL)
   OR (placement_type='department_head' AND department_id IS NOT NULL AND team_id IS NULL)
   OR (placement_type IN ('team_head','employee') AND department_id IS NOT NULL AND team_id IS NOT NULL)
 ),
 CONSTRAINT ck_placement_version CHECK(row_version>0)
) ENGINE=InnoDB;

INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
 SELECT REPLACE(UUID(),'-',''),id,'V21','fixed_organization_mapping','blocker',id,
   'Explicit stable-ID mapping required: fixed founder, employee placements, unit heads and display positions. Legacy roots, ranks and titles are not authority.'
 FROM organizations;
