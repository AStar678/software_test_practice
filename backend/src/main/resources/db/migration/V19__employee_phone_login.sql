-- Chapter 2.1: a separate, normalized employee login key.
--
-- The public username column stays exactly as it is: it is returned by several existing DTOs, so
-- turning it into a phone number would publish contact data. Instead `login_phone` is a separate
-- authentication-only identifier. Employees authenticate with it; the single administrator identity
-- keeps its original username/password login.
--
-- Staged and non-inventive:
--  * only an existing contact number is normalized (display separators removed, a leading + kept);
--  * a missing number or a normalized duplicate is reported as a migration blocker and is never
--    repaired by generating a number or by creating another account;
--  * the unique index is added only when no normalized duplicate exists, so the migration never
--    fails or silently drops a person on conflicting data.
--
-- The application applies the same normalization in cn.pandora.auth.PhoneNumbers for every later
-- write, so a login key can never drift from the contact number it was derived from.

ALTER TABLE users ADD COLUMN login_phone VARCHAR(32) NULL;

UPDATE users
SET login_phone = NULLIF(
  TRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    phone, ' ', ''), '-', ''), '(', ''), ')', ''), '.', ''), '　', ''), CHAR(9), '')),
  '')
WHERE phone IS NOT NULL AND TRIM(phone) <> '';

SET @duplicates := (SELECT COUNT(*) FROM (
  SELECT login_phone FROM users
  WHERE login_phone IS NOT NULL AND login_phone <> ''
  GROUP BY login_phone HAVING COUNT(*) > 1) x);

SET @ddl := IF(@duplicates = 0,
  'ALTER TABLE users ADD UNIQUE KEY uq_users_login_phone (login_phone)',
  'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
SELECT REPLACE(UUID(),'-',''), u.organization_id, 'V19', 'employee_login_phone_missing', 'blocker', u.id,
       CONCAT('员工账号 ', u.id, ' 缺少可用于登录的手机号，迁移不会生成号码；'
              '管理员需通过员工维护流程录入本人真实手机号后该员工才能登录。')
FROM users u
WHERE u.active=1 AND u.role<>'admin' AND (u.login_phone IS NULL OR u.login_phone='');

-- The subject is masked: a finding is read from the console and must never carry a full number.
INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
SELECT REPLACE(UUID(),'-',''), u.organization_id, 'V19', 'employee_login_phone_duplicate', 'blocker',
       CONCAT(LEFT(COALESCE(u.login_phone,''), 3), '***'),
       CONCAT('规范化后手机号 ', LEFT(COALESCE(u.login_phone,''), 3), '*** 被 ', COUNT(*),
              ' 个员工账号占用，员工登录键唯一索引未启用；需管理员先解决歧义，迁移不会改写号码。')
FROM users u
WHERE u.login_phone IS NOT NULL AND u.login_phone <> ''
GROUP BY u.organization_id, u.login_phone HAVING COUNT(*) > 1;

INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
SELECT REPLACE(UUID(),'-',''), o.id, 'V19', 'employee_login_phone_unique', 'blocker', NULL,
       CONCAT('仍有 ', @duplicates, ' 个规范化手机号重复，员工登录键唯一索引未启用。')
FROM organizations o WHERE @duplicates > 0;

-- The single administrator keeps the username login and must not acquire an employee login key.
UPDATE users SET login_phone=NULL WHERE role='admin';

INSERT INTO migration_findings(id,organization_id,migration,category,severity,subject,detail)
SELECT REPLACE(UUID(),'-',''), u.organization_id, 'V19', 'admin_login_unchanged', 'limitation', NULL,
       CONCAT('独立管理员账号 ', COUNT(*), ' 个保持原用户名登录，不作为员工手机号登录。')
FROM users u WHERE u.role='admin' GROUP BY u.organization_id HAVING COUNT(*)>0;
