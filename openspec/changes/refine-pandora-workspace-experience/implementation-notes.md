# Implementation Notes

- Change `refine-pandora-workspace-experience`
- Schema `spec-driven`，本地 OpenSpec
- Implementation root `/Users/aoxiang/Desktop/软件测试`
- Updated 2026-11-08 Asia/Shanghai
- Implementation revision `5ebbda27e640cae4dab739273327eee1ff9877a5` 加当前工作区修改
- Progress 16/16 已实施，独立验收另行记录

## Implementation Map

| 任务 | 代码与证据位置 | 实施说明 |
| --- | --- | --- |
| 1.1–1.3 | `潘多拉-日程视图.js`、`潘多拉-每日事项.js`、`潘多拉-每日事项.css`、`潘多拉-工作区接入.js` | 共享日期格、月框架、星期行、密度、补载和日期锚点。公司月历事件捕获限定公司页。首页卡片独立滚动，事件详情重新鉴权。 |
| 2.1–2.2 | `潘多拉-日程视图.js`、`潘多拉-日历.css`、原轻量排期确认 | 年度日期表覆盖 2026、2027。触摸长按后保持指针捕获，通过目标月格确定日期差，日轴按小时。支持的浏览器请求短震，视觉反馈同时呈现。 |
| 2.3–2.4 | `V32__task_table_pins.sql`、`TaskService`、`TaskController`、`潘多拉-任务表单.js` | 表单置顶独立于月历。全结果先筛选、置顶分组、组内排序，再分页。后端重验资格和账号。 |
| 3.1–3.3 | `V33__work_log_references.sql`、`WorkspaceService`、`WorkspaceController`、`潘多拉-工作区接入.js` | 创建提交保存有效排期与本人事项引用。非作者响应不包含私人事项，任务按当前权读取，存量单任务关系和冻结时间保留。 |
| 4.1–4.3 | `V34__employment_start_date.sql`、`OrganizationService`、`OrganizationPlans`、`admin.html`、`WorkspaceService`、`潘多拉-个人资料.js` | 管理端登记公历入职日期，首页和授权资料统一按公司业务日计算。员工日志独立区间查询和连续浏览。 |
| 5.1–5.3 | `潘多拉-工作区接入.js`、`DemoSeed`、`prepare_demo.py`、`backend/docs/current-checks.md` | 通知快捷筛选和更多条件采用现有完整通知集合。演示清单 v3 使用同一项目串联四层账号，保留权限、审批、分页和日期边界场景。 |

## Checks Run

- 仓库根目录执行 `openspec validate refine-pandora-workspace-experience --type change --strict --json --no-interactive` 和 `git diff --check`，通过。
- 仓库根目录对修改的 JavaScript 文件执行 `node --check`，通过。
- `mvn -o -B -ntp -f backend/pom.xml -Dmaven.repo.local="$PWD/backend/.runtime/m2" -DskipTests compile` 遇到本地缓存中 4 个空依赖描述文件。改用现有本地 JAR 的依赖、`javac --release 21 -parameters` 和 JUnit Platform 启动器，重新编译当前主源码和测试源码，111/111 通过。
- `python3 backend/scripts/check_workspace_refinement.py` 使用包含当前源码、资源与迁移的临时测试 JAR，真实 MySQL V31 升级及空库准备通过。表单置顶隔离、日志自动关联和私有事项、入职日期校验通过。通过 `CHROME_BIN` 启用 Chromium 后，320×740、390×844、1440×900 的页面交互通过，覆盖触摸长按、边缘滚动、取消、轻量确认和日志补写。
- `python3 backend/scripts/check_final_demo.py` 在随机命名演示库中检查重复准备、服务重启、账号登录及真实业务记录，57 项通过。

## Verification Reminders

- 触摸浏览器检查用可调用和不可用的 `navigator.vibrate` 验证反馈分支。当前执行环境没有实际手机震动硬件。
- 新演示清单使用 v3。已有 v2 库可使用 --keep 保留，需新演示库查看新版初始内容。
- 检查公司月历事件捕获仍限定公司页，并覆盖首页事项、员工日志详情返回及区间权限。重点复核跨月拖动的目标命中和置顶跨分页排序。

## 预览反馈增量

- 1.3 首页公告以全高详情显示实际发布时间、全文及其他公告入口。任务看板沿用鉴权任务详情，补充本人派发时间和最近更新时间。
- 2.1 每日事项使用公司日历同一套节日、休假、补班标记，保留独立的数量和日清单。
- 4.3 员工日程与日志共用双向月份窗口和滚动锚点。日程按授权员工和月份加载，拥有独立位置，跨月日期去重。失败范围可单独重试，权限失效清除显示数据。
- 重跑 `python3 backend/scripts/check_workspace_refinement.py`，MySQL 实库检查及 Chromium 320×740、390×844、1440×900 通过，390×844 同时覆盖员工和创始人。Java 后端及迁移源码沿用前次验收版本。

## 节假日接口及自动同步

- 2.1 的 `HolidayController` 启动后定时检查北京时间当年和次年的公告数据，服务端请求与后台任务共用缓存。接口合并次年公告涉及当年十二月的日期。短时故障保留最近成功结果并自动重试。
- `潘多拉-日程视图.js` 为可见日历定期重新读取年份数据，在原日期格更新标记和无障碍文本。同步机制只更新节假日标记。
- `check_workspace_refinement.py` 用隔离数据库与可控时钟验证无人请求时同步、首次发布、日期修订、跨年归属、上游故障及恢复。浏览器脚本验证可见性变化触发原地更新并保留焦点与滚动。Java 21 编译及 JUnit 111/111 通过。8081 读取了真实来源的 2022、2023、2026 和 2027 数据，前端资产与工作区一致。
