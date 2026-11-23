-- 每日事项由单日升级为首尾均包含的日期范围。既有记录无损映射为 start_date=end_date=原 item_date：
-- ID、所有者、正文、完成状态、行版本与真实时间保持不变。历史迁移与校验和均不修改。
ALTER TABLE daily_items RENAME COLUMN item_date TO start_date;
ALTER TABLE daily_items ADD COLUMN end_date DATE NULL AFTER start_date;
UPDATE daily_items SET end_date=start_date WHERE end_date IS NULL;
ALTER TABLE daily_items MODIFY end_date DATE NOT NULL;

-- The new range index must exist before the old one is dropped: the owner foreign key still needs an
-- index whose left-most columns are (organization_id,owner_id).
ALTER TABLE daily_items ADD KEY idx_daily_item_owner_range(organization_id,owner_id,start_date,end_date,created_at,id);
ALTER TABLE daily_items DROP INDEX idx_daily_item_owner_date;
ALTER TABLE daily_items ADD CONSTRAINT ck_daily_item_range CHECK(end_date>=start_date);
