# Implementation Verification

- Change: refine-flutter-employee-workflows
- Schema: spec-driven
- Verdict: BLOCKED
- Verified at: 2026-11-18T20:36:35+08:00
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice/flutter`（在仓库根捕获，涵盖共享服务）
- Verified revision: `fe3b17f904633c412b62df155d661f962a7e18c3` + 未提交改动（捕获时工作区 dirty）

## Summary

首页半屏场景独立通过：Android 普通及窄短屏大字下，上滑到底时整个事项区均为可用内容高度的 50%，在日历内滑动只翻日期，从「今天」按钮中心下滑可恢复两张上方卡片。V-001 和 V-002 已复验解决。严格规格校验、静态分析和 231 项组件及单元测试通过。整个 change 仍为 BLOCKED：真实服务的授权投影与保存回读缺少独立联调证据，完整 Android 多行软键盘操作也未复验（V-003）。不应归档。

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| ------------- | ---------------------------------------------- |
| 实施及规划 `/Users/watuji/MyGitDev/software_test_practice` | 同一 Git 根，1,217 个快照文件，含当前 proposal/design/spec/tasks、Flutter、共享后端及仓库内的关联规格 |
| 当前 `specs/pandora-requirements-aligned-prototype/spec.md` | 9 项需求、16 个场景；`proposal.md`、`design.md`、`tasks.md` 一并核对 |
| 既有 Flutter 约束 | `openspec/changes/archive/2026-11-18-build-flutter-employee-android-client/specs/flutter-employee-client/spec.md:17`、`:168`，及相邻 `design.md:112` |
| 已安装 Android debug APK | 设备与本地 APK 字节 SHA-256 一致：`f2ebe315a4d9707f22650296bdf9b8b2afd585d60d51581fef14a7dac8df90d4`。使用 apply 的已安装构建，本轮未重新构建；当前源码另以测试和快照覆盖。 |

增量复验。已确认旧 `verification-state.json` SHA-256 与前次报告一致（`205e8739c57d48a8c4027618cebd33130c3360cd1c7a4e3802f1092884f91883`）；`compare <saved.json> <before.json>` 退出 1，仅首页、首页测试、共享测试夹具及四个规划文件变化，未变更日历实现、其他功能、后端或依赖。重新追踪首页和受影响交互；因共享测试夹具变化重跑全套组件回归，复用其他场景未受影响的静态和旧 Android 局部观察，不把旧联调声明当独立证据。

快照命令（仓库根）：`python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture --root "$PWD" --output <before-or-after.json>`，及同脚本 `compare <before.json> <after.json>`；前后比较退出 0。当前 `verification-state.json` SHA-256：`be0ddc8639b7d0d42cffbea047cd31318b2eb24a850c77090d378e0e729c2b0d`。无附加 `--exclude`；Git 忽略的依赖缓存、构建、`output/` 设备产物等不在清单内，脚本自动排除交接/报告/状态文件。

## Apply Handoff Review

`implementation-notes.md` 的 change、Flutter 项目、`fe3b17f` 基线及首页差异与当前相符。首页手势、半屏测量及 Android 重放均独立执行，不以 16/16 勾选或 apply 输出作证明。`git diff` 未见后端或 Flutter 依赖清单改动。

- 真实服务数据依赖：`J28`/`J30` 依赖可审、历史及 direct 演示样例；只核对了测试和夹具断言，未确认当前服务数据，见 V-003。现用 demo 数据未重置。
- `J32` 写入与清理：源码确认它会创建或临时编辑和恢复日志，无法将清理等同于无副作用；本轮未执行、未改 demo 业务数据，不独立认定旧测试的清理结果，见 V-003。
- Android 双指与键盘：保留前次对 `output/flutter-client-2026-11-17/native/` 的 `203`/`204`/`205` 可见容量样本及 `210`/`215` 键盘截图的独立观察。双指为交接记录的 MT-B 注入，本轮未重放；截图不能证明收起、重开、多行滚动或真机适配。
- 模拟器偏好：`calendar.weekHeight=72.0`、`show_ime_with_hard_keyboard=0` 未独立读取，本次不调整它们；首页实测临时改变屏幕尺寸及字体，结束独立确认已恢复 `960×1920`、`480 dpi`、`font_scale=1.0`。只浏览、开关闭页面，不提交业务数据。
- 日志保存链路：检查 `WorkspaceService.changeLog` 的最小信封及 Flutter 合成逻辑；已有组件测试验证落后版本、失败和列表保留。真实服务版本递增与完整投影回读待 V-003；同版本不同正文并非组件测试覆盖，不能认定交接所称完全兼容。
- 作者范围：源码确认列表应用更新前核对人员范围、条目及版本；保存结果沿用基线作者。异常跨作者响应与本人换号竞态没有端到端覆盖，未重现缺陷；不把已有版本测试当作跨作者证据。
- 日视图入口锚点：设计要求用当前可见日期/偏移，`calendar_day_entrance_test.dart` 证明跨月进入及返回位置；最上方部分可见行符合当前口径，不要求改成第一个完整可见周。
- 其他未测项：第二 Android 版本、真机手势/键盘、真实振感、远端 HTTP、release 签名和 HTTPS 仍无本轮证据；本轮亦未独立复跑 Android 双人密度、日志保存和完整键盘流程。

## Checks

| Command or inspection | Result | Notes |
| --------------------- | ------ | ----- |
| `openspec validate refine-flutter-employee-workflows --type change --strict --json --no-interactive` | PASS | `valid: true`，无 issues |
| Flutter: `flutter test --no-pub test/features/home_web_parity_test.dart test/features/daily_calendar_web_parity_test.dart test/features/daily_items_ui_test.dart test/features/app_navigation_test.dart --reporter expanded` | PASS | 19 项，本轮执行；包括真实导航壳下两档屏幕与模拟安全区，以及既有长按和日期路径回归 |
| Flutter: `flutter test --no-pub test/core test/features test/widget_test.dart --reporter compact` | PASS | 231 项，本轮执行；业务交互使用夹具，非真实服务 |
| Flutter: `flutter analyze --no-pub` | PASS | No issues found |
| Android API 36，模拟器 `emulator-5554`，首页滚动 | PASS | 480 dpi；390×640 dp、字体 1.0：`684/1368 px`。320×568 dp、字体 1.5：`576/1152 px`。两档日历翻周不动外层，从「今天」中间下滑恢复卡片。窄短大字额外验证前后月、年月选择器、加号、今天、11 月 18 日当天清单（未保存）。 |
| 既有 Android 产物 `output/flutter-client-2026-11-17/native/` | PARTIAL / 复用 | `203`/`204` 有不同容量；`210`/`215` 真实键盘下发送可见；`214` 列表含保存标记，但 `213` 详情可见区没有正文，不能证明完整回读。`230`、`240` 与本轮首页测量一致，不作为本轮执行的替代。 |
| Flutter: `flutter test --no-pub test/integration/real_backend_test.dart --reporter compact` | NOT RUN | 涉及真实登录/写数据，未获隔离目标及独立执行授权；V-003 |

## Requirement Coverage

| Requirement / scenario | Evidence | Result |
| ---------------------- | -------- | ------ |
| Page chrome / Keep primary and secondary navigation legible | `common.dart`、`home_page.dart`、`daily_items_day_page.dart`、`profile_pages.dart`；`app_navigation_test.dart`、`page_chrome_test.dart`、`home_web_parity_test.dart`：五分支、事项日期标题、两种上级数据、窄屏年月与今天操作；本轮 Android 补证日期工具及当天页。 | PASS |
| Page chrome / Scroll the home dashboard without a full-height daily calendar | `home_page.dart:63` 在实际内容视口外测高，限高覆盖标题及日历；`home_web_parity_test.dart` 实拖两层并测物理布局和控件命中；Android 两档重放验证区块、日期切换和下滑起点。 | PASS；V-001、V-002 已解决 |
| Compact chronicles / Fit and expand chronicle bodies independently | `home_lists.dart` 先量实际两行再分配箭头；`home_web_parity_test.dart` 证明恰好两行无箭头且不可假展开，多条展开独立、保留纯文本和换行。 | PASS（组件） |
| Fading names / Fade only a clipped task or daily item name | `fading_name_text.dart` 及月条、首页/清单和表单接入；`fading_name_test.dart` 与 `daily_calendar_web_parity_test.dart` 检查字素、1.5 字体、满宽不渐隐、无省略号、完整语义和跨月条；未独立复跑 Android 渲染。 | PASS（布局及组件）；Android 部分待复验 |
| Notification language / Separate past submissions from actual review work | `notification_language.dart`、`notification_detail_page.dart` 和 `notification_language_test.dart` / `notification_list_test.dart`：direct、未知、无权限、撤回、历史与当前待审、已读筛选、分页不合成行。 | 夹具通过；真实资格和数据待 V-003 |
| Task hierarchy / Edit a legacy task without erasing history | `task_form_page.dart`、`assignee_picker.dart`、`task_detail_page.dart`、`task_table_page.dart`；`assignee_picker_test.dart`、`task_form_test.dart`、`task_table_ui_test.dart` 确认长树外层滚动、移除最后标签发送空数组、常规操作不呈现/提交完成标准、使用有效截止；历史投影未删除。 | PASS（组件及静态） |
| Task hierarchy / Submit progress and open the exact pending request | `task_action_pages.dart`、`task_detail_page.dart`；`task_actions_web_parity_test.dart` 和 `task_detail_layout_test.dart` 区分预览和回读身份、成功后回读故障、有效截止、精确申请 ID、下属只读。 | PASS（组件） |
| Reviewer-first / Compare only changes while retaining authorized context；Show initial proposal without a phantom comparison | `approvals_pages.dart` 以服务授权消费差异；`approvals_ui_test.dart` 验证纯排序、快照展开、空差异、无旧版、申请人投影、失权与只读裁决。 | 夹具通过；真实授权投影待 V-003 |
| Calendar entrances / Use both day entrances and return without jumping；Show optional real holiday marks across a year boundary | `task_calendar_page.dart`；`calendar_day_entrance_test.dart` 验证两个入口、详情和清单返回、日期偏移及人员隔离；`calendar_day_holiday_test.dart` 验证休/班、无年度数据、缓存故障和任务可读。 | PASS（组件）；Android 返回未独立重放 |
| Calendar indicators / Read status without confusing it with a pending schedule proposal；Adjust density without navigating or changing data | `task_calendar_page.dart`、`app_preferences.dart`；`calendar_status_style_test.dart`、`calendar_pinch_test.dart` 和 `task_calendar_drag_ui_test.dart` 覆盖显示状态、有/无提议、只读、双指锚点与 `+N`、单指、取消、无写。 | PASS（组件）；Android 双指只核对既有样本 |
| Log filtering / Distinguish an exact preview fit from a hidden fourth line | `work_logs_page.dart`、`log_body_preview.dart`；`work_logs_ui_test.dart`、`log_body_preview_test.dart` 验证两人员路径的筛选应用/取消/清除、真实冻结、详情全文，以及三行、显式第四行、软换行。 | PASS（组件） |
| Log freshness / Return from a real save without manual refresh | `work_logs_api.dart`、`work_logs_page.dart`；`work_log_freshness_test.dart` 验证同版本内容、第二页、筛选和位置、落后读取、失败不覆盖，未重跑真实写及两层回读。 | 夹具通过；真实场景待 V-003 |
| Comment composer / Keep task and log comments usable with the Android keyboard | `comments_section.dart`、`comments_keyboard_test.dart`：模拟键盘 inset、长文、收起保留、失败保留、下属有权评论；既有真键盘截图证明任务和日志发送区可见。 | 部分；真实 Android 多行/收起/重开未独立跑完 |

## Findings

### V-001: 首页和事项月历的纵向手势未协调

- Category: implementation
- Severity: medium
- Requirement: 原首页协调滚动约束；现规格 `Scroll the home dashboard without a full-height daily calendar` 明确分配手势与半屏上限。
- Evidence: `flutter/lib/features/home/presentation/home_page.dart:90` 的限高容器包括标题和日期工具栏，工具栏不进入内层滚动；`flutter/test/features/home_web_parity_test.dart:74` 实拖、测高度、断言两个滚动位置及操作日期控件。
- Expected: 上滑到底仍保留半屏内容空间；日期区独立浏览，工具栏下滑能找回卡片而不依赖边缘空隙。
- Actual: 390×640 dp：事项区 `y=852…1536`、内容 `y=240…1608`；320×568 dp / 1.5：事项区 `y=744…1320`、内容 `y=240…1392`。两次首个可见周从 11 月 9 日变为 11 月 16 日时标题位置不变；再从「今天」中心下滑后两张卡片恢复至初始边界，日历锚点未被该下滑改动。
- Repair guidance: 无剩余首页修复要求。
- Acceptance checks: `adb -s emulator-5554 shell input swipe`，普通档用 `310 735 310 290 430` 上滑、`640 1360 640 1000 450` 翻周、`434 928 434 1400 500` 下滑；短屏档用 `280 710 280 305 430`、`415 1290 415 933 450`、`537 820 537 1330 500`。先点「今天」定位；坐标为物理像素。边界由 `adb -s emulator-5554 exec-out uiautomator dump /dev/tty` 与截图核对，上述结果实测通过。
- Repair status: verified-resolved
- Repair notes: 无。
- Reverification notes: 复验新版 APK 和当前源码，两档均通过；V-001 不再阻塞。

### V-002: 半屏上限和禁止首页整页滚动尚未形成验收口径

- Category: planning
- Severity: medium
- Requirement: `Flutter concise page chrome and calendar labels` 及 `Scroll the home dashboard without a full-height daily calendar`。
- Evidence: 增量规格、提案、设计及任务 1.2/5.2 已一致定义按首页内容区测量、标题工具计入、整页可滚、紧凑时可少于两周。
- Expected: 明确半屏分母和手势，不回溯应用未提出的固定页要求。
- Actual: 新口径明确且可执行，V-001 的两档实测通过。
- Repair guidance: 无剩余规划决策。
- Acceptance checks: 严格规格校验及 V-001 的半屏复验均通过。
- Repair status: verified-resolved
- Repair notes: 无。
- Reverification notes: 用户确认保留整页滚动，未要求固定首页。

### V-003: 隔离真实服务尚未在本轮独立复测

- Category: environment
- Severity: medium
- Requirement: Tasks 2.1、2.4、4.2、5.1；真实通知资格、审核投影及保存后服务回读。
- Evidence: `flutter/test/integration/real_backend_test.dart` 默认访问本机演示库；`J28`/`J30` 登录读取，`J32` 及整套测试涉及写入且可能修改现有数据。Apply 的日志不是本轮运行结果。
- Expected: 在确认隔离、样例和授权后，真实服务证据可独立复验且测试数据可清理。
- Actual: 首页场景本轮有独立 Android 结果；通知、审核、日志联调仍只有夹具、静态及旧 Android 局部证据，未运行真实服务联调写入。
- Repair guidance: 提供并明确授权使用专用或可回滚的测试实例与种子，勿直接运行现用库写测试。
- Acceptance checks: 在隔离服务上跑 `flutter test --no-pub test/integration/real_backend_test.dart --reporter compact` 的相关场景，明确 J28/J30/J32 未跳过且运行后无测试正文残留；补完 Android 多行、收起/重开及日志两层的独立观察。
- Repair status: blocked
- Repair notes: 无。
- Reverification notes: 待隔离环境及授权。
