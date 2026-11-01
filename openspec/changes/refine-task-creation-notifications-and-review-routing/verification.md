# Implementation Verification

- Change: refine-task-creation-notifications-and-review-routing
- Schema: spec-driven
- Verdict: FAIL
- Verified at: 2026-11-01T04:57:31.747217+00:00
- Implementation roots: /Users/watuji/MyGitDev/software_test_practice
- Planning root: /Users/watuji/MyGitDev/software_test_practice（同一根）
- Verified revision: 0c5eaa11875458e0b9613b93aac98e6bed582b74；首次取证时工作区干净。所选实现主要来自 f29f9fd，当前还包含后续两个独立 change 的共同代码。

## Summary

两项已确认的测试实现偏差尚未处理：正式业务接管套件仍要求接管人直接免审（V-001）；交接/完成态 fixture 没有办理新规则下的待审，完整交接停用链因此无法执行（V-002）。这是旧回归契约未随本次规则迁移，不能通过放宽生产审核或冻结校验来使旧测试通过。

本轮重新构建，111项单元测试零失败/错误/跳过；9组专项共605项断言通过。另有 TAKE 在第12项断言失败（前11项通过），CHAIN 在浏览器启动前以 TASK_FROZEN 中断。聚焦审核、升级、多标签、通知、排期和本人日志行为均有新证据；仍有明确列出的场景执行缺口，所以不能归档。未发现证据足以确认上述两次中断是服务端越权或冻结逻辑错误。

未执行生产访问、部署、手机安装或安卓真机测试。后者已被用户在现有规划中明确取消。浏览器尺寸和触摸模拟仅证明当前网页行为。执行工具的沙箱授权不等于生产检查授权。

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| proposal.md、design.md、tasks.md、specs/pandora-requirements-aligned-prototype/spec.md | 来自 status/apply 的 contextFiles，全量读取；15条requirement、111条scenario。25个勾选任务仅为实施声明 |
| backend/src/main/java/cn/pandora/{task,workspace,auth,admin,seed}、数据库迁移、src/test、scripts、pom.xml | 当前磁盘内容；路由、事务、版本/历史、标签集合、通知权限/分页与现有测试追踪 |
| 根目录潘多拉-*.js/css/html、backend静态入口与配置、项目文档、AGENTS.md、openspec/config.yaml及相邻规划 | 当前内容；后续日志页调整与下属工作区不自动归属于本change。本次没有复用这些change的旧PASS/FAIL作为所选change的结论 |
| verification-state.json | 脚本生成316文件清单；SHA-256：`11dde99d4597e9903a9eeb77f0fbf73351514284628012662a6b4006025310eb` |

首次独立验证，原verification.md/state均不存在；compare退出2，原因仅是缺少基线，不作为环境阻塞。采用完整规格矩阵及新执行证据，没有复用apply记录的测试结果。状态快照只界定输入，不证明全部输入通过。

快照命令（before/after根与排除项完全相同）：

```sh
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture --root /Users/watuji/MyGitDev/software_test_practice --exclude 'audit/*' --exclude 'android/*' --exclude 'android-shell/*' --exclude 'backend/target/*' --exclude 'backend/.runtime/*' --exclude 'node_modules/*' --exclude 'tmp/*' --output /private/tmp/task-refinement-verification-before.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare openspec/changes/refine-task-creation-notifications-and-review-routing/verification-state.json /private/tmp/task-refinement-verification-before.json
# 用相同capture命令，将output改成/private/tmp/task-refinement-verification-after.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare /private/tmp/task-refinement-verification-before.json /private/tmp/task-refinement-verification-after.json
```

最终before/after比较退出0，`changed:false`，SHA-256一致；比较后复制脚本生成的after为verification-state.json。排除历史审计、原生Android及未改套壳包装（本次网页范围以共用在线资源为准）、依赖、构建/运行缓存及临时输出；Git ignore同时生效。相关后端/网页源码、迁移、测试、依赖声明、配置和所有规划均覆盖。工作流报告/state/实施笔记由脚本自动排除；实施笔记另行读取。已跟踪审计文件在运行前保存，测试产生的新证据转存`output/e13-task-refinement/`，恢复审计原内容；没有更改实施代码、测试或规划。

当前环境：macOS，OpenJDK21.0.7、Node24.14.0、Maven离线`.runtime/m2`，Chrome `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`，项目本机MySQL13306。集成套件只创建并清理其随机命名数据库，独立端口18177/18180/18185/18187/18193—18196/18207/18208/18210；未改正常演示库。没有输出本机非测试凭据。

## Apply Handoff Review

已读取implementation-notes.md；change名匹配，项目路径`/Users/aoxiang/Desktop/软件测试`和“原checkout未提交”属于旧机器/旧状态，不能作为当前基线。旧Chrome路径与重复`* 2.java`绕行方案也不适用于当前正式POM构建；本次直接构建成功。发布追记f29f9fd与历史相符，但没有据此检查或重部署线上。旧输出中的通过数不是本轮独立结果。

| Reminder / claim | Disposition |
| --- | --- |
| 刷新使用原申请人，接管不获得审核权，终态不复活 | ROUTE与UPGRADE确认；旧审核人失权，非创建旧待审刷新、原申请人停用阻断、已办结记录不变。TAKE仍沿用旧免审断言，见V-001 |
| 完整标签集合、缺字段保留、旧显式单标签不得截断 | FORM/UPGRADE/NOTICE确认；真实API多标签、清空、提议拒绝保留有效版、旧字段409、旧单值/删除快照迁移和重复启动；代码历史保存beforeTags/afterTags |
| 通知筛选与安全投影一致、评论撤权不泄漏、查询预算 | WorkspaceBatchReadTest含8000行分页预算、组合筛选和review分类；NOTICE真实撤权/撤回/删除/历史只读；FORM筛选返回与账号隔离，均确认 |
| 排期拖动走原确认/版本/审核、旧全天真实时刻、窄屏 | DRAG69项和FORM浏览器确认；实际16个打包静态资源与源码逐字节一致，人工查看320排期及390通知截图 |
| 完整交接/停用与演示回归已更新 | 演示在隔离进程去除密码覆盖后55项确认；正式接管与完整交接链仍存在旧规则，V-001/V-002；不能采纳“全部已适配”的声明 |
| 本人任务表单、创始人标签权限、近三天缺失日志 | LOG47项及脚本直接API权限断言确认，包含当前后续日志页调整；旧广泛日志用例未运行，不复用它的结果 |
| 真机/云端/原生界面边界与后续独立变更 | 取消真机按现有设计执行；早期“未发布”已被发布追记替代；本轮不验证生产，也不归档或修改其他change |

## Checks

以下均在本轮新执行；没有重用旧独立执行证据。代号供覆盖矩阵引用。

| Command or inspection | Result | Notes |
| --- | --- | --- |
| `openspec status --change refine-task-creation-notifications-and-review-routing --json`；`openspec instructions apply --change refine-task-creation-notifications-and-review-routing --json` | PASS | spec-driven，contextFiles齐全、all_done；不把CLI归档建议当作验收 |
| `openspec validate refine-task-creation-notifications-and-review-routing --type change --strict --json --no-interactive` | PASS | valid=true，0 issues |
| `cd backend && mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package` | PASS | 正式POM；111 tests，failures/errors/skipped均0；BUILD SUCCESS |
| FORM：`python3 backend/scripts/check_task_creation_refinement.py` | PASS | 35 API +36浏览器，退出0；output/task-creation-refinement/api-report.json、browser-report.json及截图 |
| UPGRADE：`python3 backend/scripts/check_task_refinement_upgrade.py` | PASS | 13/13，退出0；V27→V28、旧版本、空/删除标签、反复启动、旧创建/进展路由、终态和原申请人；upgrade-report.json |
| ROUTE：`python3 backend/scripts/check_review_routing.py` | PASS | 204/204，退出0；review-routing.json |
| NOTICE：`python3 backend/scripts/check_fixed_notifications.py` | PASS | 44/44，退出0；fixed-notifications.json。旧检查名字“business owner review”仅断言pending，本报告不把名字当作审核人证据 |
| DRAG：`python3 backend/scripts/check_schedule_drag.py` | PASS | 69/69，退出0；output/task-schedule/browser-report.json |
| CAL：`python3 backend/scripts/check_calendar_drawer.py` | PASS checks / coverage caveat | 102/102，退出0；新报告位于output/e13-task-refinement/audit/refactor-pandora-organization-and-workflows/calendar-drawer.json；完成态fixture不足见V-002 |
| LOG：`python3 backend/scripts/check_log_backfill_entry.py` | PASS | 47/47浏览器及脚本标签权限断言，退出0；新报告转存上述e13目录log-backfill-entry.json；截图output/entry-refinement |
| DEMO：`env -u PANDORA_DEMO_PASSWORD python3 backend/scripts/check_final_demo.py` | PASS | 55/55，退出0。首次未去除本机覆盖时在admin登录失败；seed继承覆盖、测试固定Demo@123456，已定位并仅对此隔离进程移除覆盖后完整重跑。环境已解决，不是待修业务缺陷；final-demo.json |
| TAKE：`python3 backend/scripts/check_business_takeover.py` | FAIL | 第12项旧免审断言失败，HTTP200但未直接生效；退出1，V-001；新JSON/log转存e13目录 |
| CHAIN：`python3 backend/scripts/check_handover_chain.py` | FAIL | fixture发起交接返回409 TASK_FROZEN，退出1；尚未启动浏览器，V-002 |
| 打包资源逐字节比对；所有根目录潘多拉-*.js的`node --check`；`git diff --check` | PASS | 16份实际JAR静态资源与源码一致；JS和diff退出0 |
| 截图阅读、代码及用例断言审查 | 见矩阵 | 320排期控件无横溢；390精简通知只有对象/分类/已读/时间。静态追踪权限、集合历史、固定组织父子、查询管线及拖动取消 |
| before/after snapshot compare | PASS | 退出0，无相关输入变化 |

最初FORM/UPGRADE在沙箱内连接本机MySQL报`ERROR2003 ... (1)`；获工具执行授权后原命令成功重跑，不作为未解决环境问题。

## Requirement Coverage

规格路径简写S=`specs/pandora-requirements-aligned-prototype/spec.md`。下表逐条列出全部111个scenario（含原规格中的同义旧标题），按15条requirement共享当前证据；标题按实际THEN语义判断，不因旧标题含creator/week/single-select改变验收内容。PARTIAL表示明确执行边界，没有把缺失证据换成通过。

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| **Calendar task views**（S:5）<br>S:22 `Filter the calendar without revoking other access`<br>S:26 `Reach sidebar creation applications and task table`<br>S:30 `Scroll across month and year boundaries`<br>S:34 `Preserve adjustable cells and complete overflow access`<br>S:38 `Show timed cross-day midnight and point tasks`<br>S:42 `Show more than five overlapping and all-day tasks`<br>S:46 `Pin and color without moving time`<br>S:50 `Use the required calendar entry points`<br>S:54 `Read a month and open a complete day list`<br>S:58 `Pin only one's own ordering`<br>S:62 `Split a timed cross day task`<br>S:66 `Display every overlapping and all day task`<br>S:70 `Switch a whole week while preserving weekday`<br>S:74 `Count mutually exclusive relationships`<br>S:78 `Open the default month view`<br>S:82 `Select a year and month`<br>S:86 `Drill from month to week`<br>S:90 `Ignore blank month task space`<br>S:94 `Drill from week to day`<br>S:98 `Ignore blank week task space`<br>S:102 `Switch time granularity`<br>S:106 `Keep task clicks distinct from drill-down`<br>S:110 `Navigate and return from a week`<br>S:114 `Navigate and return from a day`<br>S:118 `Render a spanning task bar`<br>S:122 `Render an all-day task`<br>S:126 `Distinguish visible tasks`<br>S:130 `Identify the current user's task relationship`<br>S:134 `Show only task names in bars`<br>S:138 `Order visible task lanes`<br>S:142 `Fill five monthly task rows`<br>S:146 `Handle crowded time slots`<br>S:150 `Open overflow tasks for one date`<br>S:154 `Preserve calendar navigation after table return`<br>S:158 `Overlay a narrow accessible schedule drawer`<br>S:162 `Open a sheet from every part of a monthly date`<br>S:166 `Return through nested detail and dismiss without losing context`<br>S:170 `Classify full-day coverage without changing schedules` | 潘多拉-日程视图.js（本人投影、月流、日轴、抽屉、清单、颜色）；CAL 102/102、DRAG 69/69、FORM 浏览器颜色断言。逐项检查午夜/点任务、重叠分栏、导航/返回、焦点和重试。 | PARTIAL：完成态 fixture 未批准，不能将 CAL 的 completed 断言当成已完成可见性证据（V-002）；其余列举行为有当前浏览器及代码证据。 |
| **Role-scoped task creation and assignment**（S:174）<br>S:179 `Assign across departments and upward`<br>S:183 `Remove the creator and preserve selection order`<br>S:187 `Keep dispatch separate from unrelated access`<br>S:191 `Isolate an unpublished creation`<br>S:195 `Select and order authorized assignees`<br>S:199 `Enforce dispatch independently from viewing`<br>S:203 `Executive selects assignees across departments`<br>S:207 `Manager assigns a departmental task`<br>S:211 `Cancel assignee selection`<br>S:215 `Search for an unavailable assignee`<br>S:219 `Employee submits a self-created task`<br>S:223 `Superior reviews a self-created task`<br>S:227 `Select company members during a later owner change`<br>S:231 `Expand and select a real hierarchy` | TaskService.assigneeCandidates/create/preview；Access.creationCandidates；潘多拉-任务接入.js、交互原型.js 的选人工作副本。ROUTE 四层预览、跨部门候选/权限隔离/未发布隔离；FORM API 候选字段白名单与浏览器树展开/搜索/顺序/取消。 | PASS；失效/跨公司/管理员由候选与提交双重校验；原始创建和负责人授权独立。 |
| **Task editing and completion review**（S:235）<br>S:240 `Freeze and cancel an application`<br>S:244 `Restrict comparison data to the reviewer`<br>S:248 `Distinguish completion outcomes`<br>S:252 `Reopen with a new schedule`<br>S:256 `Assignee updates progress`<br>S:260 `Show status without numeric progress`<br>S:264 `Creator approves completion`<br>S:268 `Superior rejects completion`<br>S:272 `Render authorized field-by-field differences in saved order`<br>S:276 `Reopen an overdue completed task from the web form`<br>S:280 `Resubmit an expired creation as a new request`<br>S:284 `Validate a direct application as strictly as a reviewed change` | TaskService.change/decide/validateApplicationEffect（650、1180附近）；ROUTE 操作权、冻结、diff裁剪、批准、重开、版本/幂等；FORM 拒绝多标签提议保留旧版；DRAG 原编辑/重开表单及待审旧排期。 | PARTIAL：原申请失效创建重提、完成退回/撤销组合及重提并发本轮未独立执行；已静态追踪新申请/旧终态与申请人检查，不将其视作完整可执行覆盖。退出的 TAKE/CHAIN 未补足这些路径。 |
| **Required notifications**（S:288）<br>S:295 `Deliver the submission and result matrix`<br>S:299 `Summarize multiple changes and preserve removed recipients`<br>S:303 `Use actual events without synthetic urgency`<br>S:307 `Inspect task change notification coverage`<br>S:311 `Notify on task creation`<br>S:315 `Surface due and emergency notices`<br>S:319 `Notify people affected by assignment changes`<br>S:323 `Surface review and consultation requests`<br>S:327 `Represent urgent work without a synthetic title`<br>S:331 `Understand the event without opening its detail`<br>S:335 `Notify the current business owner after takeover` | TaskService.submit/applyVersion/recipients/events 与 WorkspaceService.safeNotification；ROUTE 真事件投递、改派、接管、比例提醒和去重；NOTICE 44/44 评论撤权/撤回/历史只读；FORM 精简/完整及已读返回。 | PASS；静态核对多字段合并摘要和新旧负责人集合；站内通知证据不代表延期的系统推送。 |
| **Ordered reviewer routing and reassignment**（S:339）<br>S:346 `Preview all creator-based routes`<br>S:350 `Block an unavailable configured manager`<br>S:354 `Revalidate after an organization change`<br>S:358 `Preserve ordered non-creation routes`<br>S:362 `Require explicit non-creation self-review`<br>S:366 `Persist order and route the first highest peer`<br>S:370 `Review one's own application explicitly`<br>S:374 `Change assignees using the proposed route`<br>S:378 `Fall back or apply with a documented reason`<br>S:382 `Reassign after organization changes`<br>S:386 `Refresh preexisting pending requests`<br>S:390 `Block an inactive applicant` | TaskService.route/currentRoute/creationRoute（1748、1768、1776），refreshRoutes（1117），decide（650）；ROUTE 204/204、UPGRADE 13/13、TaskServiceTest/CompanyTreeTest。 | PASS 已执行的当前路由/刷新路径；TAKE 仍断言旧规则是测试实现偏差 V-001。缺失/损坏组织由完整树校验阻断，不以无上级免审。 |
| **Dedicated task handover**（S:394）<br>S:399 `A direct manager hands over a subordinate task`<br>S:403 `Handover approval preserves provenance`<br>S:407 `Distinguish direct manager handover from indirect management` | TaskService.handover/validateRequestActor；ROUTE 验证直接/间接上级、关系圈、夹带字段、代办人上级、权限生效；FORM 实际跨部门任务上级代办与标签保留。 | PARTIAL：聚焦接口通过；完整离职交接浏览器链在 fixture 阶段中断（V-002），不得声称整链通过。 |
| **Shared single-select tags for tasks and logs**（S:411）<br>S:418 `Enforce root-only maintenance and single selection`<br>S:422 `Rename recolor and delete a referenced tag`<br>S:426 `Respect review freezing and calendar color`<br>S:430 `Preserve legacy and historical tags` | V28__task_version_multiple_tags.sql；TaskService.validateForm/insertVersion/versionTags/snapshotView/diff/recordChanges；Tags.java；FORM 35 API +36 浏览器、UPGRADE、NOTICE、LOG 标签权限。 | PASS：有序多项、清空、旧字段冲突/缺省保留、跨公司/私人/删除新引用拒绝、旧单值/空值升级及历史快照、改名改色与颜色优先均有当前证据；日志仍只接收 tagId。 |
| **Persistent demonstration data for web and administration**（S:434）<br>S:441 `Run a continuous demo after refresh`<br>S:445 `Prepare a complete repeatable new-model demonstration` | seed/DemoSeed.java 使用真实 TaskService 创建及当前审核人决定；DEMO 55/55，显式隔离库重复准备/重启、144任务、全部账号、权限、分页、固定日历样例、十项公司事项和用户修改持久化。 | PASS（隔离进程移除本机 PANDORA_DEMO_PASSWORD 覆盖后）；没有重置正常账号或检查生产。 |
| **Atomic employee deactivation and formal business takeover**（S:449）<br>S:456 `Reopen taken-over completed work with active assignees`<br>S:460 `Deactivate an employee only after all responsibilities are arranged`<br>S:464 `Take over published work without impersonating its creator`<br>S:468 `Refresh valid reviews and revoke old authority atomically` | 组织计划/业务接管事务和 TaskService.refreshPendingRoutes；ROUTE 接管不改申请人、改派旧权撤销、过期不复活和并发；DEMO 接管人修改仍经其上级批准。 | PARTIAL：TAKE/CHAIN 因旧审核契约中断，停用全方案原子性、停用后更换无效负责人重开和完整浏览器链本轮未完成（V-001/V-002）。不能用聚焦路由检查替代。 |
| **Notification list presentation and combined filters**（S:474）<br>S:477 `Filter across page boundaries`<br>S:481 `Require actionable review classification`<br>S:485 `Return after opening an unread notification` | WorkspaceService.notificationsRead（368）、notificationMetadataCategory（797）、notificationCategory（806）；WorkspaceBatchReadTest 先组合筛选后分页、全局未读及8000行查询预算；FORM API和浏览器筛选/返回/账号隔离；NOTICE安全投影。 | PASS；结果事件与旧已办结提交事件明确区分，后者不伪造为结果。 |
| **Multi-select task tag controls**（S:489）<br>S:492 `Toggle and persist several tags` | 潘多拉-标签评论.js taskTagsHTML、潘多拉-任务接入.js 草稿tagIds；FORM 浏览器真实键盘、选中/取消、子页返回、保存刷新及删除项清除；人工查看截图。 | PASS：按钮下名称、换行、aria-pressed、非纯颜色选中提示；失败校验保留表单/集合。 |
| **Responsive task schedule inputs**（S:496）<br>S:499 `Use a narrow mobile viewport` | 潘多拉-任务接入.js fillFullDay/openScheduleChange、创建/编辑/重提/重开显式时分；FORM及DRAG 320/390/1440几何测量，全天快捷重复稳定、旧全天存储时刻、逆序拦截；TaskServiceTest 组织时区。 | PASS（桌面 Chrome +尺寸模拟）；未宣称安卓真机/软键盘验证。 |
| **Drag calendar schedule endpoints**（S:504）<br>S:509 `Move dates across a month boundary`<br>S:513 `Adjust precise times and cancel a drag`<br>S:517 `Preserve permissions and concurrent updates` | 潘多拉-日程视图.js proposedRange/completeScheduleDrag/bindScheduleResize（672）、任务接入.js openScheduleChange（365）；DRAG 69/69 鼠标/触摸模拟/键盘、跨年/午夜/点任务、取消、陈旧版本、无编辑权/冻结及审核前有效版。 | PASS；lostpointercapture/无位移的取消分支另经静态检查，保存复用原 change/ETag/幂等与后端权限校验。 |
| **Personal task table and founder-only tag maintenance**（S:522）<br>S:526 `Inspect a manager's task table`<br>S:530 `Reject tag maintenance without removing task colors` | 任务表单.js matchesTaskFilters/computeTaskForm（88）；Tags.java create/change/editable/requireFounder；标签评论.js 入口限制；LOG 创建/负责过滤、搜索/刷新不能恢复下属、共用/私人越权、创始人管理及颜色。 | PASS；其他全局授权未被表单过滤改变。 |
| **Single creation entry for recent missing logs**（S:534）<br>S:537 `Create missing days and edit through detail` | 工作区接入.js openLogForm（272）、existingLogFor、显式ID编辑；WorkspaceService.createLog（281）；LOG 三天逐个创建、全部已写提示、显式编辑、并发冲突保草稿，NOTICE冻结。 | PASS；当前47项LOG包含已归档后续变更行为，其额外通过不用于宣告其他change通过。 |

提案/设计/已勾选任务的附加检查：V28是新增迁移而未修改V17/V27，版本关联含组织与顺序唯一约束；根POM只打包实际加载资源；后端route以记录applicantId而不是当前浏览者为依据，reviewerBasis=operator；上级代办与普通编辑候选权限分开；创始人免审复用当前权限/版本/排期校验；个人标签维护统一requireFounder且canEdit一致；日程颜色为私人/首共用/默认。以上由代码追踪及相应新执行证据支撑。云端发布和回退演练不是本轮新增授权范围。tasks1.4、5.1的全部业务链回归完成声明被V-001/V-002否定。

剩余执行缺口：失效创建重提及其并发、完成拒绝/撤销组合、真实已完成任务的日历可见性、完整停用方案/无效原负责人重开及交接停用浏览器链。部分有静态实现与聚焦证据，但不能据此声明全部场景已独立通过。修复回归后需补齐这些覆盖。没有将缺口另行包装为未经证实的产品缺陷。

## Findings

### V-001: 正式接管套件仍要求接管人取得旧审核权并免审

- Category: implementation
- Severity: medium
- Requirement: Ordered reviewer routing and reassignment / Require explicit non-creation self-review、Reassign after organization changes；Atomic employee deactivation and formal business takeover / Take over published work without impersonating its creator；tasks1.4、5.1。
- Evidence: `backend/scripts/check_business_takeover.py:83` 运行失败：`valid takeover directly applies qualified applicant becoming reviewer`，接管返回HTTP200而该断言false；本轮JSON前11项通过、第12项失败，进程退出1。83之后85—87行继续要求status=direct及task.progress.direct，101行要求新业务接管人批准，108行要求非创始人本人完成直接生效，143行要求接管人重开direct，均是当前文件中的旧规则。ROUTE204项实际证明相同接管类型仍由原申请人上级处理，未发布提议保持旧有效版。
- Expected: 测试应要求接管只改变业务责任，待审保持原申请人及其直属上级；非创始人后续修改/完成/重开经各自上级批准。失效、版本、幂等、会话、全方案原子性和历史断言应继续得到可执行覆盖。
- Actual: 回归脚本把正确的非免审接管当作失败，首个旧断言中断后所有停用/重开/并发检查未执行。这是测试偏差，当前证据不支持为了通过它而改服务端恢复接管人审核权。
- Repair guidance: 将此套件的fixture、审核参与人和期望终态迁移到明确的新规则，显式办理前置待审，再继续保留和运行原有原子性/权限/历史/竞争检查；不要只删失败断言或跳过用例。
- Acceptance checks: `python3 backend/scripts/check_business_takeover.py`完整退出0；覆盖接管不改applicant、不免审、真实上级批准、停用后更换有效负责人重开、失败回滚和并发；`python3 backend/scripts/check_review_routing.py`保持通过。
- Repair status: pending
- Repair notes: 无。
- Reverification notes: 首次独立验证确认。没有修改脚本或服务端。

### V-002: 交接及完成态fixture未办理新增待审，完整业务链未适配

- Category: implementation
- Severity: medium
- Requirement: Task editing and completion review / Freeze and cancel an application、Assignee updates progress；Dedicated task handover / A direct manager hands over a subordinate task；Calendar task views包含已完成任务；tasks1.4、5.1。
- Evidence: `python3 backend/scripts/check_handover_chain.py`退出1，`check_handover_chain.py:69`实测`('handover',409,{'code':'TASK_FROZEN',...})`。46—60行提交普通员工完成与进展后只检查HTTP200，未审批其pending；64行继续交接被正常冻结。70—73行仍让被交接员工审批直属上级代办，而新规则应交由代办人的直属上级。配套`check_fixed_handover_chain_browser.js:86`期望接管人修改立即生效、94—96行让接管人审核进展，也仍属旧路线，尚未实际执行。另`check_calendar_drawer.py:77`的completed fixture在83—86行提交普通员工完成后未批准，因此CAL通过不能证明该记录已完成；同类setup也见check_fixed_web.py的完成fixture。
- Expected: 业务链fixture应辨别pending/direct并由实际申请人的直属上级办结前置完成/进展；确认完成态后再验证已完成展示或停用/重开。上级代办交接由该上级自己的直属上级决定；浏览器接管后操作沿用同一新审核规则。
- Actual: 完整交接停用浏览器链在fixture阶段中断；当前CAL检查用了尚未完成的记录证明“completed”展示，覆盖声明超出实际证据。服务端拒绝冻结中的交接符合规格，未发现该拒绝本身是缺陷。
- Repair guidance: 更新Python和对应浏览器业务链的所有旧审核参与人/免审期待，先正确办结前置pending，并断言executionState确为done；保留冻结、待审有效版、接管来源、停用权限与替换负责人重开检查。
- Acceptance checks: `python3 backend/scripts/check_handover_chain.py`启动并完成真实浏览器链，退出0；`python3 backend/scripts/check_calendar_drawer.py`在fixture证明确已done后仍通过；检查/更新同类完成fixture并运行受影响用例；FORM、DRAG、ROUTE保持通过。
- Repair status: pending
- Repair notes: 无。
- Reverification notes: 首次独立验证确认；浏览器文件里的后续旧断言来自静态审查，不声称它们已经被实际运行。

下一步：`$openspec-e13-fix-change refine-task-creation-notifications-and-review-routing`。修复实现/测试后重新独立验证；当前FAIL不可归档。报告仅适用于上述快照，相关修改须重新取证。
