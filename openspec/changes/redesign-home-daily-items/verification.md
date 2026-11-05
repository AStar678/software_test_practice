# Implementation Verification

- Change: `redesign-home-daily-items`
- Schema: `spec-driven`
- Verdict: **FAIL**
- Verified at: 2026-11-04T22:18:05+08:00（Asia/Shanghai）
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice`（同根规划与实现）
- Verified revision: `d5d332f47f14abe66be70d58fa7d4d8a54e3998a`；开始时工作区干净；验证仅更新report/state。

## Summary

V-001至V-005均已独立复验为 `verified-resolved`，全部修复记录原文保留。新增V-006：同日60条，读首50条后另一会话删除首屏一条，再加载后页，UI显示59条且无“加载更多”，却缺少1条仍存在事项，并残留1条已删事项。这违反design Decisions 3明确的并发分页回读要求，因此仍为 **FAIL**，不能归档。

本轮73项API/迁移、140项专项Chrome、员工166/管理端15/served resources21、资源包15、演示初始化55项及其完整性18项通过。独立补充21项浏览器检查20通过、1失败=V-006；并发公司信息上限通过。公司日历重跑情况见Checks。Java未变化，本轮重新打包静态资源，复用上一轮独立111单元测试。没有修改实现、检查代码、规划、任务勾选或实施记录。

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| 当前proposal/design/tasks/delta spec | 重新读取；全部32场景沿用并更新矩阵；内容相较旧快照不变；26/26仅为实施声明 |
| 上轮独立基线 | `ca88b94`，2026-11-04T21:29:23+08:00；旧state SHA-256 `eb86cc2ba475a5e2320ef2d34b0b4aa983d60bc740f9798ec91c1403ee50d9ca`，本轮实际计算与旧报告相符 |
| 当前输入 | 393文件，scope与上轮一致；新增1、修改3、删除0 |
| 输入差异 | 新增`backend/scripts/check_daily_items_lifecycle_browser.js`；修改`check_daily_items_browser.js`、`潘多拉-交互原型.html`、`潘多拉-每日事项.js`；Git diff和快照一致 |
| 当前state | SHA-256 `31aa52ca2715d0968d23f8219a9b1158785d7401dcfb772be440e9025e11f915`；完整输入清单保存在`verification-state.json` |
| 交接 | `implementation-notes.md`仍写dirty `bb9842f`和旧检查数量，元信息过时；读取映射和每条提醒，修复记录见Findings，仅用作线索 |

本轮增量范围包括V-005和新引入的共用open/replace/back/close/setPage覆盖。重跑整个每日事项专项、员工页面和公司日历，独立重放原V-005探针；进一步执行上轮明确未覆盖的快速切日、写后旧summary、写成功但回读失败、保存响应丢失、分页中另一会话删除和完整DemoSeed。未将修复方自评PASS当独立证据，也未将上轮未知项直接改为通过。

复用当前输入未影响的独立证据：上一轮`ca88b94`的Maven111测试（Java源/测试/依赖/构建配置未变），首轮`8f2fd02`的Admin contract40+43项及Log backfill50项中公司信息顺序/只读、日志补写/冻结/重复正文业务。相关管理端资源、后端和检查完全未变。员工弹层和页面切换本轮受影响，已重跑，未仅靠复用。另一未归档change仍按用户此前指示暂缓，本轮未编辑。

快照命令：

```sh
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture \
  --root /Users/watuji/MyGitDev/software_test_practice \
  --exclude 'audit/**' --exclude 'output/**' \
  --output /private/tmp/redesign-home-daily-items-v3-before.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare \
  openspec/changes/redesign-home-daily-items/verification-state.json \
  /private/tmp/redesign-home-daily-items-v3-before.json
# 结束时同参数capture到 /private/tmp/redesign-home-daily-items-v3-after.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare \
  /private/tmp/redesign-home-daily-items-v3-before.json \
  /private/tmp/redesign-home-daily-items-v3-after.json
```

旧→新compare exit1（上述4文件）；前后比较结果见Checks。audit/output是生成证据显式排除，report/state/handoff由脚本自动排除；Git忽略的runtime/build缓存不入清单。源代码、测试、依赖/配置、规划均覆盖。最终复制脚本生成的快照，不手填hash或清单。新的运行报告/截图只写`/private/tmp/redesign-home-daily-items-v3/`；包装器仅重定向原检查输出。关键观测和复现保存在本文，不依赖临时文件长久存在。

## Apply Handoff Review

| 提醒 | 本轮处置 |
| --- | --- |
| Native Android/旧shell | 与proposal排除范围一致；无原生改动或APK构建，仍需后续适配新home/daily-items契约。 |
| 暂缓change协调 | 本轮未改；V29已占用，下一号当前V30；后续合并不得恢复personalItems/recentLogs/首页日志，并保留每日事项独立契约。 |
| 仅清理非生产personal | 用户已授权；本轮API套件再跑V28→V29，personal1→0，company/task/log ID保留；SQL静态只删personal。脚本旧名“byte-identical”只比ID，不声称全行字节证据。 |
| 布局耦合 | 本轮140项含320/390/1440及390×600七行、FAB、导航、详情返回、scrollTop600和焦点；未改变CSS。 |
| 稀疏summary与失败 | 本轮真离线补载重试通过；额外保存后列表/summary故障保留“已保存”与刷新；旧summary晚到不覆盖新3/0。 |
| 锚点/清单恢复 | V-002/V-003/V-005本轮回归通过；每页查询绑定来源，退出/关闭/切页/新表单取消旧回调；并发分页是另一独立问题V-006。 |
| DemoSeed | 本轮首次独立完整check_final_demo：55项，另完整性18项通过。真实启动/重复初始化/重启均成功；三条每日事项且一条完成由未变的播种代码确认，未恢复旧personal写入。 |
| 公司日历drag-close偶发 | 本轮第一次恰在“dragging the sheet handle down closes it”失败；依交接仅重跑一次，完整102项通过、进程exit0。保留首次失败事实，未改代码或断言。 |
| 修复记录 | 5条Repair notes原文保留；V-005在本轮真实GET迟到复现及Lifecycle14项中均解决，原4项亦随140项重验。 |
| 非独立声明 | 实施记录及修复方运行仅作定位，不替代本轮结论。 |

## Checks

默认仓库根，Maven在backend；本轮使用重建JAR和真实认证、本地随机临时数据库，无生产或部署动作。

| Command or inspection | Result | Notes |
| --- | --- | --- |
| OpenSpec status/instructions apply（change=redesign-home-daily-items） | 完整（本轮） | spec-driven，26/26，规划齐全 |
| `openspec validate redesign-home-daily-items --type change --strict --json --no-interactive` | PASS（本轮） | 无结构问题 |
| `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 -DskipTests package` | PASS（本轮） | 仅重新打包；不声称本轮重跑单元 |
| Maven `test package` 111项 | PASS（复用） | 上轮独立结果；Java/测试/依赖/配置未变 |
| `python3 backend/scripts/check_daily_items.py`；实际临时`run-suite.py` | PASS（本轮） | 73 API/迁移+140 Chrome=原57+Repairs69+Lifecycle14 |
| `check_fixed_web.py`；临时`run-regressions.py check_fixed_web` | PASS（本轮） | 员工166、管理端15、served resources21；完整exit0 |
| `check_calendar_drawer.py`；临时`run-regressions.py check_calendar_drawer` | PASS（本轮重跑） | 首次drag-close断言失败；按提醒完整重跑一次102项通过、exit0 |
| `python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /private/tmp/redesign-home-daily-items-v3/web-resources.json` | PASS（本轮） | 15/15，指纹/顺序/白名单/JAR字节 |
| `python3 /private/tmp/redesign-home-daily-items-v3/run-demo.py`（仅重定向官方check_final_demo.OUTPUT） | PASS（本轮） | 完整55项，数据库完整性18项；一次性独有库最终清理 |
| `python3 /private/tmp/redesign-home-daily-items-v3/gaps.py` | FAIL（本轮） | 独立21浏览器项：20通过、1失败=V-006；并发公司信息检查通过。Node exit1，Python另记录false聚合，不是环境阻塞 |
| Admin contract / Log backfill | PASS（复用） | 40+43 / 50；范围和适用性见Basis |
| 前后输入快照 | PASS（本轮） | exit0，`changed:false, roots:[]`；393个输入文件及SHA-256前后一致 |

有效补充探针使用两个真正登录的同账号会话、真实API响应、CDP触摸/时区/离线。延迟响应先取得真实GET数据再暂停交付回调；丢失保存响应先执行真实POST，再抛错并以同草稿重试；回读故障仅拦截保存后的GET，不拦截POST。初次临时探针错误地等待新增后留在清单，已改为接受关闭弹层并核对保存结果和刷新入口；未把该等待条件当实现缺陷。授权执行用于访问本地MySQL/Chrome，无自动审批拒绝或最终环境阻塞。

## Requirement Coverage

全部32场景保留映射。API=本轮73；Browser/Repairs/Lifecycle=本轮140；Fixed=本轮；Calendar最终结果见Checks；Admin/Log按Basis复用。额外探针本轮覆盖时区、触摸、冲突、并发上限及上轮剩余故障/乱序/分页子情形。

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
| Independent personal daily items / Keep daily-item details minimal and safe | Browser纯文本/换行和字段审查；Repairs详情返回；Lifecycle加载中关闭不重开 | PASS，V-005已解决 |
| Horizontal continuous daily-item calendar / Read the transposed calendar | Browser 周一至周日固定七行、周列、唯一日期、年月边界、无农历；独立渲染器 | PASS |
| Horizontal continuous daily-item calendar / Browse continuously across months and years | 本轮 Browser 连续跨年/闰月；Repairs 全年 12 个月前后按钮共 24 次、四窗口跨年定位、连续日期和回今天 | PASS，V-001 已解决 |
| Horizontal continuous daily-item calendar / Recover a failed range load | Browser 真离线 supplement 失败、保留内容及 retry，恢复后真实计数/零值 | PASS |
| Horizontal continuous daily-item calendar / Separate sliding from activation | 本轮 Browser 鼠标/键盘；Repairs 每步测可见焦点；独立 CDP 真触摸 120px 横滑不激活，后续普通 touch tap 打开正确日期 | PASS，V-003 已解决；未验实体设备惯性参数 |
| Daily-item status count markers / Render zero through saturated counts | API 0/1/2/3/4/5/7/105；Browser 4/7/10/13/16px 等高宽度、零日无点；105 条完整分页 | PASS |
| Daily-item status count markers / Show mixed and completed-only days | API mixed、all-done 汇总；Browser 蓝灰并列、准确 aria；marksHTML 条件渲染 | PASS |
| Daily-item status count markers / Update both dates after a move or deletion | API summary；Browser 完成/取消、移动、删除后回读双日 | PASS |
| Daily-item lists details and reliable editing / Open an empty day and create with the floating button | Browser 空态→日期默认→保存真实项→列表/标记；FAB 与公司今天状态 | PASS |
| Daily-item lists details and reliable editing / Read every item and return through the layers | Browser无并发时50→105、Repairs滚动600及焦点恢复、Lifecycle迟到读取关闭通过；独立60条分页中另一会话删除首屏项后漏1条且残留已删项 | **FAIL V-006**；已加载详情正常返回和V-002/V-005修复通过 |
| Daily-item lists details and reliable editing / Edit and delete only the selected item | 本轮 API/Browser/Repairs 真实 ID、移日、确认/取消删除、双日计数和原清单非零滚动恢复 | PASS |
| Daily-item lists details and reliable editing / Preserve drafts and reject stale versions | API版本/幂等和Browser断网重试；独立双会话412/删除仍保留edit草稿；真实POST已提交后丢弃响应，再保存同一草稿仅1条；写成功但列表/汇总读取失败明确“已保存”并给刷新，重读无重复 | PASS |
| Daily-item lists details and reliable editing / Isolate sessions and out-of-order responses | Repairs退出/真实401/跨组织及迟到list/detail/summary隔离；Lifecycle14项；独立持有日期A真实响应，先打开B再放A仍显示B；写后释放旧summary前后均open=3/completed=0 | PASS，V-004/V-005已解决 |
| Daily-item lists details and reliable editing / Keep controls usable on compact screens | 本轮Browser/Repairs四尺寸七行/FAB/导航/返回/每步可见焦点；Lifecycle Esc/关闭/遮罩恢复触发焦点 | PASS，V-002/V-003/V-005已解决 |
| REMOVED Four-quadrant dashboard / 替换及迁移边界 | 旧卡片和 personal 写入口退役 410；API home 三字段；V29 仅清理 personal；新三模块承接 | PASS；不以被删除的“个人项十条/首页日志窗口”验收 |
| Design / 独立模型、分页汇总、写入事务及资源交付 | 独立DailyItemService/V29/Writes/If-Match/全日summary和资源检查通过；loadMore沿用旧offset直接追加，未在并发删除后校正 | **FAIL V-006**（分页并发协调）；单次list/total REPEATABLE_READ实现符合 |
| Proposal / 员工 Web+共用后端、无部署、原生后续 | 提交文件范围、构建和资源映射；无 Android 改动/构建、无部署动作 | 符合范围 |

## Findings

### V-001: 上一月和下一月跳到错误月份

- Category: implementation
- Severity: medium
- Requirement: Horizontal continuous daily-item calendar；design Decisions 4。
- Repair status: verified-resolved
- Repair notes: 修复 `潘多拉-每日事项.js` 月份参数偏移、目标周块定位及宽屏滚动钳制；同步HTML缓存指纹。新增 `backend/scripts/check_daily_items_repairs_browser.js`，接入现有浏览器专项，覆盖全年12个月前后跳转、跨年、320/390/1440及短屏、横滑连续性和回今天。`python3 /private/tmp/redesign-home-daily-items-fix/run-suite.py`（运行原 check_daily_items.py，仅重定向输出）最终73项API/迁移及126项浏览器检查通过，新增69项回归；`python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /private/tmp/redesign-home-daily-items-fix/web-resources.json` 15/15通过。证据位于 `/private/tmp/redesign-home-daily-items-fix/redesign-home-daily-items/daily-items-browser.json`。
- Reverification notes: 此前在 `ca88b94` 独立确认；本轮在 `d5d332f` 的140项真实打包服务检查中再次通过。月份偏移及目标周块/宽屏定位修复；本轮真实点击2026年全部12个月的前后按钮、跨年及四种窗口均正确，横滑连续、回今天可见。 证据：当前 Repairs检查及代码diff；未复用修复方自评 PASS。

### V-002: 详情缺少可见返回清单入口，返回后丢失清单滚动位置

- Category: implementation
- Severity: high
- Requirement: Read every item and return through the layers；design Decisions 5。
- Repair status: verified-resolved
- Repair notes: `潘多拉-每日事项.js` 提供详情/编辑/确认返回入口，进入详情前捕获实际清单位置及触发行，各层统一恢复；关闭时恢复可见日期锚点。`潘多拉-交互原型.js` 关闭按钮通过当前 closeSheet 执行，避免绕过模块恢复；更新HTML指纹。新增专项覆盖四种窗口尺寸、scrollTop=600返回及行焦点、编辑和删除确认取消、Esc、移日后原清单位置与双日计数、按钮和遮罩关闭。`python3 /private/tmp/redesign-home-daily-items-fix/run-suite.py` 最终73项API/迁移、126项浏览器通过；`python3 /private/tmp/redesign-home-daily-items-fix/run-regressions.py check_fixed_web` 员工166、管理端15、服务资源21项通过；同包装器 `check_calendar_drawer` 最终102项通过。公司日历首次手柄拖动断言失败，另一次因端口18193占用未执行，释放端口后完整重跑通过，未修改相关代码/断言。日志：`/private/tmp/redesign-home-daily-items-fix/check_fixed_web-final.log`、`check_calendar_drawer-final.log`。
- Reverification notes: 此前在 `ca88b94` 独立确认；本轮在 `d5d332f` 的140项真实打包服务检查中再次通过。首次详情返回按钮四窗口可见；scrollTop=600返回仍为600且恢复触发行焦点；编辑/删除取消、移日后原清单、Esc、遮罩与关闭后日期锚点均通过。加载中关闭另见已解决V-005。 证据：当前 Repairs检查及代码diff；未复用修复方自评 PASS。

### V-003: 键盘移动到已挂载但不可见的日期时不滚动日历

- Category: implementation
- Severity: medium
- Requirement: Separate sliding from activation；Keep controls usable on compact screens。
- Repair status: verified-resolved
- Repair notes: `潘多拉-每日事项.js` 每次聚焦按目标格与窗口边界最小横滚，更新锚点并使旧异步月份定位失效；隐藏首页不改写浏览状态。更新HTML指纹，新增浏览器回归逐步测量焦点可见性，覆盖左右边界、跨月/年、前插与未挂载日期、远月Home、Enter/Space及关闭后恢复。`python3 /private/tmp/redesign-home-daily-items-fix/run-suite.py` 126项浏览器检查通过；公司日历102项及员工166项最终回归通过。JS语法及 `git diff --check` 通过；`mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package` 111项测试通过，最终静态资源重新打包并通过15项资源检查。证据：`/private/tmp/redesign-home-daily-items-fix/redesign-home-daily-items/daily-items-browser.json`、`/private/tmp/redesign-home-daily-items-fix/maven.log`。
- Reverification notes: 此前在 `ca88b94` 独立确认；本轮在 `d5d332f` 的140项真实打包服务检查中再次通过。每步比较焦点格与日历窗口，ArrowDown18、ArrowUp40、左右各8步及远月Home、Enter/Space、跨月/年和关闭后可见焦点均通过；无整页横溢。 证据：当前 Repairs检查及代码diff；未复用修复方自评 PASS。

### V-004: 退出登录后仍保留每日事项私有缓存和编辑草稿

- Category: implementation
- Severity: medium
- Requirement: Isolate sessions and out-of-order responses；design Decisions 5的会话清理。
- Repair status: verified-resolved
- Repair notes: `潘多拉-每日事项.js` 注册 `P.sessionReset`，立即清除账号、日历/锚点、清单/汇总、详情、草稿版本、焦点引用及滚动计时器；新增会话generation使迟到清单/详情和定位回调失效，汇总继续使用单调查询token。同步HTML指纹并新增真实认证回归：有缓存及草稿时退出、撤销服务端会话触发401、切换组织账号；分别延迟真实list/detail/summary响应至清理或新登录后释放，确认旧状态不复活。`python3 /private/tmp/redesign-home-daily-items-fix/run-suite.py` 最终73项API/迁移和126项浏览器通过；原有同账号切页锚点恢复及第二员工零计数检查同时通过。证据：`/private/tmp/redesign-home-daily-items-fix/redesign-home-daily-items/daily-items-browser.json`。
- Reverification notes: 此前在 `ca88b94` 独立确认；本轮在 `d5d332f` 的140项真实打包服务检查中再次通过。主动退出、服务端撤销后真实401、跨组织登录均立即得到lists=0、summaries=0、blocks=0、account/organization/detail/draft/selected/anchor=null、epoch=-1、stack=0。延迟真实list/detail/summary后释放，旧状态不复活；普通同账号切页锚点保留。 证据：当前 Repairs检查及代码diff；未复用修复方自评 PASS。

### V-005: 关闭日清单后，迟到的详情响应重新打开弹层

- Category: implementation
- Severity: medium
- Requirement: Daily-item lists details and reliable editing；design Decisions5的关闭后响应隔离。
- Repair status: verified-resolved
- Repair notes: 已用真实GET延迟复现 Esc 关闭后栈从空变为仅detail；另复现取消首次清单读取后重新打开同日仍显示加载态。修改 `潘多拉-每日事项.js`：清单/详情查询同时绑定来源弹层、主页面及会话generation，关闭、返回、替换弹层或切页时作废旧界面回调；读取使用 P.request 的加载提示，使关闭/返回及选择新日期可用，写入仍沿用原命令锁；同日重新打开空清单发起新读取并以列表token隔离旧结果，保留同账号日历缓存与锚点。更新 `潘多拉-交互原型.html` 指纹，新增 `backend/scripts/check_daily_items_lifecycle_browser.js` 并接入 `check_daily_items_browser.js`，14项新回归覆盖Esc/关闭按钮/遮罩/返回、切页往返、新日期及新表单、取消初始清单、同日重开、正常详情返回、锚点与焦点恢复。`python3 /private/tmp/redesign-home-daily-items-fix-v005/run-suite.py`（原 check_daily_items.py，仅重定向输出）最终73项API/迁移和140项浏览器检查全部通过，包含原126项与V-004会话隔离；同目录 `run-regressions.py check_fixed_web` 员工166、管理端15、服务资源21项通过，`run-regressions.py check_calendar_drawer` 102项通过，最终进程均exit0。`mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 -DskipTests package` 成功；`check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /private/tmp/redesign-home-daily-items-fix-v005/web-resources.json` 15/15通过；JS语法与 `git diff --check` 通过。本轮未修改Java或重跑Maven单元测试。证据：`/private/tmp/redesign-home-daily-items-fix-v005/redesign-home-daily-items/daily-items-browser.json`、`daily-items-run.json`及该临时根目录下最终回归日志。
- Reverification notes: 本轮`d5d332f`独立执行140项专项及旧复现。持有真实详情GET后按Esc，关闭时hidden=true/stack=[]；释放后仍hidden=true/stack=[]。Lifecycle14项还验证关闭按钮/遮罩/返回/切页往返/新日期/新表单、初始列表取消、同日重开、正常详情返回与焦点。独立快速切日A迟到不覆盖B亦通过；缓存和锚点保留，未采用修复方自评作为结论。

### V-006: 分页期间另一会话删除首屏项，后页漏项且残留已删事项

- Category: implementation
- Severity: medium
- Requirement: design Decisions3明确“分页期间出现并发创建/删除后重新读取并按ID去重，不把旧total或旧offset结果当作最新完整清单”；`Read every item and return through the layers`要求当天全部事项可达且无重复。
- Evidence: `潘多拉-每日事项.js:522` loadList用offset查询并将非首批按ID追加，仅替换total/next（:528–534）；`:803` loadMore直接传entry.next，没有协调已加载前缀与新总量。独立真实fixture：日期2029-01-19有60条，首批50/next50；第二个真实登录会话DELETE首批第一项200；点击加载更多后serverCount=59、rendered=59、total=59、next=null、more=false，但集合对比missing=[a0587a49-cd4a-47d9-9568-9b130fb72964]，stale=[1986ffac-d311-4372-8bbc-46fc6db00feb]，stale正是刚删ID。
- Expected: 分页中的并发删除后重新协调已加载清单与服务端结果，所有当前存在事项可达，不把已删行和旧offset继续当作当前完整清单。
- Actual: 删除使服务端后续行前移，旧offset50跳过一条；客户端仍保留首批被删项，恰显示59条，数量看似正确但内容错误，且不再有加载入口。单次API list/total的事务快照正确，问题在跨请求合并。
- Reproduction: 同账号在日期D建立60条；窗口A打开D只读首50条；窗口B删除A首屏第一项；A点击加载更多直到按钮消失；以GET `/daily-items?date=D&limit=100` 的真实ID集合对比A DOM/缓存。可用两次真实登录或两个浏览器会话，后台无需伪造排序或数据。
- Repair guidance: 对并发增删后的分页结果重新读取/协调已加载范围，避免旧offset偏移漏项；按真实ID去重并移除已删除项，准确决定是否还有后页。修复应保留稳定创建顺序、完成项位置、清单滚动/焦点及全日计数。
- Acceptance checks: 60/105条场景在分页前删除首批开头/中间/边界项及新增，完整加载后UI当前ID集合与服务端一致，无漏项、残留和重复；有后页可继续加载，终态数量/按钮正确。正常分页、完成/取消完成、返回位置和V-005读取生命周期继续通过。
- Repair status: addressed-awaiting-verification
- Repair notes: 已在独立临时库与两个真实登录会话复现：60条删除首项后界面仍为59条，但缺失1个现存ID并残留被删ID。修改 `潘多拉-每日事项.js`：加载更多从0重新读取已加载范围加下一页，按真实ID协调并整体替换旧前缀；超过单请求100条时校验连续读取的ID、版本、总数一致性，最多4轮，不一致保留旧清单并提示重试；刷新完整日计数、恢复清单滚动与焦点，分页读取沿用弹层/页面/会话生命周期约束。写后回读保留超过100条的已加载范围。同步 `潘多拉-交互原型.html` 指纹，新增 `backend/scripts/check_daily_items_paging_browser.js` 并接入原专项：59项覆盖60/105条的首项/中间/50与100边界删除、新增、删一增一、读取途中总数不变的替换、完整ID集合和顺序/去重/total/更多入口、滚动与焦点、完成/取消完成及迟到分页隔离。`python3 /private/tmp/redesign-home-daily-items-fix-v006/run-suite.py`（原check_daily_items.py仅重定向输出）73项API/迁移、199项浏览器全部通过，含原140项回归；同目录 `run-regressions.py check_fixed_web` 员工166、管理端15、服务资源21项全部通过，进程均exit0。Maven离线 `-DskipTests package` 成功，check_web_resources.py 15/15通过，JS语法与git diff --check通过；本轮未修改Java或重跑单元测试。复现与最终证据位于 `/private/tmp/redesign-home-daily-items-fix-v006/`（before.json、suite.log、redesign-home-daily-items/daily-items-browser.json、daily-items-run.json、fixed-web.log及web-resources.json）。待独立复验；未更改原裁决、复验字段或verification-state.json。
- Reverification notes: 上轮已明确列为未覆盖的并发分页子情形；本轮补齐执行得到确认失败。独立21项补充检查的唯一行为失败，不归因于V-005修复引入，也不把旧勾选当通过。

## Next Action

运行`$openspec-e13-fix-change redesign-home-daily-items`修复V-006，再独立verify。本轮不修代码、不归档。后续复验重点为并发分页，保留现有5个已解决发现、全部修复记录及仍有效证据；相关输入变化须重验。
