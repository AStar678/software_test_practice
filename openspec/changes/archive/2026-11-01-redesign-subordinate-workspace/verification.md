# Implementation Verification

- Change: redesign-subordinate-workspace
- Schema: spec-driven
- Verdict: PASS
- Verified at: 2026-11-01T12:04:20.872033+00:00
- Implementation roots: /Users/watuji/MyGitDev/software_test_practice
- Planning root: /Users/watuji/MyGitDev/software_test_practice（同根）
- Verified revision: 4c0ccf52813b4f7bdd388012fdde42a0cf483427；工作区包含本次主规格同步与四项验证交接，尚未归档/提交

## Summary

主规格同步后增量复验 PASS。唯一库存差异为主规格；本 change 的 delta、实现、测试、依赖、配置及运行条件未变，既有逐场景独立证据仍适用。三项共27条需求/158个场景的正文及场景与主规格一致，无遗漏；不重跑未受影响的运行检查。以下保留的功能结果来自 2026-11-01T11:56:53.784941+00:00 的独立验证，不表示本次重复运行。

PASS。当前2条requirement、8个scenario有当前代码和执行证据，原完成状态及树组织信息两项发现均verified-resolved。本人/下属入口与详情权限分离、日级月历、待审投影、日志分页和会话边界通过；旧全站套件的人员日志断言迁移另由separate V-002跟踪，不将其当作人员页业务失败或冒称全站回归通过。

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
| V-001完成状态在月/日/全天/清单全部出现 | STAFF真实提交完成并由上级批准，再检查is-done/已完成；82项通过，verified-resolved |
| V-002职位与真实部门/团队/公司层并列 | STAFF真实节点文本、四层staffOrgLine输出及tree-320截图确认，verified-resolved |
| 下属无拖动、详情有/无基础编辑权分别检查 | STAFF两账号真实详情按钮与API、DRAG/PERM确认；代码不生成下属手柄、绑定限定本人page-view |
| 待审月历日级/日轴真实时段，驳回撤回措辞 | DRAG真实新位置及终态恢复确认；交接“驳回/撤回保持提议位置”字样为stale/不准确，不能作终态标准。实际终态按有效版本恢复 |
| 日志返回重读第一页、本人页范围不改 | refreshStaff/rebuild与STAFF日志10+2/详情返回/self-only确认；规格不要求保留已加载页数或滚动 |
| 失权/旧响应/会话 | STAFF受控延迟/撤权UI与ACCESS真实API拒绝相互支撑；不把模拟关系撤销冒充真实组织写入 |
| 资源/共享变更/旧记录/真机 | RES、DRAG确认当前资源；旧小时比例/下属可拖动/旧机器旧revision不复用；真机不在范围 |

## Checks

本次增量实际执行：`openspec validate --specs --strict --json --no-interactive`（1/1，只有长文本INFO）；本 change 的 `openspec validate redesign-subordinate-workspace --type change --strict --json --no-interactive`（valid=true、issues=[]）；27条需求/158个场景同步核对（PASS）；旧state与before仅主规格变化；before/after完全相同；`git diff --check`退出0。以下功能运行结果保留自上轮独立验证，本次未重复执行。

| Command or inspection | Result | Notes |
| --- | --- | --- |
| openspec status --change redesign-subordinate-workspace --json / openspec instructions apply --change redesign-subordinate-workspace --json | PASS | contextFiles完整、all_done；非独立完成证据 |
| openspec validate redesign-subordinate-workspace --type change --strict --json --no-interactive | PASS | valid=true，issues=[]，退出0 |
| BUILD: `python3 backend/scripts/build_refinement_verification.py` | PASS | 111 tests；0 failures/errors/skipped；退出0。离线 Maven test/package；临时 POM 仅排除历史 Finder 副本，正式 POM 不变。 |
| STAFF: `python3 backend/scripts/check_subordinate_workspace.py` | PASS | 82；退出0；树/组织、四种完成态、日级几何、详情原权限、日志分页、失权/旧响应与会话；output/subordinate-workspace/browser-report.json。 |
| DRAG: `python3 backend/scripts/check_schedule_drag.py` | PASS（完整重跑） | 211；退出0；output/task-schedule/browser-report.json。首次运行在原地点击断言失败（14 pass），未改源码/测试，原脚本完整重跑211通过；暂时波动未作为确定缺陷。 |
| ACCESS: `python3 backend/scripts/check_fixed_workspace_access.py` | PASS | 62；退出0；四层范围、作者写权、同级/跨部门拒绝、组织变化即时失权。 |
| RES: `python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /tmp/four-verify-resources.json` | PASS | 14/14；源文件、缓存版本与实际JAR静态资源逐字节一致。 |
| WEB: `python3 backend/scripts/check_fixed_web.py（check_work_logs.py 的受委托子套件）` | FAIL / 旧断言 | 135 条 PASS 后 actual descendant contact and log entry founder 失败；旧 p-open-person-logs 与本人页人员筛选断言不符合当前专用工作页/self-only合同。见 separate-log-forms-and-clean-product-copy V-002；未将中断后的行为计为已验证。 |
| node --check（8个根目录实际JS） / git diff --check | PASS | 全部退出0；不以语法通过替代功能验收 |
| 本轮截图阅读 | PASS（所观察布局） | tree-320、allday-handles-320、edit-aligned-390已实际查看；其余三宽度用浏览器几何断言覆盖 |
| before/after snapshot compare | PASS | changed=false，输入无变化 |

## Requirement Coverage

每行同时覆盖该requirement的规范正文和逐项列出的全部scenario；旧标题与新THEN冲突时以THEN及规范正文为准。

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| **Hierarchical subordinate workspace**（spec:5）<br>S:12 `Expand descendants and select independently`<br>S:16 `Read a person's schedule on a small screen`<br>S:20 `Read logs and return from details`<br>S:24 `Revalidate access and session`<br>S:28 `Keep the subordinate canvas non-draggable and details normally authorized`<br>S:32 `Show organization alongside position` | 个人资料.js reportsSection/staffOrgLine/openPerson/refreshStaff/staffCurrent/sessionReset；STAFF 82、ACCESS 62、DRAG跨月待审投影；任务与日志详情按原鉴权、10+2日志分页、独立状态/返回、无下属拖动，组织/账号重验。 | PASS |
| **Subordinate calendar month and day views**（spec:37）<br>S:42 `Navigate months days and overflow`<br>S:46 `Distinguish completed and pending tasks in every presentation` | 个人资料.js staffMonthHTML/staffDayHTML/staffQueryRange；共用P.calendar纯显示算法；STAFF默认月/跨年/+N/午夜/点/完成态/重叠/全量读取，DRAG提议位置唯一/通过及恢复，后台TaskService仍查当前负责人及正常访问。 | PASS |

已检查proposal范围、design实现约束及全部勾选任务；未新增验收要求。共同代码按当前整体快照取证，不把同一提交的所有改动自动归于此change。无本次新增数据库/权限扩张承诺被遗漏；云端发布、回退演练与手机真机按规划不在本轮范围。

## Findings

### V-001: 月历、日轴和全天任务缺少完成状态

- Category: implementation
- Severity: medium
- Requirement: 与原报告相同的相关规格/任务；按当前delta复验。
- Evidence: STAFF实际done样本，月条/日轴/全天按钮/清单is-done及已完成均通过。
- Expected / Actual: 当前已满足该发现对应的现行合同，原偏差不再复现。
- Acceptance checks: 本报告Checks中的对应完整专项。
- Repair status: verified-resolved
- Repair notes: 无；本轮未修复代码或测试。
- Reverification notes: 本轮独立重新运行并核对实现，未采纳apply自行宣告已修复作为证明。

### V-002: 下属树有职位时不显示部门或团队

- Category: implementation
- Severity: medium
- Requirement: 与原报告相同的相关规格/任务；按当前delta复验。
- Evidence: STAFF节点同时显示Display title、alpha、alpha one；四层及公司层断言通过，tree-320截图已阅读。
- Expected / Actual: 当前已满足该发现对应的现行合同，原偏差不再复现。
- Acceptance checks: 本报告Checks中的对应完整专项。
- Repair status: verified-resolved
- Repair notes: 无；本轮未修复代码或测试。
- Reverification notes: 本轮独立重新运行并核对实现，未采纳apply自行宣告已修复作为证明。

下一步：`$openspec-e13-archive-change redesign-subordinate-workspace`。本结论仅适用于上述快照；相关输入修改须重新验证。
