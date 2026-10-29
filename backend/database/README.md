# 数据库快照与当前迁移

`pandora.sql` / `snapshot.json` 是历史 V4 快照及其当时恢复记录，保留历史用途。它们不是本轮V26结构，也不代表本轮演示数据或验证通过；本轮未覆盖此快照。会话仅保留结构，恢复后须重新登录。系统账号、连接密码和运行文件不在备份内。

当前迁移链为V1—V26，V1—V24保持原文件；V25清理员工 username/旧角色管理链并收紧类型外键，V26增加受控演示标识与稳定清单。旧快照应先恢复至独立空库，按 [受控升级/恢复说明](../docs/fixed-model-upgrade.md) 演练、显式映射、修复阻断，再决定切换。不得把旧SQL直接导入已有业务库或用新演示库代替升级验证。

仓库根目录的本轮可复跑验收：

```sh
python3 backend/scripts/check_final_workflow.py --phase migration
```

检查真实打包Flyway空库/V20升级、非法映射和管理员历史冲突、MySQL information_schema结构一致性、原ID/正文/时间/哈希与真实备份恢复。随机数据库和临时备份由检查创建并清理，报告在 `audit/refactor-pandora-organization-and-workflows/final-migration.json`、`final-schema.json`，不修改普通库。

`backend/scripts/export-db.sh` 仍可导出本机配置的普通库；只有明确要更新该历史快照时才执行并重新生成匹配恢复记录。导出过程中不要并行DDL。本轮演示使用 `prepare_demo.py --database ... --demo-marker ...`，见 [后端说明](../README.md)，不通过覆盖快照完成。
