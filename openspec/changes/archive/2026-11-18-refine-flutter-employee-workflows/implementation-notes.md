# Implementation Notes

- Change: refine-flutter-employee-workflows
- Schema: spec-driven
- Store: local（仓库 `openspec/`）
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice/flutter`（后端未改）
- Updated: 2026-11-18T20:24:00+08:00
- Implementation revision: `fe3b17f` + 未提交改动（Flutter 首页、测试与变更文档，工作区 dirty）
- Progress: 16/16 tasks complete；本轮完成重新打开的 1.2 与 5.2，待独立验证。

Apply 续接（2026-11-18 20:31，`fe3b17f` + 当前未提交改动）：OpenSpec 返回 `all_done`（16/16）。确认首页限高、日期工具栏和两种视口的回归已在当前工作区；未重复修改代码或任务，也未将以下既有 apply 检查当作本次重跑的结果。转入独立验证。

## Implementation Map

| Task / requirement / scenario | Code and tests | Decisions / context |
| ----------------------------- | -------------- | ------------------- |
| 1.1 五主页标记、日期标题、资料行、文案 | `lib/core/widgets/common.dart`（`PandoraPageMark`/`PandoraPage.titleWidget`）、`home_page.dart`、`task_calendar_page.dart`、`work_logs_page.dart`、`analytics_page.dart`、`destination_pages.dart`、`daily_items_day_page.dart`、`login_page.dart`、`profile_pages.dart`、`tag_manage_page.dart`、任务表单/详情/选人/动作文案 | 主页 AppBar 用标记替代可见页名，语义保留页名；二级页保留文字标题。`test/features/app_navigation_test.dart`、`page_chrome_test.dart` 覆盖五页、二级标题、每日事项仅日期、有无直属上级两种资料。 |
| 1.2 首页半屏、独立日历滚动与事件纪紧凑展开 | `lib/features/home/presentation/home_page.dart` 在 `SafeArea` 内、首页滚动视口外量高度；标题、日期工具栏与弹性日历合在一个限高区块，标题和工具栏只参与外层滚动。把「今天」与标题、加号同组，避免窄屏工具栏折成三行；日期格尺寸、日历锚点和事件纪实现不变。 | `test/features/home_web_parity_test.dart` 在真实导航壳与模拟安全区下覆盖 390×640 / 1.0 与 320×568 / 1.5：上滑到底量整个区块、内外滚动独立、从标题或「今天」下滑、上/下月、今天、年月选择器、新建、当天清单；保留恰好两行无箭头、长文独立展开和原文换行。 |
| 1.3 名称末字渐隐 | `lib/core/widgets/fading_name_text.dart`（`resolveNameFade`/`FadingNameText`）；接入月历条、日轴、清单、看板、首页任务预览、任务表单父任务、任务表单表格、每日事项条与当天列表 | 按字素边界只渐隐最后一个完整可见字素；`ShaderMask` 仅覆盖该字素；完整名称进入语义。`fading_name_test.dart` 覆盖字素/缩放/恰好容纳；`daily_calendar_web_parity_test.dart` 覆盖跨月条。日志正文不使用该组件。 |
| 2.1 通知申请中文与筛选空态 | `notifications/domain/notification_language.dart`；`notification_detail_page.dart` 用「申请：类型 · 结果」；`direct`→已生效、未知→任务申请/已处理；无权限/撤回不显示申请元数据与处理意见 | `notification_language_test.dart`（7 项）、`notification_list_test.dart`（服务端筛选/分页/空待审不合成行）。真实服务只读回归 `J28`：经理待审可审、无关账号空、历史申请不计待审、founder `direct` 消息。未重置 demo 库。 |
| 2.2 完成标准、负责人树、空标签 | `task_form_page.dart` 移除完成标准输入与提交分支、去掉空标签提示；`task_detail_page.dart` 移除常规完成标准段；`assignee_picker.dart` 去掉 320 限高与嵌套滚动，改为随外层 `Column` 展开 | `task_form_test.dart` 编辑场景验证不显示/不发送完成标准、移除最后标签传 `tagIds: []`、长树后末端字段可达；`assignee_picker_test.dart` 验证搜索、展开、无内层滚动、树高超过 320 且拖动滚动外层。DTO/审核历史仍保留字段。 |
| 2.3 任务详情层级、截止列、准确待审入口 | `task_detail_page.dart` 重组为标题/状态/紧凑元信息/说明/进展/父任务/评论；删除常驻审核段；`TaskRecord.pendingRequestId` 与 `deadlineText`；`task_table_page.dart` 「排期」→「截止时间」，显示有效截止 | `task_detail_layout_test.dart`（有效截止 vs 提议截止、全天口径、`查看当前申请` 精确 requestId、下属只读）、`task_table_ui_test.dart`（公司时区/全天/提议不覆盖）、`task_actions_web_parity_test.dart`（预览审核人与保存后实际审核人不同、回读失败仍按成功提示）。 |
| 2.4 审核详情默认变化与授权展开 | `approvals_pages.dart`：审核人默认显示服务端 diff；纯排序沿用「仅顺序变化」；有旧版空差异如实显示；无旧版直接展示完整提议且不显示空对比；可按授权展开完整提议/原有效版本；申请人仅看自身提议 | `approvals_ui_test.dart` 新增 5 项：无旧版、空差异+展开、申请人防御（载荷含旧版/差异也不显示）、审核人变化、只读来源。真实服务 `J30` 只读验证审核人拿到 diff/base/proposed、申请人无 diff/base。未增加读写接口。 |
| 3.1 日历锚点/日视图/清单 | `task_calendar_page.dart`：`_drawerDay` + `_dayViewMode` + `_monthReturn`；顶栏「日视图/返回月历」双向；清单内「日视图/清单」；关闭/返回 restored（`_restorePosition`）；不再把访问日写入 `calendar.lastDate` | `calendar_day_entrance_test.dart` 覆盖跨月定位直进、同日往返、关闭/返回恢复偏移、详情返回保留清单、本人/下属状态隔离。 |
| 3.2 官方休班标签 | `task_calendar_page.dart` 打开某日时加载该年节假日，`_DayPanel` 标题显示 `休/班 + 名称`；无记录不占位 | `calendar_day_holiday_test.dart` 覆盖休假、调班、普通日、跨年、2027 无年度数据、节假日 503 故障且任务/清单不阻塞。 |
| 3.3 完成删除线与待审虚线 | `task_calendar_page.dart`：月条/日轴/全天区/清单按 `task.pending` 画虚线（不再依赖有无提议）；完成名称加删除线并弱化；日轴拖拽在只读上下文禁用 | `calendar_status_style_test.dart` 覆盖月条/清单/日轴/全天区、待审有提议仅绘提议、无提议仍虚线、下属只读无拖拽/置顶。 |
| 3.4 可调周高与双指 | `task_calendar_page.dart`：`_weekHeight` 72–220、`_weekBarHeight/_weekLaneStep/_weekLaneCount` 重算轨道与 `+N`；`Listener` 双指手势、`AbsorbPointer`、锚点与偏好保存；`app_preferences.dart` 新增 `calendar.weekHeight`，兼容旧 `calendar.density` | `calendar_pinch_test.dart` 覆盖密集跨月拉开/收拢、`+N` 变化、锚点、单指滚动、短按、取消、双指不触发长按改期/写请求、本人与人员偏好隔离。设备已实测（见 5.2）。 |
| 4.1 日志筛选与三行预览 | `work_logs_page.dart` 单一「筛选」底部面板（应用/取消/清除，本地草稿）；`log_body_preview.dart` 三行 + 仅在确有非空正文隐藏时补省略号；冻结标记只看 `log.frozen` | `work_logs_ui_test.dart` 覆盖本人/下属筛选入口、应用/取消/清除请求、非冻结只读不冒充冻结、详情全文；`log_body_preview_test.dart` 覆盖恰好三行、显式第四行、第三行填满、软换行、字素边界、尾随空行。 |
| 4.2 日志保存回读 | 根因：服务端 PATCH `/work-logs/{id}` 只返回 `logId/rowVersion/businessDate`，`WorkLogsApi.change` 却按完整 `WorkLog` 解码，编辑器再把空正文结果传回详情，表现为保存后旧/空内容。修复：`work_logs_api.dart` 按信封解析并用提交值+基线拼出完整新版本；`work_logs_page.dart` 详情 `_loadGeneration` 防落后响应、保存结果立即应用后按版本重验；列表按单条 `_applySavedLog` 更新并保留分页/筛选/位置；详情 `PopScope` 返回最新日志。 | `work_log_freshness_test.dart`（真实路由：筛选+第二页+位置、详情/列表同版本、stale GET 不覆盖、失败保留草稿）；真实服务 `J32`（创建/编辑后 detail/list 均为新正文与同一 rowVersion，测试后清理或恢复）。**后端未改**：服务端最小信封是有意行为，证据是响应只含三字段。 |
| 4.3 评论键盘避让 | `comments_section.dart`：`AnimatedPadding(viewInsets.bottom)`、输入 `minLines 1/maxLines 4`、发送行最小高度、`scrollPadding` 与多行键盘类型；提交失败不清空 | `comments_keyboard_test.dart` 覆盖 320 高键盘 inset 下发送可达、输入不被压缩、长文保留、收起键盘草稿、失败保留/成功清空、下属有评论权限。设备实测见 5.2。 |
| 5.1 静态检查/组件/真实服务回归 | 见下方「Checks Run」 | 真实服务目标为本机 `pandora_demo` 演示库；组件/交互均为 `FakeBackend` 夹具。后端无改动。 |
| 5.2 Android 模拟器验收 | `output/flutter-client-2026-11-17/native/230-246` 号截图与无障碍坐标；旧证据 `201-215` 号 | 本轮用最终 APK 实测两档首页；其余按任务要求核对已有 Android 证据，不把组件或 Web 当设备测试。见下面复现步骤和证据边界。 |

## Checks Run This Session

| Command | Working directory / setup | Result / evidence |
| ------- | ------------------------- | ----------------- |
| `flutter analyze --no-pub` | `flutter/` | No issues found；`/tmp/refine-home-analyze.log`。 |
| `flutter test --no-pub test/features/home_web_parity_test.dart test/features/daily_calendar_web_parity_test.dart test/features/daily_items_ui_test.dart test/features/app_navigation_test.dart --reporter expanded` | `flutter/`，`FakeBackend` | 最终 19 项通过；`/tmp/refine-home-components.log`。前几轮先后修正了空安全类型、中文返回控件定位和窄屏大字下栏位分组。 |
| `flutter test --no-pub test/core test/features test/widget_test.dart --reporter expanded` | `flutter/`，夹具，不写入演示服务 | 231 项通过；`/tmp/refine-home-full-components.log`。本轮未重跑历史真实服务集成。 |
| `./tool/build_demo.sh`；`adb -s emulator-5554 install -r build/app/outputs/flutter-apk/app-debug.apk` | `flutter/`，离线缓存，现有 API 36 ARM64 模拟器和本机演示服务 | BUILD SUCCESSFUL（`/tmp/refine-home-build.log`），安装成功；最终 APK SHA256 `f2ebe315a4d9707f22650296bdf9b8b2afd585d60d51581fef14a7dac8df90d4`。 |

## Android Home Reproduction

使用 `emulator-5554`（`employee_api36`，API 36，密度 `480`）的演示登录态；无需录入手机号、密码或提交内容。不重置演示库，不保存新建事项。截图及坐标 JSON 由 `flutter/` 下 `python3 tool/native_acceptance.py snap <名称>` 产出，保存在本机忽略目录 `output/flutter-client-2026-11-17/native/`。坐标为物理像素。

| 档位 | 复现输入（`adb -s emulator-5554 shell input swipe` 参数） | 结果 |
| --- | --- | --- |
| 普通 390×640 / 1.0 (`wm size 1170x1920`) | 上滑到底 `300 720 300 305 420`，点「今天」；日历内 `630 1330 630 880 350`；从「今天」中心 `433 924 433 1370 420` 下滑 | `230`：内容 `y=240…1608`，区块 `y=852…1536`，`684/1368=50%`；`231`：日期向后翻，工具栏和卡片坐标不动；`232`：两张上方卡片恢复完整。 |
| 窄短 320×568 / 1.5 (`wm size 960x1704`) | `settings put system font_scale 1.5` 后重启 App；上滑到底 `275 710 275 300 420`，点「今天」；日历内 `420 1250 420 930 350`；从「今天」中心 `535 816 535 1280 420` 下滑 | `240`：内容 `y=240…1392`，区块 `y=744…1320`，`576/1152=50%`；`241`：可见日期变化、外层坐标不变；`242`：恢复事件纪及任务看板；`246`：「今天」后点击 11 月 18 日进入当天清单。 |

两档均点过「今天」、上月（到 10 月）、下月（回 11 月）、年月按钮（打开选择器后取消）和加号（打开新建后返回）；截图 `233–235` 和 `243–245`，未见横向溢出。测量取截图与无障碍边界，排除顶栏、底栏、安全区及区块外的 24 dp 尾部留白。结束时已恢复原 `960x1920`、密度 `480`、字体 `1.0`。

旧设备证据核对：`201` 有截断标题与状态的共存截图；`202–205` 和历史手势记录提供本人密度变化、下属日程及返回路径，其中 `205` 是下属拉开后的单帧，不单凭该图推断手势过程。`210–212`、`215` 对应真实键盘、日志发送与任务评论区；`214` 可见保存后的合成测试标记，历史记录报告详情也回读成功，但 `213` 停在评论区，不能从该截图独立读到正文。本轮未重复写日志或评论；需要完整详情画面时，独立验证可在隔离样例上补拍。

## Historical Checks (2026-11-18, Prior Session)

| Command | Working directory / setup | Result / evidence | Run time or revision |
| ------- | ------------------------- | ----------------- | -------------------- |
| `flutter analyze --no-pub` | `flutter/`，Flutter 3.47.9 | **No issues found!**（2.1s）`/tmp/final_analyze.log` | 2026-11-18 19:38 |
| `flutter test --no-pub test/core test/features test/widget_test.dart --reporter compact` | `flutter/`，FakeBackend 夹具 | **230 passed**，无失败；`/tmp/final_components.log` | 2026-11-18 19:38 |
| `flutter test --no-pub test/integration/real_backend_test.dart --reporter compact` | `flutter/`，真实本机演示服务 `http://127.0.0.1:8080`（`pandora_demo`，启动方式 `backend/scripts/start-demo.sh --keep`） | **32 passed，无 skip**，含 J28/J30/J32；`/tmp/final_real.log` | 2026-11-18 19:38 |
| `./tool/build_demo.sh` | `flutter/`，离线缓存 | **BUILD SUCCESSFUL**；APK `build/app/outputs/flutter-apk/app-debug.apk`，SHA256 `717e0e58…59ed2`（221,668,361 bytes） | 2026-11-18 19:30 |
| `adb -s emulator-5554 install -r build/app/outputs/flutter-apk/app-debug.apk` + `am start …MainActivity` | `flutter/`，API36 ARM64 模拟器 320×640（960×1920 override / density 480） | 安装成功、真实 demo 登录态进入首页；截图 200–215 | 2026-11-18 19:31–19:38 |
| `settings put system font_scale 1.5` + 重启 App；`python3 tool/native_acceptance.py snap …` | 同上 | 200 首页工具栏换行无黄黑条；201 月条末字渐隐；205 下属日历；退出前恢复 1.0 | 2026-11-18 19:31–19:37 |
| MT-B 双指注入（`sendevent /dev/input/event1` ABS_MT_SLOT/TRACKING_ID/POSITION） | 同上，`adb root` 后注入；人工查看 UI 树/截图 | 本人 203 拉开后 `+2` 消失、204 收拢后 `+2/+3` 回来且未开清单；205 下属拉开/返回月历/日视图均正常；偏好写入 `calendar.weekHeight=72.0`（账号隔离） | 2026-11-18 19:33–19:35 |
| 设备真实软键盘：日志详情评论、任务详情评论 | 同上；`settings put secure show_ime_with_hard_keyboard 1` | 210 日志、215 任务：键盘弹出后输入框与发送按钮完整位于键盘上方；211 输入 `real-keyboard-check`，212 发送成功计数变为 1，输入清空。任务评论仅聚焦未发送，避免污染 demo。 | 2026-11-18 19:36–19:38 |
| 设备日志保存回读 | 同上，字体 1.5 | 当时记录编辑并保存 `[mobile-check]` 后详情、列表回读成功；214 可见新正文，213 未拍到正文。历史记录注明用 API 恢复原文并删除临时评论。 | 2026-11-18 19:37 |

## Verification Reminders

- **真实服务数据依赖**：`J28`/`J30` 的断言依赖当前 `pandora_demo` 种子（经理有待审、founder 有 `direct`、申请人有历史 `change`）。若演示库被重建或账号权限变化，需重跑并核对，不要把它当成固定产品数据。
- **`J32` 会写入并清理/恢复日志**：优先创建到空闲日期；若无空闲日期会临时改一条已有日志再恢复。验证者应在运行后确认 demo 库无残留测试正文/评论。
- **双指设备证据为注入手势**：模拟器通过 `adb root` + Linux MT-B `sendevent` 注入两指，不是物理手指；已走 Android 输入与 Flutter 手势管线。未覆盖真机、API26 第二版本与厂商 ROM。任务评论键盘在 1.0 字体、日志评论在 1.5 字体实测；长文换行仅组件测试（adb `input text` 不便输入换行）。
- **模拟器偏好副作用**：柏拉图账号的 `calendar.weekHeight` 被手势写成 `72.0`（`calendar.density=compact`）；字体已恢复 1.0，`show_ime_with_hard_keyboard` 已恢复 0。若后续演示希望回到默认 86，可在日历双指拉开或清除该账号偏好。
- **日志保存链路的关键假设**：客户端把最小 PATCH 信封与提交值合成新版本；若服务端以后返回完整 `WorkLog`，当前解析仍兼容（优先使用响应 `logId/rowVersion/businessDate`，正文用提交值）。列表单条更新按 `rowVersion` 丢弃旧响应；若服务端出现同版本不同正文，客户端会保留较新的本地值，需服务契约保证版本递增。
- **`_withinAuthorScope`** 对本人用当前账号、对下属用 `authorId` 过滤；构造的已保存日志沿用基线作者。未专门模拟服务端返回跨作者异常的界面场景（组件测试覆盖版本/代次守卫）。
- **日视图入口锚点**：顶栏直进取“最上方可见日”（含部分可见行），设备一次实测从 2026-11-09 进入；若验收期望严格从整行首日进入，需要与设计确认，当前实现与既有 `_position()` 保存口径一致。
- **本轮范围**：最终 APK 的设备实测是首页；其余为旧设备证据核对。未覆盖第二 Android 版本、真机软键盘/手势、远端 HTTP 服务器连通、真实振感、release 签名与 HTTPS；不能由组件或单台模拟器结果替代。
- 本次未改 `verification.md`，未声明独立 e13 验证结论；上述均为 apply 证据。
