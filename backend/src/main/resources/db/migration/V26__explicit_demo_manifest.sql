-- Only the explicit preparation command may initialize the marker on an empty database.
-- Normal application startup never creates a demo identity or clears business data.
CREATE TABLE demo_database_identity (
 singleton INT PRIMARY KEY,
 database_name VARCHAR(64) NOT NULL,
 marker VARCHAR(100) NOT NULL,
 manifest_version INT NOT NULL,
 business_date DATE NOT NULL,
 prepared_at DATETIME(6) NULL,
 CONSTRAINT ck_demo_singleton CHECK(singleton=1)
) ENGINE=InnoDB;
CREATE TABLE demo_seed_keys (
 seed_key VARCHAR(100) PRIMARY KEY,
 organization_id VARCHAR(36) NOT NULL,
 object_type VARCHAR(24) NOT NULL,
 object_id VARCHAR(36) NOT NULL,
 UNIQUE KEY uq_demo_object(object_type,object_id),
 FOREIGN KEY(organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB;
