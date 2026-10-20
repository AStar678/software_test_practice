# Implementation Verification

- Change: `fix-pandora-formal-requirement-deviations`
- Schema: `spec-driven`
- Verdict: **FAIL**
- Verified at: 2026-10-20T22:56:22+08:00
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice`（前端根目录及 `backend/`）
- OpenSpec root: 同仓库 `openspec/`，未使用独立 store。
- Verified revision: `110ebe0fadaf17e26612d2e0fa45916d91b2019b`；开始时工作树干净；结束时除本报告外无变化。

## Summary

独立复验确认 7 项 implementation 偏差（4 high、2 medium、1 low），均为 `pending`，不能归档。现有 Java、HTTP、数据库和浏览器套件重跑通过，但补充负向检查发现普通未送达通知泄露、提交触发失效回滚、失去最后审核人时 SQL 错误、环形管理链手机号泄露、旧库映射未完成仍可写、缺少独立范围配置以及日列表排序错误。

覆盖当前 delta 的 21 条有效要求、147 个场景及 1 条移除要求。矩阵明确区分已建立证据、确认失败和未完整执行的边界，不将 65 个已勾选任务或 apply 的报告当作通过依据。没有修改实施、测试、规划、任务或 implementation-notes，也没有同步主规格或归档。

DEV-029 操作系统推送与 A-25/真机体验部分按既有授权延期，未实现/未验证，不计作通过。桌面 Chrome 视口模拟只证明已执行的浏览器行为。剩余证据缺口包括三方截止竞争、179.999 秒的实际接口边界以及部分完整日历/空通知交互，见矩阵；这些不是已确认缺陷，也不能据此给出全量 PASS。

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| 实施、规划、配置、测试与非忽略新增文件 | Git `110ebe0fadaf17e26612d2e0fa45916d91b2019b`；开始/结束相同；211 个唯一路径；下述 SHA-256 `45f29735d1171f7e2c2302eda330a8ffb2ec8b63d7eb7cfa353bc685587fc8a1` |
| 当前验收规划 | `proposal.md`、`design.md`、`tasks.md`、`specs/pandora-requirements-aligned-prototype/spec.md`，均在上述清单内；以当前 delta 替代旧规则 |
| 追踪与历史资料 | `audit/2026-10-20/chapter11/traceability.md` 及仓库正式需求/历史审计；清点 35 DEV、150 AUD、25 A；历史结论不改写 |
| 历史兼容性 | 与 `f18b60e` 比较，V1—V4 迁移文件无改动；当前新增迁移至 V12 |
| V4 快照预检 | 隔离副本 `pandora_precheck_e13_110ebe0`，预检前后数据指纹均为 `bff44e434cf1e953f8194c265856155c3103156d4f58a458061c80d25250fcc2` |
| 本轮可执行证据 | `/tmp/pandora-e13-110ebe0/` 中本轮生成的 JSON、日志及截图；不使用仓库历史 JSON 冒充本轮执行 |
| 工作流所有文件 | 所有 basename 为 `verification.md` / `implementation-notes.md` 的文件排除出指纹；其余 Git 跟踪及非忽略未跟踪文件均包含 |

复算命令从实施根目录执行。路径清单与每个文件内容一起参与散列，可检测新增、删除及内容变化；开始与最终结果一致。忽略的构建/runtime 文件不属于源码基线，实际 jar 由本轮 Maven 从该源码构建。

```python
import subprocess, hashlib, json, pathlib
root = pathlib.Path.cwd()
paths = subprocess.check_output(['git','ls-files','-co','--exclude-standard','-z']).decode().split('\0')
files = {
    p: hashlib.sha256((root/p).read_bytes()).hexdigest() if (root/p).is_file() else 'MISSING'
    for p in sorted(set(paths))
    if p and pathlib.Path(p).name not in ('verification.md','implementation-notes.md')
}
print(len(files))  # 211
print(hashlib.sha256(json.dumps(files, sort_keys=True, separators=(',',':')).encode()).hexdigest())
```

开始前没有已有 `verification.md`，所以 V-001—V-007 是首次分配的稳定编号。本报告中的关键失败输出已就地记录；临时目录不是长期证据存储，修复复验应按步骤重新执行。

## Apply Handoff Review

读取了 `implementation-notes.md` 全文及 OpenSpec 返回的全部 contextFiles，当前 apply 状态为 `all_done`，65/65 任务勾选。

| Handoff claim / reminder | 独立处置 |
| --- | --- |
| change/schema、实现地图、追踪行数 | change/schema 匹配；逐域检查当前代码和脚本，35/150/25 行数确认；地图不是验收结论 |
| Windows 路径及 `29e3f99` 加未提交工作树 | **过时**：实际为本报告 Mac 路径及 `110ebe0…` 干净基线；当前文件与本轮执行为准 |
| Java 21、60 测试及 package | **确认**：明确使用本机 Java 21 独立重跑 package（包含 test），60/60，构建成功 |
| HTTP/数据库套件、隔离数据库及受控时钟顺序 | **确认**：逐套创建新库；日志、事件和其他时钟变化隔离；当前结果见 Checks |
| 浏览器五组、三视口及冻结分支 | **确认有限范围**：实际构建服务上重跑；45/45 含冻结分支；视口模拟不是真机，完整交互缺口保留 UNVERIFIED |
| V1—V12 新库与 V4 历史阻断 | 新库/旧库 Flyway 升至 V12 确认；V4 预检不改数据，映射缺失确认；未解决映射仍启用正式写流程由 **V-005** 覆盖，不能把新库通过等同历史就绪 |
| 旧负责人顺序、旧通知兼容限制 | V4 预检明确 88 行 legacy-order-unknown、40 条原申请无法绑定；不宣称恢复无法证明的历史顺序；旧消息保持只读 |
| 最初 smoke 旧断言失败后修正 | 本轮读取当前断言，使用真实身份与显式审核，最终独立 smoke 53/53；未复用 apply 输出 |
| 午夜脚本取整修复 | **确认**：本轮日志 17/17，实际验证 23:59:59 可编辑及 00:00:00 冻结、PATCH/DELETE/补建拒绝 |
| 数据库敏感字段检查修正 | **确认**：各库 18/18，账户套件另查明文密码、手机号及幂等/audit/outbox；不将普通 metadata 当秘密字段 |
| 通知打开与 replay 时间精度修复 | **确认**：本轮事件 75/75，包含打开幂等、已读和原申请绑定；未将其推广为未送达失权安全通过（V-001） |
| strict 的两条 >500 字符警告 | **过时**：独立严格非交互验证返回 `valid:true, issues:[]`；没有据旧警告建立 planning finding |
| 推送/真机延期与不宣告独立验收 | **确认**：保留 DEV-029、A-25、相关 UX/NTF 部分延期；本轮不归档、不修改历史审计 |
| 全范围独立复验提醒 | 依当前 specs/design 检查，而非仅检查 handoff 所列正向场景；7 个偏差由下文独立证据支持 |

## Checks

环境：macOS、本机 Java 21、Maven 离线依赖库、MySQL 9.3.0、Node 24、已安装 Google Chrome。使用 `/tmp/pandora-e13-110ebe0/` 的全新 MySQL 数据目录、13316 端口；没有启动/改写原项目 MySQL 数据目录。HTTP 各套件独立数据库，服务端口 18200—18208；浏览器独立 `e13_browser` / 18210。应用、浏览器及临时 MySQL 均已结束。

```sh
# 从 backend/ 执行
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 package
```

| Command or inspection | Result | Notes |
| --- | --- | --- |
| `openspec status --change fix-pandora-formal-requirement-deviations --json`；`openspec instructions apply --change fix-pandora-formal-requirement-deviations --json` | 完整可验证 | 本地 `spec-driven`，无缺失上下文阻断 |
| `openspec validate fix-pandora-formal-requirement-deviations --type change --strict --json --no-interactive` | PASS | `valid:true, issues:[]` |
| 上述 Java 21 Maven package | PASS 60/60 | 0 failures/errors/skipped；打包成功 |
| `S`：`python3 scripts/smoke_test.py --base-url http://127.0.0.1:18200 --report /tmp/pandora-e13-110ebe0/final-smoke.json` | PASS 53/53 | 本轮独立 JSON `final-smoke.json` |
| `O`：`python3 scripts/check_organization_admin.py --base-url http://127.0.0.1:18201 --output /tmp/pandora-e13-110ebe0/r-organization.json` | PASS 48/48 | 本轮独立 JSON `r-organization.json` |
| `A`：`python3 scripts/check_account_lifecycle.py --base-url http://127.0.0.1:18202 --defaults-file /tmp/pandora-e13-110ebe0/client.cnf --database e13r_account --output /tmp/pandora-e13-110ebe0/r-account.json` | PASS 47/47 | 本轮独立 JSON `r-account.json` |
| `R`：`python3 scripts/check_review_routing.py --base-url http://127.0.0.1:18203 --output /tmp/pandora-e13-110ebe0/r-routing.json` | PASS 59/59 | 本轮独立 JSON `r-routing.json` |
| `P`：`python3 scripts/check_profile_phone_matrix.py --base-url http://127.0.0.1:18204 --output /tmp/pandora-e13-110ebe0/r-phone.json` | PASS 26/26 | 本轮独立 JSON `r-phone.json` |
| `L`：`python3 scripts/check_work_logs.py --base-url http://127.0.0.1:18207 --output /tmp/pandora-e13-110ebe0/r-logs.json` | PASS 17/17 | 本轮独立 JSON `r-logs.json` |
| `H`：`python3 scripts/check_home_calendar.py --base-url http://127.0.0.1:18205 --output /tmp/pandora-e13-110ebe0/r-home.json` | PASS 12/12 | 本轮独立 JSON `r-home.json` |
| `I`：`python3 scripts/check_ai_analysis.py --base-url http://127.0.0.1:18206 --report /tmp/pandora-e13-110ebe0/r-ai.json` | PASS 18/18 | 本轮独立 JSON `r-ai.json` |
| `E`：`python3 scripts/check_deadline_reminder_notification.py --base-url http://127.0.0.1:18208 --output /tmp/pandora-e13-110ebe0/r-event.json` | PASS 75/75 | 本轮独立 JSON `r-event.json` |
| `D`：`python3 scripts/check_database.py --base-url <对应服务> --defaults-file /tmp/pandora-e13-110ebe0/client.cnf --database <套件库> --output <结果>` | PASS 18/18 × 9 库 | `r-*-database.json`；V1—V12、约束、事件/历史和幂等秘密检查 |
| `BH`：`node scripts/check_home_calendar_browser.js --base-url http://127.0.0.1:18210 --output /tmp/pandora-e13-110ebe0/home_calendar_browser.json` | PASS 33/33 | `home_calendar_browser.json`；主要交互在初始 390 视口，三视口 FAB 检查，不能解释为全部交互每屏都做过 |
| `BC`：`node scripts/check_chapter11_browser.js --base-url http://127.0.0.1:18210 --output /tmp/pandora-e13-110ebe0/chapter11-frozen.json --screenshot-dir /tmp/pandora-e13-110ebe0/screenshots-final --frozen-task-id <fixture> --frozen-username middle` | PASS 45/45 | `chapter11-frozen.json`；320×740、390×844、1440×900；234px 输入框、全屏日志、AI、管理页和冻结有效版 |
| `BA`：`node scripts/check_account_browser.js`，三视口各独立执行 | PASS 15/15 × 3 | `account_browser-{320,390,1440}.json` |
| `BL`：`node scripts/check_logs_profile_browser.js`，三视口 | PASS 22/22 × 3 | `logs_profile_browser-{320,390}.json`、`logs-profile-desktop-populated.json` |
| `BN`：`node scripts/check_notification_browser.js`，三视口 | PASS 21/21 × 3 | `notification_browser-{320,390,1440}.json` |
| `M`：V4 快照恢复、副本预检、当前 jar seed=false 启动及只对副本写入探测 | FAIL 就绪门禁 | `v4-precheck.json`、`independent-probes.json`、`final-probes.json`；Flyway 成功但 V-005 |
| `X`：补充真实 HTTP/SQL 负向探测、当前源码函数执行 | 7 项偏差 | V-001—V-007；不是只据 mock 或代码形状推断 |
| `T`：当前源码/配置/单测及前端事件处理静态追踪 | 见矩阵 | 静态结论与实测分开，具体路径见下文 |

复现设置：每个 HTTP 套件从新的 seeded 数据库启动 `backend/target/pandora-backend-0.1.0.jar`，数据库 URL 指向临时 MySQL，设置 `PANDORA_SEED=true`、测试时钟 `pandora.clock.controllable=true`。事件等受控套件使用 `--pandora.worker.delay-ms=3600000 --pandora.worker.initial-delay-ms=3600000` 并手动驱动；smoke 必须使用活跃 worker（本轮 1000ms）。浏览器脚本在 `backend/scripts/`，向脚本提供本机 Chrome 路径 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`、base URL、viewport 与独立 output；fixture 与具体交互在脚本和本轮 JSON 内。三个单视口脚本用 `--base-url http://127.0.0.1:18210 --width <320|390|1440> --height <740|844|900> --output <独立结果路径>` 分别执行。凭据仅用于本地临时数据库，不复制到报告。

本轮设置修正及失败处置（不隐去失败，也不误报实施缺陷）：

- 首次 sandbox 内 MySQL 启动/本地 TCP 被限制，授权后使用隔离临时数据库成功；没有把环境失败当作业务结果。
- 升权运行环境带 HTTP proxy，Python PATCH 曾 RemoteDisconnected；用 `NO_PROXY=127.0.0.1,localhost` 及 `no_proxy` 修正后重跑，Checks 中 `r-*` 是修正后的独立结果。
- worker 暂停时 smoke 等通知的 16 项失败属于不匹配的测试设置；改为活跃 worker 后 `final-smoke.json` 53/53，替代 `r-general.json` 的失败运行。
- 桌面日志初始样本不足滚动，回顶项 21/22（`logs_profile_browser-1440.json`、`logs-profile-desktop-recheck.json`）；仅在一次性浏览器库添加 12 个不同日期的员工日志以确保溢出，脚本不变，`logs-profile-desktop-populated.json` 22/22。没有把夹具不足记作产品缺陷。
- 最终含冻结任务的 45/45 替代早期未启用冻结分支的 36/36。截图仅位于临时目录 `screenshots-final/`，没有覆盖历史证据。

## Requirement Coverage

编号按当前 delta 文档顺序。`PASS` 表示该行有当前代码检查与所列独立证据；`FAIL` 表示已确认偏差；`UNVERIFIED` 表示部分验证成功但所述子条件缺直接证据。重复旧场景名采用同一 WHEN/THEN 的证据，不按旧名称推导旧行为。需求总行同时覆盖正文 SHALL；正文缺陷即使没有专名场景仍阻止该要求通过。

证据简称是 Checks 中的本轮运行；`T` 的实现路径如下，Java 路径以 `backend/src/main/java/cn/pandora/` 为前缀，前端文件以仓库根为前缀。

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| **R01 Five-page navigation（要求正文）** | 前端主页面/认证导航；auth/AuthFilter.java、auth/AuthService.java；S、BA、BC、BL、BN | **PASS** |
| R01.S01 Navigate with an authenticated identity | 前端主页面/认证导航；auth/AuthFilter.java、auth/AuthService.java；S、BA、BC、BL、BN | PASS（所列执行证据及 T） |
| R01.S02 Navigate across the prototype | 前端主页面/认证导航；auth/AuthFilter.java、auth/AuthService.java；S、BA、BC、BL、BN | PASS（所列执行证据及 T） |
| **R02 Four-quadrant dashboard（要求正文）** | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | **PASS** |
| R02.S01 Scroll independent quadrants | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S02 Rank a newly assigned old task | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S03 Show concise tasks and read only company information | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S04 Maintain personal items through detail | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S05 Use the ten day log window | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S06 View the four dashboard quadrants | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S07 Scroll one dashboard quadrant | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S08 Read an assigned task without clipping | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S09 Executive maintains company information | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S10 Reject company information above the limit | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S11 Edit personal information | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S12 Reject personal information above the limit | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| **R03 Calendar task views（要求正文）** | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | **FAIL V-007；部分密集交互 UNVERIFIED** |
| R03.S01 Use the required calendar entry points | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S02 Read a month and open a complete day list | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S03 Pin only one's own ordering | H 的跨用户 pin；BH；实际 dayListSort 输入/输出，见 V-007 | FAIL V-007 |
| R03.S04 Split a timed cross day task | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S05 Display every overlapping and all day task | BH：四重叠/多全天/完整轴存在，初始 390；尚未在全部三视口逐块实际点击验证 | UNVERIFIED（部分通过） |
| R03.S06 Switch a whole week while preserving weekday | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S07 Count mutually exclusive relationships | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S08 Open the default month view | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S09 Select a year and month | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S10 Drill from month to week | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S11 Ignore blank month task space | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S12 Drill from week to day | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S13 Ignore blank week task space | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S14 Switch time granularity | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S15 Keep task clicks distinct from drill-down | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S16 Navigate and return from a week | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S17 Navigate and return from a day | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S18 Render a spanning task bar | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S19 Render an all-day task | 同 Display every overlapping and all day task；全天逐项存在，跨视口逐项点击缺证 | UNVERIFIED（部分通过） |
| R03.S20 Distinguish visible tasks | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S21 Identify the current user's task relationship | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S22 Show only task names in bars | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S23 Order visible task lanes | 同上；同 pin 组全天优先覆盖真实开始时间 | FAIL V-007 |
| R03.S24 Fill five monthly task rows | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S25 Handle crowded time slots | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S26 Open overflow tasks for one date | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| **R04 Role-scoped visibility（要求正文）** | auth/Access.java、task/TaskService.java、workspace/WorkspaceService.java；O、P、R、L、I、S、T | **FAIL V-001/V-004（异常授权边界）** |
| R04.S01 Read a task crossing departments | auth/Access.java、task/TaskService.java、workspace/WorkspaceService.java；O、P、R、L、I、S、T | PASS（所列执行证据及 T） |
| R04.S02 Separate direct reports from teammates | auth/Access.java、task/TaskService.java、workspace/WorkspaceService.java；O、P、R、L、I、S、T | PASS（所列执行证据及 T） |
| R04.S03 Deny unauthorized detail and privacy leakage | P/A/I/R/S 的正常负向矩阵通过；损坏链/未送达普通通知补充探测 | FAIL V-001/V-004 |
| R04.S04 Compare role visibility | auth/Access.java、task/TaskService.java、workspace/WorkspaceService.java；O、P、R、L、I、S、T | PASS（所列执行证据及 T） |
| R04.S05 Prevent unauthorized detail access | 同上：正常拒绝有效，异常边界见 V-001/V-004 | FAIL V-001/V-004 |
| **R05 Role-scoped task creation and assignment（要求正文）** | auth/Access.java、task/TaskService.java、负责人选择前端；O、R、S、T | **PASS 执行逻辑；配置能力缺口见 V-006/R14** |
| R05.S01 Select and order authorized assignees | auth/Access.java、task/TaskService.java、负责人选择前端；O、R、S、T | PASS（所列执行证据及 T） |
| R05.S02 Enforce dispatch independently from viewing | auth/Access.java、task/TaskService.java、负责人选择前端；O、R、S、T | PASS（所列执行证据及 T） |
| R05.S03 Isolate an unpublished creation | auth/Access.java、task/TaskService.java、负责人选择前端；O、R、S、T | PASS（所列执行证据及 T） |
| R05.S04 Executive selects assignees across departments | auth/Access.java、task/TaskService.java、负责人选择前端；O、R、S、T | PASS（所列执行证据及 T） |
| R05.S05 Manager assigns a departmental task | auth/Access.java、task/TaskService.java、负责人选择前端；O、R、S、T | PASS（所列执行证据及 T） |
| R05.S06 Cancel assignee selection | auth/Access.java、task/TaskService.java、负责人选择前端；O、R、S、T | PASS（所列执行证据及 T） |
| R05.S07 Search for an unavailable assignee | auth/Access.java、task/TaskService.java、负责人选择前端；O、R、S、T | PASS（所列执行证据及 T） |
| R05.S08 Employee submits a self-created task | auth/Access.java、task/TaskService.java、负责人选择前端；O、R、S、T | PASS（所列执行证据及 T） |
| R05.S09 Superior reviews a self-created task | auth/Access.java、task/TaskService.java、负责人选择前端；O、R、S、T | PASS（所列执行证据及 T） |
| **R06 Task structure and attributes（要求正文）** | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | **PASS** |
| R06.S01 Edit task text in expanded fields | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S02 Validate schedules and preserve provenance | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S03 Search, clear or reject a parent relation | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S04 Keep parents independently executable | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S05 Create a timed task | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S06 Create an all-day task | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S07 Reject an inverted task range | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S08 Preserve task creation time | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S09 Search and select a parent task | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S10 Show no matching parent tasks | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S11 Inspect a child task | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S12 Inspect a parent task | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S13 Inspect an abstract task | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| **R07 Task editing and completion review（要求正文）** | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | **FAIL V-002（到期提交解冻）** |
| R07.S01 Freeze and cancel an application | R/S 并发唯一、撤销及冻结通过；提交时失效/解冻不能持久化，见 V-002 | FAIL V-002（到期分支） |
| R07.S02 Restrict comparison data to the reviewer | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| R07.S03 Distinguish completion outcomes | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| R07.S04 Reopen with a new schedule | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| R07.S05 Assignee updates progress | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| R07.S06 Show status without numeric progress | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| R07.S07 Creator approves completion | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| R07.S08 Superior rejects completion | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| **R08 Required notifications（要求正文）** | common/Events.java、workspace/EventsWorker.java、workspace/WorkspaceService.java；E、D、BN、T | **FAIL V-001；推送 DEFERRED** |
| R08.S01 Deliver the submission and result matrix | common/Events.java、workspace/EventsWorker.java、workspace/WorkspaceService.java；E、D、BN、T | PASS（所列执行证据及 T） |
| R08.S02 Summarize multiple changes and preserve removed recipients | common/Events.java、workspace/EventsWorker.java、workspace/WorkspaceService.java；E、D、BN、T | PASS（所列执行证据及 T） |
| R08.S03 Use actual events without synthetic urgency | common/Events.java、workspace/EventsWorker.java、workspace/WorkspaceService.java；E、D、BN、T | PASS（所列执行证据及 T） |
| R08.S04 Inspect task change notification coverage | common/Events.java、workspace/EventsWorker.java、workspace/WorkspaceService.java；E、D、BN、T | PASS（所列执行证据及 T） |
| R08.S05 Notify on task creation | common/Events.java、workspace/EventsWorker.java、workspace/WorkspaceService.java；E、D、BN、T | PASS（所列执行证据及 T） |
| R08.S06 Surface due and emergency notices | common/Events.java、workspace/EventsWorker.java、workspace/WorkspaceService.java；E、D、BN、T | PASS（所列执行证据及 T） |
| R08.S07 Notify people affected by assignment changes | common/Events.java、workspace/EventsWorker.java、workspace/WorkspaceService.java；E、D、BN、T | PASS（所列执行证据及 T） |
| R08.S08 Surface review and consultation requests | common/Events.java、workspace/EventsWorker.java、workspace/WorkspaceService.java；E、D、BN、T | PASS（所列执行证据及 T） |
| R08.S09 Represent urgent work without a synthetic title | common/Events.java、workspace/EventsWorker.java、workspace/WorkspaceService.java；E、D、BN、T | PASS（所列执行证据及 T） |
| **R09 Personal work logs（要求正文）** | workspace/WorkspaceService.java、全屏日志前端、V8/V11 迁移；L、S、BL、BC、D、T | **PASS** |
| R09.S01 Write and edit a log in a full-screen sheet | workspace/WorkspaceService.java、全屏日志前端、V8/V11 迁移；L、S、BL、BC、D、T | PASS（所列执行证据及 T） |
| R09.S02 Enforce one log under concurrent distinct keys | workspace/WorkspaceService.java、全屏日志前端、V8/V11 迁移；L、S、BL、BC、D、T | PASS（所列执行证据及 T） |
| R09.S03 Freeze across the midnight boundary | workspace/WorkspaceService.java、全屏日志前端、V8/V11 迁移；L、S、BL、BC、D、T | PASS（所列执行证据及 T） |
| R09.S04 Link, clear or redact tasks independently | workspace/WorkspaceService.java、全屏日志前端、V8/V11 迁移；L、S、BL、BC、D、T | PASS（所列执行证据及 T） |
| R09.S05 Search and link a visible task | workspace/WorkspaceService.java、全屏日志前端、V8/V11 迁移；L、S、BL、BC、D、T | PASS（所列执行证据及 T） |
| R09.S06 Clear a linked task | workspace/WorkspaceService.java、全屏日志前端、V8/V11 迁移；L、S、BL、BC、D、T | PASS（所列执行证据及 T） |
| R09.S07 Show no matching linked tasks | workspace/WorkspaceService.java、全屏日志前端、V8/V11 迁移；L、S、BL、BC、D、T | PASS（所列执行证据及 T） |
| R09.S08 Write an unlinked log | workspace/WorkspaceService.java、全屏日志前端、V8/V11 迁移；L、S、BL、BC、D、T | PASS（所列执行证据及 T） |
| R09.S09 Superior reads a subordinate log | workspace/WorkspaceService.java、全屏日志前端、V8/V11 迁移；L、S、BL、BC、D、T | PASS（所列执行证据及 T） |
| **R10 Log page single-content filtering and scroll return（要求正文）** | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | **PASS** |
| R10.S01 Enter with self and filter a direct report | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S02 Return to the top without mixing workflows | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S03 Enter the log page | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S04 Select pending reviews | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S05 Switch between role-specific content filters | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S06 Invoke a log-page command | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S07 Toggle own logs | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S08 Restore the visible log scope | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S09 Search logs by author | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S10 Show no matching authors | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S11 Keep log finding separate and scoped | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S12 Return to the top of log content | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| **R11 Role-scoped AI map（要求正文）** | workspace/WorkspaceService.java、AI 前端；I、BC、WorkspaceAnalysisTest、T | **PASS** |
| R11.S01 Generate personal and department results separately | workspace/WorkspaceService.java、AI 前端；I、BC、WorkspaceAnalysisTest、T | PASS（所列执行证据及 T） |
| R11.S02 Extract new words and required metrics | workspace/WorkspaceService.java、AI 前端；I、BC、WorkspaceAnalysisTest、T | PASS（所列执行证据及 T） |
| R11.S03 Refresh suggestions and deny stale details | workspace/WorkspaceService.java、AI 前端；I、BC、WorkspaceAnalysisTest、T | PASS（所列执行证据及 T） |
| R11.S04 View employee AI map | workspace/WorkspaceService.java、AI 前端；I、BC、WorkspaceAnalysisTest、T | PASS（所列执行证据及 T） |
| R11.S05 View executive AI map | workspace/WorkspaceService.java、AI 前端；I、BC、WorkspaceAnalysisTest、T | PASS（所列执行证据及 T） |
| **R12 Minimal profile page（要求正文）** | auth/Access.java、profile/ProfileService.java、workspace/WorkspaceService.java、资料前端；A、P、BL、BN、T | **FAIL V-004（损坏链保护）** |
| R12.S01 Read and edit the required profile | auth/Access.java、profile/ProfileService.java、workspace/WorkspaceService.java、资料前端；A、P、BL、BN、T | PASS（所列执行证据及 T） |
| R12.S02 Open a subordinate within both profile scope and the management chain | P、BL、BN 普通组织通过；循环链仍返回号码，见 V-004 | FAIL V-004 |
| R12.S03 View profile | auth/Access.java、profile/ProfileService.java、workspace/WorkspaceService.java、资料前端；A、P、BL、BN、T | PASS（所列执行证据及 T） |
| **R13 Strict prototype scope（要求正文）** | 当前打包服务、auth/AuthFilter.java、README、历史追踪；S、BC、全部 HTTP/浏览器检查、T | **PASS 范围声明/真实入口；各业务缺陷另列** |
| R13.S01 Validate the real service and declared scope | 当前打包服务、auth/AuthFilter.java、README、历史追踪；S、BC、全部 HTTP/浏览器检查、T | PASS（所列执行证据及 T） |
| R13.S02 Inspect available actions | 当前打包服务、auth/AuthFilter.java、README、历史追踪；S、BC、全部 HTTP/浏览器检查、T | PASS（所列执行证据及 T） |
| R13.S03 Open the split static prototype | 当前打包服务、auth/AuthFilter.java、README、历史追踪；S、BC、全部 HTTP/浏览器检查、T | PASS（所列执行证据及 T） |
| **R14 Organization and administration（要求正文）** | admin/OrganizationService.java、OrganizationConstraints.java、RoleCatalog.java、AdminController.java、`admin.html`、V5—V12；O、D、BC、M、T | **FAIL V-003/V-005/V-006** |
| R14.S01 Maintain an employee through the administrator interface | O/BC 新员工可维护、必填/循环等拒绝通过；独立配置缺失及 V4 未映射写入见 V-005/V-006 | FAIL V-005/V-006 |
| R14.S02 Maintain teams independently of departments | admin/OrganizationService.java、OrganizationConstraints.java、RoleCatalog.java、AdminController.java、`admin.html`、V5—V12；O、D、BC、M、T | PASS（所列执行证据及 T） |
| R14.S03 Transfer updates independent scopes | O/R 正常转岗与旧权限失效通过；移除最后审核人的合法维护 500 | FAIL V-003 |
| R14.S04 Maintain and reorder company information | admin/OrganizationService.java、OrganizationConstraints.java、RoleCatalog.java、AdminController.java、`admin.html`、V5—V12；O、D、BC、M、T | PASS（所列执行证据及 T） |
| **R15 Account password lifecycle（要求正文）** | auth/Access.java、auth/AuthService.java、admin/Credentials.java、profile/ProfileService.java；A、P、BA、BN、D、T | **FAIL V-004** |
| R15.S01 Initial login cannot enter business pages | auth/Access.java、auth/AuthService.java、admin/Credentials.java、profile/ProfileService.java；A、P、BA、BN、D、T | PASS（所列执行证据及 T） |
| R15.S02 Password validation and reset | auth/Access.java、auth/AuthService.java、admin/Credentials.java、profile/ProfileService.java；A、P、BA、BN、D、T | PASS（所列执行证据及 T） |
| R15.S03 Edit contacts without exposing another employee phone | auth/Access.java、auth/AuthService.java、admin/Credentials.java、profile/ProfileService.java；A、P、BA、BN、D、T | PASS（所列执行证据及 T） |
| R15.S04 Read phones only through authorized person details | auth/Access.java、auth/AuthService.java、admin/Credentials.java、profile/ProfileService.java；A、P、BA、BN、D、T | PASS（所列执行证据及 T） |
| R15.S05 Recheck the management chain after an organization change | P 转岗后重新鉴权通过；一次性坏链 employee→middle→upper→middle 实际人员详情仍含号码 | FAIL V-004 |
| **R16 Ordered reviewer routing and reassignment（要求正文）** | task/TaskService.java、admin/OrganizationService.java；R、E、D、TaskServiceTest、T | **FAIL V-003** |
| R16.S01 Persist order and route the first highest peer | task/TaskService.java、admin/OrganizationService.java；R、E、D、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R16.S02 Review one's own application explicitly | task/TaskService.java、admin/OrganizationService.java；R、E、D、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R16.S03 Change assignees using the proposed route | task/TaskService.java、admin/OrganizationService.java；R、E、D、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R16.S04 Fall back or apply with a documented reason | R 新提交无审核人直接生效通过；已有待审失去最后审核人进入 applyWithoutReviewer 抛 SQL 异常 | FAIL V-003 |
| R16.S05 Reassign after organization changes | R/E 有替代审核人时改派通过；无剩余审核人时合法组织维护失败 | FAIL V-003 |
| **R17 Dedicated task handover（要求正文）** | task/TaskService.java、auth/Access.java、交接前端；R、S、D、T | **PASS 已执行交接；到期入口同 V-002 需复验** |
| R17.S01 A direct manager hands over a subordinate task | task/TaskService.java、auth/Access.java、交接前端；R、S、D、T | PASS（所列执行证据及 T） |
| R17.S02 Handover approval preserves provenance | task/TaskService.java、auth/Access.java、交接前端；R、S、D、T | PASS（所列执行证据及 T） |
| **R18 Deadline expiration of pending applications（要求正文）** | workspace/ExpiryService.java、task/TaskService.java、common/Writes.java；E、S、D、X、T | **FAIL V-002；三方竞争 UNVERIFIED** |
| R18.S01 Reject expired submission and approval before the scan | E 决定入口提交失效成功；X 提交入口 412 后仍 pending/frozen，见 V-002 | FAIL V-002 |
| R18.S02 Use the applicable deadline and preserve the effective version | workspace/ExpiryService.java、task/TaskService.java、common/Writes.java；E、S、D、X、T | PASS（所列执行证据及 T） |
| R18.S03 Expire and backfill overdue once | workspace/ExpiryService.java、task/TaskService.java、common/Writes.java；E、S、D、X、T | PASS（所列执行证据及 T） |
| R18.S04 Resolve the deadline race once | E 两个截止后决定唯一 expired；S 批准/撤销一赢家；组织锁/事务静态检查；尚未同时执行批准+撤销+扫描三方竞争 | UNVERIFIED（三方并发缺证） |
| **R19 Proportional schedule reminders（要求正文）** | workspace/ReminderService.java、EventsWorker.java、TaskService.java、公司截止设置；E、O、D、ReminderNodeTest、T | **PASS** |
| R19.S01 Remind a ten hour task | workspace/ReminderService.java、EventsWorker.java、TaskService.java、公司截止设置；E、O、D、ReminderNodeTest、T | PASS（所列执行证据及 T） |
| R19.S02 Skip stale nodes after a late scan | workspace/ReminderService.java、EventsWorker.java、TaskService.java、公司截止设置；E、O、D、ReminderNodeTest、T | PASS（所列执行证据及 T） |
| R19.S03 Reset the schedule identity and handle zero duration | workspace/ReminderService.java、EventsWorker.java、TaskService.java、公司截止设置；E、O、D、ReminderNodeTest、T | PASS（所列执行证据及 T） |
| **R20 Notification lifecycle and historical access（要求正文）** | workspace/WorkspaceService.java、EventsWorker.java、common/Events.java、通知前端；E、BN、D、EventsRetentionTest、X、T | **FAIL V-001；边界/空列表部分 UNVERIFIED** |
| R20.S01 Close a notification list without footer actions | BN 三屏无 footer/关闭按钮可聚焦通过；未直接执行空列表 Tab 到关闭并触发的完整路径 | UNVERIFIED（空列表键盘路径） |
| R20.S02 Open an old review notification | workspace/WorkspaceService.java、EventsWorker.java、common/Events.java、通知前端；E、BN、D、EventsRetentionTest、X、T | PASS（所列执行证据及 T） |
| R20.S03 Enforce withdrawal and calendar month boundaries | E 179 秒可撤、180 秒拒绝；EventsRetentionTest 验证月末/闰年/公司时区；源码严格 before(+180)，未实际请求 179.999 秒 | UNVERIFIED（179.999 秒接口边界） |
| R20.S04 Distinguish hide and withdraw | workspace/WorkspaceService.java、EventsWorker.java、common/Events.java、通知前端；E、BN、D、EventsRetentionTest、X、T | PASS（所列执行证据及 T） |
| R20.S05 Retain access solely through a delivered notification | workspace/WorkspaceService.java、EventsWorker.java、common/Events.java、通知前端；E、BN、D、EventsRetentionTest、X、T | PASS（所列执行证据及 T） |
| R20.S06 End the exception and block undelivered access | E 删除/撤回/到期拒绝通过；X 送达前失权普通通知仍含原标题和实际摘要 | FAIL V-001 |
| **R21 Complete task operation history（要求正文）** | task/TaskService.java、管理端历史接口、V6/V9/V12；R、E、D、A、T | **PASS 已执行记录；V-003 路径先修复再补证** |
| R21.S01 Inspect an ordered assignee change and reassignment | task/TaskService.java、管理端历史接口、V6/V9/V12；R、E、D、A、T | PASS（所列执行证据及 T） |
| R21.S02 Retain history after message removal | task/TaskService.java、管理端历史接口、V6/V9/V12；R、E、D、A、T | PASS（所列执行证据及 T） |

移除要求 `Manager consultation`：PASS。当前业务页面/日志/通知不再提供请示回复入口（BL、S、T）；没有新增请示样例来满足已移除要求，历史数据不作破坏性删除。

正文/设计额外约束检查：V1—V4 不重写通过；V4 预检只读通过；重复日志 22 条经当前迁移保留为 18 正常行 + 4 归档行，重复组 0，唯一索引三列，未确认丢失；旧序无法恢复/旧通知无法绑定的兼容标记有记录。缺映射正式写门禁失败由 V-005 覆盖；分别可配置能力正文失败由 V-006 覆盖，不能因场景仅写“设置授权”而忽略。密码一次交付及普通缓存无秘密由 A/D 验证。冻结有效版、234px 表单、全屏日志、通知列表无 footer、下属资料日志独立授权均有当前服务证据。没有从 tasks 的勾选状态推断行为通过。

## Findings

### V-001: 普通事件在送达前失去权限仍泄露任务标题和实际变更摘要

- Category: implementation
- Severity: high
- Requirement: `Notification lifecycle and historical access`（End the exception and block undelivered access）；`Required notifications`；design §7；task 7.2（DEV-030/033）。
- Evidence: `backend/src/main/java/cn/pandora/workspace/EventsWorker.java:98`—120 无权限且非移除事件时虽清空任务/标题，仍保存 `event.changeSummary`；`WorkspaceService.java:420`—423 又从 domain event 回填被清空的 title/摘要；taskId 为空的副本在 :458 仍可列出。独立 HTTP 在 `e13_probe` 暂停 worker：middle 创建 employee 负责的任务并批准；随后改标题、把负责人换为 colleague 并批准；employee 普通任务详情已 404；再驱动 worker，employee 通知列表仍返回普通 `task.create.approved`。
- Expected: 普通消息送达前已经失权的候选人不得因此取得保留原受限标题/实际摘要的历史例外；合法负责人移除事件须按其明确的事实授权单独处理。
- Actual: 返回 `taskId:null, relationLost:false, readonly:true, title:"E13 confidential undelivered title"`、泛化 summary，同时 `changeSummary:"任务《E13 confidential undelivered title》的创建申请已通过。"`，并携带 `requestStatus:"approved"`。这是普通旧事件，不是允许向被移除人发送的移除通知。禁用了跳转仍没有阻止内容泄露。
- Repair guidance: 对送达前已失权的普通事件执行字段级脱敏或不投递，读取层不得从事件回填受限内容；同时审查原申请元数据的权限。保留合法已送达及移除事件所需摘要。
- Acceptance checks: 在独立库重做上述暂停/改权/投递顺序，检查列表、消息详情、消息 task 入口及已读响应均无受限内容/历史权；对照已送达后撤权、真正移除事件仍保留受限只读例外；其他查询持续排除。
- Repair status: pending
- Repair notes: —（首次独立验证，尚无修复记录）
- Reverification notes: 现有 E 的已送达移除用例通过，但不覆盖“普通消息排队期间失权”；上述独立接口输出与静态路径共同确认。

### V-002: 提交入口触发的待审失效随版本冲突一起回滚

- Category: implementation
- Severity: medium
- Requirement: `Deadline expiration of pending applications`（Reject expired submission and approval before the scan）；`Task editing and completion review`；design §6、tasks 5.2/5.3。
- Evidence: `backend/src/main/java/cn/pandora/task/TaskService.java:190`—198 在同一写事务先 `expirePendingForTask`（递增 task rowVersion）后检查调用者 If-Match；`handover` :532—540 同结构。`TaskController.java:82` 使用 `writes.run`，`common/Writes.java` 的 TransactionTemplate 在异常时回滚。独立服务：employee 创建截止为受控 now+60 秒的待审，读取任务 ETag，推进 61 秒后用所读 ETag PATCH `command:change`、新标题及 reason。
- Expected: 错误响应后旧申请仍应持久化为 expired、解除冻结，未发布任务不发布；不能因后续校验或冲突回滚已经要求完成的截止处理。
- Actual: PATCH 返回 `412 VERSION_CONFLICT`；随后 GET 原申请仍 `pending`、任务仍 `frozen:true`。决定入口的独立 75 项套件确能在错误后提交失效，不能替代提交入口证据。
- Repair guidance: 确保提交/交接入口的失效终态及解冻在后续命令失败时仍能持久化，保持事务授权与并发语义；不要求忽略真实过时 ETag。
- Acceptance checks: 未发布创建、已发布任务的进展/修改/重开及交接入口，在扫描前跨截止后提交；即使收到 4xx，旧请求也 expired 且解冻，原有效版/提交前状态不变，未发布不发布，失效/逾期事件各按规则去重；再测并发与相同幂等键重试。
- Repair status: pending
- Repair notes: —（首次独立验证，尚无修复记录）
- Reverification notes: 已执行创建待审跨截止再提交；交接同事务结构为静态同源影响，修复后须执行，未冒称本轮已经执行该分支。

### V-003: 失去最后审核人的待审改派存在 SQL 参数错误并回滚组织维护

- Category: implementation
- Severity: high
- Requirement: `Ordered reviewer routing and reassignment`（Fall back or apply with a documented reason；Reassign after organization changes）；`Organization and administration`；task 4.4。
- Evidence: `backend/src/main/java/cn/pandora/task/TaskService.java:678`—688 的 `applyWithoutReviewer` UPDATE 有 8 个占位符，却传入 9 个参数（重复 `now, now`）。在独立库由 upper 创建自己负责的任务并保持显式待审，原创建者也是最后可用审核人；admin 使用当前员工 ETag PATCH `reviewerAvailable:false`。`final-probes.json`：原申请 `135311a2-3d8f-43af-a7c1-9dc7327ee61a`，组织维护 `500`，随后请求仍 `pending`。`browser.log` / `e13_probe.log` 记录 `Parameter index out of range (9 > number of parameters, which is 8)`，栈在该方法。
- Expected: 合法组织变动成功；按同一算法上溯/创建者兜底，确无审核人时留存原因直接生效，并保留路由/操作历史；不得留下空审核人的待审。
- Actual: org 更新事务 500 回滚，申请保持 pending；新建时原本无审核人的正向用例通过，但已有待审转入该分支失败。
- Repair guidance: 修正该分支的 SQL/参数契约，并确保无审核人直接生效仍执行有效截止、授权和历史规则。
- Acceptance checks: 重做待审失去最后审核人的接口流程，组织变更成功，申请 direct/原因可追溯，内容及状态正确生效；覆盖有替代审核人、确无审核人、损坏链阻断、已过截止，旧审核人/旧页面不能越权决定。
- Repair status: pending
- Repair notes: —（首次独立验证，尚无修复记录）
- Reverification notes: 此 500 已重复确认；早期 `independent-probes.json` 中无实际变化的员工更新 200 不是该分支证据，以最终明确待审夹具结果为准。没有把尚未能穿过 SQL 的其他潜在问题宣告为已发生。

### V-004: 手机号鉴权在遇到查看者时提前成功，未识别后续管理链循环

- Category: implementation
- Severity: medium
- Requirement: `Account password lifecycle`（Recheck the management chain after an organization change）；`Role-scoped visibility`；`Minimal profile page`；design §3、task 3.5。
- Evidence: `backend/src/main/java/cn/pandora/auth/Access.java:180`—195，:189 遇到 actor 即 return true，未验证余下链。仅在一次性库通过 SQL 设置损坏数据 `employee -> middle -> upper -> middle`，保留 middle 的当前资料权和较高组织层级；用 middle GET employee 人员详情实际返回 200 并包含测试号码 `13900009999`，记录于 `independent-probes.json`（`phoneReturned:true`）。
- Expected: 对环、跨公司、失效等不能证明有效关系的管理链不授予他人手机号；每次请求使用当前有效链。
- Actual: 访问者出现在循环之前时被当作有效上级，循环没有触发拒绝。组织维护 API 拒绝新建环并不能满足规格明确要求的损坏数据防御。
- Repair guidance: 在授予号码前完成相关管理链有效性校验，错误链 fail closed；正常本人、直属和有资料权的间接上级仍按既有规则读取。
- Acceptance checks: 在隔离库构造 actor 位于环内/环前/环外、失效中间人、跨组织引用、转岗后旧关系，确保详情或号码被拒绝/裁剪；重跑 P/A 及下属浏览器矩阵，目录/audit/outbox 无号码。
- Repair status: pending
- Repair notes: —（首次独立验证，尚无修复记录）
- Reverification notes: 当前 AccessTest 的循环用例只覆盖 actor 不在循环中的情况；本轮真实 HTTP 覆盖其遗漏分支，不声称 UI 能创建循环。

### V-005: V4 组织映射阻断未解决时仍接受正式业务写入

- Category: implementation
- Severity: high
- Requirement: design `Migration Plan` §2 明确“缺映射或重复数据生成可审查报告，未解决不启用正式写流程”；`Organization and administration` 部门/职位必填；task 1.2。
- Evidence: 将 V4 快照恢复到隔离副本并执行 `backend/scripts/migration_precheck.py`，预检前后指纹相同，报告 7 用户缺部门/职位等阻断。当前 jar `seed=false` 启动，Flyway V1—V12 成功；仍有 7 个未映射用户及 2 条 open mapping blocker；worker 暂停。用 employee 提交明日排期的正常本人任务，POST `/api/v1/tasks` 返回 **201，outcome=pending**（`independent-probes.json`）。`admin/OrganizationConstraints.java` 在映射缺失时只记录并 return；通用写入口/任务写未执行正式就绪门禁。
- Expected: 允许管理端补齐映射/查看阻断，但阻断未解除前不能启用依赖正式组织模型的业务写流程。禁止凭旧团队名称编造部门。
- Actual: 缺正式组织字段仍可建立新任务/申请。迁移能启动及 blocker 可见不等于业务已被阻止。
- Repair guidance: 将就绪状态纳入正式写入口，保留受权管理修复通路；完成映射、验证和约束收紧后才能解除门禁，旧页面与幂等重放也不能绕过。
- Acceptance checks: 同一 V4 副本未映射时业务写明确拒绝，管理补齐仍可用；清障后 NOT NULL/其他约束就绪且正式写恢复；新空库不回归；预检仍只读、旧日志无损合并、旧顺序/旧通知兼容不造假。
- Repair status: pending
- Repair notes: —（首次独立验证，尚无修复记录）
- Reverification notes: V4 原日志 22 条，升级后 18 正常+4 归档、重复组 0、`uq_log_day` 3 列，未确认日志丢失。暂停 worker 后旧过期待审尚未扫描是测试设置，未据此另立缺陷；本项只针对明确设计要求的写门禁。

### V-006: 管理端无法分别配置任务查看范围和派发范围

- Category: implementation
- Severity: high
- Requirement: `Organization and administration` 正文 SHALL 提供分别配置的任务查看/派发权限；design §2；tasks 2.2/2.6（DEV-002）。
- Evidence: `admin.html:97`—99 是只读角色表，:335—339 只渲染 scopes 文本；员工维护只选固定角色。`backend/src/main/java/cn/pandora/admin/AdminController.java:84` 只有 GET roles，无 scope 定义写接口；`OrganizationService.java:576`—584 将 roleCodes 限于固定四种。`RoleCatalog.java`：executive 的 task_view/task_dispatch 均 company，manager 均 department，employee 均 self，admin 均无，合并角色各取最大仍保持两者相同。实际 GET `/api/v1/admin/organization` 的固定角色配置已记录在 `final-probes.json`，服务管理页也实际加载检查。
- Expected: 管理员通过受权管理流程能分别配置查看与派发，例如公司可见但仅本人派发；服务端候选、提交、批准、旧请求权限校验服从该配置。
- Actual: 存在两种 scope 列及不同 Access 检查函数，但管理端/API 不能产生不同的范围组合；只能直接改 SQL。现有 Access 单测手工构造“部门可见/仅本人派发”Actor，不能证明配置流程已实现。
- Repair guidance: 补齐可操作的受权独立配置与持久化途径，更新权限版本并即时重算候选/写权限；不要求特定新增 endpoint 名称。
- Acceptance checks: 无直接 SQL，在管理界面/API 配置 company-view+self-dispatch 及 department-view+self-dispatch；重新登录/刷新后保留，能看却不能派发，越权请求和权限改变前的旧页面/批准/幂等重放被拒绝；仅有管理员不能取得员工业务权。
- Repair status: pending
- Repair notes: —（首次独立验证，尚无修复记录）
- Reverification notes: O 的固定角色授权/派发拒绝矩阵通过；这不覆盖独立配置能力本身。已检查当前服务和所有角色维护路由，非基于猜测某个 API 返回 404 下结论。

### V-007: 完整日列表强制全天优先，破坏同置顶组的时间顺序

- Category: implementation
- Severity: low
- Requirement: `Calendar task views`（Pin only one's own ordering；Order visible task lanes）要求本人月格与完整日列表同置顶组按开始时间、同时间任务标识排序；task 9.4。
- Evidence: `潘多拉-日程视图.js:52`—61 的 `dayListSort` 对所有全天任务使用排序时间 `-1`，而 `monthSortTasks` 使用实际 start。Node 读取并执行当前文件原函数（不是另写排序实现），输入同为 `pinned:false` 的前日 20:00 开始并延续到所选日 10:00 的定时任务 `earlier-timed`，及所选日 00:00 开始的全天任务 `later-all-day`。
- Expected: 同组先 `earlier-timed` 再 `later-all-day`，按实际 start；置顶仍优先，同 start 按 id 稳定排序。
- Actual: 原函数返回 `['later-all-day','earlier-timed']`；月格与当日列表采用不同顺序。
- Repair guidance: 日列表与月格使用相同的置顶/真实开始时间/稳定 ID 规则，不改变全天区或时间轴实际位置。
- Acceptance checks: 覆盖跨日定时与稍后全天混排、相同 start、不同 pin、刷新持久化及另一账号排序，完整日列表和月格一致；时间轴仍不随 pin 移位。
- Repair status: pending
- Repair notes: —（首次独立验证，尚无修复记录）
- Reverification notes: H/BH 验证了 pin 私有性和 pin 优先，但未覆盖同 pin 组全天/跨日混排；补充执行原函数确认。

## Historical Traceability Cross-check

以下为本轮独立结论索引，保持原 `traceability.md` 及原始审计不变。以本次 delta 为验收准绳；旧审计“他人手机号一律不可见”“仅直属下属”等表述已被 2026-10-19 规则替代，不据旧规则制造新缺陷。`PASS` 仅指对应本轮范围与证据；有子条件缺证的行保留 UNVERIFIED，延期不折算完成率。

### DEV 35 项

| DEV | 本轮证据 | 独立结论 |
| --- | --- | --- |
| DEV-001 | O/A/BC/M；R14 | FAIL V-005/V-006 |
| DEV-002 | O/P/AccessTest；R04/R14 | FAIL V-006 |
| DEV-003 | A/BA/D；R15 | PASS |
| DEV-004 | O/R/P；R17 | PASS 已执行转岗/交接 |
| DEV-005 | O/L/BL/AccessTest；R09/R10 | PASS |
| DEV-006 | R/TaskServiceTest；R16 | PASS 顺序/最高层 |
| DEV-007 | R/S；R16 | PASS 显式自审 |
| DEV-008 | R；R16 | PASS 新路线 |
| DEV-009 | R/X；R16 | FAIL V-003 |
| DEV-010 | R/E/X；R16 | FAIL V-003 |
| DEV-011 | R/S/BC；R07 | PASS |
| DEV-012 | E/S/X；R18 | FAIL V-002；三方竞争 UNVERIFIED |
| DEV-013 | R/E；R07 | PASS |
| DEV-014 | E/ReminderNodeTest；R19 | PASS |
| DEV-015 | O/E；R19 | PASS |
| DEV-016 | R/E/D；R21 | PASS 已执行历史 |
| DEV-017 | H/BH；R02 | PASS |
| DEV-018 | O/H/BH；R02 | PASS |
| DEV-019 | H/BH/T；R03 | PASS 已执行入口 |
| DEV-020 | H/BH/X；R03 | FAIL V-007 |
| DEV-021 | BH/T；R03 | PASS 已执行跨日 |
| DEV-022 | BH/T；R03 | UNVERIFIED 全部视口逐块点击 |
| DEV-023 | BH/T；R03 | PASS 浏览器手势 |
| DEV-024 | H/BH/I；R03/R11 | PASS |
| DEV-025 | L/D/BL/BC；R09 | PASS |
| DEV-026 | L/WorkspaceLogAndReportsTest；R09 | PASS |
| DEV-027 | L/BL/BC；R10 | PASS |
| DEV-028 | A/P/BL/BN/X；R12 | FAIL V-004 |
| DEV-029 | 范围授权延期 | DEFERRED 系统推送/真机未验证 |
| DEV-030 | E/BN/X；R08 | FAIL V-001 |
| DEV-031 | E/BN；R20 | PASS 已读/原申请 |
| DEV-032 | E/BN/EventsRetentionTest；R20 | UNVERIFIED 179.999秒及空列表键盘子条件 |
| DEV-033 | E/BN/X；R20 | FAIL V-001 |
| DEV-034 | I/BC/WorkspaceAnalysisTest；R11 | PASS |
| DEV-035 | S/D/BC/严格验证/本报告 | FAIL 仍有实现偏差及缺证，不作全量通过 |

### AUD 150 项

每个历史编号保留独立行；证据使用上面的本轮运行和 R 要求矩阵，非历史 JSON。对宽泛验收条目不将某个窄正向检查概括为全范围实测。

| AUD | 本轮证据/当前规则 | 独立结论 |
| --- | --- | --- |
| AUD-SCP-001 | S/BC/T；R01/R13 | PASS 当前范围声明 |
| AUD-SCP-002 | O/BC/X；R14 | FAIL V-006 |
| AUD-SCP-003 | S/BC/T；R01/R13 | PASS 当前范围声明 |
| AUD-ORG-001 | O/M/D；R14 | FAIL V-005（旧库未映射仍写） |
| AUD-ORG-002 | O/R/P/D/BC/T；R14/R16/R17 | PASS |
| AUD-ORG-003 | O/R/P/D/BC/T；R14/R16/R17 | PASS |
| AUD-ORG-004 | O/BC/X；R14 | FAIL V-006 |
| AUD-ORG-005 | O/AccessTest/X；R14 | FAIL V-006 |
| AUD-ORG-006 | O/R/P/D/BC/T；R14/R16/R17 | PASS |
| AUD-ORG-007 | O/R/P/D/BC/T；R14/R16/R17 | PASS |
| AUD-ORG-008 | O/R/P/D/BC/T；R14/R16/R17 | PASS |
| AUD-ORG-009 | R/T；R17 专用交接通过 | UNVERIFIED 预设交接对象的完整管理流程未独立执行 |
| AUD-ORG-010 | R/X；R16/R17 | FAIL V-003 |
| AUD-ACC-001 | A/BA/O/D/T；R15 | PASS |
| AUD-ACC-002 | A/BA/O/D/T；R15 | PASS |
| AUD-ACC-003 | A/BA/O/D/T；R15 | PASS |
| AUD-ACC-004 | A/BA/O/D/T；R15 | PASS |
| AUD-ACC-005 | A/BA/O/D/T；R15 | PASS |
| AUD-PER-001 | O/P/R/L/I/S/T；R04/R05/R12 | PASS |
| AUD-PER-002 | O/P/R/L/I/S/T；R04/R05/R12 | PASS |
| AUD-PER-003 | O/P/R/L/I/S/T；R04/R05/R12 | PASS |
| AUD-PER-004 | O/P/R/L/I/S/T；R04/R05/R12 | PASS |
| AUD-PER-005 | O/P/R/L/I/S/T；R04/R05/R12 | PASS |
| AUD-PER-006 | O/P/R/L/I/S/T；R04/R05/R12 | PASS |
| AUD-PER-007 | O/P/R/L/I/S/T；R04/R05/R12 | PASS |
| AUD-PER-008 | O/P/R/L/I/S/T；R04/R05/R12 | PASS |
| AUD-PER-009 | A/P/X；R15 以新管理链手机号规则替代旧仅本人规则 | FAIL V-004 |
| AUD-PER-010 | S/P/R/I/E/X；R04/R20 | FAIL V-001/V-004 |
| AUD-PER-011 | P/BL/T；R12 以新资料权∩管理链规则替代旧仅直属规则 | PASS 正常关系；损坏链见 V-004 |
| AUD-ADM-001 | O/R/E/D/BH/T；R02/R21 | PASS |
| AUD-ADM-002 | O/R/E/D/BH/T；R02/R21 | PASS |
| AUD-ADM-003 | O/R/E/D/BH/T；R02/R21 | PASS |
| AUD-ADM-004 | O/R/E/D/BH/T；R02/R21 | PASS |
| AUD-TSK-001 | R/S/E/BC/TaskServiceTest/T；R05/R06/R07 | PASS |
| AUD-TSK-002 | R/S/E/BC/TaskServiceTest/T；R05/R06/R07 | PASS |
| AUD-TSK-003 | R/S/E/BC/TaskServiceTest/T；R05/R06/R07 | PASS |
| AUD-TSK-004 | R/S/E/BC/TaskServiceTest/T；R05/R06/R07 | PASS |
| AUD-TSK-005 | R/S/E/BC/TaskServiceTest/T；R05/R06/R07 | PASS |
| AUD-TSK-006 | R/S/E/BC/TaskServiceTest/T；R05/R06/R07 | PASS |
| AUD-TSK-007 | R/S/E/BC/TaskServiceTest/T；R05/R06/R07 | PASS |
| AUD-TSK-008 | R/S/E/BC/TaskServiceTest/T；R05/R06/R07 | PASS |
| AUD-TSK-009 | R/S/E/BC/TaskServiceTest/T；R05/R06/R07 | PASS |
| AUD-TSK-010 | R/S/E/BC/TaskServiceTest/T；R05/R06/R07 | PASS |
| AUD-REV-001 | R/E/TaskServiceTest/T；R16 | PASS |
| AUD-REV-002 | R/TaskServiceTest/X；R16 | FAIL V-003（最后审核人分支） |
| AUD-REV-003 | R/X；R16 | FAIL V-003 |
| AUD-REV-004 | R/E/TaskServiceTest/T；R16 | PASS |
| AUD-REV-005 | R/E/TaskServiceTest/T；R16 | PASS |
| AUD-REV-006 | R/E/TaskServiceTest/T；R16 | PASS |
| AUD-REV-007 | R/E/TaskServiceTest/T；R16 | PASS |
| AUD-REV-008 | R/E/X；R16 | FAIL V-003 |
| AUD-FLW-001 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-002 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-003 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-004 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-005 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-006 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-007 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-008 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-009 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-010 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-011 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-012 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-013 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-014 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-015 | E/X；R18 | FAIL V-002 |
| AUD-FLW-016 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-017 | R/S/E/D/T；R18 | UNVERIFIED 三方竞争尚缺直接执行 |
| AUD-HIS-001 | R/E/D/A/T；R21 | PASS 已执行历史 |
| AUD-HIS-002 | R/E/D/A/T；R21 | PASS 已执行历史 |
| AUD-HIS-003 | R/E/D/A/T；R21 | PASS 已执行历史 |
| AUD-HOM-001 | H/O/BH/T；R02 | PASS |
| AUD-HOM-002 | H/O/BH/T；R02 | PASS |
| AUD-HOM-003 | H/O/BH/T；R02 | PASS |
| AUD-HOM-004 | H/O/BH/T；R02 | PASS |
| AUD-HOM-005 | H/O/BH/T；R02 | PASS |
| AUD-HOM-006 | H/O/BH/T；R02 | PASS |
| AUD-CAL-001 | H/BH/T；R03 | PASS 已执行浏览器检查 |
| AUD-CAL-002 | H/BH/T；R03 | PASS 已执行浏览器检查 |
| AUD-CAL-003 | H/BH/T；R03 | PASS 已执行浏览器检查 |
| AUD-CAL-004 | H/BH/T；R03 | PASS 已执行浏览器检查 |
| AUD-CAL-005 | H/BH/T；R03 | PASS 已执行浏览器检查 |
| AUD-CAL-006 | H/BH/T；R03 | PASS 已执行浏览器检查 |
| AUD-CAL-007 | H/BH/T；R03 | PASS 已执行浏览器检查 |
| AUD-CAL-008 | H/BH/X；R03 | FAIL V-007 |
| AUD-TMV-001 | BH/H/I/T；R03 | PASS 已执行浏览器检查 |
| AUD-TMV-002 | BH/H/I/T；R03 | PASS 已执行浏览器检查 |
| AUD-TMV-003 | BH/H/I/T；R03 | PASS 已执行浏览器检查 |
| AUD-TMV-004 | BH/H/I/T；R03 | PASS 已执行浏览器检查 |
| AUD-TMV-005 | BH/H/I/T；R03 | PASS 已执行浏览器检查 |
| AUD-TMV-006 | BH/H/I/T；R03 | PASS 已执行浏览器检查 |
| AUD-TMV-007 | BH/T；R03 | UNVERIFIED 三视口全部逐块点击 |
| AUD-TMV-008 | BH/T；R03 | UNVERIFIED 长标题/最小尺寸完整组合逐块点击 |
| AUD-TMV-009 | BH/H/I/T；R03 | PASS 已执行浏览器检查 |
| AUD-TMV-010 | BH/H/I/T；R03 | PASS 已执行浏览器检查 |
| AUD-TMV-011 | BH/H/I/T；R03 | PASS 已执行浏览器检查 |
| AUD-LOG-001 | L/O/S/BL/BC/WorkspaceLogAndReportsTest/T；R09/R10 | PASS |
| AUD-LOG-002 | L/O/S/BL/BC/WorkspaceLogAndReportsTest/T；R09/R10 | PASS |
| AUD-LOG-003 | L/O/S/BL/BC/WorkspaceLogAndReportsTest/T；R09/R10 | PASS |
| AUD-LOG-004 | L/O/S/BL/BC/WorkspaceLogAndReportsTest/T；R09/R10 | PASS |
| AUD-LOG-005 | L/O/S/BL/BC/WorkspaceLogAndReportsTest/T；R09/R10 | PASS |
| AUD-LOG-006 | L/O/S/BL/BC/WorkspaceLogAndReportsTest/T；R09/R10 | PASS |
| AUD-LOG-007 | L/O/S/BL/BC/WorkspaceLogAndReportsTest/T；R09/R10 | PASS |
| AUD-AIM-001 | I/BC/WorkspaceAnalysisTest/T；R11 | PASS |
| AUD-AIM-002 | I/BC/WorkspaceAnalysisTest/T；R11 | PASS |
| AUD-AIM-003 | I/BC/WorkspaceAnalysisTest/T；R11 | PASS |
| AUD-AIM-004 | I/BC/WorkspaceAnalysisTest/T；R11 | PASS |
| AUD-AIM-005 | I/BC/WorkspaceAnalysisTest/T；R11 | PASS |
| AUD-AIM-006 | I/BC/WorkspaceAnalysisTest/T；R11 | PASS |
| AUD-ME-001 | A/P/BL/BN/T；R12/R15 | PASS |
| AUD-ME-002 | P/BL/BN/X；R12 以新规则替代旧“无他人手机号” | FAIL V-004（循环链） |
| AUD-ME-003 | A/P/BL/BN/T；R12/R15 | PASS |
| AUD-NTF-001 | E/BN；R08 | DEFERRED 系统推送；仅站内部分有证据 |
| AUD-NTF-002 | E/BN/D/T；R08 | PASS 已执行站内矩阵 |
| AUD-NTF-003 | E/BN/D/T；R08 | PASS 已执行站内矩阵 |
| AUD-NTF-004 | E/BN/D/T；R08 | PASS 已执行站内矩阵 |
| AUD-NTF-005 | E/BN/D/T；R08 | PASS 已执行站内矩阵 |
| AUD-NTF-006 | E/BN/D/T；R08 | PASS 已执行站内矩阵 |
| AUD-NTF-007 | E/BN/D/T；R08 | PASS 已执行站内矩阵 |
| AUD-NTF-008 | E/BN/D/T；R08 | PASS 已执行站内矩阵 |
| AUD-NTF-009 | E/D；R08 | DEFERRED 系统推送；站内去重通过 |
| AUD-TIM-001 | E/O/D/ReminderNodeTest/T；R18/R19 | PASS |
| AUD-TIM-002 | E/O/D/ReminderNodeTest/T；R18/R19 | PASS |
| AUD-TIM-003 | E/O/D/ReminderNodeTest/T；R18/R19 | PASS |
| AUD-TIM-004 | E/X；R18 | FAIL V-002 |
| AUD-TIM-005 | E/O/D/ReminderNodeTest/T；R18/R19 | PASS |
| AUD-TIM-006 | E/X；R18 | FAIL V-002 |
| AUD-TIM-007 | E/O/D/ReminderNodeTest/T；R18/R19 | PASS |
| AUD-TIM-008 | E/O/D/ReminderNodeTest/T；R18/R19 | PASS |
| AUD-TIM-009 | E/O/D/ReminderNodeTest/T；R18/R19 | PASS |
| AUD-TIM-010 | E/O/D/ReminderNodeTest/T；R18/R19 | PASS |
| AUD-TIM-011 | E/O/D/ReminderNodeTest/T；R18/R19 | PASS |
| AUD-TIM-012 | S/E/D/T；R18 | UNVERIFIED 三方竞争尚缺直接执行 |
| AUD-MSG-001 | E/BN/EventsRetentionTest/T；R20 | PASS |
| AUD-MSG-002 | E/BN/EventsRetentionTest/T；R20 | PASS |
| AUD-MSG-003 | E/BN/EventsRetentionTest/T；R20 | PASS |
| AUD-MSG-004 | E/BN/EventsRetentionTest/T；R20 | PASS |
| AUD-MSG-005 | E/T；R20 | UNVERIFIED 179/180通过，179.999秒未直接执行 |
| AUD-MSG-006 | E/BN/EventsRetentionTest/T；R20 | PASS |
| AUD-NTH-001 | E/BN/D/T；R20 | PASS 已送达只读例外 |
| AUD-NTH-002 | E/BN/D/T；R20 | PASS 已送达只读例外 |
| AUD-NTH-003 | E/BN/D/T；R20 | PASS 已送达只读例外 |
| AUD-NTH-004 | E/BN/D/T；R20 | PASS 已送达只读例外 |
| AUD-NTH-005 | X；R20 | FAIL V-001 |
| AUD-NTH-006 | E/BN/D/T；R20 | PASS 已送达只读例外 |
| AUD-UX-001 | BH/BL/BC/BN；R03/R09/R10 | DEFERRED 真机；浏览器部分有证据 |
| AUD-UX-002 | BH/BL/BC/BN；R03/R09/R10 | DEFERRED 真机；浏览器部分有证据 |
| AUD-UX-003 | BH/BL/BC/BN；R03/R09/R10 | DEFERRED 真机；浏览器部分有证据 |
| AUD-UX-004 | 只有桌面 Chrome 视口模拟 | DEFERRED 真机未验证 |
| AUD-UX-005 | BH/BL/BC/BN；R03/R09/R10 | DEFERRED 真机；浏览器部分有证据 |

### A 25 项

| A | 本轮证据 | 独立结论 |
| --- | --- | --- |
| A-01 | A/BA/O/D | PASS |
| A-02 | O/M/BC/X | FAIL V-005/V-006 |
| A-03 | O/R/AccessTest | PASS 运行时权限逻辑；可配置性见 A-02 |
| A-04 | P/L/BL/X | FAIL V-004 |
| A-05 | O/H/BH | PASS |
| A-06 | R/TaskServiceTest/X | FAIL V-003 |
| A-07 | R/S | PASS |
| A-08 | R/S/E/T | UNVERIFIED 三方竞争与预设对象流程缺证 |
| A-09 | S/E/H/I/BC/T | PASS 已执行隔离矩阵 |
| A-10 | R/S/BC | PASS |
| A-11 | R/E/D/T | PASS 已执行历史 |
| A-12 | H/O/BH/T | PASS |
| A-13 | H/BH/T | PASS 已执行导航/计数 |
| A-14 | H/BH/X | FAIL V-007 |
| A-15 | BH/T | UNVERIFIED 全视口逐块点击 |
| A-16 | BH/T | UNVERIFIED 最小尺寸/置顶/长标题组合点击 |
| A-17 | L/O/BL/BC/D | PASS |
| A-18 | A/P/BL/BN/X | FAIL V-004 |
| A-19 | E/BN/D | DEFERRED 推送；三方竞争未完整执行 |
| A-20 | E/O/D/ReminderNodeTest | PASS |
| A-21 | E/S/X | FAIL V-002；三方竞争 UNVERIFIED |
| A-22 | E/BN/EventsRetentionTest/T | UNVERIFIED 179.999秒接口边界 |
| A-23 | E/BN/X | FAIL V-001 |
| A-24 | I/BC/WorkspaceAnalysisTest | PASS |
| A-25 | 三视口浏览器证据仅作模拟 | DEFERRED 真机未验证 |

## Next Action

执行 `$openspec-e13-fix-change fix-pandora-formal-requirement-deviations` 修复 V-001—V-007，并在修复备注记录实际修改和验收证据；随后重新运行独立 verify（含未验证子条件）。本报告不授权归档；修复工作流不能自行把 finding 标记为 verified-resolved 或把总体结论改为 PASS。
