# 2026-10-23 部署记录

访问地址：https://8.141.96.122:6644 。原 HTTPS 443 入口继续保留。

本次发布包含当前工作区最新前后端代码，月历日期旁的日志标记和对应图例已删除。线上页面文件与本地文件的 SHA-256 一致；内置浏览器已完成真实登录和月历检查，日志标记数量为 0。HTTPS 证书、TLS 1.2/1.3、健康检查及业务读取接口均已验证。

服务器原有迁移历史来自旧代码分支，不能直接用新文件覆盖其校验值。本次保留原库 `pandora`，先以 SQL 备份建立 `pandora_snapshot_20261023`，再在独立新库 `pandora_release_20261023` 执行当前版本的迁移与已确认组织资料映射。7 个账号、17 个任务、18 篇日志、23 个申请及其他原有业务记录已核对保留，密码、联系人字段、日志正文和任务时间等关键字段一致。旧迁移历史和完整旧数据仍在原库及快照中。

部署位置：

- 正式服务：`pandora.service`，内部端口 `127.0.0.1:18090`。
- 当前发布目录：`/opt/pandora/releases/20261023-ui-latest`。
- 切换入口：`/opt/pandora/current`。
- 旧发布目录：`/opt/pandora/releases/20261016-login-hint`。
- SQL、原环境配置、Nginx 配置与升级核验记录：`/opt/pandora/backups/20261023-ui-latest`，仅 root 可读取。
- 6644 TCP MSS 为 1200，用于解决较大 TLS ClientHello 的路径分段问题；证书、TLS 协议和访问控制未作降级。规则通过已启用的 `pandora-web-network.service` 在开机时应用。

回退前应先备份新库，并检查上线后新增的业务记录。旧发布、旧环境配置、原库及 Nginx 配置均保留，不能在出现新写入后直接丢弃新库。迁移后的会话已失效，用户使用原账号密码重新登录。

本地核验结果：`output/journal-refinement/server-deployment-20261023.json`。该报告及部署工具不包含服务器密码。

手机访问修复：6644 的明文 HTTP 请求原先返回 Nginx 400（HTTP 请求发送到了 HTTPS 端口）。已增加 `error_page 497 =308 https://8.141.96.122:$server_port$request_uri;`，保留端口、路径和查询参数，并通过配置检查后重载 Nginx。外部验证 HTTP 返回 308、跳转目标页面返回 200。修复前配置备份：`/opt/pandora/backups/20261023-ui-latest/pandora-before-mobile-redirect-092211.conf`。
