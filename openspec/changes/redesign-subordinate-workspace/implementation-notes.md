# Implementation Notes

- Change: redesign-subordinate-workspace
- Schema: spec-driven; Store: local
- Project: /Users/aoxiang/Desktop/软件测试
- Updated: 2026-10-31 (Asia/Shanghai)
- Revision: ec675ae843b384ca1863ba9fa60dbf728928be42，同一脏工作区未提交。用户明确要求单独建立新变更；已有两个变更保留各自范围，未归档。
- Progress: 5/5实施完成（含本轮月/日视图追加）；本记录不是独立验证结论。云端未发布，用户此前取消手机真机测试，本轮仅真实浏览器尺寸模拟。

## Implementation map

| 任务/场景 | 代码和测试 |
| --- | --- |
| 1.1 全后代树 | 潘多拉-个人资料.js reportsSection按reports.managerId构树，固定展开与人员按钮分离，姓名/职级/职位分行，expandedReports会话清理；check_subordinate_workspace验证创始人三级展开、团队负责人和普通员工，API验证部门/团队后代与跨部门拒绝 |
| 2.1 独立日程 | 同模块staffView独立全屏、身份/资料、日程日志页签、七天日期按钮与前后七天导航。读取tasks assigneeId及公司日期，遍历当天全部分页后按开始排序，半开区间裁剪午夜和点任务；界面不放置拖动编辑。主题CSS为独立staff组件，非本人主页面复用 |
| 2.2 日志/返回/状态 | authorId日志每页10条可加载更早，短摘要点击原详情评论；view.rebuild返回保留人/页签/日期并重新校验关系和读取。人员/内容API独立裁决，失权或读取失败清空列表与联系方式/代办标记。epoch+request sequence+当前可见panel阻止旧响应渲染。backend/docs/subordinate-workspace.md记录使用方式 |
| 3.1 集成 | check_subordinate_workspace.py / _browser.js独立fixture，真实授权断言、分页/边界/详情/旧响应/失权/重试/范围隔离，320/390/1440截图；本地8080预览保持原数据库 |

## Checks actually run（首次实施历史结果）

工作目录：项目根目录。CHROME_BIN=/Users/aoxiang/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing。

| 命令 | 结果 / 证据 |
| --- | --- |
| python3 backend/scripts/build_refinement_verification.py | 最终成功打包，111单元测试0失败/错误/跳过；output/staff-build.log、backend/target/surefire-reports。沿用临时POM排除既有* 2.java副本，不删除用户重复文件 |
| CHROME_BIN=… python3 backend/scripts/check_subordinate_workspace.py | 39浏览器检查通过，无浏览器异常，另含API后代范围/普通员工空树/跨部门日志404及任务空集断言；output/staff-check.log、output/subordinate-workspace/browser-report.json。数据库随机创建、自动清理，不读云端正式数据 |
| JS/Python语法、git diff --check | 通过 |
| openspec validate redesign-subordinate-workspace --strict | 通过 |
| 本地预览健康/资源SHA256 | /health=200，个人资料.js与手账主题.css的HTTP资源和源码相同，保留原演示数据库 |

人工查看tree-320/390、schedule-320/390/1440、logs-320/390截图，深层名字可读，无横溢，桌面内容宽680，小屏无底部重复关闭按钮，页头关闭可达。fixture英文姓名用于长名字验证，未显示为真实业务数据。

实施修正：首轮已通过，截图发现桌面内容自动缩成窄列，增加width:100%和max-width约束；删去重复底部关闭为小屏腾出空间。快速切换使用专用异步序列而非全局busy拦截，避免前一请求未结束时新选择卡在加载；最终回归包含故意延迟旧响应、切页签后释放旧响应、模拟丧失下属关系后重试。失权时清除人员电话和代办标记。

## Verification reminders

- 复核目录父子关系来源和权限范围；UI目录不能替代任务/日志授权。
- 复核person→task/log详情的返回与组织变化，日志more分页、午夜/点任务、快速切人/换账号时序。
- 视图只主动展示所选人当前负责的正常已发布任务；不展示仅创建但不负责或待创建内容。
- 返回日志详情后重新读取日志第一页，页签/人/日期保留；加载更多仍可达。未承诺保留父页滚动偏移或已加载页数。
- 原profile平铺列表的旧浏览器断言不代表本轮需求，本轮使用新专项检查；没有重跑全部历史UI脚本。
- 共用前两个未归档变更的代码基础，无独立checkout；本变更仅修改个人资料模块、主题及本轮测试/说明。没有数据库迁移或后端权限改动。
- 独立验证与归档尚未进行，不能把本实施检查当作独立PASS。云端和安卓真机均未更新/测试。


## 月/日视图追加实施（2026-10-31）

用户确认纳入同一变更。此前“仅七天导航和每日清单”的设计已由月/日视图取代，当前规划与任务为准；原39项结果为历史，不代表追加要求已经验证。

- 2.1 / 4.1：个人资料模块增加默认月视图、模式切换、公司日期选择和今天/前后月或天导航。月网格周一至周日，使用P.calendar.monthWeek纯投影算法显示跨周/月连续条和+N；点击日期/+N进入完整日视图，月任务可进入详情并返回原模式。
- 日视图复用P.calendar.dayCoverage/layoutDayEvents计算完整00:00—24:00轴、重叠分栏、点任务和独立全天区，保留任务清单切换，窄屏有内部纵向滚动。按整月网格/当天区间读取全部授权分页，再进行半开区间裁剪；不使用本人viewTasks或写入本人日历状态。
- 3.1：主题新增局部staff日历样式，无拖动修改入口。320/390/1440测量及截图通过；月历溢出不丢任务，8个重叠/点任务在轴上分栏，两项整日覆盖独立展示。
- 个人资料、主题、专项测试与backend/docs/subordinate-workspace.md更新；后端/数据库未变，原演示库保留。

本轮命令（项目根目录，CHROME_BIN同前）：

| 命令 | 实际结果 / 证据 |
| --- | --- |
| python3 backend/scripts/build_refinement_verification.py | 最终成功，111单元测试0失败/错误/跳过；output/staff-calendar-build.log |
| CHROME_BIN=… python3 backend/scripts/check_subordinate_workspace.py | 最终月/日与原工作页专项回归全部通过；output/staff-calendar-check.log、output/subordinate-workspace/browser-report.json。56项检查全部通过；覆盖跨年翻月、月份跳转、跨周/月条、+N、全部日内任务、日轴/清单、返回模式、原日志/权限/旧响应/失权/重试。截图month-320/390/1440和day-axis-320/390/1440 |
| openspec validate redesign-subordinate-workspace --strict、JS语法、git diff --check | 通过 |
| 本地预览 | 8080健康200，个人资料.js和手账主题.css的HTTP资源与源码SHA256一致，数据库保留 |

修复及检查过程：首次月历点击测试假设某个指定任务一定在前三个可见槽，实际该任务可按稳定排序进入+N；改为点击实际可见的跨周任务，并通过+N检查全部日内任务。截图发现长时间任务文字竖向居中，显式flex顶部对齐，新增文字顶边断言并复跑。长需求拆为组织工作页和下属月/日日历两条，保持全部场景，strict验证通过。

独立验证提醒：重点检查月网格范围、跨月/午夜半开边界、+N与默认月视图、日期选择及轴/清单切换；本轮代码仍是先前同一脏工作区。真机已取消，云端未更新，未进行独立验证或归档。
