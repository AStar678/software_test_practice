# Implementation Verification

- Change: `redesign-home-daily-items`
- Schema: `spec-driven`
- Verdict: **PASS**
- Verified at: 2026-11-05T08:46:11+08:00（Asia/Shanghai；主规格同步后增量复验）
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice`（同根规划与实现）
- Verified revision: `f73dfcf7725981ceda0a210bf4388a9dc6c255c7`；行为复验开始时工作区干净；归档前增量仅同步主规格与更新report/state，未改实现。

## Summary

V-001至V-006均已独立复验为 `verified-resolved`，全部6条修复记录原文保留。V-006的60/105条真实双会话分页并发删除、新增、同总数替换及读取中变动通过；原缺项与残留未复现。新增独立205条探针6项通过，确认跨请求失败保留原清单、四轮不一致后明确提示重试、停止并发后恢复完整ID/版本、编辑后保留全部已加载范围。

本轮73项API/迁移、199项专项Chrome（原140+Paging59）、员工166/管理端15/served resources21、资源15及额外独立6项全部通过，所有执行进程exit0。严格OpenSpec校验和Maven重新打包通过。未变化的Java、公司日历、Admin/Log、Demo及部分高级故障行为复用此前独立证据，详见Basis与矩阵；不将修复方自评当独立结论。无待修复发现或必验缺口。实体设备惯性参数及原生Android仍不在此次通过声明内。

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| proposal/design/tasks/delta spec | 本轮重新读取全部contextFiles，内容未变；全部32场景矩阵保留；26/26是声明，不是证据 |
| 上轮独立基线 | `d5d332f`；报告2026-11-04T22:18:05+08:00；旧state实际SHA-256为`31aa52ca2715d0968d23f8219a9b1158785d7401dcfb772be440e9025e11f915`，与旧报告相符 |
| 当前输入 | 394文件；快照新增`backend/scripts/check_daily_items_paging_browser.js`；修改`check_daily_items_browser.js`、`潘多拉-交互原型.html`、`潘多拉-每日事项.js`；无删除，Git diff相符 |
| 当前state | SHA-256 `df4d5b05ad6cc362ce39196380514cf4351ad3c8e8c442eac8e127c5e523ef39`；完整输入清单保存于`verification-state.json` |
| 交接 | `implementation-notes.md`标识change/项目正确；仍为dirty `bb9842f`和旧检查数量，revision与数量过时；Findings中最新V-006修复记录对应本轮diff；均只作线索 |

本轮增量聚焦loadList/loadMore/reloadList的并发协调、失败与写后回读。由于共用读取影响清单和生命周期，重跑整个每日事项专项与Fixed Web；另外独立使用205条事项覆盖超过两个API页的失败/并发版本和编辑回读。未因文件相等就假定全部覆盖，也未复制修复方运行结果。

复用仍适用的独立证据：`ca88b94`的Maven111项（Java源/测试/依赖/构建配置未变）；`d5d332f`的公司日历102项、完整Demo55+完整性18项、独立时区/触摸/双会话冲突/保存响应丢失/写后summary乱序/公司信息并发上限；首轮`8f2fd02`的Admin contract40+43及Log backfill50。公司日历、播种、权限与业务后端和检查均未变；本次只改每日事项的列表读取和本地焦点恢复，没有改共用sheet包装或公司任务逻辑。Fixed Web本轮仍覆盖公司任务表单、详情返回与日志业务。高级故障的认证/日期/summary/幂等写入路径不变；受影响的跨页失败、行版本、稳定顺序与写后全量回读已有本轮新证据。旧临时运行目录现已不可用，复用依据为既有独立报告中的明确观测及当前diff，未假称重跑。

快照命令（仓库根；两次capture参数一致）：

```sh
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture \
  --root /Users/watuji/MyGitDev/software_test_practice \
  --exclude 'audit/**' --exclude 'output/**' \
  --output /private/tmp/redesign-home-daily-items-v4-before.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare \
  openspec/changes/redesign-home-daily-items/verification-state.json \
  /private/tmp/redesign-home-daily-items-v4-before.json
# 结束时同参数capture到 /private/tmp/redesign-home-daily-items-v4-after.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare \
  /private/tmp/redesign-home-daily-items-v4-before.json \
  /private/tmp/redesign-home-daily-items-v4-after.json
```

旧→新compare exit1（上述4文件）。audit/output为生成证据排除；report/state/handoff由脚本自动排除，Git忽略的runtime/build缓存不入清单；代码、测试、依赖/配置及所有规划均覆盖。最终state从脚本生成快照复制，不手填hash或清单。

本轮日志/截图/JSON保存在`/private/tmp/redesign-home-daily-items-v4/`。临时`run-check.py`与`redirect-output.cjs`只将原检查写文件位置重定向出仓库，不改源代码或断言。关键观测记录于本文，独立6项为`probe.py`+`probe.cjs`，不依赖临时文件长期存在。

### 归档前主规格同步后的增量复验

用户选择同步主规格后归档。按verify工作流重新读取当前contextFiles/交接/报告；以此前独立PASS状态`28562a0268259de4c91dd0f71eeefd202dd963de6eb8cf11e065d9bb5195d2f4`为基线比较，唯一变化为`openspec/specs/pandora-requirements-aligned-prototype/spec.md`。5个ADDED要求和1个MODIFIED导航要求逐块与已验收delta完全一致，全部32场景原文匹配；旧Four-quadrant dashboard已移除，其他45项要求及Purpose保持原文，主规格无delta操作标题。不存在新验收行为或实现/测试/配置变化，因此上述73/199/166/15/21/15及独立6项行为证据继续适用，本次增量不重跑行为测试。`openspec validate --specs --strict --json --no-interactive`及change严格校验均通过；主规格仅有长文本INFO建议，无warning/error。所有6项发现仍为verified-resolved，裁决维持PASS。

本次capture参数/排除与上文完全相同，临时路径为`/private/tmp/redesign-home-daily-items-archive-synced-before.json`和`/private/tmp/redesign-home-daily-items-archive-synced-after.json`；旧state→before compare exit1，仅上述主规格；before→after compare exit0、changed=false/roots=[]、394文件同SHA-256。最终复制after脚本输出为state。此补充后的当前指纹取代表格和旧主体运行记录中的历史最终指纹，主体检查结果为同日此前独立执行，并非本次文档增量重新执行。

## Apply Handoff Review

| 提醒 | 本轮处置 |
| --- | --- |
| Native Android/旧shell | 与proposal排除范围一致，未构建APK；后续适配home/daily-items新契约。 |
| 暂缓change协调 | 继续暂缓；后续不得恢复personalItems/recentLogs或首页日志；V29已占用，下一号当前V30。 |
| 仅清理非生产personal | 本轮73项重跑V28→V29：personal1→0，company/task/log ID保留；不将旧测试名byte-identical解释为全字段字节比较。 |
| 布局耦合 | 本轮199项含320/390/1440/390×600七行、FAB/导航/详情返回和焦点；CSS未变。 |
| 稀疏summary与失败 | 本轮真实离线补载/重试及Paging全日计数通过；保存后回读失败、旧summary不倒灌复用上轮独立证据；新跨页读取失败独立重验。 |
| 锚点/清单恢复 | 本轮原140项与新增Paging59全部通过；清单并发协调另有205条独立6项；V-006已解决。 |
| DemoSeed | 复用上轮55+18项独立结果；播种/初始化路径未变，未恢复旧personal写入。 |
| 公司日历drag-close偶发 | 本轮未重跑未变的公司日历；复用上轮首次拖拽断言失败后完整重跑102项通过的结果，保留其偶发事实；Fixed本轮通过。 |
| 修复记录 | 6条Repair notes原文保留；V-001～V-005随原140项重验，V-006使用Paging59及独立6项确认。 |
| 非独立声明 | 交接和修复运行只作定位，不替代本轮结论。 |

## Checks

默认仓库根；Maven在backend。仅使用本机服务、随机一次性临时库和真实认证，无生产或部署动作。

| Command or inspection | Result | Notes |
| --- | --- | --- |
| OpenSpec list/status/instructions apply | 完整（本轮） | spec-driven，26/26，另一未归档change按用户约定暂缓 |
| `openspec validate redesign-home-daily-items --type change --strict --json --no-interactive` | PASS（本轮） | valid=true，无issues |
| `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 -DskipTests package` | PASS（本轮） | 仅重新打包；单元未重跑 |
| Maven111项 | PASS（复用） | 范围与适用性见Basis |
| `python3 /private/tmp/redesign-home-daily-items-v4/run-check.py check_daily_items` | PASS（本轮） | 原check_daily_items，73 API/迁移+199 Chrome；exit0 |
| 同包装器`check_fixed_web` | PASS（本轮） | 员工166、管理端15、served resources21；exit0 |
| `python3 /private/tmp/redesign-home-daily-items-v4/probe.py` | PASS（本轮） | 新独立205条探针6/6；exit0，随机库已清理 |
| `python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /private/tmp/redesign-home-daily-items-v4/web-resources.json` | PASS（本轮） | 15/15，指纹/顺序/白名单/打包字节 |
| `node --check` 每日事项JS/新paging检查；`git diff --check` | PASS（本轮） | 无语法/空白错误 |
| Calendar102 / Demo55+18 / Admin40+43 / Log50 | PASS（复用） | 未受影响，具体依据和旧公司日历偶发断言见Basis/Handoff |
| 前后输入快照 | PASS（本轮） | compare exit0，changed=false/roots=[]；394文件SHA-256一致，after生成快照已复制为state |

首次在沙箱内访问MySQL被本机连接限制拒绝，尚未创建临时库；获自动授权后在本机执行同命令并通过。无自动审批拒绝、无最终环境阻塞。没有修改实现、检查代码、规划、任务或实施记录。

## Requirement Coverage

全部32场景映射保留。API=本轮73；Browser/Repairs/Lifecycle/Paging=本轮199；Fixed=本轮；Calendar/Admin/Log/Demo和明确标注的高级探针为既有独立证据复用。

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| Five-page navigation / Navigate with an authenticated identity | HTML、PAGE_TITLE、API 身份映射；Browser 五入口；Fixed 五页/通知真实登录与权限回归 | PASS |
| Five-page navigation / Navigate across the prototype | Browser 首页/公司新文案；Fixed 公司任务权限与原详情 | PASS |
| Five-page navigation / Enter the task table as a secondary view | Fixed 表单/详情/返回；Calendar 公司页模式、日期和位置恢复，完整进程 exit 0 | PASS |
| Five-page navigation / Keep independent calendars and business text | 独立 S 日期状态，不引用任务 viewDate；Browser 首页→公司→首页锚点；diff 未全局替换业务正文 | PASS |
| Three-section home dashboard / Render three modules in their intended positions | `潘多拉-工作区接入.js` renderMap、每日事项 CSS；Browser 三卡及两列下方通栏 | PASS |
| Three-section home dashboard / Scroll home modules independently | 本轮 Browser 各窗口布局及独立横滚；复用上轮独立 CDP touchStart/Move/End 真触摸，scrollLeft 102→239、整页 scrollX=0、未开弹层 | PASS |
| Three-section home dashboard / Include self-created assigned work | `WorkspaceService.homeRead` 去创建者排除；API 自建和他建有效负责混排 | PASS |
| Three-section home dashboard / Exclude work outside the board contract | API 仅创建、负责人移除、完成、未发布排除；homeRead active/current version 条件 | PASS；历史通知入口本身未因该查询扩大 |
| Three-section home dashboard / Rank a newly assigned old task | API assigned_at 倒序、同值 ID、>10、唯一性；SQL limit 10 | PASS |
| Three-section home dashboard / Show concise tasks and read only company information | Browser 窄屏标题/右侧紧急度；Admin 只读和相同管理顺序 | PASS |
| Three-section home dashboard / Reject company information above the limit | 本轮 API 第十一条拒绝；复用上轮独立 fixture 先 9 条，12 个并发 POST：1×200、11×409，最终恰 10 条；Writes.run 组织行锁 | PASS |
| Three-section home dashboard / Remove only the home log presentation | `/home` 恰含 companyItems/assignedTasks/businessDate；移除卡片；Log 50 项通过 | PASS |
| Three-section home dashboard / Separate creation actions | Browser daily FAB/空日新增；Fixed/Calendar 公司页任务加号；首页无任务创建占位 | PASS |
| Independent personal daily items / Create more than ten independent items | DailyItemService 独立表；API 105 同日、task/log/notification 数量未增加 | PASS；未做所有任务/日志字段全量快照比较 |
| Independent personal daily items / Edit the date and body of a specific item | API 真实 ID、换行、日期保存；Browser 移日后旧清单与双日计数回读 | PASS |
| Independent personal daily items / Complete and reopen an item | API 布尔明确赋值、状态持久化；Browser 清单/详情完成和反向操作及标记 | PASS |
| Independent personal daily items / Keep dates stable across time zones | 本轮 API 日期/正文非法边界；复用上轮独立 CDP 切 Pacific/Kiritimati 和 America/Los_Angeles，今天默认公司 2026-11-04（Kiritimati 本地为 11-05），闰日 2024-02-29 原样详情往返 | PASS |
| Independent personal daily items / Enforce private ownership on every operation | API 同组织其他身份/上级/founder/管理员/跨公司/无效会话读写；DailyItemService org+owner 限定 | PASS |
| Independent personal daily items / Keep daily-item details minimal and safe | Browser纯文本/换行和字段审查；Repairs详情返回；Lifecycle加载中关闭不重开 | PASS，V-005已解决 |
| Horizontal continuous daily-item calendar / Read the transposed calendar | Browser 周一至周日固定七行、周列、唯一日期、年月边界、无农历；独立渲染器 | PASS |
| Horizontal continuous daily-item calendar / Browse continuously across months and years | 本轮 Browser 连续跨年/闰月；Repairs 全年 12 个月前后按钮共 24 次、四窗口跨年定位、连续日期和回今天 | PASS，V-001 已解决 |
| Horizontal continuous daily-item calendar / Recover a failed range load | Browser 真离线 supplement 失败、保留内容及 retry，恢复后真实计数/零值 | PASS |
| Horizontal continuous daily-item calendar / Separate sliding from activation | 本轮 Browser 鼠标/键盘；Repairs 每步测可见焦点；复用上轮独立 CDP 真触摸 120px 横滑不激活，后续普通 touch tap 打开正确日期 | PASS，V-003 已解决；未验实体设备惯性参数 |
| Daily-item status count markers / Render zero through saturated counts | API 0/1/2/3/4/5/7/105；Browser 4/7/10/13/16px 等高宽度、零日无点；105 条完整分页 | PASS |
| Daily-item status count markers / Show mixed and completed-only days | API mixed、all-done 汇总；Browser 蓝灰并列、准确 aria；marksHTML 条件渲染 | PASS |
| Daily-item status count markers / Update both dates after a move or deletion | API summary；Browser 完成/取消、移动、删除后回读双日 | PASS |
| Daily-item lists details and reliable editing / Open an empty day and create with the floating button | Browser 空态→日期默认→保存真实项→列表/标记；FAB 与公司今天状态 | PASS |
| Daily-item lists details and reliable editing / Read every item and return through the layers | Browser50→105、Repairs滚动600与焦点、Lifecycle迟到读取；Paging59项真实双会话60/105条并发增删及同总数替换；额外独立205条跨请求失败/持续改版本/编辑回读 | PASS，V-006已解决 |
| Daily-item lists details and reliable editing / Edit and delete only the selected item | 本轮 API/Browser/Repairs 真实 ID、移日、确认/取消删除、双日计数和原清单非零滚动恢复 | PASS |
| Daily-item lists details and reliable editing / Preserve drafts and reject stale versions | API版本/幂等和Browser断网重试；复用上轮独立双会话412/删除仍保留edit草稿；真实POST已提交后丢弃响应，再保存同一草稿仅1条；写成功但列表/汇总读取失败明确“已保存”并给刷新，重读无重复 | PASS |
| Daily-item lists details and reliable editing / Isolate sessions and out-of-order responses | Repairs退出/真实401/跨组织及迟到list/detail/summary隔离；Lifecycle14项；复用上轮独立持有日期A真实响应，先打开B再放A仍显示B；写后释放旧summary前后均open=3/completed=0 | PASS，V-004/V-005已解决 |
| Daily-item lists details and reliable editing / Keep controls usable on compact screens | 本轮Browser/Repairs四尺寸七行/FAB/导航/返回/每步可见焦点；Lifecycle Esc/关闭/遮罩恢复触发焦点 | PASS，V-002/V-003/V-005已解决 |
| REMOVED Four-quadrant dashboard / 替换及迁移边界 | 旧卡片和 personal 写入口退役 410；API home 三字段；V29 仅清理 personal；新三模块承接 | PASS；不以被删除的“个人项十条/首页日志窗口”验收 |
| Design / 独立模型、分页汇总、写入事务及资源交付 | 独立DailyItemService/V29/Writes/If-Match/全日summary和资源检查通过；loadMore回读前缀，多请求比较ID/版本/总数，失败保留旧清单并提示重试；Paging59及独立205条6项通过 | PASS，V-006已解决 |
| Proposal / 员工 Web+共用后端、无部署、原生后续 | 提交文件范围、构建和资源映射；无 Android 改动/构建、无部署动作 | 符合范围 |

## Findings

### V-001: 上一月和下一月跳到错误月份

- Category: implementation
- Severity: medium
- Requirement: Horizontal continuous daily-item calendar；design Decisions 4。
- Repair status: verified-resolved
- Repair notes: 修复 `潘多拉-每日事项.js` 月份参数偏移、目标周块定位及宽屏滚动钳制；同步HTML缓存指纹。新增 `backend/scripts/check_daily_items_repairs_browser.js`，接入现有浏览器专项，覆盖全年12个月前后跳转、跨年、320/390/1440及短屏、横滑连续性和回今天。`python3 /private/tmp/redesign-home-daily-items-fix/run-suite.py`（运行原 check_daily_items.py，仅重定向输出）最终73项API/迁移及126项浏览器检查通过，新增69项回归；`python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /private/tmp/redesign-home-daily-items-fix/web-resources.json` 15/15通过。证据位于 `/private/tmp/redesign-home-daily-items-fix/redesign-home-daily-items/daily-items-browser.json`。
- Reverification notes: 本轮`f73dfcf`独立执行199项真实打包服务专项（包含原140项）再次通过；此前修复与具体行为证据见Repair notes及本轮Browser/Repairs/Lifecycle记录。未将修复方自评作结论。

### V-002: 详情缺少可见返回清单入口，返回后丢失清单滚动位置

- Category: implementation
- Severity: high
- Requirement: Read every item and return through the layers；design Decisions 5。
- Repair status: verified-resolved
- Repair notes: `潘多拉-每日事项.js` 提供详情/编辑/确认返回入口，进入详情前捕获实际清单位置及触发行，各层统一恢复；关闭时恢复可见日期锚点。`潘多拉-交互原型.js` 关闭按钮通过当前 closeSheet 执行，避免绕过模块恢复；更新HTML指纹。新增专项覆盖四种窗口尺寸、scrollTop=600返回及行焦点、编辑和删除确认取消、Esc、移日后原清单位置与双日计数、按钮和遮罩关闭。`python3 /private/tmp/redesign-home-daily-items-fix/run-suite.py` 最终73项API/迁移、126项浏览器通过；`python3 /private/tmp/redesign-home-daily-items-fix/run-regressions.py check_fixed_web` 员工166、管理端15、服务资源21项通过；同包装器 `check_calendar_drawer` 最终102项通过。公司日历首次手柄拖动断言失败，另一次因端口18193占用未执行，释放端口后完整重跑通过，未修改相关代码/断言。日志：`/private/tmp/redesign-home-daily-items-fix/check_fixed_web-final.log`、`check_calendar_drawer-final.log`。
- Reverification notes: 本轮`f73dfcf`独立执行199项真实打包服务专项（包含原140项）再次通过；此前修复与具体行为证据见Repair notes及本轮Browser/Repairs/Lifecycle记录。未将修复方自评作结论。

### V-003: 键盘移动到已挂载但不可见的日期时不滚动日历

- Category: implementation
- Severity: medium
- Requirement: Separate sliding from activation；Keep controls usable on compact screens。
- Repair status: verified-resolved
- Repair notes: `潘多拉-每日事项.js` 每次聚焦按目标格与窗口边界最小横滚，更新锚点并使旧异步月份定位失效；隐藏首页不改写浏览状态。更新HTML指纹，新增浏览器回归逐步测量焦点可见性，覆盖左右边界、跨月/年、前插与未挂载日期、远月Home、Enter/Space及关闭后恢复。`python3 /private/tmp/redesign-home-daily-items-fix/run-suite.py` 126项浏览器检查通过；公司日历102项及员工166项最终回归通过。JS语法及 `git diff --check` 通过；`mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package` 111项测试通过，最终静态资源重新打包并通过15项资源检查。证据：`/private/tmp/redesign-home-daily-items-fix/redesign-home-daily-items/daily-items-browser.json`、`/private/tmp/redesign-home-daily-items-fix/maven.log`。
- Reverification notes: 本轮`f73dfcf`独立执行199项真实打包服务专项（包含原140项）再次通过；此前修复与具体行为证据见Repair notes及本轮Browser/Repairs/Lifecycle记录。未将修复方自评作结论。

### V-004: 退出登录后仍保留每日事项私有缓存和编辑草稿

- Category: implementation
- Severity: medium
- Requirement: Isolate sessions and out-of-order responses；design Decisions 5的会话清理。
- Repair status: verified-resolved
- Repair notes: `潘多拉-每日事项.js` 注册 `P.sessionReset`，立即清除账号、日历/锚点、清单/汇总、详情、草稿版本、焦点引用及滚动计时器；新增会话generation使迟到清单/详情和定位回调失效，汇总继续使用单调查询token。同步HTML指纹并新增真实认证回归：有缓存及草稿时退出、撤销服务端会话触发401、切换组织账号；分别延迟真实list/detail/summary响应至清理或新登录后释放，确认旧状态不复活。`python3 /private/tmp/redesign-home-daily-items-fix/run-suite.py` 最终73项API/迁移和126项浏览器通过；原有同账号切页锚点恢复及第二员工零计数检查同时通过。证据：`/private/tmp/redesign-home-daily-items-fix/redesign-home-daily-items/daily-items-browser.json`。
- Reverification notes: 本轮`f73dfcf`独立执行199项真实打包服务专项（包含原140项）再次通过；此前修复与具体行为证据见Repair notes及本轮Browser/Repairs/Lifecycle记录。未将修复方自评作结论。

### V-005: 关闭日清单后，迟到的详情响应重新打开弹层

- Category: implementation
- Severity: medium
- Requirement: Daily-item lists details and reliable editing；design Decisions5的关闭后响应隔离。
- Repair status: verified-resolved
- Repair notes: 已用真实GET延迟复现 Esc 关闭后栈从空变为仅detail；另复现取消首次清单读取后重新打开同日仍显示加载态。修改 `潘多拉-每日事项.js`：清单/详情查询同时绑定来源弹层、主页面及会话generation，关闭、返回、替换弹层或切页时作废旧界面回调；读取使用 P.request 的加载提示，使关闭/返回及选择新日期可用，写入仍沿用原命令锁；同日重新打开空清单发起新读取并以列表token隔离旧结果，保留同账号日历缓存与锚点。更新 `潘多拉-交互原型.html` 指纹，新增 `backend/scripts/check_daily_items_lifecycle_browser.js` 并接入 `check_daily_items_browser.js`，14项新回归覆盖Esc/关闭按钮/遮罩/返回、切页往返、新日期及新表单、取消初始清单、同日重开、正常详情返回、锚点与焦点恢复。`python3 /private/tmp/redesign-home-daily-items-fix-v005/run-suite.py`（原 check_daily_items.py，仅重定向输出）最终73项API/迁移和140项浏览器检查全部通过，包含原126项与V-004会话隔离；同目录 `run-regressions.py check_fixed_web` 员工166、管理端15、服务资源21项通过，`run-regressions.py check_calendar_drawer` 102项通过，最终进程均exit0。`mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 -DskipTests package` 成功；`check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /private/tmp/redesign-home-daily-items-fix-v005/web-resources.json` 15/15通过；JS语法与 `git diff --check` 通过。本轮未修改Java或重跑Maven单元测试。证据：`/private/tmp/redesign-home-daily-items-fix-v005/redesign-home-daily-items/daily-items-browser.json`、`daily-items-run.json`及该临时根目录下最终回归日志。
- Reverification notes: 本轮`f73dfcf`独立执行199项真实打包服务专项（包含原140项）再次通过；此前修复与具体行为证据见Repair notes及本轮Browser/Repairs/Lifecycle记录。未将修复方自评作结论。

### V-006: 分页期间另一会话删除首屏项，后页漏项且残留已删事项

- Category: implementation
- Severity: medium
- Requirement: design Decisions3并发创建/删除后重新读取、按ID去重，不沿用旧total/offset；`Read every item and return through the layers`。
- Repair status: verified-resolved
- Repair notes: 已在独立临时库与两个真实登录会话复现：60条删除首项后界面仍为59条，但缺失1个现存ID并残留被删ID。修改 `潘多拉-每日事项.js`：加载更多从0重新读取已加载范围加下一页，按真实ID协调并整体替换旧前缀；超过单请求100条时校验连续读取的ID、版本、总数一致性，最多4轮，不一致保留旧清单并提示重试；刷新完整日计数、恢复清单滚动与焦点，分页读取沿用弹层/页面/会话生命周期约束。写后回读保留超过100条的已加载范围。同步 `潘多拉-交互原型.html` 指纹，新增 `backend/scripts/check_daily_items_paging_browser.js` 并接入原专项：59项覆盖60/105条的首项/中间/50与100边界删除、新增、删一增一、读取途中总数不变的替换、完整ID集合和顺序/去重/total/更多入口、滚动与焦点、完成/取消完成及迟到分页隔离。`python3 /private/tmp/redesign-home-daily-items-fix-v006/run-suite.py`（原check_daily_items.py仅重定向输出）73项API/迁移、199项浏览器全部通过，含原140项回归；同目录 `run-regressions.py check_fixed_web` 员工166、管理端15、服务资源21项全部通过，进程均exit0。Maven离线 `-DskipTests package` 成功，check_web_resources.py 15/15通过，JS语法与git diff --check通过；本轮未修改Java或重跑单元测试。复现与最终证据位于 `/private/tmp/redesign-home-daily-items-fix-v006/`（before.json、suite.log、redesign-home-daily-items/daily-items-browser.json、daily-items-run.json、fixed-web.log及web-resources.json）。待独立复验；未更改原裁决、复验字段或verification-state.json。
- Reverification notes: 本轮`f73dfcf`独立审查`潘多拉-每日事项.js:522`的前缀回读和多请求稳定性校验、`:789`保留已加载范围、`:824`分页焦点/滚动/来源生命周期，并运行完整专项。Paging59项真实双会话覆盖60/105条首项/中间/第50及100边界删除、新增、删一增一、读首个真实响应后同总数替换；终态服务端/缓存/DOM ID顺序一致，无缺项/残留/重复，total/next/更多入口和日计数正确；非零滚动/焦点、完成往返、晚到分页不覆盖新日期均通过。原60条删首项场景现在准确呈现59条现存ID，原失败未复现。
- Independent boundary evidence: 另以205条/2042-01-19在独有临时库执行6项：50→100→150，total205/next150；第2个真实分页响应后抛网络错误，仍保留原150条/next150并显示明确错误；恢复读取获得200条唯一前缀。每轮offset0真实响应后第二会话PATCH首行版本，12次请求=4轮×3页后停止，原200条不变且提示“事项正在其他会话中变化，请重试加载。”；解除并发再加载，205条ID、版本、DOM与服务端完全一致，next=null。随后编辑第205项正文，保存成功并返回原清单，205条全保留且顺序不变。6/6通过，Python/Node exit0。
- Reproduction/acceptance commands: `python3 /private/tmp/redesign-home-daily-items-v4/run-check.py check_daily_items`及`python3 /private/tmp/redesign-home-daily-items-v4/probe.py`；可重新按旧复现建立60/105/205条，加载首50/100条后第二真实会话增删，再逐页比较所有真实ID。无伪造列表数据；延迟/失败仅作用于已取得的真实响应。

## Next Action

独立验证 **PASS**。可运行`$openspec-e13-archive-change redesign-home-daily-items`。本轮不归档；报告仅适用于记录的输入快照，相关代码、测试、依赖/配置或规划修改后须重新verify。
