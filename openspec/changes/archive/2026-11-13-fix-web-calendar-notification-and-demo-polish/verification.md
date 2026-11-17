# Implementation Verification

- Change: `fix-web-calendar-notification-and-demo-polish`
- Schema: `spec-driven`
- Verdict: **PASS**
- Verified at: 2026-11-13T13:08:16+08:00
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice`（实现与规划共用此根）
- Verified revision: `095ed237a8d60f34bed3ceadb6026369d0b09f49` + dirty；修复代理仅修改 `backend/scripts/check_web_alignment_drag_browser.js`，验证流程仅维护本报告及生成的状态文件。

## Summary

六项修复的当前独立验证通过：通知固定高度、事项红蓝灰及缓存同步、月历短按/长按、下属轨道和溢出列、本人的入职信息去重、真实演示双标签。本轮重新执行月历对齐52项及排期149+7项浏览器断言，两条完整命令均exit0；确认V-001已解决，无本change待处理发现。

本轮唯一输入变化是回归脚本适配月历500ms长按；产品、依赖和规划不变。保留先前独立通过的后端129项、通知113项、事项284项、下属100项、chapter8浏览器46项、演示94项及四角色50项、任职契约42项、共用标签26项、资源15项，以及跨周/月事项五清单/三段条和四视口下属几何/命中证据。E12的既有身份文案断言仍过时，不将该整套检查记为通过。

尚无真实手机证据。CDP合成触摸已执行，但不证明物理震动、原生滚动惯性或实机边缘长拖动；前置 change 报告的环境问题V-005仍未解决。本轮task 7.1允许如实记录无实机限制，不将该限制伪写为实测通过。归档还依赖先完成/同步 `align-web-employee-client-with-nov08-guidance`，本轮不修改或归档它。

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| 实现、依赖配置、检查、主规格及全部当前规划 | 上述提交及单一测试修复，脚本生成655文件输入清单；不限于apply implementation map。 |
| `verification-state.json` | SHA-256 `4fb2fec99de0cdc8c85c1a94c61987f58cc13e5e8c2445e2c9bfdb118caa3a56`；输入快照，不是655文件逐项测试通过的声明。 |
| 上轮独立验证基准 | 保存state实算SHA-256为 `7ef6cf6dd2d1fec49e52e863af67b8df44da718ff2f53407b66a7cd13a032713`，与上轮报告一致；compare仅列出上述JS修改，无新增/删除或根/排除范围变化。 |
| 本轮执行副本 | `/private/tmp/web-polish-verify-iv_a88m_`；修复代理同步最终测试后，验证者逐一核对655份SHA-256，0处不匹配，再独立执行两条完整命令。验证者未修改该副本的实现或测试。 |
| 执行环境 | 同一本机Java/Maven/真实headless Chrome及独立MySQL 26.10.0；独立数据目录、新凭据和随机夹具库均位于上述临时副本。沿用先前独立构建、源码未变的JAR；唯一变更的JS是外部测试脚本。检查结束已关闭临时MySQL，原项目数据库目录及历史audit未改动。 |
| 前置独立证据 | `../align-web-employee-client-with-nov08-guidance/verification.md`及其state；state实算SHA-256为 `aeab69eb5d78cdc823fba6dd37e43b90ab45b421d3485e6bc5ac4bf5918767ba`，与其报告一致。它整体仍为BLOCKED，不引用其为整体PASS。 |
| 检查期间输入变化 | before/after比较exit0、`changed:false`；生成的after原样复制为本change状态文件。 |

本轮为修复后的增量验证。完整重读当前proposal/design/tasks/spec、implementation notes及既有报告，逐段检查唯一修改的测试：两个助手、独立续接段和边缘流程共用按mode分支的mouseDown，月历320ms仍pressing且无preview/ghost，累计740ms已激活后才移动；日轴无等待并断言即时激活。原二维落点、完整续接任务差量、取消与日界限断言全部保留。独立重跑E05/E08，严格OpenSpec校验、语法和diff检查；修复代理自报结果不作独立证据。其余产品、测试、配置、依赖和规划与上轮清单一致，且本轮改动仅影响此测试的输入手势，故保留上轮E01–E04、E06–E07、E09–E12、P1及静态审查中明确通过的证据，不重复构建或扩大无关套件。

仅复用前置独立报告中未受影响的细分证据：E07 table的完整服务端分页/排序/置顶（172项），E13中人员暂时失败/失权及通知120条返回/分页失败的已解决反例（100项套件中的相应部分）。对其保存清单和当前输入的比较确认，除本change的19个backend/Web文件外无该范围源码差异；后端业务服务、这些补充测试、工作区接入JS、依赖声明不变。当前个人资料JS的差异仅readonlyRows和+N定位，未改变人员重试/失权逻辑；已逐段审阅。当前通知/人员/单元检查又覆盖集成，故保留这些明确行为的先前独立证据。**不复用旧鼠标拖动结论**，因为门槛实现已改变；也不把apply的检查日志当成本轮独立证据。

快照采用 `git-tracked-and-unignored`。排除 `audit/*`、`output/*`、`backend/target/*`、`backend/.runtime/*`、`**/node_modules/*`、`**/__pycache__/*`（生成证据、构建、运行数据、缓存）。源码、测试、依赖、配置和控制规划均保留；脚本自动排除.git及handoff/report/state，handoff另行阅读。根内Android/Flutter输入虽被库存，但不宣称测试其功能。

```sh
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture \
  --root /Users/watuji/MyGitDev/software_test_practice \
  --exclude 'audit/*' --exclude 'output/*' --exclude 'backend/target/*' \
  --exclude 'backend/.runtime/*' --exclude '**/node_modules/*' \
  --exclude '**/__pycache__/*' --output /private/tmp/web-polish-reverify-before.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare \
  openspec/changes/fix-web-calendar-notification-and-demo-polish/verification-state.json \
  /private/tmp/web-polish-reverify-before.json
# exit1；仅修改backend/scripts/check_web_alignment_drag_browser.js。
# 以相同capture参数生成 /private/tmp/web-polish-reverify-after.json，随后：
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare \
  /private/tmp/web-polish-reverify-before.json /private/tmp/web-polish-reverify-after.json
# exit0，changed:false；after原样复制为verification-state.json。
```

## Apply Handoff Review

已完整阅读本change `implementation-notes.md`及proposal/design/tasks/spec。notes正确标识change及项目，但仍写`4ec2ff3 + dirty`；实现现在已提交为095ed23，该revision/未提交说明过时。17个勾选任务和其中声称的PASS仅作调查线索。

| Reminder | Disposition / independent evidence |
| --- | --- |
| 前置Web规格及归档顺序 | 确认。严格验证valid，但INFO指出主规格尚无`Daily-item span labels and status`；前置delta定义了它，前置报告仍BLOCKED。归档先前置、后本轮；不是本轮代码缺陷。A契约change已归档，B Flutter尚未归档；本次按AGENTS询问后用户明确选择先验证本change。 |
| 合成触摸与真机界限 | 确认。E05实际合成短按/700ms长按，E08实际合成滚动候选取消/无位移/二维落点与haptic调用；没有真实设备，不关闭前置V-005。 |
| 未运行start-demo.sh | 确认。E07使用新随机演示库，验证两次准备、重启和真实编辑保留；S逐条核对启动脚本默认重建/--keep/跳过构建及README。没有重建用户演示库，也没有执行回退部署。 |
| 通知固定高度只约束列表 | E03确认。关闭移除状态、其他弹层不带该类、详情不继承、返回恢复；四视口矩形保持。 |
| toggleItem逐份清单缓存同步 | E04及P1确认。原3日回归通过；额外跨月五份清单/三段条完成、取消、刷新一致。未加载分页仍从服务读取，不将缓存视为全量。 |
| 人员+N依赖七列网格 | S及E06/P1确认。显式grid-column与七列相符，稀疏周四/周日完整计数；四视口中心点命中通过。 |
| 既有检查重写历史证据 | 已规避。所有有输出副作用的检查在临时副本执行，未接受覆盖历史audit文件作为验证边界的例外。 |

## Checks

下列命令除OpenSpec/快照/Git外均在临时副本的 `backend/` 执行，完整源码与当前快照匹配。本轮新执行OpenSpec校验、快照比较、E05、E08、`node --check backend/scripts/check_web_alignment_drag_browser.js`和`git diff --check`，均通过；其他行及P1沿用上述范围内先前独立证据。临时日志`parent-reverify-alignment.log`及`parent-reverify-schedule.log`仅作辅助定位，决定性观察及复现方法保存在本报告。

| ID / Command or inspection | Result | Notes |
| --- | --- | --- |
| `openspec status --change ... --json` / `openspec instructions apply --change ... --json` | spec-driven / all_done | 本地仓库，17/17；未使用store，未把任务状态当成行为证据。 |
| `openspec validate fix-web-calendar-notification-and-demo-polish --type change --strict --json --no-interactive` | PASS | valid，1/1；另有上述前置规格合并INFO。 |
| E01 `mvn -o -B -ntp -DskipTests -Dmaven.repo.local=/Users/watuji/MyGitDev/software_test_practice/backend/.runtime/m2 package` | PASS | 从临时副本源码新建JAR，不复用apply的旧JAR。 |
| E01b 同仓库参数 `mvn ... test` | PASS 129 | 0 failure/error；首次沙箱内4个HTTP源测试因禁止绑定端口而error，获授权在沙箱外原命令重跑后全通过。 |
| E02 `python3 scripts/check_web_resources.py --repo .. --jar target/pandora-backend-0.1.0.jar --output ../resources.json` | PASS 15/15 | 内容版本、模块顺序、Maven白名单及包内字节一致。此脚本检查包内资源，不冒充对用户8080部署的在线字节核验；E03–E11的真实服务使用此新JAR。 |
| E03 `python3 scripts/check_apply_notifications.py` | PASS 24 API + 89 browser | 真实提醒/审核/标读和组合条件；可控响应注入验证加载、单条、空、失败、分页外框，不以mock证明服务端分类。 |
| E04 `python3 scripts/check_daily_items.py` | PASS 73 API/迁移 + 211 browser | 三态、真实正文、语义、日期读写、加载/返回/分页、跨日缓存。原始JSON在临时副本audit。 |
| E05 `python3 scripts/check_schedule_drag.py` | PASS 149 + 7 browser | 共156 browser断言，主阶段149、过期重启阶段7；同时Python最终断言通过。notes的158计数不能代替实际报告。真实鼠标短按端点/条/数字/空日/跨日中间日/+N，鼠标长按门槛、日轴原规则、失去捕获、确认/审批/响应丢失重试均通过。 |
| E06 `python3 scripts/check_subordinate_workspace.py` | PASS 100 browser | 四视口截图、稀疏周四/周日、只读/评论/详情返回、密集完整清单、待审虚线；E06自身逐轨几何主要在390×600，P1补齐四视口。 |
| E07 `python3 scripts/check_final_demo.py` | PASS 94 + roles browser 50 | 首次与E04同时运行冲突于18194，未进入业务判断；E04结束后单独原命令重跑通过。新随机库`pandora_precheck_demo_4d0af9bd7204`，两次准备/重启/编辑保留，62任务、12日志、10公司事项；核实两任务两日志双标签。 |
| E08 `python3 scripts/check_web_alignment_drag.py` | PASS 52 browser，exit0 | 本轮独立重跑：月历门槛前无拖影/后激活、触摸候选取消/长按、二维鼠标、续接完整任务、边缘滚动/Esc、日轴即时激活及午夜边界均到达；Python通用跨日API返回200。修复V-001的先前失败保留在finding，未跳过或删除分支。 |
| E09 `python3 scripts/check_chapter8_web.py` | PASS 46 browser | 本人各一行、组织区零行；清空hireDate后空态、四视口、事项表单及真实服务端任务表。 |
| E10 `python3 scripts/check_employee_contracts_upgrade.py --skip-witness --only hire --port 18320` | PASS 42 | 闰日/月末/公司今天、可空日期、摘要隐私、旧上级失权/新上级授权、管理员真实维护；本轮不重复不受影响的完整迁移witness。 |
| E11 `python3 scripts/check_calendar_tags.py` | PASS 15 API + 11 browser | 有序首标签换序取色、详情全部标签及删除快照、共用目录隔离/权限；未增加私人标签。 |
| E12 `python3 scripts/check_apply_profile_pin_history.py` | 12 API + 23 browser通过，旧断言失败 | 第24个browser断言在`:38`仍要求`员工 · 部门负责人 · alpha · one`，实际`alpha ▸ one ▸ 部门负责人`符合当前隐藏身份规格。该断言及staffOrgLine在本change前即已存在且未改，不归因于本次去重，也不采用其过时预期为验收标准。未执行到的尾部不记PASS。 |
| P1 临时真实服务/Chrome边界观察 | PASS | 18340随机夹具；跨月五清单/三段条，以及四视口下五周逐轨/隐藏条/+N命中，详见下方复现步骤；只执行内联观察命令，未新增测试文件。 |
| S 当前diff/渲染/样式/种子/启动审查 | 符合本轮范围 | readonlyRows仅本人组织区；下属卡未删字段；颜色/aria与用户正文分离；旧44/28px显式轨道约束已清；seed保留tag-focus并使用现有业务写入；无API、Flyway迁移、Android/套壳/Flutter/PC管理实现修改。 |

通知外框独立观察：390×844为top14/height830，加载/空/单条/错误/分页/模式切换前后不变；320×740为14/726，1440×900为24/852，390×600为14/586。内容超高时body滚动，详情不带专用类，返回恢复。

事项computed style：待做边色`rgb(59,111,216)`、完成`rgb(139,143,152)`、逾期`rgb(192,70,58)`；列表/详情无重复状态徽标与跨日说明，aria状态/完成操作仍在，正文中的同词未改写。演示目录色`#F6D5D2`/`#D8EAF4`，`task-doing`及`log-employee-0`顺序为focus→animation，`task-employee-3`及`log-middle-0`为animation→focus，无标签对照保持空集合。

P1可重复操作（使用`fixed_model_fixture.Fixture(port=18340)`的新随机库与当前JAR）：

1. 创始人真实登录，POST `/daily-items`，范围2032-01-30至2032-02-03，正文`跨月已完成正文保留`；另POST五条分配给同一真实下属的同范围任务。
2. 浏览器正常登录创始人，`PandoraDaily.goToDate('2032-02-01')`，待January/February两个`state.records`均ready；分别`PandoraDaily.openList(date)`打开五个日期以预载清单，再从2月1日清单点击该记录的`daily-toggle`。
3. 观察五份`PandoraDaily.state.lists`各仅一条同ID、completed=true，三个`.daily-bar[data-id]`片段均灰；从1月30日清单取消后五份false/三个片段蓝。`Page.reload`并重新读取，仍全部false且日期/正文逐字一致。
4. 从正常人员卡进入只读日程并定位2032-02-01，在320×740、390×844、1440×900、390×600逐周读取矩形；每种视口5周，轨道未越日期/溢出区/相邻周，隐藏条零尺寸，3个溢出入口列位正确，滚入视口后`elementFromPoint`中心均命中该按钮。没有业务写入手势或页面样式注入。

## Requirement Coverage

覆盖当前delta全部6项规范及52个场景。下列场景名逐一引用；组合行共享同一证据，不省略未执行/缺口。S表示当前静态追踪，R表示上文范围明确的前置独立证据。通过表示所列执行/追踪支持的行为，不包含实机或实际部署声明。

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| **Notification list presentation and combined filters**（规范整体） | `潘多拉-工作区接入.js`通知查询/视图、`潘多拉-交互原型.js`renderSheet、`潘多拉-正式版.css`；E03、R | 分类/组合/固定框通过；四视口外框及内部滚动独立实测。 |
| Filter across page boundaries；Require actionable review classification | E03真实API；R的120条合法分页/返回/失败原子保留 | 通过。 |
| Return after opening an unread notification；Classify actual reminder events across pages | E03真实worker的20/10/5/overdue、标读/详情/组合总数 | 通过。 |
| Keep narrow-screen filters available while scrolling；Restore mode filters and position after reading | E03及R；当前sticky/筛选状态追踪 | 通过；不以受控渲染响应代替真实权限检查。 |
| Keep the notification frame stable for every result state；Adapt the fixed frame to the viewport and restore it on return | E03上列四组矩形、详情/其他弹层状态检查 | 通过。 |
| **Daily-item span labels and status**（规范整体） | `潘多拉-每日事项.js/.css`；E04、P1、S | 条/清单/详情红蓝灰、辅助语义、旧/新范围刷新和缓存更新通过。 |
| Change one record's state across every covered date；Synchronize completion colors across a ranged item | E04三日同步；P1跨周/月五日、三段条、完成/取消/刷新 | 通过。 |
| Read long names and dense days without pinch gestures；Render three states without repetitive visible labels | E04全量清单/条外入口/正文与aria、computed style；E09 | 通过；实际日期及完成控件保留。 |
| **Calendar dragging by presentation**（规范整体） | `潘多拉-日程视图.js`候选/拖动/命中/取消、原排期后端；本轮E05/E08、S | 通过；V-001已独立验证解决。实机限制仍保留。 |
| Move an entire month bar by dates；Resize a month endpoint by days | E05鼠标月历长按、跨年端点/整条时刻工期、确认/API；E08二维鼠标及续接段 | 通过；月历等待长按后实际命中另一星期行，时刻/工期保留。 |
| Adjust day events and the all-day section by hours；Prevent dragging any clipped cross-day segment | E05横/纵日轴、零时长、全天/跨日首中尾、午夜截止 | 通过。 |
| Separate canvas interactions from task-detail permissions | E05资格检查、E06本人/下属隔离与嵌套仅评论；S表单不绑定 | 通过。 |
| Preserve cancellation and stale-version boundaries；Preserve the lightweight draft on failure | E05 Esc/pointercancel/失去捕获/无位移、旧版本/失权及响应丢失同键重试 | 通过。 |
| Confirm a monthly drop in a lightweight sheet；Reject day-view proposals crossing midnight | E05原/新排期、原因/提交及批准/拒绝/撤回/过期，日轴越界拒绝 | 通过；日轴鼠标仍即时激活。 |
| Activate a mobile drag only after a long press；Separate a monthly long press from scrolling and clicking | E05/E08合成触摸候选取消、长按、无位移、二维落点及haptic调用；S | CDP支持；真实手机的滚动交接、物理震动、边缘连续拖动仍未验证，前置V-005保留。 |
| Drag a continued segment across rows months and years | 本轮E05跨年、E08续接/边缘及S抓取日/完整任务差量 | 通过。续接段无假端点，完整任务按抓取日差量移动，确认保留04-12至05-03及09:00/11:00；边缘实测scrollTop 2596→2902、月份流仍5块，未把此次滚动冒充新增月份；E05跨年与连续补载实现审查共同支持跨月/年路径，Esc后无拖影且确认层隐藏。 |
| Open the hit day through real short presses | E05真实鼠标数字/空日/条/端点/跨日中间日/+N；合成触摸条短按；S共用命中路径 | 鼠标所列入口通过，触摸条通过；没有将其扩大成所有入口的实机结果。 |
| **Minimal profile page**（规范整体） | `潘多拉-个人资料.js`readonlyRows/renderMe/staffCardView；E01b/E06/E09/E10/E12部分、S | 本人去重、下属保留、合法资料/授权及任职算法通过；E12过时身份预期单独注明。 |
| Read and edit the required profile；View profile；Keep identity fields read-only to employees | E01b ProfileService/Auth测试、E09允许字段/入口、E10禁止员工维护hireDate、S | 允许本人维护与组织/身份字段服务端边界保留。改密/退出沿用未改链路及Auth测试，不将E12未执行尾部记通过。 |
| Open a subordinate within both profile scope and the management chain；Read contact details only inside the actual management chain | E06实际多级/其他链拒绝，E10改派旧上级失权/新上级可读及摘要无隐私 | 通过。 |
| Refresh a known person without losing organization fields | E12失败前独立通过姓名摘要、完整更新、显式null、迟到/切账号缓存断言；S | 通过；其后旧identity文案断言不参与此证据。 |
| Calculate completed tenure at calendar boundaries | E10 42项及E01b TenureTest | 闰日/月末、完整年月日、公司今天和null通过。 |
| Hide identity while retaining actual organization and permissions；Show empty subordinate contacts and tenure | E06真实/缺层路径，E09本人缺层/未设置空态，E10投影/隐私，S下属空行 | 通过；E12实际路径也符合，旧预期与当前规范冲突。 |
| Show own employment fields once；Preserve subordinate employment details | E09四视口1/1/0/0，E06下属各字段仍一行，E10日期空/非空；S调用方限定 | 通过。 |
| **Subordinate calendar month and day views**（规范整体） | `潘多拉-个人资料.js`staffWeekHTML/staffOverflowHTML、`潘多拉-手账主题.css`；E06/P1、R | 连续日历、正常流三轨/+N、只读、失败/失权及返回状态获得支持。 |
| Navigate months days and overflow；Distinguish completed and pending tasks in every presentation | E06真实跨周/月/年、午夜/零时长、完成与待审虚线/提议位置、日轴/全天/清单 | 通过。 |
| Reuse personal calendar browsing without changing its owner；Keep long-list actions visible | E06所选人员/本人隔离、清单→详情返回、仅评论/无调时；S清单固定操作区 | 通过。 |
| Continue across years and recover a failed adjacent load | E06跨年/人员日期模式返回，R已解决的网络/500重试和403/移除清除反例；S加载逻辑未改 | 通过；原failure与失权证据按明确影响范围复用。 |
| Keep dense month rows and overflow separated；Anchor sparse overflow to its actual date | E06周四/周日+1分别列4/7、首周空位、13任务完整清单、键盘入口；P1四视口几何/命中 | 通过。 |
| **Persistent demonstration data for web and administration**（规范整体） | `DemoSeed.java`及prepare/start-demo；E07/E11，S | 真实四角色/稳定ID/默认密度、共用双标签、准备保留与启动语义获得支持。未执行用户库重建。 |
| Run a continuous demo after refresh；Prepare a complete repeatable new-model demonstration | E07两次准备/重启/数据库完整性/真实页面，R独立表单全量分页 | 通过；极限数据仍隔离，不将默认少量数据声称为超两页压力。 |
| Follow the four real animation roles；Demonstrate every protagonist's own work and task chain | E07四角色50项、本人正常任务/主管链、真实父子/审核/接管/资料/日志/通知 | 通过。 |
| Preserve edits and keep extreme fixtures separate；Prepare a current dataset without resetting edited data | E07旧准备日/版本/两次准备/业务及管理员编辑保留；S种子早退与极限夹具未改 | 通过；保留模式不承诺补写新增标签。 |
| Exercise the new Web interactions using real records | E07正常短任务/逾期、三态事项、近期日志和通知，E05实际拖动/审批 | 通过。 |
| Demonstrate multiple tags on tasks and logs | E07两任务/两日志真实有序API读回，E11同一首标签取色/详情全部标签；S日志逐标签渲染 | 通过；角色脚本只证明页面可达，未伪称它逐个点开所有新样本。 |
| Rebuild for new samples while keeping preservation semantics | E07新空随机目标及重复准备/重启/编辑；S对照start-demo默认drop/create、--keep、skip-build | 允许的隔离准备链与静态启动核对通过；未运行默认用户演示库重建，符合design决策7。 |

## Findings

### V-001: 相邻月历鼠标回归仍按即时拖动，未适配500ms长按

- Category: implementation
- Severity: low
- Requirement: `Calendar dragging by presentation / Separate a monthly long press from scrolling and clicking`、`Drag a continued segment across rows months and years`；design决策7要求现有鼠标拖动助手仅对月视图增加等待，保留二维/跨月/边缘回归。
- Evidence: 修复前的 `backend/scripts/check_web_alignment_drag_browser.js:31`按下后`:32`立即移动，`:33`立刻断言存在`.p-drag-preview`；原`:41`–`:43`的另一助手及`:143`–`:144`的边缘流程也没有等待。产品 `潘多拉-日程视图.js:996`对月历鼠标进入500ms候选，门槛前超容差移动安全取消。先前独立运行`python3 scripts/check_web_alignment_drag.py`，19个browser断言通过后，在`mouseDragToDate`原第33行得到`FAIL drag preview follows the pointer undefined`，exit1；E05同JAR使用等待长按的助手正常通过。
- Expected: 月历鼠标回归模拟达到门槛后再移动，先证明门槛前无拖影，再验证二维落点、续接完整任务、边缘补载及取消；日轴鼠标仍按原即时规则检查。
- Actual: 修复前合法的新产品行为使旧助手稳定失败，整套相邻回归在二维鼠标路径提前退出；续接和边缘分支未执行。修复后完整套件通过，产品保持长按规则。
- Repair guidance: 将该脚本全部月历鼠标手势入口适配500ms等待及激活断言，包括两个助手和独立边缘流程，保持日视图规则及后续断言；不要跳过失败、删掉覆盖或改回产品旧交互。
- Acceptance checks: 当前JAR执行`python3 scripts/check_web_alignment_drag.py`完整exit0，实际到达二维鼠标、续接段、边缘补载/Esc和日界限分支；`python3 scripts/check_schedule_drag.py`继续通过，并保留短按/门槛前无拖影/日轴即时鼠标断言。
- Repair status: verified-resolved
- Repair notes: 修复代理先在 `/private/tmp/web-polish-verify-iv_a88m_` 以当前095ed23源码/JAR安全复现：原脚本第20个browser断言 `drag preview follows the pointer` 失败、exit1。仅修改 `backend/scripts/check_web_alignment_drag_browser.js`：point返回mode，两个鼠标助手、独立续接段及边缘流程共用mouseDown；月历320ms断言仍pressing且无preview/ghost/dragging，累计740ms断言已激活后才移动；日轴不等待并明确断言立即激活，保留全部后续断言。同步该测试到隔离副本后执行 `python3 scripts/check_web_alignment_drag.py` 完整exit0（52/52 browser，包含二维鼠标、续接完整任务差量、边缘补载/Esc、日轴边界；通用跨日API200）；`python3 scripts/check_schedule_drag.py` 完整exit0（主阶段149及过期阶段7个browser断言、响应丢失恰一请求和过期不发布的Python断言通过）。`node --check backend/scripts/check_web_alignment_drag_browser.js` 与 `git diff --check` 通过。执行仅使用临时副本独立MySQL和随机检查库，未触及用户演示库或原仓库audit/output；保留独立MySQL供主代理复验。未改产品、规划、tasks或verification-state.json；以上是repair结果，等待独立复验。
- Reverification notes: 验证者独立审阅单一JS diff，全部4个鼠标入口均共用mode分支，未删原断言或修改产品。与当前655文件清单逐项一致的隔离副本中，独立重新执行两条完整验收：alignment为52/52 browser及通用跨日API200、exit0；schedule为149+7 browser、响应丢失恰一请求及过期不发布断言、exit0。月历320ms无拖影/ghost且仍pressing，740ms后dragging/preview/ghost均成立；日轴3处即时激活断言通过；二维、续接、边缘Esc及日界限后续分支均实际执行。`node --check`及`git diff --check`通过，before/after输入无变化，故标记verified-resolved。没有采用修复代理日志替代本轮执行。

## Next Action

本change独立验证PASS；归档入口为 `$openspec-e13-archive-change fix-web-calendar-notification-and-demo-polish`。归档仍须先完成前置 `align-web-employee-client-with-nov08-guidance` 的独立验证及规格同步/归档，其实机环境V-005仍未关闭；当前OpenSpec INFO明确主规格缺少继承要求，直接归档本轮会被拒绝。本轮不自动归档或改动前置change。相关实现、测试、依赖或规划变化后需重新验证。
