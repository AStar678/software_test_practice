# 潘多拉

原型前端、Java 后端及当前数据库备份的完整项目。前端保留导图、视图、日志、AI 地图和我的五个栏目，并连接本地 MySQL 后端；视图内含“任务表单”二级页面，日历只展示本人当前负责的任务。

当前需求基线为 [潘多拉产品需求文档（V3 修订版）](docs/requirements/潘多拉-产品需求文档-V3修订版.md)，已整合本次 8 条甲方反馈，产品交付范围仍为 V1。最新代码逐项差异见 [甲方反馈差异分析](docs/reviews/潘多拉-甲方反馈差异分析-2026-10-21.md)；V2 正式版与历史草案保留供追溯。

## 启动

需要 Java 21、Maven 3.9+、MySQL 8.4+、Python 3、OpenSSL 和 curl。

```sh
cd backend
./scripts/start.sh
```

打开 http://127.0.0.1:8080。首次启动会生成模拟数据；如需恢复本分支保存的数据库现状，请先按 [数据库恢复说明](backend/database/README.md) 导入备份，再启动应用。

## 项目内容

- 根目录 HTML、CSS、JS：原型页面及后端接入。
- `backend/src`：后端源码、数据库迁移、模拟数据和单元测试。
- `backend/scripts`：启动、停止、数据库导出及集成检查。
- `backend/database/pandora.sql`：数据库结构及当前业务数据快照。
- `backend/docs`：API 示例和实施说明。
- `docs/requirements`：PRD、历史草案及需求来源。
- `docs/reviews`：需求审计、偏差分析；历史结论仅适用于其注明的代码基线。
- `docs/guides`、`docs/references`：调试指南与界面参考截图。
- `openspec`：规格与变更记录；已完成变更位于 `openspec/changes/archive`。
- `audit`：按日期保存的检查结果和截图。

文档入口见 [文档导航](docs/README.md)。

演示账号、运行环境和配置详见 [后端说明](backend/README.md)。本机数据库密码、登录会话、构建缓存和临时产物不提交到 Git。
