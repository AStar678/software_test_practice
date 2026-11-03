# Implementation Notes

- Change: `fix-notification-personnel-and-detail-navigation`
- Schema / store: spec-driven / repo-local
- Implementation root: `/Users/aoxiang/Desktop/软件测试`
- Updated: 2026-11-03 20:12 Asia/Shanghai
- Revision: base `d19d068`，本次代码、测试及文档由用户要求提交至 `ax_feature`，最终提交标识以 Git 记录为准。原有 audit 修改及 Finder 副本未清理、未纳入本次范围。
- Progress: 9/9 tracked tasks complete。用户明确要求先单独实施这八项；原四个变更继续待独立验证与归档。本文件为实施交接，不是独立验证结论。

## Implementation Map

| Task / requirement | Code and tests | Decisions / evidence |
| --- | --- | --- |
| 1.1 提醒分类 | WorkspaceService `isReminderEvent`、notificationCategory、notificationPurpose；WorkspaceBatchReadTest；check_notification_personnel.py | 实际 worker 产生 20/10/5 与 overdue 四事件，筛选总数、列表和详情一致，保留旧前缀。 |
| 1.2 原申请与访问权 | WorkspaceService.safeNotification、NotificationBatch、notificationMetadataCategory；工作区接入 notificationView；新增专项 Python/JS | canOpenRequest 复用 TaskService.canReadRequest；请求内按申请去重，不跨请求缓存权限。当前申请人/审核人可打开绑定原申请，普通接收人保留合法状态摘要和处理意见，无效按钮隐藏。闭环不开放新的提议/diff 权限；普通任务对象跳转去重，评论定位保留。 |
| 2.1 人员缓存 | api mapPerson/rememberPeople；任务接入候选缓存；交互原型 assigneeSummaryHTML | 完整资料原位更新、仅姓名摘要合并保留字段；没有依据职位猜身份，部门不以团队替代。工作台目录刷新后重载候选且引用当前人员对象。真实候选资料和创建表单均验证。 |
| 2.2 下属返回 | 交互原型 openSheet/replaceTopSheet/dismissSheet；个人资料 staffView/rememberStaffScroll/restoreStaffAxis | returnContext 由下属工作视图继承到子层，用户关闭逐层返回，内部 closeSheet 仍能完成退出/会话清理。保存原日期、模式和滚动，返回 root 重验 reports/users/tasks；保留 epoch 与请求序号保护。 |
| 2.3 有效置顶入口 | 任务接入 canPin / togglePin | 限已发布且本人为当前有效负责人；只创建/组织可见/下属详情隐藏。本人置顶实际保存回读通过。后端置顶原权限未扩展。 |
| 3.1 冗余资料行 | 个人资料 readonlyRows；工作区 logDetailView/freezeText | 本人、下属及编辑资料复用资料行去除公司；三类日志详情均无编辑权限行，按钮与冻结时间继续依后端 DTO。 |
| 3.2 文案清理 | 六个员工 JS 及主 HTML 资源版本；backend/docs/notification-personnel-refinement.md | 清单记录登录、任务审核/交接、通知、日志评论标签、人员设置、分析的清理及保留项。没有改校验/业务状态或历史数据。 |
| 4.1 / 4.2 集成、构建、记录 | 新专项脚本、现有三套回归、Maven、OpenSpec；backend/docs/current-checks.md | 见下表。未执行手机测试、正式发布或 Git 同步。 |

## Checks Run

所有命令的工作目录均为项目根目录，除表中特别说明。Chrome 设置：`CHROME_BIN=/Users/aoxiang/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`。测试通过现有私有运行时配置连接本机 13306，专用 fixture 创建随机测试库，退出后清理数据库和进程。

| Command | Result / evidence | 本轮说明 |
| --- | --- | --- |
| `python3 backend/scripts/build_refinement_verification.py` | 113 tests，0 failures / errors / skipped；正常 test + package 成功；output/notification-personnel/build.log、backend/target/surefire-reports | 最终源码重新构建。临时 POM 仅排除已有 Finder `* 2.java` 副本，不删除源文件，不修改真实 POM。 |
| `python3 backend/scripts/check_notification_personnel.py` | API 18 + 真实浏览器 75，全部通过，浏览器异常 0；output/notification-personnel/api-report.json、browser-report.json、integration.log | 最后一次运行覆盖最终新增的处理意见展示、无权限入口及候选目录刷新。真实提醒扫描、原申请与后续申请、申请人/审核人/普通接收人、跨公司、撤回与失权、缓存、月日返回、置顶和三类日志。缺失申请由单测补充（正式外键不允许随意删除被通知引用的申请）。 |
| `python3 backend/scripts/check_subordinate_workspace.py` | 72 checks，0 failures，浏览器异常 0；output/notification-personnel/check_subordinate_workspace.log；output/subordinate-workspace/browser-report.json | 本轮回归，包含下属树、月/日、拖动、日志字号、分页、失败重试、失权和迟到响应。 |
| `python3 backend/scripts/check_schedule_drag.py` | 166 checks，0 failures，浏览器异常 0；output/notification-personnel/check_schedule_drag.log；output/task-schedule/browser-report.json | 本轮回归，包含鼠标/触摸/键盘、月历真实小时跨度、申请虚线、取消/拒绝/撤回/到期与权限。 |
| `python3 backend/scripts/check_fixed_notifications.py` | 44 checks，0 failures；output/notification-personnel/check_fixed_notifications.log；output/task-creation-refinement/fixed-notifications.json | 本轮回归，包含评论撤权/删除/撤回、历史只读、标签维护、日志冻结、通知已读/删除、180 秒与保留期。上面三套回归运行后只追加了通知已授权处理意见的一行呈现；最终构建与新增专项在该追加之后完成。 |
| 各修改 JS 的 `node --check`、新 Python 的 `python3 -m py_compile` | 全部成功 | 未引入新依赖。 |
| `git diff --check`；`openspec validate fix-notification-personnel-and-detail-navigation --strict` | 通过 | 所有规划文件、实施任务及规范一致。 |
| 本机预览更新（临时脚本 `/tmp/pandora-refresh-notification-preview.py`） | 8080 health 正常，主 HTML 与 6 个修改 JS 共 7 资源逐字节一致，users/tasks/work_logs 数量保留；output/notification-personnel/local-preview.json | 仅确认的本地演示库，seed=false；无重建或准备数据。正式服务器未操作。 |

实际检查的截图包括 result-390.png、staff-task-detail.png、personal-log-320.png、personal-log-1440.png、staff-320.png；最终截图在同目录。截图覆盖 320×844、390×844、1440×900，人工查看未发现内容遮挡或横向溢出。早期截图的残留登录提示及评论开发说明已修正，最终专项重拍。

### 初次失败与修正

- 新增“申请缺失”单测最初暴露内存测试库把 SQL LEFT JOIN 当必有记录，抛 NoSuchElementException；修正夹具的空关联语义后，113 单测全部通过。没有放宽生产逻辑。
- 专项首次在受限本机网络环境无法连接现有 MySQL，尚未创建临时库；在获准本机执行后完成所有隔离检查。
- 本轮不依赖历史 PASS。没有运行独立 OpenSpec 验证、正式环境业务测试或手机/WebView 测试。

## Verification Reminders

- 独立验证应再次核查普通结果接收人只有已授权通知摘要/意见，没有原申请详情、提议/diff 或旧申请处理后续申请的权限；同时检查被屏蔽、撤回和评论失权的裁剪。
- 注意下属工作详情的头部、页脚关闭、遮罩、Esc 与多层申请/任务返回；返回重读期间的失权、换人、会话切换和迟到响应不得展示旧受限内容。
- 姓名摘要不应降级身份；完整目录的显式空部门/团队应能清除旧组织信息。候选授权、人员手机号及日志范围继续由后端决定。
- 文案清理只针对实际加载的员工产品页面。未重写管理员文案或被适配层替换的示例渲染器，也没有删除已有审计/任务/日志数据。
- 无数据库迁移。本次按用户要求提交并推送至 `ax_feature`；尚未上线或归档。下一步可使用 `$openspec-e13-verify-change fix-notification-personnel-and-detail-navigation` 独立验证，之后再决定归档。
