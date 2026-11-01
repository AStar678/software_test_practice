# Implementation Notes

- Change: fix-hourly-schedule-drag-and-log-type
- Schema: spec-driven; Store: local
- Project root: /Users/aoxiang/Desktop/软件测试
- Updated: 2026-11-01 (Asia/Shanghai)
- Revision: ed9a331ffd9e0ffd35620fb70582ede885a0e9d5，工作区未提交。本轮由用户明确要求单独建立变更，已上线的三个变更仍保持原范围。
- Progress: 13/13实施完成（含2026-11-01统一任务框追加）；本记录为实施交接，不是独立验证结论。仅更新本地测试版，未同步Git/未发布云端；按原要求不做手机真机测试。

## Implementation map

| 任务/场景 | 实现与测试 |
| --- | --- |
| 1.1 日志阅读字号 | 工作区接入.js为实际列表和详情p添加p-log-reading类，手账主题.css共享15px与1.55行高，staff摘要同变量。subordinate fixture新增本人长日志，浏览器实际比较320/390/1440本人和下属字号/行高，详情15px与评论流程保持 |
| 2.1 月/横轴小时步长 | 日程视图.js proposedRange统一每步3600000ms相对调整，保留分钟；月历每12px一小时，横轴按真实60px/小时比例。手柄起/止标记与命中区调整，document捕获move/up/cancel作为setPointerCapture失败回退，取消/点击抑制延用审核确认 |
| 2.2 纵轴与边界 | axisEventHTML改为可聚焦group及独立起止按钮，真实端点才可拖，纵向位移按小时，点任务最小命中高度48px且真实时段不改。补Enter/Space任务详情和方向键调时。专项验证鼠标/触摸、捕获失败、取消、跨日/跨年、分钟20保持、点任务、旧版本/审核/无权/冻结及实际保存 |
| 3.1 集成与说明 | backend/docs/hourly-schedule-drag.md；最终打包后更新原8080演示预览，保留数据库，核对4份修改资源SHA256与源文件相同 |

## Checks actually run

工作目录均为项目根目录。CHROME_BIN=/Users/aoxiang/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing。

| 命令 | 结果/证据 |
| --- | --- |
| python3 backend/scripts/build_refinement_verification.py | 最终成功，111单元测试0失败/错误/跳过；output/hourly-drag-build.log。临时POM仅排除既有* 2.java副本，不删除用户文件 |
| CHROME_BIN=… python3 backend/scripts/check_schedule_drag.py | 最终90项真实浏览器检查通过；output/hourly-drag-check.log、output/task-schedule/browser-report.json。鼠标/触摸/键盘，月历和横/纵日轴1小时，分钟保留、跨年、Pointer捕获失败、纵轴实际保存/取消/详情键盘及原审核/重开边界 |
| CHROME_BIN=… python3 backend/scripts/check_subordinate_workspace.py | 最终61项通过；output/hourly-font-check.log、output/subordinate-workspace/browser-report.json。本人/下属真实字体/行高、长日志与详情，原组织/日志/日历/权限/旧响应回归 |
| JS/Python语法、git diff --check、openspec validate fix-hourly-schedule-drag-and-log-type --strict | 通过 |
| 本地预览健康及资源hash | 200，日程JS/工作区JS/日历CSS/主题CSS与源码一致，数据库保留 |

已人工查看vertical-hour-390.png、self-reading-390/1440.png；另有320、390、1440纵轴/日志截图。时间轴起止手柄清楚，正文15px/行高23.25px，无横溢；短暂提示可能出现在截图底部，未影响字体测量。

失败/修复记录：日志与拖动首次并行运行时日志fixture因本机MySQL连接数上限启动失败，未改业务代码或调大数据库限制；改为先完成拖动再串行字体验证后通过。初轮拖动89项通过，之后为纵轴wrapper补回Enter/Space打开详情，最终90项复跑通过。没有把环境失败或旧结果当作最终通过。

## Verification reminders

- 单独复核实际目标浏览器的鼠标/触摸捕获、离开手柄释放、滚动和点击抑制；fallback故意抛DOMException用真实指针事件完成保存，不依赖合成click。
- 月历小时调整使用明确12px一步，月格宽度仍按天，不声称月格可精确以小时比例绘图；完整起止预览和确认字段提供准确值。
- 只有业务基础编辑者可调时，单纯负责人不获额外权限；松开仍需原因/提交，待审前有效排期不变。
- 纵轴短任务扩大的是命中区域，p-axis-true仍按真实起止定位；跨日被裁剪续接端不显示假手柄。
- 依赖已上线版本ed9a331，共用原专项脚本和脏工作区。旧变更月历按天/横轴15分钟要求是历史，本变更按用户最新要求改为小时。
- 本轮未上线、未推送Git、未进行独立验证/归档，未使用手机测试。

## 2026-11-01 用户要求拖动专项复测

- 使用当前JAR重新运行真实Chrome隔离测试，先复跑原90项通过，再补充320/390宽度月历触摸截止端点+1小时、确认提交、实际持久化和起始时间不变检查；最终102项全部通过，浏览器异常0。证据：output/hourly-drag-recheck.log、output/task-schedule/browser-report.json、month-touch-320/390.png。
- 已人工检查月历320、横轴1440及纵轴390/1440截图，检查原320/390/1440适配断言；遵从要求未进行手机真机测试。
- 补测初次误选被月历“更多”折叠的隐藏任务，导致无确认窗口；测试助手现拒绝零尺寸手柄，改用实际可见任务后完整复跑102项通过。本次没有修改产品拖动代码。
- 运行环境首次受限无法连接本机MySQL，经允许本机服务访问后完成；临时测试数据库由fixture自动清理。8080预览health=200，拖动JS和日历CSS的HTTP内容SHA256与本地源码一致。
- 仍为本地版本专项测试记录；未发布云端、未推送Git、未进行独立验证或归档。

## 2026-11-01 待审虚线与提案位置

用户确认继续纳入当前变更，追加4.1—4.3已完成；合计7/7。当前HEAD仍ed9a331，工作区未提交；本轮仅更新本地预览，未发布云端或推送Git，未进行独立验证/归档。

| 追加任务 | 实现 / 决定 |
| --- | --- |
| 4.1 | TaskService.taskView为授权已发布任务增加pendingSchedule五个最小排期字段，不包含提案正文/负责人。批量预取待审版本，calendarPreview=true仅调整日期过滤依据，仍使用原任务/原负责人授权；普通任务查询与统计的有效字段保持原值。无数据库迁移 |
| 4.2 | api.js的calendarTask创建展示副本，不修改TASKS。本人viewTasks和下属读取投影至申请排期；月历、横向轴、纵向真实时段、全天区及当天清单按frozen使用虚线/淡底与审核提示，标签颜色保留。详情仍说明有效版本，未发布申请不进入任务列表 |
| 4.3 | 扩充check_schedule_drag真实浏览器流程，验证真实拖动待审后重登、提案不修改有效字段、跨年跨月新位置唯一、下属月/日/清单、访问权限、进展/完成/重开/交接待审以及通过/驳回/撤回/失效后的恢复。手动检查pending-day-320、pending-month-390/1440、pending-staff-day截图。原61项下属工作区及111单元回归通过；更新原8080并核对5份资源hash一致 |

本轮实际检查（项目根目录，CHROME_BIN沿用前述Google Chrome for Testing）：

- python3 backend/scripts/build_refinement_verification.py：111 tests，0 failures/errors/skipped；output/pending-calendar-build.log及surefire-reports。
- CHROME_BIN=… python3 backend/scripts/check_schedule_drag.py：最终135项通过，浏览器异常0；output/pending-calendar-check.log、output/task-schedule/browser-report.json，含320/390/1440截图。fixture专用受控时钟推进只用于失效回退检查，不改变系统时钟或预览数据。
- CHROME_BIN=… python3 backend/scripts/check_subordinate_workspace.py：61项通过，异常0；output/pending-calendar-staff-check.log、output/subordinate-workspace/browser-report.json。
- JS语法、git diff --check、openspec validate fix-hourly-schedule-drag-and-log-type --strict：通过。
- 原演示DB未重建/重种；service.py仅重启backend，health=200，API/日程/个人资料JS及日历/主题CSS与源码SHA256相同。

失败记录：首轮新增审核用例将requestView响应的requestId误作id，提交到了undefined路径，被后端拒绝；修正测试使用任务上的pendingRequestId，并修正动作载荷后，最终135项完整复跑通过。无产品逻辑为通过测试而放宽权限。原先“有效排期不变”指实际生效数据，本轮日历显示改为提案位置，此记录及更新后spec优先于旧截图/说明。

独立验证提醒：核查待审排期只出现在日程展示副本；普通详情/提醒/统计仍用有效排期。特别复核跨月范围、已完成任务重开待审、交接待审仍按有效负责人授权、无权人员不能由calendarPreview获得任务。审核终态刷新后不残留pendingSchedule。待审区域不可再次调时；未进行手机真机测试。

## 2026-11-01 可见任务排期与月历小时比例

用户确认纳入当前变更，并明确保留审核中锁定、已完成先重开的边界。追加5.1—5.3已完成，总计10/10；HEAD仍ed9a331，工作区未提交，仍仅本地交付，未独立验证/归档/发布云端/推送Git。

| 任务 | 最终实现与验证定位 |
| --- | --- |
| 5.1 | TaskService新增reschedule命令，仅允许SCHEDULE_FIELDS及reason；存为原change审核。validateRequestActor的提案重载在提交和生效时比较非排期字段/标签快照/负责人不变，并重新校验canSeeTask。普通change资料修改仍要求业务责任方。preview reschedule按实际操作者上级；canReschedule只授予已发布非待审未完成任务。任务接入.js有独立schedule草稿/表单/最小提交载荷；原编辑任务权限不变 |
| 5.2 | monthWeek计算left/width比例，以公司业务日边界裁剪；月历真实彩色时段层独立于标题和命中区，非点任务不强制最小宽度，点任务才用2px标记。本人标题可按日格宽度/24换算小时平移，真实起止手柄按小时变更，续接段有“调时”精确入口；下属月历共享比例及授权调时按钮，新增div容器补回Enter/Space详情交互 |
| 5.3 | 下述所有最终检查通过；手工查看partial-month-390/1440、subordinate-workspace/month-390截图；重启原8080，演示DB不重建/不重种，6份HTTP资源SHA256匹配源码。用原公开演示账号只读核对截图中的分页事项040、008及完成后已重开均canReschedule=true，不改业务数据 |

本轮实际命令（项目根目录，CHROME_BIN使用前述Google Chrome for Testing；先串行完成各fixture避免本机连接上限）：

- python3 backend/scripts/build_refinement_verification.py：最终111单元，0失败/错误/跳过；output/visible-schedule-build.log及surefire-reports。临时POM排除既有Finder副本，不删除用户文件。
- python3 backend/scripts/check_visible_schedule_permissions.py：21项真实服务检查通过；output/visible-schedule-permissions.log、output/visible-schedule/permissions.json。覆盖仅负责人/仅可见管理者、跨范围/跨公司/管理员拒绝、夹带资料拒绝、旧版本/冻结/完成/未发布、正确上级审批、失去可见权后不得生效。失权用例仅修改fixture拥有的临时数据，结束自动清理。
- CHROME_BIN=… python3 backend/scripts/check_schedule_drag.py：最终152项真实浏览器检查通过，异常0；output/visible-schedule-browser.log、output/task-schedule/browser-report.json。旧135项按新语义更新：非创建者有排期手柄，虚线绘在真实时段层。增加320/390/1440九小时宽度及偏移、真实整条平移/取消、最小排期表单、跨段精确入口、普通点击和触摸纵向滚动；旧审批终态、跨年、捕获失败、分钟保持仍通过。
- CHROME_BIN=… python3 backend/scripts/check_subordinate_workspace.py：68项通过，异常0；output/visible-schedule-staff.log、output/subordinate-workspace/browser-report.json。新增跨日首尾比例38/72与20/72、零时长和整日几何、下属月历直接调时/返回/键盘；原日志字号、权限与迟到响应回归保留。
- node backend/scripts/check_calendar_sort.js --file 潘多拉-日程视图.js --output output/visible-schedule/calendar-sort.json：4项排序检查通过。
- JS语法、git diff --check、openspec validate fix-hourly-schedule-drag-and-log-type --strict：通过。

本轮取代旧记录中“仅业务编辑者可调时”“下属只读不能调时”“月历固定12px一小时”的约束。月历现在按真实日格宽度/24换算小时，窄屏精确修改建议使用调时按钮；标题的透明命中区域可以跨整格，但彩色真实时段层不会虚占全天。跨日任务完整覆盖的中间日依然覆盖整日。只放开已授权可见任务的排期，不放开资料/负责人/标签/进展/重开等权限。

独立验证重点：非责任方申请生效时必须仍可见且仅有排期差异；未发布/已完成/冻结/过期边界仍按原规则；月历整体拖动不吞点击、纵向滚动、键盘日期选择，跨段调时保留完整起止。复核最小时点命中区与真实条宽分离，下属div容器有键盘入口。未使用手机真机。

## 2026-11-01 HTTP请求标识兼容修复

用户确认将截图crypto.randomUUID is not a function修复继续纳入当前变更。6.1完成，总计11/11；当前HEAD仍ed9a331，工作区未提交，仅更新本地预览，未发布云端/推送Git/独立验证或归档。

根因：P.mutation直接调用仅安全上下文提供的crypto.randomUUID。原浏览器回归访问127.0.0.1，被浏览器视为可信上下文，因此漏掉了用户HTTP局域网地址的能力差异。新增真实非localhost HTTP域映射本机，不将HTTP伪装成安全上下文。

实现：api.js新增内部newRequestId，原生可用时保持调用；否则通过crypto.getRandomValues生成RFC4122 v4格式标识，继续使用原重试槽/签名/If-Match逻辑，不使用Math.random，不改变权限、审核或后端协议。browser_fixture.js增加可选测试浏览器参数，默认行为保持；新check_request_id_compat.py/browser.js使用一次性数据库和固定.test域→127.0.0.1映射。

本轮实际检查，项目根目录，CHROME_BIN沿用前述Google Chrome for Testing：

- PANDORA_COMPAT_EXPECT_BROKEN=1 CHROME_BIN=… python3 backend/scripts/check_request_id_compat.py：旧JAR成功复现截图同文错误。真实isSecureContext=false、randomUUID=undefined、getRandomValues=function；8项复现检查通过，提交前失败、没有新增申请。output/request-id-compat-before.log、output/request-id-compat/before.json及before-error.png。
- python3 backend/scripts/build_refinement_verification.py：最终111单元，0失败/错误/跳过；output/request-id-compat-build.log与surefire-reports。
- CHROME_BIN=… python3 backend/scripts/check_request_id_compat.py：修复后15项浏览器检查通过，另数据库断言仅新增一笔申请。普通HTTP实际提交、先提交成功后模拟响应丢失、同内容重试复用UUID并成功返回、原有效排期保持而待审时间正确、256次新操作无重复、内容变化新键、Math.random禁用仍成功、原生路径保持、浏览器异常0。output/request-id-compat-after.log与after.json，包含390/1440表单截图，已人工查看。
- 本地预览原DB保留，仅service.py重启backend；health=200，HTTP提供的api.js内容SHA256与源码相同。另对实际http://10.130.8.232:8080用新测试浏览器验证fallback，测试P.request被临时替换后恢复，不向服务端发送业务变更；output/request-id-compat/local-preview.json。
- JS语法、git diff --check、openspec严格校验：通过。

环境失败记录：实际局域网页面附加核对首次漏设CHROME_BIN，默认Chrome路径不存在；补回已安装的Google Chrome for Testing路径后重跑。本次未以此失败替代最终验证。

独立验证提醒：必须在非localhost HTTP来源检查公共P.mutation；不能仅靠127.0.0.1结果。确认相同槽和请求重试复用键、不同内容/新操作换键，不影响ETag和权限。原用户报错发生在发送前，不需要为此回滚业务数据；页面需重新加载更新后的api.js。此次范围是用户排期页及共用写入入口，独立admin/debug页面的内部UUID调用未改动，不宣称全项目已移除所有原生UUID调用。未进行手机真机测试。此前152/68/21检查属于上一轮结果，未在本次重新冒称执行。

## 2026-11-01 统一任务框、移除按钮

用户确认继续纳入当前变更，追加7.1—7.2完成，总计13/13。HEAD仍ed9a331，工作区未提交，未推送Git/发布云端/进行独立验证或归档。此节取代历史记录中的“标题在框外”“调时按钮”“起止按钮”设计。

| 任务 | 实现与决定 |
| --- | --- |
| 7.1 | 日程视图.js的月历标题/时间嵌入实际p-month-duration，横向日视图移除框外p-horizontal-label、将文字放入框内粘性caption，纵向文字置入真实时段层。个人资料.js下属月/日同样处理。删掉调时按钮及带文字的起止button，使用透明可聚焦separator边缘区域，保留方向键、悬停完整信息及详情调整排期入口。框体可整体平移，透明边缘改变端点；无位移点击仍走原查看，拖动后抑制误点击。拖动ghost也有随新排期更新的框内文字，整条平移不改变框尺寸 |
| 7.1 下属 | 导出bindScheduleResize/resizeHandle供下属动态视图使用；仅在staffCurrent序列/会话校验通过后将授权的原有效raw行upsert进共享任务集，再用单独展示副本投影待审时间，避免把待审新排期当成实际有效版本或接受迟到响应 |
| 7.2 | 原pendingSchedule继续决定新框位置、宽度及文字，月历虚线改为内收outline，不因边框最小宽度扩大极短时段；短文字在框内裁切，完整信息由提示/详情提供，点任务命中区保持独立。待审/完成/权限和审核终态逻辑不变，无后端/数据库变更 |

本轮实际检查（项目根目录；CHROME_BIN沿用前述Google Chrome for Testing；fixture串行）：

- python3 backend/scripts/build_refinement_verification.py：最终111单元，0失败/错误/跳过；output/unified-frame-build.log与surefire-reports。
- CHROME_BIN=… python3 backend/scripts/check_schedule_drag.py：最终166项全部通过；output/unified-frame-browser.log、output/task-schedule/browser-report.json。新增真实横纵框体平移/ghost尺寸保持、无位移极短边缘点击、无按钮、框内文字及320/390/1440新申请框偏移10:20/24与长度7/24，并验证文本含新10:20和17:20、无原位置副本；保留跨年/取消/捕获回退/分钟/权限/审核终态测试。浏览器异常0。
- CHROME_BIN=… python3 backend/scripts/check_subordinate_workspace.py：最终72项全部通过；output/unified-frame-staff.log、output/subordinate-workspace/browser-report.json。下属月历实际框体拖动、纵轴ghost只平移不伸缩、返回取消不保存、框内文字边界/无按钮及原权限、日志、迟到响应回归；异常0。
- node backend/scripts/check_calendar_sort.js --file 潘多拉-日程视图.js --output output/unified-frame-sort.json：4项通过。
- JS语法、git diff --check、openspec严格校验通过。
- 本地8080仅重启backend，原演示数据库保留，不重建/重种；health200，6份JS/CSS与源码SHA256一致。CHROME_BIN=… node /tmp/pandora-check-local-frame.js对实际局域网HTTP页面只读验证截图任务“分页事项040”：pending=true，展示排期等于pendingSchedule，实际是公司时间10月29日05:00至11月28日14:00，caption在虚线框内，月历无button。output/unified-frame/local-preview.json和local-pending-frame.png。此检查仅登录既有公开演示账号并读取/渲染，没有提交任务或审核变更。

人工查看pending-month-1440、day-390及实际local-pending-frame截图；原空虚线条已成为含文字的完整框，没有框外独立标题或调时/起止按钮。

失败与修复：首轮框内边界检查发现零时长横向任务的固定12px内边距撑出实际1px框，改成按框宽度限制的百分比内边距后完整复跑通过。收尾补齐纵向整条ghost移动的相同高度、透明边缘无位移普通点击及包含完整排期的提示；最后166/72项为这些修复后的结果，不是先前165项或历史检查。

独立验证提醒：看真实时段层而不是透明格子容器的边界，尤其跨月首尾与短/点任务；文字只能在真实框内裁切，不能为了显示文字虚增时长。确认待审新位置与文字同源，实际任务数据与提醒仍是有效版本。复核下属upsert发生在staffCurrent校验后且使用原有效raw；透明边缘不能吞普通点击、纵向触摸滚动或误提交；小框两端命中应独立。先前HTTP兼容及21项权限属于各自历史专项，本轮未冒称重新执行。未使用手机真机测试。

## 2026-11-01 正式发布

用户明确要求上线当前版本，并确认保留4个变更待后续独立验证/归档。源码提交c1d6073f520ae24f0bdb0cf4c674e603c7051a9d已推送main，正式目录/opt/pandora/releases/20261101-schedule-c1d6073于2026-11-01T15:40:40.922719+08:00完成切换，入口https://8.141.96.122:6644。JAR SHA256为b6bdccdbe68a43aa1ab4595a651443af6ccdce13d7fe971726a6e8f62f374933，数据库V28未迁移，业务数据/有效版本/已办记录保留，配置未改；备份位于/opt/pandora/backups/20261101-schedule-c1d6073。服务端及本机公开18份资源哈希和双HTTPS入口健康检查通过，临时副本清理。正式库无明确专用测试账号，未进行登录后业务操作；未做手机测试。本次为发布检查，不是独立验证PASS。详情见backend/docs/release-20261101.md及output/releases/20261101-schedule报告；前述“仅本地/未发布”的状态已由本节更新，历史实施与测试事实保留。
