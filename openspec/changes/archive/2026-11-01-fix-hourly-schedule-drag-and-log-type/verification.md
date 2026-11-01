# Implementation Verification

- Change: fix-hourly-schedule-drag-and-log-type
- Schema: spec-driven
- Verdict: PASS
- Verified at: 2026-11-01T12:04:20.872033+00:00
- Implementation roots: /Users/watuji/MyGitDev/software_test_practice
- Planning root: /Users/watuji/MyGitDev/software_test_practice（同根）
- Verified revision: 4c0ccf52813b4f7bdd388012fdde42a0cf483427；工作区包含本次主规格同步与四项验证交接，尚未归档/提交

## Summary

主规格同步后增量复验 PASS。唯一库存差异为主规格；本 change 的 delta、实现、测试、依赖、配置及运行条件未变，既有逐场景独立证据仍适用。三项共27条需求/158个场景的正文及场景与主规格一致，无遗漏；不重跑未受影响的运行检查。以下保留的功能结果来自 2026-11-01T11:56:53.784941+00:00 的独立验证，不表示本次重复运行。

PASS。当前7条requirement、13个scenario覆盖，旧全天区无操作入口V-001已独立复验解决。月历按日、日轴按小时、两种全天任务、本人/下属/表单入口、仅排期API、待审投影及普通HTTP重试通过。首次点击检查有一次未复现波动；原始未修改套件完整重跑211通过，保留该非阻塞风险。

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
| 月历必须日级，不能继续用9/24或38/72比例验收 | DRAG与STAFF几何测量left=0/width=100、三小时与整日同格，确认 |
| V-001两种全天任务小时操作 | DRAG211真实定时fullDay/历史allDay的端点与整条/键盘/保存、320/390可达，确认修复；下属按新规格无拖动，旧报告该部分要求已取代 |
| 历史allDay确认后转显式时间 | 任务接入openScheduleChange及DRAG历史读取/快捷/提交保持实际起止。显示分类本身不改allDay；用户确认修改仍用已确认的显式时刻合同 |
| 只绑定page-view，表单/下属无控件 | DRAG、STAFF和代码生成/绑定路径确认；PERM21确认服务端可见任务仍可仅排期 |
| 月历触摸先判断横向/纵向、日轴小时 | DRAG真实触摸滚动/拖动、取消、跨日/月/年、分钟/工期/另一端及版本确认 |
| 待审位置/框内文字/虚线、终态恢复、有效详情不变 | DRAG任意后续审核及approve/reject/withdraw/expiry、跨月/刷新/重登与有效raw对照确认；提醒/统计仍读有效版本 |
| HTTP安全随机与日志字号 | HTTP实际普通HTTP/幂等数据库核对；STAFF15px/1.55三宽度确认 |
| 资源/8080/发布/真机和旧结果 | RES14确认当前打包；不以交接预览或历史发布/数字作独立证据；无真机测试 |

## Checks

本次增量实际执行：`openspec validate --specs --strict --json --no-interactive`（1/1，只有长文本INFO）；本 change 的 `openspec validate fix-hourly-schedule-drag-and-log-type --type change --strict --json --no-interactive`（valid=true、issues=[]）；27条需求/158个场景同步核对（PASS）；旧state与before仅主规格变化；before/after完全相同；`git diff --check`退出0。以下功能运行结果保留自上轮独立验证，本次未重复执行。

| Command or inspection | Result | Notes |
| --- | --- | --- |
| openspec status --change fix-hourly-schedule-drag-and-log-type --json / openspec instructions apply --change fix-hourly-schedule-drag-and-log-type --json | PASS | contextFiles完整、all_done；非独立完成证据 |
| openspec validate fix-hourly-schedule-drag-and-log-type --type change --strict --json --no-interactive | PASS | valid=true，issues=[]，退出0 |
| BUILD: `python3 backend/scripts/build_refinement_verification.py` | PASS | 111 tests；0 failures/errors/skipped；退出0。离线 Maven test/package；临时 POM 仅排除历史 Finder 副本，正式 POM 不变。 |
| DRAG: `python3 backend/scripts/check_schedule_drag.py` | PASS（完整重跑） | 211；退出0；output/task-schedule/browser-report.json。首次运行在原地点击断言失败（14 pass），未改源码/测试，原脚本完整重跑211通过；暂时波动未作为确定缺陷。 |
| STAFF: `python3 backend/scripts/check_subordinate_workspace.py` | PASS | 82；退出0；树/组织、四种完成态、日级几何、详情原权限、日志分页、失权/旧响应与会话；output/subordinate-workspace/browser-report.json。 |
| PERM: `python3 backend/scripts/check_visible_schedule_permissions.py` | PASS | 21；退出0；非责任方仅排期、恶意字段拒绝、提交与批准时失权、完成/冻结/版本。 |
| HTTP: `python3 backend/scripts/check_request_id_compat.py` | PASS | 15 项浏览器断言及数据库只产生一笔调时的核对；退出0；普通HTTP安全随机回退、丢响应重试/不同内容新键及原生路径。 |
| CAL: `python3 backend/scripts/check_calendar_drawer.py` | PASS | 102；退出0；fixture 先真实批准完成并断言 done，再验抽屉/清单/完成任务/边界/返回。 |
| SORT: `node backend/scripts/check_calendar_sort.js --file 潘多拉-日程视图.js --output /tmp/four-verify-sort.json` | PASS | 4/4；真实开始/稳定ID/个人置顶。 |
| RES: `python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /tmp/four-verify-resources.json` | PASS | 14/14；源文件、缓存版本与实际JAR静态资源逐字节一致。 |
| node --check（8个根目录实际JS） / git diff --check | PASS | 全部退出0；不以语法通过替代功能验收 |
| 本轮截图阅读 | PASS（所观察布局） | tree-320、allday-handles-320、edit-aligned-390已实际查看；其余三宽度用浏览器几何断言覆盖 |
| before/after snapshot compare | PASS | changed=false，输入无变化 |

首次DRAG失败后，临时诊断仅取消该单一断言的fail-fast以取得后续证据，没有修改仓库测试或将诊断当官方套件PASS；诊断211/211通过，随后原始脚本独立完整重跑211/211，最终采用后者。

## Requirement Coverage

每行同时覆盖该requirement的规范正文和逐项列出的全部scenario；旧标题与新THEN冲突时以THEN及规范正文为准。

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| **Consistent log reading typography**（spec:5）<br>S:8 `Read self and subordinate logs` | 工作区接入.js p-log-reading 与手账主题.css共享15px/1.55；STAFF本人列表、详情及人员日志320/390/1440实测；评论与编辑控件独立。 | PASS |
| **Calendar dragging by presentation**（spec:12）<br>S:21 `Move an entire month bar by dates`<br>S:25 `Resize a month endpoint by days`<br>S:29 `Adjust day events and the all-day section by hours`<br>S:33 `Separate canvas interactions from task-detail permissions`<br>S:37 `Preserve cancellation and stale-version boundaries` | 日程视图.js monthWeek/shiftCompanyDays/proposedRange/allDayHTML/bindScheduleResize；DRAG 211真实鼠标/触摸/键盘、两种全天任务与点任务端点/保存/取消；STAFF与任务表单无控件且详情原权限；PERM不收窄接口。 | PASS |
| **Pending review calendar projection**（spec:41）<br>S:46 `Move a task while waiting for approval`<br>S:50 `Any subsequent review and its resolution`<br>S:54 `Keep unpublished tasks out and apply founder changes directly` | TaskService.taskView.pendingSchedule/calendarPreview + api.js calendarTask独立副本 + 个人资料.js staffCurrent后upsert有效raw；DRAG任意后续审核/通过/拒绝/撤回/失效/刷新重登、唯一提议位置、有效详情不变；ReminderService/WorkspaceService仍读current_version_id。 | PASS |
| **Reschedule every visible active task**（spec:58）<br>S:63 `Propose a schedule from an authorized detail without editing other fields` | TaskService.change reschedule/SCHEDULE_FIELDS/validateApplicationEffect；PERM 21、DRAG非责任方真实确认保存、STAFF从下属详情有/无资料权两个账号；历史只读/失权/冻结/完成/旧版本拒绝。 | PASS |
| **Day-scale bars in the month calendar**（spec:67）<br>S:72 `Draw short tasks and midnight endings by dates` | 共用monthWeek按占用公司日输出left=0/width=100；DRAG三小时与整日同宽、午夜无次日副本、跨年/跨周/点工期不改；STAFF与CAL标题/+N/详情/全清单。 | PASS |
| **Write requests work on ordinary HTTP origins**（spec:76）<br>S:79 `Submit and retry from a non-localhost HTTP page` | api.js newRequestId/getRandomValues及mutation签名重试槽；HTTP实际普通HTTP的randomUUID不可用场景、丢响应重试与数据库只一笔调时、内容变化新键/原生兼容。 | PASS |
| **Pending frame and caption use the proposed time together**（spec:83）<br>S:86 `Review a rescheduled task at its proposed position` | 日程视图.js/个人资料.js框内caption/真实时段与日级月条；DRAG320/390/1440几何/待审新位置及文字/无旧框、终态恢复；下属不生成手柄/独立调时按钮。 | PASS |

已检查proposal范围、design实现约束及全部勾选任务；未新增验收要求。共同代码按当前整体快照取证，不把同一提交的所有改动自动归于此change。无本次新增数据库/权限扩张承诺被遗漏；云端发布、回退演练与手机真机按规划不在本轮范围。

## Findings

### V-001: 纵向日视图全天区缺少小时拖动入口

- Category: implementation
- Severity: medium
- Requirement: 与原报告相同的相关规格/任务；按当前delta复验。
- Evidence: DRAG211对历史allDay与定时fullDay执行真实端点/整条/键盘/保存，仍只在全天区显示；下属按现行合同无拖动，旧下属可拖动要求stale。
- Expected / Actual: 当前已满足该发现对应的现行合同，原偏差不再复现。
- Acceptance checks: 本报告Checks中的对应完整专项。
- Repair status: verified-resolved
- Repair notes: 无；本轮仅验证，没有修复代码或修改测试。
- Reverification notes: 本轮独立重新运行并核对实现，未采纳apply自行宣告已修复作为证明。

下一步：`$openspec-e13-archive-change fix-hourly-schedule-drag-and-log-type`。本结论仅适用于上述快照；相关输入修改须重新验证。
