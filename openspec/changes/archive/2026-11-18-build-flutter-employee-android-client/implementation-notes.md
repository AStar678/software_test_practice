# Implementation Notes

- Change: `build-flutter-employee-android-client`; schema `spec-driven`; store: local repository.
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice/flutter`；共享服务和 Web 位于仓库根。
- Updated: 2026-11-17；revision `738dd520c9d6d8457c54e79567a99f1370cc6da2` + dirty worktree，未提交。本文为 apply 交接，不是独立 PASS，不修改 verification.md 或归档。
- 当前范围：按用户决定全部业务跟当前 Web；本地真实服务、自动测试、一台已有模拟器及可安装 debug APK。HTTP服务器可配置；远程部署/手机、证书/专用release签名、第二系统/厂商/真实振感、生产运维演练移交后续，不当作通过或当前阻塞。
- Progress: **66/66任务已完成**（apply完成，待独立e13验证）；见 [tasks.md](tasks.md)；逐旅程证据见 [acceptance-index.md](acceptance-index.md)。以前的实施快照移到 [implementation-history.md](implementation-history.md)，其中环境、旧门槛、待做项均被本文明确替代，历史测试不算本次运行。

## A、当前主规格及共享 delta 核对（1.1）

A 已归档至 `openspec/changes/archive/2026-11-09-prepare-employee-client-contracts-and-business-upgrade/`；独立报告记录 PASS，时间 `2026-11-09T22:46:00+08:00`，revision `36d15b6` 加主规格同步。A 的128 Maven、307契约（含V31→V35）、37节假日、33浏览器、130极限及迁移/备份恢复为**已归档依赖证据**，本次不重做生产演练、不冒充当前 Flutter 验证。

本次已读取归档验证和交接、现行主规格、`backend/docs/employee-client-contracts.md`、接口样例/错误、账号生命周期邮箱修订、当前服务 DTO/能力及 B 两份 delta。逐块结构与正文差异记录在 `output/flutter-client-2026-11-17/shared-delta-audit.json`；全部15个 MODIFIED 标题存在，无现有场景标题被删。正文核对结论：

| 共享 MODIFIED 组 | 与现行主规格的差异结论 |
| --- | --- |
| Five-page navigation / Three-module home | 增加 Flutter 载体和原生返回；保留Web五页、三卡、正文事件纪及服务排序；无标题回退 |
| Vertical continuous daily-item calendar / Daily-item span labels and status | 保留现行纵向/三轨/实际日命中、三态；增加Flutter长按整条改期和原生适配，未复活已退役横向/计数标记目标 |
| Minimal profile page / Strict prototype scope | 承接A入职/时长/邮箱可见范围；加入Flutter，保留真实职务路径与最小资料，无移动管理员 |
| Notification list layout | 六类×三读态、单模式按钮和稳定框体保留，Flutter原生窄屏适配 |
| Hierarchical subordinate browsing / Subordinate calendar | 真实管理链及只读上下文保留；连续人员日历、三轨/溢出/嵌套返回适配 |
| Calendar drag interaction / Daily-item whole-range movement | 任务审批调时与私有事项直接改期分开；500ms、取消、绝对目标、版本/幂等和日轴边界均保留 |
| Personal work logs / Body-only company chronicles | 所属日排序/卡片日期、只消费正文、独立展开；Flutter保留主动填充超限无损预览 |
| Independent task table pin / Flat task and work-log comments | 两种置顶独立、整行蓝底；按当前Web移除员工删除评论入口，服务删除及撤权安全不删 |

其余契约无未兑现依赖：范围事项日期对/93天和nextOffset；任务通用cursor、表单offset、评论ID游标不混用；table全量服务过滤/排序/分页，两种pin互不写任务版本；日志fill-source按所属日，Java trim U+0000–0020、UTF-16 10000上限；中文名称采用服务固定Collator顺序（数字按文本、规范等价后ID），不按设备语言重排；hireDate/tenure/asOfDate直接消费服务，邮箱只在本人/实际授权链详情，不进摘要/候选；年度节假日ready/stale/missing不预测；审批/通知/历史授权均沿现行服务。未提前同步B到主规格。

## Web 来源矩阵（1.2 / 12.1）

Web基线 `8625617`；当前HEAD `738dd52` 对相关最终HTML/JS/CSS/WorkspaceService无变更。入口 `index.html` → `潘多拉-交互原型.html`。JS最终加载为：原型 → API → 任务接入 → 工作区接入 → 日程视图 → 任务表单 → 个人资料 → 标签评论 → 每日事项。CSS：原型 → 界面调整 → 生产 → 日历 → 表单 → 手账主题 → 每日事项。均追到最后覆盖层；没有读取/参考/修改根目录旧Android工程。

| 模块/最终来源（根目录） | 实际Web行为 | Flutter落点（lib/下） | 差异结论 / 验证 |
| --- | --- | --- | --- |
| `潘多拉-api.js` clearData/sessionReset/epoch/request；HTML导航 | 账号代次隔离、迟到响应丢弃、加载/空/错分开 | core/session、net、router；auth/shell | 明确平台适配：安全凭证存储、原生路由/系统返回；session/account/navigation测试，真实四角色/重置，native30–38 |
| 工作区 `homeCompanyPreview/homeChronicleHTML/openHomeList` | body-only两行预览、清单按ID独立展开，卡片先到清单 | home/domain/home_data.dart、home_page/home_lists/home_copy | 已一致；home_web_parity、真实home、320/390Chrome与模拟器 |
| 工作区 `homeItemOverdue/homeTaskRowHTML`、WorkspaceService.home | 截止/紧急度/ID服务全局取10；只清单严格逾期红底 | home同上 | 已一致；72 API断言、home组件、同账号Web ID顺序/颜色 |
| 每日事项 `weekSegments/barHTML/overflowHTML/anchorFromDom`、最终CSS | 两周、纵向双向补载、三条高轨、实际列+n、按结束日三态 | daily_items/domain/month_layout、daily_items_calendar/day_page | 已一致；daily_calendar_web_parity、真实区间/隐私/极限；原Web today检查有现存锚点失败，未照搬 |
| 每日事项pointer/drag/drop | 500ms整条改期，完成也可，确认绝对目标，取消不写 | daily_items_calendar、daily_items_providers/data | 已一致；组件触觉/取消/冲突/账号、真实同键绝对改期，native/Web同ID回读记录 |
| 任务接入 `actionView/openAction`；候选/父任务/任务详情与最终标签覆盖 | 实际角色默认、有序负责人、隐藏父项保留、字段权限、原来源 | tasks task_form/detail、tasks_api、task_record | 已一致；form/actions、真实审批204、接管87、父子/资格共享服务检查 |
| 任务接入 progress/complete/reopenSchedule | 自动申请人审核预览、实际保存结果；重开完整排期+有序负责人 | task_review、task_action_pages | 已一致；普通闭环真实测试+临时服务停用接管后重开/拒绝保原版 |
| 任务接入 handoverOwners/openHandoverSheet/refreshHandoverPreview；审批diff/withdraw | 授权来源和有序位置替换、预设资格、实际审核人；仅当前审核人完整diff | tasks actions/review、approvals | 已一致；7 actions组件、真实有序交接、四层Flutter管理联调、routing204，无缺上级兜底 |
| 日程视图month hit/day projection/drag、最终calendar CSS | 实际日、三轨、溢出、连续月；横纵轴各自全天布局、当日边界 | schedule/task_calendar_page、schedule_confirmation、calendar_drag/day_axis domains | 明确平台适配：42%原生抽屉、长按/可访问动作；修复下属/完成/待审条短按无响应，新增3反例；calendar/axis/drag测试及native |
| 任务表单 `P.taskForm`、`.is-table-pinned > th/td` | 服务过滤/排序50分页；固定名列+横滚；整行蓝底 | tasks/task_table_page | 已一致；table组件/真实分页pin、极限>100、320/390Web与320native/font150 |
| 工作区日志 filters/cards/create/edit/fill-source；最终tags覆盖 | businessDate日期/顺序，独立详情createdAt；一天唯一/首次24h冻结；主动填充 | work_logs pages/API/domain/fill、tags | 已一致；卡片日期修成“年/月/日”，header改Wrap；组件UTF16长源无损+真实日志/填充/评论；native只读嵌套 |
| 标签评论目录/ordered snapshot/comment cursor最终覆盖 | 创始人目录、有序标签快照；平铺评论发表/本人编辑，无员工删除 | tags、comments/data/comments_api、comments_section | 已一致；tags/comments组件和真实目录/通知49/路由；旧DELETE动作不发送，服务删除仅用于测试清理 |
| 个人资料 tenureText/renderMe/person card/tree/avatar draft | 入职字段一次、不显示截至；授权链详情，系统/预设头像草稿 | profile pages/providers/avatar_processor、people | 明确平台适配：系统picker与256JPEG；4新增取消/拒绝/失败/10MB测试、临时服务图像原子边界、API36系统选图取消/成功 |
| 工作区 notifications filter/list/open/history +最终样式 | 类型上/读态下、六×三/单按钮、稳定可用高度；分开消息/申请/对象授权 | notifications、history routes | 已一致；18组合真实分页、原申请/179与180秒/撤权49共享检查；组件多/单/空/错/frame；320/390Chrome |
| 工作区 `renderAI/createAnalysis` | 自动role范围、进入/刷新重算、真实分布/词云/本地规则来源 | analytics page/models/api | 已一致；四角色真实统计/建议；按用户明确舍弃额外筛选/仅本人切换，见function-decisions |
| 日程年度holiday loader / session&year guards | ready/stale/missing，不阻塞任务、不预测未知年 | holidays provider/API、本人/下属calendar | 已一致；年度组件/API和A来源校验证据；native看到stale缓存说明 |
| start-demo --keep、PC管理API、A归档 | 稳定真实四角色和隔离极限数据；管理联动而非移动管理 | tool/check_demo_readback、managed_backend、Android宿主 | 课程范围适配；临时服务5项、routing204/takeover87/extremes130/notifications49，原迁移仅引用A |

## 当前真实环境与安全复现

- Flutter3.47.9/Dart3.13.7、JDK21、Gradle9.3.1、SDK36/build-tools36.0.0；min26/target36。当前仅验收 `employee_api36`，`emulator-5554`，API36 ARM64，320×640；font_scale放大1.5后恢复1.0。
- 宿主API `http://127.0.0.1:8080/api/v1`；模拟器 `http://10.0.2.2:8080/api/v1`。安全保留启动：`cd backend && ./scripts/start-demo.sh --keep`；裸脚本会清演示库，禁止用作普通启动。本轮未重置/重启常用后端。
- 四角色 upper13800000001苏景昕 → middle13800000002苏格拉底 → product-head-1 13800000011柏拉图 → employee13800000004亚里士多德，真实管理链。密码仅演示外部配置（PANDORA_DEMO_PASSWORD），不在lib/或APK资产。
- `tool/check_managed_backend.py` 使用fixed_model_fixture拥有的随机库/JAR18295，仅清自己库；routing/takeover/extremes/notifications同样使用独立夹具，不灌入稳定演示库。
- 四角色稳定有意义任务12/16/16/20（原始负责总数12/16/20/24，团队/员工各含4条旧联调任务，未删除或清库）；每人3日志和真实事项/通知。manifest ID与当前回读见demo-current.json，保留跨部门合作任务及已有更改。单/无/多标签由详情和真实演示/极限夹具检查，不从不含tags的表单摘要推断无标签。

## 本轮实际检查及证据

原始输出目录 `output/flutter-client-2026-11-17/`，本机保留、不提交大文件。执行命令从仓库根，注明flutter/者除外。

| 命令/检查 | 结果与可定位证据 |
| --- | --- |
| `cd flutter && flutter analyze --no-pub` | No issues found，3.0s；`/tmp/pandora-course-analyze.log`（另复制本机output/checks） |
| `cd flutter && flutter test --no-pub --reporter expanded` | **196 passed，含29真实演示API、无skip**；`/tmp/pandora-course-all-tests.log`。本轮新增非拖条命中3项、头像4项、HTTP配置2项；覆盖完整当前改动 |
| `python3 flutter/tool/check_managed_backend.py` | **5真实Flutter管理联调通过**；managed/flutter-tests.log、service.log。四层审核；入职闰日/转组改派/旧上级失权/密码reset受限改密；正式停用接管后重开有序替换、拒绝保原版；图像API原子边界 |
| `python3 backend/scripts/check_review_routing.py` | **204 checks/0 fail**；`output/task-creation-refinement/review-routing.json`，含缺/停用上级、四层、diff受众、冻结、截止、改派、提醒节点 |
| `check_business_takeover.main()`（Python导入后OUTPUT重定向） | **87/0 fail**；takeover.json，命令记录在acceptance-index。保创建来源/正式接管/失权 |
| `check_demo_extremes.main()`（导入后AUDIT重定向） | **130/0 fail**；extremes/，>100任务/事项、六重叠/全天/午夜/跨年/点任务/隐私 |
| `check_fixed_notifications.main()`（导入后OUTPUT重定向） | **49/0 fail**；notifications.json，评论删除/撤权、历史安全、标读/隐藏、179/180秒、审计保留 |
| `check_employee_contracts_upgrade --skip-witness`（导入后AUDIT重定向，参数见acceptance-index） | **329/0 fail**；contracts/employee-contracts-check.json，含daily/table/fill/hire及真实Chrome管理页；跳过迁移/备份见证 |
| 当前daily/home独立API检查 | **72断言通过**；current-daily-home-api.json；`/tmp/pandora-current-daily-api-20261117.log` |
| `node flutter/tool/check_web_parity.cjs` | **25检查通过**；web-parity/report.json和320/390截图；真实同founder、同源正文/board/table IDs，原生证据分列 |
| `python3 flutter/tool/check_demo_readback.py` | 四角色只读检查通过；demo-current.json，不seed/reset |
| `PANDORA_DEMO_API_URL=http://192.0.2.10:8080/api/v1 ./tool/build_demo.sh`（flutter/） | 离线BUILD SUCCESSFUL 13s；生成XML精确域192.0.2.10，Dart define相同；示例地址不声称远程连通 |
| `./tool/build_demo.sh`（flutter/，恢复默认地址） | 离线BUILD SUCCESSFUL 7s；最终本地APK；/tmp/pandora-course-build.log。--offline及sdkDownload=false，不新增依赖下载 |
| aapt/apksigner/shasum + adb install -r /am start | debug自动签名有效，包/SDK/ABI/哈希如下；API36安装/真实登录/进程恢复/账号切换截图native/ |
| OpenSpec strict validation / diff whitespace | 2026-11-17 strict valid 1/1、无issues；git diff --check通过；只检查规划/文本，不替代业务验收 |

## APK交付

`flutter/build/app/outputs/flutter-apk/app-debug.apk`，**181518468 bytes**；package `cn.pandora.employee.flutter.debug`，versionCode1、versionName1.0.0-dev，min26/target&compile36。Dart/Flutter运行库ARM64（插件还含其他架构库，不能据此称完整多ABI）。签名DN Android Debug，证书SHA256 `94e4b2b9207d1666f352b9ea37c1bb3eaa4ecbd5907adaab41c7daebf2900298`。

APK SHA256：`fc01cfe0fa2aeb6bf03414549b5dd2bf782be2e142858beba8a0be7fa389ed5e`。默认HTTP主机10.0.2.2，清除其他明文例外、HTTPS系统校验保留。没有导入旧应用凭证，外部release私钥不读不写。安装/换服务器/回退步骤见flutter/README.md。

## 模拟器证据及验证提醒

步骤见 `flutter/tool/native-acceptance.md`；辅助脚本 `native_acceptance.py`，只读dump和截图不保存密码字段。

- native01–18：真实登录五页、API36系统照片选择取消/成功（256JPEG预览，退出编辑不上传）；真实下属树→资料→三轨日历→实际日42%抽屉→只读任务→原人；下属空日志。
- native19–21：本人长按预览→新旧排期和必填原因确认→取消不写。native22边缘尝试只作过程记录；native23是launcher，**不是有效后台取消证据**，不能引用为通过。
- native25–28：320×640、字体1.5，月历/表单及键盘返回；系统返回先隐藏键盘，保留表单。
- native30–35：前后台重验、杀进程恢复；wifi/data关闭启动不显示旧正文、只显示联网验证重试；恢复网络重试成功；最终APK安装后恢复。
- native36–38：退出确认清路由，employee真实登录仅自己的资料，再切founder；没有旧姓名/邮箱残留。
- native39–42：亚里士多德3条只读日志→正文/评论→返回原列表→原人资料/连续日历，卡片所属日改为中文年月日。
- native后续条命中、边缘/日轴、临时事项保存/同IDWeb回读见补充记录与acceptance-index；未采集的不能用截图名推断通过。

失败/修正诚实记录：早期Web整套检查在390px today锚点处失败并终止，不能称整套Web通过；本次独立25项可重现检查通过，Flutter锚点已用组件覆盖。最初新管理测试放integration_test目录误触设备构建/环境缺失，已移tool/tests作为宿主机测试并通过，最终扩展5项全部通过，之后全部Android构建用offline入口。旧头像测试ProviderScope/fakeasync及Gradle生成资源依赖错误已修正，最终相应检查通过。真实设备振感/厂商权限未测；API36系统picker没有稳定可制造的权限拒绝提示，拒绝由注入适配组件覆盖。

归档前仍需独立 `$openspec-e13-verify-change build-flutter-employee-android-client`；本轮不修改验证报告、不自判PASS、不归档。后续服务器部署、实际HTTP地址手机安装/网络验证由使用者/组员负责，无HTTPS地址无需再询问。

最终补充：M临时服务父子真实检查曾因检查请求误用reason/note失败，已按现有完成接口completionNote纠正，最终5项全部通过。静态分析随后发现新增测试的null-aware风格提示，已改为map值的`?parent`，最终No issues found。该测试修正没有改变产品行为；之后另修复下面的资料卡滚动并重建最终APK。

Native最终补充：43-subordinate-bar-actual-thursday确认修复后跨日条点击Nov19（中段）到真实日清单；45-subordinate-vertical-axis含完整全天清单。48-final-native-edge-scroll为跨年预览，49为取消后恢复；53单日9–17拖动到10–18并取消，55合法移至00–08（没有因为指针出视口误判为业务越界），56超出00:00后不弹确认、不写；58通知font150。所有真实排期预览均取消，只有自有临时事项保存且已按ID清理。

最终原生复测（11.2/11.5）：V53日轴09:00–17:00按小时移动至10:00–18:00，确认后取消；V55合法00:00–08:00可确认并取消，V56超出当日午夜无确认/写入。V58大字通知；V59编辑对话框可见。大字资料卡内部滑动曾被嵌套ListView截住，修为嵌入SelfProfileCard时禁内层滚动（独立人员资料仍可滚）；新增320×640/1.5回归，完整测试最终**196项通过/29真实无skip**、静态分析无问题。最终APK离线7s重建，哈希更新为上文fc01…ed5e；V60/61为新包大字卡内滚动/编辑复测，结束恢复字体1.0。

## 2026-11-17 第二轮验收修正（本次 apply 增量）

用户给出的 0–20 项模拟器反馈已纳入 tasks 13。实现以当前 Web 的接口语义和原生 Android 的任务表单信息层级为参照：日程新建限制过去日期，点击日期改为全屏日页面且默认日轴；任务表单改为统一整行列表和单一筛选入口；首页、事件纪、看板、每日事项、评论、日志、标签、资料文案及下属标签实色均完成对应修正。任务详情原有标签展示保留，交接入口和路由移除，但后端历史申请的只读解析能力保留，避免破坏旧通知/审核记录。

本轮在独立最新 main worktree、分支 `codex/flutter-acceptance-fixes` 实施，未改动用户原 dirty worktree。检查结果：`flutter analyze --no-pub` 无问题；排除需要外部真实账号的 integration 目录后，`flutter test --no-pub test/core test/features test/widget_test.dart --reporter compact` 为 **167 passed**。首次完整 `flutter test` 的产品/组件用例全部通过，额外真实集成因旧隔离库密码不匹配返回 `401 BAD_CREDENTIALS`；随后保留旧库，新建 `pandora_codex_acceptance_20261117_2240` 演示库并确认 `13800000001 / 111` 登录成功，Flutter `real_backend_test.dart` 的 `J01 普通员工真实登录与会话` 也通过。本文仍是 apply 交接，不修改 `verification.md`，不自行声明独立 e13 PASS。
