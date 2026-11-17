# Implementation Verification

- Change: refine-web-home-interactions-and-demo
- Schema: spec-driven
- Verdict: PASS
- Verified at: 2026-11-15T18:36:31+08:00
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice`
- Verified revision: `1de3d56f3ac08665ddf276a87f7e6c21ee82a931` 加当前未提交修复：每日事项JS、HTML资源版本、两份对应检查及恢复的36个Android文件；不将HEAD单独视作已验证输入。

## Summary

归档前增量复验（本次）：主规格同步是唯一输入变化。6项修改及2项新增与已验证delta逐要求完全一致，其他54项要求不变；未增加验收行为。主规格2/2及本change严格验证通过，复用下文修复复验与前轮的全部独立执行证据，PASS继续成立。

两项原发现均经独立复验解决，当前61个规范场景有充分的修复复验或仍适用的前轮独立证据，无待处理发现。严格OpenSpec验证、当前JAR打包、15项资源检查、79项API/迁移和306项Chrome检查全部通过。补查真实401/404、人员摘要合并和达到月份容量时的来源保护通过。

采用增量验证：修复只改变每日事项目标命中及松开重算，完整重跑受影响日历/首页套件；后端、其他Web模块、依赖、配置、种子和规划均与前轮指纹一致，复用对应独立证据。没有把修复记录或任务勾选当作通过依据。触摸证据仍为headless Chrome合成CDP事件，pointercancel/blur为事件注入；没有物理触屏证据。

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| ------------- | ---------------------------------------------- |
| 当前实现及规划输入 | 同根快照665文件；含源代码、检查、依赖声明、配置、迁移、AGENTS.md及当前change规划 |
| 旧验证基线 | 原state SHA-256 `13f906131547bd7a5b52a89a181e18f380c043570bf8cddabc7677b4d0951674` 与原报告一致，629文件 |
| 旧state → 修复复验before | compare exit1：新增36个恢复的android文件；仅修改每日事项JS、HTML、check_daily_items.py和check_daily_items_drag_browser.js；无删除、无scope变化 |
| Android / Flutter / shell范围 | 对照规划提交5fe33e4，214个受版本控制文件的Git blob内容及可执行位全相等；含36个android文件及wrapper二进制；无额外非忽略文件 |
| 当前JAR | `backend/target/pandora-backend-0.1.0.jar` SHA-256 `13536495ac659beac4631e93eb14100b75e76eb6b9bb1086ce759df49f43eda4` |
| 修复复验执行证据 | `output/e13-web-reverify/`：build.log、daily-items.log、web-resources.json、focused.log、android-restoration-independent.json及audit副本 |
| 前轮独立证据 | 2026-11-15，原基线1de3d56；`output/e13-refine-web-independent/audit/` 和 `output/task-creation-refinement/`；前轮报告副本 `output/e13-web-reverify/previous-verification.md` |
| implementation-notes.md | 修复复验完整重读；revision和服务状态声明已过时，具体提醒处置见下表；按技能规则自动排除于输入快照 |

当前 `verification-state.json` SHA-256：`2e188af82091cd25590aa55c150b08ed31b22fe4e22d8c29f6ed2d12f946f7e6`。

修复复验保存的state SHA-256为`3e823f2fd9cb6b4f7c7d8b7aafeeaa1b08324208a420e11cdaec7ca3eaf04dfa`；下述原修复复验before/after记录保留为执行证据，当前归档前快照见本节补充。

实现与规划root相同，去重为一个root。使用技能脚本生成before/after和差异，不手填清单；after复制为state。捕获命令（before使用对应文件名）：

```sh
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture \
  --root /Users/watuji/MyGitDev/software_test_practice \
  --exclude 'audit/*' --exclude 'output/*' --exclude '.runtime/*' \
  --exclude 'backend/.runtime/*' --exclude 'backend/target/*' \
  --exclude '**/node_modules/*' --exclude '**/__pycache__/*' \
  --output /tmp/refine-web-reverify-after.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare \
  openspec/changes/refine-web-home-interactions-and-demo/verification-state.json /tmp/refine-web-reverify-before.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare \
  /tmp/refine-web-reverify-before.json /tmp/refine-web-reverify-after.json
```

旧state比较在替换state之前完成。before/after compare exit0，changed:false，665个输入在检查期间未变。排除项与原基线一致，限于构建、证据输出、依赖副本及运行缓存；相关代码/测试/依赖声明/配置/控制性规划保持覆盖。快照定位输入，不单独证明行为。


归档前增量快照：使用上述同root及同排除项，分别输出`/tmp/refine-web-postsync-before.json`、`/tmp/refine-web-postsync-after.json`。将先前保存state与postsync-before比较，exit1且仅`openspec/specs/pandora-requirements-aligned-prototype/spec.md`修改；after与before比较exit0、changed:false，665文件。after由技能脚本生成并复制为当前state，未手填哈希。归档移动前将再次按当前state比较。此轮主规格同步属于已验证delta的语义合并，不重跑无输入变化的浏览器或API套件。

| 本次增量检查 | 结果 |
| ------------ | ---- |
| `openspec validate --specs --strict --json --no-interactive` | PASS，2/2；仅长要求文本INFO，无警告/错误 |
| `openspec validate refine-web-home-interactions-and-demo --type change --strict --json --no-interactive` | PASS，1/1，0 issues |
| 同步主规格与delta逐要求比较 | 8/8完全相等，其他54要求与原主规格一致，单一Requirements节、无delta操作标题、无丢失原场景 |
| postsync before/after快照比较 | PASS，exit0，检查期间相关输入未变 |

## Apply Handoff Review

交接正确标识change与项目。修复说明已读并逐项复核，未采用其自测结果替代独立执行。

| Reminder | Disposition / evidence |
| -------- | ---------------------- |
| Legacy assertions aligned / 异步排序焦点 | 复用前轮独立审阅及fixed web178项员工检查，含六种排序重绘后焦点；任务表单、分页检查及依赖未变。 |
| Touch is synthetic | 确认：修复复验鼠标使用真实CDP输入；纵向touch使用Input.dispatchTouchEvent；pointercancel/blur为事件注入。 |
| Fixed-height two-week viewport | 修复复验daily完整套件重验四视口、384px scroller、32px轨道/36px日期格、两完整周、短屏及月边界；无CSS变更。 |
| Demo environment | 复用前轮新空显式目标pandora_precheck_demo_3261f37b31d6、业务日2026-11-15、manifest3、真实DemoSeed和四角色演示。seed/准备流程/服务未变；修复复验重新验证拖动及当前打包。未操作现有pandora_demo或业务pandora；交接提及的旧V35库不作为证据。 |
| Resource fingerprints | 修复复验当前JAR重新打包及15/15检查通过。 |
| Audit artifacts | 修复复验独立重跑产生的audit已另存output/e13-web-reverify/audit；tracked audit恢复修复复验开始字节。前轮结果明确标为复用。 |
| Uncommitted continuation / no Android edits | 交接revision/55路径说明过时；前轮删除属实。当前36文件恢复与规划基线逐blob/权限相等，V-001 verified-resolved；恢复仍为untracked，未更改用户index。 |
| Database service running | 开始时13306未运行；只启动现有项目MySQL，检查使用随机自动清理库，结束停止修复复验启动的服务，恢复初始状态。 |

## Checks

修复复验独立执行：

| Command or inspection | Result | Notes |
| --------------------- | ------ | ----- |
| openspec status / instructions apply --change refine-web-home-interactions-and-demo --json | 完整 | repo-local/spec-driven，contextFiles全部重读；21/21仅为实施声明 |
| `openspec validate refine-web-home-interactions-and-demo --type change --strict --json --no-interactive` | PASS | 1 valid，0 issues |
| `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 -DskipTests package`（backend/） | PASS | 当前静态资源重新打包；backend源码/依赖未变，单测复用下表 |
| `python3 -u backend/scripts/check_daily_items.py` | PASS | exit0；79 API/迁移 + 306 Chrome；检查真实数据，不以日志结束码代替断言 |
| `python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output output/e13-web-reverify/web-resources.json` | PASS | 15/15，源文件hash/HTML版本/白名单/JAR字节一致 |
| 5fe33e4客户端树逐文件比较 | PASS | 214文件blob及可执行位完全一致；36个android文件恢复；95个额外文件全是Git忽略的既有运行产物，未归属本change |
| Fixture18234 + 内存node -e/CDP补查 | PASS | 20个断言；真实401/404、U06合并重放、月份上限来源保护与取消；focused.log，无持久测试文件 |
| `git diff --check` | PASS | 修复差异无空白问题 |
| before/after snapshot compare | PASS | exit0，无相关输入中途变化 |

修复复验daily套件确认：完整七日周左右/上下外松开、表头、周间空隙、月外gap及仅pointerup变坐标均取消，确认草稿/ghost/PATCH均无，真实范围及版本不变；pointercancel/blur同样取消。有效跨周/跨月拖动、已完成续接段、整体范围/正文/完成值/ID、已加载月缓存同步与刷新持久化通过。零位移、短按/滚动分流、Escape、确认/取消、网络失败同键重试、已提交响应丢失重放、412、保存中换账号及迟到响应隔离、边缘补月和纵向合成touch全部通过。

Fixture18234补查使用当前JAR及随机库：真实鼠标拖到确认后，通过外部API删除该事项再确认，得到404且可读错误及原草稿保留，不重建记录；通过外部API撤销浏览器当前session再确认，得到401，旧token/drag/cache清理，重新登录原范围/版本不变。U06在真实已登录Chrome调用生产rememberPeople，重放姓名摘要→完整资料更新→后续姓名摘要，组织/职位不丢，联系方式不入普通缓存；与前轮真实组织更新API读回形成组合证据，资料输入重放为合成，并非新执行管理员改组端到端流程。活动CDP拖动中24次将滚动位置送到加载边缘以加速生产rAF补月，达到12个月DOM上限仍保留来源，Escape取消后真实范围/版本不变；没有宣称一次手势实际遍历超过12个月。

以下为**前轮独立执行、此轮复用**，不是修复复验重跑。对应源码/检查/依赖/配置均在旧state比较中未变；修复复验目标命中修复的邻近影响已由当前daily套件覆盖：

| Command / scope | Previous independent result | Reuse rationale |
| --------------- | --------------------------- | --------------- |
| Maven `test package`（JDK21/offline项目缓存） | 129 tests，0 failures/errors | backend业务、迁移、配置及依赖未变；修复复验package更新静态资源 |
| check_admin_contract.py | 42 | 管理端正文契约及CRUD未变 |
| check_chapter8_web.py | 57 Chrome | pin/tenure模块与CSS未变 |
| check_fixed_communication_web.py | 34 Chrome | 评论模块与服务未变 |
| check_employee_contracts_upgrade.py --skip-witness | 329 | 空库链/权限/资料未变；修复复验daily重跑V30升级witness |
| check_fixed_web.py | 17 admin +178 employee Chrome | 其他页面/表单/焦点未变；首页/日历修复复验daily再验 |
| check_final_demo.py | 94 +83 Chrome | 同业务日；真实种子/准备流程未变；当前拖动和资源重新验证 |
| 独立演示密码矩阵 | override员工/管理员200、111为401；正常改密111为400、合法新密码200；重复准备保留修改 | 配置/凭证规则/准备流程未变 |
| check_schedule_drag.py | PASS | 原公司月/日历独立引擎及任务审核未变 |
| check_fixed_notifications.py | PASS | 后端作者控制、删除/缺失/撤权脱敏未变 |
| check_demo_extremes.py | 130 | 极限夹具及相关业务未变，仍与默认种子分离 |

前轮真实默认demo证据：`output/task-creation-refinement/{final-demo.json,demo-roles-browser.json,demo-drag-employee.png}`；62任务、10事件纪，真实事项353a9e49-0280-4a04-8db8-c470b7edc01a由11-14..16拖到11-13..15，确认保存并刷新保持。四主角各有1–2条前十内逾期及普通对照、长正文和pin。密码矩阵使用新空显式目标/唯一marker、覆盖值首次准备、auth/sessions及auth/password、重复准备后重登；未输出私有运行凭证。

## Requirement Coverage

每个场景均保留显式映射。下表“前轮”均指上述仍适用的独立证据，“修复复验”指当前输入上的执行：

| Key | Implementation and independent evidence |
| --- | --------------------------------------- |
| H | WorkspaceService.homeRead、工作区接入.js/正式版.css；修复复验daily完整排序及首页Chrome，前轮fixed web。全量先排序、due/priority/id、全天有效截止、待审有效版、红底仅清单、返回/clamp/键盘及四视口。严格大于/纯文本转义另静态追踪。 |
| C | 每日事项.js/.css及DailyItemService；修复复验daily/refresh/paging，前轮employee-contracts。两周三轨道、唯一日期、完整相交分页、锚点及稀疏+n列定位。 |
| P | TaskTableService/TaskService及任务表单.js/.css；前轮employee-contracts/chapter8独立pin、权限/重放、整行颜色/横滚/hover/刷新。 |
| M | CommentService及标签评论.js；前轮fixed-notifications、communication Chrome及Maven，后端作者控制/冻结/分页/通知脱敏。 |
| U | WorkspaceService/ProfileService/Tenure、个人资料.js、api.js安全合并；前轮employee-contracts/chapter8/fixed web/Maven；修复复验Chrome人员摘要/完整资料合并重放补足U06。 |
| D | DemoSeed、application.yml、start-demo.sh及prepare_demo.py；前轮final-demo/四角色Chrome、密码矩阵及demo-extremes；修复复验相关拖动和打包重新验证。 |
| B | V36、OrganizationService/WorkspaceService及admin.html；修复复验daily升级witness/首页，前轮admin-contract和employee-contracts；旧正文/ID/顺序/版本/创建时间及历史迁移保持。 |
| G | 每日事项.js整条状态机；修复复验306项daily Chrome及Fixture18234。成功/无效目标/取消/指针取消/blur、重试/412/401/404、保存期间切账号/迟到响应、完成跨月续接、边缘加载及来源保护。 |

| Requirement / scenario | Evidence | Result |
| ---------------------- | -------- | ------ |
| H01 · Three-section home dashboard / **Render three modules in their intended positions** | H | PASS（运行及静态证据，见上述范围） |
| H02 · Three-section home dashboard / **Scroll home modules independently** | H | PASS（运行及静态证据，见上述范围） |
| H03 · Three-section home dashboard / **Include self-created assigned work** | H | PASS（运行及静态证据，见上述范围） |
| H04 · Three-section home dashboard / **Exclude work outside the board contract** | H | PASS（运行及静态证据，见上述范围） |
| H05 · Three-section home dashboard / **Rank by deadline then urgency then identifier** | H | PASS（运行及静态证据，见上述范围） |
| H06 · Three-section home dashboard / **Rank a newly assigned old task** | H | PASS（运行及静态证据，见上述范围） |
| H07 · Three-section home dashboard / **Show concise tasks and read only company information** | H | PASS（运行及静态证据，见上述范围） |
| H08 · Three-section home dashboard / **Reject company information above the limit** | H | PASS（运行及静态证据，见上述范围） |
| H09 · Three-section home dashboard / **Remove only the home log presentation** | H | PASS（运行及静态证据，见上述范围） |
| H10 · Three-section home dashboard / **Separate creation actions** | H | PASS（运行及静态证据，见上述范围） |
| H11 · Three-section home dashboard / **Reserve three complete rows in both upper cards** | H | PASS（运行及静态证据，见上述范围） |
| H12 · Three-section home dashboard / **Keep the daily header compact** | H | PASS（运行及静态证据，见上述范围） |
| H13 · Three-section home dashboard / **Restore the board list after detail** | H | PASS（运行及静态证据，见上述范围） |
| H14 · Three-section home dashboard / **Clamp and independently expand company bodies** | H | PASS（运行及静态证据，见上述范围） |
| H15 · Three-section home dashboard / **Sort the complete board before limiting** | H | PASS（运行及静态证据，见上述范围） |
| H16 · Three-section home dashboard / **Tint overdue board rows only in the complete list** | H | PASS（运行及静态证据，见上述范围） |
| H17 · Three-section home dashboard / **Keep home typography and remove redundant badges** | H | PASS（运行及静态证据，见上述范围） |
| C01 · Vertical continuous daily-item calendar / **Browse vertically immediately after refresh** | C | PASS（运行及静态证据，见上述范围） |
| C02 · Vertical continuous daily-item calendar / **Read every range intersection and page** | C | PASS（运行及静态证据，见上述范围） |
| C03 · Vertical continuous daily-item calendar / **Retain separate calendar anchors** | C | PASS（运行及静态证据，见上述范围） |
| C04 · Vertical continuous daily-item calendar / **Show two weeks with taller item bars** | C | PASS（运行及静态证据，见上述范围） |
| C05 · Vertical continuous daily-item calendar / **Place sparse overflow in the correct weekday column** | C | PASS（运行及静态证据，见上述范围） |
| P01 · Independent personal task table pin / **Read pinned rows across table columns** | P | PASS（运行及静态证据，见上述范围） |
| P02 · Independent personal task table pin / **Pin a created but unassigned task only in the table** | P | PASS（运行及静态证据，见上述范围） |
| P03 · Independent personal task table pin / **Keep preference writes separate from business mutations** | P | PASS（运行及静态证据，见上述范围） |
| P04 · Independent personal task table pin / **Never regain access from a stale pin** | P | PASS（运行及静态证据，见上述范围） |
| M01 · Flat comments with author control and targeted notifications / **Keep author editing without a Web delete action** | M | PASS（运行及静态证据，见上述范围） |
| M02 · Flat comments with author control and targeted notifications / **Comment while business fields are read-only** | M | PASS（运行及静态证据，见上述范围） |
| M03 · Flat comments with author control and targeted notifications / **Manage only one's own flat comments** | M | PASS（运行及静态证据，见上述范围） |
| M04 · Flat comments with author control and targeted notifications / **Deliver only the targeted new-comment notification** | M | PASS（运行及静态证据，见上述范围） |
| M05 · Flat comments with author control and targeted notifications / **Page comments in stable publication order** | M | PASS（运行及静态证据，见上述范围） |
| M06 · Flat comments with author control and targeted notifications / **Preserve comment redaction under new organization scopes** | M | PASS（运行及静态证据，见上述范围） |
| U01 · Minimal profile page / **Read tenure without an as-of suffix** | U | PASS（运行及静态证据，见上述范围） |
| U02 · Minimal profile page / **Read and edit the required profile** | U | PASS（运行及静态证据，见上述范围） |
| U03 · Minimal profile page / **Open a subordinate within both profile scope and the management chain** | U | PASS（运行及静态证据，见上述范围） |
| U04 · Minimal profile page / **View profile** | U | PASS（运行及静态证据，见上述范围） |
| U05 · Minimal profile page / **Keep identity fields read-only to employees** | U | PASS（运行及静态证据，见上述范围） |
| U06 · Minimal profile page / **Refresh a known person without losing organization fields** | U；修复复验真实Chrome中的摘要/完整资料合并重放，加上前轮真实组织更新API读回 | PASS（组合运行证据及静态追踪） |
| U07 · Minimal profile page / **Read contact details only inside the actual management chain** | U | PASS（运行及静态证据，见上述范围） |
| U08 · Minimal profile page / **Calculate completed tenure at calendar boundaries** | U | PASS（运行及静态证据，见上述范围） |
| U09 · Minimal profile page / **Hide identity while retaining actual organization and permissions** | U | PASS（运行及静态证据，见上述范围） |
| U10 · Minimal profile page / **Show empty subordinate contacts and tenure** | U | PASS（运行及静态证据，见上述范围） |
| U11 · Minimal profile page / **Show own employment fields once** | U | PASS（运行及静态证据，见上述范围） |
| U12 · Minimal profile page / **Preserve subordinate employment details** | U | PASS（运行及静态证据，见上述范围） |
| D01 · Persistent demonstration data for web and administration / **Use the new default demo login without changing database credentials** | D | PASS（运行及静态证据，见上述范围） |
| D02 · Persistent demonstration data for web and administration / **Demonstrate the small set of new interactions** | D | PASS（运行及静态证据，见上述范围） |
| D03 · Persistent demonstration data for web and administration / **Run a continuous demo after refresh** | D | PASS（运行及静态证据，见上述范围） |
| D04 · Persistent demonstration data for web and administration / **Prepare a complete repeatable new-model demonstration** | D | PASS（运行及静态证据，见上述范围） |
| D05 · Persistent demonstration data for web and administration / **Follow the four real animation roles** | D | PASS（运行及静态证据，见上述范围） |
| D06 · Persistent demonstration data for web and administration / **Preserve edits and keep extreme fixtures separate** | D | PASS（运行及静态证据，见上述范围） |
| D07 · Persistent demonstration data for web and administration / **Demonstrate every protagonist's own work and task chain** | D | PASS（运行及静态证据，见上述范围） |
| D08 · Persistent demonstration data for web and administration / **Exercise the new Web interactions using real records** | D | PASS（运行及静态证据，见上述范围） |
| D09 · Persistent demonstration data for web and administration / **Prepare a current dataset without resetting edited data** | D | PASS（运行及静态证据，见上述范围） |
| D10 · Persistent demonstration data for web and administration / **Demonstrate multiple tags on tasks and logs** | D | PASS（运行及静态证据，见上述范围） |
| D11 · Persistent demonstration data for web and administration / **Rebuild for new samples while keeping preservation semantics** | D | PASS（运行及静态证据，见上述范围） |
| B01 · Body-only company chronicles / **Maintain company chronicles using only body** | B | PASS（运行及静态证据，见上述范围） |
| B02 · Body-only company chronicles / **Reject retired title input atomically** | B | PASS（运行及静态证据，见上述范围） |
| B03 · Body-only company chronicles / **Upgrade existing company bodies without rewriting content** | B | PASS（运行及静态证据，见上述范围） |
| G01 · Daily-item whole-range dragging / **Move a ranged item from its middle segment** | G | PASS（运行及静态证据，见上述范围） |
| G02 · Daily-item whole-range dragging / **Separate scrolling short clicks and dragging** | G | PASS（运行及静态证据，见上述范围） |
| G03 · Daily-item whole-range dragging / **Cancel or retry a versioned range move** | G；修复复验取消/无效目标/迟到响应/401/404及重试检查 | PASS；V-002 verified-resolved |

所有强制场景有充分组合证据。静态证据用于简单判定/允许字段/作用域及分支追踪，交互可运行部分已按上述执行；未将所有排列都称为物理设备操作。三处客户端范围排除已恢复满足。没有修改实现、测试、规划、任务或implementation-notes，未归档；检查只用自动清理随机库。

## Findings

### V-001: Web change 删除了明确排除的 Android 工程（已解决）

- Category: implementation
- Severity: medium
- Requirement: proposal Impact、design Non-Goals、tasks8.2，保留android/、flutter/、android-shell/。
- Evidence: 首次在1de3d56确认36个android文件删除；修复复验对照5fe33e4逐Git blob和权限比较，三目录214个受版本控制文件均一致，含全部36个恢复的Android文件和wrapper二进制。
- Expected: 保留本change范围外客户端工程。
- Actual: 当前磁盘已恢复；恢复文件仍为untracked，用户index未修改。验证依据包含这些文件，不能只提交Web修复而遗漏恢复文件。
- Acceptance checks: `output/e13-web-reverify/android-restoration-independent.json`：allEqual=true，androidFiles=36，unignoredExtras=[]；无需Android构建。
- Repair status: verified-resolved
- Repair notes: 2026-11-15：使用 `git archive 5fe33e4 android | tar -x` 恢复全部36个Android文件，逐文件核对Git blob及可执行位均与基线一致（含wrapper二进制）。恢复文件当前为untracked；为不改变用户真实index，用临时index及临时object目录对这些文件执行 `git add -N -- android` 后运行指定的 `git diff --exit-code 5fe33e4 -- android flutter android-shell`，exit0，三目录与基线无差异。证据 `output/e13-web-repair/android-restoration.json`。未构建Android产物；Web/backend实现保留。待独立复验，未更改总体FAIL。
- Reverification notes: 修复复验独立核对内容与可执行位通过，不依赖修复方临时index结论；原删除发现保留为历史。

### V-002: 日历外松开被夹到日期并进入改期确认（已解决）

- Category: implementation
- Severity: medium
- Requirement: Daily-item whole-range dragging、Cancel or retry a versioned range move及design Decision3的真实二维日期命中/无效目标取消。
- Evidence: 首轮完整七日周在scroller左外松开生成错误草稿。当前dragPointAt检查scroller边界/表头/周行/真实日期列，finishDrag按pointerup最终坐标重算；独立daily套件及补查全部通过。
- Expected: 无效松开无确认/写入，仍可有效跨周/月及边缘滚动。
- Actual: 左右上下外、表头/周间空隙/月外gap和仅pointerup变坐标均取消；无PATCH、范围/版本不变；有效完成跨月续接/边缘拖动和原重试/会话行为通过。
- Acceptance checks: `python3 -u backend/scripts/check_daily_items.py` exit0，79 API/迁移+306 Chrome；`focused.log`补查真实401/404及12月容量来源保护通过。
- Repair status: verified-resolved
- Repair notes: 2026-11-15：先以当前JAR及隔离Fixture18233、真实Chrome/CDP鼠标复现完整七日周左外松开仍弹出确认（`output/e13-web-repair/before-fix.log`），未确认错误保存。修改 `潘多拉-每日事项.js`：目标必须在scroller可见范围内、星期表头下方、真实周行及日期列内；移除最近周和横向clamp；pointerup按最终坐标重新命中。边缘自动滚动仍独立运行。扩展 `backend/scripts/check_daily_items_drag_browser.js`，调整 `check_daily_items.py` 的专用拖动夹具到完整七日周，避免月外gap造成假通过。新增左右上下外部、表头/周间空隙/月外gap、仅pointerup改变落点、pointercancel/blur、保存中换账号及迟到响应隔离、已完成跨月续接段跨周整体保存/缓存同步/刷新、边缘补月与取消回归；纵向touch明确用headless Chrome合成CDP事件，pointercancel/blur为事件注入，无物理触屏声明。原零位移、确认/取消/Escape、网络失败/同键重试、已提交响应丢失重放、版本冲突和拖动中退出继续通过。最终 `python3 -u backend/scripts/check_daily_items.py` exit0：79项API/迁移及306项浏览器检查通过（`output/e13-web-repair/daily-items-final.log`）；跨月及边缘定向检查也通过（`cross-month-and-edge.log`）。运行资源指纹更新脚本，修改 `潘多拉-交互原型.html` 的每日事项版本；JDK21下 `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 -DskipTests package` 成功，资源检查15/15；JS语法检查、Python编译检查及 `git diff --check` 通过。修复复验证据汇总于 `output/e13-web-repair/results.json`，生成的tracked audit已复制到该目录后恢复原内容。测试只使用随机隔离库并自动清理，未重建现有业务/demo库。待独立复验，未更改总体FAIL。
- Reverification notes: 独立重跑当前修复和扩展断言，审阅检查确实使用完整七日周及真实服务读回；保存期间切账号/迟到响应、pointercancel/blur及已完成跨月续接证据已补足。合成触摸/事件类型如实标注。

下一步：`$openspec-e13-archive-change refine-web-home-interactions-and-demo`。PASS仅适用于记录的665文件输入及当前修复；相关代码、检查、依赖、配置或规划再变更需重新验证。
