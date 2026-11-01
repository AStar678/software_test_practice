# Implementation Notes

- Change: refine-task-creation-notifications-and-review-routing
- Schema: spec-driven
- Store: local（`openspec/` 仓库根，无 `--store`）
- Implementation roots: /Users/watuji/MyGitDev/software_test_practice
- Updated: 2026-11-01T19:50+08:00
- Implementation revision: `2133e28` 之上未提交的工作区（排期衔接、服务端、脚本、网页资源、任务勾选见 `git status`）；本轮未创建 commit。
- Progress: 28/28 tasks complete。`6.2`–`6.4` 已在 `fix-hourly-schedule-drag-and-log-type` 完成后按最终合同衔接并回归（见下）。

本文件是实施交接，不是独立验证结论，也不修改 `verification.md`。

## Implementation Map

| 任务 | 代码 | 检查 / 证据 |
| --- | --- | --- |
| 1.1–1.3 | `TaskService.creationRoute/route/currentRoute/refreshRoutes/decide`、`BusinessTakeovers`、`OrganizationPlans`；`潘多拉-api.js` reviewerBasis | `TaskServiceTest`、`check_review_routing.py`（204）、`check_task_refinement_upgrade.py`（13） |
| 1.4 | 本轮改写 `check_business_takeover.py`、`check_handover_chain.py`、`check_fixed_handover_chain_browser.js`、`check_calendar_drawer.py` 与 `check_fixed_web.py` 的完成态 fixture，按申请人直属上级真实办结前置待审；`TaskService.currentRoute` 增加 reopen 回退（见下） | `check_business_takeover.py` 87/87、`check_handover_chain.py` 24/24（含真实浏览器）、`check_calendar_drawer.py` 102/102、`check_review_routing.py` 保持通过 |
| 2.1–2.4 | `V28__task_version_multiple_tags.sql`、`TaskService` 标签集合、`潘多拉-标签评论.js`、`潘多拉-任务接入.js`、日程颜色 | FORM 36 API + 39 浏览器、UPGRADE 13、NOTICE 49、LOG 47 |
| 3.1–3.2 | `TaskService.assigneeCandidates`、`潘多拉-任务接入.js` 候选缓存、`潘多拉-交互原型.js` `assigneePeopleHTML`；`潘多拉-api.js` `mapPerson`（无部门创始人显示“公司层”） | FORM 候选树父节点/无联系方式 API + 浏览器展开/搜索/勾选/排序/取消；新增无部门创始人、有部门无团队、同名跨团队断言 |
| 3.3 / 6.1 | `潘多拉-任务接入.js` 排期分组、显式日期时刻、全天快捷；`潘多拉-日历.css` | FORM 320/390/1440 几何、快捷重复点击、逆序拦截；截图 `output/task-creation-refinement/schedule-*.png` |
| 4.1–4.3 | `WorkspaceService.notificationsRead/notificationMetadataCategory/notificationCategory`、`潘多拉-工作区接入.js` 精简行/筛选/返回/焦点 | FORM 筛选、后续页命中、返回保留；COMM 精简行、长标题、非任务占位、头部关闭焦点；NOTICE 分类矩阵 |
| 5.1–5.2 | 见“本轮实际检查”；`潘多拉-交互原型.html`/`admin.html` 缓存版本号刷新 | 资源 14/14 逐字节一致；桌面 1440 与 320/390 截图 |
| 7.1–7.4 | `潘多拉-任务表单.js` 本人范围、`Tags.java` 创始人维护、`潘多拉-工作区接入.js` 写日志入口 | LOG 47（含仅可见任务不能经搜索/计数/刷新恢复、三天缺失日期、显式编辑、并发不转编辑） |
| 8.1 | `潘多拉-工作区接入.js` `notificationView`：同一对象只留一个跳转（查看任务/查看评论/查看日志），审核与历史只读入口独立 | COMM 任务/任务评论/日志评论各一个入口、目的地正确、撤回后无入口 |
| 8.2 | 通知字段自动生成（事件/快照/接收人副本），无手填写接口；缺失对象安全兜底 | NOTICE 49（含全量副本字段矩阵、撤回无对象名、`POST /notifications` 不存在）；`backend/docs/task-creation-refinement.md` 接口说明 |
| 8.3 | 本 delta 对任务表单/筛选/个人日志采用完整 MODIFIED 条款替换旧范围 | LOG 47 + FORM；文档写明“替换而非追加例外” |

### 本轮服务端修复（1.4 暴露）

`TaskService.currentRoute` 原先用任务**当前有效版本**的负责人校验非创建申请的路线。已完成任务的原负责人被停用后，接管人重开并提交有效替代负责人时，申请对审核人不可见（404），也无法办理。现仅在 `kind=reopen` 且当前负责人校验失败时，改用该申请**将要发布**的负责人重新校验；审核人仍只由申请人直属上级决定，不改回旧路线，也不扩大其他申请的读取。`TaskParticipantSummaryTest` 继续保证普通冻结任务详情不查询提议版本负责人。

## 本轮实际检查（2026-11-01，均在项目根目录）

浏览器使用 `CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`；所有集成脚本各自创建并清理随机命名测试库，未连接演示库或云端。

| 命令 | 结果 / 证据 |
| --- | --- |
| `cd backend && mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package` | 111 项单元测试，0 失败/错误/跳过；BUILD SUCCESS（最后一次含 `currentRoute` 修复） |
| `python3 backend/scripts/check_task_creation_refinement.py` | 退出 0；36 API + 39 浏览器。`output/task-creation-refinement/api-report.json`、`browser-report.json` 及 `schedule-320/390/1440.png`、`assignee-tree-390.png`、`notifications-compact-390.png` |
| `python3 backend/scripts/check_review_routing.py` | 退出 0；204 项。`output/task-creation-refinement/review-routing.json` |
| `python3 backend/scripts/check_business_takeover.py` | 退出 0；87 项。`audit/.../business-takeover.json` |
| `python3 backend/scripts/check_handover_chain.py` | 退出 0；24 项，含真实浏览器接管/停用/编辑/进展/重开链。`audit/.../handover-chain.json` |
| `python3 backend/scripts/check_calendar_drawer.py` | 退出 0；102 项；完成态 fixture 先由直属上级批准为 `done` 再验证展示 |
| `python3 backend/scripts/check_fixed_notifications.py` | 退出 0；49 项，含通知副本字段矩阵与非任务对象兜底 |
| `python3 backend/scripts/check_fixed_communication_web.py` | 退出 0；32 项浏览器，含单一对象入口、日志评论定位、长标题、非任务占位、头部关闭焦点 |
| `python3 backend/scripts/check_log_backfill_entry.py` | 退出 0；47 项 |
| `python3 backend/scripts/check_task_refinement_upgrade.py` | 退出 0；13 项（V27→V28、旧待审刷新、终态/停用） |
| `env -u PANDORA_DEMO_PASSWORD python3 backend/scripts/check_final_demo.py` | 退出 0；55 项，隔离库重复准备/重启回读 |
| `cd backend && python3 scripts/check_web_resources.py --repo .. --jar target/pandora-backend-0.1.0.jar --output ../audit/refactor-pandora-organization-and-workflows/web-resources-refine.json` | 14/14；打包资源与源码逐字节一致，缓存版本号与当前哈希一致 |
| `python3 backend/scripts/check_fixed_web.py` | **未全绿**：管理端 15 项通过；员工端 134 项通过后停在 `fixed manager retains subordinate profile and logs founder`（下属资料树默认折叠，属 `redesign-subordinate-workspace` 范围）。其完成态 fixture 与重开待审路径已按本变更更新并通过 |
| `node --check`（根目录 8 个实际加载 JS + 改动的检查脚本）、`python3 -m py_compile` 等价语法检查、`openspec validate ... --strict` | 通过（validate 见下条历史说明） |

## 排期衔接完成（6.2–6.4，2026-11-01）

`fix-hourly-schedule-drag-and-log-type` 已完成（14/14）并包含月历日级绘制/按天拖动、日轴小时、纵向全天区、本人/下属入口分离和待审虚线投影。本变更因此不再阻塞：

- `6.2` 本人日历使用共享 `monthWeek` 日级几何（`--month-left:0%;--month-width:100%`），整条/端点按公司日期平移并保留日内时刻；日轴/横轴/全天区按小时。普通点击仍开当日清单，键盘、取消、跨日/月/午夜/零时长由排期专项覆盖；不再以 15 分钟或基础编辑权作为拖动标准。
- `6.3` 仅排期确认走 `P.openScheduleChange` → 原 change/reschedule 审核（实际操作者直属上级）；待审时本人日历在提议位置显示虚线，普通详情/表单/提醒仍读有效版本；任务表单和下属日程无拖动入口，任务详情沿用当前用户原权限（下属专项分别验证有/无基础编辑权）。
- `6.4` 本轮回归与本地预览更新见下表；未做手机真机测试。

| 本轮命令（2026-11-01 晚，隔离随机库） | 结果 |
| --- | --- |
| `CHROME_BIN=… python3 backend/scripts/check_schedule_drag.py` | 退出 0；211 项（日级月历、按天整条/端点、日轴小时、全天区、待审位置与终态、下属/表单无拖动） |
| `CHROME_BIN=… python3 backend/scripts/check_subordinate_workspace.py` | 退出 0；82 项（共享日级几何、完成状态、无拖动、详情权限） |
| `CHROME_BIN=… python3 backend/scripts/check_task_creation_refinement.py` | 退出 0；36 API + 39 浏览器 |
| `CHROME_BIN=… python3 backend/scripts/check_calendar_drawer.py` | 退出 0；102 项 |
| `CHROME_BIN=… python3 backend/scripts/check_review_routing.py` | 退出 0；204 项 |
| `cd backend && mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package` | 111 项单元测试，0 失败/错误/跳过；BUILD SUCCESS |
| `cd backend && python3 scripts/check_web_resources.py --repo .. --jar target/pandora-backend-0.1.0.jar --output ../audit/.../web-resources-logs.json` | 14/14；资源与源码逐字节一致 |
| 本地 8080 预览（`service.py stop demo` 后以 `pandora_demo` 重启） | health=UP；工作区/日程/个人资料/主题/HTML 与源码 SHA256 一致；演示库保留 |

实施交接仍不是独立验证结论；`verification.md` 保留首次 FAIL 原文。

## Verification Reminders

- 重点复核 1.4：接管不取得审核权、原申请人不变、停用后重开由接管人直属上级批准；`check_business_takeover.py` 与 `check_handover_chain.py` 均已真实办结前置待审，不要再以旧免审断言判断。
- 复核 `TaskService.currentRoute` reopen 回退：仅 `reopen` + 当前负责人校验失败时使用提议负责人；普通冻结详情仍不得读取提议版本（`TaskParticipantSummaryTest.effectiveTaskDoesNotRevealProposedOwnersWhileFrozen`）。
- `check_calendar_drawer_browser.js` 的置顶标志断言已从 `.p-pin` 元素改为“`.p-pin` 或标题内 `★`”；`c1d6073` 移除该元素，另一 change 可能恢复，当前两种表达都接受。
- `潘多拉-api.js` 无部门创始人部门标签由“公司”改为“公司层”（3.2/规格场景要求）。
- `潘多拉-交互原型.html`、`admin.html` 全部 `?v=` 已刷新到当前文件哈希；后续修改任一资源都需重新刷新，否则 `check_web_resources.py` 会失败。
- 通知详情现在只有一个对象入口；若后续新增对象类型，需在 `notificationView` 的 `objectLabel` 中给出明确名称，不要恢复“任务+对象”双入口。
- `check_fixed_web.py` 员工端仍有属于下属工作区/旧日志卡的断言；本变更只更新了其中的完成态 fixture、重开审核、日志卡点击、加载文案与同日冲突断言，未把其余失败当作本变更证据。
- 安卓真机、软键盘、云端部署均未执行；用户已明确取消真机测试，浏览器尺寸模拟不能替代真机结论。

## Historical（仍有效的历史事实）

- 2026-10-31 曾发布到 https://8.141.96.122:6644，代码 `f29f9fd`，V28 已升级；本轮未重新部署，也未访问生产数据。
- 更早的实施记录来自另一台机器路径 `/Users/aoxiang/Desktop/软件测试`，其“17/25 项完成”“未发布”等描述已由本文件取代；旧输出不作为本轮证据。
- `verification.md` 的 V-001/V-002 保持原样（apply 不修改验证报告）。本轮修的是测试契约与 reopen 可见性，不是放宽服务端审核。
