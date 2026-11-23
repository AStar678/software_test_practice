-- Daily items keep the inclusive date range and add an explicit whole-day flag plus optional
-- company-local start/end times. Every existing row is a whole-day item with no times.
ALTER TABLE daily_items
    ADD COLUMN all_day BOOLEAN NOT NULL DEFAULT TRUE AFTER end_date,
    ADD COLUMN start_time TIME NULL AFTER all_day,
    ADD COLUMN end_time TIME NULL AFTER start_time;
