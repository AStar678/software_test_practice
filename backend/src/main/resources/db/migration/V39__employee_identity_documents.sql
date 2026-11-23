-- Employee identity documents keep the administrator-only 18-digit resident ID number in a
-- dedicated table: old employees may have no row, employee-facing projections never query it,
-- and one normalized number stays unique inside a company.
CREATE TABLE employee_identity_documents (
  organization_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  id_card_no CHAR(18) NOT NULL,
  row_version BIGINT NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NULL,
  PRIMARY KEY(organization_id, employee_id),
  UNIQUE KEY uq_id_card_company(organization_id, id_card_no),
  FOREIGN KEY(organization_id, employee_id) REFERENCES users(organization_id, id),
  CONSTRAINT ck_id_card_no_length CHECK(CHAR_LENGTH(id_card_no) = 18)
) ENGINE=InnoDB;
