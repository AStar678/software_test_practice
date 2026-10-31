# Implementation Notes

- Change: refine-task-creation-notifications-and-review-routing
- Project: /Users/aoxiang/Desktop/软件测试
- 工作区：原 checkout，未提交；保留用户已有 android-shell/README.md、build_online.py 及所有重复文件。
- 本记录为实施检查和交接，不是独立验证结论。未部署云端、未归档。
- 用户最新范围：不需要手机测试；已停止并移除临时调试转发，测试副本未安装。真机结果不作为完成证据。

## 代码与任务映射

| 任务 | 实现 | 检查 |
| --- | --- | --- |
| 1.1–1.2 | TaskService route/currentRoute/creationRoute、预览及决定统一实际申请人 | TaskServiceTest、check_review_routing、check_task_creation_refinement |
| 1.3 | 旧待审启动刷新、组织调整/接管复用刷新，失效人员阻断 | check_task_refinement_upgrade、check_review_routing（改派/旧审核权/截止/并发） |
| 1.4 | 交接、重开、接管与演示回归跟随新规则 | check_review_routing、check_final_demo、backend/docs/task-creation-refinement.md |
| 2.1 | V28 有序任务版本标签关联及回填；不改旧迁移 | check_task_refinement_upgrade（V27→V28、删除快照、旧版本、重复启动） |
| 2.2 | TaskService 全集合读写/版本复制/diff/历史，旧字段兼容 | 实际 API 多标签、空集、重复/跨公司/私人/删除、拒绝前后与旧请求检查 |
| 2.3–2.4 | 标签按钮、任务表单/详情/审核全量显示、首项读投影 | 浏览器多选/取消/键盘/返回/失败保存、日程颜色；既有日志/通知回归 |
| 3.1–3.2 | 候选直属父节点字段，树展开/搜索/工作副本/顺序 | API 候选目录隐私；浏览器跨分支、排序、取消还原 |
| 3.3 | 排期响应式网格、日期与时分控件 | 三种尺寸截图和几何测量、显式日期时刻、全天快捷与逆序拒绝、组织时区单元检查 |
| 4.1–4.2 | WorkspaceService 元数据分类→过滤→分页→批量安全投影 | WorkspaceBatchReadTest、通知生命周期实际回归、后续页与未读总数 |
| 4.3 | 默认四字段、完整切换、组合筛选、详情返回与会话隔离 | 浏览器真实登录、打开已读、清空、无匹配、账号切换 |
| 5.1–5.3 | 构建、隔离升级/业务/演示、浏览器、文档 | 下列实际命令及 output/task-creation-refinement 报告 |

## 环境与实际检查（前五项历史结果）

现有工作区包含同名 `* 2.java` 文件，直接 Maven 会重复定义类。`build_refinement_verification.py` 从正式 POM 生成同目录临时 POM，只排除这些重复文件，完成后自动删除；源码、资源路径和正式依赖均保持原配置。

真实浏览器使用本机 Chrome for Testing：`CHROME_BIN=/Users/aoxiang/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`。

回归均使用随机命名、自动清理的测试库；不连接云端正式库。

| 实际命令 | 结果与证据 |
| --- | --- |
| `python3 backend/scripts/build_refinement_verification.py` | 111 项测试，0 失败/错误/跳过；正常打包完成。output/task-refinement-build.log 与 backend/target/surefire-reports |
| `CHROME_BIN=… python3 backend/scripts/check_task_creation_refinement.py` | 35 项真实接口与 35 项真实浏览器检查通过；最终构建复跑通过。api-report.json、browser-report.json |
| `python3 backend/scripts/check_task_refinement_upgrade.py` | 13 项通过：V27 升级、删除/空标签、旧创建与进展待审重算、重复启动、终态历史不变、原申请人停用阻断。upgrade-report.json |
| `python3 backend/scripts/check_review_routing.py` | 204 项通过：四层身份、负责人换序、编辑/进展/完成/重开/交接、组织调动/正式接管、旧审核失权、版本围栏、并发决定、通知与提醒。review-routing.json |
| `python3 backend/scripts/check_fixed_notifications.py` | 44 项通过：标签权限/删除、评论隐藏/撤回、历史只读、日志冻结、打开已读和过期清理。fixed-notifications.json |
| `python3 backend/scripts/check_final_demo.py` | 55 项通过：重复准备、稳定身份、144 个任务、各审核状态、接管编辑经直属上级批准后重启回读；管理员独立。final-demo.json |
| `openspec validate refine-task-creation-notifications-and-review-routing --strict` | PASS |
| JS/Python 语法检查及 `git diff --check` | PASS |

截图已人工查看：schedule-320/390/1440.png、tags-390.png、assignee-tree-390.png、notifications-390.png。日期与时分未横溢；长标签不遮挡；树节点显示职级/职位/部门/团队；按钮和页面保留既有主题。最新浏览器检查另外覆盖 notifications-compact-390.png，已人工查看。17 项实施任务完成；独立验证工作流和归档未执行。

修复记录：旧单标签表单会截断集合，现由数组完整传递且旧显式写入拒绝；时间的小时/分钟原来纵向堆叠，现按同组排列；负责人树工作副本支持顺序，摘要区域不放置无法写回的排序按钮；失效负责人不使整个审核列表读取失败，而将申请阻断。键盘用真实浏览器输入事件验证，输入事件包含 Enter 字符。另修复已有删除标签不在目录时编辑表单无法清除的问题：从该任务的授权快照补齐当前选中项；取消后不允许新引用。审核差异比较稳定标签 ID，防止旧标签删除后同名新标签替换被名字比较吞掉；历史附完整前后快照。

## 升级与边界

详见 backend/docs/task-creation-refinement.md：V28 回填、首项兼容投影、多标签旧字段冲突、启动旧待审刷新和兼容回退要求。

真机尝试未通过并已按用户要求取消。一次“拦截在线页面请求”工具申请被自动审批拒绝，未执行；之后准备的独立测试副本也未安装。不能把浏览器手机尺寸截图或此前尝试视作安卓真机验证。

## 独立验证提醒

- 重点复核：刷新使用原申请人，正式接管不变成审核授权；旧待审不会复活终态。
- 重点复核：完整标签集合在有效版本、历史和审核间一致，缺字段不会清空，旧显式单标签写入不会截断集合。
- 重点复核：通知筛选前后分类与安全投影一致，评论失权不泄漏，查询预算不退化为逐条读取。
- 真机验证已由用户取消；云端发布、原生客户端界面与 OpenSpec 归档均未执行。


## 追加排期实施（2026-10-31）

- 原变更继续使用 spec-driven；工作区未提交。用户确认月历和日视图均支持横向拖动，全天快捷截止为所选截止日的次日00:00；不做手机测试。
- 3.3 / 6.1：`潘多拉-交互原型.js`、`潘多拉-任务接入.js` 取消创建/编辑/重提/重开的全天开关，始终提交显式起止时刻（allDay=false）；全天快捷重复点击稳定。旧全天编辑按 raw.startAt/dueAt 回显，不修改旧记录或旧API兼容语义。
- 6.2：`潘多拉-日程视图.js`、`潘多拉-日历.css` 提供月历真实端点按天拖动及日视图默认横向轴按15分钟调整，保留纵向轴/任务清单。续接端无假端点，零时长独立手柄，标题在横向滚动时可见。Esc、pointercancel、失去捕获及无移动取消；键盘左右箭头及浏览器触摸输入已覆盖。320px顶部导航分两行避免重叠。
- 6.3：拖动只预览并打开原编辑表单确认原因，复用原change/审核/ETag/幂等流程。canEditTask控制入口，服务端独立裁决；无权、冻结和已完成无手柄，拖动期间版本变化提示最新数据，待审前原有效排期不变。
- 6.4：仅更新本机8080演示预览，保留现有演示库；未部署云端，未安装或测试手机。地址 http://10.130.8.232:8080 （同局域网）。页面五个修改资源与源码SHA256核对一致，健康检查200。

### 本轮实际检查

工作目录均为 `/Users/aoxiang/Desktop/软件测试`。浏览器使用上文 CHROME_BIN，业务检查均独立随机数据库、退出自动清理。

| 命令 | 结果 / 证据 |
| --- | --- |
| `python3 backend/scripts/build_refinement_verification.py` | 最终构建成功，111项单元测试，0失败/错误/跳过；output/task-schedule-build.log |
| `CHROME_BIN=… python3 backend/scripts/check_task_creation_refinement.py` | 35接口+36浏览器检查通过；output/task-refinement-recheck.log、原refinement报告。旧全天切换断言改为显式快捷和重复点击；最终仅追加日历标题/窄屏导航样式，表单及业务代码未再变动 |
| `CHROME_BIN=… python3 backend/scripts/check_schedule_drag.py` | 69项通过；output/task-schedule/browser-report.json、task-schedule-check.log。真实鼠标、触摸、键盘；跨年、午夜、零时长、旧全天、重开、保存、取消、版本冲突、无权和待审有效版。其后仅追加320px顶部导航样式，见最终预览检查 |
| `CHROME_BIN=… python3 backend/scripts/check_calendar_drawer.py` | 102项通过；audit/refactor-pandora-organization-and-workflows/calendar-drawer.json 与 output/task-schedule-calendar-regression.log。既有纵向轴断言显式选择纵向模式，新默认横轴另有新增测试 |
| `CHROME_BIN=… node /tmp/check_schedule_preview.js` | 最终打包预览只读登录与320/390/1440布局检查；output/task-schedule/preview-report.json、preview-*.png |
| `openspec validate refine-task-creation-notifications-and-review-routing --strict`、`git diff --check`、JS/Python语法检查 | 通过 |

失败及修复过程：新增测试最初将关闭后保留在隐藏弹层中的DOM当成“仍打开表单”，改为核对弹层可见状态及草稿后通过；截图发现横轴滚动后标题消失、点任务文本裁切，改为独立随滚动保持可见的标题；320px年月与导航重叠已调整为两行。最终截图已人工查看，不能以浏览器尺寸/触摸模拟宣称安卓真机通过。

追加范围不需要数据库迁移。独立OpenSpec验证和归档仍未执行；以上为实施检查，不是独立PASS。旧的17项完成和全天往返描述由本次21项实施及显式排期要求取代。


## 追加本人范围、标签权限与日志入口（2026-10-31）

- 7.1 `潘多拉-任务表单.js` 的统一matches管线先要求creatorId为本人或assigneeIds含本人，再筛选/排序/计数/分页；移除仅可见筛选，不改全局授权TASKS。
- 7.2 `Tags.java` 对共用/私人创建和维护统一requireFounder，canEdit同规则；`潘多拉-标签评论.js` 非创始人不挂管理入口且直接调用也阻止，日程图例及详情私人选择控件去除。既有颜色投影/私人数据不改，浏览器和原有多标签颜色回归通过。
- 7.3 `潘多拉-工作区接入.js` 写日志读取公司三天已有记录，仅提供缺失日期；全部已写仅提示，编辑仅显式ID打开。删除独立补写入口。创建竞态保持草稿和原日志，不自动切成编辑。
- 7.4 当前25/25实施任务完成，未提交、未独立验证或归档；沿用已有本地演示库更新8080预览，未动云端，未做手机测试。

本轮实际检查（项目根目录，CHROME_BIN同前，均使用独立一次性测试库）：

| 命令 | 结果及证据 |
| --- | --- |
| `python3 backend/scripts/build_refinement_verification.py` | 成功打包，111单元测试0失败/错误/跳过；output/entry-refinement-build.log |
| `CHROME_BIN=… python3 backend/scripts/check_log_backfill_entry.py` | 31浏览器检查通过，附共用/私人标签维护API权限断言；audit/refactor-pandora-organization-and-workflows/log-backfill-entry.json，output/entry-refinement-check.log。真实上级账号仍授权下属任务但表单不显示，搜索/刷新不能恢复；3天缺失创建、显式编辑、并发重复不覆盖、普通员工选择和创始人维护入口 |
| `CHROME_BIN=… python3 backend/scripts/check_task_creation_refinement.py` | 35API+36浏览器通过；output/entry-task-regression.log与refinement报告，涵盖标签选择/取消、旧颜色、创建表单和通知 |
| JS语法、`git diff --check`、OpenSpec strict validate | 通过 |
| 本地预览健康和资源SHA256 | 200，任务表单/标签评论/工作区接入三份资源与源码完全相同，保留已有演示库 |

已人工查看390和1440任务表单、390日历与日志创建截图（output/entry-refinement）。第一次新增fixture的旧私人标签ID过长导致数据库拒绝，改为标准UUID后完整重跑通过。日志编辑与旧补写行为的断言已按新需求更新，独立验证时应留意原check_fixed_employee_browser.js中“创建同日转编辑”的旧断言也已不再是当前需求。本轮未运行该旧广泛用例，不能将旧结果当作最新结论。


## 后续独立变更范围

用户于2026-10-31要求日期/标签对齐、卡片直接进入详情评论和日志页仅本人这三项单独建立变更，现由 `simplify-personal-log-page` 跟踪；本变更仍为此前25项，未把后续检查当作本变更的独立验证。两者共享工作区/测试脚本，历史结果以当时输入为准。


## 正式发布追记（2026-10-31）

用户要求先上线并同步Git。现已发布到 https://8.141.96.122:6644 ，代码提交f29f9fd，原配置/数据库保留、V28成功升级；详情见backend/docs/release-20261031.md。上文“未发布云端”描述为对应实施检查时的历史状态，现由本追记更新。发布检查不代表独立验证PASS，当前变更仍未归档；手机测试仍按用户要求取消。线上未标记专用演示账号，因此未做登录后的业务读取测试，未改任何账号密码。
