# Implementation Verification

- Change: refine-flutter-employee-workflows
- Schema: spec-driven
- Verdict: FAIL
- Verified at: 2026-11-18T19:52:00+08:00
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice/flutter`（在仓库根捕获，涵盖共享服务）
- Verified revision: `ec306884b877dedfc98d37fb02446cf73c4584ee` + 未提交改动（捕获时工作区 dirty）

## Summary

Android 模拟器独立复现 V-001：首页上滑到末端后，每日事项几乎填满内容区；从日历内下滑只滚动日期，不能带回上方卡片。代码和历史均表明外层首页滚动不是这次换行修复引入的；既有 Flutter 规格要求整页可滚、日历与首页协调。用户提出的半屏上限、以及是否禁止整页滚动，是需要落入规划的新口径（V-002）。严格规格验证、Flutter 静态分析和 230 项组件及单元测试通过；未独立重跑真实服务联调（V-003）。不应归档。

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| ------------- | ---------------------------------------------- |
| 实施及规划 `/Users/watuji/MyGitDev/software_test_practice` | 同一 Git 根，1,217 个快照文件，含当前 proposal/design/spec/tasks、Flutter、共享后端及仓库内的关联规格 |
| 当前 `specs/pandora-requirements-aligned-prototype/spec.md` | 9 项需求、15 个场景；`proposal.md`、`design.md`、`tasks.md` 一并核对 |
| 既有 Flutter 约束 | `openspec/changes/archive/2026-11-18-build-flutter-employee-android-client/specs/flutter-employee-client/spec.md:17`、`:168`，及相邻 `design.md:112` |
| 已安装 Android debug APK | 设备与本地 APK 字节 SHA-256 一致：`717e0e58ff275228dbc2ee21ac8e1dee41a2c322f7130c99df163af6b7f59ed2`。为既有构建，未重新构建；精确源码归属以本轮源码检查辅证，不把 APK 指纹当源码快照。 |

首次独立验证，无旧报告；旧状态比较因文件不存在退出 2，建立新基线。命令：仓库根执行 `python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture --root "$PWD" --output <before-or-after.json>`，及同脚本 `compare <before.json> <after.json>`；前后比较退出 0，无变化。`verification-state.json` SHA-256：`205e8739c57d48a8c4027618cebd33130c3360cd1c7a4e3802f1092884f91883`。无附加 `--exclude`；Git 忽略的依赖缓存、构建、`output/` 设备产物等不在清单内，脚本自身排除流程交接/报告/状态文件。首次按完整增量逐场景审查，重点独立操作首页；没有复用的先前独立结论。既有设备产物仅作为可直接检查的局部观察，不替代本轮未执行的交互或联调。

## Apply Handoff Review

`implementation-notes.md` 的 change、Flutter 项目和 `ec30688` 基线与当前匹配，未提交文件数依其口径写为 53、本轮捕获前 `git status --short --untracked-files=all` 为 54（包含交接文件）；不能凭数量还原源码。`git diff` 未见后端或 Flutter 依赖清单改动。关于窄屏工具栏的测试通过，但没有覆盖 V-001 的滑动。

- 真实服务数据依赖：`J28`/`J30` 依赖可审、历史及 direct 演示样例；只核对了测试和夹具断言，未确认当前服务数据，见 V-003。现用 demo 数据未重置。
- `J32` 写入与清理：源码确认它会创建或临时编辑和恢复日志，无法将清理等同于无副作用；本轮未执行、未改 demo 业务数据，不独立认定旧测试的清理结果，见 V-003。
- Android 双指与键盘：审阅既有 `output/flutter-client-2026-11-17/native/` 的 `203`/`204`/`205` 可见容量样本及 `210`/`215` 键盘和发送控件截图。双指只由交接声称为 MT-B 注入，本轮未重放；键盘截图证明当时输入和发送位于键盘之上，不能证明收起、重开、多行滚动或真机适配。
- 模拟器偏好：`calendar.weekHeight=72.0`、`show_ime_with_hard_keyboard=0` 未独立读取，无需更改；独立读得 `font_scale=1.0`。本轮复现只浏览首页、点回今天并恢复首页至顶部，未调整任务日历密度或系统配置。
- 日志保存链路：检查 `WorkspaceService.changeLog` 的最小信封及 Flutter 合成逻辑；已有组件测试验证落后版本、失败和列表保留。真实服务版本递增与完整投影回读待 V-003；同版本不同正文并非组件测试覆盖，不能认定交接所称完全兼容。
- 作者范围：源码确认列表应用更新前核对人员范围、条目及版本；保存结果沿用基线作者。异常跨作者响应与本人换号竞态没有端到端覆盖，未重现缺陷；不把已有版本测试当作跨作者证据。
- 日视图入口锚点：设计要求用当前可见日期/偏移，`calendar_day_entrance_test.dart` 证明跨月进入及返回位置；最上方部分可见行符合当前口径，不要求改成第一个完整可见周。
- 其他未测项：第二 Android 版本、真机手势/键盘、真实振感、远端 HTTP、release 签名和 HTTPS 仍无本轮证据；本轮亦未独立复跑 Android 双人密度、日志保存和完整键盘流程。

## Checks

| Command or inspection | Result | Notes |
| --------------------- | ------ | ----- |
| `openspec validate refine-flutter-employee-workflows --type change --strict --json --no-interactive` | PASS | `valid: true`，无 issues |
| Flutter: `flutter test --no-pub --reporter expanded test/features/home_web_parity_test.dart test/features/page_chrome_test.dart` | PASS | 8 项；窄屏 320、字体 1.5 测日期操作与无溢出，不测上滑和返回 |
| Flutter: `flutter test --no-pub test/core test/features test/widget_test.dart --reporter compact` | PASS | 230 项，均为本轮执行；交互使用夹具，非真实服务 |
| Flutter: `flutter analyze --no-pub` | PASS | No issues found |
| Android API 36，模拟器 `emulator-5554`，首页滚动 | FAIL | 960×1920 px，480 dpi（320×640 dp），字体 1.0；日历反向滚动不带动外层，见 V-001 |
| 既有 Android 产物 `output/flutter-client-2026-11-17/native/` | PARTIAL | `200` 的 UI 树包含日期工具；`203`/`204` 有不同容量；`210`/`215` 真键盘截图含发送按钮；`214` 列表含保存标记，但 `213` 详情可见区的 UI 树并没有该标记；不视为完整重放 |
| Flutter: `flutter test --no-pub test/integration/real_backend_test.dart --reporter compact` | NOT RUN | 涉及真实登录/写数据，未获隔离目标及独立执行授权；V-003 |

## Requirement Coverage

| Requirement / scenario | Evidence | Result |
| ---------------------- | -------- | ------ |
| Page chrome / Keep primary and secondary navigation legible | `common.dart`、`home_page.dart`、`daily_items_day_page.dart`、`profile_pages.dart`；`app_navigation_test.dart`、`page_chrome_test.dart`、`home_web_parity_test.dart`：五分支、事项日期标题、两种上级数据、窄屏年月与今天操作；既有 Android `200` UI 树同时含新建和日期控件。首页滚动的既有约束单列。 | PASS（本场景）；V-001 不由上述测试覆盖 |
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
| 既有 Flutter 首页交互（任务 1.2、5.2 的受影响邻接行为） | `home_page.dart:65`，`daily_items_calendar.dart:489`；窄屏 Android 正反向手势实测及基线追溯。 | FAIL（V-001）；新增上限及固定页口径待 V-002 |

## Findings

### V-001: 首页和事项月历的纵向手势未协调

- Category: implementation
- Severity: medium
- Requirement: 既有 Flutter `Vertical continuous daily-item calendar` / `Home previews and list-first entry`，及 `openspec/changes/archive/2026-11-18-build-flutter-employee-android-client/design.md:112` 的同向协调、边缘仍可继续滚首页。当前增量只改日期栏，不废除该行为约束。
- Evidence: `flutter/lib/features/home/presentation/home_page.dart:65` 的外层 `CustomScrollView` 与 `flutter/lib/features/daily_items/presentation/daily_items_calendar.dart:510` 的内层 `SingleChildScrollView` 使用独立 controller；后者没有外层手势交接。`git blame` 确认外层滚动早于本 change；`git diff` 显示本轮换行改变标题行所占高度，不是新增首页滚动。固定月历高为 `26 + 34 + 2 × (36 + 34 × 3 + 18 + 4) = 380 dp`，单月历即超过 `640 dp` 整屏一半（不含工具栏）。
- Expected: 按既有规格，上方卡片可随首页滚动，日历与首页同向手势有协调，不必寻找狭窄空白才能恢复上方卡片；保留日历浏览和日期工具。
- Actual: 在 320×640 dp、字体 1.0 的首页，用 `adb -s emulator-5554 shell input swipe 470 710 470 280 490` 从卡片间上滑：上方卡片只剩底边，事项区几乎铺满内容区，顶栏和底部导航仍可见。接着 `adb -s emulator-5554 shell input swipe 760 870 760 1460 490` 在日历内下滑：首个可见周从 11 月 16 日移到 11 月 9 日，工具栏和卡片位置不动。点回「今天」后从右侧留白下滑（`adb -s emulator-5554 shell input swipe 935 490 935 1050 490`），两张卡片恢复。坐标针对 960×1920 px 截图；按本机大小等比例调整。结果不是系统导航消失，也不是逻辑上完全无法回上方。
- Repair guidance: 若沿用既有整页可滚口径，协调主页面与独立日历的同向操作或保留明确、容易下滑的卡片区域，不能用缩小按钮或破坏日期定位换取空间。若改为首页固定和半屏，先处理 V-002。
- Acceptance checks: 用有三条预览及有事项的真实首页，在普通、320×640 dp 和放大字体下，从卡片上滑后正常下滑可再看到事件纪及任务看板，无需命中边缘空隙；同时验证纯日历浏览、选日、回今天和加号。增加能捕获该交互而不仅是溢出的回归检查。
- Repair status: pending
- Repair notes: 无。
- Reverification notes: 首次独立复现。

### V-002: 半屏上限和禁止首页整页滚动尚未形成验收口径

- Category: planning
- Severity: medium
- Requirement: 当前增量 `Flutter concise page chrome and calendar labels` 只要求窄屏大字时完整可操作且不缩小触摸目标；既有 Flutter 规格明确整页可滚，并以两周为正常事项密度。
- Evidence: 用户本轮希望每日事项最多半屏，也指出首页原本应固定；现有规格没有半屏限制，且其既有滚动规则与固定页相反。设备宽度下工具栏确实两行。
- Expected: 明确是否保留整页短屏滚动、半屏是整屏还是首页内容区的 50%、是否包含日期工具栏，以及短屏大字时两周密度能否降级。
- Actual: 现有产物不足以按新口径验收；两行本身符合现有设计的换行策略，不作为独立缺陷。
- Repair guidance: 回规划模型更新规格、设计及验收场景；保留工具点击面积，明确最少可见内容和短屏可达路径。
- Acceptance checks: 在普通及窄短屏大字状态使用明确定义的 50% 分母测区块，验证首页滚动策略及事项独立滚动、日期工具和上方卡片始终有可用入口。
- Repair status: blocked
- Repair notes: 无。
- Reverification notes: 不把新偏好追溯成旧规格失败；独立失败依据为 V-001。

### V-003: 隔离真实服务尚未在本轮独立复测

- Category: environment
- Severity: medium
- Requirement: Tasks 2.1、2.4、4.2、5.1；真实通知资格、审核投影及保存后服务回读。
- Evidence: `flutter/test/integration/real_backend_test.dart` 默认访问本机演示库；`J28`/`J30` 登录读取，`J32` 及整套测试涉及写入且可能修改现有数据。Apply 的日志不是本轮运行结果。
- Expected: 在确认隔离、样例和授权后，真实服务证据可独立复验且测试数据可清理。
- Actual: 本轮只有夹具、静态及已有 Android 产物部分证据；未运行任何联调写入。
- Repair guidance: 提供并明确授权使用专用或可回滚的测试实例与种子，勿直接运行现用库写测试。
- Acceptance checks: 在隔离服务上跑 `flutter test --no-pub test/integration/real_backend_test.dart --reporter compact` 的相关场景，明确 J28/J30/J32 未跳过且运行后无测试正文残留；补完 Android 多行、收起/重开及日志两层的独立观察。
- Repair status: blocked
- Repair notes: 无。
- Reverification notes: 待隔离环境及授权。
