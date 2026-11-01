# Implementation Notes

- Change: fix-hourly-schedule-drag-and-log-type
- Schema: spec-driven
- Store: local（仓库根 `openspec/`）
- Implementation roots: /Users/watuji/MyGitDev/software_test_practice
- Updated: 2026-11-01T18:40+08:00
- Implementation revision: `89658be` 之上未提交的工作区；本 change 的前端/脚本/文档改动未创建 commit。
- Progress: 14/14 tasks complete。本文件是实施交接，不是独立验证结论；`verification.md` 保留首次 FAIL 原文不变。

## Implementation map（本轮重新打开的部分）

| 任务/场景 | 实现 | 检查 |
| --- | --- | --- |
| 2.1 月历按天、日轴按小时 | `潘多拉-日程视图.js` `monthWeek` 返回日级 `left/width`；`shiftCompanyDays`/`proposedRange(...,mode)` 使 month 每步 1 公司日、vertical/day/allday 每步 1 小时；`bindScheduleResize` 按 mode 取步长；触摸先判方向（纵向滚动、横向拖动） | `check_schedule_drag.py` 192 项：整条/端点按天、跨年、分钟保持、取消/捕获、触摸滚动与触摸拖动 |
| 2.2 V-001 全天区操作 | `allDayHTML` 改为可聚焦框体 + `.p-allday-move` + 真实端点，`data-resize-mode=allday`；历史 allDay 与定时 fullDay 均按日轴小时步长进入原确认流程，仍在全天区只显示一次 | 专项真实鼠标/触摸/键盘：端点与整条平移、保存、分钟/另一端、键盘方向键、320 可达 |
| 3.1 集成与说明 | `backend/docs/hourly-schedule-drag.md` 重写为日级月历/日轴小时/全天区/下属无拖动；本地 8080 预览以 `pandora_demo` 原数据重启 | 资源哈希一致；health=UP |
| 4.1（既有） | `TaskService.taskView.pendingSchedule` 最小五字段、`calendarPreview` 范围 | 保持不变 |
| 4.2 待审日程日级/真实时段 | 本人/下属月历按日级几何绘提议日期，日轴按真实时段；无新排期保持原位置虚线；标签色与“审核中”保留；详情/表单/提醒仍有效版 | 专项：推进/完成/重开/交接待审、跨月、下属、终态恢复 |
| 4.3 待审验证 | 专项覆盖刷新/重登、跨日跨月、通过/驳回/撤回/失效、创始人免审直接实线 | `check_schedule_drag.py` 末段真实审核 |
| 5.2 月历日级框 | `monthWeek` 取消小时比例；09:00—12:00 与全天任务同为一日格；午夜不占次日；零时长保留零工期并用 CSS 时点圆点标识 | 新增专项断言：三小时/整日同宽同偏移、`data-span=1`、午夜只占本日 |
| 5.3 权限与回归 | 仅排期 API 与审核路线未改；页面拖动入口收窄到本人日程 | `check_visible_schedule_permissions.py` 21 项；专项未发布/冻结/完成/失权拒绝 |
| 6.1（既有） | `newRequestId` 强随机 v4、重试槽 | `check_request_id_compat.py` 通过 |
| 7.1 框内文字、无按钮 | 月历 caption 在日级框内；日轴 caption 在真实时段层；无调时/起止按钮；透明边缘与键盘保留；下属只读入口 | 专项 caption 几何、无 `button`、焦点/方向键 |
| 7.2 待审位置/文字与入口 | 月历日级、日轴真实时段；本人可拖、下属不可拖但可进详情；320/390/1440 截图 | 专项 + 下属专项 71 项 |
| 8.1 入口与详情权限分离 | `bindScheduleResize` 只绑定 `#page-view`（本人日程页根节点）；`潘多拉-个人资料.js` 下属月/日不再生成 `data-schedule-move`/端点，也不再调用共享绑定；任务表单为弹层，不含画布控件 | 专项：本人有手柄，下属月/日/清单 0 手柄，表单 `#sheetBody` 无拖动控件；普通详情仍按原权限 |

## 本轮实际检查（2026-11-01，项目根目录）

浏览器 `CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`；集成脚本各自创建并清理随机测试库，未连接 `pandora_demo` 或云端。

| 命令 | 结果 / 证据 |
| --- | --- |
| `cd backend && mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package` | 111 项单元测试，0 失败/错误/跳过；BUILD SUCCESS |
| `python3 backend/scripts/check_schedule_drag.py` | 退出 0；**192** 项（原 166）。`output/task-schedule/browser-report.json`，截图 `partial-month-*`、`allday-handles-320/390.png`、`vertical-hour-*`、`pending-*`、`month-touch-*` |
| `python3 backend/scripts/check_subordinate_workspace.py` | 退出 0；71 项；下属月/日无拖动入口，仍可进入详情 |
| `python3 backend/scripts/check_calendar_drawer.py` | 退出 0；102 项 |
| `python3 backend/scripts/check_task_creation_refinement.py` | 退出 0；36 API + 39 浏览器 |
| `python3 backend/scripts/check_visible_schedule_permissions.py` | 退出 0；21 项 |
| `python3 backend/scripts/check_request_id_compat.py` | 退出 0；15 项 |
| `cd backend && python3 scripts/check_web_resources.py --repo .. --jar target/pandora-backend-0.1.0.jar --output ../audit/.../web-resources-schedule.json` | 14/14；打包资源与源码逐字节一致，`?v=` 与当前哈希一致 |
| 本地预览（`scripts/service.py stop demo` 后按 `pandora_demo` 原库重启） | health=UP；日程 JS/CSS、个人资料 JS、api JS、原型 HTML 的 HTTP 内容 SHA256 与源码一致；未重建/未重种演示库 |
| `node --check` 日程/个人资料/浏览器脚本、`openspec validate --strict` | 通过 |

## Verification reminders

- 月历现在是**日级**：`--month-left:0%;--month-width:100%`，小时几何只应出现在日轴与详情；验证时不要再用 9/24、38/72 之类比例作为通过条件。
- 全天区两种任务都用**小时**步长；历史 `allDay` 任务确认后按既有仅排期表单提交显式起止（`allDay=false`，与已确认的“旧全天编辑保留实际时刻”一致），不会静默改写其他字段。若验证认为必须保留 `allDay=true`，需要先更新规划再改实现。
- 拖动绑定只作用于 `#page-view`；下属弹层和任务表单**不应**出现 `[data-resize-task]`/`[data-schedule-move]`。若为恢复旧用例重新全局绑定，属于回退。
- 触摸在月历上先判方向（|dx|>8 且大于 |dy| 才拖动），纵向滚动不受影响；日轴与横向日视图的触摸拖动仍是直接进入拖动。
- 待审虚线框在月历按日级、日轴按真实时段；终结后必须回到有效排期实线，刷新/重登不能残留副本。
- 已刷新 `潘多拉-交互原型.html`/`admin.html` 的 `?v=` 哈希；再次修改任一资源后需重新刷新，否则资源检查失败。
- 8080 预览已用当前 JAR 重启（保留 `pandora_demo`，未重建）；验证时不要把它当作独立验证证据。
- 未进行手机真机/软键盘测试；未发布云端、未推送 Git、未归档。

## Historical（仍有效）

- 首次实现基于 `c1d6073`（当时记录 13/13），并已发布 `https://8.141.96.122:6644`；本轮按新合同重新打开任务并重构，旧“小时比例月条”“下属可拖动”通过项不再适用。首次独立验证的 FAIL（V-001 全天区无拖动）已在本次修复。
- 更早记录中的旧机器路径、旧 revision 和“未发布”状态由上述发布追记与本次记录取代。
