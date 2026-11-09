-- 真实入职日期：可空，存量未知保持 NULL，绝不用 created_at 或账号创建时间回填。
ALTER TABLE users ADD COLUMN hire_date DATE NULL;

-- 中国大陆官方年度放假/调休缓存。头记录按 region+year 唯一，日记录整年提交时原子替换；
-- 普通读取只依赖本库，不要求实时访问外网。来源/版本/通知依据与最近刷新结果用于维护审计。
CREATE TABLE holiday_calendar_years (
 region VARCHAR(8) NOT NULL,
 year INT NOT NULL,
 source VARCHAR(200) NOT NULL,
 source_version VARCHAR(100) NULL,
 source_hash CHAR(64) NULL,
 official_notice VARCHAR(500) NULL,
 fetched_at DATETIME(6) NOT NULL,
 last_attempt_at DATETIME(6) NULL,
 last_failure_at DATETIME(6) NULL,
 last_failure_code VARCHAR(60) NULL,
 PRIMARY KEY(region,year),
 CONSTRAINT ck_holiday_year CHECK(year BETWEEN 1900 AND 9999)
) ENGINE=InnoDB;

CREATE TABLE holiday_calendar_days (
 region VARCHAR(8) NOT NULL,
 year INT NOT NULL,
 holiday_date DATE NOT NULL,
 name VARCHAR(100) NOT NULL,
 is_off_day BOOLEAN NOT NULL,
 PRIMARY KEY(region,year,holiday_date),
 CONSTRAINT fk_holiday_day_year FOREIGN KEY(region,year)
   REFERENCES holiday_calendar_years(region,year) ON DELETE CASCADE,
 CONSTRAINT ck_holiday_day_name CHECK(CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 100)
) ENGINE=InnoDB;
