# Implementation Notes

- Change: fix-web-calendar-notification-and-demo-polish
- Schema: spec-driven
- Store: local（仓库内 `openspec/`，无 store）
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice`（根目录员工 Web + `backend/`）
- Updated: 2026-11-13T11:28+08:00
- Implementation revision: `4ec2ff3` + 未提交工作区（本轮改动全部未提交；范围见 7.3 行）
- Progress: 17/17 tasks complete（等待独立 e13 验证）

## Implementation Map

| Task / requirement / scenario | Code and tests | Decisions / context |
| --- | --- | --- |
| 1.1 通知列表固定高度 | `潘多拉-交互原型.js` `renderSheet()` 按栈顶 `view.noticeList` 切换 `is-notice-list`，空栈时移除；`潘多拉-正式版.css` 定义手机 `calc(--app-height - 顶部安全区 - 14px)`、桌面 `calc(--app-height - 48px)` 的 height+max-height | 只约束通知列表；详情/资料/表单保持原高度。高度沿用现有 `.sheet` max-height 公式，不是按内容测量缓存，也不是固定像素 |
| 1.2 不泄漏 / 条件与位置保持 | `backend/scripts/check_apply_notifications_browser.js` 新增 `is-notice-list` 状态断言、模式/类型切换、加载/单条/空/失败/分页外框矩形比较、关闭后开其他弹层、详情返回、切账号、320×740 / 390×844 / 1440×900 / 390×600 适配 | 加载/空/失败/分页用 `Pandora.request` 注入受控响应，验证状态而不是伪造数据 |
| 2.1 事项三态统一 | `潘多拉-每日事项.css` 新增 `--daily-open/done/overdue(+bg/ink)`，条 `.daily-bar.is-completed/is-overdue`、清单 `.daily-row.is-*`、详情 `.daily-detail-head.is-*` 共用；`潘多拉-每日事项.js` 修正 `is-done`→`is-completed` 不匹配 | 完成灰 `#8b8f98`、待做蓝 `#3b6fd8`、逾期红 `#c0463a`；完成优先，逾期按公司今天与含首尾结束日 |
| 2.1 跨日完成/取消/刷新同步 | `潘多拉-每日事项.js` `toggleItem()` 写后回读时同步**所有**已加载日期清单缓存（此前只更新当前打开的一份，属本轮验证发现的真实缺口）；`check_daily_items_browser.js` 用真实 3 日记录验证条跨度、三份清单、取消与刷新 | 条仍由 `refreshDates` 刷新所有覆盖日；清单缓存逐份同步以避免切换日期读到旧状态 |
| 2.2 移除重复可见状态文字 | 月份图例（`.daily-status-legend` 模板与 CSS）、清单 `daily-row-meta` 的状态词、详情 `.badge`、表单“起止日均包含；跨日仍是同一条事项。”均移除；状态改由 `.daily-detail-head .sr-only`、`daily-text`/`daily-check` 的 `aria-label` 与 `aria-checked` 承载 | 保留正文、真实起止日期、完成控件名称；不修改用户正文中的同词 |
| 3.1 月视图鼠标/触摸统一长按 | `潘多拉-日程视图.js` `bindScheduleResize` 中 `pointerType==='touch' || mode==='month'` 均走 `startSchedulePress`；`startSchedulePress` 记录真实 `touch` 标记，激活时才 `beginScheduleDrag`；门槛前不 preventDefault / 不捕获 / 不建拖影 / 不设点击抑制；Escape 取消待激活候选 | 日视图鼠标保持原即时拖动；真实端点走同一 `data-resize` 绑定，因此同口径 |
| 3.2 门槛前滚动与激活后行为 | 同一处；`check_schedule_drag_browser.js` 真实鼠标短按（端点/条体/日期数字/空日/跨日条中间日/+N）与 700ms 长按对比，另加合成触摸短按与长按 | 短按无拖影、无轻量确认、`openScheduleChange` 调用数不变；长按后仍走原轻量确认与审核/版本/幂等 |
| 3.3 回归助手等待长按 | `check_schedule_drag_browser.js` `drag()` 对月视图先等 320ms 断言“无拖影”再等 420ms；日视图断言不变 | 月历最短高度折叠后可出现真实 `+N`，用于短按命中证据 |
| 4.1 人员月历轨道 | `潘多拉-手账主题.css` 删除旧 `grid-template-rows:repeat(3,44px)`/`repeat(3,28px)`、`height:194px`、旧绝对定位/透明容器声明；轨道统一 `--staff-lanes`/`--staff-row`（3×18px + 2px 间距 + 1px padding = 60px），待审仅保留内描虚线不再叠 2px 边框 | 不靠提高 z-index 或 overflow:hidden 掩盖冲突 |
| 4.2 +N 显式日期列 | `潘多拉-个人资料.js` `staffOverflowHTML` 输出 `style="grid-column:<col+1>"`；隐藏条 `.is-hidden{display:none}` 不绘制不命中 | 保留完整隐藏计数，不依赖跳过空列后的自动排布 |
| 4.3 下属月历几何/命中回归 | `check_subordinate_workspace.py` 增加“首周有空位、仅周四/周日各 4 条任务”的稀疏夹具与一条待审任务；`check_subordinate_workspace_browser.js` 对挂载月份逐周测量日期/轨道/溢出行矩形、条是否越轨、+N 列位与 `elementFromPoint` 中心点命中，并核对下属卡入职/联系方式行 | 只审计当前挂载月份块，避免跨月流其它周干扰 |
| 5.1 本人入职信息去重 | `潘多拉-个人资料.js` `readonlyRows()` 去掉“入职日期/已入职时长”，本人信息卡与下属卡（`staffCardView`）不变；后端 hireDate/tenure 投影未改 | 不按 CSS 行位置隐藏，避免误伤下属与缺层组织 |
| 6.1 演示多标签 | `backend/src/main/java/cn/pandora/seed/DemoSeed.java` 新增稳定 seed key `tag-animation`（湖蓝 `#D8EAF4`，“动画联动”），保留 `tag-focus`；`task-doing`→[focus,animation]、`task-employee-3`→[animation,focus]、`log-employee-0`→[focus,animation]、`log-middle-0`→[animation,focus]；其余任务/日志保留单标签或无标签对照 | 复用现有业务服务/审核与日志维护规则；不增加主线任务数量，不改 manifest 结构或版本 |
| 6.2 演示检查 | `backend/scripts/check_final_demo.py` 改为核对目录至少两种颜色、两篇日志的有序集合、两条任务的有序集合与首标签取色、以及无标签对照（不再硬编码“某日志只有 focus_tag”） | 仍覆盖两次准备不重复、保留真实编辑、四角色、主线父子链 |
| 6.3 演示文档 | `backend/README.md` 增补默认构建并重建、`--keep`/单独重复准备保留编辑、`PANDORA_SKIP_BUILD=1` 需先有含新种子的 JAR，以及“无旧库补数据器/无清表路径”；与 `start-demo.sh`、`prepare_demo.py` 实际参数一致 | 未改启动脚本语义、未加旧库升级器 |
| 7.1 四视口复核 | 通知：`output/apply-notifications/frame-*.png`；事项：`audit/refine-home-daily-items-layout-and-scrolling/daily-vertical-*.png`；月历短按/长按：`output/task-schedule/shortpress-month-390x600.png` + 鼠标/合成触摸命中断言；资料：`audit/prepare-employee-client-contracts-and-business-upgrade/chapter8-profile-*.png`；下属轨道/+N：`output/subordinate-workspace/month-*.png` | 合成触摸与鼠标结果分别记录（见“未覆盖限制”） |
| 7.2 资源版本与打包 | `python3 backend/scripts/update_web_resource_versions.py`；`mvn -B -ntp -DskipTests -Dmaven.repo.local=.runtime/m2 package`；`check_web_resources.py --jar ...` 与 `check_chapter8_web.py` | JAR 内 `潘多拉-每日事项.js` 哈希与源文件一致（`54257cd1fc5e`） |
| 7.3 diff 范围 | 改动仅：根目录 `潘多拉-*.js/.css/.html`、`backend/src/main/java/.../DemoSeed.java`、`backend/scripts/check_*.py/.js`、`backend/README.md`、本 change 与既有 audit/output 证据 | 无 `android/`、`android-shell/`、`flutter/`、Flyway 迁移或 PC 管理端改动 |

## Checks Run

| Command | Working directory / setup | Result / evidence | Run time or revision |
| --- | --- | --- | --- |
| `python3 scripts/check_web_resources.py --repo .. --jar target/pandora-backend-0.1.0.jar --output ../audit/2026-11-13-web-resources.json` | `backend/`；项目 MySQL 已起；JAR 已构建 | PASS 15/15，含“包里含全部引用资源”“字节一致”“版本哈希一致” | 2026-11-13 11:27（11:12 构建后复跑），rev `4ec2ff3`+dirty |
| `python3 scripts/check_daily_items.py` | `backend/`；隔离库 + 真实 Chrome | PASS 73 项 API + 211 项浏览器；三态 computed style `rgb(59,111,216)`/`rgb(139,143,152)`/`rgb(192,70,58)`；跨日条 `2026-11-12 → 2026-11-14` 完成/取消/刷新三份清单一致 | 2026-11-13 11:14（最后一次，含清单同步修复） |
| `python3 scripts/check_apply_notifications.py` | `backend/`；隔离库 + 真实 Chrome | PASS（API + 89 项浏览器）；外框 `390×844→top14/height830`、`320×740→726`、`1440×900→852`、`390×600→586`，加载/空/失败/单条/分页/详情返回全部一致；详情 `height 687` 不带固定类；四视口截图 `frame-*.png` 在弹层打开时拍摄 | 2026-11-13 11:21（11:12 构建后复跑） |
| `python3 scripts/check_schedule_drag.py` | `backend/`；隔离库 + 真实 Chrome | PASS（158 项浏览器）；短按命中：端点/条体/日期 11-10、空日 2030-11-01、跨日条中间日 `2031-02-11 ≠ 起点 2031-02-09`、`+N` `2030-12-31` 列 2；长按门槛前无拖影；合成触摸短按开清单、长按 700ms 激活且未提交无写入 | 2026-11-13 11:18（11:12 构建后复跑） |
| `python3 scripts/check_subordinate_workspace.py` | `backend/`；隔离库 + 真实 Chrome | PASS（100 项浏览器）；稀疏月首周 6 个空列，仅周四 `2027-01-07`（列 4，`+1`）与周日 `2027-01-31`（列 7，`+1`）溢出；四条轨道带互不覆盖；待审 `outline: dashed`；下属卡保留入职/联系方式行 | 2026-11-13 11:18（11:12 构建后复跑） |
| `python3 scripts/check_chapter8_web.py` | `backend/`；隔离库 + 真实 Chrome | PASS（46 项浏览器）；本人信息卡入职日期/时长各 1 行、组织区 0 行；清空 hireDate 后本人卡显示 2 处“入职日期未设置”；320×740 / 390×844 / 1440×900 / 390×600 四视口均去重且无横向溢出 | 2026-11-13 11:16（11:12 构建后复跑） |
| `python3 scripts/check_final_demo.py` | `backend/`；隔离演示库 `pandora_precheck_demo_*`，两次准备 + 重启真实 JAR | PASS（94 项，`report result=PASS`）；目录≥2 种颜色、`log-employee-0`=[focus,animation]、`log-middle-0`=[animation,focus]、`task-doing` 与 `task-employee-3` 有序双标签且首标签取色 `#F6D5D2`/`#D8EAF4`、无标签对照为空；两次准备不重复且保留管理员改名校验 | 2026-11-13 11:19（11:12 构建后复跑；`counts.tasks=62`、`task_versions=73`） |
| `mvn -B -ntp -DskipTests -Dmaven.repo.local=.runtime/m2 package` | `backend/` | BUILD SUCCESS；复跑 `check_web_resources` 校验 JAR 内 `潘多拉-每日事项.js`=`54257cd1fc5e` 与源一致 | 2026-11-13 11:12 |

## Verification Reminders

- **前置依赖（必须先处理）**：`align-web-employee-client-with-nov08-guidance` 仍未归档，是本轮规格基线（尤其 `Daily-item span labels and status` 尚未进主规格）。本轮归档前必须先同步/归档它，再本轮；不能用本轮规划或实现记录宣告任一 change 验证通过。`openspec validate fix-web-calendar-notification-and-demo-polish` 当前返回 “valid” 但同时提示：archive 会因 `MODIFIED` 的 `Daily-item span labels and status` 在未合并的主规格中找不到而拒绝——这正是该前置依赖，不是本轮实现缺陷。按仓库 `AGENTS.md`，归档前还需提醒用户先完成 `prepare-employee-client-contracts-and-business-upgrade`（已归档）之后的 `build-flutter-employee-android-client`（Flutter 员工 Android 客户端）。
- **触摸结论的边界**：月视图触摸只用 CDP `Input.dispatchTouchEvent` 合成事件验证（短按开清单、长按 700ms 激活拖动、未提交无写入）。本机无实际手机，**未**实测真实设备震动/滚动惯性/边缘自动滚动；不得把合成结果当作真机证据。
- **未运行 `start-demo.sh`**：默认重建会 drop/重建用户演示库 `pandora_demo`，本轮按设计用隔离目标库验证种子与准备语义，并逐条对照 `backend/scripts/start-demo.sh`、`prepare_demo.py` 参数与文档。若需人工看新演示主线，需显式执行默认（非 `--keep`）启动，且先有含新种子的 JAR。
- **固定高度只覆盖通知列表**：`is-notice-list` 仅由 `noticesView()` 的 `noticeList: true` 触发；若后续新增其他“长列表”弹层想复用，需要显式加该标记并有对应回归，不能直接改所有 `.sheet` 高度。
- **`toggleItem` 的清单缓存同步**属于本轮验证中新增的修复：只在 `daily-items` 回归覆盖（3 日记录 × 3 份清单 + 刷新）。分页超过一页的清单只同步已加载项，未加载页仍以服务端为准。
- **人员月历 `+N`**：当前实现同时依赖 `.staff-month-overflow` 的 7 列网格与按钮的 `grid-column`；若以后把该容器改为非 7 列网格，需要重新核对 `check_subordinate_workspace_browser.js` 的列位断言。
- **审计证据文件被重写**：运行既有回归会覆盖 `audit/refine-home-daily-items-layout-and-scrolling/` 与 `audit/prepare-employee-client-contracts-and-business-upgrade/` 下的历史证据文件（由检查脚本自身写出），属预期行为，不是本轮实现产物。

## Build / Revision Note

最后一次代码改动为 `潘多拉-每日事项.js` 的 `toggleItem` 清单缓存同步（11:12 重新构建 JAR）。上文全部七项检查均在该构建之后复跑通过，报告来自同一 JAR 字节。

## Current Task Progress

17/17 tasks 已勾选完成，未暂停。等待独立 `openspec-e13-verify-change fix-web-calendar-notification-and-demo-polish`；本文件不构成验证结论。
