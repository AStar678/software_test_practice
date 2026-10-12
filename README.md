# 潘多拉

原型前端、Java 后端及当前数据库备份的完整项目。前端保留导图、视图、日志、AI 地图和我的五个栏目，并连接本地 MySQL 后端。

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
- `openspec` 与根目录需求文档：需求与设计记录。

演示账号、运行环境和配置详见 [后端说明](backend/README.md)。本机数据库密码、登录会话、构建缓存和临时产物不提交到 Git。
