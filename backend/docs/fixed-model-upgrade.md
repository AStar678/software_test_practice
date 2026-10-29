# 固定组织/独立身份：受控升级、演示与恢复

当前最终版本V26；V1—V24文件保持不变。以下命令从仓库根目录执行，本机已启动项目MySQL13306、构建JAR，私有 `.runtime/database.env` 为应用连接凭据，`.runtime/mysql-admin.cnf` 为备份/预检凭据。应用账号须有目标库DDL/DML权限。命令中的 `pandora_upgrade` / `pandora_restore` 都指事先创建和授权的独立空演练库；不要替换成运行中的普通库直接试验。

## 先备份和演练

停写并保留原版本JAR、原连接配置及完整数据库备份；MySQL DDL无法随业务事务完整回滚。凭据通过defaults-file传递，不放命令行或交接报告：

```sh
mysqldump --defaults-file=backend/.runtime/mysql-admin.cnf --single-transaction --no-tablespaces --set-gtid-purged=OFF --column-statistics=0 pandora > backend/.runtime/before-upgrade.sql
mysql --defaults-file=backend/.runtime/mysql-admin.cnf --database=pandora_upgrade < backend/.runtime/before-upgrade.sql
python3 backend/scripts/migration_precheck.py --database pandora_upgrade precheck --output backend/.runtime/before-precheck.json
python3 backend/scripts/migration_precheck.py --database pandora_upgrade fingerprint
```

维护窗口内不并行DDL。备份含私人业务数据，保存在私有runtime，不提交到audit；预检输出也应保留在私有目录。受控入口 `flyway_migrate.py` 只运行构建JAR中的同一Flyway迁移、无应用Runner和种子，不建库、不删库、不自动repair历史。

## 显式映射和修复

V20旧数据不能从“无上级”或旧职位猜创始人。先依据稳定员工/单位ID准备明确的公司、固定创始人、负责人、职位、员工位置、手机号和管理员映射。格式与合法/非法样例可参考 `check_legacy_mapping.py`，只读工具会返回 blockers 和可提交的完整组织计划：

```sh
python3 backend/scripts/migration_precheck.py --database pandora_upgrade mapping --mapping backend/.runtime/organization-mapping.json --output backend/.runtime/mapping-report.json
python3 backend/scripts/flyway_migrate.py --database pandora_upgrade --target 24
```

在V24阶段先检查 `migration_findings`，尤其 `admin_business_reference`：旧管理员若曾承担员工专用任务/日志/审核引用，V25会明确阻断，保留真实正文和旧身份供处理。不能伪造员工替身、覆盖原创建人或删除历史来强行通过。应依据业务来源确认真实员工并制定有审计的人工数据修复；不能确认则恢复备份并停止切换。工具不会自动处置此类冲突；不要仅清finding或执行Flyway repair忽略来源问题。

无此冲突时可继续到V26。缺组织映射不会被猜测补齐：业务门禁保持关闭，独立管理员仍可登录。以该库连接运行JAR（seed=false），在 `/admin.html` 的完整组织草稿中核对映射结果，或 GET `/api/v1/admin/organization-plans` 取最新版本后 POST 完整计划，修复创始人、所有有效员工位置、部门/团队负责人和展示职位。手机号缺失/重复使用管理员身份资料维护修正；旧管理员账号迁入独立 `admin_accounts`，原主体ID保留。提交需公司 `If-Match`、全部 `expectedEmployees` 及单位/位置行版本，不能直接重放过期的预检计划。

```sh
python3 backend/scripts/flyway_migrate.py --database pandora_upgrade --target 26
python3 backend/scripts/migration_precheck.py --database pandora_upgrade precheck --output backend/.runtime/after-precheck.json
```

预检进程退出0不等于组织ready；务必检查报告 `status`、blockers 和手机号约束，并通过真实账号检查登录、任务/日志原ID、创建时间、正文和管理员旧审计来源。最终users不含username、旧角色/等级或可编辑组织链，位置来自 `employee_placements`；管理员不保留伪员工行。空库与升级库的结构一致性由本轮 `final-schema.json` 和迁移报告比对。

## 恢复和切换

升级演练失败时保持原库/原服务，另把同一备份恢复进 `pandora_restore`，比较恢复前后fingerprint及关键业务来源。演练全通过再安排停写、重新备份及正式迁移/修复/验收。切换新契约客户端后才开放业务写入。

```sh
mysql --defaults-file=backend/.runtime/mysql-admin.cnf --database=pandora_restore < backend/.runtime/before-upgrade.sql
python3 backend/scripts/migration_precheck.py --database pandora_restore fingerprint
python3 backend/scripts/check_final_workflow.py --phase migration
```

最后一条使用检查自有随机库执行真实V20备份恢复、升级/空库对比和非法映射修复验证；不会迁移上述演练库或普通库。失败后的回退应切回原JAR和恢复后的旧库，不能让旧JAR读取V26，也不能假称删除新列的逆向迁移无损。恢复备份后的新写入需要单独处理，不宣称自动无损回退。当前旧 `database/pandora.sql` 为历史V4，不是本次升级备份。

演示准备另见 [后端README](../README.md)：显式目标库+marker+首次initialize、稳定seed key，重复不清理、不覆盖实际编辑。演示成功不替代旧库升级/恢复验收。Android旧username登录与资料/组织模型不兼容，需后续客户端适配；本轮未改Android或交付APK。
