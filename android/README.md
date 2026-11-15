# 潘多拉 Android 原生版

**所有前端界面与交互均由 Java 和 Android 原生 Views 实现。应用不使用 WebView，不加载 HTML，不执行 JavaScript，也不打包原网页的 HTML、CSS、JS 文件。**

采用 Material 3 风格的颜色角色、圆角、导航选中标记和触摸尺寸；登录、工作台、任务和审批表单、日历和时间轴、工作日志、统计、通知、资料与头像均为原生界面。使用 Android 的日期/时间选择器、系统照片选择器和系统返回处理。

## 与旧套壳版并存

- 显示名称：**潘多拉·安卓新版**。
- 新版应用 ID：`cn.pandora.workspace`；调试包为 `cn.pandora.workspace.debug`。
- 旧套壳版 `cn.pandora.mobile` / `cn.pandora.mobile.debug` 不覆盖、不卸载、不清除数据。
- 原生版更新覆盖的是此前安装的“安卓新版”混合架构版本。两者使用同一个新版包名。

## 功能与接口

| 功能 | 原生实现 |
| --- | --- |
| 认证 | 登录、首次强制改密、普通改密、会话过期和退出；令牌仅在进程内存中保存 |
| 工作台 | 公司事项只读、我的待办、个人事项新增/编辑/删除、最近日志 |
| 任务 | 全部授权任务查询；关系/完成/状态/紧急程度/日期/名称筛选；6类排序和分页；详情、父子/同级关联、创建、修改、审核路线预览、进展、完成、重开、置顶 |
| 审批 | 本人申请、待我审核、申请提案、审核者差异对比、通过、退回、撤销、修改重提、审核路线与记录 |
| 交接 | 合法来源负责人及目标选择、交接申请、保存/清除交接预设 |
| 日程 | 本人和授权下属切换、月历事件条、事件行数连续调节与溢出日列表、月/日切换、每8小时一行的日时间轴、全天任务、本人日志 |
| 日志 | 按授权人员/部门/姓名/日期/内容筛选，详情、当日日志新增或继续编辑、关联任务选择/清除、历史只读 |
| 统计 | 任务计数、紧急程度分布、关键词词云、规则分析刷新、建议来源任务链接 |
| 通知 | 列表、打开已读、申请结果、删除、撤回、历史只读任务、撤回及关系变化状态 |
| 我的 | 组织信息、下属资料与获准联系方式/日志/交接预设入口、本人姓名/电话/邮箱/预设头像/照片头像 |

`ApiClient` 通过原生 HTTP 直接请求 `website.properties` 配置的服务器 `/api/v1`。后端代码、数据库与接口协议不修改。保持 `Authorization`、`If-Match`、`ETag`、`Idempotency-Key`、分页、版本冲突与会话隔离语义。服务端继续负责所有权限校验和业务裁决。公司时区读取自 `/me` 的 `organizationTimeZone`，日志日期以服务器 `businessDate` 为准。

当前服务器为 `https://8.141.96.122:6644/`，使用正常 TLS 校验；不忽略证书错误。`website.properties` 只配置 API 来源，不再表示网页首页。

## 构建

需要 JDK 17/21、Android SDK Platform 36、Build Tools 35.0.0。

```sh
cd android
./gradlew testDebugUnitTest lintDebug assembleDebug
```

调试包路径：`app/build/outputs/apk/debug/app-debug.apk`。仅向新版包名安装：

```sh
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n cn.pandora.workspace.debug/cn.pandora.mobile.MainActivity
```

发布版本需配置自己的签名。APK 安装完成后可直接从桌面打开，首次启动需要重新登录。退出进程后不会保存登录令牌或业务快照。

## 源码导航

- `MainActivity.java`：原生页面、登录、会话、工作台、异步调度与导航。
- `Ui.java` / `MaterialNavigation.java`：原生 Material 风格通用控件与导航。
- `ApiClient.java`：直接连接服务器的 JSON 网络客户端。
- `TasksUi.java`：任务、审批、交接与原生表单。
- `CalendarUi.java` / `ScheduleMath.java`：原生日历、时间轴、事件布局与区间算法。
- `WorkspaceUi.java`：日志、个人事项、通知、统计、资料及照片处理。

## 验证边界

构建、Lint、单元测试，以及真机验证的具体证据记录在项目 `output/android-native` 中。编译通过不代表所有角色与所有业务写入路径已验收；未实际执行的任务审批全链路不应标记为通过。此前 `output/android-material` 的记录仅适用于已被替换的混合架构版本。

### 本次原生版本验证（2026-10-23）

- `testDebugUnitTest lintDebug assembleDebug` 通过：20 项单元测试，Lint 0 错误。
- APK 检查：没有 `assets/` 网页资源，没有 `.html` / `.css` / `.js` 文件；前端 Java 源码不引用 `android.webkit` 或 WebView。
- Android 15 荣耀折叠屏真机：使用提供的 upper 账号登录 HTTPS 服务器；检查五个原生栏目、任务创建表单、原生照片选择器打开/取消。
- 原生个人事项读写：新增专用临时测试事项、使用服务端 ETag 修改、删除并清理，验证 POST / PATCH / DELETE 的实际服务器调用。
- 新版包名为 `cn.pandora.workspace.debug`，版本 `1.0.0-native`；原套壳版版本号和安装更新时间前后核对一致。
- 尚未执行全部角色的任务/审批/交接写入全链路，以及个人照片实际上传保存；这些没有记录为通过。

### 原生界面调整（1.0.1-native）

- 工作台四个模块统一为两列等宽、等高布局；高度按可用屏幕空间统一计算，长内容在模块内滚动。
- 月历移除横向滑杆，使用原生上下拖动手柄调整 1～8 行事件；向下增加、向上减少，行数实时显示，点击手柄也可直接选择行数。
- 今日日志输入框增大至至少 12 行、320dp 高，较长日志可在框内滚动，底部保存入口保留。

本次调整的构建、Lint 和 20 项单元测试通过，已安装到手机的独立原生新版。解锁后完成 Android 15 真机验证：四个模块均为 920×549 像素；手柄下拉将月历事件行数从 1 行增加到 5 行，上拉减少到 3 行；日志输入框实测高度为 960 像素（320dp），保存入口可见。本轮未提交业务数据，原套壳版安装信息保持一致。截图、测量记录和安装包位于 `output/android-native-ui`。
