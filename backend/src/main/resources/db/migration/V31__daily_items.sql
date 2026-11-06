-- 每日事项：本人私有、按公历日期保存纯文本与完成状态，不关联任务或日志。
-- 原 home_items 的个人事项为非生产数据，用户确认无需迁移保留；本迁移只清理 personal 行，
-- 公司信息、任务、日志、审核与审计全部保持不变。
CREATE TABLE daily_items (
 id VARCHAR(36) PRIMARY KEY,
 organization_id VARCHAR(36) NOT NULL,
 owner_id VARCHAR(36) NOT NULL,
 item_date DATE NOT NULL,
 body TEXT NOT NULL,
 completed BOOLEAN NOT NULL DEFAULT FALSE,
 row_version BIGINT NOT NULL DEFAULT 1,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_daily_item_org(organization_id,id),
 KEY idx_daily_item_owner_date(organization_id,owner_id,item_date,created_at,id),
 CONSTRAINT fk_daily_item_owner FOREIGN KEY(organization_id,owner_id) REFERENCES users(organization_id,id),
 CONSTRAINT ck_daily_item_body CHECK(CHAR_LENGTH(body) BETWEEN 1 AND 2000),
 CONSTRAINT ck_daily_item_version CHECK(row_version > 0)
) ENGINE=InnoDB;

DELETE FROM home_items WHERE kind='personal';
