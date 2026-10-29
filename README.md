# 潘多拉

包含两个手机前端（网页套壳版、Android 原生版）、共用 Java 后端及数据库备份的完整项目。员工业务界面包含工作台、日程、日志、统计和我的五个栏目；另提供独立的 PC Web 管理端。

当前实现依据 [2026-10-28 更改指导](docs/reviews/更改指导.md) 及 [本轮 OpenSpec delta](openspec/changes/refactor-pandora-organization-and-workflows/specs/pandora-requirements-aligned-prototype/spec.md)，与 V4 冲突处以本轮要求为准：固定创始人/部门负责人/团队负责人/员工四层位置、员工手机号与独立管理员登录、当前业务责任方审核及正式接管。历史 PRD 和审计保留供追溯。本轮为 Web 与共用后端改造，Android 客户端需要后续适配新契约，未交付新 APK。

## 两个前端与后端的范围

| 部分 | 代码与入口 | 负责范围 |
| --- | --- | --- |
| 前端一：网页与旧套壳版 | 根目录 `index.html`、`潘多拉-*.html/css/js`；`android-shell/` | 网页实现员工五个栏目及任务、审批、交接、日程、日志、统计、通知和个人资料交互；旧 Android 套壳复用网页界面，维护容器适配和原生导航的主题。旧包名为 `cn.pandora.mobile`（调试包加 `.debug`）。 |
| 前端二：Android 原生版 | `android/` | 使用 Java / Android 原生 Views 实现员工业务界面，直接请求服务器 API，不使用 WebView 或打包网页资源。新版包名为 `cn.pandora.workspace`（调试包加 `.debug`），与旧套壳独立安装、独立维护。 |
| Web 管理端 | 根目录 `admin.html`，访问 `/admin.html` | 管理员在电脑浏览器维护完整组织计划、展示职位、员工身份、停用与业务接管、管理员账号及公司信息；完整管理模块不嵌入两个员工手机前端。`/debug.html` 仅供调试。 |
| 共用后端 | `backend/`，API 前缀 `/api/v1` | Java / Spring Boot 提供认证与会话、组织和权限校验、任务及审批与交接、日程数据、日志、通知、统计与规则分析、个人资料接口，统一负责业务裁决、版本冲突、幂等和 MySQL 持久化；同时托管 Web 静态页面。 |

两个手机前端共用后端接口与业务数据，不各自维护独立后端或数据库；实际连接地址以各端配置为准。网页静态文件随后端 Maven 构建打包，原生版独立构建 APK。旧套壳以保存的 0.2.1 APK 为重建基线，构建脚本更新网站主题与容器适配，根目录网页的其他修改不会自动全部同步到该基线，详见 [套壳说明](android-shell/README.md)。各端已验证与待验证的功能以对应说明和验证记录为准。

## 启动

需要 Java 21、Maven 3.9+、MySQL 8.4+、Python 3、OpenSSL 和 curl。

```sh
cd backend
./scripts/start.sh
```

打开 http://127.0.0.1:8080。普通启动默认不灌入演示数据。旧库先按 [受控升级与恢复说明](backend/docs/fixed-model-upgrade.md) 演练；新演示库必须通过显式目标和标识准备，见 [后端说明](backend/README.md)。

## 项目内容

- 根目录 HTML、CSS、JS：原型页面及后端接入。
- `backend/src`：后端源码、数据库迁移、模拟数据和单元测试。
- `backend/scripts`：启动、停止、数据库导出及集成检查。
- `backend/database/pandora.sql`：历史 V4 数据快照，非本轮最终结构或验收证据。
- `android`：使用 Android 原生控件的安卓应用，直接连接现有服务器 API，安装与构建见 [Android 说明](android/README.md)。
- `android-shell`：手机旧套壳的独立维护目录，网页与原生导航统一沿用网站主题，见 [套壳说明](android-shell/README.md)。
- `backend/docs`：API 示例和实施说明。
- `docs/requirements`：PRD、历史草案及需求来源。
- `docs/reviews`：需求审计、偏差分析；历史结论仅适用于其注明的代码基线。
- `docs/guides`、`docs/references`：调试指南与界面参考截图。
- `openspec`：规格与变更记录；已完成变更位于 `openspec/changes/archive`。
- `audit`：按日期保存的检查结果和截图。

文档入口见 [文档导航](docs/README.md)。

演示账号、运行环境和配置详见 [后端说明](backend/README.md)。本机数据库密码、登录会话、构建缓存和临时产物不提交到 Git。
