# Implementation Notes

- Change: `update-pandora-web-admin-from-oct25-checklist`
- Schema: `spec-driven`
- Store: local repo (`/Users/watuji/MyGitDev/software_test_practice/openspec`)
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice` (员工 Web/管理端/脚本),
  `/Users/watuji/MyGitDev/software_test_practice/backend` (Java/MySQL/Flyway)
- Updated: 2026-10-25T16:05:00+08:00
- Implementation revision: `ba0cb89` + dirty worktree（第 1—11 章改动全部未提交；`android/`、`android-shell/` 无改动）
- Progress: 50/56 tasks complete。第 1—9 章、10.1—10.3、11.1、11.3 完成；10.4—10.8 按用户本轮明确选择跳过，11.2 仅完成 Web 一半（套壳未验证），故 6 项保持未勾选。

## Scope decisions this round

- 用户先询问本机阻塞项，确认缺原 Android 签名密钥、Android SDK/apktool、adb/真机后，明确选择“本轮跳过旧套壳全部任务”。因此 `android-shell/` 未修改，10.4—10.8 与 11.2 的套壳/APK/设备部分不实施、不勾选、不以构建成功或桌面截图替代。
- 第 1—8 章沿用上一轮实现与证据（`audit/2026-10-25` 旧 JSON），本轮重新运行了受第 9—11 章改动影响的回归；新增第 9 章、Web 构建、10.2/10.3 回归与第 11 章演示证据。

## Implementation Map

| Task / requirement / scenario | Code and tests | Decisions / context |
| --- | --- | --- |
| 5.1—5.6 本人日历投影、侧栏/悬浮创建、连续月份、纵向日轴、重叠分栏、日历检查 | `潘多拉-日程视图.js`、`潘多拉-日历.css`、`check_mobile_calendar.js`（13）、`check_calendar_sort.js`（4）、`check_home_calendar_browser.js`（22） | 日历只在投影层过滤本人有效负责任务，全局授权任务集不变；`audit/2026-10-25/chapter5-calendar-browser.json` |
| 6.1—6.3 任务表单入口、手机列序、综合检查 | `潘多拉-任务表单.js`、`潘多拉-任务表单.css`、`check_task_form.js`（85） | 列序改为任务名/关系/状态/待审/截止优先的 17 列，表头同步；筛选/排序/全量计数/分页管线保留 |
| 7.1—7.4 日志三天窗口、24 小时冻结、删除保留日位置、三级作者目录、全屏表单 | `WorkspaceService`、`WorkLogSlots`、`V16`、`潘多拉-工作区接入.js`、`WorkspaceLogAndReportsTest`（7）、`check_work_logs.py`（34）、`check_logs_profile_browser.js` | 冻结只认首次 `created_at`；删除保留 `(org,author,day)` 槽位；作者目录按授权派生；`audit/2026-10-25/chapter7-*.json` |
| 8.1—8.6 标签目录/单选、改名改色删除、平铺评论、评论通知、通知用途列表 | `Tags`、`CommentService`、`EventsWorker`、`V17/V18/V20`、`潘多拉-标签评论.js`、`check_tags_comments.py`（41）、`check_tags_comments_browser.js`、`check_notification_browser.js`、`check_deadline_reminder_notification.py` | 标签按目录解析、快照不重写；评论独立于业务冻结；通知带通用对象引用；`audit/2026-10-25/chapter8-*.json` |
| 9.1 管理员专用任务查找/定位分页接口 | `TaskService.adminTasks`、`AdminController GET /api/v1/admin/tasks` | 由 `view_task_history` 能力授权，不调用员工可见列表；只返回展示字段，无手机号/邮箱/密码；支持 q/state/requestStatus/creatorId/assigneeId/from/to/limit/offset |
| 9.2 `admin.html` 任务历史页签 + 历史数据补名 | `admin.html`（任务历史页签、版本/操作记录/改派/交接表）、`TaskService.taskHistory`（新增 `people` 映射与 `originalCreatorName`） | 历史接口仍仅管理能力可读；`people` 只含 id+姓名，用于有序负责人和改派/交接显示；不返回联系方式 |
| 9.3 `admin.html` 通知管理页签 | `admin.html`（通知管理页签、状态/到期/撤回）、现有 `WorkspaceService.adminNotifications`/`withdrawEvent` | 直接复用真实管理接口；撤回按钮由服务端 180 秒窗口决定结果；显示撤回后占位，不撤销业务、不删审计 |
| 9.4 员工“我的”受限团队入口 + 最小读取接口 | `TeamManagementController GET /api/v1/me/team-management`、`OrganizationService.teamManagement`、`WorkspaceService.me`（`canManageTeam`）、`潘多拉-个人资料.js`（团队管理卡片/创建/转交） | 只读本人 `manage_team` 授权部门、其团队与本部门负责人候选；写入复用现有 `POST/PATCH /api/v1/admin/teams`（服务端重复鉴权）；管理员与普通员工均无入口 |
| 9.5 管理端/员工端联合检查 | `check_admin_console.py`（53）、`check_admin_console_browser.js`（28）、`check_chapter11_browser.js`（管理端 9 页签） | 覆盖管理员/员工会话隔离、业务账号直连管理接口 403、角色变化刷新、团队负责人不扩业务权限 |
| 10.1 Web 资源/Build 校验 | `backend/pom.xml`（显式资源清单）、`潘多拉-交互原型.html`（缓存版本）、`check_web_resources.py`（14）、`mvn test`（77）、`mvn package` | 所有 `?v=` 与 sha256 前 12 位一致；8 个业务脚本按依赖顺序加载；jar 内资源逐字节一致；`android/` 无改动 |
| 10.2 任务/路由/交接/截止/提醒综合回归 | `check_task_creation_flow.js`（20）、`check_review_routing.py`（79）、`check_handover_preset.py`（29）、`check_submit_lock_deadline.py`（5）、`check_task_form.js`（85）、`check_handover_browser.js`（23）、`check_deadline_reminder_notification.py`（91） | `check_handover_browser.js` 的两处旧夹具/入口按当前实现更新：创建审核人按记录而非假设、任务查找改走任务表单（日历名称搜索已在第 5 章移除）、交接预设入口在个人设置内；断言未放宽 |
| 10.3 手机/桌面集成路径 | `check_logs_profile_browser.js`（26/26 ×2）、`check_tags_comments_browser.js`（23/23 ×2）、`check_notification_browser.js`（23/23 ×2）、`check_home_calendar_browser.js`（34/34）、`check_account_browser.js`（18/18） | 证据 `audit/2026-10-25/chapter10-{logs-profile,tags-comments,notification}-{mobile,desktop}.json`、`chapter10-home-calendar.json`、`chapter10-account-browser.json`；覆盖三天/24 小时与评论独立、手机号隐私、受限撤回原文、通知无底部栏、主导航五页；浏览器自动化不等于真机 |
| 11.1 持久演示数据准备 | `prepare_demo.py`（幂等 HTTP 准备）、复用 `DemoSeed` 的手机号员工/组织关系 | 显式准备脚本，不改动既有种子；十条公司事项（7 条演示+3 条种子）、76 条演示任务（跨月密集/全天/跨年/55 条分页/3 条待审/3 条下属）、18 条日志（员工三天）、2 个标签、3 条评论、254 条通知；三次运行计数不增 |
| 11.2 Web 连续演示 | `check_demo_flow_browser.js`（15） | 同一 `middle` 账号：首页十条公司事项→通知→审核（走真实审核通知→申请→通过）→任务表单筛选/排序/分页→下属日志→整页刷新；套壳与设备部分未验证，故 11.2 不勾选 |
| 11.3 逐清单证据汇总 | 本文件 | 不把 apply 自测写成独立 e13 PASS，不回写 PRD 为已验收 |

## Checklist traceability (C01—C25, S01)

| 清单项 | 要求摘要 | 任务 | 主要实现 | 证据 / 说明 |
| --- | --- | --- | --- | --- |
| C01 | 日历仅本人有效负责正常任务 | 5.1、10.2 | `潘多拉-日程视图.js` | `chapter5-calendar-browser.json`、`chapter10-logs-profile-*` |
| C02 | 纵向完整日时间轴 | 5.4、5.6 | `潘多拉-日程视图.js`、`潘多拉-日历.css` | `chapter5-calendar-browser.json` |
| C03 | 密集与全天任务全量可见 | 5.5、5.6 | `layoutDayEvents`、`p-allday-scroll` | `chapter5-calendar-browser.json` |
| C04 | 侧栏及悬浮创建 | 5.2、5.6 | `潘多拉-日程视图.js` | `chapter5-calendar-browser.json` |
| C05 | 任务表单正常进入返回 | 6.1、6.3 | `潘多拉-任务表单.js` | `chapter10-task-form.json`（85） |
| C06 | 全公司有效员工创建候选 | 3.1、3.6 | `Access.creationCandidates`、`TaskService` | `chapter10-review-routing.json`（79） |
| C07 | 创建人直属上级审核 | 3.2—3.4、3.6 | `TaskService.creationRoute`、`CompanyTree` | `chapter10-review-routing.json` |
| C08 | 创建免审与非创建提示一致 | 3.5、4.5 | `潘多拉-任务接入.js`、`TaskService` | `chapter10-task-creation-flow.json`（20） |
| C09 | 重开一并改排期 | 4.3、4.5 | `TaskService.reopen`、`潘多拉-任务接入.js` | `chapter10-task-creation-flow.json` |
| C10 | 失效创建修改重提 | 4.4、4.5 | `TaskService`、`潘多拉-任务接入.js` | `chapter10-task-creation-flow.json` |
| C11 | 逐项差异及有序负责人 | 4.6、10.2 | `TaskService.diff`、`differenceHTML` | `chapter10-task-form.json`、`chapter10-review-routing.json` |
| C12 | 正式 PC 任务历史查询 | 9.1、9.2、9.5 | `TaskService.adminTasks/taskHistory`、`admin.html` | `chapter9-admin-console.json`（53）、`chapter9-admin-browser.json`（28） |
| C13 | 正式 PC 通知管理 | 9.3、9.5 | `admin.html`、现有 `adminNotifications/withdrawEvent` | `chapter9-admin-console.json`、`chapter9-admin-browser.json` |
| C14 | 部门负责人受限团队入口 | 9.4、9.5 | `TeamManagementController`、`OrganizationService.teamManagement`、`潘多拉-个人资料.js` | `chapter9-admin-console.json`、`chapter9-admin-browser.json` |
| C15 | 员工手机号登录 | 1.1、2.1—2.4 | `AuthService`、`PhoneNumbers`、`V19`、`admin.html` | `chapter10-account-browser.json`、`audit/2026-10-25/account-*.json` |
| C16 | 可连续演示的持久数据 | 11.1—11.3 | `prepare_demo.py` | `chapter11-demo-prep-1/2/3.json`、`chapter11-demo-db-persistence.txt`、`chapter11-demo-web.json`（15） |
| C17 | 跨月连续任务瀑布流 | 5.3、5.6 | `monthStream/appendStreamMonth` | `chapter5-calendar-browser.json` |
| C18 | 创建移除完成标准，创建人可不负责 | 4.1、4.5 | `TaskService.rejectCreationCriteria`、`潘多拉-任务接入.js` | `chapter10-task-form.json`、`chapter10-task-creation-flow.json` |
| C19 | Web 自有时分控件避免大表盘 | 4.2、10.4、10.7 | `潘多拉-api.js timeControl`、`TaskService` | Web 证据见 `chapter10-task-creation-flow.json`；套壳/真机未验证（10.4/10.7 跳过） |
| C20 | 通知列表说明用途 | 8.5、8.6、10.3 | `潘多拉-工作区接入.js`、`WorkspaceService.notificationPurpose` | `chapter10-notification-*`、`chapter10-deadline-reminder.json`（91） |
| C21 | 日志命名及三级搜索 | 7.3、7.4、10.3、10.4、10.7 | `潘多拉-工作区接入.js`、`WorkspaceService.logAuthors` | `chapter10-logs-profile-*`；套壳未验证 |
| C22 | 近三天补写及 24 小时冻结 | 1.2、7.1、7.2、7.4 | `WorkspaceService`、`WorkLogSlots`、`V16` | `audit/2026-10-25/chapter7-work-logs.json`（34）、`chapter10-logs-profile-*` |
| C23 | 共用单选标签与创始人维护 | 1.3、8.1—8.3、10.3 | `Tags`、`潘多拉-标签评论.js`、`V17` | `chapter10-tags-comments-*` |
| C24 | 平铺评论、作者控制及定向通知 | 1.4、8.4—8.6、10.3 | `CommentService`、`EventsWorker`、`V18/V20` | `chapter10-tags-comments-*`、`chapter10-notification-*` |
| C25 | 手机任务表单列优先级 | 6.2、6.3 | `潘多拉-任务表单.js` | `chapter10-task-form.json`、截图 `task-form-narrow.png` |
| S01 | 旧套壳同步本次 Web、必要适配、覆盖升级包及验证 | 10.4—10.8、11.2、11.3 | 未实施（用户本轮明确跳过） | 缺原签名密钥、Android SDK/apktool、adb/真机；`android-shell/` 无改动，未生成 APK，未做设备升级 |

## Checks Run

All commands below ran in this session unless marked “previous session”. Backend cwd is `backend/`; Web lives in the repository root. Isolated runs use `backend/scripts/run_check_isolated.sh`（独立库+独立端口，用户 `pandora` 库未被写入）。`{base}`/`{db}` 由脚本替换。

| Command | Working directory / setup | Result / evidence | Run time or revision |
| --- | --- | --- | --- |
| `mvn -B -ntp -o -Dmaven.repo.local=.runtime/m2 test` | `backend/` | 77 tests, 0 failures | 2026-10-25 15:28, dirty `ba0cb89` |
| `mvn -B -ntp -o -Dmaven.repo.local=.runtime/m2 -DskipTests package` | `backend/` | BUILD SUCCESS；jar 含最新 Web 资源 | 同上 |
| `python3 scripts/check_web_resources.py --repo .. --jar target/pandora-backend-0.1.0.jar --output ../audit/2026-10-25/chapter10-web-resources.json` | `backend/` | 14/14；HTML 引用、hash 版本、加载顺序、Maven 清单、jar 内逐字节 | 同上 |
| `CHECK_FIXED_TIME=2026-10-25T04:00:00Z CHECK_WORKER=true ./scripts/run_check_isolated.sh python3 scripts/check_admin_console.py --base-url {base} --output ../audit/2026-10-25/chapter9-admin-console.json` | `backend/` | 53/53；任务定位分页/过滤/隐私、历史字段/顺序/改派/交接/重开/免审、消息删除后历史、通知撤回边界/审计/业务不变、团队入口与越权、会话隔离 | 2026-10-25 15:31，dirty `ba0cb89` |
| `CHECK_FIXED_TIME=2026-10-25T04:00:00Z CHECK_WORKER=true ./scripts/run_check_isolated.sh node scripts/check_admin_console_browser.js --base-url {base} --output ../audit/2026-10-25/chapter9-admin-browser.json` | `backend/` + headless Chrome（1440×900） | 28/28；PC 管理端历史/通知页签、撤回成功与超时拒绝、员工“我的”团队入口创建/转交、业务账号拒绝 | 同上 |
| `CHECK_WORKER=true ./scripts/run_check_isolated.sh node scripts/check_task_creation_flow.js --base-url {base} --database {db} --output ../audit/2026-10-25/chapter10-task-creation-flow.json` | `backend/` + 真实时钟 | 20/20（首次带固定时钟时 4.4 失效夹具因 SQL 时间基准被固定时钟推后而失败，改真实时钟后通过） | 2026-10-25 15:34 |
| `CHECK_FIXED_TIME=2026-10-22T02:00:00Z CHECK_WORKER=true ./scripts/run_check_isolated.sh node scripts/check_task_form.js --base-url {base} --database {db} --output ../audit/2026-10-25/chapter10-task-form.json --screenshot-dir ../audit/2026-10-25` | `backend/` + headless Chrome | 85/85（固定时钟需早于任务夹具的 10-23/10-24 日期） | 同上 |
| `CHECK_FIXED_TIME=2026-10-25T04:00:00Z CHECK_WORKER=true ./scripts/run_check_isolated.sh python3 scripts/check_review_routing.py ...` | `backend/` | 79/79 | 2026-10-25 15:31 |
| `... python3 scripts/check_handover_preset.py ...` | `backend/` | 29/29 | 同上 |
| `... python3 scripts/check_submit_lock_deadline.py --database {db} ...` | `backend/` | 5/5 | 同上 |
| `CHECK_WORKER=true ./scripts/run_check_isolated.sh node scripts/check_handover_browser.js --base-url {base} --width 390 --height 844 --output ../audit/2026-10-25/chapter10-handover-browser.json --screenshot-dir ../audit/2026-10-25` | `backend/` + headless Chrome | 23/23（更新旧夹具/入口后；见 10.2 说明） | 2026-10-25 15:38 |
| `CHECK_FIXED_TIME=2026-10-25T02:00:00Z CHECK_WORKER=true ./scripts/run_check_isolated.sh python3 scripts/check_deadline_reminder_notification.py --base-url {base} --output ../audit/2026-10-25/chapter10-deadline-reminder.json` | `backend/` | 91/91 | 同上 |
| `check_logs_profile_browser.js` 390×844 / 1440×900 | `backend/` + headless Chrome | 26/26、26/26 | 2026-10-25 15:52 |
| `check_tags_comments_browser.js` 390×844 / 1440×900 | 同上 | 23/23、23/23 | 2026-10-25 15:53 |
| `check_notification_browser.js` 390×844 / 1440×900 | 同上 | 23/23、23/23 | 2026-10-25 15:55 |
| `check_home_calendar_browser.js` | 同上 | 34/34（月格调高、连续月份、日轴/重叠/全天、表格返回、三尺寸悬浮创建） | 2026-10-25 15:57 |
| `check_account_browser.js` | 同上 | 18/18（手机号改号/旧号失效、管理员重置） | 2026-10-25 15:58 |
| `KEEP_ISOLATED_DB=1 CHECK_WORKER=true ./scripts/run_check_isolated.sh bash -c 'python3 scripts/prepare_demo.py ... && python3 scripts/prepare_demo.py ... && node scripts/check_demo_flow_browser.js ...'` | `backend/`（连续两次准备 + Web 流程） | `chapter11-demo-prep-1/2.json`：第二次 created 全 0、reused 76 任务/1 评论/1 标签；`chapter11-demo-web.json` 15/15 | 2026-10-25 15:47 |
| 独立演示库（`pandora_demo_e13`，端口 18150）两次准备→重启后端→第三次准备，并用 mysql 查询计数 | `backend/` | `chapter11-demo-db-persistence.txt`：三次计数一致（10 公司事项、93 任务/76 演示、4 未发布、18 日志、2 标签、3 评论、254 通知）；6 个手机号登录员工 | 2026-10-25 15:50 |
| `node --check` / `python3 -m py_compile` for edited Web modules and new scripts | repository / `backend/` | 全部通过 | 2026-10-25 15:55 |
| Previous session：`check_mobile_calendar.js`（13）、`check_calendar_sort.js`（4）、`check_home_calendar_browser.js`（22）、`check_work_logs.py`（34）、`check_logs_profile_browser.js`（25）、`check_tags_comments.py`（41）、`check_tags_comments_browser.js`（23）、`check_notification_browser.js`（23）、`check_deadline_reminder_notification.py`（91） | `backend/` | 见 `audit/2026-10-25/chapter5-*`、`chapter6-*`、`chapter7-*`、`chapter8-*` | previous session（保留原样，本轮未把旧结果冒充新运行） |

Not run / blocked in this session:
- 10.4—10.8：旧套壳导航/容器补丁、完整资源同步、APK 重建、设备覆盖升级、构建文档复现。用户明确跳过；本机也无原签名密钥、Android SDK/apktool、adb/真机。
- 11.2 的套壳一半：无安装包/设备；只完成 Web 连续演示。
- 第 1—4 章的部分旧检查本轮未全量重跑（仅重跑了受影响的创建流程/路由/交接/截止/任务表单）；旧证据仍在 `audit/2026-10-25`。

## Verification Reminders

- **旧套壳整体未交付（最重要）**：`android-shell/`、`android/` 均无改动；没有 APK、没有签名/版本/资源摘要、没有设备升级证据。10.4—10.8 与 11.2 不能视为完成，也不能据此归档 change。若需要继续，需提供原 debug keystore、Android SDK/构建工具、apktool 及测试设备。
- **管理端任务入口**：`GET /api/v1/admin/tasks` 依赖 `view_task_history` 能力，项目内只有管理员角色拥有；不要用员工 `/api/v1/tasks` 的结果替代“全公司定位”证据。返回体只有展示字段，新增字段时须继续排除手机号/邮箱/密码。
- **历史人员名映射**：`taskHistory` 新增 `people`（id→displayName）和 `originalCreatorName`，仅为显示有序负责人/改派/交接；不含联系方式。验证时不要把它当成新的隐私通道。
- **团队入口路径**：员工 Web 的受限入口读取 `/api/v1/me/team-management`，写入仍复用 `/api/v1/admin/teams`。`admin` 前缀不代表仅管理员可用；服务端按 `manage_team` + 本部门重新鉴权。管理员 `/me/team-management` 返回 403 是刻意的。
- **通知撤回边界**：9.3 的 180 秒边界依赖 `PANDORA_CLOCK_CONTROLLABLE=true` 与 worker；普通运行看不到 `clock/advance`。撤回只改通知副本，业务申请/任务/审计不变（已断言）。
- **任务创建审核夹具**：`check_handover_browser.js` 的审核人改为按记录解析；`searchAndOpen` 改走任务表单，因为第 5 章已移除日历名称搜索；交接预设入口在“我的→个人设置”内。这是跟随当前实现的夹具修复，不降低断言。
- **演示数据来源**：11.1 使用显式 `prepare_demo.py`，不是改 `DemoSeed`；它要求已启动的后端与 worker。重复运行按标题/日期/评论/公司事项幂等；`pandora_demo_e13` 已在验证后删除，可由脚本重建。通知数会随 worker 多次投递/重跑略有变化，不应把 254 当成固定断言。
- **11.2 仅 Web**：`chapter11-demo-web.json` 明确 `scope: web only; legacy shell and device not verified`。不要把它当成套壳证据。
- **浏览器非真机**：所有 headless Chrome 结果只证明 Web 行为，不等于 Android WebView、系统键盘/返回、双指手势或设备安全区。
- **旧版布局脚本未用作 10.3 证据**：`check_chapter11_browser.js` 的任务表单断言已跟随 4.1 更新，但其后的“写日志”段落仍假设创建任务弹层可被直接关闭；当前实现里弹层关闭后会被既有交互重新显示，导致该脚本在日志布局处中止。该脚本只用于旧版 AI/布局抽查，10.3 的日志/标签/评论/通知/资料/首页路径由上面的专用检查覆盖。若验证方要恢复该脚本，需要单独排查弹层关闭与重开时序，不能把它计为通过。
- **未提交**：全部改动仍在工作区（`ba0cb89` + dirty），提交前请复核 `git diff`；`audit/2026-10-25` 下 JSON/PNG/日志为本轮证据，`audit/chapter4-*.png` 为旧证据。
- **本轮验证边界**：以上均为 apply 自测，不是独立 e13 验证结论；不要修改 `verification.md` 或把本文件当作 PASS。
