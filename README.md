# 潘多拉

手机全屏前端、Java 后端及当前数据库备份的完整项目。界面与日历交互采用本地备份的工作台风格，业务沿用最新 main：五个栏目为工作台、日程、记录、统计和我的；日程保留本人申请入口，支持切换查看本人和下级当前负责的授权任务，可伸缩月历和每8小时一行的横向日时间轴均支持至少五行日程。

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
- `android`：使用 Android 原生控件的安卓应用，直接连接现有服务器 API，安装与构建见 [Android 说明](android/README.md)。
- `backend/docs`：API 示例和实施说明。
- `docs/requirements`：PRD、历史草案及需求来源。
- `docs/reviews`：需求审计、偏差分析；历史结论仅适用于其注明的代码基线。
- `docs/guides`、`docs/references`：调试指南与界面参考截图。
- `openspec`：规格与变更记录；已完成变更位于 `openspec/changes/archive`。
- `audit`：按日期保存的检查结果和截图。

文档入口见 [文档导航](docs/README.md)。

演示账号、运行环境和配置详见 [后端说明](backend/README.md)。本机数据库密码、登录会话、构建缓存和临时产物不提交到 Git。
