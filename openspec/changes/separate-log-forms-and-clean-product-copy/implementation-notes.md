# Implementation Notes

- Change: separate-log-forms-and-clean-product-copy
- Schema: spec-driven
- Store: local（仓库根 `openspec/`）
- Implementation roots: /Users/watuji/MyGitDev/software_test_practice
- Updated: 2026-11-01T19:40+08:00
- Implementation revision: `2133e28` 之上未提交的工作区（工作区接入、标签评论、任务接入、交互原型、主题、admin.html、专项脚本、文档、任务与交接）；本 change 未创建 commit。
- Progress: 10/10 tasks complete。本文件是实施交接，不是独立验证结论。

## Implementation map

| 任务 | 实现 | 检查 |
| --- | --- | --- |
| 1.1 独立创建/编辑界面 | `潘多拉-工作区接入.js` 新增 `logCreateView` / `logEditView`，`openLogForm` 按显式 ID 或缺失日期分别建立 `mode:'create'|'edit'` 草稿；只共享日期/标签/正文/任务字段组件，重建入口各用自身视图 | 日志专项：缺失日期创建、显式 ID 编辑、子页返回、并发冲突保留创建草稿；模式与目标不串用 |
| 1.2 只读编辑日期 | 编辑不再构造日期候选或 disabled select，改用 `.p-log-date-readonly` 展示字段；`syncLogDraft` 只在 create 读日期；保存路径按 `id` 更新原记录，create 冲突提示从详情编辑、不转编辑 | 专项：单一只读日期、无 `option`、`mode/id` 断言；保存后同一 ID、业务日期与 `createdAt` 不变；冻结/他人/到期由服务端原规则拒绝（`check_log_backfill_entry.py`、`check_fixed_workspace_access.py`） |
| 2.1 布局对齐 | `.p-log-meta` 两列/窄屏单列；`.p-log-date-readonly` 与标签 select 同高（50px）、同内边距/圆角/边框；320/390/1440 真实测量 | 专项 `logGeometry` 通过（高度差<1px、同排或同列、无横溢）；截图 `output/entry-refinement/create-aligned-*.png`、`edit-aligned-*.png` |
| 2.2 原流程衔接 | 日志仍单选标签（`tagSelectHTML`）、可选关联任务搜索/清除/受限关系、详情评论；本人列表/卡片/嵌套按钮与人员日志隔离保持 | 日志专项 + `check_fixed_workspace_access.py` + 人员日志专段 |
| 3.1 可见文案 | 删除标签选择长说明（“标签由创始人统一维护…”）、标签管理两处规则段、日志归属段、任务详情父子规则段，缩短交接/预设说明；登录/个人资料必要校验与管理员维护提示保留 | 日志专项 DOM 断言：日志表单无标签/归属长段、标签字段名只有“标签”；员工五页与二级页人工/DOM 检查 |
| 3.2 分析页来源 | `methodNames` 将 `local_proportional_schedule_rules`/`current_effective_tasks` 映射为“本地规则统计/当前有效任务”；规则段改为简短描述，仍说明本地规则、不调用外部模型 | 专项：分析页文本含“本地规则统计”“生成于”，不含原始方法码 |
| 3.3 管理端文案 | `admin.html` 登录说明去掉“服务端拒绝”，历史说明去掉“真实管理接口”；保留原子保存、停用/交接确认、180 秒撤回与只读/失权提示 | `check_admin_console.py` 40/40（含管理端浏览器流程、空态/失败/确认状态） |
| 4.1 旧断言更新 | `check_log_backfill_entry_browser.js` 编辑断言从 `lf-date.disabled` 改为“非 select、只读、单一日期、无候选、目标 ID”；`check_fixed_employee_browser.js` 同步改该假设并展开下属树；`check_admin_contract.py` 完成待审先由直属上级批准 | 日志专项 50 项；管理端 40 项；`check_fixed_workspace_access.py` 通过 |
| 4.2 全局文案核对 | 静态来源逐项审查（见下）；真实 DOM/截图核对；用户正文含“标签/原型”同词仍原样保存 | 日志专项：正文写入“标签 原型”后回读一致；不再新增逐字镜像测试 |
| 4.3 构建与交接 | 构建、资源逐字节、预览重启、本交接 | 见下表 |

### 文案去留清单（实际可达界面）

| 位置 | 原内容用途 | 处理 |
| --- | --- | --- |
| 标签选择（任务表单）：`P.tagSelectHTML` | 维护/单选/多选/删除规则长说明 | 删除；保留标签名、已删除状态与控件 |
| 标签管理（“我的”入口、管理弹层） | 重复维护说明 | 删除段落；保留“打开标签管理”与表单 |
| 日志创建/编辑表单 | 本人归属与上级只读规则段 | 删除；保留冻结提示与字段 |
| 任务详情：子任务 | 父子推进规则 | 删除；保留子任务列表 |
| 专用交接 / 交接预设 | 交接与路线说明 | 缩短为“只替换负责人，不改标题、排期等字段”“预设仅用于专用交接申请” |
| 分析页 | 原始方法代码、长规则说明 | 方法映射中文；规则说明缩短；保留生成时间、范围、本地规则与不修改任务 |
| 个人资料/登录 | 密码规则、管理员维护字段 | 保留（必要校验/来源提示） |
| 管理端登录/历史 | “服务端拒绝”“真实管理接口” | 改为业务语言；保留原子保存、危险确认与撤回规则 |

## 本轮实际检查（2026-11-01，项目根目录）

浏览器 `CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`；集成脚本各自创建并清理随机测试库。

| 命令 | 结果 / 证据 |
| --- | --- |
| `python3 backend/scripts/check_log_backfill_entry.py` | 退出 0；**50** 项。`output/entry-refinement/` 报告与 `create-aligned-*`、`edit-aligned-*` 截图 |
| `python3 backend/scripts/check_admin_console.py` | 退出 0；40/40（管理端真实浏览器、确认/失败/空态、原子保存） |
| `python3 backend/scripts/check_fixed_communication_web.py` | 退出 0；32 项（标签维护、评论、通知、回归） |
| `python3 backend/scripts/check_task_creation_refinement.py` | 退出 0；36 API + 39 浏览器 |
| `python3 backend/scripts/check_fixed_workspace_access.py` | 退出 0（人员/日志授权、跨范围拒绝） |
| `cd backend && mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package` | 111 项单元测试，0 失败/错误/跳过；BUILD SUCCESS |
| `cd backend && python3 scripts/check_web_resources.py --repo .. --jar target/pandora-backend-0.1.0.jar --output ../audit/.../web-resources-logs.json` | 14/14；资源与源码逐字节一致，`?v=` 已刷新 |
| 本地预览（`service.py stop demo` 后以 `pandora_demo` 原库重启） | health=UP；工作区/标签/任务接入/主题/HTML 与源码 SHA256 一致 |
| `openspec validate separate-log-forms-and-clean-product-copy --strict` | 通过 |
| `python3 backend/scripts/check_work_logs.py`（旧入口） | **未全绿**：`check_fixed_workspace_access.py` 通过；`check_fixed_web.py` 员工端仍停在旧“人员日志入口/部门筛选”断言（已被 staff 工作页与 self-only 日志页取代，属其他 change 范围），本次未删除这些旧断言 |

## Verification reminders

- 编辑界面没有日期候选；`#lf-date` 在编辑模式是只读 div（`aria-readonly=true`），创建模式才是 select。验证时不要再用 `.disabled`。
- 创建冲突仍保留创建草稿并提示从详情编辑；不会切换 `mode` 或写入他人记录。
- 标签长说明删除后，任务多选仍由 `taskTagsHTML` 药丸控件表达；日志仍单选。删除的是说明段，不是能力。
- 分析页方法名现在映射中文；`local_proportional_schedule_rules` 不应再出现在可见文本中，真实范围/生成时间/本地规则说明保留。
- 用户正文/评论/审核意见中的“标签”“原型”等词不会被过滤；专项已用含同词正文回读验证。
- `check_work_logs.py` 的旧员工端断言仍失败，属已归档/其他活跃 change 取代的界面，不应据此判本 change 失败；当前日志回归以 `check_log_backfill_entry.py` 为准。
- 已刷新 `潘多拉-交互原型.html`/`admin.html` 的资源版本；再次修改资源后需重新刷新。
- 未进行手机真机/软键盘测试；未发布云端、未推送 Git、未归档。

## Historical（仍有效）

- 本 change 与已归档 `simplify-personal-log-page` 的 self-only、卡片详情、日期/标签对齐并行；本次只改编辑日期呈现方式与文案，未减少字段或权限。
- 早期 apply 记录中的旧机器路径与旧 revision 由本记录取代。
