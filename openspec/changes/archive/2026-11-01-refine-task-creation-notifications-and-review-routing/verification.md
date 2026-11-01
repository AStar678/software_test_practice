# Implementation Verification

- Change: refine-task-creation-notifications-and-review-routing
- Schema: spec-driven
- Verdict: PASS
- Verified at: 2026-11-01T12:04:20.872033+00:00
- Implementation roots: /Users/watuji/MyGitDev/software_test_practice
- Planning root: /Users/watuji/MyGitDev/software_test_practice（同根）
- Verified revision: 4c0ccf52813b4f7bdd388012fdde42a0cf483427；工作区包含本次主规格同步与四项验证交接，尚未归档/提交

## Summary

主规格同步后增量复验 PASS。唯一库存差异为主规格；本 change 的 delta、实现、测试、依赖、配置及运行条件未变，既有逐场景独立证据仍适用。三项共27条需求/158个场景的正文及场景与主规格一致，无遗漏；不重跑未受影响的运行检查。以下保留的功能结果来自 2026-11-01T11:56:53.784941+00:00 的独立验证，不表示本次重复运行。

PASS。当前18条requirement、137个命名scenario按当前THEN语义覆盖；原接管/交接两项发现已独立复验解决，旧失效创建重提和完成结果执行缺口已补齐。共享日志“冻结失败保留草稿”是separate的新验收合同，其V-001不表示本change的服务端冻结失效；整组发布/归档仍需分别满足各change结论。

## Verification Basis

| 当前增量范围 | 证据与结果 |
| --- | --- |
| 当前 verification-state.json | 374 files；SHA-256 `1483309fc75ad9d0bd13808322b365fc87000e748d21afd1fb84c93f48c38faa` |
| 旧state→同步后before | 三项均只有 `openspec/specs/pandora-requirements-aligned-prototype/spec.md` modified；无新增/删除或排除范围变化；旧state SHA与旧报告一致 |
| 当前规格与覆盖 | 已重新读取 status/apply contextFiles、实施交接及旧报告。三项18/2/7条需求、137/8/13个场景均核对规范正文与同名场景全文；所有场景仍有既有独立矩阵证据；12条MODIFIED不遗漏旧场景，15条ADDED完整新增 |
| 非本次范围 | 主规格原Purpose和其余需求未变；未合入 separate-log-forms-and-clean-product-copy 新增需求；其FAIL及pending发现保持 |
| 复用运行证据依据 | 实现/测试/依赖/配置/各change规划均逐文件与刚才独立验证相同；本次仅把相同验收合同合入主规格，运行环境无调整，原覆盖、已解决发现及非阻塞风险继续有效 |
| before→after | 同根及原排除项 capture，再 compare 退出0、changed=false；无验证中输入漂移 |

当前 capture 命令：

```sh
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture --root /Users/watuji/MyGitDev/software_test_practice --exclude 'output/*' --exclude 'backend/target/*' --exclude 'backend/.runtime/*' --exclude 'android/.toolchain/*' --exclude 'android-shell/.build/*' --exclude 'audit/*' --output /tmp/three-sync-verify-before.json
# 先将原 verification-state.json 与 before compare：只允许上述主规格 modified。
# 核对主规格每条delta需求正文、逐场景全文、旧场景保留和无关需求未改后，同命令capture到after：
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare /tmp/three-sync-verify-before.json /tmp/three-sync-verify-after.json
```

复现同步核对时，以需求名定位主规格与delta；MODIFIED的描述及每个同名场景须全文一致，旧场景名集合不得减少；ADDED须完整存在。主规格其他需求块及Purpose与 `git show 4c0ccf5:openspec/specs/pandora-requirements-aligned-prototype/spec.md` 相同。对照下文逐场景矩阵，新增本次执行项见Checks。最终state由脚本生成after复制，未手写库存。

### Retained prior independent evidence basis

以下为上轮独立运行证据的原输入及命令；其中旧state SHA描述上轮，不代表当前state。

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| OpenSpec contextFiles | status/apply 返回的 proposal、design、tasks 和全部 delta specs 均读取；schema=spec-driven，repo-local，无 store；勾选仅为实施声明 |
| 当前根目录网页实际加载链与样式、admin.html | API/任务接入/工作区/日程/任务表单/个人资料/标签评论；使用真实打包资源，不验证未加载副本 |
| backend/src、迁移、tests、scripts、POM与配置 | 路由/标签/通知/日志/组织/接管/提醒及相关单元和真实服务验证；精确库存见state |
| 验证输入 | `4c0ccf52813b4f7bdd388012fdde42a0cf483427`；开始时git工作区干净；本轮只留下四项verification.md与生成state，未改代码、测试、规划、任务勾选或实施交接 |
| verification-state.json | 374 files；SHA-256 `40571dff5a6b8659c48f510c419b0590175cd502241d51e26acb3b8d833f4027` |

旧state的实际SHA与各旧报告一致：refine=`11dde99d4597e9903a9eeb77f0fbf73351514284628012662a6b4006025310eb`；staff=`cd3595f24f9a787958ac589cfa89fbf4f2b7f9952b3e96bcb85cf32c34b88bf6`；schedule=`a59b248481221b9cadf3701623ac5e40558afb516368d0a930a472440af90e3e`。三次旧state→before比较均退出1，涉及共同前端、TaskService.currentRoute、测试和控制规划变化，refine还改变了旧排除范围。separate无旧报告/state，本轮建立基线，不因此判BLOCKED。采用增量差异定位并扩展到全部当前规格覆盖，所有表内执行结果均本轮独立获得；没有把apply数字或旧PASS复制为当前证据。未变的服务端日志/访问/提醒代码另经当前单测/API重验；旧失效重提/完成结果缺口用EDGE补齐。

唯一实现/规划根为 `/Users/watuji/MyGitDev/software_test_practice`。快照命令（同根同时覆盖实现和全部规划）：

```sh
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture --root /Users/watuji/MyGitDev/software_test_practice --exclude 'output/*' --exclude 'backend/target/*' --exclude 'backend/.runtime/*' --exclude 'android/.toolchain/*' --exclude 'android-shell/.build/*' --exclude 'audit/*' --output /tmp/four-change-verify-before.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare openspec/changes/<change>/verification-state.json /tmp/four-change-verify-before.json
# 同一capture命令，仅将output改为 /tmp/four-change-verify-after.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare /tmp/four-change-verify-before.json /tmp/four-change-verify-after.json
```

before/after比较退出0，changed=false，374项及SHA完全相同；比较后才复制脚本生成的after为最终state。排除仅为输出、构建/运行缓存、Android工具链及历史审计；git ignore生效；相关代码、测试、依赖声明、配置和所有控制规划均覆盖。脚本自动排除handoff/report/state，handoff单独完整读取。库存界定输入，不是通过证明。

macOS、Java21、Node24、离线Maven缓存、本机Chrome与MySQL13306。沙箱内MySQL连接被拒，工具获准沙箱外重跑后完成；非未解决的环境问题。仅创建并自动清理随机Fixture/演示测试库和临时服务，没有访问生产、重启现有预览、发布、归档或做真机/软键盘测试。36个测试写入的已跟踪audit输出已保存到临时证据目录并恢复到入口干净内容，未把旧audit文件当成新结果。输出路径为临时执行线索，决定性观察及复现步骤写入报告，不依赖临时文件永久存在。

## Apply Handoff Review

已读取本change的implementation-notes.md，名称和当前项目根匹配；交接所写旧revision及“未提交工作区”已被当前clean commit替代，属于时间上的陈旧说明；实现声明均按当前代码和本轮检查复核，没有把交接当验收权威。

| 交接提醒 | 本轮处置 |
| --- | --- |
| 1.4接管不获审核权、原申请人不变、停用后由接管人直属上级审重开 | TAKE87、CHAIN24、ROUTE204确认；V-001/V-002 verified-resolved |
| currentRoute仅reopen在旧负责人无效时检查提议负责人，普通冻结详情不读取提议 | 检查TaskService.currentRoute，TAKE/CHAIN真实停用重开通过；本轮TaskParticipantSummaryTest通过 |
| 置顶元素或标题★均可，不因旧DOM误判 | CAL102及SORT4确认；未以单一旧.p-pin作为唯一证据 |
| 无部门候选显示公司层/真实职位组织，同名跨团队 | FORM候选白名单与39浏览器断言确认 |
| 多标签/迁移/通知来源/单一对象跳转/本人表单与缺失日志 | FORM/UPGRADE/NOTICE/COMM/LOG确认；全文规格范围见矩阵 |
| 共享最终日级月历/小时日轴/全天区及下属无拖动 | DRAG211、STAFF82、PERM21确认；不用旧15分钟/小时比例/下属可拖动证据 |
| 资源缓存号刷新/本地8080预览 | RES14确认当前JAR；8080交付声明不作为独立证据 |
| 综合员工套件仍有旧下属/日志断言 | 本轮WEB确认旧p-open-person-logs使套件中断；不采纳“与变更无关所以忽略”的断言，交由显式要求check_work_logs的separate V-002。refine负责的完成态、重开和此前已执行表单前缀已验证，未宣称WEB全绿 |
| 真机/发布及旧机器信息 | 明确排除；未使用旧机器路径、历史部署和旧数字作证据 |

## Checks

本次增量实际执行：`openspec validate --specs --strict --json --no-interactive`（1/1，只有长文本INFO）；本 change 的 `openspec validate refine-task-creation-notifications-and-review-routing --type change --strict --json --no-interactive`（valid=true、issues=[]）；27条需求/158个场景同步核对（PASS）；旧state与before仅主规格变化；before/after完全相同；`git diff --check`退出0。以下功能运行结果保留自上轮独立验证，本次未重复执行。

| Command or inspection | Result | Notes |
| --- | --- | --- |
| openspec status --change refine-task-creation-notifications-and-review-routing --json / openspec instructions apply --change refine-task-creation-notifications-and-review-routing --json | PASS | contextFiles完整、all_done；非独立完成证据 |
| openspec validate refine-task-creation-notifications-and-review-routing --type change --strict --json --no-interactive | PASS | valid=true，issues=[]，退出0 |
| BUILD: `python3 backend/scripts/build_refinement_verification.py` | PASS | 111 tests；0 failures/errors/skipped；退出0。离线 Maven test/package；临时 POM 仅排除历史 Finder 副本，正式 POM 不变。 |
| FORM: `python3 backend/scripts/check_task_creation_refinement.py` | PASS | 36 API + 39 browser；退出0；output/task-creation-refinement/{api-report,browser-report}.json。 |
| ROUTE: `python3 backend/scripts/check_review_routing.py` | PASS | 204；退出0；output/task-creation-refinement/review-routing.json。 |
| TAKE: `python3 backend/scripts/check_business_takeover.py` | PASS | 87；退出0；真实前置审批、接管/停用/重开、回滚与并发。 |
| CHAIN: `python3 backend/scripts/check_handover_chain.py` | PASS | 24；退出0；实际启动并完成 Chrome 交接/停用/接管/重开链。 |
| UPGRADE: `python3 backend/scripts/check_task_refinement_upgrade.py` | PASS | 13；退出0；V27→V28 单值/空值/删除标签快照、重复启动、旧有效待审刷新及原申请人/终态保持。 |
| NOTICE: `python3 backend/scripts/check_fixed_notifications.py` | PASS | 49；退出0；通知字段来源、撤权/撤回/缺失对象、独立评论与日志冻结。 |
| COMM: `python3 backend/scripts/check_fixed_communication_web.py` | PASS | 32；退出0；标签维护、评论、通知单一对象入口与评论定位、受限内容及焦点。 |
| LOG: `python3 backend/scripts/check_log_backfill_entry.py` | PASS | 50；退出0；缺失日期创建、显式ID编辑、同ID/日期/首次创建、320/390/1440 对齐、self-only、冲突不转编辑、中文分析来源。 |
| ACCESS: `python3 backend/scripts/check_fixed_workspace_access.py` | PASS | 62；退出0；四层范围、作者写权、同级/跨部门拒绝、组织变化即时失权。 |
| CAL: `python3 backend/scripts/check_calendar_drawer.py` | PASS | 102；退出0；fixture 先真实批准完成并断言 done，再验抽屉/清单/完成任务/边界/返回。 |
| DRAG: `python3 backend/scripts/check_schedule_drag.py` | PASS（完整重跑） | 211；退出0；output/task-schedule/browser-report.json。首次运行在原地点击断言失败（14 pass），未改源码/测试，原脚本完整重跑211通过；暂时波动未作为确定缺陷。 |
| STAFF: `python3 backend/scripts/check_subordinate_workspace.py` | PASS | 82；退出0；树/组织、四种完成态、日级几何、详情原权限、日志分页、失权/旧响应与会话；output/subordinate-workspace/browser-report.json。 |
| PERM: `python3 backend/scripts/check_visible_schedule_permissions.py` | PASS | 21；退出0；非责任方仅排期、恶意字段拒绝、提交与批准时失权、完成/冻结/版本。 |
| DEMO: `env -u PANDORA_DEMO_PASSWORD python3 backend/scripts/check_final_demo.py` | PASS | 55；退出0；仅自行创建随机演示测试库，重复准备/重启/真实用户编辑保持，未重置现有演示库。 |
| RES: `python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /tmp/four-verify-resources.json` | PASS | 14/14；源文件、缓存版本与实际JAR静态资源逐字节一致。 |
| EDGE: `补充隔离 API + Chrome 失效创建重提/完成结果检查` | PASS | 8 API 断言 + 实际失效申请→修改并重提界面；另人拒绝、不同键并发仅一笔新申请、旧终态不可复活、完成撤销恢复todo/退回需意见且变doing；真实正文和意见含“标签 原型”保持。复现方式见下文。 |
| WEB: `python3 backend/scripts/check_fixed_web.py（check_work_logs.py 的受委托子套件）` | FAIL / 旧断言 | 135 条 PASS 后 actual descendant contact and log entry founder 失败；旧 p-open-person-logs 与本人页人员筛选断言不符合当前专用工作页/self-only合同。见 separate-log-forms-and-clean-product-copy V-002；未将中断后的行为计为已验证。 |
| node --check（8个根目录实际JS） / git diff --check | PASS | 全部退出0；不以语法通过替代功能验收 |
| 本轮截图阅读 | PASS（所观察布局） | tree-320、allday-handles-320、edit-aligned-390已实际查看；其余三宽度用浏览器几何断言覆盖 |
| before/after snapshot compare | PASS | changed=false，输入无变化 |

EDGE复现：随机Fixture(port=18216,worker=True,controllable=True)中，员工创建截止100秒后的待创建任务→admin/clock/advance 101秒→admin/worker/run-once→确认expired/unpublished；同任务当前版本用两个不同幂等键并发PATCH(command=create,未来完整排期)，状态为200及409/412且仅一条新pending，原申请保持expired、旧决定失败。正常发布后，complete→作者withdraw恢复todo，另一complete无意见reject返回400、有意见reject变doing并解冻。Chrome以该员工打开另一失效申请，实际点击“修改并重提”，观察drafts.task.mode=resubmit、原taskId/负责人/提议均保留、日期时刻可编辑；任务接入.js resubmitCreate/saveTask链静态追踪。决定性8项API与入口检查均通过；代码/测试未修改。

## Requirement Coverage

每行同时覆盖该requirement的规范正文和逐项列出的全部scenario；旧标题与新THEN冲突时以THEN及规范正文为准。

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| **Calendar task views**（spec:5）<br>S:24 `Filter the calendar without revoking other access`<br>S:28 `Reach sidebar creation applications and task table`<br>S:32 `Scroll across month and year boundaries`<br>S:36 `Preserve adjustable cells and complete overflow access`<br>S:40 `Show timed cross-day midnight and point tasks`<br>S:44 `Show more than five overlapping and all-day tasks`<br>S:48 `Pin and color without moving time`<br>S:52 `Use the required calendar entry points`<br>S:56 `Read a month and open a complete day list`<br>S:60 `Pin only one's own ordering`<br>S:64 `Split a timed cross day task`<br>S:68 `Display every overlapping and all day task`<br>S:72 `Switch a whole week while preserving weekday`<br>S:76 `Count mutually exclusive relationships`<br>S:80 `Open the default month view`<br>S:84 `Select a year and month`<br>S:88 `Drill from month to week`<br>S:92 `Ignore blank month task space`<br>S:96 `Drill from week to day`<br>S:100 `Ignore blank week task space`<br>S:104 `Switch time granularity`<br>S:108 `Keep task clicks distinct from drill-down`<br>S:112 `Navigate and return from a week`<br>S:116 `Navigate and return from a day`<br>S:120 `Render a spanning task bar`<br>S:124 `Render an all-day task`<br>S:128 `Distinguish visible tasks`<br>S:132 `Identify the current user's task relationship`<br>S:136 `Show only task names in bars`<br>S:140 `Order visible task lanes`<br>S:144 `Fill five monthly task rows`<br>S:148 `Handle crowded time slots`<br>S:152 `Open overflow tasks for one date`<br>S:156 `Preserve calendar navigation after table return`<br>S:160 `Overlay a narrow accessible schedule drawer`<br>S:164 `Open a sheet from every part of a monthly date`<br>S:168 `Return through nested detail and dismiss without losing context`<br>S:172 `Classify full-day coverage without changing schedules` | 日程视图.js 的本人过滤、monthWeek/dayCoverage、月流/抽屉/清单/焦点；CAL、DRAG、STAFF、FORM 颜色与有效数据对照。 | PASS |
| **Role-scoped task creation and assignment**（spec:176）<br>S:181 `Assign across departments and upward`<br>S:185 `Remove the creator and preserve selection order`<br>S:189 `Keep dispatch separate from unrelated access`<br>S:193 `Isolate an unpublished creation`<br>S:197 `Select and order authorized assignees`<br>S:201 `Enforce dispatch independently from viewing`<br>S:205 `Executive selects assignees across departments`<br>S:209 `Manager assigns a departmental task`<br>S:213 `Cancel assignee selection`<br>S:217 `Search for an unavailable assignee`<br>S:221 `Employee submits a self-created task`<br>S:225 `Superior reviews a self-created task`<br>S:229 `Select company members during a later owner change`<br>S:233 `Expand and select a real hierarchy`<br>S:237 `Show candidates without a department or team` | TaskService.assigneeCandidates/create/validateAssignable；任务接入.js/交互原型.js 的树与选择工作副本；FORM、ROUTE、TAKE、CHAIN。 | PASS |
| **Task editing and completion review**（spec:241）<br>S:246 `Freeze and cancel an application`<br>S:250 `Restrict comparison data to the reviewer`<br>S:254 `Distinguish completion outcomes`<br>S:258 `Reopen with a new schedule`<br>S:262 `Assignee updates progress`<br>S:266 `Show status without numeric progress`<br>S:270 `Creator approves completion`<br>S:274 `Superior rejects completion`<br>S:278 `Render authorized field-by-field differences in saved order`<br>S:282 `Reopen an overdue completed task from the web form`<br>S:286 `Resubmit an expired creation as a new request`<br>S:290 `Validate a direct application as strictly as a reviewed change` | TaskService.change/decide/validateApplicationEffect；任务接入.js 审批/重开/重提；ROUTE、TAKE、CHAIN、DRAG、EDGE，补齐上轮失效重提并发及完成退回/撤销缺口。 | PASS |
| **Required notifications**（spec:294）<br>S:301 `Deliver the submission and result matrix`<br>S:305 `Summarize multiple changes and preserve removed recipients`<br>S:309 `Use actual events without synthetic urgency`<br>S:313 `Inspect task change notification coverage`<br>S:317 `Notify on task creation`<br>S:321 `Surface due and emergency notices`<br>S:325 `Notify people affected by assignment changes`<br>S:329 `Surface review and consultation requests`<br>S:333 `Represent urgent work without a synthetic title`<br>S:337 `Understand the event without opening its detail`<br>S:341 `Notify the current business owner after takeover` | TaskService 真实事件与接收矩阵、WorkspaceService.safeNotification；ROUTE、NOTICE、COMM、FORM；reminder_receipts 轮次/版本去重。系统推送按本规格明确延期。 | PASS |
| **Ordered reviewer routing and reassignment**（spec:345）<br>S:352 `Preview all creator-based routes`<br>S:356 `Block an unavailable configured manager`<br>S:360 `Revalidate after an organization change`<br>S:364 `Preserve ordered non-creation routes`<br>S:368 `Require explicit non-creation self-review`<br>S:372 `Persist order and route the first highest peer`<br>S:376 `Review one's own application explicitly`<br>S:380 `Change assignees using the proposed route`<br>S:384 `Fall back or apply with a documented reason`<br>S:388 `Reassign after organization changes`<br>S:392 `Refresh preexisting pending requests`<br>S:396 `Block an inactive applicant` | TaskService.creationRoute/route/currentRoute/refreshRoutes/requestReviewer；ROUTE、UPGRADE、TAKE、CHAIN，预览/提交/决定统一原申请人当前上级。 | PASS |
| **Dedicated task handover**（spec:400）<br>S:405 `A direct manager hands over a subordinate task`<br>S:409 `Handover approval preserves provenance`<br>S:413 `Distinguish direct manager handover from indirect management` | TaskService.handover/validateRequestActor 及工作圈；ROUTE、CHAIN、TAKE、FORM 真实上级代办、越权/夹带字段拒绝、来源保留。 | PASS |
| **Shared single-select tags for tasks and logs**（spec:417）<br>S:424 `Enforce root-only maintenance and single selection`<br>S:428 `Rename recolor and delete a referenced tag`<br>S:432 `Respect review freezing and calendar color`<br>S:436 `Preserve legacy and historical tags` | V28、TaskService 有序版本标签/历史/diff、Tags.java；FORM、UPGRADE、NOTICE、COMM、LOG。以规范正文的任务多选/日志单选为准。 | PASS |
| **Persistent demonstration data for web and administration**（spec:440）<br>S:447 `Run a continuous demo after refresh`<br>S:451 `Prepare a complete repeatable new-model demonstration` | DemoSeed + prepare_demo；DEMO 55项、新库与重复准备/重启、144任务/36日志/十条公司事项/用户编辑不丢。 | PASS |
| **Atomic employee deactivation and formal business takeover**（spec:455）<br>S:462 `Reopen taken-over completed work with active assignees`<br>S:466 `Deactivate an employee only after all responsibilities are arranged`<br>S:470 `Take over published work without impersonating its creator`<br>S:474 `Refresh valid reviews and revoke old authority atomically` | BusinessTakeovers/OrganizationPlans/TaskService.currentRoute；TAKE、CHAIN、ROUTE。停用后的无效旧负责人重开只在reopen读取新负责人、TaskParticipantSummaryTest 保持普通冻结详情裁剪。 | PASS |
| **Authorized task table page**（spec:478）<br>S:485 `Browse the authorized spreadsheet on a narrow screen`<br>S:489 `Inspect effective data while review is pending`<br>S:493 `Open detail and return without losing context`<br>S:497 `Prioritize mobile columns without changing the data pipeline`<br>S:501 `Simplify visible copy while retaining spreadsheet operations`<br>S:505 `Exclude merely visible subordinate tasks before paging` | 任务表单.js 的computeTaskForm/matchesTaskFilters/排序分页及任务接入鉴权详情；LOG 的先排本人范围、FORM/DRAG有效版对比、WEB 中断前已执行的完整105项任务加载/分页/比较/返回检查；历史例外与无权父项静态追踪。 | PASS |
| **Combined task table filters and search**（spec:509）<br>S:514 `Find a task created and assigned to oneself`<br>S:518 `Apply relation completion title and date together`<br>S:522 `Search beyond the first API page`<br>S:526 `Use company dates independently of device timezone` | 任务表单.js：关系范围在搜索/日期/排序/计数/分页之前；LOG 搜索/刷新不能恢复下属任务；WEB 中断前全结果筛选与分页；公司时区方法独立于设备。 | PASS |
| **Personal work logs**（spec:530）<br>S:539 `Backfill three dates with a full window`<br>S:543 `Freeze after twenty-four hours instead of midnight`<br>S:547 `Preserve the daily slot under concurrency and deletion`<br>S:551 `Preserve full-screen editing and independent links`<br>S:555 `Write and edit a log in a full-screen sheet`<br>S:559 `Enforce one log under concurrent distinct keys`<br>S:563 `Freeze across the midnight boundary`<br>S:567 `Link, clear or redact tasks independently`<br>S:571 `Search and link a visible task`<br>S:575 `Clear a linked task`<br>S:579 `Show no matching linked tasks`<br>S:583 `Write an unlinked log`<br>S:587 `Superior reads a subordinate log`<br>S:591 `Regress actual log entry and the selected editor`<br>S:595 `Keep creation separate from an existing log` | WorkspaceService.createLog/changeLog/requireWritable、WorkspaceLogAndReportsTest；本轮111单测、LOG、ACCESS、NOTICE及真实FREEZE的服务端拒绝证据。scope=self、ID编辑、同日冲突/删除重建/首次24小时、关联裁剪有代码及执行证据；冻结失败草稿新增合同归separate V-001。 | PASS |
| **Notification list presentation and combined filters**（spec:601）<br>S:604 `Filter across page boundaries`<br>S:608 `Require actionable review classification`<br>S:612 `Return after opening an unread notification` | WorkspaceService.notificationsRead、notificationMetadataCategory/category，WorkspaceBatchReadTest的8000项≤8查询及先筛选后分页；FORM、NOTICE、COMM验证返回/全局未读/会话。 | PASS |
| **Generated notification content and one object destination**（spec:616）<br>S:621 `Open one task destination from an ordinary task message`<br>S:625 `Locate the notified comment`<br>S:629 `Generate each supported notification from its event` | 工作区接入.js notificationView 单一对象入口；NOTICE支持事件字段矩阵/缺失/无独立写接口、COMM普通任务及任务/日志评论定位/撤回裁剪。 | PASS |
| **Multi-select task tag controls**（spec:633）<br>S:636 `Toggle and persist several tags` | 标签评论.js taskTagsHTML、任务接入.js tagIds草稿；FORM真实选中/取消/键盘/跨页返回/刷新回读，已删除标记/换行/aria-pressed。 | PASS |
| **Responsive task schedule inputs**（spec:640）<br>S:643 `Use a narrow mobile viewport` | 任务接入.js 显式时分/全天快捷；FORM、DRAG在320/390/1440测量，重复快捷稳定、历史全天实际时刻、逆序拒绝。 | PASS |
| **Personal task table and founder-only tag maintenance**（spec:648）<br>S:652 `Inspect a manager's task table`<br>S:656 `Reject tag maintenance without removing task colors` | 任务表单.js先关系过滤、Tags.requireFounder/canEdit；LOG/API越权覆盖shared/personal，日程无标签行但保留私人/首项/默认颜色。 | PASS |
| **Single creation entry for recent missing logs**（spec:660）<br>S:663 `Create missing days and edit through detail` | 工作区接入.js openLogForm/availableDates、WorkspaceService.createLog；LOG三天逐个创建、已有日不在选项、全写提示、显式ID编辑、抢占冲突保持create。 | PASS |

已检查proposal范围、design实现约束及全部勾选任务；未新增验收要求。共同代码按当前整体快照取证，不把同一提交的所有改动自动归于此change。无本次新增数据库/权限扩张承诺被遗漏；云端发布、回退演练与手机真机按规划不在本轮范围。

## Findings

### V-001: 正式接管套件的旧审核/免审假设

- Category: implementation
- Severity: medium
- Requirement: 与原报告相同的相关规格/任务；按当前delta复验。
- Evidence: TAKE87退出0；接管不改原申请人、真实上级审核、停用重开/回滚/竞争全部执行，ROUTE204保持通过。
- Expected / Actual: 当前已满足该发现对应的现行合同，原偏差不再复现。
- Acceptance checks: 本报告Checks中的对应完整专项。
- Repair status: verified-resolved
- Repair notes: 无。
- Reverification notes: 本轮独立重新运行并核对实现，未采纳apply自行宣告已修复作为证明。

### V-002: 交接及完成态fixture未办理待审

- Category: implementation
- Severity: medium
- Requirement: 与原报告相同的相关规格/任务；按当前delta复验。
- Evidence: CHAIN24实际Chrome完整链、CAL102真实done fixture、WEB中断前完成/接管重开链通过；新currentRoute reopen回退受TAKE/CHAIN及单元测试验证。
- Expected / Actual: 当前已满足该发现对应的现行合同，原偏差不再复现。
- Acceptance checks: 本报告Checks中的对应完整专项。
- Repair status: verified-resolved
- Repair notes: 无。
- Reverification notes: 本轮独立重新运行并核对实现，未采纳apply自行宣告已修复作为证明。

下一步：`$openspec-e13-archive-change refine-task-creation-notifications-and-review-routing`。本结论仅适用于上述快照；相关输入修改须重新验证。
