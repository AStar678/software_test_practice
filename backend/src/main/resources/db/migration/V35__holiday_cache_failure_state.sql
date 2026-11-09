-- A failed fetch for a year with no successful cache still needs its attempt/failure state so the
-- background refresh obeys the 24-hour retry interval across restarts. A missing year therefore has a
-- header row with fetched_at NULL (and no day rows); ready/stale years keep a non-null fetched_at.
ALTER TABLE holiday_calendar_years MODIFY COLUMN fetched_at DATETIME(6) NULL;
