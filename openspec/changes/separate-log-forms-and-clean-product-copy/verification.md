# Implementation Verification

- Change: separate-log-forms-and-clean-product-copy
- Schema: spec-driven
- Verdict: FAIL
- Verified at: 2026-11-01T11:56:53.784941+00:00
- Implementation roots: /Users/watuji/MyGitDev/software_test_practice
- Planning root: /Users/watuji/MyGitDev/software_test_practice（同根）
- Verified revision: 4c0ccf52813b4f7bdd388012fdde42a0cf483427；入口工作区干净，最终仅验证报告/state变更

## Summary

FAIL。发现两项medium implementation问题：V-001到达24小时冻结点的失败保存会清空未保存草稿；V-002明确要求的日志综合回归仍使用已移除的人员日志入口/筛选合同并中断。创建/编辑分离、日期对齐及指定文案清理的已验证部分通过，但不能归档。

## Verification Basis

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
| 编辑日期只读div而非disabled select | LOG50及截图确认；日期/标签对齐，模式与显式ID正确 |
| 创建冲突保留create模式及草稿 | LOG真实并发抢占确认；不会转编辑或覆盖其他日志 |
| 标签能力保留、日志单选任务多选 | LOG/FORM/COMM及Tags后端权限确认，删除段落未删控件能力 |
| 分析method中文、范围/时间/真实本地规则 | LOG可见DOM、工作区renderAI静态来源确认；无原始method码，不声称外部模型 |
| 用户正文/评论/审核意见相同关键词不被过滤 | LOG正文及EDGE真实审核意见回读，评论/历史模板esc原文输出、无运行时关键词删除 |
| check_work_logs旧员工断言失败不应判本change失败 | 已独立核实WEB失败，作者对结论的建议不具验收权；本change tasks4.1明确要求该套件与保留业务回归，因此V-002记录待迁移测试合同，不能仅以LOG通过替代全部回归 |
| 到期/失败保留草稿 | FREEZE真实时间推进确认相反结果，V-001；未将缺失保留测试包装为通过 |
| 缓存资源/预览/真机/发布 | RES14确认打包与源码一致；现有8080/云端/真机不作为本轮证据 |

## Checks

| Command or inspection | Result | Notes |
| --- | --- | --- |
| openspec status --change separate-log-forms-and-clean-product-copy --json / openspec instructions apply --change separate-log-forms-and-clean-product-copy --json | PASS | contextFiles完整、all_done；非独立完成证据 |
| openspec validate separate-log-forms-and-clean-product-copy --type change --strict --json --no-interactive | PASS | valid=true，issues=[]，退出0 |
| BUILD: `python3 backend/scripts/build_refinement_verification.py` | PASS | 111 tests；0 failures/errors/skipped；退出0。离线 Maven test/package；临时 POM 仅排除历史 Finder 副本，正式 POM 不变。 |
| LOG: `python3 backend/scripts/check_log_backfill_entry.py` | PASS | 50；退出0；缺失日期创建、显式ID编辑、同ID/日期/首次创建、320/390/1440 对齐、self-only、冲突不转编辑、中文分析来源。 |
| ACCESS: `python3 backend/scripts/check_fixed_workspace_access.py` | PASS | 62；退出0；四层范围、作者写权、同级/跨部门拒绝、组织变化即时失权。 |
| NOTICE: `python3 backend/scripts/check_fixed_notifications.py` | PASS | 49；退出0；通知字段来源、撤权/撤回/缺失对象、独立评论与日志冻结。 |
| COMM: `python3 backend/scripts/check_fixed_communication_web.py` | PASS | 32；退出0；标签维护、评论、通知单一对象入口与评论定位、受限内容及焦点。 |
| ADMIN: `python3 backend/scripts/check_admin_console.py` | PASS | 40；退出0；原子保存、管理端真实浏览器、空态/校验/失败/确认。 |
| FORM: `python3 backend/scripts/check_task_creation_refinement.py` | PASS | 36 API + 39 browser；退出0；output/task-creation-refinement/{api-report,browser-report}.json。 |
| STAFF: `python3 backend/scripts/check_subordinate_workspace.py` | PASS | 82；退出0；树/组织、四种完成态、日级几何、详情原权限、日志分页、失权/旧响应与会话；output/subordinate-workspace/browser-report.json。 |
| RES: `python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /tmp/four-verify-resources.json` | PASS | 14/14；源文件、缓存版本与实际JAR静态资源逐字节一致。 |
| FREEZE: `补充真实24小时冻结后的编辑提交` | FAIL — V-001 | 原始日志不变且 frozen=true；overlayHidden=true、visibleText=false、drafts.log=null；重新进入编辑被拒绝；浏览器异常0。 |
| WEB: `python3 backend/scripts/check_fixed_web.py（check_work_logs.py 的受委托子套件）` | FAIL / 旧断言 | 135 条 PASS 后 actual descendant contact and log entry founder 失败；旧 p-open-person-logs 与本人页人员筛选断言不符合当前专用工作页/self-only合同。见 separate-log-forms-and-clean-product-copy V-002；未将中断后的行为计为已验证。 |
| node --check（8个根目录实际JS） / git diff --check | PASS | 全部退出0；不以语法通过替代功能验收 |
| 本轮截图阅读 | PASS（所观察布局） | tree-320、allday-handles-320、edit-aligned-390已实际查看；其余三宽度用浏览器几何断言覆盖 |
| before/after snapshot compare | PASS | changed=false，输入无变化 |

## Requirement Coverage

每行同时覆盖该requirement的规范正文和逐项列出的全部scenario；旧标题与新THEN冲突时以THEN及规范正文为准。

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| **Distinct log creation and editing interfaces**（spec:3）<br>S:10 `Create only a missing recent log`<br>S:14 `Edit one explicit record without creation controls`<br>S:18 `Preserve the draft through nested navigation and failed saves`<br>S:22 `Align both interfaces and keep the personal page intact`<br>S:26 `Reject editing another author or an expired record` | 工作区接入.js logCreateView/logEditView/logDateEditHTML/syncLogDraft/saveLog；LOG两模式及同ID/首次创建/对齐、自身列表和人员隔离；ACCESS/NOTICE作者/冻结拒绝；FREEZE确认失败时清空草稿（V-001）。网络、版本冲突的保留分支静态检查，未把未执行的细分组合计为全通过。 | FAIL — V-001；其余已执行子集PASS，完整回归受V-002影响 |
| **Production interface copy without redundant implementation explanations**（spec:30）<br>S:39 `Choose a tag and edit a log without rule paragraphs`<br>S:43 `Review reachable employee and administrator flows`<br>S:47 `Keep useful state explanations and analysis provenance`<br>S:51 `Preserve user-authored and historical content` | 标签评论/任务接入/工作区接入/个人资料/API/日程/任务表单及admin实际加载链；LOG、FORM、COMM、STAFF、ADMIN与WEB中断前可达页面，分析method映射/范围/生成时间；静态模板只改提示、用户内容仍esc输出；真实正文及审核意见同词回读保持。 | PASS |

已检查proposal范围、design实现约束及全部勾选任务；未新增验收要求。共同代码按当前整体快照取证，不把同一提交的所有改动自动归于此change。无本次新增数据库/权限扩张承诺被遗漏；云端发布、回退演练与手机真机按规划不在本轮范围。

尚未单独执行创建/编辑两种模式的全部“网络失败×关联任务子页返回×版本冲突”组合；静态保留分支与LOG已执行子集不等于这些组合全通过，修复后需补齐。V-002中断后的旧综合流程未作为证据。

## Findings

### V-001: 日志保存到达冻结点后关闭界面并清空未保存草稿

- Category: implementation
- Severity: medium
- Requirement: specs/pandora-requirements-aligned-prototype/spec.md，Distinct log creation and editing interfaces / Preserve the draft through nested navigation and failed saves；design.md Decisions 1；tasks 1.1、1.2、4.1。
- Evidence: 工作区接入.js:386 的 WORK_LOG_FROZEN catch 执行 P.reload();closeSheet()。交互原型.js:1492 closeSheet调用clearDrafts()，:1681清空drafts.log。真实随机Fixture(port=18215,controllable=True)创建日志“原始正文 标签 原型”，作者打开显式ID编辑，输入“冻结时仍应可复制的未保存草稿 标签 原型”；仅对此隔离服务POST /admin/clock/advance {"seconds":86401}，再点保存。实际 after={overlayHidden:true,visibleText:false,draft:null,notice:"该日志已满24小时，只能查看。"}。GET原日志body仍是原始正文、frozen=true、editable=false；再次openLogForm(id)被正确拒绝。浏览器异常0。隐藏DOM可能残留textarea节点，但不可见、draft已清空，不能作为保留草稿的用户可用证据。
- Expected: 冻结仍拒绝写入，同时保留当前模式的日期/标签/正文/关联草稿及可读/可复制的错误反馈，不自动关闭并清空；不能重置冻结窗口或保存新记录来绕过。
- Actual: 保存失败后编辑页关闭，草稿对象为空；作者无法重新进入已冻结编辑页取回未保存内容。
- Repair guidance: 调整冻结错误的界面处理，在保持服务端只读的前提下保留当前草稿及用户可取回的文字和明确反馈。覆盖编辑及已删除日槽重建遇到冻结的创建模式，不能通过关闭/重新载入丢掉草稿。
- Acceptance checks: 按上述真实可控时钟步骤复现两种模式；确认失败后模式/目标ID/日期/标签/正文/关联仍在且可复制，数据库原日志及首次创建/冻结点不变；其他作者仍无写权；再运行日志专项和修订后的完整check_work_logs。补验网络、版本冲突、嵌套选择返回保留草稿。
- Repair status: pending
- Repair notes: 无；本轮只验证，没有修复。
- Reverification notes: 首次独立确认；LOG50通过没有覆盖该失败分支，旧综合脚本反而将“到期即关闭”写成期待，不得用其旧断言覆盖新合同。

### V-002: 必须运行的日志综合回归仍断言旧人员入口及本人页人员筛选

- Category: implementation
- Severity: medium
- Requirement: tasks.md 4.1要求运行check_work_logs.py及相关真实浏览器回归，保留原业务覆盖；Distinct log creation and editing interfaces / Align both interfaces and keep the personal page intact；design要求独立人员阅读与本人self-only。
- Evidence: check_work_logs.py委托current_checks.run(check_fixed_workspace_access.py,check_fixed_web.py)。本轮前者62项通过，后者135条PASS后在“actual descendant contact and log entry founder”失败并退出1。check_fixed_employee_browser.js:404仍等待[data-action=p-open-person-logs]；:392—400要求进入本人log主页面并设置logAuthorId；:409—412继续要求已移除的logFindingCard/部门团队人员筛选。当前专用人员工作页提供[data-action=p-staff-tab][data-tab=logs]，本人日志按self-only固定范围，这些旧断言与当前合同相反。该文件:303—322还把冻结提交后关闭页作为通过条件，与V-001的新草稿要求冲突。
- Expected: 完整日志回归用当前专用人员工作页及显式日志ID验证同样的间接下属、作者权限、关联裁剪、冻结/删除重建、返回/会话等业务，不要求恢复本人页人员筛选；应实际执行完后续检查。
- Actual: 综合入口被旧DOM/导航合同中断；handoff承认未全绿，但未完成本change明确要求的回归迁移，不能宣称后续日志/冻结/资料流程已经运行。
- Repair guidance: 迁移旧入口/筛选/冻结失败断言到当前合同，同时保留真正的授权、冻结、冲突、删除重建及账号业务检查；不删检查或恢复旧产品入口换取通过。与下属工作区共享变更协调。
- Acceptance checks: python3 backend/scripts/check_work_logs.py完整退出0，且日志/人员/冻结等后续用例确实执行；python3 backend/scripts/check_log_backfill_entry.py、check_subordinate_workspace.py、check_fixed_workspace_access.py仍通过；V-001真实失败草稿检查纳入当前验证。
- Repair status: pending
- Repair notes: 无；本轮没有修改测试。
- Reverification notes: 首次独立在本change记录。属于测试实现与覆盖缺口，现有证据不表明当前人员工作页的日志阅读本身故障；STAFF82及ACCESS62独立通过，不因过时断言否定它们实际证明的行为。

下一步：`$openspec-e13-fix-change separate-log-forms-and-clean-product-copy`，修复后重新独立验证；当前不可归档。
