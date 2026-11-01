# Implementation Verification

- Change: fix-hourly-schedule-drag-and-log-type
- Schema: spec-driven
- Verdict: FAIL
- Verified at: 2026-11-01T16:18:34+08:00
- Implementation roots: /Users/watuji/MyGitDev/software_test_practice
- Planning root: /Users/watuji/MyGitDev/software_test_practice (same root)
- Verified revision: 8264bf9730264d61808154dca2854ac0e5091d8a; relevant implementation introduced in c1d6073f520ae24f0bdb0cf4c674e603c7051a9d. Worktree clean at entry; this workflow adds only verification.md and generated verification-state.json.

## Summary

发现一项 medium 实现偏差：纵向日视图把整日覆盖及历史全天任务移到全天区后，仅提供详情按钮，没有边缘拖动或框体平移入口。本人及下属入口均如此，即使 canReschedule=true，仍无法在该视图按小时拖动，违反规格明确要求的所有可见有效任务覆盖范围（V-001）。不能归档。

本轮独立重建，111 项单元测试通过；现有专项的 166 项排期浏览器、72 项下属工作区浏览器、21 项服务端排期权限、15 项 HTTP 兼容和 4 项排序检查全部通过。额外真实服务/浏览器检查确认三种视图的零时长两端分别命中、方向键小时调整和真实失去捕获安全取消，并复现上述全天区遗漏。现有专项没有验证全天区的拖动，因此通过这些检查不代表全部需求通过。

未修改实现、测试、规划、任务勾选或 implementation-notes.md。仅使用自动清理的随机本机测试库；未进行线上业务操作、发布或手机真机测试。当前结论适用于以下输入快照，相关改动后须重新验证。

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| proposal.md / design.md / tasks.md / specs/pandora-requirements-aligned-prototype/spec.md | 全量读取 OpenSpec contextFiles；7 个 requirement、9 个命名 scenario 全量覆盖，13/13 勾选仅作为实施声明 |
| 潘多拉-日程视图.js / 潘多拉-日历.css | 月历时段比例、横纵轴、边缘/框体拖动、捕获与取消、键盘、待审框与文字 |
| 潘多拉-api.js / 潘多拉-任务接入.js | 日历展示副本、有效任务数据、最小 reschedule 表单、ETag、强随机请求标识与重试槽 |
| 潘多拉-个人资料.js / 潘多拉-工作区接入.js / 潘多拉-手账主题.css | 下属范围投影及有效 raw upsert、会话序列检查、日志阅读结构/样式、详情与原评论入口 |
| backend/src/main/java/cn/pandora/task/TaskService.java | 最小 pendingSchedule、calendarPreview 范围、可见任务排期权限、提交/生效复核及原审批路线 |
| backend/src/main/java/cn/pandora/workspace / backend/src/test / backend/scripts / backend/pom.xml | 提醒/统计有效版本来源、单元测试、隔离真实服务/浏览器专项和构建资源 |
| AGENTS.md / openspec/config.yaml / established project docs and shared artifacts | 当前仓库上下文；不将兄弟 change 的其他需求或缺陷算作本 change 的新增发现 |
| verification-state.json | 脚本生成的最终 368 文件清单；SHA-256: a59b248481221b9cadf3701623ac5e40558afb516368d0a930a472440af90e3e |

首次独立验证，没有该 change 的既有报告或 state，未复用任何历史独立结果，也未把 apply 的历史通过数字当作证据。旧 state compare 退出 2（文件不存在），仅表示需建立基线。采用全量规格验证，因为本 change 同时涉及前端手势、后端权限、审批展示和公共写入入口。

快照命令（工作目录为上述项目根；before/after 的 roots/exclusions 完全相同）：

```sh
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture --root /Users/watuji/MyGitDev/software_test_practice --exclude 'output/*' --exclude 'backend/target/*' --exclude 'backend/.runtime/*' --exclude 'android/.toolchain/*' --exclude 'android-shell/.build/*' --exclude 'audit/*' --output /tmp/hourly-verify-before.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare openspec/changes/fix-hourly-schedule-drag-and-log-type/verification-state.json /tmp/hourly-verify-before.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture --root /Users/watuji/MyGitDev/software_test_practice --exclude 'output/*' --exclude 'backend/target/*' --exclude 'backend/.runtime/*' --exclude 'android/.toolchain/*' --exclude 'android-shell/.build/*' --exclude 'audit/*' --output /tmp/hourly-verify-after.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare /tmp/hourly-verify-before.json /tmp/hourly-verify-after.json
```

before 为 369 文件，SHA-256 87061de4e1e6e5f32a1e89c14ccb977a2577b5cad9dd153fe440436d55123466。最终 compare 退出 1，唯一差异是构建脚本正常清理其临时 POM `backend/.refinement-verify-zzej7lfs.xml`；没有 added/modified 或其他 deleted。该文件由 build_refinement_verification.py 从正式 POM 自动生成，用来排除历史 Finder 副本，在构建结束后删除，属于已核实的构建临时文件。相关源码、测试、正式 POM 和规划均未变化，无需因该删除重跑行为验证。完成比较后复制脚本生成的 after 为最终 state。

排除项仅为输出、构建产物、运行缓存、Android 工具链和历史审计；Git ignore 同时生效。相关代码、测试、依赖声明、配置及全部控制性规划仍在清单内。脚本自动排除 handoff/report/state，实施交接另行完整阅读。快照只界定输入，不代表清单中每项均通过测试。

执行环境为 macOS、OpenJDK 21.0.7、Node v24.14.0、项目离线 Maven 缓存、`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`。本地 MySQL 13306；临时应用端口 18210/18211/18212/18213/18214。每项首次沙箱内运行均被本机连接权限拒绝（MySQL ERROR 2003, errno 1），获准沙箱外重跑后完成，均退出 0；没有将沙箱失败误报为实现缺陷。没有输出本机凭据。

## Apply Handoff Review

已全量读取 implementation-notes.md。change 名称匹配；开头旧项目路径 `/Users/aoxiang/Desktop/软件测试`、旧 revision ed9a331 和“脏工作区”不适用于当前 checkout。末尾 c1d6073 发布追记与 Git 历史一致，但没有把部署或旧测试声明当作本轮行为证据。本机持久 8080 预览/历史发布环境未复核；本轮使用当前源码构建的隔离服务验证，相关文档与打包资源已核对。

| Reminder / claim | Disposition |
| --- | --- |
| 鼠标/触摸捕获、离开手柄释放、取消、滚动、点击抑制；捕获异常 fallback | 本轮 166 项专项实际鼠标/触摸完成调整、保存及取消，含故意 setPointerCapture 抛错后 document fallback；补充三视图真实 releasePointerCapture 后预览消失且不打开详情/确认，已确认 |
| 月历固定 12px/小时、仅业务编辑者可调时、下属只读 | 已被后续规格/交接明确取代，标为 stale；现实现按日格宽/24，并允许可见非责任方仅调时。不能据早期提醒缩小验收范围 |
| 短/点任务命中区不虚增真实时长，真实裁剪端不冒充端点 | 本轮几何检查、跨日/跨周续接测试及补充三视图点任务起止中心分别命中；零时长 start 左移后 11:20—12:20、end 右移后 12:20—13:20；全天区缺少入口由 V-001 覆盖 |
| 只投影待审排期，不改详情、提醒、统计或提前生效；范围不扩大授权 | 166 项专项比较 raw/TASKS 与 calendarTask、跨月范围与跨范围拒绝；TaskService:167/1678 最小投影，api.js:377 创建副本；ReminderService:37 查询 current_version_id，WorkspaceService 统计读取有效 taskView，未使用 pendingSchedule，已确认 |
| 任意后续审核、重开/交接、终态恢复、标签颜色及冻结 | 166 项专项实际提交 progress/complete/reopen/handover，检查虚线和有效负责人不变；approve/reject/withdraw/expiry 后无 pendingSchedule、回到应有位置；共享颜色变量保留；21 项权限专项验证冻结/完成拒绝，已确认 |
| 非责任方提交与生效时仍可见、仅排期差异、实际操作者上级路由 | 21 项真实 API 检查及 166 项真实表单专项确认；失去可见性后审批 409 且有效排期未改变，夹带资料/标签/负责人/进展 400，普通资料编辑仍 403 |
| 月历实际小时比例、续接段、本人/下属、小屏、无可见调时/起止按钮 | 166/72 项专项按真实层测量 320/390/1440，校验首尾比例、框内 caption 和无按钮，框体真实拖动及取消确认；纵向全天任务入口遗漏见 V-001 |
| 下属 upsert 必须在 staffCurrent 后，必须保存有效 raw 而非待审副本 | 个人资料.js:134—141 先独立保留 effectiveRows，再投影副本，staffCurrent 校验通过后才 upsert；72 项专项迟到响应/快速切页签不覆盖当前内容，已确认 |
| 普通 HTTP 上公共 P.mutation、安全随机源、同槽重试/不同内容新键、原生路径 | 非 localhost 的 pandora-fixture.test 实际 isSecureContext=false、randomUUID=undefined、getRandomValues=function；15 项专项及数据库计数确认响应丢失后只新增 1 笔；禁用 Math.random 仍成功，已确认。admin/debug 的内部 UUID 不属于本轮共用入口承诺 |
| 日志本人/下属字号、详情与评论、非阅读控件保留 | 72 项专项实际字号/行高、宽度、详情全文及评论输入可达；工作区 p-log-reading 和共享阅读样式只作用于正文，评论实现及编辑控件未被选择器覆盖，已确认 |
| 旧标题在框外、可见按钮、本地未发布状态及历史测试次数 | 已被统一任务框和正式发布追记取代；未复用旧结果。所有本轮数量来自当前执行；本轮不核验线上部署，真机按原范围排除 |

## Checks

| Command or inspection | Result | Notes |
| --- | --- | --- |
| openspec status --change fix-hourly-schedule-drag-and-log-type --json / openspec instructions apply --change fix-hourly-schedule-drag-and-log-type --json | PASS | spec-driven，contextFiles 齐全，all_done；未将自动可归档提示当作独立结论 |
| openspec validate fix-hourly-schedule-drag-and-log-type --type change --strict --json --no-interactive | PASS | valid:true，0 issues |
| python3 backend/scripts/build_refinement_verification.py | PASS | 当前 Surefire XML 合计 111 tests、0 failures/errors/skipped；退出 0；仅脚本临时 POM 排除既有 `* 2.java` 副本，正式 POM 不改；日志 /tmp/hourly-verify-build.log |
| python3 backend/scripts/check_schedule_drag.py | PASS | 166/166，浏览器异常 0；output/task-schedule/browser-report.json；日志 /tmp/hourly-verify-schedule.log |
| python3 backend/scripts/check_subordinate_workspace.py | PASS | 72/72，浏览器异常 0；output/subordinate-workspace/browser-report.json；日志 /tmp/hourly-verify-staff.log |
| python3 backend/scripts/check_visible_schedule_permissions.py | PASS | 21/21；output/visible-schedule/permissions.json；日志 /tmp/hourly-verify-permissions.log |
| python3 backend/scripts/check_request_id_compat.py | PASS | 15/15；output/request-id-compat/after.json；persistedRequestCount=2（1 笔初始创建 + 1 笔调时），响应丢失重试没有重复申请；日志 /tmp/hourly-verify-http.log |
| node backend/scripts/check_calendar_sort.js --file 潘多拉-日程视图.js --output /tmp/hourly-verify-sort.json | PASS | 4/4；月/日同一真实起始排序及稳定 ID/置顶回归 |
| node --check 对 API/日程/任务接入/工作区接入/个人资料 JS；git diff --check | PASS | 全部退出 0 |
| JAR 内静态资源与磁盘源码字节比较 | PASS | API、日程、个人资料、任务接入、工作区接入 JS 和日历/主题 CSS 共 7 份全部相等，真实服务运行当前打包资源 |
| 补充一次性 Python Fixture + Node CDP 检查（18214） | 边界 PASS；全天入口 FAIL | 六个点任务端点中心分别命中；六次键盘操作保留另一端和 :20 分钟；三个真实捕获取消均 hadPreview=true、preview=false、overlay=false；本人/下属两个全天样本均 handles=0、moves=0，见 V-001。最终退出 0、浏览器异常 0；输出 /tmp/hourly-verify-extra.json |
| 本轮截图阅读 | PASS（所观察布局） | 实际查看 pending-month-390/1440 和 self-reading-390；待审窄条内文字裁切、无框外标题，日志换行。其他 320/390/1440 尺寸由浏览器几何断言覆盖 |
| before/after input comparison | 已核实差异 | 唯一删除为构建生成的临时 POM；相关实现及规划无变更，最终脚本 state 已保存 |

补充检查首次因检查表达式未引用数字开头的随机 UUID，触发 CSS selector 异常；修正临时检查表达式后全量重跑完成。没有修改产品代码，也没有将检查器错误记为产品缺陷。临时脚本/输出不作为唯一证据，V-001 的输入、决定性 DOM 观察和可复现步骤保存在本报告。

## Requirement Coverage

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| Consistent log reading typography / Read self and subordinate logs | 工作区接入.js:177/200 的正文类，主题.css:537/538 的共享 15px/1.55；72 项专项在 320/390/1440 比较本人列表与下属摘要，lineHeight=23.25px、无横溢，真实详情全文和评论输入可达；编辑/评论选择器未改变 | PASS |
| Hourly schedule endpoint dragging / Adjust endpoints by hours in every calendar presentation（普通定时与零时长任务） | 日程视图.js:675 proposedRange 使用 3600000ms 相对增量；166 项专项鼠标/触摸三视图、确认实际保存、跨日/跨年、另一端不变；补充全部三视图点任务两端键盘及命中 | PASS（该任务子集） |
| 同 requirement / 同 scenario（整日覆盖/历史全天任务） | dayEvents 排除 fullDay/allDay，全天模板未生成拖动入口；补充真实数据本人/下属均 allowed=true 但 handles=0/moves=0 | FAIL — V-001 |
| 同 requirement / Preserve interaction and approval boundaries | 166 项专项 Esc、pointercancel、逆序、capture 异常 fallback、滚动/点击、最小表单原因及取消、旧版本冲突；补充真实 releasePointerCapture 在三视图不误开详情/确认；21 项专项越权、冻结、完成、失权审批拒绝 | PASS；全天可操作性由 V-001 覆盖 |
| Pending review calendar projection / Move a task while waiting for approval | 166 项专项待审新位置唯一、原位置无副本、日历 raw 与有效 TASKS 不同、刷新/重登维持、三视图虚线淡底及审核提示、冻结无端点；有效详情/提醒/统计来源静态追踪 | PASS |
| 同 requirement / Any subsequent review and its resolution | 166 项专项真实修改/进展/完成/重开/交接申请与 approve/reject/withdraw/expiry；跨月范围和下属 month/day/list，审批前有效负责人保持；21 项专项未发布创建不获排期权，upsert 不把未发布任务放入 TASKS；标签变量与最小五字段投影检查 | PASS |
| Reschedule every visible active task / Viewer proposes schedule without editing other fields | TaskService.change/submit/validateApplicationEffect/validateRequestActor/scheduleOnly；21 项真实 API 覆盖非责任方可调时、仅可见上级、实际操作者上级路线、创始人免审、恶意字段、越权、过期版本、冻结、完成、未发布、失权后拒绝生效；166 项 UI 最小表单保存及 pending | PASS（提交/生效规则）；纵向全天 UI 入口见 V-001 |
| Partial day bars in the month calendar / Direct month schedule editing | monthWeek:173 实际 left/width；166 项本人九小时及待审七小时比例、跨年/续接整条移动、触摸纵向滚动与取消；72 项下属 38/72 宽及 20/72 偏移、全天和零时长几何、真实月条拖动/返回；框内裁切及完整提示静态/几何检查 | PASS |
| Write requests work on ordinary HTTP origins / Submit and retry from a non-localhost HTTP page | api.js:284/294 强随机 v4 + 原重试 signature/ETag；15 项真实不安全 HTTP 专项、已提交后响应丢失重试、数据库仅一笔调时、表单保留、256 次新操作不重复、同槽修改内容换键、原生路径兼容 | PASS |
| Pending frame and caption use the proposed time together / Review a rescheduled task at its proposed position | 166 项新排期 10:20—17:20 的 left/width、caption 在真实框内并含新时刻、无旧框/外部标题/起止按钮，320/390/1440；下属原有效 raw 在 staffCurrent 后 upsert，投影不污染详情；审核终态和框体 ghost 平移检查 | PASS（投影/文字）；该 requirement 的授权任务拖动覆盖遗漏见 V-001 |
| Proposal/design/completed tasks 的其余承诺 | 不扩大资料权、不改审核路线/数据库、复用原因确认和 ETag、最小待审字段与授权范围、无弱随机源、透明边缘及键盘、构建/隔离浏览器及使用说明均检查；持久预览/发布声明限于 handoff 所记旧环境，未当作当前线上证据；手机真机不在范围 | 已核对；V-001 待修复 |

## Findings

### V-001: 纵向日视图的全天区任务没有小时拖动入口

- Category: implementation
- Severity: medium
- Requirement: specs/pandora-requirements-aligned-prototype/spec.md:13/17，Hourly schedule endpoint dragging 要求三种呈现为所有可见未完成非待审有效任务提供可触达的小时边缘调时；:62 还要求授权有效任务保留框体平移、透明边缘改时。任务 2.2、7.1。
- Evidence: 日程视图.js:588—590 从纵轴事件排除 allDay 和 coverage.fullDay；:654—658 全天区仅生成 `.p-all-day-event` 详情 button，没有调用 resizeHandle 或添加 data-schedule-move。个人资料.js:94 将相同任务分入 all，:102 的 `.staff-allday` 同样仅生成详情 button。补充隔离真实服务创建公司时区 Asia/Shanghai 的已发布 todo 任务 A（allDay=false，2030-12-31 00:00 至 2031-01-01 00:00，API startAt=2030-12-30T16:00:00Z、dueAt=2030-12-31T16:00:00Z），及历史全天任务 B（allDay=true，startDate=dueDate=2030-12-31），由创始人创建，负责人含本人和 alpha-one-employee。真实 Chrome 本人视图两项均 `allowed:true, fullDay:true, visible:true, handles:0, moves:0`；任务 A 的 allDay=false，排除仅遗留全天数据兼容问题。授权下属日视图两项也均 `visible:true, handles:0, moves:0`。实际 DOM 分别只有 `<button class="p-all-day-event" data-task="…">Supplement full</button>` 和 `.staff-allday` 内的 `<button data-task="…">Supplement full</button>`，未获得小时端点或平移事件绑定。浏览器异常为 0。
- Expected: 这些有排期权限且可见的任务在纵向日呈现中也能按小时调整真实起止及平移，并进入原因/审批确认；不能因投影到全天区而失去本 change 承诺的交互。真正被裁剪的续接端继续不冒充真实端点。
- Actual: 全天区只有详情点击；无透明端点、无框体移动及其方向键处理。可转去月历/横轴或打开详情精确编辑，但这些替代路径不能满足纵向视图覆盖所有有效任务的明确要求。
- Repair guidance: 补齐本人及下属纵向日呈现中的整日覆盖/历史全天任务交互，保留合理的全天分区、真实时间语义、裁剪端规则、权限、取消、滚动及原因审核边界。不要通过减少规格覆盖范围或恢复可见起止按钮解决。
- Acceptance checks: 在一次性 Fixture 中按上述输入创建两种任务；本人选择 2030-12-31 的“纵向时间轴”，上级进入该下属同日时间轴。分别实际拖动起点/终点一小时及整体平移，验证另一端/分钟或总时长、确认前有效版本不变、取消与实际保存；聚焦透明边缘用方向键验证同粒度；覆盖 320/390/1440、冻结/完成不出现调时入口及跨日续接不出现假端点。重跑 `python3 backend/scripts/check_schedule_drag.py`、`python3 backend/scripts/check_subordinate_workspace.py` 和 `python3 backend/scripts/check_visible_schedule_permissions.py`，并确保新增证据确实覆盖全天区，而非只断言任务数量和详情可达。
- Repair status: pending
- Repair notes: 无；本轮仅验证，没有修复代码或修改测试。
- Reverification notes: 首次独立确认。现有 166/72 项脚本虽创建并统计全天任务，但未在纵向全天区执行端点或平移，不能用它们通过来解除本 finding。临时 DOM 查询可复现：在上述视图取任务 id，比较 `Pandora.canRescheduleTask(actor(),taskById(id))` 与 `[data-resize-task="<id>"]`、`[data-schedule-move="<id>"]` 的数量；两类任务前者为 true、后两者为 0。下属在 `.staff-allday [data-task="<id>"]` 可见时同样为 0。

下一步：`$openspec-e13-fix-change fix-hourly-schedule-drag-and-log-type`；修复后重新独立验证，达到 PASS 后再归档。
