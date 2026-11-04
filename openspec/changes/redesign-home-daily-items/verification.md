# Implementation Verification

- Change: `redesign-home-daily-items`
- Schema: `spec-driven`
- Verdict: **FAIL**
- Verified at: 2026-11-04T21:29:23+08:00（Asia/Shanghai）
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice`（实现与规划同一根目录）
- Verified revision: `ca88b948600559666b19d8e08050d03b3eb74642`；开始时工作区干净；本轮只更新 report/state。

## Summary

原 V-001 至 V-004 经本轮独立运行及代码审查，均标记 `verified-resolved`，保留修复方原记录。新确认 V-005：详情请求期间按 Esc 关闭日清单，迟到响应仍重新打开事项详情。关闭后响应隔离是 design Decisions 5 的明确约束，因此本轮仍为 **FAIL**，不能归档。

本轮构建/111 单元、73 API/迁移、126 专项 Chrome、员工166/管理端15/资源21、公司日历102和资源包15项检查通过。额外独立浏览器14项中13项通过、1项复现 V-005；并发公司信息上限检查通过。未修改实现、测试、规划、勾选或实施记录。

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| 当前 proposal/design/tasks/delta spec | 重新读取并核对；32 个场景；26/26 勾选仅是实施声明；相较旧快照均未变化 |
| 旧独立基线 | `8f2fd02`，2026-11-04T20:13:36+08:00；旧 state SHA-256 `d7abd41947ea213cb6e68bdb0b843f6516a6776dfc4a83834ad22d41c9f72f43`，本轮计算确认与旧报告相符 |
| 当前输入 | 脚本 inventory 392 个文件；与旧基线 scope 相同，新增1个、修改4个、删除0个 |
| 本次差异 | 新增 `backend/scripts/check_daily_items_repairs_browser.js`；修改 `check_daily_items_browser.js`、`潘多拉-交互原型.html`、`潘多拉-交互原型.js`、`潘多拉-每日事项.js`；Git diff 与快照一致 |
| 当前 state | SHA-256 `eb86cc2ba475a5e2320ef2d34b0b4aa983d60bc740f9798ec91c1403ee50d9ca`；完整 inventory 保存在 `verification-state.json` |
| 交接 | `implementation-notes.md` 仍指 dirty `bb9842f`，revision/旧检查数量过时；修复方记录在 Findings 的 Repair notes，均作为线索重新审查 |

本轮为增量复验：重验全部已修行为、每日事项全链与共用弹层影响，并补齐上轮时区、触摸、浏览器冲突及并发上限证据。重跑专项不是仅采信新增断言；另写临时探针验证规格未被现有检查证明的关闭竞态。

复用上一轮独立 `check_admin_contract.py`（40项 API/契约及43项浏览器）关于管理端公司信息顺序/员工只读的证据，以及 `check_log_backfill_entry.py`（50项）关于补写/冻结/重复正文保留的业务证据：相关后端、管理端资源、日志业务代码、检查和配置在快照比较中未变。共用员工 sheetClose 入口有改动，所以员工页面/公司日历关闭交互本轮重跑；不以未变化的旧证据代替这部分验证。不复用实施者自评结果。暂缓 change 仍按用户授权保持不变。

快照命令（前后使用同根和排除项）：

```sh
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture \
  --root /Users/watuji/MyGitDev/software_test_practice \
  --exclude 'audit/**' --exclude 'output/**' \
  --output /private/tmp/redesign-home-daily-items-reverify-before.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare \
  openspec/changes/redesign-home-daily-items/verification-state.json \
  /private/tmp/redesign-home-daily-items-reverify-before.json
# 结束 capture 使用相同参数，output 为 /private/tmp/redesign-home-daily-items-reverify-after.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare \
  /private/tmp/redesign-home-daily-items-reverify-before.json \
  /private/tmp/redesign-home-daily-items-reverify-after.json
```

旧到新 compare exit 1（上述5文件变化）；前后 compare 结果见 Checks。报告/state/handoff 由脚本自动排除；audit/output 是生成证据，显式排除；Git 忽略的 `.runtime`、构建缓存不入 inventory。业务源代码、测试、配置、依赖声明、控制性规划均覆盖。结束后复制脚本生成的最终 JSON，不手填 hash/inventory。

本轮所有新日志/截图写 `/private/tmp/redesign-home-daily-items-reverify/`；临时包装器只重定向原检查的 audit 输出，没有修改测试或业务逻辑。复现关键数值持久写在本报告，结论不依赖临时文件长期存在。

## Apply Handoff Review

| 提醒 | 本轮处置 |
| --- | --- |
| 原生 Android/old shell | proposal 排除；代码范围与旧基线相同，未构建 APK；后续仍需适配新 home/daily-items 契约。 |
| 暂缓 change 协调 | 本次未改另一 change；V29 已占用，当前下一迁移 V30；后续不能恢复首页日志/personalItems/recentLogs，共享文件仍需合并。 |
| 非生产 personal 清理 | 用户已授权；本轮重新执行 V28→V29：personal 1→0，company/task/log ID 保留；SQL 仅删除 personal。旧检查名虽写 byte-identical，实际只比较 ID，不能证明全行字节相同。 |
| 布局耦合 | 本轮 Browser/Repairs 覆盖320/390/1440及390×600；七行、FAB、导航、详情按钮、scrollTop=600恢复、日期焦点均通过。 |
| 稀疏 summary 与失败重试 | 本轮 API 全日数量/105条与 Browser 离线范围重试通过；不将失败作为确认零。 |
| 日期锚点/滚动恢复 | 本轮页面切换和四尺寸分层返回通过，V-002/V-003已解决；请求中关闭缺少使旧请求失效的机制，见 V-005。 |
| 演示数据 | DemoSeed 未变；静态确认三条事项且一条完成、不调用旧 personal。完整 check_final_demo 本轮未执行，也无上轮独立运行可复用，不把交接 PASS 当证据。 |
| 公司日历 drag-close 偶发 | 本轮独立完整进程一次 exit 0，102项通过，未复现该断言失败，无需用实施方的重跑结果替代。 |
| 修复记录 | 4条 Repair notes 原文保留，当前已独立重验；清理使用session generation，但它不随关闭递增，所以修复并未涵盖关闭生命周期，新增 V-005。 |
| 非独立判定声明 | 实施记录与修复 notes 都未作为验收权威；本轮 verdict 由规格、代码及真实运行决定。 |

## Checks

Maven 在 `backend/`，其他默认仓库根；真实 API/Chrome 仅使用本地随机临时数据库和本轮打包 JAR，无部署。

| Command or inspection | Result | Notes |
| --- | --- | --- |
| `openspec status --change redesign-home-daily-items --json`；`openspec instructions apply --change redesign-home-daily-items --json` | 完整 | spec-driven，26/26，规划齐全 |
| `openspec validate redesign-home-daily-items --type change --strict --json --no-interactive` | PASS（本轮） | 无结构问题 |
| `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package` | PASS（本轮） | 111 tests，0失败，BUILD SUCCESS |
| `python3 backend/scripts/check_daily_items.py`；实际 `python3 /private/tmp/redesign-home-daily-items-reverify/run-suite.py` | PASS（本轮） | 73 API/迁移、126 Chrome；新增 Repairs 69项均独立执行通过 |
| `python3 backend/scripts/check_fixed_web.py`；临时 `run-regressions.py check_fixed_web` | PASS（本轮） | 员工166、管理端15、served resources21；完整进程exit 0 |
| `python3 backend/scripts/check_calendar_drawer.py`；临时 `run-regressions.py check_calendar_drawer` | PASS（本轮） | 102 Chrome，完整进程exit 0；公司上下月流/任务表单/返回回归 |
| `python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /private/tmp/redesign-home-daily-items-reverify/web-resources.json` | PASS（本轮） | 15/15，指纹、加载顺序、Maven白名单与JAR字节一致 |
| `python3 /private/tmp/redesign-home-daily-items-reverify/gaps.py` | FAIL（本轮有效补充运行） | 12并发上限通过；14浏览器探针中13通过、1失败=V-005；Node探针exit1，Python包装器在JSON中记录失败，不是环境失败 |
| 上轮 Admin contract / Log backfill | PASS（复用） | 40+43 / 50；理由及范围见 Basis，不计作本轮执行数量 |
| 完整 `check_final_demo.py` | 未执行 | 仅静态验证未变的新增播种路径 |
| 前后输入快照 compare | PASS（本轮） | exit0，`changed:false, roots:[]`；392个输入文件及SHA-256前后一致 |

补充探针使用两次真实账号会话，其他会话通过真实 PATCH/DELETE 改数据；网络故障使用已启用 Network 域的 CDP offline；触摸用 CDP touchStart/Move/End；迟到响应先取得真实 GET 结果，再延迟交付给模块回调。临时探针初次初始化中“已选闰日却断言默认今天”和未启用 Network 的离线设置已修正，结论只采用修正后结果，未将这两项探针问题报告为实现缺陷。检查权限用于访问本地 MySQL/Chrome，未出现自动审批拒绝或最终环境阻塞。

## Requirement Coverage

以下全部32场景映射沿用上轮矩阵并更新本轮证据。API=本轮73项；Browser=本轮原专项57项；Repairs=本轮新增69项；Fixed/Calendar=本轮回归；Admin/Log 按 Basis 复用。标注的部分证据或残余缺口不会自动变成 PASS。

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| Five-page navigation / Navigate with an authenticated identity | HTML、PAGE_TITLE、API 身份映射；Browser 五入口；Fixed 五页/通知真实登录与权限回归 | PASS |
| Five-page navigation / Navigate across the prototype | Browser 首页/公司新文案；Fixed 公司任务权限与原详情 | PASS |
| Five-page navigation / Enter the task table as a secondary view | Fixed 表单/详情/返回；Calendar 公司页模式、日期和位置恢复，完整进程 exit 0 | PASS |
| Five-page navigation / Keep independent calendars and business text | 独立 S 日期状态，不引用任务 viewDate；Browser 首页→公司→首页锚点；diff 未全局替换业务正文 | PASS |
| Three-section home dashboard / Render three modules in their intended positions | `潘多拉-工作区接入.js` renderMap、每日事项 CSS；Browser 三卡及两列下方通栏 | PASS |
| Three-section home dashboard / Scroll home modules independently | 本轮 Browser 各窗口布局及独立横滚；补充 CDP touchStart/Move/End 真触摸，scrollLeft 102→239、整页 scrollX=0、未开弹层 | PASS |
| Three-section home dashboard / Include self-created assigned work | `WorkspaceService.homeRead` 去创建者排除；API 自建和他建有效负责混排 | PASS |
| Three-section home dashboard / Exclude work outside the board contract | API 仅创建、负责人移除、完成、未发布排除；homeRead active/current version 条件 | PASS；历史通知入口本身未因该查询扩大 |
| Three-section home dashboard / Rank a newly assigned old task | API assigned_at 倒序、同值 ID、>10、唯一性；SQL limit 10 | PASS |
| Three-section home dashboard / Show concise tasks and read only company information | Browser 窄屏标题/右侧紧急度；Admin 只读和相同管理顺序 | PASS |
| Three-section home dashboard / Reject company information above the limit | 本轮 API 第十一条拒绝；额外 fixture 先 9 条，12 个并发 POST：1×200、11×409，最终恰 10 条；Writes.run 组织行锁 | PASS |
| Three-section home dashboard / Remove only the home log presentation | `/home` 恰含 companyItems/assignedTasks/businessDate；移除卡片；Log 50 项通过 | PASS |
| Three-section home dashboard / Separate creation actions | Browser daily FAB/空日新增；Fixed/Calendar 公司页任务加号；首页无任务创建占位 | PASS |
| Independent personal daily items / Create more than ten independent items | DailyItemService 独立表；API 105 同日、task/log/notification 数量未增加 | PASS；未做所有任务/日志字段全量快照比较 |
| Independent personal daily items / Edit the date and body of a specific item | API 真实 ID、换行、日期保存；Browser 移日后旧清单与双日计数回读 | PASS |
| Independent personal daily items / Complete and reopen an item | API 布尔明确赋值、状态持久化；Browser 清单/详情完成和反向操作及标记 | PASS |
| Independent personal daily items / Keep dates stable across time zones | 本轮 API 日期/正文非法边界；CDP 切 Pacific/Kiritimati 和 America/Los_Angeles，今天默认公司 2026-11-04（Kiritimati 本地为 11-05），闰日 2024-02-29 原样详情往返 | PASS |
| Independent personal daily items / Enforce private ownership on every operation | API 同组织其他身份/上级/founder/管理员/跨公司/无效会话读写；DailyItemService org+owner 限定 | PASS |
| Independent personal daily items / Keep daily-item details minimal and safe | 本轮 Browser 纯文本/换行；Repairs 详情返回可见；esc 和 minimal 字段审查 | PASS；异步关闭生命周期另见 V-005 |
| Horizontal continuous daily-item calendar / Read the transposed calendar | Browser 周一至周日固定七行、周列、唯一日期、年月边界、无农历；独立渲染器 | PASS |
| Horizontal continuous daily-item calendar / Browse continuously across months and years | 本轮 Browser 连续跨年/闰月；Repairs 全年 12 个月前后按钮共 24 次、四窗口跨年定位、连续日期和回今天 | PASS，V-001 已解决 |
| Horizontal continuous daily-item calendar / Recover a failed range load | Browser 真离线 supplement 失败、保留内容及 retry，恢复后真实计数/零值 | PASS |
| Horizontal continuous daily-item calendar / Separate sliding from activation | 本轮 Browser 鼠标/键盘；Repairs 每步测可见焦点；独立 CDP 真触摸 120px 横滑不激活，后续普通 touch tap 打开正确日期 | PASS，V-003 已解决；未验实体设备惯性参数 |
| Daily-item status count markers / Render zero through saturated counts | API 0/1/2/3/4/5/7/105；Browser 4/7/10/13/16px 等高宽度、零日无点；105 条完整分页 | PASS |
| Daily-item status count markers / Show mixed and completed-only days | API mixed、all-done 汇总；Browser 蓝灰并列、准确 aria；marksHTML 条件渲染 | PASS |
| Daily-item status count markers / Update both dates after a move or deletion | API summary；Browser 完成/取消、移动、删除后回读双日 | PASS |
| Daily-item lists details and reliable editing / Open an empty day and create with the floating button | Browser 空态→日期默认→保存真实项→列表/标记；FAB 与公司今天状态 | PASS |
| Daily-item lists details and reliable editing / Read every item and return through the layers | 本轮 Browser 50→105 无重复；Repairs 四窗口详情可见返回、scrollTop=600 恢复和行焦点、Esc/取消编辑/取消删除/移日后原清单和关闭后日历锚点 | PASS（已加载详情逐层返回），V-002 已解决；加载中关闭另见 V-005 |
| Daily-item lists details and reliable editing / Edit and delete only the selected item | 本轮 API/Browser/Repairs 真实 ID、移日、确认/取消删除、双日计数和原清单非零滚动恢复 | PASS |
| Daily-item lists details and reliable editing / Preserve drafts and reject stale versions | 本轮 API 428/412/幂等重放，Browser 离线创建重试；独立双真实会话修改后 412 保留本地草稿且重新打开读新版本，另一会话删除后仍为 edit 且不新增；完成失败保留 false，联网重试仅增一版 | PASS（上述边界）；写成功后回读失败、真实响应丢失仍缺专项故障注入 |
| Daily-item lists details and reliable editing / Isolate sessions and out-of-order responses | 本轮 Repairs 主动退出/真实 401/跨组织切换即清缓存草稿；真实 list/detail/summary 响应延迟至清理后释放仍无旧状态；同会话 Esc 关闭后迟到 detail 重开弹层 | **FAIL V-005**（design 的关闭后响应约束）；V-004 会话清理已解决；快速切日和写后旧 summary 倒灌未专门注入 |
| Daily-item lists details and reliable editing / Keep controls usable on compact screens | 本轮 Browser + Repairs 320/390/1440/390×600 七行/FAB/导航/详情返回/焦点，每步可见性测量 | PASS（布局/已加载层级），V-002/V-003 已解决；加载中 Esc 关闭见 V-005 |
| REMOVED Four-quadrant dashboard / 替换及迁移边界 | 旧卡片和 personal 写入口退役 410；API home 三字段；V29 仅清理 personal；新三模块承接 | PASS；不以被删除的“个人项十条/首页日志窗口”验收 |
| Design / 独立模型、分页汇总、写入事务及资源交付 | DailyItemService、V29、Writes.run、If-Match、无 task/log FK；summary ≤93 天、列表 ≤100；资源 15/15 | PASS（已执行边界）；竞争时分页快照/持续并发增删未做压力验证 |
| Proposal / 员工 Web+共用后端、无部署、原生后续 | 提交文件范围、构建和资源映射；无 Android 改动/构建、无部署动作 | 符合范围 |

## Findings

### V-001: 上一月和下一月跳到错误月份

- Category: implementation
- Severity: medium
- Requirement: Horizontal continuous daily-item calendar；design Decisions 4。
- Repair status: verified-resolved
- Repair notes: 修复 `潘多拉-每日事项.js` 月份参数偏移、目标周块定位及宽屏滚动钳制；同步HTML缓存指纹。新增 `backend/scripts/check_daily_items_repairs_browser.js`，接入现有浏览器专项，覆盖全年12个月前后跳转、跨年、320/390/1440及短屏、横滑连续性和回今天。`python3 /private/tmp/redesign-home-daily-items-fix/run-suite.py`（运行原 check_daily_items.py，仅重定向输出）最终73项API/迁移及126项浏览器检查通过，新增69项回归；`python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /private/tmp/redesign-home-daily-items-fix/web-resources.json` 15/15通过。证据位于 `/private/tmp/redesign-home-daily-items-fix/redesign-home-daily-items/daily-items-browser.json`。
- Reverification notes: 本轮在 `ca88b94` 的真实打包服务独立重跑。月份偏移及目标周块/宽屏定位修复；本轮真实点击2026年全部12个月的前后按钮、跨年及四种窗口均正确，横滑连续、回今天可见。 证据：当前 Repairs检查及代码diff；未复用修复方自评 PASS。

### V-002: 详情缺少可见返回清单入口，返回后丢失清单滚动位置

- Category: implementation
- Severity: high
- Requirement: Read every item and return through the layers；design Decisions 5。
- Repair status: verified-resolved
- Repair notes: `潘多拉-每日事项.js` 提供详情/编辑/确认返回入口，进入详情前捕获实际清单位置及触发行，各层统一恢复；关闭时恢复可见日期锚点。`潘多拉-交互原型.js` 关闭按钮通过当前 closeSheet 执行，避免绕过模块恢复；更新HTML指纹。新增专项覆盖四种窗口尺寸、scrollTop=600返回及行焦点、编辑和删除确认取消、Esc、移日后原清单位置与双日计数、按钮和遮罩关闭。`python3 /private/tmp/redesign-home-daily-items-fix/run-suite.py` 最终73项API/迁移、126项浏览器通过；`python3 /private/tmp/redesign-home-daily-items-fix/run-regressions.py check_fixed_web` 员工166、管理端15、服务资源21项通过；同包装器 `check_calendar_drawer` 最终102项通过。公司日历首次手柄拖动断言失败，另一次因端口18193占用未执行，释放端口后完整重跑通过，未修改相关代码/断言。日志：`/private/tmp/redesign-home-daily-items-fix/check_fixed_web-final.log`、`check_calendar_drawer-final.log`。
- Reverification notes: 本轮在 `ca88b94` 的真实打包服务独立重跑。首次详情返回按钮四窗口可见；scrollTop=600返回仍为600且恢复触发行焦点；编辑/删除取消、移日后原清单、Esc、遮罩与关闭后日期锚点均通过。加载中关闭由新 V-005 单列。 证据：当前 Repairs检查及代码diff；未复用修复方自评 PASS。

### V-003: 键盘移动到已挂载但不可见的日期时不滚动日历

- Category: implementation
- Severity: medium
- Requirement: Separate sliding from activation；Keep controls usable on compact screens。
- Repair status: verified-resolved
- Repair notes: `潘多拉-每日事项.js` 每次聚焦按目标格与窗口边界最小横滚，更新锚点并使旧异步月份定位失效；隐藏首页不改写浏览状态。更新HTML指纹，新增浏览器回归逐步测量焦点可见性，覆盖左右边界、跨月/年、前插与未挂载日期、远月Home、Enter/Space及关闭后恢复。`python3 /private/tmp/redesign-home-daily-items-fix/run-suite.py` 126项浏览器检查通过；公司日历102项及员工166项最终回归通过。JS语法及 `git diff --check` 通过；`mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package` 111项测试通过，最终静态资源重新打包并通过15项资源检查。证据：`/private/tmp/redesign-home-daily-items-fix/redesign-home-daily-items/daily-items-browser.json`、`/private/tmp/redesign-home-daily-items-fix/maven.log`。
- Reverification notes: 本轮在 `ca88b94` 的真实打包服务独立重跑。每步比较焦点格与日历窗口，ArrowDown18、ArrowUp40、左右各8步及远月Home、Enter/Space、跨月/年和关闭后可见焦点均通过；无整页横溢。 证据：当前 Repairs检查及代码diff；未复用修复方自评 PASS。

### V-004: 退出登录后仍保留每日事项私有缓存和编辑草稿

- Category: implementation
- Severity: medium
- Requirement: Isolate sessions and out-of-order responses；design Decisions 5的会话清理。
- Repair status: verified-resolved
- Repair notes: `潘多拉-每日事项.js` 注册 `P.sessionReset`，立即清除账号、日历/锚点、清单/汇总、详情、草稿版本、焦点引用及滚动计时器；新增会话generation使迟到清单/详情和定位回调失效，汇总继续使用单调查询token。同步HTML指纹并新增真实认证回归：有缓存及草稿时退出、撤销服务端会话触发401、切换组织账号；分别延迟真实list/detail/summary响应至清理或新登录后释放，确认旧状态不复活。`python3 /private/tmp/redesign-home-daily-items-fix/run-suite.py` 最终73项API/迁移和126项浏览器通过；原有同账号切页锚点恢复及第二员工零计数检查同时通过。证据：`/private/tmp/redesign-home-daily-items-fix/redesign-home-daily-items/daily-items-browser.json`。
- Reverification notes: 本轮在 `ca88b94` 的真实打包服务独立重跑。主动退出、服务端撤销后真实401、跨组织登录均立即得到lists=0、summaries=0、blocks=0、account/organization/detail/draft/selected/anchor=null、epoch=-1、stack=0。延迟真实list/detail/summary后释放，旧状态不复活；普通同账号切页锚点保留。 证据：当前 Repairs检查及代码diff；未复用修复方自评 PASS。

### V-005: 关闭日清单后，迟到的详情响应重新打开弹层

- Category: implementation
- Severity: medium
- Requirement: `Daily-item lists details and reliable editing` 支持 Esc/关闭并恢复日历与焦点；design Decisions 5 明确“请求序号隔离快速切日、滚动补载及关闭弹层后的响应”。
- Evidence: `潘多拉-每日事项.js:603`–610 的 openDetail 在 await GET 后只检查会话 generation，随后无条件 openSheet；`:824` 的 closeSheet 清空详情/草稿/栈但没有使该查询失效。`潘多拉-交互原型.js:2717` 的 Esc 允许在请求未结束时关闭当前 list。真实 fixture 18196：GET 返回的数据被探针暂扣，在清单上按 Esc，观察 `{hidden:true, stack:[]}`；释放后观察 `{hidden:false, stack:["detail"], title:"每日事项详情"}`，同账号会话未变化。
- Expected: 用户关闭当前清单后，属于已关闭层级的详情响应被丢弃；保持日历可见及焦点恢复，不重新打开弹层。
- Actual: 弹层在用户退出后重新出现，且栈中仅有detail，没有原始list作为返回目标。原4个修复没有覆盖这种同会话关闭竞态。
- Reproduction: 员工登录→打开有事项日清单→慢速网络下点击事项正文→详情GET尚未完成时按Esc关闭清单→等待响应。无需换账号或写入。
- Deterministic reproduction: 在已加载清单的浏览器控制台保存 `const request = Pandora.request`，包装 request 使 `/daily-items/<被点ID>` 的真实GET结果在一个可手动resolve的Promise上等待；点击该事项，等待Promise挂起；发送Escape并检查 `overlayEl.hidden===true && sheetStack.length===0`；恢复原request并resolve，实际弹层重新出现。探针不伪造返回值，request及认证请求均真实执行。
- Repair guidance: 将打开清单/详情的请求绑定到当前弹层或查询生命周期；关闭/返回/更换来源时使旧请求失效，回调既验证会话也验证来源仍有效。不要用清空同账号全部日历缓存代替弹层取消。
- Acceptance checks: 用可控延迟GET分别在详情请求中Esc关闭清单、关闭/返回后切页或打开其他日期，再释放旧结果，均不得重开旧详情或覆盖新清单；正常详情→返回、calendar锚点/焦点与V-004会话隔离继续通过。复验现有126项专项和共用弹层回归。
- Repair status: addressed-awaiting-verification
- Repair notes: 已用真实GET延迟复现 Esc 关闭后栈从空变为仅detail；另复现取消首次清单读取后重新打开同日仍显示加载态。修改 `潘多拉-每日事项.js`：清单/详情查询同时绑定来源弹层、主页面及会话generation，关闭、返回、替换弹层或切页时作废旧界面回调；读取使用 P.request 的加载提示，使关闭/返回及选择新日期可用，写入仍沿用原命令锁；同日重新打开空清单发起新读取并以列表token隔离旧结果，保留同账号日历缓存与锚点。更新 `潘多拉-交互原型.html` 指纹，新增 `backend/scripts/check_daily_items_lifecycle_browser.js` 并接入 `check_daily_items_browser.js`，14项新回归覆盖Esc/关闭按钮/遮罩/返回、切页往返、新日期及新表单、取消初始清单、同日重开、正常详情返回、锚点与焦点恢复。`python3 /private/tmp/redesign-home-daily-items-fix-v005/run-suite.py`（原 check_daily_items.py，仅重定向输出）最终73项API/迁移和140项浏览器检查全部通过，包含原126项与V-004会话隔离；同目录 `run-regressions.py check_fixed_web` 员工166、管理端15、服务资源21项通过，`run-regressions.py check_calendar_drawer` 102项通过，最终进程均exit0。`mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 -DskipTests package` 成功；`check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /private/tmp/redesign-home-daily-items-fix-v005/web-resources.json` 15/15通过；JS语法与 `git diff --check` 通过。本轮未修改Java或重跑Maven单元测试。证据：`/private/tmp/redesign-home-daily-items-fix-v005/redesign-home-daily-items/daily-items-browser.json`、`daily-items-run.json`及该临时根目录下最终回归日志。
- Reverification notes: 独立补充14项检查的唯一行为失败；输出同时保存关闭前后栈和hidden值。现有Repairs只延迟到会话重置后释放，没有覆盖同会话关闭。

## Next Action

运行 `$openspec-e13-fix-change redesign-home-daily-items` 修复 V-005，再执行独立 verify；本轮不修实现、不归档。后续复验保留已解决ID和修复记录，重点检查关闭/返回/新日期的迟到响应及共用弹层回归。仍未专门注入快速切日、写后旧summary倒灌、写成功后回读失败与真实响应丢失；分页持续并发增删及完整DemoSeed运行也只有部分证据，不能在未来PASS时沿用为已覆盖。
