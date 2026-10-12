-- Contacts belong to the authenticated user's private profile, never the user directory.
ALTER TABLE users
 ADD COLUMN phone VARCHAR(32) NULL,
 ADD COLUMN email VARCHAR(254) NULL,
 ADD COLUMN profile_version BIGINT NOT NULL DEFAULT 1,
 ADD CONSTRAINT ck_users_profile_version CHECK (profile_version > 0);
