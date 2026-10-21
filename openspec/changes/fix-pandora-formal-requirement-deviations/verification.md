# Implementation Verification

- Change: `fix-pandora-formal-requirement-deviations`
- Schema: `spec-driven`
- Verdict: **FAIL**
- Verified at: 2026-10-21T17:36:01+08:00
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice`（前端根目录及 `backend/`）
- OpenSpec root: 同仓库 `openspec/`，未使用独立 store。
- Verified revision: `4b53a152a0ad4492521fcc86999e0cbc364c3e1b`（含 `f2f2dc1` 的修复）；开始时工作树干净；结束时除本报告外无变化。

## Summary

本轮独立复验仍为 FAIL：原 V-001、V-003—V-007 共 6 项标记 `verified-resolved`；V-002 原回滚问题已修复，但提交在组织锁上等待跨过截止时仍不持久化失效，保持 `pending`。另新增 V-008（high：无审核人自动生效绕过已收回的派发权限）、V-009（medium：旧库最后补团队映射后写门禁不恢复）。当前 3 项待修复：1 high、2 medium，不能归档。

严格验证、Java 62 项、九组 HTTP/九库数据库检查及浏览器套件均通过；补充真实 HTTP/SQL 竞争与负向探测确认上述偏差。通过的现有脚本不能替代遗漏的边界检查。覆盖当前 delta 的 21 条有效要求、147 个场景及 1 条移除要求，保留完整矩阵和历史 35 DEV / 150 AUD / 25 A 索引。本轮仅修改本报告，没有修复实施、测试、规划、任务或 implementation-notes，没有同步规格或归档。

DEV-029 操作系统推送与 A-25/真机体验部分按既有授权延期，未实现/未验证，不计作通过。桌面 Chrome 视口模拟只证明已执行的浏览器行为。剩余证据缺口包括批准+撤销+扫描三方竞争、179.999 秒实际接口边界、全部视口逐块日历点击、空通知键盘关闭及预设交接对象完整管理流程；它们不是已确认缺陷，但也不能计作全量 PASS。

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| 实施、规划、配置、测试与非忽略新增文件 | Git `4b53a152a0ad4492521fcc86999e0cbc364c3e1b`；开始/结束相同；215 个唯一路径；SHA-256 `dcd3bb414f6317d47df53dd423b5858b185dc19255612dbba6ab8c31d2cda908` |
| 当前验收规划 | `proposal.md`、`design.md`、`tasks.md`、`specs/pandora-requirements-aligned-prototype/spec.md` 全部在上述清单内；本轮未变；以当前 delta 替代旧规则 |
| 追踪与历史资料 | `audit/2026-10-20/chapter11/traceability.md` 及正式需求/历史审计；35 DEV、150 AUD、25 A；历史结论不改写 |
| 历史兼容性 | V1—V4 迁移与历史基线相同；新增迁移至 V13；旧库/新库均实际升级 |
| V4 快照预检 | 隔离副本 `pandora_precheck_e13v_v4`，预检前后均 `45ac48ce85cf709a8556a73e2603336e4f68b8afc4e80782aba80d800d855df1`，表清单、各表内容摘要相同 |
| 本轮可执行证据 | `/tmp/pandora-e13-reverify-4b53a15/`，本轮生成的 JSON、日志和截图；不以历史审计 JSON 或修复备注代替独立执行 |
| 工作流所有文件 | basename 为 `verification.md` / `implementation-notes.md` 的文件排除；其余 Git 跟踪及非忽略未跟踪文件均包含 |

复算命令从实施根目录执行。清单和内容共同散列，检测新增、删除及内容变化；开始与最终结果一致。忽略的构建/runtime 文件不属于源码基线，本轮 jar 从当前源码重新 package。

```python
import subprocess, hashlib, json, pathlib
root = pathlib.Path.cwd()
paths = subprocess.check_output(['git','ls-files','-co','--exclude-standard','-z']).decode().split('\0')
files = {
    p: hashlib.sha256((root/p).read_bytes()).hexdigest() if (root/p).is_file() else 'MISSING'
    for p in sorted(set(paths))
    if p and pathlib.Path(p).name not in ('verification.md','implementation-notes.md')
}
print(len(files))  # 215
print(hashlib.sha256(json.dumps(files, sort_keys=True, separators=(',',':')).encode()).hexdigest())
```

已完整读取上轮报告与修复备注，V-001—V-007 沿用稳定编号并逐项复验，Repair notes 原文保留。已解决项的原 Evidence/Actual 明确保留为上轮历史，当前结果以 Reverification notes 为准。关键失败输出及复现步骤在本报告内；临时目录不是永久证据库，下次须在新隔离环境重新执行。

## Apply Handoff Review

读取 `implementation-notes.md` 全文与 OpenSpec 返回的全部 contextFiles。当前 apply 为 `all_done`，65/65 任务勾选；勾选和修复备注均只是待独立核验的声明。

| Handoff claim / reminder | 独立处置 |
| --- | --- |
| change/schema、实现地图、追踪行数 | change/schema 匹配；逐域检查当前实现与脚本，35/150/25 行数确认；地图不是验收结论 |
| Windows 路径及 `29e3f99` 加未提交工作树 | **过时**：实际 Mac 根目录、当前 `4b53a15…` 干净基线；以当前文件为准 |
| Java 21、60 测试及 package | 版本/命令仍适用，数量**过时**；本轮 Java 21 package 成功，实际 62/62、0 failures/errors/skipped |
| HTTP/数据库套件、隔离数据库、受控时钟顺序 | **确认**：各套件新库，时钟变化隔离；新增/扩展脚本独立重跑，见 Checks |
| 浏览器五组、三视口、冻结分支 | **确认有限范围**：当前 jar 上执行五组，BC 45/45 含冻结；新增角色编辑器实际保存/重载 4/4；完整逐块/空列表键盘/真机缺口仍保留 |
| V1—V12 新库与 V4 历史阻断 | 迁移数量**过时**：已到 V13。预检只读确认；V-005 原缺映射仍写已解决；补齐后恢复的顺序缺陷由新 V-009 覆盖 |
| 旧负责人顺序、旧通知兼容限制 | 预检仍识别 88 条 legacy-order-unknown、40 条无法绑定原申请；不宣称恢复无法证明的历史顺序，旧消息保持只读 |
| 最初 smoke 旧断言失败后修正 | 本轮真实身份/显式审核，活跃 worker 下 smoke 53/53；没有复用 apply 输出 |
| 午夜脚本取整修复 | **确认**：L 17/17，23:59:59 编辑与 00:00:00 冻结及 PATCH/DELETE/补建拒绝 |
| 数据库敏感字段检查修正 | **确认**：9 库各 18/18，A 另查密码、手机号、幂等/audit/outbox；普通 metadata 不误判秘密 |
| 通知打开与 replay 时间精度修复 | **确认**：E 91/91 含打开幂等、已读、原申请绑定及 V-001 字段脱敏；179.999 秒精确接口边界仍 UNVERIFIED |
| strict 两条 >500 字符警告 | **过时**：本轮 `valid:true, issues:[]`，不据旧警告建立 planning finding |
| 推送/真机延期、不宣告独立验收 | **确认**：保留 DEV-029、A-25 及相关 UX/NTF 延期；不归档、不重写历史审计 |
| 全范围独立复验提醒及 V-001—V-007 修复声明 | 按 specs/design 扩展到竞争、失权、恢复顺序；6 项原缺陷已确认解决，V-002 仍有缺口，新增 V-008/V-009；详见 Findings |

## Checks

环境：macOS、Java 21、Maven 离线依赖库、MySQL 9.3.0、Node 24、已安装 Chrome。MySQL 使用 `/tmp/pandora-e13-reverify-4b53a15/mysql/` 独立数据目录，端口 13326；未改写原项目 MySQL 数据目录。HTTP 各套件独立新库；浏览器 `e13v_browser`/18310；负向探测 `e13v_probe`/18311；V4 两个隔离副本。所有本轮临时 Java 服务及 MySQL 已停止。

```sh
# 从 backend/ 执行
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 package
```

下表 Python/Node 脚本均相对 `backend/`；结果路径相对上述本轮临时目录，`--base-url` 按表中端口提供，`--output`（smoke/AI 用 `--report`）指向对应 JSON。

| Command or inspection | Result | Notes |
| --- | --- | --- |
| `openspec status --change fix-pandora-formal-requirement-deviations --json`；`openspec instructions apply --change fix-pandora-formal-requirement-deviations --json` | 完整可验证 | 本地 spec-driven，全部上下文可读 |
| `openspec validate fix-pandora-formal-requirement-deviations --type change --strict --json --no-interactive` | PASS | `valid:true, issues:[]` |
| 上述 Java 21 Maven package | PASS 62/62 | surefire 0 failures/errors/skipped；当前 jar 打包成功 |
| `S`：`python3 scripts/smoke_test.py`，18300 | PASS 53/53 | `smoke.json`，活跃 worker 1000ms |
| `O`：`python3 scripts/check_organization_admin.py`，18301 | PASS 58/58 | `organization.json`，含独立范围配置及旧权限/幂等拒绝 |
| `A`：`python3 scripts/check_account_lifecycle.py`，18302；附临时 `--defaults-file`、`--database e13v_account` | PASS 47/47 | `account.json`，凭据生命周期/秘密落库检查 |
| `R`：`python3 scripts/check_review_routing.py`，18303 | PASS 64/64 | `routing.json`，含 V-003 最后审核人正常直接生效 |
| `P`：`python3 scripts/check_profile_phone_matrix.py`，18324 | PASS 26/26 | `phonefinal.json` |
| `PC`：`python3 scripts/check_phone_cycle.py`，18324，附对应临时数据库参数 | PASS 5/5 | `phone-cycle.json`，真实坏链号码裁剪/本人及恢复后正常上级对照 |
| `L`：`python3 scripts/check_work_logs.py`，18327 | PASS 17/17 | `logsfinal.json` |
| `H`：`python3 scripts/check_home_calendar.py`，18325 | PASS 12/12 | `homefinal.json` |
| `I`：`python3 scripts/check_ai_analysis.py`，18326 | PASS 18/18 | `aifinal.json` |
| `E`：`python3 scripts/check_deadline_reminder_notification.py`，18328 | PASS 91/91 | `eventfinal.json`，V-001 脱敏与 V-002 原回滚回归通过；不含锁等待跨截止 |
| `D`：`python3 scripts/check_database.py --defaults-file <临时client.cnf> --database <各库> --output <结果>` | PASS 18/18 × 9 | `{smoke,organization,account,routing,phonefinal,homefinal,aifinal,logsfinal,eventfinal}-database.json`；V1—V13 |
| `CS`：`node scripts/check_calendar_sort.js` | PASS 4/4 | `calendar-sort.json`，直接读取当前源码函数，原 V-007 输入顺序正确 |
| `BH`：`node scripts/check_home_calendar_browser.js`，18310 | PASS 33/33 | `home-calendar.json`；主交互在 390，三视口 FAB；不等于每屏全部交互 |
| `BC`：`node scripts/check_chapter11_browser.js --frozen-task-id <实际夹具> --frozen-username middle`，18310 | PASS 45/45 | `chapter11.json`；三视口、234px 输入框、冻结有效版、全屏日志、AI、管理页 |
| `BA`：`node scripts/check_account_browser.js`，18310，三视口各执行 | PASS 15/15 × 3 | `account-{320,390,1440}.json` |
| `BL`：`node scripts/check_logs_profile_browser.js`，18310，三视口 | PASS 22/22 × 3 | `logs-profile-{320,390}.json`、`logs-profile-1440-populated.json` |
| `BN`：`node scripts/check_notification_browser.js`，18310，三视口 | PASS 21/21 × 3 | `notification-{320,390,1440}.json` |
| `UI`：临时 `role-editor.js`，实际管理页面下拉/保存/重载，390 视口 | PASS 4/4 | `role-editor-browser.json`；executive company/self、manager department/self 分别持久化，再通过界面恢复 |
| `M`：V4 只读预检、当前 jar seed=false 升级；`python3 scripts/check_mapping_write_gate.py`，18309 | PASS 10/10 原门禁 | `v4-precheck.json`、`mapping-gate.json`、`v4-integrity.json`；先团队后员工修复恢复写入；反向顺序见 V-009 |
| `X`：临时 `probes.py`、`extra.py`，真实 HTTP/SQL 及组织锁竞争 | FAIL 3 项 | `independent-probes.json`（V-002/V-008），`extra-probes.json`（V-009） |
| `T`：当前代码/配置/单测/前端事件静态追踪 | 见矩阵 | 静态结论与实际行为证据区分；文件路径见矩阵/Findings |

复现设置：各套件从全新 seeded 数据库启动本轮 `backend/target/pandora-backend-0.1.0.jar`，临时数据库 URL、`PANDORA_SEED=true`、`--pandora.clock.controllable=true`；V4 副本 seed=false。除 smoke 外暂停后台扫描（`--pandora.worker.delay-ms=3600000 --pandora.worker.initial-delay-ms=3600000`），按脚本手动驱动；smoke worker 1000ms。浏览器用本机 Chrome `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`，单视口脚本分别提供 `--width 320 --height 740`、`390/844`、`1440/900` 和独立 output。凭据只在临时环境使用，不写入报告。

设置失败与重跑处置：sandbox 中独立 MySQL 初始化/本地连接受限，授权后成功；本地地址预先设置 NO_PROXY。早期 `/health` 已就绪但 DemoSeed 尚未完成，导致部分套件登录 401；随后等待 `Organization constraint guard:` 启动日志并修正 helper 的等待循环后全部重跑，以上最终 JSON 为准。A/R 自带重试的首次有效结果保留。V4 restore 初次因库名前缀保护拒绝，改用 `pandora_precheck_` 前缀后执行；没有放松保护。桌面日志初次 21/22 因筛选样本不足滚动，仅向一次性库补 12 个不同日期日志，原脚本重跑 22/22。以上均属环境/夹具，不计产品 finding，也未隐去初次失败。

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
| **R03 Calendar task views（要求正文）** | H/BH/T、CS；当前源码 dayListSort/月格函数执行 | **UNVERIFIED（密集交互子条件）；原 V-007 已解决** |
| R03.S01 Use the required calendar entry points | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S02 Read a month and open a complete day list | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S03 Pin only one's own ordering | H/BH 的跨用户 pin；CS 实际函数 4/4；原 V-007 反例已正确排序 | PASS（V-007 verified-resolved） |
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
| R03.S23 Order visible task lanes | CS 同 pin 组按真实开始/id；H/BH 置顶私有性 | PASS（V-007 verified-resolved） |
| R03.S24 Fill five monthly task rows | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S25 Handle crowded time slots | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S26 Open overflow tasks for one date | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| **R04 Role-scoped visibility（要求正文）** | Access/TaskService/WorkspaceService；O、P、PC、R、L、I、S、E、T | **PASS（原 V-001/V-004 已解决）** |
| R04.S01 Read a task crossing departments | auth/Access.java、task/TaskService.java、workspace/WorkspaceService.java；O、P、R、L、I、S、T | PASS（所列执行证据及 T） |
| R04.S02 Separate direct reports from teammates | auth/Access.java、task/TaskService.java、workspace/WorkspaceService.java；O、P、R、L、I、S、T | PASS（所列执行证据及 T） |
| R04.S03 Deny unauthorized detail and privacy leakage | P/PC/A/I/R/S/E；异常链及普通通知送达前失权回归 | PASS（V-001/V-004 verified-resolved） |
| R04.S04 Compare role visibility | auth/Access.java、task/TaskService.java、workspace/WorkspaceService.java；O、P、R、L、I、S、T | PASS（所列执行证据及 T） |
| R04.S05 Prevent unauthorized detail access | P/PC/E 的当前详情拒绝/通知脱敏与 T | PASS（V-001/V-004 verified-resolved） |
| **R05 Role-scoped task creation and assignment（要求正文）** | Access/TaskService；O/R/S/UI/T；X 当前失权后自动生效 | **FAIL V-008** |
| R05.S01 Select and order authorized assignees | auth/Access.java、task/TaskService.java、负责人选择前端；O、R、S、T | PASS（所列执行证据及 T） |
| R05.S02 Enforce dispatch independently from viewing | O/UI 独立配置通过；X 显式批准 403 后组织维护仍发布同一申请 | FAIL V-008 |
| R05.S03 Isolate an unpublished creation | auth/Access.java、task/TaskService.java、负责人选择前端；O、R、S、T | PASS（所列执行证据及 T） |
| R05.S04 Executive selects assignees across departments | O/R 正常跨部门派发通过；X 旧申请在权限收回后自动生效 | FAIL V-008（权限变更后） |
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
| R07.S01 Freeze and cancel an application | R/S/E 冻结撤销及原回滚修复通过；X 等待组织锁跨截止仍 pending/frozen | FAIL V-002（锁竞争分支） |
| R07.S02 Restrict comparison data to the reviewer | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| R07.S03 Distinguish completion outcomes | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| R07.S04 Reopen with a new schedule | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| R07.S05 Assignee updates progress | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| R07.S06 Show status without numeric progress | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| R07.S07 Creator approves completion | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| R07.S08 Superior rejects completion | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| **R08 Required notifications（要求正文）** | Events/EventsWorker/WorkspaceService；E/D/BN/T | **PASS 已执行站内矩阵（V-001 已解决）；系统推送 DEFERRED** |
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
| **R12 Minimal profile page（要求正文）** | Access/ProfileService/WorkspaceService；A/P/PC/BL/BN/T | **PASS（V-004 已解决）** |
| R12.S01 Read and edit the required profile | auth/Access.java、profile/ProfileService.java、workspace/WorkspaceService.java、资料前端；A、P、BL、BN、T | PASS（所列执行证据及 T） |
| R12.S02 Open a subordinate within both profile scope and the management chain | P/PC/BL/BN；循环链不返回他人号码、恢复有效链后上级可读 | PASS（V-004 verified-resolved） |
| R12.S03 View profile | auth/Access.java、profile/ProfileService.java、workspace/WorkspaceService.java、资料前端；A、P、BL、BN、T | PASS（所列执行证据及 T） |
| **R13 Strict prototype scope（要求正文）** | 当前打包服务、auth/AuthFilter.java、README、历史追踪；S、BC、全部 HTTP/浏览器检查、T | **PASS 范围声明/真实入口；各业务缺陷另列** |
| R13.S01 Validate the real service and declared scope | 当前打包服务、auth/AuthFilter.java、README、历史追踪；S、BC、全部 HTTP/浏览器检查、T | PASS（所列执行证据及 T） |
| R13.S02 Inspect available actions | 当前打包服务、auth/AuthFilter.java、README、历史追踪；S、BC、全部 HTTP/浏览器检查、T | PASS（所列执行证据及 T） |
| R13.S03 Open the split static prototype | 当前打包服务、auth/AuthFilter.java、README、历史追踪；S、BC、全部 HTTP/浏览器检查、T | PASS（所列执行证据及 T） |
| **R14 Organization and administration（要求正文）** | OrganizationService/OrganizationConstraints/AdminController/RoleCatalog/admin.html，V5—V13；O/D/BC/M/UI/X/T | **FAIL V-008/V-009；原 V-003/V-005/V-006 已解决** |
| R14.S01 Maintain an employee through the administrator interface | O/UI 管理与独立范围通过；M 未映射拒绝通过；X 最后补团队后仍不恢复 | FAIL V-009（旧库恢复） |
| R14.S02 Maintain teams independently of departments | O/M 团队独立维护；X 所有团队映射 200 后门禁仍关闭 | FAIL V-009（旧库恢复） |
| R14.S03 Transfer updates independent scopes | O/R 正常转岗与失权拒绝通过；X 权限收回后无审核人自动发布 | FAIL V-008 |
| R14.S04 Maintain and reorder company information | admin/OrganizationService.java、OrganizationConstraints.java、RoleCatalog.java、AdminController.java、`admin.html`、V5—V12；O、D、BC、M、T | PASS（所列执行证据及 T） |
| **R15 Account password lifecycle（要求正文）** | Access/AuthService/Credentials/ProfileService；A/P/PC/BA/BN/D/T | **PASS（V-004 已解决）** |
| R15.S01 Initial login cannot enter business pages | auth/Access.java、auth/AuthService.java、admin/Credentials.java、profile/ProfileService.java；A、P、BA、BN、D、T | PASS（所列执行证据及 T） |
| R15.S02 Password validation and reset | auth/Access.java、auth/AuthService.java、admin/Credentials.java、profile/ProfileService.java；A、P、BA、BN、D、T | PASS（所列执行证据及 T） |
| R15.S03 Edit contacts without exposing another employee phone | auth/Access.java、auth/AuthService.java、admin/Credentials.java、profile/ProfileService.java；A、P、BA、BN、D、T | PASS（所列执行证据及 T） |
| R15.S04 Read phones only through authorized person details | auth/Access.java、auth/AuthService.java、admin/Credentials.java、profile/ProfileService.java；A、P、BA、BN、D、T | PASS（所列执行证据及 T） |
| R15.S05 Recheck the management chain after an organization change | P/PC 当前有效全链验证、循环裁剪、自读及恢复对照；AccessTest/T | PASS（V-004 verified-resolved） |
| **R16 Ordered reviewer routing and reassignment（要求正文）** | TaskService/OrganizationService；R/E/D/TaskServiceTest/X/T | **FAIL V-008；原 V-003 SQL 错误已解决** |
| R16.S01 Persist order and route the first highest peer | task/TaskService.java、admin/OrganizationService.java；R、E、D、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R16.S02 Review one's own application explicitly | task/TaskService.java、admin/OrganizationService.java；R、E、D、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R16.S03 Change assignees using the proposed route | task/TaskService.java、admin/OrganizationService.java；R、E、D、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R16.S04 Fall back or apply with a documented reason | R 64/64 最后审核人正常生效；X 同分支遗漏当前申请人派发鉴权 | FAIL V-008 |
| R16.S05 Reassign after organization changes | R/E 正常改派与 SQL 修复通过；X 收回派发后丧失最后审核人仍发布 | FAIL V-008 |
| **R17 Dedicated task handover（要求正文）** | TaskService/Access/交接前端；R/S/E/D/T | **PASS 已执行交接与原到期回滚回归；共享提交入口锁等待缺口见 V-002** |
| R17.S01 A direct manager hands over a subordinate task | task/TaskService.java、auth/Access.java、交接前端；R、S、D、T | PASS（所列执行证据及 T） |
| R17.S02 Handover approval preserves provenance | task/TaskService.java、auth/Access.java、交接前端；R、S、D、T | PASS（所列执行证据及 T） |
| **R18 Deadline expiration of pending applications（要求正文）** | workspace/ExpiryService.java、task/TaskService.java、common/Writes.java；E、S、D、X、T | **FAIL V-002；三方竞争 UNVERIFIED** |
| R18.S01 Reject expired submission and approval before the scan | E 原创建/交接跨截止后 412 仍提交 expired；X 组织锁等待跨截止仍 409 TASK_FROZEN 且 pending | FAIL V-002 |
| R18.S02 Use the applicable deadline and preserve the effective version | workspace/ExpiryService.java、task/TaskService.java、common/Writes.java；E、S、D、X、T | PASS（所列执行证据及 T） |
| R18.S03 Expire and backfill overdue once | workspace/ExpiryService.java、task/TaskService.java、common/Writes.java；E、S、D、X、T | PASS（所列执行证据及 T） |
| R18.S04 Resolve the deadline race once | E 两个截止后决定唯一 expired；S 批准/撤销一赢家；组织锁/事务静态检查；尚未同时执行批准+撤销+扫描三方竞争 | UNVERIFIED（三方并发缺证） |
| **R19 Proportional schedule reminders（要求正文）** | workspace/ReminderService.java、EventsWorker.java、TaskService.java、公司截止设置；E、O、D、ReminderNodeTest、T | **PASS** |
| R19.S01 Remind a ten hour task | workspace/ReminderService.java、EventsWorker.java、TaskService.java、公司截止设置；E、O、D、ReminderNodeTest、T | PASS（所列执行证据及 T） |
| R19.S02 Skip stale nodes after a late scan | workspace/ReminderService.java、EventsWorker.java、TaskService.java、公司截止设置；E、O、D、ReminderNodeTest、T | PASS（所列执行证据及 T） |
| R19.S03 Reset the schedule identity and handle zero duration | workspace/ReminderService.java、EventsWorker.java、TaskService.java、公司截止设置；E、O、D、ReminderNodeTest、T | PASS（所列执行证据及 T） |
| **R20 Notification lifecycle and historical access（要求正文）** | WorkspaceService/EventsWorker/Events/通知前端；E/BN/D/EventsRetentionTest/X/T | **UNVERIFIED（边界/空列表子条件）；V-001 已解决** |
| R20.S01 Close a notification list without footer actions | BN 三屏无 footer/关闭按钮可聚焦通过；未直接执行空列表 Tab 到关闭并触发的完整路径 | UNVERIFIED（空列表键盘路径） |
| R20.S02 Open an old review notification | workspace/WorkspaceService.java、EventsWorker.java、common/Events.java、通知前端；E、BN、D、EventsRetentionTest、X、T | PASS（所列执行证据及 T） |
| R20.S03 Enforce withdrawal and calendar month boundaries | E 179 秒可撤、180 秒拒绝；EventsRetentionTest 验证月末/闰年/公司时区；源码严格 before(+180)，未实际请求 179.999 秒 | UNVERIFIED（179.999 秒接口边界） |
| R20.S04 Distinguish hide and withdraw | workspace/WorkspaceService.java、EventsWorker.java、common/Events.java、通知前端；E、BN、D、EventsRetentionTest、X、T | PASS（所列执行证据及 T） |
| R20.S05 Retain access solely through a delivered notification | workspace/WorkspaceService.java、EventsWorker.java、common/Events.java、通知前端；E、BN、D、EventsRetentionTest、X、T | PASS（所列执行证据及 T） |
| R20.S06 End the exception and block undelivered access | E 91/91 含送达前失权字段脱敏、列表/详情/open 及 /task 拒绝 | PASS（V-001 verified-resolved） |
| **R21 Complete task operation history（要求正文）** | TaskService/管理端历史接口/V6/V9/V12；R/E/D/A/T | **PASS 已执行历史与正常无审核人分支；授权缺陷另见 V-008** |
| R21.S01 Inspect an ordered assignee change and reassignment | task/TaskService.java、管理端历史接口、V6/V9/V12；R、E、D、A、T | PASS（所列执行证据及 T） |
| R21.S02 Retain history after message removal | task/TaskService.java、管理端历史接口、V6/V9/V12；R、E、D、A、T | PASS（所列执行证据及 T） |

移除要求 `Manager consultation`：PASS。当前业务页面/日志/通知不再提供请示回复入口（BL、S、T）；没有新增请示样例来满足已移除要求，历史数据不作破坏性删除。

正文/设计额外约束检查：V1—V4 不重写通过；V4 预检只读通过；重复日志 22 条经当前迁移保留为 18 正常行 + 4 归档行，重复组 0，唯一索引三列，未确认丢失；旧序无法恢复/旧通知无法绑定的兼容标记有记录。缺映射时写门禁已由 M 证实修复（V-005），最后补团队的恢复缺口由 V-009 覆盖；独立范围编辑 API/实际界面已证实（V-006），自动生效漏重验由 V-008 覆盖。密码一次交付及普通缓存无秘密由 A/D 验证。冻结有效版、234px 表单、全屏日志、通知列表无 footer、下属资料日志独立授权均有当前服务证据。没有从 tasks 的勾选状态推断行为通过。


## Findings

### V-001: 普通事件在送达前失去权限仍泄露任务标题和实际变更摘要

- Category: implementation
- Severity: high
- Requirement: `Notification lifecycle and historical access`（End the exception and block undelivered access）；`Required notifications`；design §7；task 7.2（DEV-030/033）。
- Evidence: **上轮历史（110ebe0 基线，非本轮结果）**： `backend/src/main/java/cn/pandora/workspace/EventsWorker.java:98`—120 无权限且非移除事件时虽清空任务/标题，仍保存 `event.changeSummary`；`WorkspaceService.java:420`—423 又从 domain event 回填被清空的 title/摘要；taskId 为空的副本在 :458 仍可列出。独立 HTTP 在 `e13_probe` 暂停 worker：middle 创建 employee 负责的任务并批准；随后改标题、把负责人换为 colleague 并批准；employee 普通任务详情已 404；再驱动 worker，employee 通知列表仍返回普通 `task.create.approved`。
- Expected: 普通消息送达前已经失权的候选人不得因此取得保留原受限标题/实际摘要的历史例外；合法负责人移除事件须按其明确的事实授权单独处理。
- Actual: **上轮历史**： 返回 `taskId:null, relationLost:false, readonly:true, title:"E13 confidential undelivered title"`、泛化 summary，同时 `changeSummary:"任务《E13 confidential undelivered title》的创建申请已通过。"`，并携带 `requestStatus:"approved"`。这是普通旧事件，不是允许向被移除人发送的移除通知。禁用了跳转仍没有阻止内容泄露。
- Repair guidance: 对送达前已失权的普通事件执行字段级脱敏或不投递，读取层不得从事件回填受限内容；同时审查原申请元数据的权限。保留合法已送达及移除事件所需摘要。
- Acceptance checks: 在独立库重做上述暂停/改权/投递顺序，检查列表、消息详情、消息 task 入口及已读响应均无受限内容/历史权；对照已送达后撤权、真正移除事件仍保留受限只读例外；其他查询持续排除。
- Repair status: verified-resolved
- Repair notes: 修复：新增 V13__mask_undelivered_notification_content.sql（notifications.content_masked 及旧副本回填）；EventsWorker.deliver 对未撤销、送达前已失权且非移除事件的副本清空 title/change_summary/request_id/task_version_id 并写入泛化摘要；WorkspaceService.safeNotification 对 content_masked 行不再从 domain_event 回填标题/摘要/申请元数据，taskId/requestId 置空、canOpenTask=false，/task 入口不可用。回归：check_deadline_reminder_notification.py 新增“创建通过后改标题并改派→原负责人失权→再投递”用例，断言列表、详情、/task 入口与 open 响应均无受限内容，真实移除事件仍保留只读摘要；E 91/91，mvn test 62/62。
- Reverification notes: 本轮 E 91/91 在全新库实际重做普通事件排队期间失权，列表/详情/open 无受限 title/changeSummary/request 元数据、canOpenTask=false、/task 拒绝；真实移除事件对照保留只读摘要。V13 与读取层屏蔽检查一致。原缺陷已解决，verified-resolved。

### V-002: 提交在组织锁上等待跨过截止后，旧待审仍未失效和解冻

- Category: implementation
- Severity: medium
- Requirement: `Deadline expiration of pending applications`（Reject expired submission and approval before the scan）；`Task editing and completion review`；design §6 明确“竞争检查在获得锁后取当前时刻”，tasks 5.2/5.3。
- Evidence: `backend/src/main/java/cn/pandora/task/TaskService.java:188` 的 `expireBeforeSubmit` 在获取锁前传入 `clock.instant()`；`workspace/ExpiryService.java:45` 在独立事务中等待 organizations FOR UPDATE 后，仍用旧的 `now`。本轮 `independent-probes.json.submitLockDeadline`：task `6b40b3d7-b86c-4f85-ba3c-a0f40b47c28f`，request `04b78240-c67b-459b-9f72-5f1be0131d1f`。
- Reproduction: 暂停 worker，新建截止 now+60s 的本人创建待审并读取任务 ETag；另一 MySQL 事务持有该组织行锁；并发 PATCH 该任务 change；从 information_schema.processlist 确认其已等待组织锁，再将服务时钟推进 61s 并释放锁。`organizationLockWaitObserved:true`；实际当前时刻 `2026-10-21T09:24:37.288792Z` 已晚于适用截止 `2026-10-21T09:24:36.245725Z`。
- Expected: 锁后用实际当前时刻判断；无论后续命令返回何种 4xx，旧申请应持久化 expired、解冻，未发布任务不能发布，不能等后台扫描才满足提交入口要求。
- Actual: PATCH `409 TASK_FROZEN`；随后 GET 旧申请仍 `pending`、任务 `frozen:true`。原修复把失效放在独立事务，确已消除原 412 回滚；但锁等待时使用过时的时间，仍违反同一提交截止验收要求。
- Repair guidance: 保留独立提交终态机制，在获得相关锁之后采样受控服务时钟并完成到期判定；保持 ETag、授权、幂等、锁序及终态唯一性，不以忽略过时 ETag 消除症状。
- Acceptance checks: 重跑 E；新增可重复的组织锁阻塞→跨截止→释放场景，创建及已发布任务/交接共享入口均验证终态落库、解冻、有效版保持、未发布不发布、事件去重；同键重试/扫描不能重复改变业务。批准+撤销+扫描三方竞争仍需独立证据。
- Repair status: pending
- Repair notes: 修复：ExpiryService.expirePendingBeforeSubmit 在独立事务先取组织锁并提交 expirePendingForTask；TaskService.change/handover 移除命令事务内的先失效逻辑；TaskController 在 writes.run 之前调用 tasks.expireBeforeSubmit，使后续 412/409 不回滚 expired、解冻及失效/逾期事件。回归：E 新增未发布创建、已发布交接跨截止后用旧 ETag 重提，均收到 412 但申请已 expired、任务解冻且不发布/保持 todo，旧申请不能再批准；E 91/91。
- Reverification notes: 本轮 E 91/91 已实际验证原创建与交接 412 后失效持久化；因此不再声称原回滚仍存在。独立组织锁竞争确认相同验收目标仍失败，沿用 V-002 并重新打开 pending。未将该单个竞争探测概括为三方竞争已验证。

### V-003: 失去最后审核人的待审改派存在 SQL 参数错误并回滚组织维护

- Category: implementation
- Severity: high
- Requirement: `Ordered reviewer routing and reassignment`（Fall back or apply with a documented reason；Reassign after organization changes）；`Organization and administration`；task 4.4。
- Evidence: **上轮历史（110ebe0 基线，非本轮结果）**： `backend/src/main/java/cn/pandora/task/TaskService.java:678`—688 的 `applyWithoutReviewer` UPDATE 有 8 个占位符，却传入 9 个参数（重复 `now, now`）。在独立库由 upper 创建自己负责的任务并保持显式待审，原创建者也是最后可用审核人；admin 使用当前员工 ETag PATCH `reviewerAvailable:false`。`final-probes.json`：原申请 `135311a2-3d8f-43af-a7c1-9dc7327ee61a`，组织维护 `500`，随后请求仍 `pending`。`browser.log` / `e13_probe.log` 记录 `Parameter index out of range (9 > number of parameters, which is 8)`，栈在该方法。
- Expected: 合法组织变动成功；按同一算法上溯/创建者兜底，确无审核人时留存原因直接生效，并保留路由/操作历史；不得留下空审核人的待审。
- Actual: **上轮历史**： org 更新事务 500 回滚，申请保持 pending；新建时原本无审核人的正向用例通过，但已有待审转入该分支失败。
- Repair guidance: 修正该分支的 SQL/参数契约，并确保无审核人直接生效仍执行有效截止、授权和历史规则。
- Acceptance checks: 重做待审失去最后审核人的接口流程，组织变更成功，申请 direct/原因可追溯，内容及状态正确生效；覆盖有替代审核人、确无审核人、损坏链阻断、已过截止，旧审核人/旧页面不能越权决定。
- Repair status: verified-resolved
- Repair notes: 修复：applyWithoutReviewer 的 UPDATE 参数由 9 个改为 8 个以匹配占位符，并提取 NO_REVIEWER_APPLY_SQL 与 noReviewerApplyArgs 常量/构造器；TaskServiceTest 新增占位符数等于参数数断言。HTTP：check_review_routing.py 新增 boss 自建待审、admin 关闭最后审核人场景，组织更新 200、申请 direct 且原因可查、任务发布；R 64/64。
- Reverification notes: 本轮 R 64/64 实际关闭待审最后审核人，组织维护 200、原申请 direct/原因可查、任务发布，SQL 8 参数契约正确；原 500 已解决。扩展失权负向探测揭示的授权绕过为独立新缺陷 V-008，不继续将原 SQL 问题列为 pending。

### V-004: 手机号鉴权在遇到查看者时提前成功，未识别后续管理链循环

- Category: implementation
- Severity: medium
- Requirement: `Account password lifecycle`（Recheck the management chain after an organization change）；`Role-scoped visibility`；`Minimal profile page`；design §3、task 3.5。
- Evidence: **上轮历史（110ebe0 基线，非本轮结果）**： `backend/src/main/java/cn/pandora/auth/Access.java:180`—195，:189 遇到 actor 即 return true，未验证余下链。仅在一次性库通过 SQL 设置损坏数据 `employee -> middle -> upper -> middle`，保留 middle 的当前资料权和较高组织层级；用 middle GET employee 人员详情实际返回 200 并包含测试号码 `13900009999`，记录于 `independent-probes.json`（`phoneReturned:true`）。
- Expected: 对环、跨公司、失效等不能证明有效关系的管理链不授予他人手机号；每次请求使用当前有效链。
- Actual: **上轮历史**： 访问者出现在循环之前时被当作有效上级，循环没有触发拒绝。组织维护 API 拒绝新建环并不能满足规格明确要求的损坏数据防御。
- Repair guidance: 在授予号码前完成相关管理链有效性校验，错误链 fail closed；正常本人、直属和有资料权的间接上级仍按既有规则读取。
- Acceptance checks: 在隔离库构造 actor 位于环内/环前/环外、失效中间人、跨组织引用、转岗后旧关系，确保详情或号码被拒绝/裁剪；重跑 P/A 及下属浏览器矩阵，目录/audit/outbox 无号码。
- Repair status: verified-resolved
- Repair notes: 修复：Access.canReadPhone 遍历整条当前 manager_id 链到根并全程防环，只有完整有效链且查看者确为上级才返回 true；循环、失效、跨公司或缺失中间人一律 fail closed。回归：AccessTest 新增查看者位于环内、环上及环外的用例；新增 backend/scripts/check_phone_cycle.py，在隔离库构造 employee→middle→upper→middle，middle/upper 人员详情均无号码、本人可读，恢复有效链后直接上级恢复读取；5/5，P 26/26。
- Reverification notes: 本轮 P 26/26、PC 5/5、Java AccessTest 通过；真实隔离库环 employee→middle→upper→middle 下 middle/upper 详情均无号码，本人可读，恢复有效链后正常上级可读。源码遍历全链、防环/失效/跨公司/缺失关系检查，与当前规范一致。原问题 verified-resolved。

### V-005: V4 组织映射阻断未解决时仍接受正式业务写入

- Category: implementation
- Severity: high
- Requirement: design `Migration Plan` §2 明确“缺映射或重复数据生成可审查报告，未解决不启用正式写流程”；`Organization and administration` 部门/职位必填；task 1.2。
- Evidence: **上轮历史（110ebe0 基线，非本轮结果）**： 将 V4 快照恢复到隔离副本并执行 `backend/scripts/migration_precheck.py`，预检前后指纹相同，报告 7 用户缺部门/职位等阻断。当前 jar `seed=false` 启动，Flyway V1—V12 成功；仍有 7 个未映射用户及 2 条 open mapping blocker；worker 暂停。用 employee 提交明日排期的正常本人任务，POST `/api/v1/tasks` 返回 **201，outcome=pending**（`independent-probes.json`）。`admin/OrganizationConstraints.java` 在映射缺失时只记录并 return；通用写入口/任务写未执行正式就绪门禁。
- Expected: 允许管理端补齐映射/查看阻断，但阻断未解除前不能启用依赖正式组织模型的业务写流程。禁止凭旧团队名称编造部门。
- Actual: **上轮历史**： 缺正式组织字段仍可建立新任务/申请。迁移能启动及 blocker 可见不等于业务已被阻止。
- Repair guidance: 将就绪状态纳入正式写入口，保留受权管理修复通路；完成映射、验证和约束收紧后才能解除门禁，旧页面与幂等重放也不能绕过。
- Acceptance checks: 同一 V4 副本未映射时业务写明确拒绝，管理补齐仍可用；清障后 NOT NULL/其他约束就绪且正式写恢复；新空库不回归；预检仍只读、旧日志无损合并、旧顺序/旧通知兼容不造假。
- Repair status: verified-resolved
- Repair notes: 修复：Writes.runOutcome 在幂等缓存之前、对非 /admin/ 作用域调用 OrganizationConstraints.formalWritesReady，未完成映射返回 409 ORGANIZATION_MAPPING_INCOMPLETE；管理端修复通路豁免。OrganizationConstraints 增加 mappingBlockers/formalWritesReady；AdminController 在员工/团队写事务提交后调用 tryTighten，清障后收紧 NOT NULL；同时修复 updateTeam 在 leadUserId 为空时 Map.of 抛 NPE，保证映射修复通路可用。验收：V4 快照恢复到隔离库 e13r_gate 并由 Flyway 升至 V13，seed=false；新增 check_mapping_write_gate.py：未映射时 task/home 写 409、管理端可建部门职位并映射 7 员工/3 团队、清障后约束收紧、同一任务写 201、管理通路仍可用，10/10。
- Reverification notes: 本轮 V4 预检只读，升至 V13，M 10/10：未映射时 task/home 写 409，管理员修复仍可用；先团队后员工补齐后 mappingBlockers=0、NOT NULL 收紧，task 201/home 200。原“阻断期间仍写入”已解决。另一个新副本反向顺序的恢复缺陷单列 V-009，避免与原安全门禁重复计数。旧日志 22 条保留 18 正常+4 归档。

### V-006: 管理端无法分别配置任务查看范围和派发范围

- Category: implementation
- Severity: high
- Requirement: `Organization and administration` 正文 SHALL 提供分别配置的任务查看/派发权限；design §2；tasks 2.2/2.6（DEV-002）。
- Evidence: **上轮历史（110ebe0 基线，非本轮结果）**： `admin.html:97`—99 是只读角色表，:335—339 只渲染 scopes 文本；员工维护只选固定角色。`backend/src/main/java/cn/pandora/admin/AdminController.java:84` 只有 GET roles，无 scope 定义写接口；`OrganizationService.java:576`—584 将 roleCodes 限于固定四种。`RoleCatalog.java`：executive 的 task_view/task_dispatch 均 company，manager 均 department，employee 均 self，admin 均无，合并角色各取最大仍保持两者相同。实际 GET `/api/v1/admin/organization` 的固定角色配置已记录在 `final-probes.json`，服务管理页也实际加载检查。
- Expected: 管理员通过受权管理流程能分别配置查看与派发，例如公司可见但仅本人派发；服务端候选、提交、批准、旧请求权限校验服从该配置。
- Actual: **上轮历史**： 存在两种 scope 列及不同 Access 检查函数，但管理端/API 不能产生不同的范围组合；只能直接改 SQL。现有 Access 单测手工构造“部门可见/仅本人派发”Actor，不能证明配置流程已实现。
- Repair guidance: 补齐可操作的受权独立配置与持久化途径，更新权限版本并即时重算候选/写权限；不要求特定新增 endpoint 名称。
- Acceptance checks: 无直接 SQL，在管理界面/API 配置 company-view+self-dispatch 及 department-view+self-dispatch；重新登录/刷新后保留，能看却不能派发，越权请求和权限改变前的旧页面/批准/幂等重放被拒绝；仅有管理员不能取得员工业务权。
- Repair status: verified-resolved
- Repair notes: 修复：新增 PATCH /api/v1/admin/roles/{code}/scopes（OrganizationService.updateRoleScopes），分别持久化 task_view/task_dispatch/log_read/profile_read，校验范围级别、拒绝给 admin 角色员工范围，并递增 authz_version 使旧页面、旧候选、批准与幂等回放失效；admin.html 角色表改为四个范围下拉加保存按钮，健康页展示 formalWritesReady。验收：O 新增 executive company-view+self-dispatch 配置、持久化与版本递增、配置前幂等键重放 409 AUTHORIZATION_CHANGED、候选仅本人、公司任务仍可见、越权派发 403、admin 范围 400、恢复公司派发后候选恢复；O 58/58。
- Reverification notes: 本轮 O 58/58 重跑范围配置 API、持久化/授权版本/旧幂等拒绝/候选/越权派发。另以 Chrome 实际点击 admin.html 保存 executive company-view+self-dispatch、manager department-view+self-dispatch，重载仍保留，再经页面恢复（UI 4/4）。原“无法配置”已解决；自动生效漏鉴权见独立 V-008，不能因配置通过而概括所有旧申请已安全。

### V-007: 完整日列表强制全天优先，破坏同置顶组的时间顺序

- Category: implementation
- Severity: low
- Requirement: `Calendar task views`（Pin only one's own ordering；Order visible task lanes）要求本人月格与完整日列表同置顶组按开始时间、同时间任务标识排序；task 9.4。
- Evidence: **上轮历史（110ebe0 基线，非本轮结果）**： `潘多拉-日程视图.js:52`—61 的 `dayListSort` 对所有全天任务使用排序时间 `-1`，而 `monthSortTasks` 使用实际 start。Node 读取并执行当前文件原函数（不是另写排序实现），输入同为 `pinned:false` 的前日 20:00 开始并延续到所选日 10:00 的定时任务 `earlier-timed`，及所选日 00:00 开始的全天任务 `later-all-day`。
- Expected: 同组先 `earlier-timed` 再 `later-all-day`，按实际 start；置顶仍优先，同 start 按 id 稳定排序。
- Actual: **上轮历史**： 原函数返回 `['later-all-day','earlier-timed']`；月格与当日列表采用不同顺序。
- Repair guidance: 日列表与月格使用相同的置顶/真实开始时间/稳定 ID 规则，不改变全天区或时间轴实际位置。
- Acceptance checks: 覆盖跨日定时与稍后全天混排、相同 start、不同 pin、刷新持久化及另一账号排序，完整日列表和月格一致；时间轴仍不随 pin 移位。
- Repair status: verified-resolved
- Repair notes: 修复：潘多拉-日程视图.js 的 dayListSort 与 monthSortTasks 统一为置顶优先→真实 start→id 稳定排序，去掉全天 -1 偏移，时间轴位置不变。新增 check_calendar_sort.js 直接加载实际文件函数，覆盖跨日定时与稍后全天混排、相同 start、置顶及另一账号输入；4/4，且以修复前文件运行 4/4 失败。回归：H 12/12、BH 33/33（含置顶私有性、跨日分段、全天/重叠逐项、三视口 FAB）。
- Reverification notes: 本轮 CS 4/4 读取并运行实际源码函数：原跨日 timed/all-day 反例返回 earlier-timed 在先；日列表/月格一致，同 start 按 id、pin 优先/另一账号输入均正确。H 12/12、BH 33/33 回归通过；全视口逐块点击仍按矩阵保留缺证。原排序缺陷 verified-resolved。

### V-008: 无审核人自动生效绕过权限变更后的派发校验

- Category: implementation
- Severity: high
- Requirement: `Role-scoped task creation and assignment` 正文及 Enforce dispatch independently from viewing（权限变更后的批准拒绝越权派发）；`Ordered reviewer routing and reassignment` 的无审核人/组织改派规则；design §2/§4、task 2.5。免审核人并不豁免当前业务授权。
- Evidence: `backend/src/main/java/cn/pandora/task/TaskService.java:431` 的显式批准会重新加载 applicant 并 validateAssignable；`:651` 的 refreshPendingRoutes 转入 `:694` 的 applyWithoutReviewer 后直接更新 direct 并 applyVersion，没有相同的申请人/派发鉴权。本轮 `independent-probes.json.revokedDispatchAutoApply`，task `a33cbfee-c971-4384-a4e3-f6ea6f80cb1a`、request `f2327ccc-aacf-4447-b377-b949a5ef630d`。
- Reproduction: upper 创建负责人按序为 upper+employee 的任务，保持待审，upper 为最后可用审核人/原创建者；admin 用角色范围 API 将 executive 设置为 company-view+self-dispatch（200），当前候选仅 upper；upper 用新版本请求显式 approve，返回 `403 DISPATCH_NOT_ALLOWED` 且仍待审；admin 再用最新员工 ETag 设置 upper `reviewerAvailable:false`，触发无审核人分支。
- Expected: 旧提议不能在当前申请人已无权派发给 employee 时发布；自动生效路径须服从当前派发/有效参与人/任务资格等适用规则，同时按规范保留合法组织维护与审计结果。
- Actual: 组织维护返回 200，旧申请变为 `direct`，原因“依据人管理链与原创建者均不可承接，记录原因后直接生效”；任务 `published:true`，upper 与 employee 均成为有效负责人。同一提议显式批准被拒，自动处理却绕过相同授权。
- Repair guidance: 对无审核人的自动生效重用与显式生效相同的当前申请人、负责人、父任务、专用交接等适用资格校验；不能借管理员的管理能力代替申请人的业务权。保持合法组织维护可完成，越权提议不能生效；具体无效申请处置服从现有规格。
- Acceptance checks: 本轮步骤中显式批准与自动生效均不能越权发布；覆盖范围收回、转岗、失效参与人及专用交接资格，核对原有效版/来源/历史/事件；合法未失权的无审核人路径继续成功，重跑 O/R/E。
- Repair status: pending
- Repair notes: 首次发现，尚无修复记录。
- Reverification notes: 当前新独立库真实接口已确认；探测后在一次性库恢复 reviewerAvailable 与 executive 正常范围。此缺陷与已解决的 V-003 SQL 参数错误分开编号：V-003 原先因 SQL 异常无法走到这条成功发布路径。

### V-009: V4 最后补齐团队映射后，业务写门禁仍持续关闭

- Category: implementation
- Severity: medium
- Requirement: `Organization and administration` 的独立员工/团队维护；design Migration Plan §2 的受控映射/清障后启用正式流程及 task 1.2；V-005 修复承诺的管理修复通路与完成后恢复。
- Evidence: `backend/src/main/java/cn/pandora/admin/AdminController.java:106/118/129` 仅员工 create/update/transfer 提交后触发 tightenOrganizationConstraints；`:199` 的 updateTeam 提交后未触发。`OrganizationConstraints.java:70`—82 的 formalWritesReady 还要求 mappingBlockers=0；`:99` 的 tryTighten 才收紧约束并清除映射阻断。本轮 `extra-probes.json.mappingTeamsLast`，全新隔离副本 `pandora_precheck_e13v_teamlast`（当前 jar，seed=false，V1—V13）。
- Reproduction: 经管理 API 建立真实部门/职位；先 PATCH 全部 7 员工补齐部门/职位，teamId=null（合法独立关系），全部 200；再 PATCH 全部 3 团队补齐部门，全部 200；读取结构健康并由 employee 提交明日正常本人任务。所有映射变更均走受权 API，没有 SQL 修复映射；SQL 只复核缺失计数。
- Expected: 合法补齐顺序不影响恢复结果；全部真实映射完成后自动复核、清除已解决 blocker、收紧约束并恢复正式写入，不依赖再次保存无关员工或重启。
- Actual: usersMissingDepartment=0、usersMissingPosition=0、teamsMissingDepartment=0（独立 SQL 同样为 0/0），但 mappingBlockers=2、tighteningApplied=false、formalWritesReady=false；POST task `409 ORGANIZATION_MAPPING_INCOMPLETE`。原 M 脚本先团队后员工，10/10，遗漏最后保存团队的顺序。
- Repair guidance: 所有可能完成映射的受权管理路径（含团队更新）在适当的提交后阶段触发同源、幂等的复核/收紧及 blocker 清理；保留真实缺映射时的门禁与管理修复通路，避免把 DDL 混入原业务事务。
- Acceptance checks: 两个独立 V4 副本分别员工优先/团队优先，最后一步后无需额外编辑或重启即 mappingBlockers=0、约束收紧、业务写恢复；覆盖无团队员工/空团队和新空库；未补齐时 task/home 仍 409，原预检保持只读。
- Repair status: pending
- Repair notes: 首次发现，尚无修复记录。
- Reverification notes: 已通过独立副本及真实 HTTP 确认。原 V-005“尚未补齐却允许写”已解决；本项是新增门禁的解除遗漏，作为单独修复点避免重复统计。

## Historical Traceability Cross-check

以下为本轮独立结论索引，保持原 `traceability.md` 及原始审计不变。以本次 delta 为验收准绳；旧审计“他人手机号一律不可见”“仅直属下属”等表述已被 2026-10-19 规则替代，不据旧规则制造新缺陷。`PASS` 仅指对应本轮范围与证据；有子条件缺证的行保留 UNVERIFIED，延期不折算完成率。

### DEV 35 项

| DEV | 本轮证据 | 独立结论 |
| --- | --- | --- |
| DEV-001 | O/A/BC/M；R14 | FAIL V-009（原 V-005/V-006 已解决） |
| DEV-002 | O/UI/P/AccessTest/X；R05/R14 | FAIL V-008；独立配置已通过 |
| DEV-003 | A/BA/D；R15 | PASS |
| DEV-004 | O/R/P；R17 | PASS 已执行转岗/交接 |
| DEV-005 | O/L/BL/AccessTest；R09/R10 | PASS |
| DEV-006 | R/TaskServiceTest；R16 | PASS 顺序/最高层 |
| DEV-007 | R/S；R16 | PASS 显式自审 |
| DEV-008 | R；R16 | PASS 新路线 |
| DEV-009 | R/X；R16 | FAIL V-008（原 V-003 已解决） |
| DEV-010 | R/E/X；R16 | FAIL V-008（原 V-003 已解决） |
| DEV-011 | R/S/BC；R07 | PASS |
| DEV-012 | E/S/X；R18 | FAIL V-002；三方竞争 UNVERIFIED |
| DEV-013 | R/E；R07 | PASS |
| DEV-014 | E/ReminderNodeTest；R19 | PASS |
| DEV-015 | O/E；R19 | PASS |
| DEV-016 | R/E/D；R21 | PASS 已执行历史 |
| DEV-017 | H/BH；R02 | PASS |
| DEV-018 | O/H/BH；R02 | PASS |
| DEV-019 | H/BH/T；R03 | PASS 已执行入口 |
| DEV-020 | H/BH/X；R03 | PASS（V-007 已解决；CS/H/BH） |
| DEV-021 | BH/T；R03 | PASS 已执行跨日 |
| DEV-022 | BH/T；R03 | UNVERIFIED 全部视口逐块点击 |
| DEV-023 | BH/T；R03 | PASS 浏览器手势 |
| DEV-024 | H/BH/I；R03/R11 | PASS |
| DEV-025 | L/D/BL/BC；R09 | PASS |
| DEV-026 | L/WorkspaceLogAndReportsTest；R09 | PASS |
| DEV-027 | L/BL/BC；R10 | PASS |
| DEV-028 | A/P/BL/BN/X；R12 | PASS（V-004 已解决；P/PC） |
| DEV-029 | 范围授权延期 | DEFERRED 系统推送/真机未验证 |
| DEV-030 | E/BN/X；R08 | PASS（V-001 已解决；E） |
| DEV-031 | E/BN；R20 | PASS 已读/原申请 |
| DEV-032 | E/BN/EventsRetentionTest；R20 | UNVERIFIED 179.999秒及空列表键盘子条件 |
| DEV-033 | E/BN/X；R20 | PASS（V-001 已解决；E） |
| DEV-034 | I/BC/WorkspaceAnalysisTest；R11 | PASS |
| DEV-035 | S/D/BC/严格验证/本报告 | FAIL 仍有实现偏差及缺证，不作全量通过 |

### AUD 150 项

每个历史编号保留独立行；证据使用上面的本轮运行和 R 要求矩阵，非历史 JSON。对宽泛验收条目不将某个窄正向检查概括为全范围实测。已解决的历史问题并不表示新增授权/恢复分支通过；新 V-008/V-009 按其影响的当前条目列入。

| AUD | 本轮证据/当前规则 | 独立结论 |
| --- | --- | --- |
| AUD-SCP-001 | S/BC/T；R01/R13 | PASS 当前范围声明 |
| AUD-SCP-002 | O/BC/X；R14 | PASS（V-006 已解决；O/UI） |
| AUD-SCP-003 | S/BC/T；R01/R13 | PASS 当前范围声明 |
| AUD-ORG-001 | O/M/D；R14 | FAIL V-009（旧库补齐后恢复；原 V-005 已解决） |
| AUD-ORG-002 | O/R/P/D/BC/T；R14/R16/R17 | PASS |
| AUD-ORG-003 | O/R/P/D/BC/T；R14/R16/R17 | PASS |
| AUD-ORG-004 | O/BC/X；R14 | PASS（V-006 已解决；O/UI） |
| AUD-ORG-005 | O/AccessTest/X；R14 | PASS（V-006 已解决；O/UI） |
| AUD-ORG-006 | O/R/P/D/BC/T；R14/R16/R17 | PASS |
| AUD-ORG-007 | O/R/P/D/BC/T；R14/R16/R17 | PASS |
| AUD-ORG-008 | O/R/P/D/BC/T；R14/R16/R17 | PASS |
| AUD-ORG-009 | R/T；R17 专用交接通过 | UNVERIFIED 预设交接对象的完整管理流程未独立执行 |
| AUD-ORG-010 | R/X；R16/R17 | FAIL V-008（原 V-003 已解决） |
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
| AUD-PER-009 | A/P/X；R15 以新管理链手机号规则替代旧仅本人规则 | PASS（V-004 已解决；P/PC） |
| AUD-PER-010 | S/P/R/I/E/X；R04/R20 | PASS（V-001/V-004 已解决；E/PC） |
| AUD-PER-011 | P/BL/T；R12 以新资料权∩管理链规则替代旧仅直属规则 | PASS（正常与损坏链 P/PC；V-004 已解决） |
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
| AUD-REV-002 | R/TaskServiceTest/X；R16 | FAIL V-008（自动生效重鉴权；原 V-003 已解决） |
| AUD-REV-003 | R/X；R16 | FAIL V-008（原 V-003 已解决） |
| AUD-REV-004 | R/E/TaskServiceTest/T；R16 | PASS |
| AUD-REV-005 | R/E/TaskServiceTest/T；R16 | PASS |
| AUD-REV-006 | R/E/TaskServiceTest/T；R16 | PASS |
| AUD-REV-007 | R/E/TaskServiceTest/T；R16 | PASS |
| AUD-REV-008 | R/E/X；R16 | FAIL V-008（原 V-003 已解决） |
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
| AUD-CAL-008 | H/BH/X；R03 | PASS（V-007 已解决；CS/H/BH） |
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
| AUD-ME-002 | P/BL/BN/X；R12 以新规则替代旧“无他人手机号” | PASS（V-004 已解决；PC） |
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
| AUD-NTH-005 | X；R20 | PASS（V-001 已解决；E） |
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
| A-02 | O/M/BC/X | FAIL V-009（原 V-005/V-006 已解决） |
| A-03 | O/R/AccessTest | FAIL V-008（旧申请自动生效漏重验；O/UI 配置已通过） |
| A-04 | P/L/BL/X | PASS（V-004 已解决；P/PC） |
| A-05 | O/H/BH | PASS |
| A-06 | R/TaskServiceTest/X | FAIL V-008（原 V-003 已解决） |
| A-07 | R/S | PASS |
| A-08 | R/S/E/T | UNVERIFIED 三方竞争与预设对象流程缺证 |
| A-09 | S/E/H/I/BC/T | PASS 已执行隔离矩阵 |
| A-10 | R/S/BC | PASS |
| A-11 | R/E/D/T | PASS 已执行历史 |
| A-12 | H/O/BH/T | PASS |
| A-13 | H/BH/T | PASS 已执行导航/计数 |
| A-14 | H/BH/X | PASS（V-007 已解决；CS/H/BH） |
| A-15 | BH/T | UNVERIFIED 全视口逐块点击 |
| A-16 | BH/T | UNVERIFIED 最小尺寸/置顶/长标题组合点击 |
| A-17 | L/O/BL/BC/D | PASS |
| A-18 | A/P/BL/BN/X | PASS（V-004 已解决；P/PC） |
| A-19 | E/BN/D | DEFERRED 推送；三方竞争未完整执行 |
| A-20 | E/O/D/ReminderNodeTest | PASS |
| A-21 | E/S/X | FAIL V-002；三方竞争 UNVERIFIED |
| A-22 | E/BN/EventsRetentionTest/T | UNVERIFIED 179.999秒接口边界 |
| A-23 | E/BN/X | PASS（V-001 已解决；E） |
| A-24 | I/BC/WorkspaceAnalysisTest | PASS |
| A-25 | 三视口浏览器证据仅作模拟 | DEFERRED 真机未验证 |

## Next Action

执行 `$openspec-e13-fix-change fix-pandora-formal-requirement-deviations` 修复 **V-002、V-008、V-009**；保留已解决编号与 Repair notes，在修复备注中记录实际改动/验收。随后独立 verify（含矩阵中的未验证子条件）。本报告不授权归档；修复工作流不能自行声明 PASS 或将问题标记 verified-resolved。
