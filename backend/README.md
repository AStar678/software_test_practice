# 潘多拉后端与本机演示

Java 21 / Spring Boot 3.5.16 / MySQL / Flyway。后端托管根目录员工 Web 和独立 PC 管理端 `/admin.html`，API 前缀 `/api/v1`，`/health` 检查数据库连接。员工界面保留工作台、月/日日程、日志、统计和我的。

## 启动与演示

需要 Java 21、Maven 3.9+、MySQL 8.4+、Python 3、OpenSSL 和 curl；本轮数据库检查实际使用 MySQL 9.3。仓库根目录执行：

```sh
cd backend
./scripts/start.sh
```

服务默认 http://127.0.0.1:8080，项目 MySQL 端口13306。普通启动 `PANDORA_SEED=false`，迁移保留已有数据，不自动初始化或清理。`./scripts/stop.sh` 停止应用但保留数据库。已有旧库先执行 [升级/恢复流程](docs/fixed-model-upgrade.md)。数据库凭据保存在本机 `.runtime`，不提交。

### 演示：每次启动都是同一份初始数据

演示统一用 `pandora_demo` 库，占 8080。脚本默认**整库重建**：停掉占用 8080 的本项目后端 → drop 并重建 `pandora_demo` → 重新授权 → 构建 JAR → `--initialize` 首次准备 → 以 `PANDORA_DB_URL` 指向演示库启动。普通库 `pandora` 不受影响。

```sh
cd backend
./scripts/start-demo.sh          # 重建为初始状态后启动
./scripts/start-demo.sh --keep   # 沿用上次演示数据（保留界面编辑）
./scripts/stop.sh                # 同时停止演示实例
```

种子 UUID 由 seed key 确定性派生（`UUID.nameUUIDFromBytes("pandora.demo.v2/"+key)`），因此每次重建得到**逐位一致**的员工/任务/日志 ID，只有业务日期随启动当天取值。这也是本脚本选择「整库重建」而不是「清表」的原因：`DemoSeed` 的契约是幂等且**绝不删除或重置**已有数据，并拒绝在无标识的非空库上初始化；要拿到干净初始态只能重建库，不能在活动 schema 里清行。`PANDORA_DEMO_DB`、`PANDORA_DEMO_MARKER`、`PANDORA_PORT`、`PANDORA_SKIP_BUILD=1` 可覆盖默认值。

### 手工分步准备

演示准备只接受**已存在、明确指定的空库**，应用数据库账号须已有该库 DDL/DML 权限。下面的 `pandora_demo` 是需要事先单独创建和授权的演示库，不应替换成普通业务库。先构建 JAR，再从仓库根目录执行：

```sh
python3 backend/scripts/prepare_demo.py --database pandora_demo --demo-marker local-web-v2 --initialize --output backend/.runtime/demo-manifest.json
python3 backend/scripts/prepare_demo.py --database pandora_demo --demo-marker local-web-v2 --output backend/.runtime/demo-manifest.json
```

首次准备写入数据库名、标识、清单版本2和公司业务日；以后必须匹配。工具不建库、不删库、不清业务表，拒绝非空且无标识的库。重复准备和重启保留 ID、排期与实际用户编辑。工具启动并关闭自己的临时服务，默认18194；查看演示可使用已配置该演示库的 `PANDORA_DB_URL` 启动构建 JAR（`PANDORA_SEED=false`），避免修改普通库连接配置。

演示密码为 `Demo@123456`（可用 `PANDORA_DEMO_PASSWORD` 在首次准备前覆盖）；清单文件包含实际身份和对象 ID，权限为600，不进入 Git。seed key 是清单定位键，不能用于登录。

| 入口 | 登录字段 | 示例 | 固定身份 |
| --- | --- | --- | --- |
| 员工 Web | phone | 13800000001 | 创始人 |
| 员工 Web | phone | 13800000002 / 13800000003 | 产品部 / 市场部负责人 |
| 员工 Web | phone | 13800000011 / 13800000012、13800000021 / 13800000022 | 四个团队负责人（号码均为11位，以清单为准） |
| 员工 Web | phone | 13800000004 / 05 / 06 | 普通员工 |
| PC 管理端 | accountName | admin | 独立管理员，无员工位置或业务权限 |

共12名员工、1名管理员、2部门、4团队、四类展示职位、144任务、36日志、10条有序公司事项及个人事项。包含110项分页任务、跨部门/仅创建/交接/接管、全部申请状态、完成与重开、跨月年/午夜/点/整日覆盖/8项并发和8项全天；日期固定在首次准备的 Asia/Shanghai 业务日。日志包含近三天、删除重建和首次创建超过24小时冻结的显式演示样例；评论通知包含撤权场景。所有演示身份均为真实账户，无管理员伪员工。

## 当前业务契约

员工只按 `{"accountType":"employee","phone":"…","password":"…"}` 登录；管理员只按 `{"accountType":"admin","accountName":"…","password":"…"}` 登录。accountType 必填，旧 username、混合标识、缺类型均返回400 `INVALID_LOGIN_CONTRACT`；类型错误不跨空间回退，重复员工登录手机号被拒绝。详见 [API 示例](docs/api-examples.http)。

员工姓名/手机号仅管理员可改；改号保留员工 ID、同步登录键并撤销全部会话。本人可改头像、邮箱和密码。手机号仅本人及实际管理链上级的鉴权详情可读，邮箱仅本人，目录/通知/审计/分析均不含联系方式。管理员建号或重置密码只返回一次随机初始密码，首登强制改密，重放不返回密码。

组织通过完整结果计划保存：固定创始人、每部门/团队恰好一负责人、每员工一个位置、普通员工必须归团队、所有有效员工须有展示职位。职位名称不参与权限；员工不能维护团队或角色授权。管理员执行组织调整、停用和正式业务接管，不能承接员工任务。任务保留原创建来源，另存唯一当前业务责任及接管历史。

创建/重提由创建者直属上级审核，固定创始人创建免审；其他操作由当前业务责任方审核，申请人与审核人相同时直接生效并留历史。修改/重开仅业务责任方，进展/完成仅有效负责人；查看不等于操作权。交接仅本人或直属上级发起，接收限工作圈（创始人公司范围）。停用前须完成任务交接、岗位继任、待审处置及业务责任接管。

写命令需 `Idempotency-Key`；对象修改携带最新 GET 的 ETag 到 `If-Match`，完整组织计划使用公司版本及各行版本。缺版本428、旧版本412、同键不同请求409，无权对象通常404。版本与当前权限检查先于重放缓存。登录/会话与密码接口按各自契约处理。

## 构建与检查

```sh
cd backend
mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package
cd ..
python3 backend/scripts/check_final_workflow.py --phase all
python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output audit/refactor-pandora-organization-and-workflows/web-resources-final.json
```

离线 Maven 要求依赖已缓存；首次构建去掉 `-o` 下载依赖。Chrome 浏览器验收使用本机 Google Chrome；各集成检查拥有独立临时数据库、服务和清理过程，不应传普通库。覆盖与旧命令迁移见 [当前检查映射](docs/current-checks.md)。本轮实施证据见 [implementation-notes](../openspec/changes/refactor-pandora-organization-and-workflows/implementation-notes.md)，须另行独立验证后归档。

修改根目录 HTML/JS/CSS 后需重新构建 JAR；资源白名单和实际响应一致性由 `check_web_resources.py` 检查。历史 `database/pandora.sql` 是 V4 快照，不能当作本轮最终结构。

## Android 接入影响

共用后端的登录载荷、四层身份、只读姓名/手机号、审核路由与接管来源均已改变。旧 username 登录不兼容，Android 原生及旧套壳须后续分别更新请求/模型/入口并重新验收。本轮未修改 `android/`、`android-shell/`，未构建或交付 APK。
