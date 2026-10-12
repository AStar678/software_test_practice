-- 原型首页条目接入持久化编辑，使用版本号防止覆盖并发修改。
ALTER TABLE home_items ADD COLUMN row_version BIGINT NOT NULL DEFAULT 1;
