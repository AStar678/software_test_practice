# Implementation Notes

- Change: redesign-subordinate-workspace
- Schema: spec-driven
- Store: local（仓库根 `openspec/`）
- Implementation roots: /Users/watuji/MyGitDev/software_test_practice
- Updated: 2026-11-01T19:15+08:00
- Implementation revision: `71ec623` 之上未提交的工作区（`潘多拉-个人资料.js`、`潘多拉-手账主题.css`、两个专项脚本、文档、任务与交接）；本 change 未创建 commit。
- Progress: 5/5 tasks complete。本文件是实施交接，不是独立验证结论；`verification.md` 保留首次 FAIL 原文。

## Implementation map

| 任务/场景 | 实现 | 检查 |
| --- | --- | --- |
| 1.1 真实下属树（V-002） | `潘多拉-个人资料.js` 新增 `P.staffOrgLine`：身份/职位与真实部门/团队分别拼接，无部门显示“公司层”；节点模板改用该行，不再用 `positionName||teamName||departmentName` 互斥回退 | 浏览器：节点同时含职位/部门/团队；四种身份与公司层的纯函数断言；320/390/1440 截图 |
| 2.1 独立日程（V-001） | 月/日/全天/清单读取 `executionState`；月条、日轴、全天按钮增加 `is-done`、删除线/淡色和“已完成”文字；月历使用共享 `monthWeek` 日级几何（随排期 change 更新），不再按小时缩窄；下属月/日/全天/清单无 `data-schedule-move`/`data-resize-task`；待审虚线框按提议位置 | `check_subordinate_workspace.py` 82 项：完成状态四种呈现、所选人过滤、跨日/午夜/零时长、13 项分页可达、无拖动；`check_schedule_drag.py` 211 项覆盖下属待审提议位置（reject/withdraw）与通过后实线 |
| 2.2 日志/返回/详情权限 | 日志 10+2 分页、详情评论、返回保留人员/页签/日期；详情按当前用户原权限显示：`check_subordinate_workspace.py` 新增团队负责人查看自己创建任务（可编辑+可调时）与仅可见任务（仅调时、无基础编辑）两种情况；他人日志正文只读、失权清空、旧响应/换账号丢弃沿用 | 浏览器断言 + 既有 82 项中的失权/重试/快速换人/换账号 |
| 3.1 集成交付 | 隔离 API/浏览器 320/390/1440；构建、打包资源、本地 8080 预览以 `pandora_demo` 原数据重启；更新 `backend/docs/subordinate-workspace.md` 与实施交接 | 见下表 |
| 4.1 月/日追加验证 | 旧小时比例/下属可拖动断言更新为日级几何与无拖动；跨年翻月、跨周/月条、+N、日轴重叠/全天/午夜/零时长/完成；待审新位置与终态（通过/驳回/撤回）；详情权限保留 | `check_subordinate_workspace.py` + `check_schedule_drag.py` 下属段落 |

## 本轮实际检查（2026-11-01，项目根目录）

浏览器 `CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`；集成脚本各自创建并清理随机测试库，不连接演示库或云端。

| 命令 | 结果 / 证据 |
| --- | --- |
| `cd backend && mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package` | 111 项单元测试，0 失败/错误/跳过；BUILD SUCCESS |
| `python3 backend/scripts/check_subordinate_workspace.py` | 退出 0；**82** 项（原 71）。`output/subordinate-workspace/browser-report.json`；新增 completed/org/详情权限断言与截图 |
| `python3 backend/scripts/check_schedule_drag.py` | 退出 0；**211** 项；下属待审提议位置在驳回与撤回两种决策下验证，通过后下属月条回到实线新时间 |
| `python3 backend/scripts/check_task_creation_refinement.py` | 退出 0；36 API + 39 浏览器（回归自查/表单/通知） |
| `python3 backend/scripts/check_calendar_drawer.py` | 退出 0；102 项 |
| `cd backend && python3 scripts/check_web_resources.py --repo .. --jar target/pandora-backend-0.1.0.jar --output ../audit/.../web-resources-staff.json` | 14/14；资源与源码逐字节一致，`?v=` 与当前哈希一致 |
| 本地预览（`service.py stop demo` 后用当前 JAR 以 `pandora_demo` 重启） | health=UP；个人资料.js、手账主题.css、日程 JS、api JS 与源码 SHA256 一致；未重建演示库 |
| `node --check`（个人资料/专项脚本）、`openspec validate redesign-subordinate-workspace --strict` | 通过 |

## Verification reminders

- V-001 修复的是**呈现**：完成状态在月条、日轴、全天按钮和清单都有 `is-done` 及“已完成”文字；不是只改清单。
- V-002 修复的是**组织行**：`P.staffOrgLine` 不再用职位顶替部门/团队；验证时同时看节点文本与四种身份的纯函数输出（含无部门“公司层”）。
- 下属页面**没有**拖动绑定：`bindScheduleResize` 只作用于本人日程页根节点；下属月/日/全天/清单 0 手柄。详情入口仍按当前用户原权限显示（本轮用“团队负责人查看自己创建任务可编辑、查看他人任务仅调时”验证）。
- 待审虚线在月历按日级、日轴按真实时段；驳回/撤回保持提议位置，通过后下属月条回到实线新时间。下属终态覆盖通过（approve→19:00 实线）与驳回/撤回（待审提案仍显示）；失效终态由排期 change 的自有日历段落覆盖，共用同一投影代码。
- 日志返回重新读取第一页，不承诺保留已加载页数或滚动位置；本人日志/日历/任务表单范围未改。
- 已刷新 `潘多拉-交互原型.html`/`admin.html` 的资源版本号；再次修改资源后需重新刷新。
- 共享排期 change 的更新已包含：日级月历、日轴小时、下属无拖动。旧“下属可拖动/小时比例月条”检查结果不得作为本 change 证据。
- 未进行手机真机/软键盘测试；未发布云端、未推送 Git、未归档。

## Historical（仍有效）

- 首次实现基于 `f29f9fd` 并已发布；旧记录中的 `/Users/aoxiang/Desktop/软件测试`、旧 revision 与“未发布”状态由发布追记和本记录取代。首次独立验证 V-001/V-002 已在本轮修复。
