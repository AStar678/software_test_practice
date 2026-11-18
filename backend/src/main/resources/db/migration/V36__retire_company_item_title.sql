-- 公司事件纪只保留正文：用户已明确退役独立标题，管理端与员工端只维护 body。
-- 本迁移只删除标题列，不改写已应用的迁移，也不触碰正文、ID、组织归属、顺序、
-- 版本（row_version）及创建时间；任务与通知的 title 列保持不变。
ALTER TABLE home_items DROP COLUMN title;
