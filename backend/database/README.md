# 数据库备份

`pandora.sql` 是当前本地 `pandora` 应用数据库的可恢复快照，包含全部表结构、Flyway 迁移记录和现有业务数据。用户、团队、任务、审批、日志、通知等数据均保留，包括此前的模拟与验证记录。

登录会话表 `auth_sessions` 仅保留结构，恢复后需要重新登录。MySQL 系统账号、本机连接密码、运行日志和数据库物理文件不在备份内。演示账号见上级目录的 README。

## 新克隆项目恢复

需要 MySQL 8.4+、Java 21、Maven 3.9+、Python 3、OpenSSL 和 curl；快照实际在 MySQL 9.3 导出并验证。以下步骤只适用于新克隆的空数据库：SQL 会替换同名表，已有数据的环境请先另行备份。

在仓库根目录执行：

```sh
cd backend
./scripts/start-db.sh
mysql --defaults-file="$PWD/.runtime/mysql-admin.cnf" --database=pandora < database/pandora.sql
./scripts/start.sh
```

打开 http://127.0.0.1:8080。导入快照后已有数据会保留，启动不会重复灌入模拟数据。

## 迁移预检、演练与恢复

本次变更新增 V16—V19 迁移（日志日位置保留、标签与任务审计快照、平铺评论、员工手机号登录键）。升级前请先读
[V16—V19 迁移、预检与恢复说明](../docs/migration-v16-20261025.md)，并按其中的隔离演练步骤执行：

```sh
cd backend
python3 scripts/migration_precheck.py --database pandora precheck
python3 scripts/check_migration_foundation.py --output ../audit/2026-10-25/chapter1-migration.json
```

旧快照（V4）可直接前向迁移到 V19；缺少手机号、规范化重复号和组织树异常的账号会登记为阻断项，需要管理员通过
既有员工维护流程补齐，迁移不会生成号码或重建账号。恢复演练只在隔离数据库进行，不能直接覆盖正在使用的库。

## 更新备份

在后端数据库运行时执行：

```sh
./scripts/export-db.sh
```

业务数据使用事务一致性快照导出，不修改本地数据；导出期间不要并行执行数据库结构迁移。`snapshot.json` 记录本次备份的校验值、各表行数及恢复检查结果，重新导出后应同步重新验证并更新该记录。
