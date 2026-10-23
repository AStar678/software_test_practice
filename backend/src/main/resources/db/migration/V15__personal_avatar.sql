-- Avatars belong to the authenticated profile and share its optimistic-lock version.
ALTER TABLE users ADD COLUMN avatar MEDIUMTEXT NULL;
