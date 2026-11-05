# Implementation Verification

- Change: `refine-home-daily-items-layout-and-scrolling`
- Schema: `spec-driven`
- Verdict: **PASS**
- Verified at: 2026-11-05T16:25:12+08:00（归档前主规格同步增量复核；实现复验时间16:14）
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice`（实现及规划同根）
- Verified revision: `18c346d` (`1st verify & fix refine-home-daily-items-layout-and-scrolling`)；实现复验开始时工作区干净；本次同步复核的唯一输入变化为已批准的主规格合并。

## Summary

独立复验通过。V-001切页返回后快速导航回跳、V-002新增/编辑表单解释性文字均已复测解决。当前版本重新执行73项API/迁移、300项每日事项浏览器检查、13项补充真实浏览器检查，均通过；上一轮原始回跳探针8轮也全部保持新目标，表单DOM仅保留日期和内容。无待处理finding。

实现复验为增量复验：重测布局计时器取消及表单相关路径，保留31个规格场景的覆盖映射。固定Web的181项与公司日历的102项使用上一轮独立证据，具体适用理由见下文。未改实现、测试、规划、任务勾选或implementation-notes，未归档。

## Verification Basis

### 归档前主规格同步增量复核

用户已明确选择同步后归档并提交。与16:14独立PASS快照比较，仅`openspec/specs/pandora-requirements-aligned-prototype/spec.md`变化；当前主规格的四个修改要求及31场景与已验证delta逐块一致，新增9场景，其他要求及Purpose逐字保留。无实现、测试、依赖、配置或delta变更，已有行为证据仍适用，本次不重复行为测试。`openspec validate --specs --strict --json --no-interactive`通过（只有非阻断INFO长度提示），change严格校验通过；所有delta操作已同步，无剩余差异。总体PASS及两个verified-resolved保持。

当前`verification-state.json` SHA-256：`0fcc2e687761bb6d5abd189a8f6af8fbf7105057f2d4438ea116de0d8ce69c96`。仍采用本报告原root及三个exclusions，由同一脚本生成401文件清单。

```sh
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture --root /Users/watuji/MyGitDev/software_test_practice --exclude 'audit/*' --exclude 'backend/target/*' --exclude 'backend/.runtime/*' --output /private/tmp/refine-home-daily-synced-before.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare openspec/changes/refine-home-daily-items-layout-and-scrolling/verification-state.json /private/tmp/refine-home-daily-synced-before.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture --root /Users/watuji/MyGitDev/software_test_practice --exclude 'audit/*' --exclude 'backend/target/*' --exclude 'backend/.runtime/*' --output /private/tmp/refine-home-daily-synced-after.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare /private/tmp/refine-home-daily-synced-before.json /private/tmp/refine-home-daily-synced-after.json
cp /private/tmp/refine-home-daily-synced-after.json openspec/changes/refine-home-daily-items-layout-and-scrolling/verification-state.json
```

旧状态比较exit1，仅主规格一个文件；本次before/after比较exit0、changed:false。下文保留16:14实现复验及其仍有效的覆盖依据，非本次重跑结果。

### 实现复验及继承的证据

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| `proposal.md`、`design.md`、`tasks.md`、delta `specs/pandora-requirements-aligned-prototype/spec.md` | 当前磁盘内容已读取，与上一轮快照相同；四项要求、31场景，任务18/18勾选不是通过证据 |
| `implementation-notes.md` | 仍为初次apply交接，标注5998c3d加未提交改动；对18c346d修复已过时。实现映射仍适用，修复内容以实际diff及本报告保留的Repair notes核对 |
| 上一轮独立状态 | 已验SHA-256为`3eba74af552a67710d6d98fdfe30e3e1ab0d11326e50bb5bc5c6acd6948e8a8e`，与旧报告一致；不能沿用其FAIL为修复完成证明 |
| 增量范围 | 脚本比较：新增`backend/scripts/check_daily_items_form_browser.js`，修改daily browser/refresh入口、`潘多拉-每日事项.js`及HTML缓存指纹；无删除，共401个输入文件 |
| 实际修复 | 登记/取消零宽重试；布局代次、会话及scroller身份校验；渲染和新布局取消旧工作；移除共用formView解释段。新增真实鼠标快速返回和新增/编辑检查 |
| 未变范围及证据复用 | CSS、任务/日志/公司页实现、固定Web/公司日历测试、后端Java/迁移、依赖配置及所有规划未变。实现复验日历专项覆盖返回、尺寸与全局会话边界；先前181固定Web及102公司日历的独立证据对其未改行为继续有效，未将repair自报执行冒充实现复验结果 |
| 其他活跃change | `refine-notifications-task-editing-and-staff-browsing`仍0/38，用户已明确暂缓，实现复验未处理 |

实现复验状态 SHA-256（已由下述同步复核状态取代）：

`7a6dd60d44b34cb9118576921115433e1a134910509e484647fabe7de07494aa`

快照由技能脚本生成。root为上述仓库，排除`audit/*`（生成证据）、`backend/target/*`（构建输出）、`backend/.runtime/*`（本地依赖缓存）；脚本另自动排除.git及workflow handoff/report/state文件，按Git tracked和nonignored untracked清点。相关源码、测试、依赖声明、配置及规划保留。使用相同范围执行：

```sh
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture --root /Users/watuji/MyGitDev/software_test_practice --exclude 'audit/*' --exclude 'backend/target/*' --exclude 'backend/.runtime/*' --output /private/tmp/refine-home-daily-reverify-before.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare openspec/changes/refine-home-daily-items-layout-and-scrolling/verification-state.json /private/tmp/refine-home-daily-reverify-before.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture --root /Users/watuji/MyGitDev/software_test_practice --exclude 'audit/*' --exclude 'backend/target/*' --exclude 'backend/.runtime/*' --output /private/tmp/refine-home-daily-reverify-after.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare /private/tmp/refine-home-daily-reverify-before.json /private/tmp/refine-home-daily-reverify-after.json
cp /private/tmp/refine-home-daily-reverify-after.json openspec/changes/refine-home-daily-items-layout-and-scrolling/verification-state.json
```

旧状态对实现复验before比较exit1，变化为上列五个文件；before/after比较exit0、changed:false。记录的新状态是脚本原始输出，非手填哈希。没有验证期间输入变化或必需证据缺口；快照记录输入，不单独证明功能通过。

## Apply Handoff Review

初次交接文件及十项提醒已重新核对，未修改。修复后的新检查均以实现复验独立运行确认，不采信Repair notes中的自报PASS。原交接的布局/文件映射仍有效；旧提交号及测试数量不作为当前结果。

| 提醒 | 处理及证据 |
| --- | --- |
| 最多 12 月，裁剪后删除 summary，重访需回读且不能假零 | 独立真实手势向前 16 次、反向 30 次，所有窗口 ≤12 月且日期唯一；另对已知非空的 2026-12 月离线回读，读数为“数量加载中”而非零，恢复网络重试得到真实 4 条完成标记。已确认 |
| 加号选择器须覆盖 tiny-btn 的 44px 最小高度 | 核对 `.daily-head .btn.daily-add` 优先级及专项计算样式；32/34px 标题按钮、目标四视口同一行可见，上方内容预算成立。已确认 |
| 月头 overflow:visible 依赖块宽防重叠 | 四视口及日期边界月份均测完整标签、块宽、左对齐及相邻边界；正常字体通过。极端系统字体缩放未实测，列为非阻断残余风险，不声称覆盖 |
| S.layoutWidth 的尺寸观察假设 | 在已达到 12 月窗口后额外实测 1440→390→1440，2024-06-10 锚点及 33px 偏移保持；实现未使用所述不触发观察的 transform 动画。普通 resize 与过期布局取消均经实现复验重测通过，V-001已独立确认解决 |
| 旧 dailyAnchorLabel 断言需退役 | 检索仅保留“元素不存在”的验收；修复专项读取实际 month-label，专项全部执行通过。已确认 |
| 短屏滚动需等待布局 | 核对布局专项 instant 滚动后等待250ms；刷新 helper 实际采用设置滚动位置后等待150ms。两条路径实现复验390×600都通过；不机械照抄交接对写法的概括 |
| 真实横滑，而非手工 scroll 事件 | 新入口先 Page.reload，再 Input.synthesizeScrollGesture，之前不点月份工具；实现复验另执行46次真实远距离手势。旧检查仍有合成滚动，不把它冒充直接手势证据 |
| 存储/API/版本/分页、公司日历与主题不变 | Git 范围核对；73 API/迁移和300每日事项浏览器实现复验重跑，181固定Web及102公司日历沿用上一轮独立证据（相关源码及测试未变）；超过100条混合分页另独立验证。已确认 |
| 暂缓 change 共享首页文件 | 仍为0/38且未动；后续合并须保留本 change 契约。仅协调提示，不构成实现复验缺陷 |
| 正式套件会重写 tracked audit | 临时运行器仅将 audit 输出重定向到 `/private/tmp/refine-home-daily-reverify/audit/`；断言和套件源文件不改，前后输入快照一致，工作区未遗留 audit 改动 |

## Checks

实现复验使用相同本地fixture/真实认证及无头Chrome，创建并销毁随机隔离数据库；没有操作正常业务库。测试所需本地服务通过工具授权运行。常规Java单元测试未重跑：Java及依赖未变，不将apply交接中的111项计为实现复验执行。

| Command or inspection | Result | Notes |
| --- | --- | --- |
| `openspec status --change refine-home-daily-items-layout-and-scrolling --json`及`openspec instructions apply --change refine-home-daily-items-layout-and-scrolling --json` | 完整/all_done | 读取当前contextFiles及schema，18项完成声明另以实测核对 |
| `openspec validate refine-home-daily-items-layout-and-scrolling --type change --strict --json --no-interactive` | PASS | 0 issues |
| `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 -DskipTests package`（backend目录） | PASS，exit0 | 当前源资源重新打包，BUILD SUCCESS |
| `python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /private/tmp/refine-home-daily-reverify/web-resources.json` | 15/15 PASS | 指纹、顺序及打包资源字节一致 |
| `node --check`每日事项JS、daily browser、refresh、form脚本；`git diff --check` | PASS | 所有受改JS均检查 |
| `python3 /private/tmp/refine-home-daily-reverify/run-suite.py check_daily_items` | 73/73 API/迁移、300/300浏览器PASS，exit0 | 实际运行仓库check_daily_items.py；新增51项：快速返回18项、表单33项；旧维护/分页/版本/会话/焦点/布局全部保留执行 |
| `python3 /private/tmp/refine-home-daily-reverify/race-confirm.py` | 8/8原始回跳探针通过，exit0 | 390宽0/10/20/40ms各2轮，立即及350ms后均2040-02；form.hints=[]，body为日期和内容；browserErrors=[] |
| `python3 /private/tmp/refine-home-daily-reverify/probe.py` | 13/13 PASS，exit0 | 46次真实手势、12月裁剪、宽窄宽锚点、周二空位、5条混合完成往返、跨年移日、106条分页、离线重试 |
| 上一轮独立`check_fixed_web` / `check_calendar_drawer` | 复用181/102 PASS | 当前相关实现、测试及依赖不变；实现复验未重复执行，不计入实现复验测试数量 |
| 公司信息并发上限调用链 | 复用独立静态证据 | AdminController→Writes事务组织FOR UPDATE→计数/插入保证串行；常规第11条拒绝API实现复验重跑，未声称新增并发压力测试 |
| 前后输入快照 | PASS | changed:false；仅修改本报告/状态 |

临时运行器及Node预加载shim仅重定向audit目录的文件写出/目录创建到`/private/tmp/refine-home-daily-reverify/audit/`，不改套件源文件、断言、API、应用状态或种数逻辑，避免重写tracked audit。可直接用`python3 backend/scripts/check_daily_items.py`重跑相同套件，但原入口会写默认audit路径。

实现复验完整日志/JSON/截图在`/private/tmp/refine-home-daily-reverify/`。上一轮复用的独立日志在`/private/tmp/refine-home-daily-verify/`；重要观察已留存本报告，结论不依赖临时目录永久存在。

### 决定性观察

390/1440宽×返回后0/10ms×下一月/上一月/远月定位/今天，共16组。先定位2040-01，隐藏到公司页220ms再返回，用实际CDP鼠标操作；立即及650ms后目标均分别为2040-02、2039-12、2044-02、2026-11，目标日可见且窗口≤12月。两宽普通切页返回的日期和像素偏移也保持。另按上一轮原始探针执行8轮，全部未回跳，而旧版0/10ms的4轮全部失败。

320/390/1440宽新增标题入口、空日新增及编辑均无解释段，日期/内容控件和保存/返回可用；新增/编辑真实持久化、取消及焦点恢复通过。空正文、非法日期和2001字仍保留草稿并给出原错误。

四视口保留会话Page.reload后，不先点月工具，先测范围再真实双向手势；公司今天均可见：

| Viewport | clientWidth / scrollWidth | 初始left / maxLeft | 正向 / 反向后left | 上方完整行：事件纪 / 任务 |
| --- | --- | --- | --- | --- |
| 320×740 | 256 /1192 | 416 /936 | 859 /416 | 4 /3 |
| 390×844 | 310 /1244 | 438 /934 | 881 /438 | 3 /3 |
| 1440×900 | 1052 /2696 | 1210 /1644 | 1653 /1210 | 3 /3 |
| 390×600 | 310 /1244 | 438 /934 | 881 /437 | 3 /3 |

宽屏手势时补载，1653超过初始maxLeft属于范围已扩展。上卡236px，内容区167/160/148/160px，第三行完整、超出独立滚动；七行日期44px，短屏第七行和导航均可达。标题行加号及工具同排，月头完整对齐，无副标题、底部FAB或专用留白。

补充探针实现复验再次通过：16次正向/30次反向手势始终≤12月、真实日期唯一；1440→390→1440保留2024-06-10和33px偏移。2026-12-01周二前的周一为空SPAN、无date属性、无文本且不可交互，本月31个日期无重复。混合5条完成往返单一16px蓝→灰→蓝；跨年移日后原日4完成为13px灰，新日104未完成2完成为16px蓝，106条三页标识唯一。已知非空月离线回读不声称零，重试恢复真实标记。

## Requirement Coverage

31个场景均保留映射。除特别注明的上一轮固定Web/公司日历及并发静态证据外，下列每日事项、API、布局及补充探针均在实现复验重测。Daily JS/CSS指根目录员工资源。

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| Three-section home dashboard — Render three modules in their intended positions | Daily CSS首页grid、工作区渲染；每日事项/固定Web专项各视口模块及几何断言 | PASS |
| Scroll home modules independently | 独立overflow样式、真实横滑不带动外部及页面可达检查 | PASS |
| Include self-created assigned work | WorkspaceService.homeRead；73项API中本人创建与他人派发同时进入 | PASS |
| Exclude work outside the board contract | 有效assignment/currentVersion/未完成SQL；完成、移除、仅创建、未发布及权限回归 | PASS |
| Rank a newly assigned old task | assigned_at DESC,task id LIMIT10；API精确expected_ids及最多十项断言 | PASS |
| Show concise tasks and read only company information | 上一轮固定Web320/390/1440长标题右侧优先级、只读公司条目及权限检查 | PASS |
| Reject company information above the limit | 实现复验API拒绝第11条；组织锁→计数/插入事务调用链静态验证并发序列化 | PASS（并发为静态证据） |
| Remove only the home log presentation | /home字段API断言；上一轮固定Web实际日志创建、补填、编辑、冻结回归 | PASS |
| Separate creation actions | Daily header daily-new及公司任务入口检查，创建后的真实实体/API隔离 | PASS |
| Reserve three complete rows in both upper cards | 至少四条短条目四视口真实边界框，见上表；超出内部滚动 | PASS |
| Keep the daily header compact | calendarHTML/CSS；四视口sameRow、无dailyAnchorLabel/FAB/底部留白断言及截图 | PASS |
| Horizontal continuous daily-item calendar — Read the transposed calendar | monthBlock/blockHTML；固定七星期行、44px格、无农历及真实滚动 | PASS |
| Browse continuously across months and years | 日历专项跨年/远定位；补充46次真实手势、12月裁剪/日期唯一/像素补偿 | PASS |
| Recover a failed range load | loadBlock/重试态；原专项失败保留内容，加已知非空月离线→重试实测 | PASS |
| Separate sliding from activation | pointer隔离；刷新真实手势不打开清单；普通点击、Enter/Space、鼠标拖动及键盘导航 | PASS |
| Separate months and align the month heading | 本月1日至月末建块、非交互gap；周一/周日、4–6周、闰二月、跨年专项，加周二明确空位观察 | PASS |
| Slide immediately after a page refresh | refresh新入口、四视口Page.reload及直接真实手势，范围/位置见上表 | PASS |
| Keep browsing after a viewport resize and page return | 实现复验16组390/1440宽快速返回导航即时及650ms后均正确，两组普通返回保持日期/偏移；原始8轮复现全部通过；12月窗口resize保持日期+33px | PASS，V-001 verified-resolved |
| Daily-item status count markers — Render zero through saturated counts | marksHTML/markWidth；0/1/2/3/4/5/>5、无/4/7/10/13/16px及高度4px、精确数量 | PASS |
| Show mixed and completed-only days | 单标记数量、颜色、可访问全日期及精确计数；原专项+独立真实混合数据 | PASS |
| Update both dates after a move or deletion | invalidateDate及回读；增删末条、完成/取消、移日及跨年实际标记观察 | PASS |
| Use the total count for a mixed day | 1open+4done与5open/5done等长16px；专项及独立混合5条检查 | PASS |
| Preserve marker width when only completion changes | 独立真实UI完成往返，16px恒定、蓝灰蓝及精确读数同步 | PASS |
| Count all pages in one marker | summary独立于list分页；初始105条混合种数，移入后106条3页唯一且单一16px蓝杠 | PASS |
| Daily-item lists details and reliable editing — Open an empty day and create with the floating button | 历史场景名保留，实际WHEN为标题加号；空日/默认今天、日期修改、真实创建和summary回读专项 | PASS；文案修复亦通过V-002 |
| Read every item and return through the layers | 实现复验300项含list/detail返回、滚动及焦点；106条混合全部分页可达 | PASS |
| Edit and delete only the selected item | 同正文不同id、取消无写入、确认删除、移日返回原清单及双日标记专项 | PASS |
| Preserve drafts and reject stale versions | API版本/幂等，浏览器网络失败/冲突保留草稿与重试；未将编辑转新增 | PASS |
| Isolate sessions and out-of-order responses | clearSession/query token；快速切日期、退出/失效/换账号与迟到响应专项 | PASS；同会话布局回调另经V-001独立重测通过 |
| Keep controls usable on compact screens | 四视口清单/详情/表单、长文本、保存/返回、七行及焦点专项 | PASS |
| Create from the mint glass header control | header位置/计算rgba样式/焦点、点击与键盘创建及取消/保存后焦点检查；截图正常玻璃绿 | PASS；新增/编辑文案检查亦通过V-002 |
| 用户实现复验补充：新增表单不显示解释性文字 | formView:741；实现复验320/390/1440宽标题新增、空日新增及编辑无该段；原复现DOM仅日期和内容，校验及持久化正常 | PASS，V-002 verified-resolved |

额外承诺：DOM替换/同会话新导航取消旧工作已结合源码与真实时序确认；指纹/打包一致，无API/存储/依赖修改。残余非阻断风险仍为极端系统字体缩放未实测；未做无关原生端或生产部署验证。没有待解决发现或必需场景证据缺口。

## Findings

### V-001: 切页返回后快速翻月被隐藏时遗留的布局重试覆盖

- Category: implementation
- Severity: medium
- Requirement: `Horizontal continuous daily-item calendar / Keep browsing after a viewport resize and page return`；design§4过期工作取消；tasks4.2。
- Evidence: 旧版零宽布局每32ms重试只验证会话，返回后新翻月曾被旧目标覆盖。当前`潘多拉-每日事项.js:211`登记取消计时器、layoutVersion和scroller身份校验；layoutCalendar:277及render/clearSession均作废旧工作，延迟滚动/恢复/尺寸观察同时校验。
- Expected: 新导航或DOM替换后，旧恢复工作不得覆盖新目标。
- Actual: 当前16组快速导航及原始8轮探针全部保持即时与等待后的正确目标；普通返回/刷新/resize/裁剪/会话隔离均通过。
- Acceptance checks: 本轮完整daily套件300浏览器项（含16组导航及2组普通返回）、原始race-confirm8轮、独立probe13项，均通过。
- Repair status: verified-resolved
- Repair notes: 2026-11-05 修复。修改 `潘多拉-每日事项.js`：登记并取消零宽布局重试，新增布局代次；新布局、DOM替换和会话重置取消旧布局/滚动计时器，延迟恢复及滚动回调同时核对代次、会话与当前scroller身份，尺寸观察回调拒绝旧DOM。`backend/scripts/check_daily_items_refresh_browser.js` 新增390/1440宽、隐藏公司页220ms、返回后0/10ms真实CDP鼠标操作的16组回归，分别记录立即目标及650ms后目标，覆盖下一月/上一月/远月定位/今天，并补充两宽度普通返回的日期及像素偏移断言。修复前运行 `python3 /private/tmp/refine-home-daily-repair/race-confirm.py`，0/10ms四轮均先到2040-02再回2040-01，复现成立。修复后 `python3 /private/tmp/refine-home-daily-repair/run-suite.py check_daily_items` 退出0：73项API/迁移及300项浏览器全部通过（本轮新增51项，含本条18项）；刷新四视口真实双向手势、窄宽变化、键盘/分页/会话隔离均通过。`python3 /private/tmp/refine-home-daily-repair/probe.py` 退出0，13项通过，含46次真实双向手势、12月窗口裁剪及日期+像素锚点保持。同运行器 `check_fixed_web` 181项、`check_calendar_drawer` 102项通过，均退出0。证据与日志位于 `/private/tmp/refine-home-daily-repair/`，16组即时/最终目标见 `audit/refine-home-daily-items-layout-and-scrolling/page-return-navigation.json`；临时运行器仅重定向audit输出，不替换断言/应用/API。相关JS语法及 `git diff --check` 通过。待独立验证，未更改总体验证结论。
- Reverification notes: 2026-11-05T16:14+08:00独立复验，依据当前18c346d重新打包运行，未复用repair自报PASS；等待650ms后目标正确，原始350ms复现也无回跳。

### V-002: 新增事项表单保留用户明确要求移除的解释性文字

- Category: implementation
- Severity: low
- Requirement: 用户本轮前序反馈要求新增表单不显示解释性文字；相关`Daily-item lists details and reliable editing`。原规格并未禁止所有帮助文字，不扩大修复范围。
- Evidence: 旧formView曾显示“每日事项仅本人可见，可填写过去、今天或未来的日期，最多 2000 字。”；当前`潘多拉-每日事项.js:741`共用表单移除整段，保留日期、正文、maxlength及真实错误区。
- Expected: 标题新增、空日新增及共用编辑表单无该解释段；校验/保存/返回正常。
- Actual: 当前320/390/1440宽三条路径均无该段；原始探针form.hints=[]、body='日期\n内容'；创建/编辑持久化及三种非法输入检查通过。
- Acceptance checks: 本轮33项新增表单检查及原有API/维护回归、15项资源检查全部通过。
- Repair status: verified-resolved
- Repair notes: 2026-11-05 修复。修复前同轮真实fixture/Chrome确认新增表单可见该完整解释段（`/private/tmp/refine-home-daily-repair/race-confirm.json` 的form字段）。移除 `潘多拉-每日事项.js` 共用formView中的该段，保留日期、maxlength=2000、保存校验、错误区及服务端约束；更新 `潘多拉-交互原型.html` 的每日事项JS缓存指纹。新增 `backend/scripts/check_daily_items_form_browser.js`，并由 `backend/scripts/check_daily_items_browser.js` 调用：320/390/1440宽标题加号新增、空日清单新增及编辑均断言DOM无该段；验证保存/取消、日期/内容持久化、可用控件和焦点，另断言空正文、非法日期、2001字仍反馈原错误且保留草稿。完整每日事项套件73项API/迁移+300项浏览器通过，包含本条33项新增检查和已有空日新增保存、隐私、2000字边界回归。`mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 -DskipTests package`（backend目录）BUILD SUCCESS；`python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /private/tmp/refine-home-daily-repair/web-resources.json` 15/15通过，确认指纹及JAR字节一致；node --check受改JS及git diff --check通过。完整命令日志、浏览器逐项结果和资源报告均位于 `/private/tmp/refine-home-daily-repair/`；无待处理阻碍。待独立验证，未更改总体验证结论。
- Reverification notes: 2026-11-05T16:14+08:00独立重新执行真实登录及DOM/交互检查，指纹与新JAR字节一致，确认解决。

## Next Action

可执行`$openspec-e13-archive-change refine-home-daily-items-layout-and-scrolling`。本结论仅适用于记录的输入状态，相关实现、规划或测试再有变化时需重新验证。
