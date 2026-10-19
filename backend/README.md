# 潘多拉本地后端

可运行的 Java 21 / Spring Boot 3.5.16 / MySQL 后端，包含数据库迁移、首次模拟数据初始化、REST API 和站内通知。根目录 `index.html` 对应的原型已接入后端，保留原有五个栏目与任务弹层；月历按参考图展示跨日连续色条，周历和日历提供纵向时间轴。

## 本机使用

在终端进入仓库根目录后执行：

```sh
cd backend
./scripts/start.sh
```

打开 http://127.0.0.1:8080 即原来的 `index.html`。直接双击根目录 `index.html` 也会跳转到此本地服务。管理端在 `/admin.html`（管理员账号登录后可维护员工、部门、职位、团队、角色授权、转岗与公司信息；业务账号会被服务端拒绝）。原调试页保留在 `/debug.html`。API 前缀为 `/api/v1`，健康检查为 `/health`。

启动脚本会启动项目专用 MySQL（13306 端口）、编译并执行单元测试、运行迁移，首次开启时灌入演示数据。服务在独立进程会话运行，关闭启动终端不会清空数据。电脑重启后再次执行启动命令即可。

本分支同时提供当前数据库的 SQL 快照。新环境如需恢复全部现有业务数据，请在首次启动应用前按 [数据库恢复说明](database/README.md) 导入；备份保留全部表结构，不携带旧登录会话或本机连接密码。

```sh
./scripts/stop.sh       # 停止本项目服务，保留数据库
./scripts/start.sh      # 再次启动；已有数据不重复灌入
```

本机使用现有 JDK 21、Maven 与 MySQL 9.3。其他环境需要 Java 21、Maven 3.9+、MySQL 8.4+ 客户端与服务程序、Python 3、OpenSSL 和 curl；本次真实数据库验证使用 MySQL 9.3。首轮构建需要访问 Maven Central。MySQL 不使用已有安装的数据目录。

## 演示账号

以下账号的初始密码均为 `Demo@123456`，仅用于本机演示。

| 账号 | 姓名 | 身份 |
| --- | --- | --- |
| upper | 王海 | 上层，公司业务范围 |
| middle | 李敏 | 产品部经理 |
| market | 陈冲 | 市场部经理 |
| employee | 张涛 | 产品部员工 |
| colleague | 赵蕾 | 产品部员工 |
| marketing | 孙悦 | 市场部员工 |
| admin | 系统管理员 | 管理端：员工/部门/职位/团队/角色授权/转岗/公司信息；无员工业务权限 |

首次种子共 7 个账号、3 个部门、4 个职位、3 个团队、17 个任务、18 条日志、3 条公司信息和6条个人信息；通知由事件及提醒自动生成。任务覆盖未发布待审、有效版修改待审、完成待审、进行中、已完成、重开、逾期、全天、父子及同日密集排期。日期锚定首次初始化当天（Asia/Shanghai）。重启不改写用户操作，也不刷新演示排期。

可从员工账号创建待审任务，再退出并以 `middle` 登录审核；`upper` 无权查看尚未发布且并非本人申请或审核的任务。

管理员在 `/admin.html` 新增员工或重置密码时，系统生成随机初始密码并**只显示一次**；该账号首次登录会被强制改密，此时仅能改密或退出，改密成功后全部会话失效需重新登录。演示账号本身不带首次改密门禁，仍用上表密码直接登录。管理员可录入员工手机号，但任何他人读取入口都不会回显号码。

公司统一信息由管理员在管理端增改删和调序（最多10条），业务端（含上层账号）只读。“我的”可修改本人姓名、联系电话和邮箱，公司、部门、职位、独立团队及直属上级只读，联系电话和邮箱不进入人员目录。

视图页可创建任务，并使用与导图、日志一致的圆角边框。月历的四至六周完整显示在一屏，任务行数按可用高度调整；跨日任务连续展示、跨周分段，点击日期或“+N 项”查看完整内容。周历七列和周、日视图的 00:00—24:00 时间范围同屏展示，密集任务点开展开，任务原始排期不变。

## API 与代码

- `src/main/java/cn/pandora/auth`：登录、会话刷新/撤销、当前身份与查看范围。
- `task`：任务快照、审批、状态变化、父子关系和权限。
- `workspace`：首页、日志、通知、统计、规则分析和本地事件工作线程。
- `profile`：本人资料读取和修改、输入白名单、并发版本与联系人隐私。
- `common`：幂等事务、版本前置条件、错误格式和事件记录。
- `seed/DemoSeed.java`：仅首次初始化运行的模拟数据。
- `src/main/resources/db/migration`：MySQL 可执行 Flyway 迁移。
- `docs/api-examples.http`：登录、查询、创建、审核等请求示例。
- `docs/implementation-status.md`：已实现能力、验证结果和后续范围。

原型顶部身份按钮会进入对应账号的登录入口，实际权限来自后端会话。登录令牌只保存在当前浏览器标签的会话存储中，可在“我的”退出；任务、审批、日志、首页条目和消息修改持久化到 MySQL，刷新页面不会丢失。

前端文件作为 Maven 构建资源打包，修改根目录 HTML/JS 后需停止并重新启动服务以重新构建。

写操作（登录除外）携带 `Idempotency-Key`；修改任务、审批、日志、通知、个人信息条目及本人资料携带详情 GET 返回的 `ETag`，写在 `If-Match` 头。无权对象返回404；缺少前置版本返回428，版本过期返回412，同键不同请求返回409。公司信息写接口对业务账号返回403。会话令牌只保存摘要，密码保存 BCrypt 哈希。

本地业务默认（第 4—11 章尚未实施，以下描述的是**当前代码**的实际行为）：同层多负责人取共同有效上级；无有效上级回退原创建者，无法找到审核人则阻止提交；进展纳入审核；创建者兼审核人时仍走旧的免审分支。全天任务目前仍使用固定的 18:00 截止（`TaskService.ALL_DAY_CUTOFF`）：管理端保存的“公司下班时刻”已持久化、校验并记入审计，但要等第 6 章排期版本落地后才会真正用于新排期，改设置不会立即影响已有或新建任务。

当前采用同组织写事务串行化，适合本地验证和小规模演示；API 与站内事件工作线程在同一进程，事件持久化于 MySQL。AI 区域显示可追溯的规则提示，不调用外部模型。组织维护、账户/密码生命周期与联系方式隐私已接入（第 1—3 章）；有序审核路由、交接、截止失效、比例提醒、消息生命周期、日历与分析改版尚未接入（第 4—11 章）。详细状态以实施说明为准。

## 配置与数据位置

默认仅监听本机 `127.0.0.1`。项目数据库保存在 `.runtime/mysql`，随机数据库口令保存在 `.runtime/database.env`，管理员连接配置为 `.runtime/mysql-admin.cnf`；这些文件均被 Git 忽略。请保留 `.runtime/mysql` 以保留当前数据，不要删除或复制凭据到文档。

API 日志为 `.runtime/backend-console.log`，MySQL 日志为 `.runtime/mysql.log`。Maven 缓存及构建输出也在本项目内。

可在 `.env` 设置 `PANDORA_PORT`、`PANDORA_SEED`、`PANDORA_WORKER_ENABLED`。`PANDORA_DEMO_PASSWORD` 只影响首次初始化时的演示账号，不能用于重置已有账号。直接运行 jar 时也可通过 `PANDORA_DB_URL`、`PANDORA_DB_USER`、`PANDORA_DB_PASSWORD` 连接专门配置的 MySQL；保留迁移权限和同等约束。

## 验证

```sh
mvn test
python3 scripts/smoke_test.py --report .runtime/smoke-report.json
python3 scripts/check_database.py --output .runtime/database-check.json
python3 scripts/check_home_integration.py --report .runtime/home-integration.json
python3 scripts/check_profile_integration.py --report .runtime/profile-integration.json
```

第 1—3 章的专项验证（2026-10-16 全部通过，证据见仓库根目录 `audit/2026-10-16/`）：

```sh
# 迁移预检与隔离演练：自行创建并删除临时库，无需准备
python3 scripts/migration_precheck.py rehearse --output ../audit/migration-precheck.json

# 组织管理：需要一个「全新创建、已灌入种子」的库，并把服务指向它
python3 scripts/check_organization_admin.py --base-url http://127.0.0.1:18091

# 账户与密码：--database 必须与服务实际连接的库一致
python3 scripts/check_account_lifecycle.py --base-url http://127.0.0.1:18092 --database <服务连接的库名>

# 真实浏览器（无头 Chrome，390x844）驱动已构建页面
node scripts/check_account_browser.js --base-url http://127.0.0.1:18092
```

后三个脚本会断言「新种子库」的前提（默认下班时刻为 18:00、账号名按次随机），**必须对全新库运行**；对已经跑过的库重跑会出现“freshly seeded”一条失败，那是脚本前提而非回归。准备方式：用 `.runtime/mysql-admin.cnf` 建库并授权，再用 `PANDORA_DB_URL`/`PANDORA_SEED=true` 启动服务。

2026年10月12日，当前版本24项Java单元测试、25项个人资料HTTP检查和44项首页信息HTTP检查全部通过；专项验证结束后，本人资料恢复原值，临时个人信息条目已清理，公司信息保持不变。此前原页面接入阶段的50项任务等HTTP检查和18项数据库完整性检查也已通过。停止并再次启动后，已有数据保留，种子没有重复插入。原页面已在1440×900电脑和390×844手机尺寸检查。浏览器验证覆盖登录、任务申请/审批、日志保存刷新、首页信息、通知、规则分析；另验证保存成功但响应丢失后重试不会重复新增，以及会话过期清理。

HTTP 集成验证连接正在运行的真实 MySQL 后端，覆盖登录、越权、幂等、版本冲突、审批、日志、消息及并发竞争。它只添加带 `Smoke UUID` 前缀的测试内容，不清库；重复执行会增加新的测试记录。

首页专项脚本适配当前公司只读规则，只临时新增个人信息条目并在结束时清理；个人资料专项脚本默认临时修改 `employee` 本人的姓名和联系方式，并在结束时恢复原值。两项脚本均须在运行 V4 迁移后的本地服务上执行，不修改其他用户资料或现有公司内容。

技术参考：[Spring Boot 系统要求](https://docs.spring.io/spring-boot/3.5/system-requirements.html)、[MySQL 生成列](https://dev.mysql.com/doc/refman/8.0/en/create-table-generated-columns.html)。MySQL 通过生成列与唯一键约束每个任务最多一条待审请求，复合外键限制跨组织引用。

第 1—3 章的书面现状另见 [实施说明](docs/implementation-status.md) 末节（2026-10-16）；该节明确列出第 4—11 章尚未实施，以及“公司下班时刻”设置尚未被排期消费。接管请先读变更目录 `openspec/changes/fix-pandora-formal-requirement-deviations/implementation-notes.md` 的 “How to continue this change”。
