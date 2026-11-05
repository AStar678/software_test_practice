# Implementation Verification

- Change: `refine-home-daily-items-layout-and-scrolling`
- Schema: `spec-driven`
- Verdict: **FAIL**
- Verified at: 2026-11-05T15:53:12+08:00
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice`（实现与规划同根）
- Verified revision: `50062f3207f447e1ab61833afa93fdadc43baee5`；验证开始时工作区干净，验证仅新增本报告及脚本生成的状态文件。

## Summary

刷新后直接双向横滑、上方至少三行、独立月份空位、年月位置、薄荷绿标题栏加号、按总数绘制唯一标记等核心改动均有本轮独立运行证据。现有专项全部通过，但补充浏览器检查确认了切页返回后快速翻月被过期布局任务覆盖的问题（V-001，medium），不满足设计明确要求的旧工作取消及返回后的可靠导航，不能归档。

验证期间用户补充指出新增表单不应显示解释性文字。实测确认内容框下仍显示“每日事项仅本人可见，可填写过去、今天或未来的日期，最多 2000 字。”，记为 V-002（low）。该文案在前一版已存在；这是用户本轮明确提出的验收修正，不误称为本 change 新引入的回归，也不据此倒推原规格曾禁止该文案。

31 个规格场景均建立了覆盖映射；其中切页返回场景的快速操作分支失败。未修改实现、测试、规划、任务勾选或 implementation-notes。下一步执行 `$openspec-e13-fix-change refine-home-daily-items-layout-and-scrolling`，修复后重新独立验证。

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| `proposal.md`、`design.md`、`tasks.md`、`specs/pandora-requirements-aligned-prototype/spec.md` | 当前磁盘版本，全部读取；四项修改要求、31 个场景、18/18 勾选任务；勾选不作为通过证据 |
| `implementation-notes.md` | 当前磁盘交接；标注 `5998c3d` 加未提交改动，其列出的实现已提交于 `50062f3`；逐项核对，未复制其验证结论 |
| 员工 Web JS/CSS/HTML、浏览器/API 检查、后端及构建配置 | 下列快照的 400 文件清单；重点检查 `潘多拉-每日事项.js/.css`、资源指纹、专项入口及调用关系 |
| 后端 Java、迁移及 `backend/pom.xml` | `git diff f73dfcf..HEAD` 对应范围为空；仍独立重跑相关 API、工作区与公司日历回归 |
| 用户新增验收反馈 | 本轮会话：“我发现新增事项里面有行不应出现在真实产品里的的解释性文字”；具体显示内容经真实表单 DOM 核实，见 V-002 |
| 其他活跃 change | `refine-notifications-task-editing-and-staff-browsing` 仍为 0/38；用户此前明确要求暂不处理，本轮未修改 |

这是本 change 的首次独立验证，没有可比较的既有 `verification-state.json`；首次比较报缺失文件（exit 2），因此采用全量场景覆盖，不复用 apply 自报结果或旧归档 PASS。构建、测试与浏览器观察均在本轮独立执行；implementation-notes 中 111 项 Maven 单元测试及实施前故障记录仅为背景，本报告不将它们计作本轮实测。

最终 `verification-state.json` SHA-256：

`3eba74af552a67710d6d98fdfe30e3e1ab0d11326e50bb5bc5c6acd6948e8a8e`

快照由技能附带脚本生成，未手填路径或哈希：

```sh
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture --root /Users/watuji/MyGitDev/software_test_practice --exclude 'audit/*' --exclude 'backend/target/*' --exclude 'backend/.runtime/*' --output /private/tmp/refine-home-daily-verify-before.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare openspec/changes/refine-home-daily-items-layout-and-scrolling/verification-state.json /private/tmp/refine-home-daily-verify-before.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture --root /Users/watuji/MyGitDev/software_test_practice --exclude 'audit/*' --exclude 'backend/target/*' --exclude 'backend/.runtime/*' --output /private/tmp/refine-home-daily-verify-after.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare /private/tmp/refine-home-daily-verify-before.json /private/tmp/refine-home-daily-verify-after.json
cp /private/tmp/refine-home-daily-verify-after.json openspec/changes/refine-home-daily-items-layout-and-scrolling/verification-state.json
```

前后比较 exit 0、`changed:false`，实现及规划未在验证期间变化。排除项为生成审计证据、构建输出及本地 Maven 缓存；Git 忽略文件依脚本规则不纳入。脚本自动排除同名 workflow handoff/report/state 文件及 `.git`。有关源码、测试、依赖声明、配置及控制本 change 的规划均保留。快照说明输入范围，不代表全范围功能已经通过。

## Apply Handoff Review

交接文件为同目录 `implementation-notes.md`。其任务/文件映射与当前提交一致；提交号描述停留在提交前，已据实际 HEAD 校正。十项提醒处理如下。

| 提醒 | 处理及证据 |
| --- | --- |
| 最多 12 月，裁剪后删除 summary，重访需回读且不能假零 | 独立真实手势向前 16 次、反向 30 次，所有窗口 ≤12 月且日期唯一；另对已知非空的 2026-12 月离线回读，读数为“数量加载中”而非零，恢复网络重试得到真实 4 条完成标记。已确认 |
| 加号选择器须覆盖 tiny-btn 的 44px 最小高度 | 核对 `.daily-head .btn.daily-add` 优先级及专项计算样式；32/34px 标题按钮、目标四视口同一行可见，上方内容预算成立。已确认 |
| 月头 overflow:visible 依赖块宽防重叠 | 四视口及日期边界月份均测完整标签、块宽、左对齐及相邻边界；正常字体通过。极端系统字体缩放未实测，列为非阻断残余风险，不声称覆盖 |
| S.layoutWidth 的尺寸观察假设 | 在已达到 12 月窗口后额外实测 1440→390→1440，2024-06-10 锚点及 31px 偏移保持；实现未使用所述不触发观察的 transform 动画。普通 resize 通过；旧布局取消另见 V-001 |
| 旧 dailyAnchorLabel 断言需退役 | 检索仅保留“元素不存在”的验收；修复专项读取实际 month-label，专项全部执行通过。已确认 |
| 短屏滚动需等待布局 | 核对布局专项 instant 滚动后等待250ms；刷新 helper 实际采用设置滚动位置后等待150ms。两条路径本轮390×600都通过；不机械照抄交接对写法的概括 |
| 真实横滑，而非手工 scroll 事件 | 新入口先 Page.reload，再 Input.synthesizeScrollGesture，之前不点月份工具；本轮另执行46次真实远距离手势。旧检查仍有合成滚动，不把它冒充直接手势证据 |
| 存储/API/版本/分页、公司日历与主题不变 | Git 范围核对，73 API/迁移、249 每日事项浏览器、181 固定 Web、102 公司日历检查本轮重跑；超过100条混合分页另独立验证。已确认 |
| 暂缓 change 共享首页文件 | 仍为0/38且未动；后续合并须保留本 change 契约。仅协调提示，不构成本轮缺陷 |
| 正式套件会重写 tracked audit | 临时运行器仅将 audit 输出重定向到 `/private/tmp/refine-home-daily-verify/audit/`；断言和套件源文件不改，前后输入快照一致，工作区未遗留 audit 改动 |

另发现交接声称的“清理被替换 DOM 和过期工作”并不完整：会话变化有隔离，但同会话零宽布局重试仍可干扰返回后的新导航，纳入 V-001。

## Checks

以下均为本轮独立执行。数据库是 fixture 创建/销毁的随机隔离库，服务与无头 Chrome 均为本地；未操作正常业务库。沙箱初次访问 MySQL 127.0.0.1:13306 被拒，取得工具授权后成功执行，不将该初始环境限制当产品故障。

| Command or inspection | Result | Notes |
| --- | --- | --- |
| `openspec status --change refine-home-daily-items-layout-and-scrolling --json`；`openspec instructions apply --change refine-home-daily-items-layout-and-scrolling --json` | 完整 / all_done | 解析当前 changeRoot、contextFiles 及 schema；无缺失规划 |
| `openspec validate refine-home-daily-items-layout-and-scrolling --type change --strict --json --no-interactive` | PASS | 0 issues |
| `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 -DskipTests package`（backend目录） | PASS | 新鲜打包 BUILD SUCCESS；明确跳过 Java 单元测试，不计交接所称111项 |
| `python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /private/tmp/refine-home-daily-verify/web-resources.json` | 15/15 PASS | 缓存指纹、加载顺序、JAR与源码字节一致 |
| `node --check` 每日事项 JS、daily browser、refresh、repairs、fixed employee 脚本；`git diff --check` | PASS | 语法及空白检查 |
| `python3 /private/tmp/refine-home-daily-verify/run-suite.py check_daily_items`（运行原 `backend/scripts/check_daily_items.py`） | 73 API/迁移 +249浏览器 PASS | 包含新刷新入口、维护、分页、版本、生命周期、焦点及布局；退出0 |
| 同运行器 `check_fixed_web`（原 `backend/scripts/check_fixed_web.py`） | 181 PASS | 首页、任务、日志及其他员工流；退出0 |
| 同运行器 `check_calendar_drawer`（原 `backend/scripts/check_calendar_drawer.py`） | 102 PASS | 公司任务月历、抽屉、返回及320/1440回归；退出0 |
| `python3 /private/tmp/refine-home-daily-verify/probe.py` | 13/13 PASS | 实际认证、真实API种数和Chrome；长距离滑动、周二空位、混合状态完成往返、跨年移日、106条分页及离线重试 |
| `python3 /private/tmp/refine-home-daily-verify/race.py` | 行为失败 | 原始时序探针3轮均未保持下一月；退出码0仅代表采集完成，不是通过 |
| `python3 /private/tmp/refine-home-daily-verify/race-confirm.py` | 确认 V-001、V-002 | 真正的 CDP mousePressed/mouseReleased；8轮中返回后0/10ms的4轮回跳，20/40ms的4轮正常；无浏览器异常。表单DOM另确认解释文案可见 |
| Company item 并发上限调用链静态审阅 | 一致 | AdminController:244→Writes.runOutcome 的事务内 organization `FOR UPDATE`（Writes.java:43）→createCompanyItem:180计数/插入；相同组织写入串行，常规第11条拒绝另有本轮API证据。未声称运行新并发压力测试 |
| 前后快照比较 / 最终工作区检查 | 输入无变化 | 只新增验证报告/状态 |

输出重定向方式：临时 Python runpy 入口仅将原套件 Path.open 的 audit 写操作及目录创建映射到临时目录；NODE_OPTIONS 预加载临时 shim 对浏览器的 audit mkdirSync/writeFileSync 作同样映射。没有替换 API 调用、应用状态、断言或测试数据逻辑。原日志会打印逻辑仓库路径，实际文件位于临时 audit 目录。原套件可直接通过 `python3 backend/scripts/check_daily_items.py` 等重跑，但会写其原有 tracked audit 文件。

临时证据位于 `/private/tmp/refine-home-daily-verify/`（daily-suite/fixed-web/calendar-drawer 日志、audit 中的 JSON/截图、independent-probe.json、race-confirm.json、form-hint.png）。这些文件可能被清理，关键结论、数值和复现步骤已保留在本报告。补充 probe 初版曾因长手势后的合成日期点击未打开清单而停止；改为真实 Enter 并显式等待清单后全程通过，未据该无效操作报产品缺陷。

### 决定性刷新与布局观察

每行均为保留登录会话的 Page.reload 后，不先点任何月份控制，先测范围再真实双向触摸输入；公司今天均可见。

| Viewport | clientWidth / scrollWidth | 初始 scrollLeft / maxLeft | 正向 / 反向手势后 scrollLeft | 上方完整行：事件纪 / 任务 |
| --- | --- | --- | --- | --- |
| 320×740 | 256 /1192 | 416 /936 | 859 /416 | 4 /3 |
| 390×844 | 310 /1244 | 438 /934 | 880 /439 | 3 /3 |
| 1440×900 | 1052 /2696 | 1210 /1644 | 1653 /1211 | 3 /3 |
| 390×600 | 310 /1244 | 438 /934 | 881 /439 | 3 /3 |

宽屏手势触边时补载，1653超过初始maxLeft是范围已延伸，非测量矛盾。刷新初始宽屏约11个月、小屏5个月；后续最多12个月。两上卡均236px，内容区依次167/160/148/160px；全部可独立纵向滚动，日期44px高。标题加号、工具一行可达，无副标题/底部FAB预留，月头对齐1号列，短屏纵向滚动后第七行在导航之上。

补充观察：16次正向手势由2026-06..2027-04进入2028-05..2029-04；30次反向进入2024-05..2025-04，均≤12月且真实日期唯一。2026-12-01为周二，前方周一为无文字、无date属性、tabIndex=-1的SPAN，整月恰31个本月日期。1未完成+4完成→5完成→1未完成+4完成，单一标记始终16px，仅蓝→灰→蓝。跨年移日后原日0未完成4完成为13px灰杠，新日104未完成2完成为16px蓝杠；三页106个标识全部唯一。离线回读已知非空月显示数量加载中及重试，恢复后真实4条完成标记可见。

## Requirement Coverage

场景名均引用当前 delta spec；“通过”指该行列明的行为，不覆盖 V-001 所指出的快速导航时序分支。以下实现路径中，Daily JS/CSS指根目录 `潘多拉-每日事项.js/.css`。

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| Three-section home dashboard — Render three modules in their intended positions | Daily CSS首页grid、工作区渲染；每日事项/固定Web专项各视口模块及几何断言 | PASS |
| Scroll home modules independently | 独立overflow样式、真实横滑不带动外部及页面可达检查 | PASS |
| Include self-created assigned work | WorkspaceService.homeRead；73项API中本人创建与他人派发同时进入 | PASS |
| Exclude work outside the board contract | 有效assignment/currentVersion/未完成SQL；完成、移除、仅创建、未发布及权限回归 | PASS |
| Rank a newly assigned old task | assigned_at DESC,task id LIMIT10；API精确expected_ids及最多十项断言 | PASS |
| Show concise tasks and read only company information | 固定Web320/390/1440长标题右侧优先级、只读公司条目及权限检查 | PASS |
| Reject company information above the limit | 本轮API拒绝第11条；组织锁→计数/插入事务调用链静态验证并发序列化 | PASS（并发为静态证据） |
| Remove only the home log presentation | /home字段API断言；固定Web实际日志创建、补填、编辑、冻结回归 | PASS |
| Separate creation actions | Daily header daily-new及公司任务入口检查，创建后的真实实体/API隔离 | PASS |
| Reserve three complete rows in both upper cards | 至少四条短条目四视口真实边界框，见上表；超出内部滚动 | PASS |
| Keep the daily header compact | calendarHTML/CSS；四视口sameRow、无dailyAnchorLabel/FAB/底部留白断言及截图 | PASS |
| Horizontal continuous daily-item calendar — Read the transposed calendar | monthBlock/blockHTML；固定七星期行、44px格、无农历及真实滚动 | PASS |
| Browse continuously across months and years | 日历专项跨年/远定位；补充46次真实手势、12月裁剪/日期唯一/像素补偿 | PASS |
| Recover a failed range load | loadBlock/重试态；原专项失败保留内容，加已知非空月离线→重试实测 | PASS |
| Separate sliding from activation | pointer隔离；刷新真实手势不打开清单；普通点击、Enter/Space、鼠标拖动及键盘导航 | PASS |
| Separate months and align the month heading | 本月1日至月末建块、非交互gap；周一/周日、4–6周、闰二月、跨年专项，加周二明确空位观察 | PASS |
| Slide immediately after a page refresh | refresh新入口、四视口Page.reload及直接真实手势，范围/位置见上表 | PASS |
| Keep browsing after a viewport resize and page return | 原专项普通返回通过；12月窗口resize保持日期+31px；快速返回后下一月被旧布局任务覆盖，layoutCalendar:268及design§4 | **FAIL V-001** |
| Daily-item status count markers — Render zero through saturated counts | marksHTML/markWidth；0/1/2/3/4/5/>5、无/4/7/10/13/16px及高度4px、精确数量 | PASS |
| Show mixed and completed-only days | 单标记数量、颜色、可访问全日期及精确计数；原专项+独立真实混合数据 | PASS |
| Update both dates after a move or deletion | invalidateDate及回读；增删末条、完成/取消、移日及跨年实际标记观察 | PASS |
| Use the total count for a mixed day | 1open+4done与5open/5done等长16px；专项及独立混合5条检查 | PASS |
| Preserve marker width when only completion changes | 独立真实UI完成往返，16px恒定、蓝灰蓝及精确读数同步 | PASS |
| Count all pages in one marker | summary独立于list分页；初始105条混合种数，移入后106条3页唯一且单一16px蓝杠 | PASS |
| Daily-item lists details and reliable editing — Open an empty day and create with the floating button | 历史场景名保留，实际WHEN为标题加号；空日/默认今天、日期修改、真实创建和summary回读专项 | PASS；文案反馈另见V-002 |
| Read every item and return through the layers | 原249项含list/detail返回、滚动及焦点；106条混合全部分页可达 | PASS |
| Edit and delete only the selected item | 同正文不同id、取消无写入、确认删除、移日返回原清单及双日标记专项 | PASS |
| Preserve drafts and reject stale versions | API版本/幂等，浏览器网络失败/冲突保留草稿与重试；未将编辑转新增 | PASS |
| Isolate sessions and out-of-order responses | clearSession/query token；快速切日期、退出/失效/换账号与迟到响应专项 | PASS；同会话布局回调不在此冒充通过，见V-001 |
| Keep controls usable on compact screens | 四视口清单/详情/表单、长文本、保存/返回、七行及焦点专项 | PASS |
| Create from the mint glass header control | header位置/计算rgba样式/焦点、点击与键盘创建及取消/保存后焦点检查；截图正常玻璃绿 | PASS；额外表单文案见V-002 |
| 用户本轮补充：新增表单不显示解释性文字 | formView:732；真实认证后标题加号打开表单，DOM返回该句且有可见高度 | **FAIL V-002** |

额外规划承诺核对：资源指纹与打包一致通过；不引入API/存储/依赖修改通过；任务4.2及design§4关于“DOM替换时取消过期工作”的承诺未满足（V-001）。不将已勾选任务视为免责。残余非阻断风险：极端字体缩放未实测；本轮未做无关原生端或生产部署验证。

## Findings

### V-001: 切页返回后快速翻月被隐藏时遗留的布局重试覆盖

- Category: implementation
- Severity: medium
- Requirement: `Horizontal continuous daily-item calendar / Keep browsing after a viewport resize and page return`；design Decisions§4“限制重试次数并在会话变化或DOM替换时取消过期工作”“清理旧计时器/观察器”；tasks4.2。
- Evidence: `潘多拉-每日事项.js:268` 的 layoutCalendar 只捕获 S.generation；`:279–280` 在零宽时用未登记的 setTimeout 每32ms重试；`:454–467` 的 jumpToMonth 更新 scrollToken 并重建 track，但旧 place 不检查该导航token或当前DOM身份。clearSession处理会话变化，不解决同会话新导航。真实Chrome390×844、真实登录、本地隔离服务中已复现：定位2040-01，切公司页200ms，返回首页后立即用CDP真实鼠标点击下一月；立即采样 anchor/anchorDate为2040-02/2040-02-01，350ms后变为2040-01/2040-01-01，scrollToken仍为本次新导航值。0ms与10ms等待各两次全部回跳；20ms与40ms各两次正常；浏览器异常为空。不是仅有静态怀疑。
- Expected: 返回恢复完成后，用户已作出的下一月导航应保留；较旧恢复任务不得覆盖新导航/渲染。取消条件须包含同会话工作代次或DOM替换，不能只隔离账号。
- Actual: 隐藏期间捕获旧一月目标的重试继续执行，在新导航到二月后恢复旧一月；快速动作被撤销。
- Repair guidance: 有界取消/作废布局重试、延迟恢复及观察回调，使新导航、重渲染/DOM替换及会话变化均能使旧布局失效；保留零宽延迟布局、首次补足双向范围和像素锚点能力。补充能建立“先到二月、后等待仍是二月”的真实切页时序回归，不能仅增加等待掩盖问题。
- Acceptance checks: 390与1440宽分别定位远月、切公司页至少200ms、返回后立即/10ms点击下一月，等至少600ms仍为正确新月；重复前后月、定位和回今天；重跑刷新四视口直接手势、窄宽变化、普通切页返回、12月裁剪及会话隔离。自动检查必须断言最终目标，而非仅进程退出0。
- Repair status: addressed-awaiting-verification
- Repair notes: 2026-11-05 修复。修改 `潘多拉-每日事项.js`：登记并取消零宽布局重试，新增布局代次；新布局、DOM替换和会话重置取消旧布局/滚动计时器，延迟恢复及滚动回调同时核对代次、会话与当前scroller身份，尺寸观察回调拒绝旧DOM。`backend/scripts/check_daily_items_refresh_browser.js` 新增390/1440宽、隐藏公司页220ms、返回后0/10ms真实CDP鼠标操作的16组回归，分别记录立即目标及650ms后目标，覆盖下一月/上一月/远月定位/今天，并补充两宽度普通返回的日期及像素偏移断言。修复前运行 `python3 /private/tmp/refine-home-daily-repair/race-confirm.py`，0/10ms四轮均先到2040-02再回2040-01，复现成立。修复后 `python3 /private/tmp/refine-home-daily-repair/run-suite.py check_daily_items` 退出0：73项API/迁移及300项浏览器全部通过（本轮新增51项，含本条18项）；刷新四视口真实双向手势、窄宽变化、键盘/分页/会话隔离均通过。`python3 /private/tmp/refine-home-daily-repair/probe.py` 退出0，13项通过，含46次真实双向手势、12月窗口裁剪及日期+像素锚点保持。同运行器 `check_fixed_web` 181项、`check_calendar_drawer` 102项通过，均退出0。证据与日志位于 `/private/tmp/refine-home-daily-repair/`，16组即时/最终目标见 `audit/refine-home-daily-items-layout-and-scrolling/page-return-navigation.json`；临时运行器仅重定向audit输出，不替换断言/应用/API。相关JS语法及 `git diff --check` 通过。待独立验证，未更改总体验证结论。
- Reverification notes: 本轮首次确认；现有249项浏览器专项虽然通过，未覆盖此竞争窗口。

可用当前页面开发者控制台进行最小复现（先通过年月控件定位2040-01并等待稳定，当前首页page为map、公司页为view）：

```js
setPage('view');
setTimeout(() => {
  setPage('map');
  document.querySelector('[data-action="daily-next"]').click();
  console.log('immediate', PandoraDaily.state.anchor, PandoraDaily.state.anchorDate);
  setTimeout(() => console.log('settled', PandoraDaily.state.anchor, PandoraDaily.state.anchorDate), 350);
}, 200);
```

预期两次均为2040-02/2040-02-01；缺陷实现可能直接保持一月，也可能先到二月再回一月。上述同任务点击为便于重现；本轮另用返回后的真实CDP鼠标按下/抬起确认0/10ms两组，排除了仅脚本同步点击的解释。具体竞争时间依机器调度而异。

### V-002: 新增事项表单保留用户明确要求移除的解释性文字

- Category: implementation
- Severity: low
- Requirement: 用户本轮直接验收反馈（高于技能/文件指南）；相关界面为 `Daily-item lists details and reliable editing` 的标题栏新增表单。当前spec仅要求日期和正文，并未明确禁止帮助文案，本条依据用户新反馈，不虚构原规范条文。
- Evidence: `潘多拉-每日事项.js:732` 的 formView 在 textarea 后渲染 `.tiny.muted`：“每日事项仅本人可见，可填写过去、今天或未来的日期，最多 2000 字。”。通过实际fixture登录后点击标题栏加号，sheetTitle为“新增每日事项”，可见DOM文本为“日期\n内容\n每日事项仅本人可见，可填写过去、今天或未来的日期，最多 2000 字。”；该元素getBoundingClientRect高度大于0。该行在前一版f73dfcf也存在，来源为原有遗留；本轮新入口继续呈现它。
- Expected: 新增事项正式界面不显示该整段解释性文字；保留必要的日期/内容字段、保存及实际错误反馈。
- Actual: 每次打开新增表单都会显示该段；同一个formView亦被编辑模式共用。
- Repair guidance: 移除该解释段，核对共用编辑表单及布局；保留原有日期、2000字和本人可见的业务/服务端约束，正常错误提示与保存/返回焦点不受影响。涉及资源改动时同步缓存指纹及打包。
- Acceptance checks: 实际从标题加号、空日清单打开新增，确认该文字不在可见DOM；编辑路径亦无同一解释段；可正常创建/编辑，空正文/非法日期/长度限制仍按原规则反馈；320/390/1440宽保存/取消及焦点可用，资源指纹检查通过。
- Repair status: addressed-awaiting-verification
- Repair notes: 2026-11-05 修复。修复前同轮真实fixture/Chrome确认新增表单可见该完整解释段（`/private/tmp/refine-home-daily-repair/race-confirm.json` 的form字段）。移除 `潘多拉-每日事项.js` 共用formView中的该段，保留日期、maxlength=2000、保存校验、错误区及服务端约束；更新 `潘多拉-交互原型.html` 的每日事项JS缓存指纹。新增 `backend/scripts/check_daily_items_form_browser.js`，并由 `backend/scripts/check_daily_items_browser.js` 调用：320/390/1440宽标题加号新增、空日清单新增及编辑均断言DOM无该段；验证保存/取消、日期/内容持久化、可用控件和焦点，另断言空正文、非法日期、2001字仍反馈原错误且保留草稿。完整每日事项套件73项API/迁移+300项浏览器通过，包含本条33项新增检查和已有空日新增保存、隐私、2000字边界回归。`mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 -DskipTests package`（backend目录）BUILD SUCCESS；`python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /private/tmp/refine-home-daily-repair/web-resources.json` 15/15通过，确认指纹及JAR字节一致；node --check受改JS及git diff --check通过。完整命令日志、浏览器逐项结果和资源报告均位于 `/private/tmp/refine-home-daily-repair/`；无待处理阻碍。待独立验证，未更改总体验证结论。
- Reverification notes: 本轮以真实表单DOM独立确认；此处记录用户补充反馈，不扩大为删除全部帮助文字。
