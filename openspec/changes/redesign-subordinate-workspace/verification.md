# Implementation Verification

- Change: redesign-subordinate-workspace
- Schema: spec-driven
- Verdict: FAIL
- Verified at: 2026-11-01T12:26:18+08:00
- Implementation roots: /Users/watuji/MyGitDev/software_test_practice
- Planning root: /Users/watuji/MyGitDev/software_test_practice (same root)
- Verified revision: ed9a331ffd9e0ffd35620fb70582ede885a0e9d5; implementation introduced in f29f9fd. Worktree clean before verification; only this report and generated verification-state.json added by this workflow.

## Summary

独立验证发现两项明确的实现偏差：月历、日轴及全天任务没有完成状态呈现（V-001）；下属目录在人员有职位时省略部门/团队信息（V-002）。均为 medium，待修复，不能归档。

本轮重新构建，111 项单元测试通过；隔离数据库及真实 Chrome 专项的 56 项浏览器检查通过。另行检查了 104 条任务的完整分页、待发布/仅创建任务排除、跨公司/跨部门/同级授权拒绝，以及延迟响应后的快速切人和换账号。既有专项通过并未覆盖上述两个缺陷，不能据此判定整体 PASS。

未执行线上检查、发布或手机真机测试。真机已明确排除在本 change 范围之外；浏览器尺寸模拟不能代表 Android 原生或软键盘行为。只创建并清理随机本地测试库，未改正常演示库或生产数据。

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| proposal.md / design.md / tasks.md / specs/pandora-requirements-aligned-prototype/spec.md | 从 openspec instructions apply 返回的 contextFiles 全量读取；5/5 勾选任务仅视为待验证声明 |
| 潘多拉-个人资料.js / 潘多拉-手账主题.css | 主要实现；检查树、独立弹层、月/日投影、分页、授权刷新、序列与会话清理 |
| 潘多拉-api.js / 潘多拉-日程视图.js / 潘多拉-交互原型.js / 潘多拉-任务接入.js / 潘多拉-工作区接入.js | 检查公司日期、纯日历算法、弹层返回、详情鉴权和本人状态隔离 |
| backend/src/main/java/cn/pandora/{task,workspace,auth} / backend/src/test / backend/scripts / backend/pom.xml | 检查真实任务、人员和日志范围、排序、分页；重新构建与执行检查 |
| AGENTS.md / openspec/config.yaml / sibling change artifacts | 按当前仓库上下文和共同代码基础处理；没有将同一提交中的全部改动归属于本 change |
| verification-state.json | 脚本生成的 358 文件清单；SHA-256: cd3595f24f9a787958ac589cfa89fbf4f2b7f9952b3e96bcb85cf32c34b88bf6 |

首次独立验证，无既有 verification.md 或 verification-state.json；因此采用全量规格覆盖，没有复用 apply 所声称的历史测试结果。首次 compare 返回 2（旧 state 不存在），仅说明需要建立基线，不构成阻塞。

快照命令（在上述项目根目录运行；before/after 使用相同 roots/exclusions）：

```sh
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture --root /Users/watuji/MyGitDev/software_test_practice --exclude 'output/*' --exclude 'backend/target/*' --exclude 'backend/.runtime/*' --exclude 'android/.toolchain/*' --exclude 'android-shell/.build/*' --exclude 'audit/*' --output /private/tmp/subordinate-before.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare openspec/changes/redesign-subordinate-workspace/verification-state.json /private/tmp/subordinate-before.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture --root /Users/watuji/MyGitDev/software_test_practice --exclude 'output/*' --exclude 'backend/target/*' --exclude 'backend/.runtime/*' --exclude 'android/.toolchain/*' --exclude 'android-shell/.build/*' --exclude 'audit/*' --output /private/tmp/subordinate-after.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare /private/tmp/subordinate-before.json /private/tmp/subordinate-after.json
```

最终 compare 返回 0，`changed:false`；前后 SHA-256 相同。完成比较后将脚本生成的 after 文件复制为 verification-state.json。排除项是构建产物、运行库/缓存、Android 工具链和历史证据；Git ignore 生效。源码、测试、POM、配置、当前及共同规划文件仍在清单中。脚本自动排除 implementation-notes.md、verification.md、verification-state.json；实施记录已单独阅读。快照只界定输入，不代表其中所有文件均通过测试。

执行环境：macOS，OpenJDK 21.0.7、Node v24.14.0、项目离线 Maven 缓存；Chrome 为 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome。集成检查在用户单独授权后使用项目本地 MySQL 配置，端口 13306；临时应用端口 18211/18212。未将配置内容或非测试凭据写入报告。

## Apply Handoff Review

已读取本 change 的 implementation-notes.md。change 名称匹配；其中旧项目路径 `/Users/aoxiang/Desktop/软件测试`、旧 revision `ec675ae...` 和“同一脏工作区”不是当前验证基线，不能作为现状证据。当前目录、提交和清洁状态见报告头。后续 f29f9fd/ed9a331 发布追记与当前历史一致，但发布声明没有被当作独立测试证据。

| Reminder / claim | Disposition |
| --- | --- |
| reports.managerId 为父子来源，目录权限不替代业务权限 | 已确认：个人资料.js:43 的构树与 WorkspaceService.reports/person、Access.isManagerOf；真实 API 对同级、跨部门、跨公司拒绝 person/log（404），tasks 返回空集。目录信息呈现缺陷另见 V-002 |
| person → task/log 详情返回，日志 more、午夜、点任务、快速切人/换账号 | 本轮 56 项专项检查及补充会话检查确认；任务/日志详情回到原人、页签、日期，月模式保留；延迟旧人/旧账号响应不会替换当前界面 |
| 只展示所选人当前负责且正常已发布任务 | 已确认：TaskService.list/filteredTasks/loadTaskBatch 按当前版本及真实 assigneeId 授权；补充检查显示 104 项应显示任务全部可达，待发布和仅创建但不负责的任务均不出现 |
| 日志详情返回重读第一页，不保留加载页数或滚动 | 已确认：staffView.rebuild 清空 rows 并重新 refreshStaff(false)；本轮返回页签保持，日志再次分页仍可达；未添加保留滚动/已加载页数要求 |
| 旧平铺 profile 断言不适用，历史全 UI 未重跑 | 确认为过时断言；本轮使用层级树专项并补充范围/时序检查；未声称全部历史 UI 已回归 |
| 共同未归档代码基础、无独立 checkout、无本 change 数据迁移/后端授权新增 | 当前提交合并多个 change，无法把旧脏工作区重建成独立提交；以当前整体快照验证本 change 范围。没有运行迁移发布/修改授权实现；临时测试库正常启动时执行当前全部迁移 |
| 先前七天清单、原 39 项结果 | 被后续月/日规格及追加记录取代，不作为当前验收依据；本轮实际重跑当前 56 项 |
| 月网格、跨月/午夜半开边界、+N、默认月模式、日期选择、轴/清单 | 已确认当前专项和纯算法/查询范围；补充 104 项分页。完成状态提醒由 V-001 覆盖，不能以布局检查通过替代 |
| 未独立验证/未归档，早期“云端未更新”与真机取消 | 本报告首次独立判定 FAIL，仍未归档；云端旧描述被发布追记取代，本轮没有核验线上。真机仍不在范围内 |

没有把 apply 的 111/39/56 项历史数字、本地 8080 预览或线上发布结果复用为本轮证据；本轮构建产物在隔离服务中运行，并核对 JAR 内个人资料 JS、主题 CSS、日程 JS、API JS 与磁盘源码逐字节一致。

## Checks

| Command or inspection | Result | Notes |
| --- | --- | --- |
| openspec status --change redesign-subordinate-workspace --json / openspec instructions apply --change redesign-subordinate-workspace --json | PASS | schema spec-driven，规划完整，apply all_done；没有把“可归档”提示当作独立结论 |
| openspec validate redesign-subordinate-workspace --type change --strict --json --no-interactive | PASS | valid:true，0 issues |
| python3 backend/scripts/build_refinement_verification.py | PASS | 退出 0；Surefire XML 合计 tests=111、failures=0、errors=0、skipped=0；临时 POM 仅排除既有 Finder `* 2.java` 副本，不修改正式 POM。日志 /private/tmp/subordinate-build.log |
| node --check 潘多拉-个人资料.js / node --check backend/scripts/check_subordinate_workspace_browser.js / git diff --check | PASS | 退出 0 |
| python3 backend/scripts/check_subordinate_workspace.py | PASS | 沙箱内首次连接 MySQL 被拒（ERROR 2003，errno 1）；按用户授权沙箱外重跑退出 0。output/subordinate-workspace/browser-report.json：56/56，无浏览器异常；脚本另含真实 API 授权断言 |
| Chrome 专项截图阅读 | PASS（布局） | 本轮生成 tree/month/day-axis/schedule/logs 的 320/390/1440 截图；人工阅读 tree-320 与 day-axis-320，测量无横溢。组织文字遗漏见 V-002 |
| JAR 内静态资源与源码字节比较 | PASS | 4 个上述关键资源全部一致，测试运行当前构建产物 |
| 补充真实 API 和浏览器检查：104 项有效任务、另有待发布及仅创建任务 | PASS（分页/范围）；完成状态 FAIL | 实际观察月/日请求 offset=0、100，日轴/清单均 104 项；待发布/仅创建任务未混入；无排期手柄，本人 page/viewMode/viewAnchor 不变。同级、跨部门、跨公司 person/log 返回 404，tasks 空集。完成状态的具体 DOM 证据见 V-001 |
| 延迟旧人员响应、登出后登录部门负责人再释放旧账号响应 | PASS | 新人员 panel 保持；换账号后 overlayHidden=true，隐藏弹层 DOM 在释放响应前后未变，直属节点 2 个且无旧展开；无浏览器异常 |
| before/after snapshot compare | PASS | changed:false，358 个文件输入不变 |

补充检查在 `/private/tmp/subordinate-extra.py`、`/private/tmp/subordinate-session.py` 中临时执行，复用仓库 Fixture 和 browser_fixture，没有修改或新增仓库测试。其决定性结果已记录在本报告，不要求临时文件永久存在。前一检查曾因 CDP 等待故意挂起的 Promise 超时，随后改为立即返回；另一个过严断言误把已隐藏且未变化的旧弹层 DOM 当作串号，改为比较响应释放前后 DOM、可见状态和树展开。相关会话检查单独重跑退出 0，未把检查器问题报为实现缺陷，也未把未完成的前一进程声称为整体通过。

## Requirement Coverage

所有本 change 的规范性正文及 5 个命名 scenario 已映射；静态证据与本轮执行证据共同使用，没有复用旧独立证据。

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| Hierarchical subordinate workspace：真实全部合法后代、独立展开/人员选择；Scenario: Expand descendants and select independently | 个人资料.js:43 reportsSection 仅按 managerId；seen 递归去重；WorkspaceService:101；真实 API 创始人/部门/团队/员工范围；专项树分支、三层展开与点击分离 | PASS（层级/操作） |
| 同一 requirement：姓名、职级/职位及组织可辨 | 个人资料.js:50 节点模板；真实 API 返回 departmentName/teamName，DOM 仅姓名、身份及职位；tree-320 截图 | FAIL — V-002 |
| 同一 requirement：展开状态不跨账号，不按角色猜父子关系或扩大权限 | managerId 构树；个人资料.js:248 sessionReset 清 expandedReports；补充换账号部门负责人仅显示 2 个直接节点；真实 peer/cross-company API 拒绝 | PASS |
| 同一 requirement：独立小屏工作页、选人身份和日程/日志切换 | staffView/openPerson，独立 staff 对象及 fullscreen；专项独立 panel、身份、320/390/1440 几何检查 | PASS |
| 同一 requirement；Scenario: Read a person's schedule on a small screen | 专项月/轴/清单各宽度测量；午夜任务不在次日 10 项清单；cross/point 可达。额外普通标题点任务 start=end=720，真实区间 2px、点击区 22px、aria 起止相等，清单显示“时点” | PASS（本 scenario）；完成状态另见 V-001 |
| 同一 requirement：日志业务日期/时间倒序、分页、全文/评论；Scenario: Read logs and return from details | WorkspaceService.logsRead:139 ORDER BY business_date DESC,created_at DESC；12 条日志按 10+2 加载；专项原日志详情/评论及返回；工作区接入.js:205 实时鉴权详情、正文 pre-wrap/overflow-wrap | PASS |
| 同一 requirement：任务/日志返回保留选人、日期、页签，本人范围不变 | staffView.rebuild、独立 staff 状态；专项任务/月/日志详情返回及本人日志；补充比较本人 page/viewMode/viewAnchor 完全相同 | PASS |
| 同一 requirement：无数据、加载、失败、重试与失权状态；Scenario: Revalidate access and session | 专项加载、故意读取失败→清空→重试、reports 关系撤销→清空→恢复；员工无下属；补充空日志明确显示“暂无可查看的日志”。无任务日期为无事件的月网格/日轴，清单有明确空态；person 手机号/代办标记在失败时删除 | PASS |
| 同一 requirement / 同一 scenario：组织/账号变化重验、快速换人/换账号、旧响应丢弃、跨公司/同级拒绝 | refreshStaff 每次重读 reports/person；staffCurrent 校验对象、epoch、sequence、当前 panel；真实跨公司/同级/跨部门 person/log 404、tasks 空集；延迟切页签专项及补充切人/换账号 | PASS；关系撤销 UI 使用受控响应模拟，服务端拒绝另由真实 API 验证 |
| 同一 requirement：无额外正文编辑或排期权 | 人员页不生成 resize/editor；补充日轴 dragHandles=0；任务/日志详情复用原服务鉴权及 raw.editable/原操作条件 | PASS |
| Subordinate calendar month and day views：默认月、周一至周日、连续跨日条、+N；Scenario: Navigate months days and overflow | staffMonthBounds、monthWeek；专项跨周/月条、overflow 完整当天、默认月及跨年导航；补充月网格 42 天、表头“一二三四五六日” | PASS |
| 同一 requirement：00:00—24:00 日轴、重叠分栏、独立全天区、清单 | 专项 day-axis 高 1440、8 个定时/点任务重叠分栏、2 个整日覆盖项、清单 10 项；dayCoverage/layoutDayEvents 实际纯投影 | PASS |
| 同一 requirement：按模式翻月/天、跳日期、今天、无周模式；详情返回模式/日期/人 | 专项 2030-12→2031-01、日期跳转、按天前进、今天触发刷新、月任务及日清单详情返回；模式模板只有 month/day；staff 未写入本人 state | PASS |
| 同一 requirement：公司日期、当前负责且有权的正常已发布任务，完整分页后投影 | companyDayStart/companyParts + assigneeId/from/to；TaskService 当前版本/权限过滤；真实 104 项及 offset=100；待发布和仅创建项不显示，跨周/月/午夜半开范围静态及专项核对 | PASS |
| 同一 requirement：跨月/周、午夜、零时长、完成状态正确且任务可达 | 边界/分页/可达性证据如上；完成任务在清单显示“已完成”，但月条/日轴/全天模板未使用状态 | FAIL — V-001（完成状态） |
| Proposal / Design / tasks 的其他约束：复用主题与纯算法、日志每页10、异常目录安全去重、不写本人页面、无新数据库迁移/授权能力、隔离构建及本地预览、不做真机 | 个人资料和主题、P.calendar 调用、API 复用与当前迁移文件归属检查；本轮构建/隔离服务/资源一致性。未改持久本地预览服务或执行线上发布；旧 apply 交付声明仅作为历史记录 | 设计实现约束已核对；布局与接口测试通过，V-001/V-002 待修复 |

## Findings

### V-001: 月历、日轴和全天任务缺少完成状态区分

- Category: implementation
- Severity: medium
- Requirement: specs/pandora-requirements-aligned-prototype/spec.md:32，Subordinate calendar month and day views：“完成状态正确”；proposal.md 要求完成状态可辨。
- Evidence: 潘多拉-个人资料.js:79 月条、:94 日轴及 :95 全天模板不读取 executionState/task.status；对应主题规则位于 潘多拉-手账主题.css:529/:530/:531，没有完成态规则。补充真实服务检查创建同一所选人员、相同标题“状态检查”、09:00—10:00 的两个有效任务，在随机 fixture 库将其中一个当前任务/当前版本设为 done，再从真实接口加载。todo 与 done 月条均为 `class="staff-month-event"`，正文均为 `状态检查09:00`，title 均为同一标题及日期区间，背景均为 `color(srgb 1 0.922353 0.945647)`；日轴均为 `class="staff-axis-event"`，正文、aria-label 和状态相关样式相同，仅排布位置不同。相同 done 任务在清单中明确出现“已完成”，排除后端未返回完成状态的可能。
- Expected: 所选人员月历、日轴和全天区域均能表达已完成任务，与未完成任务可辨，同时保留详情入口和任务可达性。
- Actual: 只有切换到任务清单或进入详情才能确认完成；默认月历及日轴/全天区域省略状态。
- Repair guidance: 在全部人员日历投影中呈现完成状态及可访问语义，沿用现有设计系统；保留只读人员页、颜色及边界语义。
- Acceptance checks: 用同名同时间 todo/done 任务分别检查月历、日轴、全天区域及清单；确认存在真实完成态文本/样式及可访问区分，不依赖任务标题伪装状态；在320/390/1440检查可读性，再运行 `python3 backend/scripts/check_subordinate_workspace.py`。
- Repair status: pending
- Repair notes: 无；本轮未修复代码或测试。
- Reverification notes: 首次独立确认；现有56项脚本没有创建/检查完成态任务，不能覆盖本缺陷。

### V-002: 下属树有职位时不显示部门或团队

- Category: implementation
- Severity: medium
- Requirement: specs/pandora-requirements-aligned-prototype/spec.md:6，Hierarchical subordinate workspace：“姓名、职级/职位和组织可辨”。
- Evidence: 潘多拉-个人资料.js:50 使用 `identityLabel(person)+' · '+(person.positionName||person.teamName||person.departmentName||'')`，三个字段互斥回退。补充真实接口人员含 `departmentName='alpha'`、`teamName='alpha one'`、`positionName='Display title'`，节点输出仅为 `<strong>alpha-one-employee</strong><small>员工 · Display title</small>`，没有部门/团队字段；本轮 tree-320.png 也展示相同遗漏。所有有职位的上级节点同样不显示组织，无法从祖先组织标签补足。fixture 姓名中的 alpha 只是测试命名，不是实际组织字段证据。
- Expected: 下属目录能同时辨认姓名、身份/职位及真实所属组织，不需要先打开人员工作页才能获知部门/团队。
- Actual: 有 positionName 时部门和团队均被省略；缺少职位时也至多显示团队或部门其中一项。人员工作页虽正确显示组织，不能补足目录要求。
- Repair guidance: 在树节点中保留身份/职位，并显示适用的真实部门/团队；沿用窄屏分行和溢出约束，不改变 managerId 父子关系或授权范围。
- Acceptance checks: 使用姓名和职位都不含组织名、且跨部门/团队有同名职位的人员，检查各级树节点能看到适用组织信息；在320/390/1440确认无横溢、展开按钮与选人仍独立，再运行下属工作页专项。
- Repair status: pending
- Repair notes: 无；本轮未修复代码或测试。
- Reverification notes: 首次独立确认；现有树专项验证父子关系和几何宽度，没有验证组织字段同时可辨。

下一步：`$openspec-e13-fix-change redesign-subordinate-workspace`。修复后重新独立验证，达到 PASS 后再归档；本报告仅适用于上面记录的输入快照。
