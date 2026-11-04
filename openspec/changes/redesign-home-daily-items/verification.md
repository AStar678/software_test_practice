# Implementation Verification

- Change: `redesign-home-daily-items`
- Schema: `spec-driven`
- Verdict: **FAIL**
- Verified at: 2026-11-04T20:13:36+08:00（Asia/Shanghai；本轮独立验证）
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice`（同一根目录包含规划和实现）
- Verified revision: `8f2fd02b3e27e1005871bf244121ecd4decc736e`；开始时工作区干净；本轮只新增验证报告和生成的状态文件。

## Summary

确认 4 项尚未修复的前端偏差：月份按钮跳转错误（V-001）、详情缺少可见返回入口且丢失清单滚动位置（V-002）、键盘焦点移出可见日历（V-003）、退出登录没有立即清除每日事项缓存和草稿（V-004）。因此不能归档。

当前构建的 111 项 Maven 测试、73 项专项 API/迁移检查、57 项专项浏览器检查以及资源检查通过，但这些检查没有覆盖上述完整行为。独立补充探针在真实认证、真实后端和 Chrome 中复现了问题。本轮没有修改实现、测试、规划、任务勾选或实施记录。

触摸惯性、刻意制造的快速切日响应乱序、浏览器版本冲突后的完整处理、公司信息并发第十一条等子情形仍有证据边界，下文单列；不将其视为已确认缺陷，也不以现有脚本通过代替这些证据。

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| 当前 proposal/design/tasks 和 delta spec | `openspec/changes/redesign-home-daily-items/`；逐项核对全部 32 个场景；26/26 勾选仅作为实施声明 |
| 员工 Web、后端、迁移、检查、依赖和配置 | 当前 HEAD `8f2fd02`；通过脚本记录 391 个输入文件 |
| 实施交接 | `implementation-notes.md`；映射与当前代码相符，但 revision 仍写 dirty `bb9842f`，该元信息已过时 |
| 其他活跃 change | `refine-notifications-task-editing-and-staff-browsing`；用户明确暂缓，本轮未实施或改写 |
| 当前独立基线 | `verification-state.json`；SHA-256：`d7abd41947ea213cb6e68bdb0b843f6516a6776dfc4a83834ad22d41c9f72f43` |

首次独立验证，无旧 `verification-state.json` 可比；初始 compare 因文件不存在返回 2，故建立完整新基线，未复用实施者声称的 PASS 或历史审计结果。当前报告中所有执行结果均来自本轮。

快照命令（前后两次使用相同根和排除项）：

```sh
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture \
  --root /Users/watuji/MyGitDev/software_test_practice \
  --exclude 'audit/**' --exclude 'output/**' \
  --output /private/tmp/redesign-home-daily-items-verify-before.json
# 结束时将 output 改为 /private/tmp/redesign-home-daily-items-verify-after.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare \
  /private/tmp/redesign-home-daily-items-verify-before.json \
  /private/tmp/redesign-home-daily-items-verify-after.json
```

排除生成的 audit/output 证据，不排除业务源代码、测试、依赖声明或控制性规划。Git inventory 自然排除被忽略的 `.runtime`、构建缓存；脚本自动排除 workflow report/state/handoff。最终快照由脚本生成后复制到本 change，完整清单留在 JSON。前后比较结果见 Checks。

测试日志和新截图输出到 `/private/tmp/redesign-home-daily-items-verify/`，避免覆写版本库已有审计文件。临时 Python 包装器仅重定向报告路径；Node preload 仅将 `/audit/` 输出解析到临时目录，没有改变断言、业务逻辑或 fixture 数据。补充探针使用独立临时 fixture、60 条当天事项；决定性观测和复现步骤已保存在本报告，不依赖临时文件长期存在。

## Apply Handoff Review

| 提醒 | 本轮处置 |
| --- | --- |
| 原生 Android / old shell 未适配 | 与 proposal 范围一致；当前提交未改这两个目录。未构建 APK，也不声明原生验收通过。移除 `/home` 旧字段是已计划的接口破坏性变化。 |
| 暂缓 change 协调 | 核对共享文件确实重叠；V29 已由本 change 占用，后续迁移须从实际最新版本继续（当前下一号 V30）。不得恢复 personalItems/recentLogs 或首页日志卡片。另一 change 的规划本轮保持不变。 |
| 不可逆个人项清理 | 用户已授权清理非生产数据；实际 V29 SQL 仅 DELETE personal 行。真实 V28→V29 检查保留 company/task/log 的 ID，personal 从 1 变 0。测试虽名为 byte-identical，实际仅比较 ID，本报告不声称全行字节一致；SQL 静态确认不修改其他业务表。 |
| 布局耦合 | 专项浏览器在 320/390/1440 及 390×600 通过七行、FAB、导航、页面溢出检查；返回与键盘可用性仍由 V-002/V-003 阻止整体通过。 |
| 稀疏 summary / 请求失败 | API 精确分组、空日与 105 条日汇总通过；浏览器离线补载保留内容、明确重试，恢复联网后读到真实计数。 |
| 日期锚点和滚动恢复 | 主页面切换恢复锚点通过；不能据此认定详情清单恢复通过，独立实测 V-002。焦点跨可视边界另见 V-003。 |
| 演示数据 | `backend/src/main/java/cn/pandora/seed/DemoSeed.java:140`–144 静态确认每个被播种员工 3 条、其中 1 条完成，未调用旧 personal 写入。完整演示初始化结果见 Checks；未复用交接声明。 |
| 公司日历 drag-close 偶发失败 | 本轮第一次 102 项浏览器断言全部通过，失败发生在本地 MySQL 停止后的 fixture 清理，非 drag-close 断言。恢复数据库后完整补跑，结果见 Checks。 |
| 实施记录不是独立结论 | 当前 4 个发现直接反驳其“返回恢复”“退出清理”“键盘可用”覆盖声明；实施记录未改写。 |

## Checks

命令默认在仓库根运行；Maven 在 `backend/`。DB/API/Chrome 检查只用本地一次性数据库、真实登录和打包服务，不接触生产或部署。

| Command or inspection | Result | Notes |
| --- | --- | --- |
| `openspec status --change redesign-home-daily-items --json`；`openspec instructions apply --change redesign-home-daily-items --json` | 完整 | spec-driven；26/26 任务，规划齐全，未因缺失工件阻塞 |
| `openspec validate redesign-home-daily-items --type change --strict --json --no-interactive` | PASS | 无结构问题 |
| `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package` | PASS | 111 tests；BUILD SUCCESS；使用本轮重建 JAR |
| `python3 backend/scripts/check_daily_items.py`（临时输出包装执行） | PASS | 73 API/迁移 + 57 Chrome；包括真实 V28→V29 升级、分页、鉴权、状态/幂等、首页任务筛选等 |
| `python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /private/tmp/redesign-home-daily-items-verify/web-resources.json` | PASS | 15/15；指纹、顺序、Maven 白名单、JAR 资源字节 |
| `python3 backend/scripts/check_fixed_web.py`（临时输出包装执行） | PASS | 员工 166、管理端 43、served resources 21 项报告均无失败 |
| `python3 backend/scripts/check_admin_contract.py`（临时输出包装执行） | PASS（恢复数据库后） | 40 API/契约 + 43 浏览器；公司信息十条、顺序、只读等回归 |
| `python3 backend/scripts/check_log_backfill_entry.py`（临时输出包装执行） | PASS（恢复数据库后） | 50 项；日志补写、冻结、重复创建及原正文保留 |
| `python3 backend/scripts/check_calendar_drawer.py`（临时输出包装执行） | PASS（恢复数据库后） | 102 浏览器检查通过，完整进程 exit 0；首次清理阶段 DB 连接失败已补跑消除 |
| 完整 `check_final_demo.py` | 未执行 | 本轮只静态核对每日事项播种路径；交接中旧 PASS 未作为独立证据 |
| 独立真实浏览器补充探针 | FAIL | 6 组观测形成 V-001 至 V-004；具体数值及操作见 Findings |
| 前后输入快照 compare | PASS | exit 0，`changed: false, roots: []`；391 个输入文件及 SHA-256 前后一致 |

初次受 sandbox 限制未能连本地 MySQL，使用已批准的本地 fixture 执行权限重跑成功。后续 MySQL 服务停止使日历清理、管理端、日志首次进程失败；恢复本项目测试服务后补跑。此环境故障未计作实现缺陷，未将未完成进程冒充通过。

## Requirement Coverage

场景名均来自当前 delta spec。API=本轮 73 项专项；Browser=本轮 57 项专项；Fixed/Admin/Calendar/Log=上表本轮回归。静态证据与运行证据分开说明。32 个场景均有映射，但“部分”不等于 PASS。

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| Five-page navigation / Navigate with an authenticated identity | HTML、PAGE_TITLE、API 身份映射；Browser 五入口；Fixed 五页/通知真实登录与权限回归 | PASS |
| Five-page navigation / Navigate across the prototype | Browser 首页/公司新文案；Fixed 公司任务权限与原详情 | PASS |
| Five-page navigation / Enter the task table as a secondary view | Fixed 表单/详情/返回；Calendar 公司页模式、日期和位置恢复，完整进程 exit 0 | PASS |
| Five-page navigation / Keep independent calendars and business text | 独立 S 日期状态，不引用任务 viewDate；Browser 首页→公司→首页锚点；diff 未全局替换业务正文 | PASS |
| Three-section home dashboard / Render three modules in their intended positions | `潘多拉-工作区接入.js` renderMap、每日事项 CSS；Browser 三卡及两列下方通栏 | PASS |
| Three-section home dashboard / Scroll home modules independently | Browser 自身横滚、320/390/1440/短屏布局；CSS 两个 q-body 独立 overflow | PASS；真实触摸惯性未单独测量 |
| Three-section home dashboard / Include self-created assigned work | `WorkspaceService.homeRead` 去创建者排除；API 自建和他建有效负责混排 | PASS |
| Three-section home dashboard / Exclude work outside the board contract | API 仅创建、负责人移除、完成、未发布排除；homeRead active/current version 条件 | PASS；历史通知入口本身未因该查询扩大 |
| Three-section home dashboard / Rank a newly assigned old task | API assigned_at 倒序、同值 ID、>10、唯一性；SQL limit 10 | PASS |
| Three-section home dashboard / Show concise tasks and read only company information | Browser 窄屏标题/右侧紧急度；Admin 只读和相同管理顺序 | PASS |
| Three-section home dashboard / Reject company information above the limit | API/Admin 真正第十一条 409；OrganizationService 原锁定/上限路径保留 | 部分：串行拒绝通过；未新执行并发第十一条压力复现 |
| Three-section home dashboard / Remove only the home log presentation | `/home` 恰含 companyItems/assignedTasks/businessDate；移除卡片；Log 50 项通过 | PASS |
| Three-section home dashboard / Separate creation actions | Browser daily FAB/空日新增；Fixed/Calendar 公司页任务加号；首页无任务创建占位 | PASS |
| Independent personal daily items / Create more than ten independent items | DailyItemService 独立表；API 105 同日、task/log/notification 数量未增加 | PASS；未做所有任务/日志字段全量快照比较 |
| Independent personal daily items / Edit the date and body of a specific item | API 真实 ID、换行、日期保存；Browser 移日后旧清单与双日计数回读 | PASS |
| Independent personal daily items / Complete and reopen an item | API 布尔明确赋值、状态持久化；Browser 清单/详情完成和反向操作及标记 | PASS |
| Independent personal daily items / Keep dates stable across time zones | LocalDate/DATE、ISO 字符串、公司 businessDate；API 闰日/非法日期/空白/超长，Browser 闰月/今天 | 部分：日期链路有静态和运行证据；未切换设备时区执行往返 |
| Independent personal daily items / Enforce private ownership on every operation | API 同组织其他身份/上级/founder/管理员/跨公司/无效会话读写；DailyItemService org+owner 限定 | PASS |
| Independent personal daily items / Keep daily-item details minimal and safe | Browser HTML-like 多行文本按原文显示；detailView esc 和 CSS 换行；无 task/log 扩展字段 | PASS（内容）；必要返回操作见 V-002 |
| Horizontal continuous daily-item calendar / Read the transposed calendar | Browser 周一至周日固定七行、周列、唯一日期、年月边界、无农历；独立渲染器 | PASS |
| Horizontal continuous daily-item calendar / Browse continuously across months and years | Browser 十二月→一月、远处闰月、连续日期、主页面锚点；补充月份按钮探针 | **FAIL V-001**；连续流通过，但设计承诺的上/下一月错误 |
| Horizontal continuous daily-item calendar / Recover a failed range load | Browser 真离线 supplement 失败、保留内容及 retry，恢复后真实计数/零值 | PASS |
| Horizontal continuous daily-item calendar / Separate sliding from activation | Browser 鼠标拖动抑制打开、Enter 打开；补充跨可视边界键盘探针 | **FAIL V-003**；真实 touch 惯性和 touchend 合成 click 未单独执行 |
| Daily-item status count markers / Render zero through saturated counts | API 0/1/2/3/4/5/7/105；Browser 4/7/10/13/16px 等高宽度、零日无点；105 条完整分页 | PASS |
| Daily-item status count markers / Show mixed and completed-only days | API mixed、all-done 汇总；Browser 蓝灰并列、准确 aria；marksHTML 条件渲染 | PASS |
| Daily-item status count markers / Update both dates after a move or deletion | API summary；Browser 完成/取消、移动、删除后回读双日 | PASS |
| Daily-item lists details and reliable editing / Open an empty day and create with the floating button | Browser 空态→日期默认→保存真实项→列表/标记；FAB 与公司今天状态 | PASS |
| Daily-item lists details and reliable editing / Read every item and return through the layers | Browser 50→105 去重且完成项稳定；补充 60 条清单滚动到 600→详情→Esc，回到 0 | **FAIL V-002** |
| Daily-item lists details and reliable editing / Edit and delete only the selected item | API ID 作用域和版本；Browser 移日、删除、取消；双日刷新 | PASS（写入对象/移日）；普通详情返回仍受 V-002 影响 |
| Daily-item lists details and reliable editing / Preserve drafts and reject stale versions | API 428/412、幂等 create/delete replay；Browser 离线保留草稿并重试恰 1 条；前端显式显示错误 | 部分：网络重试/API 冲突通过；浏览器真实 412/他会话删除后的回读处理未专门注入 |
| Daily-item lists details and reliable editing / Isolate sessions and out-of-order responses | Browser 换账号后 0/0；API request epoch 和 daily query token 静态；退出补充探针保留旧缓存/草稿 | **FAIL V-004**；未专门延迟请求制造快速切日/写后旧 summary 倒灌 |
| Daily-item lists details and reliable editing / Keep controls usable on compact screens | Browser 320/390/1440/短屏七行、FAB、导航；补充可见返回和键盘焦点 | **FAIL V-002、V-003** |
| REMOVED Four-quadrant dashboard / 替换及迁移边界 | 旧卡片和 personal 写入口退役 410；API home 三字段；V29 仅清理 personal；新三模块承接 | PASS；不以被删除的“个人项十条/首页日志窗口”验收 |
| Design / 独立模型、分页汇总、写入事务及资源交付 | DailyItemService、V29、Writes.run、If-Match、无 task/log FK；summary ≤93 天、列表 ≤100；资源 15/15 | PASS（已执行边界）；竞争时分页快照/持续并发增删未做压力验证 |
| Proposal / 员工 Web+共用后端、无部署、原生后续 | 提交文件范围、构建和资源映射；无 Android 改动/构建、无部署动作 | 符合范围 |

## Findings

### V-001: 上一月和下一月跳到错误月份

- Category: implementation
- Severity: medium
- Requirement: `Horizontal continuous daily-item calendar`；design Decisions 4 的“上一月/下一月”定位入口。
- Evidence: `潘多拉-每日事项.js:33` 的 `monthStart(year, month)` 使用 1-based month；`:702`、`:703` 却将 0-based `getMonth()` 再减/加 1 传入。真实浏览器在公司日期 2026-11-04，标签 2026年11月：点击下一月后 anchor=2026-10、标签变为 2026年10月；重置今天后点击上一月，anchor=2026-08、标签变为 2026年8月。前后可见日期分别 10/26–11/29→10/12–11/22，以及 10/26–11/29→8/17–9/27。
- Expected: 从十一月分别定位十二月与十月，日历可见范围和年月标签一致。
- Actual: 下一月向后错跳；上一月跨过期望月份，日期锚点偏差又影响标签。
- Reproduction: 登录员工→首页→回到今天；记下年月；分别点击下一月、回到今天、上一月，比较所选年月和可见日期。
- Repair guidance: 统一月份参数约定，并使定位目标与最终可见锚点一致；不要只修标签。
- Acceptance checks: 任意月以及十二月/一月边界，上/下一月各移动恰一月；定位后继续横滑日期连续、无缺漏，回今天仍正确。
- Repair status: addressed-awaiting-verification
- Repair notes: 修复 `潘多拉-每日事项.js` 月份参数偏移、目标周块定位及宽屏滚动钳制；同步HTML缓存指纹。新增 `backend/scripts/check_daily_items_repairs_browser.js`，接入现有浏览器专项，覆盖全年12个月前后跳转、跨年、320/390/1440及短屏、横滑连续性和回今天。`python3 /private/tmp/redesign-home-daily-items-fix/run-suite.py`（运行原 check_daily_items.py，仅重定向输出）最终73项API/迁移及126项浏览器检查通过，新增69项回归；`python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /private/tmp/redesign-home-daily-items-fix/web-resources.json` 15/15通过。证据位于 `/private/tmp/redesign-home-daily-items-fix/redesign-home-daily-items/daily-items-browser.json`。
- Reverification notes: 专项原有 57 项只检查月份选择器/回今天，没有验证两个按钮；补充真实点击确认失败。

### V-002: 详情缺少可见返回清单入口，返回后丢失清单滚动位置

- Category: implementation
- Severity: high
- Requirement: `Daily-item lists details and reliable editing` 的分层返回要求、`Read every item and return through the layers`、`Keep controls usable on compact screens`；design Decisions 5。
- Evidence: `潘多拉-每日事项.js:548` 在压入详情前调用 withBack；`潘多拉-交互原型.js:1451` 仅当现有栈长度>1才生成返回，此时只有 list。通用 `renderSheet`（`:1404`）对非通知详情隐藏头部返回。实测栈 `[list, detail]`，底部仅“标记完成/编辑/删除”，headerBackVisible=false。`openDetail`（每日事项 `:557`）从初始化为 0 的 S.listScroll 取位置，未捕获打开详情前的 sheetBodyEl.scrollTop；`:765` 后续据此恢复。
- Expected: 可点击/触摸返回当天清单，并保持详情打开前的清单滚动位置；随后关闭清单恢复日历和焦点。
- Actual: 首次详情没有可见返回清单按钮，X 会关闭整个弹层；键盘 Esc 虽能退一层，但清单从 scrollTop=600 回到 0。
- Reproduction: 同日建立至少 60 条事项→打开清单（首屏 50 条）→滚到 scrollTop=600→点击当前可见行文本→查看返回按钮→按 Esc→读取或观察清单位置。实际标题回到“11月4日 · 每日事项”，位置为 0。
- Repair guidance: 为首次详情提供明确返回入口，在离开清单时保存实际滚动及触发行；各层返回统一恢复，不以曾经手动写入的初始位置代替当前滚动。
- Acceptance checks: 320/390/1440 下不依赖键盘即可从详情返回；长清单滚动后逐层返回保留位置和选中行焦点；编辑、移日、删除确认取消、Esc 和关闭清单分别保持正确层级与日历锚点。
- Repair status: addressed-awaiting-verification
- Repair notes: `潘多拉-每日事项.js` 提供详情/编辑/确认返回入口，进入详情前捕获实际清单位置及触发行，各层统一恢复；关闭时恢复可见日期锚点。`潘多拉-交互原型.js` 关闭按钮通过当前 closeSheet 执行，避免绕过模块恢复；更新HTML指纹。新增专项覆盖四种窗口尺寸、scrollTop=600返回及行焦点、编辑和删除确认取消、Esc、移日后原清单位置与双日计数、按钮和遮罩关闭。`python3 /private/tmp/redesign-home-daily-items-fix/run-suite.py` 最终73项API/迁移、126项浏览器通过；`python3 /private/tmp/redesign-home-daily-items-fix/run-regressions.py check_fixed_web` 员工166、管理端15、服务资源21项通过；同包装器 `check_calendar_drawer` 最终102项通过。公司日历首次手柄拖动断言失败，另一次因端口18193占用未执行，释放端口后完整重跑通过，未修改相关代码/断言。日志：`/private/tmp/redesign-home-daily-items-fix/check_fixed_web-final.log`、`check_calendar_drawer-final.log`。
- Reverification notes: 原检查只证明分页和部分保存后返回，未证明“普通首次详情→返回”按钮及非零清单滚动。

### V-003: 键盘移动到已挂载但不可见的日期时不滚动日历

- Category: implementation
- Severity: medium
- Requirement: `Separate sliding from activation`、`Keep controls usable on compact screens`；design Decisions 4 的键盘日期浏览。
- Evidence: `潘多拉-每日事项.js:425` focus 使用 preventScroll=true；`:450` 附近只有目标不存在 DOM 时才 goToDate，未处理“存在但不在可视窗口”。实测从公司今天 2026-11-04 聚焦日历，连续按 ArrowDown 8 次，selected 和焦点均为 2026-12-30；单元格 left=527/right=573，而日历 viewport left=57/right=367，visible=false，scrollLeft=536。
- Expected: 键盘浏览相邻日期范围时，当前焦点日期应保持可见，并能明确识别将打开的日期。
- Actual: 焦点落在窗口外；Enter 仍可打开不可见日期清单。
- Reproduction: 首页→回今天→聚焦日历区域→连续箭头移动跨过当前横向窗口→比较 document.activeElement 与 dailyScroller 的 boundingClientRect。
- Repair guidance: 每次键盘移动同步保持目标格可见；兼顾前插/裁剪和固定星期表头，不只在目标未挂载时定位。
- Acceptance checks: 左右两侧越过窗口边界、跨月/跨年、Home 和未挂载日期均保持可见焦点；Enter/Space 打开当前可见焦点日，关闭后恢复焦点且无整页横移。
- Repair status: addressed-awaiting-verification
- Repair notes: `潘多拉-每日事项.js` 每次聚焦按目标格与窗口边界最小横滚，更新锚点并使旧异步月份定位失效；隐藏首页不改写浏览状态。更新HTML指纹，新增浏览器回归逐步测量焦点可见性，覆盖左右边界、跨月/年、前插与未挂载日期、远月Home、Enter/Space及关闭后恢复。`python3 /private/tmp/redesign-home-daily-items-fix/run-suite.py` 126项浏览器检查通过；公司日历102项及员工166项最终回归通过。JS语法及 `git diff --check` 通过；`mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package` 111项测试通过，最终静态资源重新打包并通过15项资源检查。证据：`/private/tmp/redesign-home-daily-items-fix/redesign-home-daily-items/daily-items-browser.json`、`/private/tmp/redesign-home-daily-items-fix/maven.log`。
- Reverification notes: 原检查只判断存在焦点和 Enter 能开清单，没有比较焦点格与窗口相交。

### V-004: 退出登录后仍保留每日事项私有缓存和编辑草稿

- Category: implementation
- Severity: medium
- Requirement: `Isolate sessions and out-of-order responses`；design Decisions 5 要求退出/失效/换账号立即清理状态、弹层、版本与缓存。
- Evidence: `潘多拉-每日事项.js:70` resetForSession 仅在后续有 profile 的 render 中清理，`:73` 无 me.id 直接返回；模块未注册 P.sessionReset。`潘多拉-api.js:92` clearData 调用 reset callbacks，但因此不包含每日事项；通用 `潘多拉-交互原型.js:1635` clearDrafts 仅清任务/日志。实测当天清单→详情→编辑→await Pandora.logout()→已显示登录表单且 Pandora.ready=false：lists.size 仍为 1，summaries.size=6，drafts.daily.body 仍为 `Verifier daily 00`，缓存首条正文仍相同，S.account 仍是旧员工 ID。
- Expected: 退出或会话失效即清除所有每日事项正文缓存、草稿和账号相关状态，旧请求不能再填回。
- Actual: UI 已退出并关闭弹层，但私有数据和编辑草稿留在内存；要等另一账号成功渲染才清理。
- Reproduction: 员工打开有事项日期→编辑任意项→退出→确认登录表单出现→读取 PandoraDaily.state.lists/summaries、drafts.daily、PandoraDaily.state.account；不重新登录。
- Repair guidance: 将每日事项完整状态清理接入真正的会话 reset 生命周期，并使清理期间的迟到请求失效；保留普通同账号页面切换的浏览位置。
- Acceptance checks: 主动退出、401 失效、切换组织/账号后立即检查缓存和草稿为空、账号状态已重置；注入延迟 list/summary/detail 响应也不得复活旧状态；重新登录其他员工不显示前人正文/数量，同账号正常切页仍保留锚点。
- Repair status: addressed-awaiting-verification
- Repair notes: `潘多拉-每日事项.js` 注册 `P.sessionReset`，立即清除账号、日历/锚点、清单/汇总、详情、草稿版本、焦点引用及滚动计时器；新增会话generation使迟到清单/详情和定位回调失效，汇总继续使用单调查询token。同步HTML指纹并新增真实认证回归：有缓存及草稿时退出、撤销服务端会话触发401、切换组织账号；分别延迟真实list/detail/summary响应至清理或新登录后释放，确认旧状态不复活。`python3 /private/tmp/redesign-home-daily-items-fix/run-suite.py` 最终73项API/迁移和126项浏览器通过；原有同账号切页锚点恢复及第二员工零计数检查同时通过。证据：`/private/tmp/redesign-home-daily-items-fix/redesign-home-daily-items/daily-items-browser.json`。
- Reverification notes: 已证明内存清理不符合要求；未发现或声称跨账号可见 UI 泄漏、服务端越权。原专项的“登录另一个账号后为零”不覆盖退出瞬间。

## Next Action

运行 `$openspec-e13-fix-change redesign-home-daily-items` 修复 pending implementation findings，随后重新执行独立验证；本轮不进入修复或归档。再次验证须重验 4 项发现和对应返回/会话/日历回归，并补齐上表 mandatory 子情形的证据，方可考虑 PASS。
